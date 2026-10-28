import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, Product, ProductOption, StoreCategory, PaymentMethod, LocationCoordinates, Order } from '../../types';
import { isLocationInServiceArea } from '../../utils/distancePricing';
import { OrderTrackerModal } from './OrderTrackerModal';
import { InAppSupportChatModal } from '../common/InAppSupportChatModal';
import { FinalOrderReviewModal } from './FinalOrderReviewModal';
import { RealInteractiveMap } from '../common/RealInteractiveMap';
import { PhoneAuthModal } from '../common/PhoneAuthModal';
import { StoreReviewsModal } from './StoreReviewsModal';
import { OrderRatingModal } from './OrderRatingModal';
import { FoodCustomizationModal } from './FoodCustomizationModal';
import RegisterRestaurantModal from '../merchant/RegisterRestaurantModal';
import RegisterCourierModal from '../courier/RegisterCourierModal';
import {
  Search,
  MapPin,
  Star,
  Clock,
  Bike,
  Store as StoreIcon,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Headphones,
  Check,
  Phone,
  Home,
  Receipt,
  User as UserIcon,
  Bell,
  X,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
} from 'lucide-react';

export const CustomerView: React.FC = () => {
  const {
    stores,
    products,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartSubtotal,
    cartDeliveryFee,
    cartTotal,
    currentUser,
    orders,
    activeTrackedOrderId,
    setActiveTrackedOrderId,
    setRole,
    isOrderRated,
    notifications,
    pricingSettings,
  } = useApp();

  // Navigation Tabs: 'home' | 'search' | 'orders' | 'account'
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'orders' | 'account'>('home');

  // Location & Category Filters
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('بغداد - سبع البور');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  // Modals state
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isFinalReviewOpen, setIsFinalReviewOpen] = useState(false);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [selectedStoreForReviews, setSelectedStoreForReviews] = useState<Store | null>(null);
  const [orderForRatingModal, setOrderForRatingModal] = useState<Order | null>(null);
  const [selectedStoreCategory, setSelectedStoreCategory] = useState<string>('الكل');
  const [isRegisterRestaurantOpen, setIsRegisterRestaurantOpen] = useState(false);
  const [isRegisterCourierOpen, setIsRegisterCourierOpen] = useState(false);

  // Customer Coordinates for Map
  const [customerCoords, setCustomerCoords] = useState<LocationCoordinates>({
    lat: 33.4632,
    lng: 44.1508,
    accuracy: 30,
    isManualPin: true,
  });

  // Checkout form
  const [customerName, setCustomerName] = useState(currentUser.name || 'أحمد العبيدي');
  const [customerPhone, setCustomerPhone] = useState(currentUser.phone || '07701234567');
  const [customerAddress, setCustomerAddress] = useState(currentUser.address || 'شارع 14 رمضان، عمارة 12');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);

  const neighborhoods = [
    'بغداد - سبع البور',
    'بغداد - المنصور',
    'بغداد - الكرادة',
    'بغداد - الجادرية',
    'بغداد - زيونة',
    'بغداد - الأعظمية',
    'أربيل - عينكاوة',
    'البصرة - العشار',
  ];

  const categories = [
    { label: 'الكل', icon: '🍽️', filterKey: 'الكل' },
    { label: 'برغر', icon: '🍔', filterKey: 'برغر ووجبات سريعة' },
    { label: 'بيتزا ومعجنات', icon: '🍕', filterKey: 'بيتزا ومعجنات' },
    { label: 'مشاوي وعراقي', icon: '🥩', filterKey: 'مشاوي ومأكولات عراقية' },
    { label: 'حلويات ومقاهي', icon: '🍰', filterKey: 'حلويات ومقاهي' },
    { label: 'ماركت وبقالة', icon: '🛒', filterKey: 'ماركت وبقالة' },
    { label: 'قصابة ولحوم', icon: '🍖', filterKey: 'قصابة ولحوم طازجة' },
  ];

  // Active store if viewing store details
  const currentSelectedStore = stores.find((s) => s.id === activeStoreId);
  const storeProducts = products.filter((p) => p.storeId === activeStoreId);

  // Store category tabs
  const storeCategoryTabs = ['الكل', ...Array.from(new Set(storeProducts.map((p) => p.category)))];

  const filteredStoreProducts = storeProducts.filter((p) => {
    if (selectedStoreCategory === 'الكل') return true;
    return p.category === selectedStoreCategory;
  });

  // Filtered stores for main view
  const filteredStores = stores.filter((store) => {
    const matchesCat =
      selectedCategory === 'الكل' ||
      store.category === selectedCategory ||
      (selectedCategory === 'برغر' && store.category.includes('برغر')) ||
      (selectedCategory === 'بيتزا' && store.category.includes('بيتزا'));
    const matchesSearch =
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.neighborhood || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Filtered products for search tab
  const searchMatchedProducts = products.filter((p) => {
    if (!searchQuery.trim()) return false;
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Customer's Orders
  const customerOrders = orders.filter(
    (o) => o.customer?.phone === customerPhone || o.customer?.name === customerName
  );
  const activeOrders = customerOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = customerOrders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  // Handle food card click
  const handleProductClick = (product: Product) => {
    if (product.optionGroups && product.optionGroups.length > 0) {
      setCustomizingProduct(product);
    } else if (product.options && product.options.length > 0) {
      setCustomizingProduct(product);
    } else {
      // Add directly
      addToCart(product, [], '');
    }
  };

  // Add customized item to cart
  const handleAddCustomizedToCart = (
    product: Product,
    quantity: number,
    selectedOptionGroups: {
      groupTitle: string;
      selectedItems: { name: string; price: number }[];
    }[],
    notes: string
  ) => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product, [], notes, selectedOptionGroups);
    }
  };

  // Proceed to review
  const handleProceedToReview = () => {
    if (!customerName.trim()) {
      setCheckoutError('يرجى إدخال اسم المستلم');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 10) {
      setCheckoutError('يرجى إدخال رقم هاتف عراقي صالح (مثال: 07701234567)');
      return;
    }
    if (!customerAddress.trim()) {
      setCheckoutError('يرجى كتابة العنوان بالتفصيل');
      return;
    }
    
    // Service Area Validation
    if (!pricingSettings.serviceArea?.isEnabled) {
      setCheckoutError('نعتذر، خدمة الطلب معطلة حالياً من قبل الإدارة');
      return;
    }
    
    const { isInArea } = isLocationInServiceArea(customerCoords, pricingSettings);
    if (!isInArea) {
      setCheckoutError('عذراً، التوصيل غير متوفر في موقعك حالياً');
      return;
    }

    setCheckoutError(null);
    setIsCheckoutOpen(false);
    setIsFinalReviewOpen(true);
  };

  // Confirm final order
  const handleConfirmFinalOrder = async () => {
    setIsSubmittingOrder(true);
    try {
      // Close final review modal and reset cart is handled in AppContext createOrder
      setIsFinalReviewOpen(false);
      setActiveTab('orders');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24" dir="rtl">
      {/* 1. TOP HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#EF3838] to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
              ط
            </div>
            <div>
              <span className="font-extrabold text-base text-[#172554] tracking-tight block leading-tight">
                طلبي <span className="text-[#EF3838]">TALABI</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">خدمة التوصيل السريع</span>
            </div>
          </div>

          {/* Neighborhood & Delivery Selector */}
          <div className="flex-1 max-w-xs mx-2">
            <div className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 transition-colors px-2.5 py-1.5 rounded-full cursor-pointer">
              <MapPin className="w-3.5 h-3.5 text-[#F47721] shrink-0" />
              <div className="overflow-hidden text-right flex-1">
                <span className="text-[9px] text-slate-400 block font-medium leading-none">التوصيل إلى</span>
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-800 w-full focus:outline-none cursor-pointer truncate"
                >
                  {neighborhoods.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Top Actions: Onboarding & Support & Cart */}
          <div className="flex items-center gap-1.5">
            {/* Quick Onboarding Actions */}
            <button
              type="button"
              onClick={() => setIsRegisterRestaurantOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-bold flex items-center gap-1 transition"
              title="انضم كمطعم شريك في TALABI"
            >
              <StoreIcon className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden xs:inline">انضم كمطعم</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRegisterCourierOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition"
              title="انضم ككابتن توصيل في TALABI"
            >
              <Bike className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xs:inline">انضم ككابتن</span>
            </button>

            <button
              onClick={() => setIsSupportChatOpen(true)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all relative"
              title="الدعم الفني"
            >
              <Headphones className="w-4 h-4 text-slate-700" />
            </button>

            {cart.length > 0 && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="h-9 px-3 rounded-full bg-[#F47721] hover:bg-[#e06816] text-white flex items-center gap-1.5 font-bold text-xs shadow-sm shadow-orange-500/20 active:scale-95 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{cart.reduce((a, b) => a + b.quantity, 0)}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. SEARCH BAR (Visible in Home & Search tab) */}
        {(activeTab === 'home' || activeTab === 'search') && !activeStoreId && (
          <div className="max-w-4xl mx-auto px-4 pb-3 pt-1">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مطعم، كباب، برغر، ماركت، بيتزا..."
                className="w-full pr-10 pl-10 py-2.5 bg-slate-100 hover:bg-slate-100/90 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200/80 focus:border-[#F47721] focus:outline-none transition-all placeholder:text-slate-400 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center absolute left-3"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-3">
        {/* VIEW A: INDEPENDENT STORE VIEW (When a restaurant is clicked) */}
        {activeStoreId && currentSelectedStore ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Back button */}
            <button
              onClick={() => {
                setActiveStoreId(null);
                setSelectedStoreCategory('الكل');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#172554] hover:text-[#F47721] bg-white px-3 py-1.5 rounded-full shadow-xs border border-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              <span>العودة إلى جميع المطاعم</span>
            </button>

            {/* Store Banner & Info Card */}
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              {currentSelectedStore.isSuspendedDueToDues && (
                <div className="bg-rose-600 text-white p-3 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>نعتذر، هذا المطعم متوقف مؤقتاً عن استقبال الطلبات الجديدة بسبب مستحقات مالية وتنظيمية.</span>
                </div>
              )}
              <div className="h-44 sm:h-52 w-full relative bg-slate-100">
                <img
                  src={currentSelectedStore.banner}
                  alt={currentSelectedStore.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${
                      currentSelectedStore.isOpen
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-rose-500/90 text-white'
                    }`}
                  >
                    {currentSelectedStore.isOpen ? 'مفتوح للطلبات' : 'مغلق مؤقتاً'}
                  </span>
                </div>

                {/* Rating trigger button */}
                <button
                  onClick={() => setSelectedStoreForReviews(currentSelectedStore)}
                  className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-extrabold text-slate-800 flex items-center gap-1 shadow-sm hover:bg-white"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{currentSelectedStore.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({currentSelectedStore.ratingCount})</span>
                </button>

                {/* Store title & details overlay */}
                <div className="absolute bottom-3 right-4 left-4 text-white">
                  <div className="flex items-end gap-3">
                    <img
                      src={currentSelectedStore.logo}
                      alt={currentSelectedStore.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md bg-white shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="flex-1">
                      <span className="text-[11px] bg-[#F47721] text-white px-2 py-0.5 rounded-md font-semibold inline-block mb-1">
                        {currentSelectedStore.category}
                      </span>
                      <h1 className="text-lg sm:text-xl font-black text-white leading-tight drop-shadow-sm">
                        {currentSelectedStore.name}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta stats bar */}
              <div className="p-3.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#F47721]" />
                  <span>التوصيل: {currentSelectedStore.deliveryTimeEstimate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-[#172554]" />
                  <span>الأجرة: {currentSelectedStore.deliveryFee.toLocaleString()} د.ع</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentSelectedStore.neighborhood}</span>
                </div>
                {currentSelectedStore.phone && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{currentSelectedStore.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Menu Sections Tabs */}
            <div className="sticky top-[102px] z-30 bg-slate-50/95 backdrop-blur-md py-2 -mx-3 px-3 overflow-x-auto scrollbar-none flex items-center gap-2">
              {storeCategoryTabs.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedStoreCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedStoreCategory === cat
                      ? 'bg-[#172554] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Dishes list: 2-column or clean cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredStoreProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-xs hover:shadow-md transition-all flex gap-3 relative group"
                >
                  {/* Dish Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                        {prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-[#F47721]">
                          {prod.price.toLocaleString()} د.ع
                        </span>
                        {prod.optionGroups && prod.optionGroups.length > 0 && (
                          <span className="text-[9px] text-slate-400 block font-medium">خيارات متعددة</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleProductClick(prod)}
                        disabled={!prod.isAvailable || !currentSelectedStore.isOpen || currentSelectedStore.isSuspendedDueToDues}
                        className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F47721] text-[#F47721] hover:text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </div>

                  {/* Dish Photo */}
                  <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    {!prod.isAvailable && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-1 text-center">
                        <span className="text-[10px] text-white font-bold">نافد مؤقتاً</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredStoreProducts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">لا توجد أكلات متوفرة في هذا القسم حالياً.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'home' ? (
          /* VIEW B: HOME TAB (Category Pills + 2-Column Mobile Restaurant Grid) */
          <div className="space-y-4 animate-fadeIn">
            {/* 3. CATEGORY PILLS / CAROUSEL */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3 py-1 flex items-center gap-2">
              {categories.map((c) => {
                const isSelected = selectedCategory === c.filterKey;
                return (
                  <button
                    key={c.filterKey}
                    onClick={() => setSelectedCategory(c.filterKey)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#172554] text-white shadow-xs scale-[1.02]'
                        : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-sm">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Iraqi promotional banner chip */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-[#172554] to-slate-800 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F47721] flex items-center justify-center text-white shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">عروض الغداء والعشاء في {selectedNeighborhood}</h4>
                  <p className="text-[10px] text-slate-300">توصيل سريع وأسعار مطابقة للمطعم مباشرة</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg">عروض حصرية</span>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="font-black text-sm text-[#172554]">
                  {selectedCategory === 'الكل' ? 'جميع المطاعم والمتاجر' : `مطاعم: ${selectedCategory}`}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {filteredStores.length} متجر متوفر في منطقتك
                </p>
              </div>
            </div>

            {/* 4. RESTAURANTS: 2-COLUMN GRID ON MOBILE (grid-cols-2) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  onClick={() => setActiveStoreId(store.id)}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col group relative"
                >
                  {/* Cover Photo */}
                  <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                    <img
                      src={store.banner}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Logo Overlay */}
                    <div className="absolute top-2 right-2">
                      <img
                        src={store.logo}
                        alt={store.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-white shadow-sm bg-white"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&auto=format&fit=crop&q=80';
                        }}
                      />
                    </div>

                    {/* Open / Closed badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md ${
                          store.isOpen
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-rose-500/90 text-white'
                        }`}
                      >
                        {store.isOpen ? 'مفتوح' : 'مغلق'}
                      </span>
                    </div>

                    {/* Delivery Time Overlay */}
                    <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-[10px] text-white font-semibold drop-shadow-sm">
                      <Clock className="w-3 h-3 text-[#F47721]" />
                      <span>{store.deliveryTimeEstimate}</span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate leading-snug">
                        {store.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {store.category}
                      </p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px]">
                      {/* Rating */}
                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{store.rating.toFixed(1)}</span>
                        <span className="text-slate-400 font-normal">({store.ratingCount})</span>
                      </div>

                      {/* Delivery Fee */}
                      <div className="font-bold text-[#F47721]">
                        {store.deliveryFee === 0 ? 'توصيل مجاني' : `${store.deliveryFee.toLocaleString()} د.ع`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredStores.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">لا توجد متاجر تطابق بحثك حالياً.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('الكل');
                    setSearchQuery('');
                  }}
                  className="mt-2 text-xs font-bold text-[#F47721]"
                >
                  إعادة تعيين الفلاتر
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'search' ? (
          /* VIEW C: SEARCH TAB */
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="font-black text-sm text-[#172554]">نتائج البحث الشامل</h2>
              <p className="text-[11px] text-slate-400">
                {searchQuery ? `البحث عن: "${searchQuery}"` : 'اكتب في مربع البحث بالأعلى لتصفح الأكلات والمتاجر'}
              </p>
            </div>

            {/* Quick chips if no search */}
            {!searchQuery && (
              <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-xs text-slate-700">الأكثر طلباً في بغداد</h4>
                <div className="flex flex-wrap gap-2">
                  {['كباب عراقي', 'سماش برغر', 'بيتزا حطب', 'قوزي الشام', 'أرز عنبر', 'حلاوة دهينة', 'لبن أربيل'].map(
                    (term) => (
                      <button
                        key={term}
                        onClick={() => setSearchQuery(term)}
                        className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-[#F47721] text-xs font-semibold text-slate-700 transition-colors"
                      >
                        {term}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Matched Dishes */}
            {searchMatchedProducts.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-xs text-slate-700">الأكلات والمنتجات المطابقة ({searchMatchedProducts.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {searchMatchedProducts.map((p) => {
                    const store = stores.find((s) => s.id === p.storeId);
                    return (
                      <div
                        key={p.id}
                        className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div>
                            <h4 className="font-bold text-xs text-slate-900">{p.name}</h4>
                            <span className="text-[10px] text-slate-400 block">{store?.name}</span>
                            <span className="text-xs font-bold text-[#F47721] block mt-0.5">
                              {p.price.toLocaleString()} د.ع
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleProductClick(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F47721] text-[#F47721] hover:text-white font-bold text-xs transition-colors"
                        >
                          إضافة
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Matched Restaurants */}
            {filteredStores.length > 0 && searchQuery && (
              <div className="space-y-2 pt-2">
                <h3 className="font-bold text-xs text-slate-700">المتاجر المطابقة ({filteredStores.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredStores.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setActiveStoreId(st.id)}
                      className="bg-white p-2.5 rounded-2xl border border-slate-100 cursor-pointer hover:shadow-md transition-all"
                    >
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2">
                        <img src={st.banner} alt={st.name} className="w-full h-full object-cover" />
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 truncate">{st.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{st.neighborhood}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'orders' ? (
          /* VIEW D: MY ORDERS TAB */
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="font-black text-sm text-[#172554]">طلباتي</h2>
              <p className="text-[11px] text-slate-400">تتبع الطلبات الحالية وسجل الطلبات السابقة</p>
            </div>

            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>طلبات جارية التوصيل ({activeOrders.length})</span>
                </h3>

                {activeOrders.map((ord) => {
                  const store = stores.find((s) => s.id === ord.storeId);
                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono">رقم الطلب: #{ord.id.slice(-6)}</span>
                          <h4 className="font-bold text-sm text-slate-900">{store?.name || 'مطعم معتمد'}</h4>
                        </div>
                        <span className="text-xs bg-orange-100 text-[#F47721] px-2.5 py-1 rounded-full font-bold">
                          {ord.status === 'preparing'
                            ? 'جاري التحضير'
                            : ord.status === 'ready_for_pickup'
                            ? 'جاهز للاستلام'
                            : ord.status === 'picked_up'
                            ? 'المندوب في الطريق'
                            : 'تم استلام الطلب'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl space-y-1">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-bold">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="font-black text-sm text-[#172554]">
                          المجموع: {(ord.financials?.total ?? ord.total).toLocaleString()} د.ع
                        </span>

                        <button
                          onClick={() => setActiveTrackedOrderId(ord.id)}
                          className="px-3.5 py-2 bg-[#F47721] hover:bg-[#e06816] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>تتبع على الخريطة</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Past Orders */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-xs text-slate-700">الطلبات المكتملة والسابقة</h3>

              {pastOrders.length > 0 ? (
                pastOrders.map((ord) => {
                  const store = stores.find((s) => s.id === ord.storeId);
                  const isRated = isOrderRated(ord.id);

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-900">{store?.name || 'مطعم معتمد'}</h4>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              ord.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {ord.status === 'delivered' ? 'مكتمل بنجاح' : 'ملغي'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(ord.createdAt).toLocaleDateString('ar-IQ')} • {ord.items.length} أصناف
                        </span>
                        <span className="font-extrabold text-xs text-slate-800 block mt-1">
                          {(ord.financials?.total ?? ord.total).toLocaleString()} د.ع
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end">
                        {ord.status === 'delivered' && !isRated && (
                          <button
                            onClick={() => setOrderForRatingModal(ord)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Star className="w-3 h-3 fill-white" />
                            <span>تقييم الطلب</span>
                          </button>
                        )}
                        {ord.status === 'delivered' && isRated && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم التقييم</span>
                          </span>
                        )}
                        <button
                          onClick={() => setActiveTrackedOrderId(ord.id)}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                        >
                          تفاصيل الفاتورة
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400">لا توجد طلبات سابقة حتى الآن.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW E: ACCOUNT TAB */
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="font-black text-sm text-[#172554]">حسابي</h2>
              <p className="text-[11px] text-slate-400">إدارة الملف الشخصي والعناوين والتحقق</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#172554] to-[#F47721] text-white flex items-center justify-center font-black text-lg shadow-sm">
                  {currentUser.name ? currentUser.name.charAt(0) : 'ز'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{customerName}</h3>
                  <p className="text-xs text-slate-500 font-mono" dir="ltr">
                    {customerPhone}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>رقم عراقي موثق (+964)</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsPhoneAuthOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
              >
                تعديل الرقم
              </button>
            </div>

            {/* Merchant Onboarding Card */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-2xl border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <StoreIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#172554]">هل تملك مطعماً أو ماركت في العراق؟</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">سجل متجرك الآن للانضمام لمنصة TALABI والوصول لآلاف الزبائن</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setIsRegisterRestaurantOpen(true)}
                  className="px-3.5 py-2 bg-[#F47721] hover:bg-[#e06816] text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  انضم كمطعم
                </button>
                <button
                  onClick={() => setRole('merchant')}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all whitespace-nowrap"
                >
                  لوحة المطعم
                </button>
              </div>
            </div>

            {/* Courier Onboarding Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#172554] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#172554]">هل ترغب بالعمل ككابتن توصيل حر؟</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">حقق دخلاً يومياً مجزياً مع أجور توصيل عادلة وحوافز إضافية</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setIsRegisterCourierOpen(true)}
                  className="px-3.5 py-2 bg-[#172554] hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  انضم ككابتن
                </button>
                <button
                  onClick={() => setRole('courier')}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all whitespace-nowrap"
                >
                  لوحة الكابتن
                </button>
              </div>
            </div>

            {/* Help & Support */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
              <button
                onClick={() => setIsSupportChatOpen(true)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#F47721]" />
                  <span>خدمة العملاء والشكاوى المباشرة</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <div className="p-3.5 text-xs text-slate-500 flex justify-between items-center">
                <span>إصدار التطبيق</span>
                <span className="font-mono text-slate-400">v2.4.0 (Iraqi Edition)</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. FLOATING CART DRAWER / BAR (when cart has items) */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 p-3 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#172554] hover:bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-orange-500/40 flex items-center justify-between transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F47721] text-white flex items-center justify-center font-bold text-xs">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-300 block">عرض سلة المشتريات</span>
                  <span className="font-extrabold text-xs text-white">
                    {cartTotal.toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 font-bold text-xs text-[#F47721]">
                <span>المتابعة</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 6. BOTTOM NAVIGATION BAR (Home, Search, Orders, Account) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
          <button
            onClick={() => {
              setActiveTab('home');
              setActiveStoreId(null);
            }}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'home' && !activeStoreId
                ? 'text-[#F47721] font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">الرئيسية</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('search');
              setActiveStoreId(null);
            }}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'search'
                ? 'text-[#F47721] font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px]">البحث</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('orders');
              setActiveStoreId(null);
            }}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all relative ${
              activeTab === 'orders'
                ? 'text-[#F47721] font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">طلباتي</span>
            {activeOrders.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#F47721] absolute top-1 right-3" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('account');
              setActiveStoreId(null);
            }}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'account'
                ? 'text-[#F47721] font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px]">حسابي</span>
          </button>
        </div>
      </nav>

      {/* 7. CART SLIDE-OVER MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#F47721]" />
                <h3 className="font-black text-sm text-[#172554]">سلة المشتريات</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {cart.reduce((a, b) => a + b.quantity, 0)} أصناف
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
              {cart.map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                    {/* Render Selected Option Groups */}
                    {item.selectedOptionGroups && item.selectedOptionGroups.length > 0 ? (
                      <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                        {item.selectedOptionGroups.map((g, gi) => (
                          <div key={gi} className="flex items-center gap-1">
                            <span className="text-slate-400">{g.groupTitle}:</span>
                            <span className="font-medium text-slate-700">
                              {g.selectedItems.map((si) => si.name).join('، ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : item.selectedOptions && item.selectedOptions.length > 0 ? (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.selectedOptions.map((o) => o.name).join('، ')}
                      </p>
                    ) : null}

                    {item.notes && (
                      <p className="text-[10px] text-orange-600 mt-0.5 font-medium">ملاحظة: {item.notes}</p>
                    )}
                    <span className="text-xs font-extrabold text-slate-800 block mt-1">
                      {(item.price * item.quantity).toLocaleString()} د.ع
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-xl">
                    <button
                      onClick={() => updateCartQuantity(idx, item.quantity - 1)}
                      className="text-slate-600 hover:text-rose-600 p-0.5"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-xs font-black min-w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(idx, item.quantity + 1)}
                      className="text-slate-600 hover:text-orange-600 p-0.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary & Checkout Button */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-bold">{cartSubtotal.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>أجرة التوصيل:</span>
                <span className="font-bold">{cartDeliveryFee.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>رسوم تشغيل النظام:</span>
                <span className="font-bold">1,000 د.ع</span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#172554] pt-2 border-t border-slate-200">
                <span>المجموع الإجمالي:</span>
                <span className="text-[#F47721]">{cartTotal.toLocaleString()} د.ع</span>
              </div>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full mt-3 py-3 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <span>المتابعة إلى العنوان وتحديد الدفع</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-y-auto my-auto text-slate-800">
            <div className="sticky top-0 bg-white/95 backdrop-blur-md p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-base text-[#172554]">إتمام الطلب وتحديد الدفع</h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-700 rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Delivery Details & Address Section */}
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h4 className="font-black text-sm text-[#172554] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#F47721]" />
                    <span>عنوان التوصيل</span>
                  </h4>
                  {isAddressConfirmed ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      تم تأكيد العنوان
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      يرجى مراجعة وتأكيد الموقع
                    </span>
                  )}
                </div>

                {/* Current Address Summary Card */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">المنطقة والمستلم:</span>
                      <p className="font-extrabold text-xs text-slate-900 mt-0.5">
                        {customerName} • {selectedNeighborhood}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block font-medium">رقم الهاتف (قابل للتعديل):</span>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-32 p-1 text-xs rounded-lg border border-slate-200 font-mono font-bold text-slate-800 bg-slate-50 text-center"
                        placeholder="077xxxxxxxx"
                      />
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">العنوان التفصيلي / نقطة دالة:</span>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="اسم الشارع، رقم العمارة أو البيت، قرب معلم معروف..."
                      className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>

                {/* Map Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(!isMapOpen)}
                    className="py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#F47721]" />
                    <span>{isMapOpen ? 'إخفاء الخريطة' : 'تحديد موقعي على الخريطة'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMapOpen(true);
                      setCheckoutError(null);
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const c = {
                              lat: pos.coords.latitude,
                              lng: pos.coords.longitude,
                              accuracy: Math.round(pos.coords.accuracy),
                              isManualPin: false,
                              verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
                            };
                            setCustomerCoords(c);
                          },
                          (err) => {
                            let msg = 'تعذر الوصول إلى GPS. يرجى تحديد الموقع يدوياً بالضغط على الخريطة.';
                            if (err.code === 1) msg = 'تم رفض إذن الوصول للموقع. يرجى السماح للمتصفح بالوصول لموقعك أو التحديد يدوياً.';
                            setCheckoutError(msg);
                          },
                          { enableHighAccuracy: true, timeout: 8000 }
                        );
                      } else {
                        setCheckoutError('متصفحك لا يدعم تحديد الموقع الجغرافي.');
                      }
                    }}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>استخدم موقعي الحالي</span>
                  </button>
                </div>

                {/* Interactive Map Picker (OpenStreetMap / Leaflet wrapper) */}
                {isMapOpen && (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>انقر على الخريطة لتثبيت دبوس موقعك بدقة:</span>
                      <span className="text-orange-600 font-bold">خريطة OpenStreetMap التفاعلية</span>
                    </div>
                    <RealInteractiveMap
                      storeName={currentSelectedStore?.name || stores[0].name}
                      storeAddress={currentSelectedStore?.address || stores[0].address}
                      customerAddress={`${selectedNeighborhood} - ${customerAddress}`}
                      customerCoordinates={customerCoords}
                      onCoordinatesChange={(c) => setCustomerCoords(c)}
                      isInteractivePicker={true}
                    />
                  </div>
                )}

                {/* Confirm Address Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddressConfirmed(true);
                    setIsMapOpen(false);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد العنوان</span>
                </button>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1 mt-1">ملاحظات إضافية للمندوب</label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="رن الجرس، عدم الاتصال إلا عند الباب..."
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  />
                </div>
              </div>

              {/* Payment Method - Cash on Delivery Only */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    طريقة الدفع المعتمدة
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                    الدفع النقدي فقط
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border-2 border-orange-500 bg-orange-50/80 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-900">نقد عند الاستلام (Cash on Delivery - COD)</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">الدفع نقداً بالدينار العراقي للكابتن عند استلام الطلب باب البيت</p>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </span>
                </div>
              </div>

              {/* Total Display */}
              <div className="bg-slate-100 p-3.5 rounded-2xl flex items-center justify-between font-bold">
                <span className="text-slate-700">المبلغ الإجمالي المستحق:</span>
                <span className="text-base font-black text-[#F47721]">{cartTotal.toLocaleString()} د.ع</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                تعديل السلة
              </button>

              <button
                disabled={isSubmittingOrder}
                onClick={handleProceedToReview}
                className="flex-1 py-3 bg-[#F47721] hover:bg-[#e06816] text-white rounded-xl font-black text-xs shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>المتابعة لمراجعة الطلب النهائية ({cartTotal.toLocaleString()} د.ع)</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. FOOD CUSTOMIZATION MODAL (Sizes, Add-ons, Dynamic Price) */}
      {customizingProduct && (
        <FoodCustomizationModal
          product={customizingProduct}
          isOpen={Boolean(customizingProduct)}
          onClose={() => setCustomizingProduct(null)}
          onAddToCart={handleAddCustomizedToCart}
        />
      )}

      {/* 10. FINAL ORDER REVIEW MODAL (Anti-fraud & Anti-duplicate check) */}
      {isFinalReviewOpen && (
        <FinalOrderReviewModal
          isOpen={isFinalReviewOpen}
          onClose={() => setIsFinalReviewOpen(false)}
          store={currentSelectedStore || stores[0]}
          items={cart}
          customerName={customerName}
          customerPhone={customerPhone}
          address={customerAddress}
          neighborhood={selectedNeighborhood}
          notes={deliveryNotes}
          paymentMethod={paymentMethod}
          subtotal={cartSubtotal}
          deliveryFee={cartDeliveryFee}
          serviceFee={1000}
          total={cartTotal}
          coordinates={customerCoords}
          onConfirmOrder={handleConfirmFinalOrder}
          isSubmitting={isSubmittingOrder}
        />
      )}

      {/* 11. PHONE AUTH MODAL */}
      <PhoneAuthModal
        isOpen={isPhoneAuthOpen}
        onClose={() => setIsPhoneAuthOpen(false)}
        onVerifiedSuccess={(phone) => {
          setCustomerPhone(phone);
        }}
        title="توثيق الحساب بالرقم العراقي (+964)"
        subtitle="حماية حسابك وتفادي الطلبات الوهمية برمز OTP عبر رسالة نصية قصيرة"
      />

      {/* 12. IN-APP SUPPORT CHAT MODAL */}
      <InAppSupportChatModal
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
        relatedOrderId={activeOrders[0]?.id}
      />

      {/* 13. ACTIVE ORDER TRACKER MODAL */}
      {activeTrackedOrderId && (
        <OrderTrackerModal
          orderId={activeTrackedOrderId}
          onClose={() => setActiveTrackedOrderId(null)}
        />
      )}

      {/* 14. STORE REVIEWS MODAL */}
      {selectedStoreForReviews && (
        <StoreReviewsModal
          store={selectedStoreForReviews}
          isOpen={Boolean(selectedStoreForReviews)}
          onClose={() => setSelectedStoreForReviews(null)}
        />
      )}

      {/* 15. ORDER RATING MODAL */}
      {orderForRatingModal && (
        <OrderRatingModal
          order={orderForRatingModal}
          isOpen={Boolean(orderForRatingModal)}
          onClose={() => setOrderForRatingModal(null)}
        />
      )}

      {/* 16. RESTAURANT REGISTRATION MODAL */}
      <RegisterRestaurantModal
        isOpen={isRegisterRestaurantOpen}
        onClose={() => setIsRegisterRestaurantOpen(false)}
      />

      {/* 17. COURIER REGISTRATION MODAL */}
      <RegisterCourierModal
        isOpen={isRegisterCourierOpen}
        onClose={() => setIsRegisterCourierOpen(false)}
      />
    </div>
  );
};
