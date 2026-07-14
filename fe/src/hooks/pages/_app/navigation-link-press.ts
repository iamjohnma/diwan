import { useCallback } from 'react';
import type { FileRouteTypes } from '@/routeTree.gen';
import { useRouter } from '@tanstack/react-router';
import {
  type MouseImmediatePressEvent,
  useMouseImmediatePress
} from '@/hooks/common';
import { isExactRoutePath } from '@/utils/core/pathname';

type Route = FileRouteTypes['fullPaths'];

interface SidebarNavigationLinkPressProps {
  href: Route | undefined;
  onNavigate?: () => void;
}

function canHandleSidebarNavigation(event: MouseImmediatePressEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

// Mouse navigates on pointer-down; touch waits for click so Link can handle
// the default route change. Matches Naab's sidebar link press behavior.
export function useSidebarNavigationLinkPress(
  props: SidebarNavigationLinkPressProps
) {
  const router = useRouter();
  const mouseImmediatePress = useMouseImmediatePress();
  const shouldSkipNavigation = useCallback(() => {
    return (
      props.href !== undefined &&
      isExactRoutePath(router.state.location.pathname, props.href)
    );
  }, [props.href, router]);
  const handlePress = useCallback(
    (event: MouseImmediatePressEvent) => {
      if (!props.href || !canHandleSidebarNavigation(event)) {
        return;
      }
      if (shouldSkipNavigation()) {
        event.preventDefault();

        return;
      }

      const isImmediateMousePress = event.type === 'pointerdown';
      if (isImmediateMousePress) {
        event.preventDefault();
      }
      props.onNavigate?.();
      if (isImmediateMousePress) {
        void router.navigate({ to: props.href });
      }
    },
    [props.href, props.onNavigate, router, shouldSkipNavigation]
  );

  return mouseImmediatePress.bindPress(
    handlePress,
    (event) =>
      !!props.href &&
      canHandleSidebarNavigation(event) &&
      !shouldSkipNavigation()
  );
}
