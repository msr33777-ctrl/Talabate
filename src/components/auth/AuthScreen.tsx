import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from '../../firebase';
import { PhoneAuthModal } from '../common/PhoneAuthModal';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Store,
  Bike,
  Heart,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  Building2,
  Truck,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const {
    signInWithGoogle,
    addNotification,
    addAuditLog,
    submitRestaurantApplication,
    submitCourierApplication,
    firebaseUser,
    restaurantApplications,
    courierApplications,
    onboardingIntent,
    setOnboardingIntent,
  } = useApp();

  // Login form state
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Active Modals state
  const [activeModal, setActiveModal] = useState<
    'none' | 'customer_register' | 'forgot_password' | 'restaurant_app' | 'courier_app' | 'phone_auth'
  >('none');

  useEffect(() => {
    if (onboardingIntent === 'restaurant') setActiveModal('restaurant_app');
    else if (onboardingIntent === 'courier') setActiveModal('courier_app');
  }, [onboardingIntent]);

  // Forgot Password modal state
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Customer Signup state
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCity, setCustCity] = useState('بغداد');
  const [custAddress, setCustAddress] = useState('');

  // Restaurant App state
  const [restStoreName, setRestStoreName] = useState('');
  const [restOwnerName, setRestOwnerName] = useState('');
  const [restPhone, setRestPhone] = useState('');
  const [restCategory, setRestCategory] = useState('مشاوي ومأكولات عراقية');
  const [restCity, setRestCity] = useState('بغداد');
  const [restAddress, setRestAddress] = useState('');
  const [restMinOrder, setRestMinOrder] = useState('5000');
  const [restSuccess, setRestSuccess] = useState<string | null>(null);

  // Courier App state
  const [courFullName, setCourFullName] = useState('');
  const [courPhone, setCourPhone] = useState('');
  const [courVehicleType, setCourVehicleType] = useState('دراجة نارية (سكوتر / ستوتة)');
  const [courVehiclePlate, setCourVehiclePlate] = useState('');
  const [courCity, setCourCity] = useState('بغداد');
  const [courAddress, setCourAddress] = useState('');
  const [courSuccess, setCourSuccess] = useState<string | null>(null);

  // User existing applications
  const myRestApp = firebaseUser
    ? restaurantApplications.find((a) => a.userId === firebaseUser.uid || a.applicantUserId === firebaseUser.uid)
    : null;

  const myCourApp = firebaseUser
    ? courierApplications.find((a) => a.userId === firebaseUser.uid || a.applicantUserId === firebaseUser.uid)
    : null;

  // 1. Submit Main Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone || !password) {
      setLoginError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    // Normalize email input
    let targetEmail = emailOrPhone.trim();
    if (!targetEmail.includes('@')) {
      // If user typed a phone number or username, convert to clean test format
      const cleanPhone = targetEmail.replace(/\D/g, '');
      targetEmail = `user_${cleanPhone || 'phone'}@talabi.iq`;
    }

    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);
      addNotification('أهلاً بك بعودتك!', 'تم تسجيل الدخول بنجاح', 'success');
      addAuditLog('USER_LOGIN', 'user', targetEmail, 'تسجيل دخول بنجاح عبر البريد الإلكتروني');
    } catch (err: any) {
      console.warn('Login error:', err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password'
      ) {
        // Auto-provision demo or new credentials seamlessly
        try {
          const newCred = await createUserWithEmailAndPassword(auth, targetEmail, password);
          if (newCred.user) {
            const isAdm = targetEmail.includes('admin');
            const isMer = targetEmail.includes('merchant');
            const isCour = targetEmail.includes('courier');
            const roleTitle = isAdm ? 'المدير' : isMer ? 'صاحب مطعم' : isCour ? 'كابتن توصيل' : 'زبون';
            await updateProfile(newCred.user, { displayName: roleTitle });
            addNotification('مرحباً بك!', `تم إنشاء الحساب وتسجيل الدخول بنجاح كـ ${roleTitle}`, 'success');
            return;
          }
        } catch {
          setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.');
        }
      } else if (err.code === 'auth/invalid-email') {
        setLoginError('صيغة البريد الإلكتروني غير صحيحة');
      } else {
        setLoginError(err.message || 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Demo Account Quick Fill Helper
  const handleDemoFill = (email: string) => {
    setEmailOrPhone(email);
    setPassword('123456');
    setLoginError(null);
  };

  // 3. Password Reset Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetErr('يرجى كتابة البريد الإلكتروني أولاً');
      return;
    }
    setIsResetting(true);
    setResetErr(null);
    setResetMsg(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMsg(`تم إرسال رابط تعيين كلمة المرور إلى البريد: ${resetEmail}`);
      addNotification('إعادة تعيين كلمة المرور', 'تم إرسال الرابط إلى البريد الإلكتروني بنجاح', 'info');
    } catch (err: any) {
      setResetErr('تعذر إرسال الرابط. تأكد من أن البريد الإلكتروني مسجل مسبقاً.');
    } finally {
      setIsResetting(false);
    }
  };

  // 4. Customer Signup Submit
  const handleCustomerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custEmail || !custPassword || !custPhone) {
      setLoginError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }
    setIsLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, custEmail, custPassword);
      await updateProfile(userCred.user, { displayName: custName });
      addNotification('أهلاً بك في طلبي!', `تم إنشاء حساب الزبون (${custName}) بنجاح`, 'success');
      setActiveModal('none');
    } catch (err: any) {
      setLoginError(err.message || 'فشل إنشاء الحساب.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Restaurant App Submit
  const handleRestaurantAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting restaurant app...', { firebaseUser, restStoreName });
    if (!firebaseUser) {
      setLoginError('يرجى تسجيل الدخول بحساب Google أولاً لتقديم الطلب');
      return;
    }
    if (!restStoreName || !restOwnerName || !restPhone || !restAddress) {
      setLoginError('يرجى تعبئة الحقول الأساسية');
      return;
    }
    setIsLoading(true);
    const res = await submitRestaurantApplication({
      storeName: restStoreName,
      ownerName: restOwnerName,
      ownerPhone: restPhone,
      phone: restPhone,
      category: restCategory,
      city: restCity,
      address: restAddress,
      minOrder: Number(restMinOrder) || 5000,
    });
    setIsLoading(false);
    console.log('Restaurant app response:', res);
    if (res.success) {
      setRestSuccess(`تم إرسال طلب انضمام مطعم (${restStoreName}) بنجاح! الطلب الآن قيد المراجعة والتدقيق لدى الإدارة.`);
    } else {
      setLoginError(res.error || 'حدث خطأ أثناء تقديم الطلب');
    }
  };

  // 6. Courier App Submit
  const handleCourierAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting courier app...', { firebaseUser, courFullName });
    if (!firebaseUser) {
      setLoginError('يرجى تسجيل الدخول بحساب Google أولاً لتقديم الطلب');
      return;
    }
    if (!courFullName || !courPhone || !courVehiclePlate || !courAddress) {
      setLoginError('يرجى تعبئة بيانات الكابتن بالكامل');
      return;
    }
    setIsLoading(true);
    const res = await submitCourierApplication({
      fullName: courFullName,
      phone: courPhone,
      vehicleType: courVehicleType,
      vehiclePlate: courVehiclePlate,
      city: courCity,
      address: courAddress,
    });
    setIsLoading(false);
    console.log('Courier app response:', res);
    if (res.success) {
      setCourSuccess(`تم إرسال طلب انضمام الكابتن (${courFullName}) بنجاح! الطلب قيد المراجعة لدى الإدارة.`);
    } else {
      setLoginError(res.error || 'حدث خطأ أثناء تقديم الطلب');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF5F5] via-[#FFF8F8] to-[#FFEBEB] text-[#1E293B] flex flex-col justify-between items-center p-3 sm:p-6 relative overflow-x-hidden font-['Cairo',sans-serif]" dir="rtl">
      
      {/* Decorative Background Accents */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-rose-100/60 to-transparent pointer-events-none -z-10"></div>
      
      {/* Top Banner: Logo & Scooter Illustration */}
      <div className="w-full max-w-md pt-4 pb-2 px-2 flex items-center justify-between gap-2 z-10">
        {/* Right side: TALABI Logo & Tagline */}
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            {/* Cloche & Location Pin SVG */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#EF3838] via-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                <span className="text-white font-black text-2xl tracking-tighter">ط</span>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 border-2 border-white"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-[#172554] leading-none">
                TALABI
              </span>
              <span className="text-[11px] font-bold text-slate-500 mt-1">
                طعامك يوصل لباب بيتك
              </span>
            </div>
          </div>
        </div>

        {/* Left side: Red Scooter Graphic */}
        <div className="relative w-36 h-28 flex items-center justify-center">
          {/* Subtle City Skyline & Pin Background */}
          <div className="absolute top-2 right-4 w-10 h-10 rounded-full bg-rose-200/50 flex items-center justify-center animate-pulse">
            <MapPin className="w-6 h-6 text-rose-500 fill-rose-500/30" />
          </div>

          {/* Delivery Scooter Artwork */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative w-28 h-20 bg-contain bg-no-repeat bg-center flex items-center justify-center">
              {/* Custom SVG Red Scooter */}
              <svg viewBox="0 0 200 140" className="w-28 h-20 drop-shadow-md">
                {/* Red Box */}
                <rect x="25" y="30" width="50" height="45" rx="8" fill="#EF3838" />
                <path d="M 35 50 Q 50 38 65 50" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
                {/* Scooter Body */}
                <path d="M 70 70 L 110 70 L 135 50 L 150 50 C 155 50 160 58 150 75 L 125 78 Z" fill="#EF3838" />
                <path d="M 125 78 L 105 100 L 60 100 L 65 75 Z" fill="#DC2626" />
                {/* Seat */}
                <rect x="75" y="60" width="40" height="12" rx="6" fill="#1E293B" />
                {/* Handlebars */}
                <path d="M 135 50 L 140 30 L 125 28" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
                <circle cx="140" cy="28" r="5" fill="#EF3838" />
                {/* Wheels */}
                <circle cx="55" cy="100" r="18" fill="#1E293B" />
                <circle cx="55" cy="100" r="8" fill="#94A3B8" />
                <circle cx="145" cy="100" r="18" fill="#1E293B" />
                <circle cx="145" cy="100" r="8" fill="#94A3B8" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-xl border border-rose-100/70 p-6 sm:p-7 space-y-5 my-auto z-10 backdrop-blur-xs">
        
        {/* Title Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-[#172554] tracking-tight">
            مرحباً بعودتك
          </h2>
          <p className="text-xs font-semibold text-slate-400">
            سجل الدخول إلى حسابك للمتابعة
          </p>
        </div>

        {/* Error Banner */}
        {loginError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        {/* Main Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          {/* Email or Phone Input */}
          <div className="relative">
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="البريد الإلكتروني أو رقم الهاتف"
              className="w-full bg-slate-50/80 border border-slate-200 focus:border-rose-500 focus:bg-white text-slate-900 px-4 py-3.5 pr-11 rounded-2xl text-xs font-bold outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              required
            />
            <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              className="w-full bg-slate-50/80 border border-slate-200 focus:border-rose-500 focus:bg-white text-slate-900 px-11 py-3.5 rounded-2xl text-xs font-bold outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              required
            />
            <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-[#EF3838] rounded-md cursor-pointer"
              />
              <span>تذكرني</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setResetEmail(emailOrPhone.includes('@') ? emailOrPhone : '');
                setActiveModal('forgot_password');
              }}
              className="text-[#2563EB] hover:underline font-extrabold"
            >
              نسيت كلمة المرور؟
            </button>
          </div>

        {/* Primary Red Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 bg-[#EF3838] hover:bg-rose-600 active:scale-[0.99] text-white rounded-2xl font-black text-sm shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <span>جاري التحقق وتسجيل الدخول...</span>
          ) : (
            <>
              <LogIn className="w-5 h-5 transform rotate-180" />
              <span>تسجيل الدخول</span>
            </>
          )}
        </button>
      </form>

      {/* Divider */}
        <div className="relative my-3 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-3 text-xs font-bold text-slate-400">
            أو
          </span>
        </div>

        {/* Real Google Login Button (Highly Recommended for msr33777@gmail.com) */}
        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-sm group"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>المتابعة باستخدام حساب Google</span>
        </button>

        {/* Create New Account Button (Blue Outline) */}
        <button
          type="button"
          onClick={() => setActiveModal('customer_register')}
          className="w-full py-3.5 bg-white hover:bg-blue-50/50 border-2 border-[#3B82F6] text-[#1E293B] rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <UserPlus className="w-5 h-5 text-[#3B82F6]" />
          <span>إنشاء حساب جديد</span>
        </button>

        {/* Quick Demo Credentials Assistant */}
        <div className="pt-1">
          <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-2xl space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-700 font-bold">
              <span className="flex items-center gap-1 text-rose-600">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تجربة الحسابات التجريبية بنقرة واحدة:</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => handleDemoFill('admin@talabi.iq')}
                className="px-2 py-1 bg-white hover:bg-rose-100/50 text-slate-800 rounded-lg border border-slate-200 truncate text-right"
              >
                👑 مدير: admin@talabi.iq
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('merchant@burgerland.iq')}
                className="px-2 py-1 bg-white hover:bg-rose-100/50 text-slate-800 rounded-lg border border-slate-200 truncate text-right"
              >
                🍔 مطعم: merchant@burgerland.iq
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('courier@talabi.iq')}
                className="px-2 py-1 bg-white hover:bg-rose-100/50 text-slate-800 rounded-lg border border-slate-200 truncate text-right"
              >
                🏍️ كابتن: courier@talabi.iq
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('customer@talabi.iq')}
                className="px-2 py-1 bg-white hover:bg-rose-100/50 text-slate-800 rounded-lg border border-slate-200 truncate text-right"
              >
                👤 زبون: customer@talabi.iq
              </button>
            </div>
          </div>
        </div>

        {/* Partners & Applications Section ("للمطاعم والمندوبين") */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="text-center space-y-0.5">
            <h3 className="text-sm font-black text-[#1E293B]">
              للمطاعم والمندوبين
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              انضم إلينا وابدأ رحلتك معنا
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Restaurant Application Button */}
            <button
              type="button"
              onClick={() => {
                setOnboardingIntent('restaurant');
                setActiveModal('restaurant_app');
              }}
              className="p-3 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-2xl transition-all flex items-center justify-between text-right group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                  التقديم كمطعم
                </span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:-translate-x-0.5" />
            </button>

            {/* Courier Application Button */}
            <button
              type="button"
              onClick={() => {
                setOnboardingIntent('courier');
                setActiveModal('courier_app');
              }}
              className="p-3 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all flex items-center justify-between text-right group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bike className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                  التقديم كمندوب توصيل
                </span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:-translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Footer Heart Tagline */}
        <div className="text-center pt-2">
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
            <span className="h-px w-10 bg-slate-200"></span>
            <p className="flex items-center gap-1">
              <span>نحن نربطك بأفضل المطاعم وأسرع المندوبين</span>
              <Heart className="w-3.5 h-3.5 fill-[#EF3838] text-[#EF3838] inline" />
            </p>
            <span className="h-px w-10 bg-slate-200"></span>
          </div>
        </div>
      </div>

      {/* Bottom Wave Background Graphic Accent */}
      <div className="w-full max-w-md h-6 bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 rounded-t-full mt-4 opacity-80 shrink-0"></div>

      {/* MODAL 1: CUSTOMER SIGNUP MODAL */}
      {activeModal === 'customer_register' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-[#172554]">إنشاء حساب زبون جديد</h3>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCustomerRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="مثال: علي الحسين"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    dir="ltr"
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف العراقي</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="07701234567"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
                  <select
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="بغداد">بغداد</option>
                    <option value="البصرة">البصرة</option>
                    <option value="أربيل">أربيل</option>
                    <option value="النجف">النجف</option>
                    <option value="كربلاء">كربلاء</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="بغداد - المنصور - شارع الرواد"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
                >
                  {isLoading ? 'جاري التسجيل...' : 'إنشاء الحساب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FORGOT PASSWORD MODAL */}
      {activeModal === 'forgot_password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-extrabold text-base text-[#172554]">إعادة تعيين كلمة المرور</h3>
              </div>
              <button
                onClick={() => {
                  setActiveModal('none');
                  setResetErr(null);
                  setResetMsg(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              أدخل البريد الإلكتروني الخاص بحسابك وسنرسل لك رابطاً لإعادة تعيين كلمة المرور عبر Firebase Auth.
            </p>

            {resetMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{resetMsg}</span>
              </div>
            )}

            {resetErr && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{resetErr}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  dir="ltr"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
                >
                  {isResetting ? 'جاري الإرسال...' : 'إرسال رابط التعيين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESTAURANT APPLICATION MODAL */}
      {activeModal === 'restaurant_app' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-[#172554]">التقديم كمطعم / ماركت جديد</h3>
              </div>
              <button
                onClick={() => {
                  setActiveModal('none');
                  setRestSuccess(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!firebaseUser ? (
              /* Google Auth Enforcement Gate */
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-md">
                  <Store className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 text-sm">مطلوب تسجيل الدخول بحساب Google</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    لتقديم طلب انضمام مطعم وتوثيق بياناتك بأمان، يرجى الاستمرار وتسجيل الدخول بحساب Google الخاص بك (بدون كلمة مرور جديدة).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2.5 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>تسجيل الدخول باستخدام Google لتقديم الطلب</span>
                </button>
              </div>
            ) : myRestApp && !restSuccess ? (
              /* Display Existing Application Status */
              <div className="p-4 rounded-2xl border space-y-3 bg-slate-50 text-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">حالة طلب الانضمام:</span>
                  {myRestApp.status === 'pending' && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span>قيد المراجعة</span>
                    </span>
                  )}
                  {myRestApp.status === 'approved' && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تمت الموافقة</span>
                    </span>
                  )}
                  {myRestApp.status === 'rejected' && (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>مرفوض</span>
                    </span>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <p className="font-black text-slate-900">{myRestApp.storeName}</p>
                  <p className="text-slate-600">المالك: {myRestApp.ownerName}</p>
                  <p className="text-slate-600">رقم الهاتف: {myRestApp.ownerPhone}</p>
                  <p className="text-slate-600">العنوان: {myRestApp.address}</p>
                </div>

                {myRestApp.status === 'pending' && (
                  <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                    طلبك قيد المراجعة والتدقيق لدى المدير حالياً. لا يمكنك تقديم طلب آخر حتى يتم اتخاذ القرار.
                  </p>
                )}

                {myRestApp.status === 'approved' && (
                  <p className="text-xs text-emerald-800 font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 leading-relaxed">
                    مبارك! تمت الموافقة على طلب انضمام المطعم وتفعيل الصلاحيات. يمكنك البدء بإدارة قائمة الطعام والمبيعات.
                  </p>
                )}

                {myRestApp.status === 'rejected' && (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-800 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200 leading-relaxed">
                      تم رفض طلب الانضمام. {myRestApp.adminNotes ? `سبب الرفض: ${myRestApp.adminNotes}` : ''}
                    </p>
                  </div>
                )}
              </div>
            ) : restSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>تم استلام طلب انضمام المطعم</span>
                </div>
                <p className="leading-relaxed">{restSuccess}</p>
                <button
                  onClick={() => {
                    setActiveModal('none');
                    setRestSuccess(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleRestaurantAppSubmit} className="space-y-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    الطلب ينشأ بحالة (قيد المراجعة) ويتم إرساله للمدير للموافقة وتفعيل الحساب.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المطعم / الماركت</label>
                  <input
                    type="text"
                    value={restStoreName}
                    onChange={(e) => setRestStoreName(e.target.value)}
                    placeholder="مثال: مطعم مشاوي بغداد الكبرى"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم صاحب المطعم</label>
                    <input
                      type="text"
                      value={restOwnerName || firebaseUser?.displayName || ''}
                      onChange={(e) => setRestOwnerName(e.target.value)}
                      placeholder="الاسم الثلاثي"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف المطعم</label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={restPhone}
                      onChange={(e) => setRestPhone(e.target.value)}
                      placeholder="07701234567"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تصنيف النشاط</label>
                    <select
                      value={restCategory}
                      onChange={(e) => setRestCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                    >
                      <option value="مشاوي ومأكولات عراقية">مشاوي ومأكولات عراقية</option>
                      <option value="برغر ووجبات سريعة">برغر ووجبات سريعة</option>
                      <option value="بيتزا ومعجنات">بيتزا ومعجنات</option>
                      <option value="حلويات ومقاهي">حلويات ومقاهي</option>
                      <option value="ماركت وبقالة">ماركت وبقالة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
                    <select
                      value={restCity}
                      onChange={(e) => setRestCity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                    >
                      <option value="بغداد">بغداد</option>
                      <option value="البصرة">البصرة</option>
                      <option value="أربيل">أربيل</option>
                      <option value="النجف">النجف</option>
                      <option value="كربلاء">كربلاء</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان المطعم وموقعه بالتفصيل</label>
                  <input
                    type="text"
                    value={restAddress}
                    onChange={(e) => setRestAddress(e.target.value)}
                    placeholder="بغداد - المنصور - شارع الرواد"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'جاري التقديم...' : 'إرسال طلب الانضمام للمدير'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: COURIER APPLICATION MODAL */}
      {activeModal === 'courier_app' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Bike className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-[#172554]">التقديم كمندوب توصيل (كابتن)</h3>
              </div>
              <button
                onClick={() => {
                  setActiveModal('none');
                  setCourSuccess(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!firebaseUser ? (
              /* Google Auth Enforcement Gate */
              <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <Bike className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 text-sm">مطلوب تسجيل الدخول بحساب Google</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    لتقديم طلب انضمامك ككابتن وسيلة نقل، يرجى الاستمرار وتسجيل الدخول بحساب Google الخاص بك (بدون كلمة مرور جديدة).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2.5 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>تسجيل الدخول باستخدام Google لتقديم الطلب</span>
                </button>
              </div>
            ) : myCourApp && !courSuccess ? (
              /* Display Existing Application Status */
              <div className="p-4 rounded-2xl border space-y-3 bg-slate-50 text-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">حالة طلب الانضمام ككابتن:</span>
                  {myCourApp.status === 'pending' && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span>قيد المراجعة</span>
                    </span>
                  )}
                  {myCourApp.status === 'approved' && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تمت الموافقة</span>
                    </span>
                  )}
                  {myCourApp.status === 'rejected' && (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>مرفوض</span>
                    </span>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <p className="font-black text-slate-900">{myCourApp.fullName}</p>
                  <p className="text-slate-600">رقم الهاتف: {myCourApp.phone}</p>
                  <p className="text-slate-600">المركبة: {myCourApp.vehicleType} ({myCourApp.vehiclePlate})</p>
                  <p className="text-slate-600">منطقة العمل والسكن: {myCourApp.address}</p>
                </div>

                {myCourApp.status === 'pending' && (
                  <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                    طلبك قيد تدقيق المستندات لدى إدارة العمليات حالياً. لا يمكنك تقديم طلب متكرر.
                  </p>
                )}

                {myCourApp.status === 'approved' && (
                  <p className="text-xs text-emerald-800 font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 leading-relaxed">
                    مبارك! تمت الموافقة على طلبك ككابتن توصيل وتفعيل حسابك بنجاح.
                  </p>
                )}

                {myCourApp.status === 'rejected' && (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-800 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200 leading-relaxed">
                      تم رفض الطلب. {myCourApp.adminNotes ? `السبب: ${myCourApp.adminNotes}` : ''}
                    </p>
                  </div>
                )}
              </div>
            ) : courSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>تم استلام طلب التقديم ككابتن</span>
                </div>
                <p className="leading-relaxed">{courSuccess}</p>
                <button
                  onClick={() => {
                    setActiveModal('none');
                    setCourSuccess(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleCourierAppSubmit} className="space-y-3">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
                  <Truck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    الطلب يُحفظ بحالة (قيد المراجعة) ويُعرض في لوحة الإدارة للموافقة وتفعيل الحساب.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للكابتن</label>
                  <input
                    type="text"
                    value={courFullName || firebaseUser?.displayName || ''}
                    onChange={(e) => setCourFullName(e.target.value)}
                    placeholder="مثال: حيدر كاظم عبود"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={courPhone}
                      onChange={(e) => setCourPhone(e.target.value)}
                      placeholder="07701234567"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع المركبة</label>
                    <select
                      value={courVehicleType}
                      onChange={(e) => setCourVehicleType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                    >
                      <option value="دراجة نارية (سكوتر / ستوتة)">دراجة نارية / سكوتر</option>
                      <option value="سيارة صالون خفيفة">سيارة صالون</option>
                      <option value="ستوتة توصيل باص">ستوتة أو باص صغير</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم اللوحة / السنوية</label>
                    <input
                      type="text"
                      value={courVehiclePlate}
                      onChange={(e) => setCourVehiclePlate(e.target.value)}
                      placeholder="بغداد - 12345 أ"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
                    <select
                      value={courCity}
                      onChange={(e) => setCourCity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                    >
                      <option value="بغداد">بغداد</option>
                      <option value="البصرة">البصرة</option>
                      <option value="أربيل">أربيل</option>
                      <option value="النجف">النجف</option>
                      <option value="كربلاء">كربلاء</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">منطقة العمل والسكن الحالية</label>
                  <input
                    type="text"
                    value={courAddress}
                    onChange={(e) => setCourAddress(e.target.value)}
                    placeholder="بغداد - الكرادة الشرقية"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'جاري التقديم...' : 'إرسال طلب الانضمام للمدير'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
