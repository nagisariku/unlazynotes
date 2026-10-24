import React from 'react';

export interface PrimaryNavProps {
  children: React.ReactNode;
  className?: string;
}

export const PrimaryNav: React.FC<PrimaryNavProps> = ({ children, className = '' }) => {
  return (
    <nav
      className={`w-full bg-surface-soft text-ink text-body-sm-strong rounded-none border-0 sticky top-0 z-40 ${className}`.trim()}
    >
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        {children}
      </div>
    </nav>
  );
};

export interface FooterSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ children, className = '' }) => {
  return (
    <footer
      className={`bg-canvas text-body text-caption-sm rounded-none px-6 py-8 border-t border-hairline ${className}`.trim()}
    >
      {children}
    </footer>
  );
};
