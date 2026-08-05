import { api } from "../../api/client";
import { TaskDetailModal } from "../board/TaskDetailModal";
import type { Section, Task } from "../../types";

interface TaskDetailHostProps {
  task: Task;
  sections: Section[];
  /** Every task across all sections — narrowed to the task's own section here. */
  allTasks: Task[];
  onClose: () => void;
  /** Called with the server's updated task after any successful mutation. */
  onChanged: (task: Task) => void;
  onDeleted: (taskId: number) => void;
}

/**
 * Wires TaskDetailModal up to the API for the cross-section views.
 *
 * The Dashboard drives the same modal through `useTasks`, which exists to serve
 * one section's board and its optimistic drag-and-drop. Deadlines and Calendar
 * span every section, so they'd have to instantiate that hook per section to
 * reuse it. This talks to the API directly instead and reports the updated task
 * back up, which is all either page needs to stay in sync.
 */
export function TaskDetailHost({
  task,
  sections,
  allTasks,
  onClose,
  onChanged,
  onDeleted,
}: TaskDetailHostProps) {
  const section = sections.find((s) => s.id === task.section_id);

  // Dependencies only make sense within a section — the board's picker is
  // scoped that way, and widening it here would make the two disagree.
  const sectionTasks = allTasks.filter((t) => t.section_id === task.section_id);

  // Subtask writes return the SUBTASK, not the parent task, so the modal's
  // view of `task.subtasks` has to be rebuilt locally rather than swapped
  // wholesale the way every other mutation below can be.
  async function refetchTask() {
    onChanged(await api.getTask(task.id));
  }

  return (
    <TaskDetailModal
      task={task}
      subsections={section?.subsections ?? []}
      sectionTasks={sectionTasks}
      onClose={onClose}
      onSave={async (payload) => onChanged(await api.updateTask(task.id, payload))}
      onDelete={async () => {
        await api.deleteTask(task.id);
        onDeleted(task.id);
        onClose();
      }}
      onUploadAttachment={async (file) => onChanged(await api.uploadAttachment(task.id, file))}
      onDeleteAttachment={async (filename) =>
        onChanged(await api.deleteAttachment(task.id, filename))
      }
      onAddDependency={async (id) => onChanged(await api.addDependency(task.id, id))}
      onRemoveDependency={async (id) => onChanged(await api.removeDependency(task.id, id))}
      onAddSubtask={async (title) => {
        await api.createSubtask(task.id, title);
        await refetchTask();
      }}
      onToggleSubtask={async (subtaskId, isDone) => {
        await api.toggleSubtask(subtaskId, isDone);
        await refetchTask();
      }}
      onDeleteSubtask={async (subtaskId) => {
        await api.deleteSubtask(subtaskId);
        await refetchTask();
      }}
    />
  );
}
