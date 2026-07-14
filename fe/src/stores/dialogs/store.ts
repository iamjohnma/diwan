import { create } from 'zustand';

export interface CommandPaletteOpenOptions {
  initialQuery?: string;
}

export type DialogId = 'commandPalette' | 'keyboardShortcuts';

export interface DialogPayloads {
  commandPalette: CommandPaletteOpenOptions | undefined;
  keyboardShortcuts: undefined;
}

// Reserved for per-dialog extras once Law domain dialogs need them.

interface DialogSubmitHandler {
  id: string;
  priority: number;
  onSubmit: () => void;
  isDisabled?: () => boolean;
}

interface DialogEntry<T extends DialogId = DialogId> {
  payload: DialogPayloads[T];
  extras?: Record<string, unknown>;
}

interface DialogsState {
  openDialogs: Map<DialogId, DialogEntry>;
  registeredDialogs: Map<string, () => void>;
  submitHandlers: Map<string, DialogSubmitHandler>;
  isEnterPressed: boolean;
  activeToastLayerId: string | null;
  toastLayerSequence: number;

  open: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => void;
  close: (id: DialogId) => void;
  toggle: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => void;
  closeAll: () => void;
  isOpen: (id: DialogId) => boolean;
  hasOpenDialogs: () => boolean;
  getData: <T extends DialogId>(id: T) => DialogPayloads[T] | undefined;
  getExtras: (id: DialogId) => Record<string, unknown> | undefined;
  setExtras: (id: DialogId, extras: Record<string, unknown>) => void;

  registerDialog: (id: string, closeCallback: () => void) => void;
  unregisterDialog: (id: string) => void;

  registerSubmit: (handler: DialogSubmitHandler) => void;
  unregisterSubmit: (id: string) => void;
  getTopSubmitHandler: () => DialogSubmitHandler | undefined;
  triggerTopSubmit: () => boolean;
  setEnterPressed: (pressed: boolean) => void;
}

function getOpenLayerCount(state: DialogsState): number {
  return state.openDialogs.size + state.registeredDialogs.size;
}

/**
 * Full-screen page surfaces that register a toast layer so their Escape key
 * and toast routing behave like dialogs, but that are opaque z-50 workspaces
 * rather than modal overlays. While only these are open, the base toaster
 * must be lifted above them or default-layer toasts render invisibly behind
 * the surface.
 */
const FULLSCREEN_SURFACE_LAYER_IDS = new Set<string>([]);

export function hasOnlyFullscreenSurfaceToastLayers(
  state: Pick<DialogsState, 'openDialogs' | 'registeredDialogs'>
): boolean {
  if (state.openDialogs.size > 0 || state.registeredDialogs.size === 0) {
    return false;
  }

  for (const id of state.registeredDialogs.keys()) {
    if (!FULLSCREEN_SURFACE_LAYER_IDS.has(id)) {
      return false;
    }
  }

  return true;
}

/** Returns `next` plus the toast-layer bookkeeping the map change implies. */
function withToastLayerPatch(
  state: DialogsState,
  next: Partial<Pick<DialogsState, 'openDialogs' | 'registeredDialogs'>>
): Partial<DialogsState> {
  const previousOpenLayerCount = getOpenLayerCount(state);
  const nextOpenLayerCount =
    (next.openDialogs ?? state.openDialogs).size +
    (next.registeredDialogs ?? state.registeredDialogs).size;

  if (previousOpenLayerCount === 0 && nextOpenLayerCount > 0) {
    const toastLayerSequence = state.toastLayerSequence + 1;

    return {
      ...next,
      toastLayerSequence,
      activeToastLayerId: `dialog-layer-${toastLayerSequence}`
    };
  }

  if (previousOpenLayerCount > 0 && nextOpenLayerCount === 0) {
    return { ...next, activeToastLayerId: null };
  }

  return next;
}

