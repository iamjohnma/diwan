const IDLE_SIZE_DESKTOP_PX = 220;
const IDLE_SIZE_MOBILE_PX = 220;
const ACTIVE_SIZE_DESKTOP_PX = 300;
const ACTIVE_SIZE_MOBILE_PX = 288;
const ACTIVE_Y_OFFSET_DESKTOP_PX = 0;
const ACTIVE_Y_OFFSET_MOBILE_PX = 0;
const ACTIVE_CONTROL_DOCK_PADDING_DESKTOP_PX = 96;
const ACTIVE_CONTROL_DOCK_PADDING_MOBILE_PX = 104;
const IDLE_COLLAPSED_DESKTOP_Y_OFFSET_PX = -24;
// Negative on purpose: the orb canvas is mostly empty around its particle
// cloud (radius fraction 0.3 â†’ the cloud fills ~60% of the box), so the
// welcome copy must overlap the canvas box to sit visually close to the orb.
const WELCOME_COPY_GAP_PX = -16;
const WELCOME_COPY_GAP_MOBILE_PX = -12;

export const VOICE_ORB_WELCOME_COPY_SLOT_HEIGHT_DESKTOP_PX = 36;
export const VOICE_ORB_WELCOME_COPY_SLOT_HEIGHT_MOBILE_PX = 40;
export const VOICE_ORB_RENDER_SIZE_PX = ACTIVE_SIZE_MOBILE_PX;

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

function isCollapsedDesktop(
  isMobile: boolean,
  isPanelExpanded: boolean
): boolean {
  return !isMobile && !isPanelExpanded;
}

export function getVoiceOrbWelcomeCopyGapPx(isMobile: boolean): number {
  return isMobile ? WELCOME_COPY_GAP_MOBILE_PX : WELCOME_COPY_GAP_PX;
}

export function getVoiceOrbIdleStackYOffsetPx(
  isMobile: boolean,
  isPanelExpanded: boolean
): number {
  return isCollapsedDesktop(isMobile, isPanelExpanded)
    ? IDLE_COLLAPSED_DESKTOP_Y_OFFSET_PX
    : 0;
}

export function getVoiceOrbIdleSizePx(isMobile: boolean): number {
  return isMobile ? IDLE_SIZE_MOBILE_PX : IDLE_SIZE_DESKTOP_PX;
}

export function getVoiceOrbIdleVisualScale(isMobile: boolean): number {
  return getVoiceOrbIdleSizePx(isMobile) / VOICE_ORB_RENDER_SIZE_PX;
}

export function getVoiceOrbActiveSizePx(isMobile: boolean): number {
  return isMobile ? ACTIVE_SIZE_MOBILE_PX : ACTIVE_SIZE_DESKTOP_PX;
}

export function getVoiceOrbActiveVisualScale(isMobile: boolean): number {
  return getVoiceOrbActiveSizePx(isMobile) / VOICE_ORB_RENDER_SIZE_PX;
}

export function getVoiceOrbActiveYOffsetPx(isMobile: boolean): number {
  return isMobile ? ACTIVE_Y_OFFSET_MOBILE_PX : ACTIVE_Y_OFFSET_DESKTOP_PX;
}

export function getVoiceOrbActiveBottomPaddingPx(isMobile: boolean): number {
  return isMobile
    ? ACTIVE_CONTROL_DOCK_PADDING_MOBILE_PX
    : ACTIVE_CONTROL_DOCK_PADDING_DESKTOP_PX;
}

export const VOICE_ORB_LAYOUT_TRANSITION = {
  duration: 0.95,
  ease: EASE_OUT_QUINT
};

export const VOICE_ORB_TEXT_EXIT_TRANSITION = {
  duration: 0.28,
  ease: EASE_OUT_QUINT
};

export const VOICE_MODE_INPUT_TRANSFORM_ORIGIN = '50% 0%';

export const VOICE_MODE_INPUT_PERSPECTIVE_PX = 1400;

export const VOICE_MODE_INPUT_VISIBLE = {
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1,
  opacity: 1
};

export const VOICE_MODE_INPUT_EXIT = {
  y: 148,
  z: -132,
  rotateX: 52,
  rotateY: -16,
  rotateZ: 7,
  scale: 0.72,
  opacity: 0
};

export const VOICE_MODE_INPUT_EXIT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 170,
  damping: 26,
  mass: 1.08
};

export const VOICE_MODE_INPUT_RETURN_TRANSITION = {
  duration: 0.95,
  ease: EASE_OUT_QUINT
};

export const VOICE_MODE_INPUT_RETURN_DELAYED_TRANSITION = {
  ...VOICE_MODE_INPUT_RETURN_TRANSITION,
  delay: 0.12
};

export const VOICE_MODE_INPUT_REDUCED_MOTION_EXIT = { y: 48, opacity: 0 };

export const VOICE_MODE_INPUT_REDUCED_MOTION_VISIBLE = { y: 0, opacity: 1 };

export const VOICE_MODE_CONTROLS_VISIBLE = {
  opacity: 1,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1
};

export const VOICE_MODE_CONTROLS_HIDDEN = {
  opacity: 0,
  y: 54,
  z: -132,
  rotateX: 52,
  rotateY: -16,
  rotateZ: 7,
  scale: 0.72
};

export const VOICE_MODE_CONTROLS_REDUCED_MOTION_VISIBLE = {
  opacity: 1,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1
};

export const VOICE_MODE_CONTROLS_REDUCED_MOTION_HIDDEN = {
  opacity: 0,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1
};

export const VOICE_MODE_CONTROLS_TRANSITION = VOICE_MODE_INPUT_EXIT_TRANSITION;

// Softer pop used by the floating controls dock rendered outside the panel
// (panel closed, live voice still active). Keeps the same 3D tilt language as
// the panel-internal dock above, just dialed back â€” shallower rotation/depth
// and a much shallower scale dip, since the full-strength version reads as
// overdone on a small pill sitting alone on the page.
export const VOICE_MODE_OUTER_CONTROLS_VISIBLE = {
  opacity: 1,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1
};

export const VOICE_MODE_OUTER_CONTROLS_HIDDEN = {
  opacity: 0,
  y: 28,
  z: -60,
  rotateX: 26,
  rotateY: -8,
  rotateZ: 3,
  scale: 0.9
};

export const VOICE_MODE_OUTER_CONTROLS_TRANSITION = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 30,
  mass: 0.85
};

export const LIVE_VOICE_MOBILE_HEADER_TRANSITION = {
  duration: 0.42,
  ease: EASE_OUT_QUINT
};

export const LIVE_VOICE_MOBILE_HEADER_SHELL_VISIBLE = {
  maxHeight: 120,
  opacity: 1
};

export const LIVE_VOICE_MOBILE_HEADER_SHELL_HIDDEN = {
  maxHeight: 0,
  opacity: 0
};

export const LIVE_VOICE_MOBILE_HEADER_CONTENT_VISIBLE = {
  y: 0
};

export const LIVE_VOICE_MOBILE_HEADER_CONTENT_HIDDEN = {
  y: -20
};

export const VOICE_ORB_AURORA_ENTER_TRANSITION = {
  duration: 0.85,
  ease: EASE_OUT_QUINT
};

export const VOICE_ORB_AURORA_BAND_1_DURATION_S = 9.5;
export const VOICE_ORB_AURORA_BAND_2_DURATION_S = 7.2;
export const VOICE_ORB_AURORA_BASE_DURATION_S = 6.3;
