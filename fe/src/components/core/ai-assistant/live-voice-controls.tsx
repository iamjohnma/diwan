import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  ArrowUpIcon,
  ChatCircleTextIcon,
  WaveformIcon,
  WaveformSlashIcon,
  XIcon
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  VOICE_MODE_CONTROLS_HIDDEN,
  VOICE_MODE_CONTROLS_REDUCED_MOTION_HIDDEN,
  VOICE_MODE_CONTROLS_REDUCED_MOTION_VISIBLE,
  VOICE_MODE_CONTROLS_TRANSITION,
  VOICE_MODE_CONTROLS_VISIBLE,
  VOICE_MODE_INPUT_PERSPECTIVE_PX,
  VOICE_MODE_OUTER_CONTROLS_HIDDEN,
  VOICE_MODE_OUTER_CONTROLS_TRANSITION,
  VOICE_MODE_OUTER_CONTROLS_VISIBLE
} from '@/constants/core/ai-assistant/voice-orb';
import { useBreakpoint, useDirection } from '@/hooks/common';
import { cn } from '@/lib/utils';

interface AiAssistantLiveVoiceControlsDockProps {
  active: boolean;
  isMuted: boolean;
  className: string;
  onToggleMuted: () => void;
  onExit: () => void;
  onSendText: (message: string) => boolean;
  variant?: 'panel' | 'floating';
}

const CONTROL_BUTTON_BASE =
  'relative flex size-14 cursor-pointer items-center justify-center rounded-full outline-none transition-[box-shadow,background-color,border-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/35 md:size-[3.35rem]';
const DOCK_TRANSITION = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.82
};
const FIELD_TRANSITION = {
  type: 'spring' as const,
  stiffness: 430,
  damping: 38,
  mass: 0.76
};
const ICON_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const
};
const CONTROL_SIZE_MOBILE_PX = 56;
const CONTROL_SIZE_DESKTOP_PX = 53.6;
const CONTROL_GAP_PX = 8;
const CLIP_BLEED_PX = 4;