export const useDialogsStore = create<DialogsState>()((set, get) => ({
  openDialogs: new Map(),
  registeredDialogs: new Map(),
  submitHandlers: new Map(),
  isEnterPressed: false,
  activeToastLayerId: null,
  toastLayerSequence: 0,

  open: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => {
    set((state) => {
      const openDialogs = new Map(state.openDialogs);
      openDialogs.set(id, {
        payload: payload as DialogPayloads[DialogId]
      });

      return withToastLayerPatch(state, { openDialogs });
    });
  },

  close: (id: DialogId) => {
    set((state) => {
      if (!state.openDialogs.has(id)) return state;
      const openDialogs = new Map(state.openDialogs);
      openDialogs.delete(id);

      return withToastLayerPatch(state, { openDialogs });
    });
  },

  toggle: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => {
    const { isOpen, open, close } = get();
    if (isOpen(id)) {
      close(id);
    } else {
      open(id, payload);
    }
  },

  closeAll: () => {
    const { openDialogs, registeredDialogs } = get();
    if (openDialogs.size === 0 && registeredDialogs.size === 0) {
      return;
    }

    for (const closeCallback of Array.from(registeredDialogs.values())) {
      closeCallback();
    }

    set((state) => {
      if (state.openDialogs.size === 0) {
        return state;
      }

      return {
        openDialogs: new Map<DialogId, DialogEntry>(),
        activeToastLayerId:
          state.registeredDialogs.size === 0 ? null : state.activeToastLayerId
      };
    });
  },

  isOpen: (id: DialogId) => get().openDialogs.has(id),

  hasOpenDialogs: () => getOpenLayerCount(get()) > 0,

  getData: <T extends DialogId>(id: T) => {
    const entry = get().openDialogs.get(id);

    return entry?.payload as DialogPayloads[T] | undefined;
  },

  getExtras: (id: DialogId) => {
    const entry = get().openDialogs.get(id);

    return entry?.extras;
  },

  setExtras: (id: DialogId, extras: Record<string, unknown>) => {
    set((state) => {
      const entry = state.openDialogs.get(id);
      if (!entry) return state;

      return {
        openDialogs: new Map(state.openDialogs).set(id, {
          ...entry,
          extras: {
            ...(entry.extras ?? {}),
            ...extras
          }
        })
      };
    });
  },

  registerDialog: (id: string, closeCallback: () => void) => {
    set((state) => {
      if (state.registeredDialogs.get(id) === closeCallback) {
        return state;
      }

      const registeredDialogs = new Map(state.registeredDialogs);
      registeredDialogs.set(id, closeCallback);

      return withToastLayerPatch(state, { registeredDialogs });
    });
  },

  unregisterDialog: (id: string) => {
    set((state) => {
      if (!state.registeredDialogs.has(id)) {
        return state;
      }

      const registeredDialogs = new Map(state.registeredDialogs);
      registeredDialogs.delete(id);

      return withToastLayerPatch(state, { registeredDialogs });
    });
  },

  registerSubmit: (handler: DialogSubmitHandler) => {
    set((state) => ({
      submitHandlers: new Map(state.submitHandlers).set(handler.id, handler)
    }));
  },

  unregisterSubmit: (id: string) => {
    set((state) => {
      if (!state.submitHandlers.has(id)) return state;
      const submitHandlers = new Map(state.submitHandlers);
      submitHandlers.delete(id);

      return { submitHandlers };
    });
  },

  getTopSubmitHandler: () =>
    Array.from(get().submitHandlers.values()).reduce<
      DialogSubmitHandler | undefined
    >(
      (topHandler, handler) =>
        !topHandler || handler.priority > topHandler.priority
          ? handler
          : topHandler,
      undefined
    ),

  triggerTopSubmit: () => {
    if (get().isEnterPressed) return false;

    const topHandler = get().getTopSubmitHandler();
    if (!topHandler) return false;
    if (topHandler.isDisabled?.()) return false;

    set({ isEnterPressed: true });
    topHandler.onSubmit();

    return true;
  },

  setEnterPressed: (pressed: boolean) => set({ isEnterPressed: pressed })
}));
