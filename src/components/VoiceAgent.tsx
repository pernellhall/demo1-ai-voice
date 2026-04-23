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

  const pulseScale = Math.max(1, 1 + (volume * 10));

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
      
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
                <button 
                  onClick={() => {
                    disconnect();
                    onEndDemo();
                  }}
                  className="relative z-10 w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center border-2 border-white/20 transition-transform hover:scale-105 group cursor-pointer"
                >
                   <Mic className="text-white w-6 h-6 group-hover:hidden" />
                   <X className="text-white w-6 h-6 hidden group-hover:block" />
                   
                   <span className="absolute -top-10 bg-black/90 text-xs font-bold tracking-wider text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                     End Demo
                   </span>
                </button>
             </>
          ) : (
            <button 
              onClick={() => connect()}
              className="relative z-10 w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] border-2 border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-all group animate-pulse"
            >
               <Mic className="text-white w-6 h-6" />
               <span className="absolute right-20 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap shadow-lg flex items-center gap-2">
                 Tap to Activate AI
                 <span className="absolute -right-1 top-1/2 -translate-y-1/2 border-[6px] border-transparent border-l-blue-600" />
               </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
