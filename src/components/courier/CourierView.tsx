import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { InAppSupportChatModal } from '../common/InAppSupportChatModal';
import { LeafletMapComponent } from '../common/LeafletMapComponent';
import { LocationCoordinates, Order } from '../../types';
import {
  Bike,
  Power,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  AlertCircle,
  HelpCircle,
  Banknote,
  Store as StoreIcon,
  MessageCircle,
  Menu,
  Percent,
  Crosshair,
  TrendingUp,
  Gift,
  X,
  Star,
  Compass,
  ArrowRight,
  MessageSquare,
  Info,
  Check,
  UserCheck,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  Bell,
  Home,
  User as UserIcon,
  Layers,
  ArrowLeft,
  XCircle,
  PhoneIncoming,
  RotateCcw,
} from 'lucide-react';

export const CourierView: React.FC = () => {
  const {
    couriers,
    toggleCourierStatus,
    orders,
    courierDeliverOrder,
    updateOrderStatus,
    updateCourierLocation,
    startSupportConversation,
    setRole,
    addNotification,
    addAuditLog,
    getCourierRatings,
    pricingSettings,
    conversations,
    claimOrderAtomically,
    rejectOrderOffer,
  } = useApp();

  // Active courier details (Default: أحمد محمد as in reference image)
  const fallbackCourier = {
    id: 'cour_1',
    userId: 'user_cour_1',
    name: 'أحمد محمد',
    phone: '07701234567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    vehicleType: 'دراجة نارية',
    vehiclePlate: 'بغداد 10101 أ',
    isOnline: true,
    rating: 4.9,
    ratingCount: 142,
    completedOrdersCount: 450,
    totalDeliveries: 450,
    totalEarnings: 1350000,
    walletBalance: 25000,
    currentLocationName: 'بغداد - شارع فلسطين',
    approvalStatus: 'approved' as const,
  };

  const [selectedCourierId, setSelectedCourierId] = useState<string>(couriers[0]?.id || 'cour_1');
  const currentCourier = couriers.find((c) => c.id === selectedCourierId) || couriers[0] || fallbackCourier;
  const courierRatings = getCourierRatings(currentCourier?.id || 'cour_1');

  // Screen View state: matches reference image screens 1-8
  // 'splash' | 'map' (Screen 2) | 'orders' (Screen 3) | 'detail' (Screen 4) | 'navigation' (Screen 5) | 'timeline' (Screen 6) | 'victory' (Screen 7) | 'call' (Screen 8) | 'profile'
  const [currentScreen, setCurrentScreen] = useState<string>('map');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [showCustomerCallModal, setShowCustomerCallModal] = useState<boolean>(false);

  // Modals & Drawers
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isIncentivesModalOpen, setIsIncentivesModalOpen] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showMapInfoModal, setShowMapInfoModal] = useState(false);

  // Active order assigned to this courier (Max 1 active order)
  const activeOrder = orders.find(
    (o) =>
      o.courierId === currentCourier.id &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled'
  );

  // Unassigned available orders: dispatched to couriers immediately upon creation, without waiting for merchant acceptance or food preparation
  const availableOrders = orders.filter(
    (o) =>
      !o.courierId &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled' &&
      o.status !== 'picked_up' &&
      o.status !== 'courier_arrived' &&
      !(o.rejectedCourierIds || []).includes(currentCourier.id)
  );

  // 15-second Exclusive Dispatch Offer logic
  const offeredOrder = !activeOrder && currentCourier.isOnline && availableOrders.length > 0
    ? availableOrders[0]
    : null;

  const [timerSeconds, setTimerSeconds] = useState<number>(15);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  // GPS Location
  const [captainCoords, setCaptainCoords] = useState<LocationCoordinates>({
    lat: 33.3152,
    lng: 44.3541,
    accuracy: 15,
    isManualPin: false,
    verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
  });

  // Timer Effect for 15-second Offer
  useEffect(() => {
    if (!offeredOrder) {
      setTimerSeconds(15);
      return;
    }

    setTimerSeconds(15);
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          rejectOrderOffer(offeredOrder.id, currentCourier.id);
          addNotification('انتهت المهلة', `تم تحويل الطلب #${offeredOrder.id.slice(-4)} لكابتن آخر`, 'info');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [offeredOrder?.id, currentCourier.id]);

  // Handle Accept Exclusive Claim with Atomic Lock
  const handleAcceptClaim = async (ord: Order) => {
    setIsClaiming(true);
    const res = await claimOrderAtomically(ord.id, currentCourier.id);
    setIsClaiming(false);
    if (res.success) {
      setSelectedOrderForDetail(null);
      setCurrentScreen('map');
    }
  };

  // Handle Reject Offer
  const handleRejectClaim = async (ordId: string) => {
    await rejectOrderOffer(ordId, currentCourier.id);
    setSelectedOrderForDetail(null);
    addNotification('تم رفض الطلب', 'تم إلغاء العرض وإعادة الطلب لقائمة التوزيع العام', 'info');
  };

  // Complete delivery
  const handleCompleteDelivery = () => {
    if (!activeOrder) return;
    courierDeliverOrder(currentCourier.id, activeOrder.id);
    setCurrentScreen('victory');
    addNotification('مبارك! تم إتمام التوصيل', 'أضيفت أرباح الطلب ومستحقاتك فورياً إلى محفظتك', 'success');
  };

  const formatWhatsAppUrl = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('964')) clean = `964${clean}`;
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 flex flex-col relative overflow-hidden select-none font-sans" dir="rtl">
      {/* Demo Quota Banner requirement as per skill */}
      <div id="gmp-quota-banner" className="hidden bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs text-center sticky top-0 z-50">
        <span>
          Google Maps Platform quota reached. If you are the app owner, visit{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-amber-950"
          >
            maps developer site
          </a>
        </span>
      </div>

      {/* ================= HEADER BAR (Top Status Bar & User Profile Header) ================= */}
      {currentScreen !== 'splash' && currentScreen !== 'call' && (
        <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between shadow-lg border-b border-slate-800 z-30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentCourier.avatar}
                alt={currentCourier.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-md"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1E293B] ${
                  currentCourier.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </div>
            <div>
              <h2 className="font-black text-sm text-white flex items-center gap-1.5">
                <span>{currentCourier.name}</span>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  متصل
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCommissionModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 border border-white/10"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              <span>{(currentCourier?.walletBalance ?? 0).toLocaleString()} د.ع</span>
            </button>

            <button
              onClick={() => setIsProfileDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ================= MAIN VIEWPORT CONTENT ================= */}
      <div className="flex-1 relative overflow-hidden bg-slate-100 flex flex-col">
        {/* ================= SCREEN 1: SPLASH / START JOURNEY ================= */}
        {currentScreen === 'splash' && (
          <div className="flex-1 bg-white flex flex-col items-center justify-between p-6 text-center animate-fadeIn">
            <div className="w-full pt-8 space-y-4">
              <div className="w-24 h-24 mx-auto bg-rose-50 rounded-full flex items-center justify-center shadow-inner">
                <Bike className="w-14 h-14 text-[#E11D48]" />
              </div>
              <h1 className="text-3xl font-black text-[#1E293B] tracking-tight">TALABI</h1>
              <p className="text-sm font-bold text-slate-500">توصيل أسرع .. حياة أسهل</p>
            </div>

            <div className="w-full max-w-xs space-y-6 my-auto">
              <img
                src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80"
                alt="Talabi Scooter"
                className="w-full h-48 object-cover rounded-3xl shadow-xl border-4 border-rose-100"
              />
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                مرحباً بك في منصة طلبي العراقية. ابدأ رحلتك التوصيلية واستقبل الطلبات الحصرية مباشرة!
              </p>
            </div>

            <div className="w-full max-w-xs space-y-3 pb-6">
              <button
                onClick={() => {
                  toggleCourierStatus(currentCourier.id);
                  setCurrentScreen('map');
                }}
                className="w-full py-4 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
              >
                بدء الرحلة
              </button>
              <button
                onClick={() => setCurrentScreen('map')}
                className="w-full py-2.5 text-[#E11D48] font-bold text-xs flex items-center justify-center gap-1 hover:underline"
              >
                <span>تسجيل الدخول</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 2: REAL GOOGLE MAP DASHBOARD ================= */}
        {currentScreen === 'map' && (
          <div className="relative w-full flex-1 bg-slate-200 overflow-hidden flex flex-col">
            {/* Live Interactive Leaflet OpenStreetMap Canvas */}
            <div className="absolute inset-0 z-0">
              <LeafletMapComponent
                captainCoords={captainCoords}
                restaurantCoords={{ lat: 33.3225, lng: 44.3685 }}
                customerCoords={activeOrder?.customer.coordinates || { lat: 33.3080, lng: 44.3410 }}
                storeName={activeOrder?.storeName || 'مطعم البيتزا الإيطالي'}
                customerName={activeOrder?.customer.name || 'الزبون'}
                showRoute={Boolean(activeOrder)}
                className="w-full h-full"
              />
            </div>

            {/* Recenter & Map Controls */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setCaptainCoords({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: Math.round(pos.coords.accuracy),
                        verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
                      });
                      addNotification('موقعك الفعلي', 'تم تثبيت إحداثياتك الميدانية على خرائط Google', 'success');
                    });
                  }
                }}
                className="w-11 h-11 rounded-2xl bg-white text-slate-800 flex items-center justify-center shadow-xl border border-slate-200 active:scale-95 transition-all"
                title="تحديد الموقع الحالي"
              >
                <Crosshair className="w-5 h-5 text-[#E11D48]" />
              </button>
            </div>

            {/* Floating Order Overlay Card matching Screen 2 */}
            {activeOrder ? (
              <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-4 border border-slate-200 animate-slideUp">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-black text-slate-400">#{activeOrder.id.slice(-6)}</span>
                  
                  {/* Decoupled Status Badge */}
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                      activeOrder.status === 'ready_for_pickup'
                        ? 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse'
                        : activeOrder.status === 'picked_up'
                        ? 'bg-orange-100 text-[#F47721] border-orange-200'
                        : activeOrder.status === 'courier_arrived'
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {activeOrder.status === 'ready_for_pickup' ? (
                      <>
                        <PackageCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>جاهز للاستلام الآن!</span>
                      </>
                    ) : activeOrder.status === 'picked_up' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span>في الطريق للزبون</span>
                      </>
                    ) : activeOrder.status === 'courier_arrived' ? (
                      <>
                        <MapPin className="w-3.5 h-3.5 text-teal-600" />
                        <span>وصلت عند باب الزبون</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                        <span>بانتظار تجهيز المطعم</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Status Notice Banner */}
                {activeOrder.status === 'created' || activeOrder.status === 'merchant_accepted' || activeOrder.status === 'preparing' ? (
                  <div className="mb-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-2 text-[11px] font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>الطلب محجوز لك. المطعم يقوم بتجهيز الوجبة حالياً؛ وسيتم تفعيل زر الاستلام وتنبيهك فور جاهزيتها.</span>
                  </div>
                ) : activeOrder.status === 'ready_for_pickup' ? (
                  <div className="mb-2 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl p-2 text-[11px] font-bold flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>الوجبة جاهزة ومغلفة في المطعم! يمكنك استلامها الآن والانطلاق للزبون.</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#E11D48] flex items-center justify-center">
                      <StoreIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{activeOrder.storeName}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Navigation className="w-3.5 h-3.5 text-[#E11D48]" />
                        <span>{activeOrder.deliveryDistanceKm || 2.8} كم • 12 دقيقة</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-black text-sm text-[#E11D48]">
                    {(activeOrder.financials?.courierTotalEarnings ?? 8000).toLocaleString()} د.ع
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCurrentScreen('timeline')}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-[#E11D48]" />
                    <span>حالة المراحل</span>
                  </button>

                  <button
                    onClick={() => setCurrentScreen('navigation')}
                    className="py-2.5 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>التوجيه للمطعم</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-4 border border-slate-200 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>أنت متصل وجاهز لاستقبال الطلبات القادمة</span>
                </div>
                <p className="text-[11px] text-slate-400">بانتظار تجهيز طلب من المطاعم القريبة منك</p>
              </div>
            )}
          </div>
        )}

        {/* ================= SCREEN 3: AVAILABLE ORDERS LIST ================= */}
        {currentScreen === 'orders' && (
          <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentScreen('map')}
                  className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <h2 className="font-extrabold text-base text-slate-900">الطلبات المتاحة</h2>
              </div>

              <div className="relative">
                <Bell className="w-5 h-5 text-slate-700" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#E11D48] text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {availableOrders.length || 3}
                </span>
              </div>
            </div>

            {/* Filter Subtabs matching Screen 3 */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-slate-600 border border-slate-200">
                الكل
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-rose-50 text-[#E11D48] border border-[#E11D48]">
                جديدة {availableOrders.length || 3}
              </button>
            </div>

            {/* List of Orders matching Screen 3 Cards */}
            <div className="space-y-3">
              {availableOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3 relative hover:border-[#E11D48]/50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80"
                        alt={ord.storeName}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">{ord.storeName}</h3>
                          <span className="bg-rose-100 text-[#E11D48] text-[10px] font-black px-2 py-0.5 rounded-full">
                            جديد
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          1.2 كم • <span className="font-bold text-[#E11D48]">{(ord.financials?.courierTotalEarnings ?? 8000).toLocaleString()} د.ع</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOrderForDetail(ord);
                        setCurrentScreen('detail');
                      }}
                      className="text-xs text-[#E11D48] font-bold underline"
                    >
                      التفاصيل
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleRejectClaim(ord.id)}
                      className="py-2.5 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <X className="w-4 h-4" />
                      <span>رفض</span>
                    </button>

                    <button
                      onClick={() => handleAcceptClaim(ord)}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول</span>
                    </button>
                  </div>
                </div>
              ))}

              {availableOrders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-6 space-y-2">
                  <Bike className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-sm text-slate-700">لا توجد طلبات معلقة بالقرب منك حالياً</h3>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 4: ORDER DETAILS PAGE ================= */}
        {(currentScreen === 'detail' || (selectedOrderForDetail && currentScreen === 'detail')) && (() => {
          const detailOrder = selectedOrderForDetail || availableOrders[0] || activeOrder;
          if (!detailOrder) {
            return (
              <div className="flex-1 bg-white p-6 text-center space-y-3">
                <p className="text-xs text-slate-500">لا يوجد طلب محدد لعرض تفاصيله</p>
                <button onClick={() => setCurrentScreen('orders')} className="px-4 py-2 bg-[#E11D48] text-white rounded-xl text-xs font-bold">
                  العودة للطلبات
                </button>
              </div>
            );
          }

          return (
            <div className="flex-1 bg-white p-4 overflow-y-auto space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => setCurrentScreen('orders')}
                  className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <h2 className="font-extrabold text-base text-slate-900">تفاصيل الطلب</h2>
                <div className="w-8" />
              </div>

              {/* Store Cover Banner matching Screen 4 */}
              <div className="relative rounded-3xl overflow-hidden h-36 border border-slate-200 shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80"
                  alt="Store Banner"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 right-3 flex items-center gap-3 text-white">
                  <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-lg text-slate-800 flex items-center justify-center font-bold">
                    <StoreIcon className="w-6 h-6 text-[#E11D48]" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">{detailOrder.storeName}</h3>
                    <p className="text-xs text-amber-300 font-bold">⭐ 4.9 (متجر معتمد)</p>
                  </div>
                </div>
              </div>

              {/* Information List matching Screen 4 */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-3xl border border-slate-200 text-xs">
                <h4 className="font-black text-sm text-slate-900 border-b border-slate-200 pb-2">معلومات الطلب</h4>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-bold">رقم الطلب:</span>
                  <span className="font-mono font-black text-slate-900">#{detailOrder.id.slice(-6)}</span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-bold">أجرة توصيل الكابتن:</span>
                  <span className="font-black text-[#E11D48]">
                    {(detailOrder.financials?.courierTotalEarnings ?? detailOrder.deliveryFee ?? 3500).toLocaleString()} د.ع
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-bold">إجمالي الطلب:</span>
                  <span className="font-black text-slate-900">{detailOrder.total.toLocaleString()} د.ع</span>
                </div>

                <div className="flex justify-between py-1 border-t border-slate-200 pt-2">
                  <span className="text-slate-500 font-bold">محتويات الوجبة:</span>
                  <span className="font-bold text-slate-800 text-left max-w-[200px]">
                    {detailOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(' + ')}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block">موقع الاستلام (المطعم)</span>
                      <span className="text-slate-500">{detailOrder.storeAddress || 'بغداد'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block">موقع التوصيل (الزبون)</span>
                      <span className="text-slate-500">
                        {detailOrder.customer.name} - {detailOrder.customer.neighborhood} ({detailOrder.customer.address})
                      </span>
                    </div>
                  </div>

                  {/* Real Customer Phone */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-600">هاتف الزبون:</span>
                    {detailOrder.customer.phone && detailOrder.customer.phone.trim() !== '' ? (
                      <a
                        href={`tel:${detailOrder.customer.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold border border-emerald-200"
                        dir="ltr"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{detailOrder.customer.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 font-medium">رقم الهاتف غير متوفر</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Full-Width Action Buttons matching Screen 4 */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    handleAcceptClaim(detailOrder);
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all"
                >
                  قبول وحجز الطلب
                </button>

                <button
                  onClick={() => {
                    handleRejectClaim(detailOrder.id);
                    setCurrentScreen('orders');
                  }}
                  className="w-full py-3 bg-white hover:bg-rose-50 text-[#E11D48] rounded-2xl font-bold text-xs border border-[#E11D48] transition-colors"
                >
                  رفض الطلب
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 5: NAVIGATION TO RESTAURANT ================= */}
        {currentScreen === 'navigation' && (
          <div className="flex-1 bg-slate-200 relative overflow-hidden flex flex-col">
            <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between z-20">
              <button
                onClick={() => setCurrentScreen('map')}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <h2 className="font-extrabold text-base text-slate-900">التوجيه إلى المطعم</h2>
              <div className="w-8" />
            </div>

            {/* Map Canvas */}
            <div className="flex-1 relative">
              <LeafletMapComponent
                captainCoords={captainCoords}
                restaurantCoords={{ lat: 33.3225, lng: 44.3685 }}
                showRoute={true}
                className="w-full h-full"
              />

              {/* Distance Overlay Badge */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1E293B] text-white px-4 py-2 rounded-full font-black text-xs shadow-xl border border-slate-700 flex items-center gap-1.5 z-20">
                <Navigation className="w-4 h-4 text-sky-400" />
                <span>1.2 كم • 10 دقائق</span>
              </div>
            </div>

            {/* Bottom Card matching Screen 5 */}
            <div className="bg-white p-4 rounded-t-3xl border-t border-slate-200 shadow-2xl space-y-3 z-20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg">
                  <Navigation className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">اتجه إلى المطعم: {activeOrder?.storeName || 'المطعم'}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeOrder?.storeAddress || 'شارع فلسطين'} • ستصل خلال 10 دقائق
                  </p>
                </div>
              </div>

              {/* Decoupled Pickup Action: Disabled until merchant declares ready_for_pickup */}
              {activeOrder?.status === 'created' || activeOrder?.status === 'merchant_accepted' || activeOrder?.status === 'preparing' ? (
                <div className="space-y-1.5">
                  <button
                    disabled
                    className="w-full py-3.5 bg-slate-200 text-slate-500 rounded-2xl font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
                  >
                    <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                    <span>بانتظار تجهيز المطعم (الاستلام غير متاح قبل إعلان الجاهزية)</span>
                  </button>
                  <p className="text-[11px] text-amber-700 text-center font-medium">
                    المطعم يقوم بتحضير الوجبة حالياً. سيتم تفعيل زر الاستلام فوراً عند ضغط المطعم على "جاهز للاستلام".
                  </p>
                </div>
              ) : activeOrder?.status === 'ready_for_pickup' ? (
                <button
                  onClick={() => {
                    if (activeOrder) {
                      updateOrderStatus(activeOrder.id, 'picked_up', 'تم استلام الطلب من المطعم والانطلاق للزبون');
                    }
                    setCurrentScreen('timeline');
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-5 h-5" />
                  <span>تأكيد استلام الطلب من المطعم والانطلاق للزبون</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentScreen('timeline')}
                  className="w-full py-3.5 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Bike className="w-5 h-5" />
                  <span>متابعة مراحل الطلب والتوصيل</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 6: STATUS LIFECYCLE TIMELINE ================= */}
        {currentScreen === 'timeline' && (
          <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <button
                onClick={() => setCurrentScreen('map')}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <h2 className="font-extrabold text-base text-slate-900">مراحل وتدفق الطلب</h2>
              <div className="w-8" />
            </div>

            {/* Store Top Card matching Screen 6 */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-[#E11D48] flex items-center justify-center font-bold">
                  <StoreIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-slate-400">#{activeOrder?.id.slice(-6) || '1245'}</span>
                  <h3 className="font-extrabold text-sm text-slate-900">{activeOrder?.storeName || 'المتجر'}</h3>
                  <p className="text-[11px] text-slate-500">
                    الزبون: {activeOrder?.customer.name} ({activeOrder?.customer.neighborhood})
                  </p>
                </div>
              </div>

              <div className="text-left font-black text-xs text-[#E11D48] bg-rose-50 px-2.5 py-1 rounded-xl">
                {(activeOrder?.financials?.courierTotalEarnings ?? 8000).toLocaleString()} د.ع
              </div>
            </div>

            {/* Vertical Timeline matching Screen 6 with Decoupled Ready Check */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6 relative">
              {/* Step 1: Order Created */}
              <div className="flex items-start gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 shadow-md">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="absolute top-8 right-4 bottom-0 w-0.5 bg-emerald-500 -mb-6" />
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">تم إنشاء الطلب وإرساله</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {activeOrder?.createdAt || 'الآن'}
                  </p>
                </div>
              </div>

              {/* Step 2: Courier Claimed */}
              <div className="flex items-start gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 shadow-md">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div
                  className={`absolute top-8 right-4 bottom-0 w-0.5 -mb-6 ${
                    activeOrder?.status === 'ready_for_pickup' ||
                    activeOrder?.status === 'picked_up' ||
                    activeOrder?.status === 'courier_arrived' ||
                    activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500'
                      : 'bg-amber-400'
                  }`}
                />
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">تم قبول العرض وحجز الطلب لك</h4>
                  <p className="text-[11px] text-emerald-600 font-medium">محجوز للكابتن {currentCourier.name}</p>
                </div>
              </div>

              {/* Step 3: Merchant Preparation */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 z-10 shadow-md ${
                    activeOrder?.status === 'ready_for_pickup' ||
                    activeOrder?.status === 'picked_up' ||
                    activeOrder?.status === 'courier_arrived' ||
                    activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500 animate-pulse'
                  }`}
                >
                  {activeOrder?.status === 'ready_for_pickup' ||
                  activeOrder?.status === 'picked_up' ||
                  activeOrder?.status === 'courier_arrived' ||
                  activeOrder?.status === 'delivered' ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : (
                    <Clock className="w-4 h-4 animate-spin" />
                  )}
                </div>
                <div
                  className={`absolute top-8 right-4 bottom-0 w-0.5 -mb-6 ${
                    activeOrder?.status === 'picked_up' ||
                    activeOrder?.status === 'courier_arrived' ||
                    activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                />
                <div>
                  <h4
                    className={`font-extrabold text-xs ${
                      activeOrder?.status === 'ready_for_pickup'
                        ? 'text-purple-700 font-black'
                        : activeOrder?.status === 'picked_up' ||
                          activeOrder?.status === 'courier_arrived' ||
                          activeOrder?.status === 'delivered'
                        ? 'text-slate-900'
                        : 'text-amber-700'
                    }`}
                  >
                    {activeOrder?.status === 'ready_for_pickup'
                      ? 'الوجبة جاهزة للاستلام من المطعم الآن!'
                      : activeOrder?.status === 'picked_up' ||
                        activeOrder?.status === 'courier_arrived' ||
                        activeOrder?.status === 'delivered'
                      ? 'المطعم أتم تجهيز الوجبة'
                      : 'المطعم يقوم بتحضير الوجبة (بانتظار الجاهزية)'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {activeOrder?.status === 'ready_for_pickup'
                      ? 'المطعم أعلن الجاهزية، تفضل باستلامها'
                      : 'قيد الطهي والتغليف في المطبخ'}
                  </p>
                </div>
              </div>

              {/* Step 4: Picked up */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 shadow-md ${
                    activeOrder?.status === 'picked_up' ||
                    activeOrder?.status === 'courier_arrived' ||
                    activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {activeOrder?.status === 'picked_up' ||
                  activeOrder?.status === 'courier_arrived' ||
                  activeOrder?.status === 'delivered' ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`absolute top-8 right-4 bottom-0 w-0.5 -mb-6 ${
                    activeOrder?.status === 'courier_arrived' || activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                />
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">استلام الطلب من المطعم والانطلاق</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {activeOrder?.status === 'picked_up'
                      ? 'أنت الآن في الطريق إلى الزبون'
                      : activeOrder?.status === 'courier_arrived' || activeOrder?.status === 'delivered'
                      ? 'تم الاستلام بنجاح'
                      : 'بانتظار تأكيد استلامك للوجبة'}
                  </p>
                </div>
              </div>

              {/* Step 5: Arrived at Customer Door */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    activeOrder?.status === 'courier_arrived' || activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {activeOrder?.status === 'courier_arrived' || activeOrder?.status === 'delivered' ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`absolute top-8 right-4 bottom-0 w-0.5 -mb-6 ${
                    activeOrder?.status === 'delivered' ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">الوصول عند باب الزبون</h4>
                  <p className="text-[11px] text-slate-400">
                    {activeOrder?.customer.neighborhood} - {activeOrder?.customer.address}
                  </p>
                </div>
              </div>

              {/* Step 6: Delivered Final */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    activeOrder?.status === 'delivered'
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {activeOrder?.status === 'delivered' ? <Check className="w-5 h-5 stroke-[3]" /> : <CheckCircle2 className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">التسليم النهائي واستلام المبلغ</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    المبلغ المطلوب: {(activeOrder?.total || 0).toLocaleString()} د.ع
                  </p>
                </div>
              </div>
            </div>

            {/* Real Customer Contact Direct Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {activeOrder?.customer.phone && activeOrder.customer.phone.trim() !== '' ? (
                <a
                  href={`tel:${activeOrder.customer.phone}`}
                  className="py-3 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-bold text-xs border border-slate-200 shadow-xs flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 text-[#E11D48]" />
                  <span dir="ltr">{activeOrder.customer.phone}</span>
                </a>
              ) : (
                <div className="py-3 bg-slate-100 text-slate-400 rounded-2xl font-bold text-xs border border-slate-200 flex items-center justify-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-300" />
                  <span>رقم الهاتف غير متوفر</span>
                </div>
              )}

              {activeOrder?.customer.phone && activeOrder.customer.phone.trim() !== '' ? (
                <a
                  href={formatWhatsAppUrl(activeOrder.customer.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-bold text-xs border border-slate-200 shadow-xs flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>مراسلة واتساب</span>
                </a>
              ) : (
                <div className="py-3 bg-slate-100 text-slate-400 rounded-2xl font-bold text-xs border border-slate-200 flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-slate-300" />
                  <span>واتساب غير متوفر</span>
                </div>
              )}
            </div>

            {/* Dynamic Stage Progression Button: Strictly gated by restaurant readiness */}
            {activeOrder?.status === 'created' ||
            activeOrder?.status === 'merchant_accepted' ||
            activeOrder?.status === 'preparing' ? (
              <div className="space-y-1 mt-2">
                <button
                  disabled
                  className="w-full py-3.5 bg-slate-200 text-slate-500 rounded-2xl font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
                >
                  <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                  <span>بانتظار إعلان المطعم جاهزية الطلب (الاستلام غير متاح حالياً)</span>
                </button>
                <p className="text-[11px] text-amber-700 text-center font-medium">
                  الطلب محجوز لك. سيتم تفعيل زر الاستلام فور قيام المطعم بتسليم الوجبة أو النقر على "جاهز للاستلام".
                </p>
              </div>
            ) : activeOrder?.status === 'ready_for_pickup' ? (
              <button
                onClick={() => {
                  if (activeOrder) {
                    updateOrderStatus(activeOrder.id, 'picked_up', 'تم استلام الطلب من المطعم وهو في الطريق للزبون');
                  }
                }}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 animate-bounce"
              >
                <PackageCheck className="w-4 h-4" />
                <span>تأكيد استلام الطلب من المطعم والانطلاق للزبون</span>
              </button>
            ) : activeOrder?.status === 'picked_up' ? (
              <button
                onClick={() => {
                  if (activeOrder) {
                    updateOrderStatus(activeOrder.id, 'courier_arrived', 'وصل المندوب إلى عنوان الزبون وهو عند الباب');
                  }
                }}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all mt-2 flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>وصلت إلى عنوان الزبون (عند الباب)</span>
              </button>
            ) : activeOrder?.status === 'courier_arrived' ? (
              <button
                onClick={handleCompleteDelivery}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all mt-2 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد تسليم الطلب النهائي للزبون واستلام المبلغ</span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentScreen('map')}
                className="w-full py-3.5 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all mt-2"
              >
                العودة للخريطة الرئيسية
              </button>
            )}
          </div>
        )}

        {/* ================= SCREEN 7: VICTORY DELIVERED SCREEN ================= */}
        {currentScreen === 'victory' && (
          <div className="flex-1 bg-white p-6 flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
            <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-bounceIn">
              <Check className="w-14 h-14 stroke-[3]" />
            </div>

            <div>
              <h2 className="font-black text-2xl text-slate-900">تم التسليم بنجاح</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">تم تسليم الطلب للزبون بنجاح</p>
            </div>

            <div className="w-full max-w-xs bg-slate-50 rounded-3xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80"
                  alt="Pizza"
                  className="w-12 h-12 rounded-2xl object-cover"
                />
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-400">#1245</span>
                  <h4 className="font-extrabold text-sm text-slate-900">مطعم البيتزا الإيطالي</h4>
                </div>
              </div>

              <div className="flex justify-between text-xs font-bold py-1">
                <span className="text-slate-500">قيمة التوصيل:</span>
                <span className="text-slate-900">8,000 د.ع</span>
              </div>

              <div className="flex justify-between text-xs font-bold py-1">
                <span className="text-slate-500">المدة المستغرقة:</span>
                <span className="text-slate-900">28 دقيقة</span>
              </div>
            </div>

            <button
              onClick={() => setCurrentScreen('map')}
              className="w-full max-w-xs py-4 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
            >
              العودة إلى الرئيسية
            </button>
          </div>
        )}

        {/* ================= SCREEN 8: INCOMING CUSTOMER CALL OVERLAY ================= */}
        {showCustomerCallModal && (
          <div className="fixed inset-0 z-50 bg-[#0F172A] text-white flex flex-col items-center justify-between p-8 animate-fadeIn">
            <div className="text-center space-y-3 mt-12">
              <h3 className="text-sm font-extrabold text-slate-200">اتصال من الزبون</h3>
              <p className="text-xs text-slate-400">الزبون يريد التواصل معك بخصوص الطلب</p>

              <div className="w-28 h-28 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border-4 border-slate-700 shadow-2xl my-6">
                <UserIcon className="w-14 h-14 text-slate-300" />
              </div>

              <h2 className="font-black text-2xl text-white">{activeOrder?.customer.name || 'زبون طلبي'}</h2>
              {activeOrder?.customer.phone && activeOrder.customer.phone.trim() !== '' ? (
                <p className="text-sm font-mono text-emerald-400 font-bold" dir="ltr">{activeOrder.customer.phone}</p>
              ) : (
                <p className="text-xs text-slate-400">رقم الهاتف غير متوفر</p>
              )}
            </div>

            <div className="w-full max-w-xs grid grid-cols-2 gap-8 mb-12">
              <button
                onClick={() => setShowCustomerCallModal(false)}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all">
                  <X className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold text-slate-300">إغلاق</span>
              </button>

              {activeOrder?.customer.phone && activeOrder.customer.phone.trim() !== '' ? (
                <a
                  href={`tel:${activeOrder.customer.phone}`}
                  onClick={() => setShowCustomerCallModal(false)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all">
                    <PhoneCall className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-slate-300">اتصال مباشر</span>
                </a>
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
                  <div className="w-16 h-16 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center shadow-xl">
                    <PhoneCall className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">غير متوفر</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 15-SECOND OVERLAY DISPATCH CARD (Screen 3 & 4 Style) ================= */}
        {offeredOrder && currentScreen !== 'splash' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border-2 border-[#E11D48] space-y-4 relative overflow-hidden animate-bounceIn">
              <div className="absolute top-0 left-0 right-0 h-2 bg-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-[#E11D48] to-emerald-500 transition-all duration-1000"
                  style={{ width: `${(timerSeconds / 15) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="font-extrabold text-sm text-[#1E293B]">طلب حصرِي جديد</h3>
                </div>
                <span className="bg-rose-100 text-[#E11D48] text-xs font-black px-2.5 py-1 rounded-full border border-rose-200 font-mono">
                  {timerSeconds} ثانية
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{offeredOrder.storeName}</h4>
                    <p className="text-[11px] text-slate-500">2.8 كم • 12 دقيقة</p>
                  </div>
                  <div className="text-left font-black text-sm text-[#E11D48]">
                    {(offeredOrder.financials?.courierTotalEarnings ?? 8000).toLocaleString()} د.ع
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <p className="text-slate-600 font-bold">المطعم: {offeredOrder.storeAddress}</p>
                  <p className="text-emerald-700 font-bold">التوصيل إلى: {offeredOrder.customer.neighborhood}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRejectClaim(offeredOrder.id)}
                  className="py-3 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  <X className="w-4 h-4" />
                  <span>رفض الطلب</span>
                </button>

                <button
                  disabled={isClaiming}
                  onClick={() => handleAcceptClaim(offeredOrder)}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  {isClaiming ? (
                    <span>جاري الحجز...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>قبول الطلب</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= BOTTOM TAB NAVIGATION BAR (Matching Screen 2/3/4/6) ================= */}
      {currentScreen !== 'splash' && currentScreen !== 'call' && (
        <div className="bg-[#1E293B] text-slate-300 border-t border-slate-800 p-2 z-40 flex items-center justify-around text-[10px] font-bold">
          {/* Tab 1: المزيد */}
          <button
            onClick={() => setIsProfileDrawerOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span>المزيد</span>
          </button>

          {/* Tab 2: الطلبات (Red Badge 3) */}
          <button
            onClick={() => setCurrentScreen('orders')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors relative ${
              currentScreen === 'orders' ? 'text-[#E11D48]' : 'hover:text-white'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>الطلبات</span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E11D48] text-white text-[9px] font-black rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* Tab 3: الخريطة (Active Red Pin) */}
          <button
            onClick={() => setCurrentScreen('map')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${
              currentScreen === 'map' ? 'text-[#E11D48]' : 'hover:text-white'
            }`}
          >
            <MapPin className="w-5 h-5 text-[#E11D48]" />
            <span className="text-[#E11D48]">الخريطة</span>
          </button>

          {/* Tab 4: الملف الشخصي */}
          <button
            onClick={() => setIsProfileDrawerOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl hover:text-white transition-colors"
          >
            <UserIcon className="w-5 h-5" />
            <span>الملف الشخصي</span>
          </button>
        </div>
      )}

      {/* Support Chat Modal */}
      <InAppSupportChatModal
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
        relatedOrderId={activeOrder?.id}
      />
    </div>
  );
};
