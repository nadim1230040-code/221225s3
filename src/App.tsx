
import React, { useState, useEffect } from 'react';
import { 
  ClassLevel, Subject, Chapter, AppState, Board, Stream, User, ContentType, SystemSettings, ActivityLogEntry, WeeklyTest
} from './types';
import { getChapterData, saveChapterData, checkFirebaseConnection, saveTestResult } from './firebase';
import { canAccessContent } from './utils/subscriptionUtils';
import { fetchChapters, fetchLessonContent } from './services/gemini';
import { BoardSelection } from './components/BoardSelection';
import { ClassSelection } from './components/ClassSelection';
import { SubjectSelection } from './components/SubjectSelection';
import { ChapterSelection } from './components/ChapterSelection';
import { StreamSelection } from './components/StreamSelection';
import { LessonView } from './components/LessonView';
import { Auth } from './pages/Auth';
import { AdminDashboard } from './pages/AdminDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { AudioStudio } from './components/AudioStudio';
import { WelcomePopup } from './components/WelcomePopup';
import { PremiumModal } from './components/PremiumModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { RulesPage } from './pages/RulesPage';
import { IICPage } from './pages/IICPage';
import { StartupAd } from './components/StartupAd';
import { WeeklyTestView } from './components/WeeklyTestView';
import { BrainCircuit, Globe, LogOut, LayoutDashboard, BookOpen, Headphones, HelpCircle, Newspaper, KeyRound, Lock, X, ShieldCheck, FileText, UserPlus, EyeOff, WifiOff, Book } from 'lucide-react';
import { SUPPORT_EMAIL } from './constants';

