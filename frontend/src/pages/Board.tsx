import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { connectSocket } from '../api/socket';
import { BoardWithColumns, Column, Task } from '../types';
import { BoardColumn } from '../components/BoardColumn';
import { AddTaskModal } from '../components/AddTaskModal';

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}

function applyRealtimeEvent(board: BoardWithColumns, type: string, data: Record<string, unknown>): BoardWithColumns {
  const columns = [...board.columns];
  switch (type) {
    case 'task.created': {
      const task = data.task as Task;
      const idx = columns.findIndex((c) => c.id === task.columnId);
      if (idx === -1) return board;
      columns[idx] = { ...columns[idx], tasks: sortTasks([...columns[idx].tasks, task]) };
      return { ...board, columns };
    }
    case 'task.updated': {
      const task = data.task as Task;
      let changed = false;
      const next = columns.map((c) => {
        if (c.tasks.some((t) => t.id === task.id)) {
          changed = true;
          return { ...c, tasks: c.tasks.filter((t) => t.id !== task.id) };
        }
        return c;
      });
      if (!changed) return board;
      const targetIdx = next.findIndex((c) => c.id === task.columnId);
      if (targetIdx === -1) return board;
      next[targetIdx] = { ...next[targetIdx], tasks: sortTasks([...next[targetIdx].tasks, task]) };
      return { ...board, columns: next };
    }
    case 'task.deleted': {
      const { taskId } = data as { taskId: string };
      return {
        ...board,
        columns: columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })),
      };
    }
    default:
      return board;
  }
}

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, logout } = useAuth();
  const [board, setBoard] = useState<BoardWithColumns | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [modalColumn, setModalColumn] = useState<Column | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const boardRef = useRef<BoardWithColumns | null>(null);
  boardRef.current = board;

  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const { board } = await api.getBoard(boardId);
      setBoard(board);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load board');
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoading(true);
    api
      .getBoard(boardId)
      .then(({ board }) => {
        if (!cancelled) setBoard(board);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load board');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    const disconnect = connectSocket(
      {
        onStatusChange: setConnected,
        onEvent: (event) => {
          if (event.type === 'subscribed') return;
          if (event.type === 'reconnected') {
            void loadBoard();
            return;
          }
          if (event.type === 'task.created' || event.type === 'task.updated' || event.type === 'task.deleted') {
            const current = boardRef.current;
            if (!current || event.boardId !== current.id) return;
            setBoard((prev) => (prev ? applyRealtimeEvent(prev, event.type, event.data) : prev));
          } else if (event.type === 'column.added' && boardRef.current && event.boardId === boardRef.current.id) {
            void loadBoard();
          }
        },
      },
      boardId
    );

    return disconnect;
  }, [boardId, loadBoard]);

  const moveTask = useCallback(
    async (columnId: string, task: Task, targetOrder: number) => {
      const boardId = boardRef.current?.id;
      if (!boardId) return;
      const apply = (prev: BoardWithColumns | null): BoardWithColumns | null =>
        prev ? applyRealtimeEvent(prev, 'task.updated', { task: { ...task, columnId, order: targetOrder } }) : prev;
      setBoard(apply);
      setActionError(null);
      try {
        await api.updateTask(boardId, task.id, { columnId, order: targetOrder });
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not move task');
        await loadBoard();
      }
    },
    [loadBoard]
  );

  const createTask = useCallback(
    async (title: string, description: string) => {
      const boardId = boardRef.current?.id;
      if (!boardId || !modalColumn) return;
      setSubmitting(true);
      setActionError(null);
      try {
        await api.createTask(boardId, { title, description, columnId: modalColumn.id });
        setModalColumn(null);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not create task');
      } finally {
        setSubmitting(false);
      }
    },
    [modalColumn]
  );

  const addColumn = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const boardId = boardRef.current?.id;
      if (!boardId || !newColumnTitle.trim()) return;
      setActionError(null);
      try {
        await api.addColumn(boardId, newColumnTitle.trim());
        setNewColumnTitle('');
        await loadBoard();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not add column');
      }
    },
    [newColumnTitle, loadBoard]
  );

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (loadError || !board) {
    return (
      <div className="screen-center">
        <div className="card auth-card">
          <h1>Something went wrong</h1>
          <p>{loadError ?? 'Board not found'}</p>
          <Link className="btn btn-primary" to="/">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <Link to="/" className="brand-link">
            <span className="brand-mark">⬡</span> FlowBoard
          </Link>
        </div>
        <div className="topbar-actions">
          <span className={`live-indicator ${connected ? 'live' : ''}`}>
            {connected ? '● Live' : '○ Reconnecting…'}
          </span>
          <span className="user-chip">{user?.name}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="container board-container">
        <div className="board-head">
          <h1>{board.name}</h1>
          <Link className="btn btn-ghost" to="/">
            ← All boards
          </Link>
        </div>

        {actionError && (
          <div className="alert alert-error" role="alert">
            {actionError}
          </div>
        )}

        <div className="board-columns">
          {board.columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              draggingTask={draggingTask}
              onDragStart={setDraggingTask}
              onDragEnd={() => setDraggingTask(null)}
              onDropTask={moveTask}
              onAddTask={setModalColumn}
            />
          ))}

          <form className="column add-column" onSubmit={addColumn}>
            <input
              type="text"
              placeholder="Add column…"
              value={newColumnTitle}
              maxLength={60}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              aria-label="New column name"
            />
            <button className="btn btn-ghost" type="submit" disabled={!newColumnTitle.trim()}>
              Add column
            </button>
          </form>
        </div>
      </main>

      {modalColumn && (
        <AddTaskModal
          column={modalColumn}
          submitting={submitting}
          onClose={() => setModalColumn(null)}
          onSubmit={createTask}
        />
      )}
    </div>
  );
}
