import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, OrderItem, PaymentMethod, LocationCoordinates } from '../../types';
import { RealInteractiveMap } from '../common/RealInteractiveMap';
import { PhoneAuthModal } from '../common/PhoneAuthModal';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShoppingBag,
  MapPin,
  Banknote,
  Smartphone,
  CreditCard,
  Lock,
  ArrowRight,
  Phone,
  HelpCircle,
} from 'lucide-react';

interface FinalOrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhood: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  coordinates: LocationCoordinates;
  onConfirmOrder: (idempotencyKey: string) => Promise<void>;
  isSubmitting: boolean;
}

export const FinalOrderReviewModal: React.FC<FinalOrderReviewModalProps> = ({
  isOpen,
  onClose,
  store,
  items,
  customerName,
  customerPhone,
  address,
  neighborhood,
  notes,
  paymentMethod,
  subtotal,
  deliveryFee,
  serviceFee,
  total,
  coordinates,
  onConfirmOrder,
  isSubmitting,
}) => {
  const { currentUser } = useApp();
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [isPhoneVerifiedForCod, setIsPhoneVerifiedForCod] = useState(
    Boolean((currentUser as any)?.phoneVerified)
  );

  // Unique Idempotency Key generated per review session
  const [idempotencyKey] = useState(
    () => `idem_${store.id}_${currentUser.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );

  if (!isOpen) return null;

  const handleFinalSubmit = async () => {
    // If Cash on delivery, verify phone first to prevent fake anonymous orders
    if (paymentMethod === 'cash_on_delivery' && !isPhoneVerifiedForCod) {
      setShowPhoneOtpModal(true);
      return;
    }

    if (!hasConfirmedCheckbox) {
      return;
    }

    await onConfirmOrder(idempotencyKey);
  };

  const paymentTitles: Record<PaymentMethod, { title: string; desc: string; icon: React.ReactNode }> = {
    cash_on_delivery: {
      title: 'نقد عند الاستلام (COD)',
      desc: 'الدفع نقداً بالدينار العراقي للمندوب فور وصوله إلى بابك',
      icon: <Banknote className="w-4 h-4 text-emerald-600" />,
    },
    zain_cash: {
      title: 'محفظة زين كاش العراقية',
      desc: 'خصم فوري وآمن من رصيد محفظة زين كاش',
      icon: <Smartphone className="w-4 h-4 text-orange-500" />,
    },
    qi_card: {
      title: 'بطاقة كي كارد / ماستركارد',
      desc: 'دفع إلكتروني فوري ومشفر',
      icon: <CreditCard className="w-4 h-4 text-sky-600" />,
    },
    asia_pay: {
      title: 'آسيا حوالة / FastPay',
      desc: 'محفظة رقمية محلية',
      icon: <Smartphone className="w-4 h-4 text-purple-600" />,
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in text-slate-800">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col my-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#172554]">
                مراجعة وتأكيد الطلب النهائي
              </h3>
              <p className="text-[11px] text-slate-400">
                صفحة التأكيد الإلزامي لمنع الطلبات بالخطأ أو الوهمية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Store Info Banner */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={store.logo}
                alt={store.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">{store.name}</h4>
                <p className="text-[11px] text-slate-500">{store.neighborhood} - {store.address}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
              {items.length} أصناف
            </span>
          </div>

          {/* Items Summary Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-600 flex justify-between">
              <span>الأصناف المختارة</span>
              <span>السعر الإفرادي</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800">
                      {item.quantity} × {item.name}
                    </span>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <p className="text-[10px] text-slate-400">
                        {item.selectedOptions.map((o) => o.name).join('، ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-amber-700 italic">ملاحظة: {item.notes}</p>
                    )}
                  </div>
                  <span className="font-bold text-slate-700">
                    {(item.price * item.quantity).toLocaleString()} د.ع
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Destination Details */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <h5 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-500" />
              تفاصيل التوصيل وموقع العميل
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400 block">اسم المستلم:</span>
                <strong className="text-slate-900">{customerName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">رقم الهاتف:</span>
                <span className="font-mono text-slate-900 font-bold" dir="ltr">
                  {customerPhone}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block">عنوان التوصيل والنقطة الدالة:</span>
                <strong className="text-slate-900">{neighborhood} - {address}</strong>
                {notes && <p className="text-amber-800 text-[10px] mt-0.5">ملاحظات: {notes}</p>}
              </div>
            </div>

            {/* Coordinates verification badge */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">
                الإحداثيات الجغرافية: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                موقع موثق داخل العراق
              </span>
            </div>
          </div>

          {/* Payment Method Review */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                {paymentTitles[paymentMethod].icon}
              </div>
              <div>
                <h6 className="font-extrabold text-slate-900">{paymentTitles[paymentMethod].title}</h6>
                <p className="text-[10px] text-slate-400">{paymentTitles[paymentMethod].desc}</p>
              </div>
            </div>
            {paymentMethod === 'cash_on_delivery' && (
              <div>
                {isPhoneVerifiedForCod ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    رقم موثق بـ OTP
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPhoneOtpModal(true)}
                    className="text-[10px] bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>توثيق الرقم بـ OTP الآن</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>مجموع الأصناف:</span>
              <span className="font-bold">{subtotal.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>أجرة التوصيل ({neighborhood}):</span>
              <span className="font-bold">{deliveryFee.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>رسوم الخدمة والتشغيل:</span>
              <span className="font-bold">{serviceFee.toLocaleString()} د.ع</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-[#172554]">
              <span>المبلغ الإجمالي النهائي:</span>
              <span className="text-base text-orange-600 font-black">{total.toLocaleString()} د.ع</span>
            </div>
          </div>

          {/* Idempotency & Anti-fraud badge */}
          <div className="p-2.5 bg-slate-100 rounded-xl text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>مفتاح عدم التكرار (Idempotency Key):</span>
            </span>
            <span className="font-mono text-slate-700 font-semibold">{idempotencyKey.substring(0, 22)}...</span>
          </div>

          {/* Explicit User Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-orange-200 bg-orange-50/50 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={hasConfirmedCheckbox}
              onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
              className="mt-0.5 accent-orange-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-slate-700 leading-snug">
              أؤكد صحة تفاصيل الطلب والعنوان ورغبتي الفعلية بالاستلام، وأوافق على شروط سياسة التوصيل والإلغاء في تطبيق طلبي TALABI.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          <button
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            تعديل الطلب
          </button>

          <button
            disabled={isSubmitting || !hasConfirmedCheckbox || (paymentMethod === 'cash_on_delivery' && !isPhoneVerifiedForCod)}
            onClick={handleFinalSubmit}
            className="flex-1 py-3.5 bg-[#F47721] hover:bg-orange-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isSubmitting ? (
              <span>جاري توثيق وإرسال الطلب للخادم...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>إرسال الطلب النهائي الآن ({total.toLocaleString()} د.ع)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Embedded Phone OTP Modal for COD if needed */}
      <PhoneAuthModal
        isOpen={showPhoneOtpModal}
        onClose={() => setShowPhoneOtpModal(false)}
        onVerifiedSuccess={(phone) => {
          setIsPhoneVerifiedForCod(true);
        }}
        title="تأكيد رقم الهاتف للطلبات النقدية"
        subtitle="لمنع الطلبات الوهمية، يرجى تأكيد رمز OTP لطلب الدفع نقد عند الاستلام"
        requireForCod={true}
      />
    </div>
  );
};
