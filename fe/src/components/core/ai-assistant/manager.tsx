import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { api } from '@diwan-be/convex/_generated/api';
import type { Id } from '@diwan-be/convex/_generated/dataModel';
import {
  ArrowUpIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  ListPlusIcon,
  MinusIcon,
  StarFourIcon,
  WaveformIcon,
  XIcon
} from '@phosphor-icons/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { AiAssistantLiveVoiceControlsDock } from '@/components/core/ai-assistant/live-voice-controls';
import {
  AssistantMarkdown,
  VoiceOrb
} from '@/components/core/ai-assistant/presentation';
import { AiAssistantThreadPicker } from '@/components/core/ai-assistant/thread-picker';
import {
  AiAssistantVoiceOrbGlow,
  warmVoiceOrbAuroraGlowRaster
} from '@/components/core/ai-assistant/voice-orb-glow';
import { AiAssistantVoiceWaveform } from '@/components/core/ai-assistant/voice-waveform';
import { IconButton, TextShimmer, toast } from '@/components/ui';
import { iconButtonVariants } from '@/components/ui/icon-button';
import {
  AI_ASSISTANT_PANEL_HEIGHT_CSS_TRANSITION,
  AI_ASSISTANT_PANEL_OPEN_TRANSITION,
  computeAiAssistantPanelHeight
} from '@/constants/core/ai-assistant/panel-layout';
import {
  VOICE_MODE_INPUT_EXIT,
  VOICE_MODE_INPUT_EXIT_TRANSITION,
  VOICE_MODE_INPUT_PERSPECTIVE_PX,
  VOICE_MODE_INPUT_REDUCED_MOTION_EXIT,
  VOICE_MODE_INPUT_REDUCED_MOTION_VISIBLE,
  VOICE_MODE_INPUT_RETURN_DELAYED_TRANSITION,
  VOICE_MODE_INPUT_TRANSFORM_ORIGIN,
  VOICE_MODE_INPUT_VISIBLE,
  VOICE_ORB_AURORA_ENTER_TRANSITION,
  VOICE_ORB_LAYOUT_TRANSITION,
  getVoiceOrbActiveBottomPaddingPx
} from '@/constants/core/ai-assistant/voice-orb';
import { useBreakpoint } from '@/hooks/common';
import { useAiAssistantVoiceInput } from '@/hooks/core/ai-assistant';
import { useAiAssistantVoice } from '@/hooks/core/ai-assistant-voice';
import { cn } from '@/lib/utils';
import { useDialogsStore } from '@/stores/dialogs/store';
import {
  hapticVoiceRecordingEnd,
  hapticVoiceRecordingStart
} from '@/utils/common/haptics';

type ThreadId = Id<'aiThreads'>;

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: { name: string; resultCount?: number };
}

