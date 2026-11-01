import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';

import firebaseConfig from './firebase-applet-config.json';

const activeProjectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const activeDatabaseId =
  process.env.FIRESTORE_DATABASE_ID ||
  (process.env.FIRESTORE_EMULATOR_HOST ? '(default)' : firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin SDK for server-side ID token verification and database access
if (!getAdminApps().length) {
  initAdminApp({
    projectId: activeProjectId,
  });
}

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Initialize Admin Firestore with dedicated project database (or default emulator db when isolated)
const db =
  activeDatabaseId === '(default)'
    ? getAdminFirestore(getAdminApps()[0])
    : getAdminFirestore(getAdminApps()[0], activeDatabaseId);

// Middleware: Authenticate Firebase ID Token and verify courier role
interface AuthenticatedCourierRequest extends express.Request {
  authenticatedCourier?: {
    uid: string;
    courierId: string;
    name: string;
    phone?: string;
    courierData: any;
  };
}

async function requireCourierAuth(
  req: AuthenticatedCourierRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'رمز التحقق مفقود. يجب إرسال رأس Authorization: Bearer <Firebase_ID_Token>'
    });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      success: false,
      error: 'رمز التحقق فارغ'
    });
  }

  try {
    // 1. Verify token cryptographically via Firebase Admin SDK
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const authUid = decodedToken.uid;

    // 2. Verify user exists and role is strictly 'courier'
    const userDocRef = db.collection('users').doc(authUid);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      return res.status(403).json({
        success: false,
        error: 'حساب المستخدم غير مسجل في النظام'
      });
    }

    const userData = userSnap.data()!;
    if (userData.role !== 'courier') {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح: هذا الإجراء مخصص حصراً لمناديب التوصيل المعتمدين'
      });
    }

    // 3. Resolve courier document in /couriers (by ID or by userId)
    let courierDocSnap = await db.collection('couriers').doc(authUid).get();
    if (!courierDocSnap.exists) {
      const couriersCol = db.collection('couriers');
      const qCourier = couriersCol.where('userId', '==', authUid);
      const qSnap = await qCourier.get();
      if (!qSnap.empty) {
        courierDocSnap = qSnap.docs[0];
      }
    }

    if (!courierDocSnap || !courierDocSnap.exists) {
      return res.status(403).json({
        success: false,
        error: 'ملف المندوب غير موجود في منظومة المناديب'
      });
    }

    const courierData = courierDocSnap.data()!;

    // 4. Verify courier account is active / approved
    if (courierData.approvalStatus && courierData.approvalStatus !== 'approved') {
      const statusLabel = courierData.approvalStatus === 'pending' ? 'قيد المراجعة' : 'معلق مؤقتاً';
      return res.status(403).json({
        success: false,
        error: `حساب الكابتن غير مفعل (${statusLabel})`
      });
    }

    req.authenticatedCourier = {
      uid: authUid,
      courierId: courierDocSnap.id,
      name: courierData.name || userData.name || 'الكابتن',
      phone: courierData.phone || userData.phone || '',
      courierData: courierData
    };

    next();
  } catch (authErr: any) {
    return res.status(401).json({
      success: false,
      error: `رمز التحقق غير صالح أو منتهي الصلاحية: ${authErr?.message || String(authErr)}`
    });
  }
}

// Middleware: Authenticate any Firebase User via ID Token
interface AuthenticatedUserRequest extends express.Request {
  authenticatedUser?: {
    uid: string;
    role: string;
    name: string;
    email?: string;
    tokenRole?: string;
  };
}

async function requireUserAuth(
  req: AuthenticatedUserRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'رمز التحقق مفقود. يجب إرسال رأس Authorization: Bearer <Firebase_ID_Token>'
    });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      success: false,
      error: 'رمز التحقق فارغ'
    });
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const authUid = decodedToken.uid;

    // Strict Security Rule: Admin privileges require cryptographic verification from Custom Claims ONLY!
    // users/{uid} document in Firestore MUST NEVER be used to confer 'admin' role!
    const tokenRole = (decodedToken.role as string) || '';
    const hasAdminClaim = tokenRole === 'admin';

    let role = hasAdminClaim ? 'admin' : (tokenRole || 'customer');
    let name = decodedToken.name || 'مستخدم';
    let email = decodedToken.email;

    try {
      const userDocRef = db.collection('users').doc(authUid);
      const userSnap = await userDocRef.get();
      if (userSnap.exists) {
        const uData = userSnap.data()!;
        name = uData.name || name;
        if (!hasAdminClaim) {
          // If Firestore user doc claims to be 'admin', explicitly reject elevation!
          if (uData.role === 'admin') {
            console.warn(`[SECURITY WARNING] User ${authUid} has role: 'admin' in Firestore user doc but lacks trusted token claim. Role elevation blocked!`);
          }
          // Only allow non-admin operational roles (merchant/courier) from Firestore doc
          if (uData.role && uData.role !== 'admin') {
            role = uData.role;
          }
        }
      }
    } catch (dbErr) {
      console.warn('[requireUserAuth] Firestore userDoc fallback to token claims:', dbErr);
    }

    req.authenticatedUser = {
      uid: authUid,
      role,
      name,
      email,
      tokenRole
    };
    next();
  } catch (authErr: any) {
    return res.status(401).json({
      success: false,
      error: `رمز التحقق غير صالح أو منتهي الصلاحية: ${authErr?.message || String(authErr)}`
    });
  }
}

// Dedicated middleware for Admin-only routes: enforces trusted Custom Claim
function requireAdminAuth(
  req: AuthenticatedUserRequest,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.authenticatedUser?.role !== 'admin' || req.authenticatedUser?.tokenRole !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح: يتطلب هذا الإجراء صلاحية مدير موثوقة حصراً (Admin Custom Claim)'
    });
  }
  next();
}

// Protected Atomic Order Status Update Endpoint (Requires verified Firebase ID Token)
app.post('/api/orders/status', requireUserAuth, async (req: AuthenticatedUserRequest, res) => {
  const { orderId, status, note } = req.body;
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ success: false, error: 'حالة الطلب status مطلوبة' });
  }

  const authUser = req.authenticatedUser!;
  const authUid = authUser.uid;
  const userRole = authUser.role;
  const userName = authUser.name;

  try {
    const orderRef = db.collection('orders').doc(orderId);

    const updateResult = await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      if (!oSnap.exists) {
        throw new Error('الطلب غير موجود في النظام');
      }

      const order = oSnap.data()!;

      // Verify permissions: Courier assigned to this order, merchant, or admin/support
      const isCourier = userRole === 'courier';
      const isMerchant = userRole === 'merchant';
      const isAdmin = userRole === 'admin' || userRole === 'support';
      const isCustomer = userRole === 'customer';

      if (isCourier) {
        if (order.courierId !== authUid) {
          const courierDocRef = db.collection('couriers').doc(authUid);
          const cSnap = await tx.get(courierDocRef);
          const cId = cSnap.exists ? cSnap.id : authUid;
          if (order.courierId !== cId) {
            throw new Error('غير مصرح: هذا الطلب غير مسند إليك');
          }
        }
      } else if (isMerchant) {
        if (order.merchantUserId !== authUid && order.merchantId !== authUid && order.storeId !== authUid) {
          throw new Error('غير مصرح: هذا الطلب لا يتبع لمتجرك');
        }
      } else if (isCustomer) {
        if (order.customer?.id !== authUid) {
          throw new Error('غير مصرح: لا يمكنك تعديل طلب يخص زبوناً آخر');
        }
      } else if (!isAdmin) {
        throw new Error('غير مصرح لك بتعديل حالة هذا الطلب');
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const newEvent = {
        id: 'ev_' + Date.now(),
        orderId,
        status,
        timestamp: nowTime,
        note: note || `تحديث حالة الطلب إلى: ${status}`,
        actorRole: userRole,
        actorName: userName,
      };

      const isDeliveredTransition = status === 'delivered';
      const deliveredAtTimestamp = isDeliveredTransition
        ? (order.deliveredAtTimestamp || Date.now())
        : (order.deliveredAtTimestamp || null);
      const deliveredAt = isDeliveredTransition
        ? (order.deliveredAt || new Date().toISOString())
        : (order.deliveredAt || null);

      const updatedPayment = {
        ...(order.payment || {}),
        ...(isDeliveredTransition && order.payment?.method === 'cash_on_delivery'
          ? { status: 'completed', paidAt: nowTime }
          : {})
      };

      const orderUpdates: Record<string, any> = {
        status,
        payment: updatedPayment,
        events: [...(order.events || []), newEvent],
        ...(deliveredAtTimestamp ? { deliveredAtTimestamp, deliveredAt } : {}),
        ...(status === 'courier_arrived'
          ? { courierArrivedAt: nowTime }
          : order.courierArrivedAt
          ? { courierArrivedAt: order.courierArrivedAt }
          : {})
      };

      tx.update(orderRef, orderUpdates);

      // If finished (delivered), atomically release courier and clear customer active order stats
      const isFinished = status === 'delivered';
      if (isFinished) {
        if (order.courierId) {
          const courierRef = db.collection('couriers').doc(order.courierId);
          const cSnap = await tx.get(courierRef);
          if (cSnap.exists) {
            const cData = cSnap.data()!;
            if (cData.currentOrderId === orderId) {
              tx.update(courierRef, {
                isBusy: false,
                currentOrderId: null
              });
            }
          }
        }

        if (order.customer?.id) {
          const statsRef = db.collection('user_order_stats').doc(order.customer.id);
          const statsSnap = await tx.get(statsRef);
          if (statsSnap.exists && statsSnap.data()!.activeOrderId === orderId) {
            tx.update(statsRef, { activeOrderId: null });
          }
        }
      }

      return { success: true, orderId, status };
    });

    res.json(updateResult);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// Protected Atomic Order Cancellation Endpoint (Requires verified Firebase ID Token)
app.post('/api/orders/cancel', requireUserAuth, async (req: AuthenticatedUserRequest, res) => {
  const { orderId, reason } = req.body;
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, error: 'سبب الإلغاء مطلوب لتسجيل العملية' });
  }

  const authUser = req.authenticatedUser!;
  const authUid = authUser.uid;
  const userRole = authUser.role;
  const userName = authUser.name;
  const cleanReason = reason.trim();

  try {
    const orderRef = db.collection('orders').doc(orderId);

    const cancelResult = await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      if (!oSnap.exists) {
        throw new Error('الطلب غير موجود في النظام');
      }

      const order = oSnap.data()!;

      if (order.status === 'cancelled') {
        return { success: true, message: 'الطلب ملغى مسبقاً', orderId };
      }

      if (order.status === 'delivered') {
        throw new Error('لا يمكن إلغاء طلب تم تسليمه للزبون بالفعل');
      }

      const isCustomer = userRole === 'customer';
      const isMerchant = userRole === 'merchant';
      const isAdmin = userRole === 'admin' || userRole === 'support';

      if (isCustomer) {
        if (order.customer?.id !== authUid) {
          throw new Error('غير مصرح: لا يمكنك إلغاء طلب يخص زبوناً آخر');
        }
        const canCustomerCancel = order.status === 'created' || order.status === 'merchant_accepted';
        if (!canCustomerCancel) {
          throw new Error('لا يمكن للزبون إلغاء الطلب بعد بدء تجهيز الطعام في المطبخ لحفظ حقوق المتجر');
        }
      } else if (isMerchant) {
        if (order.merchantUserId !== authUid && order.merchantId !== authUid && order.storeId !== authUid) {
          throw new Error('غير مصرح: هذا الطلب لا يتبع لمتجرك');
        }
      } else if (!isAdmin) {
        throw new Error('غير مصرح لك بإلغاء هذا الطلب');
      }

      if (order.courierId) {
        const courierRef = db.collection('couriers').doc(order.courierId);
        const cSnap = await tx.get(courierRef);
        if (cSnap.exists) {
          const cData = cSnap.data()!;
          if (cData.currentOrderId === orderId) {
            tx.update(courierRef, {
              isBusy: false,
              currentOrderId: null
            });
          }
        }
      }

      if (order.offeredToCourierId) {
        const offCourierRef = db.collection('couriers').doc(order.offeredToCourierId);
        const offSnap = await tx.get(offCourierRef);
        if (offSnap.exists) {
          const offData = offSnap.data()!;
          if (offData.currentOfferOrderId === orderId) {
            tx.update(offCourierRef, {
              currentOfferOrderId: null
            });
          }
        }
      }

      if (order.customer?.id) {
        const statsRef = db.collection('user_order_stats').doc(order.customer.id);
        const statsSnap = await tx.get(statsRef);
        if (statsSnap.exists && statsSnap.data()!.activeOrderId === orderId) {
          tx.update(statsRef, {
            activeOrderId: null
          });
        }
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const cancelEvent = {
        id: 'ev_' + Date.now(),
        orderId,
        status: 'cancelled',
        timestamp: nowTime,
        note: `تم إلغاء الطلب بواسطة ${userName} (${userRole}). السبب: ${cleanReason}`,
        actorRole: userRole,
        actorName: userName
      };

      const updatedPayment = {
        ...(order.payment || {}),
        status: order.payment?.status === 'completed' ? 'refunded' : 'failed'
      };

      tx.update(orderRef, {
        status: 'cancelled',
        cancellationReason: cleanReason,
        cancelledBy: {
          uid: authUid,
          name: userName,
          role: userRole,
          timestamp: new Date().toISOString()
        },
        offeredToCourierId: null,
        offeredAt: null,
        offeredExpireAt: null,
        payment: updatedPayment,
        events: [...(order.events || []), cancelEvent]
      });

      return { success: true, orderId, status: 'cancelled' };
    });

    res.json(cancelResult);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// Dispatch Engine Status & Metrics API (Read-only monitoring)
