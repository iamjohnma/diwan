// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- Ported verbatim from Naab; its typed-array renderer is validated under Naab's TypeScript profile.
export type VoiceOrbMode =
  'idle' | 'thinking' | 'listening' | 'speaking' | 'speaking-progress';

export function isVoiceOrbSphereLayoutMode(mode: VoiceOrbMode): boolean {
  return (
    mode === 'thinking' ||
    mode === 'listening' ||
    mode === 'speaking' ||
    mode === 'speaking-progress'
  );
}

export function isVoiceOrbRingLayoutMode(mode: VoiceOrbMode): boolean {
  return isVoiceOrbSphereLayoutMode(mode);
}

export interface VoiceOrbParticle {
  originX: number;
  originY: number;
  originZ: number;
  sphereX: number;
  sphereY: number;
  sphereZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  springX: number;
  springY: number;
  springZ: number;
  springVelX: number;
  springVelY: number;
  springVelZ: number;
  size: number;
  delay: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  pointerVelocityX: number;
  pointerVelocityY: number;
  shellOffset: number;
  wobbleAmplitude: number;
  wobbleSpeed: number;
  wobblePhase: number;
  isTraveler: boolean;
  travelerPhase: number;
  travelerPeriod: number;
  travelerFlightDuration: number;
  shadeVariant: 0 | 1;
}

export interface VoiceOrbColors {
  idle: string;
  thinking: string;
  listening: string;
  speaking: string;
}

export interface VoiceOrbRgbColor {
  r: number;
  g: number;
  b: number;
}

const VOICE_ORB_PRIMARY_FALLBACK_COLOR = '#2e6acd';

export const VOICE_ORB_COLOR_TRANSITION_DURATION_S = 0.95;

const VOICE_ORB_ALPHA_BUCKET_COUNT = 32;
const VOICE_ORB_SHADE_COUNT = 2;
const VOICE_ORB_DRAW_BUCKET_COUNT =
  VOICE_ORB_ALPHA_BUCKET_COUNT * VOICE_ORB_SHADE_COUNT;
const VOICE_ORB_ALT_SHADE_LIGHTNESS_LIFT = 0.17;
const VOICE_ORB_ALT_SHADE_MAX_LIGHTNESS = 0.82;
const VOICE_ORB_PARTICLE_SATURATION_LIFT = 0.12;
const VOICE_ORB_PARTICLE_LIGHTNESS_LIFT = 0.015;
const TWO_PI = Math.PI * 2;

export interface VoiceOrbRenderBuffer {
  capacity: number;
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  screenX: Float32Array;
  screenY: Float32Array;
  radius: Float32Array;
  shadeVariant: Uint8Array;
  bucket: Int16Array;
  order: Int32Array;
  bucketCount: Int32Array;
  bucketStart: Int32Array;
  bucketCursor: Int32Array;
  rotationBlendInitialized: boolean;
  rotationBlendNegated: boolean;
  rotationBlendUsesExtendedArc: boolean;
  rotationBlendTangent: Float64Array;
  previousSphereQuaternion: Float64Array;
  previousRingQuaternion: Float64Array;
  rotationBlendTransitionElapsed: number;
  rotationBlendTransitionFromSphereLayout: boolean;
  rotationBlendTransitionFromRingLayout: boolean;
}

export function createVoiceOrbRenderBuffer(
  capacity: number
): VoiceOrbRenderBuffer {
  const safeCapacity = Math.max(1, capacity);

  return {
    capacity: safeCapacity,
    count: 0,
    x: new Float32Array(safeCapacity),
    y: new Float32Array(safeCapacity),
    z: new Float32Array(safeCapacity),
    size: new Float32Array(safeCapacity),
    alpha: new Float32Array(safeCapacity),
    screenX: new Float32Array(safeCapacity),
    screenY: new Float32Array(safeCapacity),
    radius: new Float32Array(safeCapacity),
    shadeVariant: new Uint8Array(safeCapacity),
    bucket: new Int16Array(safeCapacity),
    order: new Int32Array(safeCapacity),
    bucketCount: new Int32Array(VOICE_ORB_DRAW_BUCKET_COUNT),
    bucketStart: new Int32Array(VOICE_ORB_DRAW_BUCKET_COUNT),
    bucketCursor: new Int32Array(VOICE_ORB_DRAW_BUCKET_COUNT),
    rotationBlendInitialized: false,
    rotationBlendNegated: false,
    rotationBlendUsesExtendedArc: false,
    rotationBlendTangent: new Float64Array(4),
    previousSphereQuaternion: new Float64Array(4),
    previousRingQuaternion: new Float64Array(4),
    rotationBlendTransitionElapsed: Number.NaN,
    rotationBlendTransitionFromSphereLayout: false,
    rotationBlendTransitionFromRingLayout: false
  };
}

function resetVoiceOrbRotationBlendContinuity(
  buffer: VoiceOrbRenderBuffer
): void {
  buffer.rotationBlendInitialized = false;
  buffer.rotationBlendNegated = false;
  buffer.rotationBlendUsesExtendedArc = false;
  buffer.rotationBlendTangent.fill(0);
  buffer.previousSphereQuaternion.fill(0);
  buffer.previousRingQuaternion.fill(0);
}

