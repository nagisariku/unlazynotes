import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '../../lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  size?: 'default' | 'medium' | 'large';
};

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  size = 'default',
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  const isSingle = props.mode === 'single';
  const isMultiple = props.mode === 'multiple';
  const isLarge = size === 'large';
  const isMedium = size === 'medium';

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        isLarge
          ? 'p-3 sm:p-5 bg-canvas text-ink select-none'
          : isMedium
            ? 'p-3 sm:p-4 bg-canvas text-ink select-none'
            : 'p-2.5 bg-canvas text-ink select-none',
        className
      )}
      classNames={{
        root: cn('w-full', defaultClassNames.root, classNames?.root),
        months: cn(
          isLarge
            ? 'relative flex flex-col gap-5 sm:gap-6'
            : isMedium
              ? 'relative flex flex-col gap-3 sm:gap-4'
              : 'relative flex flex-col gap-3',
          defaultClassNames.months,
          classNames?.months
        ),
        month: cn(
          isLarge
            ? 'flex flex-col gap-3 sm:gap-5 w-full'
            : isMedium
              ? 'flex flex-col gap-2.5 sm:gap-3 w-full'
              : 'flex flex-col gap-2 w-full',
          defaultClassNames.month,
          classNames?.month
        ),
        nav: cn(
          isLarge
            ? 'flex items-center justify-between w-full absolute inset-x-0 top-0 px-2 sm:px-4 z-10 pointer-events-none'
            : isMedium
              ? 'flex items-center justify-between w-full absolute inset-x-0 top-0 px-1 sm:px-2 z-10 pointer-events-none'
              : 'flex items-center justify-between w-full absolute inset-x-0 top-0 px-1 z-10 pointer-events-none',
          defaultClassNames.nav,
          classNames?.nav
        ),
        button_previous: cn(
          isLarge
            ? 'h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors'
            : isMedium
              ? 'h-10 w-10 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors'
              : 'h-9 w-9 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors',
          defaultClassNames.button_previous,
          classNames?.button_previous
        ),
        button_next: cn(
          isLarge
            ? 'h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors'
            : isMedium
              ? 'h-10 w-10 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors'
              : 'h-9 w-9 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors',
          defaultClassNames.button_next,
          classNames?.button_next
        ),
        month_caption: cn(
          isLarge
            ? 'flex h-10 sm:h-12 w-full items-center justify-center text-heading-md sm:text-heading-lg font-semibold text-ink tracking-tight capitalize'
            : isMedium
              ? 'flex h-10 w-full items-center justify-center text-body-md sm:text-heading-sm font-semibold text-ink tracking-tight capitalize'
              : 'flex h-9 w-full items-center justify-center text-body-sm font-semibold text-ink capitalize',
          defaultClassNames.month_caption,
          classNames?.month_caption
        ),
        month_grid: cn('w-full table-fixed border-collapse border-spacing-0', defaultClassNames.month_grid, classNames?.month_grid),
        weekdays: cn('table-row', defaultClassNames.weekdays, classNames?.weekdays),
        weekday: cn(
          isLarge
            ? 'table-cell text-mute text-caption-xs sm:text-caption-sm font-mono text-center h-8 sm:h-10 align-middle uppercase tracking-wider'
            : isMedium
              ? 'table-cell text-mute text-[11px] sm:text-caption-xs font-mono text-center h-8 align-middle uppercase'
              : 'table-cell text-mute text-[11px] font-mono text-center h-7 align-middle uppercase',
          defaultClassNames.weekday,
          classNames?.weekday
        ),
        weeks: cn('table-row-group', defaultClassNames.weeks, classNames?.weeks),
        week: cn('table-row', defaultClassNames.week, classNames?.week),
        day: cn(
          isLarge
            ? 'table-cell p-0.5 sm:p-1 h-12 sm:h-16 md:h-20 text-center align-middle relative text-body sm:text-heading-sm'
            : isMedium
              ? 'table-cell p-0.5 h-10 sm:h-11 text-center align-middle relative text-body-sm'
              : 'table-cell p-0.5 h-9 text-center align-middle relative text-caption-sm',
          defaultClassNames.day,
          classNames?.day
        ),
        day_button: cn(
          isLarge
            ? isSingle || isMultiple
              ? 'w-10 h-10 sm:w-13 sm:h-13 md:w-14 md:h-14 mx-auto rounded-full flex items-center justify-center text-body-sm sm:text-body md:text-heading-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal'
              : 'w-full h-12 sm:h-16 md:h-20 flex items-center justify-center text-body-sm sm:text-body md:text-heading-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal'
            : isMedium
              ? isSingle || isMultiple
                ? 'w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-full flex items-center justify-center text-body-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal'
                : 'w-full h-10 sm:h-11 flex items-center justify-center text-caption-sm sm:text-body-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal'
              : isSingle || isMultiple
                ? 'w-8 h-8 sm:w-9 sm:h-9 mx-auto rounded-full flex items-center justify-center text-caption-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal'
                : 'w-full h-8 flex items-center justify-center text-caption-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal',
          defaultClassNames.day_button,
          classNames?.day_button
        ),
        range_start: cn(
          'bg-hairline rounded-tl-full rounded-bl-full rounded-tr-none rounded-br-none [&>button]:!bg-transparent [&>button]:!text-ink [&>button]:font-semibold',
          defaultClassNames.range_start,
          classNames?.range_start
        ),
        range_middle: cn(
          'bg-hairline rounded-none [&>button]:!bg-transparent [&>button]:!text-ink [&>button]:font-medium',
          defaultClassNames.range_middle,
          classNames?.range_middle
        ),
        range_end: cn(
          'bg-hairline rounded-tr-full rounded-br-full rounded-tl-none rounded-bl-none [&>button]:!bg-transparent [&>button]:!text-ink [&>button]:font-semibold',
          defaultClassNames.range_end,
          classNames?.range_end
        ),
        selected: cn(
          isSingle || isMultiple
            ? '[&>button]:!bg-primary [&>button]:!text-on-primary [&>button]:!ring-0 [&>button]:font-semibold [&>button]:shadow-sm rounded-full'
            : 'bg-hairline [&>button]:!bg-transparent [&>button]:!text-ink [&>button]:font-semibold',
          defaultClassNames.selected,
          classNames?.selected
        ),
        today: cn(
          isSingle || isMultiple
            ? isLarge
              ? '[&>button]:ring-2 [&>button]:ring-ink font-bold'
              : isMedium
                ? '[&>button]:ring-1.5 [&>button]:ring-hairline-strong font-semibold'
                : '[&>button]:ring-1 [&>button]:ring-hairline-strong font-semibold'
            : 'font-bold underline decoration-2 decoration-primary underline-offset-4',
          defaultClassNames.today,
          classNames?.today
        ),
        outside: cn('text-mute/40 opacity-40 aria-selected:opacity-60', defaultClassNames.outside, classNames?.outside),
        disabled: cn('text-mute/30 cursor-not-allowed opacity-30', defaultClassNames.disabled, classNames?.disabled),
        hidden: cn('invisible', defaultClassNames.hidden, classNames?.hidden),
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass, ...chevProps }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeft
                className={cn(isLarge ? 'w-5 h-5 sm:w-6 sm:h-6' : isMedium ? 'w-5 h-5' : 'w-4 h-4', chevronClass)}
                {...chevProps}
              />
            );
          }
          return (
            <ChevronRight
              className={cn(isLarge ? 'w-5 h-5 sm:w-6 sm:h-6' : isMedium ? 'w-5 h-5' : 'w-4 h-4', chevronClass)}
              {...chevProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}