const TermsPopup: React.FC<{ onClose: () => void, text?: string }> = ({ onClose, text }) => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-white p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <FileText className="text-[var(--primary)]" /> Terms & Conditions
                </h3>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar whitespace-pre-wrap">
                <p className="text-slate-900 font-medium">Please read carefully before using NST AI Assistant.</p>
                <p>{text || "By continuing, you agree to abide by these rules and the standard terms of service."}</p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <button onClick={onClose} className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95">I Agree & Continue</button>
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStartupAd, setShowStartupAd] = useState(false);

  const [state, setState] = useState<AppState>({
    user: null,
    originalAdmin: null,
    view: 'BOARDS',
    selectedBoard: null,
    selectedClass: null,
    selectedStream: null,
    selectedSubject: null,
    selectedChapter: null,
    chapters: [],
    lessonContent: null,
    loading: false,
    error: null,
    language: 'English',
    showWelcome: false,
    globalMessage: null,
    settings: {
        appName: 'NST',
        themeColor: '#3b82f6',
        maintenanceMode: false,
        maintenanceMessage: 'We are upgrading our servers. Please check back later.',
        customCSS: '',
        apiKeys: [],
        welcomeTitle: 'Unlock Smart Learning', 
        welcomeMessage: 'Experience the power of AI-driven education. NST AI filters out the noise of traditional textbooks to deliver only the essential, high-yield topics you need for success. Study smarter, not harder.',
        marqueeLines: ["Welcome to NST AI", "Learn Smart", "Contact Admin for Credits"], 
        liveMessage1: '', 
        liveMessage2: '', 
        wheelRewards: [0, 1, 2, 5],
        chatCost: 1,
        dailyReward: 3,
        signupBonus: 2,
        isChatEnabled: true,
        isGameEnabled: true, 
        allowSignup: true,
        loginMessage: '',
        allowedClasses: ['6','7','8','9','10','11','12'],
        storageCapacity: '100 GB',
        isPaymentEnabled: true, 
        upiId: '',
        upiName: '',
        qrCodeUrl: '',
        paymentInstructions: '',
        packages: [],
        subscriptionPlans: [
            { id: 'weekly', name: 'Weekly', duration: '7 days', basicPrice: 49, basicOriginalPrice: 199, ultraPrice: 99, ultraOriginalPrice: 399, features: ['Premium Content'], popular: false },
            { id: 'monthly', name: 'Monthly', duration: '30 days', basicPrice: 199, basicOriginalPrice: 499, ultraPrice: 299, ultraOriginalPrice: 799, features: ['Everything in Weekly', 'Live Chat'], popular: true },
            { id: 'yearly', name: 'Yearly', duration: '365 days', basicPrice: 999, basicOriginalPrice: 2999, ultraPrice: 2999, ultraOriginalPrice: 5999, features: ['Priority Support'], popular: false },
            { id: 'lifetime', name: 'Lifetime', duration: 'Forever', basicPrice: 4999, basicOriginalPrice: 9999, ultraPrice: 9999, ultraOriginalPrice: 19999, features: ['VIP Status'], popular: true }
        ],
        startupAd: {
            enabled: true,
            duration: 3,
            title: "Premium Features",
            features: ["AI Notes Generator", "MCQ Practice", "Live Chat Support"],
            bgColor: "#1e293b",
            textColor: "#ffffff"
        }
    }
  });

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [tempSelectedChapter, setTempSelectedChapter] = useState<Chapter | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [generationDataReady, setGenerationDataReady] = useState(false);
  const [activeWeeklyTest, setActiveWeeklyTest] = useState<WeeklyTest | null>(null);
  
  // GLOBAL STUDY TIMER
  const [dailyStudySeconds, setDailyStudySeconds] = useState(0);
  const [showUserGuide, setShowUserGuide] = useState(false);

  // --- ONLINE/OFFLINE DETECTOR ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- AUTO RELOAD SETTINGS EVERY 2 SECONDS ---
  useEffect(() => {
    const interval = setInterval(() => {
      const storedSettings = localStorage.getItem('nst_system_settings');
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          setState(prev => {
            const hasChanges = JSON.stringify(prev.settings) !== JSON.stringify({...prev.settings, ...parsed});
            return hasChanges ? {...prev, settings: {...prev.settings, ...parsed}} : prev;
          });
        } catch(e) {}
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      // STARTUP AD LOGIC
      const hasSeenAd = sessionStorage.getItem('nst_ad_seen');
      if (!hasSeenAd) {
          setShowStartupAd(true);
      }

      const storedSettings = localStorage.getItem('nst_system_settings');
      if (storedSettings) {
          try {
              const parsed = JSON.parse(storedSettings);
              setState(prev => ({ 
                  ...prev, 
                  settings: { ...prev.settings, ...parsed } 
              }));
          } catch(e) {}
      }
      
      const hasAcceptedTerms = localStorage.getItem('nst_terms_accepted');
      if (!hasAcceptedTerms) setShowTerms(true);

      const hasSeenWelcome = localStorage.getItem('nst_has_seen_welcome');
      if (!hasSeenWelcome && hasAcceptedTerms) setState(prev => ({ ...prev, showWelcome: true }));

      const loggedInUserStr = localStorage.getItem('nst_current_user');
      if (loggedInUserStr) {
        const user: User = JSON.parse(loggedInUserStr);
        if (!user.progress) user.progress = {};
        if (user.isLocked) { localStorage.removeItem('nst_current_user'); alert("Account Locked."); return; }

        let initialView = user.role === 'admin' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD';
        setState(prev => ({ 
          ...prev, user: user, view: initialView as any, selectedBoard: user.board || null, selectedClass: user.classLevel || null, selectedStream: user.stream || null, language: user.board === 'BSEB' ? 'Hindi' : 'English', showWelcome: !hasSeenWelcome && !!hasAcceptedTerms
        }));
      }
  }, []);

  // --- TIMER LOGIC (UPDATED) ---
  useEffect(() => {
    if (!state.user) return;

    // Load initial seconds from storage
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('nst_timer_date');
    const storedSeconds = parseInt(localStorage.getItem('nst_daily_study_seconds') || '0');

    if (storedDate !== today) {
        localStorage.setItem('nst_timer_date', today);
        localStorage.setItem('nst_daily_study_seconds', '0');
        setDailyStudySeconds(0);
    } else {
        setDailyStudySeconds(storedSeconds);
    }

    // ONLY START INTERVAL IF VIEW IS 'LESSON'
    let interval: any;
    if (state.view === 'LESSON') {
        interval = setInterval(() => {
            setDailyStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('nst_daily_study_seconds', next.toString());
                return next;
            });
        }, 1000);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [state.user?.id, state.view]); 

  useEffect(() => {
      document.title = `${state.settings.appName}`;
      const styleId = 'nst-custom-styles';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `:root { --primary: ${state.settings.themeColor || '#3b82f6'}; } .text-primary { color: var(--primary); } .bg-primary { background-color: var(--primary); } .border-primary { border-color: var(--primary); } ${state.settings.customCSS || ''}`;
  }, [state.settings]);

  // --- LOGGING SYSTEM ---
  const logActivity = (action: string, details: string, overrideUser?: User) => {
      const u = overrideUser || state.user;
      if (!u && !overrideUser) return;
      
      const newLog: ActivityLogEntry = {
          id: Date.now().toString() + Math.random(),
          userId: u!.id,
          userName: u!.name,
          role: u!.role,
          action: action,
          details: details,
          timestamp: new Date().toISOString()
      };

      const storedLogs = localStorage.getItem('nst_activity_log');
      const logs: ActivityLogEntry[] = storedLogs ? JSON.parse(storedLogs) : [];
      // Keep last 500 logs
      const updatedLogs = [...logs, newLog].slice(-500); 
      localStorage.setItem('nst_activity_log', JSON.stringify(updatedLogs));
  };

  const updateSettings = (newSettings: SystemSettings) => {
      setState(prev => ({...prev, settings: newSettings}));
      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
  };

  const handleAcceptTerms = () => {
      localStorage.setItem('nst_terms_accepted', 'true');
      setShowTerms(false);
      const hasSeenWelcome = localStorage.getItem('nst_has_seen_welcome');
      if (!hasSeenWelcome) setState(prev => ({ ...prev, showWelcome: true }));
  };

  const handleStartApp = () => {
    localStorage.setItem('nst_has_seen_welcome', 'true');
    setState(prev => ({ ...prev, showWelcome: false }));
  };

  const handleLogin = (user: User) => {
    localStorage.setItem('nst_current_user', JSON.stringify(user));
    localStorage.setItem('nst_has_seen_welcome', 'true');
    setState(prev => ({ ...prev, user, view: user.role === 'admin' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' as any, selectedBoard: user.board || null, selectedClass: user.classLevel || null, selectedStream: user.stream || null, language: user.board === 'BSEB' ? 'Hindi' : 'English', showWelcome: false }));
  };

  const handleLogout = () => {
    logActivity("LOGOUT", "User Logged Out");
    localStorage.removeItem('nst_current_user');
    setState(prev => ({ ...prev, user: null, originalAdmin: null, view: 'BOARDS', selectedBoard: null, selectedClass: null, selectedStream: null, selectedSubject: null, lessonContent: null, language: 'English' }));
    setDailyStudySeconds(0);
  };

  const handleImpersonate = (targetUser: User) => {
      if (state.user?.role !== 'admin') return;
      logActivity("IMPERSONATE", `Admin accessed as ${targetUser.name}`);
      setState(prev => ({ ...prev, originalAdmin: prev.user, user: targetUser, view: 'STUDENT_DASHBOARD', selectedBoard: targetUser.board || null, selectedClass: targetUser.classLevel || null, selectedStream: targetUser.stream || null, language: targetUser.board === 'BSEB' ? 'Hindi' : 'English' }));
  };

  const handleReturnToAdmin = () => {
      if (!state.originalAdmin) return;
      setState(prev => ({ ...prev, user: prev.originalAdmin, originalAdmin: null, view: 'ADMIN_DASHBOARD', selectedBoard: null, selectedClass: null }));
  };

  const handleBoardSelect = (board: Board) => { setState(prev => ({ ...prev, selectedBoard: board, view: 'CLASSES', language: board === 'BSEB' ? 'Hindi' : 'English' })); };
  const handleClassSelect = (level: ClassLevel) => { if (level === '11' || level === '12') { setState(prev => ({ ...prev, selectedClass: level, view: 'STREAMS' })); } else { setState(prev => ({ ...prev, selectedClass: level, selectedStream: null, view: 'SUBJECTS' })); } };
  const handleStreamSelect = (stream: Stream) => { setState(prev => ({ ...prev, selectedStream: stream, view: 'SUBJECTS' })); };
  const handleSubjectSelect = async (subject: Subject) => {
    setState(prev => ({ ...prev, selectedSubject: subject, loading: true }));
    try {
      if (state.selectedClass && state.selectedBoard) {
        const chapters = await fetchChapters(state.selectedBoard, state.selectedClass, state.selectedStream, subject, state.language);
        setState(prev => ({ ...prev, chapters, view: 'CHAPTERS', loading: false }));
      }
    } catch (err) { setState(prev => ({ ...prev, chapters: [], view: 'CHAPTERS', loading: false })); }
  };

  const onChapterClick = (chapter: Chapter) => {
      setTempSelectedChapter(chapter);
      setShowPremiumModal(true);
  };

  const handleContentGeneration = async (type: ContentType, count?: number) => {
    setShowPremiumModal(false);
    if (!tempSelectedChapter || !state.user) return;
    
    // Check Cost Logic
    let cost = 0;
    const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
    // Append type to key to distinguish between Notes, MCQ, etc.
    const key = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}_${type}`;
    
    // Check Firebase first
    const onlineContent = await getChapterData(key);
    
    if (onlineContent) {
         if(onlineContent.price) cost = onlineContent.price;
    } else {
         const storedContent = localStorage.getItem(key);
         if(storedContent) {
            const parsed = JSON.parse(storedContent);
            if(parsed.price) cost = parsed.price;
         }
    }

    // SUBSCRIPTION OVERRIDE: Subscribers get content for free
    if (canAccessContent(state.user, type)) {
        cost = 0;
    }

    if (state.user.role !== 'admin' && !state.originalAdmin && cost > 0 && state.user.credits < cost) {
        alert(`Insufficient Credits! This content costs ${cost} credits.`);
        return;
    }
    
    // Deduct
    if (state.user.role !== 'admin' && !state.originalAdmin && cost > 0) {
        const updatedUser = { ...state.user, credits: state.user.credits - cost };
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        const allUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
        const idx = allUsers.findIndex((u:User) => u.id === updatedUser.id);
        if (idx !== -1) { allUsers[idx] = updatedUser; localStorage.setItem('nst_users', JSON.stringify(allUsers)); }
        setState(prev => ({...prev, user: updatedUser}));
    }

    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, loading: true }));
    setGenerationDataReady(false); 
    
    logActivity("CONTENT_GEN", `Opened ${type} for ${tempSelectedChapter.title}`);

    try {
        // Try to use online content if available
        if (onlineContent) {
            setState(prev => ({ ...prev, lessonContent: onlineContent }));
            setGenerationDataReady(true);
            return;
        }

        const content = await fetchLessonContent(
          state.selectedBoard!, state.selectedClass!, state.selectedStream!, state.selectedSubject!, tempSelectedChapter, state.language, type
        );
        
        // Save generated content to Firebase
        await saveChapterData(key, content);

        setState(prev => ({ ...prev, lessonContent: content }));
        setGenerationDataReady(true); // Immediate ready for link mode
    } catch (err) {
      setState(prev => ({ ...prev, loading: false }));
    }
  };
  
  const handleLoadingAnimationComplete = () => { setState(prev => ({ ...prev, loading: false, view: 'LESSON' })); };

  const handleStartWeeklyTest = (test: WeeklyTest) => {
    setActiveWeeklyTest(test);
  };

  const handleWeeklyTestComplete = async (score: number, total: number) => {
    if (!activeWeeklyTest || !state.user) return;
    
    // Save Attempt
    const attempt = {
        testId: activeWeeklyTest.id,
        testName: activeWeeklyTest.name,
        userId: state.user.id,
        userName: state.user.name,
        startedAt: localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`) || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score: Math.round((score / total) * 100),
        totalQuestions: total,
        answers: {} // We could capture actual answers if WeeklyTestView provided them
    };
    
    // 1. Local Backup
    const key = `nst_test_attempts_${state.user.id}`;
    const attempts = JSON.parse(localStorage.getItem(key) || '{}');
    attempts[activeWeeklyTest.id] = attempt;
    localStorage.setItem(key, JSON.stringify(attempts));

    // 2. Firestore Sync (So Admin can see)
    await saveTestResult(state.user.id, attempt);
    
    logActivity("TEST_SUBMIT", `Completed ${activeWeeklyTest.name} with score ${score}/${total}`);
    setActiveWeeklyTest(null);
    alert(`Test Submitted! You scored ${score}/${total}`);
    
    // Cleanup Local Timer
    localStorage.removeItem(`weekly_test_start_${activeWeeklyTest.id}`);
  };

  // --- SAFE NAVIGATION LOGIC ---
  const goBack = () => {
    if (activeWeeklyTest) {
        if (confirm("Exit test? Progress may be lost unless submitted.")) {
            setActiveWeeklyTest(null);
        }
        return;
    }

    setState(prev => {
      // 1. Content -> Chapters
      if (prev.view === 'LESSON') return { ...prev, view: 'CHAPTERS', lessonContent: null };

      // 2. Chapters -> Dashboard (for Students) OR Subjects (Admin)
      if (prev.view === 'CHAPTERS') {
          // If Student, go DIRECTLY to Dashboard. Don't unwind to subjects/boards.
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedChapter: null, selectedSubject: null };
          }
          return { ...prev, view: 'SUBJECTS', selectedChapter: null };
      }

      // 3. Subjects -> Dashboard (for Students) OR Classes (Admin)
      if (prev.view === 'SUBJECTS') {
          // If Student, go DIRECTLY to Dashboard
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedSubject: null };
          }
          return { ...prev, view: ['11','12'].includes(prev.selectedClass||'') ? 'STREAMS' : 'CLASSES', selectedSubject: null };
      }

      if (prev.view === 'STREAMS') return { ...prev, view: 'CLASSES', selectedStream: null };
      if (prev.view === 'CLASSES') return { ...prev, view: 'BOARDS', selectedClass: null };
      
      // 4. Boards -> Dashboard or Admin
      if (prev.view === 'BOARDS') {
          const nextView = prev.user?.role === 'admin' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD';
          return { ...prev, view: nextView as any, selectedBoard: null };
      }
      
      return { ...prev, view: prev.user?.role === 'admin' ? 'ADMIN_DASHBOARD' as any : 'STUDENT_DASHBOARD' as any };
    });
  };

  // --- OFFLINE SCREEN ---
  if (!isOnline) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <WifiOff size={80} className="text-red-500 mb-6 animate-pulse" />
              <h1 className="text-3xl font-black mb-2">Internet Not Connected</h1>
              <p className="text-slate-400 mb-8 max-w-sm">
                  Please check your internet connection to continue using NST AI Assistant.
              </p>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {state.settings.footerText || 'Developed by Nadim Anwar'}
              </div>
          </div>
      );
  }

  // --- MAINTENANCE SCREEN ---
  if (state.settings.maintenanceMode && state.user?.role !== 'admin') {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <div className="bg-red-500/10 p-6 rounded-full mb-6 animate-pulse">
                  <Lock size={64} className="text-red-500" />
              </div>
              <h1 className="text-3xl font-black mb-4">Under Maintenance</h1>
              <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
                  {state.settings.maintenanceMessage || "We are currently upgrading our servers. Please check back later."}
              </p>
              
              {/* Secret Admin Login */}
              <button 
                  onClick={() => setState(prev => ({...prev, user: null, view: 'BOARDS', settings: {...prev.settings, maintenanceMode: false}}))} 
                  className="text-[10px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-widest"
              >
                  Admin Bypass
              </button>
          </div>
      );
  }

  // --- STARTUP AD SCREEN ---
  if (showStartupAd && state.settings.startupAd?.enabled) {
      return (
          <StartupAd 
              settings={state.settings} 
              onClose={() => {
                  setShowStartupAd(false);
                  sessionStorage.setItem('nst_ad_seen', 'true');
              }} 
          />
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans relative">
      
      {/* GLOBAL LIVE DASHBOARD 1 (TOP) */}
      {state.settings.liveMessage1 && (
          <div className="bg-red-600 text-white text-[10px] font-bold py-1 overflow-hidden relative whitespace-nowrap z-50">
              <div className="animate-marquee inline-block">{state.settings.liveMessage1} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage1} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage1}</div>
          </div>
      )}

      {/* IMPERSONATION RETURN BUTTON */}
      {state.originalAdmin && (
          <div className="fixed bottom-12 right-6 z-[90] animate-bounce">
              <button onClick={handleReturnToAdmin} className="bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 border-4 border-white">
                  <EyeOff size={20} /> Exit User View
              </button>
          </div>
      )}

      {showTerms && <TermsPopup onClose={handleAcceptTerms} text={state.settings.termsText} />}
      
      {/* USER GUIDE MODAL */}
      {showUserGuide && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                  <div className="bg-blue-600 p-6 text-white text-center">
                      <HelpCircle size={48} className="mx-auto mb-2 opacity-80" />
                      <h2 className="text-2xl font-black">User Guide</h2>
                      <p className="text-blue-200 text-sm">How to use NST AI Assistant</p>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                      <div className="flex gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg text-blue-600 h-fit"><BrainCircuit size={20} /></div>
                          <div><h4 className="font-bold text-slate-800">Smart Notes</h4><p className="text-xs text-slate-500">Select any chapter to generate instant, easy-to-understand notes.</p></div>
                      </div>
                      <div className="flex gap-3">
                          <div className="bg-green-100 p-2 rounded-lg text-green-600 h-fit"><BookOpen size={20} /></div>
                          <div><h4 className="font-bold text-slate-800">MCQ Practice</h4><p className="text-xs text-slate-500">Solve 100 MCQs to unlock the next chapter. Track progress in your Routine tab.</p></div>
                      </div>
                      <div className="flex gap-3">
                          <div className="bg-purple-100 p-2 rounded-lg text-purple-600 h-fit"><LayoutDashboard size={20} /></div>
                          <div><h4 className="font-bold text-slate-800">Weekly Tests</h4><p className="text-xs text-slate-500">Participate in live tests every week to boost your ranking.</p></div>
                      </div>
                  </div>
                  <button onClick={() => setShowUserGuide(false)} className="m-4 bg-slate-900 text-white py-3 rounded-xl font-bold">Got it!</button>
              </div>
          </div>
      )}

      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <div onClick={() => setState(prev => ({ ...prev, view: state.user?.role === 'admin' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' as any }))} className="flex items-center gap-2 cursor-pointer">
               {/* LOGO GLOW EFFECT */}
               <div className="bg-[var(--primary)] rounded-lg p-1.5 text-white shadow-[0_0_15px_var(--primary)] animate-pulse transition-all duration-1000"><BrainCircuit size={20} /></div>
               <h1 className="text-xl font-black text-slate-800">{state.settings.appName}</h1>
           </div>
           {state.user && (
               <div className="flex items-center gap-2">
                   <div className="text-right hidden md:block">
                       <div className="text-xs font-bold text-slate-800">{state.user.name}</div>
                   </div>
                   <button onClick={handleLogout} className="p-2 text-red-400 hover:bg-red-50 rounded-full"><LogOut size={20} /></button>
               </div>
           )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 mb-8">
        {!state.user ? (
            <Auth onLogin={handleLogin} logActivity={logActivity} />
        ) : (
            <>
                {state.view === 'ADMIN_DASHBOARD' && state.user.role === 'admin' && <AdminDashboard onNavigate={(v) => setState(prev => ({...prev, view: v}))} settings={state.settings} onUpdateSettings={updateSettings} onImpersonate={handleImpersonate} logActivity={logActivity} />}
                
                {/* ACTIVE WEEKLY TEST OVERRIDE */}
                {activeWeeklyTest ? (
                    <WeeklyTestView test={activeWeeklyTest} onComplete={handleWeeklyTestComplete} onExit={() => { if(confirm('Quit Test?')) setActiveWeeklyTest(null); }} />
                ) : (
                    state.view === 'STUDENT_DASHBOARD' as any && <StudentDashboard user={state.user} dailyStudySeconds={dailyStudySeconds} onSubjectSelect={handleSubjectSelect} onRedeemSuccess={u => setState(prev => ({...prev, user: u}))} settings={state.settings} onStartWeeklyTest={handleStartWeeklyTest} />
                )}
                
                {(!activeWeeklyTest && state.view === 'BOARDS') && <BoardSelection onSelect={handleBoardSelect} onBack={goBack} />}
                {state.view === 'CLASSES' && <ClassSelection selectedBoard={state.selectedBoard} allowedClasses={state.settings.allowedClasses} onSelect={handleClassSelect} onBack={goBack} />}
                {state.view === 'STREAMS' && <StreamSelection onSelect={handleStreamSelect} onBack={goBack} />}
                {state.view === 'SUBJECTS' && state.selectedClass && <SubjectSelection classLevel={state.selectedClass} stream={state.selectedStream} onSelect={handleSubjectSelect} onBack={goBack} />}
                {state.view === 'CHAPTERS' && state.selectedSubject && <ChapterSelection chapters={state.chapters} subject={state.selectedSubject} classLevel={state.selectedClass!} loading={state.loading && state.view === 'CHAPTERS'} user={state.user} onSelect={onChapterClick} onBack={goBack}/>}
                {state.view === 'LESSON' && state.lessonContent && <LessonView content={state.lessonContent} subject={state.selectedSubject!} classLevel={state.selectedClass!} chapter={state.selectedChapter!} loading={false} onBack={goBack} />}
            </>
        )}
      </main>
      
      {/* PERSISTENT FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-1 text-center z-[40]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {state.settings.footerText || 'Developed by Nadim Anwar'}
          </p>
      </footer>

      {/* GLOBAL LIVE DASHBOARD 2 (BOTTOM) */}
      {state.settings.liveMessage2 && (
          <div className="fixed bottom-6 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold py-1 overflow-hidden relative whitespace-nowrap z-[39]">
              <div className="animate-marquee-reverse inline-block">{state.settings.liveMessage2} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage2} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage2}</div>
          </div>
      )}

      {state.loading && <LoadingOverlay dataReady={generationDataReady} onComplete={handleLoadingAnimationComplete} />}
      {showPremiumModal && tempSelectedChapter && state.user && (
          <PremiumModal chapter={tempSelectedChapter} credits={state.user.credits || 0} isAdmin={state.user.role === 'admin'} onSelect={handleContentGeneration} onClose={() => setShowPremiumModal(false)} />
      )}
      {state.showWelcome && <WelcomePopup onStart={handleStartApp} isResume={!!state.user} title={state.settings.welcomeTitle} message={state.settings.welcomeMessage} footerText={state.settings.footerText} />}
    </div>
  );
};
export default App;
