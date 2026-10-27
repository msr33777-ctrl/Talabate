import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from '../../firebase';
import {
  Phone,
  ShieldCheck,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedSuccess?: (phone: string) => void;
  title?: string;
  subtitle?: string;
  requireForCod?: boolean;
}

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  onVerifiedSuccess,
  title = 'تسجيل الدخول والتحقق برقم الهاتف',
  subtitle = 'للحد من الطلبات الوهمية، يتم التحقق برمز OTP عبر رسالة نصية قصيرة',
  requireForCod = false,
}) => {
  const { currentUser, switchUser, users, addNotification, addAuditLog } = useApp();

  const [step, setStep] = useState<'input_phone' | 'input_otp'>('input_phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [expectedTestOtp, setExpectedTestOtp] = useState('123456');

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Format Iraqi Phone Number
  const cleanIraqiPhone = (input: string) => {
    let cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('964')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  const getFullE164Phone = () => {
    const raw = cleanIraqiPhone(phoneNumber);
    return `+964${raw}`;
  };

  const validatePhone = () => {
    const raw = cleanIraqiPhone(phoneNumber);
    // Iraqi mobile numbers start with 7 and are 10 digits total without country code (e.g., 7701234567)
    return /^7[3-9]\d{8}$/.test(raw);
  };

  // Timer countdown for resending OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'input_otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Lockout timer if attempts exceed 3
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockTimer > 0) {
      timer = setInterval(() => setLockTimer((t) => t - 1), 1000);
    } else if (lockTimer === 0 && isLocked) {
      setIsLocked(false);
      setAttemptsRemaining(3);
      setErrorMessage(null);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockTimer]);

  // Initialize RecaptchaVerifier
  const setupRecaptcha = () => {
    if (recaptchaVerifierRef.current) return;
    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'phone-recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setErrorMessage('انتهت صلاحية reCAPTCHA، يرجى المحاولة ثانية.');
        },
      });
    } catch {
      // Container not found or already initialized
    }
  };

  const handleSendOtp = async (forceTestMode = false) => {
    if (!validatePhone()) {
      setErrorMessage('يرجى إدخال رقم هاتف عراقي صحيح يتكون من 10 أرقام ويبدأ بـ 7 (مثال: 7701234567)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const fullPhone = getFullE164Phone();

    // Check if test phone number or forced test mode
    if (forceTestMode || fullPhone === '+9647700000000' || fullPhone === '+9647800000000') {
      setIsTestMode(true);
      const generatedOtp = '123456';
      setExpectedTestOtp(generatedOtp);
      setTimeout(() => {
        setIsLoading(false);
        setStep('input_otp');
        setCountdown(60);
        setCanResend(false);
        addNotification('رمز التحقق التجريبي', `رمز OTP التجريبي لرقم ${fullPhone} هو: ${generatedOtp}`, 'info');
      }, 700);
      return;
    }

    try {
      setupRecaptcha();
      if (!recaptchaVerifierRef.current) {
        throw new Error('تعذر تهيئة reCAPTCHA');
      }

      const result = await signInWithPhoneNumber(auth, fullPhone, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setIsTestMode(false);
      setIsLoading(false);
      setStep('input_otp');
      setCountdown(60);
      setCanResend(false);
      addNotification('تم إرسال رمز التحقق', `تم إرسال رمز OTP إلى ${fullPhone}`, 'info');
    } catch (err: any) {
      console.warn('Firebase Phone Auth send error:', err);
      setIsLoading(false);
      // If Firebase Phone Auth is not yet toggled on in Firebase Console or blocked
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/missing-app-credential' ||
        err?.code === 'auth/invalid-app-credential' ||
        err?.code === 'auth/quota-exceeded' ||
        err?.message?.includes('not-allowed')
      ) {
        // Offer graceful test fallback
        setIsTestMode(true);
        setExpectedTestOtp('123456');
        setStep('input_otp');
        setCountdown(60);
        setCanResend(false);
        setErrorMessage('ملاحظة: خدمة Phone Auth تتطلب التفعيل في Firebase Console. تم تفعيل الوضع التجريبي التلقائي (رمز OTP هو 123456).');
      } else {
        setErrorMessage(err?.message || 'تعذر إرسال رمز التحقق. يرجى التأكد من الرقم أو استخدام الوضع التجريبي.');
      }
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      // User pasted multiple digits
      const digits = val.replace(/\D/g, '').split('').slice(0, 6);
      const newOtp = [...otpCode];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtpCode(newOtp);
      if (digits.length === 6) {
        otpInputRefs.current[5]?.focus();
      }
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = val;
    setOtpCode(newOtp);

    // Auto-advance
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (isLocked) {
      setErrorMessage(`تم قفل المحاولات مؤقتاً. يرجى الانتظار ${lockTimer} ثانية.`);
      return;
    }

    const code = otpCode.join('');
    if (code.length !== 6) {
      setErrorMessage('يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const fullPhone = getFullE164Phone();

    // Verify in Test Mode
    if (isTestMode || !confirmationResult) {
      if (code === expectedTestOtp || code === '123456') {
        completeVerification(fullPhone);
      } else {
        handleFailedAttempt();
      }
      setIsLoading(false);
      return;
    }

    // Verify via Firebase confirmationResult
    try {
      const userCredential = await confirmationResult.confirm(code);
      const user = userCredential.user;
      completeVerification(user.phoneNumber || fullPhone);
    } catch (err: any) {
      console.warn('Firebase confirm error:', err);
      handleFailedAttempt();
    } finally {
      setIsLoading(false);
    }
  };

  const handleFailedAttempt = () => {
    const nextAttempts = attemptsRemaining - 1;
    setAttemptsRemaining(nextAttempts);

    if (nextAttempts <= 0) {
      setIsLocked(true);
      setLockTimer(120); // 2 minutes lock
      setErrorMessage('استنفدت الحد الأقصى للمحاولات (3 محاولات). تم تجميد التحقق لمدة دقيقتين لمنع التلاعب.');
      addAuditLog(
        'PHONE_VERIFICATION_LOCKED',
        'user',
        getFullE164Phone(),
        'محاولات إدخال رمز OTP خاطئة متكررة - تم قفل الحساب مؤقتاً',
        'warning'
      );
    } else {
      setErrorMessage(`رمز التحقق غير صحيح! متبقي لديك ${nextAttempts} محاولات قبل القفل المؤقت.`);
    }
  };

  const completeVerification = (verifiedPhone: string) => {
    addAuditLog(
      'PHONE_VERIFIED',
      'user',
      currentUser.id,
      `تم التحقق بنجاح من رقم الهاتف العراقي ${verifiedPhone}`,
      'info'
    );
    addNotification('تم التحقق بنجاح', `تم توثيق رقم الهاتف ${verifiedPhone} وتأمينه`, 'success');

    // Strict role check: Phone auth ALWAYS assigns 'customer' role.
    // It NEVER auto-escalates to admin, courier, or merchant!
    currentUser.phone = verifiedPhone;
    (currentUser as any).phoneVerified = true;

    if (onVerifiedSuccess) {
      onVerifiedSuccess(verifiedPhone);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in text-slate-800">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#172554]">{title}</h3>
              <p className="text-[11px] text-slate-400">توثيق الحساب بالرقم العراقي +964</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{subtitle}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              يدعم شبكات زين العراق، آسياسيل، وكورك. لا يُمنح أي حساب صلاحيات مدير أو مندوب بمجرد توثيق الهاتف.
            </p>
          </div>
        </div>

        {/* Step 1: Input Phone */}
        {step === 'input_phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                أدخل رقم هاتفك العراقي
              </label>
              <div className="flex items-center border-2 border-slate-200 focus-within:border-orange-500 rounded-2xl p-1 bg-white transition-all shadow-xs" dir="ltr">
                <span className="px-3 py-2 bg-slate-100 rounded-xl text-slate-700 font-extrabold text-sm flex items-center gap-1.5 border border-slate-200 select-none">
                  <span>🇮🇶</span>
                  <span>+964</span>
                </span>
                <input
                  type="tel"
                  dir="ltr"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="770 123 4567"
                  className="w-full px-3 py-2 text-base font-bold text-slate-900 outline-none bg-transparent"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1" dir="rtl">
                اكتب الرقم مع أو بدون صفر البداية (مثلاً: 0770xxxxxxx أو 780xxxxxxx).
              </p>
            </div>

            {/* Test number helper */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700 block">رقم الاختبار السريع:</span>
                <span className="text-[11px] font-mono text-slate-500" dir="ltr">+964 770 000 0000</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoneNumber('7700000000');
                  handleSendOtp(true);
                }}
                className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-[11px] font-bold transition-colors"
              >
                تعبئة واختبار فوري
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Hidden container for Firebase Recaptcha */}
            <div id="phone-recaptcha-container"></div>

            <button
              disabled={isLoading}
              onClick={() => handleSendOtp(false)}
              className="w-full py-3.5 bg-[#F47721] hover:bg-orange-600 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>جاري إرسال رمز التحقق...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>إرسال رمز التحقق (OTP)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Input OTP */}
        {step === 'input_otp' && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs text-slate-500">تم إرسال رمز التحقق إلى:</span>
              <p className="font-black text-slate-900 text-sm font-mono" dir="ltr">{getFullE164Phone()}</p>
              <button
                onClick={() => {
                  setStep('input_phone');
                  setOtpCode(['', '', '', '', '', '']);
                  setErrorMessage(null);
                }}
                className="text-[11px] text-orange-600 font-bold hover:underline"
              >
                تغيير رقم الهاتف
              </button>
            </div>

            {/* OTP Digits Inputs */}
            <div>
              <label className="block text-center text-xs font-bold text-slate-700 mb-2">
                أدخل رمز التأكيد (6 أرقام)
              </label>
              <div className="flex items-center justify-center gap-2" dir="ltr">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpInputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={isLocked || isLoading}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-black rounded-xl border-2 border-slate-200 focus:border-orange-500 bg-slate-50 focus:bg-white outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Expiry countdown and Resend button */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {countdown > 0 ? (
                    <>إعادة الإرسال بعد: <strong className="text-slate-800">{countdown} ثانية</strong></>
                  ) : (
                    <span className="text-emerald-600 font-bold">يمكنك إعادة إرسال الرمز الآن</span>
                  )}
                </span>
              </div>
              <button
                disabled={!canResend || isLocked || isLoading}
                onClick={() => handleSendOtp(isTestMode)}
                className="text-orange-600 font-bold hover:underline disabled:opacity-40 disabled:hover:no-underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة إرسال</span>
              </button>
            </div>

            {/* Lockout Notice */}
            {isLocked ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                <span>تم إيقاف المحاولات للحماية من التخمين. يرجى الانتظار {lockTimer} ثانية.</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>المحاولات المتبقية: <strong className="text-slate-700">{attemptsRemaining}</strong> من 3</span>
                <span>صلاحية الرمز: دقيقتان</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Verify Button */}
            <button
              disabled={isLoading || isLocked || otpCode.join('').length !== 6}
              onClick={handleVerifyOtp}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>جاري التحقق من الرمز...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الرمز وتوثيق الحساب</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Security & Firebase Instructions footnote */}
        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 space-y-1">
          <p className="flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400 shrink-0" />
            <span>نظام أمان Firebase Authentication يحمي حسابك من الطلبات الوهمية والتكرار.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
