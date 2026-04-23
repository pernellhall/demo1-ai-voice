import { useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export function useLiveAPI(systemInstruction: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const playQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const connect = useCallback(async () => {
    if (isConnected || sessionRef.current) return;

    try {
      const meta = import.meta as any;
      const apiKey = meta.env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY;
      
      if (!apiKey) {
        alert("Missing VITE_GEMINI_API_KEY. Please add it to your environment.");
        return;
      }

      // Initialize AudioContext immediately on user click to satisfy Safari/Chrome requirements
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey });
      
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
            await setupMic(sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              queueAudio(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              playQueueRef.current = []; // flush audio on interrupt
            }
          },
          onclose: () => disconnect(),
          onerror: (error: any) => console.error('Live API Error:', error)
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to connect:", e);
    }
  }, [systemInstruction]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
      sessionRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (inputProcessorRef.current) {
      inputProcessorRef.current.disconnect();
      inputProcessorRef.current = null;
    }
    
    setIsConnected(false);
    playQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const setupMic = async (sessionPromise: any) => {
    try {
      if (!audioContextRef.current) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      inputProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        setVolume(Math.sqrt(sum / inputData.length) * 2);

        // Convert to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to Base64 and send
        const buffer = new Uint8Array(pcm16.buffer);
        const binary = String.fromCharCode(...buffer);
        sessionPromise.then((session: any) => {
           session.sendRealtimeInput({
             audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' }
           });
        }).catch(() => {});
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
    } catch (e) {
      console.error("Mic error:", e);
    }
  };

  const queueAudio = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    const pcm16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768.0;

    playQueueRef.current.push(f32);
    if (!isPlayingRef.current) {
      playNext();
    }
  };

  const playNext = () => {
    if (!audioContextRef.current || playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = playQueueRef.current.shift()!;
    const ctx = audioContextRef.current;
    
    try {
      const buffer = ctx.createBuffer(1, audioData.length, 24000); // API returns 24kHz
      buffer.getChannelData(0).set(audioData);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => playNext();
      source.start();
    } catch (err) {
      console.error("Playback error:", err);
      isPlayingRef.current = false;
    }
  };

  return { connect, disconnect, isConnected, volume };
}
