import { useSyncExternalStore } from 'react';

// Must stay in sync with the --breakpoint-* theme tokens in styles/theme.css.
const TABLET_QUERY = '(min-width: 48rem)';
const DESKTOP_QUERY = '(min-width: 80rem)';
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

type BreakpointKey = keyof typeof BREAKPOINTS;

interface Breakpoint {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isAbove: (breakpoint: BreakpointKey) => boolean;
  isBelow: (breakpoint: BreakpointKey) => boolean;
}

function subscribeToQuery(query: string, onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(query);
  mediaQueryList.addEventListener('change', onChange);

  return () => mediaQueryList.removeEventListener('change', onChange);
}

function subscribe(onChange: () => void): () => void {
  const unsubscribers = [
    subscribeToQuery(TABLET_QUERY, onChange),
    subscribeToQuery(DESKTOP_QUERY, onChange)
  ];

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

function readSnapshot(): 'mobile' | 'tablet' | 'desktop' {
  if (window.matchMedia(DESKTOP_QUERY).matches) {
    return 'desktop';
  }

  return window.matchMedia(TABLET_QUERY).matches ? 'tablet' : 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const size = useSyncExternalStore(subscribe, readSnapshot);
  const width =
    typeof window === 'undefined' ? BREAKPOINTS.xl : window.innerWidth;

  return {
    isMobile: size === 'mobile',
    isTablet: size === 'tablet',
    isDesktop: size === 'desktop',
    isAbove: (breakpoint) => width >= BREAKPOINTS[breakpoint],
    isBelow: (breakpoint) => width < BREAKPOINTS[breakpoint]
  };
}
