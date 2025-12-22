
import React, { useEffect, useState } from 'react';
import { X, Sparkles, Crown } from 'lucide-react';
import { SystemSettings } from '../types';

interface Props {
  settings: SystemSettings;
  onClose: () => void;
}

export const StartupAd: React.FC<Props> = ({ settings, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(settings.startupAd?.duration || 3);

  useEffect(() => {
    if (!settings.startupAd?.enabled) {
        onClose();
        return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.startupAd]);

  if (!settings.startupAd?.enabled) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10"
        style={{ 
            backgroundColor: settings.startupAd.bgColor || '#1e293b', 
            color: settings.startupAd.textColor || '#ffffff' 
        }}
      >
        {/* Glow Effect */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

        <div className="p-8 text-center">
            <div className="mx-auto w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <Crown size={40} className="text-yellow-400 drop-shadow-lg" />
            </div>
            
            <h2 className="text-3xl font-black mb-2 tracking-tight">
                {settings.startupAd.title || "Upgrade to Premium"}
            </h2>
            
            <ul className="text-left space-y-3 my-6 pl-4">
                {(settings.startupAd.features || ["Ad-Free Experience", "Unlimited Notes", "Video Lectures"]).map((feat, i) => (
                    <li key={i} className="flex items-center gap-3 font-bold opacity-90">
                        <Sparkles size={16} className="text-yellow-400" /> {feat}
                    </li>
                ))}
            </ul>

            <button 
                onClick={timeLeft === 0 ? onClose : undefined}
                className={`w-full py-4 rounded-xl font-black text-lg transition-all ${
                    timeLeft === 0 
                    ? 'bg-white text-slate-900 hover:scale-[1.02] shadow-xl cursor-pointer' 
                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                }`}
            >
                {timeLeft > 0 ? `Wait ${timeLeft}s` : 'Continue to App 🚀'}
            </button>
        </div>

        {/* Branding */}
        <div className="bg-black/20 p-3 text-center text-[10px] font-bold uppercase tracking-widest opacity-50">
            NST AI Assistant
        </div>
      </div>
    </div>
  );
};