app.get('/api/dispatch/status', async (req, res) => {
  try {
    const ordersCol = db.collection('orders');
    const couriersCol = db.collection('couriers');

    const dispatchStatuses = ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup', 'courier_offered'];
    const pendingOrdersQuery = ordersCol.where('status', 'in', dispatchStatuses);

    const [ordersSnap, couriersSnap] = await Promise.all([
      pendingOrdersQuery.get(),
      couriersCol.get()
    ]);

    const allOrders = ordersSnap.docs.map(d => d.data());
    const allCouriers = couriersSnap.docs.map(d => d.data());

    const unassignedOrders = allOrders.filter(
      o => !o.courierId && ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup'].includes(o.status)
    );
    const currentlyOffered = unassignedOrders.filter(
      o => o.offeredToCourierId && o.offeredExpireAt && Date.now() < o.offeredExpireAt
    );
    const onlineCouriers = allCouriers.filter(c => c.isOnline);
    const availableCouriers = onlineCouriers.filter(c => !c.isBusy && !c.currentOrderId && !c.currentOfferOrderId);

    res.json({
      success: true,
      metrics: {
        totalOrders: allOrders.length,
        unassignedOrdersCount: unassignedOrders.length,
        activeOffersCount: currentlyOffered.length,
        totalCouriers: allCouriers.length,
        onlineCouriersCount: onlineCouriers.length,
        availableCouriersCount: availableCouriers.length,
        serverTime: Date.now()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Protected Atomic Claim Endpoint (Legacy alias; primary handler is /api/dispatch/claim below)
app.post('/api/dispatch/claim-legacy', requireCourierAuth, async (req: AuthenticatedCourierRequest, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }

  const authenticatedCourierId = req.authenticatedCourier!.courierId;
  const courierName = req.authenticatedCourier!.name;
  const courierPhone = req.authenticatedCourier!.phone || '';

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const courierRef = db.collection('couriers').doc(authenticatedCourierId);

    const result = await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      const cSnap = await tx.get(courierRef);

      if (!oSnap.exists) throw new Error('الطلب غير موجود في النظام');
      if (!cSnap.exists) throw new Error('بيانات المندوب غير موجودة في النظام');

      const order = oSnap.data()!;
      const courier = cSnap.data()!;

      if (order.courierId) {
        throw new Error('الطلب تم حجزه مسبقاً من قبل كابتن آخر');
      }

      if (order.offeredToCourierId !== authenticatedCourierId) {
        throw new Error('عذراً، هذا الطلب غير معروض عليك أو تم تحويله لكابتن آخر');
      }

      const now = Date.now();
      const expireAt = order.offeredExpireAt || (order.offeredAt ? order.offeredAt + 15000 : 0);
      if (expireAt > 0 && now > expireAt) {
        throw new Error('انتهت مهلة استجابة هذا العرض (15 ثانية)');
      }

      if (courier.isBusy || courier.currentOrderId) {
        throw new Error('لديك طلب نشط بالفعل قيد التوصيل، لا يمكنك قبول طلب آخر');
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const events = [
        ...(order.events || []),
        {
          id: 'ev_' + Date.now(),
          orderId,
          status: order.status,
          timestamp: nowTime,
          note: `تم قبول العرض وحجز الطلب رسمياً للكابتن ${courierName}`,
          actorRole: 'courier',
          actorName: courierName
        }
      ];

      tx.update(orderRef, {
        courierId: authenticatedCourierId,
        courierName: courierName,
        courierPhone: courierPhone,
        offeredToCourierId: null,
        offeredAt: null,
        offeredExpireAt: null,
        events,
        status: order.status === 'courier_offered' ? (order.previousStatus || 'created') : order.status
      });

      tx.update(courierRef, {
        isBusy: true,
        currentOrderId: order.id,
        currentOfferOrderId: null
      });

      return { success: true, courierName: courierName, orderId: order.id };
    });

    res.json(result);
  } catch (err: any) {
    res.status(409).json({ success: false, error: err?.message || String(err) });
  }
});

// Protected Location Update Endpoint: Securely updates courierLocation on active order using Admin SDK
app.post('/api/couriers/location', requireCourierAuth, async (req: AuthenticatedCourierRequest, res) => {
  const { orderId, coordinates } = req.body;
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    return res.status(400).json({ success: false, error: 'إحداثيات الموقع (lat, lng) مطلوبة كأرقام صحيحة' });
  }

  const authenticatedCourierId = req.authenticatedCourier!.courierId;
  const authUid = req.authenticatedCourier!.uid;

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const courierRef = db.collection('couriers').doc(authenticatedCourierId);

    const result = await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      const cSnap = await tx.get(courierRef);

      if (!oSnap.exists) {
        throw new Error('الطلب غير موجود');
      }
      if (!cSnap.exists) {
        throw new Error('بيانات المندوب غير موجودة في النظام');
      }

      const orderData = oSnap.data()!;
      const courierData = cSnap.data()!;

      // Verify that this courier's active assigned order strictly matches orderId
      if (!courierData.currentOrderId || courierData.currentOrderId !== orderId) {
        throw new Error('غير مصرح: هذا الطلب ليس هو الطلب النشط المخصص لك حالياً');
      }

      // Verify that this courier actually owns this active order
      const isAssignedCourier =
        orderData.courierId === authenticatedCourierId ||
        orderData.courierId === authUid;

      if (!isAssignedCourier) {
        throw new Error('غير مصرح: هذا الطلب غير مسند إلى حسابك');
      }

      // Verify order is active (not finished or cancelled)
      if (['delivered', 'cancelled'].includes(orderData.status)) {
        throw new Error('لا يمكن تحديث موقع كابتن لطلب تم إتمامه أو إلغاؤه');
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const courierLocationData = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        accuracy: typeof coordinates.accuracy === 'number' ? coordinates.accuracy : 10,
        updatedAt: nowTime,
        isSharingEnabled: true,
      };

      // 1. Update courier location inside order document for customer tracking
      tx.update(orderRef, {
        courierLocation: courierLocationData,
      });

      // 2. Also keep courier document location synchronized
      tx.update(courierRef, {
        currentLocation: typeof coordinates.neighborhood === 'string' && coordinates.neighborhood ? coordinates.neighborhood : 'قيد التوصيل',
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
        },
        updatedAt: nowTime,
      });

      return { success: true, courierLocation: courierLocationData };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// Protected Courier Online/Offline Status Endpoint: Securely toggles status and handles active offer revocation
app.post('/api/couriers/status', requireCourierAuth, async (req: AuthenticatedCourierRequest, res) => {
  const { isOnline } = req.body;
  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ success: false, error: 'حالة الاتصال isOnline مطلوبة كقيمة منطقية' });
  }

  const authenticatedCourierId = req.authenticatedCourier!.courierId;
  const courierName = req.authenticatedCourier!.name;

  try {
    const courierRef = db.collection('couriers').doc(authenticatedCourierId);

    const result = await db.runTransaction(async (tx) => {
      const cSnap = await tx.get(courierRef);
      if (!cSnap.exists) {
        throw new Error('ملف المندوب غير موجود');
      }

      const courierData = cSnap.data()!;
      if (courierData.approvalStatus && courierData.approvalStatus !== 'approved') {
        throw new Error('حساب الكابتن غير معتمد بعد من الإدارة');
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

      // If going offline while having an active pending offer, revoke the offer safely
      const offeredOrderId = courierData.currentOfferOrderId;
      if (!isOnline && offeredOrderId && typeof offeredOrderId === 'string') {
        const orderRef = db.collection('orders').doc(offeredOrderId);
        const oSnap = await tx.get(orderRef);
        if (oSnap.exists) {
          const oData = oSnap.data()!;
          if (oData.offeredToCourierId === authenticatedCourierId && !oData.courierId) {
            const events = [
              ...(oData.events || []),
              {
                id: 'ev_' + Date.now(),
                orderId: offeredOrderId,
                status: oData.status,
                timestamp: nowTime,
                note: `تم سحب العرض بأمان بسبب انقطاع اتصال الكابتن ${courierName}`,
                actorRole: 'system',
                actorName: 'نظام التوزيع الذكي',
              },
            ];
            tx.update(orderRef, {
              offeredToCourierId: null,
              offeredAt: null,
              offeredExpireAt: null,
              events,
              status: oData.status === 'courier_offered' ? (oData.previousStatus || 'created') : oData.status,
            });
          }
        }
      }

      tx.update(courierRef, {
        isOnline,
        currentOfferOrderId: isOnline ? (courierData.currentOfferOrderId || null) : null,
        updatedAt: nowTime,
      });

      return { success: true, isOnline };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// Protected Atomic Rejection / Timeout Release Endpoint (Requires verified Firebase ID Token & courier role)
app.post('/api/dispatch/reject', requireCourierAuth, async (req: AuthenticatedCourierRequest, res) => {
  const { orderId, reason } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }

  const authenticatedCourierId = req.authenticatedCourier!.courierId;
  const courierName = req.authenticatedCourier!.name;
  const isExplicitRejection = reason === 'explicit_rejection' || !reason;

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const courierRef = db.collection('couriers').doc(authenticatedCourierId);

    await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      const cSnap = await tx.get(courierRef);

      if (!oSnap.exists || !cSnap.exists) {
        throw new Error('الطلب أو بيانات المندوب غير موجودة');
      }

      const order = oSnap.data()!;
      const courier = cSnap.data()!;

      if (order.offeredToCourierId !== authenticatedCourierId && courier.currentOfferOrderId !== orderId) {
        throw new Error('هذا الطلب غير مخصص لك لرفضه أو إلغائه');
      }

      const orderUpdates: Record<string, any> = {
        offeredToCourierId: null,
        offeredAt: null,
        offeredExpireAt: null,
      };

      if (order.status === 'courier_offered') {
        orderUpdates.status = order.previousStatus || 'created';
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      if (isExplicitRejection) {
        const rejected = order.rejectedCourierIds || [];
        if (!rejected.includes(authenticatedCourierId)) {
          orderUpdates.rejectedCourierIds = FieldValue.arrayUnion(authenticatedCourierId);
        }
        orderUpdates.events = [
          ...(order.events || []),
          {
            id: 'ev_' + Date.now(),
            orderId,
            status: order.status,
            timestamp: nowTime,
            note: `رفض الكابتن ${courierName} استلام الطلب صراحة - إعادة الطلب لمنظومة التوزيع`,
            actorRole: 'courier',
            actorName: courierName
          }
        ];
      } else {
        const timeouts = order.timeoutCourierIds || [];
        if (!timeouts.includes(authenticatedCourierId)) {
          orderUpdates.timeoutCourierIds = FieldValue.arrayUnion(authenticatedCourierId);
        }
        orderUpdates.events = [
          ...(order.events || []),
          {
            id: 'ev_' + Date.now(),
            orderId,
            status: order.status,
            timestamp: nowTime,
            note: `انتهت مهلة استجابة الكابتن ${courierName} (15 ثانية) دون رد - إعادة الطلب لمنظومة التوزيع`,
            actorRole: 'system',
            actorName: 'نظام التوزيع الذكي'
          }
        ];
      }

      tx.update(orderRef, orderUpdates);

      if (courier.currentOfferOrderId === orderId) {
        tx.update(courierRef, {
          currentOfferOrderId: null
        });
      }
    });

    res.json({ success: true, reason: isExplicitRejection ? 'explicit_rejection' : 'timeout' });
  } catch (err: any) {
    res.status(409).json({ success: false, error: err?.message || String(err) });
  }
});

// ============================================================================
// SOLE DISPATCH ENGINE (محرك التوزيع المركزي الوحيد)
// ============================================================================
const WORKER_LOCK_ID = 'dispatch_worker_lock';
const WORKER_LOCK_TTL_MS = 12000;
let lastLockWarningLoggedAt = 0;
let dispatchWorkerIamNoticeLogged = false;

/**
 * Distributed Leader-Election Lock using Firestore Transactions.
 * Guarantees that across multiple auto-scaled Cloud Run container instances,
 * only ONE active leader worker runs the dispatch loop at any given moment.
 * In-memory fallbacks are eliminated to prevent multi-instance split-brain execution.
 */
async function acquireWorkerLock(workerInstanceId: string): Promise<number | null> {
  const now = Date.now();
  const lockRef = db.collection('platform_settings').doc(WORKER_LOCK_ID);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      let currentFencingToken = 0;

      if (snap.exists) {
        const data = snap.data()!;
        const expiresAt = data.expiresAt || 0;
        currentFencingToken = typeof data.fencingToken === 'number' ? data.fencingToken : 0;
        // Prevent overlap across BOTH different workers (A vs B) AND overlapping cycles of the SAME worker (A vs A)
        if (now < expiresAt && data.owner) {
          return null;
        }
      }

      const nextFencingToken = currentFencingToken + 1;

      // Atomically claim the lock with a strictly increasing fencingToken
      tx.set(lockRef, {
        owner: workerInstanceId,
        fencingToken: nextFencingToken,
        acquiredAt: now,
        expiresAt: now + WORKER_LOCK_TTL_MS,
        lastHeartbeat: FieldValue.serverTimestamp()
      }, { merge: true });

      return nextFencingToken;
    });
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    if (now - lastLockWarningLoggedAt > 30000) {
      lastLockWarningLoggedAt = now;
      console.warn('[TALABI Dispatch Lock] Distributed Firestore lock acquisition failed:', errMsg);
    }
    // Fail safely: refuse to run without a genuine distributed lock across Cloud Run instances
    return null;
  }
}

async function releaseWorkerLock(workerInstanceId: string, fencingToken: number) {
  const lockRef = db.collection('platform_settings').doc(WORKER_LOCK_ID);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (snap.exists) {
        const data = snap.data()!;
        // Only release if both owner AND fencingToken match this exact cycle
        if (data.owner === workerInstanceId && data.fencingToken === fencingToken) {
          tx.set(lockRef, {
            expiresAt: 0,
            owner: null,
            fencingToken: data.fencingToken
          }, { merge: true });
        }
      }
    });
  } catch (err) {
    // Release errors handled gracefully; lock will expire naturally at expiresAt
  }
}

async function verifyWorkerFencing(
  tx: FirebaseFirestore.Transaction,
  workerInstanceId: string,
  expectedFencingToken: number
): Promise<boolean> {
  const lockRef = db.collection('platform_settings').doc(WORKER_LOCK_ID);
  const lockSnap = await tx.get(lockRef);
  if (!lockSnap.exists) return false;
  const lockData = lockSnap.data()!;
  if (
    lockData.owner !== workerInstanceId ||
    lockData.fencingToken !== expectedFencingToken ||
    Date.now() >= (lockData.expiresAt || 0)
  ) {
    console.warn(
      `[TALABI Dispatch Fencing] Stale worker cycle blocked (worker=${workerInstanceId}, token=${expectedFencingToken}, currentOwner=${lockData.owner}, currentToken=${lockData.fencingToken}). Aborting mutation!`
    );
    return false;
  }
  return true;
}

let isWorkerRunning = false;
const workerInstanceId = 'instance_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

