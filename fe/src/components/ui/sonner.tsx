import * as React from 'react';
import {
  CheckCircleIcon,
  CircleNotchIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import {
  type ExternalToast,
  Toaster as SonnerRoot,
  type ToastT,
  type ToastToDismiss,
  type ToasterProps,
  toast as sonnerToast,
  useSonner
} from 'sonner';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useDirection } from '@/hooks/common/direction';
import { cn } from '@/lib/utils';
import {
  hasOnlyFullscreenSurfaceToastLayers,
  useDialogsStore
} from '@/stores/dialogs/store';

const WRAPPER_BASE =
  'flex items-center justify-center size-8 rounded-lg shrink-0';

const ICON_FROM_SCALE = 0.9;

const ICON_MOTION = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

const TOAST_ELEMENT_SELECTOR = '[data-sonner-toast]';

const TOASTER_ELEMENT_SELECTOR = '[data-sonner-toaster]';

const DIALOG_TOASTER_ID_PREFIX = 'dialog-layer-';

const DEFAULT_TOASTER_Z_INDEX = 45;

/**
 * Base-toaster z-index while a full-screen surface is the only open layer:
 * above the surface so default-layer toasts stay visible, below the
 * dialog-layer toaster and any modal dialog chrome.
 */
const FULLSCREEN_SURFACE_TOASTER_Z_INDEX = 60;

const DIALOG_TOASTER_Z_INDEX = 70;

type TextDirection = 'ltr' | 'rtl';

const INTERACTIVE_TOAST_ELEMENT_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-button]',
  '[data-close-button]'
].join(', ');

function createToastIcons(): NonNullable<ToasterProps['icons']> {
  return {
    success: (
      <span key="toast-success" className={cn(WRAPPER_BASE, 'bg-primary/10')}>
        <motion.span
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: ICON_FROM_SCALE }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ICON_MOTION}
        >
          <CheckCircleIcon className="size-4.5 text-primary" weight="duotone" />
        </motion.span>
      </span>
    ),
    error: (
      <span
        key="toast-error"
        className={cn(WRAPPER_BASE, 'bg-error/10 self-start')}
      >
        <motion.span
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: ICON_FROM_SCALE }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ICON_MOTION}
        >
          <XCircleIcon className="size-4.5 text-error" weight="duotone" />
        </motion.span>
      </span>
    ),
    warning: (
      <span key="toast-warning" className={cn(WRAPPER_BASE, 'bg-warning/10')}>
        <motion.span
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: ICON_FROM_SCALE }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ICON_MOTION}
        >
          <WarningIcon className="size-4.5 text-warning" weight="duotone" />
        </motion.span>
      </span>
    ),
    info: (
      <span key="toast-info" className={cn(WRAPPER_BASE, 'bg-primary/10')}>
        <motion.span
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: ICON_FROM_SCALE }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ICON_MOTION}
        >
          <InfoIcon className="size-4.5 text-primary" weight="duotone" />
        </motion.span>
      </span>
    ),
    loading: (
      <span
        key="toast-loading"
        className={cn(
          'sonner-loading-icon-slot',
          WRAPPER_BASE,
          'bg-primary/10'
        )}
      >
        <CircleNotchIcon
          className="size-4.5 animate-spin text-primary"
          weight="bold"
        />
      </span>
    )
  };
}

const TOAST_CLASS_NAMES = {
  toast:
    '!flex-row !items-center !justify-between !gap-2 !py-3 !px-3 !cursor-pointer',
  icon: '!size-8 !m-0 !shrink-0 !items-center !justify-center',
  content: '!flex-1 !min-w-0',
  title: '!font-medium !text-text-primary !leading-5 !break-words',
  description: '!text-text-secondary !leading-5 !break-words',
  actionButton:
    '!shrink-0 !px-3 !py-1.5 !text-xs !font-medium !rounded-lg !bg-secondary !text-secondary-foreground hover:!bg-secondary-hover active:!bg-secondary-active !border !border-secondary !transition-colors !cursor-pointer !h-auto !self-center',
  cancelButton: '!hidden',
  closeButton: '!hidden'
};

const TOAST_STYLE = {
  '--normal-bg': 'var(--background-base)',
  '--normal-text': 'var(--text-primary)',
  '--normal-border': 'var(--border-default)',
  '--border-radius': 'var(--radius-xl)',
  fontFamily: 'inherit',
  zIndex: DEFAULT_TOASTER_Z_INDEX
} as React.CSSProperties;

function resolveDefaultToastPosition(
  direction: TextDirection,
  isCompactViewport: boolean
): NonNullable<ToasterProps['position']> {
  if (isCompactViewport) {
    return 'bottom-center';
  }

  return direction === 'rtl' ? 'bottom-right' : 'bottom-left';
}

