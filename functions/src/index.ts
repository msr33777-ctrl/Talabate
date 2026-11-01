import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';

admin.initializeApp();
const db = admin.firestore();
const tasksClient = new CloudTasksClient();

// Configuration
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'ai-studio-talabi-6a8714a3-14fa-4b58-aad4-fced9a57737b';
const LOCATION = 'us-central1';
const QUEUE = 'courier-assignment-queue';

const ASSIGNABLE_STATUSES = ['created', 'merchant_accepted', 'preparing', 'ready_for_pickup'];

export const onOrderCreated = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const orderId = context.params.orderId;
    const orderData = snap.data();
    
    if (!orderData) return;

    // Start assignment process immediately upon creation
    await assignToNextCourier(orderId);
  });

export const onOrderUpdated = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;

    if (!after || !before) return;

    // Trigger assignment if:
    // 1. Status changed to an assignable status (e.g. merchant accepted or ready for pickup)
    // 2. AND it's not already assigned or being offered
    const statusChanged = before.status !== after.status;
    const isNowAssignable = ASSIGNABLE_STATUSES.includes(after.status);
    const isUnassigned = !after.courierId && !after.offeredToCourierId;

    if (isNowAssignable && isUnassigned && statusChanged) {
       console.log(`[TALABI Functions] Triggering assignment for order ${orderId} due to status change: ${before.status} -> ${after.status}`);
       await assignToNextCourier(orderId);
    }
  });

async function assignToNextCourier(orderId: string) {
  let courierId: string | null = null;

  console.log(`[TALABI Functions] Attempting to assign order: ${orderId}`);

  // Atomic assignment logic (transaction)
  await db.runTransaction(async (transaction) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const orderSnap = await transaction.get(orderRef);
    const order = orderSnap.data();
    
    // Safety check: only assign unassigned orders in specific statuses
    if (!order || !ASSIGNABLE_STATUSES.includes(order.status)) {
      console.log(`[TALABI Functions] Order ${orderId} is not in assignable status: ${order?.status}`);
      return;
    }
    
    if (order.courierId || order.offeredToCourierId) {
      console.log(`[TALABI Functions] Order ${orderId} already has courier or offer: ${order.courierId || order.offeredToCourierId}`);
      return;
    }
    
    // Find available courier who doesn't have a pending offer and hasn't rejected this order
    // NOTE: We don't query currentOfferOrderId == null here because Firestore returns zero results if the field is missing.
    // Instead we query general availability and filter in code for better resilience.
    const couriersSnapshot = await db.collection('couriers')
      .where('isOnline', '==', true)
      .where('isBusy', '==', false)
      .get();
      
    // Filter available couriers
    const availableCouriers = couriersSnapshot.docs.filter(doc => {
      const cData = doc.data();
      // Must not have an active offer (null or undefined check)
      const hasNoOffer = !cData.currentOfferOrderId;
      // Must not have rejected this specific order
      const hasNotRejected = !(order.rejectedCourierIds || []).includes(doc.id);
      return hasNoOffer && hasNotRejected;
    });

    if (availableCouriers.length === 0) {
      console.log(`[TALABI Functions] No available couriers found for order ${orderId}`);
      return;
    }
    
    // Pick the first available courier (could be improved with distance logic)
    const courierDoc = availableCouriers[0];
    courierId = courierDoc.id;
    
    console.log(`[TALABI Functions] Offering order ${orderId} to courier ${courierId}`);

    // Reserve the courier and update the order
    transaction.update(orderRef, {
      offeredToCourierId: courierId,
      offeredAt: admin.firestore.FieldValue.serverTimestamp(),
      previousStatus: order.status,
      status: 'courier_offered'
    });

    transaction.update(courierDoc.ref, {
      currentOfferOrderId: orderId
    });
  });

  // Create timeout task outside of transaction
  if (courierId) {
    try {
      await createTimeoutTask(orderId, courierId);
    } catch (err) {
      console.error(`[TALABI Functions] Failed to create timeout task for ${orderId}:`, err);
      // Fallback: Manually reset offer if task creation fails to prevent deadlocks
      await clearOffer(orderId, courierId!);
    }
  }
}

async function clearOffer(orderId: string, courierId: string) {
  await db.runTransaction(async (transaction) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const courierRef = db.doc(`couriers/${courierId}`);
    
    const [orderSnap, courierSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(courierRef)
    ]);
    
    const order = orderSnap.data();
    const courier = courierSnap.data();
    
    if (order && order.offeredToCourierId === courierId) {
      transaction.update(orderRef, {
        offeredToCourierId: null,
        offeredAt: null,
        status: 'created' // Reset to created if it was offered
      });
    }
    
    if (courier && courier.currentOfferOrderId === orderId) {
      transaction.update(courierRef, {
        currentOfferOrderId: null
      });
    }
  });
}

async function createTimeoutTask(orderId: string, courierId: string) {
  const queuePath = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE);
  const scheduleTime = Math.floor(Date.now() / 1000) + 15;
  
  await tasksClient.createTask({
    parent: queuePath,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/handleAssignmentTimeout`,
        body: Buffer.from(JSON.stringify({ orderId, courierId })).toString('base64'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TIMEOUT_SECRET || 'TALABI_INTERNAL_SECRET'}`
        },
      },
      scheduleTime: {
        seconds: scheduleTime,
      },
    },
  });
}

export const handleAssignmentTimeout = functions.https.onRequest(async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = `Bearer ${process.env.TIMEOUT_SECRET || 'TALABI_INTERNAL_SECRET'}`;

  if (!authHeader || authHeader !== expectedSecret) {
    res.status(403).send('Unauthorized');
    return;
  }

  const { orderId, courierId } = req.body;
  
  // Transaction: Reset offer if still offered to THIS courier
  await db.runTransaction(async (transaction) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const courierRef = db.doc(`couriers/${courierId}`);
    
    const [orderSnap, courierSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(courierRef)
    ]);
    
    const order = orderSnap.data();
    const courier = courierSnap.data();
    
    // Check if the order is still offered to this courier
    if (order && order.offeredToCourierId === courierId) {
      const updates: any = {
        offeredToCourierId: null,
        offeredAt: null
      };

      // Revert status to its state before the offer (e.g., 'created' or 'merchant_accepted').
      if (order.status === 'courier_offered') {
        updates.status = order.previousStatus || 'created';
      }

      transaction.update(orderRef, updates);
      
      // Free the courier if they are still reserved for this specific order
      if (courier && courier.currentOfferOrderId === orderId) {
        transaction.update(courierRef, {
          currentOfferOrderId: null
        });
      }
    } else if (courier && courier.currentOfferOrderId === orderId) {
       // Cleanup courier if they are still reserved but order has moved on
       transaction.update(courierRef, {
          currentOfferOrderId: null
       });
    }
  });
  
  // Note: We don't call assignToNextCourier here because the status change to 'created'
  // will trigger onOrderUpdated which will call assignToNextCourier.
  
  res.send('Timeout handled');
});
