export const GEMINI_LIVE_INPUT_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
export const GEMINI_LIVE_INPUT_SAMPLE_RATE = 16_000;
export const GEMINI_LIVE_OUTPUT_SAMPLE_RATE = 24_000;
export const CAPTURE_WORKLET_NAME = 'gemini-live-capture-processor';
export const PLAYBACK_ANALYSER_FFT_SIZE = 256;
export const PLAYBACK_ANALYSER_SMOOTHING = 0.6;
export const PLAYBACK_OUTPUT_LEVEL_GAIN = 3.4;
const INPUT_ANALYSER_FFT_SIZE = PLAYBACK_ANALYSER_FFT_SIZE;
const INPUT_ANALYSER_SMOOTHING = PLAYBACK_ANALYSER_SMOOTHING;
export const INPUT_LEVEL_GAIN = PLAYBACK_OUTPUT_LEVEL_GAIN;
export const PLAYBACK_DUCK_RELEASE_MS = 250;

export type AudioChunkHandler = (base64Pcm16: string) => void;
export type PlaybackActivityHandler = (isPlaying: boolean) => void;

export interface WorkletCaptureState {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  worklet: AudioWorkletNode;
  inputAnalyser: AnalyserNode;
  inputAnalyserBuffer: Uint8Array<ArrayBuffer>;
  stream: MediaStream;
  workletUrl: string;
}

export interface ScriptCaptureState {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  inputAnalyser: AnalyserNode;
  inputAnalyserBuffer: Uint8Array<ArrayBuffer>;
  stream: MediaStream;
}

export type CaptureState = WorkletCaptureState | ScriptCaptureState;

export function isWorkletCapture(
  capture: CaptureState
): capture is WorkletCaptureState {
  return 'worklet' in capture;
}

function clampSample(sample: number): number {
  return Math.max(-1, Math.min(1, sample));
}

export function resampleFloat32(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) return input;

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const startIndex = Math.min(input.length - 1, Math.floor(position));
    const endIndex = Math.min(input.length - 1, startIndex + 1);
    const fraction = position - startIndex;
    const start = input[startIndex] ?? 0;
    const end = input[endIndex] ?? start;
    output[index] = start + (end - start) * fraction;
  }

  return output;
}

export function downmixAudioBufferToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels <= 1) return buffer.getChannelData(0);

  const output = new Float32Array(buffer.length);
  for (
    let channelIndex = 0;
    channelIndex < buffer.numberOfChannels;
    channelIndex += 1
  ) {
    const channel = buffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
      output[sampleIndex] =
        (output[sampleIndex] ?? 0) + (channel[sampleIndex] ?? 0);
    }
  }

  for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
    output[sampleIndex] = (output[sampleIndex] ?? 0) / buffer.numberOfChannels;
  }
  return output;
}

export function float32ToPcm16(input: Float32Array): Uint8Array {
  const output = new Uint8Array(input.length * 2);
  const view = new DataView(output.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = clampSample(input[index] ?? 0);
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(index * 2, pcm, true);
  }
  return output;
}

export function pcm16ToFloat32(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Float32Array(
    Math.floor(bytes.byteLength / 2)
  ) as Float32Array<ArrayBuffer>;
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000;
  }
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function createAudioContext(sampleRate?: number): AudioContext {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error('WebAudio is not available in this browser.');
  }
  return new AudioContextConstructor(sampleRate ? { sampleRate } : undefined);
}

export function createInputAnalyser(context: AudioContext): AnalyserNode {
  const analyser = context.createAnalyser();
  analyser.fftSize = INPUT_ANALYSER_FFT_SIZE;
  analyser.smoothingTimeConstant = INPUT_ANALYSER_SMOOTHING;
  return analyser;
}

export function readAnalyserLevel(
  analyser: AnalyserNode,
  buffer: Uint8Array<ArrayBuffer>,
  gain: number
): number {
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = ((buffer[index] ?? 128) - 128) / 128;
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  return Math.min(1, rms * gain);
}
