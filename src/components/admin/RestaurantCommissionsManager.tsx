import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, StorePaymentRecord } from '../../types';
import {
  Coins,
  Send,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Phone,
  Calendar,
  Receipt,
  Search,
  Store as StoreIcon,
  X,
  Check,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';

export const RestaurantCommissionsManager: React.FC = () => {
  const { stores, orders, storePayments, recordStorePayment, suspendStoreDueToDues, reactivateStore, pricingSettings } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unpaid' | 'suspended' | 'settled'>('all');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStoreForPayment, setSelectedStoreForPayment] = useState<Store | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentRecord['paymentMethod']>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Suspension Modal State
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const [selectedStoreForSuspension, setSelectedStoreForSuspension] = useState<Store | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('تأخر تسداد مستحقات المنصة المالية');

  // Reminder WhatsApp/SMS Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderStore, setReminderStore] = useState<Store | null>(null);
  const [reminderData, setReminderData] = useState({
    amountDue: 0,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-27',
    dueDate: '2026-10-31',
  });

  // Calculate store financial summaries
  const storeSummaries = stores.map((store) => {
    // Exclude cancelled and returned orders, only completed 'delivered' orders are taxable for commission
    const storeDeliveredOrders = orders.filter(
      (o) => o.storeId === store.id && o.status === 'delivered'
    );

    const completedCount = storeDeliveredOrders.length;
    const taxableSubtotal = storeDeliveredOrders.reduce((acc, o) => acc + (o.subtotal || 0), 0);
    const commissionPercent = store.commissionRate ?? pricingSettings.defaultPlatformCommissionPercent;
    
    // Total commission due
    const commissionDue = Math.round((taxableSubtotal * commissionPercent) / 100);

    // Payments made previously
    const paymentsForStore = storePayments.filter((p) => p.storeId === store.id);
    const totalPaid = paymentsForStore.reduce((acc, p) => acc + p.amount, 0);

    // Remaining balance due
    const remainingBalance = Math.max(0, commissionDue - totalPaid);

    // Determine status:
    // - "تمت التسوية" only shown when remainingBalance === 0 and commissionDue > 0 (or no dues)
    // - "متوقف مؤقتاً بسبب المستحقات" if store.isSuspendedDueToDues
    // - "مستحقات غير مسددة" if remainingBalance > 0
    // - "نشط" otherwise
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

  const handleOpenPaymentModal = (store: Store, defaultAmount: number) => {
    setSelectedStoreForPayment(store);
    setPaymentAmount(defaultAmount > 0 ? defaultAmount : 10000);
    setPaymentMethod('cash');
    setReceiptNumber('REC-' + Math.floor(1000 + Math.random() * 9000));
    setPaymentNotes('تسديد جزء من عمولات تطبيق طلبي');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreForPayment) return;
    if (paymentAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const summary = storeSummaries.find((s) => s.store.id === selectedStoreForPayment.id);
    if (summary && paymentAmount > summary.remainingBalance + 50000) {
      if (!confirm(`المبلغ المدخل (${paymentAmount.toLocaleString()} د.ع) أكبر بكثير من الرصيد المتبقي المستحق (${summary.remainingBalance.toLocaleString()} د.ع). هل أنت متأكد من الاستمرار؟`)) {
        return;
      }
    }

    const res = await recordStorePayment(
      selectedStoreForPayment.id,
      paymentAmount,
      paymentMethod,
      receiptNumber,
      paymentNotes,
      paymentDate
    );

    if (res.success) {
      setIsPaymentModalOpen(false);
      setSelectedStoreForPayment(null);
    } else {
      alert(res.error || 'تعذر تسجيل الدفعة');
    }
  };

  const handleOpenSuspensionModal = (store: Store) => {
    setSelectedStoreForSuspension(store);
    setSuspensionReason('تأخر تسديد المبالغ المستحقة لتطبيق طلبي رغم إرسال التذكيرات المتكررة');
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
      periodStart: '2026-10-01',
      periodEnd: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    });
    setIsReminderModalOpen(true);
  };

  // Exact formula required by user prompt
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
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-base text-[#172554]">إدارة عوائد وعمولات المطاعم والمستحقات</h2>
            <p className="text-xs text-slate-500">حساب العمولات الأسبوعية التلقائية، سجلات التسديد، وإدارة الحالات والإيقاف</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث باسم المطعم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs p-2 rounded-xl border border-slate-200 font-bold bg-white"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="unpaid">مستحقات غير مسددة</option>
            <option value="suspended">متوقف بسبب المستحقات</option>
            <option value="settled">تمت التسوية</option>
          </select>
        </div>
      </div>

      {/* Stores Commissions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="p-3.5 font-bold">المطعم والمنطقة</th>
                <th className="p-3.5 font-bold text-center">الطلبات المكتملة</th>
                <th className="p-3.5 font-bold">إجمالي الخاضع للعمولة</th>
                <th className="p-3.5 font-bold text-center">النسبة</th>
                <th className="p-3.5 font-bold text-indigo-700">العمولة المستحقة</th>
                <th className="p-3.5 font-bold text-emerald-700">المدفوع سابقاً</th>
                <th className="p-3.5 font-bold text-rose-700">الرصيد المتبقي</th>
                <th className="p-3.5 font-bold text-center">الحالة</th>
                <th className="p-3.5 font-bold text-center">الإجراءات والعمليات</th>
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

                  <td className="p-3.5 text-center font-bold text-purple-700">
                    {item.commissionPercent}%
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
                      {/* Record Payment Button */}
                      <button
                        onClick={() => handleOpenPaymentModal(item.store, item.remainingBalance)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1"
                        title="تسجيل دفعة مستلمة"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>تسجيل دفعة</span>
                      </button>

                      {/* Reminder WhatsApp Button */}
                      <button
                        onClick={() => handleOpenReminderModal(item.store, item.remainingBalance)}
                        className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                        title="إرسال تذكير بالدفع للمطعم"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>تذكير</span>
                      </button>

                      {/* Suspension / Reactivation Button */}
                      {item.store.isSuspendedDueToDues ? (
                        <button
                          onClick={() => reactivateStore(item.store.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                          title="إعادة تفعيل المطعم"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>إعادة تفعيل</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenSuspensionModal(item.store)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                          title="إيقاف المطعم مؤقتاً بسبب المستحقات"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>إيقاف مؤقت</span>
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
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
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
                  className="w-full p-2.5 rounded-xl border border-slate-300"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md"
                >
                  تأكيد وتوثيق الدفعة المستلمة
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
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 bg-rose-50/20"
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
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
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
