import {
  type AudioChunkHandler,
  CAPTURE_WORKLET_NAME,
  type CaptureState,
  GEMINI_LIVE_INPUT_AUDIO_MIME_TYPE,
  GEMINI_LIVE_INPUT_SAMPLE_RATE,
  GEMINI_LIVE_OUTPUT_SAMPLE_RATE,
  INPUT_LEVEL_GAIN,
  PLAYBACK_ANALYSER_FFT_SIZE,
  PLAYBACK_ANALYSER_SMOOTHING,
  PLAYBACK_DUCK_RELEASE_MS,
  PLAYBACK_OUTPUT_LEVEL_GAIN,
  type PlaybackActivityHandler,
  type ScriptCaptureState,
  type WorkletCaptureState,
  base64ToBytes,
  bytesToBase64,
  createAudioContext,
  createInputAnalyser,
  downmixAudioBufferToMono,
  float32ToPcm16,
  isWorkletCapture,
  pcm16ToFloat32,
  readAnalyserLevel,
  resampleFloat32
} from '@/lib/ai/gemini-live-audio-utils';
import {
  releaseMicrophoneStream,
  requestMicrophoneStream
} from '@/lib/ai/voice-recording';

export { GEMINI_LIVE_INPUT_AUDIO_MIME_TYPE };

function createCaptureWorkletUrl(): string {
  const source = `
class GeminiLiveCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = ${GEMINI_LIVE_INPUT_SAMPLE_RATE};
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.readPosition = 0;
    this.buffer = new Int16Array(1024);
    this.bufferWriteIndex = 0;
    this.port.postMessage({
      type: 'meta',
      sampleRate,
      targetSampleRate: this.targetSampleRate
    });
  }

  sendAndClearBuffer() {
    if (this.bufferWriteIndex === 0) {
      return;
    }
    this.port.postMessage({
      type: 'chunk',
      data: this.buffer.slice(0, this.bufferWriteIndex).buffer
    });
    this.bufferWriteIndex = 0;
  }

  pushSample(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16Value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.buffer[this.bufferWriteIndex++] = int16Value;
    if (this.bufferWriteIndex >= this.buffer.length) {
      this.sendAndClearBuffer();
    }
  }

  readMonoSample(channels, position) {
    const startIndex = Math.floor(position);
    const endIndex = startIndex + 1;
    const fraction = position - startIndex;
    let mixed = 0;
    let channelCount = 0;

    for (const channel of channels) {
      if (!channel?.length) {
        continue;
      }

      const safeStartIndex = Math.min(channel.length - 1, Math.max(0, startIndex));
      const safeEndIndex = Math.min(channel.length - 1, Math.max(0, endIndex));
      const start = channel[safeStartIndex] ?? 0;
      const end = channel[safeEndIndex] ?? start;
      mixed += start + (end - start) * fraction;
      channelCount += 1;
    }

    return channelCount > 0 ? mixed / channelCount : 0;
  }

  process(inputs) {
    const channels = inputs[0] ?? [];
    const frameLength = channels[0]?.length ?? 0;
    if (!frameLength) {
      return true;
    }

    while (this.readPosition < frameLength) {
      this.pushSample(this.readMonoSample(channels, this.readPosition));
      this.readPosition += this.resampleRatio;
    }

    this.readPosition -= frameLength;

    return true;
  }
}

registerProcessor('${CAPTURE_WORKLET_NAME}', GeminiLiveCaptureProcessor);
`;

  return URL.createObjectURL(
    new Blob([source], { type: 'application/javascript' })
  );
}

// One-shot idle warm-up for the first live-voice start: the first
// AudioContext spins up the browser's audio service and the first
// audioWorklet.addModule compiles the worklet machinery — both otherwise
// land mid orb-morph on the first voice activation. Module compilation
// doesn't need a running context, so the (gesture-less, suspended) context
// is never resumed.
let didWarmCaptureAudioPipeline = false;

export function warmGeminiLiveCaptureAudioPipeline(): void {
  if (didWarmCaptureAudioPipeline || typeof window === 'undefined') {
    return;
  }

  didWarmCaptureAudioPipeline = true;
  const workletUrl = createCaptureWorkletUrl();

  try {
    const context = createAudioContext(GEMINI_LIVE_INPUT_SAMPLE_RATE);
    void context.audioWorklet
      .addModule(workletUrl)
      .catch(() => undefined)
      .then(() => {
        URL.revokeObjectURL(workletUrl);
        void context.close().catch(() => undefined);
      });
  } catch {
    URL.revokeObjectURL(workletUrl);
  }
}

