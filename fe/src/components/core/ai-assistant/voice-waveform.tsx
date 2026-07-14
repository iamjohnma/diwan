import { motion } from 'motion/react';
import { useAiAssistantVoiceWaveform } from '@/hooks/core/ai-assistant/voice-waveform';
import { VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX } from '@/lib/ai/voice-waveform';
import { cn } from '@/lib/utils';

interface AiAssistantVoiceWaveformProps {
  active: boolean;
  stream: MediaStream | null;
  className?: string;
}

const VOICE_WAVEFORM_FADE_TRANSITION = {
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1] as const
};

export function AiAssistantVoiceWaveform(props: AiAssistantVoiceWaveformProps) {
  const voiceWaveform = useAiAssistantVoiceWaveform({
    active: props.active,
    stream: props.stream
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={VOICE_WAVEFORM_FADE_TRANSITION}
      className={cn(
        'flex w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-default bg-background-surface px-2 py-1',
        props.className
      )}
      aria-hidden
    >
      <div
        ref={voiceWaveform.containerRef}
        className="flex h-5 w-24 items-center gap-px overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {voiceWaveform.committedBars.map((bar) => (
          <div
            key={bar.id}
            className="w-0.5 shrink-0 rounded-full bg-text-tertiary/80"
            style={{ height: `${bar.height}px` }}
          />
        ))}
        <div
          ref={voiceWaveform.liveBarRef}
          className="w-0.5 shrink-0 rounded-full bg-text-tertiary"
          style={{
            height: VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX,
            minHeight: VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX
          }}
        />
        <div className="h-2 w-0.5 shrink-0 animate-pulse rounded-full bg-destructive" />
      </div>
    </motion.div>
  );
}
