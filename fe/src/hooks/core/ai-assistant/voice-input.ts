import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_AI_ASSISTANT_VOICE_RECORDING_MS,
  getVoiceInputEnvironmentBlockReason,
  releaseMicrophoneStream,
  requestMicrophoneStream
} from '@/lib/ai/voice-recording';
import { hapticVoiceRecordingEnd } from '@/utils/common/haptics';

const BROWSER_SPEECH_TRANSCRIPT_SETTLE_MS = 0;

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0?: {
    readonly transcript?: string;
  };
}

interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: BrowserSpeechRecognitionResult | undefined;
}

export interface BrowserSpeechRecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognitionGlobal {
  SpeechRecognition?: new () => unknown;
  webkitSpeechRecognition?: new () => unknown;
}

export type AiAssistantVoiceInputStatus = 'idle' | 'recording';

interface UseAiAssistantVoiceInputOptions {
  enabled: boolean;
  disabled?: boolean;
  onLiveTranscript?: (transcript: string) => void;
  onTranscript: (transcript: string) => void;
  onStopSettled?: () => void;
}

export function getAiAssistantVoiceRecognitionLanguage(
  language: string | undefined
): string {
  const normalizedLanguage = language?.toLowerCase().trim();
  if (!normalizedLanguage) {
    return 'en';
  }

  if (normalizedLanguage.startsWith('ar')) {
    return 'ar';
  }

  if (normalizedLanguage.startsWith('en')) {
    return 'en';
  }

  return normalizedLanguage;
}

export function getBrowserSpeechRecognitionConstructor(
  speechGlobal: BrowserSpeechRecognitionGlobal = globalThis as BrowserSpeechRecognitionGlobal
): BrowserSpeechRecognitionConstructor | null {
  const Constructor =
    speechGlobal.SpeechRecognition ?? speechGlobal.webkitSpeechRecognition;

  return Constructor
    ? (Constructor as BrowserSpeechRecognitionConstructor)
    : null;
}

function normalizeSpeechTranscriptSegment(transcript: string): string {
  return transcript.replace(/\s+/g, ' ').trim();
}

function findSpeechTranscriptOverlapLength(
  existingTranscript: string,
  nextSegment: string
): number {
  const maxLength = Math.min(existingTranscript.length, nextSegment.length);

  for (let length = maxLength; length > 0; length -= 1) {
    if (
      existingTranscript
        .slice(existingTranscript.length - length)
        .localeCompare(nextSegment.slice(0, length), undefined, {
          sensitivity: 'accent'
        }) === 0
    ) {
      return length;
    }
  }

  return 0;
}

export function mergeSpeechTranscriptSegment(
  existingTranscript: string,
  nextSegment: string
): string {
  const existing = normalizeSpeechTranscriptSegment(existingTranscript);
  const next = normalizeSpeechTranscriptSegment(nextSegment);

  if (!next) {
    return existing;
  }
  if (!existing) {
    return next;
  }
  if (next.toLocaleLowerCase().startsWith(existing.toLocaleLowerCase())) {
    return next;
  }
  if (existing.toLocaleLowerCase().startsWith(next.toLocaleLowerCase())) {
    return existing;
  }

  const overlapLength = findSpeechTranscriptOverlapLength(existing, next);
  if (overlapLength > 0) {
    return normalizeSpeechTranscriptSegment(
      `${existing}${next.slice(overlapLength)}`
    );
  }

  return `${existing} ${next}`;
}

function buildBrowserSpeechRecognitionTranscript(
  results: BrowserSpeechRecognitionResultList
): string {
  let transcript = '';

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const text = result?.[0]?.transcript ?? '';
    transcript = mergeSpeechTranscriptSegment(transcript, text);
  }

  return transcript;
}

interface MicrophonePrimeRequest {
  promise: Promise<MediaStream | null>;
  generation: number;
}

