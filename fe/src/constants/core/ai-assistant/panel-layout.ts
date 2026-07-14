const PANEL_EDGE_INSET_REM = 1;
const APP_HEADER_HEIGHT_REM = 4;
const COLLAPSED_HEIGHT_MAX_REM = 32;

function getRemPx(): number {
  if (typeof document === 'undefined') {
    return 16;
  }

  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export function computeAiAssistantMobilePanelHeight(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  return window.innerHeight;
}

export function computeAiAssistantPanelHeight(isExpanded: boolean): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  const rem = getRemPx();
  const viewportHeight = window.innerHeight;
  const inset = PANEL_EDGE_INSET_REM * rem;
  if (isExpanded) {
    return Math.max(
      0,
      viewportHeight - APP_HEADER_HEIGHT_REM * rem - inset - inset
    );
  }

  return Math.min(
    COLLAPSED_HEIGHT_MAX_REM * rem,
    Math.max(0, viewportHeight - inset - inset)
  );
}

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

export const AI_ASSISTANT_PANEL_OPEN_TRANSITION = {
  duration: 0.18,
  ease: EASE_OUT_QUINT
};

export const AI_ASSISTANT_PANEL_LAYOUT_TRANSITION = {
  duration: 0.32,
  ease: [0.32, 0.72, 0, 1] as const
};

export const AI_ASSISTANT_PANEL_HEIGHT_CSS_TRANSITION =
  'height 320ms cubic-bezier(0.32, 0.72, 0, 1)';

export const AI_ASSISTANT_PANEL_EXPAND_GESTURE = {
  dragActivationPx: 6,
  velocitySampleWindowMs: 100,
  velocityThresholdPxPerMs: 0.35
} as const;

export const AI_ASSISTANT_TITLE_REVEAL_WIDTH_TRANSITION = {
  duration: 0.55,
  ease: EASE_OUT_QUINT
};

export const AI_ASSISTANT_TITLE_REVEAL_OPACITY_TRANSITION = {
  duration: 0.5,
  delay: 0.06,
  ease: EASE_OUT_QUINT
};
