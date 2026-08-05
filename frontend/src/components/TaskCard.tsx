import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onDragStart: (task: Task) => void;
  onDragEnd?: () => void;
}

export function TaskCard({ task, onDragStart, onDragEnd }: TaskCardProps) {
  return (
    <article
      className="task-card"
      draggable
      onDragStart={(e) => {
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
