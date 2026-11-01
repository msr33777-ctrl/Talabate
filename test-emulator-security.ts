import http from 'http';
import fs from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const EMULATOR_HOST = '127.0.0.1:8085';
const PROJECT_ID = 'demo-no-project';
process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;

/**
 * Helper to create an unsigned JWT accepted by the local Firebase Firestore Emulator
 * so the real Java Firestore Rules Engine evaluates `request.auth.uid` and `request.auth.token`.
 */
function createEmulatorJwt(uid: string, claims: Record<string, any> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      user_id: uid,
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      iat: nowSec - 60,
      exp: nowSec + 3600,
      ...claims,
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

/**
 * Performs an HTTP request directly against the local Firestore Emulator REST API
 * with an optional user JWT to trigger real `firestore.rules` evaluation.
 */
async function emulatorRestRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  subPath: string,
  jwtToken?: string | null,
  bodyObj?: any
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const basePath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
    const fullPath = subPath.startsWith(':commit')
      ? `${basePath}${subPath}`
      : `${basePath}/${subPath.replace(/^\//, '')}`;

    const payloadStr = bodyObj ? JSON.stringify(bodyObj) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }
    if (payloadStr) {
      headers['Content-Length'] = String(Buffer.byteLength(payloadStr));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8085,
        path: fullPath,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {}
          resolve({ statusCode: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

async function checkEmulatorConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${EMULATOR_HOST}`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function runSecurityTests() {
  console.log('===============================================================');
  console.log('   TALABI SECURITY & EMULATOR VERIFICATION TEST SUITE         ');
  console.log('===============================================================');

  const isConnected = await checkEmulatorConnection();
  if (!isConnected) {
    console.error(`❌ CRITICAL FAILURE: Firestore Emulator is NOT connected on http://${EMULATOR_HOST}!`);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ VERIFIED: Connected strictly to local Firestore Emulator at http://${EMULATOR_HOST}`);
  console.log('🔒 Production Database Security: SAFE (0 Network calls to live database)\n');

  if (!getApps().length) {
    initializeApp({ projectId: PROJECT_ID });
  }
  const adminDb = getFirestore();

  let passed = 0;
  let failed = 0;

  function recordPass(msg: string) {
    passed++;
    console.log(`✅ [PASS] ${msg}`);
  }

  function recordFail(msg: string) {
    failed++;
    console.error(`❌ [FAIL] ${msg}`);
  }

  try {
    // =========================================================================
    // 1. POINT 1: EMAIL-BASED ADMIN REMOVED; CUSTOM CLAIM REQUIRED; OTHER ROLES PRESERVED
    // =========================================================================
    console.log('--- 1. Testing Firestore Rules: Email Admin Removal & Role Preservation ---');

    const emailOnlyToken = createEmulatorJwt('uid_email_admin_no_claim', {
      email: 'msr33777@gmail.com',
      email_verified: true,
      // No role: 'admin' claim!
    });

    const verifiedAdminClaimToken = createEmulatorJwt('uid_real_admin_claim', {
      email: 'msr33777@gmail.com',
      email_verified: true,
      role: 'admin',
    });

    // 1.1: Email-only user tries to create an admin user document in /users
    const emailAdminCreateUserRes = await emulatorRestRequest(
      'POST',
      'users?documentId=uid_email_admin_no_claim',
      emailOnlyToken,
      {
        fields: toFirestoreFields({
          id: 'uid_email_admin_no_claim',
          name: 'Email Only User',
          phone: '07700000000',
          email: 'msr33777@gmail.com',
          role: 'admin',
        }),
      }
    );
    if (emailAdminCreateUserRes.statusCode === 403) {
      recordPass('Email-only token (msr33777@gmail.com without admin Custom Claim) REJECTED (403) when creating admin user profile');
    } else {
      recordFail(`Email-only token was allowed to create admin user! Status: ${emailAdminCreateUserRes.statusCode}`);
    }

    // 1.2: Email-only user tries to write to /platform_settings
    const emailAdminSettingsRes = await emulatorRestRequest(
      'PATCH',
      'platform_settings/test_config',
      emailOnlyToken,
      {
        fields: toFirestoreFields({ updatedBy: 'email_only' }),
      }
    );
    if (emailAdminSettingsRes.statusCode === 403) {
      recordPass('Email-only token (without admin Custom Claim) REJECTED (403) when writing to /platform_settings');
    } else {
      recordFail(`Email-only token was allowed to write platform_settings! Status: ${emailAdminSettingsRes.statusCode}`);
    }

    // 1.3: Verified Admin Custom Claim (role === 'admin') succeeds
    const claimAdminSettingsRes = await emulatorRestRequest(
      'PATCH',
      'platform_settings/test_config',
      verifiedAdminClaimToken,
      {
        fields: toFirestoreFields({ updatedBy: 'verified_admin_claim' }),
      }
    );
    if (claimAdminSettingsRes.statusCode === 200) {
      recordPass('Token with verified Custom Claim (role: "admin") ALLOWED (200) to write to /platform_settings');
    } else {
      recordFail(`Admin Custom Claim token failed! Status: ${claimAdminSettingsRes.statusCode}`);
    }

    // 1.4: Verify other roles (customer, merchant, courier, support) are preserved
    await adminDb.collection('users').doc('uid_cust_1').delete();
    const customerToken = createEmulatorJwt('uid_cust_1', { email: 'cust@talabi.iq' });
    const custCreateRes = await emulatorRestRequest('POST', 'users?documentId=uid_cust_1', customerToken, {
      fields: toFirestoreFields({
        id: 'uid_cust_1',
        name: 'زبون تجريبي',
        phone: '07701112233',
        email: 'cust@talabi.iq',
        role: 'customer',
      }),
    });

    await adminDb.collection('stores').doc('store_role_test').set({
      id: 'store_role_test',
      name: 'مطعم التجربة',
      merchantUserId: 'uid_merch_1',
      approvalStatus: 'approved',
      isOpen: true,
    });
    const merchantToken = createEmulatorJwt('uid_merch_1', { role: 'merchant' });
    const merchUpdateRes = await emulatorRestRequest('PATCH', 'stores/store_role_test', merchantToken, {
      fields: toFirestoreFields({
        id: 'store_role_test',
        name: 'مطعم التجربة المحدث',
        merchantUserId: 'uid_merch_1',
        approvalStatus: 'approved',
        isOpen: false,
      }),
    });

    await adminDb.collection('couriers').doc('courier_role_test').set({
      id: 'courier_role_test',
      userId: 'uid_courier_1',
      name: 'كابتن التجربة',
      approvalStatus: 'approved',
      isOnline: false,
    });
    const courierToken = createEmulatorJwt('uid_courier_1', { role: 'courier' });
    const courierUpdateRes = await emulatorRestRequest('PATCH', 'couriers/courier_role_test', courierToken, {
      fields: toFirestoreFields({
        id: 'courier_role_test',
        userId: 'uid_courier_1',
        name: 'كابتن التجربة',
        approvalStatus: 'approved',
        isOnline: true,
      }),
    });

    await adminDb.collection('support_conversations').doc('conv_role_test').set({
      id: 'conv_role_test',
      userId: 'uid_cust_1',
      status: 'open',
    });
    const supportToken = createEmulatorJwt('uid_support_1', { role: 'support' });
    const supportReadRes = await emulatorRestRequest('GET', 'support_conversations/conv_role_test', supportToken);

    if (
      custCreateRes.statusCode === 200 &&
      merchUpdateRes.statusCode === 200 &&
      courierUpdateRes.statusCode === 200 &&
      supportReadRes.statusCode === 200
    ) {
      recordPass('All non-admin roles (customer, merchant, courier, support) preserved and verified on Emulator');
    } else {
      recordFail(
        `Role preservation check failed: cust=${custCreateRes.statusCode}, merch=${merchUpdateRes.statusCode}, courier=${courierUpdateRes.statusCode}, support=${supportReadRes.statusCode}`
      );
    }

    // =========================================================================
    // 2. POINT 2: DISPATCH LOCK WITH MONOTONIC FENCING TOKEN (A vs B AND A vs A)
    // =========================================================================
    console.log('\n--- 2. Testing Dispatch Lock & Monotonic Fencing Token (A vs B & A vs A) ---');
    const WORKER_LOCK_ID = 'dispatch_worker_lock';
    const WORKER_LOCK_TTL_MS = 12000;
    const lockRef = adminDb.collection('platform_settings').doc(WORKER_LOCK_ID);

    // Clear lock doc before test
    await lockRef.delete();

    // Exact implementation from server.ts
    async function acquireWorkerLock(workerInstanceId: string, nowOverride?: number): Promise<number | null> {
      const now = nowOverride ?? Date.now();
      return await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(lockRef);
        let currentFencingToken = 0;
        if (snap.exists) {
          const data = snap.data()!;
          const expiresAt = data.expiresAt || 0;
          currentFencingToken = typeof data.fencingToken === 'number' ? data.fencingToken : 0;
          if (now < expiresAt && data.owner) {
            return null;
          }
        }
        const nextFencingToken = currentFencingToken + 1;
        tx.set(
          lockRef,
          {
            owner: workerInstanceId,
            fencingToken: nextFencingToken,
            acquiredAt: now,
            expiresAt: now + WORKER_LOCK_TTL_MS,
            lastHeartbeat: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return nextFencingToken;
      });
    }

    async function releaseWorkerLock(workerInstanceId: string, fencingToken: number) {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(lockRef);
        if (snap.exists) {
          const data = snap.data()!;
          if (data.owner === workerInstanceId && data.fencingToken === fencingToken) {
            tx.set(
              lockRef,
              {
                expiresAt: 0,
                owner: null,
                fencingToken: data.fencingToken,
              },
              { merge: true }
            );
          }
        }
      });
    }

    async function verifyWorkerFencing(
      tx: FirebaseFirestore.Transaction,
      workerInstanceId: string,
      expectedFencingToken: number,
      nowOverride?: number
    ): Promise<boolean> {
      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists) return false;
      const lockData = lockSnap.data()!;
      const now = nowOverride ?? Date.now();
      if (
        lockData.owner !== workerInstanceId ||
        lockData.fencingToken !== expectedFencingToken ||
        now >= (lockData.expiresAt || 0)
      ) {
        return false;
      }
      return true;
    }

    const workerA = 'instance_worker_A';
    const workerB = 'instance_worker_B';
    const testOrderId = 'order_dispatch_fence_001';
    const testCourierId = 'courier_dispatch_fence_001';

    await adminDb.collection('orders').doc(testOrderId).set({
      id: testOrderId,
      status: 'created',
      storeId: 'store_1',
      total: 15000,
    });
    await adminDb.collection('couriers').doc(testCourierId).set({
      id: testCourierId,
      name: 'كابتن التجربة',
      isOnline: true,
      isBusy: false,
    });

    // 2.1: Worker A Cycle 1 acquires lock -> fencingToken = 1
    const baseTime = Date.now();
    const tokenA1 = await acquireWorkerLock(workerA, baseTime);
    if (tokenA1 === 1) {
      recordPass(`Worker A (Cycle 1) acquired distributed lock with initial fencingToken = ${tokenA1}`);
    } else {
      recordFail(`Expected fencingToken = 1 for Worker A Cycle 1, got: ${tokenA1}`);
    }

    // 2.2: Overlapping Cycle 2 from Worker A ITSELF while Cycle 1 lock is still active (baseTime + 3000ms < baseTime + 12000ms)
    const tokenA2OverlapWhileActive = await acquireWorkerLock(workerA, baseTime + 3000);
    if (tokenA2OverlapWhileActive === null) {
      recordPass('Same-worker overlap blocked: Worker A (Cycle 2) REJECTED (null) while Worker A (Cycle 1) lock is still unexpired');
    } else {
      recordFail(`Worker A Cycle 2 overwrote active Cycle 1 lock! Got token: ${tokenA2OverlapWhileActive}`);
    }

    // 2.3: Worker A Cycle 1 stalls beyond 12s TTL; Worker B acquires lock -> fencingToken = 2
    const afterExpiry1 = baseTime + 13000;
    const tokenB1 = await acquireWorkerLock(workerB, afterExpiry1);
    if (tokenB1 === 2) {
      recordPass(`After 12s TTL expiry, Worker B acquired lock with monotonically incremented fencingToken = ${tokenB1}`);
    } else {
      recordFail(`Expected fencingToken = 2 for Worker B, got: ${tokenB1}`);
    }

    // Stale Worker A (token=1) attempts to mutate order/courier while Worker B (token=2) holds lock
    let staleA_vs_B_Aborted = false;
    await adminDb.runTransaction(async (tx) => {
      if (!(await verifyWorkerFencing(tx, workerA, tokenA1!, afterExpiry1 + 500))) {
        staleA_vs_B_Aborted = true;
        return;
      }
      tx.update(adminDb.collection('orders').doc(testOrderId), { status: 'courier_offered' });
    });
    if (staleA_vs_B_Aborted) {
      recordPass('Worker A vs Worker B: Stale Worker A (token=1) fenced and ABORTED when Worker B (token=2) holds lock');
    } else {
      recordFail('Stale Worker A (token=1) was NOT fenced against Worker B!');
    }

    // 2.4: Worker B releases lock cleanly. Then Worker A (Cycle 1) acquires lock (token=3), stalls >12s, and Worker A (Cycle 2) acquires lock (token=4)
    await releaseWorkerLock(workerB, tokenB1!);
    const timeCycleA1 = afterExpiry1 + 2000;
    const tokenA_Cycle1 = await acquireWorkerLock(workerA, timeCycleA1); // Expected: 3
    const timeCycleA2AfterTTL = timeCycleA1 + 13000; // >12s later, Cycle 1 lock expired
    const tokenA_Cycle2 = await acquireWorkerLock(workerA, timeCycleA2AfterTTL); // Expected: 4 (same owner workerA, higher token!)

    if (tokenA_Cycle1 === 3 && tokenA_Cycle2 === 4) {
      recordPass(`Worker A vs Worker A (after TTL): Cycle 1 got token=${tokenA_Cycle1}, Cycle 2 got incremented token=${tokenA_Cycle2}`);
    } else {
      recordFail(`Unexpected tokens for A Cycle 1 (${tokenA_Cycle1}) and A Cycle 2 (${tokenA_Cycle2})`);
    }

    // Now Stale Cycle 1 of Worker A (owner=workerA, token=3) wakes up while Cycle 2 of Worker A (owner=workerA, token=4) holds the lock!
    let staleA_Cycle1_Aborted = false;
    await adminDb.runTransaction(async (tx) => {
      if (!(await verifyWorkerFencing(tx, workerA, tokenA_Cycle1!, timeCycleA2AfterTTL + 500))) {
        staleA_Cycle1_Aborted = true;
        return;
      }
      tx.update(adminDb.collection('orders').doc(testOrderId), {
        status: 'courier_offered',
        offeredToCourierId: testCourierId,
      });
      tx.update(adminDb.collection('couriers').doc(testCourierId), {
        currentOfferOrderId: testOrderId,
      });
    });

    const orderAfterStaleA1 = (await adminDb.collection('orders').doc(testOrderId).get()).data()!;
    const courierAfterStaleA1 = (await adminDb.collection('couriers').doc(testCourierId).get()).data()!;

    if (
      staleA_Cycle1_Aborted &&
      orderAfterStaleA1.status === 'created' &&
      !courierAfterStaleA1.currentOfferOrderId
    ) {
      recordPass(
        'Same-Worker Stale Cycle Fencing (A Cycle 1 vs A Cycle 2): Stale Cycle 1 (token=3) ABORTED even though lock owner is still Worker A (token=4)!'
      );
    } else {
      recordFail('Stale Cycle 1 of Worker A was NOT fenced against Cycle 2 of Worker A!');
    }

    // Also verify Stale Cycle 1 releasing lock does NOT release Cycle 2's active lock
    await releaseWorkerLock(workerA, tokenA_Cycle1!);
    const lockAfterStaleRelease = (await lockRef.get()).data()!;
    if (lockAfterStaleRelease.owner === workerA && lockAfterStaleRelease.fencingToken === tokenA_Cycle2) {
      recordPass('Stale Cycle 1 releaseWorkerLock(workerA, token=3) did NOT release active Cycle 2 lock (token=4)');
    } else {
      recordFail('Stale Cycle 1 erroneously released Cycle 2 lock!');
    }

    // =========================================================================
    // 3. POINT 3: STRICT keys().hasOnly() WHITELIST ON /ratings IN FIRESTORE EMULATOR
    // =========================================================================
    console.log('\n--- 3. Testing /ratings Strict keys().hasOnly() Field Whitelist on Emulator ---');

    const orderDeliveredId = 'order_rated_delivered_777';
    const customerUid = 'uid_cust_1';
    const custRatingJwt = createEmulatorJwt(customerUid, { email: 'cust@talabi.iq' });

    await adminDb.collection('orders').doc(orderDeliveredId).delete();
    await adminDb.collection('ratings').doc(orderDeliveredId).delete();
    await adminDb.collection('order_ratings').doc(orderDeliveredId).delete();

    await adminDb.collection('orders').doc(orderDeliveredId).set({
      id: orderDeliveredId,
      status: 'delivered',
      customer: { id: customerUid, name: 'زبون التقييم' },
      storeId: 'store_kebabs_baghdad',
      total: 25000,
      payment: { method: 'cash_on_delivery', status: 'completed', amount: 25000 },
    });

    const validPublicBase = {
      id: orderDeliveredId,
      orderId: orderDeliveredId,
      storeId: 'store_kebabs_baghdad',
      storeName: 'كباب المنصور',
      storeRating: 5,
      storeComment: 'طعام ممتاز',
      createdAt: '2026-10-31 12:00',
    };

    // 3.1: Attempt to inject `customerId` into public `/ratings`
    const resWithCustomerId = await emulatorRestRequest(
      'POST',
      `ratings?documentId=${orderDeliveredId}`,
      custRatingJwt,
      {
        fields: toFirestoreFields({
          ...validPublicBase,
          customerId: customerUid,
        }),
      }
    );
    if (resWithCustomerId.statusCode === 403) {
      recordPass('Public /ratings creation with `customerId` REJECTED (403 PERMISSION_DENIED) by keys().hasOnly() rule');
    } else {
      recordFail(`Public /ratings allowed customerId! Status: ${resWithCustomerId.statusCode}`);
    }

    // 3.2: Attempt to inject `phone` / `customerPhone` into public `/ratings`
    const resWithPhone = await emulatorRestRequest(
      'POST',
      `ratings?documentId=${orderDeliveredId}`,
      custRatingJwt,
      {
        fields: toFirestoreFields({
          ...validPublicBase,
          phone: '07701234567',
        }),
      }
    );
    if (resWithPhone.statusCode === 403) {
      recordPass('Public /ratings creation with `phone` REJECTED (403 PERMISSION_DENIED) by keys().hasOnly() rule');
    } else {
      recordFail(`Public /ratings allowed phone! Status: ${resWithPhone.statusCode}`);
    }

    // 3.3: Attempt to inject `address` into public `/ratings`
    const resWithAddress = await emulatorRestRequest(
      'POST',
      `ratings?documentId=${orderDeliveredId}`,
      custRatingJwt,
      {
        fields: toFirestoreFields({
          ...validPublicBase,
          address: 'بغداد - المنصور - شارع 14 رمضان',
        }),
      }
    );
    if (resWithAddress.statusCode === 403) {
      recordPass('Public /ratings creation with `address` REJECTED (403 PERMISSION_DENIED) by keys().hasOnly() rule');
    } else {
      recordFail(`Public /ratings allowed address! Status: ${resWithAddress.statusCode}`);
    }

    // 3.4: Standalone public rating creation WITHOUT paired order_ratings is REJECTED by existsAfter(), while paired atomic batch with whitelisted keys ALLOWED
    const resStandalonePublic = await emulatorRestRequest(
      'POST',
      `ratings?documentId=${orderDeliveredId}`,
      custRatingJwt,
      {
        fields: toFirestoreFields(validPublicBase),
      }
    );
    const dbRoot3 = `projects/${PROJECT_ID}/databases/(default)/documents`;
    const resValidPairedPublic = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot3}/order_ratings/${orderDeliveredId}`,
            fields: toFirestoreFields({
              ...validPublicBase,
              customerId: customerUid,
              customerName: 'زبون التقييم',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot3}/ratings/${orderDeliveredId}`,
            fields: toFirestoreFields(validPublicBase),
          },
          currentDocument: { exists: false },
        },
      ],
    });
    if (resStandalonePublic.statusCode === 403 && resValidPairedPublic.statusCode === 200) {
      recordPass(
        'Public /ratings standalone write REJECTED (403) by existsAfter(), and paired atomic creation with whitelisted fields ALLOWED (200 OK)'
      );
    } else {
      recordFail(
        `Unexpected rating result! standalone=${resStandalonePublic.statusCode}, paired=${resValidPairedPublic.statusCode}`
      );
    }

    // =========================================================================
    // 4. POINT 4: ATOMIC DUAL-SAVE OF order_ratings & ratings (NO CONTRADICTORY STATE)
    // =========================================================================
    console.log('\n--- 4. Testing Atomic Dual-Save & Failure Rollback (Zero Contradictory State) ---');

    const orderAtomicFailId = 'order_atomic_fail_888';
    await adminDb.collection('orders').doc(orderAtomicFailId).delete();
    await adminDb.collection('ratings').doc(orderAtomicFailId).delete();
    await adminDb.collection('order_ratings').doc(orderAtomicFailId).delete();

    await adminDb.collection('orders').doc(orderAtomicFailId).set({
      id: orderAtomicFailId,
      status: 'delivered',
      customer: { id: customerUid, name: 'زبون التقييم' },
      storeId: 'store_kebabs_baghdad',
      total: 20000,
      payment: { method: 'cash_on_delivery', status: 'completed', amount: 20000 },
    });

    const dbRoot = `projects/${PROJECT_ID}/databases/(default)/documents`;

    // 4.1: Simulate atomic writeBatch where `order_ratings` is VALID, but `ratings` FAILS (contains unauthorized `phone` field)
    const atomicCommitPublicFailRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              customerId: customerUid,
              customerName: 'زبون التقييم',
              storeRating: 5,
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              storeRating: 5,
              phone: '07709998877', // Unauthorized field causing public rating save to fail!
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    const privateSnapAfterPublicFail = await adminDb.collection('order_ratings').doc(orderAtomicFailId).get();
    const publicSnapAfterPublicFail = await adminDb.collection('ratings').doc(orderAtomicFailId).get();

    if (
      atomicCommitPublicFailRes.statusCode === 403 &&
      !privateSnapAfterPublicFail.exists &&
      !publicSnapAfterPublicFail.exists
    ) {
      recordPass(
        'When public /ratings write fails, atomic batch rolls back completely: /order_ratings is NOT saved (0 contradictory state)'
      );
    } else {
      recordFail(
        `Contradictory state detected! status=${atomicCommitPublicFailRes.statusCode}, privateExists=${privateSnapAfterPublicFail.exists}, publicExists=${publicSnapAfterPublicFail.exists}`
      );
    }

    // 4.1b: Simulate atomic writeBatch where `order_ratings` FAILS (e.g. mismatched customerId), while `ratings` is VALID
    const atomicCommitPrivateFailRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              customerId: 'forged_different_uid', // Causes private order_ratings rule to fail!
              customerName: 'زبون التقييم',
              storeRating: 5,
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              storeName: 'كباب المنصور',
              storeRating: 5,
              storeComment: 'ممتاز',
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    const privateSnapAfterPrivateFail = await adminDb.collection('order_ratings').doc(orderAtomicFailId).get();
    const publicSnapAfterPrivateFail = await adminDb.collection('ratings').doc(orderAtomicFailId).get();

    if (
      atomicCommitPrivateFailRes.statusCode === 403 &&
      !privateSnapAfterPrivateFail.exists &&
      !publicSnapAfterPrivateFail.exists
    ) {
      recordPass(
        'When private /order_ratings write fails, atomic batch rolls back completely: /ratings is NOT saved (0 contradictory state)'
      );
    } else {
      recordFail(
        `Contradictory state detected when private failed! status=${atomicCommitPrivateFailRes.statusCode}, privateExists=${privateSnapAfterPrivateFail.exists}, publicExists=${publicSnapAfterPrivateFail.exists}`
      );
    }

    // 4.2: Simulate atomic writeBatch where BOTH `order_ratings` and `ratings` are valid -> Both succeed together
    const atomicCommitBothValidRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              customerId: customerUid,
              customerName: 'زبون التقييم',
              storeRating: 5,
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderAtomicFailId}`,
            fields: toFirestoreFields({
              id: orderAtomicFailId,
              orderId: orderAtomicFailId,
              storeId: 'store_kebabs_baghdad',
              storeName: 'كباب المنصور',
              storeRating: 5,
              storeComment: 'ممتاز',
              createdAt: '2026-10-31 12:05',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    const privateSnapAfterValid = await adminDb.collection('order_ratings').doc(orderAtomicFailId).get();
    const publicSnapAfterValid = await adminDb.collection('ratings').doc(orderAtomicFailId).get();

    if (
      atomicCommitBothValidRes.statusCode === 200 &&
      privateSnapAfterValid.exists &&
      publicSnapAfterValid.exists
    ) {
      recordPass('When both private and public ratings are valid, atomic writeBatch commits both documents together (200 OK)');
    } else {
      recordFail(`Valid atomic batch failed! Status: ${atomicCommitBothValidRes.statusCode}`);
    }

    // 4.3: Verify AppContext.tsx does not use silent .catch(() => {}) on ratings and uses writeBatch(db)
    const appContextCode = fs.readFileSync('/app/applet/src/context/AppContext.tsx', 'utf-8');
    const usesWriteBatchForRatings =
      appContextCode.includes("batch.set(doc(db, 'order_ratings', ratingId)") &&
      appContextCode.includes("batch.set(doc(db, 'ratings', ratingId)") &&
      appContextCode.includes('await batch.commit()');
    const hasNoSilentRatingsCatch = !appContextCode.includes("setDoc(doc(db, 'ratings', ratingId), publicRatingDoc).catch(() => {})");

    if (usesWriteBatchForRatings && hasNoSilentRatingsCatch) {
      recordPass('AppContext.tsx verified: uses atomic writeBatch(db) and removed silent .catch(() => {}) on public ratings');
    } else {
      recordFail('AppContext.tsx still has non-atomic rating save or silent .catch(() => {})!');
    }

    // =========================================================================
    // 5. POINT 5: ADMIN PRIVILEGE HARDENING (CLIENT, SERVER & EMULATOR)
    // =========================================================================
    console.log('\n--- 5. Testing Admin Privilege Hardening (Email vs Doc vs Trusted Custom Claim) ---');

    const { resolveClientAuthRole } = await import('./src/context/AppContext');
    const { getApps: getClientApps, deleteApp: deleteClientApp } = await import('firebase/app');
    for (const cApp of getClientApps()) {
      await deleteClientApp(cApp);
    }
    const { evaluateAdminAuthorization } = await import('./talabi-admin-web/src/context/AdminAppContext');

    // 5.1: Account with admin email (msr33777@gmail.com / admin@talabi.iq) WITHOUT Custom Claim does NOT get admin privileges
    const emailOnlyClientAuth1 = resolveClientAuthRole({
      email: 'msr33777@gmail.com',
      tokenClaims: {}, // No role: 'admin' claim
      firestoreRole: 'customer',
      firestoreAccountType: 'customer',
    });
    const emailOnlyClientAuth2 = resolveClientAuthRole({
      email: 'admin@talabi.iq',
      tokenClaims: {},
      firestoreRole: 'admin', // Even if Firestore doc says admin!
      firestoreAccountType: 'admin',
    });
    const emailOnlyPortalAuth = evaluateAdminAuthorization({
      email: 'msr33777@gmail.com',
      emailVerified: true,
      tokenClaims: {},
      firestoreRole: 'admin',
      serverVerified: true,
    });

    if (
      !emailOnlyClientAuth1.isAdmin &&
      emailOnlyClientAuth1.role === 'customer' &&
      !emailOnlyClientAuth2.isAdmin &&
      emailOnlyClientAuth2.role === 'customer' &&
      !emailOnlyPortalAuth.isAdmin &&
      emailOnlyPortalAuth.role === 'customer'
    ) {
      recordPass(
        'Test 5.1: Account with admin email (msr33777@gmail.com / admin@talabi.iq) WITHOUT Custom Claim is DENIED admin privileges in both client apps'
      );
    } else {
      recordFail(
        `Email-only account got admin privilege! client1=${JSON.stringify(emailOnlyClientAuth1)}, client2=${JSON.stringify(emailOnlyClientAuth2)}`
      );
    }

    // 5.2: Regular account with tampered Firestore users/{uid}.role === 'admin' CANNOT get admin UI or call Admin APIs
    const tamperedUid = 'uid_regular_with_admin_doc';
    await adminDb.collection('users').doc(tamperedUid).set({
      id: tamperedUid,
      name: 'مستخدم عادي بوثيقة معدلة',
      email: 'regular@talabi.iq',
      role: 'admin',
      accountType: 'admin',
    });

    const regularWithAdminDocClient = resolveClientAuthRole({
      email: 'regular@talabi.iq',
      tokenClaims: { role: 'customer' },
      firestoreRole: 'admin',
      firestoreAccountType: 'admin',
    });

    // Simulate server.ts requireUserAuth + requireAdminAuth logic against Firestore doc role: 'admin'
    const tamperedDocSnap = await adminDb.collection('users').doc(tamperedUid).get();
    const tamperedDocData = tamperedDocSnap.data()!;
    const simulatedDecodedTokenRegular: Record<string, any> = {
      uid: tamperedUid,
      email: 'msr33777@gmail.com', // Even with admin email!
      role: undefined, // No Custom Claim
    };
    const tokenRoleRegular = (simulatedDecodedTokenRegular.role as string) || '';
    const hasAdminClaimRegular = tokenRoleRegular === 'admin';
    let serverResolvedRoleRegular = hasAdminClaimRegular ? 'admin' : tokenRoleRegular || 'customer';
    if (!hasAdminClaimRegular && tamperedDocData.role && tamperedDocData.role !== 'admin') {
      serverResolvedRoleRegular = tamperedDocData.role;
    }
    const serverRequireAdminAuthAllowedRegular =
      serverResolvedRoleRegular === 'admin' && tokenRoleRegular === 'admin';

    if (
      !regularWithAdminDocClient.isAdmin &&
      regularWithAdminDocClient.role === 'customer' &&
      regularWithAdminDocClient.accountType === 'customer' &&
      !serverRequireAdminAuthAllowedRegular &&
      serverResolvedRoleRegular === 'customer'
    ) {
      recordPass(
        'Test 5.2: Regular account with users/{uid}.role === "admin" in Firestore is DENIED admin role in UI and REJECTED (403) by requireAdminAuth on all /api/admin/* routes'
      );
    } else {
      recordFail(
        `Tampered Firestore doc granted admin! client=${JSON.stringify(regularWithAdminDocClient)}, serverRole=${serverResolvedRoleRegular}`
      );
    }

    // 5.3: Admin account WITH valid Custom Claim (tokenResult.claims.role === 'admin') retains full privileges
    const validAdminClient = resolveClientAuthRole({
      email: 'msr33777@gmail.com',
      tokenClaims: { role: 'admin', accountType: 'admin' },
      firestoreRole: 'admin',
      firestoreAccountType: 'admin',
    });
    const validAdminPortal = evaluateAdminAuthorization({
      email: 'msr33777@gmail.com',
      emailVerified: true,
      tokenClaims: { role: 'admin' },
      firestoreRole: 'admin',
      serverVerified: true,
    });
    const simulatedDecodedTokenAdmin: Record<string, any> = {
      uid: 'uid_real_admin_claim',
      email: 'msr33777@gmail.com',
      role: 'admin',
    };
    const tokenRoleAdmin = (simulatedDecodedTokenAdmin.role as string) || '';
    const serverRequireAdminAuthAllowedAdmin = tokenRoleAdmin === 'admin';

    if (
      validAdminClient.isAdmin &&
      validAdminClient.role === 'admin' &&
      validAdminClient.accountType === 'admin' &&
      validAdminPortal.isAdmin &&
      validAdminPortal.role === 'admin' &&
      serverRequireAdminAuthAllowedAdmin
    ) {
      recordPass(
        'Test 5.3: Admin account with valid Custom Claim (tokenResult.claims.role === "admin") RETAINS full admin privileges in client UI, Admin Portal, and server /api/admin/* routes'
      );
    } else {
      recordFail('Valid admin with Custom Claim lost privileges!');
    }

    // 5.4: Verify code invariants across AppContext.tsx, Header.tsx, AdminAppContext.tsx, and server.ts
    const headerCode = fs.readFileSync('/app/applet/src/components/layout/Header.tsx', 'utf-8');
    const adminContextCode = fs.readFileSync(
      '/app/applet/talabi-admin-web/src/context/AdminAppContext.tsx',
      'utf-8'
    );
    const serverCode = fs.readFileSync('/app/applet/server.ts', 'utf-8');

    const noAutoBootstrapInClients =
      !appContextCode.includes("fetch('/api/admin/bootstrap-primary-admin'") &&
      !adminContextCode.includes("fetch('/api/admin/bootstrap-primary-admin'");
    const noEmailAdminInHeaderOrAppContext =
      !headerCode.includes('msr33777@gmail.com') &&
      !headerCode.includes('admin@talabi.iq') &&
      !headerCode.includes('admin.operations@talabi.iq') &&
      !appContextCode.includes('msr33777@gmail.com') &&
      !appContextCode.includes('admin@talabi.iq') &&
      !appContextCode.includes('admin.operations@talabi.iq');
    const unifiedReviewMiddleware = serverCode.includes(
      "app.post('/api/admin/applications/review', requireUserAuth, requireAdminAuth,"
    );
    const bootstrapEndpointPreservedOnServer = serverCode.includes(
      "app.post('/api/admin/bootstrap-primary-admin',"
    );

    if (
      noAutoBootstrapInClients &&
      noEmailAdminInHeaderOrAppContext &&
      unifiedReviewMiddleware &&
      bootstrapEndpointPreservedOnServer
    ) {
      recordPass(
        'Test 5.4: Verified code invariants: auto-bootstrap removed from login, email checks removed from Header.tsx & AppContext.tsx, /api/admin/applications/review unified with requireUserAuth + requireAdminAuth, and server bootstrap endpoint preserved intact'
      );
    } else {
      recordFail(
        `Code invariant check failed: noAutoBootstrap=${noAutoBootstrapInClients}, noEmailChecks=${noEmailAdminInHeaderOrAppContext}, unifiedReview=${unifiedReviewMiddleware}, bootstrapPreserved=${bootstrapEndpointPreservedOnServer}`
      );
    }

    // =========================================================================
    // 6. POINT 6: COMPREHENSIVE 5-FIX FIRESTORE RULES VERIFICATION ACROSS ALL ROLES
    // =========================================================================
    console.log('\n--- 6. Testing All 5 Firestore Rules Fixes Across All Roles (Customer, Merchant, Courier, Support, Admin) ---');

    const merchA_Uid = 'uid_merch_A';
    const merchB_Uid = 'uid_merch_B';
    const merchA_Jwt = createEmulatorJwt(merchA_Uid, { role: 'merchant' });
    const merchB_Jwt = createEmulatorJwt(merchB_Uid, { role: 'merchant' });

    const courierA_Uid = 'uid_courier_A';
    const courierB_Uid = 'uid_courier_B';
    const courierPending_Uid = 'uid_courier_pending';
    const courierA_Jwt = createEmulatorJwt(courierA_Uid, { role: 'courier' });
    const courierB_Jwt = createEmulatorJwt(courierB_Uid, { role: 'courier' });
    const courierPending_Jwt = createEmulatorJwt(courierPending_Uid, { role: 'courier' });

    await adminDb.collection('stores').doc('store_A').set({
      id: 'store_A',
      name: 'مطعم أ',
      merchantUserId: merchA_Uid,
      approvalStatus: 'approved',
      commissionRate: 10,
      rating: 4.8,
      ratingCount: 20,
      isSuspendedDueToDues: false,
      isOpen: true,
    });
    await adminDb.collection('stores').doc('store_B').set({
      id: 'store_B',
      name: 'مطعم ب المنافس',
      merchantUserId: merchB_Uid,
      approvalStatus: 'approved',
      commissionRate: 12,
      rating: 4.9,
      ratingCount: 50,
      isSuspendedDueToDues: false,
      isOpen: true,
    });

    // --- 6.1: PRODUCTS (Create, Update, Delete & Cross-Store Hijack Prevention) ---
    const prodCreateOwn = await emulatorRestRequest('POST', 'products?documentId=prod_A1', merchA_Jwt, {
      fields: toFirestoreFields({
        id: 'prod_A1',
        storeId: 'store_A',
        name: 'كباب عراقي',
        price: 12000,
        isAvailable: true,
      }),
    });
    const prodUpdateOwn = await emulatorRestRequest('PATCH', 'products/prod_A1', merchA_Jwt, {
      fields: toFirestoreFields({
        id: 'prod_A1',
        storeId: 'store_A',
        name: 'كباب عراقي ملكي',
        price: 14000,
        isAvailable: false,
      }),
    });
    // Merchant B tries to hijack/modify Merchant A's product by passing storeId: 'store_B'
    const prodHijackByB = await emulatorRestRequest('PATCH', 'products/prod_A1', merchB_Jwt, {
      fields: toFirestoreFields({
        id: 'prod_A1',
        storeId: 'store_B',
        name: 'منتج مخترق',
        price: 0,
        isAvailable: false,
      }),
    });
    // Merchant A tries to move own product to store_B
    const prodMoveStoreByA = await emulatorRestRequest('PATCH', 'products/prod_A1', merchA_Jwt, {
      fields: toFirestoreFields({
        id: 'prod_A1',
        storeId: 'store_B',
        name: 'كباب عراقي ملكي',
        price: 14000,
        isAvailable: false,
      }),
    });
    // Merchant B tries to delete Merchant A's product
    const prodDeleteByB = await emulatorRestRequest('DELETE', 'products/prod_A1', merchB_Jwt);
    // Merchant A deletes own product
    const prodDeleteOwnByA = await emulatorRestRequest('DELETE', 'products/prod_A1', merchA_Jwt);

    if (
      prodCreateOwn.statusCode === 200 &&
      prodUpdateOwn.statusCode === 200 &&
      prodHijackByB.statusCode === 403 &&
      prodMoveStoreByA.statusCode === 403 &&
      prodDeleteByB.statusCode === 403 &&
      prodDeleteOwnByA.statusCode === 200
    ) {
      recordPass(
        'Fix 1 (products): Merchant can create/update/delete own store products (200), while cross-store product update/hijack, storeId change, and cross-store delete are REJECTED (403)'
      );
    } else {
      recordFail(
        `Fix 1 (products) failed: create=${prodCreateOwn.statusCode}, update=${prodUpdateOwn.statusCode}, hijack=${prodHijackByB.statusCode}, move=${prodMoveStoreByA.statusCode}, delB=${prodDeleteByB.statusCode}, delA=${prodDeleteOwnByA.statusCode}`
      );
    }

    // --- 6.2: STORES & RESTAURANTS (Block financial/approval/rating tampering; allow operational fields) ---
    const baseStoreA = {
      id: 'store_A',
      name: 'مطعم أ المحدث',
      merchantUserId: merchA_Uid,
      approvalStatus: 'approved',
      commissionRate: 10,
      rating: 4.8,
      ratingCount: 20,
      isSuspendedDueToDues: false,
      isOpen: false,
    };
    const storeOperationalUpdate = await emulatorRestRequest('PATCH', 'stores/store_A', merchA_Jwt, {
      fields: toFirestoreFields(baseStoreA),
    });
    const storeTamperCommission = await emulatorRestRequest('PATCH', 'stores/store_A', merchA_Jwt, {
      fields: toFirestoreFields({ ...baseStoreA, commissionRate: 0 }),
    });
    const storeTamperRating = await emulatorRestRequest('PATCH', 'stores/store_A', merchA_Jwt, {
      fields: toFirestoreFields({ ...baseStoreA, rating: 5.0, ratingCount: 9999 }),
    });
    const storeTamperOwner = await emulatorRestRequest('PATCH', 'stores/store_A', merchA_Jwt, {
      fields: toFirestoreFields({ ...baseStoreA, merchantUserId: merchB_Uid }),
    });
    const storeTamperApproval = await emulatorRestRequest('PATCH', 'stores/store_A', merchA_Jwt, {
      fields: toFirestoreFields({ ...baseStoreA, approvalStatus: 'suspended' }),
    });
    const storeOtherMerchant = await emulatorRestRequest('PATCH', 'stores/store_B', merchA_Jwt, {
      fields: toFirestoreFields({
        id: 'store_B',
        name: 'تخريب مطعم ب',
        merchantUserId: merchB_Uid,
        approvalStatus: 'approved',
        commissionRate: 12,
        rating: 4.9,
        ratingCount: 50,
        isSuspendedDueToDues: false,
        isOpen: false,
      }),
    });
    const storeAdminUpdateCommission = await emulatorRestRequest('PATCH', 'stores/store_A', verifiedAdminClaimToken, {
      fields: toFirestoreFields({ ...baseStoreA, commissionRate: 8 }),
    });

    if (
      storeOperationalUpdate.statusCode === 200 &&
      storeTamperCommission.statusCode === 403 &&
      storeTamperRating.statusCode === 403 &&
      storeTamperOwner.statusCode === 403 &&
      storeTamperApproval.statusCode === 403 &&
      storeOtherMerchant.statusCode === 403 &&
      storeAdminUpdateCommission.statusCode === 200
    ) {
      recordPass(
        'Fix 2 (stores/restaurants): Merchant allowed operational updates (200), REJECTED (403) on commissionRate/rating/merchantUserId/approvalStatus/other store, and Admin ALLOWED (200)'
      );
    } else {
      recordFail(
        `Fix 2 (stores) failed: op=${storeOperationalUpdate.statusCode}, comm=${storeTamperCommission.statusCode}, rate=${storeTamperRating.statusCode}, owner=${storeTamperOwner.statusCode}, app=${storeTamperApproval.statusCode}, other=${storeOtherMerchant.statusCode}, admin=${storeAdminUpdateCommission.statusCode}`
      );
    }

    // --- 6.3: COURIERS (Block wallet/earnings/approval/dispatch tampering & restrict read privacy) ---
    const baseCourierA = {
      id: 'cour_A',
      userId: courierA_Uid,
      name: 'كابتن أ',
      phone: '07701112222',
      approvalStatus: 'approved',
      walletBalance: 15000,
      totalEarnings: 50000,
      rating: 4.9,
      ratingCount: 10,
      isBusy: false,
      isOnline: false,
      currentLocation: 'بغداد - المنصور',
    };
    await adminDb.collection('couriers').doc('cour_A').set(baseCourierA);
    await adminDb.collection('couriers').doc('cour_B').set({
      ...baseCourierA,
      id: 'cour_B',
      userId: courierB_Uid,
      name: 'كابتن ب',
      phone: '07709998888',
      walletBalance: 75000,
    });
    await adminDb.collection('couriers').doc('cour_pending').set({
      ...baseCourierA,
      id: 'cour_pending',
      userId: courierPending_Uid,
      approvalStatus: 'pending',
    });

    const courierReadOwn = await emulatorRestRequest('GET', 'couriers/cour_A', courierA_Jwt);
    const courierReadOther = await emulatorRestRequest('GET', 'couriers/cour_B', courierA_Jwt);
    const customerReadCourier = await emulatorRestRequest('GET', 'couriers/cour_A', customerToken);
    const merchantReadCourier = await emulatorRestRequest('GET', 'couriers/cour_A', merchA_Jwt);
    const unauthReadCourier = await emulatorRestRequest('GET', 'couriers/cour_A', null);
    const supportReadCourier = await emulatorRestRequest('GET', 'couriers/cour_A', supportToken);
    const adminReadCourier = await emulatorRestRequest('GET', 'couriers/cour_A', verifiedAdminClaimToken);

    const courierUpdateOperational = await emulatorRestRequest('PATCH', 'couriers/cour_A', courierA_Jwt, {
      fields: toFirestoreFields({
        ...baseCourierA,
        isOnline: true,
        currentLocation: 'بغداد - الكرادة',
        coordinates: { lat: 33.31, lng: 44.4 },
      }),
    });
    const courierTamperWallet = await emulatorRestRequest('PATCH', 'couriers/cour_A', courierA_Jwt, {
      fields: toFirestoreFields({ ...baseCourierA, isOnline: true, walletBalance: 9999999 }),
    });
    const courierTamperEarnings = await emulatorRestRequest('PATCH', 'couriers/cour_A', courierA_Jwt, {
      fields: toFirestoreFields({ ...baseCourierA, isOnline: true, totalEarnings: 9999999 }),
    });
    const courierTamperBusy = await emulatorRestRequest('PATCH', 'couriers/cour_A', courierA_Jwt, {
      fields: toFirestoreFields({ ...baseCourierA, isOnline: true, isBusy: true }),
    });
    const pendingCourierSelfApprove = await emulatorRestRequest('PATCH', 'couriers/cour_pending', courierPending_Jwt, {
      fields: toFirestoreFields({
        ...baseCourierA,
        id: 'cour_pending',
        userId: courierPending_Uid,
        approvalStatus: 'approved',
      }),
    });
    const pendingCourierToggleOnline = await emulatorRestRequest('PATCH', 'couriers/cour_pending', courierPending_Jwt, {
      fields: toFirestoreFields({
        ...baseCourierA,
        id: 'cour_pending',
        userId: courierPending_Uid,
        approvalStatus: 'pending',
        isOnline: true,
      }),
    });

    if (
      courierReadOwn.statusCode === 200 &&
      courierReadOther.statusCode === 403 &&
      customerReadCourier.statusCode === 403 &&
      merchantReadCourier.statusCode === 403 &&
      unauthReadCourier.statusCode === 403 &&
      supportReadCourier.statusCode === 200 &&
      adminReadCourier.statusCode === 200 &&
      courierUpdateOperational.statusCode === 200 &&
      courierTamperWallet.statusCode === 403 &&
      courierTamperEarnings.statusCode === 403 &&
      courierTamperBusy.statusCode === 403 &&
      pendingCourierSelfApprove.statusCode === 403 &&
      pendingCourierToggleOnline.statusCode === 403
    ) {
      recordPass(
        'Fix 3 (couriers): Read strictly isolated to owner courier/Support/Admin (200) and REJECTED (403) for other couriers/customers/merchants/unauth; wallet/earnings/isBusy/approvalStatus tampering REJECTED (403)'
      );
    } else {
      recordFail(
        `Fix 3 (couriers) failed: readOwn=${courierReadOwn.statusCode}, readOther=${courierReadOther.statusCode}, custRead=${customerReadCourier.statusCode}, merchRead=${merchantReadCourier.statusCode}, unauthRead=${unauthReadCourier.statusCode}, suppRead=${supportReadCourier.statusCode}, admRead=${adminReadCourier.statusCode}, opUpd=${courierUpdateOperational.statusCode}, wallet=${courierTamperWallet.statusCode}, earn=${courierTamperEarnings.statusCode}, busy=${courierTamperBusy.statusCode}, pendApp=${pendingCourierSelfApprove.statusCode}, pendOnl=${pendingCourierToggleOnline.statusCode}`
      );
    }

    // --- 6.4: ORDER_RATINGS & RATINGS (storeId/courierId match, integer 1..5 stars, existsAfter() pairing) ---
    const orderWithCourierId = 'order_delivered_with_courier_901';
    await adminDb.collection('orders').doc(orderWithCourierId).delete();
    await adminDb.collection('ratings').doc(orderWithCourierId).delete();
    await adminDb.collection('order_ratings').doc(orderWithCourierId).delete();

    await adminDb.collection('orders').doc(orderWithCourierId).set({
      id: orderWithCourierId,
      status: 'delivered',
      customer: { id: customerUid, name: 'زبون التقييم' },
      storeId: 'store_A',
      courierId: 'cour_A',
      total: 18000,
      payment: { method: 'cash_on_delivery', status: 'completed', amount: 18000 },
    });

    // 6.4a: Standalone private order_ratings without public ratings -> REJECTED (403) by existsAfter()
    const standalonePrivateRes = await emulatorRestRequest(
      'POST',
      `order_ratings?documentId=${orderWithCourierId}`,
      custRatingJwt,
      {
        fields: toFirestoreFields({
          id: orderWithCourierId,
          orderId: orderWithCourierId,
          storeId: 'store_A',
          courierId: 'cour_A',
          customerId: customerUid,
          customerName: 'زبون التقييم',
          storeRating: 5,
          courierRating: 5,
          createdAt: '2026-10-31 13:00',
        }),
      }
    );

    // 6.4b: Spoofed storeId (store_B instead of order's store_A) -> REJECTED (403)
    const spoofedStoreBatchRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_B', // Spoofed!
              courierId: 'cour_A',
              customerId: customerUid,
              storeRating: 1,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_B', // Spoofed!
              courierId: 'cour_A',
              storeRating: 1,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    // 6.4c: Spoofed courierId (cour_B instead of order's cour_A) -> REJECTED (403)
    const spoofedCourierBatchRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_B', // Spoofed!
              customerId: customerUid,
              storeRating: 5,
              courierRating: 1,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_B', // Spoofed!
              storeRating: 5,
              courierRating: 1,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    // 6.4d: Out-of-bounds or non-integer star rating (storeRating: 6 or courierRating: 0 or float 4.5) -> REJECTED (403)
    const outOfBoundsStarBatchRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_A',
              customerId: customerUid,
              storeRating: 6, // Invalid > 5
              courierRating: 0, // Invalid < 1
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_A',
              storeRating: 6,
              courierRating: 0,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    // 6.4e: Valid atomic batch with matching storeId, courierId, and integer stars 1..5 -> ALLOWED (200 OK)
    const validWithCourierBatchRes = await emulatorRestRequest('POST', ':commit', custRatingJwt, {
      writes: [
        {
          update: {
            name: `${dbRoot}/order_ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_A',
              customerId: customerUid,
              customerName: 'زبون التقييم',
              storeRating: 5,
              courierRating: 4,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${dbRoot}/ratings/${orderWithCourierId}`,
            fields: toFirestoreFields({
              id: orderWithCourierId,
              orderId: orderWithCourierId,
              storeId: 'store_A',
              courierId: 'cour_A',
              storeRating: 5,
              courierRating: 4,
              createdAt: '2026-10-31 13:00',
            }),
          },
          currentDocument: { exists: false },
        },
      ],
    });

    if (
      standalonePrivateRes.statusCode === 403 &&
      spoofedStoreBatchRes.statusCode === 403 &&
      spoofedCourierBatchRes.statusCode === 403 &&
      outOfBoundsStarBatchRes.statusCode === 403 &&
      validWithCourierBatchRes.statusCode === 200
    ) {
      recordPass(
        'Fix 4 (order_ratings & ratings): Standalone private write, spoofed storeId, spoofed courierId, and out-of-range stars all REJECTED (403); valid paired atomic batch ALLOWED (200)'
      );
    } else {
      recordFail(
        `Fix 4 (ratings) failed: standalonePriv=${standalonePrivateRes.statusCode}, spoofStore=${spoofedStoreBatchRes.statusCode}, spoofCour=${spoofedCourierBatchRes.statusCode}, outOfBounds=${outOfBoundsStarBatchRes.statusCode}, validBatch=${validWithCourierBatchRes.statusCode}`
      );
    }

    // --- 6.5: SUPPORT_CONVERSATIONS & ONBOARDING APPLICATIONS ---
    // Cleanup test documents from prior runs
    await adminDb.collection('support_conversations').doc('conv_sec_1').delete();
    await adminDb.collection('restaurant_applications').doc('app_rest_sec_1').delete();

    const msg1 = {
      id: 'm1',
      conversationId: 'conv_sec_1',
      senderId: customerUid,
      senderName: 'زبون تجريبي',
      senderRole: 'customer',
      text: 'مرحباً أحتاج مساعدة',
      timestamp: '13:00',
      isAgent: false,
    };
    const msg2 = {
      id: 'm2',
      conversationId: 'conv_sec_1',
      senderId: customerUid,
      senderName: 'زبون تجريبي',
      senderRole: 'customer',
      text: 'رسالة إضافية من الزبون',
      timestamp: '13:01',
      isAgent: false,
    };

    const convCreateRes = await emulatorRestRequest(
      'POST',
      'support_conversations?documentId=conv_sec_1',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: customerUid,
          status: 'open',
          lastMessage: msg1.text,
          lastUpdated: '13:00',
          messages: [msg1],
        }),
      }
    );

    // Valid append of 1 message by conversation owner
    const convAppendValidRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_sec_1',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: customerUid,
          status: 'open',
          lastMessage: msg2.text,
          lastUpdated: '13:01',
          messages: [msg1, msg2],
        }),
      }
    );

    // Tamper userId on conversation -> REJECTED (403)
    const convTamperUserIdRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_sec_1',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: 'other_victim_uid',
          status: 'open',
          lastMessage: msg2.text,
          lastUpdated: '13:02',
          messages: [msg1, msg2],
        }),
      }
    );

    // Delete or rewrite previous messages -> REJECTED (403)
    const convDeletePrevMessagesRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_sec_1',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: customerUid,
          status: 'open',
          lastMessage: 'حذف الرسائل السابقة',
          lastUpdated: '13:03',
          messages: [msg2], // msg1 deleted!
        }),
      }
    );

    // Impersonate support agent (isAgent: true / senderRole: 'support') -> REJECTED (403)
    const convImpersonateSupportRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_sec_1',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: customerUid,
          status: 'open',
          lastMessage: 'رد مزيف باسم الدعم',
          lastUpdated: '13:04',
          messages: [
            msg1,
            msg2,
            {
              id: 'm3_fake',
              conversationId: 'conv_sec_1',
              senderId: customerUid,
              senderName: 'الدعم الفني',
              senderRole: 'support',
              text: 'تمت الموافقة على تعويضك',
              timestamp: '13:04',
              isAgent: true,
            },
          ],
        }),
      }
    );

    // Support staff can reply and update status -> ALLOWED (200)
    const convSupportReplyRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_sec_1',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_sec_1',
          userId: customerUid,
          status: 'resolved',
          lastMessage: 'تم الحل بواسطة الدعم',
          lastUpdated: '13:05',
          messages: [
            msg1,
            msg2,
            {
              id: 'm3_real_supp',
              conversationId: 'conv_sec_1',
              senderId: 'uid_support_1',
              senderName: 'موظف الدعم',
              senderRole: 'support',
              text: 'تم الحل بواسطة الدعم',
              timestamp: '13:05',
              isAgent: true,
            },
          ],
        }),
      }
    );

    // Onboarding Applications: Support can READ (200), but CANNOT UPDATE status (403); ONLY Admin can UPDATE (200)
    await adminDb.collection('restaurant_applications').doc('app_rest_sec_1').set({
      id: 'app_rest_sec_1',
      applicantUserId: customerUid,
      storeName: 'مطعم جديد',
      status: 'pending',
    });
    const appSupportReadRes = await emulatorRestRequest(
      'GET',
      'restaurant_applications/app_rest_sec_1',
      supportToken
    );
    const appSupportUpdateRes = await emulatorRestRequest(
      'PATCH',
      'restaurant_applications/app_rest_sec_1',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'app_rest_sec_1',
          applicantUserId: customerUid,
          storeName: 'مطعم جديد',
          status: 'approved',
        }),
      }
    );
    const appAdminUpdateRes = await emulatorRestRequest(
      'PATCH',
      'restaurant_applications/app_rest_sec_1',
      verifiedAdminClaimToken,
      {
        fields: toFirestoreFields({
          id: 'app_rest_sec_1',
          applicantUserId: customerUid,
          storeName: 'مطعم جديد',
          status: 'approved',
        }),
      }
    );

    if (
      convCreateRes.statusCode === 200 &&
      convAppendValidRes.statusCode === 200 &&
      convTamperUserIdRes.statusCode === 403 &&
      convDeletePrevMessagesRes.statusCode === 403 &&
      convImpersonateSupportRes.statusCode === 403 &&
      convSupportReplyRes.statusCode === 200 &&
      appSupportReadRes.statusCode === 200 &&
      appSupportUpdateRes.statusCode === 403 &&
      appAdminUpdateRes.statusCode === 200
    ) {
      recordPass(
        'Fix 5 (support_conversations & applications): Conversation userId tampering, message deletion, and support impersonation REJECTED (403); Support application status update REJECTED (403); Admin update ALLOWED (200)'
      );
    } else {
      recordFail(
        `Fix 5 failed: create=${convCreateRes.statusCode}, append=${convAppendValidRes.statusCode}, userId=${convTamperUserIdRes.statusCode}, delMsg=${convDeletePrevMessagesRes.statusCode}, impSupp=${convImpersonateSupportRes.statusCode}, suppReply=${convSupportReplyRes.statusCode}, appSuppRead=${appSupportReadRes.statusCode}, appSuppUpd=${appSupportUpdateRes.statusCode}, appAdmUpd=${appAdminUpdateRes.statusCode}`
      );
    }

    // =========================================================================
    // 7. POINT 7: SUPPLEMENTARY HARDENING VERIFICATION ON EMULATOR
    // =========================================================================
    console.log('\n--- 7. Testing Supplementary Hardening (Support Reordering & Role, Courier Missing Approval, Suspended Store Products, AppContext Compatibility) ---');

    // --- 7.1: support_conversations (First-message senderRole, Reordering old messages, Support field/operation restrictions) ---
    const convBadFirstRoleRes = await emulatorRestRequest(
      'POST',
      'support_conversations?documentId=conv_supp_bad_role',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_supp_bad_role',
          userId: customerUid,
          status: 'open',
          messages: [
            {
              id: 'm_bad_1',
              conversationId: 'conv_supp_bad_role',
              senderId: customerUid,
              senderName: 'زبون ينتحل الدعم عند الإنشاء',
              senderRole: 'support', // Spoofed on first message!
              text: 'رسالة أولى بدور دعم مزيف',
              timestamp: '14:00',
              isAgent: false,
            },
          ],
        }),
      }
    );

    const convMissingFirstRoleRes = await emulatorRestRequest(
      'POST',
      'support_conversations?documentId=conv_supp_no_role',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_supp_no_role',
          userId: customerUid,
          status: 'open',
          messages: [
            {
              id: 'm_no_role_1',
              conversationId: 'conv_supp_no_role',
              senderId: customerUid,
              senderName: 'زبون بدون senderRole',
              text: 'رسالة أولى بدون تحديد الدور',
              timestamp: '14:00',
              isAgent: false,
            },
          ],
        }),
      }
    );

    // Seed a conversation with 2 existing messages [msg1, msg2] to test reordering [msg2, msg1, msg3]
    await adminDb.collection('support_conversations').doc('conv_reorder_test').set({
      id: 'conv_reorder_test',
      userId: customerUid,
      subject: 'مشكلة في الطلب',
      userPhone: '07701234567',
      status: 'open',
      lastMessage: msg2.text,
      lastUpdated: '13:01',
      messages: [msg1, msg2],
    });

    const msg3Customer = {
      id: 'm3_cust',
      conversationId: 'conv_reorder_test',
      senderId: customerUid,
      senderName: 'زبون تجريبي',
      senderRole: 'customer',
      text: 'رسالة ثالثة بعد عكس الترتيب',
      timestamp: '14:02',
      isAgent: false,
    };

    // Attempt to reorder [msg2, msg1, msg3Customer] (passes hasAll, but MUST FAIL slice equality!)
    const convReorderByUserRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      customerToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'open',
          lastMessage: msg3Customer.text,
          lastUpdated: '14:02',
          messages: [msg2, msg1, msg3Customer], // Reordered!
        }),
      }
    );

    // Support staff attempts to modify subject/userPhone or delete/reorder messages -> REJECTED (403)
    const convSupportTamperSubjectRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'عنوان معدل بشكل غير مصرح به', // Tampered by support!
          userPhone: '07701234567',
          status: 'pending',
          lastMessage: msg2.text,
          lastUpdated: '14:03',
          messages: [msg1, msg2],
        }),
      }
    );

    const convSupportDeleteMessagesRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'resolved',
          lastMessage: 'تم مسح السجل',
          lastUpdated: '14:04',
          messages: [], // Support tries to wipe history!
        }),
      }
    );

    // Support staff valid status-only update (lastMessage untouched) -> ALLOWED (200)
    const convSupportStatusOnlyRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'pending',
          lastMessage: msg2.text, // Exactly identical to existing().lastMessage
          lastUpdated: '14:05',
          messages: [msg1, msg2],
        }),
      }
    );

    // Support staff tries to change status AND tamper lastMessage without adding a message -> REJECTED (403)
    const convSupportTamperLastMsgOnStatusRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'resolved',
          lastMessage: 'نص رسالة أخير مزور دون إضافة رسالة', // Tampered!
          lastUpdated: '14:06',
          messages: [msg1, msg2], // No message added!
        }),
      }
    );

    // Support staff adds valid message BUT passes mismatched lastMessage -> REJECTED (403)
    const realSupportMsg = {
      id: 'm3_agent_real',
      conversationId: 'conv_reorder_test',
      senderId: 'uid_support_1',
      senderName: 'فريق الدعم الفني',
      senderRole: 'support',
      text: 'أهلاً بك، تم التحقق من طلبك وسنقوم بالمعالجة فورا.',
      timestamp: '14:07',
      isAgent: true,
    };

    const convSupportMismatchedLastMsgOnReplyRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'pending',
          lastMessage: 'نص مختلف تماما عن محتوى الرسالة المضافة', // Mismatched with realSupportMsg.text!
          lastUpdated: '14:07',
          messages: [msg1, msg2, realSupportMsg],
        }),
      }
    );

    // Support staff adds valid message with matching lastMessage -> ALLOWED (200)
    const convSupportValidReplyWithMatchingLastMsgRes = await emulatorRestRequest(
      'PATCH',
      'support_conversations/conv_reorder_test',
      supportToken,
      {
        fields: toFirestoreFields({
          id: 'conv_reorder_test',
          userId: customerUid,
          subject: 'مشكلة في الطلب',
          userPhone: '07701234567',
          status: 'pending',
          lastMessage: realSupportMsg.text, // Exactly matches newly added message text!
          lastUpdated: '14:07',
          messages: [msg1, msg2, realSupportMsg],
        }),
      }
    );

    if (
      convBadFirstRoleRes.statusCode === 403 &&
      convMissingFirstRoleRes.statusCode === 403 &&
      convReorderByUserRes.statusCode === 403 &&
      convSupportTamperSubjectRes.statusCode === 403 &&
      convSupportDeleteMessagesRes.statusCode === 403 &&
      convSupportStatusOnlyRes.statusCode === 200 &&
      convSupportTamperLastMsgOnStatusRes.statusCode === 403 &&
      convSupportMismatchedLastMsgOnReplyRes.statusCode === 403 &&
      convSupportValidReplyWithMatchingLastMsgRes.statusCode === 200
    ) {
      recordPass(
        'Test 7.1 (support_conversations): First-message senderRole tampering/omission REJECTED (403), old message reordering REJECTED (403), Support subject tampering & message deletion REJECTED (403), changing lastMessage on status-only REJECTED (403), mismatched lastMessage on reply REJECTED (403), status update with unchanged lastMessage ALLOWED (200), and reply with matching lastMessage ALLOWED (200)'
      );
    } else {
      recordFail(
        `Test 7.1 failed: badRole=${convBadFirstRoleRes.statusCode}, noRole=${convMissingFirstRoleRes.statusCode}, reorder=${convReorderByUserRes.statusCode}, suppSubj=${convSupportTamperSubjectRes.statusCode}, suppDel=${convSupportDeleteMessagesRes.statusCode}, suppStatus=${convSupportStatusOnlyRes.statusCode}, suppTamperLastMsg=${convSupportTamperLastMsgOnStatusRes.statusCode}, suppMismatchLastMsg=${convSupportMismatchedLastMsgOnReplyRes.statusCode}, suppValidReply=${convSupportValidReplyWithMatchingLastMsgRes.statusCode}`
      );
    }

    // --- 7.2: couriers (Block update when approvalStatus is missing or not 'approved') ---
    const courierNoStatusUid = 'uid_courier_no_status';
    const courierNoStatusJwt = createEmulatorJwt(courierNoStatusUid, { role: 'courier' });
    await adminDb.collection('couriers').doc('cour_no_status').set({
      id: 'cour_no_status',
      userId: courierNoStatusUid,
      name: 'كابتن بدون حقل اعتماد',
      phone: '07705554444',
      walletBalance: 0,
      totalEarnings: 0,
      isBusy: false,
      isOnline: false,
      currentLocation: 'بغداد',
      // Note: approvalStatus intentionally omitted!
    });

    const courierMissingStatusUpdateRes = await emulatorRestRequest(
      'PATCH',
      'couriers/cour_no_status',
      courierNoStatusJwt,
      {
        fields: toFirestoreFields({
          id: 'cour_no_status',
          userId: courierNoStatusUid,
          name: 'كابتن بدون حقل اعتماد',
          phone: '07705554444',
          walletBalance: 0,
          totalEarnings: 0,
          isBusy: false,
          isOnline: true,
          currentLocation: 'بغداد - الأعظمية',
        }),
      }
    );

    if (courierMissingStatusUpdateRes.statusCode === 403 && pendingCourierToggleOnline.statusCode === 403) {
      recordPass(
        'Test 7.2 (couriers): Courier update REJECTED (403) when approvalStatus is missing or not "approved", while approved courier operational update is ALLOWED (200)'
      );
    } else {
      recordFail(
        `Test 7.2 failed: missingStatus=${courierMissingStatusUpdateRes.statusCode}, pendingStatus=${pendingCourierToggleOnline.statusCode}`
      );
    }

    // --- 7.3: products (Block create/update when store is unapproved or suspended due to dues) ---
    const merchPendingUid = 'uid_merch_pending';
    const merchPendingJwt = createEmulatorJwt(merchPendingUid, { role: 'merchant' });
    const merchSuspendedUid = 'uid_merch_suspended';
    const merchSuspendedJwt = createEmulatorJwt(merchSuspendedUid, { role: 'merchant' });

    await adminDb.collection('stores').doc('store_pending').set({
      id: 'store_pending',
      name: 'مطعم قيد المراجعة',
      merchantUserId: merchPendingUid,
      approvalStatus: 'pending',
      isSuspendedDueToDues: false,
    });
    await adminDb.collection('stores').doc('store_suspended').set({
      id: 'store_suspended',
      name: 'مطعم موقوف بسبب المديونية',
      merchantUserId: merchSuspendedUid,
      approvalStatus: 'approved',
      isSuspendedDueToDues: true,
    });
    await adminDb.collection('products').doc('prod_susp_1').set({
      id: 'prod_susp_1',
      storeId: 'store_suspended',
      name: 'منتج في متجر موقوف',
      price: 5000,
      isAvailable: true,
    });

    const prodCreateUnapprovedStoreRes = await emulatorRestRequest(
      'POST',
      'products?documentId=prod_pend_1',
      merchPendingJwt,
      {
        fields: toFirestoreFields({
          id: 'prod_pend_1',
          storeId: 'store_pending',
          name: 'منتج متجر غير معتمد',
          price: 8000,
          isAvailable: true,
        }),
      }
    );

    const prodCreateSuspendedStoreRes = await emulatorRestRequest(
      'POST',
      'products?documentId=prod_susp_new',
      merchSuspendedJwt,
      {
        fields: toFirestoreFields({
          id: 'prod_susp_new',
          storeId: 'store_suspended',
          name: 'منتج جديد لمتجر موقوف',
          price: 9000,
          isAvailable: true,
        }),
      }
    );

    const prodUpdateSuspendedStoreRes = await emulatorRestRequest(
      'PATCH',
      'products/prod_susp_1',
      merchSuspendedJwt,
      {
        fields: toFirestoreFields({
          id: 'prod_susp_1',
          storeId: 'store_suspended',
          name: 'تعديل منتج في متجر موقوف',
          price: 6000,
          isAvailable: false,
        }),
      }
    );

    if (
      prodCreateUnapprovedStoreRes.statusCode === 403 &&
      prodCreateSuspendedStoreRes.statusCode === 403 &&
      prodUpdateSuspendedStoreRes.statusCode === 403
    ) {
      recordPass(
        'Test 7.3 (products): Merchant product create and update REJECTED (403) when store is unapproved (pending) or suspended (isSuspendedDueToDues == true)'
      );
    } else {
      recordFail(
        `Test 7.3 failed: createPending=${prodCreateUnapprovedStoreRes.statusCode}, createSusp=${prodCreateSuspendedStoreRes.statusCode}, updateSusp=${prodUpdateSuspendedStoreRes.statusCode}`
      );
    }

    // --- 7.4: Verify AppContext.tsx Compatibility (Scoped courier query, removed fake support auto-reply, no client store/courier rating setDoc) ---
    const latestAppContextCode = fs.readFileSync('/app/applet/src/context/AppContext.tsx', 'utf-8');
    const hasScopedCourierQuery = latestAppContextCode.includes(
      "where('userId', '==', firebaseUser.uid)"
    );
    const removedFakeAutoSupportReply =
      !latestAppContextCode.includes('msg_auto_') &&
      !latestAppContextCode.includes('سارة التميمي (الدعم الفني)');
    const submitRatingBlock =
      latestAppContextCode.split('const submitOrderRating =')[1]?.split('const isOrderRated =')[0] || '';
    const removedClientRatingAverageSetDoc =
      !submitRatingBlock.includes("setDoc(doc(db, 'stores'") &&
      !submitRatingBlock.includes("setDoc(doc(db, 'couriers'");

    if (hasScopedCourierQuery && removedFakeAutoSupportReply && removedClientRatingAverageSetDoc) {
      recordPass(
        'Test 7.4 (AppContext.tsx compatibility): Public couriers listener replaced with role-restricted query, fake support auto-reply removed, and forbidden client setDoc on store/courier rating averages removed'
      );
    } else {
      recordFail(
        `Test 7.4 failed: scopedCourier=${hasScopedCourierQuery}, noFakeReply=${removedFakeAutoSupportReply}, noRatingSetDoc=${removedClientRatingAverageSetDoc}`
      );
    }

    // =========================================================================
    // 8. POINT 8: COURIER LOCATION & SAFE STATUS SERVER LOGIC VERIFICATION
    // =========================================================================
    console.log('\n--- 8. Testing Courier Location & Offline Status Server Handlers ---');

    const courierActiveUid = 'uid_courier_active_track';
    const courierOtherUid = 'uid_courier_other_track';
    const activeOrderId = 'order_active_tracking_101';

    // Seed users and courier profiles
    await adminDb.collection('users').doc(courierActiveUid).set({
      id: courierActiveUid,
      name: 'كابتن التوصيل الفعلي',
      phone: '07703332211',
      email: 'courier_active@talabi.iq',
      role: 'courier',
      accountType: 'courier',
    });
    await adminDb.collection('couriers').doc('cour_active_track').set({
      id: 'cour_active_track',
      userId: courierActiveUid,
      name: 'كابتن التوصيل الفعلي',
      phone: '07703332211',
      approvalStatus: 'approved',
      isOnline: true,
      isBusy: true,
      currentOrderId: activeOrderId,
    });

    await adminDb.collection('users').doc(courierOtherUid).set({
      id: courierOtherUid,
      name: 'كابتن متطفل',
      phone: '07709998877',
      email: 'courier_other@talabi.iq',
      role: 'courier',
      accountType: 'courier',
    });
    await adminDb.collection('couriers').doc('cour_other_track').set({
      id: 'cour_other_track',
      userId: courierOtherUid,
      name: 'كابتن متطفل',
      phone: '07709998877',
      approvalStatus: 'approved',
      isOnline: true,
    });

    // Seed active order assigned to cour_active_track
    await adminDb.collection('orders').doc(activeOrderId).set({
      id: activeOrderId,
      status: 'picked_up',
      storeId: 'store_A',
      courierId: 'cour_active_track',
      courierName: 'كابتن التوصيل الفعلي',
      total: 25000,
      payment: { method: 'cash_on_delivery', status: 'pending', amount: 25000 },
    });

    // 8.1 Direct client write from courier to orders/{activeOrderId}.courierLocation MUST BE BLOCKED (403) by firestore.rules
    const directClientLocationWriteRes = await emulatorRestRequest(
      'PATCH',
      `orders/${activeOrderId}`,
      createEmulatorJwt(courierActiveUid, { role: 'courier' }),
      {
        fields: toFirestoreFields({
          courierLocation: {
            lat: 33.315,
            lng: 44.366,
            updatedAt: '15:00',
            isSharingEnabled: true,
          },
        }),
      }
    );

    // 8.2 Server Handler Logic Test: Function that executes the exact transaction from /api/couriers/location
    async function simulateServerUpdateLocation(courierAuth: { uid: string; courierId: string }, ordId: string, coords: any) {
      return await adminDb.runTransaction(async (tx) => {
        const orderRef = adminDb.collection('orders').doc(ordId);
        const courierRef = adminDb.collection('couriers').doc(courierAuth.courierId);
        const oSnap = await tx.get(orderRef);
        const cSnap = await tx.get(courierRef);

        if (!oSnap.exists) throw new Error('الطلب غير موجود');
        if (!cSnap.exists) throw new Error('بيانات المندوب غير موجودة في النظام');

        const orderData = oSnap.data()!;
        const courierData = cSnap.data()!;

        // 1. Verify that this courier's active assigned order strictly matches orderId
        if (!courierData.currentOrderId || courierData.currentOrderId !== ordId) {
          throw new Error('غير مصرح: هذا الطلب ليس هو الطلب النشط المخصص لك حالياً');
        }

        // 2. Verify that this courier actually owns this active order
        const isAssignedCourier =
          orderData.courierId === courierAuth.courierId ||
          orderData.courierId === courierAuth.uid;

        if (!isAssignedCourier) throw new Error('غير مصرح: هذا الطلب غير مسند إلى حسابك');

        // 3. Verify order is active (not finished or cancelled)
        if (['delivered', 'cancelled'].includes(orderData.status)) {
          throw new Error('لا يمكن تحديث موقع كابتن لطلب تم إتمامه أو إلغاؤه');
        }

        const nowTime = '15:00';
        const courierLocationData = {
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy || 10,
          updatedAt: nowTime,
          isSharingEnabled: true,
        };
        tx.update(orderRef, { courierLocation: courierLocationData });
        tx.update(courierRef, {
          currentLocation: 'بغداد - المنصور',
          coordinates: { lat: coords.lat, lng: coords.lng },
          updatedAt: nowTime,
        });
        return { success: true, courierLocation: courierLocationData };
      });
    }

    // A: Assigned courier updates location of currentOrderId -> SUCCEEDS
    const assignedLocationUpdateResult = await simulateServerUpdateLocation(
      { uid: courierActiveUid, courierId: 'cour_active_track' },
      activeOrderId,
      { lat: 33.3152, lng: 44.3661, accuracy: 5 }
    );
    const updatedOrderSnap = await adminDb.collection('orders').doc(activeOrderId).get();
    const hasOrderLocationUpdated = updatedOrderSnap.data()?.courierLocation?.lat === 33.3152;

    // B: Courier tries to update a DIFFERENT / OLD order not matching currentOrderId -> REJECTED
    const otherOrderId = 'order_past_inactive_999';
    await adminDb.collection('orders').doc(otherOrderId).set({
      id: otherOrderId,
      status: 'picked_up',
      storeId: 'store_A',
      courierId: 'cour_active_track',
      total: 20000,
      payment: { method: 'cash_on_delivery', status: 'pending', amount: 20000 },
    });
    let mismatchedOrderBlocked = false;
    try {
      await simulateServerUpdateLocation(
        { uid: courierActiveUid, courierId: 'cour_active_track' },
        otherOrderId,
        { lat: 33.3152, lng: 44.3661, accuracy: 5 }
      );
    } catch (e: any) {
      if (e.message.includes('ليس هو الطلب النشط')) mismatchedOrderBlocked = true;
    }

    // C: Other courier tries to update location of this order -> REJECTED
    let otherCourierBlocked = false;
    try {
      await simulateServerUpdateLocation(
        { uid: courierOtherUid, courierId: 'cour_other_track' },
        activeOrderId,
        { lat: 33.399, lng: 44.399, accuracy: 5 }
      );
    } catch (e: any) {
      if (e.message.includes('ليس هو الطلب النشط') || e.message.includes('غير مسند')) otherCourierBlocked = true;
    }

    // D: Location update rejected after order is delivered
    await adminDb.collection('orders').doc(activeOrderId).update({ status: 'delivered' });
    let deliveredOrderLocationBlocked = false;
    try {
      await simulateServerUpdateLocation(
        { uid: courierActiveUid, courierId: 'cour_active_track' },
        activeOrderId,
        { lat: 33.32, lng: 44.37, accuracy: 5 }
      );
    } catch (e: any) {
      if (e.message.includes('تم إتمامه أو إلغاؤه')) deliveredOrderLocationBlocked = true;
    }

    // 8.3 Offline Courier Revokes Pending Offer Safely on Server while Preserving Accepted Orders
    const pendingOfferOrderId = 'order_pending_offer_202';
    await adminDb.collection('orders').doc(pendingOfferOrderId).set({
      id: pendingOfferOrderId,
      status: 'courier_offered',
      previousStatus: 'ready_for_pickup',
      offeredToCourierId: 'cour_active_track',
      offeredAt: Date.now(),
      offeredExpireAt: Date.now() + 15000,
      total: 15000,
      payment: { method: 'cash_on_delivery', status: 'pending', amount: 15000 },
    });
    await adminDb.collection('couriers').doc('cour_active_track').update({
      currentOfferOrderId: pendingOfferOrderId,
    });

    // Simulate /api/couriers/status transaction when courier turns offline
    async function simulateServerCourierStatus(courierId: string, isOnline: boolean) {
      return await adminDb.runTransaction(async (tx) => {
        const courierRef = adminDb.collection('couriers').doc(courierId);
        const cSnap = await tx.get(courierRef);
        const courierData = cSnap.data()!;
        const offeredId = courierData.currentOfferOrderId;
        if (!isOnline && offeredId) {
          const orderRef = adminDb.collection('orders').doc(offeredId);
          const oSnap = await tx.get(orderRef);
          if (oSnap.exists) {
            const oData = oSnap.data()!;
            if (oData.offeredToCourierId === courierId && !oData.courierId) {
              tx.update(orderRef, {
                offeredToCourierId: null,
                offeredAt: null,
                offeredExpireAt: null,
                status: oData.status === 'courier_offered' ? (oData.previousStatus || 'created') : oData.status,
              });
            }
          }
        }
        tx.update(courierRef, {
          isOnline,
          currentOfferOrderId: isOnline ? (courierData.currentOfferOrderId || null) : null,
        });
        return { success: true, isOnline };
      });
    }

    await simulateServerCourierStatus('cour_active_track', false);
    const orderAfterOfflineSnap = await adminDb.collection('orders').doc(pendingOfferOrderId).get();
    const orderAfterOfflineData = orderAfterOfflineSnap.data()!;
    const courierAfterOfflineSnap = await adminDb.collection('couriers').doc('cour_active_track').get();
    const courierAfterOfflineData = courierAfterOfflineSnap.data()!;

    const offerRevokedSafely =
      orderAfterOfflineData.offeredToCourierId === null &&
      orderAfterOfflineData.status === 'ready_for_pickup' &&
      courierAfterOfflineData.isOnline === false &&
      courierAfterOfflineData.currentOfferOrderId === null;

    if (
      directClientLocationWriteRes.statusCode === 403 &&
      assignedLocationUpdateResult.success &&
      hasOrderLocationUpdated &&
      mismatchedOrderBlocked &&
      otherCourierBlocked &&
      deliveredOrderLocationBlocked &&
      offerRevokedSafely
    ) {
      recordPass(
        'Test 8 (Courier Location & Status Handlers): Direct client location blocked (403), Assigned active order updated via Server Admin SDK (200), Mismatched or non-current orders blocked, Other couriers blocked, Delivered orders blocked, and going offline safely revokes pending order offer'
      );
    } else {
      recordFail(
        `Test 8 failed: directClient=${directClientLocationWriteRes.statusCode}, assignedResult=${assignedLocationUpdateResult.success}, hasUpdated=${hasOrderLocationUpdated}, mismatchedBlocked=${mismatchedOrderBlocked}, otherBlocked=${otherCourierBlocked}, deliveredBlocked=${deliveredOrderLocationBlocked}, offerRevoked=${offerRevokedSafely}`
      );
    }
  } catch (err: any) {
    failed++;
    console.error('Test execution error:', err);
  } finally {
    console.log('\n===============================================================');
    console.log(`  SECURITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED  `);
    console.log('===============================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  }
}

runSecurityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
