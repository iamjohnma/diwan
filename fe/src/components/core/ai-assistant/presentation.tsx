import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  VOICE_ORB_LAYOUT_TRANSITION,
  VOICE_ORB_RENDER_SIZE_PX,
  getVoiceOrbActiveSizePx,
  getVoiceOrbActiveVisualScale,
  getVoiceOrbIdleSizePx,
  getVoiceOrbIdleVisualScale
} from '@/constants/core/ai-assistant/voice-orb';
import { useBreakpoint } from '@/hooks/common';
import { useAiAssistantVoiceOrb } from '@/hooks/core/ai-assistant';
import type { AssistantVoiceStatus } from '@/hooks/core/ai-assistant-voice';
import type { VoiceOrbMode } from '@/lib/ai/voice-orb';

export function AssistantMarkdown(props: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="m-0 break-words whitespace-pre-wrap">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 ps-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 ps-5">{children}</ol>
        ),
        a: ({ children, href }) => (
          <a
            className="text-primary underline underline-offset-2"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded bg-background-elevated px-1 py-0.5 font-mono text-sm">
            {children}
          </code>
        )
      }}
    >
      {props.children}
    </ReactMarkdown>
  );
}

export function VoiceOrb(props: {
  status: AssistantVoiceStatus;
  level: number;
}) {
  const active = props.status !== 'idle';
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint.isMobile;
  const mode: VoiceOrbMode =
    props.status === 'connecting'
      ? 'thinking'
      : props.status === 'idle'
        ? 'idle'
        : props.status;
  const orb = useAiAssistantVoiceOrb({
    mode,
    active: true,
    isMobile,
    getAudioLevel: () => props.level,
    disablePointerInteraction: active
  });
  const layoutSize = active
    ? getVoiceOrbActiveSizePx(isMobile)
    : getVoiceOrbIdleSizePx(isMobile);
  const visualScale = active
    ? getVoiceOrbActiveVisualScale(isMobile)
    : getVoiceOrbIdleVisualScale(isMobile);

  return (
    <motion.div
      className="relative shrink-0 overflow-visible"
      initial={false}
      animate={{ width: layoutSize, height: layoutSize }}
      transition={VOICE_ORB_LAYOUT_TRANSITION}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: visualScale }}
          initial={false}
          transition={VOICE_ORB_LAYOUT_TRANSITION}
          style={{
            width: VOICE_ORB_RENDER_SIZE_PX,
            height: VOICE_ORB_RENDER_SIZE_PX,
            transformOrigin: 'center center'
          }}
          className="will-change-transform"
        >
          <canvas
            ref={orb.canvasRef}
            className="block size-full touch-none pointer-events-auto"
            aria-hidden
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
