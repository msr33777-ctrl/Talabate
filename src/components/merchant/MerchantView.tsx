import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { OrderStatus, Product, ProductOptionGroup, ProductOptionItem, Store as StoreType } from '../../types';
import {
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  Utensils,
  Plus,
  Edit2,
  Trash2,
  Power,
  Volume2,
  VolumeX,
  PackageCheck,
  Bike,
  AlertCircle,
  Check,
  ChevronDown,
  Star,
  MessageSquare,
  ShieldCheck,
  Image as ImageIcon,
  Upload,
  Settings,
  ListPlus,
  Layers,
  Save,
  Phone,
  MapPin,
  DollarSign,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react';

export const MerchantView: React.FC = () => {
  const {
    stores,
    products,
    orders,
    toggleStoreOpen,
    toggleProductAvailability,
    updateProductPrice,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStore,
    uploadImageFile,
    updateOrderStatus,
    cancelOrder,
    getStoreRatings,
    pricingSettings,
  } = useApp();

  // Active Store Selection
  const [activeStoreId, setActiveStoreId] = useState<string>(stores[0]?.id || 'store_1');

  // Main Tabs: 6 dedicated sections
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'options' | 'media' | 'settings' | 'reviews'>('orders');

  // Order status filter in orders tab
  const [orderFilter, setOrderFilter] = useState<'all' | 'created' | 'preparing' | 'ready' | 'picked_up' | 'delivered'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reviewStarFilter, setReviewStarFilter] = useState<number | null>(null);

  // Active Store & Data
  const currentStore = stores.find((s) => s.id === activeStoreId) || stores[0];
  const storeOrders = orders.filter((o) => o.storeId === activeStoreId);
  const storeProducts = products.filter((p) => p.storeId === activeStoreId);
  const storeRatings = getStoreRatings(activeStoreId);

  // Store Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    name: currentStore.name,
    description: currentStore.description,
    address: currentStore.address,
    neighborhood: currentStore.neighborhood,
    phone: currentStore.phone || '07801234567',
    openingHours: currentStore.openingHours || '11:00 ص - 12:00 منتصف الليل',
    deliveryFee: currentStore.deliveryFee,
    minimumOrder: currentStore.minimumOrder,
    banner: currentStore.banner,
    logo: currentStore.logo,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  // Sync settings form when activeStoreId changes
  React.useEffect(() => {
    if (currentStore) {
      setSettingsForm({
        name: currentStore.name,
        description: currentStore.description,
        address: currentStore.address,
        neighborhood: currentStore.neighborhood,
        phone: currentStore.phone || '07801234567',
        openingHours: currentStore.openingHours || '11:00 ص - 12:00 منتصف الليل',
        deliveryFee: currentStore.deliveryFee,
        minimumOrder: currentStore.minimumOrder,
        banner: currentStore.banner,
        logo: currentStore.logo,
      });
    }
  }, [activeStoreId, currentStore]);

  // Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState<{
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    preparationTimeMinutes: number;
    optionGroups: ProductOptionGroup[];
  }>({
    name: '',
    description: '',
    price: 8000,
    category: 'أطباق رئيسية',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
    preparationTimeMinutes: 20,
    optionGroups: [],
  });
  const [isUploadingProdImg, setIsUploadingProdImg] = useState(false);

  // Option Group Builder Modal State (Inside product or standalone)
  const [isGroupBuilderOpen, setIsGroupBuilderOpen] = useState(false);
  const [groupBuilderTargetProduct, setGroupBuilderTargetProduct] = useState<Product | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(true);
  const [newGroupMaxSelect, setNewGroupMaxSelect] = useState(1);
  const [newGroupItems, setNewGroupItems] = useState<{ id: string; name: string; price: number }[]>([
    { id: 'item_1', name: 'عادي / وسط', price: 0 },
    { id: 'item_2', name: 'كبير / دبل', price: 2500 },
  ]);

  // Media Tab File Upload Ref
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const prodImgInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Open Edit Product Modal
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setProdForm({
      name: prod.name,
      description: prod.description,
      price: prod.price,
      category: prod.category,
      imageUrl: prod.imageUrl,
      preparationTimeMinutes: prod.preparationTimeMinutes || 15,
      optionGroups: prod.optionGroups ? JSON.parse(JSON.stringify(prod.optionGroups)) : [],
    });
    setIsProductModalOpen(true);
  };

  // Open New Product Modal
  const handleOpenNewProduct = () => {
    setEditingProductId(null);
    setProdForm({
      name: '',
      description: '',
      price: 8000,
      category: 'مشاوي رئيسية',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80',
      preparationTimeMinutes: 20,
      optionGroups: [],
    });
    setIsProductModalOpen(true);
  };

  // Save Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim()) return;

    if (editingProductId) {
      await updateProduct(editingProductId, {
        name: prodForm.name.trim(),
        description: prodForm.description.trim(),
        price: Number(prodForm.price) || 1000,
        category: prodForm.category,
        imageUrl: prodForm.imageUrl,
        preparationTimeMinutes: Number(prodForm.preparationTimeMinutes) || 15,
        optionGroups: prodForm.optionGroups,
      });
    } else {
      await addProduct({
        storeId: activeStoreId,
        name: prodForm.name.trim(),
        description: prodForm.description.trim() || 'صنف طازج يجهز خصيصاً عند الطلب',
        price: Number(prodForm.price) || 5000,
        category: prodForm.category,
        imageUrl: prodForm.imageUrl,
        isAvailable: true,
        preparationTimeMinutes: Number(prodForm.preparationTimeMinutes) || 15,
        optionGroups: prodForm.optionGroups,
      });
    }

    setIsProductModalOpen(false);
    setEditingProductId(null);
  };

  // Delete product with confirm
  const handleDeleteProduct = async (productId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الصنف (${name}) نهائياً من قائمة المطعم؟`)) {
      await deleteProduct(productId);
    }
  };

  // Handle Image File Upload for Product
  const handleProdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingProdImg(true);
      const dataUrl = await uploadImageFile(file);
      setProdForm((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (err) {
      console.error(err);
      alert('تعذر قراءة أو تحميل الصورة، يرجى اختيار صورة أخرى');
    } finally {
      setIsUploadingProdImg(false);
    }
  };

  // Handle Banner Image File Upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingMedia(true);
      const dataUrl = await uploadImageFile(file);
      setSettingsForm((prev) => ({ ...prev, banner: dataUrl }));
      await updateStore(activeStoreId, { banner: dataUrl });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Handle Logo Image File Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingMedia(true);
      const dataUrl = await uploadImageFile(file);
      setSettingsForm((prev) => ({ ...prev, logo: dataUrl }));
      await updateStore(activeStoreId, { logo: dataUrl });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Save Store Settings
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      await updateStore(activeStoreId, {
        name: settingsForm.name,
        description: settingsForm.description,
        address: settingsForm.address,
        neighborhood: settingsForm.neighborhood,
        phone: settingsForm.phone,
        openingHours: settingsForm.openingHours,
        deliveryFee: Number(settingsForm.deliveryFee),
        minimumOrder: Number(settingsForm.minimumOrder),
        banner: settingsForm.banner,
        logo: settingsForm.logo,
      });
      setSettingsSuccessMessage('تم حفظ وتحديث بيانات المتجر بنجاح في قاعدة البيانات.');
      setTimeout(() => setSettingsSuccessMessage(null), 4000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Add Option Group in Builder
  const handleSaveOptionGroup = async () => {
    if (!newGroupTitle.trim() || newGroupItems.length === 0) {
      alert('يرجى إدخال اسم المجموعة وخيار واحد على الأقل');
      return;
    }

    const newGroup: ProductOptionGroup = {
      id: 'grp_' + Date.now(),
      title: newGroupTitle.trim(),
      isRequired: newGroupRequired,
      minSelect: newGroupRequired ? 1 : 0,
      maxSelect: Number(newGroupMaxSelect) || 1,
      options: newGroupItems.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        price: Number(item.price) || 0,
      })),
    };

    if (isProductModalOpen) {
      // Adding directly into currently editing product form
      setProdForm((prev) => ({
        ...prev,
        optionGroups: [...prev.optionGroups, newGroup],
      }));
    } else if (groupBuilderTargetProduct) {
      // Updating target product
      const updatedGroups = [...(groupBuilderTargetProduct.optionGroups || []), newGroup];
      await updateProduct(groupBuilderTargetProduct.id, { optionGroups: updatedGroups });
    }

    setIsGroupBuilderOpen(false);
    setNewGroupTitle('');
    setNewGroupItems([
      { id: 'item_1', name: 'عادي / وسط', price: 0 },
      { id: 'item_2', name: 'كبير / دبل', price: 2500 },
    ]);
  };

  // Filter Orders for Live Orders Tab
  const filteredOrders = storeOrders.filter((o) => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'created') return o.status === 'created';
    if (orderFilter === 'preparing') return o.status === 'merchant_accepted' || o.status === 'preparing';
    if (orderFilter === 'ready') return o.status === 'ready_for_pickup' || o.status === 'courier_assigned';
    if (orderFilter === 'picked_up') return o.status === 'picked_up';
    if (orderFilter === 'delivered') return o.status === 'delivered';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-5 text-slate-800" dir="rtl">
      {/* 1. TOP HEADER & STORE SWITCHER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={currentStore.logo}
              alt={currentStore.name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-200 bg-slate-50"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">إدارة متجر:</span>
              <div className="relative inline-block">
                <select
                  value={activeStoreId}
                  onChange={(e) => setActiveStoreId(e.target.value)}
                  className="font-black text-base sm:text-lg text-[#172554] bg-transparent outline-none cursor-pointer pr-1 pl-6 focus:ring-1 focus:ring-orange-400 rounded-lg"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-0 top-1.5 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  currentStore.approvalStatus && currentStore.approvalStatus !== 'approved'
                    ? currentStore.approvalStatus === 'pending'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-orange-100 text-orange-800 border border-orange-300'
                    : currentStore.isOpen
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {currentStore.approvalStatus && currentStore.approvalStatus !== 'approved'
                  ? currentStore.approvalStatus === 'pending'
                    ? 'بانتظار موافقة المدير'
                    : 'حساب متجر معلق'
                  : currentStore.isOpen
                  ? 'المتجر يستقبل الطلبات'
                  : 'المتجر مغلق'}
              </span>

              <button
                onClick={() => setActiveTab('reviews')}
                className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 text-[11px] transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{(Number(currentStore.rating) || 5.0).toFixed(1)} ({currentStore.ratingCount || 1} تقييم)</span>
              </button>

              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#F47721]" />
                <span>{currentStore.neighborhood}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-orange-50 border-orange-300 text-[#F47721]'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
            title="تنبيهات صوت الطلبات الجديدة"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-[11px]">{soundEnabled ? 'الجرس مفعل' : 'صامت'}</span>
          </button>

          <button
            onClick={() => toggleStoreOpen(currentStore.id)}
            disabled={Boolean(currentStore.approvalStatus && currentStore.approvalStatus !== 'approved')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
              currentStore.approvalStatus && currentStore.approvalStatus !== 'approved'
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : currentStore.isOpen
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>
              {currentStore.approvalStatus === 'pending'
                ? 'بانتظار الموافقة'
                : currentStore.approvalStatus === 'suspended'
                ? 'معلق مؤقتاً'
                : currentStore.isOpen
                ? 'إغلاق المتجر مؤقتاً'
                : 'فتح استقبال الطلبات'}
            </span>
          </button>
        </div>
      </div>

      {/* Approval Status Alert Banner */}
      {currentStore.approvalStatus && currentStore.approvalStatus !== 'approved' && (
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 flex items-start gap-3 shadow-xs">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1 text-xs text-amber-900 flex-1">
            <span className="font-bold text-sm block">
              {currentStore.approvalStatus === 'pending'
                ? 'المتجر بانتظار موافقة واعتماد إدارة المنصة'
                : currentStore.approvalStatus === 'suspended'
                ? 'حساب المتجر معلق مؤقتاً من قِبل الإدارة'
                : 'طلب تسجيل المتجر مرفوض'}
            </span>
            <p className="text-amber-800 leading-relaxed">
              {currentStore.approvalStatus === 'pending'
                ? 'تم تسجيل بيانات المتجر وموقعه بنجاح وهو الآن قيد التدقيق الإداري. لا يمكن تفعيل استقبال الطلبات للزبائن أو تعديل الأسعار المالية حتى تصدر موافقة المدير الرسمية.'
                : 'يرجى مراجعة إدارة منصة طلبي لمزيد من التفاصيل حول حالة الحساب والامتثال.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. DEDICATED NAVIGATION TABS (6 TABS) */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'orders'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Utensils className="w-4 h-4 text-orange-400" />
          <span>الطلبات الحية ({storeOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'menu'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ListPlus className="w-4 h-4 text-orange-400" />
          <span>القائمة والأصناف ({storeProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'options'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-orange-400" />
          <span>مجموعات الخيارات</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'media'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-orange-400" />
          <span>الوسائط والصور</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4 text-orange-400" />
          <span>إعدادات المتجر</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'reviews'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Star className="w-4 h-4 text-amber-400" />
          <span>التقييمات ({storeRatings.length})</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}

      {/* ================= TAB 1: LIVE ORDERS ================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Order Status Filters */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100/70 p-2 rounded-2xl border border-slate-200">
            <button
              onClick={() => setOrderFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'all' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              الكل ({storeOrders.length})
            </button>
            <button
              onClick={() => setOrderFilter('created')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'created' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              طلبات جديدة ({storeOrders.filter((o) => o.status === 'created').length})
            </button>
            <button
              onClick={() => setOrderFilter('preparing')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'preparing' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              قيد التحضير ({storeOrders.filter((o) => o.status === 'merchant_accepted' || o.status === 'preparing').length})
            </button>
            <button
              onClick={() => setOrderFilter('ready')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'ready' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              جاهزة للاستلام ({storeOrders.filter((o) => o.status === 'ready_for_pickup' || o.status === 'courier_assigned').length})
            </button>
            <button
              onClick={() => setOrderFilter('picked_up')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'picked_up' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              مع المندوب في الطريق ({storeOrders.filter((o) => o.status === 'picked_up').length})
            </button>
            <button
              onClick={() => setOrderFilter('delivered')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                orderFilter === 'delivered' ? 'bg-[#F47721] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              مكتملة ({storeOrders.filter((o) => o.status === 'delivered').length})
            </button>
          </div>

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-orange-300 transition-all space-y-3"
              >
                {/* Header: Order ID, Time, Customer Contact, Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-[#172554] font-mono">
                      #{ord.id.slice(-6)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {ord.createdAt || new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Customer Name & Real Phone Info */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                      <span className="text-xs font-bold text-slate-800">
                        {ord.customer?.name || 'زبون طلبي'}
                      </span>
                      {ord.customer?.phone && ord.customer.phone.trim() !== '' ? (
                        <a
                          href={`tel:${ord.customer.phone}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors shadow-xs"
                          title="اتصال مباشر بالزبون"
                        >
                          <Phone className="w-3 h-3 text-emerald-700" />
                          <span dir="ltr">{ord.customer.phone}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium mr-1">
                          (رقم الهاتف غير متوفر)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                      ord.status === 'created'
                        ? 'bg-amber-100 text-amber-800 animate-pulse border border-amber-300'
                        : ord.status === 'merchant_accepted' || ord.status === 'preparing'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : ord.status === 'ready_for_pickup'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : ord.status === 'courier_assigned'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : ord.status === 'picked_up'
                        ? 'bg-orange-100 text-[#F47721] border border-orange-200'
                        : ord.status === 'courier_arrived'
                        ? 'bg-teal-100 text-teal-800 border border-teal-200'
                        : ord.status === 'delivered'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {ord.status === 'created' && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
                    <span>
                      {ord.status === 'created'
                        ? 'طلب جديد وبانتظار الموافقة'
                        : ord.status === 'merchant_accepted' || ord.status === 'preparing'
                        ? 'جاري التحضير في المطبخ'
                        : ord.status === 'ready_for_pickup'
                        ? 'جاهز للاستلام والتسليم للمندوب'
                        : ord.status === 'courier_assigned'
                        ? 'تم حجز المندوب'
                        : ord.status === 'picked_up'
                        ? 'تم الاستلام وبطريقه للزبون'
                        : ord.status === 'courier_arrived'
                        ? 'المندوب وصل عند باب الزبون'
                        : ord.status === 'delivered'
                        ? 'تم التوصيل بنجاح'
                        : 'ملغي'}
                    </span>
                  </span>
                </div>

                {/* Items & Options detail */}
                <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-900">{item.quantity}x {item.name}</span>
                        {item.selectedOptionGroups && item.selectedOptionGroups.length > 0 && (
                          <div className="text-[11px] text-slate-500 pr-3">
                            {item.selectedOptionGroups.map((g, gi) => (
                              <span key={gi} className="ml-2 inline-block">
                                <span className="text-slate-400">{g.groupTitle}:</span> {g.selectedItems.map((s) => s.name).join(', ')}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <span className="text-[11px] text-orange-600 block pr-3 font-medium">ملاحظات: {item.notes}</span>
                        )}
                      </div>
                      <span className="font-extrabold text-[#172554] text-left">
                        {(item.price * item.quantity).toLocaleString()} د.ع
                      </span>
                    </div>
                  ))}
                </div>

                {/* Courier Reservation Info & Delivery Location */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                  {/* Courier Reservation Status */}
                  <div className="flex items-center gap-2">
                    {ord.courierId ? (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl text-xs">
                        <Bike className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <span className="font-bold">المندوب المحجوز: </span>
                          <span className="font-extrabold text-blue-800">{ord.courierName || 'كابتن طلبي'}</span>
                        </div>
                        {ord.courierPhone && (
                          <a
                            href={`tel:${ord.courierPhone}`}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors mr-1 shadow-2xs"
                            dir="ltr"
                            title="اتصال مباشر بالمندوب"
                          >
                            <Phone className="w-3 h-3 text-blue-600" />
                            <span>{ord.courierPhone}</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="font-medium">العرض مرسل للمناديب المؤهلين (بانتظار قبول الكابتن...)</span>
                      </div>
                    )}
                  </div>

                  {/* Customer Address */}
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-[#F47721] shrink-0" />
                    <span>{ord.customer?.neighborhood || 'بغداد'} - {ord.customer?.address || 'العنوان المسجل'}</span>
                  </div>
                </div>

                {/* Financial Summary & Merchant Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      صافي استحقاق المطعم: {(ord.financials?.storeNetPayout ?? ord.subtotal).toLocaleString()} د.ع
                    </span>
                  </div>

                  {/* Merchant Action Buttons */}
                  <div className="flex items-center gap-2">
                    {ord.status === 'created' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(ord.id, 'preparing', 'وافق المطعم على الطلب وبدأ التحضير في المطبخ')}
                          className="px-4 py-2 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <Check className="w-4 h-4" />
                          <span>قبول وبدء التحضير</span>
                        </button>
                        <button
                          onClick={() => cancelOrder(ord.id, 'اعتذار المطعم عن الطلب')}
                          className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-all border border-rose-200"
                        >
                          اعتذار / رفض
                        </button>
                      </>
                    )}

                    {(ord.status === 'merchant_accepted' || ord.status === 'preparing') && (
                      <button
                        onClick={() => updateOrderStatus(ord.id, 'ready_for_pickup', 'الطلب جاهز للاستلام والتسليم للمندوب')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>جاهز للاستلام (إشعار المندوب)</span>
                      </button>
                    )}

                    {ord.status === 'ready_for_pickup' && (
                      <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>بانتظار تأكيد استلام المندوب للوجبة</span>
                      </span>
                    )}

                    {ord.status === 'picked_up' && (
                      <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                        <Bike className="w-3.5 h-3.5" />
                        <span>مع المندوب في الطريق للزبون</span>
                      </span>
                    )}

                    {ord.status === 'delivered' && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم التوصيل بنجاح</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredOrders.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">لا توجد طلبات في هذا القسم حالياً.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: MENU & ITEMS ================= */}
      {activeTab === 'menu' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Action Header */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-[#172554]">قائمة الأكلات والمنتجات ({storeProducts.length})</h3>
              <p className="text-[11px] text-slate-400">أضف وجباتك، حدد الأسعار، وقت التجهيز وحالة التوفر</p>
            </div>
            <button
              onClick={handleOpenNewProduct}
              className="px-4 py-2.5 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أكلة / منتج جديد</span>
            </button>
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storeProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Photo & Availability Badge */}
                  <div className="h-36 w-full rounded-xl overflow-hidden bg-slate-100 relative mb-2.5">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md font-semibold">
                        {prod.category}
                      </span>
                    </div>

                    <div className="absolute top-2 left-2">
                      <button
                        onClick={() => toggleProductAvailability(prod.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md transition-colors ${
                          prod.isAvailable
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {prod.isAvailable ? 'متوفر' : 'غير متوفر'}
                      </button>
                    </div>

                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span>{prod.preparationTimeMinutes || 15} دقيقة</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">{prod.name}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{prod.description}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-extrabold text-sm text-[#F47721]">
                    {prod.price.toLocaleString()} د.ع
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditProduct(prod)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#F47721] text-slate-600 transition-colors"
                      title="تعديل الأكلة والخيارات"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id, prod.name)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                      title="حذف من القائمة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: OPTION GROUPS BUILDER ================= */}
      {activeTab === 'options' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#172554]">مجموعات الخيارات والإضافات (Option Groups)</h3>
              <p className="text-[11px] text-slate-400">
                إدارة أحجام الوجبات (صغير، وسط، كبير) والإضافات (جبن، صوصات، مقبلات) مع شروط الإلزامية والحدود
              </p>
            </div>
            <button
              onClick={() => {
                setGroupBuilderTargetProduct(null);
                setIsGroupBuilderOpen(true);
              }}
              className="px-4 py-2 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مجموعة خيارات جديدة</span>
            </button>
          </div>

          {/* List of Option Groups configured across store products */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {storeProducts.filter((p) => p.optionGroups && p.optionGroups.length > 0).map((prod) => (
              <div key={prod.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <img src={prod.imageUrl} alt={prod.name} className="w-8 h-8 rounded-lg object-cover" />
                    <span className="font-bold text-xs text-slate-900">{prod.name}</span>
                  </div>
                  <button
                    onClick={() => handleOpenEditProduct(prod)}
                    className="text-[11px] text-[#F47721] font-bold hover:underline"
                  >
                    تعديل الخيارات
                  </button>
                </div>

                <div className="space-y-2">
                  {prod.optionGroups?.map((grp) => (
                    <div key={grp.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                        <span>{grp.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${grp.isRequired ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                          {grp.isRequired ? 'إلزامي' : 'اختياري'} • {grp.maxSelect === 1 ? 'خيار واحد' : `حتى ${grp.maxSelect}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {grp.options.map((opt) => (
                          <span key={opt.id} className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                            {opt.name} {opt.price > 0 ? `(+${opt.price.toLocaleString()} د.ع)` : '(مجاناً)'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: MEDIA & PHOTO UPLOADS ================= */}
      {activeTab === 'media' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <h3 className="font-bold text-sm text-[#172554]">إدارة الوسائط وصور المتجر</h3>
            <p className="text-[11px] text-slate-400">
              ارفع صوراً حقيقية من هاتفك أو جهازك لصورة الغلاف، شعار المتجر، وأطباق القائمة
            </p>
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            className="hidden"
          />
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Store Banner Uploader Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800">صورة غلاف المتجر (Banner)</h4>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="px-3 py-1.5 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>تغيير / رفع صورة الغلاف</span>
                </button>
              </div>

              <div className="h-44 w-full rounded-xl overflow-hidden bg-slate-100 relative border border-slate-200">
                <img
                  src={settingsForm.banner}
                  alt="غلاف المتجر"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                يُفضل استخدام صورة أفقية واضحة للمطعم أو صينية المأكولات بدقة عالية.
              </p>
            </div>

            {/* Store Logo Uploader Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800">شعار المتجر (Logo)</h4>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="px-3 py-1.5 bg-[#172554] hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>تغيير / رفع الشعار</span>
                </button>
              </div>

              <div className="h-44 w-full rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200">
                <img
                  src={settingsForm.logo}
                  alt="شعار المتجر"
                  className="w-28 h-28 rounded-2xl object-cover shadow-sm border-2 border-white"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                شعار المتجر يظهر في بطاقات المطاعم وشريط التصفح العلوي.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: STORE PROFILE SETTINGS ================= */}
      {activeTab === 'settings' && (
        <div className="space-y-4 animate-fadeIn">
          <form onSubmit={handleSaveStoreSettings} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#172554]">بيانات ومعلومات المتجر</h3>
                <p className="text-[11px] text-slate-400">تعديل الاسم والوصف ورقم الهاتف وساعات العمل وأجرة التوصيل</p>
              </div>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'جاري الحفظ...' : 'حفظ التعديلات في Firebase'}</span>
              </button>
            </div>

            {settingsSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{settingsSuccessMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم المطعم أو المتجر</label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">رقم هاتف المتجر المباشر</label>
                <input
                  type="text"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none font-mono"
                  placeholder="0780xxxxxxx"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">المنطقة / الحي</label>
                <input
                  type="text"
                  value={settingsForm.neighborhood}
                  onChange={(e) => setSettingsForm({ ...settingsForm, neighborhood: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ساعات العمل اليومية</label>
                <input
                  type="text"
                  value={settingsForm.openingHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none"
                  placeholder="11:00 ص - 12:00 م"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">العنوان التفصيلي</label>
                <input
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">وصف المتجر ونوع المأكولات</label>
                <textarea
                  rows={2}
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">أجرة التوصيل للزبون (د.ع)</label>
                <input
                  type="number"
                  step="250"
                  value={settingsForm.deliveryFee}
                  onChange={(e) => setSettingsForm({ ...settingsForm, deliveryFee: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">الحد الأدنى للطلب (د.ع)</label>
                <input
                  type="number"
                  step="500"
                  value={settingsForm.minimumOrder}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minimumOrder: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#F47721] focus:outline-none font-bold"
                  required
                />
              </div>
            </div>

            {/* Read-Only RBAC Commission Box */}
            <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="font-bold text-slate-900 block">نسبة عمولة منصة طلبي (RBAC Protection)</span>
                  <span className="text-[10px] text-slate-400">تحدد حصرياً من قبل إدارة المنصة ولا يمكن للمطعم تعديلها.</span>
                </div>
              </div>
              <span className="font-extrabold text-sm text-[#172554] bg-white px-3 py-1 rounded-xl border border-slate-200">
                %{pricingSettings.defaultPlatformCommissionPercent}
              </span>
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB 6: REVIEWS & RATINGS ================= */}
      {activeTab === 'reviews' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Rating Summary Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-right">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-amber-600">{currentStore.rating.toFixed(1)}</span>
                <span className="text-[9px] text-slate-400">من 5.0</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#172554]">متوسط تقييمات الزبائن للمطعم</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  بناءً على {currentStore.ratingCount} تقييماً حقيقياً مسجلاً في Firebase
                </p>
              </div>
            </div>

            {/* Star Filters */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setReviewStarFilter(null)}
                className={`px-3 py-1 rounded-xl text-xs font-bold ${
                  reviewStarFilter === null ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                الكل
              </button>
              {[5, 4, 3, 2, 1].map((st) => (
                <button
                  key={st}
                  onClick={() => setReviewStarFilter(st)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-0.5 ${
                    reviewStarFilter === st ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span>{st}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {storeRatings
              .filter((r) => reviewStarFilter === null || r.storeRating === reviewStarFilter)
              .map((r) => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < r.storeRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-900">{r.customerName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString('ar-IQ')}
                    </span>
                  </div>

                  {r.storeComment && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                      "{r.storeComment}"
                    </p>
                  )}
                </div>
              ))}

            {storeRatings.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <Star className="w-8 h-8 text-amber-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">لا توجد تقييمات مسجلة لهذا المطعم حتى الآن.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT PRODUCT ================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-sm text-[#172554]">
                {editingProductId ? 'تعديل بيانات الصنف' : 'إضافة أكلة / منتج جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* Product Photo Upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">صورة الأكلة أو المنتج</label>
                <input
                  ref={prodImgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProdImageUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <img src={prodForm.imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => prodImgInputRef.current?.click()}
                      disabled={isUploadingProdImg}
                      className="px-3 py-1.5 bg-orange-50 hover:bg-[#F47721] text-[#F47721] hover:text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingProdImg ? 'جاري التحميل...' : 'رفع صورة من الجهاز'}</span>
                    </button>
                    <input
                      type="text"
                      value={prodForm.imageUrl}
                      onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                      placeholder="أو الصق رابط صورة مباشر..."
                      className="w-full p-2 rounded-lg border border-slate-200 text-[11px] bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اسم الصنف / الأكلة</label>
                  <input
                    type="text"
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    placeholder="مثال: نفر كباب مشوي عالفحم"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">السعر الأساسي (د.ع)</label>
                  <input
                    type="number"
                    step="250"
                    value={prodForm.price}
                    onChange={(e) => setProdForm({ ...prodForm, price: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-bold"
                    required
                  />
                </div>
              </div>

              {/* Category & Preparation Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">التصنيف والقسم</label>
                  <input
                    type="text"
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    placeholder="مشاوي، برغر، مقبلات..."
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">وقت التحضير المتوقع (دقيقة)</label>
                  <input
                    type="number"
                    value={prodForm.preparationTimeMinutes}
                    onChange={(e) => setProdForm({ ...prodForm, preparationTimeMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-bold"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">وصف المكونات والتقديم</label>
                <textarea
                  rows={2}
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                  placeholder="وصف مختصر للوجبة أو المنتج..."
                />
              </div>

              {/* Attached Option Groups */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">مجموعات الخيارات المرفقة ({prodForm.optionGroups.length})</span>
                  <button
                    type="button"
                    onClick={() => setIsGroupBuilderOpen(true)}
                    className="text-[11px] font-bold text-[#F47721] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مجموعة خيارات</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {prodForm.optionGroups.map((grp, gi) => (
                    <div key={grp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{grp.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {grp.isRequired ? 'إلزامي' : 'اختياري'} • {grp.options.length} خيارات
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProdForm((prev) => ({
                            ...prev,
                            optionGroups: prev.optionGroups.filter((_, idx) => idx !== gi),
                          }));
                        }}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold shadow-sm"
                >
                  {editingProductId ? 'حفظ التعديلات' : 'إضافة إلى القائمة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: OPTION GROUP BUILDER ================= */}
      {isGroupBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-4 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-sm text-[#172554]">إنشاء مجموعة خيارات (أحجام أو إضافات)</h3>
              <button
                type="button"
                onClick={() => setIsGroupBuilderOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم المجموعة</label>
                <input
                  type="text"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  placeholder="مثال: حجم الوجبة، إضافات الجبن، المشروب..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 cursor-pointer bg-slate-50">
                  <input
                    type="checkbox"
                    checked={newGroupRequired}
                    onChange={(e) => setNewGroupRequired(e.target.checked)}
                    className="accent-[#F47721]"
                  />
                  <span className="font-bold text-slate-800">اختيار إلزامي</span>
                </label>

                <div>
                  <select
                    value={newGroupMaxSelect}
                    onChange={(e) => setNewGroupMaxSelect(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                  >
                    <option value={1}>خيار واحد فقط (Radio)</option>
                    <option value={2}>حتى خيارين (Checkbox)</option>
                    <option value={3}>حتى 3 خيارات</option>
                    <option value={5}>خيارات متعددة غير محدودة</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">عناصر الخيارات والأسعار</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewGroupItems((prev) => [
                        ...prev,
                        { id: 'item_' + Date.now(), name: '', price: 0 },
                      ])
                    }
                    className="text-[11px] font-bold text-[#F47721] hover:underline"
                  >
                    + إضافة خيار
                  </button>
                </div>

                {newGroupItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const copy = [...newGroupItems];
                        copy[idx].name = e.target.value;
                        setNewGroupItems(copy);
                      }}
                      placeholder="اسم الخيار (مثال: جبن إضافي)"
                      className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50"
                    />
                    <input
                      type="number"
                      step="250"
                      value={item.price}
                      onChange={(e) => {
                        const copy = [...newGroupItems];
                        copy[idx].price = Number(e.target.value);
                        setNewGroupItems(copy);
                      }}
                      placeholder="السعر (0 لمجاناً)"
                      className="w-24 p-2 rounded-lg border border-slate-200 bg-slate-50 font-bold text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setNewGroupItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGroupBuilderOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveOptionGroup}
                className="px-5 py-2 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-bold text-xs shadow-sm"
              >
                حفظ المجموعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
