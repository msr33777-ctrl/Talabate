import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  User,
  Store,
  Product,
  Order,
  OrderStatus,
  Courier,
  SupportConversation,
  SupportMessage,
  AuditLog,
  AppNotification,
  OrderItem,
  PaymentMethod,
  ProductOption,
  PlatformPricingSettings,
  OrderFinancials,
  AreaFeeConfig,
  LocationCoordinates,
  OrderRating,
  RestaurantApplication,
  CourierApplication,
} from '../types';
import { computeDistanceDeliveryFee } from '../utils/distancePricing';
import {
  INITIAL_USERS,
  INITIAL_STORES,
  INITIAL_PRODUCTS,
  INITIAL_COURIERS,
  INITIAL_ORDERS,
  INITIAL_CONVERSATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_PRICING_SETTINGS,
  INITIAL_RATINGS,
  INITIAL_RESTAURANT_APPLICATIONS,
  INITIAL_COURIER_APPLICATIONS,
} from '../data/initialData';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

interface CartItem extends OrderItem {}

interface AppContextType {
  // Authentication & Firebase
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  firestoreConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // Current session & view
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentUser: User;
  switchUser: (userId: string) => void;
  users: User[];
  isMobileFrame: boolean;
  setIsMobileFrame: (val: boolean) => void;

  // Stores & Products
  stores: Store[];
  products: Product[];
  toggleStoreOpen: (storeId: string) => void;
  toggleProductAvailability: (productId: string) => void;
  updateProductPrice: (productId: string, newPrice: number) => void;
  addProduct: (product: Omit<Product, 'id'>) => Promise<{ success: boolean; productId?: string }>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<{ success: boolean; error?: string }>;
  deleteProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;
  updateStore: (storeId: string, updates: Partial<Store>) => Promise<{ success: boolean; error?: string }>;
  uploadImageFile: (file: File) => Promise<string>;

  // Cart
  cart: CartItem[];
  cartStoreId: string | null;
  addToCart: (
    product: Product,
    selectedOptions?: ProductOption[],
    notes?: string,
    selectedOptionGroups?: {
      groupTitle: string;
      selectedItems: { name: string; price: number }[];
    }[]
  ) => void;
  removeFromCart: (index: number) => void;
  updateCartQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartDeliveryFee: number;
  cartTotal: number;

  // Orders
  orders: Order[];
  activeTrackedOrderId: string | null;
  setActiveTrackedOrderId: (id: string | null) => void;
  createOrder: (orderData: {
    storeId: string;
    items: OrderItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    neighborhood: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    coordinates?: LocationCoordinates;
    idempotencyKey?: string;
    phoneVerified?: boolean;
    deliveryDistanceKm?: number;
    customDeliveryFee?: number;
  }) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  assignCourierToOrder: (orderId: string, courierId: string) => void;

  // Pricing & Commissions
  pricingSettings: PlatformPricingSettings;
  calculateOrderFinancials: (
    subtotal: number,
    storeId: string,
    neighborhood: string,
    distanceKm?: number
  ) => OrderFinancials;
  updatePricingSettings: (
    newSettings: Partial<PlatformPricingSettings>
  ) => Promise<{ success: boolean; error?: string }>;

  // Couriers
  couriers: Courier[];
  toggleCourierStatus: (courierId: string) => void;
  courierAcceptOrder: (courierId: string, orderId: string) => void;
  courierDeliverOrder: (courierId: string, orderId: string) => void;
  updateCourierLocation: (orderId: string, coords: LocationCoordinates) => Promise<void>;

  // Support
  conversations: SupportConversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  sendSupportMessage: (conversationId: string, text: string) => void;
  startSupportConversation: (subject: string, relatedOrderId?: string) => string;
  updateConversationStatus: (conversationId: string, status: 'open' | 'pending' | 'resolved') => void;

  // Audit Logs & Notifications
  auditLogs: AuditLog[];
  addAuditLog: (action: string, entityType: AuditLog['entityType'], entityId: string, details: string, severity?: AuditLog['severity']) => void;
  notifications: AppNotification[];
  dismissNotification: (id: string) => void;
  addNotification: (title: string, message: string, type?: AppNotification['type'], orderId?: string) => void;

  // Ratings & Customer Reviews System
  ratings: OrderRating[];
  submitOrderRating: (ratingData: Omit<OrderRating, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  isOrderRated: (orderId: string) => boolean;
  getStoreRatings: (storeId: string) => OrderRating[];
  getCourierRatings: (courierId: string) => OrderRating[];

  // Restaurant & Courier Onboarding Applications
  restaurantApplications: RestaurantApplication[];
  courierApplications: CourierApplication[];
  submitRestaurantApplication: (
    data: Omit<RestaurantApplication, 'id' | 'status' | 'createdAt'>
  ) => Promise<{ success: boolean; id?: string; error?: string }>;
  submitCourierApplication: (
    data: Omit<CourierApplication, 'id' | 'status' | 'createdAt'>
  ) => Promise<{ success: boolean; id?: string; error?: string }>;
  reviewRestaurantApplication: (
    appId: string,
    action: 'approve' | 'reject' | 'suspend',
    adminNotes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  reviewCourierApplication: (
    appId: string,
    action: 'approve' | 'reject' | 'suspend',
    adminNotes?: string
  ) => Promise<{ success: boolean; error?: string }>;

  // System & Edge-case Simulators
  isSimulatedOffline: boolean;
  setIsSimulatedOffline: (val: boolean) => void;
  forcePaymentFail: boolean;
  setForcePaymentFail: (val: boolean) => void;
  forceNoCourier: boolean;
  setForceNoCourier: (val: boolean) => void;

  // Data Management
  resetToInitialData: () => void;
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'talabi_state_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadSavedData = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return null;
  };

  const saved = loadSavedData();

  // Firebase auth state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(false);

  // App UI state
  const [role, setRoleState] = useState<UserRole>('customer');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>('user_cust_1');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);

  // Core Data
  const [stores, setStores] = useState<Store[]>(saved?.stores || INITIAL_STORES);
  const [products, setProducts] = useState<Product[]>(saved?.products || INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(saved?.orders || INITIAL_ORDERS);
  const [couriers, setCouriers] = useState<Courier[]>(saved?.couriers || INITIAL_COURIERS);
  const [conversations, setConversations] = useState<SupportConversation[]>(saved?.conversations || INITIAL_CONVERSATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(saved?.auditLogs || INITIAL_AUDIT_LOGS);
  const [pricingSettings, setPricingSettings] = useState<PlatformPricingSettings>(
    saved?.pricingSettings || INITIAL_PRICING_SETTINGS
  );
  const [ratings, setRatings] = useState<OrderRating[]>(saved?.ratings || INITIAL_RATINGS);
  const [restaurantApplications, setRestaurantApplications] = useState<RestaurantApplication[]>(
    saved?.restaurantApplications || INITIAL_RESTAURANT_APPLICATIONS
  );
  const [courierApplications, setCourierApplications] = useState<CourierApplication[]>(
    saved?.courierApplications || INITIAL_COURIER_APPLICATIONS
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartStoreId, setCartStoreId] = useState<string | null>(null);
  const [activeTrackedOrderId, setActiveTrackedOrderId] = useState<string | null>(saved?.orders?.[0]?.id || INITIAL_ORDERS[0]?.id || null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(INITIAL_CONVERSATIONS[0]?.id || null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Simulator flags
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [forcePaymentFail, setForcePaymentFail] = useState<boolean>(false);
  const [forceNoCourier, setForceNoCourier] = useState<boolean>(false);

  // 1. Monitor Firebase Auth
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          setFirebaseUser(user);
          setIsAuthReady(true);
          if (user) {
            const userEmail = user.email || '';
            const isAdminUser = userEmail === 'msr33777@gmail.com';
            const authenticatedUser: User = {
              id: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'مستخدم مسجل',
              email: user.email || '',
              phone: user.phoneNumber || '07701234567',
              role: isAdminUser ? 'admin' : 'customer',
              avatar: user.photoURL || undefined,
              city: 'بغداد',
              address: 'العراق',
            };

            setUsers((prev) => {
              const exists = prev.find((u) => u.id === user.uid);
              if (exists) return prev.map((u) => (u.id === user.uid ? authenticatedUser : u));
              return [authenticatedUser, ...prev];
            });

            setCurrentUserId(user.uid);
            if (isAdminUser) setRoleState('admin');
          }
        },
        (error) => {
          console.warn('Firebase Auth token service warning or disabled:', error.message);
          setIsAuthReady(true);
          setIsSimulatedOffline(true);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firebase Auth initialization caught error:', err);
      setIsAuthReady(true);
    }
  }, []);

  // 2. Test Firestore connection & initialize real-time listeners
  useEffect(() => {
    let isMounted = true;
    testConnection().then((connected) => {
      if (isMounted) setFirestoreConnected(connected);
    });

    try {
      // Setup Firestore listeners for orders
      const ordersCol = collection(db, 'orders');
      const unsubOrders = onSnapshot(
        ordersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteOrders = snapshot.docs.map((d) => d.data() as Order);
            remoteOrders.sort((a, b) => b.id.localeCompare(a.id));
            setOrders(remoteOrders);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'orders');
        }
      );

      // Support conversations listener
      const convCol = collection(db, 'support_conversations');
      const unsubConv = onSnapshot(
        convCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteConv = snapshot.docs.map((d) => d.data() as SupportConversation);
            remoteConv.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
            setConversations(remoteConv);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'support_conversations');
        }
      );