export interface VoiceOrbPointerRepulsion {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

export const VOICE_ORB_DEFAULT_SIZE_PX = 128;
const VOICE_ORB_PARTICLE_RADIUS_FRACTION_IDLE = 0.3;
const VOICE_ORB_PARTICLE_RADIUS_FRACTION_ACTIVE_DESKTOP = 0.28;
const VOICE_ORB_PARTICLE_RADIUS_FRACTION_ACTIVE_MOBILE = 0.38;

function getVoiceOrbParticleRadiusFraction(
  mode: VoiceOrbMode,
  isMobile: boolean
): number {
  if (!isVoiceOrbSphereLayoutMode(mode)) {
    return VOICE_ORB_PARTICLE_RADIUS_FRACTION_IDLE;
  }

  return isMobile
    ? VOICE_ORB_PARTICLE_RADIUS_FRACTION_ACTIVE_MOBILE
    : VOICE_ORB_PARTICLE_RADIUS_FRACTION_ACTIVE_DESKTOP;
}

export function computeVoiceOrbParticleRadius(
  width: number,
  height: number,
  mode: VoiceOrbMode,
  isMobile: boolean
): number {
  return (
    Math.min(width, height) * getVoiceOrbParticleRadiusFraction(mode, isMobile)
  );
}
export const VOICE_ORB_PARTICLE_COUNT = 720;
const VOICE_ORB_FORMATION_DURATION_S = 1.5;
const VOICE_ORB_MAX_PARTICLE_DELAY_S = 0.8;
const VOICE_ORB_SPHERE_FORMATION_DURATION_S = 1.25;
const VOICE_ORB_SPRING_STIFFNESS = 80;
const VOICE_ORB_SPRING_DAMPING = 8;
// A spring within these thresholds of its target (<0.00001px â€” orders of
// magnitude below one canvas anti-aliasing quantum) is visually
// indistinguishable from one resting exactly on it, so it gets pinned to the
// exact fixed point (which is also the exact fixed point of the original
// integrator) and its integration becomes skippable on subsequent frames.
const VOICE_ORB_SPRING_SETTLE_POSITION_EPS = 1e-5;
const VOICE_ORB_SPRING_SETTLE_VELOCITY_EPS = 1e-4;
export const VOICE_ORB_FIXED_TIMESTEP_S = 1 / 60;
export const VOICE_ORB_POINTER_REPEL_RADIUS_FRACTION = 0.34;
const VOICE_ORB_POINTER_REPEL_FORCE = 3600;
const VOICE_ORB_POINTER_RETURN_STIFFNESS = 32;
const VOICE_ORB_POINTER_RETURN_DAMPING = 6.8;
const VOICE_ORB_POINTER_MAX_OFFSET_PX = 40;

const VOICE_ORB_SPEAKING_BASE_PUSH = 0.1;
const VOICE_ORB_SPEAKING_WAVE_PUSH = 0.52;
const VOICE_ORB_SPEAKING_WAVE_SPEED = 2.6;
const VOICE_ORB_SPEAKING_WAVE_BANDS = 3.6;
const VOICE_ORB_SPEAKING_SHIMMER_SPEED = 6.1;

const VOICE_ORB_SHELL_JITTER = 0.12;
const VOICE_ORB_INNER_DUST_RATIO = 0.08;
const VOICE_ORB_INNER_DUST_MIN_OFFSET = 0.45;
const VOICE_ORB_INNER_DUST_MAX_OFFSET = 0.85;
const VOICE_ORB_WOBBLE_MIN_AMPLITUDE = 0.012;
const VOICE_ORB_WOBBLE_MAX_AMPLITUDE = 0.04;
const VOICE_ORB_WOBBLE_MIN_SPEED = 0.25;
const VOICE_ORB_WOBBLE_MAX_SPEED = 0.75;
const VOICE_ORB_TRAVELER_RATIO = 0.28;
const VOICE_ORB_TRAVELER_MIN_FLIGHT_S = 0.7;
const VOICE_ORB_TRAVELER_MAX_FLIGHT_S = 6.2;
const VOICE_ORB_TRAVELER_MIN_REST_S = 1.2;
const VOICE_ORB_TRAVELER_MAX_REST_S = 4.8;
const VOICE_ORB_CAMERA_DISTANCE_RADII = 5;

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

function getParticleCountForRadius(
  radius: number,
  particleCount?: number
): number {
  if (particleCount !== undefined) {
    return Math.max(1, Math.round(particleCount));
  }

  const scaled = Math.round((radius / 28) * VOICE_ORB_PARTICLE_COUNT);

  return Math.max(270, Math.min(VOICE_ORB_PARTICLE_COUNT, scaled));
}

export function createVoiceOrbParticles(
  radius: number,
  particleCount?: number
): VoiceOrbParticle[] {
  const count = getParticleCountForRadius(radius, particleCount);
  const particles: VoiceOrbParticle[] = [];

  for (let index = 0; index < count; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const sphereTheta = (2 * Math.PI * index) / GOLDEN_RATIO;
    const spherePhi = Math.acos(1 - (2 * (index + 0.5)) / count);
    const sphereX = radius * Math.sin(spherePhi) * Math.cos(sphereTheta);
    const sphereY = radius * Math.sin(spherePhi) * Math.sin(sphereTheta);
    const sphereZ = radius * Math.cos(spherePhi);

    const roleRoll = Math.random();
    const isTraveler = roleRoll < VOICE_ORB_TRAVELER_RATIO;
    const isInnerDust =
      !isTraveler &&
      roleRoll < VOICE_ORB_TRAVELER_RATIO + VOICE_ORB_INNER_DUST_RATIO;
    const shellOffset = isInnerDust
      ? VOICE_ORB_INNER_DUST_MIN_OFFSET +
        Math.random() *
          (VOICE_ORB_INNER_DUST_MAX_OFFSET - VOICE_ORB_INNER_DUST_MIN_OFFSET)
      : 1 + (Math.random() - 0.5) * VOICE_ORB_SHELL_JITTER;
    const travelerSpeedExponent = 0.35 + Math.random() * 1.45;
    const travelerFlightDuration =
      VOICE_ORB_TRAVELER_MIN_FLIGHT_S +
      (VOICE_ORB_TRAVELER_MAX_FLIGHT_S - VOICE_ORB_TRAVELER_MIN_FLIGHT_S) *
        Math.pow(Math.random(), travelerSpeedExponent);
    const travelerPeriod =
      travelerFlightDuration +
      VOICE_ORB_TRAVELER_MIN_REST_S +
      Math.random() *
        (VOICE_ORB_TRAVELER_MAX_REST_S - VOICE_ORB_TRAVELER_MIN_REST_S);
    const sizeScale = isInnerDust ? 0.75 : isTraveler ? 1.15 : 1;

    particles.push({
      originX: x,
      originY: y,
      originZ: z,
      sphereX,
      sphereY,
      sphereZ,
      targetX: x,
      targetY: y,
      targetZ: z,
      springX: x,
      springY: y,
      springZ: z,
      springVelX: 0,
      springVelY: 0,
      springVelZ: 0,
      size: (Math.random() * 0.95 + 0.35) * sizeScale,
      delay: Math.random() * VOICE_ORB_MAX_PARTICLE_DELAY_S,
      speedX: 0.3 + Math.random() * 0.7,
      speedY: 0.3 + Math.random() * 0.7,
      speedZ: 0.3 + Math.random() * 0.7,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      pointerVelocityX: 0,
      pointerVelocityY: 0,
      shellOffset,
      wobbleAmplitude:
        VOICE_ORB_WOBBLE_MIN_AMPLITUDE +
        Math.random() *
          (VOICE_ORB_WOBBLE_MAX_AMPLITUDE - VOICE_ORB_WOBBLE_MIN_AMPLITUDE),
      wobbleSpeed:
        VOICE_ORB_WOBBLE_MIN_SPEED +
        Math.random() *
          (VOICE_ORB_WOBBLE_MAX_SPEED - VOICE_ORB_WOBBLE_MIN_SPEED),
      wobblePhase: Math.random() * Math.PI * 2,
      isTraveler,
      travelerPhase: isTraveler ? Math.random() * travelerPeriod : 0,
      travelerPeriod,
      travelerFlightDuration,
      shadeVariant: Math.random() < 0.5 ? 0 : 1
    });
  }

  return particles;
}

function readParticleSphereRadius(particle: VoiceOrbParticle): number {
  return Math.hypot(particle.sphereX, particle.sphereY, particle.sphereZ);
}

function resizeParticleVector(
  x: number,
  y: number,
  z: number,
  radius: number,
  fallback: { x: number; y: number; z: number }
): {
  x: number;
  y: number;
  z: number;
} {
  const distance = Math.hypot(x, y, z);

  if (distance > 1e-6) {
    return {
      x: (x / distance) * radius,
      y: (y / distance) * radius,
      z: (z / distance) * radius
    };
  }

  return fallback;
}

export function resizeVoiceOrbParticles(
  particles: VoiceOrbParticle[],
  radius: number
): void {
  for (const particle of particles) {
    const sphere = resizeParticleVector(
      particle.sphereX,
      particle.sphereY,
      particle.sphereZ,
      radius,
      { x: 0, y: 0, z: radius }
    );
    const origin = resizeParticleVector(
      particle.originX,
      particle.originY,
      particle.originZ,
      radius,
      sphere
    );

    particle.originX = origin.x;
    particle.originY = origin.y;
    particle.originZ = origin.z;
    particle.sphereX = sphere.x;
    particle.sphereY = sphere.y;
    particle.sphereZ = sphere.z;
  }
}

const VOICE_ORB_THINKING_RING_DEPTH_COMPRESSION = 0.2;
const VOICE_ORB_THINKING_RING_MAX_BAND_FRACTION = 0.16;

function setVoiceOrbParticleRingTarget(
  particle: VoiceOrbParticle,
  x: number,
  y: number,
  z: number,
  radius: number,
  fallbackAngle: number
): void {
  const maxBandZ = radius * VOICE_ORB_THINKING_RING_MAX_BAND_FRACTION;
  const bandZ = Math.max(
    -maxBandZ,
    Math.min(maxBandZ, z * VOICE_ORB_THINKING_RING_DEPTH_COMPRESSION)
  );
  const ringRadius = Math.sqrt(Math.max(0, radius * radius - bandZ * bandZ));
  const planar = Math.hypot(x, y);

  if (planar > 1e-6) {
    const scale = ringRadius / planar;

    particle.targetX = x * scale;
    particle.targetY = y * scale;
    particle.targetZ = bandZ;

    return;
  }

  particle.targetX = ringRadius * Math.cos(fallbackAngle);
  particle.targetY = ringRadius * Math.sin(fallbackAngle);
  particle.targetZ = bandZ;
}

export function setVoiceOrbParticleTargets(
  particles: VoiceOrbParticle[],
  mode: VoiceOrbMode
): void {
  const useSphereLayout = isVoiceOrbSphereLayoutMode(mode);
  const useRingLayout = isVoiceOrbRingLayoutMode(mode);

  for (const particle of particles) {
    if (useSphereLayout) {
      const radius = readParticleSphereRadius(particle) * particle.shellOffset;
      const homeX = particle.originX * particle.shellOffset;
      const homeY = particle.originY * particle.shellOffset;
      const homeZ = particle.originZ * particle.shellOffset;
      if (useRingLayout) {
        setVoiceOrbParticleRingTarget(
          particle,
          homeX,
          homeY,
          homeZ,
          radius,
          particle.phaseX
        );
      } else {
        particle.targetX = homeX;
        particle.targetY = homeY;
        particle.targetZ = homeZ;
      }
      continue;
    }

    particle.targetX = particle.originX;
    particle.targetY = particle.originY;
    particle.targetZ = particle.originZ;
  }
}

export function settleVoiceOrbParticles(particles: VoiceOrbParticle[]): void {
  for (const particle of particles) {
    particle.springX = particle.targetX;
    particle.springY = particle.targetY;
    particle.springZ = particle.targetZ;
    particle.springVelX = 0;
    particle.springVelY = 0;
    particle.springVelZ = 0;
    particle.pointerOffsetX = 0;
    particle.pointerOffsetY = 0;
    particle.pointerVelocityX = 0;
    particle.pointerVelocityY = 0;
  }
}

function constrainParticleToSphereShell(
  particle: VoiceOrbParticle,
  radius: number
): void {
  const distance = Math.sqrt(
    particle.springX * particle.springX +
      particle.springY * particle.springY +
      particle.springZ * particle.springZ
  );

  if (distance <= 1e-6) {
    return;
  }

  const scale = radius / distance;

  particle.springX *= scale;
  particle.springY *= scale;
  particle.springZ *= scale;
  particle.springVelX = 0;
  particle.springVelY = 0;
  particle.springVelZ = 0;
}

function computeVoiceOrbSpeakingScale(
  particle: VoiceOrbParticle,
  radius: number,
  time: number,
  audioLevel: number
): number {
  if (audioLevel <= 0.001) {
    return 1;
  }

  const normalizedY = radius > 1e-6 ? particle.sphereY / radius : 0;
  const ripple =
    0.5 +
    0.5 *
      Math.sin(
        time * VOICE_ORB_SPEAKING_WAVE_SPEED +
          normalizedY * VOICE_ORB_SPEAKING_WAVE_BANDS +
          particle.phaseX
      );
  const shimmer =
    0.5 +
    0.5 * Math.sin(time * VOICE_ORB_SPEAKING_SHIMMER_SPEED + particle.phaseZ);
  const pushFraction =
    audioLevel *
    (VOICE_ORB_SPEAKING_BASE_PUSH +
      VOICE_ORB_SPEAKING_WAVE_PUSH * ripple * (0.7 + 0.3 * shimmer));

  return 1 + pushFraction;
}

function easeVoiceOrbTravelProgress(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function computeVoiceOrbTravelMultiplier(
  particle: VoiceOrbParticle,
  time: number
): number {
  if (!particle.isTraveler) {
    return 1;
  }

  const cycleTime = time + particle.travelerPhase;
  const cycleIndex = Math.floor(cycleTime / particle.travelerPeriod);
  const localTime = cycleTime - cycleIndex * particle.travelerPeriod;
  const restDuration =
    particle.travelerPeriod - particle.travelerFlightDuration;
  const dockSign = cycleIndex % 2 === 0 ? 1 : -1;

  if (localTime <= restDuration) {
    return dockSign;
  }

  const flightProgress = Math.min(
    1,
    (localTime - restDuration) / particle.travelerFlightDuration
  );

  return dockSign * (1 - 2 * easeVoiceOrbTravelProgress(flightProgress));
}

interface VoiceOrbProjectedPoint {
  x: number;
  y: number;
  z: number;
  perspective: number;
}

const VOICE_ORB_SLERP_LINEAR_THRESHOLD = 0.9995;
const VOICE_ORB_SLERP_ANTIPODAL_THRESHOLD = -VOICE_ORB_SLERP_LINEAR_THRESHOLD;
const VOICE_ORB_SLERP_TANGENT_EPSILON = 1e-8;
const voiceOrbSlerpCandidateTangent = new Float64Array(4);

function setVoiceOrbSlerpTangent(
  out: Float64Array,
  a: Float64Array,
  bw: number,
  bx: number,
  by: number,
  bz: number
): boolean {
  const dot = a[0] * bw + a[1] * bx + a[2] * by + a[3] * bz;
  const tangentW = bw - a[0] * dot;
  const tangentX = bx - a[1] * dot;
  const tangentY = by - a[2] * dot;
  const tangentZ = bz - a[3] * dot;
  const length = Math.hypot(tangentW, tangentX, tangentY, tangentZ);

  if (length <= VOICE_ORB_SLERP_TANGENT_EPSILON) {
    return false;
  }

  out[0] = tangentW / length;
  out[1] = tangentX / length;
  out[2] = tangentY / length;
  out[3] = tangentZ / length;

  return true;
}

function buildVoiceOrbRotationMatrix(
  out: Float64Array,
  cosX: number,
  sinX: number,
  cosY: number,
  sinY: number,
  cosZ: number,
  sinZ: number
): void {
  out[0] = cosY * cosZ;
  out[1] = -cosY * sinZ;
  out[2] = -sinY;
  out[3] = cosX * sinZ - sinX * sinY * cosZ;
  out[4] = cosX * cosZ + sinX * sinY * sinZ;
  out[5] = -sinX * cosY;
  out[6] = sinX * sinZ + cosX * sinY * cosZ;
  out[7] = sinX * cosZ - cosX * sinY * sinZ;
  out[8] = cosX * cosY;
}

function voiceOrbMatrixToQuaternion(m: Float64Array, out: Float64Array): void {
  const trace = m[0] + m[4] + m[8];

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out[0] = 0.25 / s;
    out[1] = (m[7] - m[5]) * s;
    out[2] = (m[2] - m[6]) * s;
    out[3] = (m[3] - m[1]) * s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
    out[0] = (m[7] - m[5]) / s;
    out[1] = 0.25 * s;
    out[2] = (m[1] + m[3]) / s;
    out[3] = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
    out[0] = (m[2] - m[6]) / s;
    out[1] = (m[1] + m[3]) / s;
    out[2] = 0.25 * s;
    out[3] = (m[5] + m[7]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
    out[0] = (m[3] - m[1]) / s;
    out[1] = (m[2] + m[6]) / s;
    out[2] = (m[5] + m[7]) / s;
    out[3] = 0.25 * s;
  }
}

function voiceOrbQuaternionToMatrix(q: Float64Array, out: Float64Array): void {
  const w = q[0];
  const x = q[1];
  const y = q[2];
  const z = q[3];
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  out[0] = 1 - 2 * (yy + zz);
  out[1] = 2 * (xy - wz);
  out[2] = 2 * (xz + wy);
  out[3] = 2 * (xy + wz);
  out[4] = 1 - 2 * (xx + zz);
  out[5] = 2 * (yz - wx);
  out[6] = 2 * (xz - wy);
  out[7] = 2 * (yz + wx);
  out[8] = 1 - 2 * (xx + yy);
}

function slerpVoiceOrbQuaternion(
  a: Float64Array,
  b: Float64Array,
  t: number,
  negateB: boolean,
  retainedTangent: Float64Array,
  useExtendedArc: boolean,
  out: Float64Array
): boolean {
  const sign = negateB ? -1 : 1;
  const bw = b[0] * sign;
  const bx = b[1] * sign;
  const by = b[2] * sign;
  const bz = b[3] * sign;
  const dot = a[0] * bw + a[1] * bx + a[2] * by + a[3] * bz;
  let nextUseExtendedArc = useExtendedArc;

  // Near the antipode, the usual sin(theta) denominator collapses and the
  // interpolation plane becomes ambiguous. Reuse the prior plane, switching
  // to its extended angle if the moving endpoint crosses through -a.
  if (dot < VOICE_ORB_SLERP_ANTIPODAL_THRESHOLD || useExtendedArc) {
    let theta = Math.acos(Math.max(-1, Math.min(1, dot)));
    const hasRetainedTangent = setVoiceOrbSlerpTangent(
      retainedTangent,
      a,
      retainedTangent[0],
      retainedTangent[1],
      retainedTangent[2],
      retainedTangent[3]
    );
    const hasCandidateTangent = setVoiceOrbSlerpTangent(
      voiceOrbSlerpCandidateTangent,
      a,
      bw,
      bx,
      by,
      bz
    );

    if (hasCandidateTangent) {
      if (
        hasRetainedTangent &&
        voiceOrbSlerpCandidateTangent[0] * retainedTangent[0] +
          voiceOrbSlerpCandidateTangent[1] * retainedTangent[1] +
          voiceOrbSlerpCandidateTangent[2] * retainedTangent[2] +
          voiceOrbSlerpCandidateTangent[3] * retainedTangent[3] <
          0
      ) {
        voiceOrbSlerpCandidateTangent[0] = -voiceOrbSlerpCandidateTangent[0];
        voiceOrbSlerpCandidateTangent[1] = -voiceOrbSlerpCandidateTangent[1];
        voiceOrbSlerpCandidateTangent[2] = -voiceOrbSlerpCandidateTangent[2];
        voiceOrbSlerpCandidateTangent[3] = -voiceOrbSlerpCandidateTangent[3];
        theta = TWO_PI - theta;
        nextUseExtendedArc = true;
      } else {
        nextUseExtendedArc = false;
      }

      retainedTangent.set(voiceOrbSlerpCandidateTangent);
    } else if (hasRetainedTangent) {
      theta = useExtendedArc ? TWO_PI - theta : theta;
    } else {
      // This is only reachable on an uninitialized exact-antipode input.
      retainedTangent[0] = -a[1];
      retainedTangent[1] = a[0];
      retainedTangent[2] = -a[3];
      retainedTangent[3] = a[2];
      nextUseExtendedArc = false;
    }

    const weightA = Math.cos(t * theta);
    const weightTangent = Math.sin(t * theta);

    out[0] = a[0] * weightA + retainedTangent[0] * weightTangent;
    out[1] = a[1] * weightA + retainedTangent[1] * weightTangent;
    out[2] = a[2] * weightA + retainedTangent[2] * weightTangent;
    out[3] = a[3] * weightA + retainedTangent[3] * weightTangent;
  } else if (dot > VOICE_ORB_SLERP_LINEAR_THRESHOLD) {
    out[0] = a[0] + (bw - a[0]) * t;
    out[1] = a[1] + (bx - a[1]) * t;
    out[2] = a[2] + (by - a[2]) * t;
    out[3] = a[3] + (bz - a[3]) * t;
  } else {
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const weightA = Math.sin((1 - t) * theta) / sinTheta;
    const weightB = Math.sin(t * theta) / sinTheta;

    out[0] = a[0] * weightA + bw * weightB;
    out[1] = a[1] * weightA + bx * weightB;
    out[2] = a[2] * weightA + by * weightB;
    out[3] = a[3] * weightA + bz * weightB;
    if (dot < 0) {
      setVoiceOrbSlerpTangent(retainedTangent, a, bw, bx, by, bz);
    }
  }

  const length = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
  out[0] /= length;
  out[1] /= length;
  out[2] /= length;
  out[3] /= length;

  return nextUseExtendedArc;
}

function projectVoiceOrbPointWithMatrix(
  out: VoiceOrbProjectedPoint,
  x: number,
  y: number,
  z: number,
  m: Float64Array,
  cameraDistance: number
): void {
  const rotatedX = m[0] * x + m[1] * y + m[2] * z;
  const rotatedY = m[3] * x + m[4] * y + m[5] * z;
  const rotatedDepth = m[6] * x + m[7] * y + m[8] * z;
  const perspective =
    cameraDistance > 1e-6
      ? cameraDistance /
        Math.max(cameraDistance * 0.45, cameraDistance - rotatedDepth)
      : 1;

  out.x = rotatedX * perspective;
  out.y = rotatedY * perspective;
  out.z = rotatedDepth;
  out.perspective = perspective;
}

const VOICE_ORB_RING_SPIN_SPEED = 0.35;
const VOICE_ORB_RING_FAST_SPIN_SPEED = 1.1;

export function getVoiceOrbRingSpinSpeed(mode: VoiceOrbMode): number {
  return mode === 'thinking' || mode === 'speaking-progress'
    ? VOICE_ORB_RING_FAST_SPIN_SPEED
    : VOICE_ORB_RING_SPIN_SPEED;
}

const voiceOrbProjectionHead: VoiceOrbProjectedPoint = {
  x: 0,
  y: 0,
  z: 0,
  perspective: 1
};
const voiceOrbRotationMatrix = new Float64Array(9);
const voiceOrbSphereRotationMatrix = new Float64Array(9);
const voiceOrbRingRotationMatrix = new Float64Array(9);
const voiceOrbSphereQuaternion = new Float64Array(4);
const voiceOrbRingQuaternion = new Float64Array(4);
const voiceOrbBlendedQuaternion = new Float64Array(4);

export function projectVoiceOrbParticlesInto(
  buffer: VoiceOrbRenderBuffer,
  options: {
    particles: VoiceOrbParticle[];
    mode: VoiceOrbMode;
    time: number;
    elapsed: number;
    modeTransitionElapsed: number;
    transitionFromSphereLayout?: boolean;
    transitionFromRingLayout?: boolean;
    pointerRepulsion?: VoiceOrbPointerRepulsion | null;
    audioLevel?: number;
    ringSpin?: number;
    activeCount?: number;
  }
): void {
  const {
    particles,
    mode,
    time,
    elapsed,
    modeTransitionElapsed,
    transitionFromSphereLayout = false,
    transitionFromRingLayout = false,
    pointerRepulsion
  } = options;
  const previousModeTransitionElapsed = buffer.rotationBlendTransitionElapsed;
  // Interrupted layout transitions can begin before the prior blend reaches
  // an endpoint, so elapsed restarts and source-layout changes define epochs.
  const transitionEpochChanged =
    buffer.rotationBlendInitialized &&
    (transitionFromSphereLayout !==
      buffer.rotationBlendTransitionFromSphereLayout ||
      transitionFromRingLayout !==
        buffer.rotationBlendTransitionFromRingLayout ||
      !Number.isFinite(modeTransitionElapsed) ||
      !Number.isFinite(previousModeTransitionElapsed) ||
      modeTransitionElapsed < previousModeTransitionElapsed);
  if (transitionEpochChanged) {
    resetVoiceOrbRotationBlendContinuity(buffer);
  }
  buffer.rotationBlendTransitionElapsed = modeTransitionElapsed;
  buffer.rotationBlendTransitionFromSphereLayout = transitionFromSphereLayout;
  buffer.rotationBlendTransitionFromRingLayout = transitionFromRingLayout;
  const count = Math.min(
    buffer.capacity,
    options.activeCount ?? particles.length,
    particles.length
  );
  buffer.count = count;
  if (count <= 0) {
    return;
  }
  const isAudioReactiveMode =
    mode === 'listening' || mode === 'speaking' || mode === 'speaking-progress';
  const isSphereLayout = isVoiceOrbSphereLayoutMode(mode);
  const isRingLayout = isVoiceOrbRingLayoutMode(mode);
  const audioLevel = isAudioReactiveMode
    ? Math.min(1, Math.max(0, options.audioLevel ?? 0))
    : 0;
  const shapeTransitionProgress = Number.isFinite(modeTransitionElapsed)
    ? Math.min(
        1,
        Math.max(
          0,
          modeTransitionElapsed / VOICE_ORB_SPHERE_FORMATION_DURATION_S
        )
      )
    : 1;
  const shapeTransitionEased = 1 - (1 - shapeTransitionProgress) ** 3;
  const sphereBlend = isSphereLayout
    ? transitionFromSphereLayout
      ? 1
      : shapeTransitionEased
    : transitionFromSphereLayout && shapeTransitionProgress < 1
      ? 1 - shapeTransitionEased
      : 0;
  const ringBlend = isRingLayout
    ? transitionFromRingLayout
      ? 1
      : shapeTransitionEased
    : transitionFromRingLayout && shapeTransitionProgress < 1
      ? 1 - shapeTransitionEased
      : 0;
  const wanderAmount = 12 * (1 - sphereBlend);
  const rotY = time * 0.15;
  const idleRotX = Math.sin(time * 0.1) * 0.2;
  const sphereRotX = 0.28 + Math.sin(time * 0.06) * 0.06;
  const rotX = idleRotX + (sphereRotX - idleRotX) * sphereBlend;
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const ringSpin = options.ringSpin ?? time * getVoiceOrbRingSpinSpeed(mode);
  const cosRing = Math.cos(ringSpin);
  const sinRing = Math.sin(ringSpin);
  const dt = VOICE_ORB_FIXED_TIMESTEP_S;
  const springStiffness =
    VOICE_ORB_SPRING_STIFFNESS +
    (72 - VOICE_ORB_SPRING_STIFFNESS) * sphereBlend;
  const springDamping =
    VOICE_ORB_SPRING_DAMPING + (12 - VOICE_ORB_SPRING_DAMPING) * sphereBlend;
  const radius = readParticleSphereRadius(particles[0]);
  const cameraDistance = radius * VOICE_ORB_CAMERA_DISTANCE_RADII;
  const head = voiceOrbProjectionHead;
  const speakingActive = audioLevel > 0.001;
  const pointerActive =
    !!pointerRepulsion &&
    pointerRepulsion.radius > 0 &&
    pointerRepulsion.strength > 0.01;
  // In sphere layout every particle shares the same formation progress, so
  // the shell constraint toggle is frame-constant rather than per-particle.
  const applyShellConstraint = isSphereLayout && shapeTransitionProgress >= 1;
  // Idle formation easing only shapes the output while the orb is in idle
  // layout with no residual sphere blend and at least one particle is still
  // forming (delays are bounded by VOICE_ORB_MAX_PARTICLE_DELAY_S). Past
  // that point every particle evaluates to exactly 1, so the per-particle
  // easing math is skipped wholesale.
  const idleFormationActive =
    !isSphereLayout &&
    sphereBlend <= 0 &&
    elapsed < VOICE_ORB_MAX_PARTICLE_DELAY_S + VOICE_ORB_FORMATION_DURATION_S;

  const rotationMatrix = voiceOrbRotationMatrix;
  if (ringBlend <= 0) {
    buffer.rotationBlendInitialized = false;
    buildVoiceOrbRotationMatrix(rotationMatrix, cosX, sinX, cosY, sinY, 1, 0);
  } else if (ringBlend >= 1) {
    buffer.rotationBlendInitialized = false;
    buildVoiceOrbRotationMatrix(rotationMatrix, 1, 0, 1, 0, cosRing, sinRing);
  } else {
    buildVoiceOrbRotationMatrix(
      voiceOrbSphereRotationMatrix,
      cosX,
      sinX,
      cosY,
      sinY,
      1,
      0
    );
    buildVoiceOrbRotationMatrix(
      voiceOrbRingRotationMatrix,
      1,
      0,
      1,
      0,
      cosRing,
      sinRing
    );
    voiceOrbMatrixToQuaternion(
      voiceOrbSphereRotationMatrix,
      voiceOrbSphereQuaternion
    );
    voiceOrbMatrixToQuaternion(
      voiceOrbRingRotationMatrix,
      voiceOrbRingQuaternion
    );
    const rawDot =
      voiceOrbSphereQuaternion[0] * voiceOrbRingQuaternion[0] +
      voiceOrbSphereQuaternion[1] * voiceOrbRingQuaternion[1] +
      voiceOrbSphereQuaternion[2] * voiceOrbRingQuaternion[2] +
      voiceOrbSphereQuaternion[3] * voiceOrbRingQuaternion[3];
    if (buffer.rotationBlendInitialized) {
      const sphereRepresentationFlipped =
        buffer.previousSphereQuaternion[0] * voiceOrbSphereQuaternion[0] +
          buffer.previousSphereQuaternion[1] * voiceOrbSphereQuaternion[1] +
          buffer.previousSphereQuaternion[2] * voiceOrbSphereQuaternion[2] +
          buffer.previousSphereQuaternion[3] * voiceOrbSphereQuaternion[3] <
        0;
      const ringRepresentationFlipped =
        buffer.previousRingQuaternion[0] * voiceOrbRingQuaternion[0] +
          buffer.previousRingQuaternion[1] * voiceOrbRingQuaternion[1] +
          buffer.previousRingQuaternion[2] * voiceOrbRingQuaternion[2] +
          buffer.previousRingQuaternion[3] * voiceOrbRingQuaternion[3] <
        0;
      // Keep the same physical interpolation arc while the blend is active.
      // q and -q encode the same endpoint, so only an endpoint representation
      // flipâ€”not a raw dot-product crossingâ€”may change the stored branch.
      if (sphereRepresentationFlipped !== ringRepresentationFlipped) {
        buffer.rotationBlendNegated = !buffer.rotationBlendNegated;
      }
      if (sphereRepresentationFlipped) {
        // The tangent shares the sphere endpoint's quaternion representation.
        buffer.rotationBlendTangent[0] = -buffer.rotationBlendTangent[0];
        buffer.rotationBlendTangent[1] = -buffer.rotationBlendTangent[1];
        buffer.rotationBlendTangent[2] = -buffer.rotationBlendTangent[2];
        buffer.rotationBlendTangent[3] = -buffer.rotationBlendTangent[3];
      }
    } else {
      buffer.rotationBlendInitialized = true;
      buffer.rotationBlendNegated = rawDot < 0;
      buffer.rotationBlendUsesExtendedArc = false;
      buffer.rotationBlendTangent.fill(0);
    }
    buffer.previousSphereQuaternion.set(voiceOrbSphereQuaternion);
    buffer.previousRingQuaternion.set(voiceOrbRingQuaternion);
    buffer.rotationBlendUsesExtendedArc = slerpVoiceOrbQuaternion(
      voiceOrbSphereQuaternion,
      voiceOrbRingQuaternion,
      ringBlend,
      buffer.rotationBlendNegated,
      buffer.rotationBlendTangent,
      buffer.rotationBlendUsesExtendedArc,
      voiceOrbBlendedQuaternion
    );
    voiceOrbQuaternionToMatrix(voiceOrbBlendedQuaternion, rotationMatrix);
  }

  for (let index = 0; index < count; index += 1) {
    const particle = particles[index];
    // Outside the idle formation window every particle resolves to
    // baseFormation = 1 and alpha = 1 (sphere/ring frames force them to 1,
    // and finished idle formation evaluates to exactly 1), so the easing
    // math only runs while it can still influence the output.
    let baseFormation = 1;
    let alpha = 1;
    if (idleFormationActive) {
      const formationProgress = Math.min(
        1,
        Math.max(0, (elapsed - particle.delay) / VOICE_ORB_FORMATION_DURATION_S)
      );

      baseFormation = 1 - (1 - formationProgress) ** 3;
      alpha = formationProgress;
    }

    // A spring resting exactly on its target with zero velocity is a fixed
    // point of the integrator (force = 0, position delta = 0), so
    // re-integrating it every frame is wasted work. Particles are pinned to
    // that fixed point once they converge (see the settle snap below) and
    // skipped here until their target moves again.
    const springSettled =
      particle.springX === particle.targetX &&
      particle.springY === particle.targetY &&
      particle.springZ === particle.targetZ &&
      particle.springVelX === 0 &&
      particle.springVelY === 0 &&
      particle.springVelZ === 0;

    if (!springSettled) {
      const springForceX =
        -springStiffness * (particle.springX - particle.targetX) -
        springDamping * particle.springVelX;
      const springVelocityX = particle.springVelX + springForceX * dt;
      particle.springX += springVelocityX * dt;
      particle.springVelX = springVelocityX;

      const springForceY =
        -springStiffness * (particle.springY - particle.targetY) -
        springDamping * particle.springVelY;
      const springVelocityY = particle.springVelY + springForceY * dt;
      particle.springY += springVelocityY * dt;
      particle.springVelY = springVelocityY;

      const springForceZ =
        -springStiffness * (particle.springZ - particle.targetZ) -
        springDamping * particle.springVelZ;
      const springVelocityZ = particle.springVelZ + springForceZ * dt;
      particle.springZ += springVelocityZ * dt;
      particle.springVelZ = springVelocityZ;

      if (applyShellConstraint) {
        constrainParticleToSphereShell(particle, radius * particle.shellOffset);
      }

      if (
        Math.abs(particle.springX - particle.targetX) <
          VOICE_ORB_SPRING_SETTLE_POSITION_EPS &&
        Math.abs(particle.springY - particle.targetY) <
          VOICE_ORB_SPRING_SETTLE_POSITION_EPS &&
        Math.abs(particle.springZ - particle.targetZ) <
          VOICE_ORB_SPRING_SETTLE_POSITION_EPS &&
        Math.abs(particle.springVelX) < VOICE_ORB_SPRING_SETTLE_VELOCITY_EPS &&
        Math.abs(particle.springVelY) < VOICE_ORB_SPRING_SETTLE_VELOCITY_EPS &&
        Math.abs(particle.springVelZ) < VOICE_ORB_SPRING_SETTLE_VELOCITY_EPS
      ) {
        particle.springX = particle.targetX;
        particle.springY = particle.targetY;
        particle.springZ = particle.targetZ;
        particle.springVelX = 0;
        particle.springVelY = 0;
        particle.springVelZ = 0;
      }
    }

    const offsetX = wanderAmount
      ? Math.sin(time * particle.speedX + particle.phaseX) * wanderAmount
      : 0;
    const offsetY = wanderAmount
      ? Math.sin(time * particle.speedY + particle.phaseY) * wanderAmount
      : 0;
    const offsetZ = wanderAmount
      ? Math.sin(time * particle.speedZ + particle.phaseZ) * wanderAmount
      : 0;

    const speakingScale = speakingActive
      ? computeVoiceOrbSpeakingScale(particle, radius, time, audioLevel)
      : 1;
    const wobbleScale =
      1 +
      particle.wobbleAmplitude *
        Math.sin(time * particle.wobbleSpeed + particle.wobblePhase);
    const radialScale = speakingScale * wobbleScale;
    const travelMultiplier = computeVoiceOrbTravelMultiplier(particle, time);
    const pointX =
      (particle.springX * baseFormation + offsetX) *
      radialScale *
      travelMultiplier;
    const pointY =
      (particle.springY * baseFormation + offsetY) *
      radialScale *
      travelMultiplier;
    const pointZ =
      (particle.springZ * baseFormation + offsetZ) *
      radialScale *
      travelMultiplier;
    projectVoiceOrbPointWithMatrix(
      head,
      pointX,
      pointY,
      pointZ,
      rotationMatrix,
      cameraDistance
    );

    // With no pointer force in play and the offset spring exactly at rest,
    // the repulsion pass cannot change the particle or the point, so it is
    // skipped. The pass itself snaps decayed offsets to exactly zero, which
    // is what arms this skip.
    if (
      pointerActive ||
      particle.pointerOffsetX !== 0 ||
      particle.pointerOffsetY !== 0 ||
      particle.pointerVelocityX !== 0 ||
      particle.pointerVelocityY !== 0
    ) {
      applyVoiceOrbPointerRepulsion(particle, head, pointerRepulsion, dt);
    }

    buffer.x[index] = head.x;
    buffer.y[index] = head.y;
    buffer.z[index] = head.z;
    buffer.size[index] = particle.size * head.perspective;
    buffer.alpha[index] = alpha;
    let shadeVariant = particle.shadeVariant;
    if (shadeVariant !== 0 && shadeVariant !== 1) {
      shadeVariant = ((index * 13 + 7) % 2) as 0 | 1;
      particle.shadeVariant = shadeVariant;
    }
    buffer.shadeVariant[index] = shadeVariant;
  }
}

function applyVoiceOrbPointerRepulsion(
  particle: VoiceOrbParticle,
  point: { x: number; y: number },
  pointerRepulsion: VoiceOrbPointerRepulsion | null | undefined,
  dt: number
): void {
  const x = point.x;
  const y = point.y;
  let offsetX = particle.pointerOffsetX ?? 0;
  let offsetY = particle.pointerOffsetY ?? 0;
  let velocityX = particle.pointerVelocityX ?? 0;
  let velocityY = particle.pointerVelocityY ?? 0;

  if (
    pointerRepulsion &&
    pointerRepulsion.radius > 0 &&
    pointerRepulsion.strength > 0.01
  ) {
    const currentX = x + offsetX;
    const currentY = y + offsetY;
    const deltaX = currentX - pointerRepulsion.x;
    const deltaY = currentY - pointerRepulsion.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < pointerRepulsion.radius) {
      const sourceDistance = Math.sqrt(x * x + y * y);
      const directionX =
        distance > 1e-6
          ? deltaX / distance
          : sourceDistance > 1e-6
            ? x / sourceDistance
            : 1;
      const directionY =
        distance > 1e-6
          ? deltaY / distance
          : sourceDistance > 1e-6
            ? y / sourceDistance
            : 0;
      const falloff = 1 - distance / pointerRepulsion.radius;
      const force =
        VOICE_ORB_POINTER_REPEL_FORCE *
        pointerRepulsion.strength *
        falloff *
        falloff;

      velocityX += directionX * force * dt;
      velocityY += directionY * force * dt;
    }
  }

  velocityX +=
    (-offsetX * VOICE_ORB_POINTER_RETURN_STIFFNESS -
      velocityX * VOICE_ORB_POINTER_RETURN_DAMPING) *
    dt;
  velocityY +=
    (-offsetY * VOICE_ORB_POINTER_RETURN_STIFFNESS -
      velocityY * VOICE_ORB_POINTER_RETURN_DAMPING) *
    dt;
  offsetX += velocityX * dt;
  offsetY += velocityY * dt;

  const offsetDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  if (offsetDistance > VOICE_ORB_POINTER_MAX_OFFSET_PX) {
    const scale = VOICE_ORB_POINTER_MAX_OFFSET_PX / offsetDistance;

    offsetX *= scale;
    offsetY *= scale;
    velocityX *= 0.68;
    velocityY *= 0.68;
  }

  if (
    (!pointerRepulsion || pointerRepulsion.strength <= 0.01) &&
    Math.abs(offsetX) < 0.01 &&
    Math.abs(offsetY) < 0.01 &&
    Math.abs(velocityX) < 0.01 &&
    Math.abs(velocityY) < 0.01
  ) {
    offsetX = 0;
    offsetY = 0;
    velocityX = 0;
    velocityY = 0;
  }

  particle.pointerOffsetX = offsetX;
  particle.pointerOffsetY = offsetY;
  particle.pointerVelocityX = velocityX;
  particle.pointerVelocityY = velocityY;

  point.x = x + offsetX;
  point.y = y + offsetY;
}

export function getVoiceOrbColorForMode(
  mode: VoiceOrbMode,
  colors: VoiceOrbColors
): string {
  if (mode === 'thinking') {
    return colors.thinking;
  }

  if (mode === 'listening') {
    return colors.listening;
  }

  if (mode === 'speaking' || mode === 'speaking-progress') {
    return colors.speaking;
  }

  return colors.idle;
}

const voiceOrbColorParseContext =
  typeof document !== 'undefined'
    ? document.createElement('canvas').getContext('2d')
    : null;

export function parseVoiceOrbColor(color: string): VoiceOrbRgbColor {
  const fallback: VoiceOrbRgbColor = { r: 10, g: 10, b: 10 };

  if (!voiceOrbColorParseContext) {
    return fallback;
  }

  voiceOrbColorParseContext.fillStyle = color.trim();
  const normalized = voiceOrbColorParseContext.fillStyle;

  if (!normalized.startsWith('#')) {
    return fallback;
  }

  const hex = normalized.slice(1);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

export function formatVoiceOrbRgbColor(color: VoiceOrbRgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function clampVoiceOrbRgbChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface VoiceOrbHslColor {
  h: number;
  s: number;
  l: number;
}

function rgbToVoiceOrbHsl(color: VoiceOrbRgbColor): VoiceOrbHslColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta > 1e-6) {
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }
  }

