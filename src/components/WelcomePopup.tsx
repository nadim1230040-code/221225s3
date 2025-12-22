
import React from 'react';
import { BrainCircuit, Zap, Clock, Wifi, Trophy } from 'lucide-react';

interface Props {
  onStart: () => void;
  isResume: boolean;
  title?: string;
  message?: string;
  footerText?: string;
}

export const WelcomePopup: React.FC<Props> = ({ onStart, isResume, title, message, footerText }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
       <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-[2rem] p-8 text-center shadow-2xl overflow-hidden ring-1 ring-slate-800">
           
           {/* Glowing Background Effect */}
           <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-blue-500/10 blur-3xl rounded-full animate-pulse"></div>
           
           <div className="relative z-10">
               {/* GLOWING LOGO */}
               <div className="w-20 h-20 mx-auto mb-6 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.6)] animate-bounce-slow">
                   <BrainCircuit size={40} className="text-white" />
               </div>
               
               <h2 className="text-3xl font-black text-white mb-1 tracking-tight">NSTA <span className="text-blue-500">AI</span></h2>
               <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Future of Education</p>
               
               {/* FEATURE GRID */}
               <div className="grid grid-cols-2 gap-2 mb-8 text-left">
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                       <Zap className="text-yellow-400 mb-1" size={16} />
                       <h4 className="text-slate-200 font-bold text-[10px] uppercase">AI Powered</h4>
                       <p className="text-slate-500 text-[9px]">Smart Notes & MCQ</p>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                       <Clock className="text-green-400 mb-1" size={16} />
                       <h4 className="text-slate-200 font-bold text-[10px] uppercase">Auto Rewards</h4>
                       <p className="text-slate-500 text-[9px]">Study 1hr = Free Sub</p>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                       <Wifi className="text-blue-400 mb-1" size={16} />
                       <h4 className="text-slate-200 font-bold text-[10px] uppercase">Live Sync</h4>
                       <p className="text-slate-500 text-[9px]">Real-time Updates</p>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                       <Trophy className="text-orange-400 mb-1" size={16} />
                       <h4 className="text-slate-200 font-bold text-[10px] uppercase">Weekly Tests</h4>
                       <p className="text-slate-500 text-[9px]">Compete & Rank Up</p>
                   </div>
               </div>

               <p className="text-slate-400 text-xs leading-relaxed mb-6 font-medium">
                   {message || "Unlock your potential with intelligent tools designed to make learning faster, easier, and more effective."}
               </p>

               <button onClick={onStart} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transform transition active:scale-95 border border-blue-500/20">
                   {isResume ? "Resume Learning 🚀" : "Get Started 🚀"}
               </button>
               
               <div className="mt-6">
                   <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{footerText || "Developed by Nadim Anwar"}</p>
               </div>
           </div>
       </div>
    </div>
  );
};
