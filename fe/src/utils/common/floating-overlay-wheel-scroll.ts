import type { WheelEvent } from 'react';

/**
 * Wheel handler for scrollable regions inside portaled floating overlays (Popover,
 * Select, Menu, etc.) when a parent Dialog's react-remove-scroll lock blocks
 * native wheel scrolling.
 *
 * React delegates wheel events through a passive root listener, so this handler
 * must not call preventDefault. Stopping propagation keeps react-remove-scroll's
 * document listener from cancelling the event while preserving native scrolling.
 */
export function handleFloatingOverlayWheelScroll(
  event: WheelEvent<HTMLElement>
) {
  event.stopPropagation();
}
