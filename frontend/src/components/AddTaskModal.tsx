import { FormEvent, useState } from 'react';
import { Column } from '../types';

interface AddTaskModalProps {
  column: Column;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
}

/** Modal for creating a task in a specific column. */
export function AddTaskModal({ column, submitting, onClose, onSubmit }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  /** Submits trimmed values; ignores empty titles. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-task-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="add-task-title">Add task to “{column.title}”</h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              maxLength={200}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              maxLength={2000}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
            />
          </label>

          <div className="modal-actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}