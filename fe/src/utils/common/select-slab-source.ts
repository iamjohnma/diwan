/**
 * Decides which item the desktop Select's highlight slab ("background") should
 * track when it re-syncs from the DOM (on open, keyboard nav, scroll, resize).
 *
 * The slab has two drivers that have to be reconciled here:
 *  - keyboard navigation marks the active item with `data-highlighted`;
 *  - pointer hover tracks whatever item is physically under the cursor.
 *
 * The reconciliation matters most during a wheel/trackpad scroll: the cursor
 * stays put while a *different* item slides under it, and the browser does not
 * reliably fire `mouseenter` for that item. If we only looked at the highlighted
 * or checked item the slab would snap to the selected row (or vanish) instead of
 * following what the user is now pointing at — the "background doesn't follow"
 * bug. So whenever the pointer is inside the list and not driving the keyboard
 * highlight, the item under the cursor wins.
 */
type SelectSlabSource =
  'highlighted' | 'pointer' | 'checked' | 'keep' | 'clear';

export interface SelectSlabResolutionInput {
  /** Open phase: the slab should jump straight to the selected item. */
  preferCheckedOnOpen: boolean;
  /** The cursor is currently hovering inside the scrollable list. */
  pointerInsideViewport: boolean;
  /** An item carries `data-highlighted` (keyboard navigation is active). */
  hasHighlighted: boolean;
  /** An item carries `data-state="checked"` (it is the selected value). */
  hasChecked: boolean;
  /** An enabled item was resolved directly under the cursor. */
  hasPointerItem: boolean;
  /** A slab is already being shown. */
  hasCurrentSlab: boolean;
}

export function resolveSelectSlabSource(
  input: SelectSlabResolutionInput
): SelectSlabSource {
  const {
    preferCheckedOnOpen,
    pointerInsideViewport,
    hasHighlighted,
    hasChecked,
    hasPointerItem,
    hasCurrentSlab
  } = input;

  // On open we deliberately snap to the selected item before any interaction.
  if (preferCheckedOnOpen) {
    return hasChecked ? 'checked' : 'clear';
  }

  // Keyboard navigation owns the highlight while it is active.
  if (hasHighlighted) {
    return 'highlighted';
  }

  // Pointer mode: follow the item under the cursor, even when a scroll (not a
  // real mouse move) is what brought it there.
  if (pointerInsideViewport) {
    if (hasPointerItem) {
      return 'pointer';
    }
    // Cursor is over a gap between items mid-scroll. Don't yank the slab to the
    // checked item — hold its current position until an item is back under it.
    if (hasCurrentSlab) {
      return 'keep';
    }
  }

  return hasChecked ? 'checked' : 'clear';
}
