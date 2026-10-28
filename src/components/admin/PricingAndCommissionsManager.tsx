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
  RotateCcw,
} from 'lucide-react';
import { computeDistanceDeliveryFee } from '../../utils/distancePricing';
import { AdminServiceAreaMap } from './AdminServiceAreaMap';

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
    (firebaseUser &&
      (firebaseUser.email === 'msr33777@gmail.com' ||
        firebaseUser.email === 'admin@talabi.iq' ||
        firebaseUser.email === 'admin.operations@talabi.iq' ||
        (firebaseUser as any).isAdmin));

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

  // Local editing state for Service Area
  const [serviceAreaEnabled, setServiceAreaEnabled] = useState<boolean>(
    pricingSettings.serviceArea?.isEnabled ?? true
  );
  const [serviceAreaLat, setServiceAreaLat] = useState<number>(
    pricingSettings.serviceArea?.center.lat ?? 33.4632
  );
  const [serviceAreaLng, setServiceAreaLng] = useState<number>(
    pricingSettings.serviceArea?.center.lng ?? 44.1508
  );
  const [serviceAreaRadius, setServiceAreaRadius] = useState<number>(
    pricingSettings.serviceArea?.radiusKm ?? 5
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
      serviceArea: {
        isEnabled: serviceAreaEnabled,
        areaName: 'بغداد - سبع البور',
        center: { lat: Number(serviceAreaLat), lng: Number(serviceAreaLng) },
        radiusKm: Number(serviceAreaRadius),
      },
    });

    setIsSaving(false);

    if (res.success) {
      setSaveSuccessMessage('تم حفظ وتطبيق السياسة المالية في قاعدة بيانات Firebase بنجاح!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } else {
      setSaveErrorMessage(res.error || 'حدث خطأ أثناء حفظ الإعدادات.');
    }
  };

  // Reset Service Area to saved state
  const handleResetServiceArea = () => {
    setServiceAreaEnabled(pricingSettings.serviceArea?.isEnabled ?? true);
    setServiceAreaLat(pricingSettings.serviceArea?.center.lat ?? 33.4632);
    setServiceAreaLng(pricingSettings.serviceArea?.center.lng ?? 44.1508);
    setServiceAreaRadius(pricingSettings.serviceArea?.radiusKm ?? 5);
    setSaveSuccessMessage('تمت إعادة ضبط إعدادات المنطقة إلى الحالة المحفوظة');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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
            </div>

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
            </div>

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
            </div>
          </div>
        </div>

        {/* Section 1.5: Service Area Management (Geofencing) */}
        <div className="bg-white rounded-3xl border-2 border-emerald-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#172554]">
                  منطقة التوصيل (نطاق الخدمة)
                </h3>
                <p className="text-[11px] text-slate-500">
                  قم بتحديد مركز منطقة التوصيل وحجمها التقديري بالكيلومترات.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetServiceArea}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all flex items-center gap-1.5"
                title="إعادة ضبط التغييرات غير المحفوظة"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>

              <button
                type="button"
                onClick={() => setServiceAreaEnabled(!serviceAreaEnabled)}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  serviceAreaEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{serviceAreaEnabled ? 'الخدمة مفعلة' : 'الخدمة معطلة مؤقتاً'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-h-[400px]">
              <AdminServiceAreaMap
                center={{ lat: serviceAreaLat, lng: serviceAreaLng }}
                radiusKm={serviceAreaRadius}
                onCenterChange={(coords) => {
                  setServiceAreaLat(coords.lat);
                  setServiceAreaLng(coords.lng);
                }}
              />
            </div>

            <div className="w-full lg:w-80 space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="font-black text-xs text-slate-700">نصف قطر منطقة التوصيل</label>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-lg">
                    {serviceAreaRadius} كم
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={serviceAreaRadius}
                  onChange={(e) => setServiceAreaRadius(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>0.5 كم</span>
                  <span>15 كم</span>
                  <span>30 كم</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="font-bold text-xs text-slate-700">إحداثيات المركز (يدوي)</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">خط العرض (Lat)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={serviceAreaLat}
                      onChange={(e) => setServiceAreaLat(Number(e.target.value))}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">خط الطول (Lng)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={serviceAreaLng}
                      onChange={(e) => setServiceAreaLng(Number(e.target.value))}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>
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
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="font-bold text-slate-700 block">أجرة التوصيل الأساسية (يدفعها الزبون)</label>
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
            </div>

            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="font-bold text-slate-700 block">مستحق المندوب الأساسي عن كل طلب</label>
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
            </div>

            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Gift className="w-4 h-4 text-orange-500" />
                  حافز المندوب
                </label>
                <button
                  type="button"
                  onClick={() => setIsCourierBonusActive(!isCourierBonusActive)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    isCourierBonusActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
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
            </div>
          </div>
        </div>

        {/* Section 2: Area-based Custom Delivery Fees Table */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-[#172554]">
                تخصيص أجور التوصيل حسب المناطق ({areaFees.length})
              </h3>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                placeholder="اسم المنطقة"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-300 bg-white"
              />
              <input
                type="number"
                placeholder="أجرة الزبون"
                value={newAreaDeliveryFee}
                onChange={(e) => setNewAreaDeliveryFee(Number(e.target.value))}
                className="p-2.5 rounded-xl border border-slate-300 bg-white"
              />
              <input
                type="number"
                placeholder="مستحق المندوب"
                value={newAreaCourierPayout}
                onChange={(e) => setNewAreaCourierPayout(Number(e.target.value))}
                className="p-2.5 rounded-xl border border-slate-300 bg-white"
              />
              <button
                type="button"
                onClick={handleAddArea}
                className="py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-bold text-xs"
              >
                إضافة المنطقة
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3">اسم المنطقة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3">أجرة التوصيل</th>
                  <th className="p-3">مستحق المندوب</th>
                  <th className="p-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {areaFees.map((area) => (
                  <tr key={area.id} className="border-b border-slate-100">
                    <td className="p-3 font-bold">{area.name}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleAreaActive(area.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          area.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {area.isActive !== false ? 'مفعلة' : 'معطلة'}
                      </button>
                    </td>
                    <td className="p-3">{area.deliveryFee.toLocaleString()} د.ع</td>
                    <td className="p-3">{area.courierPayout.toLocaleString()} د.ع</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleRemoveArea(area.id)} className="text-rose-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Commissions */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-sky-600" />
              <h3 className="font-black text-sm text-[#172554]">إدارة عمولات المتاجر</h3>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <span>نسبة عمولة المنصة العامة الافتراضية</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={defaultPlatformCommissionPercent}
                onChange={(e) => setDefaultPlatformCommissionPercent(Number(e.target.value))}
                className="w-20 p-2 rounded-xl border border-slate-300 text-center"
              />
              <span className="font-bold">%</span>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white rounded-2xl shadow-xl">
          <div>
            <p className="text-sm font-black">حفظ التغييرات النهائية</p>
            <p className="text-[10px] text-slate-400">سيتم تطبيق هذه السياسات فوراً على جميع العمليات الجديدة.</p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-[#F47721] hover:bg-orange-600 text-white rounded-xl font-black text-sm shadow-lg flex items-center gap-2"
          >
            {isSaving ? <Zap className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات في Firebase'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