async function courierAssignmentWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  const fencingToken = await acquireWorkerLock(workerInstanceId);
  if (fencingToken === null) {
    isWorkerRunning = false;
    return;
  }

  try {
    const now = Date.now();
    const ordersCol = db.collection('orders');
    const couriersCol = db.collection('couriers');

    // PASS 1: Sweep for Expired Offers
    const pass1Statuses = ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup', 'courier_offered'];
    const pass1OrdersQuery = ordersCol.where('status', 'in', pass1Statuses);
    const ordersSnap = await pass1OrdersQuery.get();
    
    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      if (order.courierId) continue;

      if (order.offeredToCourierId) {
        const expireAt = order.offeredExpireAt || (order.offeredAt ? order.offeredAt + 15000 : 0);
        if (now >= expireAt) {
          const expiredCourierId = order.offeredToCourierId;
          const courierRef = couriersCol.doc(expiredCourierId);

          await db.runTransaction(async (tx) => {
            // Fencing Check: verify owner, monotonically increasing fencingToken, and TTL
            if (!(await verifyWorkerFencing(tx, workerInstanceId, fencingToken))) {
              return;
            }

            const oSnap = await tx.get(orderDoc.ref);
            const cSnap = await tx.get(courierRef);
            if (!oSnap.exists) return;

            const currentOrderData = oSnap.data()!;
            if (currentOrderData.courierId) return;

            if (currentOrderData.offeredToCourierId === expiredCourierId) {
              const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
              const events = [
                ...(currentOrderData.events || []),
                {
                  id: 'ev_' + Date.now(),
                  orderId: orderDoc.id,
                  status: currentOrderData.status,
                  timestamp: nowTime,
                  note: 'انتهت مهلة استجابة الكابتن (15 ثانية) دون رد - إتاحة الطلب للكباتن الآخرين',
                  actorRole: 'system',
                  actorName: 'محرك توزيع طلبي'
                }
              ];

              tx.update(orderDoc.ref, {
                offeredToCourierId: null,
                offeredAt: null,
                offeredExpireAt: null,
                timeoutCourierIds: FieldValue.arrayUnion(expiredCourierId),
                events,
                status: currentOrderData.status === 'courier_offered' ? (currentOrderData.previousStatus || 'created') : currentOrderData.status
              });
            }

            if (cSnap.exists) {
              const currentCourierData = cSnap.data()!;
              if (currentCourierData.currentOfferOrderId === orderDoc.id) {
                tx.update(courierRef, {
                  currentOfferOrderId: null
                });
              }
            }
          });

          console.log(`[TALABI Dispatch] Released expired offer for order ${orderDoc.id} (courier ${expiredCourierId})`);
        }
      }
    }

    // PASS 2: Sweep for Offline Couriers with Active Offers
    const couriersSnap = await couriersCol.get();
    for (const courierDoc of couriersSnap.docs) {
      const courier = courierDoc.data();
      if (!courier.isOnline && courier.currentOfferOrderId) {
        const orderIdToRelease = courier.currentOfferOrderId;
        const orderRef = ordersCol.doc(orderIdToRelease);

        await db.runTransaction(async (tx) => {
          // Fencing Check: verify owner, monotonically increasing fencingToken, and TTL
          if (!(await verifyWorkerFencing(tx, workerInstanceId, fencingToken))) {
            return;
          }

          const cSnap = await tx.get(courierDoc.ref);
          const oSnap = await tx.get(orderRef);

          if (cSnap.exists) {
            tx.update(courierDoc.ref, { currentOfferOrderId: null });
          }

          if (oSnap.exists) {
            const o = oSnap.data()!;
            if (o.offeredToCourierId === courier.id && !o.courierId) {
              const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
              const events = [
                ...(o.events || []),
                {
                  id: 'ev_' + Date.now(),
                  orderId: orderIdToRelease,
                  status: o.status,
                  timestamp: nowTime,
                  note: `تم سحب العرض بسبب انقطاع اتصال الكابتن ${courier.name}`,
                  actorRole: 'system',
                  actorName: 'محرك توزيع طلبي'
                }
              ];
              tx.update(orderRef, {
                offeredToCourierId: null,
                offeredAt: null,
                offeredExpireAt: null,
                events,
                status: o.status === 'courier_offered' ? (o.previousStatus || 'created') : o.status
              });
            }
          }
        });
        console.log(`[TALABI Dispatch] Cleared offer from offline courier ${courier.id} for order ${orderIdToRelease}`);
      }

      if (courier.currentOrderId) {
        const orderRef = ordersCol.doc(courier.currentOrderId);
        const oSnap = await orderRef.get();
        if (oSnap.exists) {
          const ord = oSnap.data()!;
          if (ord.status === 'delivered' || ord.status === 'cancelled') {
            await db.runTransaction(async (tx) => {
              // Fencing Check: verify owner, monotonically increasing fencingToken, and TTL before mutating courier state
              if (!(await verifyWorkerFencing(tx, workerInstanceId, fencingToken))) {
                return;
              }

              const liveCSnap = await tx.get(courierDoc.ref);
              if (liveCSnap.exists && liveCSnap.data()!.currentOrderId === courier.currentOrderId) {
                tx.update(courierDoc.ref, {
                  isBusy: false,
                  currentOrderId: null
                });
                console.log(`[TALABI Dispatch] Auto-freed courier ${courier.id} after order ${courier.currentOrderId} reached status: ${ord.status}`);
              }
            });
          }
        }
      }
    }

    // PASS 3: Match Pending Orders to Next Eligible Courier
    const assignableStatuses = ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup'];
    const pendingOrdersQuery = ordersCol.where('status', 'in', assignableStatuses);
    const activeOrdersSnap = await pendingOrdersQuery.get();

    const couriersLockedThisCycle = new Set<string>();

    for (const orderDoc of activeOrdersSnap.docs) {
      const order = orderDoc.data();

      if (order.courierId) continue;

      if (order.offeredToCourierId) {
        const expireAt = order.offeredExpireAt || (order.offeredAt ? order.offeredAt + 15000 : 0);
        if (now < expireAt) continue;
      }

      const availableCouriersQuery = couriersCol.where('isOnline', '==', true).where('isBusy', '==', false);
      const freshCouriersSnap = await availableCouriersQuery.get();

      const rejectedIds = (order.rejectedCourierIds || []) as string[];
      const timeoutIds = (order.timeoutCourierIds || []) as string[];

      const eligibleCouriers = freshCouriersSnap.docs
        .map(d => ({ ref: d.ref, data: d.data() }))
        .filter(({ data }) => {
          if (data.isBusy || data.currentOrderId || data.currentOfferOrderId) return false;
          if (couriersLockedThisCycle.has(data.id)) return false;
          if (rejectedIds.includes(data.id)) return false;
          return true;
        });

      if (eligibleCouriers.length === 0) continue;

      eligibleCouriers.sort((a, b) => {
        const aTimedOut = timeoutIds.includes(a.data.id) ? 1 : 0;
        const bTimedOut = timeoutIds.includes(b.data.id) ? 1 : 0;
        return aTimedOut - bTimedOut;
      });

      const selectedCourier = eligibleCouriers[0];
      const courier = selectedCourier.data;

      let lockSuccess = false;
      await db.runTransaction(async (tx) => {
        // Fencing Check: verify owner, monotonically increasing fencingToken, and TTL
        if (!(await verifyWorkerFencing(tx, workerInstanceId, fencingToken))) {
          return;
        }

        const oSnap = await tx.get(orderDoc.ref);
        const cSnap = await tx.get(selectedCourier.ref);

        if (!oSnap.exists || !cSnap.exists) return;

        const currentOrder = oSnap.data()!;
        const currentCourier = cSnap.data()!;

        if (currentOrder.courierId) return;
        if (currentOrder.offeredToCourierId) {
          const curExpire = currentOrder.offeredExpireAt || (currentOrder.offeredAt ? currentOrder.offeredAt + 15000 : 0);
          if (Date.now() < curExpire) return;
        }
        if (currentCourier.isBusy || currentCourier.currentOrderId || currentCourier.currentOfferOrderId) return;
        if (!currentCourier.isOnline) return;
        if ((currentOrder.rejectedCourierIds || []).includes(currentCourier.id)) return;

        const offerTime = Date.now();
        const expireTime = offerTime + 15000;

        tx.update(orderDoc.ref, {
          offeredToCourierId: currentCourier.id,
          offeredAt: offerTime,
          offeredExpireAt: expireTime,
          previousStatus: currentOrder.status,
          status: 'courier_offered'
        });

        tx.update(selectedCourier.ref, {
          currentOfferOrderId: orderDoc.id
        });

        lockSuccess = true;
      });

      if (lockSuccess) {
        couriersLockedThisCycle.add(courier.id);
        console.log(`[TALABI Dispatch] Exclusively offered order #${orderDoc.id} to courier ${courier.name} (${courier.id}) for 15s`);
      }
    }
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    if (err?.code === 7 || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('Missing or insufficient permissions')) {
      if (!dispatchWorkerIamNoticeLogged) {
        dispatchWorkerIamNoticeLogged = true;
        console.warn('[TALABI Dispatch Worker] Firestore Admin SDK query requires IAM credentials or FIRESTORE_EMULATOR_HOST:', errMsg);
      }
    } else {
      console.error('[TALABI Dispatch Worker] Error during cycle:', err);
    }
  } finally {
    await releaseWorkerLock(workerInstanceId, fencingToken);
    isWorkerRunning = false;
  }
}

// =============================================================================
// DISPATCH ENDPOINTS: SECURE COURIER OFFER CLAIMING & REJECTION (SERVER-ONLY)
// =============================================================================

// Helper function to safely parse timestamp as epoch milliseconds
function parseTimestampMs(val: any): number {
  if (typeof val === 'number') return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val._seconds === 'number') return val._seconds * 1000;
  return 0;
}

// Courier claims an offered order
app.post('/api/dispatch/claim', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق مفقود' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق فارغ' });
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 1. Unified Courier Role Verification: Custom Claim MUST be courier!
    if (decodedToken.role !== 'courier') {
      return res.status(403).json({ success: false, error: 'غير مصرح: يتطلب صلاحية كابتن موثوقة (Courier Custom Claim)' });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'رقم الطلب مفقود' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    let updatedOrderData: any = null;

    await db.runTransaction(async (tx) => {
      // 2. Fetch courier profile and detect duplicate profiles for same UID
      const couriersSnap = await tx.get(db.collection('couriers').where('userId', '==', uid));
      if (couriersSnap.docs.length > 1) {
        throw new Error('تكرار غير مصرح به: يوجد أكثر من ملف كابتن مرتبط برقم التعريف UID نفسه. تم إيقاف العملية لمنع تضارب البيانات.');
      }

      let courierDocRef: any = null;
      let courierData: any = null;

      if (couriersSnap.docs.length === 1) {
        courierDocRef = couriersSnap.docs[0].ref;
        courierData = couriersSnap.docs[0].data();
      } else {
        const directDocRef = db.collection('couriers').doc(uid);
        const directSnap = await tx.get(directDocRef);
        if (directSnap.exists) {
          courierDocRef = directDocRef;
          courierData = directSnap.data();
        }
      }

      if (!courierDocRef || !courierData) {
        throw new Error('ملف المندوب غير موجود في النظام');
      }

      // 3. Unified Admin Approval Source Check
      if (courierData.approvalStatus !== 'approved') {
        throw new Error('حساب الكابتن غير معتمد بعد من قبل إدارة المنصة (بانتظار الموافقة)');
      }

      if (courierData.isOnline !== true) {
        throw new Error('يجب تفعيل وضع الاتصال (أونلاين) أولاً قبل قبول العروض');
      }

      // 4. Verify courier busy state
      if (courierData.isBusy || courierData.currentOrderId) {
        throw new Error('المندوب مشغول بطلب آخر ولا يمكنه قبول هذا العرض');
      }

      const courierId = courierData.id || uid;

      // Check if courier has active assigned orders in system
      const activeAssignedSnap = await tx.get(
        db.collection('orders')
          .where('courierId', '==', courierId)
          .where('status', 'in', ['courier_assigned', 'picked_up', 'courier_arrived'])
      );
      if (!activeAssignedSnap.empty) {
        throw new Error('المندوب يملك طلباً نشطاً بالفعل في النظام');
      }

      // 5. Fetch order document
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error('الطلب غير موجود');
      }
      const orderData = orderSnap.data()!;

      // 6. Strict Courier Offer Matching: offeredToCourierId MUST match courier ID exactly!
      const targetMatchesCourier = orderData.offeredToCourierId === courierId || orderData.offeredToCourierId === uid;
      if (!targetMatchesCourier) {
        throw new Error('هذا العرض غير موجّه إليك ولا يمكن قبوله');
      }

      // If courierData.currentOfferOrderId is set, require it to match orderId as well!
      if (courierData.currentOfferOrderId && courierData.currentOfferOrderId !== orderId) {
        throw new Error('بيانات العرض غير متطابقة مع الطلب المعروض حالياً على الكابتن');
      }

      // 7. Verify offer expiration (handling both numeric timestamp and Firestore Timestamp safely with Fail Closed)
      const now = Date.now();
      const rawExpire = orderData.offeredExpireAt || (orderData.offeredAt ? parseTimestampMs(orderData.offeredAt) + 15000 : 0);
      const expireAtMs = parseTimestampMs(rawExpire);

      if (expireAtMs <= 0) {
        throw new Error('بيانات تاريخ انقضاء العرض مفقودة أو غير صالحة. تم رفض قبول العرض حمايةً للنظام (Fail Closed)');
      }

      if (now >= expireAtMs) {
        throw new Error('عذراً، انتهت صلاحية العرض الموجه إليك');
      }

      // 8. Verify order availability
      if (orderData.status !== 'courier_offered' || orderData.courierId) {
        throw new Error('الطلب لم يعد متاحاً أو تم تعيينه لمندوب آخر');
      }

      // Perform atomic updates
      tx.update(orderRef, {
        courierId,
        courierName: courierData.name || decodedToken.name || 'المندوب',
        courierPhone: courierData.phone || '',
        status: 'courier_assigned',
        offeredToCourierId: FieldValue.delete(),
        offeredAt: FieldValue.delete(),
        offeredExpireAt: FieldValue.delete(),
        events: FieldValue.arrayUnion({
          status: 'courier_assigned',
          timestamp: now,
          actor: 'courier',
          note: 'تم قبول العرض والتعيين بواسطة المندوب عبر الخادم الموثوق'
        })
      });

      tx.update(courierDocRef, {
        isBusy: true,
        currentOrderId: orderId,
        currentOfferOrderId: null
      });

      updatedOrderData = { id: orderId, courierId, status: 'courier_assigned' };
    });

    return res.json({
      success: true,
      message: 'تم قبول العرض وتعيين الطلب بنجاح',
      order: updatedOrderData
    });

  } catch (err: any) {
    console.error('[TALABI Dispatch Claim Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'فشلت عملية قبول العرض' });
  }
});

