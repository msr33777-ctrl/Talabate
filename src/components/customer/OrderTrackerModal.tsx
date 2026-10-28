import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RealInteractiveMap } from '../common/RealInteractiveMap';
import { OrderRatingModal } from './OrderRatingModal';
import {
  X,
  Clock,
  CheckCircle2,
  Phone,
  AlertCircle,
  HelpCircle,
  Receipt,
  MapPin,
  Store,
  Bike,
  Ban,
  BellRing,
  Navigation,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { OrderStatus } from '../../types';

interface OrderTrackerModalProps {
  orderId: string;
  onClose: () => void;
}

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({ orderId, onClose }) => {
  const {
    orders,
    cancelOrder,
    startSupportConversation,
    setRole,
    role,
    isOrderRated,
    completeTestOrder,
    advanceTestOrderStage,
  } = useApp();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('تم الطلب عن طريق الخطأ');
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  const order = orders.find((o) => o.id === orderId);

  if (!order) return null;

  const steps: { status: OrderStatus; label: string; sub: string }[] = [
    { status: 'created', label: 'تم استلام الطلب', sub: 'وصل طلبك بنجاح إلى النظام' },
    { status: 'merchant_accepted', label: 'المتجر وافق', sub: 'بدأ فريق العمل مراجعة طلبك' },
    { status: 'preparing', label: 'قيد التحضير', sub: 'يجري تحضير وتغليف وجبتك' },
    { status: 'ready_for_pickup', label: 'جاهز للاستلام', sub: 'بانتظار استلام الكابتن' },
    { status: 'courier_assigned', label: 'تم تعيين المندوب', sub: `${order.courierName || 'الكابتن'} في الطريق للمتجر` },
    { status: 'picked_up', label: 'في الطريق إليك', sub: 'الكابتن استلم الطلب وهو متوجه لعنوانك' },
    { status: 'courier_arrived', label: 'الكابتن وصل عند الباب', sub: 'الكابتن بانتظارك الآن لتسليم الطلب' },
    { status: 'delivered', label: 'تم التوصيل بنجاح', sub: 'بالعافية! تم تسليم طلبك' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'cancelled') return -1;
    return steps.findIndex((s) => s.status === status);
  };

  const currentStepIdx = getStepIndex(order.status);
  const canCancel = order.status === 'created' || order.status === 'merchant_accepted';

  const handleCallCourier = () => {
    if (order.courierPhone) {
      window.location.href = `tel:${order.courierPhone}`;
    }
  };

  const handleContactSupport = () => {
    startSupportConversation(`استفسار بخصوص الطلب #${order.id}`, order.id);
    setRole('support');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col my-auto text-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
            <h3 className="font-extrabold text-lg text-[#172554]">تتبع الطلب #{order.id}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Admin Simulation & Test Order Controls */}
          {(role === 'admin' || order.isTest || order.customer?.name?.includes('تجريبي')) &&
            order.status !== 'delivered' &&
            order.status !== 'cancelled' && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                    وضع المدير التجريبي
                  </span>
                  <span className="text-amber-950 font-bold">هذا طلب تجريبي للمحاكاة وفحص النظام</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => completeTestOrder(order.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>إتمام الطلب التجريبي</span>
                  </button>
                  <button
                    onClick={() => advanceTestOrderStage(order.id)}
                    className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <span>تقديم مرحلة</span>
                  </button>
                </div>
              </div>
            )}
          {/* High Priority Arrival Banner if courier arrived */}
          {order.status === 'courier_arrived' && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg flex items-center justify-between gap-3 animate-bounce">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-orange-600 flex items-center justify-center shadow">
                  <BellRing className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-sm">الكابتن وصل إلى عنوانك وهو بالباب الآن!</h4>
                  <p className="text-xs text-orange-100 mt-0.5">
                    يرجى النزول أو فتح الباب لاستلام الوجبة. وقت الوصول: {order.courierArrivedAt || 'الآن'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              order.status === 'delivered'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : order.status === 'cancelled'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : order.status === 'courier_arrived'
                ? 'bg-orange-50 border-orange-300 text-orange-950 font-bold'
                : 'bg-orange-50 border-orange-200 text-[#172554]'
            }`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">الحالة المباشرة</span>
              <h4 className="text-base font-extrabold mt-0.5">
                {order.status === 'delivered'
                  ? 'تم استلام الطلب بنجاح'
                  : order.status === 'cancelled'
                  ? `تم إلغاء الطلب: ${order.cancellationReason || ''}`
                  : steps.find((s) => s.status === order.status)?.label || 'قيد المتابعة'}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {order.status === 'cancelled'
                  ? 'تم تسجيل سبب الإلغاء في سجل الرقابة'
                  : order.status === 'courier_arrived'
                  ? 'الكابتن متواجد عند الباب بانتظارك'
                  : `الوقت المتوقع للوصول: ${order.estimatedDeliveryTime || '25 دقيقة'}`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-orange-500 border border-slate-100">
              {order.status === 'delivered' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : order.status === 'cancelled' ? (
                <Ban className="w-6 h-6 text-rose-600" />
              ) : (
                <Clock className="w-6 h-6 text-orange-500 animate-spin" style={{ animationDuration: '8s' }} />
              )}
            </div>
          </div>

          {/* Rating CTA if delivered */}
          {order.status === 'delivered' && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow shrink-0">
                  <Star className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-[#172554]">
                    {isOrderRated(order.id) || order.isRated ? 'تم تقييم هذا الطلب بنجاح!' : 'كيف كانت وجبتك والخدمة؟'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isOrderRated(order.id) || order.isRated
                      ? 'شكراً لرأيك، تم تحديث تقييم المتجر والكابتن فورياً.'
                      : 'شاركنا تقييمك لمطعمك المفضل والكابتن بالنجوم والملاحظات.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsRatingModalOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <Star className="w-4 h-4 fill-white" />
                <span>{isOrderRated(order.id) || order.isRated ? 'عرض التقييم' : 'قيّم الطلب الآن'}</span>
              </button>
            </div>
          )}

          {/* Real Interactive Map with Real Coordinates */}
          {order.status !== 'cancelled' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  خريطة التتبع الحقيقية وموقع التوصيل
                </span>
                <span className="text-[10px] text-slate-400">بدون مسارات وهمية مصطنعة</span>
              </div>
              <RealInteractiveMap
                status={order.status}
                storeName={order.storeName}
                storeAddress={order.storeAddress}
                customerAddress={`${order.customer.neighborhood} - ${order.customer.address}`}
                customerCoordinates={order.customer.coordinates}
                courierName={order.courierName}
                courierLocation={order.courierLocation}
                isInteractivePicker={false}
              />
            </div>
          )}

          {/* Courier Card if assigned */}
          {order.courierName && order.status !== 'cancelled' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#172554] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <Bike className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#172554]">{order.courierName}</span>
                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">
                      كابتن معتمد
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {order.status === 'courier_arrived' ? 'متواجد الآن عند باب المبنى' : 'في طريقه إليك'}
                  </p>
                </div>
              </div>
              {order.courierPhone && (
                <button
                  onClick={handleCallCourier}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال بالكابتن</span>
                </button>
              )}
            </div>
          )}

          {/* Stepper Timeline */}
          {order.status !== 'cancelled' && (
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-700 mb-3">مراحل إعداد وتوصيل الطلب</h4>
              <div className="space-y-3 relative before:absolute before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {steps.map((step, idx) => {
                  const isDone = currentStepIdx >= idx;
                  const isCurrent = currentStepIdx === idx;
                  return (
                    <div key={step.status} className="flex items-start gap-3 relative pr-7">
                      <div
                        className={`absolute right-1 top-0.5 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                          isDone
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isCurrent ? 'text-orange-600' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                          {step.label}
                        </p>
                        <p className="text-[11px] text-slate-500">{step.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items breakdown invoice */}
          <div className="border border-slate-100 rounded-2xl p-4 bg-white">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-orange-500" />
                تفاصيل الفاتورة والأصناف
              </h4>
              <span className="text-xs font-bold text-slate-500">{order.storeName}</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">
                      {item.quantity} × {item.name}
                    </span>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <p className="text-[10px] text-slate-400">
                        {item.selectedOptions.map((o) => o.name).join('، ')}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-slate-700">
                    {(item.price * item.quantity).toLocaleString()} د.ع
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{order.subtotal.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span>أجور التوصيل:</span>
                <span>{order.deliveryFee.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span>رسوم الخدمة والتشغيل:</span>
                <span>{order.serviceFee.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-[#172554]">
                <span>المجموع الكلي:</span>
                <span className="text-orange-600">{order.total.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-slate-500">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-slate-700">
                  {order.payment.method === 'zain_cash'
                    ? 'زين كاش (مدفوع)'
                    : order.payment.method === 'qi_card'
                    ? 'كي كارد (مدفوع)'
                    : order.payment.method === 'asia_pay'
                    ? 'آسيا حوالة (مدفوع)'
                    : 'نقد عند الاستلام (COD)'}
                </span>
              </div>
            </div>
          </div>

          {/* Cancellation Notice if not allowed */}
          {!canCancel && order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">سياسة الإلغاء:</p>
                <p>
                  الطلب الآن في مرحلة التحضير أو التوصيل النشط، ولا يمكن إلغاؤه لحفظ حقوق المتجر والمندوب. إذا كان لديك ظرف طارئ، يرجى التواصل فوراً مع الدعم الفني.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons: Support and Cancel */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleContactSupport}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-orange-500" />
              <span>محادثة الدعم الفني</span>
            </button>

            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="py-3 px-4 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-xs transition-colors"
              >
                إلغاء الطلب (متاح قبل التجهيز)
              </button>
            )}
          </div>

          {/* Cancel Confirmation Prompt */}
          {showCancelDialog && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-700 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>تأكيد إلغاء الطلب قبل بدء التجهيز</span>
              </div>
              <p className="text-slate-600">
                يرجى تحديد سبب الإلغاء الصريح؛ يتم تسجيل الإلغاءات في سجل النظام لحماية المنصة من الطلبات الوهمية المتكررة:
              </p>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-xs font-semibold"
              >
                <option value="تم الطلب عن طريق الخطأ">تم الطلب عن طريق الخطأ</option>
                <option value="تأخر في تأكيد المطعم للطلب">تأخر في تأكيد المطعم للطلب</option>
                <option value="تغيير في العنوان أو الخطة">تغيير في العنوان أو الخطة</option>
                <option value="طلب صنف غير مرغوب">طلب صنف غير مرغوب</option>
                <option value="سبب آخر">سبب آخر</option>
              </select>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-rose-100 font-bold"
                >
                  تراجع
                </button>
                <button
                  onClick={() => {
                    cancelOrder(order.id, cancelReason);
                    setShowCancelDialog(false);
                  }}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm"
                >
                  تأكيد الإلغاء النهائي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      <OrderRatingModal
        order={order}
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
      />
    </div>
  );
};
