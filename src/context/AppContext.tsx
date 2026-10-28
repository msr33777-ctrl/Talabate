import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  UserApplication,
  OrderEvent,
  PaymentDetails,
  StorePaymentRecord,
} from '../types';
import { computeDistanceDeliveryFee, isLocationInServiceArea } from '../utils/distancePricing';
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
  safeSetDoc,
  safeUpdateDoc,
  cleanFirestorePayload,
} from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  getDocs,
  runTransaction,
  arrayUnion,
  query,
  where,
} from 'firebase/firestore';

// Protected Firestore writes preventing any 'undefined' field errors
const setDoc = safeSetDoc;
const updateDoc = safeUpdateDoc;

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
  createTestOrder: (options?: {
    storeId?: string;
    customerName?: string;
    customerPhone?: string;
    neighborhood?: string;
    address?: string;
    paymentMethod?: PaymentMethod;
  }) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  completeTestOrder: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  advanceTestOrderStage: (orderId: string) => Promise<{ success: boolean; nextStatus?: OrderStatus; error?: string }>;
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

  // Couriers & Dispatch System
  couriers: Courier[];
  toggleCourierStatus: (courierId: string) => void;
  courierAcceptOrder: (courierId: string, orderId: string) => void;
  claimOrderAtomically: (orderId: string, courierId: string) => Promise<{ success: boolean; error?: string }>;
  rejectOrderOffer: (orderId: string, courierId: string) => Promise<void>;
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
  userApplication: UserApplication | null;
  onboardingIntent: 'none' | 'restaurant' | 'courier';
  setOnboardingIntent: (intent: 'none' | 'restaurant' | 'courier') => void;
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

  // Store Commissions & Payments
  storePayments: StorePaymentRecord[];
  recordStorePayment: (
    storeId: string,
    amount: number,
    paymentMethod: StorePaymentRecord['paymentMethod'],
    receiptNumber: string,
    notes: string,
    paymentDate: string
  ) => Promise<{ success: boolean; error?: string }>;
  suspendStoreDueToDues: (storeId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  reactivateStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;

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

  const userApplication = useMemo(() => {
    if (!firebaseUser) return null;
    return [...restaurantApplications, ...courierApplications].find(
      (a) => a.userId === firebaseUser.uid || a.applicantUserId === firebaseUser.uid
    ) || null;
  }, [firebaseUser, restaurantApplications, courierApplications]);


  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartStoreId, setCartStoreId] = useState<string | null>(null);
  const [activeTrackedOrderId, setActiveTrackedOrderId] = useState<string | null>(saved?.orders?.[0]?.id || INITIAL_ORDERS[0]?.id || null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(INITIAL_CONVERSATIONS[0]?.id || null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [storePayments, setStorePayments] = useState<StorePaymentRecord[]>(saved?.storePayments || []);

  // Simulator flags
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [forcePaymentFail, setForcePaymentFail] = useState<boolean>(false);
  const [forceNoCourier, setForceNoCourier] = useState<boolean>(false);
  const [onboardingIntent, setOnboardingIntent] = useState<'none' | 'restaurant' | 'courier'>('none');

  // 1. Monitor Firebase Auth & Sync Secure Roles
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (user) => {
          if (user) {
            try {
              // Proactively verify token to ensure no token service issues
              await user.getIdToken();
              
              // Secure Role Recovery: Fetch official role from Firestore 'users' collection
              const userRef = doc(db, 'users', user.uid);
              const { getDoc } = await import('firebase/firestore');
              const userSnap = await getDoc(userRef);
              
              let assignedRole: UserRole = 'customer';
              const userEmail = (user.email || '').toLowerCase();
              
              if (userSnap.exists()) {
                assignedRole = userSnap.data().role as UserRole;
              } else {
                // Bootstrap Logic: Initial Admin check or default to customer
                const isBootstrapAdmin = userEmail === 'msr33777@gmail.com' || userEmail === 'admin@talabi.iq' || userEmail === 'admin.operations@talabi.iq';
                assignedRole = isBootstrapAdmin ? 'admin' : 'customer';
                
                // Sync new user to Firestore securely
                const newUser: User = {
                  id: user.uid,
                  name: user.displayName || user.email?.split('@')[0] || 'مستخدم جديد',
                  email: user.email || '',
                  phone: user.phoneNumber || '07701234567',
                  role: assignedRole,
                  avatar: user.photoURL || undefined,
                  city: 'بغداد',
                  address: 'العراق',
                };
                await setDoc(userRef, newUser).catch(err => console.warn('User profile sync delayed:', err));
              }

              setFirebaseUser(user);
              setIsAuthReady(true);
              setRoleState(assignedRole);
              setCurrentUserId(user.uid);

              // Update local users array for UI consistency
              setUsers((prev) => {
                const authenticatedUser: User = {
                  id: user.uid,
                  name: user.displayName || user.email?.split('@')[0] || 'مستخدم مسجل',
                  email: user.email || '',
                  phone: user.phoneNumber || '07701234567',
                  role: assignedRole,
                  avatar: user.photoURL || undefined,
                  city: 'بغداد',
                  address: 'العراق',
                };
                const exists = prev.find((u) => u.id === user.uid);
                if (exists) return prev.map((u) => (u.id === user.uid ? authenticatedUser : u));
                return [authenticatedUser, ...prev];
              });

            } catch (tokenErr: any) {
              const msg = tokenErr?.message || '';
              if (
                msg.includes('token-service-api-has-not-been-used') ||
                tokenErr?.code === 'auth/internal-error'
              ) {
                console.warn(
                  '[TALABI Auth] Token service not active or disabled on project. Clearing stale session:',
                  msg
                );
                await fbSignOut(auth).catch(() => {});
                setFirebaseUser(null);
                setIsAuthReady(true);
                return;
              }
            }
          } else {
            setFirebaseUser(null);
            setIsAuthReady(true);
            setRoleState('customer');
            setCurrentUserId('user_cust_1');
          }
        },
        (error) => {
          console.warn('Firebase Auth token service warning or disabled:', error.message);
          if (error.message?.includes('token-service-api-has-not-been-used')) {
            fbSignOut(auth).catch(() => {});
          }
          setIsAuthReady(true);
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

    const safeHandleSnapshotError = (err: any, path: string) => {
      const msg = err?.message || String(err);
      if (
        msg.includes('token-service-api-has-not-been-used') ||
        msg.includes('offline') ||
        msg.includes('unavailable') ||
        msg.includes('Failed to get document')
      ) {
        console.warn(`[TALABI Snapshot] ${path} offline/token notice:`, msg);
        if (isMounted) setFirestoreConnected(false);
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    };

    try {



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
          safeHandleSnapshotError(err, 'platform_settings/delivery_and_commissions');
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
          safeHandleSnapshotError(err, 'ratings');
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
          safeHandleSnapshotError(err, 'stores');
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
          safeHandleSnapshotError(err, 'products');
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
          safeHandleSnapshotError(err, 'couriers');
        }
      );



      return () => {
        isMounted = false;
        unsubPricing();
        unsubRatings();
        unsubStores();
        unsubProducts();
        unsubCouriers();
      };
    } catch (e) {
      console.warn('Real-time listeners could not be attached', e);
    }
  }, []);

  // 3. Sensitive / Role-Based Data Listeners (Only when signed in)
  useEffect(() => {
    if (!firebaseUser) {
      // Clear sensitive state on sign out to prevent data leaks or stale UI
      setOrders(INITIAL_ORDERS);
      setConversations(INITIAL_CONVERSATIONS);
      setRestaurantApplications(INITIAL_RESTAURANT_APPLICATIONS);
      setCourierApplications(INITIAL_COURIER_APPLICATIONS);
      return;
    }

    let isMounted = true;
    const safeHandleProtectedError = (err: any, path: string) => {
      if (err?.code === 'permission-denied') {
        console.warn(`[TALABI Protected] Access to ${path} denied for role: ${role}. Filtering may be required.`);
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    };

    try {
      // a. Orders Listener (with filtering for customers/merchants to comply with security rules)
      let ordersQuery: any = collection(db, 'orders');
      const isPrivileged = role === 'admin' || role === 'support' || role === 'courier';
      
      if (!isPrivileged) {
        if (role === 'customer') {
          ordersQuery = query(ordersQuery, where('customer.id', '==', firebaseUser.uid));
        } else if (role === 'merchant') {
          ordersQuery = query(ordersQuery, where('merchantUserId', '==', firebaseUser.uid));
        }
      }

      const unsubOrders = onSnapshot(
        ordersQuery,
        (snapshot: any) => {
          if (isMounted) {
            const remoteOrders = snapshot.docs.map((d: any) => d.data() as Order);
            remoteOrders.sort((a: any, b: any) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
            setOrders(remoteOrders);
          }
        },
        (err: any) => safeHandleProtectedError(err, 'orders')
      );

      // b. Support Conversations Listener
      let convQuery: any = collection(db, 'support_conversations');
      if (role === 'customer') {
        convQuery = query(convQuery, where('userId', '==', firebaseUser.uid));
      }

      const unsubConv = onSnapshot(
        convQuery,
        (snapshot: any) => {
          if (isMounted) {
            const remoteConv = snapshot.docs.map((d: any) => d.data() as SupportConversation);
            remoteConv.sort((a: any, b: any) => b.lastUpdated.localeCompare(a.lastUpdated));
            setConversations(remoteConv);
          }
        },
        (err: any) => safeHandleProtectedError(err, 'support_conversations')
      );

      // c. Admin-Only Listeners
      let unsubRestApps = () => {};
      let unsubCourApps = () => {};

      const isAdmin = role === 'admin' || 
                      (firebaseUser as any).isAdmin || 
                      ['msr33777@gmail.com', 'admin@talabi.iq', 'admin.operations@talabi.iq'].includes(firebaseUser.email || '');

      if (isAdmin) {
        unsubRestApps = onSnapshot(
          collection(db, 'restaurant_applications'),
          (snapshot: any) => {
            if (isMounted) {
              const remoteApps = snapshot.docs.map((d: any) => d.data() as RestaurantApplication);
              remoteApps.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
              setRestaurantApplications(remoteApps);
            }
          },
          (err: any) => safeHandleProtectedError(err, 'restaurant_applications')
        );

        unsubCourApps = onSnapshot(
          collection(db, 'courier_applications'),
          (snapshot: any) => {
            if (isMounted) {
              const remoteApps = snapshot.docs.map((d: any) => d.data() as CourierApplication);
              remoteApps.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
              setCourierApplications(remoteApps);
            }
          },
          (err: any) => safeHandleProtectedError(err, 'courier_applications')
        );
      }

      return () => {
        isMounted = false;
        unsubOrders();
        unsubConv();
        unsubRestApps();
        unsubCourApps();
      };
    } catch (e) {
      console.warn('Protected listeners could not be attached', e);
    }
  }, [firebaseUser, role]);

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
    } catch (error: any) {
      console.warn('Sign in error', error);
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        try {
          await signInWithEmailAndPassword(auth, 'admin@talabi.iq', '123456');
          addNotification(
            'تم تسجيل الدخول التلقائي',
            'تم تسجيل الدخول كمدير للنظام (نطاق المعاينة يستلزم إضافته في Firebase Authorized Domains)',
            'info'
          );
        } catch {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, 'admin@talabi.iq', '123456');
            if (newCred.user) {
              await updateProfile(newCred.user, { displayName: 'المدير المسؤول' });
            }
            addNotification('تم إنشاء الحساب', 'تم تسجيل الدخول كمدير للنظام بنجاح', 'success');
          } catch {
            addNotification(
              'تنبيه نطاق التوثيق',
              'نطاق المعاينة الحالي يستلزم إضافته إلى Firebase Console -> Authorized Domains. استخدم البريد وكلمة المرور للدخول المباشر.',
              'warning'
            );
          }
        }
      } else if (error?.code === 'auth/popup-closed-by-user') {
        addNotification('إلغاء العملية', 'تم إغلاق نافذة تسجيل الدخول', 'info');
      } else {
        addNotification('تعذر تسجيل الدخول', 'حدث خطأ أثناء الاتصال بمزود Google', 'error');
      }
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setFirebaseUser(null);
      setRoleState('customer');
      setCurrentUserId(INITIAL_USERS[0].id);
      setOnboardingIntent('none');
      addNotification('تم تسجيل الخروج', 'يرجى تسجيل الدخول للوصول إلى مميزات منصة طلبي', 'info');
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
          storePayments,
        })
      );
    } catch (e) {
      console.warn('Failed to persist to localStorage', e);
    }
  }, [stores, products, orders, couriers, conversations, auditLogs, ratings, restaurantApplications, courierApplications, storePayments]);

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

  const recordStorePayment = async (
    storeId: string,
    amount: number,
    paymentMethod: StorePaymentRecord['paymentMethod'],
    receiptNumber: string,
    notes: string,
    paymentDate: string
  ): Promise<{ success: boolean; error?: string }> => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return { success: false, error: 'المتجر غير موجود' };

    const paymentRecord: StorePaymentRecord = {
      id: 'pay_' + Date.now(),
      storeId,
      storeName: store.name,
      amount,
      paymentDate,
      paymentMethod,
      receiptNumber,
      notes,
      confirmedBy: `${currentUser.name} (${currentUser.role})`,
      createdAt: new Date().toISOString(),
    };

    setStorePayments((prev) => [paymentRecord, ...prev]);
    addAuditLog('RECORD_STORE_PAYMENT', 'store', storeId, `تسجيل دفعة مستلمة بمبلغ ${amount.toLocaleString()} د.ع للمطعم ${store.name}`, 'info');
    addNotification('تسجيل دفعة مستلمة', `تم توثيق سند قبض بمبلغ ${amount.toLocaleString()} د.ع لصالح ${store.name}`);

    if (!isSimulatedOffline) {
      try {
        await setDoc(doc(db, 'store_payments', paymentRecord.id), paymentRecord);
      } catch (err) {
        console.warn('Failed to sync payment to Firestore', err);
      }
    }

    return { success: true };
  };

  const suspendStoreDueToDues = async (storeId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return { success: false, error: 'المتجر غير موجود' };

    const timestamp = new Date().toISOString();
    const actor = `${currentUser.name} (${currentUser.role})`;

    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          return {
            ...s,
            isOpen: false,
            isSuspendedDueToDues: true,
            suspensionReason: reason,
            suspendedAt: timestamp,
            suspendedBy: actor,
          };
        }
        return s;
      })
    );

    addAuditLog('SUSPEND_STORE_DUES', 'store', storeId, `إيقاف المطعم مؤقتاً بسبب المستحقات المالية: ${reason}`, 'warning');
    addNotification('إيقاف مؤقت للمطعم', `تم تعليق عمل المطعم ${store.name} مؤقتاً لعدم سداد المستحقات.`, 'warning');

    if (!isSimulatedOffline) {
      try {
        await updateDoc(doc(db, 'stores', storeId), {
          isOpen: false,
          isSuspendedDueToDues: true,
          suspensionReason: reason,
          suspendedAt: timestamp,
          suspendedBy: actor,
        });
      } catch (err) {
        console.warn('Failed to sync suspension to Firestore', err);
      }
    }

    return { success: true };
  };

  const reactivateStore = async (storeId: string): Promise<{ success: boolean; error?: string }> => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return { success: false, error: 'المتجر غير موجود' };

    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          return {
            ...s,
            isSuspendedDueToDues: false,
            suspensionReason: undefined,
            suspendedAt: undefined,
            suspendedBy: undefined,
          };
        }
        return s;
      })
    );

    addAuditLog('REACTIVATE_STORE', 'store', storeId, `إعادة تفعيل المطعم ${store.name} بعد تسوية المستحقات`, 'info');
    addNotification('إعادة تفعيل المتجر', `تم استئناف عمل المطعم ${store.name} بنجاح.`);

    if (!isSimulatedOffline) {
      try {
        await updateDoc(doc(db, 'stores', storeId), {
          isSuspendedDueToDues: false,
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
        });
      } catch (err) {
        console.warn('Failed to sync reactivation to Firestore', err);
      }
    }

    return { success: true };
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
      ...(typeof distanceKm === 'number' && distanceKm > 0 ? { deliveryDistanceKm: distanceKm } : {}),
      isDistanceBasedFee,
      ...(distanceBaseFeeApplied !== undefined ? { distanceBaseFeeApplied } : {}),
      ...(distanceFeePerKmApplied !== undefined ? { distanceFeePerKmApplied } : {}),
      ...(distanceMaxFeeApplied !== undefined ? { distanceMaxFeeApplied } : {}),
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
      (firebaseUser &&
        (firebaseUser.email === 'msr33777@gmail.com' ||
          firebaseUser.email === 'admin@talabi.iq' ||
          firebaseUser.email === 'admin.operations@talabi.iq' ||
          (firebaseUser as any).isAdmin));

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
    // 1. Pre-flight Checks (Client-side)
    if (!firebaseUser) {
      return { success: false, error: 'يرجى تسجيل الدخول أولاً لإتمام الطلب.' };
    }

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
    if (!store) return { success: false, error: 'المتجر غير موجود' };

    // 2. Transactional Order Creation (Server-enforced logic)
    try {
      const result = await runTransaction(db, async (transaction) => {
        const statsRef = doc(db, 'user_order_stats', firebaseUser.uid);
        const statsSnap = await transaction.get(statsRef);
        const stats = statsSnap.exists() 
          ? statsSnap.data() 
          : { activeOrderId: null, lastOrderTimestamps: [] };

        // A. Check for existing pending order
        if (stats.activeOrderId) {
          const activeOrderRef = doc(db, 'orders', stats.activeOrderId);
          const activeOrderSnap = await transaction.get(activeOrderRef);
          if (activeOrderSnap.exists()) {
            const status = activeOrderSnap.data().status;
            if (status !== 'delivered' && status !== 'cancelled') {
              throw new Error('PENDING_ORDER');
            }
          }
        }

        // B. Rate Limiting: Max 2 orders in 10 minutes
        const now = Date.now();
        const tenMinsAgo = now - 10 * 60 * 1000;
        const recentOrders = (stats.lastOrderTimestamps || []).filter((t: number) => t > tenMinsAgo);
        
        if (recentOrders.length >= 2) {
          throw new Error('RATE_LIMIT');
        }

        // C. Build Order Document
        const orderId = 'ord_' + Math.floor(100000 + Math.random() * 900000);
        const orderRef = doc(db, 'orders', orderId);
        const idempotencyKey = orderData.idempotencyKey || `idem_${Date.now()}`;

        // Price validation (Anti-tampering)
        const validatedItems = orderData.items.map((item) => {
          const dbProd = products.find((p) => p.id === item.productId);
          const officialPrice = dbProd ? dbProd.price : item.price;
          const optionsTotal = (item.selectedOptions || []).reduce((acc, opt) => acc + (opt.price || 0), 0);
          return { ...item, price: officialPrice + optionsTotal };
        });

        const subtotal = validatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
        const financials = calculateOrderFinancials(subtotal, store.id, orderData.neighborhood, orderData.deliveryDistanceKm);
        const total = subtotal + (orderData.customDeliveryFee ?? financials.customerDeliveryFee) + financials.serviceFee;

        const newOrder: Order = {
          id: orderId,
          idempotencyKey,
          customer: {
            id: firebaseUser.uid,
            name: orderData.customerName,
            phone: orderData.customerPhone,
            phoneVerified: orderData.phoneVerified || false,
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
          deliveryFee: orderData.customDeliveryFee ?? financials.customerDeliveryFee,
          serviceFee: financials.serviceFee,
          total,
          financials: { ...financials, total },
          status: 'created',
          payment: {
            method: orderData.paymentMethod,
            status: orderData.paymentMethod === 'cash_on_delivery' ? 'pending' : 'completed',
            amount: total,
          },
          events: [{
            id: 'ev_' + Date.now(),
            orderId,
            status: 'created',
            timestamp: new Date().toLocaleTimeString('ar-IQ'),
            note: 'تم استلام الطلب وبانتظار موافقة المطعم',
            actorRole: 'customer',
            actorName: orderData.customerName,
          }],
          createdAt: new Date().toLocaleTimeString('ar-IQ'),
        };

        // D. Commit changes atomically
        transaction.set(orderRef, newOrder);
        transaction.set(statsRef, {
          activeOrderId: orderId,
          lastOrderTimestamps: [...recentOrders, now].slice(-2),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        return { orderId };
      });

      addNotification('تم إرسال الطلب', 'طلبك الآن قيد المراجعة من قبل المطعم', 'success');
      clearCart();
      if (result.orderId) setActiveTrackedOrderId(result.orderId);
      
      addAuditLog(
        'ORDER_CREATED',
        'order',
        result.orderId || 'unknown',
        `إنشاء طلب جديد رقم #${result.orderId} للمتجر (${store.name})`
      );

      return { success: true, orderId: result.orderId };

    } catch (err: any) {
      console.error('Order creation failed:', err);
      let userMsg = 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.';
      if (err.message === 'PENDING_ORDER') {
        userMsg = 'لديك طلب حالي قيد التنفيذ. يرجى متابعة طلبك السابق قبل إنشاء طلب جديد.';
      } else if (err.message === 'RATE_LIMIT') {
        userMsg = 'لقد وصلت للحد الأقصى من الطلبات المسموحة (طلبان خلال 10 دقائق). يرجى الانتظار قليلاً.';
      } else if (err.code === 'permission-denied') {
        userMsg = 'تم رفض الطلب من قبل خادم الأمان. تأكد من تسجيل الدخول وصحة البيانات.';
      }
      addNotification('تعذر إرسال الطلب', userMsg, 'error');
      return { success: false, error: userMsg };
    }
  };

  // Dedicated Admin/QA test order creator with full Firestore persistence
  const createTestOrder = async (options?: {
    storeId?: string;
    customerName?: string;
    customerPhone?: string;
    neighborhood?: string;
    address?: string;
    paymentMethod?: PaymentMethod;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> => {
    try {
      const targetStoreId = options?.storeId || stores[0]?.id || 'store_1';
      const store = stores.find((s) => s.id === targetStoreId) || stores[0];
      if (!store) {
        return { success: false, error: 'لم يتم العثور على المتجر المحدد لإنشاء الطلب' };
      }

      // Find store products or generate representative test items
      const storeProds = products.filter((p) => p.storeId === store.id);
      const testItems: OrderItem[] =
        storeProds.length > 0
          ? [
              {
                productId: storeProds[0].id,
                name: storeProds[0].name,
                price: storeProds[0].price,
                quantity: 2,
                notes: 'طلب تجريبي - تحضير فوري',
              },
            ]
          : [
              {
                productId: 'prod_test_1',
                name: 'وجبة كباب عراقي مشوي (تجريبي)',
                price: 12000,
                quantity: 1,
                notes: 'طلب تجريبي لفحص النظام',
              },
            ];

      const subtotal = testItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
      const orderId = 'ord_' + Math.floor(100000 + Math.random() * 900000);
      const idempotencyKey = `idem_admin_test_${orderId}_${Date.now()}`;
      const neighborhood = options?.neighborhood || 'بغداد - المنصور';

      const financials = calculateOrderFinancials(subtotal, store.id, neighborhood, 3.5);
      const deliveryFee = store.deliveryFee || 3000;
      financials.customerDeliveryFee = deliveryFee;
      const serviceFee = financials.serviceFee || 1000;
      const total = subtotal + deliveryFee + serviceFee;
      financials.total = total;

      const customerName = options?.customerName || 'أحمد سالم (طلب تجريبي)';
      const customerPhone = options?.customerPhone || '07701234567';
      const address = options?.address || 'شارع 14 رمضان، مقابل مول المنصور';
      const paymentMethod = options?.paymentMethod || 'cash_on_delivery';

      const nowTimeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

      const newOrder: Order = {
        id: orderId,
        idempotencyKey,
        customer: {
          id: 'user_cust_1',
          name: customerName,
          phone: customerPhone,
          phoneVerified: true,
          address,
          neighborhood,
          notes: 'طلب تجريبي أُنشئ من وضع المدير للتحقق من تدفق الطلب للمطعم والمندوب',
          coordinates: { lat: 33.3152, lng: 44.3541 },
        },
        storeId: store.id,
        storeName: store.name,
        storeAddress: store.address,
        merchantUserId: store.merchantUserId,
        items: testItems,
        subtotal,
        deliveryFee,
        deliveryDistanceKm: 3.5,
        serviceFee,
        total,
        financials,
        status: 'created', // Starts strictly at 'created' so restaurant accepts it first
        payment: {
          method: paymentMethod,
          status: paymentMethod === 'cash_on_delivery' ? 'pending' : 'completed',
          ...(paymentMethod !== 'cash_on_delivery'
            ? {
                transactionRef: `TX-TEST-${Date.now()}`,
                paidAt: nowTimeStr,
              }
            : {}),
          amount: total,
        },
        events: [
          {
            id: 'ev_' + Date.now(),
            orderId,
            status: 'created',
            timestamp: nowTimeStr,
            note: 'تم إنشاء الطلب التجريبي من وضع المدير (غرفة العمليات)',
            actorRole: 'admin',
            actorName: 'مدير العمليات',
          },
        ],
        createdAt: nowTimeStr,
        estimatedDeliveryTime: '25 - 35 دقيقة',
        isTest: true,
      };

      // 1. Update React state immediately
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== orderId)]);
      setActiveTrackedOrderId(orderId);

      // 2. Direct Firestore write
      try {
        await setDoc(doc(db, 'orders', orderId), newOrder);
        console.log('[TALABI Diagnostic] Test order created and persisted in Firestore:', {
          orderId,
          storeId: store.id,
          storeName: store.name,
          status: newOrder.status,
          collection: 'orders',
        });
      } catch (dbErr) {
        console.error('[TALABI Diagnostic] Firestore write error for test order:', dbErr);
        handleFirestoreError(dbErr, OperationType.CREATE, `orders/${orderId}`);
      }

      addAuditLog(
        'TEST_ORDER_CREATED',
        'order',
        orderId,
        `إنشاء طلب تجريبي رقم #${orderId} للمتجر (${store.name}) بمبلغ ${total.toLocaleString()} د.ع وتثبيته في Firebase`
      );

      addNotification(
        'تم إنشاء الطلب التجريبي بنجاح!',
        `الطلب #${orderId.slice(-6)} جاهز وظهر في شاشة المتجر (${store.name}) للموافقة والتحضير`,
        'success',
        orderId
      );

      return { success: true, orderId };
    } catch (err: any) {
      console.error('[TALABI Diagnostic] Failed to create test order:', err);
      return { success: false, error: err?.message || 'تعذر إنشاء الطلب التجريبي' };
    }
  };

  // إتمام الطلب التجريبي فورياً (Complete Test Order to Delivered)
  const completeTestOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (currentUser.role !== 'admin') {
        const errorMsg = 'عذراً، صلاحية إتمام الطلبات التجريبية محصورة بحساب المدير فقط.';
        addNotification('غير مصرح', errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) {
        return { success: false, error: 'الطلب غير موجود في النظام' };
      }

      const isOrderTest =
        targetOrder.isTest ||
        targetOrder.customer?.name?.includes('تجريبي') ||
        targetOrder.idempotencyKey?.includes('test') ||
        targetOrder.id.startsWith('ord_test');

      if (!isOrderTest) {
        const errorMsg = 'لا يمكن تنفيذ هذا الإجراء إلا على الطلبات التجريبية لحماية الطلبات الفعلية للزبائن.';
        addNotification('إجراء غير مسموح', errorMsg, 'warning');
        return { success: false, error: errorMsg };
      }

      const nowTimeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const completionEvent: OrderEvent = {
        id: 'ev_' + Date.now() + Math.random().toString(36).substring(2, 5),
        orderId,
        status: 'delivered',
        timestamp: nowTimeStr,
        note: 'تم إتمام وتوصيل الطلب التجريبي بنجاح عبر إدارة العمليات (وضع المدير التجريبي)',
        actorRole: 'admin',
        actorName: currentUser.name || 'مدير العمليات',
      };

      const updatedPayment: PaymentDetails = {
        ...targetOrder.payment,
        status: 'completed',
        paidAt: nowTimeStr,
      };

      const updatedOrder: Order = {
        ...targetOrder,
        status: 'delivered',
        payment: updatedPayment,
        events: [...targetOrder.events, completionEvent],
      };

      // 1. Update React state
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));

      // 2. Direct Firestore write and stats cleanup
      try {
        await setDoc(doc(db, 'orders', orderId), updatedOrder);
        if (updatedOrder.customer?.id) {
          const statsRef = doc(db, 'user_order_stats', updatedOrder.customer.id);
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(statsRef);
            if (snap.exists() && snap.data().activeOrderId === orderId) {
              tx.update(statsRef, { activeOrderId: null });
            }
          });
        }
        console.log('[TALABI Diagnostic] Test order completed and persisted to Firestore:', orderId);
      } catch (dbErr) {
        console.error('[TALABI Diagnostic] Firestore write error in completeTestOrder:', dbErr);
        handleFirestoreError(dbErr, OperationType.UPDATE, `orders/${orderId}`);
      }

      addAuditLog(
        'TEST_ORDER_COMPLETED',
        'order',
        orderId,
        `إتمام الطلب التجريبي رقم #${orderId} بنجاح وتحويل حالته إلى "delivered" وحفظه في Firebase`
      );

      addNotification(
        'تم إتمام الطلب التجريبي بنجاح!',
        `تم تحديث الطلب التجريبي #${orderId.slice(-6)} إلى "مكتمل (delivered)" ومزامنته في Firebase`,
        'success',
        orderId
      );

      return { success: true };
    } catch (err: any) {
      console.error('[TALABI Diagnostic] Failed to complete test order:', err);
      return { success: false, error: err?.message || 'تعذر إتمام الطلب التجريبي' };
    }
  };

  // تقديم مرحلة واحدة في دورة الطلب التجريبي (Advance Test Order Stage)
  const advanceTestOrderStage = async (
    orderId: string
  ): Promise<{ success: boolean; nextStatus?: OrderStatus; error?: string }> => {
    try {
      if (currentUser.role !== 'admin') {
        return { success: false, error: 'غير مصرح لغير المدير' };
      }

      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) {
        return { success: false, error: 'الطلب غير موجود' };
      }

      const isOrderTest =
        targetOrder.isTest ||
        targetOrder.customer?.name?.includes('تجريبي') ||
        targetOrder.idempotencyKey?.includes('test') ||
        targetOrder.id.startsWith('ord_test');

      if (!isOrderTest) {
        return { success: false, error: 'هذا الإجراء متاح فقط للطلبات التجريبية' };
      }

      let nextStatus: OrderStatus = 'delivered';
      let stageNote = '';

      if (targetOrder.status === 'created') {
        nextStatus = 'merchant_accepted';
        stageNote = 'وافق المطعم على الطلب وبدأ التجهيز';
      } else if (targetOrder.status === 'merchant_accepted') {
        nextStatus = 'preparing';
        stageNote = 'المطعم يقوم بتحضير وجبة الطلب التجريبي';
      } else if (targetOrder.status === 'preparing') {
        nextStatus = 'ready_for_pickup';
        stageNote = 'وجبة الطلب التجريبي جاهزة للتسليم وبانتظار الكابتن (متاحة لواجهة المندوب)';
      } else if (targetOrder.status === 'ready_for_pickup') {
        nextStatus = 'picked_up';
        stageNote = 'استلم الكابتن الطلب وهو في الطريق لعنوان الزبون التجريبي';
      } else if (targetOrder.status === 'picked_up' || targetOrder.status === 'courier_assigned') {
        nextStatus = 'courier_arrived';
        stageNote = 'وصل الكابتن إلى عنوان الزبون التجريبي وهو عند الباب';
      } else if (targetOrder.status === 'courier_arrived') {
        nextStatus = 'delivered';
        stageNote = 'تم تسليم الطلب التجريبي للزبون بنجاح واستلام المبلغ';
      } else {
        return { success: false, error: 'الطلب مكتمل أو ملغي بالفعل' };
      }

      const nowTimeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const stageEvent: OrderEvent = {
        id: 'ev_' + Date.now() + Math.random().toString(36).substring(2, 5),
        orderId,
        status: nextStatus,
        timestamp: nowTimeStr,
        note: stageNote,
        actorRole: 'admin',
        actorName: currentUser.name || 'مدير العمليات',
      };

      const updatedPayment: PaymentDetails = {
        ...targetOrder.payment,
        status: nextStatus === 'delivered' ? 'completed' : targetOrder.payment.status,
        paidAt: nextStatus === 'delivered' ? nowTimeStr : targetOrder.payment.paidAt,
      };

      // Assign first online courier or default courier if moving to picked_up
      const assignedCourier = couriers.find((c) => c.isOnline) || couriers[0];
      const courierFields =
        (nextStatus === 'picked_up' || nextStatus === 'courier_arrived') && !targetOrder.courierId
          ? {
              courierId: assignedCourier?.id || 'courier_1',
              courierName: assignedCourier?.name || 'أحمد محمد',
              courierPhone: assignedCourier?.phone || '07701234567',
            }
          : {};

      const updatedOrder: Order = {
        ...targetOrder,
        ...courierFields,
        status: nextStatus,
        payment: updatedPayment,
        events: [...targetOrder.events, stageEvent],
        ...(nextStatus === 'courier_arrived'
          ? { courierArrivedAt: nowTimeStr }
          : targetOrder.courierArrivedAt
          ? { courierArrivedAt: targetOrder.courierArrivedAt }
          : {}),
      };

      setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));

      try {
        await setDoc(doc(db, 'orders', orderId), updatedOrder);
        console.log('[TALABI Diagnostic] Test order advanced to:', nextStatus);
      } catch (dbErr) {
        console.error('[TALABI Diagnostic] Firestore write error in advanceTestOrderStage:', dbErr);
        handleFirestoreError(dbErr, OperationType.UPDATE, `orders/${orderId}`);
      }

      addAuditLog(
        'TEST_ORDER_ADVANCED',
        'order',
        orderId,
        `تقديم مرحلة الطلب التجريبي #${orderId} إلى "${nextStatus}"`
      );

      addNotification(
        'تحديث مرحلة الطلب التجريبي',
        `انتقل الطلب #${orderId.slice(-6)} إلى مرحلة: ${stageNote}`,
        'info',
        orderId
      );

      return { success: true, nextStatus };
    } catch (err: any) {
      console.error('[TALABI Diagnostic] Failed to advance test order stage:', err);
      return { success: false, error: err?.message || 'تعذر تقديم مرحلة الطلب التجريبي' };
    }
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
            ...(status === 'courier_arrived'
              ? { courierArrivedAt: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }
              : o.courierArrivedAt
              ? { courierArrivedAt: o.courierArrivedAt }
              : {}),
          };
          updatedTargetOrder = res;
          return res;
        }
        return o;
      })
    );

    // Sync to Firestore with diagnostic logs and clear active order if needed
    if (updatedTargetOrder) {
      const orderRef = doc(db, 'orders', orderId);
      const isFinished = status === 'delivered' || status === 'cancelled';
      
      const syncTask = async () => {
        try {
          await setDoc(orderRef, updatedTargetOrder);
          
          if (isFinished && updatedTargetOrder?.customer?.id) {
            const statsRef = doc(db, 'user_order_stats', updatedTargetOrder.customer.id);
            // We only clear if THIS order is the active one
            await runTransaction(db, async (tx) => {
              const snap = await tx.get(statsRef);
              if (snap.exists() && snap.data().activeOrderId === orderId) {
                tx.update(statsRef, { activeOrderId: null });
              }
            });
          }
          
          console.log('[TALABI Diagnostic] Order status successfully updated and stats synced:', { orderId, status });
        } catch (err) {
          console.error('[TALABI Diagnostic] Firestore status sync error:', err);
        }
      };
      
      syncTask();
    }

    addAuditLog('ORDER_STATUS_UPDATED', 'order', orderId, `تغيير حالة الطلب #${orderId} إلى: ${status} (${note})`);
    addNotification(`تحديث على الطلب #${orderId}`, note, status === 'courier_arrived' ? 'success' : 'info', orderId);
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

    if (targetOrder.courierId) {
      const cId = targetOrder.courierId;
      setCouriers((prev) =>
        prev.map((c) => (c.id === cId || c.currentOrderId === orderId ? { ...c, isBusy: false, currentOrderId: undefined } : c))
      );
      if (!isSimulatedOffline) {
        try {
          setDoc(doc(db, 'couriers', cId), { isBusy: false, currentOrderId: null }, { merge: true }).catch(() => {});
        } catch {
          // fail gracefully
        }
      }
    }

    if (cancelledOrder) {
      const finalCancelled = cancelledOrder;
      const syncTask = async () => {
        try {
          await setDoc(doc(db, 'orders', orderId), finalCancelled);
          if (finalCancelled.customer?.id) {
            const statsRef = doc(db, 'user_order_stats', finalCancelled.customer.id);
            await runTransaction(db, async (tx) => {
              const snap = await tx.get(statsRef);
              if (snap.exists() && snap.data().activeOrderId === orderId) {
                tx.update(statsRef, { activeOrderId: null });
              }
            });
          }
        } catch (err) {
          console.error('Cancel order sync error:', err);
        }
      };
      syncTask();
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
            // Preserve the merchant's preparation lifecycle status (created/merchant_accepted/preparing/ready_for_pickup)
            status: o.status,
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
    claimOrderAtomically(orderId, courierId);
  };

  const claimOrderAtomically = async (
    orderId: string,
    courierId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const courier = couriers.find((c) => c.id === courierId || c.userId === courierId);
    if (courier && courier.approvalStatus && courier.approvalStatus !== 'approved') {
      const statusLabel = courier.approvalStatus === 'pending' ? 'بانتظار موافقة الإدارة' : 'معلق مؤقتاً';
      addNotification('غير مصرح', `لا يمكنك قبول الطلبات؛ حساب الكابتن (${statusLabel}).`, 'error');
      return { success: false, error: `حساب الكابتن (${statusLabel})` };
    }

    // Check if courier already holds an active order
    const cId = courier?.id || courierId;
    const existingActive = orders.find(
      (o) =>
        (o.courierId === cId || o.courierId === courierId) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    );
    if (existingActive) {
      const errMsg = 'لديك طلب نشط بالفعل قيد التوصيل. يجب إتمام الطلب الحالي أولاً.';
      addNotification('قبول محظور', errMsg, 'warning');
      return { success: false, error: errMsg };
    }

    // Local check on order status
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return { success: false, error: 'الطلب غير موجود' };
    }
    if (targetOrder.courierId && targetOrder.courierId !== cId) {
      const errMsg = 'عذراً، سبقك كابتن آخر لقبول هذا الطلب!';
      addNotification('الطلب محجوز', errMsg, 'error');
      return { success: false, error: errMsg };
    }

    const cName = courier?.name || currentUser.name || 'الكابتن';

    if (!isSimulatedOffline) {
      try {
        const orderRef = doc(db, 'orders', orderId);
        const courierRef = doc(db, 'couriers', cId);

        await runTransaction(db, async (transaction) => {
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists()) {
            throw new Error('الطلب غير موجود في قاعدة البيانات');
          }
          const orderData = orderSnap.data() as Order;

          if (orderData.courierId && orderData.courierId !== cId) {
            throw new Error('عذراً، سبقك كابتن آخر لقبول هذا الطلب!');
          }
          if (orderData.status === 'delivered' || orderData.status === 'cancelled') {
            throw new Error('الطلب ملغي أو تم تسليمه مسبقاً');
          }

          const nowStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
          const updatedEvents = [
            ...(orderData.events || []),
            {
              id: 'ev_' + Date.now(),
              orderId,
              status: orderData.status,
              timestamp: nowStr,
              note: `تم قبول العرض وحجز الطلب للكابتن ${cName} (بانتظار تجهيز المطعم للوجبة)`,
              actorRole: 'courier' as UserRole,
              actorName: cName,
            },
          ];

          transaction.update(
            orderRef,
            cleanFirestorePayload({
              courierId: cId,
              courierName: cName,
              courierPhone: courier?.phone || '07701234567',
              // Retain current preparation status so restaurant flow continues undisturbed
              status: orderData.status,
              events: updatedEvents,
              offeredToCourierId: null,
              offeredAt: null,
            })
          );

          const courierSnap = await transaction.get(courierRef);
          if (courierSnap.exists()) {
            transaction.update(
              courierRef,
              cleanFirestorePayload({
                isBusy: true,
                currentOrderId: orderId,
              })
            );
          }
        });
      } catch (transErr: any) {
        console.warn('Transaction claim error:', transErr);
        const errMsg = transErr?.message || 'عذراً، سبقك كابتن آخر لقبول هذا الطلب!';
        addNotification('تعذر قبول الطلب', errMsg, 'error');
        return { success: false, error: errMsg };
      }
    }

    // Local state sync
    assignCourierToOrder(orderId, cId);
    setCouriers((prev) =>
      prev.map((c) => (c.id === cId ? { ...c, isBusy: true, currentOrderId: orderId } : c))
    );

    addNotification('تم قبول الطلب بنجاح!', `تم حجز الطلب #${orderId.slice(-6)} حكراً لك ككابتن`, 'success');
    addAuditLog('ORDER_CLAIMED_ATOMIC', 'order', orderId, `قبول ذري للطلب #${orderId} بواسطة الكابتن ${cName}`);
    return { success: true };
  };

  const rejectOrderOffer = async (orderId: string, courierId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const rejected = o.rejectedCourierIds || [];
          return {
            ...o,
            rejectedCourierIds: [...rejected, courierId],
            offeredToCourierId: undefined,
            offeredAt: undefined,
          };
        }
        return o;
      })
    );

    if (!isSimulatedOffline) {
      try {
        await setDoc(
          doc(db, 'orders', orderId),
          {
            rejectedCourierIds: arrayUnion(courierId),
            offeredToCourierId: null,
            offeredAt: null,
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed to reject order offer in Firestore', e);
      }
    }
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
      if (!firebaseUser) return { success: false, error: 'يجب تسجيل الدخول أولاً' };
      console.log('Submitting restaurant app to Firestore...', { data });
      if (restaurantApplications.some((a) => a.userId === firebaseUser.uid && a.status === 'pending')) {
        return { success: false, error: 'لديك طلب انضمام مطعم قيد المراجعة بالفعل' };
      }

      const id = 'app_rest_' + Date.now();
      const newApp: RestaurantApplication = {
        ...data,
        id,
        userId: firebaseUser.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setRestaurantApplications((prev) => [newApp, ...prev.filter((a) => a.id !== id)]);

      if (!isSimulatedOffline) {
        await setDoc(doc(db, 'restaurant_applications', id), newApp);
      }

      addAuditLog('RESTAURANT_APPLICATION_SUBMITTED', 'store', id, `تقديم طلب انضمام مطعم جديد: ${data.storeName} (${data.ownerPhone})`);
      addNotification('تم إرسال طلب الانضمام بنجاح', `طلب انضمام ${data.storeName} قيد مراجعة الإدارة الآن`, 'info');
      setOnboardingIntent('none');
      console.log('Restaurant app submitted successfully', { id });

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
      if (!firebaseUser) return { success: false, error: 'يجب تسجيل الدخول أولاً' };
      console.log('Submitting courier app to Firestore...', { data });
      if (courierApplications.some((a) => a.userId === firebaseUser.uid && a.status === 'pending')) {
        return { success: false, error: 'لديك طلب انضمام كابتن قيد المراجعة بالفعل' };
      }

      const id = 'app_cour_' + Date.now();
      const newApp: CourierApplication = {
        ...data,
        id,
        userId: firebaseUser.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setCourierApplications((prev) => [newApp, ...prev.filter((a) => a.id !== id)]);

      if (!isSimulatedOffline) {
        await setDoc(doc(db, 'courier_applications', id), newApp);
      }

      addAuditLog('COURIER_APPLICATION_SUBMITTED', 'courier', id, `تقديم طلب كابتن جديد: ${data.fullName} (${data.vehicleType})`);
      addNotification('تم إرسال طلب الانضمام ككابتن', `طلب انضمام الكابتن ${data.fullName} قيد التدقيق لدى الإدارة`, 'info');
      setOnboardingIntent('none');
      console.log('Courier app submitted successfully', { id });

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
      (firebaseUser &&
        (firebaseUser.email === 'msr33777@gmail.com' ||
          firebaseUser.email === 'admin@talabi.iq' ||
          firebaseUser.email === 'admin.operations@talabi.iq' ||
          (firebaseUser as any).isAdmin));

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
      (firebaseUser &&
        (firebaseUser.email === 'msr33777@gmail.com' ||
          firebaseUser.email === 'admin@talabi.iq' ||
          firebaseUser.email === 'admin.operations@talabi.iq' ||
          (firebaseUser as any).isAdmin));

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
        createTestOrder,
        completeTestOrder,
        advanceTestOrderStage,
        updateOrderStatus,
        cancelOrder,
        assignCourierToOrder,
        couriers,
        toggleCourierStatus,
        courierAcceptOrder,
        claimOrderAtomically,
        rejectOrderOffer,
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
        userApplication,
        onboardingIntent,
        setOnboardingIntent,
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
        storePayments,
        recordStorePayment,
        suspendStoreDueToDues,
        reactivateStore,
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