// Courier rejects or times out on an offer
app.post('/api/dispatch/respond-offer', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق مفقود' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق فارغ' });
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (decodedToken.role !== 'courier') {
      return res.status(403).json({ success: false, error: 'غير مصرح: يتطلب صلاحية كابتن موثوقة' });
    }

    const { orderId, action } = req.body;
    if (!orderId || !action) {
      return res.status(400).json({ success: false, error: 'بيانات الطلب أو نوع الاستجابة مفقودة' });
    }

    // Strict Action Validation: Allow ONLY 'reject' or 'timeout'
    if (action !== 'reject' && action !== 'timeout') {
      return res.status(400).json({ success: false, error: 'نوع الاستجابة غير صالح. المسموح فقط reject أو timeout' });
    }

    const orderRef = db.collection('orders').doc(orderId);

    await db.runTransaction(async (tx) => {
      // Fetch courier profile and detect duplicate profiles for same UID
      const couriersSnap = await tx.get(db.collection('couriers').where('userId', '==', uid));
      if (couriersSnap.docs.length > 1) {
        throw new Error('تكرار غير مصرح به: يوجد أكثر من ملف كابتن مرتبط برقم التعريف UID نفسه. تم إيقاف العملية لمنع تضارب البيانات.');
      }

      let courierDocRef: any = null;
      let courierData: any = null;

      if (couriersSnap.docs.length === 1) {
        courierDocRef = couriersSnap.docs[0].ref;
        courierData = couriersSnap.docs[0].data();
      } else {
        const directDocRef = db.collection('couriers').doc(uid);
        const directSnap = await tx.get(directDocRef);
        if (directSnap.exists) {
          courierDocRef = directDocRef;
          courierData = directSnap.data();
        }
      }

      if (!courierDocRef || !courierData) {
        throw new Error('ملف المندوب غير موجود في النظام');
      }

      if (courierData.approvalStatus !== 'approved') {
        throw new Error('حساب الكابتن غير معتمد من قبل إدارة المنصة');
      }

      const courierId = courierData.id || uid;

      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error('الطلب غير موجود');
      }
      const orderData = orderSnap.data()!;

      // Verify order status matches current offer state
      if (orderData.status !== 'courier_offered') {
        throw new Error('العرض غير نشط حالياً أو تم حسمه/إلغاؤه مسبقاً');
      }

      // Strict Offer Matching: offeredToCourierId MUST match courier ID exactly!
      const targetMatchesCourier = orderData.offeredToCourierId === courierId || orderData.offeredToCourierId === uid;
      if (!targetMatchesCourier) {
        throw new Error('هذا العرض غير موجّه إليك لرفضه');
      }

      // If courierData.currentOfferOrderId is set, require it to match orderId as well!
      if (courierData.currentOfferOrderId && courierData.currentOfferOrderId !== orderId) {
        throw new Error('بيانات العرض غير متطابقة مع الطلب المعروض حالياً على الكابتن');
      }

      // Strict Expiration & Action Validation with Fail Closed protection
      const now = Date.now();
      const rawExpire = orderData.offeredExpireAt || (orderData.offeredAt ? parseTimestampMs(orderData.offeredAt) + 15000 : 0);
      const expireAtMs = parseTimestampMs(rawExpire);

      if (expireAtMs <= 0) {
        throw new Error('بيانات تاريخ انقضاء العرض مفقودة أو غير صالحة. تم رفض استجابة العرض حمايةً للنظام (Fail Closed)');
      }

      if (action === 'timeout') {
        // Timeout action requires offer to actually be expired or at limit!
        if (now < expireAtMs) {
          throw new Error('عذراً، العرض لم تنتهِ مهلته الزمنية بعد لاحتساب مهلة الانتهاء (timeout)');
        }
      } else if (action === 'reject') {
        // Manual rejection should happen while offer is active
        if (now >= expireAtMs) {
          throw new Error('عذراً، انتهت صلاحية العرض الموجه إليك مسبقاً ولا يمكن رفضه يدوياً الآن');
        }
      }

      // Verify not already responded / duplicate response prevention
      const listField = action === 'reject' ? 'rejectedCourierIds' : 'timeoutCourierIds';
      const existingList = (orderData[listField] || []) as string[];
      if (existingList.includes(courierId)) {
        throw new Error('تم تسجيل استجابتك لهذا العرض مسبقاً');
      }

      const newList = Array.from(new Set([...existingList, courierId]));
      const revertStatus = orderData.previousStatus || 'merchant_accepted';

      tx.update(orderRef, {
        [listField]: newList,
        offeredToCourierId: FieldValue.delete(),
        offeredAt: FieldValue.delete(),
        offeredExpireAt: FieldValue.delete(),
        status: revertStatus,
        events: FieldValue.arrayUnion({
          status: 'offer_declined',
          timestamp: Date.now(),
          actor: 'courier',
          note: action === 'reject' ? 'تم رفض العرض الموجه بواسطة المندوب' : 'انتهت مهلة استجابة المندوب للعرض'
        })
      });

      tx.update(courierDocRef, {
        currentOfferOrderId: null
      });
    });

    return res.json({
      success: true,
      message: 'تمت معالجة استجابة العرض بنجاح'
    });

  } catch (err: any) {
    console.error('[TALABI Dispatch Respond Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'فشلت معالجة رفض العرض' });
  }
});

// Helper function for Haversine distance in KM
function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    return 0;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 10) / 10;
}

