
import React, { useState, useEffect } from 'react';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest } from '../types';
import { updateUserStatus, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getSubjectsList } from '../constants';
import { isSubscriptionActive, getDaysRemaining } from '../utils/subscriptionUtils';
import { RedeemSection } from '../components/RedeemSection';
import { Store } from '../components/Store';
import { Zap, Crown, Calendar, Clock, History, Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight } from 'lucide-react';
import { SubjectSelection } from '../components/SubjectSelection';
import { HistoryPage } from './HistoryPage';
import { UniversalChat } from '../components/UniversalChat';
import { SpinWheel } from '../components/SpinWheel';
import { Leaderboard } from '../components/Leaderboard';

interface Props {
  user: User;
  dailyStudySeconds: number; // Received from Global App
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings; // New prop
  onStartWeeklyTest?: (test: WeeklyTest) => void;
}

const DEFAULT_PACKAGES: CreditPackage[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `pkg-${i+1}`,
    name: `Pack ${i+1}`,
    credits: (i + 1) * 10,
    price: (i + 1) * 20
}));

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest }) => {
  const [activeTab, setActiveTab] = useState<StudentTab | 'LEADERBOARD' | 'STORE'>('ROUTINE');
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const globalMessage = localStorage.getItem('nst_global_message');
  
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      dailyGoalHours: 3 // Default
  });

  const [canClaimReward, setCanClaimReward] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  
  // Custom Daily Target Logic
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  const REWARD_AMOUNT = settings?.dailyReward || 3;
  
  // Phone setup
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  const defaultPhoneId = adminPhones.find(p => p.isDefault)?.id || adminPhones[0]?.id || 'default';
  
  if (!selectedPhoneId && adminPhones.length > 0) {
    setSelectedPhoneId(defaultPhoneId);
  }
  
  const getPhoneNumber = (phoneId?: string) => {
    const phone = adminPhones.find(p => p.id === (phoneId || selectedPhoneId));
    return phone ? phone.number : '8227070298';
  };

  useEffect(() => {
      // Load user's custom goal
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  const [showRewardModal, setShowRewardModal] = useState<{tier: any, hours: number} | null>(null);

  // --- CHECK YESTERDAY'S REWARD ON LOAD ---
  useEffect(() => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();
      
      const yActivity = parseInt(localStorage.getItem(`activity_${user.id}_${yDateStr}`) || '0');
      const yClaimed = localStorage.getItem(`reward_claimed_${user.id}_${yDateStr}`);
      
      if (!yClaimed && (!user.subscriptionTier || user.subscriptionTier === 'FREE')) {
          if (yActivity >= 7200) setShowRewardModal({ tier: 'MONTHLY', hours: 8 }); // 2 Hrs -> Ultra
          else if (yActivity >= 3600) setShowRewardModal({ tier: 'WEEKLY', hours: 8 }); // 1 Hr -> Basic
      }
  }, [user.id]);

  const claimYesterdayReward = () => {
      if (!showRewardModal) return;
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();

      const endDate = new Date(Date.now() + showRewardModal.hours * 60 * 60 * 1000).toISOString();
      const updatedUser = { 
          ...user, 
          subscriptionTier: showRewardModal.tier, 
          subscriptionEndDate: endDate,
          isPremium: true
      };
      
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const idx = storedUsers.findIndex((u:User) => u.id === user.id);
      if (idx !== -1) storedUsers[idx] = updatedUser;
      
      localStorage.setItem('nst_users', JSON.stringify(storedUsers));
      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      localStorage.setItem(`reward_claimed_${user.id}_${yDateStr}`, 'true'); 
      
      onRedeemSuccess(updatedUser);
      setShowRewardModal(null);
      alert("✅ Reward Claimed! Enjoy 8 hours of premium access.");
  };

  // --- TRACK TODAY'S ACTIVITY & FIRST DAY BONUSES ---
  // --- REAL-TIME SUBSCRIPTION SYNC ---
  useEffect(() => {
    if (!user.id) return;
    
    // Listen to MY user document in Firestore
    const unsub = onSnapshot(doc(db, "users", user.id), (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as User;
            // If subscription or credits changed in cloud, update local state immediately
            if (cloudData.credits !== user.credits || 
                cloudData.subscriptionTier !== user.subscriptionTier ||
                cloudData.isPremium !== user.isPremium ||
                cloudData.isGameBanned !== user.isGameBanned) {
                
                // Merge cloud data with local user object
                const updated = { ...user, ...cloudData };
                onRedeemSuccess(updated); // Propagate to App.tsx
            }
        }
    });
    return () => unsub();
  }, [user.id]); // Only re-subscribe if ID changes (rare)

  useEffect(() => {
      const interval = setInterval(() => {
          updateUserStatus(user.id, dailyStudySeconds);
          
          // Save Daily Stats for Next Day Logic
          const todayStr = new Date().toDateString();
          localStorage.setItem(`activity_${user.id}_${todayStr}`, dailyStudySeconds.toString());
          
          // FIRST DAY SPECIAL BONUS: 1 Hour Usage -> 1 Hour Ultra
          const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
          const firstDayBonusClaimed = localStorage.getItem(`first_day_ultra_${user.id}`);
          
          if (accountAgeHours < 24 && dailyStudySeconds >= 3600 && !firstDayBonusClaimed) {
              const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Hour
              const updatedUser = { 
                  ...user, 
                  subscriptionTier: 'MONTHLY', // Ultra
                  subscriptionEndDate: endDate,
                  isPremium: true
              };
              
              // Save
              const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
              const idx = storedUsers.findIndex((u:User) => u.id === user.id);
              if (idx !== -1) storedUsers[idx] = updatedUser;
              
              localStorage.setItem('nst_users', JSON.stringify(storedUsers));
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              localStorage.setItem(`first_day_ultra_${user.id}`, 'true');
              
              onRedeemSuccess(updatedUser);
              alert("🎉 FIRST DAY BONUS: You unlocked 1 Hour Free ULTRA Subscription!");
          }
          
      }, 60000); 
      return () => clearInterval(interval);
  }, [dailyStudySeconds, user.id, user.createdAt]);

  // Inbox
  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  // CONSTANTS FOR PAYMENT
  const packages = settings?.packages || DEFAULT_PACKAGES;

  useEffect(() => {
    // Check if reward already claimed today
    const today = new Date().toDateString();
    const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';
    setCanClaimReward(lastClaim !== today && dailyStudySeconds >= dailyTargetSeconds);
  }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;
      const updatedUser = {
          ...user,
          credits: (user.credits || 0) + REWARD_AMOUNT,
          lastRewardClaimDate: new Date().toISOString()
      };
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      }
      setCanClaimReward(false);
      onRedeemSuccess(updatedUser);
      alert(`🎉 Congratulations! You met your Daily Goal.\n\nReceived: ${REWARD_AMOUNT} Free Credits!`);
  };

  const handleBuyPackage = (pkg: CreditPackage) => {
      const phoneNum = getPhoneNumber();
      const message = `Hello Admin, I want to buy credits.\n\n🆔 User ID: ${user.id}\n📦 Package: ${pkg.name}\n💰 Amount: ₹${pkg.price}\n💎 Credits: ${pkg.credits}\n\nPlease check my payment.`;
      const url = `https://wa.me/91${phoneNum}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveProfile = () => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      
      const updatedUser = { 
          ...user, 
          board: profileData.board,
          classLevel: profileData.classLevel,
          stream: profileData.stream,
          password: profileData.newPassword.trim() ? profileData.newPassword : user.password
      };

      // Save Goal
      localStorage.setItem(`nst_goal_${user.id}`, profileData.dailyGoalHours.toString());
      setDailyTargetSeconds(profileData.dailyGoalHours * 3600);

      const userIdx = storedUsers.findIndex((u:User) => u.id === user.id);
      if(userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          window.location.reload(); 
      }
      setEditMode(false);
  };
  
  const handleUserUpdate = (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          onRedeemSuccess(updatedUser); 
      }
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  const RoutineView = () => {
    const subjects = getSubjectsList(user.classLevel || '10', user.stream || null);
    const targetHours = dailyTargetSeconds / 3600;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-[var(--primary)]" /> Routine
                    </h3>
                    <p className="text-xs text-slate-500">Tap a subject to start learning</p>
                </div>
                <button 
                    onClick={() => setEditMode(true)}
                    className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-slate-200 border border-slate-200"
                >
                    <Settings size={14} /> Class & Goal
                </button>
            </div>

            <div className="bg-slate-900 rounded-2xl p-5 text-white mb-8 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                             <Timer size={14} /> Active Study Timer
                        </div>
                        <div className="text-4xl font-mono font-bold tracking-wider text-green-400">
                            {formatTime(dailyStudySeconds)}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Goal: {targetHours} Hours/Day</p>
                    </div>
                    <div className="flex gap-2">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center ${dailyStudySeconds > 0 ? 'bg-slate-800 animate-pulse' : 'bg-slate-800'}`}>
                             <div className={`w-3 h-3 rounded-full ${dailyStudySeconds > 0 ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                         </div>
                    </div>
                </div>
                <div className="mt-4 relative z-10">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.floor((Math.min(dailyStudySeconds, dailyTargetSeconds) / dailyTargetSeconds) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-1000" style={{ width: `${Math.min((dailyStudySeconds / dailyTargetSeconds) * 100, 100)}%` }}></div>
                    </div>
                </div>
                {canClaimReward && (
                    <button onClick={claimDailyReward} className="mt-4 w-full py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold rounded-lg shadow-lg animate-pulse text-xs flex items-center justify-center gap-2">
                        <Crown size={14} /> CLAIM REWARD
                    </button>
                )}
                
                {/* REWARD PROGRESS */}
                {(!user.subscriptionTier || user.subscriptionTier === 'FREE') && (
                    <div className="mt-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                            <Gift size={12} className="text-pink-500" /> Free Subscription Progress
                        </p>
                        <div className="flex gap-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="bg-pink-500 transition-all duration-1000" style={{ width: `${Math.min((dailyStudySeconds / 3600) * 100, 100)}%` }}></div>
                            <div className="bg-purple-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(((dailyStudySeconds - 3600) / 3600) * 100, 100))}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-bold">
                            <span>1 Hr (Basic)</span>
                            <span>2 Hr (Ultra)</span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="space-y-3">
                {subjects.map((subj, idx) => {
                    const progress = user.progress?.[subj.id] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
                    // Simply showing index as placeholder routine
                    const startHour = 8 + idx; 
                    const timeSlot = `${startHour}:00 - ${startHour + 1}:00`;
                    return (
                        <div key={idx} onClick={() => onSubjectSelect(subj)} className="p-4 rounded-xl border bg-white border-slate-200 hover:border-[var(--primary)] hover:shadow-md flex items-center gap-4 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="w-16 text-center opacity-60"><div className="font-bold text-slate-800">{timeSlot.split('-')[0]}</div></div>
                            <div className={`h-10 w-1 ${subj.color.split(' ')[0]} rounded-full`}></div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg text-slate-800">{subj.name}</h4>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><BookOpen size={12} /> Ch: {progress.currentChapterIndex + 1}</span>
                                    <span className={`flex items-center gap-1 font-bold ${progress.totalMCQsSolved < 100 ? 'text-orange-500' : 'text-green-600'}`}>MCQs: {progress.totalMCQsSolved}/100</span>
                                </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-full group-hover:bg-[var(--primary)] text-slate-300 group-hover:text-white transition-colors"><Clock size={20} /></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const isGameEnabled = settings?.isGameEnabled ?? true;

  return (
    <div>
        {/* TOP MARQUEE (ANNOUNCEMENTS) */}
        {settings?.marqueeLines && settings.marqueeLines.length > 0 && (
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white text-xs font-medium py-2 px-4 mb-4 rounded-xl overflow-hidden relative shadow-md border border-slate-700">
                <div className="whitespace-nowrap animate-marquee">
                    {settings.marqueeLines.map((line, i) => (
                        <span key={i} className="mx-8 inline-flex items-center gap-2">
                            <Zap size={10} className="text-yellow-400" /> {line}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {/* Profile Edit Modal */}
        {editMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <h3 className="font-bold text-lg mb-4">Edit Profile & Settings</h3>
                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Daily Study Goal (Hours)</label>
                            <input 
                                type="number" 
                                value={profileData.dailyGoalHours}
                                onChange={e => setProfileData({...profileData, dailyGoalHours: Number(e.target.value)})}
                                className="w-full p-2 border rounded-lg"
                                min={1} max={12}
                            />
                        </div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">New Password</label>
                            <input 
                                type="text" 
                                placeholder="Set new password (optional)" 
                                value={profileData.newPassword}
                                onChange={e => setProfileData({...profileData, newPassword: e.target.value})}
                                className="w-full p-2 border rounded-lg bg-yellow-50 border-yellow-200"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Leave blank to keep current password.</p>
                        </div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Board</label>
                            <select value={profileData.board} onChange={e => setProfileData({...profileData, board: e.target.value as any})} className="w-full p-2 border rounded-lg">
                                <option value="CBSE">CBSE</option>
                                <option value="BSEB">BSEB</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Class</label>
                            <select value={profileData.classLevel} onChange={e => setProfileData({...profileData, classLevel: e.target.value as any})} className="w-full p-2 border rounded-lg">
                                {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {['11','12'].includes(profileData.classLevel) && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Stream</label>
                                <select value={profileData.stream} onChange={e => setProfileData({...profileData, stream: e.target.value as any})} className="w-full p-2 border rounded-lg">
                                    <option value="Science">Science</option>
                                    <option value="Commerce">Commerce</option>
                                    <option value="Arts">Arts</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setEditMode(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                        <button onClick={saveProfile} className="flex-1 py-2 bg-[var(--primary)] text-white rounded-lg font-bold">Save Changes</button>
                    </div>
                </div>
            </div>
        )}

        {/* INBOX MODAL */}
        {showInbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-[var(--primary)]" /> Admin Messages</h3>
                        <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                        {(!user.inbox || user.inbox.length === 0) && (
                            <p className="text-slate-400 text-sm text-center py-8">No messages from Admin.</p>
                        )}
                        {user.inbox?.map(msg => (
                            <div key={msg.id} className={`p-3 rounded-xl border text-sm ${msg.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                                <p className="text-slate-700 leading-relaxed">{msg.text}</p>
                                <p className="text-slate-400 text-[10px] mt-2 text-right">{new Date(msg.date).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markInboxRead} className="w-full py-3 bg-[var(--primary)] text-white font-bold text-sm hover:opacity-90">Mark All as Read</button>
                    )}
                </div>
            </div>
        )}

        {/* REWARD CLAIM MODAL */}
        {showRewardModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in">
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8 rounded-3xl w-full max-w-sm text-center border border-white/20 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
                    <div className="relative z-10">
                        <Gift size={64} className="mx-auto mb-4 text-yellow-400 animate-bounce" />
                        <h2 className="text-2xl font-black mb-2">Reward Unlocked!</h2>
                        <p className="text-purple-200 text-sm mb-6">
                            You studied hard yesterday! 
                            <br/>
                            <span className="text-yellow-300 font-bold block mt-2 text-lg">
                                {showRewardModal.tier === 'MONTHLY' ? 'ULTRA PACK (8 Hours)' : 'LITE PACK (8 Hours)'}
                            </span>
                        </p>
                        <button onClick={claimYesterdayReward} className="w-full py-4 bg-yellow-400 text-purple-900 font-black rounded-xl shadow-lg hover:bg-yellow-300 transform transition active:scale-95">
                            CLAIM NOW 🚀
                        </button>
                    </div>
                </div>
            </div>
        )}

        {globalMessage && (
            <div className="bg-[var(--primary)] text-white p-3 rounded-xl mb-6 flex items-start gap-3 shadow-lg animate-pulse">
                <Megaphone size={20} className="shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Admin Announcement</p>
                    <p className="font-medium text-sm">{globalMessage}</p>
                </div>
            </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-6 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full text-orange-600"><Zap size={20} fill="currentColor" /></div>
                <div><h3 className="text-lg font-black text-slate-800">{user.streak} Days</h3><p className="text-[10px] text-slate-500 uppercase font-bold">Streak</p></div>
            </div>
            <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Crown size={20} fill="currentColor" /></div>
                <div><h3 className="text-lg font-black text-slate-800">{user.credits} Cr</h3><p className="text-[10px] text-slate-500 uppercase font-bold">Credits</p></div>
            </div>
            <div className="relative cursor-pointer" onClick={() => setShowInbox(true)}>
                <div className="bg-slate-100 p-2 rounded-full text-slate-600 hover:bg-blue-50 hover:text-[var(--primary)] transition-colors"><Mail size={20} /></div>
                {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</div>}
            </div>
        </div>

        <div className={`grid ${isGameEnabled ? 'grid-cols-8' : 'grid-cols-7'} gap-1 bg-white p-2 rounded-xl border border-slate-200 shadow-sm mb-8 sticky top-20 z-20 overflow-x-auto`}>
            <button onClick={() => setActiveTab('ROUTINE')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'ROUTINE' ? 'bg-slate-100 text-[var(--primary)]' : 'text-slate-400 hover:bg-slate-50'}`}><Calendar size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Routine</span></button>
            <button onClick={() => setActiveTab('CHAT')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'CHAT' ? 'bg-slate-100 text-[var(--primary)]' : 'text-slate-400 hover:bg-slate-50'}`}><MessageCircle size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Chat</span></button>
            <button onClick={() => setActiveTab('LEADERBOARD')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'LEADERBOARD' ? 'bg-slate-100 text-[var(--primary)]' : 'text-slate-400 hover:bg-slate-50'}`}><Trophy size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Rank</span></button>
            {isGameEnabled && <button onClick={() => setActiveTab('GAME')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'GAME' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`}><Gamepad2 size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Game</span></button>}
            <button onClick={() => setActiveTab('HISTORY')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'HISTORY' ? 'bg-slate-100 text-[var(--primary)]' : 'text-slate-400 hover:bg-slate-50'}`}><History size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">History</span></button>
            <button onClick={() => setActiveTab('REDEEM')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'REDEEM' ? 'bg-slate-100 text-[var(--primary)]' : 'text-slate-400 hover:bg-slate-50'}`}><Gift size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Redeem</span></button>
            <button onClick={() => setActiveTab('STORE')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'STORE' ? 'bg-gradient-to-br from-green-400 to-blue-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><ShoppingBag size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Store</span></button>
            {settings?.weeklyTests?.some(t => t.isActive && t.classLevel === user.classLevel) && <button onClick={() => setActiveTab('WEEKLY_TEST')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'WEEKLY_TEST' ? 'bg-gradient-to-br from-red-400 to-pink-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Calendar size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Test</span></button>}
            <button onClick={() => setActiveTab('PROFILE')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'PROFILE' ? 'bg-gradient-to-br from-purple-400 to-indigo-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Settings size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Profile</span></button>
            <button onClick={() => setActiveTab('PREMIUM')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-[60px] ${activeTab === 'PREMIUM' ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Sparkles size={18} className="mb-1" /><span className="text-[9px] font-bold uppercase">Premium</span></button>
        </div>

        <div className="min-h-[400px]">
            {activeTab === 'ROUTINE' && <RoutineView />}
            {activeTab === 'CHAT' && <UniversalChat currentUser={user} onUserUpdate={handleUserUpdate} settings={settings} />}
            {activeTab === 'LEADERBOARD' && <Leaderboard />}
            {activeTab === 'GAME' && isGameEnabled && (user.isGameBanned ? <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100"><Ban size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-lg font-bold text-red-700">Access Denied</h3><p className="text-sm text-red-600">Admin has disabled the game for your account.</p></div> : <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />)}
            {activeTab === 'HISTORY' && <HistoryPage />}
            {activeTab === 'REDEEM' && <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>}
            {activeTab === 'STORE' && <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />}
            
            {activeTab === 'WEEKLY_TEST' && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-6 text-center text-white mb-6">
                        <h2 className="text-2xl font-bold mb-2">Weekly Test</h2>
                        <p className="text-red-100 text-sm">Auto-submits after 2 hours! Questions accessible during test window.</p>
                    </div>
                    {settings?.weeklyTests?.filter(t => {
                        // 1. Must be active and for correct class
                        if (!t.isActive || t.classLevel !== user.classLevel) return false;
                        
                        // 2. 24-Hour Visibility Rule
                        // If created more than 24 hours ago, hide it (unless user already started it)
                        if (t.createdAt) {
                            const created = new Date(t.createdAt).getTime();
                            const now = Date.now();
                            const diffHours = (now - created) / (1000 * 60 * 60);
                            const hasAttempted = !!testAttempts[t.id];
                            
                            // If > 24 hours old and NOT attempted/started, hide it.
                            // If attempted, keep showing so they can see result/status.
                            if (diffHours > 24 && !hasAttempted) return false;
                        }
                        
                        return true;
                    }).map(test => {
                        const attempt = testAttempts[test.id];
                        const durationMins = test.durationMinutes || 120;
                        const startTime = attempt ? new Date(attempt.startedAt).getTime() : null;
                        const timeLeft = startTime ? Math.max(0, durationMins * 60 * 1000 - (Date.now() - startTime)) : durationMins * 60 * 1000;
                        const isSubmitted = attempt?.submittedAt;
                        const mins = Math.floor(timeLeft / 60000);
                        const secs = Math.floor((timeLeft % 60000) / 1000);
                        
                        return (
                          <div key={test.id} className="bg-white rounded-2xl p-6 border-2 border-red-200 mb-4">
                              <div className="flex justify-between items-start mb-4">
                                  <div><h3 className="text-2xl font-bold text-red-600">{test.name}</h3><p className="text-slate-600 text-sm">{test.description}</p></div>
                                  {attempt && !isSubmitted && <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-lg">{mins}:{secs.toString().padStart(2,'0')}</div>}
                              </div>
                              <div className="flex gap-4 mb-4">
                                  <div className="bg-red-50 p-3 rounded-lg flex-1"><p className="text-xs text-red-600 font-bold">Questions</p><p className="text-2xl font-black text-red-600">{test.totalQuestions}</p></div>
                                  <div className="bg-green-50 p-3 rounded-lg flex-1"><p className="text-xs text-green-600 font-bold">Pass Score</p><p className="text-2xl font-black text-green-600">{test.passingScore}%</p></div>
                              </div>
                              {isSubmitted ? (
                                  <div className="bg-green-50 p-4 rounded-lg text-center"><p className="font-bold text-green-700">✅ Submitted! Score: {attempt.score}/{test.totalQuestions}</p></div>
                              ) : (
                                  <button 
                                      onClick={() => onStartWeeklyTest && onStartWeeklyTest(test)}
                                      className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all"
                                  >
                                      {attempt ? '📝 Resume Test' : '📝 Start Test'} - {test.totalQuestions} Questions
                                  </button>
                              )}
                          </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'PROFILE' && (
                <div className="animate-in fade-in zoom-in duration-300 pb-10">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-center text-white mb-6">
                        <div className="w-16 h-16 bg-white text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">{user.name.charAt(0)}</div>
                        <h2 className="text-2xl font-bold">{user.name}</h2>
                        <p className="text-purple-100 text-sm">Student ID: {user.id}</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Class</p>
                            <p className="text-lg font-black text-slate-800">{user.classLevel} • {user.board} • {user.stream}</p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Subscription</p>
                            <div className="flex justify-between items-center">
                                <p className="text-lg font-black text-slate-800">{user.subscriptionTier || 'FREE'}</p>
                                {user.subscriptionTier && user.subscriptionTier !== 'FREE' && !isSubscriptionActive(user) && (
                                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded animate-pulse">EXPIRED</span>
                                )}
                            </div>
                            {user.subscriptionEndDate && (
                                <p className={`text-xs mt-1 ${getDaysRemaining(user) < 3 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                    {isSubscriptionActive(user) 
                                      ? `Expires in ${getDaysRemaining(user)} days` 
                                      : `Expired on ${new Date(user.subscriptionEndDate).toLocaleDateString()}`}
                                </p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                                <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                                <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                            </div>
                        </div>
                        
                        <button onClick={() => {localStorage.removeItem(`nst_user_${user.id}`); window.location.reload();}} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">🚪 Logout</button>
                    </div>
                </div>
            )}
            
            {activeTab === 'PREMIUM' && (
                <div className="animate-in zoom-in duration-300 pb-10">
                    <div className="bg-slate-900 rounded-2xl p-6 text-center text-white mb-8">
                        <h2 className="text-2xl font-bold mb-2">Buy Credits</h2>
                        <p className="text-slate-400 text-sm">Tap a package to open WhatsApp & Pay.</p>
                    </div>

                    {settings?.isPaymentEnabled === false ? (
                        <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-10 rounded-3xl border-2 border-slate-300 text-center shadow-inner">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"><Lock size={40} className="text-slate-400" /></div>
                            <h3 className="text-2xl font-black text-slate-700 mb-2">Store Locked</h3>
                            <p className="text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">{settings.paymentDisabledMessage || "Purchases are currently disabled by the Admin. Please check back later."}</p>
                        </div>
                    ) : (<>
                        {adminPhones.length > 1 && (
                            <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-200">
                                <label className="text-xs font-bold text-blue-700 block mb-2">Select Admin WhatsApp:</label>
                                <select value={selectedPhoneId} onChange={e => setSelectedPhoneId(e.target.value)} className="w-full p-2 border border-blue-300 rounded-lg text-sm">
                                    {adminPhones.map(phone => (
                                        <option key={phone.id} value={phone.id}>{phone.name} - {phone.number}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {packages.map((pkg) => (
                                <div key={pkg.id} className="relative group">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <button 
                                        onClick={() => handleBuyPackage(pkg)}
                                        className="relative w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-center hover:border-blue-500 hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden"
                                    >
                                        <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                                            <ShoppingBag size={24} />
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-sm mb-1">{pkg.name}</h3>
                                        <div className="text-2xl font-black text-blue-600 mb-1">₹{pkg.price}</div>
                                        <div className="text-xs font-bold text-slate-400 mb-3">{pkg.credits} Credits</div>
                                        
                                        <div className="bg-slate-900 text-white text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 group-hover:bg-blue-600 transition-colors">
                                            BUY <ArrowRight size={10} />
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                    )}
                    
                    <div className="mt-8 text-center text-xs text-slate-400 max-w-md mx-auto">
                        <p>After clicking "Buy", you will be redirected to WhatsApp. Send the message and complete payment to Admin.</p>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
