import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface TerminalTrafficLightsProps {
  className?: string;
}

export const TerminalTrafficLights: React.FC<TerminalTrafficLightsProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <span className="w-3 h-3 rounded-full bg-terminal-red inline-block" />
      <span className="w-3 h-3 rounded-full bg-terminal-yellow inline-block" />
      <span className="w-3 h-3 rounded-full bg-terminal-green inline-block" />
    </div>
  );
};

export interface InstallSnippetProps {
  command?: string;
  className?: string;
  showCopy?: boolean;
}

export const InstallSnippet: React.FC<InstallSnippetProps> = ({
  command = 'curl -fsSL https://ollama.com/install.sh | sh',
  className = '',
  showCopy = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className={`bg-surface-soft text-ink text-code-md rounded-full px-5 h-12 flex items-center justify-between border border-hairline  max-w-full ${className}`.trim()}
    >
      <code className="truncate select-all mr-3">{command}</code>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy install command"
          className="text-body hover:text-ink active:text-ink-deep p-1 rounded-full focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {copied ? <Check className="w-4 h-4 text-ink" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};

export interface CommandTagProps {
  children: React.ReactNode;
  className?: string;
}

export const CommandTag: React.FC<CommandTagProps> = ({ children, className = '' }) => {
  return (
    <span
      className={`bg-surface-soft text-ink text-[11px] leading-tight rounded-full px-2 py-0.5 inline-flex items-center font-sans font-medium select-none ${className}`.trim()}
    >
      {children}
    </span>
  );
};

export interface TerminalCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const TerminalCard: React.FC<TerminalCardProps> = ({
  children,
  title,
  className = '',
}) => {
  return (
    <div
      className={`bg-canvas text-ink text-code-sm rounded-lg p-4 border border-hairline font-mono ${className}`.trim()}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-hairline">
        <TerminalTrafficLights />
        {title && <span className="text-body text-caption-sm">{title}</span>}
        <div className="w-12" />
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};
