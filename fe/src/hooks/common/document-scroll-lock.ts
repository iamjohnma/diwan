import * as React from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousScrollbarGutter = '';

export function useDocumentScrollLock(locked: boolean) {
  React.useLayoutEffect(() => {
    if (!locked) {
      return;
    }

    const html = document.documentElement;

    if (lockCount === 0) {
      previousOverflow = html.style.overflow;
      previousScrollbarGutter = html.style.getPropertyValue('scrollbar-gutter');
      html.style.setProperty('scrollbar-gutter', 'auto');
      html.style.overflow = 'hidden';
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount === 0) {
        html.style.overflow = previousOverflow;

        if (previousScrollbarGutter) {
          html.style.setProperty('scrollbar-gutter', previousScrollbarGutter);
        } else {
          html.style.removeProperty('scrollbar-gutter');
        }
      }
    };
  }, [locked]);
}