function createClientKey(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseToolCall(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as {
      name?: unknown;
      resultCount?: unknown;
    };
    return typeof parsed.name === 'string'
      ? {
          name: parsed.name,
          resultCount:
            typeof parsed.resultCount === 'number'
              ? parsed.resultCount
              : undefined
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function AiAssistantManager() {
  const breakpoint = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const translation = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [threadId, setThreadId] = useState<ThreadId | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [optimistic, setOptimistic] = useState<DisplayMessage[]>([]);
  const [serverCutoff, setServerCutoff] = useState<number | null>(null);
  const [isVoiceHoldActive, setIsVoiceHoldActive] = useState(false);
  const [isInputReturningFromVoice, setIsInputReturningFromVoice] =
    useState(false);
  const [panelHeight, setPanelHeight] = useState(() =>
    computeAiAssistantPanelHeight(false)
  );
  const aiAssistantVoice = useAiAssistantVoice();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const voiceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceHoldPointerIdRef = useRef<number | null>(null);
  const voiceHoldStartedRef = useRef(false);
  const suppressVoiceClickRef = useRef(false);
  const previousVoiceActiveRef = useRef(false);

  const threads = useQuery(api.aiAssistant.listThreads, {}) ?? [];
  const serverMessages = useQuery(
    api.aiAssistant.listMessages,
    threadId
      ? { threadId, paginationOpts: { cursor: null, numItems: 200 } }
      : 'skip'
  );
  const createThread = useMutation(api.aiAssistant.createThread);
  const runChat = useAction(api.aiAssistantActions.chat);

  useEffect(() => {
    warmVoiceOrbAuroraGlowRaster();
  }, []);

  useEffect(() => {
    if (!threadId && threads[0]) setThreadId(threads[0].id);
  }, [threadId, threads]);

  useEffect(() => {
    const updateHeight = () =>
      setPanelHeight(computeAiAssistantPanelHeight(isExpanded));
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [isExpanded]);

  const persistedMessages = useMemo<DisplayMessage[]>(
    () =>
      (serverMessages ?? [])
        .filter((message) => message.role !== 'tool')
        .map((message) => ({
          id: message.id,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          toolCall: parseToolCall(message.toolCalls)
        })),
    [serverMessages]
  );
  const displayedMessages = [
    ...(serverCutoff === null
      ? persistedMessages
      : persistedMessages.slice(0, serverCutoff)),
    ...optimistic
  ];

  useEffect(() => {
    const element = scrollRef.current;
    if (element)
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [displayedMessages.length, optimistic.at(-1)?.content]);

  const startNewChat = useCallback(async () => {
    const id = await createThread({ clientThreadKey: createClientKey() });
    setThreadId(id);
    setOptimistic([]);
    setServerCutoff(null);
    setIsOpen(true);
  }, [createThread]);

  const ensureThread = useCallback(async () => {
    if (threadId) return threadId;
    const id = await createThread({ clientThreadKey: createClientKey() });
    setThreadId(id);
    return id;
  }, [createThread, threadId]);

  const submit = useCallback(
    async (promptOverride?: string) => {
      const prompt = (promptOverride ?? draft).trim();
      if (!prompt || isSending) return;
      setDraft('');
      setIsSending(true);
      const activeThreadId = await ensureThread();
      const cutoff = persistedMessages.length;
      setServerCutoff(cutoff);
      setOptimistic([
        { id: createClientKey(), role: 'user', content: prompt },
        { id: createClientKey(), role: 'assistant', content: '' }
      ]);
      try {
        const result = await runChat({ threadId: activeThreadId, prompt });
        if (result.toolCall) {
          setOptimistic((messages) =>
            messages.map((message) =>
              message.role === 'assistant'
                ? { ...message, toolCall: result.toolCall }
                : message
            )
          );
        }
        const chunks = result.text.match(/\S+\s*/g) ?? [result.text];
        for (const chunk of chunks) {
          await new Promise((resolve) => window.setTimeout(resolve, 12));
          setOptimistic((messages) =>
            messages.map((message) =>
              message.role === 'assistant'
                ? { ...message, content: message.content + chunk }
                : message
            )
          );
        }
        window.setTimeout(() => {
          setOptimistic([]);
          setServerCutoff(null);
        }, 180);
      } catch (error) {
        setOptimistic((messages) =>
          messages.map((message) =>
            message.role === 'assistant'
              ? {
                  ...message,
                  content: translation.t('aiAssistant.errors.unavailable')
                }
              : message
          )
        );
        toast.error(
          error instanceof Error
            ? error.message
            : translation.t('aiAssistant.errors.requestFailed')
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      draft,
      ensureThread,
      isSending,
      persistedMessages.length,
      runChat,
      translation
    ]
  );

  const transcriptionVoiceInput = useAiAssistantVoiceInput({
    enabled: isOpen,
    disabled: isSending || aiAssistantVoice.isActive,
    onLiveTranscript: setDraft,
    onTranscript: (transcript) => void submit(transcript)
  });

  const clearVoiceHoldTimer = useCallback(() => {
    if (voiceHoldTimerRef.current !== null) {
      clearTimeout(voiceHoldTimerRef.current);
      voiceHoldTimerRef.current = null;
    }
  }, []);

  const finishVoiceHold = useCallback(
    (pointerId: number, target: HTMLButtonElement) => {
      if (voiceHoldPointerIdRef.current !== pointerId) return;
      clearVoiceHoldTimer();
      voiceHoldPointerIdRef.current = null;
      suppressVoiceClickRef.current = true;
      window.setTimeout(() => {
        suppressVoiceClickRef.current = false;
      }, 0);
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      if (voiceHoldStartedRef.current) {
        voiceHoldStartedRef.current = false;
        setIsVoiceHoldActive(false);
        transcriptionVoiceInput.stopVoiceInput();
        hapticVoiceRecordingEnd();
        return;
      }
      transcriptionVoiceInput.cancelMicrophonePrime();
      void aiAssistantVoice.toggle();
    },
    [aiAssistantVoice, clearVoiceHoldTimer, transcriptionVoiceInput]
  );

  const cancelVoiceHold = useCallback(
    (pointerId: number, target: HTMLButtonElement) => {
      if (voiceHoldPointerIdRef.current !== pointerId) return;
      clearVoiceHoldTimer();
      voiceHoldPointerIdRef.current = null;
      voiceHoldStartedRef.current = false;
      setIsVoiceHoldActive(false);
      transcriptionVoiceInput.cancelMicrophonePrime();
      transcriptionVoiceInput.cancelRecording();
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    },
    [clearVoiceHoldTimer, transcriptionVoiceInput]
  );

  const handleVoicePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (
        event.button !== 0 ||
        draft.trim() ||
        isSending ||
        aiAssistantVoice.isActive ||
        voiceHoldPointerIdRef.current !== null
      ) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      voiceHoldPointerIdRef.current = event.pointerId;
      voiceHoldStartedRef.current = false;
      transcriptionVoiceInput.primeMicrophoneAccess();
      const activationDelay = displayedMessages.length === 0 ? 300 : 100;
      voiceHoldTimerRef.current = setTimeout(() => {
        voiceHoldTimerRef.current = null;
        if (voiceHoldPointerIdRef.current !== event.pointerId) return;
        voiceHoldStartedRef.current = true;
        setIsVoiceHoldActive(true);
        hapticVoiceRecordingStart();
        transcriptionVoiceInput.startVoiceInput();
      }, activationDelay);
    },
    [
      aiAssistantVoice.isActive,
      displayedMessages.length,
      draft,
      isSending,
      transcriptionVoiceInput
    ]
  );

  useEffect(
    () => () => {
      clearVoiceHoldTimer();
      transcriptionVoiceInput.cancelRecording();
    },
    [clearVoiceHoldTimer, transcriptionVoiceInput.cancelRecording]
  );

  useHotkey(
    { key: 'G', ctrl: true },
    () => {
      if (useDialogsStore.getState().isOpen('commandPalette')) return;
      useDialogsStore.getState().close('keyboardShortcuts');
      void aiAssistantVoice.toggle();
    },
    { preventDefault: true, ignoreInputs: false }
  );
  useHotkey(
    { key: 'G', ctrl: true, shift: true },
    () => {
      if (useDialogsStore.getState().isOpen('commandPalette')) return;
      useDialogsStore.getState().close('keyboardShortcuts');
      setIsOpen((open) => !open);
    },
    { preventDefault: true, ignoreInputs: false }
  );
  useHotkey(
    'Escape',
    (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        useDialogsStore.getState().isOpen('commandPalette')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    },
    {
      enabled: isOpen,
      preventDefault: false,
      stopPropagation: false,
      requireReset: false,
      ignoreInputs: false,
      conflictBehavior: 'allow'
    }
  );

  const voiceActive = aiAssistantVoice.isActive;
  const voiceOrbMode =
    aiAssistantVoice.status === 'connecting'
      ? 'thinking'
      : aiAssistantVoice.status === 'idle'
        ? 'idle'
        : aiAssistantVoice.status;
  const inputMotionState = voiceActive
    ? reducedMotion
      ? VOICE_MODE_INPUT_REDUCED_MOTION_EXIT
      : VOICE_MODE_INPUT_EXIT
    : reducedMotion
      ? VOICE_MODE_INPUT_REDUCED_MOTION_VISIBLE
      : VOICE_MODE_INPUT_VISIBLE;
  const inputMotionTransition = voiceActive
    ? VOICE_MODE_INPUT_EXIT_TRANSITION
    : VOICE_MODE_INPUT_RETURN_DELAYED_TRANSITION;

  useEffect(() => {
    if (previousVoiceActiveRef.current && !voiceActive) {
      setIsInputReturningFromVoice(true);
    }
    previousVoiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  return (
    <>
      <div className="pointer-events-none fixed end-4 bottom-4 z-50">
        <motion.div
          animate={{ opacity: isOpen ? 0 : 1, scale: isOpen ? 0.92 : 1 }}
        >
          <IconButton
            variant="outline"
            size="equal"
            roundness="full"
            icon={
              <StarFourIcon
                className={cn(
                  'size-7',
                  voiceActive ? 'text-primary' : 'text-text-secondary'
                )}
                weight="duotone"
              />
            }
            tooltip={translation.t('aiAssistant.title')}
            aria-label={translation.t('aiAssistant.title')}
            className="pointer-events-auto size-14 shadow-lg hover:scale-105 hover:shadow-xl"
            onClick={() => setIsOpen(true)}
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.section
            key="diwan-ai-assistant"
            data-dms-ai-assistant-root="true"
            className={cn(
              'fixed z-100 flex flex-col overflow-hidden border border-border-default bg-background-base shadow-2xl will-change-[transform,opacity]',
              breakpoint.isMobile
                ? 'inset-0 h-dvh w-full border-0'
                : 'end-4 bottom-4 w-[min(28rem,calc(100vw-2rem))] rounded-3xl'
            )}
            style={
              !breakpoint.isMobile
                ? {
                    height: panelHeight,
                    transformOrigin: 'bottom right',
                    transition: AI_ASSISTANT_PANEL_HEIGHT_CSS_TRANSITION
                  }
                : undefined
            }
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={AI_ASSISTANT_PANEL_OPEN_TRANSITION}
          >
            <header
              className={cn(
                'relative flex min-h-14 shrink-0 items-center justify-between gap-3 bg-background-base px-3 py-3',
                breakpoint.isMobile && 'safe-top border-b border-border-default'
              )}
            >
              <div className="min-w-0 flex-1">
                <AiAssistantThreadPicker
                  threads={threads}
                  currentThreadId={threadId}
                  titlePlaceholder={translation.t(
                    'aiAssistant.newConversation'
                  )}
                  emptyLabel={translation.t('aiAssistant.threads.empty')}
                  noResultsLabel={translation.t(
                    'aiAssistant.threads.noResults'
                  )}
                  searchPlaceholder={translation.t(
                    'aiAssistant.threads.searchPlaceholder'
                  )}
                  disabled={voiceActive}
                  onSelectThread={(thread) => {
                    setThreadId(thread.id);
                    setOptimistic([]);
                    setServerCutoff(null);
                  }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton
                  variant="ghost"
                  size="equal"
                  roundness="full"
                  icon={ListPlusIcon}
                  tooltip={translation.t('aiAssistant.actions.startNewChat')}
                  aria-label={translation.t('aiAssistant.actions.startNewChat')}
                  onClick={() => void startNewChat()}
                />
                {!breakpoint.isMobile && (
                  <IconButton
                    variant="ghost"
                    size="equal"
                    roundness="full"
                    icon={isExpanded ? ArrowsInSimpleIcon : ArrowsOutSimpleIcon}
                    tooltip={
                      isExpanded
                        ? translation.t('aiAssistant.actions.collapse')
                        : translation.t('aiAssistant.actions.expand')
                    }
                    aria-label={
                      isExpanded
                        ? translation.t('aiAssistant.actions.collapse')
                        : translation.t('aiAssistant.actions.expand')
                    }
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                  />
                )}
                <IconButton
                  variant="ghost"
                  size="equal"
                  roundness="full"
                  icon={breakpoint.isMobile ? XIcon : MinusIcon}
                  tooltip={
                    breakpoint.isMobile
                      ? translation.t('aiAssistant.actions.close')
                      : translation.t('aiAssistant.actions.minimize')
                  }
                  aria-label={
                    breakpoint.isMobile
                      ? translation.t('aiAssistant.actions.close')
                      : translation.t('aiAssistant.actions.minimize')
                  }
                  onClick={() => setIsOpen(false)}
                />
              </div>
            </header>

            <div
              ref={scrollRef}
              className="relative min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4"
            >
              {displayedMessages.length === 0 && !voiceActive ? (
                <div className="flex h-full min-h-60 items-center justify-center px-5 pb-24 text-center">
                  <div className="flex w-full max-w-full flex-col items-center">
                    <motion.button
                      type="button"
                      aria-label={translation.t(
                        'aiAssistant.actions.voiceShortcut'
                      )}
                      className="relative touch-manipulation rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void aiAssistantVoice.toggle()}
                    >
                      <VoiceOrb status="idle" level={0} />
                    </motion.button>
                    <motion.h2
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.32,
                        ease: [0.22, 1, 0.36, 1]
                      }}
                      className="-mt-4 max-w-xs font-heading text-lg font-normal text-text-primary"
                    >
                      {translation.t('aiAssistant.emptyTitle')}
                    </motion.h2>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {displayedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex w-full',
                        message.role === 'user'
                          ? 'justify-end'
                          : 'justify-start'
                      )}
                    >
                      <div
                        dir="auto"
                        className={cn(
                          'flex max-w-5/6 flex-col gap-2 text-sm leading-relaxed text-text-primary',
                          message.role === 'user' &&
                            'rounded-2xl bg-[rgba(42,28,0,0.07)] px-3.5 py-2.5'
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <AssistantMarkdown>
                            {message.content}
                          </AssistantMarkdown>
                        ) : (
                          <p className="m-0 break-words whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                        {message.role === 'assistant' &&
                          !message.content &&
                          isSending && (
                            <TextShimmer
                              active
                              spread={28}
                              duration={2.2}
                              className="text-sm"
                            >
                              {message.toolCall?.resultCount === undefined
                                ? translation.t('aiAssistant.voice.thinking')
                                : translation.t(
                                    'aiAssistant.tools.listedCases',
                                    { count: message.toolCall.resultCount }
                                  )}
                            </TextShimmer>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={cn(
                'relative shrink-0 overflow-visible',
                voiceActive || isInputReturningFromVoice ? 'z-40' : 'z-20',
                voiceActive && 'pointer-events-none'
              )}
              style={{ perspective: VOICE_MODE_INPUT_PERSPECTIVE_PX }}
            >
              <motion.form
                initial={false}
                animate={inputMotionState}
                transition={inputMotionTransition}
                onAnimationComplete={() => {
                  if (!voiceActive) setIsInputReturningFromVoice(false);
                }}
                style={{
                  transformOrigin: VOICE_MODE_INPUT_TRANSFORM_ORIGIN,
                  transformStyle: 'preserve-3d'
                }}
                className="relative overflow-visible p-3 will-change-transform max-md:p-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div className="relative">
                  <AnimatePresence initial={false}>
                    {isVoiceHoldActive && (
                      <AiAssistantVoiceWaveform
                        key="voice-waveform"
                        active
                        stream={transcriptionVoiceInput.recordingStream}
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2"
                      />
                    )}
                  </AnimatePresence>
                  <div className="relative z-10 rounded-2xl border border-border-default bg-background-surface transition-[border-color] duration-200 ease-out hover:border-border-dark focus-within:border-border-dark">
                    <textarea
                      value={draft}
                      rows={1}
                      placeholder={
                        isVoiceHoldActive
                          ? translation.t('aiAssistant.voice.voicePlaceholder')
                          : translation.t('aiAssistant.inputPlaceholder')
                      }
                      className="block max-h-30 min-h-0 w-full resize-none overflow-y-hidden bg-transparent px-4 py-2.5 text-base text-text-primary outline-none placeholder:text-text-tertiary max-md:min-h-14 max-md:text-lg"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(
                        event: KeyboardEvent<HTMLTextAreaElement>
                      ) => {
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                    />
                    <div className="flex min-h-8 items-center justify-start gap-2 overflow-visible px-2 pb-2">
                      <motion.div
                        className="shrink-0"
                        animate={{ scale: isVoiceHoldActive ? 1.52 : 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 520,
                          damping: 32,
                          mass: 0.65
                        }}
                      >
                        <button
                          type="button"
                          title={
                            draft.trim()
                              ? translation.t('aiAssistant.actions.send')
                              : isVoiceHoldActive
                                ? translation.t(
                                    'aiAssistant.voice.releaseToStop'
                                  )
                                : translation.t(
                                    'aiAssistant.voice.holdToRecord'
                                  )
                          }
                          aria-label={
                            draft.trim()
                              ? translation.t('aiAssistant.actions.send')
                              : translation.t('aiAssistant.voice.holdToRecord')
                          }
                          className={cn(
                            iconButtonVariants({
                              variant: 'primary',
                              size: 'equal',
                              roundness: 'full'
                            }),
                            'size-9.5 cursor-pointer touch-manipulation select-none md:size-8.5 hover:bg-primary active:bg-primary'
                          )}
                          onClick={() => {
                            if (suppressVoiceClickRef.current) return;
                            if (draft.trim()) {
                              void submit();
                              return;
                            }
                            if (!isSending) void aiAssistantVoice.toggle();
                          }}
                          onPointerDown={handleVoicePointerDown}
                          onPointerUp={(event) =>
                            finishVoiceHold(
                              event.pointerId,
                              event.currentTarget
                            )
                          }
                          onPointerCancel={(event) =>
                            cancelVoiceHold(
                              event.pointerId,
                              event.currentTarget
                            )
                          }
                          onLostPointerCapture={(event) => {
                            if (
                              voiceHoldPointerIdRef.current === event.pointerId
                            ) {
                              cancelVoiceHold(
                                event.pointerId,
                                event.currentTarget
                              );
                            }
                          }}
                          onContextMenu={(event) => event.preventDefault()}
                        >
                          <span className="relative block size-4.5 md:size-4">
                            <AnimatePresence initial={false}>
                              {draft.trim() ? (
                                <motion.span
                                  key="send"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <ArrowUpIcon
                                    className="size-4.5 md:size-4"
                                    weight="bold"
                                  />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="mic"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <WaveformIcon
                                    className="size-4.5 md:size-4"
                                    weight="bold"
                                  />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                        </button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.form>
            </div>
            <AnimatePresence initial={false}>
              {voiceActive && (
                <motion.div
                  key="live-voice-surface"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={VOICE_ORB_AURORA_ENTER_TRANSITION}
                  className="absolute inset-x-0 top-14 bottom-0 z-30 overflow-hidden bg-background-base"
                >
                  <AiAssistantVoiceOrbGlow active mode={voiceOrbMode} />
                  <motion.div
                    initial={false}
                    animate={{
                      paddingBottom: getVoiceOrbActiveBottomPaddingPx(
                        breakpoint.isMobile
                      )
                    }}
                    transition={VOICE_ORB_LAYOUT_TRANSITION}
                    className="absolute inset-0 z-10 flex items-center justify-center"
                  >
                    <VoiceOrb
                      status={aiAssistantVoice.status}
                      level={aiAssistantVoice.audioLevel}
                    />
                  </motion.div>
                  <AiAssistantLiveVoiceControlsDock
                    active
                    isMuted={aiAssistantVoice.isMuted}
                    onToggleMuted={aiAssistantVoice.toggleMuted}
                    onExit={aiAssistantVoice.stop}
                    onSendText={aiAssistantVoice.sendTextMessage}
                    className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)] max-md:bottom-8"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      <AiAssistantLiveVoiceControlsDock
        active={voiceActive && !isOpen}
        variant="floating"
        isMuted={aiAssistantVoice.isMuted}
        onToggleMuted={aiAssistantVoice.toggleMuted}
        onExit={aiAssistantVoice.stop}
        onSendText={aiAssistantVoice.sendTextMessage}
        className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]"
      />
    </>
  );
}
