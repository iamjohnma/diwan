import { clamp } from '@/utils/common/math';

const VOICE_ORB_MIN_ACTIVE_FRACTION = 0.34;
const VOICE_ORB_SHRINK_STEP_FRACTION = 0.12;
const VOICE_ORB_GROW_STEP_FRACTION = 0.06;
const VOICE_ORB_SHRINK_FPS = 50;
const VOICE_ORB_GROW_FPS = 58;
const VOICE_ORB_FPS_EMA_PER_S = 2.5;
const VOICE_ORB_SHRINK_COOLDOWN_S = 0.6;
const VOICE_ORB_GROW_COOLDOWN_S = 2.5;
const VOICE_ORB_WARMUP_S = 1.2;
const VOICE_ORB_MIN_FPS_SAMPLE = 5;
const VOICE_ORB_MAX_FPS_SAMPLE = 120;

interface NavigatorWithDeviceHints extends Navigator {
  deviceMemory?: number;
}

export function estimateVoiceOrbDeviceScalar(): number {
  if (typeof navigator === 'undefined') {
    return 1;
  }

  let scalar = 1;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0) {
    if (cores <= 4) {
      scalar = Math.min(scalar, 0.55);
    } else if (cores <= 6) {
      scalar = Math.min(scalar, 0.8);
    }
  }

  const memory = (navigator as NavigatorWithDeviceHints).deviceMemory;
  if (typeof memory === 'number' && memory > 0 && memory <= 4) {
    scalar = Math.min(scalar, 0.6);
  }

  if (
    typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches
  ) {
    scalar = Math.min(scalar, 0.85);
  }

  return clamp(scalar, VOICE_ORB_MIN_ACTIVE_FRACTION, 1);
}

export function getVoiceOrbMaxDevicePixelRatio(deviceScalar: number): number {
  return deviceScalar < 0.6 ? 1.5 : 2;
}

export interface VoiceOrbPerformanceController {
  capacity: number;
  minActive: number;
  activeCount: number;
  fpsEma: number;
  cooldown: number;
}

export function createVoiceOrbPerformanceController(
  capacity: number,
  deviceScalar: number
): VoiceOrbPerformanceController {
  const safeCapacity = Math.max(1, Math.round(capacity));
  const minActive = Math.max(
    1,
    Math.min(
      safeCapacity,
      Math.round(safeCapacity * VOICE_ORB_MIN_ACTIVE_FRACTION)
    )
  );
  const activeCount = clamp(
    Math.round(safeCapacity * deviceScalar),
    minActive,
    safeCapacity
  );

  return {
    capacity: safeCapacity,
    minActive,
    activeCount,
    fpsEma: 60,
    cooldown: VOICE_ORB_WARMUP_S
  };
}

export function updateVoiceOrbPerformanceController(
  controller: VoiceOrbPerformanceController,
  deltaSeconds: number
): number {
  if (deltaSeconds <= 0) {
    return controller.activeCount;
  }

  const fpsSample = clamp(
    1 / deltaSeconds,
    VOICE_ORB_MIN_FPS_SAMPLE,
    VOICE_ORB_MAX_FPS_SAMPLE
  );
  const ease = 1 - Math.exp(-deltaSeconds * VOICE_ORB_FPS_EMA_PER_S);
  controller.fpsEma += (fpsSample - controller.fpsEma) * ease;

  controller.cooldown -= deltaSeconds;
  if (controller.cooldown > 0) {
    return controller.activeCount;
  }

  if (
    controller.fpsEma < VOICE_ORB_SHRINK_FPS &&
    controller.activeCount > controller.minActive
  ) {
    const step = Math.max(
      1,
      Math.round(controller.capacity * VOICE_ORB_SHRINK_STEP_FRACTION)
    );
    controller.activeCount = Math.max(
      controller.minActive,
      controller.activeCount - step
    );
    controller.cooldown = VOICE_ORB_SHRINK_COOLDOWN_S;
  } else if (
    controller.fpsEma > VOICE_ORB_GROW_FPS &&
    controller.activeCount < controller.capacity
  ) {
    const step = Math.max(
      1,
      Math.round(controller.capacity * VOICE_ORB_GROW_STEP_FRACTION)
    );
    controller.activeCount = Math.min(
      controller.capacity,
      controller.activeCount + step
    );
    controller.cooldown = VOICE_ORB_GROW_COOLDOWN_S;
  }

  return controller.activeCount;
}