function withDialogToasterId<T extends { toasterId?: string } | undefined>(
  data: T
) {
  const activeToastLayerId = useDialogsStore.getState().activeToastLayerId;

  if (data?.toasterId || !activeToastLayerId) {
    return data;
  }

  return {
    ...data,
    toasterId: activeToastLayerId
  } as T;
}

const defaultLayerToast = ((
  message: Parameters<typeof sonnerToast>[0],
  data?: ExternalToast
) => sonnerToast(message, data)) as typeof sonnerToast;

defaultLayerToast.success = (message, data) =>
  sonnerToast.success(message, data);
defaultLayerToast.info = (message, data) => sonnerToast.info(message, data);
defaultLayerToast.warning = (message, data) =>
  sonnerToast.warning(message, data);
defaultLayerToast.error = (message, data) => sonnerToast.error(message, data);
defaultLayerToast.custom = (jsx, data) => sonnerToast.custom(jsx, data);
defaultLayerToast.message = (message, data) =>
  sonnerToast.message(message, data);
defaultLayerToast.loading = (message, data) =>
  sonnerToast.loading(message, data);
defaultLayerToast.promise = (promise, data) =>
  sonnerToast.promise(promise, data);
defaultLayerToast.dismiss = sonnerToast.dismiss;
defaultLayerToast.getHistory = sonnerToast.getHistory;
defaultLayerToast.getToasts = sonnerToast.getToasts;

type RoutedToast = typeof sonnerToast & {
  defaultLayer: typeof sonnerToast;
};

const routedToast = ((
  message: Parameters<typeof sonnerToast>[0],
  data?: ExternalToast
) => sonnerToast(message, withDialogToasterId(data))) as RoutedToast;

routedToast.success = (message, data) =>
  sonnerToast.success(message, withDialogToasterId(data));
routedToast.info = (message, data) =>
  sonnerToast.info(message, withDialogToasterId(data));
routedToast.warning = (message, data) =>
  sonnerToast.warning(message, withDialogToasterId(data));
routedToast.error = (message, data) =>
  sonnerToast.error(message, withDialogToasterId(data));
routedToast.custom = (jsx, data) =>
  sonnerToast.custom(jsx, withDialogToasterId(data));
routedToast.message = (message, data) =>
  sonnerToast.message(message, withDialogToasterId(data));
routedToast.loading = (message, data) =>
  sonnerToast.loading(message, withDialogToasterId(data));
routedToast.promise = (promise, data) =>
  sonnerToast.promise(promise, withDialogToasterId(data));
routedToast.dismiss = sonnerToast.dismiss;
routedToast.getHistory = sonnerToast.getHistory;
routedToast.getToasts = sonnerToast.getToasts;

routedToast.defaultLayer = defaultLayerToast;

export const toast = routedToast;

function isActiveToast(
  currentToast: ToastT | ToastToDismiss
): currentToast is ToastT {
  return !('dismiss' in currentToast);
}

function resolveToastContent(
  content: ToastT['title'] | ToastT['description']
): React.ReactNode {
  return typeof content === 'function' ? content() : content;
}

function moveToastToDefaultLayer(currentToast: ToastT) {
  const message = resolveToastContent(currentToast.title);
  const customToast = currentToast.jsx;
  const data: ExternalToast = {
    id: currentToast.id,
    description: resolveToastContent(currentToast.description),
    icon: currentToast.icon,
    richColors: currentToast.richColors,
    invert: currentToast.invert,
    closeButton: currentToast.closeButton,
    dismissible: currentToast.dismissible,
    duration: currentToast.duration,
    action: currentToast.action,
    cancel: currentToast.cancel,
    onDismiss: currentToast.onDismiss,
    onAutoClose: currentToast.onAutoClose,
    cancelButtonStyle: currentToast.cancelButtonStyle,
    actionButtonStyle: currentToast.actionButtonStyle,
    style: currentToast.style,
    unstyled: currentToast.unstyled,
    className: currentToast.className,
    classNames: currentToast.classNames,
    descriptionClassName: currentToast.descriptionClassName,
    position: currentToast.position,
    testId: currentToast.testId,
    toasterId: undefined
  };

  if (React.isValidElement(customToast)) {
    sonnerToast.custom(() => customToast, data);

    return;
  }

  switch (currentToast.type) {
    case 'success':
      sonnerToast.success(message, data);

      return;
    case 'info':
      sonnerToast.info(message, data);

      return;
    case 'warning':
      sonnerToast.warning(message, data);

      return;
    case 'error':
      sonnerToast.error(message, data);

      return;
    case 'loading':
      sonnerToast.loading(message, data);

      return;
    default:
      sonnerToast(message, data);
  }
}