// Customer Order Creation Endpoint (Server Atomic Write + Rate Limiting & User Order Stats Sync)
app.post('/api/orders/create', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق مفقود' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق فارغ' });
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userRole = decodedToken.role;

    const { orderDoc } = req.body;
    if (!orderDoc || typeof orderDoc !== 'object' || !orderDoc.storeId || !orderDoc.items || !Array.isArray(orderDoc.items) || orderDoc.items.length === 0) {
      return res.status(400).json({ success: false, error: 'بيانات الطلب مفقودة أو غير صالحة' });
    }

    // Point 8: Restrict test orders strictly to Admin Custom Claim (userRole === 'admin')
    if (orderDoc.isTest === true) {
      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'غير مصرح: الطلبات الاختبارية مخصصة لمدير المنصة ذي الصلاحية الخادمية الموثوقة فقط' });
      }
    }

    // Point 5: Generate order ID strictly on the server
    const newOrderDocRef = db.collection('orders').doc();
    const orderId = newOrderDocRef.id;
    const statsRef = db.collection('user_order_stats').doc(uid);

    let createdOrderResult: any = null;

    await db.runTransaction(async (tx) => {
      // Point 5: Ensure document does not already exist
      const existingSnap = await tx.get(newOrderDocRef);
      if (existingSnap.exists) {
        throw new Error('معرف الطلب موجود مسبقاً، يتعذر استبدال أي مستند قائم');
      }

      // Point 6 & 2: Fetch user document from Firestore for verified profile data & role check
      const userDocRef = db.collection('users').doc(uid);
      const userDocSnap = await tx.get(userDocRef);
      const userDocData = userDocSnap.exists ? userDocSnap.data()! : {};

      // Point 2: Check user role authorized for customer ordering (admin only if verified in token claim)
      const callerRole = userRole === 'admin' ? 'admin' : (userRole || (userDocData.role !== 'admin' ? userDocData.role : 'customer') || 'customer');
      if (callerRole !== 'customer' && callerRole !== 'admin') {
        throw new Error('FORBIDDEN_ROLE');
      }

      // Point 7: Independent idempotency document checking and atomic reservation
      const clientKey = typeof orderDoc.idempotencyKey === 'string' ? orderDoc.idempotencyKey.trim() : '';
      let idemDocRef: FirebaseFirestore.DocumentReference | null = null;
      if (clientKey !== '') {
        idemDocRef = db.collection('idempotency_keys').doc(`${uid}_${clientKey}`);
        const idemSnap = await tx.get(idemDocRef);
        if (idemSnap.exists) {
          const existingOrderId = idemSnap.data()?.orderId;
          if (existingOrderId) {
            const existingOrderRef = db.collection('orders').doc(existingOrderId);
            const existingOrderSnap = await tx.get(existingOrderRef);
            if (existingOrderSnap.exists) {
              createdOrderResult = existingOrderSnap.data();
              return; // Idempotent replay
            }
          }
        }
      }

      // Point 1: Verify Store Existence & Explicit Approval Status ('approved')
      const storeRef = db.collection('stores').doc(orderDoc.storeId);
      const storeSnap = await tx.get(storeRef);
      let storeData = storeSnap.exists ? storeSnap.data() : null;

      if (!storeData) {
        const restRef = db.collection('restaurants').doc(orderDoc.storeId);
        const restSnap = await tx.get(restRef);
        storeData = restSnap.exists ? restSnap.data() : null;
      }

      if (!storeData) {
        throw new Error('المتجر غير موجود في قاعدة البيانات');
      }

      // Point 1: Explicitly require storeData.approvalStatus === 'approved'
      if (!storeData.approvalStatus || storeData.approvalStatus !== 'approved') {
        if (orderDoc.isTest === true && callerRole === 'admin') {
          // Permitted for authorized admin test order
        } else {
          throw new Error('المتجر غير معتمد صراحةً من قبل إدارة المنصة ولا يمكن استقبال طلبات جديدة منه');
        }
      }

      if (storeData.isOpen === false || storeData.status === 'closed' || storeData.isSuspendedDueToDues === true) {
        throw new Error('المتجر مغلق حالياً أو متوقف مؤقتاً ولا يستقبل طلبات جديدة');
      }

      // Point 5: Unified phone verification strictly from Firestore profile or Auth token
      const isPhoneVerified = userDocData.phoneVerified === true || Boolean(decodedToken.phone_number);

      // Point 6: Safe active order checking handling missing / dangling document
      const statsSnap = await tx.get(statsRef);
      const stats = statsSnap.exists
        ? statsSnap.data()!
        : { activeOrderId: null, lastOrderTimestamps: [] };

      if (stats.activeOrderId && typeof stats.activeOrderId === 'string' && stats.activeOrderId.trim() !== '') {
        const activeOrderRef = db.collection('orders').doc(stats.activeOrderId.trim());
        const activeOrderSnap = await tx.get(activeOrderRef);
        if (activeOrderSnap.exists) {
          const activeData = activeOrderSnap.data()!;
          const status = activeData.status;
          const isCompleted = status === 'delivered' || status === 'cancelled';

          if (!isCompleted) {
            throw new Error('PENDING_ORDER');
          }
        } else {
          // Point 6: Safely handle missing/dangling activeOrderId document without failing or ignoring
          console.warn(`[TALABI Order Create] Clearing orphaned activeOrderId (${stats.activeOrderId}) for user ${uid}`);
          stats.activeOrderId = null;
        }
      }

      const now = Date.now();
      const tenMinsAgo = now - 10 * 60 * 1000;
      const recentOrders = (stats.lastOrderTimestamps || []).filter((t: number) => typeof t === 'number' && t > tenMinsAgo);

      if (recentOrders.length >= 2) {
        throw new Error('RATE_LIMIT');
      }

      const updatedTimestamps = [...recentOrders, now].slice(-2);

      // Point 3, 8, 9, 10: Verify Products, StoreId Match, Valid Price, Options & Group Constraints
      let verifiedSubtotal = 0;
      const verifiedItems = [];

      for (const item of orderDoc.items) {
        if (!item || !item.productId || typeof item.productId !== 'string') {
          throw new Error('بيانات صنف الطلب مفقودة أو غير صالحة');
        }

        // Point 9: Reject invalid/out-of-bounds quantity explicitly
        const rawQty = item.quantity;
        if (typeof rawQty !== 'number' || isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0 || rawQty > 100) {
          throw new Error(`الكمية المطلوبة للصنف غیر صالحة (${rawQty}). يجب أن تكون عدداً صحيحاً بين 1 و100`);
        }

        const prodRef = db.collection('products').doc(item.productId.trim());
        const prodSnap = await tx.get(prodRef);

        if (!prodSnap.exists) {
          throw new Error(`المنتج المختار غير موجود في قاعدة البيانات: (${item.productId})`);
        }

        const prodData = prodSnap.data()!;

        // Point 3: StoreId exact match check
        if (!prodData.storeId || prodData.storeId !== orderDoc.storeId) {
          throw new Error(`المنتج "${prodData.name || item.productId}" لا ينتمي إلى المتجر المحدد`);
        }

        // Point 3: Base price validity check
        if (typeof prodData.price !== 'number' || isNaN(prodData.price) || prodData.price <= 0) {
          throw new Error(`سعر المنتج الأساسي "${prodData.name || item.productId}" غير صالح في قاعدة البيانات`);
        }

        if (prodData.approvalStatus === 'rejected') {
          throw new Error(`المنتج "${prodData.name || item.productId}" غير معتمد في المنصة`);
        }

        if (prodData.available === false || prodData.isAvailable === false) {
          throw new Error(`المنتج "${prodData.name || item.productId}" غير متاح حالياً للبيع`);
        }

        const basePrice = prodData.price;
        let verifiedOptionsPrice = 0;
        const verifiedSelectedOptions: any[] = [];
        const verifiedOptionGroups: any[] = [];

        // Point 8: Verify standalone options & reject duplicates
        if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
          const dbOptions = (prodData.options || []) as any[];
          const seenOptionKeys = new Set<string>();

          for (const clientOpt of item.selectedOptions) {
            const optKey = (clientOpt.id || clientOpt.name || '').trim();
            if (seenOptionKeys.has(optKey)) {
              throw new Error(`تكرار غير مسموح للإضافة "${clientOpt.name}" بداخل المنتج نفسه`);
            }
            seenOptionKeys.add(optKey);

            const match = dbOptions.find((o: any) =>
              (o.id && clientOpt.id && o.id === clientOpt.id) ||
              (o.name && clientOpt.name && o.name.trim() === clientOpt.name.trim())
            );
            if (!match) {
              throw new Error(`الإضافة المحددة "${clientOpt.name || clientOpt.id}" غير موجودة في بيانات المنتج بـ Firestore`);
            }
            const optPrice = typeof match.price === 'number' && !isNaN(match.price) ? Math.max(0, match.price) : 0;
            verifiedOptionsPrice += optPrice;
            verifiedSelectedOptions.push({
              id: match.id || clientOpt.id || 'opt_' + Math.random().toString(36).substring(2, 6),
              name: match.name || clientOpt.name,
              price: optPrice
            });
          }
        }

        // Point 10: Verify option groups and enforce minSelect / maxSelect / required / duplicate checks
        const dbOptionGroups = (prodData.optionGroups || []) as any[];
        for (const dbGroup of dbOptionGroups) {
          const clientGroup = (item.selectedOptionGroups || []).find((cg: any) =>
            (cg.id && dbGroup.id && cg.id === dbGroup.id) ||
            (cg.groupTitle && dbGroup.title && cg.groupTitle.trim() === dbGroup.title.trim())
          );

          const clientSelectedItems = clientGroup?.selectedItems && Array.isArray(clientGroup.selectedItems) ? clientGroup.selectedItems : [];
          const minSel = typeof dbGroup.minSelect === 'number' ? dbGroup.minSelect : (dbGroup.isRequired ? 1 : 0);
          const maxSel = typeof dbGroup.maxSelect === 'number' ? dbGroup.maxSelect : 99;

          if (dbGroup.isRequired && clientSelectedItems.length < Math.max(1, minSel)) {
            throw new Error(`مجموعة الخيارات "${dbGroup.title}" إجبارية ويجب اختيار ${Math.max(1, minSel)} خيار على الأقل`);
          }

          if (clientSelectedItems.length < minSel) {
            throw new Error(`يجب اختيار ${minSel} خيارات على الأقل من مجموعة "${dbGroup.title}"`);
          }

          if (clientSelectedItems.length > maxSel) {
            throw new Error(`لا يمكنك اختيار أكثر من ${maxSel} خيارات من مجموعة "${dbGroup.title}"`);
          }

          // Check duplicate item selections inside the same group
          const selectedNamesOrIds = new Set<string>();
          const verifiedItemsInGroup: any[] = [];

          for (const sItem of clientSelectedItems) {
            const key = (sItem.id || sItem.name || '').trim();
            if (selectedNamesOrIds.has(key)) {
              throw new Error(`تكرار غير مسموح للخيار "${sItem.name}" في مجموعة "${dbGroup.title}"`);
            }
            selectedNamesOrIds.add(key);

            const dbGroupOptions = Array.isArray(dbGroup.options) ? dbGroup.options : [];
            const matchItem = dbGroupOptions.find((o: any) =>
              (o.id && sItem.id && o.id === sItem.id) ||
              (o.name && sItem.name && o.name.trim() === sItem.name.trim())
            );

            if (!matchItem) {
              throw new Error(`الخيار الفرعي "${sItem.name || sItem.id}" غير موجود في القائمة المعتمدة للمجموعة "${dbGroup.title}"`);
            }

            const itemPrice = typeof matchItem.price === 'number' && !isNaN(matchItem.price) ? Math.max(0, matchItem.price) : 0;
            verifiedOptionsPrice += itemPrice;
            verifiedItemsInGroup.push({
              id: matchItem.id || sItem.id || 'opt_' + Math.random().toString(36).substring(2, 6),
              name: matchItem.name || sItem.name,
              price: itemPrice
            });
          }

          if (verifiedItemsInGroup.length > 0) {
            verifiedOptionGroups.push({
              groupTitle: dbGroup.title || 'خيارات إضافية',
              selectedItems: verifiedItemsInGroup
            });
          }
        }

        const verifiedUnitPrice = basePrice + verifiedOptionsPrice;
        verifiedSubtotal += verifiedUnitPrice * rawQty;

        verifiedItems.push({
          productId: prodData.id || item.productId,
          name: prodData.name || item.name || 'منتج',
          price: verifiedUnitPrice,
          basePrice,
          quantity: rawQty,
          notes: typeof item.notes === 'string' ? item.notes.slice(0, 500) : '',
          ...(verifiedSelectedOptions.length > 0 ? { selectedOptions: verifiedSelectedOptions } : {}),
          ...(verifiedOptionGroups.length > 0 ? { selectedOptionGroups: verifiedOptionGroups } : {})
        });
      }

      // Dynamic financial settings loaded directly from platform_settings/delivery_and_commissions
      const settingsRef = db.collection('platform_settings').doc('delivery_and_commissions');
      const settingsSnap = await tx.get(settingsRef);
      const pricingSettings = settingsSnap.exists ? settingsSnap.data()! : {};

      // 7. Toggle for distance-based pricing
      const isDistancePricingEnabled = pricingSettings.isDistancePricingEnabled !== false && pricingSettings.enableDistanceCalculation !== false;

      // 1. Base delivery fee (baseDeliveryFee / distanceBaseFee)
      const baseFee = typeof pricingSettings.distanceBaseFee === 'number' && !isNaN(pricingSettings.distanceBaseFee) && pricingSettings.distanceBaseFee >= 0
        ? pricingSettings.distanceBaseFee
        : (typeof pricingSettings.baseDeliveryFee === 'number' && !isNaN(pricingSettings.baseDeliveryFee) && pricingSettings.baseDeliveryFee >= 0
          ? pricingSettings.baseDeliveryFee
          : 1500);

      // 2. Per kilometer fee (perKmFee / distanceFeePerKm)
      const perKmFee = typeof pricingSettings.distanceFeePerKm === 'number' && !isNaN(pricingSettings.distanceFeePerKm) && pricingSettings.distanceFeePerKm >= 0
        ? pricingSettings.distanceFeePerKm
        : (typeof pricingSettings.perKmFee === 'number' && !isNaN(pricingSettings.perKmFee) && pricingSettings.perKmFee >= 0
          ? pricingSettings.perKmFee
          : 250);

      // 3. Max delivery fee cap (maxDeliveryFee / distanceMaxFee)
      const maxFee = typeof pricingSettings.distanceMaxFee === 'number' && !isNaN(pricingSettings.distanceMaxFee) && pricingSettings.distanceMaxFee >= baseFee
        ? pricingSettings.distanceMaxFee
        : (typeof pricingSettings.maxDeliveryFee === 'number' && !isNaN(pricingSettings.maxDeliveryFee) && pricingSettings.maxDeliveryFee >= baseFee
          ? pricingSettings.maxDeliveryFee
          : 5000);

      // 4. Captain fee / courier payout (captainFee / defaultCourierBasePayout)
      const courierBasePayout = typeof pricingSettings.defaultCourierBasePayout === 'number' && !isNaN(pricingSettings.defaultCourierBasePayout) && pricingSettings.defaultCourierBasePayout >= 0
        ? pricingSettings.defaultCourierBasePayout
        : (typeof pricingSettings.captainFee === 'number' && !isNaN(pricingSettings.captainFee) && pricingSettings.captainFee >= 0
          ? pricingSettings.captainFee
          : 2500);

      const isBonusActive = pricingSettings.isCourierBonusActive !== false;
      const courierBonus = isBonusActive && typeof pricingSettings.defaultCourierBonus === 'number' && !isNaN(pricingSettings.defaultCourierBonus) && pricingSettings.defaultCourierBonus >= 0
        ? pricingSettings.defaultCourierBonus
        : 0;

      const courierTotalEarnings = courierBasePayout + courierBonus;

      // 5. Platform Commission Percentage (platformCommissionPercent / defaultPlatformCommissionPercent)
      let commissionPercent = typeof storeData.commissionRate === 'number' && !isNaN(storeData.commissionRate) && storeData.commissionRate >= 0 && storeData.commissionRate <= 100
        ? storeData.commissionRate
        : (typeof pricingSettings.defaultPlatformCommissionPercent === 'number' && !isNaN(pricingSettings.defaultPlatformCommissionPercent) && pricingSettings.defaultPlatformCommissionPercent >= 0 && pricingSettings.defaultPlatformCommissionPercent <= 100
          ? pricingSettings.defaultPlatformCommissionPercent
          : (typeof pricingSettings.platformCommissionPercent === 'number' && !isNaN(pricingSettings.platformCommissionPercent) && pricingSettings.platformCommissionPercent >= 0 && pricingSettings.platformCommissionPercent <= 100
            ? pricingSettings.platformCommissionPercent
            : 10));

      if (commissionPercent < 0 || commissionPercent > 100) {
        throw new Error(`نسبة عمولة المتجر (${commissionPercent}%) غير صالحة، ويجب أن تكون بين 0 و100%`);
      }

      // 6. Service fee (serviceFee / defaultServiceFee)
      const verifiedServiceFee = typeof pricingSettings.serviceFee === 'number' && !isNaN(pricingSettings.serviceFee) && pricingSettings.serviceFee >= 0
        ? pricingSettings.serviceFee
        : (typeof pricingSettings.defaultServiceFee === 'number' && !isNaN(pricingSettings.defaultServiceFee) && pricingSettings.defaultServiceFee >= 0
          ? pricingSettings.defaultServiceFee
          : 1000);

      // Verify customer address coordinates from Firestore
      const storeCoords = storeData.coordinates || null;
      let verifiedCustCoords: { lat: number; lng: number } | null = null;
      if (userDocData.addresses && Array.isArray(userDocData.addresses) && userDocData.addresses.length > 0) {
        const defaultAddr = userDocData.addresses.find((a: any) => a.isDefault) || userDocData.addresses[0];
        if (defaultAddr && defaultAddr.coordinates && typeof defaultAddr.coordinates.lat === 'number' && typeof defaultAddr.coordinates.lng === 'number') {
          verifiedCustCoords = defaultAddr.coordinates;
        }
      } else if (userDocData.coordinates && typeof userDocData.coordinates.lat === 'number' && typeof userDocData.coordinates.lng === 'number') {
        verifiedCustCoords = userDocData.coordinates;
      }

      const defaultTrustedFee = typeof pricingSettings.defaultDeliveryFee === 'number' && pricingSettings.defaultDeliveryFee > 0
        ? pricingSettings.defaultDeliveryFee
        : (typeof storeData.deliveryFee === 'number' && storeData.deliveryFee > 0 ? storeData.deliveryFee : baseFee);

      let calculatedDeliveryFee = defaultTrustedFee;
      let verifiedDirectDistanceKm: number | undefined = undefined;

      if (
        isDistancePricingEnabled &&
        storeCoords &&
        typeof storeCoords.lat === 'number' &&
        typeof storeCoords.lng === 'number' &&
        verifiedCustCoords &&
        typeof verifiedCustCoords.lat === 'number' &&
        typeof verifiedCustCoords.lng === 'number'
      ) {
        const directDist = calculateHaversineDistanceKm(storeCoords.lat, storeCoords.lng, verifiedCustCoords.lat, verifiedCustCoords.lng);
        if (directDist > 0 && directDist <= 100) {
          verifiedDirectDistanceKm = directDist;
          calculatedDeliveryFee = Math.min(maxFee, Math.max(baseFee, Math.round(baseFee + perKmFee * directDist)));
        }
      }

      calculatedDeliveryFee = Math.min(maxFee, Math.max(baseFee, Math.round(calculatedDeliveryFee)));

      const verifiedTotal = verifiedSubtotal + calculatedDeliveryFee + verifiedServiceFee;

      const platformCommissionAmount = Math.round((verifiedSubtotal * commissionPercent) / 100);
      const storeNetPayout = Math.max(0, verifiedSubtotal - platformCommissionAmount);

      const financials = {
        subtotal: verifiedSubtotal,
        customerDeliveryFee: calculatedDeliveryFee,
        ...(verifiedDirectDistanceKm ? { deliveryDistanceKm: verifiedDirectDistanceKm, isDirectStraightLineDistance: true } : {}),
        serviceFee: verifiedServiceFee,
        total: verifiedTotal,
        platformCommissionPercent: commissionPercent,
        platformCommissionAmount,
        storeNetPayout,
        courierBasePayout,
        courierBonus,
        courierTotalEarnings,
      };

      const finalOrderDoc = {
        id: orderId,
        idempotencyKey: clientKey !== '' ? clientKey : `idem_${Date.now()}`,
        storeId: orderDoc.storeId,
        storeName: storeData.name || 'المتجر',
        storeAddress: storeData.address || '',
        merchantUserId: storeData.merchantUserId || '',
        items: verifiedItems,
        subtotal: verifiedSubtotal,
        deliveryFee: calculatedDeliveryFee,
        ...(verifiedDirectDistanceKm ? { deliveryDistanceKm: verifiedDirectDistanceKm } : {}),
        serviceFee: verifiedServiceFee,
        total: verifiedTotal,
        financials,
        customer: {
          id: uid,
          name: typeof orderDoc.customer?.name === 'string' && orderDoc.customer.name.trim() !== ''
            ? orderDoc.customer.name.trim().slice(0, 100)
            : (decodedToken.name || userDocData.name || 'الزبون'),
          phone: userDocData.phone || (typeof orderDoc.customer?.phone === 'string' ? orderDoc.customer.phone.slice(0, 30) : ''),
          phoneVerified: isPhoneVerified,
          address: typeof orderDoc.customer?.address === 'string' ? orderDoc.customer.address.slice(0, 300) : '',
          neighborhood: typeof orderDoc.customer?.neighborhood === 'string' ? orderDoc.customer.neighborhood.slice(0, 100) : '',
          notes: typeof orderDoc.customer?.notes === 'string' ? orderDoc.customer.notes.slice(0, 500) : '',
          ...(verifiedCustCoords ? { coordinates: verifiedCustCoords } : {})
        },
        status: 'created',
        payment: {
          method: orderDoc.payment?.method === 'online' ? 'online' : 'cash_on_delivery',
          status: 'pending',
          amount: verifiedTotal
        },
        events: [
          {
            id: 'ev_' + Date.now(),
            orderId,
            status: 'created',
            timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
            actorRole: 'customer',
            actorName: typeof orderDoc.customer?.name === 'string' ? orderDoc.customer.name.slice(0, 100) : 'الزبون',
            note: 'تم استلام الطلب وبانتظار موافقة المطعم'
          }
        ],
        createdAt: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        createdAtTimestamp: now,
        ...(orderDoc.isTest === true ? { isTest: true } : {})
      };

      // Point 5: tx.create strictly creates without overwriting
      tx.create(newOrderDocRef, finalOrderDoc);

      // Point 7: Store independent idempotency record
      if (idemDocRef) {
        tx.create(idemDocRef, {
          uid,
          orderId,
          key: clientKey,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      tx.set(statsRef, {
        userId: uid,
        activeOrderId: orderId,
        lastOrderTimestamps: updatedTimestamps,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      createdOrderResult = finalOrderDoc;
    });

    return res.json({
      success: true,
      message: 'تمت معالجة وإنشاء الطلب بنجاح عبر الخادم الموثوق',
      orderId: createdOrderResult?.id || orderId,
      order: createdOrderResult
    });

  } catch (err: any) {
    console.error('[TALABI Order Create Error]:', err);
    let errorMsg = err.message || 'فشل إنشاء الطلب';
    if (err.message === 'PENDING_ORDER') {
      errorMsg = 'لديك طلب حالي قيد التنفيذ. يرجى متابعة طلبك السابق حتى اكتماله أو إلغائه قبل إنشاء طلب جديد.';
    } else if (err.message === 'RATE_LIMIT') {
      errorMsg = 'لقد وصلت للحد الأقصى من الطلبات المسموحة (طلبان خلال 10 دقائق). يرجى الانتظار قليلاً.';
    } else if (err.message === 'FORBIDDEN_ROLE') {
      return res.status(403).json({ success: false, error: 'غير مصرح: إنشاء الطلبات مخصص لحسابات الزبائن المعتمدة فقط' });
    }
    return res.status(400).json({ success: false, error: errorMsg });
  }
});

// =============================================================================
// ADMIN SECURITY ENDPOINTS: PRIMARY BOOTSTRAP & APPLICATION/ROLE REVIEWS
// =============================================================================

// 1. Primary Admin One-Time Bootstrap Endpoint (Strict State-Driven Atomic Lock with Multi-Layer Verification)
app.post('/api/admin/bootstrap-primary-admin', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق مفقود (Authorization: Bearer <idToken>)' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'رمز التوثيق فارغ' });
  }

  const PRIMARY_ADMIN_EMAIL = 'msr33777@gmail.com';
  let currentUid = '';
  const lockRef = db.collection('platform_settings').doc('primary_admin_bootstrapped');

  try {
    // Cryptographically verify Firebase ID Token
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const userEmail = (decodedToken.email || '').toLowerCase();
    const isEmailVerified = decodedToken.email_verified === true;
    const uid = decodedToken.uid;
    currentUid = uid;

    // Strict Whitelist Enforcement
    if (userEmail !== PRIMARY_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: `غير مصرح: عملية التفعيل الأولي مخصصة حصراً للبريد الإلكتروني الأساسي للمدير (${PRIMARY_ADMIN_EMAIL})`
      });
    }

    if (!isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح: يجب توثيق البريد الإلكتروني بحساب Google قبل تفعيل صلاحية المدير الأساسي'
      });
    }

    // Step 1: Atomic Lock Reservation & UID Binding Verification
    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const lockData = lockSnap.exists ? lockSnap.data() : null;
      if (lockData) {
        // Strict UID Binding Check: Lock cannot be seized or resumed by a different UID!
        if (lockData.adminUid && lockData.adminUid !== uid) {
          throw new Error('LOCKED_BY_DIFFERENT_UID');
        }
        if (lockData.isBootstrapped === true && lockData.status === 'completed' && lockData.adminUid === uid) {
          // Already bootstrapped for this exact UID: proceed to verify and ensure claims idempotently
          return;
        }
      }

      tx.set(lockRef, {
        isBootstrapped: true,
        status: 'in_progress',
        adminUid: uid,
        adminEmail: PRIMARY_ADMIN_EMAIL,
        initiatedAt: lockData?.initiatedAt ? lockData.initiatedAt : FieldValue.serverTimestamp(),
        lastAttemptAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }).catch((txErr: any) => {
      if (txErr.message === 'LOCKED_BY_DIFFERENT_UID') {
        throw new Error('قفل التفعيل محجوز برقم تعريف آخر (UID). يمنع استكمال العملية بـ UID مختلف.');
      }
      throw txErr;
    });

    // Step 2: Check current Auth Claims and Firestore User Doc State
    const userRecord = await getAdminAuth().getUser(uid);
    const hasAdminClaim = userRecord.customClaims?.role === 'admin';
    
    const userDocRef = db.collection('users').doc(uid);
    const userDocSnap = await userDocRef.get();
    const isUserDocAdmin = userDocSnap.exists && userDocSnap.data()?.role === 'admin';

    // Step 3: Resume / Grant Custom Claims if missing
    let updatedClaims = userRecord.customClaims || {};
    if (!hasAdminClaim) {
      updatedClaims = {
        ...updatedClaims,
        role: 'admin',
        accountType: 'admin',
        bootstrappedAt: Date.now()
      };
      await getAdminAuth().setCustomUserClaims(uid, updatedClaims);
    }

    // Step 4: Resume / Sync Firestore user document if missing
    if (!isUserDocAdmin) {
      await userDocRef.set({
        id: uid,
        email: PRIMARY_ADMIN_EMAIL,
        name: decodedToken.name || userRecord.displayName || 'المدير الأساسي',
        role: 'admin',
        accountType: 'admin',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Step 5: Strict Multi-Layer Verification before declaring completion
    const verifyUser = await getAdminAuth().getUser(uid);
    const verifyDocSnap = await userDocRef.get();

    const verifiedClaims = verifyUser.customClaims?.role === 'admin';
    const verifiedDocRole = verifyDocSnap.exists && verifyDocSnap.data()?.role === 'admin';

    if (!verifiedClaims || !verifiedDocRole) {
      throw new Error('فشلت التحققات المزدوجة قبل إعلان اكتمال القفل. سيتم الاحتفاظ بحالة in_progress لإعادة المحاولة.');
    }

    // Step 6: Mark Lock Completed
    await lockRef.set({
      isBootstrapped: true,
      status: 'completed',
      adminUid: uid,
      adminEmail: PRIMARY_ADMIN_EMAIL,
      completedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Write server audit log
    await db.collection('audit_logs').add({
      action: 'PRIMARY_ADMIN_BOOTSTRAPPED',
      entityType: 'user',
      entityId: uid,
      details: `تفعيل صلاحية المدير الأساسي للبريد (${PRIMARY_ADMIN_EMAIL}) والـ UID (${uid}) بنجاح مع التحقق الكامل`,
      severity: 'warning',
      timestamp: FieldValue.serverTimestamp()
    }).catch(() => {});

    console.log(`[TALABI Security] Successfully bootstrapped Primary Admin: ${PRIMARY_ADMIN_EMAIL} (${uid})`);

    return res.json({
      success: true,
      message: `تم تفعيل صلاحية المدير الأساسي بنجاح والتحقق منها للبريد (${PRIMARY_ADMIN_EMAIL})`,
      uid,
      claims: verifyUser.customClaims
    });

  } catch (err: any) {
    console.error('[TALABI Security] Bootstrap Primary Admin error:', err);

    // Error Handling & Recovery Guarantee:
    // If setCustomUserClaims succeeded or lock was engaged, keep lock as 'in_progress' bound strictly to currentUid!
    if (currentUid) {
      try {
        const checkUser = await getAdminAuth().getUser(currentUid);
        if (checkUser.customClaims?.role === 'admin') {
          // Custom Claims exist: NEVER reset isBootstrapped to false! Keep lock bound to currentUid for retry!
          await lockRef.set({
            isBootstrapped: true,
            status: 'in_progress',
            adminUid: currentUid,
            adminEmail: PRIMARY_ADMIN_EMAIL,
            lastError: err.message || 'فشلت بعض الخطوات أثناء المزامنة',
            failedAt: FieldValue.serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      } catch (recoveryErr) {
        console.error('[TALABI Security] Recovery check error:', recoveryErr);
      }
    }

    return res.status(400).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء تفعيل حساب المدير الأساسي'
    });
  }
});

// 2. Review Applications & Role Change Endpoint (Admin Only - Atomic Transaction with Store/Courier Doc Creation & Audit Log)
app.post('/api/admin/applications/review', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const adminName = req.authenticatedUser?.name || 'المدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  const { type, appId, action, adminNotes } = req.body; // type: 'restaurant' | 'courier', action: 'approve' | 'reject' | 'suspend'
  if (!type || !appId || !action) {
    return res.status(400).json({ success: false, error: 'البيانات المطلوبة مفقودة (type, appId, action)' });
  }

  const collectionName = type === 'restaurant' ? 'restaurant_applications' : 'courier_applications';
  const appRef = db.collection(collectionName).doc(appId);
  const auditRef = db.collection('audit_logs').doc();

  let targetApplicantUid = '';
  let entityId = '';
  let newRole: 'merchant' | 'courier' | 'customer' = 'customer';
  let newAccountType: 'restaurant' | 'courier' | 'customer' = 'customer';

  try {
    const result = await db.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) {
        throw new Error('طلب الانضمام غير موجود في النظام');
      }

      const appData = appSnap.data()!;
      if (appData.status !== 'pending') {
        throw new Error(`عذراً، الطلب حالته الحالية (${appData.status}) وليست معلقة، وتمت معالجته مسبقاً.`);
      }

      targetApplicantUid = appData.userId || appData.applicantUserId || appData.id;
      if (!targetApplicantUid) {
        throw new Error('معرّف المستخدم المتقدم غير موجود في تفاصيل الطلب');
      }

      if (action === 'approve') {
        entityId = type === 'restaurant' ? `store_${targetApplicantUid}` : `courier_${targetApplicantUid}`;
        if (appData.storeId) entityId = appData.storeId;
        if (appData.courierId) entityId = appData.courierId;

        const targetCol = type === 'restaurant' ? 'stores' : 'couriers';
        const targetRef = db.collection(targetCol).doc(entityId);
        const targetSnap = await tx.get(targetRef);

        if (targetSnap.exists) {
          throw new Error('مستند المتجر أو الكابتن موجود مسبقاً لهذا المتقدم (منع التكرار)');
        }

        if (type === 'restaurant') {
          const storeDoc = {
            id: entityId,
            merchantUserId: targetApplicantUid,
            name: appData.restaurantName || appData.name || 'مطعم جديد',
            phone: appData.phone || '',
            address: appData.address || 'بغداد',
            category: appData.category || 'مشويات ومأكولات',
            logo: appData.logo || appData.image || '',
            commissionRate: 10,
            approvalStatus: 'approved',
            isOpen: true,
            isSuspendedDueToDues: false,
            createdAt: new Date().toISOString()
          };
          tx.set(targetRef, storeDoc);

          const restRef = db.collection('restaurants').doc(entityId);
          tx.set(restRef, storeDoc);
        } else {
          const courierDoc = {
            id: entityId,
            userId: targetApplicantUid,
            name: appData.courierName || appData.name || 'كابتن توصيل',
            phone: appData.phone || '',
            vehicleType: appData.vehicleType || 'دراجة نارية',
            vehiclePlate: appData.vehiclePlate || 'بغداد',
            approvalStatus: 'approved',
            walletBalance: 0,
            totalEarnings: 0,
            isOnline: false,
            isBusy: false,
            createdAt: new Date().toISOString()
          };
          tx.set(targetRef, courierDoc);
        }

        tx.update(appRef, {
          status: 'approved',
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: `${adminName} (${adminEmail})`,
          adminNotes: adminNotes || 'تمت الموافقة بنجاح'
        });

        tx.set(auditRef, {
          action: 'APPLICATION_APPROVE',
          entityType: type === 'restaurant' ? 'store' : 'courier',
          entityId,
          details: `الموافقة على طلب انضمام ${type === 'restaurant' ? 'المطعم' : 'الكابتن'} (${appData.restaurantName || appData.courierName || appId}) بواسطة المدير (${adminEmail})`,
          severity: 'info',
          performedBy: `${adminName} (admin)`,
          performedByUid: adminUid,
          timestamp: FieldValue.serverTimestamp()
        });

        return { success: true, action: 'approve', entityId, targetApplicantUid };
      } else if (action === 'reject') {
        const rejectionReason = adminNotes || 'لم يتم استيفاء الشروط المطلوبة';
        tx.update(appRef, {
          status: 'rejected',
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: `${adminName} (${adminEmail})`,
          adminNotes: rejectionReason
        });

        tx.set(auditRef, {
          action: 'APPLICATION_REJECT',
          entityType: type === 'restaurant' ? 'store' : 'courier',
          entityId: appId,
          details: `رفض طلب انضمام ${type === 'restaurant' ? 'المطعم' : 'الكابتن'} (${appId}). السبب: ${rejectionReason} بواسطة المدير (${adminEmail})`,
          severity: 'warning',
          performedBy: `${adminName} (admin)`,
          performedByUid: adminUid,
          timestamp: FieldValue.serverTimestamp()
        });

        return { success: true, action: 'reject', appId, targetApplicantUid };
      } else {
        throw new Error('إجراء غير مدعوم');
      }
    });

    // If approved, update Custom Claims and Firestore user role
    if (action === 'approve' && targetApplicantUid) {
      newRole = type === 'restaurant' ? 'merchant' : 'courier';
      newAccountType = type === 'restaurant' ? 'restaurant' : 'courier';

      try {
        const applicantRecord = await getAdminAuth().getUser(targetApplicantUid);
        const existingClaims = applicantRecord.customClaims || {};
        const updatedClaims = {
          ...existingClaims,
          role: newRole,
          accountType: newAccountType,
          updatedAt: Date.now()
        };
        await getAdminAuth().setCustomUserClaims(targetApplicantUid, updatedClaims);
      } catch (claimErr) {
        console.warn('[TALABI Review] Failed to set custom claims:', claimErr);
      }

      await db.collection('users').doc(targetApplicantUid).set({
        role: newRole,
        accountType: newAccountType,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});
    }

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Admin Review Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'حدث خطأ أثناء مراجعة طلب الانضمام' });
  }
});

