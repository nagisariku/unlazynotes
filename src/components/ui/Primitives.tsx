import React from 'react';
import { Check } from 'lucide-react';

export interface FeatureBulletProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  onDark?: boolean;
}

export const FeatureBullet: React.FC<FeatureBulletProps> = ({
  children,
  icon,
  className = '',
  onDark = false,
}) => {
  return (
    <div
      className={`text-body-sm flex items-start gap-2.5 ${
        onDark ? 'text-on-dark-mute' : 'text-charcoal'
      } ${className}`.trim()}
    >
      <span className={`mt-0.5 shrink-0 ${onDark ? 'text-on-dark' : 'text-ink'}`}>
        {icon || <Check className="w-4 h-4" />}
      </span>
      <span>{children}</span>
    </div>
  );
};

export interface FaqRowProps {
  question: React.ReactNode;
  answer: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const FaqRow: React.FC<FaqRowProps> = ({
  question,
  answer,
  isOpen = false,
  onToggle,
  className = '',
}) => {
  return (
    <div
      className={`bg-canvas text-ink text-body-md rounded-none py-4 border-b border-hairline  ${className}`.trim()}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-center justify-between gap-4 font-medium focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span>{question}</span>
        <span className="text-body text-xl font-light select-none shrink-0">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="pt-3 text-body text-body-sm">
          {answer}
        </div>
      )}
    </div>
  );
};

export interface LinkInlineProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
}

export const LinkInline: React.FC<LinkInlineProps> = ({ children, className = '', ...props }) => {
  return (
    <a
      className={`text-ink text-body-md underline underline-offset-4 hover:opacity-75  ${className}`.trim()}
      {...props}
    >
      {children}
    </a>
  );
};

export interface LinkMuteProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
}

export const LinkMute: React.FC<LinkMuteProps> = ({ children, className = '', ...props }) => {
  return (
    <a
      className={`text-body text-body-sm hover:text-ink  ${className}`.trim()}
      {...props}
    >
      {children}
    </a>
  );
};
