import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddTaskModal } from '../components/AddTaskModal';
import { Column } from '../types';

const column: Column = {
  id: 'c1',
  title: 'Backlog',
  order: 0,
  boardId: 'b1',
  tasks: [],
};

describe('AddTaskModal', () => {
  it('submits title and description', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <AddTaskModal column={column} submitting={false} onClose={onClose} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Ship the feature' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Across all environments' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(onSubmit).toHaveBeenCalledWith('Ship the feature', 'Across all environments');
  });

  it('does not submit an empty title', () => {
    const onSubmit = vi.fn();
    render(
      <AddTaskModal
        column={column}
        submitting={false}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes when cancel is pressed', () => {
    const onClose = vi.fn();
    render(
      <AddTaskModal
        column={column}
        submitting={false}
        onClose={onClose}
        onSubmit={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the submit button while submitting', () => {
    render(
      <AddTaskModal
        column={column}
        submitting={true}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });
});
