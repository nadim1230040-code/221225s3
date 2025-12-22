import React, { useState, useEffect } from 'react';
import { User, Board, ClassLevel, Stream, SystemSettings, RecoveryRequest } from '../types';
import { ADMIN_EMAIL } from '../constants';
// Firebase Functions Import
import { saveUserToLive, auth, updateUserStatus, checkFirebaseConnection } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { UserPlus, LogIn, Lock, User as UserIcon, Phone, Mail, ShieldCheck, ArrowRight, School, GraduationCap, Layers, KeyRound, Copy, Check, AlertTriangle, XCircle, MessageCircle, Send, RefreshCcw, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
  logActivity: (action: string, details: string, user?: User) => void;
}

type AuthView = 'LOGIN' | 'SIGNUP' | 'ADMIN' | 'RECOVERY' | 'SUCCESS_ID';

// --- SECURITY: BLOCKED EMAIL DOMAINS ---
const BLOCKED_DOMAINS = [
    'tempmail.com', 'throwawaymail.com', 'mailinator.com', 'yopmail.com', 
    '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'getairmail.com',
    'dispostable.com', 'grr.la', 'mailnesia.com', 'temp-mail.org', 'fake-email.com'
];

export const Auth: React.FC<Props> = ({ onLogin, logActivity }) => {
  const [view, setView] = useState<AuthView>('LOGIN');
  const [generatedId, setGeneratedId] = useState<string>('');
  const [isOnline, setIsOnline] = useState(false); // New: Connection State
  
  const [formData, setFormData] = useState({
    id: '',
    password: '',
    name: '',
    mobile: '',
    email: '',
    board: 'CBSE' as Board,
    classLevel: '10' as ClassLevel,
    stream: 'Science' as Stream,
    recoveryCode: ''
  });
  
  // ADMIN VERIFICATION STATE
  const [showAdminVerify, setShowAdminVerify] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);

  // --- INITIALIZATION: CHECK CONNECTION & SETTINGS ---
  useEffect(() => {
      const s = localStorage.getItem('nst_system_settings');
      if (s) setSettings(JSON.parse(s));
      
      // Real-time connection monitoring
      const checkConn = () => setIsOnline(checkFirebaseConnection());
      const interval = setInterval(checkConn, 5000);
      checkConn();
      
      return () => clearInterval(interval);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  // UNIQUE ID GENERATOR
  const generateUserId = () => {
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const namePart = formData.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      return `NST-${namePart}-${randomPart}`;
  };

  const handleCopyId = () => {
      navigator.clipboard.writeText(generatedId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return false;
      const domain = email.split('@')[1].toLowerCase();
      if (BLOCKED_DOMAINS.includes(domain)) return false;
      return true;
  };

  // --- PASSWORD-LESS LOGIN REQUEST ---
  const handleRequestLogin = () => {
      const inputId = formData.id; 
      if (!inputId) {
          setError("Please enter your Login ID or Mobile Number first.");
          return;
      }

      const storedUsersStr = localStorage.getItem('nst_users');
      const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
      const user = users.find(u => u.id === inputId || u.mobile === inputId || u.email === inputId);

      if (!user) {
          setError("User not found with this ID/Mobile.");
          return;
      }

      const requestsStr = localStorage.getItem('nst_recovery_requests');
      const requests: RecoveryRequest[] = requestsStr ? JSON.parse(requestsStr) : [];
      
      if (!requests.some(r => r.id === user.id && r.status === 'PENDING')) {
          const newReq: RecoveryRequest = {
              id: user.id,
              name: user.name,
              mobile: user.mobile,
              timestamp: new Date().toISOString(),
              status: 'PENDING'
          };
          localStorage.setItem('nst_recovery_requests', JSON.stringify([newReq, ...requests]));
      }

      setRequestSent(true);
      setError(null);
  };

  // CHECK IF ADMIN APPROVED LOGIN
  const checkLoginStatus = () => {
      const inputId = formData.id;
      if (!inputId) return;
      
      setStatusCheckLoading(true);
      setTimeout(() => {
          const storedUsersStr = localStorage.getItem('nst_users');
          const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
          const user = users.find(u => u.id === inputId || u.mobile === inputId || u.email === inputId);

          if (user) {
              const requestsStr = localStorage.getItem('nst_recovery_requests');
              const requests: RecoveryRequest[] = requestsStr ? JSON.parse(requestsStr) : [];
              const myRequest = requests.find(r => r.id === user.id);

              if (myRequest && myRequest.status === 'RESOLVED') {
                  const updatedUser = { ...user, isArchived: false, deletedAt: undefined, lastLoginDate: new Date().toISOString() };
                  const updatedReqs = requests.filter(r => r.id !== user.id);
                  localStorage.setItem('nst_recovery_requests', JSON.stringify(updatedReqs));
                  
                  const userIdx = users.findIndex(u => u.id === user.id);
                  users[userIdx] = updatedUser;
                  localStorage.setItem('nst_users', JSON.stringify(users));

                  alert("✅ Admin Approved! Logging you in...");
                  logActivity("RECOVERY_LOGIN", "User logged in via Admin Approval", updatedUser);
                  onLogin(updatedUser);
              } else {
                  setError("Admin has not approved yet. Please wait.");
              }
          }
          setStatusCheckLoading(false);
      }, 1200);
  };

  // --- MAIN FORM SUBMISSION (LOGIN / SIGNUP / ADMIN) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const storedUsersStr = localStorage.getItem('nst_users');
    const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];

    // --- 1. ADMIN LOGIN LOGIC ---
    if (view === 'ADMIN') {
        const allowedEmail = settings?.adminEmail || ADMIN_EMAIL;
        if (!showAdminVerify) {
            if (formData.email.trim() !== allowedEmail) {
                setError('Access Denied. Unauthorized Email.');
                return;
            }
            setShowAdminVerify(true); 
            setError(null);
            return;
        }

        let validCodes = ['NSTA', 'TNASSR@0319#1108', 'NSTA21122025'];
        if (settings?.adminCode) validCodes.push(settings.adminCode);
        
        if (!validCodes.includes(adminAuthCode.trim())) {
            setError('Invalid Verification Code.');
            return;
        }

        let adminUser = users.find(u => u.email === allowedEmail || u.id === 'ADMIN');
        if (!adminUser) {
            adminUser = { id: 'ADMIN', password: '', name: 'System Admin', mobile: '0000000000', email: allowedEmail, role: 'admin', createdAt: new Date().toISOString(), credits: 99999, streak: 999, lastLoginDate: new Date().toISOString(), redeemedCodes: [], progress: {} };
            localStorage.setItem('nst_users', JSON.stringify([...users, adminUser]));
        }
        logActivity("LOGIN", "Admin Logged In", adminUser);
        onLogin(adminUser);
        return;
    }

    // --- 2. STUDENT LOGIN LOGIC ---
    if (view === 'LOGIN') {
      const input = formData.id.trim();
      const pass = formData.password.trim();

      try {
          let loginEmail = input;
          if (!input.includes('@')) {
              const mappedUser = users.find(u => u.id === input || u.mobile === input);
              if (mappedUser && mappedUser.email) {
                  loginEmail = mappedUser.email;
              } else {
                  // Local Fallback Check
                  const legacyUser = users.find(u => (u.id === input || u.mobile === input) && u.password === pass && u.role !== 'admin');
                  if (legacyUser) {
                      if (legacyUser.isArchived) { setError('Account Deleted.'); return; }
                      logActivity("LOGIN", "Student Logged In (Legacy)", legacyUser);
                      onLogin(legacyUser);
                      return;
                  }
                  throw new Error("User not found. Use Email to Login if you recently joined.");
              }
          }

          // FIREBASE AUTH LOGIN
          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, pass);
          const firebaseUser = userCredential.user;

          const appUser = users.find(u => u.email === loginEmail) || {
              id: 'NST-' + firebaseUser.uid.substring(0, 5).toUpperCase(),
              name: firebaseUser.displayName || 'Student',
              email: loginEmail,
              password: '', 
              mobile: '',
              role: 'student',
              createdAt: new Date().toISOString(),
              credits: 0,
              streak: 0,
              lastLoginDate: new Date().toISOString(),
              board: 'CBSE',
              classLevel: '10',
              progress: {},
              redeemedCodes: []
          } as User;

          if (appUser.isArchived) { setError('Account Deleted.'); return; }

          // Sync Status to Cloud
          await updateUserStatus(appUser.id, 0); 
          
          logActivity("LOGIN", "Student Logged In (Firebase Sync)", appUser);
          onLogin(appUser);

      } catch (err: any) {
          setError(err.message || "Login Failed.");
      }

    } else if (view === 'SIGNUP') {
      // --- 3. STUDENT SIGNUP LOGIC (ULTRA LIVE SYNC) ---
      if (!formData.password || !formData.name || !formData.mobile || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }
      if (settings && settings.allowSignup === false) {
          setError('Registration is currently closed by Admin.');
          return;
      }
      if (!validateEmail(formData.email)) {
          setError('Please enter a valid, real Email Address.');
          return;
      }
      if (formData.mobile.length !== 10) {
          setError('Mobile number must be exactly 10 digits.');
          return;
      }

      try {
          // A. Create in Firebase Authentication
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const firebaseUser = userCredential.user;
          
          // Set Display Name in Firebase
          await updateProfile(firebaseUser, { displayName: formData.name });

          const newId = generateUserId();
          const isSenior = formData.classLevel === '11' || formData.classLevel === '12';
          
          // B. Create Full Student Profile Object
          const newUser: User = {
            id: newId,
            uid: firebaseUser.uid, // Store Firebase UID for cross-reference
            password: formData.password, 
            name: formData.name,
            mobile: formData.mobile,
            email: formData.email,
            role: 'student',
            createdAt: new Date().toISOString(),
            credits: settings?.signupBonus || 2,
            streak: 0,
            lastLoginDate: new Date().toISOString(),
            redeemedCodes: [],
            board: formData.board,
            classLevel: formData.classLevel,
            stream: isSenior ? formData.stream : undefined,
            progress: {},
            // INITIAL PREMIUM BONUS (1 Hour)
            subscriptionTier: 'WEEKLY',
            subscriptionEndDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            isPremium: true
          };

          // C. Save Locally (Speed)
          const updatedUsers = [...users, newUser];
          localStorage.setItem('nst_users', JSON.stringify(updatedUsers));
          
          // D. SAVE TO CLOUD (FIRESTORE) - IMPORTANT!
          const firestoreUser = { ...newUser };
          // We keep data but ensure it's secure
          await saveUserToLive(firestoreUser);

          logActivity("SIGNUP", `Live Sync: ${newUser.name} registered for Class ${newUser.classLevel}`, newUser);
          
          setGeneratedId(newId);
          setView('SUCCESS_ID');

      } catch (err: any) {
          setError(err.message || "Signup Error.");
      }
    }
  };

  // SUCCESS SCREEN
  if (view === 'SUCCESS_ID') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md border border-slate-200 text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <ShieldCheck size={40} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">Success!</h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">Account created & synced to Cloud. Your unique ID is ready.</p>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 mb-8 flex items-center justify-between shadow-xl">
                    <span className="text-2xl font-mono font-black text-blue-400 tracking-[0.2em]">{generatedId}</span>
                    <button onClick={handleCopyId} className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:text-blue-400 transition-colors">
                        {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                    </button>
                </div>
                <button onClick={() => setView('LOGIN')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95">Proceed to Login</button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 font-sans py-16">
      <div className="bg-white p-10 rounded-[45px] shadow-2xl w-full max-w-md border border-slate-200 relative overflow-hidden">
        
        {/* CONNECTION INDICATOR */}
        <div className="absolute top-6 right-8 flex items-center gap-1.5">
            {isOnline ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-green-500 uppercase tracking-widest"><Wifi size={10} /> Live</span>
            ) : (
                <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse"><WifiOff size={10} /> Local</span>
            )}
        </div>

        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-blue-600 rounded-3xl shadow-lg shadow-blue-200 mb-4">
              <Sparkles className="text-white" size={32} />
          </div>
          <h1 className="text-5xl font-black text-slate-900 mb-1 tracking-tighter italic">NST</h1>
          <p className="text-blue-600 font-black tracking-[0.3em] text-[10px] uppercase">Smart Study Tracker</p>
        </div>

        <div className="flex items-center gap-3 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <button onClick={() => setView('LOGIN')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${view === 'LOGIN' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Login</button>
            <button onClick={() => setView('SIGNUP')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${view === 'SIGNUP' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Signup</button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-[11px] font-black p-4 rounded-2xl mb-6 border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-4">
            <XCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {view === 'RECOVERY' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100 mb-6">
                    <p className="text-xs text-orange-800 font-black uppercase tracking-wider mb-2 flex items-center gap-1"><ShieldAlert size={14}/> Fast Login</p>
                    <p className="text-[10px] text-orange-600 leading-relaxed font-bold">Admin can approve your login directly. Enter your ID below and request approval.</p>
                </div>

                <div className="space-y-2 mb-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account ID / Mobile</label>
                    <div className="relative">
                        <KeyRound className="absolute left-4 top-4 text-slate-300" size={18} />
                        <input name="id" type="text" placeholder="NST-XXXX-1234" value={formData.id} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                    </div>
                </div>

                {!requestSent ? (
                    <button type="button" onClick={handleRequestLogin} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-slate-200 transition-all active:scale-95">
                        <Send size={18} /> Send Login Request
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center">
                            <p className="text-xs font-black text-green-700">REQUEST ACTIVE</p>
                            <p className="text-[10px] text-green-600 mt-1 font-bold italic">Admin will verify you shortly...</p>
                        </div>
                        <button type="button" onClick={checkLoginStatus} disabled={statusCheckLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all">
                            {statusCheckLoading ? <RefreshCcw size={18} className="animate-spin" /> : <><RefreshCcw size={18} /> Check Approval & Login</>}
                        </button>
                    </div>
                )}
              </div>
          )}

          {view === 'SIGNUP' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input name="name" type="text" placeholder="Rahul" value={formData.name} onChange={handleChange} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile</label>
                        <input name="mobile" type="tel" placeholder="91..." value={formData.mobile} onChange={handleChange} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" maxLength={10} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input name="email" type="email" placeholder="example@gmail.com" value={formData.email} onChange={handleChange} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                    <input name="password" type="password" placeholder="Min 8 Characters" value={formData.password} onChange={handleChange} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" maxLength={20} />
                </div>
                <div className="bg-blue-50/50 p-5 rounded-[32px] border border-blue-100/50 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-blue-400 uppercase ml-1">Board</label>
                        <select name="board" value={formData.board} onChange={handleChange} className="w-full px-3 py-2.5 border border-blue-200 rounded-xl bg-white text-xs font-bold outline-none">
                            <option value="CBSE">CBSE</option>
                            <option value="BSEB">BSEB</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-blue-400 uppercase ml-1">Class</label>
                        <select name="classLevel" value={formData.classLevel} onChange={handleChange} className="w-full px-3 py-2.5 border border-blue-200 rounded-xl bg-white text-xs font-bold outline-none">
                            {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">Register & Sync to Cloud</button>
              </div>
          )}

          {view === 'LOGIN' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login Identity</label>
                    <div className="relative">
                        <UserIcon className="absolute left-4 top-4 text-slate-300" size={18} />
                        <input name="id" type="text" placeholder="ID, Email or Mobile" value={formData.id} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secret Password</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-4 text-slate-300" size={18} />
                        <input name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">Sign In</button>
                 
                 <div className="flex items-center justify-between px-2">
                     <button type="button" onClick={() => setView('RECOVERY')} className="text-[10px] font-black text-orange-500 hover:underline flex items-center gap-1 uppercase tracking-tighter">
                         <RefreshCcw size={10} /> Password-less Login?
                     </button>
                     <button type="button" onClick={() => { setView('ADMIN'); setShowAdminVerify(false); setError(null); }} className="text-[10px] font-black text-slate-300 hover:text-purple-500 transition-colors uppercase tracking-widest">
                         Admin Control
                     </button>
                 </div>
              </div>
          )}
          
          {view === 'ADMIN' && (
              <div className="space-y-5 animate-in slide-in-from-bottom-6 duration-400">
                <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100 text-center">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1">Restricted Area</p>
                    <p className="text-[9px] font-bold text-purple-400 italic">Enter credentials to manage the Smart Tracker system.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Identity</label>
                    <input name="email" type="email" placeholder="admin@nst.com" value={formData.email} onChange={handleChange} disabled={showAdminVerify} className={`w-full px-5 py-4 border rounded-2xl font-bold text-sm ${showAdminVerify ? 'bg-slate-100 text-slate-400' : 'bg-slate-50'}`} />
                </div>
                
                {showAdminVerify && (
                    <div className="space-y-1.5 animate-in zoom-in-95 duration-200">
                        <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Master Access Key</label>
                        <input name="adminAuthCode" type="password" placeholder="••••••••" value={adminAuthCode} onChange={(e) => setAdminAuthCode(e.target.value)} className="w-full px-5 py-4 border border-purple-200 bg-white rounded-2xl font-black text-center text-lg tracking-[0.5em] focus:ring-2 focus:ring-purple-500 outline-none" autoFocus />
                    </div>
                )}

                <button type="submit" className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-100 flex items-center justify-center gap-2 hover:bg-purple-700 transition-all">
                    {showAdminVerify ? <><ShieldCheck size={20} /> Authenticate System</> : 'Verify Email'}
                </button>
              </div>
          )}

        </form>

        {view !== 'LOGIN' && view !== 'SUCCESS_ID' && (
            <div className="mt-8 text-center pt-6 border-t border-slate-50">
                <button onClick={() => { setView('LOGIN'); setError(null); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors">← Back to Portal</button>
            </div>
        )}
      </div>
      
      {/* FOOTER INFO */}
      <div className="fixed bottom-6 text-center w-full">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">© 2025 NST PERSONAL ASSISTANT • LIVE V3.1</p>
      </div>
    </div>
  );
};
