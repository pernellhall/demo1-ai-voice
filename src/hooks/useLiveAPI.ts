import { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export function useLiveAPI(systemInstruction: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null); // holds session promise
  const streamRef = useRef<MediaStream | null>(null);
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio nodes for playing back the raw PCM data from Gemini
  const playQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // For visualizer
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (isConnected) return;
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access. Please try Chrome or Safari.");
      }

      const meta = import.meta as any;
      const processEnv = typeof process !== 'undefined' ? process.env : {};
      const apiKey = (meta.env?.VITE_GEMINI_API_KEY || (processEnv as any).GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY);
      
      const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY_FALLBACK" });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            try {
              await setupAudioCapture(sessionPromise);
            } catch (err: any) {
              setError("Mic access failed. Check permissions.");
              console.error(err);
            }
          },
          onmessage: (message: LiveServerMessage) => {
            try {
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                queueAudioPlayback(base64Audio);
              }
              if (message.serverContent?.interrupted) {
                playQueueRef.current = [];
              }
            } catch (err) {
              console.error("Error processing message", err);
            }
          },
          onclose: () => {
            setIsConnected(false);
            cleanupAudio();
          },
          onerror: (error: any) => {
            console.error('GenAI Live API Error:', error);
            setError("AI Connection Error.");
          }
        }
      });
      sessionRef.current = sessionPromise;
      
    } catch (e: any) {
      console.error("Failed to connect to Live API:", e);
      setError(e?.message || "Unknown Connection Error");
    }
  }, [systemInstruction]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
    }
    cleanupAudio();
    setIsConnected(false);
  }, []);

  const setupAudioCapture = async (sessionPromise: any) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      }
      const ctx = audioContextRef.current;
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsMicrophoneActive(true);

      const source = ctx.createMediaStreamSource(stream);
      // Deprecated but simpler for raw PCM extraction without AudioWorklet. Better for quick demo.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      inputProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isConnected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(rms * 2); // Increased multiplier to make visualizer visible on phone

        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to Base64
        const buffer = new Uint8Array(pcm16.buffer);
        const binary = String.fromCharCode(...buffer);
        const base64Data = btoa(binary);

        sessionPromise.then((session: any) => {
           session.sendRealtimeInput({
             audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
           });
        }).catch(() => {});
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (e: any) {
      console.error("Microphone access denied or error:", e);
      throw e;
    }
  };

  const queueAudioPlayback = async (base64Audio: string) => {
    try {
      // Ensure context is running before decoding buffer
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      playQueueRef.current.push(float32Array);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error("Audio playback queue error", err);
    }
  };

  const playNextAudio = async () => {
    if (!audioContextRef.current) return;
    
    if (playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = playQueueRef.current.shift()!;
    
    const ctx = audioContextRef.current;
    
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = ctx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        playNextAudio();
      };
      source.start();
    } catch (err) {
      console.error("Playback execution error", err);
      isPlayingRef.current = false;
    }
  };

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputProcessorRef.current) {
        inputProcessorRef.current.disconnect();
        inputProcessorRef.current = null;
    }
    setIsMicrophoneActive(false);
  };

  return { connect, disconnect, isConnected, volume, error };
}