export function AiAssistantLiveVoiceControlsDock(
  props: AiAssistantLiveVoiceControlsDockProps
) {
  const reducedMotion = useReducedMotion();
  const isFloating = props.variant === 'floating';
  const breakpoint = useBreakpoint();
  const direction = useDirection();
  const translation = useTranslation();
  const [isChatModeActive, setIsChatModeActive] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const windowWidth =
    typeof window === 'undefined'
      ? 320
      : window.document.documentElement.clientWidth;
  const chatInputWidth = breakpoint.isMobile
    ? Math.max(184, Math.min(304, windowWidth - 116))
    : 256;
  const controlSize = breakpoint.isMobile
    ? CONTROL_SIZE_MOBILE_PX
    : CONTROL_SIZE_DESKTOP_PX;
  const inactiveControlsWidth = controlSize * 2 + CONTROL_GAP_PX;
  const liveViewportWidth =
    (isChatModeActive
      ? chatInputWidth + CONTROL_GAP_PX + controlSize
      : controlSize + CONTROL_GAP_PX + inactiveControlsWidth) +
    CLIP_BLEED_PX * 2;
  const trackWidth =
    chatInputWidth +
    CONTROL_GAP_PX +
    controlSize +
    CONTROL_GAP_PX +
    inactiveControlsWidth;
  const trackX = isChatModeActive ? 0 : -(chatInputWidth + CONTROL_GAP_PX);
  const prompt = chatDraft.trim();
  const controlsVisible = reducedMotion
    ? VOICE_MODE_CONTROLS_REDUCED_MOTION_VISIBLE
    : isFloating
      ? VOICE_MODE_OUTER_CONTROLS_VISIBLE
      : VOICE_MODE_CONTROLS_VISIBLE;
  const controlsHidden = reducedMotion
    ? VOICE_MODE_CONTROLS_REDUCED_MOTION_HIDDEN
    : isFloating
      ? VOICE_MODE_OUTER_CONTROLS_HIDDEN
      : VOICE_MODE_CONTROLS_HIDDEN;
  const controlsTransition = isFloating
    ? VOICE_MODE_OUTER_CONTROLS_TRANSITION
    : VOICE_MODE_CONTROLS_TRANSITION;

  useEffect(() => {
    if (!isChatModeActive) return;
    const frame = window.requestAnimationFrame(() =>
      textareaRef.current?.focus({ preventScroll: true })
    );
    return () => window.cancelAnimationFrame(frame);
  }, [isChatModeActive]);

  const exitChatMode = () => {
    setIsChatModeActive(false);
    setChatDraft('');
  };
  const submitChat = () => {
    if (!prompt || !props.onSendText(prompt)) return;
    exitChatMode();
  };
  const handleChatButton = () => {
    if (!isChatModeActive) {
      setIsChatModeActive(true);
    } else if (prompt) {
      submitChat();
    } else {
      exitChatMode();
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      exitChatMode();
    } else if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitChat();
    }
  };

  return (
    <div
      className={cn('pointer-events-none', props.className)}
      style={{ perspective: VOICE_MODE_INPUT_PERSPECTIVE_PX }}
    >
      <AnimatePresence>
        {props.active && (
          <motion.div
            key="live-voice-controls-dock"
            initial={controlsHidden}
            animate={controlsVisible}
            exit={controlsHidden}
            transition={controlsTransition}
            style={{
              transformOrigin: '50% 100%',
              transformStyle: 'preserve-3d'
            }}
            className="pointer-events-auto will-change-transform"
          >
            <motion.div
              layout
              transition={DOCK_TRANSITION}
              className={cn(
                'ai-assistant-live-voice-dock direction-ltr flex max-w-[calc(100vw-2rem)] items-center overflow-hidden rounded-full border border-border-default/70 bg-background-base/82 p-2 backdrop-blur-xl',
                isChatModeActive &&
                  'ai-assistant-live-voice-dock-chat border-primary/20 bg-background-base/94'
              )}
            >
              <motion.div
                animate={{ width: liveViewportWidth }}
                initial={false}
                transition={reducedMotion ? { duration: 0 } : DOCK_TRANSITION}
                className="relative -m-1 h-16 shrink-0 overflow-hidden md:h-[calc(3.35rem+0.5rem)]"
              >
                <motion.div
                  animate={{ transform: `translateX(${trackX}px)` }}
                  initial={false}
                  transition={
                    reducedMotion ? { duration: 0 } : FIELD_TRANSITION
                  }
                  style={{ width: trackWidth }}
                  className="absolute inset-y-1 start-1 flex items-center gap-2"
                >
                  <form
                    style={{ width: chatInputWidth }}
                    className={cn(
                      'h-full min-w-0 shrink-0',
                      !isChatModeActive && 'pointer-events-none'
                    )}
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitChat();
                    }}
                  >
                    <div className="flex h-14 min-w-0 items-center rounded-full border border-border-default/80 bg-background-surface/96 px-4 md:h-13.5">
                      <textarea
                        ref={textareaRef}
                        value={chatDraft}
                        rows={1}
                        aria-label={translation.t(
                          'aiAssistant.inputPlaceholder'
                        )}
                        placeholder={translation.t(
                          'aiAssistant.inputPlaceholder'
                        )}
                        dir={direction}
                        tabIndex={isChatModeActive ? undefined : -1}
                        className="hide-scrollbar h-10 min-h-0 w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-base leading-6 text-text-primary outline-none placeholder:text-text-tertiary md:text-sm"
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          setChatDraft(event.target.value)
                        }
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                  </form>
                  <button
                    type="button"
                    aria-label={translation.t('aiAssistant.actions.send')}
                    aria-expanded={isChatModeActive}
                    className={cn(
                      CONTROL_BUTTON_BASE,
                      'shrink-0',
                      isChatModeActive && prompt
                        ? 'border border-primary/30 bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover'
                        : 'border border-border-default/80 bg-background-surface text-text-primary shadow-sm hover:border-primary/35 hover:bg-primary/10 hover:text-primary'
                    )}
                    onClick={handleChatButton}
                  >
                    <span className="relative block size-5">
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={isChatModeActive && prompt ? 'send' : 'chat'}
                          initial={{ opacity: 0, y: 8, scale: 0.84 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.84 }}
                          transition={ICON_TRANSITION}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          {isChatModeActive && prompt ? (
                            <ArrowUpIcon className="size-5" weight="bold" />
                          ) : (
                            <ChatCircleTextIcon
                              className="size-5"
                              weight="bold"
                            />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </button>
                  <div
                    style={{ width: inactiveControlsWidth }}
                    className={cn(
                      'flex h-full shrink-0 items-center gap-2',
                      isChatModeActive && 'pointer-events-none'
                    )}
                  >
                    <button
                      type="button"
                      aria-label={
                        props.isMuted
                          ? translation.t('aiAssistant.actions.unmute')
                          : translation.t('aiAssistant.actions.mute')
                      }
                      aria-pressed={props.isMuted}
                      tabIndex={isChatModeActive ? -1 : undefined}
                      className={cn(
                        CONTROL_BUTTON_BASE,
                        props.isMuted
                          ? 'border border-border-default/80 bg-background-surface text-text-secondary shadow-sm hover:text-text-primary'
                          : 'border border-primary/30 bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover'
                      )}
                      onClick={props.onToggleMuted}
                    >
                      {props.isMuted ? (
                        <WaveformSlashIcon className="size-5" weight="bold" />
                      ) : (
                        <WaveformIcon className="size-5" weight="bold" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={translation.t(
                        'aiAssistant.actions.stopVoice'
                      )}
                      tabIndex={isChatModeActive ? -1 : undefined}
                      className={cn(
                        CONTROL_BUTTON_BASE,
                        'border border-border-default/80 bg-background-base/90 text-text-secondary shadow-sm hover:border-border-dark hover:bg-background-surface hover:text-text-primary'
                      )}
                      onClick={props.onExit}
                    >
                      <XIcon className="size-5" weight="bold" />
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
