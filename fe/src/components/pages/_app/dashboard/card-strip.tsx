import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface DashboardCardStripProps {
  children: ReactNode;
  className?: string;
}

export function DashboardCardStrip(props: DashboardCardStripProps) {
  const translation = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hints, setHints] = useState({ previous: false, next: false });

  const updateHints = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    setHints({
      previous: container.scrollLeft > 2,
      next: container.scrollLeft < maxScroll - 2
    });
  }, []);

  useEffect(() => {
    updateHints();
    const observer = new ResizeObserver(updateHints);
    const container = containerRef.current;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [updateHints]);

  const scroll = useCallback((direction: -1 | 1) => {
    const container = containerRef.current;
    if (!container) return;
    const firstCard = container.firstElementChild as HTMLElement | null;
    container.scrollBy({
      behavior: 'smooth',
      left: direction * (firstCard?.offsetWidth ?? container.clientWidth)
    });
  }, []);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className={cn(
          '@container flex w-full min-w-0 snap-x snap-proximity overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          props.className
        )}
        onScroll={updateHints}
      >
        {props.children}
      </div>
      <button
        aria-label={translation.t('dashboard.cards.previous')}
        className={cn(
          'absolute inset-y-0 left-0 z-20 hidden w-12 cursor-pointer transition-opacity md:block',
          hints.previous ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => scroll(-1)}
        type="button"
      >
        <CaretLeftIcon
          className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          weight="bold"
        />
      </button>
      <button
        aria-label={translation.t('dashboard.cards.next')}
        className={cn(
          'absolute inset-y-0 right-0 z-20 hidden w-12 cursor-pointer transition-opacity md:block',
          hints.next ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => scroll(1)}
        type="button"
      >
        <CaretRightIcon
          className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          weight="bold"
        />
      </button>
    </div>
  );
}