async function startWorkletCapture(
  stream: MediaStream,
  onAudioChunk: AudioChunkHandler
): Promise<WorkletCaptureState | null> {
  const workletUrl = createCaptureWorkletUrl();

  try {
    const context = createAudioContext(GEMINI_LIVE_INPUT_SAMPLE_RATE);
    await context.audioWorklet.addModule(workletUrl);
    await context.resume();

    const source = context.createMediaStreamSource(stream);
    const inputAnalyser = createInputAnalyser(context);
    const inputAnalyserBuffer = new Uint8Array(inputAnalyser.fftSize);
    const worklet = new AudioWorkletNode(context, CAPTURE_WORKLET_NAME);
    worklet.port.onmessage = (
      event: MessageEvent<{
        type?: string;
        data?: ArrayBuffer;
        sampleRate?: number;
        targetSampleRate?: number;
      }>
    ) => {
      const message = event.data;
      if (message?.type === 'meta') {
        return;
      }

      if (message?.type !== 'chunk' || !message.data) {
        return;
      }

      const bytes = new Uint8Array(message.data);
      if (bytes.length > 0) {
        onAudioChunk(bytesToBase64(bytes));
      }
    };

    source.connect(worklet);
    source.connect(inputAnalyser);
    worklet.connect(context.destination);

    return {
      context,
      source,
      worklet,
      inputAnalyser,
      inputAnalyserBuffer,
      stream,
      workletUrl
    };
  } catch {
    URL.revokeObjectURL(workletUrl);

    return null;
  }
}

function startScriptCapture(
  stream: MediaStream,
  onAudioChunk: AudioChunkHandler
): ScriptCaptureState {
  const context = createAudioContext();
  const source = context.createMediaStreamSource(stream);
  const inputAnalyser = createInputAnalyser(context);
  const inputAnalyserBuffer = new Uint8Array(inputAnalyser.fftSize);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const monoInput = downmixAudioBufferToMono(event.inputBuffer);
    const resampled = resampleFloat32(
      monoInput,
      context.sampleRate,
      GEMINI_LIVE_INPUT_SAMPLE_RATE
    );
    const pcm = float32ToPcm16(resampled);
    if (pcm.length > 0) {
      onAudioChunk(bytesToBase64(pcm));
    }
  };

  source.connect(processor);
  source.connect(inputAnalyser);
  processor.connect(silentGain);
  silentGain.connect(context.destination);
  void context.resume().catch(() => undefined);

  return {
    context,
    source,
    processor,
    silentGain,
    inputAnalyser,
    inputAnalyserBuffer,
    stream
  };
}

function teardownCapture(capture: CaptureState): void {
  if (isWorkletCapture(capture)) {
    capture.worklet.port.onmessage = null;
    capture.source.disconnect();
    capture.inputAnalyser.disconnect();
    capture.worklet.disconnect();
    URL.revokeObjectURL(capture.workletUrl);
  } else {
    capture.processor.onaudioprocess = null;
    capture.source.disconnect();
    capture.inputAnalyser.disconnect();
    capture.processor.disconnect();
    capture.silentGain.disconnect();
  }

  releaseMicrophoneStream(capture.stream);
  void capture.context.close().catch(() => undefined);
}

export class GeminiLiveAudioIO {
  private capture: CaptureState | null = null;
  private playbackContext: AudioContext | null = null;
  private playbackContextReadyPromise: Promise<AudioContext> | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private playbackAnalyserBuffer: Uint8Array<ArrayBuffer> | null = null;
  private nextPlaybackTime = 0;
  private activePlaybackSources = 0;
  private muted = false;
  private halfDuplexEnabled = false;
  private playbackDucking = false;
  private duckReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private onPlaybackActivityChange: PlaybackActivityHandler | null = null;

  get stream(): MediaStream | null {
    return this.capture?.stream ?? null;
  }

  get isPlaying(): boolean {
    return this.activePlaybackSources > 0;
  }

  getPlaybackClock(): { currentTime: number; scheduledEnd: number } | null {
    const context = this.playbackContext;
    if (!context || context.state === 'closed') {
      return null;
    }

    return {
      currentTime: context.currentTime,
      scheduledEnd: this.nextPlaybackTime
    };
  }

  getOutputLevel(): number {
    const analyser = this.playbackAnalyser;
    const buffer = this.playbackAnalyserBuffer;
    if (!analyser || !buffer || this.activePlaybackSources === 0) {
      return 0;
    }

    return readAnalyserLevel(analyser, buffer, PLAYBACK_OUTPUT_LEVEL_GAIN);
  }

  getInputLevel(): number {
    const capture = this.capture;
    if (
      !capture ||
      this.muted ||
      (this.halfDuplexEnabled && this.playbackDucking)
    ) {
      return 0;
    }

    return readAnalyserLevel(
      capture.inputAnalyser,
      capture.inputAnalyserBuffer,
      INPUT_LEVEL_GAIN
    );
  }

  setPlaybackActivityHandler(handler: PlaybackActivityHandler | null): void {
    this.onPlaybackActivityChange = handler;
    handler?.(this.isPlaying);
  }

  private setPlaybackActive(isPlaying: boolean): void {
    if (this.onPlaybackActivityChange) {
      this.onPlaybackActivityChange(isPlaying);
    }
  }

  private incrementPlaybackSources(): void {
    const wasPlaying = this.activePlaybackSources > 0;
    this.activePlaybackSources += 1;
    if (!wasPlaying) {
      this.setPlaybackActive(true);
    }
    this.engagePlaybackDuck();
  }

