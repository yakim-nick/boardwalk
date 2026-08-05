import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { Board } from '../types';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listBoards()
      .then(({ boards }) => {
        if (!cancelled) setBoards(boards);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load boards');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { board } = await api.createBoard(name);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create board');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⬡</span> FlowBoard
        </div>
        <div className="topbar-actions">
          <span className="user-chip">{user?.name}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <h1>Your boards</h1>
          <p>Create a board and collaborate in real time.</p>
        </section>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form className="card new-board" onSubmit={onCreate}>
          <input
            type="text"
            placeholder="New board name…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            aria-label="New board name"
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create board'}
          </button>
        </form>

        {loading ? (
          <div className="screen-center-inline">
            <div className="spinner" />
          </div>
        ) : boards.length === 0 ? (
          <div className="card empty-state">
            <p>No boards yet. Create your first board to get started.</p>
          </div>
        ) : (
          <ul className="board-grid">
            {boards.map((board) => (
              <li key={board.id}>
                <Link className="card board-tile" to={`/boards/${board.id}`}>
                  <span className="board-tile-title">{board.name}</span>
                  <span className="board-tile-date">
                    Created {new Date(board.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
