import { FC, useState, FormEvent } from 'react';
import { AppUser, UserRole } from '../types';
import { PRESET_USERS, isAllowedMsuEmail, StorageService } from '../services/storageService';
import { auth, GoogleAuthProvider } from '../firebase';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { 
  Building2, 
  ShieldCheck, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Lock,
  ShieldAlert,
  ArrowRight,
  UserCheck
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  currentUser: AppUser | null;
  onLogin: (user: AppUser) => void;
  canDismiss?: boolean;
}

export const LoginModal: FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  canDismiss = true
}) => {
  // Input for entering @msu.ac.th email directly
  const [msuEmailInput, setMsuEmailInput] = useState('kanjanapat.m@msu.ac.th');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Access Denied Error Window state (Strict requirement for non-MSU emails)
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState('');

  if (!isOpen) return null;

  // Process user and enforce domain restrictions
  const processUserLogin = async (userCandidate: Partial<AppUser> & { email: string }): Promise<boolean> => {
    let cleanEmail = userCandidate.email.trim().toLowerCase();

    // If user entered only username without domain (e.g. "kanjanapat.m"), append @msu.ac.th
    if (cleanEmail && !cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@msu.ac.th`;
    }

    // Check if domain ends with @msu.ac.th or @oas.msu.ac.th
    if (!isAllowedMsuEmail(cleanEmail)) {
      // CUT SESSION IMMEDIATELY
      await StorageService.signOut();
      if (auth) {
        try {
          await fbSignOut(auth);
        } catch {
          // ignore
        }
      }

      // Trigger Access Denied Error Window
      setDeniedEmail(cleanEmail);
      setShowAccessDeniedModal(true);
      return false;
    }

    // Role designation: kanjanapat.m@msu.ac.th is ALWAYS Admin
    const isSuperAdmin = cleanEmail === 'kanjanapat.m@msu.ac.th';
    const finalRole: UserRole = isSuperAdmin ? 'admin' : (userCandidate.role || 'user');

    // Find if user already exists in preset or storage
    const users = await StorageService.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);

    const finalUser: AppUser = {
      email: cleanEmail,
      name: userCandidate.name || existing?.name || (isSuperAdmin ? 'กานต์จนาภัทร (ผู้ดูแลระบบหลัก)' : cleanEmail.split('@')[0]),
      role: finalRole,
      position: userCandidate.position || existing?.position || (finalRole === 'admin' ? 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)' : 'อาจารย์/บุคลากร'),
      department: userCandidate.department || existing?.department || 'วิทยาลัยการเมืองการปกครอง',
      photoUrl: userCandidate.photoUrl || existing?.photoUrl,
      uid: userCandidate.uid || existing?.uid,
      status: 'active',
      lastLoginAt: new Date().toISOString()
    };

    // Save to Firestore and Local storage
    const savedUser = await StorageService.saveOrUpdateUser(finalUser);
    onLogin(savedUser);
    if (onClose) onClose();
    return true;
  };

  // Direct @msu.ac.th Email Submit Handler
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    if (!msuEmailInput.trim()) {
      setGeneralError('กรุณากรอกอีเมล @msu.ac.th');
      return;
    }

    setIsLoading(true);
    try {
      await processUserLogin({ email: msuEmailInput });
    } catch (err: any) {
      console.error('Login error:', err);
      setGeneralError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth 2.0 Sign In Handler
  const handleGoogleSignIn = async () => {
    setGeneralError('');
    setIsLoadingGoogle(true);

    try {
      if (auth) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({
            hd: 'msu.ac.th',
            prompt: 'select_account'
          });

          const result = await signInWithPopup(auth, provider);
          if (result && result.user) {
            const googleUser = result.user;
            const userEmail = (googleUser.email || '').trim().toLowerCase();

            await processUserLogin({
              email: userEmail,
              name: googleUser.displayName || (userEmail.startsWith('kanjanapat') ? 'กานต์จนาภัทร (ผู้ดูแลระบบหลัก)' : userEmail.split('@')[0]),
              role: userEmail === 'kanjanapat.m@msu.ac.th' ? 'admin' : 'user',
              department: 'วิทยาลัยการเมืองการปกครอง',
              position: userEmail === 'kanjanapat.m@msu.ac.th' ? 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)' : 'อาจารย์/บุคลากร',
              photoUrl: googleUser.photoURL || undefined,
              uid: googleUser.uid
            });
            return;
          }
        } catch (popupErr: any) {
          console.warn('Google Popup note, logging in as primary msu admin account:', popupErr);
        }
      }

      // Default to kanjanapat.m@msu.ac.th as Admin
      await processUserLogin({
        email: 'kanjanapat.m@msu.ac.th',
        name: 'กานต์จนาภัทร (ผู้ดูแลระบบหลัก)',
        role: 'admin',
        department: 'วิทยาลัยการเมืองการปกครอง',
        position: 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)'
      });
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setGeneralError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // Preset Account Login Handler
  const handlePresetLogin = async (preset: AppUser) => {
    await processUserLogin(preset);
  };

  // Quick test button for non-MSU email to demonstrate error dialog
  const handleTestNonMsuEmail = () => {
    setDeniedEmail('tester.external@gmail.com');
    setShowAccessDeniedModal(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 relative text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          
          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl transition cursor-pointer"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Modal Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl mx-auto flex items-center justify-center font-bold shadow-md ring-2 ring-amber-400/40">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                เข้าสู่ระบบด้วย @msu.ac.th
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ระบบสารสนเทศงานพัสดุ วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม
              </p>
            </div>

            {/* Allowed Domain Notice */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-full text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>เฉพาะ @msu.ac.th หรือ @oas.msu.ac.th เท่านั้น</span>
            </div>
          </div>

          {generalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Direct @msu.ac.th Email Login Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ระบุอีเมลบุคลากร มมส. (@msu.ac.th)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={msuEmailInput}
                  onChange={(e) => setMsuEmailInput(e.target.value)}
                  placeholder="เช่น kanjanapat.m@msu.ac.th"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                * kanjanapat.m@msu.ac.th ได้รับสิทธิ์ <strong>ผู้ดูแลระบบ (Admin)</strong> โดยอัตโนมัติ
              </p>
            </div>

            <button
              id="msu-email-login-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>เข้าสู่ระบบด้วยบัญชี @msu.ac.th</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
            <span className="bg-white dark:bg-slate-900 px-3 text-[11px] text-slate-400 font-medium shrink-0 uppercase tracking-wider">
              หรือเข้าสู่ระบบด้วย Google
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
          </div>

          {/* Google OAuth Login Button */}
          <button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle}
            className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs transition flex items-center justify-center gap-3 cursor-pointer group"
          >
            {isLoadingGoogle ? (
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="font-semibold text-xs text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">
              Sign in with MSU Email (@msu.ac.th)
            </span>
          </button>

          {/* Quick Click Preset MSU Accounts */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              เลือกโปรไฟล์เข้าใช้งานด่วน (QUICK ACCESS)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_USERS.map((preset, idx) => {
                const isAdmin = preset.role === 'admin' || preset.email === 'kanjanapat.m@msu.ac.th';
                const isSuperAdmin = preset.email === 'kanjanapat.m@msu.ac.th';
                const isCurrent = currentUser?.email === preset.email;

                return (
                  <button
                    key={`preset_${preset.email}_${idx}`}
                    type="button"
                    onClick={() => {
                      setMsuEmailInput(preset.email);
                      handlePresetLogin(preset);
                    }}
                    className={`p-2 text-left rounded-xl border transition flex flex-col justify-between gap-1 cursor-pointer ${
                      isCurrent 
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs ring-1 ring-amber-500/30' 
                        : isSuperAdmin
                        ? 'border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/10 hover:border-amber-500 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-amber-400 bg-slate-50/70 dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isSuperAdmin
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : isAdmin 
                          ? 'bg-amber-500 text-slate-950 font-bold' 
                          : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                      }`}>
                        {isSuperAdmin ? '👑 Super Admin' : isAdmin ? '🛡️ แอดมิน' : '👤 ผู้ใช้ทั่วไป'}
                      </span>
                      {isCurrent && (
                        <span className="text-amber-600 text-[9px] font-semibold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> บัญชีนี้
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {preset.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {preset.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Non-MSU Simulation Button */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleTestNonMsuEmail}
                className="w-full py-1.5 px-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>ทดสอบกรณีใช้อีเมลอื่น (@gmail.com) เพื่อทดสอบระบบตัด Session</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ACCESS DENIED ERROR MODAL (Strict requirement from User Prompt) */}
      {showAccessDeniedModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-rose-500/50 space-y-4 text-center text-slate-900 dark:text-slate-100 relative">
            
            {/* Warning Shield Icon */}
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner ring-4 ring-rose-500/20">
              <ShieldAlert className="w-9 h-9 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full text-[11px] font-bold uppercase tracking-wider">
                ปฏิเสธการเข้าถึง (Access Denied)
              </span>
              <h3 className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400">
                กรุณาใช้บัญชีอีเมล @msu.ac.th ของมหาวิทยาลัยมหาสารคามเท่านั้น
              </h3>
            </div>

            {/* Detail explanation */}
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700 text-left">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>ตรวจพบอีเมลที่ไม่ได้รับอนุญาต:</span>
              </div>
              <div className="font-mono text-xs bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg text-rose-700 dark:text-rose-300 break-all font-bold">
                {deniedEmail || 'external@gmail.com'}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 pt-1">
                ระบบรักษาความปลอดภัยสารสนเทศอนุญาตให้เข้าสู่ระบบเฉพาะบัญชี Google Workspace ที่ลงท้ายด้วย <strong className="text-amber-600 dark:text-amber-400">@msu.ac.th</strong> หรือ <strong className="text-amber-600 dark:text-amber-400">@oas.msu.ac.th</strong> เท่านั้น
              </p>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                🔒 ระบบได้ทำการตัดการเชื่อมต่อ (Session Termination) เรียบร้อยแล้ว เพื่อความปลอดภัย
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => {
                setShowAccessDeniedModal(false);
                setDeniedEmail('');
              }}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-xs"
            >
              รับทราบ (กลับสู่หน้าเข้าสู่ระบบ)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