// 3. Admin Store Commission Update Endpoint
app.post('/api/admin/stores/commission', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { storeId, commissionRate } = req.body;
  if (!storeId || typeof storeId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المتجر storeId مطلوب' });
  }

  const numericRate = Number(commissionRate);
  if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
    return res.status(400).json({ success: false, error: 'نسبة العمولة يجب أن تكون رقماً بين 0% و 100%' });
  }

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
    }

    const previousRate = storeSnap.data()?.commissionRate ?? 0;

    await storeRef.update({
      commissionRate: numericRate,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.authenticatedUser?.name || 'مدير'
    });

    // Save commission history log
    await db.collection('store_commission_history').add({
      storeId,
      storeName: storeSnap.data()?.name || '',
      previousRate,
      newRate: numericRate,
      updatedByUid: req.authenticatedUser?.uid,
      updatedByName: req.authenticatedUser?.name || 'مدير',
      createdAt: FieldValue.serverTimestamp()
    });

    // Write audit log
    await db.collection('audit_logs').add({
      action: 'UPDATE_STORE_COMMISSION',
      entityType: 'store',
      entityId: storeId,
      details: `تحديث نسبة عمولة المتجر ${storeSnap.data()?.name} إلى ${numericRate}% بواسطة ${req.authenticatedUser?.name || 'مدير'}`,
      severity: 'info',
      timestamp: FieldValue.serverTimestamp()
    }).catch(() => {});

    return res.json({
      success: true,
      message: `تم تحديث نسبة العمولة إلى ${numericRate}% بنجاح`,
      storeId,
      commissionRate: numericRate
    });
  } catch (err: any) {
    console.error('[TALABI Admin Commission Update Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'حدث خطأ أثناء تحديث نسبة العمولة' });
  }
});

