import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import {
  Star,
  X,
  Store,
  Bike,
  Heart,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
} from 'lucide-react';

interface OrderRatingModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STORE_TAG_OPTIONS = [
  'طعام ساخن ولذيذ',
  'تغليف محكم وممتاز',
  'كمية وفيرة ومُشبعة',
  'طعم بغدادي أصيل',
  'توصيل أسرع من المتوقع',
  'أصناف طازجة 100%',
];

const COURIER_TAG_OPTIONS = [
  'كابتن لبق وخلوق',
  'وصل بسرعة قياسية',
  'ملتزم بالتعليمات وعنوان الباب',
  'حافظ على سخونة الطلب',
  'تعامل راقي ومحترم',
  'محافظ على سلامة الوجبة',
];

const RATING_LABELS: Record<number, string> = {
  1: 'تجربة سيئة جداً',
  2: 'أقل من المتوقع',
  3: 'جيد ومقبول',
  4: 'جيد جداً ولذيذ',
  5: 'ممتاز وفوق التقييم!',
};

export const OrderRatingModal: React.FC<OrderRatingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { submitOrderRating, currentUser, isOrderRated } = useApp();

  const [storeRating, setStoreRating] = useState<number>(5);
  const [storeHover, setStoreHover] = useState<number | null>(null);
  const [storeComment, setStoreComment] = useState('');
  const [selectedStoreTags, setSelectedStoreTags] = useState<string[]>([
    'طعام ساخن ولذيذ',
    'تغليف محكم وممتاز',
  ]);

  const [courierRating, setCourierRating] = useState<number>(order.courierId ? 5 : 0);
  const [courierHover, setCourierHover] = useState<number | null>(null);
  const [courierComment, setCourierComment] = useState('');
  const [selectedCourierTags, setSelectedCourierTags] = useState<string[]>([
    'كابتن لبق وخلوق',
    'وصل بسرعة قياسية',
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const alreadyRated = isOrderRated(order.id) || order.isRated;

  const toggleStoreTag = (tag: string) => {
    setSelectedStoreTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleCourierTag = (tag: string) => {
    setSelectedCourierTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (storeRating < 1) {
      setErrorMessage('يرجى تحديد تقييم المطعم بنجمة واحدة على الأقل');
      return;
    }

    if (order.courierId && courierRating < 1) {
      setErrorMessage('يرجى تحديد تقييم الكابتن المندوب');
      return;
    }

    setIsSubmitting(true);

    const res = await submitOrderRating({
      orderId: order.id,
      customerId: currentUser.id,
      customerName: currentUser.name || order.customer.name,
      customerPhone: currentUser.phone || order.customer.phone,
      storeId: order.storeId,
      storeName: order.storeName,
      storeRating,
      storeComment: storeComment.trim() || undefined,
      storeTags: selectedStoreTags,
      courierId: order.courierId || undefined,
      courierName: order.courierName || undefined,
      courierRating: order.courierId ? courierRating : undefined,
      courierComment: courierComment.trim() || undefined,
      courierTags: selectedCourierTags,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmittedSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setErrorMessage(res.error || 'تعذر إرسال التقييم، يرجى المحاولة لاحقاً');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col my-auto text-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#172554]">
                تقييم الطلب #{order.id}
              </h3>
              <p className="text-[11px] text-slate-400">
                رأيك يمنح التقدير للمطاعم والمناديب المتميزين
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {alreadyRated ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50 rounded-3xl border border-emerald-200">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="font-black text-lg text-emerald-950">
                تم استلام تقييمك لهذا الطلب مسبقاً!
              </h4>
              <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                شكراً لمشاركتك رأيك القيّم، تم تحديث متوسط تقييم متجر{' '}
                <strong>{order.storeName}</strong> والكابتن في النظام فورياً.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          ) : submittedSuccess ? (
            <div className="p-8 text-center space-y-3 bg-gradient-to-b from-orange-50 to-amber-50 rounded-3xl border border-orange-200">
              <div className="w-16 h-16 rounded-full bg-orange-500 text-white flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <Heart className="w-8 h-8 fill-white" />
              </div>
              <h4 className="font-black text-xl text-[#172554]">
                عاشت إيدك! تم حفظ التقييم بنجاح
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                تم تحديث تقييم مطعم {order.storeName}
                {order.courierName ? ` والكابتن ${order.courierName}` : ''} فورياً في المنصة.
              </p>
              <div className="flex justify-center gap-1 text-amber-500 pt-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-500" />
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-700 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Store Rating Card */}
              <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-orange-600 font-bold block uppercase tracking-wider">
                        تقييم المطعم والمتجر
                      </span>
                      <h4 className="font-black text-sm text-[#172554]">
                        {order.storeName}
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    {RATING_LABELS[storeHover || storeRating] || ''}
                  </span>
                </div>

                {/* Stars selector */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (storeHover || storeRating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setStoreRating(star)}
                        onMouseEnter={() => setStoreHover(star)}
                        onMouseLeave={() => setStoreHover(null)}
                        className="p-1 rounded-xl transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`w-9 h-9 transition-colors ${
                            active
                              ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Quick Compliment Tags */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">
                    ما الذي أعجبك في الطلب؟ (اختر ما يناسبك):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {STORE_TAG_OPTIONS.map((tag) => {
                      const selected = selectedStoreTags.includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => toggleStoreTag(tag)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                            selected
                              ? 'bg-orange-500 text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Review Text */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-orange-500" />
                    رأيك للمطعم (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={storeComment}
                    onChange={(e) => setStoreComment(e.target.value)}
                    placeholder="مثلاً: الطعم أصيل، البهارات مضبوطة، الوجبة وصلت ساخنة..."
                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-orange-500 bg-white"
                  />
                </div>
              </div>

              {/* 2. Courier Rating Card (if courier was assigned) */}
              {order.courierName && (
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#172554] text-white flex items-center justify-center shadow">
                        <Bike className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-600 font-bold block uppercase tracking-wider">
                          تقييم كابتن التوصيل
                        </span>
                        <h4 className="font-black text-sm text-[#172554]">
                          {order.courierName}
                        </h4>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {RATING_LABELS[courierHover || courierRating] || ''}
                    </span>
                  </div>

                  {/* Stars selector */}
                  <div className="flex items-center justify-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (courierHover || courierRating) >= star;
                      return (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setCourierRating(star)}
                          onMouseEnter={() => setCourierHover(star)}
                          onMouseLeave={() => setCourierHover(null)}
                          className="p-1 rounded-xl transition-transform hover:scale-125 focus:outline-none"
                        >
                          <Star
                            className={`w-9 h-9 transition-colors ${
                              active
                                ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Compliment Tags for Courier */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">
                      إشادات بأداء الكابتن:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COURIER_TAG_OPTIONS.map((tag) => {
                        const selected = selectedCourierTags.includes(tag);
                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => toggleCourierTag(tag)}
                            className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                              selected
                                ? 'bg-[#172554] text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Courier Comment */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      كلمة شكر أو ملاحظة للكابتن (اختياري)
                    </label>
                    <textarea
                      rows={2}
                      value={courierComment}
                      onChange={(e) => setCourierComment(e.target.value)}
                      placeholder="مثلاً: كابتن محترم جداً، وصل بسرعة وحافظ على سخونة الوجبة..."
                      className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>جاري حفظ وتحديث التقييم في الخادم...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال التقييم النهائي</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
