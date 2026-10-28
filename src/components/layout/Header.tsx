import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { PhoneAuthModal } from '../common/PhoneAuthModal';
import {
  ShoppingBag,
  Store,
  Bike,
  ShieldAlert,
  Headphones,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Clock,
  LogIn,
  LogOut,
  Database,
  Cloud,
  CheckCircle,
  Phone,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    role,
    setRole,
    currentUser,
    users,
    switchUser,
    isMobileFrame,
    setIsMobileFrame,
    isSimulatedOffline,
    setIsSimulatedOffline,
    orders,
    couriers,
    conversations,
    setActiveTrackedOrderId,
    firebaseUser,
    signInWithGoogle,
    signOut,
    firestoreConnected,
  } = useApp();

  const [showDbModal, setShowDbModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const rolesConfig: { id: UserRole; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      id: 'customer',
      title: 'الزبون',
      subtitle: 'طلب الطعام والمقاضي',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: 'merchant',
      title: 'المطعم / الماركت',
      subtitle: 'إدارة الطلبات والمنيو',
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: 'courier',
      title: 'المندوب',
      subtitle: 'استلام وتوصيل الطلبات',
      icon: <Bike className="w-4 h-4" />,
    },
    {
      id: 'admin',
      title: 'المدير',
      subtitle: 'غرفة العمليات والمراقبة',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'support',
      title: 'الدعم الفني',
      subtitle: 'محادثات خدمة العملاء',
      icon: <Headphones className="w-4 h-4" />,
    },
  ];

  // Badges calculations
  const customerActiveOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const merchantPendingOrders = orders.filter((o) => o.status === 'created' || o.status === 'merchant_accepted');
  const courierDeliverable = orders.filter((o) => o.status === 'ready_for_pickup' && !o.courierId);
  const openSupportTickets = conversations.filter((c) => c.status === 'open');

  return (
    <header className="sticky top-0 z-40 bg-[#172554] text-white border-b border-slate-800 shadow-md">
      {/* Offline Simulation warning banner */}
      {isSimulatedOffline && (
        <div className="bg-rose-600 text-white text-xs py-1 px-4 text-center font-bold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>تنبيه: أنت في وضع محاكاة انقطاع الإنترنت (Offline Mode). اضغط لإعادة الاتصال بالخادم.</span>
          <button
            onClick={() => setIsSimulatedOffline(false)}
            className="underline mr-2 bg-white/20 px-2 py-0.5 rounded text-[11px]"
          >
            إلغاء المحاكاة
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F47721] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-950/40">
              <span className="text-white font-extrabold text-lg">ط</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">طلبي</span>
                <span className="text-xs font-bold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                  TALABI
                </span>
                {/* Cloud DB indicator */}
                <button
                  onClick={() => setShowDbModal(true)}
                  className="hidden lg:flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full hover:bg-emerald-500/30 transition-colors"
                  title="عرض تفاصيل قاعدة بيانات Firestore الحقيقية"
                >
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span>Firestore مفعّل</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-300 hidden sm:block">كلشي تريده، لحد بابك • أسرع • أسهل • أوفر</p>
            </div>
          </div>
        </div>

        {/* Roles Navigation Pill Switcher */}
        {firebaseUser ? (
          (() => {
            const isAdminUser =
              currentUser.role === 'admin' ||
              (firebaseUser &&
                (firebaseUser.email?.toLowerCase() === 'msr33777@gmail.com' ||
                  firebaseUser.email?.toLowerCase() === 'admin@talabi.iq' ||
                  firebaseUser.email?.toLowerCase() === 'admin.operations@talabi.iq'));

            if (isAdminUser) {
              return (
                <nav className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-700/60 overflow-x-auto max-w-full">
                  {rolesConfig.map((r) => {
                    const isActive = role === r.id;
                    let badgeCount = 0;
                    if (r.id === 'customer') badgeCount = customerActiveOrders.length;
                    if (r.id === 'merchant') badgeCount = merchantPendingOrders.length;
                    if (r.id === 'courier') badgeCount = courierDeliverable.length;
                    if (r.id === 'support') badgeCount = openSupportTickets.length;

                    return (
                      <button
                        key={r.id}
                        onClick={() => setRole(r.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all relative whitespace-nowrap ${
                          isActive
                            ? 'bg-[#F47721] text-white shadow-md'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        }`}
                      >
                        {r.icon}
                        <span>{r.title}</span>
                        {badgeCount > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              isActive ? 'bg-white text-[#F47721]' : 'bg-orange-500 text-white'
                            }`}
                          >
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              );
            }

            const activeRoleConfig = rolesConfig.find((r) => r.id === role) || rolesConfig[0];
            return (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-700 text-xs font-bold text-orange-400">
                {activeRoleConfig.icon}
                <span>دورك الحالي: {activeRoleConfig.title}</span>
              </div>
            );
          })()
        ) : null}

        {/* Controls: Auth, Mobile toggle, Offline toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Active Order shortcut */}
          {customerActiveOrders.length > 0 && role === 'customer' && (
            <button
              onClick={() => setActiveTrackedOrderId(customerActiveOrders[0].id)}
              className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600/40 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>تتبع الطلب</span>
            </button>
          )}

          {/* Real Authentication button */}
          {firebaseUser ? (
            <div className="flex items-center gap-1.5 bg-slate-800/90 py-1 px-2 rounded-xl border border-slate-700 text-xs">
              {firebaseUser.photoURL ? (
                <img src={firebaseUser.photoURL} alt="User" className="w-5 h-5 rounded-full" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">
                  {firebaseUser.email?.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[75px] truncate text-[11px] font-medium hidden sm:inline">
                {firebaseUser.displayName || firebaseUser.email}
              </span>
              <button
                onClick={signOut}
                title="تسجيل الخروج"
                className="text-slate-400 hover:text-rose-400 p-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowPhoneModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#F47721] text-white hover:bg-orange-600 transition-colors shadow-xs"
                title="تسجيل الدخول برقم الهاتف العراقي +964 مع رمز OTP"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دخول بالهاتف 🇮🇶</span>
              </button>

              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors shadow-xs"
                title="تسجيل الدخول الحقيقي بحساب Google لحفظ طلباتك في السحابة"
              >
                <LogIn className="w-3.5 h-3.5 text-orange-500" />
                <span className="hidden sm:inline">Google</span>
              </button>
            </div>
          )}

          {/* Toggle Phone Frame View vs Full Responsive View */}
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            title={isMobileFrame ? 'تبديل إلى العرض الكامل' : 'تبديل إلى إطار هاتف أندرويد'}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            {isMobileFrame ? (
              <Smartphone className="w-4 h-4 text-orange-400" />
            ) : (
              <Monitor className="w-4 h-4 text-sky-400" />
            )}
          </button>

          {/* Network Simulator toggle */}
          <button
            onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
            title={isSimulatedOffline ? 'إعادة الاتصال بالإنترنت' : 'محاكاة انقطاع الإنترنت'}
            className={`p-1.5 rounded-xl text-xs transition-colors border ${
              isSimulatedOffline
                ? 'bg-rose-700 text-white border-rose-600 animate-pulse'
                : 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isSimulatedOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cloud Services Modal Info */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-[#172554]">تفاصيل قاعدة البيانات السحابية (Firestore)</h3>
              </div>
              <button onClick={() => setShowDbModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>تم ربط قاعدة البيانات الحقيقية وتفعيلها بنجاح:</span>
                </div>
                <p>• <strong>معرّف المشروع:</strong> subtle-ranger-fsmzh</p>
                <p>• <strong>قاعدة البيانات:</strong> ai-studio-talabi-6a8714a3-14fa-4b58-aad4-fced9a57737b</p>
                <p>• <strong>حالة الاتصال:</strong> {firestoreConnected ? 'متصل ومحدث آنياً (Live)' : 'جاري الفحص'}</p>
                <p>• <strong>خدمة المصادقة:</strong> Firebase Authentication (Google Login)</p>
              </div>

              <div className="text-slate-600 space-y-1 pt-1">
                <p className="font-bold text-slate-800">المجموعات (Collections) المنشأة:</p>
                <p>• <code>orders</code>: لتخزين وتتبع الطلبات المباشرة بدقة مع تاريخ الحالات.</p>
                <p>• <code>support_conversations</code>: لمحادثات خدمة العملاء والمناديب.</p>
                <p>• <code>audit_logs</code>: لسجل الرقابة وتدقيق العمليات والتوقيت الزمني.</p>
                <p>• <code>stores</code> & <code>products</code>: لقوائم المطاعم والأصناف.</p>
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button
                onClick={() => setShowDbModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Auth Modal for Iraqi Phone Login */}
      <PhoneAuthModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        title="تسجيل الدخول بالهاتف العراقي (+964)"
        subtitle="أدخل رقمك العراقي لاستلام رمز التحقق OTP وتوثيق حسابك في طلبي"
      />
    </header>
  );
};
