import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, StorePaymentRecord, StoreAccountingStatement } from '../../types';
import {
  Coins,
  Send,
  PlusCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Phone,
  Calendar,
  Receipt,
  Search,
  X,
  Building2,
  FileSpreadsheet,
  Edit3,
  Check,
  Percent,
  TrendingUp,
  CreditCard,
  History,
  Calculator,
  RefreshCw,
  ChevronRight,
  Clock,
  Printer
} from 'lucide-react';

export const RestaurantCommissionsManager: React.FC = () => {
  const {
    stores,
    orders,
    storePayments,
    updateStoreCommission,
    recordStorePayment,
    suspendStoreDueToDues,
    reactivateStore,
    pricingSettings,
    firebaseUser
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'statements' | 'payments_log'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unpaid' | 'suspended' | 'settled'>('all');

  // Edit Commission Rate State
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<number>(0);
  const [isUpdatingCommission, setIsUpdatingCommission] = useState<boolean>(false);

  // Statements View State
  const [selectedStoreForStatement, setSelectedStoreForStatement] = useState<string>('all');
  const [cycleStartDate, setCycleStartDate] = useState<string>('2025-01-01');
  const [statementsData, setStatementsData] = useState<Record<string, StoreAccountingStatement[]>>({});
  const [isLoadingStatements, setIsLoadingStatements] = useState<boolean>(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStoreForPayment, setSelectedStoreForPayment] = useState<Store | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentRecord['paymentMethod']>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Suspension Modal State
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const [selectedStoreForSuspension, setSelectedStoreForSuspension] = useState<Store | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('تأخر تسديد المستحقات والعمولات المالية للمنصة');

  // Reminder WhatsApp Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderStore, setReminderStore] = useState<Store | null>(null);
  const [reminderData, setReminderData] = useState({
    amountDue: 0,
    periodStart: '2025-01-01',
    periodEnd: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  });

  // Fetch 10-day accounting statements from server
  const loadAccountingStatements = async () => {
    setIsLoadingStatements(true);
    try {
      let url = `/api/admin/accounting/statements?startDate=${cycleStartDate}`;
      if (selectedStoreForStatement !== 'all') {
        url += `&storeId=${selectedStoreForStatement}`;
      }

      let idToken = '';
      if (firebaseUser) {
        idToken = await firebaseUser.getIdToken();
      }

      const resp = await fetch(url, {
        headers: idToken ? { 'Authorization': `Bearer ${idToken}` } : {}
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setStatementsData(data.statementsByStore || {});
      }
    } catch (err) {
      console.warn('Fallback to local statement computation', err);
    } finally {
      setIsLoadingStatements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'statements') {
      loadAccountingStatements();
    }
  }, [activeTab, selectedStoreForStatement, cycleStartDate]);

  // Calculate store financial summaries
  const storeSummaries = stores.map((store) => {
    // Delivered orders only
    const storeDeliveredOrders = orders.filter(
      (o) => o.storeId === store.id && o.status === 'delivered'
    );

    const completedCount = storeDeliveredOrders.length;
    const taxableSubtotal = storeDeliveredOrders.reduce((acc, o) => {
      return acc + Number(o.financials?.subtotal || o.subtotal || 0);
    }, 0);

    const commissionPercent = store.commissionRate ?? pricingSettings.defaultPlatformCommissionPercent ?? 10;

    // Sum snapshot platform commissions from orders (or fallback)
    const commissionDue = storeDeliveredOrders.reduce((acc, o) => {
      if (o.financials?.platformCommissionAmount !== undefined) {
        return acc + o.financials.platformCommissionAmount;
      }
      return acc + Math.round((o.subtotal || 0) * (commissionPercent / 100));
    }, 0);

    // Payments made previously
    const paymentsForStore = storePayments.filter((p) => p.storeId === store.id);
    const totalPaid = paymentsForStore.reduce((acc, p) => acc + p.amount, 0);

    // Remaining balance due
    const remainingBalance = Math.max(0, commissionDue - totalPaid);

    let settlementStatus: 'نشط' | 'مستحقات غير مسددة' | 'متوقف مؤقتاً بسبب المستحقات' | 'تمت التسوية' = 'نشط';

    if (store.isSuspendedDueToDues) {
      settlementStatus = 'متوقف مؤقتاً بسبب المستحقات';
    } else if (commissionDue > 0 && remainingBalance === 0) {
      settlementStatus = 'تمت التسوية';
    } else if (remainingBalance > 0) {
      settlementStatus = 'مستحقات غير مسددة';
    }

    return {
      store,
      completedCount,
      taxableSubtotal,
      commissionPercent,
      commissionDue,
      totalPaid,
      remainingBalance,
      settlementStatus,
      paymentsForStore,
    };
  });

  // Platform totals
  const platformTotals = storeSummaries.reduce(
    (acc, curr) => ({
      totalFoodSales: acc.totalFoodSales + curr.taxableSubtotal,
      totalCommissionDue: acc.totalCommissionDue + curr.commissionDue,
      totalPaid: acc.totalPaid + curr.totalPaid,
      totalRemainingBalance: acc.totalRemainingBalance + curr.remainingBalance,
    }),
    { totalFoodSales: 0, totalCommissionDue: 0, totalPaid: 0, totalRemainingBalance: 0 }
  );

  // Filter summaries
  const filteredSummaries = storeSummaries.filter((item) => {
    const matchesSearch = item.store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.store.neighborhood || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return item.settlementStatus === 'نشط';
    if (statusFilter === 'unpaid') return item.settlementStatus === 'مستحقات غير مسددة';
    if (statusFilter === 'suspended') return item.settlementStatus === 'متوقف مؤقتاً بسبب المستحقات';
    if (statusFilter === 'settled') return item.settlementStatus === 'تمت التسوية';
    return true;
  });

  // Handle Save Commission Rate
  const handleStartEditCommission = (store: Store) => {
    setEditingStoreId(store.id);
    setEditingRate(store.commissionRate ?? pricingSettings.defaultPlatformCommissionPercent ?? 10);
  };

  const handleSaveCommissionRate = async (storeId: string) => {
    if (editingRate < 0 || editingRate > 100) {
      alert('نسبة العمولة يجب أن تكون بين 0% و 100%');
      return;
    }

    setIsUpdatingCommission(true);
    const res = await updateStoreCommission(storeId, editingRate);
    setIsUpdatingCommission(false);

    if (res.success) {
      setEditingStoreId(null);
    } else {
      alert(res.error || 'تعذر تحديث نسبة العمولة');
    }
  };

  const handleOpenPaymentModal = (store: Store, defaultAmount: number) => {
    setSelectedStoreForPayment(store);
    setPaymentAmount(defaultAmount > 0 ? defaultAmount : 10000);
    setPaymentMethod('cash');
    setReceiptNumber('REC-' + Math.floor(100000 + Math.random() * 900000));
    setPaymentNotes('تحصيل عمولة منصة طلبي العادية');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreForPayment) return;
    if (paymentAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setIsSubmittingPayment(true);
    const res = await recordStorePayment(
      selectedStoreForPayment.id,
      paymentAmount,
      paymentMethod,
      receiptNumber,
      paymentNotes,
      paymentDate
    );
    setIsSubmittingPayment(false);

    if (res.success) {
      setIsPaymentModalOpen(false);
      setSelectedStoreForPayment(null);
      if (activeTab === 'statements') loadAccountingStatements();
    } else {
      alert(res.error || 'تعذر تسجيل الدفعة');
    }
  };

  const handleOpenSuspensionModal = (store: Store) => {
    setSelectedStoreForSuspension(store);
    setSuspensionReason('تأخر تسديد المبالغ والعمولات المستحقة لتطبيق طلبي رغم التذكير');
    setIsSuspensionModalOpen(true);
  };

  const handleConfirmSuspension = async () => {
    if (!selectedStoreForSuspension) return;
    const res = await suspendStoreDueToDues(selectedStoreForSuspension.id, suspensionReason);
    if (res.success) {
      setIsSuspensionModalOpen(false);
      setSelectedStoreForSuspension(null);
    } else {
      alert(res.error || 'تعذر إيقاف المطعم');
    }
  };

  const handleOpenReminderModal = (store: Store, amountDue: number) => {
    setReminderStore(store);
    setReminderData({
      amountDue,
      periodStart: cycleStartDate,
      periodEnd: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    });
    setIsReminderModalOpen(true);
  };

  const generateReminderText = (storeName: string, amount: number, start: string, end: string, due: string) => {
    return `«السلام عليكم، إدارة مطعم ${storeName} المحترمين، نود تذكيركم بأن المبالغ المستحقة لتطبيق TALABI عن الفترة من تاريخ ${start} إلى ${end} تبلغ ${amount.toLocaleString()} دينار عراقي. يرجى تسديد المستحقات قبل ${due}. في حال إتمام الدفع، يرجى تجاهل هذه الرسالة والتواصل معنا لتحديث سجل التسديد. شكراً لتعاونكم مع TALABI»`;
  };

  const handleSendWhatsApp = (storePhone: string, text: string) => {
    let clean = storePhone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('964')) clean = `964${clean}`;
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Navigation Tabs */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-700 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-base text-slate-900">نظام المحاسبة والعمولات والكشوفات</h2>
            <p className="text-xs text-slate-500">متابعة عمولات المتاجر، تسجيل التحصيلات، وتوليد كشوفات الحساب الدورية (كل 10 أيام)</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>عمولات المتاجر ({stores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('statements')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              activeTab === 'statements'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>كشف حساب 10 أيام</span>
          </button>

          <button
            onClick={() => setActiveTab('payments_log')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              activeTab === 'payments_log'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المقبوضات ({storePayments.length})</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 block">إجمالي مبيعات الطعام</span>
          <div className="font-mono font-black text-lg text-slate-900">
            {platformTotals.totalFoodSales.toLocaleString()} <span className="text-xs">د.ع</span>
          </div>
          <span className="text-[10px] text-slate-400 block">للطلبات المسلمة بنجاح</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-indigo-600 block">عمولة المنصة المستحقة</span>
          <div className="font-mono font-black text-lg text-indigo-700">
            {platformTotals.totalCommissionDue.toLocaleString()} <span className="text-xs">د.ع</span>
          </div>
          <span className="text-[10px] text-indigo-400 block">محسوبة حسب نسبة كل متجر</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 block">المقبوضات المحصلة</span>
          <div className="font-mono font-black text-lg text-emerald-700">
            {platformTotals.totalPaid.toLocaleString()} <span className="text-xs">د.ع</span>
          </div>
          <span className="text-[10px] text-emerald-500 block">موثوقة بإيصالات رسمية</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-rose-600 block">المتبقي الذمة بذمة المتاجر</span>
          <div className="font-mono font-black text-lg text-rose-700">
            {platformTotals.totalRemainingBalance.toLocaleString()} <span className="text-xs">د.ع</span>
          </div>
          <span className="text-[10px] text-rose-400 block">بانتظار التحصيل</span>
        </div>
      </div>

      {/* TAB 1: STORES & COMMISSIONS OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث باسم المطعم أو المنطقة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-bold"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 font-bold whitespace-nowrap">تصفية حسب الحالة:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs p-2 rounded-xl border border-slate-200 font-bold bg-white focus:outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">نشط</option>
                <option value="unpaid">مستحقات غير مسددة</option>
                <option value="suspended">متوقف بسبب المستحقات</option>
                <option value="settled">تمت التسوية</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="p-3.5 font-bold">المطعم / السوق</th>
                  <th className="p-3.5 font-bold text-center">الطلبات المسلمة</th>
                  <th className="p-3.5 font-bold">مبيعات الطعام الخاضعة</th>
                  <th className="p-3.5 font-bold text-center">نسبة العمولة (%)</th>
                  <th className="p-3.5 font-bold text-indigo-700">العمولة المستحقة</th>
                  <th className="p-3.5 font-bold text-emerald-700">المحصل سابقاً</th>
                  <th className="p-3.5 font-bold text-rose-700">المتبقي الذمة</th>
                  <th className="p-3.5 font-bold text-center">الحالة</th>
                  <th className="p-3.5 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((item) => (
                  <tr key={item.store.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.store.logo}
                          alt={item.store.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-100"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div>
                          <h4 className="font-extrabold text-slate-900">{item.store.name}</h4>
                          <span className="text-[11px] text-slate-400">{item.store.neighborhood || 'بغداد'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      {item.completedCount} طلب
                    </td>

                    <td className="p-3.5 font-mono font-black text-slate-900">
                      {item.taxableSubtotal.toLocaleString()} د.ع
                    </td>

                    {/* Commission Rate Inline Editing */}
                    <td className="p-3.5 text-center">
                      {editingStoreId === item.store.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={editingRate}
                            onChange={(e) => setEditingRate(Number(e.target.value))}
                            className="w-16 p-1 text-center font-black rounded-lg border border-indigo-400 bg-indigo-50 text-indigo-900 focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveCommissionRate(item.store.id)}
                            disabled={isUpdatingCommission}
                            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                            title="حفظ النسبة"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingStoreId(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-600"
                            title="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditCommission(item.store)}
                          className="font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition inline-flex items-center gap-1"
                          title="انقر لتعديل نسبة العمولة"
                        >
                          <span>{item.commissionPercent}%</span>
                          <Edit3 className="w-3 h-3 text-indigo-500" />
                        </button>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-black text-indigo-700">
                      {item.commissionDue.toLocaleString()} د.ع
                    </td>

                    <td className="p-3.5 font-mono font-bold text-emerald-700">
                      {item.totalPaid.toLocaleString()} د.ع
                    </td>

                    <td className="p-3.5 font-mono font-black text-rose-700">
                      {item.remainingBalance.toLocaleString()} د.ع
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          item.settlementStatus === 'تمت التسوية'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : item.settlementStatus === 'متوقف مؤقتاً بسبب المستحقات'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                            : item.settlementStatus === 'مستحقات غير مسددة'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {item.settlementStatus}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleOpenPaymentModal(item.store, item.remainingBalance)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1"
                          title="تسجيل دفعة مستلمة"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>تسجيل تحصيل</span>
                        </button>

                        <button
                          onClick={() => handleOpenReminderModal(item.store, item.remainingBalance)}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                          title="إرسال تذكير بالدفع للمطعم"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>تذكير</span>
                        </button>

                        {item.store.isSuspendedDueToDues ? (
                          <button
                            onClick={() => reactivateStore(item.store.id)}
                            className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                            title="إعادة تفعيل المطعم"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>تفعيل</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenSuspensionModal(item.store)}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                            title="إيقاف المطعم مؤقتاً بسبب المستحقات"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>إيقاف</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                      لا توجد مطاعم مطابقة لفلاتر البحث الحالية.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: 10-DAY ACCOUNT STATEMENTS (كشف حساب كل 10 أيام) */}
      {activeTab === 'statements' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <div className="space-y-1">
              <h3 className="font-black text-sm text-indigo-950 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span>كشوفات الحساب الدورية (دورات 10 أيام - بتوقيت بغداد GMT+3)</span>
              </h3>
              <p className="text-xs text-indigo-800/80">
                يتم تقسيم الفترات المحاسبية كل 10 أيام وتراكم الرصيد السابق للحصول على صافي المتبقي بذمة المطعم.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">المطعم:</label>
                <select
                  value={selectedStoreForStatement}
                  onChange={(e) => setSelectedStoreForStatement(e.target.value)}
                  className="text-xs p-2 rounded-xl border border-slate-200 font-bold bg-white focus:outline-none"
                >
                  <option value="all">جميع المتاجر والمطاعم</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">بداية الدورة الأولى:</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="text-xs p-2 rounded-xl border border-slate-200 font-bold bg-white focus:outline-none"
                />
              </div>

              <button
                onClick={loadAccountingStatements}
                disabled={isLoadingStatements}
                className="mt-4 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs transition"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingStatements ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Statements Table */}
          <div className="space-y-6">
            {Object.keys(statementsData).map((storeId) => {
              const storeStmts = statementsData[storeId] || [];
              const storeName = storeStmts[0]?.storeName || stores.find(s => s.id === storeId)?.name || storeId;

              return (
                <div key={storeId} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 p-3 flex items-center justify-between border-b border-slate-200">
                    <span className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>كشف حساب: {storeName}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      عدد الدورات: {storeStmts.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="p-3 font-bold">رقم الدورة والفترة</th>
                          <th className="p-3 font-bold text-center">الطلبات</th>
                          <th className="p-3 font-bold">مبيعات الطعام</th>
                          <th className="p-3 font-bold text-center">نسبة العمولة</th>
                          <th className="p-3 font-bold text-indigo-700">العمولة المستحقة</th>
                          <th className="p-3 font-bold text-slate-600">الرصيد السابق</th>
                          <th className="p-3 font-bold text-emerald-700">المحصل بالفترة</th>
                          <th className="p-3 font-bold text-rose-700">الصافي المتبقي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {storeStmts.map((stmt) => (
                          <tr key={stmt.id} className="hover:bg-slate-50/70">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">الدورة #{stmt.periodIndex}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {stmt.startDate} إلى {stmt.endDate}
                              </div>
                            </td>

                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {stmt.completedOrdersCount}
                            </td>

                            <td className="p-3 font-mono font-black text-slate-900">
                              {stmt.totalFoodSales.toLocaleString()} د.ع
                            </td>

                            <td className="p-3 text-center font-bold text-purple-700">
                              {stmt.commissionRate}%
                            </td>

                            <td className="p-3 font-mono font-black text-indigo-700">
                              {stmt.commissionDue.toLocaleString()} د.ع
                            </td>

                            <td className="p-3 font-mono font-bold text-slate-600">
                              {stmt.previousBalance.toLocaleString()} د.ع
                            </td>

                            <td className="p-3 font-mono font-bold text-emerald-700">
                              {stmt.paymentsCollected.toLocaleString()} د.ع
                            </td>

                            <td className="p-3 font-mono font-black text-rose-700">
                              {stmt.remainingBalance.toLocaleString()} د.ع
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {Object.keys(statementsData).length === 0 && !isLoadingStatements && (
              <div className="text-center py-12 text-slate-400 text-xs">
                جاري احتساب كشوفات الحساب للفترات المحددة...
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENTS LOG (سجل المقبوضات) */}
      {activeTab === 'payments_log' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>سجل التحصيلات والمقبوضات التاريخية الموثوقة</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">إجمالي المقبوضات: {storePayments.length} إيصال</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="p-3.5 font-bold">رقم الإيصال</th>
                  <th className="p-3.5 font-bold">المطعم / السوق</th>
                  <th className="p-3.5 font-bold text-emerald-700">المبلغ المحصل</th>
                  <th className="p-3.5 font-bold">تاريخ الدفع</th>
                  <th className="p-3.5 font-bold">طريقة الدفع</th>
                  <th className="p-3.5 font-bold">موثّق الدفعة (الأدمن)</th>
                  <th className="p-3.5 font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {storePayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-bold text-slate-700">
                      {p.receiptNumber || p.id}
                    </td>
                    <td className="p-3.5 font-extrabold text-slate-900">
                      {p.storeName}
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-700">
                      {p.amount.toLocaleString()} د.ع
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                        {p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod === 'zain_cash' ? 'زين كاش' : 'تحويل مصرفي'}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {p.confirmedBy}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {p.notes || '-'}
                    </td>
                  </tr>
                ))}

                {storePayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                      لا توجد مدفوعات مسجلة مسبقاً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: RECORD STORE PAYMENT ================= */}
      {isPaymentModalOpen && selectedStoreForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">تسجيل دفعة مستلمة من مطعم: {selectedStoreForPayment.name}</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">المبلغ المستلم (د.ع):</label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-slate-300 font-black text-sm text-emerald-700 bg-emerald-50/50 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">طريقة الدفع:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="cash">نقداً (يد بيد)</option>
                    <option value="zain_cash">زين كاش (Zain Cash)</option>
                    <option value="bank_transfer">تحويل مصرفي</option>
                    <option value="receipt">إيصال رسمي</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">تاريخ الدفع:</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">رقم الإيصال أو المرجع:</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="مثال: REC-4921"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">ملاحظات إدارية:</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="ملاحظات حول تسديد المستحقات..."
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md"
                >
                  {isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد وتوثيق الدفعة المستلمة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: SUSPENSION REASON MODAL ================= */}
      {isSuspensionModalOpen && selectedStoreForSuspension && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-sm text-slate-900">إيقاف المطعم مؤقتاً: {selectedStoreForSuspension.name}</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="leading-relaxed">
                سيؤدي هذا الإجراء إلى منع المطعم من استقبال طلبات جديدة وإظهاره للزبائن بأنه <strong>غير متاح مؤقتاً بسبب المستحقات المالية</strong>. لن يتم حذف طلبات الزبائن السابقة أو بيانات المطعم.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">سبب الإيقاف المؤقت:</label>
                <textarea
                  rows={3}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 bg-rose-50/20 font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setIsSuspensionModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmSuspension}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black shadow-md"
              >
                تأكيد الإيقاف المؤقت للمطعم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: PAYMENT REMINDER (WHATSAPP / SMS) ================= */}
      {isReminderModalOpen && reminderStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-sky-600" />
                <h3 className="font-black text-sm text-slate-900">إرسال تذكير بالدفع للمطعم: {reminderStore.name}</h3>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block">المبلغ المستحق (د.ع):</span>
                  <input
                    type="number"
                    value={reminderData.amountDue}
                    onChange={(e) => setReminderData({ ...reminderData, amountDue: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-black text-emerald-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block">موعد التسديد الأقصى:</span>
                  <input
                    type="date"
                    value={reminderData.dueDate}
                    onChange={(e) => setReminderData({ ...reminderData, dueDate: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">نص الرسالة الجاهزة (حسب الصيغة الرسمية لتطبيق طلبي):</label>
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl text-amber-950 font-medium leading-relaxed select-all">
                  {generateReminderText(reminderStore.name, reminderData.amountDue, reminderData.periodStart, reminderData.periodEnd, reminderData.dueDate)}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-600 block">رقم هاتف المطعم المسجل:</span>
                <div className="p-2.5 bg-slate-100 rounded-xl font-mono font-bold text-slate-800 flex items-center justify-between">
                  <span>{reminderStore.phone || '07801234567'}</span>
                  <Phone className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                إغلاق
              </button>
              <button
                onClick={() => {
                  const text = generateReminderText(reminderStore.name, reminderData.amountDue, reminderData.periodStart, reminderData.periodEnd, reminderData.dueDate);
                  handleSendWhatsApp(reminderStore.phone || '07801234567', text);
                  setIsReminderModalOpen(false);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>إرسال عبر واتساب (WhatsApp)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