  return { h: hue, s: saturation, l: lightness };
}

function voiceOrbHslToRgb(hsl: VoiceOrbHslColor): VoiceOrbRgbColor {
  if (hsl.s <= 1e-6) {
    const gray = clampVoiceOrbRgbChannel(hsl.l * 255);

    return { r: gray, g: gray, b: gray };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let channel = t;
    if (channel < 0) {
      channel += 1;
    }
    if (channel > 1) {
      channel -= 1;
    }
    if (channel < 1 / 6) {
      return p + (q - p) * 6 * channel;
    }
    if (channel < 1 / 2) {
      return q;
    }
    if (channel < 2 / 3) {
      return p + (q - p) * (2 / 3 - channel) * 6;
    }

    return p;
  };

  const q = hsl.l < 0.5 ? hsl.l * (1 + hsl.s) : hsl.l + hsl.s - hsl.l * hsl.s;
  const p = 2 * hsl.l - q;

  return {
    r: clampVoiceOrbRgbChannel(hueToRgb(p, q, hsl.h + 1 / 3) * 255),
    g: clampVoiceOrbRgbChannel(hueToRgb(p, q, hsl.h) * 255),
    b: clampVoiceOrbRgbChannel(hueToRgb(p, q, hsl.h - 1 / 3) * 255)
  };
}

