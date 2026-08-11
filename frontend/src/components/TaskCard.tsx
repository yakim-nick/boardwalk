import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onDragStart: (task: Task) => void;
  onDragEnd?: () => void;
}

/** A draggable task card showing its title and optional description. */
export function TaskCard({ task, onDragStart, onDragEnd }: TaskCardProps) {
  return (
    <article
      className="task-card"
      draggable
      onDragStart={(e) => {
        // The task id travels with the drag so the drop target can verify
        // it is dropping the card that actually started the drag.
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task);
      }}
      onDragEnd={onDragEnd}
    >
      <p className="task-card-title">{task.title}</p>
      {task.description && <p className="task-card-description">{task.description}</p>}
    </article>
  );
}