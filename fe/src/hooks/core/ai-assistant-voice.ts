import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@diwan-be/convex/_generated/api';
import {
  GoogleGenAI,
  type LiveServerMessage,
  Modality,
  type Session,
  ThinkingLevel
} from '@google/genai';
import { useAction } from 'convex/react';
import { toast } from '@/components/ui';
import { GeminiLiveAudioIO } from '@/lib/ai/gemini-live-audio';
import { convexClient } from '@/lib/convex/client';

export type AssistantVoiceStatus =
  'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

const VOICE_SYSTEM_INSTRUCTION = `You are Diwan's voice assistant for a law firm. Reply naturally and briefly in the user's language. You have exactly one application tool, list_cases. Call it directly for every request that needs current case data. You cannot create, update, or delete anything. Never invent case data.`;

export function useAiAssistantVoice() {
  const [status, setStatus] = useState<AssistantVoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<GeminiLiveAudioIO | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const mintLiveToken = useAction(api.aiAssistantActions.mintLiveToken);

  const stop = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    audioRef.current?.close();
    audioRef.current = null;
    if (levelFrameRef.current !== null) {
      cancelAnimationFrame(levelFrameRef.current);
    }
    levelFrameRef.current = null;
    setAudioLevel(0);
    setStatus('idle');
    setTranscript('');
  }, []);

  const handleMessage = useCallback((message: LiveServerMessage) => {
    const audio = audioRef.current;
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        void audio?.playPcm16Base64(part.inlineData.data);
      }
    }
    const inputText = message.serverContent?.inputTranscription?.text?.trim();
    const outputText = message.serverContent?.outputTranscription?.text?.trim();
    if (outputText) {
      setTranscript((current) => `${current}${outputText}`);
    } else if (inputText) {
      setTranscript(inputText);
    }
    if (message.serverContent?.modelTurn) {
      setStatus('speaking');
    } else if (message.serverContent?.turnComplete) {
      setStatus('listening');
    }

    const calls = message.toolCall?.functionCalls ?? [];
    if (calls.length === 0) {
      return;
    }
    setStatus('thinking');
    void (async () => {
      const responses = [];
      for (const call of calls) {
        if (call.name !== 'list_cases') {
          continue;
        }
        const raw =
          call.args && typeof call.args === 'object'
            ? (call.args as Record<string, unknown>)
            : {};
        const result = await convexClient.query(api.aiAssistant.listCasesTool, {
          search: typeof raw.search === 'string' ? raw.search : undefined,
          status:
            typeof raw.status === 'string' ? (raw.status as never) : undefined,
          limit: typeof raw.limit === 'number' ? raw.limit : undefined
        });
        responses.push({
          id: call.id,
          name: 'list_cases',
          response: { cases: result }
        });
      }
      if (responses.length > 0) {
        sessionRef.current?.sendToolResponse({
          functionResponses: responses
        });
      }
    })().catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Voice tool failed')
    );
  }, []);

  const start = useCallback(async () => {
    if (status !== 'idle') {
      stop();
      return;
    }
    setStatus('connecting');
    setTranscript('');
    try {
      const token = await mintLiveToken({});
      const audio = new GeminiLiveAudioIO();
      audioRef.current = audio;
      audio.setPlaybackActivityHandler((playing) =>
        setStatus(playing ? 'speaking' : 'listening')
      );
      const ai = new GoogleGenAI({
        apiKey: token.token,
        apiVersion: 'v1alpha'
      });
      const session = await ai.live.connect({
        model: token.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction: VOICE_SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'list_cases',
                  description:
                    'List legal cases visible to the signed-in user.',
                  parametersJsonSchema: {
                    type: 'object',
                    properties: {
                      search: { type: 'string' },
                      status: {
                        type: 'string',
                        enum: [
                          'intake',
                          'filed',
                          'in_hearings',
                          'verdict',
                          'execution',
                          'closed',
                          'archived'
                        ]
                      },
                      limit: { type: 'number', minimum: 1, maximum: 50 }
                    }
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => setStatus('listening'),
          onmessage: handleMessage,
          onerror: (event) => {
            console.error('Gemini Live error', event.error ?? event);
            toast.error('The voice assistant disconnected.');
            stop();
          },
          onclose: () => stop()
        }
      });
      sessionRef.current = session;
      const stream = await audio.startCapture((data) => {
        sessionRef.current?.sendRealtimeInput({
          audio: { data, mimeType: 'audio/pcm;rate=16000' }
        });
      });
      if (!stream) {
        throw new Error('Microphone access is required for voice mode.');
      }
      audio.setMuted(isMuted);
      const updateLevel = () => {
        const current = audioRef.current;
        if (!current) {
          return;
        }
        setAudioLevel(
          Math.max(current.getInputLevel(), current.getOutputLevel())
        );
        levelFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (error) {
      stop();
      toast.error(
        error instanceof Error
          ? error.message
          : 'Voice assistant could not start'
      );
    }
  }, [handleMessage, isMuted, mintLiveToken, status, stop]);

  const toggleMuted = useCallback(() => {
    setIsMuted((muted) => {
      audioRef.current?.setMuted(!muted);
      return !muted;
    });
  }, []);

  const sendTextMessage = useCallback(
    (message: string) => {
      const prompt = message.trim();
      if (!prompt || !sessionRef.current || status === 'idle') {
        return false;
      }
      sessionRef.current.sendClientContent({
        turns: prompt,
        turnComplete: true
      });
      setTranscript('');
      setStatus('thinking');
      return true;
    },
    [status]
  );

  useEffect(() => stop, [stop]);

  return {
    status,
    transcript,
    isMuted,
    audioLevel,
    isActive: status !== 'idle',
    toggle: start,
    stop,
    toggleMuted,
    sendTextMessage
  };
}
