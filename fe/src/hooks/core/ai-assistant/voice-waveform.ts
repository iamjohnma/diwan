import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  VOICE_WAVEFORM_BADGE_BAR_INTERVAL_MS,
  VOICE_WAVEFORM_BADGE_INITIAL_BAR_COUNT,
  VOICE_WAVEFORM_BADGE_MAX_BARS,
  VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX,
  amplitudeToBadgeVoiceWaveformBarHeight,
  computeVoiceAmplitudeFromAnalyser,
  computeVoiceWaveformCommitHeight,
  getBadgeWaveformSeedBarHeight,
  getIdleVoiceAmplitude,
  isVoiceWaveformActive,
  scrollBadgeWaveformToEnd
} from '@/lib/ai/voice-waveform';

export interface AiAssistantVoiceWaveformBar {
  id: number;
  height: number;
}

interface UseAiAssistantVoiceWaveformOptions {
  active: boolean;
  stream: MediaStream | null;
}

function createInitialCommittedBars(): AiAssistantVoiceWaveformBar[] {
  const seedHeight = getBadgeWaveformSeedBarHeight();

  return Array.from(
    { length: VOICE_WAVEFORM_BADGE_INITIAL_BAR_COUNT },
    (_, index) => ({
      id: index,
      height: seedHeight
    })
  );
}

export function useAiAssistantVoiceWaveform(
  options: UseAiAssistantVoiceWaveformOptions
) {
  const { active, stream } = options;
  const [committedBars, setCommittedBars] = useState<
    AiAssistantVoiceWaveformBar[]
  >(createInitialCommittedBars);
  const containerRef = useRef<HTMLDivElement>(null);
  const liveBarRef = useRef<HTMLDivElement>(null);
  const barIdRef = useRef(VOICE_WAVEFORM_BADGE_INITIAL_BAR_COUNT);
  const lastCommitTimeRef = useRef(0);
  const liveHeightRef = useRef(VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX);

  useLayoutEffect(() => {
    const restingHeight = VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX;
    setCommittedBars(createInitialCommittedBars());
    barIdRef.current = VOICE_WAVEFORM_BADGE_INITIAL_BAR_COUNT;
    lastCommitTimeRef.current = performance.now();
    liveHeightRef.current = restingHeight;

    if (liveBarRef.current) {
      liveBarRef.current.style.height = `${restingHeight}px`;
    }

    if (containerRef.current) {
      scrollBadgeWaveformToEnd(containerRef.current);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let animationFrameId = 0;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null;
    let frequencyBuffer: Uint8Array<ArrayBuffer> | null = null;

    if (stream) {
      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      timeDomainBuffer = new Uint8Array(
        analyser.fftSize
      ) as Uint8Array<ArrayBuffer>;
      frequencyBuffer = new Uint8Array(
        analyser.frequencyBinCount
      ) as Uint8Array<ArrayBuffer>;
      void audioContext.resume().catch(() => undefined);
    }

    const tick = (now: number) => {
      let amplitude = getIdleVoiceAmplitude();
      if (analyser && timeDomainBuffer && frequencyBuffer) {
        amplitude = computeVoiceAmplitudeFromAnalyser(
          analyser,
          timeDomainBuffer
        );
      }

      const restingHeight = VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX;
      const height = amplitudeToBadgeVoiceWaveformBarHeight(amplitude);

      if (liveHeightRef.current !== height && liveBarRef.current) {
        liveHeightRef.current = height;
        liveBarRef.current.style.height = `${height}px`;
      }

      if (
        now - lastCommitTimeRef.current >=
        VOICE_WAVEFORM_BADGE_BAR_INTERVAL_MS
      ) {
        let committedHeight = restingHeight;
        if (
          analyser &&
          timeDomainBuffer &&
          frequencyBuffer &&
          isVoiceWaveformActive(amplitude)
        ) {
          committedHeight = computeVoiceWaveformCommitHeight(
            analyser,
            timeDomainBuffer,
            frequencyBuffer,
            barIdRef.current
          );
        }

        setCommittedBars((previous) => {
          const nextBars = [
            ...previous,
            { id: barIdRef.current++, height: committedHeight }
          ];

          if (nextBars.length > VOICE_WAVEFORM_BADGE_MAX_BARS) {
            return nextBars.slice(-VOICE_WAVEFORM_BADGE_MAX_BARS);
          }

          return nextBars;
        });
        lastCommitTimeRef.current = now;
      }

      if (containerRef.current) {
        scrollBadgeWaveformToEnd(containerRef.current);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      source?.disconnect();
      analyser?.disconnect();
      if (audioContext) {
        void audioContext.close();
      }
    };
  }, [active, stream]);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    if (containerRef.current) {
      scrollBadgeWaveformToEnd(containerRef.current);
    }
  }, [active, committedBars]);

  return {
    committedBars,
    containerRef,
    liveBarRef
  };
}