function moveToastsFromLayerToDefault(toasterId: string) {
  for (const currentToast of sonnerToast.getToasts()) {
    if (!isActiveToast(currentToast) || currentToast.toasterId !== toasterId) {
      continue;
    }

    moveToastToDefaultLayer(currentToast);
  }
}

export function DialogLayerToaster() {
  const activeToastLayerId = useDialogsStore(
    (state) => state.activeToastLayerId
  );
  const previousToastLayerIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const previousToastLayerId = previousToastLayerIdRef.current;

    if (
      previousToastLayerId &&
      previousToastLayerId.startsWith(DIALOG_TOASTER_ID_PREFIX) &&
      previousToastLayerId !== activeToastLayerId
    ) {
      moveToastsFromLayerToDefault(previousToastLayerId);
    }

    previousToastLayerIdRef.current = activeToastLayerId;
  }, [activeToastLayerId]);

  if (!activeToastLayerId) {
    return null;
  }

  return <Toaster id={activeToastLayerId} />;
}

function getToastPosition(
  toasterElement: HTMLElement
): NonNullable<ToasterProps['position']> | null {
  const xPosition = toasterElement.dataset.xPosition;
  const yPosition = toasterElement.dataset.yPosition;

  if (!xPosition || !yPosition) {
    return null;
  }

  return `${yPosition}-${xPosition}` as NonNullable<ToasterProps['position']>;
}

function isInteractiveToastElement(target: HTMLElement) {
  return !!target.closest(INTERACTIVE_TOAST_ELEMENT_SELECTOR);
}

export function Toaster(props: ToasterProps) {
  const direction = useDirection();
  const breakpoint = useBreakpoint();
  const sonner = useSonner();
  const toastIcons = React.useMemo(() => createToastIcons(), []);
  const isDialogLayerToaster =
    typeof props.id === 'string' &&
    props.id.startsWith(DIALOG_TOASTER_ID_PREFIX);
  const isLiftedAboveFullscreenSurface = useDialogsStore(
    (state) =>
      !isDialogLayerToaster && hasOnlyFullscreenSurfaceToastLayers(state)
  );

  const position = resolveDefaultToastPosition(
    direction,
    breakpoint.isBelow('xl')
  );
  const resolvedPosition = props.position ?? position;

  const visibleToasts = React.useMemo(() => {
    if (props.id) {
      return sonner.toasts.filter(
        (currentToast) => currentToast.toasterId === props.id
      );
    }

    return sonner.toasts.filter((currentToast) => !currentToast.toasterId);
  }, [props.id, sonner.toasts]);

  React.useEffect(() => {
    function handleToastClick(event: MouseEvent) {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (isInteractiveToastElement(event.target)) {
        return;
      }

      const toastElement = event.target.closest<HTMLElement>(
        TOAST_ELEMENT_SELECTOR
      );
      const toasterElement = event.target.closest<HTMLElement>(
        TOASTER_ELEMENT_SELECTOR
      );

      if (!toastElement || !toasterElement) {
        return;
      }

      const clickedPosition = getToastPosition(toasterElement);

      if (!clickedPosition) {
        return;
      }

      const renderedToasts = Array.from(
        toasterElement.querySelectorAll<HTMLElement>(TOAST_ELEMENT_SELECTOR)
      );
      const toastIndex = renderedToasts.indexOf(toastElement);

      if (toastIndex === -1) {
        return;
      }

      const matchingToasts = visibleToasts.filter((currentToast) =>
        currentToast.position
          ? currentToast.position === clickedPosition
          : clickedPosition === resolvedPosition
      );
      const clickedToast = matchingToasts[toastIndex];

      if (!clickedToast || clickedToast.dismissible === false) {
        return;
      }

      toast.dismiss(clickedToast.id);
    }

    document.addEventListener('click', handleToastClick);

    return () => {
      document.removeEventListener('click', handleToastClick);
    };
  }, [resolvedPosition, visibleToasts]);

  return (
    <SonnerRoot
      theme="light"
      dir={direction}
      position={position}
      icons={toastIcons}
      toastOptions={{ classNames: TOAST_CLASS_NAMES }}
      style={{
        ...TOAST_STYLE,
        zIndex: isDialogLayerToaster
          ? DIALOG_TOASTER_Z_INDEX
          : isLiftedAboveFullscreenSurface
            ? FULLSCREEN_SURFACE_TOASTER_Z_INDEX
            : DEFAULT_TOASTER_Z_INDEX,
        ...props.style
      }}
      {...props}
    />
  );
}
