import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AreaFeeConfig, StoreCommissionOverride } from '../../types';
import {
  DollarSign,
  Percent,
  Bike,
  Store,
  MapPin,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  History,
  ShieldCheck,
  Gift,
  Coins,
  ArrowRight,
  TrendingUp,
  Navigation,
  Route,
  Gauge,
  Zap,
} from 'lucide-react';
import { computeDistanceDeliveryFee } from '../../utils/distancePricing';

export const PricingAndCommissionsManager: React.FC = () => {
  const {
    pricingSettings,
    updatePricingSettings,
    stores,
    currentUser,
    firebaseUser,
    auditLogs,
  } = useApp();

  const isAdmin =
    currentUser.role === 'admin' ||
    (firebaseUser && (firebaseUser.email === 'msr33777@gmail.com' || (firebaseUser as any).isAdmin));

  // Local editing state for Distance-Based Delivery Pricing
  const [distanceBaseFee, setDistanceBaseFee] = useState<number>(
    pricingSettings.distanceBaseFee ?? 1500
  );
  const [distanceFeePerKm, setDistanceFeePerKm] = useState<number>(
    pricingSettings.distanceFeePerKm ?? 250
  );
  const [distanceMaxFee, setDistanceMaxFee] = useState<number>(
    pricingSettings.distanceMaxFee ?? 5000
  );
  const [isDistancePricingEnabled, setIsDistancePricingEnabled] = useState<boolean>(
    pricingSettings.isDistancePricingEnabled !== false
  );

  // Local editing state for Global Settings
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(pricingSettings.defaultDeliveryFee);
  const [defaultCourierBasePayout, setDefaultCourierBasePayout] = useState(pricingSettings.defaultCourierBasePayout);
  const [defaultCourierBonus, setDefaultCourierBonus] = useState(pricingSettings.defaultCourierBonus);
  const [isCourierBonusActive, setIsCourierBonusActive] = useState<boolean>(pricingSettings.isCourierBonusActive !== false);
  const [defaultPlatformCommissionPercent, setDefaultPlatformCommissionPercent] = useState(
    pricingSettings.defaultPlatformCommissionPercent
  );

  // Local editing state for Area Fees
  const [areaFees, setAreaFees] = useState<AreaFeeConfig[]>(pricingSettings.areaDeliveryFees || []);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDeliveryFee, setNewAreaDeliveryFee] = useState(3000);
  const [newAreaCourierPayout, setNewAreaCourierPayout] = useState(2500);

  // Local editing state for Store Overrides
  const [storeOverrides, setStoreOverrides] = useState<StoreCommissionOverride[]>(
    pricingSettings.storeCommissionOverrides || []
  );

  // Status message
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Interactive Live Calculator Simulation state
  const [calcSubtotal, setCalcSubtotal] = useState(25000);
  const [calcSelectedStoreId, setCalcSelectedStoreId] = useState(stores[0]?.id || 'store_1');
  const [calcSelectedArea, setCalcSelectedArea] = useState(areaFees[0]?.name || 'بغداد - المنصور');
  const [calcDistanceKm, setCalcDistanceKm] = useState<number>(5.0);

  // Handle saving global settings
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setSaveErrorMessage('فقط المدير المصرح له يملك صلاحية حفظ وتعديل الإعدادات المالية.');
      return;
    }

    // Validation for Distance Pricing
    if (distanceBaseFee < 0 || distanceFeePerKm < 0 || distanceMaxFee <= 0) {
      setSaveErrorMessage('قيم نظام أجور التوصيل حسب المسافة يجب أن تكون أرقاماً موجبة.');
      return;
    }
    if (distanceMaxFee < distanceBaseFee) {
      setSaveErrorMessage('الحد الأعلى لأجرة التوصيل (الحد الأقصى) يجب أن يكون أكبر من أو يساوي أجرة البداية.');
      return;
    }

    // Validation against negative values & realistic ranges
    if (defaultPlatformCommissionPercent < 0 || defaultPlatformCommissionPercent > 50) {
      setSaveErrorMessage('نسبة عمولة المنصة يجب أن تكون بين 0% و 50%.');
      return;
    }

    if (defaultDeliveryFee < 0 || defaultCourierBasePayout < 0 || defaultCourierBonus < 0) {
      setSaveErrorMessage('لا يمكن إدخال قيم سالبة لأجور التوصيل أو مستحقات المندوب.');
      return;
    }

    const hasNegativeArea = areaFees.some((a) => a.deliveryFee < 0 || a.courierPayout < 0);
    if (hasNegativeArea) {
      setSaveErrorMessage('يرجى التحقق من أجور المناطق، لا يمكن أن تكون سالبة.');
      return;
    }

    const hasNegativeOverride = storeOverrides.some((s) => s.commissionPercent < 0 || s.commissionPercent > 50);
    if (hasNegativeOverride) {
      setSaveErrorMessage('عمولات المتاجر المخصصة يجب أن تكون بين 0% و 50%.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);

    const res = await updatePricingSettings({
      distanceBaseFee: Number(distanceBaseFee) || 1500,
      distanceFeePerKm: Number(distanceFeePerKm) || 250,
      distanceMaxFee: Number(distanceMaxFee) || 5000,
      isDistancePricingEnabled,
      defaultDeliveryFee: Number(defaultDeliveryFee),
      defaultCourierBasePayout: Number(defaultCourierBasePayout),
      defaultCourierBonus: Number(defaultCourierBonus),
      isCourierBonusActive,
      defaultPlatformCommissionPercent: Number(defaultPlatformCommissionPercent),
      areaDeliveryFees: areaFees,
      storeCommissionOverrides: storeOverrides,
    });

    setIsSaving(false);

    if (res.success) {
      setSaveSuccessMessage('تم حفظ وتطبيق السياسة المالية في قاعدة بيانات Firebase بنجاح!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } else {
      setSaveErrorMessage(res.error || 'حدث خطأ أثناء حفظ الإعدادات.');
    }
  };

  // Add new area fee rule
  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    const newId = 'area_' + Date.now();
    const updatedAreas = [
      ...areaFees,
      {
        id: newId,
        name: newAreaName.trim(),
        deliveryFee: Number(newAreaDeliveryFee) || 3000,
        courierPayout: Number(newAreaCourierPayout) || 2500,
        isActive: true,
      },
    ];
    setAreaFees(updatedAreas);
    setNewAreaName('');
    setNewAreaDeliveryFee(3000);
    setNewAreaCourierPayout(2500);
  };

  // Toggle area active status
  const handleToggleAreaActive = (id: string) => {
    setAreaFees(
      areaFees.map((a) => (a.id === id ? { ...a, isActive: a.isActive === false ? true : false } : a))
    );
  };

  // Remove area fee rule
  const handleRemoveArea = (id: string) => {
    setAreaFees(areaFees.filter((a) => a.id !== id));
  };

  // Update specific area in list
  const handleUpdateArea = (id: string, field: 'deliveryFee' | 'courierPayout', val: number) => {
    setAreaFees(
      areaFees.map((a) => (a.id === id ? { ...a, [field]: Number(val) || 0 } : a))
    );
  };

  // Update store override commission
  const handleUpdateStoreOverride = (storeId: string, storeName: string, percent: number) => {
    const existing = storeOverrides.find((s) => s.storeId === storeId);
    if (existing) {
      setStoreOverrides(
        storeOverrides.map((s) => (s.storeId === storeId ? { ...s, commissionPercent: Number(percent) } : s))
      );
    } else {
      setStoreOverrides([
        ...storeOverrides,
        { storeId, storeName, commissionPercent: Number(percent) },
      ]);
    }
  };

  // Live calculation preview calculation
  const selectedAreaObj = areaFees.find((a) => a.name === calcSelectedArea);
  const distanceCalculatedFee = computeDistanceDeliveryFee(calcDistanceKm, {
    distanceBaseFee,
    distanceFeePerKm,
    distanceMaxFee,
  });
  const activeDeliveryFee = isDistancePricingEnabled
    ? distanceCalculatedFee
    : (selectedAreaObj ? selectedAreaObj.deliveryFee : defaultDeliveryFee);
  const activeCourierBase = selectedAreaObj ? selectedAreaObj.courierPayout : defaultCourierBasePayout;
  const activeCourierBonus = isCourierBonusActive ? defaultCourierBonus : 0;
  const activeCourierTotal = activeCourierBase + activeCourierBonus;

  const activeStoreOverride = storeOverrides.find((s) => s.storeId === calcSelectedStoreId);
  const activeCommissionPercent = activeStoreOverride
    ? activeStoreOverride.commissionPercent
    : defaultPlatformCommissionPercent;
  const activeCommissionAmount = Math.round((calcSubtotal * activeCommissionPercent) / 100);
  const activeStoreNetPayout = Math.max(0, calcSubtotal - activeCommissionAmount);
  const activeServiceFee = 1000;
  const activeTotalCustomerPays = calcSubtotal + activeDeliveryFee + activeServiceFee;

  // Filter audit logs for pricing
  const pricingLogs = auditLogs.filter(
    (l) => l.action === 'PRICING_SETTINGS_UPDATED' || l.entityType === 'system'
  );

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#172554] via-slate-900 to-[#F47721] text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
              إدارة الإيرادات والسياسات
            </span>
            <span className="text-xs text-orange-200">مربوطة سحابياً بـ Firebase Firestore</span>
          </div>
          <h2 className="text-xl font-black">إدارة أجور التوصيل وعمولات المتاجر والمناديب</h2>
          <p className="text-xs text-slate-300">
            تحديد أجور المسافة، أجور المناطق، مكافآت السائقين، ونسب عمولة المطاعم مع احتساب الصافي تلقائياً
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/20 text-xs">
            <span className="text-slate-300 block text-[10px]">آخر تعديل محفوظ</span>
            <span className="font-bold text-orange-300">
              {pricingSettings.updatedAt} • {pricingSettings.updatedBy}
            </span>
          </div>
        </div>
      </div>

      {/* Security alert if not admin */}
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            تنبيه: أنت تتصفح هذا القسم للعرض فقط. لا يمكن حفظ التعديلات إلا من خلال حساب المدير المعتمد في قواعد الأمان.
          </span>
        </div>
      )}

      {/* Feedback Messages */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {saveErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{saveErrorMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveGlobalSettings} className="space-y-6">
        {/* Section 1: Distance-Based Delivery Pricing System */}
        <div className="bg-white rounded-3xl border-2 border-orange-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-100 text-[#F47721] flex items-center justify-center shrink-0">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm text-[#172554]">
                    1. نظام أجور التوصيل التلقائي حسب المسافة (Distance-Based Delivery)
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                    حساب بمسارات الطرق الفعلية
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  المعادلة التلقائية: أجرة التوصيل = أجرة البداية + (المسافة بالكيلومتر × أجرة الكيلومتر) بحيث لا تتجاوز الحد الأعلى.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDistancePricingEnabled(!isDistancePricingEnabled)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  isDistancePricingEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isDistancePricingEnabled ? 'النظام مفعل (افتراضي)' : 'النظام معطل (اعتماد المناطق)'}</span>
              </button>
            </div>
          </div>

          {/* 3 Main Distance Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* 1. Base Fee (أجرة البداية) */}
            <div className="space-y-1.5 bg-orange-50/60 p-4 rounded-2xl border border-orange-200">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>1. أجرة البداية (فتح العداد)</span>
                <span className="text-[10px] text-orange-600 font-black">Base Fee</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  min="0"
                  required
                  value={distanceBaseFee}
                  onChange={(e) => setDistanceBaseFee(Number(e.target.value))}
                  className="w-full p-2.5 pl-12 rounded-xl border border-orange-300 bg-white font-black text-slate-900 focus:outline-none focus:border-orange-500 text-sm"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-500">
                المبلغ الأساسي الثابت عند انطلاق الرحلة (الافتراضي: 1,500 د.ع)
              </p>
            </div>

            {/* 2. Fee Per Km (أجرة كل كيلومتر) */}
            <div className="space-y-1.5 bg-sky-50/60 p-4 rounded-2xl border border-sky-200">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>2. أجرة كل كيلومتر</span>
                <span className="text-[10px] text-sky-700 font-black">Per Km</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="50"
                  min="0"
                  required
                  value={distanceFeePerKm}
                  onChange={(e) => setDistanceFeePerKm(Number(e.target.value))}
                  className="w-full p-2.5 pl-12 rounded-xl border border-sky-300 bg-white font-black text-sky-800 focus:outline-none focus:border-sky-500 text-sm"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-500">
                المبلغ المضاف لكل كيلومتر مسار طريق (الافتراضي: 250 د.ع/كم)
              </p>
            </div>

            {/* 3. Max Fee (الحد الأعلى لأجرة التوصيل) */}
            <div className="space-y-1.5 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>3. الحد الأعلى لأجرة التوصيل</span>
                <span className="text-[10px] text-emerald-700 font-black">Max Cap</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500"
                  min="500"
                  required
                  value={distanceMaxFee}
                  onChange={(e) => setDistanceMaxFee(Number(e.target.value))}
                  className="w-full p-2.5 pl-12 rounded-xl border border-emerald-300 bg-white font-black text-emerald-800 focus:outline-none focus:border-emerald-500 text-sm"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-500">
                سقف أقصى لا تتجاوزه الأجرة مهما بلغت المسافة (الافتراضي: 5,000 د.ع)
              </p>
            </div>
          </div>

          {/* Interactive Examples Table based on current input values */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span className="text-xs font-black text-[#172554] flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-orange-500" />
                محاكاة تطبيق المعادلة على أمثلة المسافات بالقيم المدخلة أعلاه:
              </span>
              <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                Fee = min({distanceMaxFee}, {distanceBaseFee} + dist × {distanceFeePerKm})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 text-center">
              {[1, 2, 5, 10, 14, 20].map((dist) => {
                const raw = distanceBaseFee + dist * distanceFeePerKm;
                const isCapped = raw > distanceMaxFee;
                const finalFee = Math.min(distanceMaxFee, raw);
                return (
                  <div
                    key={dist}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isCapped
                        ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <span className="text-[11px] font-bold block text-slate-500">{dist} كم</span>
                    <strong className="text-sm font-black block my-0.5 text-[#172554]">
                      {finalFee.toLocaleString()} د.ع
                    </strong>
                    <span className="text-[9px] text-slate-400 block">
                      {isCapped ? 'سقف الحد الأعلى' : `${raw.toLocaleString()} د.ع`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 2: Global Courier Delivery & Incentive Rules */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-orange-500" />
              <h3 className="font-black text-sm text-[#172554]">
                2. القواعد العامة ومستحقات المندوب (الاحتياطية للمناطق)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">تُطبق بالدينار العراقي (د.ع)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Default Delivery Fee (Customer) */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="font-bold text-slate-700 block">
                أجرة التوصيل الأساسية (يدفعها الزبون)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  required
                  value={defaultDeliveryFee}
                  onChange={(e) => setDefaultDeliveryFee(Number(e.target.value))}
                  className="w-full p-2.5 pl-12 rounded-xl border border-slate-300 bg-white font-black text-slate-900 focus:outline-none focus:border-orange-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-400">تُعتمد إذا لم تُحدد المنطقة الخاصة</p>
            </div>

            {/* Default Courier Base Payout */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="font-bold text-slate-700 block">
                مستحق المندوب الأساسي عن كل طلب
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  required
                  value={defaultCourierBasePayout}
                  onChange={(e) => setDefaultCourierBasePayout(Number(e.target.value))}
                  className="w-full p-2.5 pl-12 rounded-xl border border-slate-300 bg-white font-black text-emerald-700 focus:outline-none focus:border-orange-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-400">المبلغ الثابت الذي يودع في محفظة الكابتن</p>
            </div>

            {/* Courier Extra Incentive / Bonus */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Gift className="w-4 h-4 text-orange-500" />
                  حافز ومكافأة الكابتن الإضافية
                </label>
                <button
                  type="button"
                  onClick={() => setIsCourierBonusActive(!isCourierBonusActive)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    isCourierBonusActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCourierBonusActive ? 'مفعل' : 'معطل'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  value={defaultCourierBonus}
                  onChange={(e) => setDefaultCourierBonus(Number(e.target.value))}
                  disabled={!isCourierBonusActive}
                  className="w-full p-2.5 pl-12 rounded-xl border border-slate-300 bg-white font-black text-orange-600 focus:outline-none focus:border-orange-500 disabled:opacity-40"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">د.ع</span>
              </div>
              <p className="text-[10px] text-slate-400">حافز اختياري إضافي يُصرف مع كل توصيل</p>
            </div>
          </div>
        </div>

        {/* Section 2: Area-based Custom Delivery Fees Table */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-[#172554]">
                2. تخصيص أجور التوصيل ومستحقات المندوب حسب المناطق ({areaFees.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">إضافة وتعديل وحذف أجور المناطق</span>
          </div>

          {/* Add Area Row */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">إضافة منطقة جديدة:</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                placeholder="اسم المنطقة (مثلاً: بغداد - اليرموك)"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-300 bg-white font-medium"
              />
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  placeholder="أجرة الزبون"
                  value={newAreaDeliveryFee}
                  onChange={(e) => setNewAreaDeliveryFee(Number(e.target.value))}
                  className="w-full p-2.5 pl-10 rounded-xl border border-slate-300 bg-white font-bold"
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400 text-[10px]">د.ع</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="250"
                  placeholder="مستحق المندوب"
                  value={newAreaCourierPayout}
                  onChange={(e) => setNewAreaCourierPayout(Number(e.target.value))}
                  className="w-full p-2.5 pl-10 rounded-xl border border-slate-300 bg-white font-bold text-emerald-700"
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400 text-[10px]">د.ع</span>
              </div>
              <button
                type="button"
                onClick={handleAddArea}
                disabled={!newAreaName.trim()}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة المنطقة</span>
              </button>
            </div>
          </div>

          {/* Areas Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3 font-bold">اسم المنطقة / الحي</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold">أجرة التوصيل (على الزبون)</th>
                  <th className="p-3 font-bold">مستحق المندوب الأساسي</th>
                  <th className="p-3 font-bold">المكافأة المعتمدة</th>
                  <th className="p-3 font-bold">إجمالي دخل المندوب</th>
                  <th className="p-3 font-bold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areaFees.map((area) => (
                  <tr
                    key={area.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      area.isActive === false ? 'opacity-60 bg-slate-50/60' : ''
                    }`}
                  >
                    <td className="p-3 font-bold text-slate-900">{area.name}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleToggleAreaActive(area.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                          area.isActive !== false
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {area.isActive !== false ? 'مفعلة' : 'معطلة'}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 max-w-[120px]">
                        <input
                          type="number"
                          step="250"
                          value={area.deliveryFee}
                          onChange={(e) => handleUpdateArea(area.id, 'deliveryFee', Number(e.target.value))}
                          className="w-24 p-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">د.ع</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 max-w-[120px]">
                        <input
                          type="number"
                          step="250"
                          value={area.courierPayout}
                          onChange={(e) => handleUpdateArea(area.id, 'courierPayout', Number(e.target.value))}
                          className="w-24 p-1.5 rounded-lg border border-slate-300 text-xs font-bold text-emerald-700"
                        />
                        <span className="text-[10px] text-slate-400">د.ع</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-orange-600">
                      {isCourierBonusActive
                        ? `+${defaultCourierBonus.toLocaleString()} د.ع`
                        : <span className="text-slate-400 font-normal">معطلة (0)</span>}
                    </td>
                    <td className="p-3 font-black text-emerald-700">
                      {(area.courierPayout + (isCourierBonusActive ? defaultCourierBonus : 0)).toLocaleString()} د.ع
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveArea(area.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف المنطقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Restaurant & Store Commission Management */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-sky-600" />
              <h3 className="font-black text-sm text-[#172554]">
                3. إدارة عمولات المطاعم والماركت واحتساب صافي المستحقات
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">تحديد نسبة كل متجر أو النسبة العامة</span>
          </div>

          {/* Global Commission Setting */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 block">نسبة عمولة المنصة العامة الافتراضية</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تُطبق تلقائياً على أي متجر أو مطعم لا يمتلك نسبة خاصة محددة.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={defaultPlatformCommissionPercent}
                onChange={(e) => setDefaultPlatformCommissionPercent(Number(e.target.value))}
                className="w-20 p-2 rounded-xl border border-slate-300 bg-white font-black text-center text-sm text-sky-700"
              />
              <span className="font-bold text-slate-600">%</span>
            </div>
          </div>

          {/* Store-specific commission overrides */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              نسب العمولة المخصصة لكل متجر (يتم اعتمادها بدلاً من النسبة العامة):
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stores.map((s) => {
                const override = storeOverrides.find((o) => o.storeId === s.id);
                const currentPercent = override ? override.commissionPercent : defaultPlatformCommissionPercent;
                const isCustom = !!override;

                return (
                  <div
                    key={s.id}
                    className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={s.logo} alt={s.name} className="w-10 h-10 rounded-xl object-cover bg-slate-100" />
                      <div>
                        <h4 className="font-black text-xs text-slate-900 truncate max-w-[180px]">{s.name}</h4>
                        <span className="text-[10px] text-slate-400">{s.neighborhood} • {s.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={currentPercent}
                          onChange={(e) => handleUpdateStoreOverride(s.id, s.name, Number(e.target.value))}
                          className="w-16 p-1.5 rounded-lg border border-slate-300 text-xs font-black text-center text-sky-700 bg-white"
                        />
                        <span className="text-xs font-bold text-slate-500">%</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          isCustom ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isCustom ? 'مخصصة' : 'افتراضية'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-lg">
          <div>
            <p className="text-xs font-bold text-white">حفظ التغييرات في قاعدة بيانات Firebase Firestore</p>
            <p className="text-[10px] text-slate-400">
              تُطبق الإعدادات فوراً على جميع الطلبات الجديدة في النظام دون التأثير على الحسابات التاريخية للطلبات السابقة.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#F47721] hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جاري الحفظ في Firestore...' : 'حفظ وتطبيق السياسة الآن'}</span>
          </button>
        </div>
      </form>

      {/* Section 4: Live Interactive Order Financials Simulator */}
      <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-3xl border-2 border-orange-300 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-orange-200">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            <h3 className="font-black text-sm text-[#172554]">
              4. المحاكي المالي التفاعلي للطلب (Live Financial Breakdown)
            </h3>
          </div>
          <span className="text-xs font-bold text-orange-800">
            فصل أجرة التوصيل عن حساب المطعم واحتساب صافي الأرباح
          </span>
        </div>

        {/* Simulator controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">المتجر / المطعم المطلوب منه:</label>
            <select
              value={calcSelectedStoreId}
              onChange={(e) => setCalcSelectedStoreId(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white font-medium"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">منطقة التوصيل للزبون:</label>
            <select
              value={calcSelectedArea}
              onChange={(e) => setCalcSelectedArea(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white font-medium"
            >
              {areaFees.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">سعر أصناف الوجبات (المجموع الفرعي):</label>
            <div className="relative">
              <input
                type="number"
                step="1000"
                value={calcSubtotal}
                onChange={(e) => setCalcSubtotal(Number(e.target.value))}
                className="w-full p-2 pl-10 rounded-xl border border-slate-300 bg-white font-black text-slate-900"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 font-bold">د.ع</span>
            </div>
          </div>
        </div>

        {/* Visual Partition Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Customer Total */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">إجمالي ما يدفعه الزبون</span>
            <p className="text-base font-black text-[#172554]">{activeTotalCustomerPays.toLocaleString()} د.ع</p>
            <p className="text-[9px] text-slate-500">
              أصناف {calcSubtotal.toLocaleString()} + توصيل {activeDeliveryFee.toLocaleString()} + خدمة 1,000
            </p>
          </div>

          {/* Platform Commission */}
          <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-sky-700 font-bold block">عمولة منصة طلبي</span>
              <span className="text-[9px] bg-sky-100 text-sky-800 px-1 rounded font-black">{activeCommissionPercent}%</span>
            </div>
            <p className="text-base font-black text-sky-700">{activeCommissionAmount.toLocaleString()} د.ع</p>
            <p className="text-[9px] text-slate-500">تخصم من قيمة طعام المطعم فقط</p>
          </div>

          {/* Store Net Payout */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[10px] text-emerald-700 font-bold block">صافي مستحقات المطعم</span>
            <p className="text-base font-black text-emerald-600">{activeStoreNetPayout.toLocaleString()} د.ع</p>
            <p className="text-[9px] text-slate-500">المجموع الفرعي - عمولة المنصة</p>
          </div>

          {/* Courier Total Earning */}
          <div className="bg-white p-3.5 rounded-2xl border border-orange-200 shadow-xs space-y-1">
            <span className="text-[10px] text-orange-700 font-bold block">مستحق المندوب الكامل</span>
            <p className="text-base font-black text-orange-600">{activeCourierTotal.toLocaleString()} د.ع</p>
            <p className="text-[9px] text-slate-500">
              أساسي {activeCourierBase.toLocaleString()} + مكافأة {activeCourierBonus.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Section 5: Settings Audit Log */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h4 className="font-black text-xs text-[#172554]">
              سجل تدقيق تغييرات السياسة المالية والعمولات (Audit Log)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">توثيق تاريخي آمن لكل تعديل</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {pricingLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">لا توجد تعديلات مسجلة حديثاً</p>
          ) : (
            pricingLogs.map((log) => (
              <div key={log.id} className="py-2 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                  <span className="font-bold text-slate-800">{log.details}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium shrink-0">{log.performedBy}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
