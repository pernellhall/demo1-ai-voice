import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveAPI } from '../hooks/useLiveAPI';
import { Mic, MicOff, X } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceAgentProps {
  systemInstruction: string;
  onEndDemo: () => void;
}

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ systemInstruction, onEndDemo }) => {
  const { connect, disconnect, isConnected, volume, error: aiError } = useLiveAPI(systemInstruction);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes demo

  useEffect(() => {
    // DO NOT AUTO-CONNECT! Mobile browsers kill the audio stream if connected programmatically after an async scrape.
    // The user MUST physically tap the agent to unlock the audio engine.
    
    // Connect timeout
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onEndDemo(); // Demo time expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [disconnect, onEndDemo]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Pulse animation based on volume
  const pulseScale = Math.max(1, 1 + (volume * 10)); // Volume usually 0.0 - 0.2

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-4 pointer-events-none">
      
      {/* Timer & Controls */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 pointer-events-auto">
        <div className="text-white text-xs font-mono font-medium tracking-wider">
          DEMO MODE
        </div>
        <div className="text-white/80 text-sm font-mono font-bold">
          {formatTime(timeLeft)}
        </div>
        <button 
          onClick={() => {
            disconnect();
            onEndDemo();
          }}
          className="mt-1 bg-red-500/20 hover:bg-red-500/40 text-red-100 p-2 rounded-full transition-colors flex items-center justify-center group relative cursor-pointer"
        >
           <X className="w-4 h-4" />
           <span className="absolute -top-8 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
             End Demo
           </span>
        </button>
      </div>

      {/* The Agent Avatar / Waveform */}
      <div className="relative pointer-events-auto flex flex-col items-center gap-3">
        {aiError && (
          <div className="bg-red-500/90 text-white text-[10px] px-3 py-1 rounded-lg mb-2 max-w-[150px] text-center backdrop-blur shadow-lg border border-red-400/50">
            {aiError}
          </div>
        )}
        <div className="relative flex items-center justify-center w-24 h-24">
          {isConnected ? (
             <>
                <motion.div
                  animate={{ scale: pulseScale }}
                  transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                  className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl"
                />
                <motion.div
                  animate={{ scale: pulseScale * 0.8 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                  className="absolute inset-2 bg-blue-400/40 rounded-full blur-md"
                />
                <div className="relative z-10 w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center border-2 border-white/20">
                   <Mic className="text-white w-6 h-6 animate-pulse" />
                </div>
             </>
          ) : (
            <div 
              onClick={() => connect()}
              className="relative z-10 w-20 h-20 bg-gradient-to-tr from-green-600 to-emerald-400 rounded-full flex flex-col items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.6)] border-2 border-white/40 cursor-pointer hover:scale-105 transition-all group animate-bounce"
            >
               <Mic className="text-white w-8 h-8" />
               <span className="absolute -top-12 bg-black/90 text-sm font-bold tracking-wider text-white px-4 py-2 rounded-xl whitespace-nowrap shadow-xl border border-white/20">
                 TAP TO START AI
               </span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
