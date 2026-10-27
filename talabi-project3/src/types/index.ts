// Types for Talabi Platform (طلبي)

export type UserRole = 'customer' | 'merchant' | 'courier' | 'admin' | 'support';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatar?: string;
  address?: string;
  city: string;
}

export type StoreCategory = 
  | 'مشاوي ومأكولات عراقية' 
  | 'برغر ووجبات سريعة' 
  | 'بيتزا ومعجنات' 
  | 'حلويات ومقاهي' 
  | 'ماركت وبقالة' 
  | 'خضار وفواكه' 
  | 'قصابة ولحوم طازجة';

export interface ProductOption {
  id: string;
  name: string;
  price: number; // in IQD (د.ع)
}

export interface ProductOptionItem {
  id: string;
  name: string;
  price: number; // in IQD (0 for free)
  isDefault?: boolean;
}

export interface ProductOptionGroup {
  id: string;
  title: string; // e.g. "حجم الوجبة", "إضافات الجبن والصوص", "المشروب المفضل"
  isRequired: boolean; // إلزامي أو اختياري
  minSelect?: number; // 0 or 1
  maxSelect?: number; // 1 for single-choice (radio), >1 for multiple choices
  options: ProductOptionItem[];
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number; // in IQD (د.ع)
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  options?: ProductOption[];
  optionGroups?: ProductOptionGroup[];
}

export interface Store {
  id: string;
  name: string;
  description?: string;
  category: StoreCategory;
  logo: string;
  banner?: string;
  coverImage?: string;
  rating: number;
  ratingCount: number;
  deliveryTimeEstimate?: string; // e.g. "25 - 35 دقيقة"
  deliveryTime?: string;
  deliveryFee: number; // in IQD
  minimumOrder?: number; // in IQD
  minOrder?: number;
  isOpen: boolean;
  address: string;
  neighborhood?: string; // e.g. "المنصور", "الكرادة"
  city?: string;
  phone?: string;
  openingHours?: string; // e.g. "11:00 ص - 12:00 م"
  merchantUserId?: string;
  commissionRate?: number;
  coordinates?: LocationCoordinates;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
}

export type OrderStatus =
  | 'created'              // تم استلام الطلب
  | 'merchant_accepted'    // وافق المطعم
  | 'preparing'            // جاري التحضير
  | 'ready_for_pickup'     // جاهز للاستلام
  | 'courier_assigned'     // تم تعيين المندوب
  | 'picked_up'            // تم الاستلام وفي الطريق
  | 'courier_arrived'      // وصل المندوب إلى عنوان الزبون (بالباب)
  | 'delivered'            // تم التوصيل بنجاح
  | 'cancelled';           // ملغي

export interface OrderItem {
  productId: string;
  name: string;
  basePrice?: number;
  price: number;
  quantity: number;
  selectedOptions?: ProductOption[];
  selectedOptionGroups?: {
    groupTitle: string;
    selectedItems: { name: string; price: number }[];
  }[];
  notes?: string;
}

export type PaymentMethod = 
  | 'cash_on_delivery' // نقد عند الاستلام (COD)
  | 'zain_cash'        // زين كاش (Zain Cash)
  | 'qi_card'          // بطاقة كي كارد / ماستركارد (Qi Card)
  | 'asia_pay';        // آسيا حوالة / FastPay

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PaymentDetails {
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;
  amount: number;
  paidAt?: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  note: string;
  actorRole: UserRole;
  actorName: string;
}

export interface OrderFinancials {
  subtotal: number;
  customerDeliveryFee: number;
  deliveryFee?: number;
  deliveryDistanceKm?: number; // المسافة الفعلية المعتمدة بالكيلومتر
  isDistanceBasedFee?: boolean; // هل تم اعتماد الحساب بنظام المسافة
  distanceBaseFeeApplied?: number;
  distanceFeePerKmApplied?: number;
  distanceMaxFeeApplied?: number;
  serviceFee: number;
  total: number;
  platformCommissionPercent: number;
  platformCommissionRate?: number;
  platformCommissionAmount: number; // subtotal * percent / 100
  storeNetPayout: number; // subtotal - commissionAmount
  courierBasePayout: number;
  courierPayout?: number;
  courierBonus: number;
  courierTotalEarnings: number; // courierBasePayout + courierBonus
}

export interface AreaFeeConfig {
  id: string;
  name: string;
  deliveryFee: number; // in IQD
  courierPayout: number; // in IQD
  isActive?: boolean; // تفعيل أو تعطيل المنطقة
}

