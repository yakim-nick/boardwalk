import { RefObject, useRef, useState } from 'react';
import { Column, Task } from '../types';
import { TaskCard } from './TaskCard';

interface BoardColumnProps {
  column: Column;
  draggingTask: Task | null;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  onDropTask: (columnId: string, task: Task, targetOrder: number) => void;
  onAddTask: (column: Column) => void;
}

/**
 * Computes the insertion index for a drop at `clientY` by comparing against
 * the midpoint of each rendered card. Falls back to appending at the end.
 */
function computeDropTargetOrder(
  listRef: RefObject<HTMLUListElement | null>,
  clientY: number,
  fallbackOrder: number
): number {
  const cards = listRef.current ? Array.from(listRef.current.children) : [];
  for (let i = 0; i < cards.length; i++) {
    const rect = (cards[i] as HTMLElement).getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return i;
    }
  }
  return fallbackOrder;
}

/** A single board column: header, task list, and drop/add-task handling. */
export function BoardColumn({
  column,
  draggingTask,
  onDragStart,
  onDragEnd,
  onDropTask,
  onAddTask,
}: BoardColumnProps) {
  const [over, setOver] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  /** Resolves the drop position and delegates the move to the parent. */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    onDragEnd();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = draggingTask;
    if (!task || task.id !== taskId) return;

    const targetOrder = computeDropTargetOrder(listRef, e.clientY, column.tasks.length);
    onDropTask(column.id, task, targetOrder);
  };

  return (
    <section
      className={`column ${over ? 'column-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <header className="column-header">
        <h2>{column.title}</h2>
        <span className="count-badge">{column.tasks.length}</span>
      </header>

      <ul className="task-list" ref={listRef}>
        {column.tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          </li>
        ))}
      </ul>

      <button className="btn btn-ghost btn-block add-task" onClick={() => onAddTask(column)}>
        + Add task
      </button>
    </section>
  );
}