// 4. Admin Store Suspension Endpoint
app.post('/api/admin/stores/suspend', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { storeId, reason } = req.body;
  if (!storeId || typeof storeId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المتجر storeId مطلوب' });
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, error: 'سبب التعليق مطلوب' });
  }

  const adminName = req.authenticatedUser?.name || 'مدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';
  const cleanReason = reason.trim();

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
    }

    const storeData = storeSnap.data()!;

    await db.runTransaction(async (tx) => {
      tx.update(storeRef, {
        isSuspendedDueToDues: true,
        suspensionReason: cleanReason,
        isOpen: false,
        suspendedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminName,
      });

      const auditRef = db.collection('audit_logs').doc();
      tx.set(auditRef, {
        action: 'STORE_SUSPEND',
        entityType: 'store',
        entityId: storeId,
        details: `تعليق نشاط المتجر ${storeData.name || storeId} بسبب المستحقات: ${cleanReason} بواسطة ${adminName}`,
        severity: 'warning',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return res.json({ success: true, storeId, message: 'تم تعليق المتجر بنجاح وتوثيق العملية' });
  } catch (err: any) {
    console.error('[TALABI Admin Store Suspend Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'حدث خطأ أثناء تعليق المتجر' });
  }
});

// 5. Admin Store Reactivation Endpoint
app.post('/api/admin/stores/reactivate', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { storeId } = req.body;
  if (!storeId || typeof storeId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المتجر storeId مطلوب' });
  }

  const adminName = req.authenticatedUser?.name || 'مدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
    }

    const storeData = storeSnap.data()!;

    await db.runTransaction(async (tx) => {
      tx.update(storeRef, {
        isSuspendedDueToDues: false,
        suspensionReason: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminName,
      });

      const auditRef = db.collection('audit_logs').doc();
      tx.set(auditRef, {
        action: 'STORE_REACTIVATE',
        entityType: 'store',
        entityId: storeId,
        details: `إلغاء تعليق المتجر ${storeData.name || storeId} واستئناف النشاط بواسطة ${adminName}`,
        severity: 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return res.json({ success: true, storeId, message: 'تم إعادة تفعيل المتجر بنجاح' });
  } catch (err: any) {
    console.error('[TALABI Admin Store Reactivate Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'حدث خطأ أثناء إعادة تفعيل المتجر' });
  }
});

// 6. Admin Store Update Endpoint
app.post('/api/admin/stores/update', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { storeId, updates } = req.body;
  if (!storeId || typeof storeId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المتجر storeId مطلوب' });
  }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: 'بيانات التحديث مطلوبة' });
  }

  const adminName = req.authenticatedUser?.name || 'مدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
    }

    const storeData = storeSnap.data()!;
    const allowedUpdates = { ...updates };
    delete allowedUpdates.id;

    await db.runTransaction(async (tx) => {
      tx.update(storeRef, {
        ...allowedUpdates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminName,
      });

      const auditRef = db.collection('audit_logs').doc();
      tx.set(auditRef, {
        action: 'STORE_UPDATE',
        entityType: 'store',
        entityId: storeId,
        details: `تحديث بيانات المتجر ${storeData.name || storeId} (${Object.keys(allowedUpdates).join(', ')}) بواسطة ${adminName}`,
        severity: 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return res.json({ success: true, storeId, message: 'تم تحديث المتجر بنجاح' });
  } catch (err: any) {
    console.error('[TALABI Admin Store Update Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || 'حدث خطأ أثناء تحديث المتجر' });
  }
});

// 4. Admin Store Payment Recording Endpoint (Immutable Payment Logs)
app.post('/api/admin/payments/record', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {

  const { storeId, amount, paymentDate, paymentMethod, receiptNumber, notes, idempotencyKey } = req.body;

  if (!storeId || typeof storeId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المتجر storeId مطلوب' });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, error: 'المبلغ المحصّل يجب أن يكون رقماً أكبر من صفر' });
  }

  if (!paymentDate || typeof paymentDate !== 'string') {
    return res.status(400).json({ success: false, error: 'تاريخ التحصيل مطلوب' });
  }

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
    }

    const storeData = storeSnap.data()!;
    const cleanKey = typeof idempotencyKey === 'string' && idempotencyKey.trim() !== '' ? idempotencyKey.trim() : null;
    const paymentId = cleanKey ? `pmt_${cleanKey}` : `pmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentDocRef = db.collection('store_payments').doc(paymentId);

    // Requirement 4: Fast idempotent replay check before transaction
    const existingPaymentSnap = await paymentDocRef.get();
    if (existingPaymentSnap.exists) {
      const existingData = existingPaymentSnap.data()!;
      return res.json({
        success: true,
        message: 'تم استلام الدفعة مسبقاً وتأكيد تسجيلها بنجاح (إعادة إرسال مطابقة)',
        paymentId,
        amount: existingData.amount,
        isIdempotentReplay: true
      });
    }

    const cleanReceiptStr = typeof receiptNumber === 'string' && receiptNumber.trim() !== '' ? receiptNumber.trim() : null;
    const receiptLockKey = cleanReceiptStr ? cleanReceiptStr.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : null;
    const receiptLockRef = receiptLockKey ? db.collection('receipt_locks').doc(receiptLockKey) : null;

    // Create deterministic audit log reference before transaction
    const auditRef = db.collection('audit_logs').doc();
    let isReplayInTx = false;

    // Prevent duplicate recording using atomic transaction with deterministic receipt lock and audit log write
    await db.runTransaction(async (tx) => {
      // 1. All reads first
      const txPaymentSnap = await tx.get(paymentDocRef);
      if (txPaymentSnap.exists) {
        isReplayInTx = true;
        return;
      }

      let receiptLockSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (receiptLockRef && cleanReceiptStr) {
        receiptLockSnap = await tx.get(receiptLockRef);
      }

      // 2. Validations / checks
      if (receiptLockSnap && receiptLockSnap.exists) {
        const lockData = receiptLockSnap.data();
        if (lockData?.paymentId !== paymentId) {
          throw new Error(`DUPLICATE_RECEIPT_NUMBER:${cleanReceiptStr}`);
        }
      }

      const paymentRecord = {
        id: paymentId,
        storeId,
        storeName: storeData.name || '',
        amount: numericAmount,
        paymentDate,
        paymentMethod: paymentMethod || 'cash',
        receiptNumber: cleanReceiptStr,
        notes: notes || '',
        idempotencyKey: cleanKey,
        confirmedBy: req.authenticatedUser?.name || 'المدير',
        confirmedByUid: req.authenticatedUser?.uid,
        createdAt: new Date().toISOString(),
        createdAtTimestamp: Date.now()
      };

      // 3. All writes (Payment, Receipt Lock, and Audit Log written atomically)
      if (receiptLockRef && cleanReceiptStr) {
        tx.set(receiptLockRef, {
          receiptNumber: cleanReceiptStr,
          receiptLockKey,
          paymentId,
          storeId,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      tx.set(paymentDocRef, paymentRecord);

      tx.set(auditRef, {
        action: 'RECORD_STORE_PAYMENT',
        entityType: 'store',
        entityId: storeId,
        details: `تسجيل تحصيل مبلغ ${numericAmount.toLocaleString()} د.ع من ${storeData.name || storeId} برقم إيصال (${cleanReceiptStr || 'بدون'})`,
        severity: 'info',
        performedBy: `${req.authenticatedUser?.name || 'المدير'} (admin)`,
        performedByUid: req.authenticatedUser?.uid || null,
        paymentId,
        timestamp: FieldValue.serverTimestamp()
      });
    });

    if (isReplayInTx) {
      return res.json({
        success: true,
        message: 'تم استلام الدفعة مسبقاً وتأكيد تسجيلها بنجاح (إعادة إرسال مطابقة)',
        paymentId,
        amount: numericAmount,
        isIdempotentReplay: true
      });
    }

    return res.json({
      success: true,
      message: 'تم تسجيل الدفعة المحصلة بنجاح وتوثيقها في السجل المالي وسجل التدقيق الذري',
      paymentId,
      amount: numericAmount
    });
  } catch (err: any) {
    if (err.message && err.message.startsWith('DUPLICATE_RECEIPT_NUMBER')) {
      const rNum = err.message.split(':')[1] || receiptNumber;
      return res.status(409).json({ success: false, error: `رقم الإيصال (${rNum}) مسجل مسبقاً في النظام بحجز ذري مؤكد.` });
    }
    console.error('[TALABI Admin Payment Record Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'حدث خطأ أثناء تسجيل الدفعة' });
  }
});

// 5. Admin Assign Courier Endpoint (Atomic Transaction with Strict Approval Check & Atomic Audit Log)
app.post('/api/admin/orders/assign-courier', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { orderId, courierId } = req.body;
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الطلب orderId مطلوب' });
  }
  if (!courierId || typeof courierId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الكابتن courierId مطلوب' });
  }

  const adminName = req.authenticatedUser?.name || 'المدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const courierRef = db.collection('couriers').doc(courierId);
    const auditRef = db.collection('audit_logs').doc();

    const result = await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(orderRef);
      const cSnap = await tx.get(courierRef);

      if (!oSnap.exists) {
        throw new Error('الطلب غير موجود في النظام');
      }
      if (!cSnap.exists) {
        throw new Error('بيانات المندوب غير موجودة في النظام');
      }

      const order = oSnap.data()!;
      const courier = cSnap.data()!;

      // 1. Prevent assigning order if already assigned
      if (order.courierId && order.courierId.trim() !== '') {
        throw new Error('الطلب مسند بالفعل لكابتن آخر ولا يمكن إعادة إسناده مباشرة');
      }

      // 2. Validate order status allows assignment
      const validAssignmentStatuses = ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup', 'courier_offered'];
      if (!validAssignmentStatuses.includes(order.status)) {
        throw new Error(`لا يمكن إسناد الطلب وحالته الحالية هي (${order.status})`);
      }

      // 3. Strict validation: approvalStatus MUST be strictly 'approved' (reject missing, null, pending, etc.)
      if (courier.approvalStatus !== 'approved') {
        throw new Error('حساب الكابتن غير معتمد (يجب أن يكون approvalStatus مساوياً لـ approved حصراً)');
      }

      // 4. Validate courier is not busy or holding another active order
      if (courier.isBusy || (courier.currentOrderId && courier.currentOrderId.trim() !== '')) {
        throw new Error('الكابتن مشغول حالياً ولديه طلب نشط قيد التوصيل');
      }

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const newEvent = {
        id: 'ev_' + Date.now(),
        orderId,
        status: 'courier_assigned',
        timestamp: nowTime,
        note: `تم إسناد الطلب يدوياً للكابتن ${courier.name || 'المندوب'} بواسطة المدير (${adminName})`,
        actorRole: 'admin',
        actorName: adminName,
      };

      // Atomic Update to Order
      tx.update(orderRef, {
        courierId,
        courierName: courier.name || '',
        courierPhone: courier.phone || '',
        status: 'courier_assigned',
        offeredToCourierId: null,
        offeredAt: null,
        offeredExpireAt: null,
        events: [...(order.events || []), newEvent],
      });

      // Atomic Update to Courier
      tx.update(courierRef, {
        isBusy: true,
        currentOrderId: orderId,
        currentOfferOrderId: null,
        updatedAt: nowTime,
      });

      // Atomic Audit Log creation inside transaction (prevents silent failure or false claims of success)
      tx.set(auditRef, {
        action: 'ADMIN_ASSIGN_COURIER',
        entityType: 'order',
        entityId: orderId,
        details: `إسناد الطلب ${orderId} يدوياً للكابتن ${courier.name || 'المندوب'} بواسطة المدير (${adminEmail})`,
        severity: 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });

      return { success: true, orderId, courierId, courierName: courier.name || 'المندوب', auditLogId: auditRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Admin Assign Courier Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// Helper function to safely extract delivered timestamp (Order completion time)
function getOrderDeliveredAtMs(o: any): number {
  if (typeof o.deliveredAtTimestamp === 'number' && o.deliveredAtTimestamp > 0) {
    return o.deliveredAtTimestamp;
  }
  if (o.deliveredAt) {
    const ms = new Date(o.deliveredAt).getTime();
    if (!isNaN(ms) && ms > 0) return ms;
  }
  if (Array.isArray(o.events)) {
    const delEvent = o.events.find((e: any) => e.status === 'delivered');
    if (delEvent) {
      if (typeof delEvent.timestamp === 'number' && delEvent.timestamp > 0) return delEvent.timestamp;
      if (typeof delEvent.timestamp === 'string') {
        const ms = new Date(delEvent.timestamp).getTime();
        if (!isNaN(ms) && ms > 0) return ms;
      }
    }
  }
  // Fallback for older orders marked as delivered without event
  if (o.status === 'delivered') {
    if (typeof o.createdAtTimestamp === 'number' && o.createdAtTimestamp > 0) return o.createdAtTimestamp;
    if (o.createdAt) {
      const ms = new Date(o.createdAt).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
  }
  return 0;
}

// 5. Admin Accounting Statements Endpoint (10-Day Cycles in Baghdad Time GMT+3)
app.get('/api/admin/accounting/statements', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {

  try {
    const targetStoreId = req.query.storeId as string | undefined;
    const baseStartDateStr = (req.query.startDate as string) || '2025-01-01'; // Default Baghdad cycle start date

    // 1. Fetch stores
    let storesSnap;
    if (targetStoreId) {
      const sDoc = await db.collection('stores').doc(targetStoreId).get();
      storesSnap = sDoc.exists ? [sDoc] : [];
    } else {
      const sQuery = await db.collection('stores').get();
      storesSnap = sQuery.docs;
    }

    // 2. Fetch all completed orders (delivered)
    const ordersSnap = await db.collection('orders').where('status', '==', 'delivered').get();
    const deliveredOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // 3. Fetch all recorded payments
    const paymentsSnap = await db.collection('store_payments').get();
    const allPayments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Baghdad base timestamp (Asia/Baghdad GMT+3)
    const baghdadBaseMs = new Date(`${baseStartDateStr}T00:00:00+03:00`).getTime();
    const nowMs = Date.now();
    const MS_PER_10_DAYS = 10 * 24 * 60 * 60 * 1000;

    // Determine current cycle index
    const totalPeriodsCount = Math.max(1, Math.ceil((nowMs - baghdadBaseMs) / MS_PER_10_DAYS));

    const statementsByStore: Record<string, any[]> = {};

    for (const storeDoc of storesSnap) {
      const storeData = storeDoc.data() as any;
      const sId = storeDoc.id;
      const storeOrders = deliveredOrders.filter(o => o.storeId === sId);
      const storePayments = allPayments.filter(p => p.storeId === sId);

      const storeStatements = [];
      let runningPreviousBalance = 0;

      for (let periodIdx = 0; periodIdx < totalPeriodsCount; periodIdx++) {
        const periodStartMs = baghdadBaseMs + (periodIdx * MS_PER_10_DAYS);
        const periodEndMs = periodStartMs + MS_PER_10_DAYS - 1;

        // Convert timestamps to Baghdad Date strings (YYYY-MM-DD)
        const periodStartStr = new Date(periodStartMs + 3 * 3600 * 1000).toISOString().split('T')[0];
        const periodEndStr = new Date(periodEndMs + 3 * 3600 * 1000).toISOString().split('T')[0];

        // Requirement 2: Filter orders in this 10-day period strictly by deliveredAtTimestamp (Order completion date)
        const periodOrders = storeOrders.filter(o => {
          if (o.status !== 'delivered') return false;
          const deliveredMs = getOrderDeliveredAtMs(o);
          if (!deliveredMs || deliveredMs <= 0) return false;
          return deliveredMs >= periodStartMs && deliveredMs <= periodEndMs;
        });

        // Filter payments in this 10-day period
        const periodPayments = storePayments.filter(p => {
          const t = p.createdAtTimestamp || (p.paymentDate ? new Date(`${p.paymentDate}T12:00:00+03:00`).getTime() : 0);
          return t >= periodStartMs && t <= periodEndMs;
        });

        // Compute food sales & commission
        let totalFoodSales = 0;
        let totalCommissionDue = 0;
        let missingSnapshotOrdersCount = 0;

        for (const order of periodOrders) {
          const foodSubtotal = Number(order.financials?.subtotal || order.subtotal || 0);
          totalFoodSales += foodSubtotal;

          // Requirement 3: Strictly use saved snapshot. Never invent historic commission rate using live store rate!
          if (typeof order.financials?.platformCommissionAmount === 'number') {
            totalCommissionDue += order.financials.platformCommissionAmount;
          } else if (typeof order.platformCommissionAmount === 'number') {
            totalCommissionDue += order.platformCommissionAmount;
          } else {
            missingSnapshotOrdersCount++;
          }
        }

        const totalPaymentsCollected = periodPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
        const previousBalance = runningPreviousBalance;

        // Requirement 1: Preserve store overpayments and credit balance
        // netBalance = previousBalance (can be negative credit) + totalCommissionDue - totalPaymentsCollected
        const netBalance = previousBalance + totalCommissionDue - totalPaymentsCollected;

        let remainingBalance = 0;
        let creditBalance = 0;

        if (netBalance > 0) {
          remainingBalance = netBalance;
          creditBalance = 0;
        } else if (netBalance < 0) {
          remainingBalance = 0;
          creditBalance = Math.abs(netBalance);
        } else {
          remainingBalance = 0;
          creditBalance = 0;
        }

        // Update running balance carried forward to next period
        runningPreviousBalance = netBalance;

        storeStatements.push({
          id: `stmt_${sId}_p${periodIdx}`,
          storeId: sId,
          storeName: storeData.name || '',
          periodIndex: periodIdx + 1,
          startDate: periodStartStr,
          endDate: periodEndStr,
          totalFoodSales,
          commissionRate: storeData.commissionRate ?? 0,
          commissionDue: totalCommissionDue,
          paymentsCollected: totalPaymentsCollected,
          previousBalance,
          remainingBalance,
          creditBalance,
          completedOrdersCount: periodOrders.length,
          missingSnapshotOrdersCount
        });
      }

      statementsByStore[sId] = storeStatements;
    }

    return res.json({
      success: true,
      baseStartDate: baseStartDateStr,
      statementsByStore
    });
  } catch (err: any) {
    console.error('[TALABI Admin Accounting Statements Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'حدث خطأ أثناء احتساب كشوفات الحساب' });
  }
});

// 6. Admin Legacy Orders Financial Audit Endpoint (Report on delivered orders lacking financial snapshot)
app.get('/api/admin/accounting/legacy-audit', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  try {
    let ordersSnap: any = null;
    try {
      ordersSnap = await db.collection('orders').where('status', '==', 'delivered').get();
    } catch (qErr: any) {
      console.warn('[TALABI Legacy Audit Firestore Query Warning]:', qErr?.message);
    }

    const legacyOrders: any[] = [];
    if (ordersSnap && !ordersSnap.empty) {
      ordersSnap.forEach((doc: any) => {
        const data = doc.data();
        const hasSnapshot = typeof data.financials?.platformCommissionAmount === 'number' || typeof data.platformCommissionAmount === 'number';
        if (!hasSnapshot) {
          legacyOrders.push({
            orderId: doc.id,
            storeId: data.storeId || '',
            storeName: data.storeName || '',
            createdAt: data.createdAt || '',
            createdAtTimestamp: data.createdAtTimestamp || 0,
            deliveredAtTimestamp: data.deliveredAtTimestamp || null,
            subtotal: Number(data.financials?.subtotal || data.subtotal || 0)
          });
        }
      });
    }

    return res.json({
      success: true,
      totalDeliveredOrders: ordersSnap ? ordersSnap.size : 0,
      legacyOrdersLackingSnapshotCount: legacyOrders.length,
      legacyOrders,
      proposedMigrationStrategy: {
        summary: 'اقتراح ترحيل آمن للطلبات القديمة التي تفتقد لـ Snapshot المالي دون فرض نسب غير مثبتة أوتوماتيكياً.',
        steps: [
          '1. مراجعة سجل تغييرات عمولات المتجر القائمة في مجموعة store_commission_history لتحديد النسبة المعتمدة تاريخياً لكل متجر وقت إنشاء الطلب.',
          '2. استخدام النسبة العامة للإنشاء (10%) كنسبة افتراضية فقط للطلبات التي لا يمكن العثور على سجل عمولة تاريخي مؤكد لها.',
          '3. إنشاء أداة ترحيل صريحة تتطلب موافقة وتأكيد مدير المنصة قبل حفظ حقول financials.platformCommissionAmount للطلبات القديمة.'
        ]
      }
    });
  } catch (err: any) {
    console.error('[TALABI Legacy Audit Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'حدث خطأ أثناء إجراء التدقيق المالي للطلبات القديمة' });
  }
});

// 7. Admin Session Verification Endpoint
app.get('/api/admin/verify-session', requireUserAuth, requireAdminAuth, (req: AuthenticatedUserRequest, res) => {
  return res.json({
    success: true,
    user: {
      uid: req.authenticatedUser?.uid,
      role: req.authenticatedUser?.role,
      name: req.authenticatedUser?.name,
      email: req.authenticatedUser?.email
    }
  });
});

// 8. Admin Trusted Server-Side Audit Log Endpoint (Writes to audit_logs via Admin SDK)
app.post('/api/admin/audit-log', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { action, entityType, entityId, details, severity } = req.body;
  if (!action || !entityType || !entityId) {
    return res.status(400).json({ success: false, error: 'بيانات السجل غير مكتملة' });
  }
  try {
    const docRef = await db.collection('audit_logs').add({
      action: String(action).slice(0, 100),
      entityType: String(entityType).slice(0, 50),
      entityId: String(entityId).slice(0, 128),
      details: String(details || '').slice(0, 1000),
      severity: severity || 'info',
      performedBy: `${req.authenticatedUser?.name || 'مدير'} (admin)`,
      performedByUid: req.authenticatedUser?.uid || 'unknown',
      timestamp: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, logId: docRef.id });
  } catch (err: any) {
    console.error('[TALABI Audit Log Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Protected Admin Courier Wallet Adjustment Endpoint (Firestore Transaction + Idempotency + Audit Log)
app.post('/api/admin/couriers/adjust-wallet', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { courierId, amount, reason, idempotencyKey } = req.body;
  if (!courierId || typeof courierId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف الكابتن courierId مطلوب' });
  }
  if (typeof amount !== 'number' || isNaN(amount)) {
    return res.status(400).json({ success: false, error: 'المبلغ يجب أن يكون رقماً صحيحاً أو عشرياً' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ success: false, error: 'سبب التعديل المالي reason مطلوب' });
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return res.status(400).json({ success: false, error: 'مفتاح منع التكرار idempotencyKey مطلوب' });
  }

  const adminName = req.authenticatedUser?.name || 'المدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  try {
    const courierRef = db.collection('couriers').doc(courierId);
    const auditRef = db.collection('audit_logs').doc();

    const result = await db.runTransaction(async (tx) => {
      // Idempotency check: query if audit log with this idempotencyKey already exists
      const existingAuditQuery = await db.collection('audit_logs').where('idempotencyKey', '==', idempotencyKey).limit(1).get();
      if (!existingAuditQuery.empty) {
        const existingData = existingAuditQuery.docs[0].data();
        return {
          success: true,
          message: 'تم تنفيذ العملية مسبقاً (Idempotent Replay)',
          courierId,
          auditLogId: existingAuditQuery.docs[0].id,
          walletBalance: existingData.balanceAfter ?? 0
        };
      }

      const cSnap = await tx.get(courierRef);
      if (!cSnap.exists) {
        throw new Error('بيانات المندوب غير موجودة في النظام');
      }

      const courier = cSnap.data()!;
      const oldWalletBalance = Number(courier.walletBalance || 0);
      const oldTotalEarnings = Number(courier.totalEarnings || 0);

      const newWalletBalance = oldWalletBalance + amount;
      const newTotalEarnings = amount > 0 ? oldTotalEarnings + amount : oldTotalEarnings;

      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

      // Atomic Update to Courier
      tx.update(courierRef, {
        walletBalance: newWalletBalance,
        totalEarnings: newTotalEarnings,
        updatedAt: nowTime,
      });

      // Atomic Audit Log creation inside transaction
      tx.set(auditRef, {
        action: 'ADMIN_ADJUST_COURIER_WALLET',
        entityType: 'courier',
        entityId: courierId,
        courierName: courier.name || 'الكابتن',
        amount,
        reason: reason.trim(),
        balanceBefore: oldWalletBalance,
        balanceAfter: newWalletBalance,
        idempotencyKey,
        details: `تعديل محفظة الكابتن ${courier.name || 'الكابتن'} بمبلغ ${amount} د.ع. السبب: ${reason}. الرصيد قبل: ${oldWalletBalance}، بعد: ${newWalletBalance} بواسطة المدير (${adminEmail})`,
        severity: 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        courierId,
        walletBalance: newWalletBalance,
        auditLogId: auditRef.id
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Admin Adjust Courier Wallet Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// 10. Protected Admin Customer Ban/Unban Endpoint (Firestore Transaction + Idempotency + Audit Log)
app.post('/api/admin/customers/ban', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { userId, isBanned, reason, idempotencyKey } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف العميل userId مطلوب' });
  }
  if (typeof isBanned !== 'boolean') {
    return res.status(400).json({ success: false, error: 'حالة الحظر isBanned يجب أن تكون قيمة منطقية (true/false)' });
  }
  if (isBanned && (!reason || typeof reason !== 'string' || reason.trim() === '')) {
    return res.status(400).json({ success: false, error: 'سبب الحظر مطلوب لتسجيل العملية' });
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return res.status(400).json({ success: false, error: 'مفتاح منع التكرار idempotencyKey مطلوب' });
  }

  const adminName = req.authenticatedUser?.name || 'المدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  if (userId === adminUid) {
    return res.status(400).json({ success: false, error: 'لا يمكنك حظر حسابك الإداري الشخصي' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const auditRef = db.collection('audit_logs').doc();

    const result = await db.runTransaction(async (tx) => {
      const existingAuditQuery = await db.collection('audit_logs').where('idempotencyKey', '==', idempotencyKey).limit(1).get();
      if (!existingAuditQuery.empty) {
        const existingData = existingAuditQuery.docs[0].data();
        return {
          success: true,
          message: 'تم تنفيذ العملية مسبقاً (Idempotent Replay)',
          userId,
          auditLogId: existingAuditQuery.docs[0].id,
          isBanned: existingData.newStatus ?? isBanned
        };
      }

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('حساب العميل غير موجود في النظام');
      }

      const userData = userSnap.data()!;
      const oldIsBanned = Boolean(userData.isBanned);

      if (oldIsBanned === isBanned) {
        return {
          success: true,
          message: isBanned ? 'الحساب محظور مسبقاً' : 'الحساب مفعل مسبقاً',
          userId,
          isBanned
        };
      }

      const cleanReason = reason ? reason.trim() : (isBanned ? 'حظر إداري' : 'إلغاء الحظر');

      tx.update(userRef, {
        isBanned,
        bannedReason: isBanned ? cleanReason : null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminName
      });

      tx.set(auditRef, {
        action: isBanned ? 'CUSTOMER_BAN' : 'CUSTOMER_UNBAN',
        entityType: 'user',
        entityId: userId,
        customerName: userData.name || 'زبون',
        customerPhone: userData.phone || '',
        previousStatus: oldIsBanned,
        newStatus: isBanned,
        reason: cleanReason,
        idempotencyKey,
        details: `${isBanned ? 'حظر' : 'إلغاء حظر'} حساب العميل ${userData.name || userId}. السبب: ${cleanReason} بواسطة المدير (${adminEmail})`,
        severity: isBanned ? 'warning' : 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        userId,
        isBanned,
        auditLogId: auditRef.id
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Admin Customer Ban Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// 11. Protected Admin Pricing Settings Update Endpoint (Firestore Transaction + Audit Log)
app.post('/api/admin/pricing/update', requireUserAuth, requireAdminAuth, async (req: AuthenticatedUserRequest, res) => {
  const { newSettings } = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ success: false, error: 'إعدادات التسعير الجديدة مطلوبة' });
  }

  const baseFee = newSettings.distanceBaseFee ?? newSettings.baseDeliveryFee;
  if (baseFee !== undefined && (typeof baseFee !== 'number' || baseFee < 0)) {
    return res.status(400).json({ success: false, error: 'أجرة التوصيل الأساسية يجب ألا تكون سالبة' });
  }
  const perKm = newSettings.distanceFeePerKm ?? newSettings.perKmFee;
  if (perKm !== undefined && (typeof perKm !== 'number' || perKm < 0)) {
    return res.status(400).json({ success: false, error: 'أجرة المسافة لكل كيلومتر يجب ألا تكون سالبة' });
  }
  const maxFee = newSettings.distanceMaxFee ?? newSettings.maxDeliveryFee;
  if (maxFee !== undefined && (typeof maxFee !== 'number' || maxFee < 0)) {
    return res.status(400).json({ success: false, error: 'الحد الأعلى لأجرة التوصيل يجب ألا يكون سالباً' });
  }
  const commPct = newSettings.defaultPlatformCommissionPercent ?? newSettings.platformCommissionPercent;
  if (commPct !== undefined && (typeof commPct !== 'number' || commPct < 0 || commPct > 100)) {
    return res.status(400).json({ success: false, error: 'نسبة عمولة المنصة يجب أن تكون بين 0% و 100%' });
  }

  const adminName = req.authenticatedUser?.name || 'المدير';
  const adminEmail = req.authenticatedUser?.email || '';
  const adminUid = req.authenticatedUser?.uid || '';

  try {
    const settingsRef = db.collection('platform_settings').doc('delivery_and_commissions');
    const auditRef = db.collection('audit_logs').doc();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(settingsRef);
      const oldSettings = snap.exists ? snap.data() : {};

      const merged = {
        ...oldSettings,
        ...newSettings,
        updatedAt: new Date().toISOString(),
        updatedBy: adminName
      };

      tx.set(settingsRef, merged, { merge: true });

      tx.set(auditRef, {
        action: 'UPDATE_PRICING_SETTINGS',
        entityType: 'system',
        entityId: 'delivery_and_commissions',
        previousSettings: oldSettings,
        newSettings: merged,
        details: `تحديث إعدادات التسعير والعمولات للمنصة بواسطة المدير (${adminEmail})`,
        severity: 'info',
        performedBy: `${adminName} (admin)`,
        performedByUid: adminUid,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        settings: merged,
        auditLogId: auditRef.id
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Admin Pricing Update Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// 12. Protected Support Message Endpoint (Append-only message verification + Idempotency)
app.post('/api/support/message', requireUserAuth, async (req: AuthenticatedUserRequest, res) => {
  const { conversationId, text, idempotencyKey } = req.body;
  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المحادثة مطلوب' });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'نص الرسالة مطلوب' });
  }

  const authUser = req.authenticatedUser!;
  const authUid = authUser.uid;
  const userRole = authUser.role;
  const userName = authUser.name;
  const cleanText = text.trim();

  try {
    const convRef = db.collection('support_conversations').doc(conversationId);

    const result = await db.runTransaction(async (tx) => {
      if (idempotencyKey && typeof idempotencyKey === 'string') {
        const existingConvSnap = await tx.get(convRef);
        if (existingConvSnap.exists) {
          const cData = existingConvSnap.data()!;
          const existingMsg = (cData.messages || []).find((m: any) => m.idempotencyKey === idempotencyKey);
          if (existingMsg) {
            return {
              success: true,
              message: 'تم إرسال الرسالة مسبقاً (Idempotent Replay)',
              sentMessage: existingMsg
            };
          }
        }
      }

      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        throw new Error('المحادثة غير موجودة في النظام');
      }

      const convData = convSnap.data()!;
      const isOwner = convData.userId === authUid;
      const isAdminOrSupport = userRole === 'admin' || userRole === 'support';

      if (!isOwner && !isAdminOrSupport) {
        throw new Error('غير مصرح: لا يمكنك المشاركة في محادثة لا تخصك');
      }

      const isAgent = isAdminOrSupport;
      const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const nowTime = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

      const newMessage = {
        id: msgId,
        conversationId,
        senderId: authUid,
        senderName: userName,
        senderRole: isAgent ? 'admin' : userRole,
        text: cleanText,
        timestamp: nowTime,
        isAgent,
        ...(idempotencyKey ? { idempotencyKey } : {})
      };

      const updatedMessages = [...(convData.messages || []), newMessage];

      tx.update(convRef, {
        messages: updatedMessages,
        lastMessage: cleanText,
        lastUpdated: new Date().toISOString(),
        ...(isAgent && convData.status === 'pending' ? { status: 'open' } : {})
      });

      return {
        success: true,
        sentMessage: newMessage
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Support Message Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

// 13. Protected Support Status Update Endpoint (Admin/Support Only + Audit Log)
app.post('/api/admin/support/status', requireUserAuth, async (req: AuthenticatedUserRequest, res) => {
  const { conversationId, status } = req.body;
  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ success: false, error: 'معرّف المحادثة مطلوب' });
  }
  if (!['open', 'pending', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, error: 'حالة المحادثة غير صالحة' });
  }

  const authUser = req.authenticatedUser!;
  const authUid = authUser.uid;
  const userRole = authUser.role;
  const userName = authUser.name;

  if (userRole !== 'admin' && userRole !== 'support') {
    return res.status(403).json({ success: false, error: 'غير مصرح: تتطلب صلاحية الدعم الفني أو الإدارة لتغيير حالة التذكرة' });
  }

  try {
    const convRef = db.collection('support_conversations').doc(conversationId);
    const auditRef = db.collection('audit_logs').doc();

    const result = await db.runTransaction(async (tx) => {
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        throw new Error('المحادثة غير موجودة في النظام');
      }

      const convData = convSnap.data()!;
      const oldStatus = convData.status || 'open';

      if (oldStatus === status) {
        return { success: true, message: 'الحالة مطابقة مسبقاً', conversationId, status };
      }

      tx.update(convRef, {
        status,
        lastUpdated: new Date().toISOString()
      });

      tx.set(auditRef, {
        action: 'SUPPORT_STATUS_UPDATE',
        entityType: 'support_conversation',
        entityId: conversationId,
        previousStatus: oldStatus,
        newStatus: status,
        details: `تحديث حالة التذكرة من (${oldStatus}) إلى (${status}) بواسطة الموظف (${userName})`,
        severity: 'info',
        performedBy: `${userName} (${userRole})`,
        performedByUid: authUid,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        conversationId,
        status,
        auditLogId: auditRef.id
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[TALABI Support Status Update Error]:', err);
    return res.status(400).json({ success: false, error: err?.message || String(err) });
  }
});

setInterval(courierAssignmentWorker, 3000);

// Set up frontend serving
async function setupFrontend() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TALABI Engine & Server running on http://0.0.0.0:${port} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

setupFrontend().catch((err) => {
  console.error('[TALABI Server] Failed to initialize frontend server:', err);
});
