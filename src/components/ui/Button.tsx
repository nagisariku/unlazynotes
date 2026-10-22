import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'pill-on-dark' | 'disabled';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth = false, className = '', disabled, children, ...props }, ref) => {
    const isExplicitDisabled = disabled || variant === 'disabled';

    let variantStyles = '';

    if (isExplicitDisabled) {
      variantStyles = 'bg-surface-soft text-body cursor-not-allowed border border-hairline opacity-65';
    } else {
      switch (variant) {
        case 'secondary':
          variantStyles =
            'bg-canvas text-ink border border-hairline active:bg-surface-soft  hover:border-hairline-strong focus-visible:ring-2 focus-visible:ring-focus-ring';
          break;
        case 'pill-on-dark':
          variantStyles =
            'bg-canvas text-ink active:bg-surface-soft  focus-visible:ring-2 focus-visible:ring-focus-ring';
          break;
        case 'primary':
        default:
          variantStyles =
            'bg-primary text-on-primary active:bg-ink-deep  focus-visible:ring-2 focus-visible:ring-focus-ring';
          break;
      }
    }

    return (
      <button
        ref={ref}
        disabled={isExplicitDisabled}
        className={`inline-flex items-center justify-center text-button-md rounded-full px-5 h-9   select-none cursor-pointer disabled:cursor-not-allowed ${
          fullWidth ? 'w-full' : ''
        } ${variantStyles} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
