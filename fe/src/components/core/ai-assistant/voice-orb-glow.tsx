import { type CSSProperties, memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  VOICE_MODE_INPUT_EXIT_TRANSITION,
  VOICE_MODE_INPUT_RETURN_TRANSITION,
  VOICE_ORB_AURORA_BAND_1_DURATION_S,
  VOICE_ORB_AURORA_BAND_2_DURATION_S,
  VOICE_ORB_AURORA_BASE_DURATION_S
} from '@/constants/core/ai-assistant/voice-orb';
import { type VoiceOrbMode } from '@/lib/ai/voice-orb';
import { cn } from '@/lib/utils';

interface AiAssistantVoiceOrbGlowProps {
  active: boolean;
  mode?: VoiceOrbMode;
  className?: string;
}

const AURORA_EASE = [0.45, 0, 0.55, 1] as const;
const AURORA_TOP_FADE_MASK = 'linear-gradient(to top, black 60%, transparent)';
// Shared with warmVoiceOrbAuroraGlowRaster so the warm pass rasterizes the
// exact same blur filters the live bands use.
const AURORA_BAND_1_CLASS =
  'absolute -inset-x-[24%] bottom-0 h-full will-change-transform bg-[radial-gradient(ellipse_80%_72%_at_50%_100%,color-mix(in_srgb,var(--voice-orb-glow-color)_56%,transparent),transparent_74%)] blur-3xl';
const AURORA_BAND_2_CLASS =
  'absolute inset-x-0 bottom-0 h-[62%] will-change-transform bg-[radial-gradient(ellipse_92%_56%_at_50%_100%,color-mix(in_srgb,var(--voice-orb-glow-color)_40%,transparent),transparent_70%)] blur-[40px]';
const VOICE_ORB_GLOW_COLOR_TRANSITION = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1] as const
};

interface VoiceOrbAuroraBandsProps {
  color: string;
  reducedMotion: boolean;
}

function VoiceOrbAuroraBands(props: VoiceOrbAuroraBandsProps) {
  return (
    <div
      className="absolute inset-0"
      style={
        {
          '--voice-orb-glow-color': props.color
        } as CSSProperties
      }
    >
      <motion.div
        animate={
          props.reducedMotion
            ? undefined
            : {
                opacity: [0.82, 1, 0.82],
                scaleY: [1, 1.08, 1]
              }
        }
        transition={
          props.reducedMotion
            ? undefined
            : {
                duration: VOICE_ORB_AURORA_BASE_DURATION_S,
                repeat: Number.POSITIVE_INFINITY,
                ease: AURORA_EASE
              }
        }
        style={{ transformOrigin: 'bottom' }}
        className="absolute inset-0 will-change-transform bg-[linear-gradient(to_top,color-mix(in_srgb,var(--voice-orb-glow-color)_44%,transparent),color-mix(in_srgb,var(--voice-orb-glow-color)_14%,transparent),transparent)]"
      />
      <motion.div
        animate={
          props.reducedMotion
            ? undefined
            : {
                x: ['-12%', '10%', '-12%'],
                opacity: [0.38, 0.64, 0.38]
              }
        }
        transition={
          props.reducedMotion
            ? undefined
            : {
                duration: VOICE_ORB_AURORA_BAND_1_DURATION_S,
                repeat: Number.POSITIVE_INFINITY,
                ease: AURORA_EASE
              }
        }
        className={AURORA_BAND_1_CLASS}
      />
      <motion.div
        animate={
          props.reducedMotion
            ? undefined
            : {
                x: ['14%', '-12%', '14%'],
                opacity: [0.24, 0.48, 0.24],
                scaleY: [0.94, 1.05, 0.94]
              }
        }
        transition={
          props.reducedMotion
            ? undefined
            : {
                duration: VOICE_ORB_AURORA_BAND_2_DURATION_S,
                repeat: Number.POSITIVE_INFINITY,
                ease: AURORA_EASE,
                delay: 0.8
              }
        }
        className={AURORA_BAND_2_CLASS}
      />
    </div>
  );
}

export const AiAssistantVoiceOrbGlow = memo(function AiAssistantVoiceOrbGlow(
  props: AiAssistantVoiceOrbGlowProps
) {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion === true;
  const isSpeaking = props.mode === 'speaking';

  return (
    <AnimatePresence initial={false}>
      {props.active && (
        <motion.div
          key="voice-orb-aurora"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: VOICE_MODE_INPUT_EXIT_TRANSITION
          }}
          exit={{
            opacity: 0,
            transition: VOICE_MODE_INPUT_RETURN_TRANSITION
          }}
          style={{
            maskImage: AURORA_TOP_FADE_MASK,
            WebkitMaskImage: AURORA_TOP_FADE_MASK
          }}
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[min(58%,320px)] overflow-hidden contain-paint',
            props.className
          )}
        >
          <VoiceOrbAuroraBands
            color="var(--primary)"
            reducedMotion={shouldReduceMotion}
          />
          {/* The speaking intensifier doubles the (expensive, large-radius)
              blur, so it is only mounted while actually speaking instead of
              kept at opacity 0 â€” the fade in/out keeps the look identical. */}
          <AnimatePresence initial={false}>
            {isSpeaking && (
              <motion.div
                key="voice-orb-aurora-speaking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={VOICE_ORB_GLOW_COLOR_TRANSITION}
                className="absolute inset-0"
              >
                <VoiceOrbAuroraBands
                  color="var(--primary)"
                  reducedMotion={shouldReduceMotion}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// One-shot idle warm-up for the first voice-mode activation: rasterizes the
// aurora's two blurred bands once in a tiny, effectively invisible fixed
// layer so the GPU blur pipeline is compiled before the glow's first real
// mount (which otherwise pays it in the middle of the orb morph). Blur
// shader compilation is size-independent, so the layer stays small and is
// removed after a few painted frames.
let didWarmVoiceOrbAuroraGlow = false;

export function warmVoiceOrbAuroraGlowRaster(): void {
  if (didWarmVoiceOrbAuroraGlow || typeof document === 'undefined') {
    return;
  }

  didWarmVoiceOrbAuroraGlow = true;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.className =
    'pointer-events-none fixed bottom-0 start-0 overflow-hidden contain-paint';
  host.style.width = '160px';
  host.style.height = '120px';
  // Small but non-zero: a fully transparent layer may be skipped by the
  // compositor, which would defeat the warm-up.
  host.style.opacity = '0.02';
  host.style.setProperty('mask-image', AURORA_TOP_FADE_MASK);
  host.style.setProperty('-webkit-mask-image', AURORA_TOP_FADE_MASK);
  host.style.setProperty('--voice-orb-glow-color', 'var(--primary)');

  for (const bandClassName of [AURORA_BAND_1_CLASS, AURORA_BAND_2_CLASS]) {
    const band = document.createElement('div');
    band.className = bandClassName;
    host.appendChild(band);
  }

  document.body.appendChild(host);

  let paintedFrames = 0;
  const removeAfterPaint = () => {
    paintedFrames += 1;
    if (paintedFrames >= 3) {
      host.remove();

      return;
    }

    requestAnimationFrame(removeAfterPaint);
  };
  requestAnimationFrame(removeAfterPaint);
}
