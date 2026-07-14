import { useEffect, useState } from 'react';
import {
  type TouchScreenState,
  detectTouchScreen,
  subscribeTouchScreenDetection
} from '@/utils/common/touch-screen';

export function useTouchScreen(): TouchScreenState {
  const [state, setState] = useState(detectTouchScreen);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const queries = [
      '(pointer: coarse)',
      '(hover: none)',
      '(any-pointer: coarse)'
    ].map((query) => window.matchMedia(query));
    const update = () => {
      const next = detectTouchScreen();
      setState((prev) =>
        prev.isPrimaryTouch === next.isPrimaryTouch &&
        prev.hasTouchCapability === next.hasTouchCapability
          ? prev
          : next
      );
    };

    update();
    queries.forEach((mq) => mq.addEventListener('change', update));
    const unsubscribeTouchSeen = subscribeTouchScreenDetection(update);

    return () => {
      queries.forEach((mq) => mq.removeEventListener('change', update));
      unsubscribeTouchSeen();
    };
  }, []);

  return state;
}
