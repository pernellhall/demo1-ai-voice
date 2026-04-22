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

  const connect = useCallback(async () => {
    if (isConnected) return;

    try {
      const meta = import.meta as any;
      const apiKey = meta.env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY; 
      
      const windowProcess = (window as any).process;
      const ai = new GoogleGenAI({ apiKey: windowProcess?.env?.GEMINI_API_KEY || meta.env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY });
      
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
            await setupAudioCapture(sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              queueAudioPlayback(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              playQueueRef.current = [];
            }
          },
          onclose: () => {
            setIsConnected(false);
            cleanupAudio();
          },
          onerror: (error: any) => {
            console.error('GenAI Live API Error:', error);
          }
        }
      });
      sessionRef.current = sessionPromise;
      
    } catch (e) {
      console.error("Failed to connect to Live API:", e);
    }
  }, [systemInstruction]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close());
    }
    cleanupAudio();
    setIsConnected(false);
  }, []);

  const setupAudioCapture = async (sessionPromise: any) => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
    }
    const ctx = audioContextRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsMicrophoneActive(true);

      const source = ctx.createMediaStreamSource(stream);
      // Deprecated but simpler for raw PCM extraction without AudioWorklet. Better for quick demo.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      inputProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(rms);

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
        });
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (e) {
      console.error("Microphone access denied or error:", e);
    }
  };

  const queueAudioPlayback = (base64Audio: string) => {
    // Decode base64 to Float32Array PCM
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
  };

  const playNextAudio = () => {
    if (!audioContextRef.current) return;
    
    // We receive 24kHz audio from Gemini Live
    if (audioContextRef.current.sampleRate !== 24000) {
        // Just creating a context specifically for output if needed, but modern browsers usually handle Float32 buffer play via simple buffer creation well.
    }
    
    if (playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = playQueueRef.current.shift()!;
    
    const ctx = audioContextRef.current;
    
    // Create output context if needed to match 24kHz
    if (!outputProcessorRef.current) {
         // Create a dedicated playback context if not created yet or use existing
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

  return { connect, disconnect, isConnected, volume };
}