export function deriveVoiceOrbParticleShades(
  base: VoiceOrbRgbColor
): [VoiceOrbRgbColor, VoiceOrbRgbColor] {
  const hsl = rgbToVoiceOrbHsl(base);
  const vividHsl = {
    h: hsl.h,
    s: clamp01(hsl.s + (1 - hsl.s) * VOICE_ORB_PARTICLE_SATURATION_LIFT),
    l: clamp01(hsl.l + VOICE_ORB_PARTICLE_LIGHTNESS_LIFT)
  };

  return [
    voiceOrbHslToRgb(vividHsl),
    voiceOrbHslToRgb({
      h: vividHsl.h,
      s: vividHsl.s,
      l: clamp01(
        Math.min(
          VOICE_ORB_ALT_SHADE_MAX_LIGHTNESS,
          vividHsl.l + VOICE_ORB_ALT_SHADE_LIGHTNESS_LIFT
        )
      )
    })
  ];
}

let voiceOrbShadeCacheKey = -1;
let voiceOrbShadeCache: [string, string] | null = null;

export function formatVoiceOrbParticleShades(
  base: VoiceOrbRgbColor
): [string, string] {
  // Channels are always 0-255 integers here (parse/interpolate round them),
  // so a 24-bit key memoizes the HSL derivation + string formatting that the
  // render loop would otherwise redo every frame for a color that only
  // changes during the short mode-color transition.
  const cacheKey = (base.r << 16) | (base.g << 8) | base.b;
  if (voiceOrbShadeCache && cacheKey === voiceOrbShadeCacheKey) {
    return voiceOrbShadeCache;
  }

  const shades = deriveVoiceOrbParticleShades(base);

  voiceOrbShadeCacheKey = cacheKey;
  voiceOrbShadeCache = [
    formatVoiceOrbRgbColor(shades[0]),
    formatVoiceOrbRgbColor(shades[1])
  ];

  return voiceOrbShadeCache;
}

