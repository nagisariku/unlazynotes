import NoteDetailModal, { type NoteDetailModalProps, type ModalMode } from './NoteDetailModal';
import type { NoteItem } from './NotesTimeline';

export interface EditNoteModalProps {
  note: any;
  isOpen: boolean;
  isVault?: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSave: (updatedNote: any) => void;
}

export default function EditNoteModal({
  note,
  isOpen,
  isVault,
  onClose,
  onSave,
}: EditNoteModalProps) {
  return (
    <NoteDetailModal
      note={note}
      isOpen={isOpen}
      isVault={isVault}
      initialMode="edit"
      onClose={onClose}
      onSave={onSave}
      onDelete={() => {}}
      onTogglePin={() => {}}
    />
  );
}
