import {
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  ThinkingLevel,
} from "@google/genai";

export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const MAX_TOKEN_TTL_MS = 19.5 * 60 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 19 * 60 * 60 * 1000;

export interface GeminiLiveClientToken {
  token: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  model: string;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function buildGeminiLiveConnectConfig() {
  return {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        silenceDurationMs: 800,
        prefixPaddingMs: 300,
      },
    },
    thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    temperature: 0.5,
  };
}

export async function createGeminiLiveClientToken(options: {
  apiKey: string;
  model?: string;
  sessionTtlMs?: string;
  newSessionTtlMs?: string;
  uses?: string;
}): Promise<GeminiLiveClientToken> {
  const now = Date.now();
  const sessionTtlMs = Math.min(
    MAX_TOKEN_TTL_MS,
    readNumber(options.sessionTtlMs, DEFAULT_TOKEN_TTL_MS),
  );
  const newSessionTtlMs = Math.min(
    MAX_TOKEN_TTL_MS,
    readNumber(options.newSessionTtlMs, DEFAULT_TOKEN_TTL_MS),
  );
  const uses = Math.floor(readNumber(options.uses, 0));
  const expiresAt = new Date(now + sessionTtlMs).toISOString();
  const newSessionExpiresAt = new Date(now + newSessionTtlMs).toISOString();
  const model = options.model?.trim() || DEFAULT_GEMINI_LIVE_MODEL;
  const ai = new GoogleGenAI({ apiKey: options.apiKey, apiVersion: "v1alpha" });
  const token = await ai.authTokens.create({
    config: {
      uses,
      expireTime: expiresAt,
      newSessionExpireTime: newSessionExpiresAt,
      liveConnectConstraints: {
        model,
        config: buildGeminiLiveConnectConfig(),
      },
      lockAdditionalFields: [],
    },
  });
  if (!token.name)
    throw new Error("Gemini did not return a Live session token.");
  return { token: token.name, expiresAt, newSessionExpiresAt, model };
}