export interface StoreCommissionOverride {
  storeId: string;
  storeName: string;
  commissionPercent: number; // e.g. 8%
}

export interface PlatformPricingSettings {
  id: string;
  // إعدادات نظام أجور التوصيل حسب المسافة
  distanceBaseFee: number; // أجرة البداية (افتراضياً 1500 د.ع)
  distanceFeePerKm: number; // أجرة كل كيلومتر (افتراضياً 250 د.ع)
  distanceMaxFee: number; // الحد الأعلى لأجرة التوصيل (افتراضياً 5000 د.ع)
  isDistancePricingEnabled?: boolean; // تفعيل الحساب التلقائي حسب المسافة

  defaultDeliveryFee: number;
  defaultCourierBasePayout: number;
  defaultCourierBonus: number;
  isCourierBonusActive?: boolean; // تفعيل أو تعطيل حافز الكابتن
  defaultPlatformCommissionPercent: number;
  defaultMerchantCommissionRate?: number;
  areaDeliveryFees: AreaFeeConfig[];
  storeCommissionOverrides: StoreCommissionOverride[];
  updatedAt: string;
  updatedBy: string;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy?: number; // in meters
  isManualPin?: boolean;
  landmark?: string;
  mockSuspected?: boolean;
  verifiedAt?: string;
}

export interface Order {
  id: string;
  idempotencyKey: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    phoneVerified?: boolean;
    address: string;
    neighborhood: string;
    notes?: string;
    coordinates?: LocationCoordinates;
  };
  storeId: string;
  storeName: string;
  storeAddress: string;
  merchantUserId?: string;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  courierLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    updatedAt: string;
    isSharingEnabled: boolean;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  deliveryDistanceKm?: number; // المسافة الفعلية بالكيلومتر المعتمدة للطلب
  serviceFee: number;
  total: number;
  financials?: OrderFinancials;
  status: OrderStatus;
  payment: PaymentDetails;
  events: OrderEvent[];
  createdAt: string;
  courierArrivedAt?: string;
  estimatedDeliveryTime?: string;
  cancellationReason?: string;
  verifiedOtpCode?: string;
  isRated?: boolean;
  ratingId?: string;
}

export interface Courier {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  avatar?: string;
  vehicleType: string;
  vehiclePlate: string;
  isOnline: boolean;
  isBusy?: boolean;
  currentOrderId?: string;
  rating: number;
  ratingCount?: number;
  totalDeliveries?: number;
  completedOrdersCount?: number;
  totalEarnings?: number;
  walletBalance: number; // in IQD
  currentLocationName?: string;
  currentLocation?: string;
  coordinates?: LocationCoordinates;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface RestaurantApplication {
  id: string;
  userId?: string;
  applicantUserId?: string;
  userEmail?: string;
  storeName: string;
  ownerName: string;
  phone?: string;
  ownerPhone?: string;
  address: string;
  neighborhood?: string;
  city?: string;
  category?: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
  banner?: string;
  minOrder?: number;
  coordinates?: LocationCoordinates;
  contactInfo?: string;
  openingHours?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  storeId?: string; // Set when approved
  documents?: {
    commercialLicenseUrl?: string;
    taxNumber?: string;
  };
}

export interface CourierApplication {
  id: string;
  userId?: string;
  applicantUserId?: string;
  userEmail?: string;
  fullName: string;
  phone: string;
  city?: string;
  address: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleModel?: string;
  coordinates?: LocationCoordinates;
  nationalIdUrl?: string; // Document photo/file
  drivingLicenseUrl?: string; // Document photo/file
  vehicleRegistrationUrl?: string; // Document photo/file
  profilePhotoUrl?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  courierId?: string; // Set when approved
  documents?: {
    driverLicenseUrl?: string;
    drivingLicenseUrl?: string;
    nationalIdUrl?: string;
    vehicleRegistrationUrl?: string;
    profilePhotoUrl?: string;
  };
}

export interface OrderRating {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  storeId: string;
  storeName: string;
  storeRating: number; // 1 to 5
  storeComment?: string;
  storeTags?: string[];
  courierId?: string;
  courierName?: string;
  courierRating?: number; // 1 to 5
  courierComment?: string;
  courierTags?: string[];
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  isAgent: boolean;
}

export interface SupportConversation {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userPhone: string;
  relatedOrderId?: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  lastMessage: string;
  lastUpdated: string;
  messages: SupportMessage[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: 'order' | 'store' | 'user' | 'payment' | 'courier' | 'support' | 'system';
  entityId: string;
  performedBy: string;
  details: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
  orderId?: string;
  read: boolean;
}
