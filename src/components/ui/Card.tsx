import React from 'react';

export interface PricingCardProps {
  children: React.ReactNode;
  className?: string;
}

export const PricingCard: React.FC<PricingCardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-canvas text-ink text-body-md rounded-lg p-8 border border-hairline flex flex-col justify-between  ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export interface PricingCardDarkProps {
  children: React.ReactNode;
  className?: string;
}

export const PricingCardDark: React.FC<PricingCardDarkProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-surface-dark text-on-dark text-body-md rounded-lg p-8 flex flex-col justify-between  ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export interface CtaStripDarkProps {
  children: React.ReactNode;
  className?: string;
}

export const CtaStripDark: React.FC<CtaStripDarkProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-surface-dark text-on-dark text-heading-lg rounded-lg px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6  ${className}`.trim()}
    >
      {children}
    </div>
  );
};
