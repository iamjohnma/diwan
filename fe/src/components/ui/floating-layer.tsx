import * as React from 'react';

const FloatingLayerContainerContext = React.createContext<HTMLElement | null>(
  null
);

interface TopFloatingLayerDismissOptions {
  enabled: boolean;
  getElements: () => (Element | null | undefined)[];
  close: () => void;
  ignoreOutsideEvent?: (event: PointerEvent) => boolean;
}

interface TopFloatingLayerEntry {
  getElements: () => (Element | null | undefined)[];
  close: () => void;
  ignoreOutsideEvent?: (event: PointerEvent) => boolean;
}

const topFloatingLayerEntries: TopFloatingLayerEntry[] = [];

let removeTopFloatingLayerPointerListener: (() => void) | null = null;
let removeTopFloatingLayerKeyListener: (() => void) | null = null;
let removeNextClickSuppression: (() => void) | null = null;

interface FloatingLayerProviderProps {
  container: HTMLElement | null;
  children: React.ReactNode;
}

export function FloatingLayerProvider(props: FloatingLayerProviderProps) {
  return (
    <FloatingLayerContainerContext.Provider value={props.container}>
      {props.children}
    </FloatingLayerContainerContext.Provider>
  );
}

export function useFloatingLayerContainer() {
  return React.useContext(FloatingLayerContainerContext);
}

function isConnectedElement(
  element: Element | null | undefined
): element is Element {
  return element instanceof Element && element.isConnected;
}

function getEventPath(event: Event) {
  const path = event.composedPath();

  return path.length > 0 ? path : event.target ? [event.target] : [];
}

function isEventInsideElement(event: Event, element: Element) {
  return getEventPath(event).some(
    (target) => target instanceof Node && element.contains(target)
  );
}

function isEventInsideLayer(event: Event, entry: TopFloatingLayerEntry) {
  return entry.getElements().some((element) => {
    if (!isConnectedElement(element)) {
      return false;
    }

    return isEventInsideElement(event, element);
  });
}

function getTopFloatingLayerEntry() {
  for (let i = topFloatingLayerEntries.length - 1; i >= 0; i -= 1) {
    const entry = topFloatingLayerEntries[i];
    if (!entry) {
      continue;
    }
    const hasConnectedElement = entry.getElements().some(isConnectedElement);

    if (hasConnectedElement) {
      return entry;
    }
  }

  return null;
}

function stopNativeEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function suppressNextClick() {
  if (typeof window === 'undefined') {
    return;
  }

  removeNextClickSuppression?.();

  let timeoutId: number | null = null;

  const cleanup = () => {
    window.removeEventListener('click', handleClick, true);
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (removeNextClickSuppression === cleanup) {
      removeNextClickSuppression = null;
    }
  };

  const handleClick = (event: MouseEvent) => {
    stopNativeEvent(event);
    cleanup();
  };

  removeNextClickSuppression = cleanup;
  window.addEventListener('click', handleClick, true);
  timeoutId = window.setTimeout(cleanup, 500);
}

function handleTopFloatingLayerPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  const entry = getTopFloatingLayerEntry();

  if (!entry) {
    return;
  }

  if (isEventInsideLayer(event, entry)) {
    return;
  }

  if (entry.ignoreOutsideEvent?.(event)) {
    return;
  }

  entry.close();
  stopNativeEvent(event);
  suppressNextClick();
}

function handleTopFloatingLayerKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) {
    return;
  }

  const entry = getTopFloatingLayerEntry();

  if (!entry) {
    return;
  }

  entry.close();
  stopNativeEvent(event);
}

function syncTopFloatingLayerListeners() {
  if (typeof window === 'undefined') {
    return;
  }

  if (
    topFloatingLayerEntries.length > 0 &&
    !removeTopFloatingLayerPointerListener
  ) {
    window.addEventListener('pointerdown', handleTopFloatingLayerPointerDown, {
      capture: true
    });
    removeTopFloatingLayerPointerListener = () => {
      window.removeEventListener(
        'pointerdown',
        handleTopFloatingLayerPointerDown,
        true
      );
    };
  }

  if (
    topFloatingLayerEntries.length > 0 &&
    !removeTopFloatingLayerKeyListener
  ) {
    window.addEventListener('keydown', handleTopFloatingLayerKeyDown, {
      capture: true
    });
    removeTopFloatingLayerKeyListener = () => {
      window.removeEventListener(
        'keydown',
        handleTopFloatingLayerKeyDown,
        true
      );
    };
  }

  if (
    topFloatingLayerEntries.length === 0 &&
    removeTopFloatingLayerPointerListener
  ) {
    removeTopFloatingLayerPointerListener();
    removeTopFloatingLayerPointerListener = null;
  }

  if (
    topFloatingLayerEntries.length === 0 &&
    removeTopFloatingLayerKeyListener
  ) {
    removeTopFloatingLayerKeyListener();
    removeTopFloatingLayerKeyListener = null;
  }
}

export function hasOpenTopFloatingLayer() {
  return getTopFloatingLayerEntry() !== null;
}

export function closeTopFloatingLayer() {
  const entry = getTopFloatingLayerEntry();

  if (!entry) {
    return false;
  }

  entry.close();

  return true;
}

export function useTopFloatingLayerDismiss(
  options: TopFloatingLayerDismissOptions
) {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  React.useEffect(() => {
    if (!options.enabled) {
      return;
    }

    const entry: TopFloatingLayerEntry = {
      getElements: () => optionsRef.current.getElements(),
      close: () => optionsRef.current.close(),
      ignoreOutsideEvent: (event) =>
        optionsRef.current.ignoreOutsideEvent?.(event) ?? false
    };

    topFloatingLayerEntries.push(entry);
    syncTopFloatingLayerListeners();

    return () => {
      const index = topFloatingLayerEntries.indexOf(entry);
      if (index >= 0) {
        topFloatingLayerEntries.splice(index, 1);
      }
      syncTopFloatingLayerListeners();
    };
  }, [options.enabled]);
}
