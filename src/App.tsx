import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { AuthScreen } from './components/auth/AuthScreen';
import { CustomerView } from './components/customer/CustomerView';
import { MerchantView } from './components/merchant/MerchantView';
import { CourierView } from './components/courier/CourierView';
import { AdminView } from './components/admin/AdminView';
import { SupportDeskView } from './components/support/SupportDeskView';
import { NotificationsToast } from './components/common/NotificationsToast';
import { ApplicationStatusScreen } from './components/onboarding/ApplicationStatusScreen';
import {
  Wifi,
  Battery,
  Signal,
  Smartphone,
  Monitor,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    role,
    isAdmin,
    isMobileFrame,
    setIsMobileFrame,
    firebaseUser,
    currentUser,
    isAuthReady,
    onboardingIntent,
    courierApplications,
    restaurantApplications,
    roleMismatchWarning,
    clearRoleMismatchWarning,
    signOut,
  } = useApp();

  // 1. Loading state during Firebase Auth check
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-['Cairo',sans-serif]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F47721] to-amber-500 text-white flex items-center justify-center font-black text-3xl shadow-xl animate-bounce">
            ط
          </div>
          <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
            <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            <span>جاري التحقق من جلسة المصادقة...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated user -> MUST see AuthScreen first (No bypass allowed)
  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]">
        <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
          {isMobileFrame ? (
            <div className="w-full max-w-[420px] my-auto">
              <div className="relative mx-auto rounded-[46px] border-[10px] border-slate-800 bg-[#FAF5F5] shadow-2xl overflow-hidden ring-1 ring-white/10 text-slate-800 flex flex-col min-h-[820px] max-h-[88vh]">
                {/* Android Status Bar */}
                <div className="bg-[#172554] text-white px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-bold select-none shrink-0 z-30">
                  <div className="flex items-center gap-1.5">
                    <span>9:41</span>
                    <span className="text-[10px] bg-orange-500/80 text-white px-1 rounded font-black">طلبي</span>
                  </div>
                  <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700/80 -mt-1 shadow-inner"></div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Signal className="w-3 h-3 text-emerald-400" />
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px]">100%</span>
                      <Battery className="w-3.5 h-3.5 fill-current text-white" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#FAF5F5] via-[#FFF8F8] to-[#FFEBEB]">
                  <AuthScreen />
                </div>

                <div className="bg-[#FFEBEB] py-2 px-6 flex items-center justify-center shrink-0 border-t border-rose-200/50 z-30">
                  <div className="w-32 h-1 bg-slate-400 rounded-full"></div>
                </div>
              </div>

              <div className="text-center mt-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                <span>معاينة واجهة الدخول الموحدة (طِبق الصورة المرجعية)</span>
                <span>•</span>
                <button
                  onClick={() => setIsMobileFrame(false)}
                  className="text-orange-400 font-bold hover:underline"
                >
                  التبديل إلى الشاشة الكاملة
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl bg-gradient-to-b from-[#FAF5F5] via-[#FFF8F8] to-[#FFEBEB] rounded-3xl shadow-2xl border border-rose-100 p-2 overflow-hidden my-auto">
              <AuthScreen />
            </div>
          )}
        </main>
        <NotificationsToast />
      </div>
    );
  }

  // 3. Authenticated user -> Render Header and active role view with Account Type Locking
  const renderActiveView = () => {
    if (onboardingIntent !== 'none') {
      return <AuthScreen />;
    }

    // 1. Admin accounts: strictly require verified Firebase Custom Claim (tokenResult.claims.role === 'admin')
    if (isAdmin) {
      switch (role) {
        case 'admin':
          return <AdminView />;
        case 'merchant':
          return <MerchantView />;
        case 'courier':
          return <CourierView />;
        case 'support':
          return <SupportDeskView />;
        default:
          return <CustomerView />;
      }
    }

    const userAccountType =
      currentUser?.accountType && currentUser.accountType !== 'admin'
        ? currentUser.accountType
        : role === 'merchant'
        ? 'restaurant'
        : role === 'courier'
        ? 'courier'
        : 'customer';

    // 2. Courier account type: Check application status
    if (userAccountType === 'courier') {
      const myCourApp = courierApplications.find(
        (a) => a.userId === firebaseUser?.uid || a.applicantUserId === firebaseUser?.uid
      );

      // If no application submitted yet, or pending, or rejected:
      if (!myCourApp || myCourApp.status !== 'approved') {
        return <ApplicationStatusScreen type="courier" />;
      }

      // Approved courier -> opens CourierView only
      return <CourierView />;
    }

    // 3. Restaurant account type: Check application status
    if (userAccountType === 'restaurant') {
      const myRestApp = restaurantApplications.find(
        (a) => a.userId === firebaseUser?.uid || a.applicantUserId === firebaseUser?.uid
      );

      // If no application submitted yet, or pending, or rejected:
      if (!myRestApp || myRestApp.status !== 'approved') {
        return <ApplicationStatusScreen type="restaurant" />;
      }

      // Approved restaurant -> opens MerchantView only
      return <MerchantView />;
    }

    // 4. Customer account type -> opens CustomerView only
    return <CustomerView />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Top Global Navigation Bar */}
      <Header />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 overflow-x-hidden">
        {isMobileFrame ? (
          /* Android Phone Simulation Container */
          <div className="w-full max-w-[420px] my-auto">
            {/* Phone Device Shell */}
            <div className="relative mx-auto rounded-[46px] border-[10px] border-slate-800 bg-[#F8FAFC] shadow-2xl overflow-hidden ring-1 ring-white/10 text-slate-800 flex flex-col min-h-[820px] max-h-[88vh]">
              {/* Android Top Bezel / Status Bar */}
              <div className="bg-[#172554] text-white px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-bold select-none shrink-0 z-30">
                <div className="flex items-center gap-1.5">
                  <span>4:30</span>
                  <span className="text-[10px] bg-orange-500/80 text-white px-1 rounded font-black">طلبي</span>
                </div>

                {/* Camera punch-hole simulation */}
                <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700/80 -mt-1 shadow-inner"></div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <Signal className="w-3 h-3 text-emerald-400" />
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px]">98%</span>
                    <Battery className="w-3.5 h-3.5 fill-current text-white" />
                  </div>
                </div>
              </div>

              {/* Scrollable Android App Screen */}
              <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                {renderActiveView()}
              </div>

              {/* Android Bottom Navigation Pill Gesture Bar */}
              <div className="bg-[#F8FAFC] py-2 px-6 flex items-center justify-center shrink-0 border-t border-slate-200/80 z-30">
                <div className="w-32 h-1 bg-slate-400 rounded-full"></div>
              </div>
            </div>

            {/* Hint underneath phone frame */}
            <div className="text-center mt-3 text-xs text-slate-400 flex items-center justify-center gap-2">
              <span>معاينة واجهة Android الموحدة</span>
              <span>•</span>
              <button
                onClick={() => setIsMobileFrame(false)}
                className="text-orange-400 font-bold hover:underline"
              >
                التبديل إلى شاشة سطح المكتب الكاملة
              </button>
            </div>
          </div>
        ) : (
          /* Full Desktop / Responsive View */
          <div className="w-full bg-[#F8FAFC] rounded-3xl shadow-2xl border border-slate-800 min-h-[85vh] text-slate-800 overflow-hidden">
            {renderActiveView()}
          </div>
        )}
      </main>

      {/* Floating Notifications */}
      <NotificationsToast />

      {/* Role Mismatch Cross-Path Warning Modal */}
      {roleMismatchWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 border border-slate-100 text-center font-['Cairo',sans-serif]">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-base text-[#172554]">
                تنبيه نظام تثبيت نوع الحساب
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {roleMismatchWarning.message}
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={clearRoleMismatchWarning}
                className="w-full py-3 bg-[#172554] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                المتابعة بحسابي الحالي
              </button>
              <button
                type="button"
                onClick={signOut}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition"
              >
                تسجيل الخروج والتبديل لحساب آخر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
