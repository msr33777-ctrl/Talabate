import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Store,
  Bike,
  Search,
  Filter,
  Check,
  X,
  AlertTriangle,
  Building2,
  Truck,
  FileText,
  User,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react';
import { RestaurantApplication, CourierApplication } from '../../types';

interface ApplicationReviewSectionProps {
  type: 'restaurants' | 'couriers';
}

export const ApplicationReviewSection: React.FC<ApplicationReviewSectionProps> = ({ type }) => {
  const {
    restaurantApplications,
    courierApplications,
    reviewRestaurantApplication,
    reviewCourierApplication,
    addNotification,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const isRest = type === 'restaurants';
  const apps = isRest ? restaurantApplications : courierApplications;

  const filteredApps = apps.filter((a) => {
    const name = isRest ? (a as RestaurantApplication).storeName : (a as CourierApplication).fullName;
    const phone = isRest ? (a as RestaurantApplication).ownerPhone || (a as RestaurantApplication).phone || '' : (a as CourierApplication).phone;
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    try {
      if (isRest) {
        await reviewRestaurantApplication(id, 'approve');
        addNotification('تم اعتماد المطعم', 'تمت الموافقة وتفعيل حساب المتجر وترقية دور المستخدم إلى مطعم', 'success');
      } else {
        await reviewCourierApplication(id, 'approve');
        addNotification('تم اعتماد الكابتن', 'تمت الموافقة وتفعيل حساب الكابتن وترقية دور المستخدم إلى كابتن', 'success');
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectSubmit = async (id: string) => {
    setIsProcessing(id);
    try {
      if (isRest) {
        await reviewRestaurantApplication(id, 'reject', rejectReason || 'لم يستوفِ الشروط المعتمدة');
        addNotification('تم رفض الطلب', 'تم تسجيل قرار الرفض وحفظ السبب', 'warning');
      } else {
        await reviewCourierApplication(id, 'reject', rejectReason || 'عدم استيفاء الوثائق والشروط');
        addNotification('تم رفض الطلب', 'تم تسجيل قرار الرفض وحفظ السبب', 'warning');
      }
      setRejectingAppId(null);
      setRejectReason('');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 font-['Cairo',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
              isRest ? 'bg-amber-500' : 'bg-blue-600'
            }`}
          >
            {isRest ? <Building2 className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {isRest ? 'طلبات انضمام المتاجر والمطاعم' : 'طلبات انضمام مناديب التوصيل (الكباتن)'}
            </h3>
            <p className="text-xs text-slate-500">
              {isRest
                ? 'مراجعة وتدقيق المستمسكات، واعتماد المطاعم الجديدة أو رفضها'
                : 'مراجعة وثائق الكباتن، ونوع المركبة، وترقية حساباتهم للعمل'}
            </p>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition ${
              statusFilter === 'all' ? 'bg-[#172554] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({apps.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl transition ${
              statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-100'
            }`}
          >
            قيد المراجعة ({apps.filter((a) => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl transition ${
              statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            المقبولة ({apps.filter((a) => a.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl transition ${
              statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-100'
            }`}
          >
            المرفوضة ({apps.filter((a) => a.status === 'rejected').length})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRest ? 'بحث باسم المطعم، المالك، أو رقم الهاتف...' : 'بحث باسم الكابتن، أو رقم الهاتف...'}
          className="w-full bg-slate-50 border border-slate-200 text-slate-900 pr-10 pl-4 py-2.5 rounded-2xl text-xs font-medium outline-none focus:border-[#F47721]"
        />
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApps.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-200">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">لا توجد طلبات مطابقة لهذا الفلتر</p>
          </div>
        ) : (
          filteredApps.map((app) => {
            const isPending = app.status === 'pending';
            const isApproved = app.status === 'approved';
            const isRejected = app.status === 'rejected';

            const restApp = isRest ? (app as RestaurantApplication) : null;
            const courApp = !isRest ? (app as CourierApplication) : null;

            return (
              <div
                key={app.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                        isRest ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                    >
                      {isRest ? <Store className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm text-[#172554]">
                          {isRest ? restApp?.storeName : courApp?.fullName}
                        </h4>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isPending ? 'قيد المراجعة' : isApproved ? 'معتمد ومقبول' : 'مرفوض'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        معرّف الطلب: #{app.id} • مقدم بواسطة UID: {app.userId || app.applicantUserId || 'غير محدد'}
                      </p>
                    </div>
                  </div>

                  {/* Date Submitted */}
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {new Date(app.createdAt).toLocaleString('ar-IQ')}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl text-xs text-slate-700">
                  {isRest ? (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[10px]">المالك:</span>
                        <span className="font-bold text-slate-900">{restApp?.ownerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
                        <span className="font-bold text-slate-900">{restApp?.ownerPhone || restApp?.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">التصنيف والمدينة:</span>
                        <span className="font-bold text-slate-900">{restApp?.category} ({restApp?.city || 'بغداد'})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">العنوان:</span>
                        <span className="font-bold text-slate-900 truncate block">{restApp?.address}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[10px]">الكابتن:</span>
                        <span className="font-bold text-slate-900">{courApp?.fullName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
                        <span className="font-bold text-slate-900">{courApp?.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">المركبة واللوحة:</span>
                        <span className="font-bold text-slate-900">
                          {courApp?.vehicleType} ({courApp?.vehiclePlate})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">السكن ومنطقة العمل:</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {courApp?.city || 'بغداد'} - {courApp?.address}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Admin Notes if rejected */}
                {app.adminNotes && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    <span className="font-bold block mb-0.5">ملاحظات الإدارة المسجلة:</span>
                    <span>{app.adminNotes}</span>
                  </div>
                )}

                {/* Reject Dialog inline */}
                {rejectingAppId === app.id && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-in fade-in">
                    <h5 className="font-black text-xs text-rose-950">سبب رفض الطلب (سيظهر للمستخدم):</h5>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="اكتب سبب الرفض هنا، مثل: عدم وضوح سنوية المركبة، أو عدم توفر ترخيص المطعم..."
                      rows={2}
                      className="w-full bg-white border border-rose-300 text-slate-900 p-2.5 rounded-xl text-xs outline-none focus:border-rose-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingAppId(null);
                          setRejectReason('');
                        }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectSubmit(app.id)}
                        disabled={isProcessing === app.id}
                        className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        {isProcessing === app.id ? 'جاري الحفظ...' : 'تأكيد الرفض'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons for Admin */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <div className="text-[11px] text-slate-400">
                    الحالة الحالية: <strong className="text-slate-700">{app.status}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve button */}
                    <button
                      type="button"
                      disabled={isProcessing === app.id || isApproved}
                      onClick={() => handleApprove(app.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isApproved ? 'معتمد ومقبول' : 'اعتماد وقبول الحساب'}</span>
                    </button>

                    {/* Reject button */}
                    {rejectingAppId !== app.id && !isRejected && (
                      <button
                        type="button"
                        disabled={isProcessing === app.id}
                        onClick={() => {
                          setRejectingAppId(app.id);
                          setRejectReason('');
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>رفض الطلب</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
