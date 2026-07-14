export const VOICE_WAVEFORM_BADGE_BAR_INTERVAL_MS = 18;
const VOICE_WAVEFORM_BADGE_TRACK_WIDTH_PX = 96;
const VOICE_WAVEFORM_BADGE_BAR_WIDTH_PX = 2;
const VOICE_WAVEFORM_BADGE_BAR_GAP_PX = 1;

export const VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX = 4;
const VOICE_WAVEFORM_BADGE_SPEAKING_MIN_HEIGHT_PX = 3;
const VOICE_WAVEFORM_BADGE_SPEAKING_MAX_HEIGHT_PX = 7;
export const VOICE_WAVEFORM_BADGE_MAX_BARS = 52;

function getBadgeWaveformVisibleCommittedBarCount(): number {
  const stride =
    VOICE_WAVEFORM_BADGE_BAR_WIDTH_PX + VOICE_WAVEFORM_BADGE_BAR_GAP_PX;
  const trailingSlots =
    2 * VOICE_WAVEFORM_BADGE_BAR_WIDTH_PX + VOICE_WAVEFORM_BADGE_BAR_GAP_PX;
  const available = VOICE_WAVEFORM_BADGE_TRACK_WIDTH_PX - trailingSlots;

  return Math.max(
    1,
    Math.floor((available + VOICE_WAVEFORM_BADGE_BAR_GAP_PX) / stride)
  );
}

export const VOICE_WAVEFORM_BADGE_INITIAL_BAR_COUNT =
  getBadgeWaveformVisibleCommittedBarCount();

const VOICE_WAVEFORM_ACTIVITY_THRESHOLD = 0.06;

const VOICE_AMPLITUDE_NOISE_FLOOR = 0.006;
const VOICE_AMPLITUDE_GAIN = 6;
const VOICE_AMPLITUDE_CURVE_EXPONENT = 0.38;

function normalizeVoiceAmplitude(raw: number): number {
  const boosted = Math.min(1, Math.max(0, raw) * VOICE_AMPLITUDE_GAIN);
  const aboveFloor = Math.max(0, boosted - VOICE_AMPLITUDE_NOISE_FLOOR);
  const normalized = aboveFloor / (1 - VOICE_AMPLITUDE_NOISE_FLOOR);

  return Math.min(1, normalized ** VOICE_AMPLITUDE_CURVE_EXPONENT);
}

export function isVoiceWaveformActive(amplitude: number): boolean {
  return amplitude >= VOICE_WAVEFORM_ACTIVITY_THRESHOLD;
}

export function getIdleVoiceAmplitude(): number {
  return 0;
}

export function getBadgeWaveformSeedBarHeight(): number {
  return VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX;
}

export function scrollBadgeWaveformToEnd(container: HTMLElement): void {
  container.scrollLeft = Math.max(
    0,
    container.scrollWidth - container.clientWidth
  );
}

export function amplitudeToBadgeVoiceWaveformBarHeight(
  amplitude: number
): number {
  if (!isVoiceWaveformActive(amplitude)) {
    return VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX;
  }

  const clamped = Math.max(0, Math.min(1, amplitude));

  return Math.round(
    VOICE_WAVEFORM_BADGE_SPEAKING_MIN_HEIGHT_PX +
      clamped *
        (VOICE_WAVEFORM_BADGE_SPEAKING_MAX_HEIGHT_PX -
          VOICE_WAVEFORM_BADGE_SPEAKING_MIN_HEIGHT_PX)
  );
}

export function computeVoiceAmplitudeFromAnalyser(
  analyser: AnalyserNode,
  timeDomainBuffer: Uint8Array<ArrayBuffer>
): number {
  analyser.getByteTimeDomainData(timeDomainBuffer);

  let sumSquares = 0;
  let peak = 0;

  for (let index = 0; index < timeDomainBuffer.length; index += 1) {
    const centered = (timeDomainBuffer[index] ?? 128) - 128;
    const magnitude = Math.abs(centered);
    peak = Math.max(peak, magnitude);
    sumSquares += centered * centered;
  }

  const rms =
    timeDomainBuffer.length > 0
      ? Math.sqrt(sumSquares / timeDomainBuffer.length) / 128
      : 0;
  const peakLevel = peak / 128;

  return normalizeVoiceAmplitude(Math.max(rms, peakLevel));
}

export function computeVoiceWaveformCommitHeight(
  analyser: AnalyserNode,
  timeDomainBuffer: Uint8Array<ArrayBuffer>,
  frequencyBuffer: Uint8Array<ArrayBuffer>,
  sliceIndex: number
): number {
  const overall = computeVoiceAmplitudeFromAnalyser(analyser, timeDomainBuffer);

  if (!isVoiceWaveformActive(overall)) {
    return VOICE_WAVEFORM_BADGE_RESTING_BAR_HEIGHT_PX;
  }

  analyser.getByteFrequencyData(frequencyBuffer);

  const sliceWidth = 4;
  const sliceStart = 2 + (sliceIndex % 14) * sliceWidth;
  const sliceEnd = Math.min(sliceStart + sliceWidth, frequencyBuffer.length);
  let sliceSum = 0;

  for (let index = sliceStart; index < sliceEnd; index += 1) {
    sliceSum += frequencyBuffer[index] ?? 0;
  }

  const sliceAverage =
    sliceEnd > sliceStart ? sliceSum / (sliceEnd - sliceStart) / 255 : 0;
  const sliceLevel = normalizeVoiceAmplitude(sliceAverage);
  const combined = Math.min(
    1,
    Math.max(overall, sliceLevel * 0.85 + overall * 0.15)
  );

  return amplitudeToBadgeVoiceWaveformBarHeight(combined);
}
