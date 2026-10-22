import React from 'react';

export interface PrimaryNavProps {
  children: React.ReactNode;
  className?: string;
}

export const PrimaryNav: React.FC<PrimaryNavProps> = ({ children, className = '' }) => {
  return (
    <nav
      className={`bg-canvas text-ink text-body-sm-strong rounded-none h-14 border-b border-hairline px-6 flex items-center justify-between sticky top-0 z-40  ${className}`.trim()}
    >
      {children}
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
      className={`bg-canvas text-body text-caption-sm rounded-none px-6 py-8 border-t border-hairline  ${className}`.trim()}
    >
      {children}
    </footer>
  );
};