export function interpolateVoiceOrbRgbColor(
  from: VoiceOrbRgbColor,
  to: VoiceOrbRgbColor,
  progress: number
): VoiceOrbRgbColor {
  const t = Math.min(1, Math.max(0, progress));

  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t)
  };
}

export function easeVoiceOrbColorTransition(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));

  return 1 - (1 - t) ** 3;
}

const VOICE_ORB_MIN_VISIBLE_ALPHA = 0.004;

export function drawVoiceOrbBuffer(options: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  buffer: VoiceOrbRenderBuffer;
  mode: VoiceOrbMode;
  isMobile: boolean;
  shades: [string, string];
  particleSizeScale?: number;
  audioLevel?: number;
}): void {
  const {
    ctx,
    width,
    height,
    buffer,
    mode,
    isMobile,
    shades,
    particleSizeScale = 1
  } = options;

  ctx.clearRect(0, 0, width, height);

  const count = buffer.count;
  if (count <= 0) {
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const maxZ =
    Math.min(width, height) *
    getVoiceOrbParticleRadiusFraction(mode, isMobile) *
    1.08;
  const depthRange = maxZ * 2;

  const isAudioReactiveMode =
    mode === 'listening' || mode === 'speaking' || mode === 'speaking-progress';
  const isRingLayout = isVoiceOrbRingLayoutMode(mode);
  const audioLevel = isAudioReactiveMode
    ? Math.min(1, Math.max(0, options.audioLevel ?? 0))
    : 0;
  const alphaBoost = isAudioReactiveMode
    ? 1.18 + audioLevel * 0.34
    : isRingLayout
      ? 1.62
      : 1.06;
  const sizeBoost = isAudioReactiveMode
    ? 1.04 + audioLevel * 0.45
    : isRingLayout
      ? 1.1
      : 1;

  const bucketCount = buffer.bucketCount;
  bucketCount.fill(0);

  for (let index = 0; index < count; index += 1) {
    const depth = Math.min(
      1.25,
      Math.max(0, (buffer.z[index] + maxZ) / depthRange)
    );
    const alpha = Math.min(
      1,
      (0.1 + 0.9 * depth ** 1.35) * buffer.alpha[index] * alphaBoost
    );
    const size =
      buffer.size[index] * (0.7 + depth * 0.5) * sizeBoost * particleSizeScale;

    if (alpha <= VOICE_ORB_MIN_VISIBLE_ALPHA || size <= 0) {
      buffer.bucket[index] = -1;
      continue;
    }

    let alphaBucket = Math.floor(alpha * VOICE_ORB_ALPHA_BUCKET_COUNT);
    if (alphaBucket >= VOICE_ORB_ALPHA_BUCKET_COUNT) {
      alphaBucket = VOICE_ORB_ALPHA_BUCKET_COUNT - 1;
    }

    const shadeVariant = buffer.shadeVariant[index] & 1;
    const bucket = shadeVariant * VOICE_ORB_ALPHA_BUCKET_COUNT + alphaBucket;

    buffer.bucket[index] = bucket;
    buffer.screenX[index] = centerX + buffer.x[index];
    buffer.screenY[index] = centerY + buffer.y[index];
    buffer.radius[index] = size;
    bucketCount[bucket] += 1;
  }

  const bucketStart = buffer.bucketStart;
  const bucketCursor = buffer.bucketCursor;
  let offset = 0;
  for (let bucket = 0; bucket < VOICE_ORB_DRAW_BUCKET_COUNT; bucket += 1) {
    bucketStart[bucket] = offset;
    bucketCursor[bucket] = offset;
    offset += bucketCount[bucket];
  }
  const visibleCount = offset;

  const order = buffer.order;
  for (let index = 0; index < count; index += 1) {
    const bucket = buffer.bucket[index];
    if (bucket < 0) {
      continue;
    }

    order[bucketCursor[bucket]] = index;
    bucketCursor[bucket] += 1;
  }

  const previousGlobalAlpha = ctx.globalAlpha;

  for (let bucket = 0; bucket < VOICE_ORB_DRAW_BUCKET_COUNT; bucket += 1) {
    const start = bucketStart[bucket];
    const end =
      bucket + 1 < VOICE_ORB_DRAW_BUCKET_COUNT
        ? bucketStart[bucket + 1]
        : visibleCount;
    if (end <= start) {
      continue;
    }

    const shadeVariant = Math.floor(bucket / VOICE_ORB_ALPHA_BUCKET_COUNT);
    const alphaBucket = bucket % VOICE_ORB_ALPHA_BUCKET_COUNT;

    ctx.fillStyle = shades[shadeVariant] ?? shades[0];
    ctx.globalAlpha =
      previousGlobalAlpha *
      ((alphaBucket + 0.5) / VOICE_ORB_ALPHA_BUCKET_COUNT);
    for (let cursor = start; cursor < end; cursor += 1) {
      const index = order[cursor];

      ctx.beginPath();
      ctx.arc(
        buffer.screenX[index],
        buffer.screenY[index],
        buffer.radius[index],
        0,
        TWO_PI
      );
      ctx.fill();
    }
  }

  ctx.globalAlpha = previousGlobalAlpha;
}

export function readVoiceOrbColorsFromDocument(): VoiceOrbColors {
  const styles = getComputedStyle(document.documentElement);
  const primary =
    styles.getPropertyValue('--primary').trim() ||
    VOICE_ORB_PRIMARY_FALLBACK_COLOR;

  return {
    idle: styles.getPropertyValue('--text-primary').trim() || '#0a0a0a',
    thinking: primary,
    listening: primary,
    speaking: primary
  };
}
