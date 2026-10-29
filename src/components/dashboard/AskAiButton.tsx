import React from 'react';
import { Sparkles } from 'lucide-react';

interface AskAiButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
  variant?: 'pill' | 'circle';
}

export default function AskAiButton({
  onClick,
  className = '',
  label = 'Ask AI',
  variant = 'pill',
}: AskAiButtonProps) {
  if (variant === 'circle') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 bg-surface-soft text-ink hover:bg-canvas transition-colors !border-0 select-none ${className}`.trim()}
        title={label}
        aria-label={label}
      >
        <Sparkles className="w-4.5 h-4.5 text-ink" />
      </button>
    );
  }

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
