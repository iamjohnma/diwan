type RtlScrollBehavior = 'default' | 'negative' | 'reverse';

let rtlScrollBehaviorCache: RtlScrollBehavior | null = null;
export const SCROLL_EDGE_EPSILON = 2;

function detectRtlScrollBehavior(): RtlScrollBehavior {
  if (rtlScrollBehaviorCache) return rtlScrollBehaviorCache;
  if (typeof document === 'undefined') return 'default';

  const scrollContainer = document.createElement('div');
  const content = document.createElement('div');
  scrollContainer.style.cssText =
    'width:4px;height:1px;position:absolute;top:-9999px;overflow:scroll;direction:rtl';
  content.style.cssText = 'width:8px;height:1px';
  scrollContainer.append(content);
  document.body.append(scrollContainer);

  if (scrollContainer.scrollLeft > 0) {
    rtlScrollBehaviorCache = 'default';
  } else {
    scrollContainer.scrollLeft = 1;
    rtlScrollBehaviorCache =
      scrollContainer.scrollLeft === 0 ? 'negative' : 'reverse';
  }
  scrollContainer.remove();
  return rtlScrollBehaviorCache;
}

export function getMaxScrollLeft(container: HTMLElement): number {
  return Math.max(0, container.scrollWidth - container.clientWidth);
}

export function getNormalizedScrollLeft(container: HTMLElement): number {
  const max = getMaxScrollLeft(container);
  if (max <= SCROLL_EDGE_EPSILON) return 0;
  if (getComputedStyle(container).direction !== 'rtl')
    return container.scrollLeft;

  const behavior = detectRtlScrollBehavior();
  if (behavior === 'negative') return container.scrollLeft + max;
  if (behavior === 'reverse') return max - container.scrollLeft;
  return container.scrollLeft;
}

export function getRawScrollLeft(
  container: HTMLElement,
  normalizedScrollLeft: number
): number {
  const max = getMaxScrollLeft(container);
  const value = Math.min(max, Math.max(0, normalizedScrollLeft));
  if (getComputedStyle(container).direction !== 'rtl') return value;

  const behavior = detectRtlScrollBehavior();
  if (behavior === 'negative') return value - max;
  if (behavior === 'reverse') return max - value;
  return value;
}