      // Pricing & Commission settings listener
      const pricingDocRef = doc(db, 'platform_settings', 'delivery_and_commissions');
      const unsubPricing = onSnapshot(
        pricingDocRef,
        (snap) => {
          if (snap.exists()) {
            const remoteData = snap.data() as Partial<PlatformPricingSettings>;
            setPricingSettings({
              ...INITIAL_PRICING_SETTINGS,
              ...remoteData,
              distanceBaseFee: remoteData.distanceBaseFee ?? 1500,
              distanceFeePerKm: remoteData.distanceFeePerKm ?? 250,
              distanceMaxFee: remoteData.distanceMaxFee ?? 5000,
              isDistancePricingEnabled: remoteData.isDistancePricingEnabled ?? true,
            } as PlatformPricingSettings);
          } else {
            // Seed initial pricing settings to Firestore
            setDoc(pricingDocRef, INITIAL_PRICING_SETTINGS).catch(() => {});
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'platform_settings/delivery_and_commissions');
        }
      );

      // Ratings & Reviews listener
      const ratingsCol = collection(db, 'ratings');
      const unsubRatings = onSnapshot(
        ratingsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteRatings = snapshot.docs.map((d) => d.data() as OrderRating);
            remoteRatings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setRatings(remoteRatings);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'ratings');
        }
      );

      // Stores listener
      const storesCol = collection(db, 'stores');
      const unsubStores = onSnapshot(
        storesCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteStores = snapshot.docs.map((d) => d.data() as Store);
            setStores(remoteStores);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'stores');
        }
      );

      // Products listener
      const productsCol = collection(db, 'products');
      const unsubProducts = onSnapshot(
        productsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteProducts = snapshot.docs.map((d) => d.data() as Product);
            setProducts(remoteProducts);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'products');
        }
      );

      // Couriers listener
      const couriersCol = collection(db, 'couriers');
      const unsubCouriers = onSnapshot(
        couriersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteCouriers = snapshot.docs.map((d) => d.data() as Courier);
            setCouriers(remoteCouriers);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'couriers');
        }
      );

      // Restaurant Applications listener
      const restAppsCol = collection(db, 'restaurant_applications');
      const unsubRestApps = onSnapshot(
        restAppsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteApps = snapshot.docs.map((d) => d.data() as RestaurantApplication);
            remoteApps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setRestaurantApplications(remoteApps);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'restaurant_applications');
        }
      );

      // Courier Applications listener
      const courAppsCol = collection(db, 'courier_applications');
      const unsubCourApps = onSnapshot(
        courAppsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteApps = snapshot.docs.map((d) => d.data() as CourierApplication);
            remoteApps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setCourierApplications(remoteApps);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'courier_applications');
        }
      );

      return () => {
        isMounted = false;
        unsubOrders();
        unsubConv();
        unsubPricing();
        unsubRatings();
        unsubStores();
        unsubProducts();
        unsubCouriers();
        unsubRestApps();
        unsubCourApps();
      };
    } catch (e) {
      console.warn('Real-time listeners could not be attached', e);
    }
  }, []);

  // Sync role and active user
  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    const matchedUser = users.find((u) => u.role === newRole);
    if (matchedUser) {
      setCurrentUserId(matchedUser.id);
    }
  };

  const switchUser = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (u) {
      setCurrentUserId(u.id);
      setRoleState(u.role);
    }
  };

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  // Google sign in / out
  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      addNotification('تم تسجيل الدخول بنجاح', `أهلاً بك، ${res.user.displayName || res.user.email}!`, 'success');
    } catch (error) {
      console.error('Sign in error', error);
      addNotification('تعذر تسجيل الدخول', 'حدث خطأ أثناء الاتصال بمزود Google', 'error');
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setRoleState('customer');
      setCurrentUserId(INITIAL_USERS[0].id);
      addNotification('تم تسجيل الخروج', 'أنت تتصفح التطبيق الآن كزائر', 'info');
    } catch (e) {
      console.error(e);
    }
  };

  // Local persistence backup
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stores,
          products,
          orders,
          couriers,
          conversations,
          auditLogs,
          ratings,
          restaurantApplications,
          courierApplications,
        })
      );
    } catch (e) {
      console.warn('Failed to persist to localStorage', e);
    }
  }, [stores, products, orders, couriers, conversations, auditLogs, ratings, restaurantApplications, courierApplications]);

  // Notifications
  const addNotification = (title: string, message: string, type: AppNotification['type'] = 'info', orderId?: string) => {
    const notif: AppNotification = {
      id: 'notif_' + Date.now() + Math.random().toString(36).substring(2, 6),
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      orderId,
      read: false,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 9)]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Audit Logs
  const addAuditLog = (
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    details: string,
    severity: AuditLog['severity'] = 'info'
  ) => {
    const newLog: AuditLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      entityType,
      entityId,
      performedBy: `${currentUser.name} (${currentUser.role})`,
      details,
      severity,
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 99)]);

    // Write to Firestore if connected
    if (!isSimulatedOffline) {
      try {
        setDoc(doc(db, 'audit_logs', newLog.id), newLog).catch(() => {});
      } catch {
        // fail silently
      }
    }
  };

  // Store & Product functions
  const toggleStoreOpen = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          const nextState = !s.isOpen;
          addAuditLog('STORE_STATUS_TOGGLE', 'store', storeId, `تم تغيير حالة المتجر (${s.name}) إلى: ${nextState ? 'مفتوح ومستعد للاستلام' : 'مغلق مؤقتاً'}`);
          addNotification(nextState ? 'المتجر مفتوح' : 'المتجر مغلق', `${s.name} أصبح الآن ${nextState ? 'يستقبل الطلبات' : 'مغلق للطلبات'}`);
          return { ...s, isOpen: nextState };
        }
        return s;
      })
    );
  };

  const toggleProductAvailability = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const nextState = !p.isAvailable;
          addAuditLog('PRODUCT_AVAILABILITY_CHANGE', 'store', p.storeId, `تحديث توفر الصنف (${p.name}) إلى: ${nextState ? 'متوفر' : 'نافد'}`);
          return { ...p, isAvailable: nextState };
        }
        return p;
      })
    );
  };

  const updateProductPrice = (productId: string, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          addAuditLog('PRODUCT_PRICE_UPDATE', 'store', p.storeId, `تعديل سعر (${p.name}) إلى ${newPrice.toLocaleString()} د.ع`);
          return { ...p, price: newPrice };
        }
        return p;
      })
    );
  };

  const addProduct = async (prodData: Omit<Product, 'id'>): Promise<{ success: boolean; productId?: string }> => {
    const newId = 'prod_' + Date.now();
    const newProd: Product = { ...prodData, id: newId };
    setProducts((prev) => [newProd, ...prev]);
    addAuditLog('PRODUCT_CREATED', 'store', prodData.storeId, `إضافة صنف جديد: ${prodData.name} بسعر ${prodData.price.toLocaleString()} د.ع`);
    addNotification('تمت إضافة الصنف', `أصبح ${prodData.name} متاحاً في قائمة المتجر`, 'success');

    if (!isSimulatedOffline) {
      try {
        await setDoc(doc(db, 'products', newId), newProd);
      } catch (e) {
        console.warn('Failed to persist product to Firestore', e);
      }
    }
    return { success: true, productId: newId };
  };

  const updateProduct = async (productId: string, updates: Partial<Product>): Promise<{ success: boolean; error?: string }> => {
    try {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
      );
      addAuditLog('PRODUCT_UPDATED', 'store', updates.storeId || '', `تعديل الصنف ${productId}`);

      if (!isSimulatedOffline) {
        await setDoc(doc(db, 'products', productId), updates, { merge: true });
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error updating product:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const prod = products.find((p) => p.id === productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (prod) {
        addAuditLog('PRODUCT_DELETED', 'store', prod.storeId, `حذف الصنف: ${prod.name}`);
        addNotification('تم حذف الصنف', `تم حذف ${prod.name} من قائمة المتجر`, 'info');
      }

      if (!isSimulatedOffline) {
        await deleteDoc(doc(db, 'products', productId));
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting product:', err);
      return { success: false, error: err.message };
    }
  };

  const updateStore = async (storeId: string, updates: Partial<Store>): Promise<{ success: boolean; error?: string }> => {
    try {
      const existing = stores.find((s) => s.id === storeId);
      if (existing && existing.approvalStatus && existing.approvalStatus !== 'approved' && currentUser.role !== 'admin') {
        const errMsg = 'لا يمكن تعديل بيانات المتجر أو البيانات المالية قبل موافقة واعتماد الإدارة';
        addNotification('الإجراء محظور', errMsg, 'error');
        return { success: false, error: errMsg };
      }

      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, ...updates } : s))
      );
      addAuditLog('STORE_PROFILE_UPDATE', 'store', storeId, `تحديث بيانات المتجر: ${Object.keys(updates).join(', ')}`);
      addNotification('تم تحديث المتجر', 'تم حفظ بيانات المتجر بنجاح', 'success');

      if (!isSimulatedOffline) {
        try {
          await setDoc(doc(db, 'stores', storeId), updates, { merge: true });
        } catch (firestoreErr: any) {
          console.warn('Firestore update store permission/network notice:', firestoreErr?.message);
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error updating store:', err);
      return { success: false, error: err.message };
    }
  };

  const uploadImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Cart operations
  const addToCart = (
    product: Product,
    selectedOptions: ProductOption[] = [],
    notes: string = '',
    selectedOptionGroups?: {
      groupTitle: string;
      selectedItems: { name: string; price: number }[];
    }[]
  ) => {
    if (cartStoreId && cartStoreId !== product.storeId && cart.length > 0) {
      if (!confirm('سلتك تحتوي على منتجات من متجر آخر. هل ترغب في إفراغ السلة وبدء طلب جديد من هذا المتجر؟')) {
        return;
      }
      setCart([]);
    }

    setCartStoreId(product.storeId);

    let extraPrice = 0;
    if (selectedOptions && selectedOptions.length > 0) {
      extraPrice += selectedOptions.reduce((acc, opt) => acc + (opt.price || 0), 0);
    }
    if (selectedOptionGroups && selectedOptionGroups.length > 0) {
      selectedOptionGroups.forEach((grp) => {
        grp.selectedItems.forEach((item) => {
          extraPrice += item.price || 0;
        });
      });
    }

    const itemPrice = product.price + extraPrice;

    setCart((prev) => {
      const optionsKey = JSON.stringify({
        opts: selectedOptions,
        groups: selectedOptionGroups || [],
        notes,
      });

      const existingIdx = prev.findIndex(
        (i) =>
          i.productId === product.id &&
          JSON.stringify({
            opts: i.selectedOptions || [],
            groups: i.selectedOptionGroups || [],
            notes: i.notes || '',
          }) === optionsKey
      );

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }

      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          basePrice: product.price,
          price: itemPrice,
          quantity: 1,
          selectedOptions,
          selectedOptionGroups,
          notes,
        },
      ];
    });

    addNotification('تمت الإضافة للسلة', `${product.name} أضيف إلى سلتك`, 'info');
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      if (copy.length === 0) setCartStoreId(null);
      return copy;
    });
  };

  const updateCartQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    setCart((prev) => {
      const copy = [...prev];
      copy[index].quantity = quantity;
      return copy;
    });
  };

  const clearCart = () => {
    setCart([]);
    setCartStoreId(null);
  };

  // Calculate order financials based on active pricing settings (Distance or Area-based)
  const calculateOrderFinancials = (
    subtotal: number,
    storeId: string,
    neighborhood: string,
    distanceKm?: number
  ): OrderFinancials => {
    let customerDeliveryFee: number;
    let isDistanceBasedFee = false;
    let distanceBaseFeeApplied: number | undefined;
    let distanceFeePerKmApplied: number | undefined;
    let distanceMaxFeeApplied: number | undefined;

    // Check if distance pricing is enabled and valid distance provided
    if (
      pricingSettings.isDistancePricingEnabled !== false &&
      typeof distanceKm === 'number' &&
      distanceKm > 0
    ) {
      isDistanceBasedFee = true;
      customerDeliveryFee = computeDistanceDeliveryFee(distanceKm, pricingSettings);
      distanceBaseFeeApplied = pricingSettings.distanceBaseFee;
      distanceFeePerKmApplied = pricingSettings.distanceFeePerKm;
      distanceMaxFeeApplied = pricingSettings.distanceMaxFee;
    } else {
      const matchedArea = pricingSettings.areaDeliveryFees.find(
        (a) =>
          a.isActive !== false &&
          (a.name.trim() === neighborhood.trim() || neighborhood.includes(a.name) || a.name.includes(neighborhood))
      );
      customerDeliveryFee = matchedArea ? matchedArea.deliveryFee : pricingSettings.defaultDeliveryFee;
    }

    const matchedArea = pricingSettings.areaDeliveryFees.find(
      (a) =>
        a.isActive !== false &&
        (a.name.trim() === neighborhood.trim() || neighborhood.includes(a.name) || a.name.includes(neighborhood))
    );
    const courierBasePayout = matchedArea ? matchedArea.courierPayout : pricingSettings.defaultCourierBasePayout;
    const isBonusActive = pricingSettings.isCourierBonusActive !== false;
    const courierBonus = isBonusActive ? pricingSettings.defaultCourierBonus : 0;
    const courierTotalEarnings = courierBasePayout + courierBonus;

    const storeOverride = pricingSettings.storeCommissionOverrides.find((s) => s.storeId === storeId);
    const platformCommissionPercent = storeOverride
      ? storeOverride.commissionPercent
      : pricingSettings.defaultPlatformCommissionPercent;
    const platformCommissionAmount = Math.round((subtotal * platformCommissionPercent) / 100);
    const storeNetPayout = Math.max(0, subtotal - platformCommissionAmount);

    const serviceFee = 1000;
    const total = subtotal + customerDeliveryFee + serviceFee;

    return {
      subtotal,
      customerDeliveryFee,
      deliveryDistanceKm: typeof distanceKm === 'number' && distanceKm > 0 ? distanceKm : undefined,
      isDistanceBasedFee,
      distanceBaseFeeApplied,
      distanceFeePerKmApplied,
      distanceMaxFeeApplied,
      serviceFee,
      total,
      platformCommissionPercent,
      platformCommissionAmount,
      storeNetPayout,
      courierBasePayout,
      courierBonus,
      courierTotalEarnings,
    };
  };

  const updatePricingSettings = async (
    newSettings: Partial<PlatformPricingSettings>
  ): Promise<{ success: boolean; error?: string }> => {
    const isAdmin =
      currentUser.role === 'admin' ||
      (firebaseUser && (firebaseUser.email === 'msr33777@gmail.com' || (firebaseUser as any).isAdmin));

    if (!isAdmin) {
      addNotification('غير مصرح', 'فقط المدير يملك صلاحية تعديل أجور التوصيل والعمولات', 'error');
      return { success: false, error: 'غير مصرح: هذه العملية تتطلب صلاحيات المدير.' };
    }

    const updated: PlatformPricingSettings = {
      ...pricingSettings,
      ...newSettings,
      updatedAt: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      updatedBy: `${currentUser.name} (المدير)`,
    };

    setPricingSettings(updated);

    addAuditLog(
      'PRICING_SETTINGS_UPDATED',
      'system',
      'delivery_and_commissions',
      `تعديل السياسة المالية: أجرة البداية ${updated.distanceBaseFee} د.ع، كل كم ${updated.distanceFeePerKm} د.ع، الحد الأقصى ${updated.distanceMaxFee} د.ع، عمولة المنصة ${updated.defaultPlatformCommissionPercent}%`
    );

    try {
      await setDoc(doc(db, 'platform_settings', 'delivery_and_commissions'), updated);
      addNotification('تم حفظ الإعدادات', 'تم تحديث أجور التوصيل والعمولات في Firestore وتطبيقها على الطلبات الجديدة', 'success');
      return { success: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platform_settings/delivery_and_commissions');
      return { success: false, error: 'حدث خطأ أثناء حفظ الإعدادات في قاعدة بيانات Firebase' };
    }
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartDeliveryFee = pricingSettings.defaultDeliveryFee;
  const cartTotal = cartSubtotal > 0 ? cartSubtotal + cartDeliveryFee + 1000 : 0;

  // Order creation with IDEMPOTENCY check & Firestore writing
  const createOrder = async (orderData: {
    storeId: string;
    items: OrderItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    neighborhood: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    coordinates?: LocationCoordinates;
    idempotencyKey?: string;
    phoneVerified?: boolean;
    deliveryDistanceKm?: number;
    customDeliveryFee?: number;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> => {
    if (isSimulatedOffline) {
      addNotification('فشل الاتصال بالشبكة', 'تعذر إرسال الطلب: تم تفعيل وضع انقطاع الإنترنت للاختبار', 'error');
      addAuditLog('ORDER_CREATION_FAILED', 'system', 'network_err', 'فشل إنشاء الطلب بسبب انقطاع اتصال الإنترنت المحاكى', 'error');
      return { success: false, error: 'تعذر الاتصال بالخادم. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.' };
    }

    if (!orderData.items || orderData.items.length === 0) {
      return { success: false, error: 'السلة فارغة، يرجى اختيار أصناف أولاً.' };
    }

    const idempotencyKey = orderData.idempotencyKey || `idem_${orderData.storeId}_${currentUser.id}_${Date.now()}`;

    // Anti-duplicate protection: Check if order with this idempotency key already exists
    const existingOrder = orders.find((o) => o.idempotencyKey === idempotencyKey);
    if (existingOrder) {
      console.warn('Duplicate order attempt blocked by idempotency key:', idempotencyKey);
      return { success: true, orderId: existingOrder.id };
    }

    if (forcePaymentFail && orderData.paymentMethod !== 'cash_on_delivery') {
      addNotification('فشلت عملية الدفع', 'تم رفض بطاقة الدفع من مزود الخدمة (محاكاة فشل الدفع). لم يتم خصم أي مبلغ.', 'error');
      addAuditLog('PAYMENT_REJECTED', 'payment', idempotencyKey, `رفض عملية الدفع عبر ${orderData.paymentMethod}`, 'warning');
      return { success: false, error: 'تم رفض عملية الدفع من قبل البنك أو المحفظة الإلكترونية. يرجى تجربة طريقة دفع أخرى.' };
    }

    const store = stores.find((s) => s.id === orderData.storeId);
    if (!store) {
      return { success: false, error: 'المتجر غير موجود' };
    }

    if (!store.isOpen) {
      return { success: false, error: 'المتجر مغلق حالياً ولا يستقبل طلبات جديدة' };
    }

    if (store.approvalStatus && store.approvalStatus !== 'approved') {
      return { success: false, error: 'المتجر غير معتمد حالياً أو بانتظار موافقة الإدارة، لا يمكن إتمام الطلب' };
    }

    // Server-side price recalculation & anti-tampering check:
    // Validate each item price against official product catalog
    const validatedItems = orderData.items.map((item) => {
      const dbProd = products.find((p) => p.id === item.productId);
      const officialPrice = dbProd ? dbProd.price : item.price;
      const optionsTotal = (item.selectedOptions || []).reduce((acc, opt) => acc + opt.price, 0);
      return {
        ...item,
        price: officialPrice + optionsTotal,
      };
    });

    const subtotal = validatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);

    const orderId = 'ord_' + Math.floor(100000 + Math.random() * 900000);

    // Snapshot immutable financials at order creation time
    const financials = calculateOrderFinancials(
      subtotal,
      store.id,
      orderData.neighborhood,
      orderData.deliveryDistanceKm
    );
    const deliveryFee = orderData.customDeliveryFee ?? financials.customerDeliveryFee;
    financials.customerDeliveryFee = deliveryFee;
    const serviceFee = financials.serviceFee;
    const total = subtotal + deliveryFee + serviceFee;
    financials.total = total;

    const newOrder: Order = {
      id: orderId,
      idempotencyKey,
      customer: {
        id: currentUser.id,
        name: orderData.customerName,
        phone: orderData.customerPhone,
        phoneVerified: orderData.phoneVerified ?? (orderData.paymentMethod !== 'cash_on_delivery'),
        address: orderData.address,
        neighborhood: orderData.neighborhood,
        notes: orderData.notes,
        coordinates: orderData.coordinates,
      },
      storeId: store.id,
      storeName: store.name,
      storeAddress: store.address,
      merchantUserId: store.merchantUserId,
      items: validatedItems,
      subtotal,
      deliveryFee,
      deliveryDistanceKm: orderData.deliveryDistanceKm,
      serviceFee,
      total,
      financials,
      status: 'created',
      payment: {
        method: orderData.paymentMethod,
        status: orderData.paymentMethod === 'cash_on_delivery' ? 'pending' : 'completed',
        transactionRef: orderData.paymentMethod === 'cash_on_delivery' ? undefined : `TX-${Date.now()}`,
        amount: total,
        paidAt: orderData.paymentMethod === 'cash_on_delivery' ? undefined : new Date().toLocaleTimeString('ar-IQ'),
      },
      events: [
        {
          id: 'ev_' + Date.now(),
          orderId,
          status: 'created',
          timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
          note: `تم إنشاء الطلب بنجاح بطريقة دفع: ${
            orderData.paymentMethod === 'zain_cash'
              ? 'زين كاش (Zain Cash)'
              : orderData.paymentMethod === 'qi_card'
              ? 'بطاقة كي كارد'
              : orderData.paymentMethod === 'asia_pay'
              ? 'آسيا حوالة / FastPay'
              : 'الدفع نقد عند الاستلام (COD)'
          }`,
          actorRole: 'customer',
          actorName: orderData.customerName,
        },
      ],
      createdAt: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      estimatedDeliveryTime: '30 - 45 دقيقة',
    };

    // Save locally
    setOrders((prev) => [newOrder, ...prev]);
    setActiveTrackedOrderId(orderId);
    clearCart();

    // Write to Firestore database directly
    try {
      await setDoc(doc(db, 'orders', orderId), newOrder);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
    }

    addAuditLog('ORDER_CREATED', 'order', orderId, `إنشاء طلب جديد رقم #${orderId} بمبلغ ${total.toLocaleString()} د.ع من (${store.name}) بمفتاح idempotency: ${idempotencyKey.substring(0, 15)}`);
    addNotification('تم تأكيد الطلب بنجاح!', `طلبك رقم #${orderId} تم إرساله إلى ${store.name}`, 'success', orderId);

    return { success: true, orderId };
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, customNote?: string) => {
    let note = customNote || '';
    if (!note) {
      switch (status) {
        case 'merchant_accepted':
          note = 'وافق المطعم على الطلب وبدأ التجهيز';
          break;
        case 'preparing':
          note = 'الطلب قيد التحضير في المطبخ حالياً';
          break;
        case 'ready_for_pickup':
          note = 'الطلب جاهز ومغلف بانتظار استلام المندوب';
          break;
        case 'courier_assigned':
          note = 'تم تعيين كابتن التوصيل للطلب';
          break;
        case 'picked_up':
          note = 'استلم المندوب الطلب وبدأ التوجه إلى عنوان الزبون';
          break;
        case 'courier_arrived':
          note = 'وصل المندوب إلى عنوان الزبون وهو عند الباب الآن';
          break;
        case 'delivered':
          note = 'تم تسليم الطلب إلى الزبون بنجاح واستلام المبلغ';
          break;
        case 'cancelled':
          note = 'تم إلغاء الطلب من قبل النظام أو العميل';
          break;
      }
    }

    let updatedTargetOrder: Order | undefined;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const newEvent = {
            id: 'ev_' + Date.now() + Math.random().toString(36).substring(2, 5),
            orderId,
            status,
            timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
            note,
            actorRole: currentUser.role,
            actorName: currentUser.name,
          };

          const updatedPayment = { ...o.payment };
          if (status === 'delivered' && updatedPayment.method === 'cash_on_delivery') {
            updatedPayment.status = 'completed';
            updatedPayment.paidAt = new Date().toLocaleTimeString('ar-IQ');
          }

          const res: Order = {
            ...o,
            status,
            payment: updatedPayment,
            events: [...o.events, newEvent],
            courierArrivedAt: status === 'courier_arrived' ? new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : o.courierArrivedAt,
          };
          updatedTargetOrder = res;
          return res;
        }
        return o;
      })
    );

    // Sync to Firestore
    if (updatedTargetOrder) {
      try {
        setDoc(doc(db, 'orders', orderId), updatedTargetOrder).catch(() => {});
      } catch {
        // fail gracefully
      }
    }

    addAuditLog('ORDER_STATUS_UPDATED', 'order', orderId, `تغيير حالة الطلب #${orderId} إلى: ${status} (${note})`);
    addNotification(`تحديث على الطلب #${orderId}`, note, status === 'courier_arrived' ? 'success' : 'info', orderId);

    if (status === 'ready_for_pickup' && !forceNoCourier) {
      setTimeout(() => {
        const availableCourier = couriers.find((c) => c.isOnline && !c.isBusy);
        if (availableCourier) {
          assignCourierToOrder(orderId, availableCourier.id);
        }
      }, 1200);
    } else if (status === 'ready_for_pickup' && forceNoCourier) {
      addNotification('تنبيه العمليات: لا يوجد مندوب متاح', `تعذر التعيين التلقائي للطلب #${orderId}، جاري البحث عن مناديب إضافيين...`, 'warning', orderId);
      addAuditLog('COURIER_DISPATCH_TIMEOUT', 'courier', orderId, 'فشل تعيين مندوب للطلب بسبب عدم توفر كباتن متاحين في النطاق (محاكاة)', 'warning');
    }
  };

  const cancelOrder = (orderId: string, reason: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    // Strict Cancellation Policy: Only allowed before food preparation begins
    const isCustomer = currentUser.role === 'customer';
    const canCancel = targetOrder.status === 'created' || targetOrder.status === 'merchant_accepted' || currentUser.role === 'admin';

    if (isCustomer && !canCancel) {
      addNotification('تعذر الإلغاء', 'لا يمكن إلغاء الطلب بعد بدء تجهيز الطعام في المطبخ لحفظ حقوق المتجر', 'error', orderId);
      return;
    }

    let cancelledOrder: Order | undefined;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const cancelEvent = {
            id: 'ev_' + Date.now(),
            orderId,
            status: 'cancelled' as OrderStatus,
            timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
            note: `تم إلغاء الطلب: ${reason}`,
            actorRole: currentUser.role,
            actorName: currentUser.name,
          };
          const res: Order = {
            ...o,
            status: 'cancelled',
            cancellationReason: reason,
            payment: {
              ...o.payment,
              status: o.payment.status === 'completed' ? 'refunded' : 'failed',
            },
            events: [...o.events, cancelEvent],
          };
          cancelledOrder = res;
          return res;
        }
        return o;
      })
    );

    if (cancelledOrder) {
      try {
        setDoc(doc(db, 'orders', orderId), cancelledOrder).catch(() => {});
      } catch {
        // fail gracefully
      }
    }

    addAuditLog('ORDER_CANCELLED', 'order', orderId, `إلغاء الطلب #${orderId} بواسطة ${currentUser.name} (${currentUser.role}). السبب: ${reason}`, 'warning');
    addNotification('تم إلغاء الطلب', `تم إلغاء الطلب #${orderId}: ${reason}`, 'warning', orderId);
  };

  const assignCourierToOrder = (orderId: string, courierId: string) => {
    const courier = couriers.find((c) => c.id === courierId);
    if (!courier) return;

    if (courier.approvalStatus && courier.approvalStatus !== 'approved') {
      const statusLabel = courier.approvalStatus === 'pending' ? 'بانتظار موافقة الإدارة' : 'معلق مؤقتاً';
      addNotification('تعذر تعيين الكابتن', `الكابتن ${courier.name} غير معتمد حالياً (${statusLabel})`, 'warning', orderId);
      return;
    }

    setCouriers((prev) =>
      prev.map((c) => (c.id === courierId ? { ...c, isBusy: true, currentOrderId: orderId } : c))
    );

    let updatedOrder: Order | undefined;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const newEvent = {
            id: 'ev_' + Date.now(),
            orderId,
            status: 'courier_assigned' as OrderStatus,
            timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
            note: `تم تعيين الكابتن ${courier.name} (${courier.vehicleType}) لتوصيل الطلب`,
            actorRole: 'admin' as UserRole,
            actorName: 'نظام الإسناد الذكي',
          };
          const res: Order = {
            ...o,
            status: 'courier_assigned',
            courierId: courier.id,
            courierName: courier.name,
            courierPhone: courier.phone,
            events: [...o.events, newEvent],
          };
          updatedOrder = res;
          return res;
        }
        return o;
      })
    );

    if (updatedOrder) {
      try {
        setDoc(doc(db, 'orders', orderId), updatedOrder).catch(() => {});
      } catch {
        // fail gracefully
      }
    }

    addAuditLog('COURIER_ASSIGNED', 'courier', courierId, `إسناد الطلب #${orderId} إلى الكابتن ${courier.name}`);
    addNotification('تم تعيين المندوب!', `الكابتن ${courier.name} استلم مهمة توصيل طلبك #${orderId}`, 'info', orderId);
  };

  const toggleCourierStatus = async (courierId: string) => {
    const courier = couriers.find((c) => c.id === courierId);
    if (courier && courier.approvalStatus && courier.approvalStatus !== 'approved') {
      const statusLabel = courier.approvalStatus === 'pending' ? 'بانتظار موافقة الإدارة' : 'معلق مؤقتاً';
      addNotification('الحساب غير معتمد', `لا يمكنك تفعيل حالة الاتصال (${statusLabel}). بانتظار اعتماد الإدارة.`, 'error');
      return;
    }

    let nextStatus = false;
    setCouriers((prev) =>
      prev.map((c) => {
        if (c.id === courierId) {
          nextStatus = !c.isOnline;
          addAuditLog('COURIER_STATUS_CHANGE', 'courier', courierId, `تغيير حالة الكابتن ${c.name} إلى: ${nextStatus ? 'متصل' : 'غير متصل'}`);
          addNotification(
            nextStatus ? 'الكابتن متصل الآن' : 'الكابتن غير متصل',
            nextStatus ? 'أنت جاهز لاستقبال وتوصيل الطلبات' : 'تم إيقاف استقبال الطلبات مؤقتاً',
            nextStatus ? 'success' : 'info'
          );
          return { ...c, isOnline: nextStatus };
        }
        return c;
      })
    );

    if (!isSimulatedOffline) {
      try {
        await setDoc(doc(db, 'couriers', courierId), { isOnline: nextStatus }, { merge: true });
      } catch (e) {
        console.warn('Failed to sync courier status to Firestore', e);
      }
    }
  };

  const updateCourierLocation = async (orderId: string, coords: LocationCoordinates) => {
    const courierLocationData = {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      updatedAt: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      isSharingEnabled: true,
    };

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              courierLocation: courierLocationData,
            }
          : o
      )
    );

    if (!isSimulatedOffline) {
      try {
        await setDoc(
          doc(db, 'orders', orderId),
          {
            courierLocation: courierLocationData,
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed to sync courierLocation to Firestore', e);
      }
    }
  };

  const courierAcceptOrder = (courierId: string, orderId: string) => {
    const courier = couriers.find((c) => c.id === courierId);
    if (courier && courier.approvalStatus && courier.approvalStatus !== 'approved') {
      const statusLabel = courier.approvalStatus === 'pending' ? 'بانتظار موافقة الإدارة' : 'معلق مؤقتاً';
      addNotification('غير مصرح', `لا يمكنك قبول الطلبات؛ حساب الكابتن (${statusLabel}).`, 'error');
      return;
    }
    assignCourierToOrder(orderId, courierId);
  };

  const courierDeliverOrder = (courierId: string, orderId: string) => {
    updateOrderStatus(orderId, 'delivered', 'تم تسليم الطلب باليد واستلام المستحقات من الزبون');
    setCouriers((prev) =>
      prev.map((c) => {
        if (c.id === courierId) {
          const order = orders.find((o) => o.id === orderId);
          const earning = order?.financials
            ? order.financials.courierTotalEarnings
            : (order ? order.deliveryFee : 3500);
          return {
            ...c,
            isBusy: false,
            currentOrderId: undefined,
            totalDeliveries: (c.totalDeliveries || 0) + 1,
            walletBalance: c.walletBalance + earning,
          };
        }
        return c;
      })
    );
  };

  // Support conversations
  const sendSupportMessage = (conversationId: string, text: string) => {
    if (!text.trim()) return;

    const isAgent = currentUser.role === 'support' || currentUser.role === 'admin';
    const newMsg: SupportMessage = {
      id: 'msg_' + Date.now(),
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      isAgent,
    };

    let updatedConv: SupportConversation | undefined;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          const res: SupportConversation = {
            ...c,
            lastMessage: text.trim(),
            lastUpdated: newMsg.timestamp,
            messages: [...c.messages, newMsg],
          };
          updatedConv = res;
          return res;
        }
        return c;
      })
    );

    if (updatedConv) {
      try {
        setDoc(doc(db, 'support_conversations', conversationId), updatedConv).catch(() => {});
      } catch {
        // fail gracefully
      }
    }

    addAuditLog('SUPPORT_MESSAGE_SENT', 'support', conversationId, `رسالة دعم من ${currentUser.name}: ${text.substring(0, 40)}...`);

    if (!isAgent) {
      setTimeout(() => {
        setConversations((curr) =>
          curr.map((c) => {
            if (c.id === conversationId) {
              const replyMsg: SupportMessage = {
                id: 'msg_auto_' + Date.now(),
                conversationId,
                senderId: 'user_supp_1',
                senderName: 'سارة التميمي (الدعم الفني)',
                senderRole: 'support',
                text: 'أهلاً بك! تم استلام رسالتك وفريق الدعم يتابع حالتك الآن لضمان تجربة ممتازة.',
                timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
                isAgent: true,
              };
              const res = {
                ...c,
                lastMessage: replyMsg.text,
                lastUpdated: replyMsg.timestamp,
                messages: [...c.messages, replyMsg],
              };
              try {
                setDoc(doc(db, 'support_conversations', conversationId), res).catch(() => {});
              } catch {
                // fail gracefully
              }
              return res;
            }
            return c;
          })
        );
        addNotification('رد من الدعم الفني', 'سارة التميمي: أهلاً بك! تم استلام رسالتك ونتابع طلبك فوراً.');
      }, 1500);
    }
  };

  const startSupportConversation = (subject: string, relatedOrderId?: string) => {
    const newId = 'conv_' + Date.now();
    const newConv: SupportConversation = {
      id: newId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userPhone: currentUser.phone,
      relatedOrderId,
      subject,
      status: 'open',
      lastMessage: 'تم فتح المحادثة، بانتظار الرد',
      lastUpdated: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: 'msg_' + Date.now(),
          conversationId: newId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          text: `مرحباً، لدي استفسار بخصوص: ${subject}${relatedOrderId ? ` (طلب #${relatedOrderId})` : ''}`,
          timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
          isAgent: false,
        },
      ],
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);

    try {
      setDoc(doc(db, 'support_conversations', newId), newConv).catch(() => {});
    } catch {
      // fail gracefully
    }

    addAuditLog('SUPPORT_TICKET_CREATED', 'support', newId, `تذكرة دعم جديدة من ${currentUser.name}: ${subject}`);
    addNotification('محادثة دعم جديدة', 'تم فتح التذكرة وسيرد عليك موظف الدعم بأسرع وقت');
    return newId;
  };

  const updateConversationStatus = (conversationId: string, status: 'open' | 'pending' | 'resolved') => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          const res = { ...c, status };
          try {
            setDoc(doc(db, 'support_conversations', conversationId), res).catch(() => {});
          } catch {
            // fail gracefully
          }
          return res;
        }
        return c;
      })
    );
    addAuditLog('SUPPORT_STATUS_CHANGE', 'support', conversationId, `تم تحديث حالة تذكرة الدعم إلى: ${status}`);
  };

  // Ratings & Customer Reviews Implementation
  const submitOrderRating = async (
    ratingData: Omit<OrderRating, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!ratingData.orderId || !ratingData.storeId || !ratingData.storeRating) {
        return { success: false, error: 'يرجى تحديد تقييم المتجر بالنجوم أولاً' };
      }

      const alreadyRated = ratings.some((r) => r.orderId === ratingData.orderId);
      if (alreadyRated) {
        return { success: false, error: 'تم إرسال تقييم لهذا الطلب مسبقاً' };
      }

      const ratingId = `rat_${Date.now()}`;
      const now = new Date();
      const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newRating: OrderRating = {
        id: ratingId,
        ...ratingData,
        createdAt,
      };

      // 1. Add to local ratings state
      const nextRatings = [newRating, ...ratings];
      setRatings(nextRatings);

      // 2. Update order with isRated: true
      setOrders((prev) =>
        prev.map((o) => (o.id === ratingData.orderId ? { ...o, isRated: true, ratingId } : o))
      );

      // 3. Compute store rating & count
      const storeRatingsList = nextRatings.filter((r) => r.storeId === ratingData.storeId);
      const storeAvg =
        Math.round((storeRatingsList.reduce((acc, r) => acc + r.storeRating, 0) / storeRatingsList.length) * 10) / 10;

      setStores((prev) =>
        prev.map((s) => {
          if (s.id === ratingData.storeId) {
            const updated = {
              ...s,
              rating: storeAvg,
              ratingCount: s.ratingCount + 1,
            };
            try {
              setDoc(doc(db, 'stores', s.id), updated, { merge: true }).catch(() => {});
            } catch {}
            return updated;
          }
          return s;
        })
      );

      // 4. Compute courier rating & count if courier was rated
      if (ratingData.courierId && ratingData.courierRating) {
        const courierRatingsList = nextRatings.filter(
          (r) => r.courierId === ratingData.courierId && r.courierRating
        );
        const courierAvg =
          Math.round(
            (courierRatingsList.reduce((acc, r) => acc + (r.courierRating || 5), 0) /
              courierRatingsList.length) *
              100
          ) / 100;

        setCouriers((prev) =>
          prev.map((c) => {
            if (c.id === ratingData.courierId) {
              const updated = {
                ...c,
                rating: courierAvg,
                ratingCount: (c.ratingCount || 0) + 1,
              };
              try {
                setDoc(doc(db, 'couriers', c.id), updated, { merge: true }).catch(() => {});
              } catch {}
              return updated;
            }
            return c;
          })
        );
      }

      // 5. Save to Firestore
      try {
        await setDoc(doc(db, 'ratings', ratingId), newRating);
        await setDoc(doc(db, 'orders', ratingData.orderId), { isRated: true, ratingId }, { merge: true });
      } catch (err) {
        console.warn('Firestore ratings sync handled gracefully in offline/fallback mode', err);
      }

      addAuditLog(
        'ORDER_RATED',
        'order',
        ratingData.orderId,
        `تقييم الزبون ${ratingData.customerName} للمتجر ${ratingData.storeName} (${ratingData.storeRating}★) وللكابتن (${ratingData.courierRating || '-'}★)`
      );

      addNotification(
        'شكراً لمشاركتك التقييم!',
        `تم تسجيل تقييمك لمطعم ${ratingData.storeName} ومندوب التوصيل بنجاح. رأيك يساعدنا على التطوير المستمر!`,
        'success',
        ratingData.orderId
      );

      return { success: true };
    } catch (err: any) {
      console.error('Error submitting rating:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء حفظ التقييم' };
    }
  };

  const isOrderRated = (orderId: string): boolean => {
    return ratings.some((r) => r.orderId === orderId);
  };

  const getStoreRatings = (storeId: string): OrderRating[] => {
    return ratings.filter((r) => r.storeId === storeId);
  };

  const getCourierRatings = (courierId: string): OrderRating[] => {
    return ratings.filter((r) => r.courierId === courierId);
  };

  // Restaurant Application submission
  const submitRestaurantApplication = async (
    data: Omit<RestaurantApplication, 'id' | 'status' | 'createdAt'>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const id = 'app_rest_' + Date.now();
      const newApp: RestaurantApplication = {
        ...data,
        id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setRestaurantApplications((prev) => [newApp, ...prev.filter((a) => a.id !== id)]);

      if (!isSimulatedOffline) {
        await setDoc(doc(db, 'restaurant_applications', id), newApp);
      }

      addAuditLog('RESTAURANT_APPLICATION_SUBMITTED', 'store', id, `تقديم طلب انضمام مطعم جديد: ${data.storeName} (${data.ownerPhone})`);
      addNotification('تم إرسال طلب الانضمام بنجاح', `طلب انضمام ${data.storeName} قيد مراجعة الإدارة الآن`, 'info');

      return { success: true, id };
    } catch (err: any) {
      console.error('Error submitting restaurant application:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء تقديم الطلب' };
    }
  };

  // Courier Application submission
  const submitCourierApplication = async (
    data: Omit<CourierApplication, 'id' | 'status' | 'createdAt'>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const id = 'app_cour_' + Date.now();
      const newApp: CourierApplication = {
        ...data,
        id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setCourierApplications((prev) => [newApp, ...prev.filter((a) => a.id !== id)]);

      if (!isSimulatedOffline) {
        await setDoc(doc(db, 'courier_applications', id), newApp);
      }

      addAuditLog('COURIER_APPLICATION_SUBMITTED', 'courier', id, `تقديم طلب كابتن جديد: ${data.fullName} (${data.vehicleType})`);
      addNotification('تم إرسال طلب الانضمام ككابتن', `طلب انضمام الكابتن ${data.fullName} قيد التدقيق لدى الإدارة`, 'info');

      return { success: true, id };
    } catch (err: any) {
      console.error('Error submitting courier application:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء تقديم الطلب' };
    }
  };

  // Admin Review of Restaurant Application
  const reviewRestaurantApplication = async (
    appId: string,
    action: 'approve' | 'reject' | 'suspend',
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const isAdmin =
      currentUser.role === 'admin' ||
      (firebaseUser && (firebaseUser.email === 'msr33777@gmail.com' || (firebaseUser as any).isAdmin));

    if (!isAdmin) {
      return { success: false, error: 'غير مصرح: صلاحية المدير مطلوبة لمراجعة الطلبات' };
    }

    const app = restaurantApplications.find((a) => a.id === appId);
    if (!app) {
      return { success: false, error: 'طلب المطعم غير موجود' };
    }

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended';
    const updatedApp: RestaurantApplication = {
      ...app,
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy: `${currentUser.name} (المدير)`,
      adminNotes: adminNotes ?? app.adminNotes,
    };

    setRestaurantApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));

    if (!isSimulatedOffline) {
      try {
        await setDoc(doc(db, 'restaurant_applications', appId), updatedApp, { merge: true });
      } catch (e) {
        console.warn('Error updating restaurant application in Firestore', e);
      }
    }

    if (action === 'approve') {
      const storeId = app.storeId || `store_${app.id}`;
      const existingStore = stores.find((s) => s.id === storeId || s.name === app.storeName);

      if (existingStore) {
        const updatedStore: Store = {
          ...existingStore,
          approvalStatus: 'approved',
          isOpen: true,
          phone: app.ownerPhone || existingStore.phone,
          address: app.address || existingStore.address,
          coordinates: app.coordinates || existingStore.coordinates,
        };
        setStores((prev) => prev.map((s) => (s.id === existingStore.id ? updatedStore : s)));
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'stores', existingStore.id), updatedStore, { merge: true }).catch(() => {});
        }
      } else {
        const newStore: Store = {
          id: storeId,
          name: app.storeName,
          logo: app.logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
          coverImage: app.logoUrl,
          category: (app.category as any) || 'مشاوي ومأكولات عراقية',
          rating: 5.0,
          ratingCount: 1,
          minOrder: app.minOrder || 5000,
          deliveryTime: '25-35 دقيقة',
          deliveryFee: 1500,
          isOpen: true,
          address: app.address,
          phone: app.ownerPhone,
          commissionRate: pricingSettings.defaultMerchantCommissionRate || 10,
          coordinates: app.coordinates,
          approvalStatus: 'approved',
        };
        setStores((prev) => [newStore, ...prev]);
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'stores', storeId), newStore).catch(() => {});
        }
      }

      // Upgrade applicant user role to merchant if userId is present
      if (app.applicantUserId) {
        setUsers((prev) =>
          prev.map((u) => (u.id === app.applicantUserId ? { ...u, role: 'merchant' } : u))
        );
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'users', app.applicantUserId), { role: 'merchant' }, { merge: true }).catch(() => {});
        }
      }

      addAuditLog('RESTAURANT_APPLICATION_APPROVED', 'store', appId, `اعتماد وموافقة على انضمام مطعم: ${app.storeName}`);
      addNotification('تمت الموافقة على المطعم', `تم اعتماد ${app.storeName} بنجاح وأصبح متاحاً للزبائن وقبول الطلبات!`, 'success');
    } else if (action === 'reject') {
      const existingStore = stores.find((s) => s.id === app.storeId || s.name === app.storeName);
      if (existingStore) {
        setStores((prev) =>
          prev.map((s) => (s.id === existingStore.id ? { ...s, approvalStatus: 'rejected', isOpen: false } : s))
        );
      }
      addAuditLog('RESTAURANT_APPLICATION_REJECTED', 'store', appId, `رفض طلب انضمام مطعم: ${app.storeName}. السبب: ${adminNotes || 'غير مستوفِ للشروط'}`);
      addNotification('تم رفض طلب المطعم', `تم رفض طلب ${app.storeName}. السبب: ${adminNotes || 'لم يستوفِ الشروط المطلوبة'}`, 'warning');
    } else if (action === 'suspend') {
      const existingStore = stores.find((s) => s.id === app.storeId || s.name === app.storeName);
      if (existingStore) {
        const suspended = { ...existingStore, approvalStatus: 'suspended' as const, isOpen: false };
        setStores((prev) => prev.map((s) => (s.id === existingStore.id ? suspended : s)));
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'stores', existingStore.id), suspended, { merge: true }).catch(() => {});
        }
      }
      addAuditLog('RESTAURANT_ACCOUNT_SUSPENDED', 'store', appId, `تعليق مؤقت لحساب مطعم: ${app.storeName}`);
      addNotification('تم تعليق حساب المطعم', `تم تعليق حساب ${app.storeName} مؤقتاً بواسطة الإدارة`, 'warning');
    }

    return { success: true };
  };

  // Admin Review of Courier Application
  const reviewCourierApplication = async (
    appId: string,
    action: 'approve' | 'reject' | 'suspend',
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const isAdmin =
      currentUser.role === 'admin' ||
      (firebaseUser && (firebaseUser.email === 'msr33777@gmail.com' || (firebaseUser as any).isAdmin));

    if (!isAdmin) {
      return { success: false, error: 'غير مصرح: صلاحية المدير مطلوبة لمراجعة طلبات الكباتن' };
    }

    const app = courierApplications.find((a) => a.id === appId);
    if (!app) {
      return { success: false, error: 'طلب الكابتن غير موجود' };
    }

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended';
    const updatedApp: CourierApplication = {
      ...app,
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy: `${currentUser.name} (المدير)`,
      adminNotes: adminNotes ?? app.adminNotes,
    };

    setCourierApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));

    if (!isSimulatedOffline) {
      try {
        await setDoc(doc(db, 'courier_applications', appId), updatedApp, { merge: true });
      } catch (e) {
        console.warn('Error updating courier application in Firestore', e);
      }
    }

    if (action === 'approve') {
      const courierId = app.courierId || `courier_${app.id}`;
      const existingCourier = couriers.find((c) => c.id === courierId || c.phone === app.phone);

      if (existingCourier) {
        const updatedCourier: Courier = {
          ...existingCourier,
          approvalStatus: 'approved',
          isOnline: true,
          vehicleType: app.vehicleType || existingCourier.vehicleType,
          vehiclePlate: app.vehiclePlate || existingCourier.vehiclePlate,
          phone: app.phone || existingCourier.phone,
          coordinates: app.coordinates || existingCourier.coordinates,
        };
        setCouriers((prev) => prev.map((c) => (c.id === existingCourier.id ? updatedCourier : c)));
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'couriers', existingCourier.id), updatedCourier, { merge: true }).catch(() => {});
        }
      } else {
        const newCourier: Courier = {
          id: courierId,
          name: app.fullName,
          phone: app.phone,
          avatar: app.documents?.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          rating: 5.0,
          ratingCount: 1,
          currentLocation: app.address || `${app.city || 'بغداد'} - المنصور`,
          vehicleType: app.vehicleType,
          vehiclePlate: app.vehiclePlate,
          completedOrdersCount: 0,
          totalEarnings: 0,
          walletBalance: 0,
          isOnline: true,
          coordinates: app.coordinates || { lat: 33.3152, lng: 44.3661 },
          approvalStatus: 'approved',
        };
        setCouriers((prev) => [newCourier, ...prev]);
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'couriers', courierId), newCourier).catch(() => {});
        }
      }

      // Upgrade applicant user role to courier if userId is present
      if (app.applicantUserId) {
        setUsers((prev) =>
          prev.map((u) => (u.id === app.applicantUserId ? { ...u, role: 'courier' } : u))
        );
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'users', app.applicantUserId), { role: 'courier' }, { merge: true }).catch(() => {});
        }
      }

      addAuditLog('COURIER_APPLICATION_APPROVED', 'courier', appId, `اعتماد وموافقة على انضمام الكابتن: ${app.fullName} (${app.vehiclePlate})`);
      addNotification('تم اعتماد الكابتن بنجاح', `تم قبول الكابتن ${app.fullName} وأصبح بإمكانه الاتصال وقبول طلبات التوصيل!`, 'success');
    } else if (action === 'reject') {
      const existingCourier = couriers.find((c) => c.id === app.courierId || c.phone === app.phone);
      if (existingCourier) {
        setCouriers((prev) =>
          prev.map((c) => (c.id === existingCourier.id ? { ...c, approvalStatus: 'rejected', isOnline: false } : c))
        );
      }
      addAuditLog('COURIER_APPLICATION_REJECTED', 'courier', appId, `رفض طلب انضمام كابتن: ${app.fullName}. السبب: ${adminNotes || 'عدم اكتمال الوثائق'}`);
      addNotification('تم رفض طلب الكابتن', `تم رفض طلب ${app.fullName}. السبب: ${adminNotes || 'عدم استيفاء الشروط أو الوثائق المطلوبة'}`, 'warning');
    } else if (action === 'suspend') {
      const existingCourier = couriers.find((c) => c.id === app.courierId || c.phone === app.phone);
      if (existingCourier) {
        const suspended = { ...existingCourier, approvalStatus: 'suspended' as const, isOnline: false };
        setCouriers((prev) => prev.map((c) => (c.id === existingCourier.id ? suspended : c)));
        if (!isSimulatedOffline) {
          setDoc(doc(db, 'couriers', existingCourier.id), suspended, { merge: true }).catch(() => {});
        }
      }
      addAuditLog('COURIER_ACCOUNT_SUSPENDED', 'courier', appId, `تعليق مؤقت لحساب الكابتن: ${app.fullName}`);
      addNotification('تم تعليق حساب الكابتن', `تم تعليق حساب الكابتن ${app.fullName} مؤقتاً بواسطة الإدارة`, 'warning');
    }

    return { success: true };
  };

  // Reset & Backup
  const resetToInitialData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStores(INITIAL_STORES);
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setCouriers(INITIAL_COURIERS);
    setConversations(INITIAL_CONVERSATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setRatings(INITIAL_RATINGS);
    setRestaurantApplications(INITIAL_RESTAURANT_APPLICATIONS);
    setCourierApplications(INITIAL_COURIER_APPLICATIONS);
    setCart([]);
    setCartStoreId(null);
    setActiveTrackedOrderId(INITIAL_ORDERS[0]?.id || null);
    addNotification('إعادة ضبط النظام', 'تمت استعادة البيانات الأولية لجميع الجداول والمتاجر والمناديب والتقييمات وطلبات الانضمام', 'info');
  };

  const exportDatabaseJson = () => {
    const data = {
      stores,
      products,
      orders,
      couriers,
      conversations,
      auditLogs,
      ratings,
      restaurantApplications,
      courierApplications,
      exportedAt: new Date().toISOString(),
      platform: 'TALABI_IRAQ_v2',
    };
    return JSON.stringify(data, null, 2);
  };

  const importDatabaseJson = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.stores && parsed.orders) {
        setStores(parsed.stores);
        setProducts(parsed.products || INITIAL_PRODUCTS);
        setOrders(parsed.orders);
        setCouriers(parsed.couriers || INITIAL_COURIERS);
        setConversations(parsed.conversations || INITIAL_CONVERSATIONS);
        setAuditLogs(parsed.auditLogs || INITIAL_AUDIT_LOGS);
        if (parsed.ratings) setRatings(parsed.ratings);
        if (parsed.restaurantApplications) setRestaurantApplications(parsed.restaurantApplications);
        if (parsed.courierApplications) setCourierApplications(parsed.courierApplications);
        addNotification('تم استيراد البيانات', 'تم تحديث قاعدة البيانات بنجاح من الملف', 'success');
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        isAuthReady,
        firestoreConnected,
        signInWithGoogle,
        signOut,
        pricingSettings,
        updatePricingSettings,
        calculateOrderFinancials,
        role,
        setRole,
        currentUser,
        switchUser,
        users,
        isMobileFrame,
        setIsMobileFrame,
        stores,
        products,
        toggleStoreOpen,
        toggleProductAvailability,
        updateProductPrice,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStore,
        uploadImageFile,
        cart,
        cartStoreId,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartSubtotal,
        cartDeliveryFee,
        cartTotal,
        orders,
        activeTrackedOrderId,
        setActiveTrackedOrderId,
        createOrder,
        updateOrderStatus,
        cancelOrder,
        assignCourierToOrder,
        couriers,
        toggleCourierStatus,
        courierAcceptOrder,
        courierDeliverOrder,
        updateCourierLocation,
        conversations,
        activeConversationId,
        setActiveConversationId,
        sendSupportMessage,
        startSupportConversation,
        updateConversationStatus,
        auditLogs,
        addAuditLog,
        notifications,
        dismissNotification,
        addNotification,
        ratings,
        submitOrderRating,
        isOrderRated,
        getStoreRatings,
        getCourierRatings,
        restaurantApplications,
        courierApplications,
        submitRestaurantApplication,
        submitCourierApplication,
        reviewRestaurantApplication,
        reviewCourierApplication,
        isSimulatedOffline,
        setIsSimulatedOffline,
        forcePaymentFail,
        setForcePaymentFail,
        forceNoCourier,
        setForceNoCourier,
        resetToInitialData,
        exportDatabaseJson,
        importDatabaseJson,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