export function useAiAssistantVoiceInput(
  options: UseAiAssistantVoiceInputOptions
) {
  const { disabled, enabled, onLiveTranscript, onStopSettled, onTranscript } =
    options;
  const translation = useTranslation();
  const [status, setStatus] = useState<AiAssistantVoiceInputStatus>('idle');
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(
    null
  );
  const [isMuted, setIsMuted] = useState(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechRecognitionCommitTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const speechRecognitionTranscriptRef = useRef('');
  const canceledRef = useRef(false);
  const holdActiveRef = useRef(false);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const microphonePrimeRef = useRef<MicrophonePrimeRequest | null>(null);
  const isMutedRef = useRef(false);
  const startTokenRef = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => undefined);

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const clearSpeechRecognitionCommitTimer = useCallback(() => {
    if (speechRecognitionCommitTimerRef.current !== null) {
      clearTimeout(speechRecognitionCommitTimerRef.current);
      speechRecognitionCommitTimerRef.current = null;
    }
  }, []);

  const applyMuteToMicrophoneStream = useCallback(
    (stream: MediaStream | null, muted: boolean) => {
      if (!stream) {
        return;
      }

      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    },
    []
  );

  const setVoiceMuted = useCallback(
    (muted: boolean) => {
      isMutedRef.current = muted;
      setIsMuted(muted);
      applyMuteToMicrophoneStream(microphoneStreamRef.current, muted);
    },
    [applyMuteToMicrophoneStream]
  );

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted(!isMutedRef.current);
  }, [setVoiceMuted]);

  const stopMicrophoneStream = useCallback(() => {
    releaseMicrophoneStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
    setRecordingStream(null);
  }, []);

  const cancelMicrophonePrime = useCallback(() => {
    const prime = microphonePrimeRef.current;
    microphonePrimeRef.current = null;
    if (!prime) {
      return;
    }

    void prime.promise.then((stream) => {
      if (microphoneStreamRef.current === stream) {
        return;
      }

      releaseMicrophoneStream(stream);
    });
  }, []);

  const primeMicrophoneAccess = useCallback(() => {
    if (getVoiceInputEnvironmentBlockReason() || microphonePrimeRef.current) {
      return;
    }

    const generation = startTokenRef.current;
    const promise = requestMicrophoneStream();
    microphonePrimeRef.current = { promise, generation };
  }, []);

  const resetSpeechRecognitionRefs = useCallback(() => {
    clearAutoStopTimer();
    clearSpeechRecognitionCommitTimer();
    stopMicrophoneStream();
    speechRecognitionRef.current = null;
    speechRecognitionTranscriptRef.current = '';
    isMutedRef.current = false;
    setIsMuted(false);
  }, [
    clearAutoStopTimer,
    clearSpeechRecognitionCommitTimer,
    stopMicrophoneStream
  ]);

  const commitBrowserSpeechTranscript = useCallback(() => {
    const transcript = speechRecognitionTranscriptRef.current.trim();
    const wasCanceled = canceledRef.current;

    resetSpeechRecognitionRefs();
    setStatus('idle');

    if (!wasCanceled && transcript) {
      onTranscript(transcript);
    }

    onStopSettled?.();
  }, [onStopSettled, onTranscript, resetSpeechRecognitionRefs]);

  const scheduleBrowserSpeechTranscriptCommit = useCallback(
    (recognition: BrowserSpeechRecognition) => {
      clearSpeechRecognitionCommitTimer();
      if (BROWSER_SPEECH_TRANSCRIPT_SETTLE_MS === 0) {
        if (speechRecognitionRef.current !== recognition) {
          return;
        }

        commitBrowserSpeechTranscript();

        return;
      }

      speechRecognitionCommitTimerRef.current = setTimeout(() => {
        if (speechRecognitionRef.current !== recognition) {
          return;
        }

        commitBrowserSpeechTranscript();
      }, BROWSER_SPEECH_TRANSCRIPT_SETTLE_MS);
    },
    [clearSpeechRecognitionCommitTimer, commitBrowserSpeechTranscript]
  );

  const startBrowserSpeechRecognition = useCallback(
    (language: string): boolean => {
      const Recognition = getBrowserSpeechRecognitionConstructor();
      if (!Recognition) {
        return false;
      }

      try {
        const recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          if (isMutedRef.current) {
            return;
          }

          const transcript = buildBrowserSpeechRecognitionTranscript(
            event.results
          );
          speechRecognitionTranscriptRef.current = transcript;
          onLiveTranscript?.(transcript);
          if (speechRecognitionCommitTimerRef.current !== null) {
            scheduleBrowserSpeechTranscriptCommit(recognition);
          }
        };
        recognition.onerror = () => {
          if (speechRecognitionRef.current !== recognition) {
            return;
          }

          speechRecognitionRef.current = null;
        };
        recognition.onend = () => {
          if (speechRecognitionRef.current !== recognition) {
            return;
          }

          if (holdActiveRef.current && !canceledRef.current) {
            try {
              recognition.start();

              return;
            } catch {
              return;
            }
          }

          scheduleBrowserSpeechTranscriptCommit(recognition);
        };

        speechRecognitionRef.current = recognition;
        recognition.start();

        return true;
      } catch {
        speechRecognitionRef.current = null;

        return false;
      }
    },
    [onLiveTranscript, scheduleBrowserSpeechTranscriptCommit]
  );

  const beginVoiceCapture = useCallback(async () => {
    const token = startTokenRef.current;
    const primedRequest = microphonePrimeRef.current;
    microphonePrimeRef.current = null;
    const stream = await (primedRequest?.promise ?? requestMicrophoneStream());

    const isStale =
      token !== startTokenRef.current ||
      !holdActiveRef.current ||
      canceledRef.current;
    if (isStale) {
      releaseMicrophoneStream(stream);

      return;
    }

    if (!stream) {
      holdActiveRef.current = false;
      setStatus('idle');

      return;
    }

    microphoneStreamRef.current = stream;
    setRecordingStream(stream);
    applyMuteToMicrophoneStream(stream, isMutedRef.current);
    canceledRef.current = false;
    speechRecognitionTranscriptRef.current = '';

    const language = getAiAssistantVoiceRecognitionLanguage(
      translation.i18n.resolvedLanguage ?? translation.i18n.language
    );
    startBrowserSpeechRecognition(language);

    setStatus('recording');
    clearAutoStopTimer();
    autoStopTimerRef.current = setTimeout(() => {
      holdActiveRef.current = false;
      hapticVoiceRecordingEnd();
      stopRecordingRef.current();
    }, MAX_AI_ASSISTANT_VOICE_RECORDING_MS);
  }, [
    applyMuteToMicrophoneStream,
    clearAutoStopTimer,
    translation.i18n.language,
    translation.i18n.resolvedLanguage,
    startBrowserSpeechRecognition
  ]);

  const stopRecording = useCallback(() => {
    clearAutoStopTimer();
    const speechRecognition = speechRecognitionRef.current;
    if (speechRecognition) {
      speechRecognition.stop();

      return;
    }

    commitBrowserSpeechTranscript();
  }, [clearAutoStopTimer, commitBrowserSpeechTranscript]);

  stopRecordingRef.current = stopRecording;

  const cancelRecording = useCallback(() => {
    startTokenRef.current += 1;
    cancelMicrophonePrime();
    holdActiveRef.current = false;
    canceledRef.current = true;
    const speechRecognition = speechRecognitionRef.current;
    if (speechRecognition) {
      speechRecognition.abort();
    }

    resetSpeechRecognitionRefs();
    setStatus('idle');
    onStopSettled?.();
  }, [cancelMicrophonePrime, onStopSettled, resetSpeechRecognitionRefs]);

  const startVoiceInput = useCallback(() => {
    if (!enabled || disabled || status !== 'idle') {
      return;
    }

    if (getVoiceInputEnvironmentBlockReason()) {
      return;
    }

    holdActiveRef.current = true;
    canceledRef.current = false;
    startTokenRef.current += 1;
    void beginVoiceCapture();
  }, [beginVoiceCapture, disabled, enabled, status]);

  const stopVoiceInput = useCallback(() => {
    holdActiveRef.current = false;
    stopRecording();
  }, [stopRecording]);

  useEffect(() => {
    if (enabled) {
      return;
    }

    cancelRecording();
  }, [cancelRecording, enabled]);

  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  return {
    status,
    recordingStream,
    isRecording: status === 'recording',
    isProcessing: false,
    isMuted,
    startVoiceInput,
    stopVoiceInput,
    cancelRecording,
    toggleVoiceMuted,
    setVoiceMuted,
    primeMicrophoneAccess,
    cancelMicrophonePrime
  };
}

export type AiAssistantVoiceInputResult = ReturnType<
  typeof useAiAssistantVoiceInput
>;
