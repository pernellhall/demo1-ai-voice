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
  const { connect, disconnect, isConnected, volume } = useLiveAPI(systemInstruction);
  const [timeLeft, setTimeLeft] = useState(5 * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onEndDemo();
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

  const pulseScale = Math.max(1, 1 + (volume * 10));

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
            <button 
              onClick={() => connect()}
              className="relative z-10 bg-white hover:bg-gray-100 text-black px-6 py-4 rounded-xl flex items-center gap-3 shadow-2xl transition-all group"
            >
               <Mic className="w-5 h-5" />
               <span className="font-bold tracking-tight">Connect AI Agent</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
