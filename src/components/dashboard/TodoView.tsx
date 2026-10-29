import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Plus,
  SlidersHorizontal,
  Check,
  ExternalLink,
  Link2,
  ListChecks,
  LayoutGrid,
  GripVertical,
} from 'lucide-react';
import { format, isThisMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { SearchPill } from '../ui';
import NoteCard from './NoteCard';
import NoteDetailModal from './NoteDetailModal';
import NewTodoModal from './NewTodoModal';
import AskAiButton from './AskAiButton';
import AskAiModal from './AskAiModal';
import NotesFilterPopover, {
  type TodoDateFilter,
  type TodoStatusFilter,
} from './NotesFilterPopover';
import type { TodoEntry } from '@/db/schema';

export interface TodoItem {
  id: string;
  content: string;
  category: string;
  specificTags?: string[] | null;
  source?: string | null;
  isPinned?: boolean;
  isProcessed?: boolean;
  todos?: TodoEntry[] | null;
  attachments?: Array<{
    fileId: string;
    type: 'image' | 'file';
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
    localPath?: string;
  }> | null;
  createdAt: string;
}

export interface FlatTodoItem {
  id: string;
  noteId: string;
  todoId: string;
  task: string;
  isCompleted: boolean;
  completedAt?: string | null;
  priority?: 'low' | 'normal' | 'high' | null;
  createdAt: Date;
  isPinned: boolean;
  tags: string[];
  rawNote: TodoItem;
}

interface TodoViewProps {
  initialItems: TodoItem[];
  userName?: string | null;
}

interface TodoItemCardProps {
  todo: FlatTodoItem;
  isHidden?: boolean;
  isDraggable?: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onGripPointerDown?: (e: React.PointerEvent) => void;
}

function TodoItemCard({
  todo,
  isHidden = false,
  isDraggable = true,
  onToggle,
  onOpenDetail,
  onGripPointerDown,
}: TodoItemCardProps) {
  // Extract external web link if present in task or source note
  const extractedUrl = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const matchTask = todo.task.match(urlRegex);
    if (matchTask) return matchTask[0];
    const matchRaw = todo.rawNote?.content?.match(urlRegex);
    if (matchRaw) return matchRaw[0];
    return null;
  }, [todo.task, todo.rawNote]);

  // Context chip: tag or parent note topic if multi-item note
  const parentContext = useMemo(() => {
    if (todo.tags && todo.tags.length > 0) {
      return `#${todo.tags[0]}`;
    }
    if (todo.rawNote?.todos && todo.rawNote.todos.length > 1) {
      const firstLine = todo.rawNote.content.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
      if (firstLine && firstLine !== todo.task && firstLine.length < 25) {
        return firstLine;
      }
    }
    return null;
  }, [todo.tags, todo.rawNote, todo.task]);

  return (
    <div
      data-todo-card
      className={`group flex items-start gap-2 py-2 px-2.5 sm:px-3 rounded-xl border border-hairline w-fit max-w-full transition-colors select-none ${
        isHidden ? 'hidden' : ''
      } ${
        todo.isCompleted
          ? 'bg-surface-soft/40 border-hairline/60 opacity-65'
          : 'bg-canvas hover:border-hairline-strong hover:shadow-xs'
      }`}
    >
      {/* 1. Draggable Grip Handle Icon (Only handle initiates drag) */}
      {isDraggable && (
        <div
          onPointerDown={onGripPointerDown}
          className="mt-0.5 text-mute/40 group-hover:text-ink cursor-grab active:cursor-grabbing shrink-0 transition-colors p-1 -ml-1 touch-none select-none"
          title="Tarik ikon ini untuk memindahkan prioritas"
          aria-label="Tarik ikon untuk memindahkan prioritas"
        >
          <GripVertical className="w-3.5 h-3.5 pointer-events-none" />
        </div>
      )}

      {/* 2. Interactive Checkbox Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
          todo.isCompleted
            ? 'bg-ink border-ink text-canvas'
            : 'border-hairline-strong bg-canvas hover:border-ink'
        }`}
        title={todo.isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
        aria-label={todo.isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
      >
        {todo.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </button>

      {/* 3. Task Content, External Web Link, Source Modal Link, and Context Chip */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
        <span
          className={`text-body-sm leading-relaxed break-words [overflow-wrap:anywhere] select-text font-sans ${
            todo.isCompleted
              ? 'line-through text-mute font-normal'
              : 'text-ink font-medium'
          }`}
        >
          {todo.task}
        </span>

        {/* Direct Mini Link Icon to Web URL (if URL present in task/note) */}
        {extractedUrl && (
          <a
            href={extractedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center text-mute hover:text-ink cursor-pointer transition-colors shrink-0 !border-0 bg-transparent p-0.5"
            title={`Buka web: ${extractedUrl}`}
            aria-label="Buka web eksternal"
          >
            <Link2 className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Reverse Link Action: Pure icon directly next to task */}
        <button
          type="button"
          onClick={onOpenDetail}
          className="inline-flex items-center justify-center text-mute hover:text-ink cursor-pointer transition-colors shrink-0 !border-0 bg-transparent p-0.5"
          title="Lihat catatan asli"
          aria-label="Lihat catatan asli"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>

        {/* Parent Context Chip (Tag or Parent Note Topic) */}
        {parentContext && (
          <span
            className="text-[10px] text-mute/80 bg-surface-soft px-1.5 py-0.5 rounded-md font-mono shrink-0 select-none"
            title={`Konteks: ${parentContext}`}
          >
            {parentContext}
          </span>
        )}

        {/* Date adjacent to task title (hidden on mobile breakpoint) */}
        <span className="hidden md:inline text-[11px] text-mute font-mono shrink-0 select-none">
          {format(todo.createdAt, 'd MMM yyyy', { locale: localeId })}
        </span>

        {/* Pinned Badge */}
        {todo.isPinned && (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-medium shrink-0 select-none">
            Pinned
          </span>
        )}
      </div>
    </div>
  );
}

export default function TodoView({ initialItems, userName }: TodoViewProps) {
  const [items, setItems] = useState<TodoItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<'checklist' | 'cards'>('checklist');
  // Default status filter is 'all' (all tasks shown by default)
  const [statusFilter, setStatusFilter] = useState<TodoStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<TodoDateFilter>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Drag and drop state
  const [draggedTodo, setDraggedTodo] = useState<FlatTodoItem | null>(null);
  const [hiddenTodoId, setHiddenTodoId] = useState<string | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOverColumn, setDragOverColumn] = useState<'unassigned' | 'low' | 'normal' | 'high' | null>(null);

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Modals state
  const [activeTodoModal, setActiveTodoModal] = useState<TodoItem | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'read' | 'edit'>('view');
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  // Quick In-Place Task Input state
  const [quickTaskText, setQuickTaskText] = useState('');
  const [isAddingQuickTask, setIsAddingQuickTask] = useState(false);

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickTaskText.trim();
    if (!text || isAddingQuickTask) return;

    setIsAddingQuickTask(true);
    const tempId = `temp-todo-${Date.now()}`;
    const todoId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `todo-${Date.now()}`;
    const initialTodos = [
      {
        id: todoId,
        task: text,
        isCompleted: false,
        completedAt: null,
        priority: null,
      },
    ];

    const optimisticItem: TodoItem = {
      id: tempId,
      content: text,
      category: 'todo',
      specificTags: [],
      source: 'web',
      isPinned: false,
      isProcessed: true,
      todos: initialTodos,
      createdAt: new Date().toISOString(),
    };

    handleTaskCreated(optimisticItem);
    setQuickTaskText('');

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          category: 'todo',
          todos: initialTodos,
        }),
      });

      if (!res.ok) {
        throw new Error('Gagal menyimpan tugas');
      }
      toast.success('Tugas ditambahkan ke Inbox');
    } catch {
      toast.error('Gagal menambahkan tugas cepat');
    } finally {
      setIsAddingQuickTask(false);
    }
  };

  const handleOpenDetail = (item: TodoItem) => {
    setActiveTodoModal(item);
    setModalMode('view');
  };

  const handleOpenEdit = (item: TodoItem) => {
    setActiveTodoModal(item);
    setModalMode('edit');
  };

  // Sorting helper for raw notes
  const sortNotes = (list: TodoItem[]) => {
    return [...list].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  // Toggle Pin on raw note
  const handleTogglePinState = async (id: string, nextPinned: boolean) => {
    setItems((prev) =>
      sortNotes(prev.map((i) => (i.id === id ? { ...i, isPinned: nextPinned } : i)))
    );

    if (activeTodoModal?.id === id) {
      setActiveTodoModal((prev) => (prev ? { ...prev, isPinned: nextPinned } : null));
    }

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });

      if (!res.ok) throw new Error('Gagal toggle pin');
      toast.success(nextPinned ? 'Catatan tugas disematkan ke atas' : 'Semat dilepas');
    } catch {
      setItems((prev) =>
        sortNotes(prev.map((i) => (i.id === id ? { ...i, isPinned: !nextPinned } : i)))
      );
      if (activeTodoModal?.id === id) {
        setActiveTodoModal((prev) => (prev ? { ...prev, isPinned: !nextPinned } : null));
      }
      toast.error('Gagal memperbarui status pin');
    }
  };

  // Delete note
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (activeTodoModal?.id === id) {
          setActiveTodoModal(null);
        }
        toast.success('Catatan tugas berhasil dihapus');
      } else {
        toast.error('Gagal menghapus catatan tugas');
      }
    } catch {
      toast.error('Gagal menghapus catatan tugas');
    }
  };

  // Callback after task created from modal
  const handleTaskCreated = (newTask: TodoItem) => {
    setItems((prev) => sortNotes([newTask, ...prev]));
    toast.success('Tugas baru berhasil ditambahkan');
  };

  // Callback after task edited
  const handleTaskUpdated = (updatedNote: any) => {
    setItems((prev) =>
      sortNotes(
        prev.map((i) =>
          i.id === updatedNote.id ? { ...i, ...updatedNote } : i
        )
      )
    );
    if (activeTodoModal?.id === updatedNote.id) {
      setActiveTodoModal((prev) =>
        prev ? { ...prev, ...updatedNote } : null
      );
    }
  };

  // Flatten todos from all notes
  const allTodos: FlatTodoItem[] = useMemo(() => {
    const list: FlatTodoItem[] = [];
    for (const note of items) {
      const noteDate = new Date(note.createdAt);
      if (Array.isArray(note.todos) && note.todos.length > 0) {
        for (let i = 0; i < note.todos.length; i++) {
          const t = note.todos[i];
          list.push({
            id: `${note.id}-todo-${t.id || i}`,
            noteId: note.id,
            todoId: t.id || `todo-${i}`,
            task: t.task,
            isCompleted: Boolean(t.isCompleted),
            completedAt: t.completedAt,
            priority: t.priority || null,
            createdAt: noteDate,
            isPinned: Boolean(note.isPinned),
            tags: note.specificTags || [],
            rawNote: note,
          });
        }
      } else {
        // Fallback for notes awaiting AI sync or legacy items
        list.push({
          id: `${note.id}-todo-default`,
          noteId: note.id,
          todoId: 'default',
          task: note.content,
          isCompleted: false,
          completedAt: null,
          priority: null,
          createdAt: noteDate,
          isPinned: Boolean(note.isPinned),
          tags: note.specificTags || [],
          rawNote: note,
        });
      }
    }
    return list;
  }, [items]);

  // Date filter helper
  const matchesDateFilter = (d: Date) => {
    if (dateFilter === 'this_month') {
      return isThisMonth(d);
    }
    return true; // 'all'
  };

  // Tasks within current date filter
  const dateScopedTodos = useMemo(() => {
    return allTodos.filter((t) => matchesDateFilter(t.createdAt));
  }, [allTodos, dateFilter]);

  // Filtered todos according to Search & Status Filter
  const filteredTodos = useMemo(() => {
    return dateScopedTodos
      .filter((todo) => {
        // Status filter: 'all' or 'pending' (default: 'all')
        if (statusFilter === 'pending' && todo.isCompleted) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTask = todo.task.toLowerCase().includes(q);
          const matchTags = todo.tags.some((t) => t.toLowerCase().includes(q));
          const matchContent = todo.rawNote.content.toLowerCase().includes(q);
          return matchTask || matchTags || matchContent;
        }

        return true;
      })
      .sort((a, b) => {
        // 1. Pinned notes first
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        // 2. Incomplete tasks first
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        // 3. Priority Auto-Arrange: High (3) -> Normal (2) -> Low (1) -> None (0)
        const priorityWeight: Record<string, number> = {
          high: 3,
          normal: 2,
          low: 1,
        };
        const weightA = a.priority ? priorityWeight[a.priority] ?? 0 : 0;
        const weightB = b.priority ? priorityWeight[b.priority] ?? 0 : 0;
        if (weightA !== weightB) {
          return weightB - weightA;
        }
        // 4. Newest created first
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [dateScopedTodos, statusFilter, searchQuery]);

  // Priority partitioned todos
  const unassignedTodos = useMemo(
    () => filteredTodos.filter((t) => !t.priority),
    [filteredTodos]
  );

  const lowTodos = useMemo(
    () => filteredTodos.filter((t) => t.priority === 'low'),
    [filteredTodos]
  );

  const normalTodos = useMemo(
    () => filteredTodos.filter((t) => t.priority === 'normal'),
    [filteredTodos]
  );

  const highTodos = useMemo(
    () => filteredTodos.filter((t) => t.priority === 'high'),
    [filteredTodos]
  );

  // Group unassigned todos by note origin with gap separation
  const unassignedGroupedByNote = useMemo(() => {
    const groups: { noteId: string; rawNote: TodoItem; todos: FlatTodoItem[] }[] = [];
    const map = new Map<string, { noteId: string; rawNote: TodoItem; todos: FlatTodoItem[] }>();

    for (const todo of unassignedTodos) {
      let group = map.get(todo.noteId);
      if (!group) {
        group = { noteId: todo.noteId, rawNote: todo.rawNote, todos: [] };
        map.set(todo.noteId, group);
        groups.push(group);
      }
      group.todos.push(todo);
    }
    return groups;
  }, [unassignedTodos]);

  // Filtered raw notes for Card View
  const filteredCardNotes = useMemo(() => {
    return items.filter((item) => {
      if (!matchesDateFilter(new Date(item.createdAt))) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const contentMatch = item.content.toLowerCase().includes(query);
        const tagMatch = item.specificTags?.some((t) => t.toLowerCase().includes(query));
        return contentMatch || tagMatch;
      }

      return true;
    });
  }, [items, dateFilter, searchQuery]);

  // Toggle todo completion
  const handleToggleTodo = async (todo: FlatTodoItem) => {
    const targetNote = items.find((n) => n.id === todo.noteId);
    if (!targetNote) return;

    const nextCompleted = !todo.isCompleted;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => {
        if (n.id !== todo.noteId) return n;
        const currentTodos = Array.isArray(n.todos) ? [...n.todos] : [];

        if (todo.todoId === 'default' && currentTodos.length === 0) {
          return {
            ...n,
            todos: [
              {
                id: crypto.randomUUID(),
                task: n.content,
                isCompleted: nextCompleted,
                completedAt: nextCompleted ? new Date().toISOString() : null,
                priority: todo.priority || null,
              },
            ],
          };
        }

        return {
          ...n,
          todos: currentTodos.map((t) =>
            t.id === todo.todoId
              ? {
                  ...t,
                  isCompleted: nextCompleted,
                  completedAt: nextCompleted ? new Date().toISOString() : null,
                }
              : t
          ),
        };
      })
    );

    try {
      const res = await fetch(`/api/notes/${todo.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todoId: todo.todoId !== 'default' ? todo.todoId : undefined,
          todoIndex: todo.todoId === 'default' ? 0 : undefined,
          isCompleted: nextCompleted,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(
        nextCompleted ? 'Tugas ditandai selesai' : 'Tugas ditandai belum selesai'
      );
    } catch {
      // Rollback
      setItems((prev) =>
        prev.map((n) => (n.id === todo.noteId ? targetNote : n))
      );
      toast.error('Gagal memperbarui status tugas');
    }
  };

  // Update priority (via Drop or Dropdown select)
  const handlePriorityChange = async (
    todo: FlatTodoItem,
    targetPriority: 'low' | 'normal' | 'high' | null
  ) => {
    const currentPriority = todo.priority || null;
    if (currentPriority === targetPriority) return;

    const targetNote = items.find((n) => n.id === todo.noteId);
    if (!targetNote) return;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => {
        if (n.id !== todo.noteId) return n;
        const currentTodos = Array.isArray(n.todos) ? [...n.todos] : [];

        if (todo.todoId === 'default' && currentTodos.length === 0) {
          return {
            ...n,
            todos: [
              {
                id: crypto.randomUUID(),
                task: n.content,
                isCompleted: todo.isCompleted,
                completedAt: todo.completedAt || null,
                priority: targetPriority,
              },
            ],
          };
        }

        return {
          ...n,
          todos: currentTodos.map((t) =>
            t.id === todo.todoId ? { ...t, priority: targetPriority } : t
          ),
        };
      })
    );

    try {
      const res = await fetch(`/api/notes/${todo.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todoId: todo.todoId !== 'default' ? todo.todoId : undefined,
          todoIndex: todo.todoId === 'default' ? 0 : undefined,
          priority: targetPriority,
        }),
      });

      if (!res.ok) throw new Error('Gagal update priority');

      const priorityLabels: Record<string, string> = {
        low: 'Later',
        normal: 'Soon',
        high: 'Now',
      };
      if (targetPriority) {
        toast.success(`Dipindahkan ke ${priorityLabels[targetPriority]}`);
      } else {
        toast.success('Dipindahkan ke Inbox');
      }
    } catch {
      // Rollback
      setItems((prev) =>
        prev.map((n) => (n.id === todo.noteId ? targetNote : n))
      );
      toast.error('Gagal memperbarui prioritas tugas');
    }
  };

  const handlePriorityChangeRef = useRef(handlePriorityChange);
  handlePriorityChangeRef.current = handlePriorityChange;

  // Geometry-Aware Drop Zone Resolver (Generous Hit-Testing Coverage)
  const getZoneUnderPoint = (
    clientX: number,
    clientY: number,
    cardRect: DOMRect | null,
    offset: { x: number; y: number }
  ): 'low' | 'normal' | 'high' | 'unassigned' | null => {
    // 1. Calculate center coordinates of the dragged card
    const cardWidth = cardRect ? cardRect.width : 160;
    const cardHeight = cardRect ? cardRect.height : 40;
    const cardCenterX = clientX - offset.x + cardWidth / 2;
    const cardCenterY = clientY - offset.y + cardHeight / 2;

    // 2. Fast exact element check under pointer & card center
    const points = [
      { x: clientX, y: clientY },
      { x: cardCenterX, y: cardCenterY },
    ];
    for (const pt of points) {
      const el = document.elementFromPoint(pt.x, pt.y);
      const zoneEl = el?.closest('[data-priority-zone]');
      if (zoneEl) {
        const p = zoneEl.getAttribute('data-priority-zone') as any;
        if (p) return p;
      }
    }

    // 3. Geometry-based coverage for desktop columns & mobile rows
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobile) {
      // Desktop: side-by-side columns
      const desktopCols = Array.from(document.querySelectorAll<HTMLElement>('[data-desktop-column]'));
      if (desktopCols.length > 0) {
        const testX = clientX;
        const testY = clientY;
        for (let i = 0; i < desktopCols.length; i++) {
          const col = desktopCols[i];
          const rect = col.getBoundingClientRect();
          if (testY >= rect.top - 60 && testY <= rect.bottom + 60) {
            const prevBoundary = i === 0 ? rect.left - 40 : (desktopCols[i - 1].getBoundingClientRect().right + rect.left) / 2;
            const nextBoundary = i === desktopCols.length - 1 ? rect.right + 40 : (rect.right + desktopCols[i + 1].getBoundingClientRect().left) / 2;
            if (testX >= prevBoundary && testX <= nextBoundary) {
              return col.getAttribute('data-priority-zone') as any;
            }
          }
        }
        // Fallback test with card center coordinates
        for (let i = 0; i < desktopCols.length; i++) {
          const col = desktopCols[i];
          const rect = col.getBoundingClientRect();
          if (cardCenterY >= rect.top - 60 && cardCenterY <= rect.bottom + 60) {
            const prevBoundary = i === 0 ? rect.left - 40 : (desktopCols[i - 1].getBoundingClientRect().right + rect.left) / 2;
            const nextBoundary = i === desktopCols.length - 1 ? rect.right + 40 : (rect.right + desktopCols[i + 1].getBoundingClientRect().left) / 2;
            if (cardCenterX >= prevBoundary && cardCenterX <= nextBoundary) {
              return col.getAttribute('data-priority-zone') as any;
            }
          }
        }
      }
    } else {
      // Mobile: stacked rows
      const mobileRows = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-row]'));
      if (mobileRows.length > 0) {
        const testY = clientY;
        for (let i = 0; i < mobileRows.length; i++) {
          const row = mobileRows[i];
          const rect = row.getBoundingClientRect();
          const prevTop = i === 0 ? rect.top - 40 : (mobileRows[i - 1].getBoundingClientRect().bottom + rect.top) / 2;
          const nextBottom = i === mobileRows.length - 1 ? rect.bottom + 40 : (rect.bottom + mobileRows[i + 1].getBoundingClientRect().top) / 2;
          if (testY >= prevTop && testY <= nextBottom) {
            return row.getAttribute('data-priority-zone') as any;
          }
        }
      }
    }

    return null;
  };

  // Unified Pointer Drag-and-Drop Auto-Scroll Engine
  const autoScrollRef = useRef<{
    speed: number;
    rafId: number | null;
    pointerX: number;
    pointerY: number;
  }>({
    speed: 0,
    rafId: null,
    pointerX: 0,
    pointerY: 0,
  });

  const performAutoScroll = (deltaY: number) => {
    const mainEl = document.querySelector('main');
    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
      mainEl.scrollTop += deltaY;
      return;
    }
    if (document.documentElement && document.documentElement.scrollHeight > document.documentElement.clientHeight) {
      document.documentElement.scrollTop += deltaY;
      return;
    }
    window.scrollBy(0, deltaY);
  };

  // Unified Pointer Drag-and-Drop Engine (Desktop & Mobile)
  const dragRef = useRef<{
    todo: FlatTodoItem;
    pointerId: number;
    startX: number;
    startY: number;
    offset: { x: number; y: number };
    cardRect: DOMRect;
    isDragging: boolean;
  } | null>(null);

  const handleGripPointerDown = (e: React.PointerEvent, todo: FlatTodoItem) => {
    // Only primary button (left mouse click) or touch
    if (e.button !== 0) return;

    const cardEl = (e.currentTarget as HTMLElement).closest('[data-todo-card]') as HTMLElement;
    const rect = cardEl ? cardEl.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    dragRef.current = {
      todo,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offset: { x: offsetX, y: offsetY },
      cardRect: rect,
      isDragging: false,
    };
  };

  useEffect(() => {
    const stopAutoScroll = () => {
      autoScrollRef.current.speed = 0;
      if (autoScrollRef.current.rafId !== null) {
        cancelAnimationFrame(autoScrollRef.current.rafId);
        autoScrollRef.current.rafId = null;
      }
    };

    const startAutoScroll = () => {
      if (autoScrollRef.current.rafId !== null) return;

      const step = () => {
        if (!dragRef.current?.isDragging) {
          stopAutoScroll();
          return;
        }

        const { speed, pointerX, pointerY } = autoScrollRef.current;
        if (speed !== 0) {
          performAutoScroll(speed);

          // As page scrolls under the stationary finger/cursor, dynamically update drop zone highlight
          if (dragRef.current) {
            const priority = getZoneUnderPoint(
              pointerX,
              pointerY,
              dragRef.current.cardRect,
              dragRef.current.offset
            );
            setDragOverColumn(priority);
          }
        }

        if (dragRef.current?.isDragging && autoScrollRef.current.speed !== 0) {
          autoScrollRef.current.rafId = requestAnimationFrame(step);
        } else {
          autoScrollRef.current.rafId = null;
        }
      };

      autoScrollRef.current.rafId = requestAnimationFrame(step);
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;

      const deltaX = Math.abs(e.clientX - dragRef.current.startX);
      const deltaY = Math.abs(e.clientY - dragRef.current.startY);

      // Drag threshold of 4px prevents accidental drag on click/tap
      if (!dragRef.current.isDragging && (deltaX > 4 || deltaY > 4)) {
        dragRef.current.isDragging = true;
        setDraggedTodo(dragRef.current.todo);
        setHiddenTodoId(dragRef.current.todo.id);
        setDragOffset(dragRef.current.offset);
      }

      if (dragRef.current.isDragging) {
        setDragCoords({ x: e.clientX, y: e.clientY });
        autoScrollRef.current.pointerX = e.clientX;
        autoScrollRef.current.pointerY = e.clientY;

        // Highlight drop zone under cursor with geometry awareness
        const priority = getZoneUnderPoint(
          e.clientX,
          e.clientY,
          dragRef.current.cardRect,
          dragRef.current.offset
        );
        setDragOverColumn(priority);

        // Continuous Auto-scroll near top and bottom viewport edges
        const topScrollZone = 110;
        const bottomScrollZone = 120;
        let nextSpeed = 0;

        if (e.clientY < topScrollZone) {
          const dist = topScrollZone - e.clientY;
          const ratio = Math.min(1, Math.max(0, dist / topScrollZone));
          nextSpeed = -Math.round(4 + ratio * 16);
        } else if (window.innerHeight - e.clientY < bottomScrollZone) {
          const dist = bottomScrollZone - (window.innerHeight - e.clientY);
          const ratio = Math.min(1, Math.max(0, dist / bottomScrollZone));
          nextSpeed = Math.round(4 + ratio * 16);
        }

        autoScrollRef.current.speed = nextSpeed;
        if (nextSpeed !== 0) {
          startAutoScroll();
        } else {
          stopAutoScroll();
        }
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;

      stopAutoScroll();

      if (dragRef.current.isDragging) {
        const targetPriority = getZoneUnderPoint(
          e.clientX,
          e.clientY,
          dragRef.current.cardRect,
          dragRef.current.offset
        );

        const todoToMove = dragRef.current.todo;
        if (targetPriority) {
          const finalPriority = targetPriority === 'unassigned' ? null : targetPriority;
          handlePriorityChangeRef.current(todoToMove, finalPriority);
        }
      }

      dragRef.current = null;
      setDraggedTodo(null);
      setHiddenTodoId(null);
      setDragCoords(null);
      setDragOverColumn(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      stopAutoScroll();
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, []);

  const isFilterActive = isFilterOpen || dateFilter !== 'this_month' || statusFilter !== 'all';

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-36 sm:pb-8 md:pb-0 bg-canvas text-ink relative min-h-full flex flex-col flex-1">
      {/* 1. Top Header (Title and Subtitle) */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
              <span>{userLastName}</span>
              <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
                ToDo
              </span>
            </h1>
          </div>
          <p className="text-body-sm text-body mt-0.5">
            Daftar tugas, rencana aksi, dan checklist prioritas harian Anda.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 self-start sm:self-center shrink-0">
          <AskAiButton onClick={() => setIsAskAiOpen(true)} label="Ask Todo" />
        </div>
      </div>

      {/* 2. Controls Row: Searchbox + View Toggle + Filter button */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex items-center gap-2 min-w-0">
        <SearchPill
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari tugas & checklist..."
          wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:w-72 md:w-80"
        />

        {/* View Mode Toggle: List vs Grid (Icons only) */}
        <div className="inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0 select-none">
          <button
            type="button"
            onClick={() => setViewMode('checklist')}
            className={`p-2 rounded-full cursor-pointer transition-colors !border-0 flex items-center justify-center ${
              viewMode === 'checklist'
                ? 'bg-canvas text-ink shadow-xs'
                : 'text-body hover:text-ink'
            }`}
            title="Tampilan List"
            aria-label="Checklist View"
          >
            <ListChecks className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-full cursor-pointer transition-colors !border-0 flex items-center justify-center ${
              viewMode === 'cards'
                ? 'bg-canvas text-ink shadow-xs'
                : 'text-body hover:text-ink'
            }`}
            title="Tampilan Grid"
            aria-label="Cards View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Filter button -> toggle filter popup modal */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
            isFilterActive
              ? 'bg-primary text-on-primary'
              : 'bg-surface-soft text-ink hover:bg-canvas'
          }`}
          title="Filter periode & status"
          aria-label="Toggle filter menu"
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
          {(dateFilter !== 'this_month' || statusFilter !== 'all') && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-terminal-yellow border border-canvas" />
          )}
        </button>

        {/* Mobile Ask AI Button (Circle box next to searchbox) */}
        <AskAiButton
          onClick={() => setIsAskAiOpen(true)}
          label="Ask Todo"
          variant="circle"
          className="sm:hidden"
        />
      </div>

      {/* 3. Main Area */}
      <div className="w-full space-y-4 mt-4 sm:mt-6 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
              {viewMode === 'checklist' ? 'Checklist Tugas & Prioritas' : 'Daftar Catatan ToDo'}
            </h2>
            <p className="text-body-sm text-body mt-0.5 font-normal">
              {statusFilter === 'pending'
                ? dateFilter === 'this_month'
                  ? 'Menampilkan tugas belum selesai pada periode bulan ini.'
                  : 'Menampilkan tugas belum selesai sepanjang waktu.'
                : dateFilter === 'this_month'
                ? 'Menampilkan seluruh tugas periode bulan ini.'
                : 'Menampilkan seluruh tugas sepanjang waktu.'}
            </p>
          </div>

          {/* Quick In-Place Task Input (Desktop & Mobile, Fast task creation into Inbox) */}
          {viewMode === 'checklist' && (
            <form
              onSubmit={handleQuickAddTask}
              className="relative flex items-center w-full sm:w-80 md:w-96 group min-w-0"
            >
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute group-focus-within:text-ink pointer-events-none transition-colors">
                <Plus className="w-4.5 h-4.5" />
              </div>
              <input
                type="text"
                value={quickTaskText}
                onChange={(e) => setQuickTaskText(e.target.value)}
                disabled={isAddingQuickTask}
                placeholder="Tambah tugas cepat..."
                className="w-full min-w-0 h-10 pl-10 pr-4 rounded-full border-0 bg-surface-soft text-ink placeholder:text-mute text-body-sm focus:outline-none focus:ring-0 focus:bg-surface-soft transition-colors"
              />
            </form>
          )}
        </div>

        {/* View Mode 1: Actionable Kanban Checklist with Priority Columns (Desktop) & Priority List (Mobile) */}
        {viewMode === 'checklist' ? (
          filteredTodos.length > 0 ? (
            <>
              {/* Mobile View (< md): 3 Priority Rows (Now, Soon, Later) with Vertical Drag & Drop */}
              <div className="block md:hidden space-y-6 pb-8">
                {/* Row 1: Now Priority */}
                <div
                  data-priority-zone="high"
                  data-mobile-row
                  className={`p-3 min-h-[120px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'high'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Now
                    </span>
                  </div>

                  {highTodos.length > 0 ? (
                    <div className="space-y-2">
                      {highTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'high' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Now
                      </p>
                    </div>
                  )}
                </div>

                {/* Row 2: Soon Priority */}
                <div
                  data-priority-zone="normal"
                  data-mobile-row
                  className={`p-3 min-h-[120px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'normal'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Soon
                    </span>
                  </div>

                  {normalTodos.length > 0 ? (
                    <div className="space-y-2">
                      {normalTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'normal' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Soon
                      </p>
                    </div>
                  )}
                </div>

                {/* Row 3: Later Priority */}
                <div
                  data-priority-zone="low"
                  data-mobile-row
                  className={`p-3 min-h-[120px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'low'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Later
                    </span>
                  </div>

                  {lowTodos.length > 0 ? (
                    <div className="space-y-2">
                      {lowTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'low' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Later
                      </p>
                    </div>
                  )}
                </div>

                {/* Optional Row 4: Inbox (Unassigned tasks if any exist) */}
                {unassignedTodos.length > 0 && (
                  <div
                    data-priority-zone="unassigned"
                    data-mobile-row
                    className={`p-3 min-h-[120px] transition-all duration-150 rounded-xl border-2 ${
                      dragOverColumn === 'unassigned'
                        ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="mb-3">
                      <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                        Inbox
                      </span>
                    </div>

                    <div className="space-y-2">
                      {unassignedTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop View (>= md): 4-Column Kanban with Drag and Drop */}
              <div className="hidden md:flex flex-1 flex-col w-full overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
                <div className="min-w-[960px] w-full flex-1 flex items-stretch gap-1 sm:gap-2">
                {/* Column 0: Inbox (Unassigned / Belum Dipetakan) */}
                <div
                  data-priority-zone="unassigned"
                  data-desktop-column
                  className={`flex-1 flex flex-col p-3 sm:p-4 min-h-[580px] sm:min-h-[660px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'unassigned'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column Header */}
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Inbox
                    </span>
                  </div>

                  {/* Column Content: Grouped by Note with Gap Space */}
                  {unassignedGroupedByNote.length > 0 ? (
                    <div className="space-y-6">
                      {unassignedGroupedByNote.map((group) => (
                        <div key={group.noteId} className="space-y-2">
                          {group.todos.map((todo) => (
                            <TodoItemCard
                              key={todo.id}
                              todo={todo}
                              isHidden={hiddenTodoId === todo.id}
                              onToggle={() => handleToggleTodo(todo)}
                              onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                              onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'unassigned' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Semua tugas telah dipetakan
                      </p>
                    </div>
                  )}
                </div>

                {/* Vertical Divider 1 */}
                <div className="w-px bg-hairline shrink-0 self-stretch" />

                {/* Column 1: Now Priority */}
                <div
                  data-priority-zone="high"
                  data-desktop-column
                  className={`flex-1 flex flex-col p-3 sm:p-4 min-h-[580px] sm:min-h-[660px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'high'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column Header */}
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Now
                    </span>
                  </div>

                  {/* Column Content */}
                  {highTodos.length > 0 ? (
                    <div className="space-y-2">
                      {highTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'high' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Now
                      </p>
                    </div>
                  )}
                </div>

                {/* Vertical Divider 2 */}
                <div className="w-px bg-hairline shrink-0 self-stretch" />

                {/* Column 2: Soon Priority */}
                <div
                  data-priority-zone="normal"
                  data-desktop-column
                  className={`flex-1 flex flex-col p-3 sm:p-4 min-h-[580px] sm:min-h-[660px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'normal'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column Header */}
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Soon
                    </span>
                  </div>

                  {/* Column Content */}
                  {normalTodos.length > 0 ? (
                    <div className="space-y-2">
                      {normalTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'normal' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Soon
                      </p>
                    </div>
                  )}
                </div>

                {/* Vertical Divider 3 */}
                <div className="w-px bg-hairline shrink-0 self-stretch" />

                {/* Column 3: Later Priority */}
                <div
                  data-priority-zone="low"
                  data-desktop-column
                  className={`flex-1 flex flex-col p-3 sm:p-4 min-h-[580px] sm:min-h-[660px] transition-all duration-150 rounded-xl border-2 ${
                    dragOverColumn === 'low'
                      ? 'bg-ink/[0.04] border-dashed border-ink/20 shadow-none'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column Header */}
                  <div className="mb-3">
                    <span className="text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono">
                      Later
                    </span>
                  </div>

                  {/* Column Content */}
                  {lowTodos.length > 0 ? (
                    <div className="space-y-2">
                      {lowTodos.map((todo) => (
                        <TodoItemCard
                          key={todo.id}
                          todo={todo}
                          isHidden={hiddenTodoId === todo.id}
                          onToggle={() => handleToggleTodo(todo)}
                          onOpenDetail={() => handleOpenDetail(todo.rawNote)}
                          onGripPointerDown={(e) => handleGripPointerDown(e, todo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center px-2">
                      <p
                        className={`text-body-sm select-none transition-colors ${
                          dragOverColumn === 'low' ? 'text-ink font-medium' : 'text-mute/80'
                        }`}
                      >
                        Tarik tugas ke sini untuk Later
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h2 className="text-heading-lg text-ink font-semibold mb-2">
                Belum ada tugas
              </h2>
              <p className="text-body-sm text-body max-w-sm leading-relaxed">
                Tulis tugas pertama Anda dengan tombol New Task di bawah atau melalui bot Telegram.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h2 className="text-heading-lg text-ink font-semibold mb-2">
                Tidak ada checklist tugas yang cocok
              </h2>
              <p className="text-body-sm text-body max-w-sm leading-relaxed">
                {searchQuery.trim()
                  ? `Tidak ada tugas yang cocok dengan "${searchQuery}".`
                  : `Tidak ada tugas pada filter status "${statusFilter === 'pending' ? 'Belum Selesai' : 'Semua'}" periode "${dateFilter === 'this_month' ? 'Bulan Ini' : 'Semua Waktu'}".`}
              </p>
            </div>
          )
        ) : (
          /* View Mode 2: Card Gallery View */
          filteredCardNotes.length > 0 ? (
            <div className="w-full columns-1 md:columns-[300px] md:[column-width:300px] lg:columns-[320px] lg:[column-width:320px] gap-3.5 [column-gap:0.875rem] max-w-full lg:max-w-5xl xl:max-w-[90rem] 2xl:max-w-[105rem]">
              {filteredCardNotes.map((item) => (
                <NoteCard
                  key={item.id}
                  note={item}
                  showDateTime={true}
                  showCategory={false}
                  variant="timeline"
                  maxHeight="max-h-64"
                  onDelete={handleDelete}
                  onTogglePin={(id, isPinned) => handleTogglePinState(id, isPinned)}
                  onEdit={(n) => handleOpenEdit(n as TodoItem)}
                  onClick={(n) => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      return;
                    }
                    handleOpenDetail(n as TodoItem);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h2 className="text-heading-lg text-ink font-semibold mb-2">
                Tidak ada kartu catatan yang ditemukan
              </h2>
              <p className="text-body-sm text-body max-w-sm leading-relaxed">
                {searchQuery.trim()
                  ? `Tidak ada kartu catatan yang cocok dengan "${searchQuery}".`
                  : `Tidak ada catatan pada filter "${dateFilter === 'this_month' ? 'Bulan Ini' : 'Semua Waktu'}".`}
              </p>
            </div>
          )
        )}
      </div>

      {/* Filter Popover Modal */}
      <NotesFilterPopover
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        variant="todo"
        currentDateFilter={dateFilter}
        onApplyDateFilter={(newFilter) => setDateFilter(newFilter)}
        currentTodoStatusFilter={statusFilter}
        onApplyTodoStatusFilter={(newStatus) => setStatusFilter(newStatus)}
      />

      {/* Unified Note Modal */}
      {activeTodoModal && (
        <NoteDetailModal
          isOpen={Boolean(activeTodoModal)}
          initialMode={modalMode}
          note={activeTodoModal}
          onClose={() => setActiveTodoModal(null)}
          onDelete={(id) => {
            handleDelete(id);
            setActiveTodoModal(null);
          }}
          onTogglePin={(id, isPinned) => {
            handleTogglePinState(id, isPinned);
          }}
          onSave={(updatedNote) => {
            handleTaskUpdated(updatedNote as TodoItem);
            setActiveTodoModal(updatedNote as TodoItem);
          }}
        />
      )}

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <NewTodoModal
          isOpen={isNewTaskOpen}
          onClose={() => setIsNewTaskOpen(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {/* Floating Action Button: New Task (Hidden during mobile drag) */}
      <button
        type="button"
        onClick={() => setIsNewTaskOpen(true)}
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
          draggedTodo ? 'hidden sm:flex' : ''
        }`}
        title="Tambah Tugas Baru"
        aria-label="New Task"
      >
        <span className="hidden sm:inline text-body-sm font-medium">New Task</span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>

      {/* Dedicated Ask AI Modal */}
      <AskAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        category="todo"
        placeholder="Tanya tugas, rencana aksi, atau checklist Anda..."
        contextTitle="Tugas & ToDo"
      />

      {/* 100% Solid Custom Drag Follower (Zero transparency, moves with cursor, component fully intact) */}
      {draggedTodo && dragCoords && (
        <div
          style={{
            position: 'fixed',
            left: `${dragCoords.x - dragOffset.x}px`,
            top: `${dragCoords.y - dragOffset.y}px`,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
          className="w-fit max-w-full opacity-100 shadow-md select-none"
        >
          <TodoItemCard
            todo={draggedTodo}
            isDraggable={false}
            onToggle={() => {}}
            onOpenDetail={() => {}}
          />
        </div>
      )}
    </div>
  );
}
