import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from '../components/TaskCard';
import { Task } from '../types';

const task: Task = {
  id: 't1',
  title: 'Write the README',
  description: 'Document the setup steps',
  order: 0,
  columnId: 'c1',
  boardId: 'b1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('TaskCard', () => {
  it('renders title and description', () => {
    render(<TaskCard task={task} onDragStart={() => undefined} />);
    expect(screen.getByText('Write the README')).toBeInTheDocument();
    expect(screen.getByText('Document the setup steps')).toBeInTheDocument();
  });

  it('is draggable', () => {
    render(<TaskCard task={task} onDragStart={() => undefined} />);
    expect(screen.getByRole('article')).toHaveAttribute('draggable', 'true');
  });

  it('does not render a description when absent', () => {
    render(<TaskCard task={{ ...task, description: null }} onDragStart={() => undefined} />);
    expect(screen.queryByText('Document the setup steps')).not.toBeInTheDocument();
    expect(screen.getByText('Write the README')).toBeInTheDocument();
  });
});
