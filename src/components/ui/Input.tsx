import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ fullWidth = false, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`bg-canvas text-ink text-body-md rounded-full px-4 h-10 border border-hairline placeholder:text-mute focus:outline-none focus:ring-0 focus:border-hairline ${
          fullWidth ? 'w-full' : ''
        } ${className}`.trim()}
        {...props}
      />
    );
  }
);

TextInput.displayName = 'TextInput';

export interface SearchPillProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  fullWidth?: boolean;
  onClear?: () => void;
  wrapperClassName?: string;
}

export const SearchPill = forwardRef<HTMLInputElement, SearchPillProps>(
  (
    {
      fullWidth = false,
      className = '',
      wrapperClassName = '',
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      ...props
    },
    ref
  ) => {
    const hasValue = Boolean(value);

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={`relative ${fullWidth ? 'w-full' : 'w-full sm:w-72 md:w-80'} ${wrapperClassName}`.trim()}>
        <Search className="w-4.5 h-4.5 text-mute absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full pl-10 ${hasValue ? 'pr-9' : 'pr-4'} h-10 rounded-full border-0 bg-surface-soft text-ink placeholder:text-mute text-body-sm focus:outline-none focus:ring-0 focus:bg-surface-soft ${className}`.trim()}
          {...props}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mute hover:text-ink cursor-pointer focus:outline-none"
            aria-label="Hapus pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchPill.displayName = 'SearchPill';
