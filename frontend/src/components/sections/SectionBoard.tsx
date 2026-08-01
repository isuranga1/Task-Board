import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { Section, Subsection, Task, TaskStatus } from "../../types";
import { SubsectionGroup } from "./SubsectionGroup";
import { TaskCardOverlay } from "../board/TaskCard";

interface SectionBoardProps {
  section: Section;
  tasksBySubsection: Map<number | null, Task[]>;
  onMoveTask: (taskId: number, changes: { status: TaskStatus; subsection_id: number | null }) => void;
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onAddTask: (subsectionId: number | null, title: string) => void;
  onOpenTask: (task: Task) => void;
  onRenameGroup: (subsectionId: number, name: string) => void;
  onDeleteGroup: (subsectionId: number) => void;
  onReorderSubsections: (newOrder: Subsection[]) => void;
}

// One shared DndContext for every group in the active section — this is
// what makes it possible to drag a task out of one group's board and drop
// it into another group's column, not just between columns within the same
// group. Group headers are dragged via dnd-kit's sortable list on top of
// the same context, distinguished from task drags via `data.type`.
export function SectionBoard({
  section,
  tasksBySubsection,
  onMoveTask,
  onToggleSubtask,
  onAddTask,
  onOpenTask,
  onRenameGroup,
  onDeleteGroup,
  onReorderSubsections,
}: SectionBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeGroup, setActiveGroup] = useState<Subsection | null>(null);

  const subsections = section.subsections;

  function findTask(taskId: number): Task | undefined {
    for (const bucket of tasksBySubsection.values()) {
      const found = bucket.find((t) => t.id === taskId);
      if (found) return found;
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (active.data.current?.type === "group") {
      const subsectionId = active.data.current.subsectionId as number | null;
      setActiveGroup(subsections.find((s) => s.id === subsectionId) ?? null);
    } else {
      setActiveTask(findTask(Number(active.id)) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setActiveGroup(null);
    if (!over) return;

    if (active.data.current?.type === "group") {
      const oldIndex = subsections.findIndex((s) => `group:${s.id}` === active.id);
      const newIndex = subsections.findIndex((s) => `group:${s.id}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onReorderSubsections(arrayMove(subsections, oldIndex, newIndex));
      }
      return;
    }

    // Task drag: `over.id` is a column's dropId, shaped "<subsectionKey>::<status>".
    const [subKey, status] = String(over.id).split("::");
    if (!status) return; // dropped on something that isn't a column (shouldn't happen, but be safe)

    const newSubsectionId = subKey === "none" ? null : Number(subKey);
    const newStatus = status as TaskStatus;
    const task = findTask(Number(active.id));
    if (task && (task.status !== newStatus || task.subsection_id !== newSubsectionId)) {
      onMoveTask(task.id, { status: newStatus, subsection_id: newSubsectionId });
    }
  }

  const generalTasks = tasksBySubsection.get(null) ?? [];
  const showGeneral = generalTasks.length > 0 || subsections.length === 0;
  const groupIds = subsections.map((s) => `group:${s.id}`);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setActiveGroup(null);
      }}
    >
      {showGeneral && (
        <SubsectionGroup
          key="general"
          subsection={null}
          tasks={generalTasks}
          onToggleSubtask={onToggleSubtask}
          onAddTask={(title) => onAddTask(null, title)}
          onOpenTask={onOpenTask}
          onRenameGroup={onRenameGroup}
          onDeleteGroup={onDeleteGroup}
        />
      )}

      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        {subsections.map((sub) => (
          <SubsectionGroup
            key={sub.id}
            subsection={sub}
            tasks={tasksBySubsection.get(sub.id) ?? []}
            onToggleSubtask={onToggleSubtask}
            onAddTask={(title) => onAddTask(sub.id, title)}
            onOpenTask={onOpenTask}
            onRenameGroup={onRenameGroup}
            onDeleteGroup={onDeleteGroup}
          />
        ))}
      </SortableContext>

      <DragOverlay>
        {activeTask && <TaskCardOverlay task={activeTask} />}
        {activeGroup && (
          <div className="glass rounded-2xl px-4 py-2.5 shadow-2xl scale-105">
            <p className="text-sm font-semibold text-white">{activeGroup.name}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
