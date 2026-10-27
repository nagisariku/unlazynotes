import React from 'react';
import { Sparkles } from 'lucide-react';

interface AskAiButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

export default function AskAiButton({ onClick, className = '', label = 'Ask AI' }: AskAiButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-4 sm:px-5 rounded-full inline-flex items-center justify-center gap-2 text-body-sm font-semibold bg-surface-soft hover:bg-hairline/60 text-ink cursor-pointer transition-colors !border-0 select-none shrink-0 ${className}`.trim()}
      title={label}
      aria-label={label}
    >
      <Sparkles className="w-4 h-4 text-ink" />
      <span>{label}</span>
    </button>
  );
}
