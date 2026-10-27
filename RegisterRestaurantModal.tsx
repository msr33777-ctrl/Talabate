import React, { useState } from 'react';
import {
  X,
  Store as StoreIcon,
  MapPin,
  Phone,
  User,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  DollarSign,
  UtensilsCrossed,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LocationCoordinates } from '../../types';
import RealInteractiveMap from '../common/RealInteractiveMap';

interface RegisterRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  'وجبات سريعة وبرجر',
  'مشويات وكباب عراقي',
  'شاورما وصاج',
  'بيتزا وفطائر',
  'مأكولات شعبية وتمن',
  'حلويات وآيس كريم',
  'كافيه وعصائر طبيعية',
  'سوبرماركت وبقالة',
];

const RegisterRestaurantModal: React.FC<RegisterRestaurantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { submitRestaurantApplication, uploadImageFile, currentUser } = useApp();

  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [ownerName, setOwnerName] = useState(currentUser?.name || '');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '0770');
  const [city, setCity] = useState('بغداد');
  const [neighborhood, setNeighborhood] = useState('المنصور');
  const [address, setAddress] = useState('');
  const [minOrder, setMinOrder] = useState<number>(5000);
  const [description, setDescription] = useState('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coordinates, setCoordinates] = useState<LocationCoordinates>({
    lat: 33.3152,
    lng: 44.3661,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await uploadImageFile(file);
      setLogoPreview(base64);
    } catch (err) {
      console.error('Failed to read image', err);
      setErrorMsg('تعذر تحميل الصورة، يرجى تجربة صورة أصغر حجماً');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!storeName.trim()) {
      setErrorMsg('يرجى كتابة اسم المطعم أو المتجر');
      return;
    }
    if (!ownerPhone.trim() || ownerPhone.length < 10) {
      setErrorMsg('يرجى كتابة رقم هاتف عراقي صحيح للتواصل');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('يرجى كتابة العنوان التفصيلي ونقطة دالة');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitRestaurantApplication({
        storeName: storeName.trim(),
        ownerName: ownerName.trim() || 'صاحب المتجر',
        ownerPhone: ownerPhone.trim(),
        category,
        address: `${city} - ${neighborhood}، ${address.trim()}`,
        coordinates,
        logoUrl: logoPreview || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
        minOrder: Number(minOrder) || 5000,
        applicantUserId: currentUser?.id,
        documents: {
          commercialLicenseUrl: logoPreview || undefined,
        },
      });

      if (res.success) {
        setSubmittedSuccess(true);
      } else {
        setErrorMsg(res.error || 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmittedSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden transform transition-all flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-orange-600 via-orange-500 to-amber-500 p-5 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner text-white">
              <StoreIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">انضم كمطعم شريك في TALABI</h3>
                <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-medium">تسجيل جديد</span>
              </div>
              <p className="text-orange-100 text-xs mt-0.5">
                وسّع مبيعاتك في العراق وانضم لأسرع منصة توصيل ذكية
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {submittedSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="text-xl font-black text-slate-800">
                تم استلام طلب انضمام مطعمك بنجاح!
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 max-w-md mx-auto leading-relaxed text-right space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>الحالة الحالية: بانتظار موافقة المدير</span>
                </div>
                <p className="text-xs text-amber-700">
                  تم تسجيل طلبك وحفظه في النظام. سيقوم فريق إدارة طلبي بمراجعة البيانات واعتماد المتجر. فور الموافقة، ستتمكن من فتح لوحة المطعم، ضبط القائمة، وتلقي الطلبات فوراً.
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition"
                >
                  فهمت، شكراً لك
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Status Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3 text-xs text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">سياسة الانضمام: </span>
                  يُحفظ الطلب مباشرة بحالة <strong>«بانتظار موافقة المدير»</strong> لحماية جودة المنصة. بعد الاعتماد يمكنك إدارة الأسعار والقوائم والطلبات بالكامل.
                </div>
              </div>

              {/* Store Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المطعم / المتجر <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <StoreIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="مثال: شاورما خان البغدادي"
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تصنيف الطعام أو النشاط <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <UtensilsCrossed className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none appearance-none bg-white font-medium"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Owner Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المسؤول / صاحب المطعم
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="اسمك الكامل"
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف للتواصل <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="0770XXXXXXX"
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Address & City */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدينة</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة / الحي</label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="مثال: المنصور، الكرادة"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأدنى للطلب (د.ع)</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="number"
                      step={500}
                      value={minOrder}
                      onChange={(e) => setMinOrder(Number(e.target.value))}
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  العنوان التفصيلي ونقطة دالة <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="مثال: شارع 14 رمضان، مجاور مصرف الرافدين، قرب تقاطع الرواد"
                    className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Interactive Map Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    حدد موقع المطعم الدقيق على الخريطة <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                  </span>
                </div>
                <div className="h-48 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                  <RealInteractiveMap
                    destinationCoords={coordinates}
                    isInteractivePicker={true}
                    onCoordinateSelect={(coords: LocationCoordinates) => setCoordinates(coords)}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  انقر على الخريطة لتثبيت مؤشر موقع المطعم لحساب مسافات التوصيل الدقيقة للزبائن.
                </p>
              </div>

              {/* Logo / Store Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  صورة / شعار المطعم (أو واجهة المحل)
                </label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-dashed border-slate-300">
                    <Upload className="w-4 h-4 text-orange-500" />
                    <span>اختر صورة المطعم</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                  {logoPreview ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={logoPreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                      <span className="text-xs text-emerald-600 font-medium">تم تجهيز الصورة</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      يمكنك رفع صورة شعار أو قائمة طعام
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري إرسال الطلب...</span>
                    </>
                  ) : (
                    <>
                      <StoreIcon className="w-4 h-4" />
                      <span>إرسال طلب الانضمام للمراجعة</span>
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

export default RegisterRestaurantModal;
