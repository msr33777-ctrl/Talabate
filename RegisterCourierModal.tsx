import React, { useState } from 'react';
import {
  X,
  Bike,
  User,
  Phone,
  MapPin,
  Upload,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  FileText,
  Clock,
  Sparkles,
  Car,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LocationCoordinates } from '../../types';
import RealInteractiveMap from '../common/RealInteractiveMap';

interface RegisterCourierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VEHICLE_TYPES = [
  { id: 'دراجة نارية (ماطور)', label: 'دراجة نارية (ماطور)', icon: Bike },
  { id: 'سيارة صالون / خصوصي', label: 'سيارة خصوصي', icon: Car },
  { id: 'سكوتر كهربائي', label: 'سكوتر كهربائي', icon: Bike },
  { id: 'دراجة هوائية (بايسكل)', label: 'دراجة هوائية', icon: Bike },
];

const RegisterCourierModal: React.FC<RegisterCourierModalProps> = ({ isOpen, onClose }) => {
  const { submitCourierApplication, uploadImageFile, currentUser } = useApp();

  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '0770');
  const [city, setCity] = useState('بغداد');
  const [neighborhood, setNeighborhood] = useState('المنصور واليرموك');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('دراجة نارية (ماطور)');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // Documents
  const [driverLicenseImg, setDriverLicenseImg] = useState<string>('');
  const [nationalIdImg, setNationalIdImg] = useState<string>('');
  const [vehicleRegImg, setVehicleRegImg] = useState<string>('');
  const [profilePhotoImg, setProfilePhotoImg] = useState<string>('');

  const [coordinates, setCoordinates] = useState<LocationCoordinates>({
    lat: 33.3152,
    lng: 44.3661,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (
    file: File,
    setter: (val: string) => void
  ) => {
    try {
      const base64 = await uploadImageFile(file);
      setter(base64);
    } catch (err) {
      console.error('File upload error', err);
      setErrorMsg('تعذر رفع المستند، يرجى التأكد من أن حجم الصورة مناسب');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || fullName.trim().length < 4) {
      setErrorMsg('يرجى إدخال الاسم الثلاثي الكامل للكابتن');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      setErrorMsg('يرجى إدخال رقم هاتف عراقي فعال للتواصل وتفعيل الحساب');
      return;
    }
    if (!vehiclePlate.trim()) {
      setErrorMsg('يرجى إدخال رقم لوحة المركبة أو رقم التعريف');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitCourierApplication({
        fullName: fullName.trim(),
        phone: phone.trim(),
        city,
        address: `${city} - ${neighborhood}، ${address.trim()}`,
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim() || undefined,
        coordinates,
        applicantUserId: currentUser?.id,
        documents: {
          driverLicenseUrl: driverLicenseImg || undefined,
          nationalIdUrl: nationalIdImg || undefined,
          vehicleRegistrationUrl: vehicleRegImg || undefined,
          profilePhotoUrl: profilePhotoImg || undefined,
        },
      });

      if (res.success) {
        setSubmittedSuccess(true);
      } else {
        setErrorMsg(res.error || 'تعذر تسجيل الطلب، يرجى المحاولة لاحقاً');
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
        {/* Header */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-blue-900 p-5 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 backdrop-blur-md flex items-center justify-center shadow-inner text-orange-400">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">انضم ككابتن توصيل TALABI</h3>
                <span className="bg-orange-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  فرصة عمل حرة
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                أجور توصيل مميزة + حوافز إضافية وحرية اختيار أوقات العمل
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

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {submittedSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="text-xl font-black text-slate-800">
                تم استلام طلب انضمامك ككابتن بنجاح!
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 max-w-md mx-auto leading-relaxed text-right space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>الحالة الحالية: بانتظار موافقة المدير</span>
                </div>
                <p className="text-xs text-amber-700">
                  تم تسجيل ملفك ورفع المستندات بنجاح. سيقوم مشرف العمليات بالتحقق من صحة المستندات واعتماد الحساب. فور الموافقة، ستتمكن من تسجيل الدخول وتفعيل حالة الاتصال واستلام الطلبات وتوليد الأرباح.
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md transition"
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-3 text-xs text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">شروط القبول والسرية: </span>
                  يخضع جميع الكباتن للتدقيق الإداري والموافقة المسبقة لحماية الزبائن والمطاعم. لا يمكن فتح الاتصال أو استقبال الطلبات قبل صدور قرار الاعتماد.
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم الثلاثي الكامل <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: علي حسن كاظم"
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف الفعال <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0770XXXXXXX"
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع وسيلة التوصيل <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((v) => {
                    const Icon = v.icon;
                    const isSelected = vehicleType === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleType(v.id)}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-[11px]">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Plate & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم اللوحة / تسجيل المركبة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="مثال: بغداد 24519 ف"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    طراز وموديل المركبة
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="مثال: هوندا كليك 2022"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدينة</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المناطق المفضلة للتوصيل
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="مثال: المنصور، اليرموك، الحارثية"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Interactive Location Pin */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    نقطة التواجد الأساسية / السكن على الخريطة
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                  </span>
                </div>
                <div className="h-40 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                  <RealInteractiveMap
                    destinationCoords={coordinates}
                    isInteractivePicker={true}
                    onCoordinateSelect={(coords: LocationCoordinates) => setCoordinates(coords)}
                  />
                </div>
              </div>

              {/* Required Documents Upload */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>المستندات والوثائق الرسمية (صورة واضحة)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">تُحفظ في بيئة مشفرة وآمنة</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Driver License */}
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex flex-col items-center justify-between text-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">إجازة السوق</span>
                    {driverLicenseImg ? (
                      <div className="relative group w-full h-14 rounded-lg overflow-hidden border border-emerald-300">
                        <img src={driverLicenseImg} alt="License" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] py-0.5">تم الرفع</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-full py-2 bg-white hover:bg-slate-100 text-slate-600 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>رفع الإجازة</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, setDriverLicenseImg);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* National ID */}
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex flex-col items-center justify-between text-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">البطاقة الوطنية</span>
                    {nationalIdImg ? (
                      <div className="relative group w-full h-14 rounded-lg overflow-hidden border border-emerald-300">
                        <img src={nationalIdImg} alt="ID" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] py-0.5">تم الرفع</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-full py-2 bg-white hover:bg-slate-100 text-slate-600 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>رفع الهوية</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, setNationalIdImg);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Vehicle Registration */}
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex flex-col items-center justify-between text-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">سنوية المركبة</span>
                    {vehicleRegImg ? (
                      <div className="relative group w-full h-14 rounded-lg overflow-hidden border border-emerald-300">
                        <img src={vehicleRegImg} alt="Vehicle Reg" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] py-0.5">تم الرفع</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-full py-2 bg-white hover:bg-slate-100 text-slate-600 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>رفع السنوية</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, setVehicleRegImg);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Profile Photo */}
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex flex-col items-center justify-between text-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">صورة شخصية</span>
                    {profilePhotoImg ? (
                      <div className="relative group w-full h-14 rounded-lg overflow-hidden border border-emerald-300">
                        <img src={profilePhotoImg} alt="Profile" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] py-0.5">تم الرفع</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-full py-2 bg-white hover:bg-slate-100 text-slate-600 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>صورة الكابتن</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, setProfilePhotoImg);
                          }}
                        />
                      </label>
                    )}
                  </div>
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
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري إرسال الطلب...</span>
                    </>
                  ) : (
                    <>
                      <Bike className="w-4 h-4 text-orange-400" />
                      <span>تقديم طلب الانضمام ككابتن</span>
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

export default RegisterCourierModal;
