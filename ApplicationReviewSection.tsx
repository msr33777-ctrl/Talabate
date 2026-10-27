import React, { useState } from 'react';
import {
  Store as StoreIcon,
  Bike,
  Clock,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Eye,
  MapPin,
  Phone,
  User,
  FileText,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Search,
  Car,
  Image as ImageIcon,
  X,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RestaurantApplication, CourierApplication, ApplicationStatus } from '../../types';
import RealInteractiveMap from '../common/RealInteractiveMap';

interface ApplicationReviewSectionProps {
  type: 'restaurants' | 'couriers';
}

export const ApplicationReviewSection: React.FC<ApplicationReviewSectionProps> = ({ type }) => {
  const {
    restaurantApplications,
    courierApplications,
    reviewRestaurantApplication,
    reviewCourierApplication,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedDocUrl, setSelectedDocUrl] = useState<{ title: string; url: string } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ title: string; coords: { lat: number; lng: number } } | null>(null);
  const [reviewActionTarget, setReviewActionTarget] = useState<{
    appId: string;
    action: 'approve' | 'reject' | 'suspend';
    title: string;
  } | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isRestaurants = type === 'restaurants';

  const rawApplications = isRestaurants ? restaurantApplications : courierApplications;

  const filteredApps = rawApplications.filter((app: any) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const nameMatch = isRestaurants
      ? (app.storeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.ownerPhone || '').includes(searchQuery)
      : (app.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.phone || '').includes(searchQuery) ||
        (app.vehiclePlate || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && nameMatch;
  });

  const pendingCount = rawApplications.filter((a) => a.status === 'pending').length;
  const approvedCount = rawApplications.filter((a) => a.status === 'approved').length;
  const rejectedCount = rawApplications.filter((a) => a.status === 'rejected').length;
  const suspendedCount = rawApplications.filter((a) => a.status === 'suspended').length;

  const handleExecuteReview = async () => {
    if (!reviewActionTarget) return;
    setIsProcessing(true);

    try {
      if (isRestaurants) {
        await reviewRestaurantApplication(
          reviewActionTarget.appId,
          reviewActionTarget.action,
          adminNotesInput.trim() || undefined
        );
      } else {
        await reviewCourierApplication(
          reviewActionTarget.appId,
          reviewActionTarget.action,
          adminNotesInput.trim() || undefined
        );
      }
      setReviewActionTarget(null);
      setAdminNotesInput('');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>بانتظار موافقة المدير</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>معتمد ونشط</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>مرفوض</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
            <span>معلق مؤقتاً</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${
              isRestaurants
                ? 'bg-gradient-to-tr from-orange-600 to-amber-500'
                : 'bg-gradient-to-tr from-blue-900 to-indigo-700'
            }`}
          >
            {isRestaurants ? <StoreIcon className="w-6 h-6" /> : <Bike className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              {isRestaurants ? 'طلبات انضمام المطاعم والشركاء' : 'طلبات انضمام الكباتن ومناديب التوصيل'}
            </h3>
            <p className="text-xs text-slate-500">
              {isRestaurants
                ? 'مراجعة وتدقيق المتاجر الجديدة، التحقق من المواقع واعتماد فتح الحسابات المالية'
                : 'فحص وثائق الكباتن، بيانات المركبة، وإصدار قرارات القبول والتعليق المؤقت'}
            </p>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <span className="text-[10px] text-amber-700 font-bold block">بانتظار القرار</span>
            <span className="text-base font-black text-amber-800">{pendingCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span className="text-[10px] text-emerald-700 font-bold block">معتمدة</span>
            <span className="text-base font-black text-emerald-800">{approvedCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
            <span className="text-[10px] text-rose-700 font-bold block">مرفوضة</span>
            <span className="text-base font-black text-rose-800">{rejectedCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl text-center">
            <span className="text-[10px] text-orange-700 font-bold block">معلقة</span>
            <span className="text-base font-black text-orange-800">{suspendedCount}</span>
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isRestaurants
                ? 'ابحث باسم المطعم، المالك، أو رقم الهاتف...'
                : 'ابحث باسم الكابتن، رقم الهاتف، أو لوحة المركبة...'
            }
            className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `الكل (${rawApplications.length})` },
            { id: 'pending', label: `بانتظار الموافقة (${pendingCount})` },
            { id: 'approved', label: `معتمدة (${approvedCount})` },
            { id: 'suspended', label: `معلقة (${suspendedCount})` },
            { id: 'rejected', label: `مرفوضة (${rejectedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Cards Grid */}
      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-700">لا توجد طلبات مطابقة للمعايير المحددة</p>
          <p className="text-xs text-slate-400">
            {statusFilter !== 'all' ? 'جرب تغيير فلتر الحالة لعرض باقي الطلبات' : 'لم يتم تسجيل أي طلب بعد'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((item: any) => {
            if (isRestaurants) {
              const app = item as RestaurantApplication;
              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Store Info & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            app.logoUrl ||
                            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80'
                          }
                          alt={app.storeName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{app.storeName}</h4>
                          <span className="text-[11px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            {app.category}
                          </span>
                        </div>
                      </div>
                      <div>{getStatusBadge(app.status)}</div>
                    </div>

                    {/* Metadata Details */}
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs text-slate-700 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>المالك / المسؤول:</span>
                        </span>
                        <span className="font-bold text-slate-900">{app.ownerName}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>رقم الهاتف:</span>
                        </span>
                        <a
                          href={`tel:${app.ownerPhone}`}
                          className="font-mono font-bold text-orange-600 hover:underline"
                        >
                          {app.ownerPhone}
                        </a>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1 flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>العنوان:</span>
                        </span>
                        <span className="font-medium text-slate-800 text-left text-[11px] leading-tight">
                          {app.address}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>تاريخ التقديم:</span>
                        </span>
                        <span className="font-mono text-slate-600">
                          {new Date(app.createdAt).toLocaleDateString('ar-IQ', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {app.adminNotes && (
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-[11px] font-medium border border-amber-200">
                          <span className="font-bold">ملاحظة الإدارة: </span>
                          {app.adminNotes}
                        </div>
                      )}
                    </div>

                    {/* Preview Buttons: Map Pin & Documents */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCoords({
                            title: `موقع ${app.storeName} على الخريطة`,
                            coords: app.coordinates || { lat: 33.3152, lng: 44.3661 },
                          })
                        }
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <MapPin className="w-3.5 h-3.5 text-orange-500" />
                        <span>معاينة الموقع الخرائطي</span>
                      </button>

                      {Boolean(app.logoUrl || app.logo) && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDocUrl({
                              title: `شعار / واجهة ${app.storeName}`,
                              url: app.logoUrl || app.logo || '',
                            })
                          }
                          className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>الصورة</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Admin Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewActionTarget({
                              appId: app.id,
                              action: 'approve',
                              title: `الموافقة على انضمام مطعم «${app.storeName}» وتفعيل حسابه`,
                            })
                          }
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>موافقة واعتماد</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewActionTarget({
                              appId: app.id,
                              action: 'reject',
                              title: `رفض طلب انضمام مطعم «${app.storeName}»`,
                            })
                          }
                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      </>
                    )}

                    {app.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'suspend',
                            title: `تعليق مؤقت لحساب مطعم «${app.storeName}» وإيقاف استقبال الطلبات`,
                          })
                        }
                        className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
                        <span>تعليق مؤقت للحساب</span>
                      </button>
                    )}

                    {app.status === 'suspended' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'approve',
                            title: `إعادة تنشيط واعتماد مطعم «${app.storeName}»`,
                          })
                        }
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>إلغاء التعليق وإعادة التنشيط</span>
                      </button>
                    )}

                    {app.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'approve',
                            title: `إعادة النظر والموافقة على «${app.storeName}»`,
                          })
                        }
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                      >
                        إعادة النظر والموافقة
                      </button>
                    )}
                  </div>
                </div>
              );
            } else {
              // Courier Application Card
              const app = item as CourierApplication;
              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Courier Info & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            app.documents?.profilePhotoUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                          }
                          alt={app.fullName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{app.fullName}</h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md mt-0.5">
                            <Bike className="w-3 h-3" />
                            <span>{app.vehicleType}</span>
                          </div>
                        </div>
                      </div>
                      <div>{getStatusBadge(app.status)}</div>
                    </div>

                    {/* Metadata Details */}
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs text-slate-700 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>رقم الهاتف:</span>
                        </span>
                        <a
                          href={`tel:${app.phone}`}
                          className="font-mono font-bold text-blue-700 hover:underline"
                        >
                          {app.phone}
                        </a>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          <span>رقم اللوحة والموديل:</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {app.vehiclePlate} {app.vehicleModel ? `(${app.vehicleModel})` : ''}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1 flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>منطقة التواجد:</span>
                        </span>
                        <span className="font-medium text-slate-800 text-left text-[11px] leading-tight">
                          {app.address}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>تاريخ التقديم:</span>
                        </span>
                        <span className="font-mono text-slate-600">
                          {new Date(app.createdAt).toLocaleDateString('ar-IQ', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {app.adminNotes && (
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-[11px] font-medium border border-amber-200">
                          <span className="font-bold">ملاحظة الإدارة: </span>
                          {app.adminNotes}
                        </div>
                      )}
                    </div>

                    {/* Uploaded Documents Gallery */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        المستندات المرفقة:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (app.documents?.driverLicenseUrl) {
                              setSelectedDocUrl({
                                title: `إجازة سوق الكابتن ${app.fullName}`,
                                url: app.documents.driverLicenseUrl,
                              });
                            }
                          }}
                          disabled={!app.documents?.driverLicenseUrl}
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition flex items-center justify-center gap-1 ${
                            app.documents?.driverLicenseUrl
                              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>إجازة السوق</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (app.documents?.nationalIdUrl) {
                              setSelectedDocUrl({
                                title: `البطاقة الوطنية للكابتن ${app.fullName}`,
                                url: app.documents.nationalIdUrl,
                              });
                            }
                          }}
                          disabled={!app.documents?.nationalIdUrl}
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition flex items-center justify-center gap-1 ${
                            app.documents?.nationalIdUrl
                              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>الهوية الوطنية</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (app.documents?.vehicleRegistrationUrl) {
                              setSelectedDocUrl({
                                title: `سنوية مركبة الكابتن ${app.fullName}`,
                                url: app.documents.vehicleRegistrationUrl,
                              });
                            }
                          }}
                          disabled={!app.documents?.vehicleRegistrationUrl}
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition flex items-center justify-center gap-1 ${
                            app.documents?.vehicleRegistrationUrl
                              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>السنوية</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewActionTarget({
                              appId: app.id,
                              action: 'approve',
                              title: `الموافقة على انضمام الكابتن «${app.fullName}» واعتماد حسابه`,
                            })
                          }
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>موافقة واعتماد</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewActionTarget({
                              appId: app.id,
                              action: 'reject',
                              title: `رفض طلب انضمام الكابتن «${app.fullName}»`,
                            })
                          }
                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      </>
                    )}

                    {app.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'suspend',
                            title: `تعليق مؤقت لحساب الكابتن «${app.fullName}» وإيقاف استقبال الطلبات`,
                          })
                        }
                        className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
                        <span>تعليق مؤقت للحساب</span>
                      </button>
                    )}

                    {app.status === 'suspended' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'approve',
                            title: `إلغاء تعليق وإعادة تنشيط حساب الكابتن «${app.fullName}»`,
                          })
                        }
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>إلغاء التعليق وتفعيل الحساب</span>
                      </button>
                    )}

                    {app.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewActionTarget({
                            appId: app.id,
                            action: 'approve',
                            title: `إعادة النظر واعتماد الكابتن «${app.fullName}»`,
                          })
                        }
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                      >
                        إعادة النظر واعتماد الكابتن
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Confirmation & Decision Modal */}
      {reviewActionTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                <span>تأكيد الإجراء الإداري</span>
              </h4>
              <button
                onClick={() => setReviewActionTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {reviewActionTarget.title}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات أو أسباب الإدارة (اختياري / يظهر في السجل):
              </label>
              <textarea
                rows={2}
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="مثال: تم تدقيق السجلات والتأكد من مطابقة الوثائق الرسمية..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewActionTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteReview}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-1.5 ${
                  reviewActionTarget.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : reviewActionTarget.action === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {isProcessing ? 'جاري التنفيذ...' : 'تأكيد وحفظ القرار'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document / Photo Viewer Modal */}
      {selectedDocUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="text-xs font-bold truncate">{selectedDocUrl.title}</h4>
              <button
                onClick={() => setSelectedDocUrl(null)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={selectedDocUrl.url}
                alt={selectedDocUrl.title}
                className="max-h-[65vh] w-auto rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Map Coordinates Modal */}
      {selectedCoords && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="text-xs font-bold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-orange-400" />
                <span>{selectedCoords.title}</span>
              </h4>
              <button
                onClick={() => setSelectedCoords(null)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-72 w-full">
              <RealInteractiveMap
                destinationCoords={selectedCoords.coords}
                isInteractivePicker={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
