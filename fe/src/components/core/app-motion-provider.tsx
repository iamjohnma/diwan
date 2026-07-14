import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';

interface AppMotionProviderProps {
  children: ReactNode;
}

/**
 * Keeps Motion animations consistent with Naab: when the OS is not asking to
 * reduce motion, force `reducedMotion="never"` so step slides and other
 * Motion transitions are not silently dropped. When the OS prefers reduced
 * motion, honour it via `always`.
 */
export function AppMotionProvider(props: AppMotionProviderProps) {
  const osReducedMotion = useReducedMotion();
  const appReducedMotion = osReducedMotion === true;

  useLayoutEffect(() => {
    document.documentElement.dataset.reducedMotion = appReducedMotion
      ? 'true'
      : 'false';
  }, [appReducedMotion]);

  return (
    <MotionConfig reducedMotion={appReducedMotion ? 'always' : 'never'}>
      {props.children}
    </MotionConfig>
  );
}
