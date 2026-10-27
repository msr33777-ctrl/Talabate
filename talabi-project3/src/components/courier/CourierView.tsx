import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { InAppSupportChatModal } from '../common/InAppSupportChatModal';
import { LocationCoordinates, Order } from '../../types';
import {
  Bike,
  Power,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  DollarSign,
  Star,
  Clock,
  Package,
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
  ShieldCheck,
  ChevronDown,
  X,
  Compass,
  ArrowUpRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';

export const CourierView: React.FC = () => {
  const {
    couriers,
    toggleCourierStatus,
    orders,
    courierAcceptOrder,
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
  } = useApp();

  // Active courier (default to first courier: حيدر الكرخي)
  const [selectedCourierId, setSelectedCourierId] = useState<string>(couriers[0]?.id || 'cour_1');
  const currentCourier = couriers.find((c) => c.id === selectedCourierId) || couriers[0];
  const courierRatings = getCourierRatings(currentCourier.id);

  // Modals & Drawers
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isIncentivesModalOpen, setIsIncentivesModalOpen] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showMapInfoModal, setShowMapInfoModal] = useState(false);

  // GPS & Live Location
  const [captainCoords, setCaptainCoords] = useState<LocationCoordinates>({
    lat: 33.3152,
    lng: 44.3541,
    accuracy: 15,
    isManualPin: false,
    verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
  });
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Active order assigned to this courier
  const activeOrder = orders.find(
    (o) =>
      o.courierId === currentCourier.id &&
      (o.status === 'courier_assigned' || o.status === 'picked_up' || o.status === 'courier_arrived')
  );

  // Available orders waiting for dispatch (ready_for_pickup with no courier)
  const availableOrders = orders.filter(
    (o) => o.status === 'ready_for_pickup' && !o.courierId
  );

  // Unread messages count for this courier
  const unreadMessagesCount = conversations
    .filter((c) => c.userId === currentCourier.userId || c.userId === currentCourier.id)
    .reduce((acc, c) => acc + (c.status === 'open' ? 1 : 0), 1);

  // Fetch / Recenter GPS
  const handleRecenterLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('خاصية تحديد الموقع غير مدعومة في متصفحك');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const newCoords: LocationCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          isManualPin: false,
          verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
        };
        setCaptainCoords(newCoords);

        addNotification(
          'تم تحديث موقع الكابتن',
          `تم تثبيت إحداثياتك الميدانية بدقة ±${Math.round(pos.coords.accuracy)} متر`,
          'success'
        );

        // If on active order, sync with order & Firestore
        if (activeOrder) {
          updateCourierLocation(activeOrder.id, newCoords);
        }
      },
      (err) => {
        setIsGpsLoading(false);
        setGpsError('تعذر الحصول على إشارة GPS. تأكد من منح إذن الموقع في المتصفح.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto request location once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LocationCoordinates = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            isManualPin: false,
            verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
          };
          setCaptainCoords(coords);
          if (activeOrder) {
            updateCourierLocation(activeOrder.id, coords);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [activeOrder?.id]);

  // Arrived at Doorstep Action
  const handleCourierArrived = () => {
    if (!activeOrder) return;
    const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    updateOrderStatus(
      activeOrder.id,
      'courier_arrived',
      `وصل الكابتن ${currentCourier.name} إلى عنوان الزبون وهو عند الباب الآن (${timeStr})`
    );
    addNotification(
      'الكابتن بالباب الآن!',
      `تم إرسال إشعار فوري للزبون بأنك وصلت إلى عنوانه ومعه الطلب #${activeOrder.id.slice(-6)}`,
      'success',
      activeOrder.id
    );
  };

  // Complete delivery
  const handleDeliverOrder = () => {
    if (!activeOrder) return;
    courierDeliverOrder(currentCourier.id, activeOrder.id);
    addNotification('مبارك! تم إتمام التوصيل', 'أضيفت أرباح الطلب ومستحقاتك فورياً إلى محفظتك', 'success');
  };

  // Format WhatsApp link for Iraqi numbers
  const formatWhatsAppUrl = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('964')) clean = `964${clean}`;
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative overflow-hidden select-none" dir="rtl">
      {/* ================= 1. INTERACTIVE REAL MAP VIEWPORT (FILLS MOST OF THE SCREEN) ================= */}
      <div className="relative w-full flex-1 h-[78vh] sm:h-[82vh] bg-slate-900 overflow-hidden">
        {/* OpenStreetMap Real Tile Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: `url('https://tile.openstreetmap.org/15/${Math.floor(
              ((captainCoords.lng + 180) / 360) * Math.pow(2, 15)
            )}/${Math.floor(
              ((1 -
                Math.log(
                  Math.tan((captainCoords.lat * Math.PI) / 180) +
                    1 / Math.cos((captainCoords.lat * Math.PI) / 180)
                ) /
                  Math.PI) /
                2) *
                Math.pow(2, 15)
            )}.png')`,
            filter: 'contrast(1.05) saturate(1.1)',
          }}
        />

        {/* Baghdad Map Grid Overlay for spatial feel */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/30 pointer-events-none" />

        {/* Central Captain Live Position Marker with Radar Pulse */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center">
          {currentCourier.isOnline ? (
            <div className="relative flex items-center justify-center">
              {/* Radar pulse rings */}
              <div className="absolute w-24 h-24 rounded-full bg-orange-500/20 animate-ping" />
              <div className="absolute w-16 h-16 rounded-full bg-[#F47721]/30 animate-pulse" />
              
              {/* Captain Marker Pin */}
              <div className="relative w-12 h-12 rounded-full bg-[#172554] border-3 border-[#F47721] text-white flex items-center justify-center shadow-2xl">
                <Bike className="w-6 h-6 text-orange-400" />
              </div>

              {/* Status Tag */}
              <div className="absolute -bottom-7 bg-[#172554]/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap border border-orange-500/30">
                موقعك الفعلي: {currentCourier.name.split(' ')[0]}
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-700 border-3 border-slate-500 text-slate-300 flex items-center justify-center shadow-lg">
                <Power className="w-5 h-5 text-slate-400" />
              </div>
              <div className="absolute -bottom-6 bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                غير متصل
              </div>
            </div>
          )}
        </div>

        {/* If Active Order: Show Restaurant Pin (Pickup) & Customer Pin (Dropoff) */}
        {activeOrder && (
          <>
            {/* Restaurant Marker (Offset visually on map) */}
            <div className="absolute top-[35%] right-[28%] z-20 flex flex-col items-center animate-bounce">
              <div className="w-9 h-9 rounded-2xl bg-[#F47721] text-white flex items-center justify-center shadow-lg border-2 border-white">
                <StoreIcon className="w-5 h-5" />
              </div>
              <span className="bg-white/95 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md mt-1 border border-slate-200">
                المطعم: {activeOrder.storeName}
              </span>
            </div>

            {/* Customer Marker (Offset visually on map) */}
            <div className="absolute bottom-[36%] left-[26%] z-20 flex flex-col items-center">
              <div className="w-9 h-9 rounded-2xl bg-[#172554] text-white flex items-center justify-center shadow-lg border-2 border-orange-400 animate-pulse">
                <MapPin className="w-5 h-5 text-orange-400" />
              </div>
              <span className="bg-[#172554] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md mt-1 border border-orange-400/50">
                الزبون: {activeOrder.customer.neighborhood}
              </span>
            </div>

            {/* Direct Route Indicator SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70">
              <line
                x1="72%"
                y1="35%"
                x2="50%"
                y2="50%"
                stroke="#F47721"
                strokeWidth="3"
                strokeDasharray="6 4"
              />
              <line
                x1="50%"
                y1="50%"
                x2="26%"
                y2="64%"
                stroke="#172554"
                strokeWidth="3"
                strokeDasharray="6 4"
              />
            </svg>
          </>
        )}

        {/* ================= 2. TOP FLOATING CARDS & CONTROLS ================= */}
        {/* A. Menu Button (Top Right) */}
        <button
          onClick={() => setIsProfileDrawerOpen(true)}
          className="absolute top-4 right-4 z-30 w-11 h-11 rounded-2xl bg-white/95 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg border border-slate-200/80 active:scale-95 transition-all"
          title="القائمة والإعدادات والملف الشخصي"
        >
          <Menu className="w-5 h-5 text-[#172554]" />
        </button>

        {/* B. Balance Card (Top Center - بطاقة الرصيد في الأعلى) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F47721] flex items-center justify-center font-bold">
              <Banknote className="w-4 h-4" />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
                رصيد الكابتن الفعلي
              </span>
              <span className="font-extrabold text-sm sm:text-base text-[#172554]">
                {currentCourier.walletBalance.toLocaleString()} د.ع
              </span>
            </div>
          </div>
        </div>

        {/* C. Circular Commission & Earnings Button (Top Left - زر دائري أعلى اليسار) */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <button
            onClick={() => setIsCommissionModalOpen(true)}
            className="w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 flex flex-col items-center justify-center shadow-lg border border-slate-200/80 active:scale-95 transition-all"
            title="نسبة العمولة وتفاصيل الأرباح"
          >
            <Percent className="w-4 h-4 text-[#F47721]" />
            <span className="text-[8px] font-black text-[#172554] leading-none">
              %{pricingSettings.defaultPlatformCommissionPercent}
            </span>
          </button>

          {/* D. Messages Button with Unread Badge */}
          <button
            onClick={() => setIsSupportChatOpen(true)}
            className="w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg border border-slate-200/80 active:scale-95 transition-all relative"
            title="الرسائل والدعم الفني"
          >
            <MessageCircle className="w-5 h-5 text-sky-600" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F47721] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        </div>

        {/* E. Map Help / Prototype API Explanation Trigger */}
        <button
          onClick={() => setShowMapInfoModal(true)}
          className="absolute top-18 right-4 z-30 bg-white/90 hover:bg-white text-slate-700 px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-md border border-slate-200"
        >
          <Info className="w-3.5 h-3.5 text-[#F47721]" />
          <span>إعداد الخريطة وGPS</span>
        </button>

        {/* Approval Status Alert Banner */}
        {currentCourier.approvalStatus && currentCourier.approvalStatus !== 'approved' && (
          <div className="absolute top-18 left-4 right-4 sm:right-36 z-30 bg-amber-500/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-amber-300">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-200 animate-pulse shrink-0" />
              <div>
                <span className="text-xs font-black block">
                  {currentCourier.approvalStatus === 'pending'
                    ? 'الحساب بانتظار موافقة واعتماد المدير'
                    : currentCourier.approvalStatus === 'suspended'
                    ? 'تم تعليق حساب الكابتن مؤقتاً'
                    : 'طلب الانضمام مرفوض'}
                </span>
                <span className="text-[10px] text-amber-100 block">
                  {currentCourier.approvalStatus === 'pending'
                    ? 'لا يمكنك تفعيل الاتصال أو استقبال طلبات الزبائن قبل اعتماد الإدارة للمستندات والبيانات.'
                    : 'يرجى مراجعة إدارة طلبي لمزيد من التفاصيل.'}
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold shrink-0">
              {currentCourier.approvalStatus === 'pending' ? 'قيد التدقيق' : 'معطل'}
            </span>
          </div>
        )}

        {/* F. Recenter Current Location Button (Bottom Right of Map) */}
        <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-2">
          <button
            onClick={handleRecenterLocation}
            disabled={isGpsLoading}
            className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center shadow-xl border border-slate-200 active:scale-95 transition-all disabled:opacity-50"
            title="تحديد وتثبيت موقعي الحالي الحقيقي"
          >
            <Crosshair className={`w-5 h-5 text-[#F47721] ${isGpsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* GPS Error notice if any */}
        {gpsError && (
          <div className="absolute bottom-24 left-4 right-18 z-30 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-2xl text-[11px] font-bold flex items-center gap-2 shadow-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}
      </div>

      {/* ================= 3. ACTIVE ORDER OVERLAY SHEET (IF ASSIGNED) ================= */}
      {activeOrder && (
        <div className="bg-white border-t border-slate-200 shadow-2xl p-4 -mt-6 rounded-t-3xl relative z-30 max-w-xl mx-auto w-full space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black text-slate-400">
                #{activeOrder.id.slice(-6)}
              </span>
              <span className="text-xs bg-orange-100 text-[#F47721] font-bold px-2 py-0.5 rounded-full">
                {activeOrder.status === 'courier_assigned'
                  ? 'طلب جديد مسند إليك'
                  : activeOrder.status === 'picked_up'
                  ? 'الطلب معك وفي الطريق'
                  : 'أنت عند باب الزبون'}
              </span>
            </div>

            <div className="text-left font-black text-sm text-[#172554]">
              أرباحك:{' '}
              <span className="text-[#F47721]">
                {(activeOrder.financials?.courierTotalEarnings ?? 3000).toLocaleString()} د.ع
              </span>
            </div>
          </div>

          {/* Locations detail: Pickup & Dropoff */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            {/* Store Pickup */}
            <div className="flex items-start gap-2">
              <StoreIcon className="w-4 h-4 text-[#F47721] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">{activeOrder.storeName}</span>
                <span className="text-[11px] text-slate-400">{activeOrder.storeAddress}</span>
              </div>
            </div>

            {/* Customer Dropoff */}
            <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {activeOrder.customer.name} ({activeOrder.customer.neighborhood})
                  </span>
                  <span className="text-[11px] text-slate-400">{activeOrder.customer.address}</span>
                  {activeOrder.customer.notes && (
                    <span className="text-[10px] text-orange-600 block font-medium">
                      ملاحظة: {activeOrder.customer.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Call & WhatsApp actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${activeOrder.customer.phone}`}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs"
                  title="اتصال هاتفي"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
                <a
                  href={formatWhatsAppUrl(activeOrder.customer.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                  title="محادثة واتساب"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Action Step Buttons */}
          <div className="flex items-center gap-2">
            {activeOrder.status === 'courier_assigned' && (
              <button
                onClick={() => updateOrderStatus(activeOrder.id, 'picked_up', 'استلم الكابتن الطلب وبدأ مسار التوصيل')}
                className="flex-1 py-3 bg-[#F47721] hover:bg-[#e06816] text-white rounded-2xl font-bold text-xs shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <Package className="w-4 h-4" />
                <span>استلمت الطلب من المطعم وبدأت التوصيل</span>
              </button>
            )}

            {activeOrder.status === 'picked_up' && (
              <button
                onClick={handleCourierArrived}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <BellRingIcon className="w-4 h-4" />
                <span>وصلت للعنوان وأنا عند الباب (تنبيه الزبون)</span>
              </button>
            )}

            {activeOrder.status === 'courier_arrived' && (
              <button
                onClick={handleDeliverOrder}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تم التسليم بنجاح واستلام المبلغ</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. AVAILABLE ORDERS SHEET (IF ONLINE & NO ACTIVE ORDER) ================= */}
      {!activeOrder && availableOrders.length > 0 && currentCourier.isOnline && (
        <div className="bg-white border-t border-slate-200 shadow-2xl p-4 -mt-6 rounded-t-3xl relative z-30 max-w-xl mx-auto w-full space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>طلبات جاهزة للتوصيل بالقرب منك ({availableOrders.length})</span>
            </h3>
            <span className="text-[10px] text-slate-400">اختر طلباً لبدء رحلتك</span>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {availableOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{ord.storeName}</h4>
                  <p className="text-[11px] text-slate-500">
                    التوصيل إلى: {ord.customer.neighborhood} • {ord.items.length} أصناف
                  </p>
                  <span className="text-xs font-bold text-[#F47721] block mt-0.5">
                    أرباحك: {(ord.financials?.courierTotalEarnings ?? 3000).toLocaleString()} د.ع
                  </span>
                </div>

                <button
                  onClick={() => courierAcceptOrder(currentCourier.id, ord.id)}
                  className="px-3.5 py-2 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 whitespace-nowrap"
                >
                  قبول وتوصيل
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 5. BOTTOM FLOATING BAR (HELP, BIG ONLINE TOGGLE, INCENTIVES) ================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* A. Help Button (المساعدة) */}
          <button
            onClick={() => {
              startSupportConversation('مساعدة كابتن ميداني', activeOrder?.id);
              setIsSupportChatOpen(true);
            }}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <HelpCircle className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] font-bold">المساعدة</span>
          </button>

          {/* B. Big Central Online / Offline Toggle Button (زر التبديل الكبير في المنتصف) */}
          <button
            onClick={() => toggleCourierStatus(currentCourier.id)}
            disabled={Boolean(currentCourier.approvalStatus && currentCourier.approvalStatus !== 'approved')}
            className={`flex-1 py-3 px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
              currentCourier.approvalStatus && currentCourier.approvalStatus !== 'approved'
                ? 'bg-amber-600/90 text-white cursor-not-allowed opacity-90'
                : currentCourier.isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                : 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-900/20'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                currentCourier.approvalStatus && currentCourier.approvalStatus !== 'approved'
                  ? 'bg-amber-300'
                  : currentCourier.isOnline
                  ? 'bg-white animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {currentCourier.approvalStatus === 'pending'
                ? 'بانتظار موافقة المدير (غير متاح)'
                : currentCourier.approvalStatus === 'suspended'
                ? 'الحساب معلق مؤقتاً'
                : currentCourier.approvalStatus === 'rejected'
                ? 'الطلب مرفوض'
                : currentCourier.isOnline
                ? 'متصل (استقبال الطلبات مفعل)'
                : 'غير متصل (اضغط للاتصال)'}
            </span>
          </button>

          {/* C. Incentives & Earnings Section (قسم الحوافز والأرباح) */}
          <button
            onClick={() => setIsIncentivesModalOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl hover:bg-slate-100 text-slate-600 transition-colors relative"
          >
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <span className="text-[10px] font-bold">الأرباح والحوافز</span>
            {pricingSettings.isCourierBonusActive && (
              <span className="w-2 h-2 rounded-full bg-[#F47721] absolute top-1 right-2" />
            )}
          </button>
        </div>
      </div>

      {/* ================= 6. MODAL: COMMISSION & EARNINGS BREAKDOWN (TOP-LEFT CIRCLE) ================= */}
      {isCommissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#F47721] flex items-center justify-center font-bold">
                  <Percent className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#172554]">تفاصيل العمولة والأرباح</h3>
              </div>
              <button
                onClick={() => setIsCommissionModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600">نسبة عمولة منصة طلبي العامة:</span>
                <span className="font-extrabold text-[#172554] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  %{pricingSettings.defaultPlatformCommissionPercent}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600">أجرة الكابتن الأساسية لكل توصيل:</span>
                <span className="font-extrabold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  {pricingSettings.defaultCourierBasePayout.toLocaleString()} د.ع
                </span>
              </div>

              <div className="p-3 bg-orange-50/70 rounded-2xl border border-orange-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">حافز الكابتن الإضافي:</span>
                  <span className="text-[10px] text-slate-400">
                    {pricingSettings.isCourierBonusActive ? 'مفعل من قبل إدارة المنصة' : 'غير مفعل حالياً'}
                  </span>
                </div>
                <span className="font-extrabold text-[#F47721] bg-white px-2.5 py-1 rounded-lg border border-orange-200">
                  {pricingSettings.isCourierBonusActive
                    ? `+${pricingSettings.defaultCourierBonus.toLocaleString()} د.ع`
                    : '0 د.ع'}
                </span>
              </div>

              <div className="p-3 bg-slate-100 rounded-2xl text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">كيف تُحسب مستحقاتك؟</p>
                <p>يحصل الكابتن على مستحقات التوصيل كاملة (أجرة التوصيل + الحافز) مباشرة في محفظته فور تأكيد التسليم دون أي استقطاع عمولة من حصتك.</p>
              </div>
            </div>

            <button
              onClick={() => setIsCommissionModalOpen(false)}
              className="w-full py-2.5 bg-[#172554] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-slate-900"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ================= 7. DRAWER: CAPTAIN PROFILE & SETTINGS (TOP-RIGHT MENU) ================= */}
      {isProfileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white h-full w-full max-w-xs p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-[#172554]">الملف الشخصي للكابتن</h3>
                <button
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Courier Profile Info */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#172554] to-[#F47721] text-white flex items-center justify-center font-black text-xl mx-auto shadow-md">
                  {currentCourier.name.charAt(0)}
                </div>
                <h4 className="font-bold text-sm text-slate-900">{currentCourier.name}</h4>
                <p className="text-xs text-slate-400 font-mono" dir="ltr">
                  {currentCourier.phone}
                </p>

                <div className="flex items-center justify-center gap-1 text-amber-500 font-bold text-xs">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{currentCourier.rating}</span>
                  <span className="text-slate-400 font-normal">({currentCourier.ratingCount || 142} تقييم)</span>
                </div>
              </div>

              {/* Vehicle & Fleet Info */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">نوع المركبة:</span>
                  <span className="font-bold text-slate-800">{currentCourier.vehicleType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم اللوحة:</span>
                  <span className="font-bold font-mono text-slate-800">{currentCourier.vehiclePlate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إجمالي التوصيلات:</span>
                  <span className="font-bold text-[#F47721]">{currentCourier.totalDeliveries} طلب ناجح</span>
                </div>
              </div>

              {/* Switch Courier (For testing other fleet members) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500">
                  تبديل الكابتن (للتجربة والمحاكاة)
                </label>
                <select
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.vehicleType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ratings List Modal trigger */}
              <button
                onClick={() => setShowReviewsModal(true)}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                <span>عرض تقييمات وآراء الزبائن عني</span>
              </button>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRole('customer')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                العودة لتطبيق الزبون
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 8. MODAL: INCENTIVES & EARNINGS ================= */}
      {isIncentivesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#F47721] flex items-center justify-center font-bold">
                  <Gift className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#172554]">الحوافز ومكافآت التوصيل</h3>
              </div>
              <button
                onClick={() => setIsIncentivesModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-3.5 rounded-2xl border border-orange-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-[#172554]">
                  <span>حافز إضافي على كل طلب:</span>
                  <span className="text-[#F47721] text-sm font-black">
                    {pricingSettings.isCourierBonusActive
                      ? `+${pricingSettings.defaultCourierBonus.toLocaleString()} د.ع`
                      : 'غير مفعل'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {pricingSettings.isCourierBonusActive
                    ? 'يضاف تلقائياً مع كل عملية توصيل ناجحة لتشجيع الكباتن في أوقات الذروة.'
                    : 'يتم تفعيل الحافز من قبل إدارة المنصة في أوقات الذروة.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">التوصيلات المنجزة اليوم:</span>
                  <span className="font-bold text-slate-900">4 رحلات</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">أرباح اليوم التقديرية:</span>
                  <span className="font-bold text-emerald-700">14,000 د.ع</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                  <span className="text-slate-800">إجمالي رصيد المحفظة:</span>
                  <span className="text-[#F47721]">{currentCourier.walletBalance.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsIncentivesModalOpen(false)}
              className="w-full py-2.5 bg-[#172554] text-white rounded-xl font-bold text-xs hover:bg-slate-900"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

      {/* ================= 9. MODAL: MAP API & GPS SETUP EXPLANATION ================= */}
      {showMapInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#F47721]" />
                <h3 className="font-bold text-sm text-[#172554]">إعداد الخرائط الحقيقية وGPS</h3>
              </div>
              <button
                onClick={() => setShowMapInfoModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-1">
                <p className="font-bold">الخريطة الحقيقية تعمل حالياً بدون أي تكلفة:</p>
                <p className="text-[11px]">
                  التطبيق مدمج مع طبقات OpenStreetMap الحقيقية عالية الدقة لمدن العراق (بغداد، أربيل، البصرة)، وتعمل فوراً للمعاينة والتوصيل بدون الحاجة إلى إدخال بطاقة بنكية.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <p className="font-bold text-slate-800">لربط Google Maps Platform الرسمية في الإنتاج:</p>
                <ol className="list-decimal list-inside text-[11px] text-slate-500 space-y-1 pr-1">
                  <li>إنشاء مشروع في Google Cloud Console وتفعيل Maps JavaScript API.</li>
                  <li>توليد مفتاح API Key وتقييده بنطاق التطبيق الخاص بك.</li>
                  <li>تعيين المتغير <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">VITE_GOOGLE_MAPS_API_KEY</code> في ملف البيئة.</li>
                </ol>
              </div>

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-orange-950 text-[11px] space-y-1">
                <p className="font-bold">تحديد موقع GPS الحقيقي:</p>
                <p>
                  يستخدم التطبيق Geolocation API للوصول إلى إحداثيات GPS الحقيقية لهاتفك، ويقوم بفحص دقة الإشارة والتحقق من الحدود الجغرافية للعراق ومزامنة موقع الكابتن والزبون عبر Firebase Firestore.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowMapInfoModal(false)}
              className="w-full py-2.5 bg-[#172554] text-white rounded-xl font-bold text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ================= 10. MODAL: COURIER REVIEWS ================= */}
      {showReviewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <h3 className="font-bold text-sm text-[#172554]">
                  تقييمات الزبائن للكابتن {currentCourier.name}
                </h3>
              </div>
              <button
                onClick={() => setShowReviewsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5">
              {courierRatings.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{r.customerName}</span>
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < (r.courierRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.courierComment && (
                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                      "{r.courierComment}"
                    </p>
                  )}
                  {r.courierTags && r.courierTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.courierTags.map((tag, ti) => (
                        <span key={ti} className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {courierRatings.length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400">لا توجد تقييمات للكابتن بعد.</p>
              )}
            </div>

            <button
              onClick={() => setShowReviewsModal(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ================= 11. IN-APP SUPPORT CHAT MODAL ================= */}
      <InAppSupportChatModal
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
        relatedOrderId={activeOrder?.id}
      />
    </div>
  );
};

// Simple Icon wrapper for arrived alert
const BellRingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    <path d="M4 2C2.8 3.7 2 5.7 2 8" />
    <path d="M22 8c0-2.3-.8-4.3-2-6" />
  </svg>
);
