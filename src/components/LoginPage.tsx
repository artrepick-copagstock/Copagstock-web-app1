import { FC, useState } from 'react';
import { AppUser } from '../types';
import { StorageService, isAllowedMsuEmail, PRESET_USERS } from '../services/storageService';
import { auth, GoogleAuthProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { 
  ShieldCheck,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: AppUser) => void;
}

export const LoginPage: FC<LoginPageProps> = ({ onLogin }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Authenticate and validate user email
  const authenticateUser = async (email: string, displayName?: string, photoURL?: string, uid?: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('กรุณาเข้าสู่ระบบด้วยอีเมล @msu.ac.th');
      return false;
    }

    // Strict validation: must be @msu.ac.th or @oas.msu.ac.th
    if (!isAllowedMsuEmail(cleanEmail)) {
      setErrorMessage(`❌ อีเมล "${cleanEmail}" ไม่ถูกต้อง ระบบอนุญาตเฉพาะบัญชีอีเมล @msu.ac.th ของมหาวิทยาลัยมหาสารคามเท่านั้น`);
      return false;
    }

    setErrorMessage('');

    // Determine admin or regular user
    const isSuperAdmin = cleanEmail === 'kanjanapat.m@msu.ac.th' || cleanEmail === 'artrepick@gmail.com';
    const existing = PRESET_USERS.find(p => p.email.toLowerCase() === cleanEmail);

    const targetUser: AppUser = {
      email: cleanEmail,
      name: displayName || existing?.name || (isSuperAdmin ? 'กานต์จนาภัทร (ผู้ดูแลระบบหลัก)' : cleanEmail.split('@')[0]),
      role: isSuperAdmin ? 'admin' : (existing?.role || 'user'),
      department: existing?.department || 'วิทยาลัยการเมืองการปกครอง',
      position: existing?.position || (isSuperAdmin ? 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)' : 'อาจารย์/บุคลากร'),
      photoUrl: photoURL || existing?.photoUrl,
      uid: uid || existing?.uid,
      status: 'active',
      lastLoginAt: new Date().toISOString()
    };

    // Save session and enter application
    StorageService.setCurrentUser(targetUser);
    await StorageService.saveOrUpdateUser(targetUser);
    onLogin(targetUser);
    return true;
  };

  // Google OAuth / Firebase Sign-in handler strictly using @msu.ac.th
  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle) return;
    setErrorMessage('');
    setIsLoadingGoogle(true);

    try {
      if (auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account',
          hd: 'msu.ac.th'
        });

        const result = await signInWithPopup(auth, provider);
        if (result && result.user) {
          const googleUser = result.user;
          const userEmail = (googleUser.email || '').trim().toLowerCase();

          const success = await authenticateUser(
            userEmail,
            googleUser.displayName || undefined,
            googleUser.photoURL || undefined,
            googleUser.uid
          );
          if (success) return;
        } else {
          setErrorMessage('ไม่พบข้อมูลบัญชี กรุณาลองใหม่อีกครั้ง');
        }
      } else {
        setErrorMessage('ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      console.warn('Google Sign-in Note:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสิ้น กรุณาลองใหม่อีกครั้ง');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMessage('เบราว์เซอร์บล็อกหน้าต่างป็อปอัป กรุณาอนุญาตป็อปอัปสำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง');
      } else {
        setErrorMessage('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Centered Minimal Card - Exactly as shown in the screenshot */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-xl dark:shadow-2xl space-y-6 text-center">
        
        {/* Shield Icon Badge */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
          <ShieldCheck className="w-7 h-7" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            ระบบเบิกจ่ายและคลังพัสดุ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            เข้าสู่ระบบด้วยบัญชีอีเมลมหาวิทยาลัยมหาสารคาม (@msu.ac.th)
          </p>
        </div>

        {/* Error Alert Message Box */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900/80 text-rose-700 dark:text-rose-200 rounded-2xl text-xs flex items-start gap-2.5 text-left animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="font-semibold leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* PRIMARY BUTTON: "Sign in with MSU Email (@msu.ac.th)" */}
        <div className="space-y-3.5 pt-1">
          <button
            id="msu-oauth-login-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle}
            className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-2xl shadow-sm hover:shadow-md transition flex items-center justify-center gap-3 cursor-pointer group text-sm select-none"
          >
            {isLoadingGoogle ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="w-6 h-6 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              </div>
            )}
            <span className="truncate">Sign in with MSU Email (@msu.ac.th)</span>
            <ChevronRight className="w-4 h-4 text-slate-900 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Under Button Note from the screenshot */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>อนุญาตเฉพาะบัญชีอีเมล <strong>@msu.ac.th</strong> ของ มมส. เท่านั้น</span>
          </div>
        </div>

      </div>

    </div>
  );
};
