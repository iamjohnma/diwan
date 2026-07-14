import * as React from 'react';
import { useBreakpoint } from '@/hooks/common';
import { useDirection } from '@/hooks/common';

type PanelId = string;

interface TriggerEntry {
  ref: React.RefObject<HTMLElement | null>;
  index: number;
}

interface DynamicPopoverState {
  activePanel: PanelId | null;
  previousPanel: PanelId | null;
  direction: number;
  isTemporarilyHidden: boolean;
}

type DynamicPopoverAction =
  | { type: 'OPEN'; panelId: PanelId; direction: number }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE'; panelId: PanelId; direction: number }
  | { type: 'HIDE_TEMPORARILY' }
  | { type: 'SHOW_TEMPORARILY_HIDDEN' };

interface DynamicPopoverContextValue {
  state: DynamicPopoverState;
  triggersRef: React.RefObject<Map<PanelId, TriggerEntry>>;
  open: (panelId: PanelId) => void;
  close: () => void;
  toggle: (panelId: PanelId) => void;
  hideTemporarily: () => void;
  showTemporarilyHidden: () => void;
  registerTrigger: (
    panelId: PanelId,
    ref: React.RefObject<HTMLElement | null>,
    index: number
  ) => void;
  unregisterTrigger: (panelId: PanelId) => void;
  isMobile: boolean;
}

const DynamicPopoverContext =
  React.createContext<DynamicPopoverContextValue | null>(null);

export function useDynamicPopover() {
  const context = React.useContext(DynamicPopoverContext);
  if (!context) {
    throw new Error('useDynamicPopover must be used within DynamicPopover');
  }

  return context;
}

export function resolveDynamicPopoverIsLayerVisible(
  state: DynamicPopoverState
): boolean {
  return state.activePanel !== null && !state.isTemporarilyHidden;
}

function resolveDynamicPopoverState(
  state: DynamicPopoverState,
  action: DynamicPopoverAction
): DynamicPopoverState {
  switch (action.type) {
    case 'OPEN':
      return {
        activePanel: action.panelId,
        previousPanel: state.activePanel,
        direction: action.direction,
        isTemporarilyHidden: false
      };
    case 'CLOSE':
      return {
        activePanel: null,
        previousPanel: state.activePanel,
        direction: state.direction,
        isTemporarilyHidden: false
      };
    case 'TOGGLE':
      if (state.activePanel === action.panelId) {
        return {
          activePanel: null,
          previousPanel: state.activePanel,
          direction: state.direction,
          isTemporarilyHidden: false
        };
      }

      return {
        activePanel: action.panelId,
        previousPanel: state.activePanel,
        direction: action.direction,
        isTemporarilyHidden: false
      };
    case 'HIDE_TEMPORARILY':
      return {
        ...state,
        isTemporarilyHidden: state.activePanel !== null
      };
    case 'SHOW_TEMPORARILY_HIDDEN':
      return {
        ...state,
        isTemporarilyHidden: false
      };
    default:
      return state;
  }
}

function getAnimationDirection(
  triggers: Map<PanelId, TriggerEntry>,
  from: PanelId | null,
  to: PanelId,
  isRTL: boolean
): number {
  if (!from) return 0;
  const fromEntry = triggers.get(from);
  const toEntry = triggers.get(to);
  if (!fromEntry || !toEntry) return 1;
  const rawDir = toEntry.index > fromEntry.index ? 1 : -1;

  return isRTL ? -rawDir : rawDir;
}

interface DynamicPopoverProps {
  children: React.ReactNode;
  onPanelChange?: (panelId: PanelId | null) => void;
}

export function DynamicPopover(props: DynamicPopoverProps) {
  const { isMobile } = useBreakpoint();
  const textDirection = useDirection();
  const isRTL = textDirection === 'rtl';

  const [state, dispatch] = React.useReducer(resolveDynamicPopoverState, {
    activePanel: null,
    previousPanel: null,
    direction: 0,
    isTemporarilyHidden: false
  });

  const triggersRef = React.useRef<Map<PanelId, TriggerEntry>>(new Map());
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const onPanelChangeRef = React.useRef(props.onPanelChange);
  onPanelChangeRef.current = props.onPanelChange;

  const open = React.useCallback(
    (panelId: PanelId) => {
      const dir = getAnimationDirection(
        triggersRef.current,
        stateRef.current.activePanel,
        panelId,
        isRTL
      );
      dispatch({ type: 'OPEN', panelId, direction: dir });
      onPanelChangeRef.current?.(panelId);
    },
    [isRTL]
  );

  const close = React.useCallback(() => {
    (document.activeElement as HTMLElement)?.blur();
    dispatch({ type: 'CLOSE' });
    onPanelChangeRef.current?.(null);
  }, []);

  const toggle = React.useCallback(
    (panelId: PanelId) => {
      if (stateRef.current.activePanel === panelId) {
        close();
      } else {
        open(panelId);
      }
    },
    [open, close]
  );

  const hideTemporarily = React.useCallback(() => {
    dispatch({ type: 'HIDE_TEMPORARILY' });
  }, []);

  const showTemporarilyHidden = React.useCallback(() => {
    dispatch({ type: 'SHOW_TEMPORARILY_HIDDEN' });
  }, []);

  const registerTrigger = React.useCallback(
    (
      panelId: PanelId,
      ref: React.RefObject<HTMLElement | null>,
      index: number
    ) => {
      triggersRef.current.set(panelId, { ref, index });
    },
    []
  );

  const unregisterTrigger = React.useCallback((panelId: PanelId) => {
    triggersRef.current.delete(panelId);
  }, []);

  const contextValue = React.useMemo<DynamicPopoverContextValue>(
    () => ({
      state,
      triggersRef,
      open,
      close,
      toggle,
      hideTemporarily,
      showTemporarilyHidden,
      registerTrigger,
      unregisterTrigger,
      isMobile
    }),
    [
      state,
      open,
      close,
      toggle,
      hideTemporarily,
      showTemporarilyHidden,
      registerTrigger,
      unregisterTrigger,
      isMobile
    ]
  );

  return (
    <DynamicPopoverContext.Provider value={contextValue}>
      {props.children}
    </DynamicPopoverContext.Provider>
  );
}

interface DynamicPopoverTriggerResultHook {
  ref: React.RefObject<HTMLElement | null>;
  isActive: boolean;
  toggle: () => void;
  triggerProps: {
    'data-state': 'open' | 'closed';
  };
}

export function useDynamicPopoverTrigger(
  panelId: PanelId,
  index: number
): DynamicPopoverTriggerResultHook {
  const {
    registerTrigger,
    unregisterTrigger,
    toggle: contextToggle,
    state
  } = useDynamicPopover();
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    registerTrigger(panelId, ref, index);

    return () => unregisterTrigger(panelId);
  }, [panelId, index, registerTrigger, unregisterTrigger]);

  const isActive = state.activePanel === panelId;

  const toggle = React.useCallback(() => {
    contextToggle(panelId);
  }, [contextToggle, panelId]);

  const triggerProps = React.useMemo(
    () => ({
      'data-state': (isActive ? 'open' : 'closed') as 'open' | 'closed'
    }),
    [isActive]
  );

  return { ref, isActive, toggle, triggerProps };
}
