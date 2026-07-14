export const MAX_AI_ASSISTANT_VOICE_RECORDING_MS = 60 * 1000;

export type VoiceInputEnvironmentBlockReason = 'insecure-context';

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export function getVoiceInputEnvironmentBlockReason(): VoiceInputEnvironmentBlockReason | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!window.isSecureContext) {
    return 'insecure-context';
  }

  return null;
}

// Capture the microphone raw, in normal media mode. The WebRTC voice
// processing chain (echo cancellation in particular) makes the OS treat the
// page like a phone call: it switches to communication mode, routes playback
// to the earpiece/call stream, ducks other audio, and degrades both mic and
// speaker quality. Leaving these off keeps everything in media mode.
const BASE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48_000 },
  sampleSize: { ideal: 16 }
};

const VIRTUAL_MICROPHONE_DEVICE_IDS = new Set(['default', 'communications']);

function stopMediaStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function readPreferredMicrophoneDeviceId(): string {
  return '';
}

function buildAudioConstraints(
  deviceId: string | undefined
): MediaStreamConstraints {
  if (!deviceId) {
    return { audio: { ...BASE_AUDIO_CONSTRAINTS } };
  }

  return {
    audio: { ...BASE_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } }
  };
}

async function openMicrophoneStream(
  mediaDevices: MediaDevices,
  constraintsList: MediaStreamConstraints[]
): Promise<MediaStream | null> {
  let lastError: unknown = null;

  for (const constraints of constraintsList) {
    try {
      return await mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.error('Microphone access failed', lastError);
  }

  return null;
}

export async function requestMicrophoneStream(
  preferredDeviceId?: string
): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const deviceId = preferredDeviceId ?? readPreferredMicrophoneDeviceId();
  const mediaDevices = navigator.mediaDevices;
  if (typeof mediaDevices?.getUserMedia === 'function') {
    const constraintsList: MediaStreamConstraints[] = [];
    if (deviceId) {
      constraintsList.push(buildAudioConstraints(deviceId));
    }
    constraintsList.push(buildAudioConstraints(undefined));

    // Do not fall back to `{ audio: true }`: mobile browsers can interpret that
    // as voice-call capture and route playback through the receiver.
    return await openMicrophoneStream(mediaDevices, constraintsList);
  }

  type LegacyGetUserMedia = (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: Error) => void
  ) => void;

  const legacyNavigator = navigator as Navigator & {
    getUserMedia?: LegacyGetUserMedia;
    webkitGetUserMedia?: LegacyGetUserMedia;
    mozGetUserMedia?: LegacyGetUserMedia;
  };

  const legacyGetUserMedia =
    legacyNavigator.getUserMedia ??
    legacyNavigator.webkitGetUserMedia ??
    legacyNavigator.mozGetUserMedia;

  if (!legacyGetUserMedia) {
    return null;
  }

  return await new Promise<MediaStream | null>((resolve) => {
    legacyGetUserMedia.call(
      navigator,
      { audio: true },
      (stream: MediaStream) => resolve(stream),
      () => resolve(null)
    );
  });
}

export async function enumerateMicrophones(): Promise<MicrophoneDevice[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
      .filter(
        (device) =>
          device.kind === 'audioinput' &&
          !!device.deviceId &&
          !VIRTUAL_MICROPHONE_DEVICE_IDS.has(device.deviceId)
      )
      .map((device) => ({ deviceId: device.deviceId, label: device.label }));
  } catch (error) {
    console.error('Could not enumerate microphones', error);

    return [];
  }
}

export function releaseMicrophoneStream(stream: MediaStream | null): void {
  if (stream) {
    stopMediaStream(stream);
  }
}
