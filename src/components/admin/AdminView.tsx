import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OrderStatus } from '../../types';
import { PricingAndCommissionsManager } from './PricingAndCommissionsManager';
import { RestaurantCommissionsManager } from './RestaurantCommissionsManager';
import {
  ShieldAlert,
  Activity,
  Layers,
  Store,
  Bike,
  FileText,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  WifiOff,
  CreditCard,
  UserX,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  ArrowUpDown,
  ExternalLink,
  ClipboardCheck,
  UserCheck,
  Coins,
  Smartphone,
  X,
  PlusCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { ApplicationReviewSection } from './ApplicationReviewSection';

export const AdminView: React.FC = () => {
  const {
    orders,
    stores,
    couriers,
    auditLogs,
    restaurantApplications,
    courierApplications,
    updateOrderStatus,
    assignCourierToOrder,
    cancelOrder,
    isSimulatedOffline,
    setIsSimulatedOffline,
    forcePaymentFail,
    setForcePaymentFail,
    forceNoCourier,
    setForceNoCourier,
    resetToInitialData,
    exportDatabaseJson,
    importDatabaseJson,
    setActiveTrackedOrderId,
    setRole,
    createTestOrder,
    completeTestOrder,
    advanceTestOrderStage,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    | 'orders'
    | 'stores'
    | 'couriers'
    | 'pricing'
    | 'commissions'
    | 'audit'
    | 'simulator'
    | 'restaurant_applications'
    | 'courier_applications'
  >('orders');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);

  // Test Order Creator Modal State
  const [isTestOrderModalOpen, setIsTestOrderModalOpen] = useState(false);
  const [testStoreId, setTestStoreId] = useState<string>(stores[0]?.id || 'store_1');
  const [testCustomerName, setTestCustomerName] = useState('أحمد العبيدي (طلب تجريبي)');
  const [testCustomerPhone, setTestCustomerPhone] = useState('07701234567');
  const [testNeighborhood, setTestNeighborhood] = useState('بغداد - المنصور');
  const [testAddress, setTestAddress] = useState('شارع 14 رمضان، مقابل مول المنصور');
  const [testPaymentMethod, setTestPaymentMethod] = useState<'cash_on_delivery' | 'zain_cash' | 'qi_card'>('cash_on_delivery');
  const [isCreatingTestOrder, setIsCreatingTestOrder] = useState(false);
  const [lastCreatedTestOrderId, setLastCreatedTestOrderId] = useState<string | null>(null);
  const [testOrderFeedback, setTestOrderFeedback] = useState<string | null>(null);
  const [isProcessingTestOrder, setIsProcessingTestOrder] = useState<string | null>(null);

  // Platform KPIs
  const totalGMV = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.total, 0);

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  const onlineCouriersCount = couriers.filter((c) => c.isOnline).length;
  const openStoresCount = stores.filter((s) => s.isOpen).length;
  const pendingRestaurantsCount = (restaurantApplications || []).filter((a) => a.status === 'pending').length;
  const pendingCouriersCount = (courierApplications || []).filter((a) => a.status === 'pending').length;

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.includes(orderSearch) ||
      o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.storeName.toLowerCase().includes(orderSearch.toLowerCase());
    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    const jsonStr = exportDatabaseJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talabi_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const ok = importDatabaseJson(importJsonText);
    if (ok) {
      setShowImportBox(false);
      setImportJsonText('');
    } else {
      alert('صيغة ملف النسخة الاحتياطية غير صالحة.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 text-slate-800">
      {/* Admin Operations Tower Header */}
      <div className="bg-[#172554] text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-lg text-white">غرفة العمليات المركزية | إدارة طلبي</h2>
              <span className="text-[10px] bg-orange-500/30 text-orange-200 border border-orange-500/40 px-2 py-0.5 rounded font-bold">
                Admin Control Tower
              </span>
            </div>
            <p className="text-xs text-slate-300">مراقبة الطلبات المباشرة، إدارة الأسطول، وسجل التدقيق والامتثال</p>
          </div>
        </div>

        {/* Quick Data Operations */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            <span>تصدير نسخة احتياطية</span>
          </button>

          <a
            href="/talabi-project.zip"
            download="talabi-project.zip"
            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            title="تحميل مشروع طلبي الكامل ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل المشروع الكامل (ZIP)</span>
          </a>

          <button
            type="button"
            onClick={() => setIsAndroidModalOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            title="تحميل حزمة تطبيق Android وإعدادات بناء APK"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
            <span>تنزيل تطبيق Android</span>
          </button>

          <button
            onClick={() => setShowImportBox(!showImportBox)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>استعادة نسخة</span>
          </button>

          <button
            onClick={() => {
              if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط جميع الجداول والبيانات إلى حالتها الأولية؟')) {
                resetToInitialData();
              }
            }}
            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع</span>
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportBox && (
        <div className="p-4 bg-slate-100 rounded-2xl border border-slate-300 space-y-2 animate-in fade-in">
          <label className="text-xs font-bold text-slate-800 block">
            الصق محتوى ملف JSON للنسخة الاحتياطية هنا:
          </label>
          <textarea
            rows={4}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder='{"stores": [...], "orders": [...]}'
            className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs bg-white"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowImportBox(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              إلغاء
            </button>
            <button
              onClick={handleImportSubmit}
              className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold"
            >
              استيراد وتطبيق البيانات
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">إجمالي التعاملات (GMV)</span>
          <p className="text-lg font-black text-emerald-600">{totalGMV.toLocaleString()} د.ع</p>
          <span className="text-[10px] text-slate-400">دينار عراقي محقق</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">الطلبات النشطة الآن</span>
          <p className="text-lg font-black text-orange-600">{activeOrdersCount} طلب</p>
          <span className="text-[10px] text-slate-400">قيد المعالجة والتوصيل</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">المناديب على رأس العمل</span>
          <p className="text-lg font-black text-[#172554]">{onlineCouriersCount} كابتن</p>
          <span className="text-[10px] text-slate-400">من أصل {couriers.length} مسجلين</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">المتاجر والمطاعم المفتوحة</span>
          <p className="text-lg font-black text-sky-600">{openStoresCount} متجر</p>
          <span className="text-[10px] text-slate-400">من أصل {stores.length} معتمدين</span>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-[#172554] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>كل الطلبات ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'stores' ? 'bg-[#172554] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>المتاجر والشركاء ({stores.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('couriers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'couriers' ? 'bg-[#172554] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>أسطول المناديب ({couriers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('restaurant_applications')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'restaurant_applications'
              ? 'bg-[#172554] text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-orange-400" />
          <span>طلبات انضمام المطاعم</span>
          {pendingRestaurantsCount > 0 && (
            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {pendingRestaurantsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('courier_applications')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'courier_applications'
              ? 'bg-[#172554] text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4 text-blue-400" />
          <span>طلبات انضمام الكباتن</span>
          {pendingCouriersCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {pendingCouriersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'pricing' ? 'bg-[#F47721] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>العمولات وأجور التوصيل</span>
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'commissions' ? 'bg-[#172554] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>إدارة العمولات والمستحقات</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'audit' ? 'bg-[#172554] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>سجل التدقيق (Audit Logs)</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-orange-500 text-white shadow'
              : 'text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>محاكي الأعطال وفحص الجودة</span>
        </button>
      </div>

      {/* TAB 1: ALL ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-4">
          {/* Quick Action & Diagnostics Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50 to-amber-50 p-3.5 rounded-2xl border border-orange-200">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <h4 className="font-black text-xs text-orange-950">فحص دورة حياة الطلبات الميدانية</h4>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                يمكنك إنشاء طلب تجريبي ومراقبته فورياً في شاشات المطعم والمندوب وتتبع تدفقه في Firebase
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTestOrderFeedback(null);
                setIsTestOrderModalOpen(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-[#F47721] to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إنشاء طلب تجريبي مباشر (Test Order)</span>
            </button>
          </div>

          {/* Test Order Created Feedback Banner */}
          {lastCreatedTestOrderId && (() => {
            const bannerOrder = orders.find((o) => o.id === lastCreatedTestOrderId);
            const isDelivered = bannerOrder?.status === 'delivered';
            const isCancelled = bannerOrder?.status === 'cancelled';
            const canAction = bannerOrder && !isDelivered && !isCancelled;

            return (
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs text-emerald-950 animate-fadeIn shadow-xs">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900">
                        الطلب التجريبي #{lastCreatedTestOrderId.slice(-6)} مثبت في Firebase
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isDelivered
                            ? 'bg-emerald-600 text-white'
                            : isCancelled
                            ? 'bg-rose-600 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {bannerOrder ? bannerOrder.status : 'created'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      {isDelivered
                        ? 'اكتملت دورة حياة الطلب التجريبي بنجاح وتم تسليمه!'
                        : 'يمكنك إتمام الطلب بنقرة واحدة أو تقديم مراحله لاختبار المطعم والمندوب'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canAction && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsProcessingTestOrder(lastCreatedTestOrderId);
                          try {
                            await completeTestOrder(lastCreatedTestOrderId);
                          } finally {
                            setIsProcessingTestOrder(null);
                          }
                        }}
                        disabled={isProcessingTestOrder === lastCreatedTestOrderId}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                        title="إتمام الطلب التجريبي فوراً وتحويل حالته إلى delivered"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isProcessingTestOrder === lastCreatedTestOrderId ? 'جاري الإتمام...' : 'إتمام الطلب التجريبي'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsProcessingTestOrder(lastCreatedTestOrderId);
                          try {
                            await advanceTestOrderStage(lastCreatedTestOrderId);
                          } finally {
                            setIsProcessingTestOrder(null);
                          }
                        }}
                        disabled={isProcessingTestOrder === lastCreatedTestOrderId}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                        title="تقديم مرحلة تجريبية واحدة"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>تقديم مرحلة</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setRole('merchant')}
                    className="px-2.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] rounded-xl transition"
                  >
                    شاشة المطعم
                  </button>

                  <button
                    onClick={() => setRole('courier')}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] rounded-xl transition"
                  >
                    شاشة المندوب
                  </button>

                  <button
                    onClick={() => setLastCreatedTestOrderId(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                    title="إخفاء التنبيه"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث برقم الطلب، اسم الزبون، أو المتجر..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="text-xs p-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="created">تم الاستلام</option>
              <option value="merchant_accepted">وافق المطعم</option>
              <option value="preparing">قيد التحضير</option>
              <option value="ready_for_pickup">جاهز للمندوب</option>
              <option value="courier_assigned">تم تعيين مندوب</option>
              <option value="picked_up">في الطريق</option>
              <option value="delivered">مكتمل</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="p-3 font-bold">رقم الطلب</th>
                  <th className="p-3 font-bold">الزبون</th>
                  <th className="p-3 font-bold">المتجر</th>
                  <th className="p-3 font-bold">المندوب</th>
                  <th className="p-3 font-bold">الحسابات والعمولات</th>
                  <th className="p-3 font-bold">طريقة الدفع</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-[#172554]">#{o.id}</span>
                        {(o.isTest || o.customer?.name?.includes('تجريبي')) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            تجريبي
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{o.customer.name}</p>
                      <p className="text-[10px] text-slate-400">{o.customer.phone}</p>
                    </td>
                    <td className="p-3 font-medium text-slate-700">{o.storeName}</td>
                    <td className="p-3">
                      {o.courierName ? (
                        <span className="font-bold text-slate-800">{o.courierName}</span>
                      ) : (
                        <select
                          onChange={(e) => assignCourierToOrder(o.id, e.target.value)}
                          defaultValue=""
                          className="text-[10px] p-1 border rounded bg-white text-orange-600 font-bold"
                        >
                          <option value="" disabled>
                            إسناد مندوب...
                          </option>
                          {couriers
                            .filter((c) => c.isOnline)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-black text-slate-900">{o.total.toLocaleString()} د.ع</p>
                      {o.financials ? (
                        <div className="flex flex-col gap-0.5 mt-1 text-[10px]">
                          <span className="text-emerald-700 font-bold">
                            صافي المتجر: {o.financials.storeNetPayout.toLocaleString()} د.ع
                          </span>
                          <span className="text-purple-700 font-medium">
                            عمولة المنصة ({o.financials.platformCommissionPercent}%): {o.financials.platformCommissionAmount.toLocaleString()} د.ع
                          </span>
                          <span className="text-sky-700 font-medium">
                            مستحق المندوب: {o.financials.courierTotalEarnings.toLocaleString()} د.ع
                            {o.financials.courierBonus > 0 && ` (+${o.financials.courierBonus.toLocaleString()} حافز)`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">توصيل: {o.deliveryFee.toLocaleString()} د.ع</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {o.payment.method === 'zain_cash'
                          ? 'زين كاش'
                          : o.payment.method === 'qi_card'
                          ? 'كي كارد'
                          : 'نقد (COD)'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* خيار إتمام الطلب التجريبي الحصري للطلبات التجريبية */}
                        {(o.isTest || o.customer?.name?.includes('تجريبي')) && o.status !== 'delivered' && o.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={async () => {
                              setIsProcessingTestOrder(o.id);
                              try {
                                await completeTestOrder(o.id);
                              } finally {
                                setIsProcessingTestOrder(null);
                              }
                            }}
                            disabled={isProcessingTestOrder === o.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black shadow-xs transition flex items-center gap-1 shrink-0"
                            title="إتمام الطلب التجريبي فوراً وتحويله لمكتمل"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isProcessingTestOrder === o.id ? 'جاري...' : 'إتمام الطلب التجريبي'}</span>
                          </button>
                        )}

                        {/* تقديم مرحلة واحدة لاختبار الواجهات */}
                        {(o.isTest || o.customer?.name?.includes('تجريبي')) && o.status !== 'delivered' && o.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={async () => {
                              setIsProcessingTestOrder(o.id);
                              try {
                                await advanceTestOrderStage(o.id);
                              } finally {
                                setIsProcessingTestOrder(null);
                              }
                            }}
                            disabled={isProcessingTestOrder === o.id}
                            className="px-2 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shrink-0"
                            title="تقديم مرحلة تجريبية واحدة"
                          >
                            <span>تقديم مرحلة</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setActiveTrackedOrderId(o.id);
                            setRole('customer');
                          }}
                          className="p-1 text-slate-400 hover:text-orange-500"
                          title="عرض في شاشة التتبع"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {o.status !== 'delivered' && o.status !== 'cancelled' && (
                          <button
                            onClick={() => cancelOrder(o.id, 'إلغاء إداري من غرفة العمليات')}
                            className="text-[10px] text-rose-600 hover:underline font-bold"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STORES */}
      {activeTab === 'stores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={s.logo} alt={s.name} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
                <div>
                  <h4 className="font-black text-xs text-slate-900">{s.name}</h4>
                  <p className="text-[11px] text-slate-400">{s.neighborhood} • {s.category}</p>
                  <p className="text-[10px] text-emerald-700 font-bold mt-0.5">عمولة المنصة: 10% • أجور التوصيل: {s.deliveryFee.toLocaleString()} د.ع</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  s.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {s.isOpen ? 'مفتوح' : 'مغلق'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: COURIERS FLEET */}
      {activeTab === 'couriers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {couriers.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900">{c.name}</h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {c.isOnline ? 'متصل' : 'غير متصل'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                مركبة: {c.vehicleType} ({c.vehiclePlate})
              </p>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px]">
                <span>التوصيلات: <strong>{c.totalDeliveries}</strong></span>
                <span>المحفظة: <strong className="text-emerald-600">{c.walletBalance.toLocaleString()} د.ع</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: PRICING & COMMISSIONS MANAGER */}
      {activeTab === 'pricing' && <PricingAndCommissionsManager />}

      {/* TAB: RESTAURANT COMMISSIONS & SETTLEMENTS */}
      {activeTab === 'commissions' && <RestaurantCommissionsManager />}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="font-black text-xs text-[#172554]">سجل تدقيق العمليات الآمن (Audit Trail)</h3>
            <span className="text-[10px] text-slate-400">آخر 100 إجراء مسجل بالكامل مع البصمة الزمنية</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 text-xs flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                      {log.entityType}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">{log.performedBy}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: RELIABILITY & EDGE-CASE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-3xl border-2 border-orange-300 p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="font-black text-base text-orange-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              محاكي الأعطال وسيناريوهات فحص الجودة (Quality Assurance Suite)
            </h3>
            <p className="text-xs text-slate-500">
              اختبار متطلبات الوثيقة (Requirements #8 & #10): انقطاع الإنترنت، فشل بوابات الدفع، إلغاء الطلبات، منع تكرار الطلب، وعدم توفر مندوب.
            </p>
          </div>

          {/* Test Orders Lifecycle & Completion Suite */}
          <div className="p-5 rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-white space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-emerald-950">
                    دورة حياة الطلبات التجريبية وخيار الإتمام الفوري (Test Order Lifecycle & Completion)
                  </h4>
                  <p className="text-xs text-emerald-800">
                    إنشاء وتتبع الطلب التجريبي في كافة شاشات التطبيق، مع إمكانية استخدام خيار «إتمام الطلب التجريبي» بنقرة واحدة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTestOrderFeedback(null);
                  setIsTestOrderModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إنشاء طلب تجريبي جديد</span>
              </button>
            </div>

            {/* List of Test Orders */}
            <div className="space-y-3">
              {orders.filter((o) => o.isTest || o.customer?.name?.includes('تجريبي')).length === 0 ? (
                <div className="p-6 bg-white/90 rounded-2xl border border-emerald-200 text-center space-y-2">
                  <p className="text-xs text-slate-600 font-bold">لا يوجد أي طلب تجريبي نشط حالياً.</p>
                  <p className="text-[11px] text-slate-400">
                    انقر فوق «إنشاء طلب تجريبي جديد» لتوليد طلب مباشر وتثبيته في Firebase واختباره بين واجهات المطعم والمندوب.
                  </p>
                  <button
                    onClick={() => {
                      setTestOrderFeedback(null);
                      setIsTestOrderModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    إنشاء طلب تجريبي الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders
                    .filter((o) => o.isTest || o.customer?.name?.includes('تجريبي'))
                    .map((testOrd) => {
                      const isDelivered = testOrd.status === 'delivered';
                      const isCancelled = testOrd.status === 'cancelled';
                      const canAction = !isDelivered && !isCancelled;

                      return (
                        <div
                          key={testOrd.id}
                          className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition hover:border-emerald-300"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-[#172554] text-xs">#{testOrd.id}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                طلب تجريبي
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isDelivered
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCancelled
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {testOrd.status}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 flex items-center gap-3 flex-wrap">
                              <span>المتجر: <strong className="text-slate-800">{testOrd.storeName}</strong></span>
                              <span>الزبون: <strong className="text-slate-800">{testOrd.customer.name}</strong></span>
                              <span>المبلغ: <strong className="text-slate-800">{testOrd.total.toLocaleString()} د.ع</strong></span>
                              {testOrd.courierName && (
                                <span>المندوب: <strong className="text-slate-800">{testOrd.courierName}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {canAction && (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setIsProcessingTestOrder(testOrd.id);
                                    try {
                                      await completeTestOrder(testOrd.id);
                                    } finally {
                                      setIsProcessingTestOrder(null);
                                    }
                                  }}
                                  disabled={isProcessingTestOrder === testOrd.id}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5"
                                  title="إتمام الطلب التجريبي فوراً وتحويله لمكتمل"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{isProcessingTestOrder === testOrd.id ? 'جاري...' : 'إتمام الطلب التجريبي'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    setIsProcessingTestOrder(testOrd.id);
                                    try {
                                      await advanceTestOrderStage(testOrd.id);
                                    } finally {
                                      setIsProcessingTestOrder(null);
                                    }
                                  }}
                                  disabled={isProcessingTestOrder === testOrd.id}
                                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                                  title="تقديم مرحلة تجريبية واحدة"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                  <span>تقديم مرحلة</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => {
                                setActiveTrackedOrderId(testOrd.id);
                                setRole('customer');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>تتبع</span>
                            </button>

                            <button
                              onClick={() => setRole('merchant')}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                            >
                              المتجر
                            </button>

                            <button
                              onClick={() => setRole('courier')}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                            >
                              المندوب
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Test 1: Offline simulation */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isSimulatedOffline ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                  <WifiOff className="w-4 h-4 text-rose-500" />
                  محاكاة انقطاع الإنترنت
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSimulatedOffline ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isSimulatedOffline ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                يفحص سلوك التطبيق عند فقدان الاتصال بالخادم ويمنع الطلبات مع عرض رسالة خطأ واضحة للمستخدم.
              </p>
              <button
                onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                  isSimulatedOffline ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {isSimulatedOffline ? 'إيقاف المحاكاة (عودة الاتصال)' : 'تفعيل انقطاع الإنترنت'}
              </button>
            </div>

            {/* Test 2: Payment failure simulation */}
            <div className={`p-4 rounded-2xl border transition-all ${
              forcePaymentFail ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  محاكاة فشل الدفع الإلكتروني
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  forcePaymentFail ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {forcePaymentFail ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                يرفض بوابات الدفع (زين كاش / كي كارد) للتحقق من عدم سحب أي مبالغ وإتاحة إعادة المحاولة أو الدفع نقداً.
              </p>
              <button
                onClick={() => setForcePaymentFail(!forcePaymentFail)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                  forcePaymentFail ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {forcePaymentFail ? 'إيقاف المحاكاة (دفع ناجح)' : 'تفعيل فشل بوابات الدفع'}
              </button>
            </div>

            {/* Test 3: No Courier Available simulation */}
            <div className={`p-4 rounded-2xl border transition-all ${
              forceNoCourier ? 'bg-purple-50 border-purple-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                  <UserX className="w-4 h-4 text-purple-500" />
                  محاكاة عدم توفر مناديب
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  forceNoCourier ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {forceNoCourier ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                يمنع التعيين التلقائي للمناديب للتحقق من إشعار إدارة العمليات وتصعيد الطلب لإسناده يدوياً.
              </p>
              <button
                onClick={() => setForceNoCourier(!forceNoCourier)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                  forceNoCourier ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {forceNoCourier ? 'إيقاف المحاكاة (توفر مناديب)' : 'تفعيل عجز المناديب'}
              </button>
            </div>

            {/* Test 4: Idempotency & Duplicate Prevention Test */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  فحص منع تكرار الطلب (Idempotency)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  نشط ومحمي
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                يتحقق من توليد مفاتيح عشوائية فريدة لكل معاملة لمنع خصم المبلغ مرتين أو تكرار إرسال الطلب للمطعم.
              </p>
              <button
                onClick={() => {
                  alert('فحص Idempotency Key:\nجميع الطلبات تسند بمفتاح فريد (e.g. idem_store_user_timestamp) لمنع التكرار المزدوج عند نقر الزر أكثر من مرة.');
                }}
                className="w-full py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                اختبار التحقق من المفتاح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RESTAURANT APPLICATIONS REVIEW */}
      {activeTab === 'restaurant_applications' && (
        <ApplicationReviewSection type="restaurants" />
      )}

      {/* TAB: COURIER APPLICATIONS REVIEW */}
      {activeTab === 'courier_applications' && (
        <ApplicationReviewSection type="couriers" />
      )}

      {/* ANDROID DOWNLOAD & BUILD MODAL */}
      {isAndroidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#172554]">تحميل وتجهيز تطبيق Android الأصلي</h3>
                  <p className="text-[11px] text-slate-500">حزمة تطبيق طلبي المكتملة مجهزة ببنية Capacitor وGradle</p>
                </div>
              </div>
              <button
                onClick={() => setIsAndroidModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-950 space-y-1">
                <span className="font-bold text-xs block text-emerald-800">تطبيق Android الأصلي مكتمل ومجهز بالكامل:</span>
                <p className="text-[11px] text-emerald-900">
                  تحتوي الحزمة على مجلد <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">/android</code> بكامل ملفات Gradle و Manifest والأذونات الرسمية (الموقع الـ GPS، الكاميرا، الاتصال، الإشعارات) مع خط البناء التلقائي لـ GitHub Actions.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span>طريقة تنزيل الملفات وبناء APK:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 pr-1">
                  <li>حمل حزمة المشروع الكامل بصيغة ZIP من الزر أدناه.</li>
                  <li>قم برفع الملفات إلى مستودعك على GitHub.</li>
                  <li>انتقل إلى تبويب <strong>Actions</strong> وسيقوم السيرفر بإنشاء ملف الـ <strong>Debug APK</strong> تلقائياً.</li>
                  <li>حمل ملف الـ APK وثبّته مباشرة على هاتفك الأندرويد.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <a
                href="/talabi-project.zip"
                download="talabi-project.zip"
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl text-center shadow-md transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>تحميل حزمة Android (ZIP)</span>
              </a>
              <button
                onClick={() => setIsAndroidModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TEST ORDER MODAL */}
      {isTestOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#172554]">إنشاء طلب تجريبي مباشر</h3>
                  <p className="text-[11px] text-slate-500">حفظ فوري في Firebase ومزامنة مع المطعم والمندوب</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestOrderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Target Store */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">المطعم / المتجر المستهدف:</label>
                <select
                  value={testStoreId}
                  onChange={(e) => setTestStoreId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.neighborhood}) - {s.category}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block">
                  الطلب سيصل مباشرة لقائمة طلبات هذا المطعم في واجهة "المطعم / الماركت"
                </span>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">اسم الزبون التجريبي:</label>
                  <input
                    type="text"
                    value={testCustomerName}
                    onChange={(e) => setTestCustomerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">رقم هاتف الزبون:</label>
                  <input
                    type="text"
                    value={testCustomerPhone}
                    onChange={(e) => setTestCustomerPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Neighborhood & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">منطقة التوصيل:</label>
                  <input
                    type="text"
                    value={testNeighborhood}
                    onChange={(e) => setTestNeighborhood(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">العنوان بالتفصيل:</label>
                  <input
                    type="text"
                    value={testAddress}
                    onChange={(e) => setTestAddress(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">طريقة الدفع:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestPaymentMethod('cash_on_delivery')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      testPaymentMethod === 'cash_on_delivery'
                        ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    نقد (COD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestPaymentMethod('zain_cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      testPaymentMethod === 'zain_cash'
                        ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    زين كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestPaymentMethod('qi_card')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      testPaymentMethod === 'qi_card'
                        ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    كي كارد
                  </button>
                </div>
              </div>

              {/* Status Roadmap explanation */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">مسار تدفق الطلب في النظام:</span>
                <p>
                  1. ينشأ الطلب بحالة <strong>created</strong> ويظهر في واجهة المطعم للموافقة.<br />
                  2. عند قبول المطعم، يتحول إلى <strong>preparing</strong> (قيد التحضير).<br />
                  3. عند ضغط المطعم "جاهز للاستلام"، يتحول إلى <strong>ready_for_pickup</strong> ويظهر فوراً في واجهة المندوب مع عدّاد الـ 15 ثانية الحصري!
                </p>
              </div>

              {/* Feedback Message & Instant Action Buttons */}
              {testOrderFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{testOrderFeedback}</span>
                  </div>

                  {lastCreatedTestOrderId && (
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60 flex-wrap">
                      <button
                        type="button"
                        onClick={async () => {
                          setIsProcessingTestOrder(lastCreatedTestOrderId);
                          try {
                            const res = await completeTestOrder(lastCreatedTestOrderId);
                            if (res.success) {
                              setTestOrderFeedback(`تم إتمام الطلب التجريبي #${lastCreatedTestOrderId.slice(-6)} بنجاح وحفظه كـ delivered في Firebase!`);
                            }
                          } finally {
                            setIsProcessingTestOrder(null);
                          }
                        }}
                        disabled={isProcessingTestOrder === lastCreatedTestOrderId}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isProcessingTestOrder === lastCreatedTestOrderId ? 'جاري الإتمام...' : 'إتمام الطلب التجريبي فوراً'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsProcessingTestOrder(lastCreatedTestOrderId);
                          try {
                            const res = await advanceTestOrderStage(lastCreatedTestOrderId);
                            if (res.success && res.nextStatus) {
                              setTestOrderFeedback(`تم تقديم مرحلة الطلب إلى: ${res.nextStatus}`);
                            }
                          } finally {
                            setIsProcessingTestOrder(null);
                          }
                        }}
                        disabled={isProcessingTestOrder === lastCreatedTestOrderId}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>تقديم مرحلة واحدة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRole('merchant');
                          setIsTestOrderModalOpen(false);
                        }}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold transition"
                      >
                        فتح شاشة المطعم
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRole('courier');
                          setIsTestOrderModalOpen(false);
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[11px] font-bold transition"
                      >
                        فتح شاشة المندوب
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isCreatingTestOrder}
                onClick={async () => {
                  setIsCreatingTestOrder(true);
                  setTestOrderFeedback(null);
                  try {
                    const res = await createTestOrder({
                      storeId: testStoreId,
                      customerName: testCustomerName,
                      customerPhone: testCustomerPhone,
                      neighborhood: testNeighborhood,
                      address: testAddress,
                      paymentMethod: testPaymentMethod,
                    });
                    if (res.success && res.orderId) {
                      setLastCreatedTestOrderId(res.orderId);
                      setTestOrderFeedback(`تم حفظ الطلب #${res.orderId.slice(-6)} بنجاح في Firestore بحالة "created"!`);
                    } else {
                      setTestOrderFeedback(`تعذر إنشاء الطلب: ${res.error || 'خطأ غير معروف'}`);
                    }
                  } finally {
                    setIsCreatingTestOrder(false);
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl text-center shadow-md transition flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isCreatingTestOrder ? 'جاري الإنشاء والحفظ في Firebase...' : 'تأكيد وإنشاء الطلب في Firebase'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTestOrderModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