  private decrementPlaybackSources(): void {
    this.activePlaybackSources = Math.max(0, this.activePlaybackSources - 1);
    if (this.activePlaybackSources === 0) {
      this.setPlaybackActive(false);
      this.schedulePlaybackDuckRelease();
    }
  }

  setHalfDuplex(enabled: boolean): void {
    this.halfDuplexEnabled = enabled;
    if (!enabled) {
      this.clearDuckReleaseTimer();
      this.playbackDucking = false;
    }
  }

  private clearDuckReleaseTimer(): void {
    if (this.duckReleaseTimer !== null) {
      clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
  }

  private engagePlaybackDuck(): void {
    if (!this.halfDuplexEnabled) {
      return;
    }

    this.clearDuckReleaseTimer();
    this.playbackDucking = true;
  }

  private schedulePlaybackDuckRelease(): void {
    this.clearDuckReleaseTimer();
    if (!this.halfDuplexEnabled) {
      this.playbackDucking = false;

      return;
    }

    this.duckReleaseTimer = setTimeout(() => {
      this.duckReleaseTimer = null;
      this.playbackDucking = false;
    }, PLAYBACK_DUCK_RELEASE_MS);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;

    for (const track of this.capture?.stream.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  async startCapture(
    onAudioChunk: AudioChunkHandler
  ): Promise<MediaStream | null> {
    this.stopCapture();

    const stream = await requestMicrophoneStream();
    if (!stream) {
      return null;
    }

    const handleChunk: AudioChunkHandler = (base64Pcm16) => {
      if (this.muted || (this.halfDuplexEnabled && this.playbackDucking)) {
        return;
      }

      onAudioChunk(base64Pcm16);
    };

    const workletCapture = await startWorkletCapture(stream, handleChunk);
    this.capture = workletCapture ?? startScriptCapture(stream, handleChunk);
    this.setMuted(this.muted);

    return stream;
  }

  stopCapture(): void {
    const capture = this.capture;
    this.capture = null;
    if (!capture) {
      return;
    }

    teardownCapture(capture);
  }

  clearPlayback(): void {
    this.clearDuckReleaseTimer();
    this.playbackDucking = false;
    this.nextPlaybackTime = 0;
    this.activePlaybackSources = 0;
    this.setPlaybackActive(false);
    const context = this.playbackContext;
    this.playbackContext = null;
    this.playbackContextReadyPromise = null;
    this.playbackAnalyser = null;
    this.playbackAnalyserBuffer = null;
    void context?.close().catch(() => undefined);
  }

  private async ensurePlaybackContextReady(
    sampleRate: number
  ): Promise<AudioContext> {
    if (this.playbackContextReadyPromise) {
      return await this.playbackContextReadyPromise;
    }

    const context = this.playbackContext ?? createAudioContext(sampleRate);
    this.playbackContext = context;

    const readyPromise = (async () => {
      if (context.state !== 'running') {
        await context.resume();
      }

      return context;
    })();
    this.playbackContextReadyPromise = readyPromise;

    try {
      return await readyPromise;
    } catch (error) {
      if (this.playbackContextReadyPromise === readyPromise) {
        this.playbackContextReadyPromise = null;
      }

      throw error;
    }
  }

  private ensurePlaybackAnalyser(context: AudioContext): AnalyserNode {
    if (this.playbackAnalyser) {
      return this.playbackAnalyser;
    }

    const analyser = context.createAnalyser();
    analyser.fftSize = PLAYBACK_ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = PLAYBACK_ANALYSER_SMOOTHING;
    analyser.connect(context.destination);

    this.playbackAnalyser = analyser;
    this.playbackAnalyserBuffer = new Uint8Array(analyser.fftSize);

    return analyser;
  }

  async playPcm16Base64(
    base64: string,
    sampleRate = GEMINI_LIVE_OUTPUT_SAMPLE_RATE
  ): Promise<void> {
    if (!base64) {
      return;
    }

    this.incrementPlaybackSources();
    let didSchedulePlayback = false;

    try {
      const context = await this.ensurePlaybackContextReady(sampleRate);
      if (this.playbackContext !== context || context.state === 'closed') {
        return;
      }

      const samples = pcm16ToFloat32(base64ToBytes(base64));
      if (samples.length === 0) {
        return;
      }

      const buffer = context.createBuffer(1, samples.length, sampleRate);
      const audioSamples = new Float32Array(samples.length);
      audioSamples.set(samples);
      buffer.copyToChannel(audioSamples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ensurePlaybackAnalyser(context));
      source.onended = () => {
        this.decrementPlaybackSources();
      };

      const startAt = Math.max(context.currentTime, this.nextPlaybackTime);
      source.start(startAt);
      this.nextPlaybackTime = startAt + buffer.duration;
      didSchedulePlayback = true;
    } finally {
      if (!didSchedulePlayback) {
        this.decrementPlaybackSources();
      }
    }
  }

  close(): void {
    this.stopCapture();
    this.clearPlayback();
    this.onPlaybackActivityChange = null;
  }
}
