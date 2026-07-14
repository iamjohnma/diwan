export interface TouchScreenState {
  isPrimaryTouch: boolean;
  hasTouchCapability: boolean;
}

// matchMedia / maxTouchPoints can misreport touch capability (Chrome device
// emulation quirks, some hover-capable touch laptops). A real touchstart is
// definitive proof, so once one is seen anywhere in the document the session
// is treated as touch-capable for good — this keeps calendar badges draggable
// and their touch resize strips reachable even when detection lies.
let touchSeenInSession = false;
const touchSeenSubscribers = new Set<() => void>();
let touchSeenListenerInstalled = false;

function handleFirstTouchSeen() {
  document.removeEventListener('touchstart', handleFirstTouchSeen, true);
  touchSeenInSession = true;
  touchSeenSubscribers.forEach((notify) => notify());
}

function installTouchSeenListener() {
  if (touchSeenListenerInstalled || typeof document === 'undefined') {
    return;
  }
  touchSeenListenerInstalled = true;
  document.addEventListener('touchstart', handleFirstTouchSeen, {
    capture: true,
    passive: true
  });
}

export function subscribeTouchScreenDetection(notify: () => void): () => void {
  installTouchSeenListener();
  touchSeenSubscribers.add(notify);

  return () => {
    touchSeenSubscribers.delete(notify);
  };
}

export function detectTouchScreen(): TouchScreenState {
  if (typeof window === 'undefined') {
    return { isPrimaryTouch: false, hasTouchCapability: false };
  }

  const canUseMatchMedia = typeof window.matchMedia === 'function';
  const maxTouchPoints =
    typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints;

  const isPrimaryTouch =
    canUseMatchMedia &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches;

  const hasTouchCapability =
    touchSeenInSession ||
    maxTouchPoints > 0 ||
    (canUseMatchMedia && window.matchMedia('(any-pointer: coarse)').matches);

  return { isPrimaryTouch, hasTouchCapability };
}

export function hasTouchScreenCapability(): boolean {
  return detectTouchScreen().hasTouchCapability;
}
