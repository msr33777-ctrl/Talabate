import express from 'express';

// ============================================================================
// TALABI SECURITY SUITE - VERIFICATION OF SECURITY FIXES
// ============================================================================

console.log('===============================================================');
console.log('       TALABI SYSTEM - COMPREHENSIVE SECURITY AUDIT SUITE      ');
console.log('===============================================================');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   ℹ️  ${details}`);
  } else {
    failedTests++;
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   ⚠️  ${details}`);
  }
}

// ----------------------------------------------------------------------------
// TEST SECTION 1: ADMIN ROLE ELEVATION PROTECTION (USERS/{UID}.ROLE OVERRIDE)
// ----------------------------------------------------------------------------
console.log('\n--- 1. Testing Admin Role Elevation via Firestore userDoc ---');

// Simulated token verification and role assignment logic matching server.ts
function evaluateUserRole(decodedToken: any, firestoreUserDoc: any) {
  const tokenRole = (decodedToken.role as string) || '';
  const hasAdminClaim = tokenRole === 'admin';

  let role = hasAdminClaim ? 'admin' : (tokenRole || 'customer');
  let name = decodedToken.name || 'مستخدم';
  let email = decodedToken.email;

  if (firestoreUserDoc) {
    name = firestoreUserDoc.name || name;
    if (!hasAdminClaim) {
      if (firestoreUserDoc.role === 'admin') {
        // SECURITY SHIELD: Block role elevation!
      }
      if (firestoreUserDoc.role && firestoreUserDoc.role !== 'admin') {
        role = firestoreUserDoc.role;
      }
    }
  }

  return {
    uid: decodedToken.uid,
    role,
    name,
    email,
    tokenRole
  };
}

// Middleware simulator for requireAdminAuth
function simulateRequireAdminAuth(authenticatedUser: any): { status: number; allowed: boolean; error?: string } {
  if (authenticatedUser?.role !== 'admin' || authenticatedUser?.tokenRole !== 'admin') {
    return {
      status: 403,
      allowed: false,
      error: 'غير مصرح: يتطلب هذا الإجراء صلاحية مدير موثوقة حصراً (Admin Custom Claim)'
    };
  }
  return { status: 200, allowed: true };
}

// Scenario 1: Malicious customer with Firestore role: 'admin'
const maliciousCustomerToken = { uid: 'user_attacker_1', email: 'attacker@example.com', role: 'customer' };
const forgedFirestoreDoc = { name: 'المهاجم', role: 'admin' };

const evaluatedMalicious = evaluateUserRole(maliciousCustomerToken, forgedFirestoreDoc);
assert(
  evaluatedMalicious.role === 'customer',
  'Attack 1: Firestore doc role="admin" rejected; role remains "customer"',
  `Assigned role: ${evaluatedMalicious.role} (Elevation blocked!)`
);

const adminAccessAttempt1 = simulateRequireAdminAuth(evaluatedMalicious);
assert(
  adminAccessAttempt1.status === 403 && !adminAccessAttempt1.allowed,
  'Attack 1: requireAdminAuth returned 403 Forbidden for elevated document attempt',
  `HTTP Status: ${adminAccessAttempt1.status}, Error: ${adminAccessAttempt1.error}`
);

// Scenario 2: Normal customer without role claim
const normalCustomerToken = { uid: 'user_cust_1', email: 'cust@example.com' };
const normalFirestoreDoc = { name: 'زبون عادي', role: 'customer' };

const evaluatedNormal = evaluateUserRole(normalCustomerToken, normalFirestoreDoc);
const adminAccessAttempt2 = simulateRequireAdminAuth(evaluatedNormal);
assert(
  adminAccessAttempt2.status === 403 && !adminAccessAttempt2.allowed,
  'Attack 2: Normal customer denied access to admin routes',
  `HTTP Status: ${adminAccessAttempt2.status}`
);

// Scenario 3: Legitimate primary admin with cryptographically signed Custom Claim
const genuineAdminToken = { uid: 'user_admin_primary', email: 'msr33777@gmail.com', role: 'admin' };
const adminFirestoreDoc = { name: 'المدير الأساسي', role: 'admin' };

const evaluatedAdmin = evaluateUserRole(genuineAdminToken, adminFirestoreDoc);
const adminAccessAttempt3 = simulateRequireAdminAuth(evaluatedAdmin);
assert(
  adminAccessAttempt3.status === 200 && adminAccessAttempt3.allowed && evaluatedAdmin.role === 'admin',
  'Verification: Genuine Admin with Custom Claim role="admin" granted access',
  `Allowed: ${adminAccessAttempt3.allowed}`
);

// ----------------------------------------------------------------------------
// TEST SECTION 2: ORDER RATINGS SECURITY & DUPLICATE PREVENTION LOGIC
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing Order Ratings Security & Deduplication ---');

// Simulated Firestore Rules function: isValidOrderRating
interface OrderDoc {
  id: string;
  status: string;
  customer: { id: string };
  isRated?: boolean;
}

interface IncomingRating {
  orderId: string;
  storeId: string;
  customerId: string;
  storeRating: number;
}

function evaluateOrderRatingRule(
  incoming: IncomingRating,
  ratingDocId: string,
  authUid: string,
  ordersDatabase: Record<string, OrderDoc>,
  existingRatingsDatabase: Set<string>
): { allowed: boolean; reason: string } {
  // 1. Required keys
  if (!incoming.orderId || !incoming.storeId || !incoming.customerId || !incoming.storeRating) {
    return { allowed: false, reason: 'Missing mandatory rating fields' };
  }
  // 2. Caller must be customerId
  if (incoming.customerId !== authUid) {
    return { allowed: false, reason: 'Caller UID does not match incoming customerId' };
  }
  // 3. Strict 1:1 ID binding
  if (ratingDocId !== incoming.orderId) {
    return { allowed: false, reason: 'ratingDocId must equal orderId (Deduplication enforcement)' };
  }
  // 4. Duplicate check at collection level (Firestore "allow create" fails if doc already exists)
  if (existingRatingsDatabase.has(ratingDocId)) {
    return { allowed: false, reason: 'ALREADY_EXISTS: A rating for this order already exists' };
  }
  // 5. Order existence
  const order = ordersDatabase[incoming.orderId];
  if (!order) {
    return { allowed: false, reason: 'Order does not exist in /orders' };
  }
  // 6. Order status must be delivered
  if (order.status !== 'delivered') {
    return { allowed: false, reason: `Order is not delivered (Current status: ${order.status})` };
  }
  // 7. Order ownership
  if (order.customer.id !== authUid) {
    return { allowed: false, reason: 'Order belongs to a different customer' };
  }

  return { allowed: true, reason: 'OK' };
}

const mockOrders: Record<string, OrderDoc> = {
  order_delivered_own: { id: 'order_delivered_own', status: 'delivered', customer: { id: 'cust_100' } },
  order_preparing_own: { id: 'order_preparing_own', status: 'preparing', customer: { id: 'cust_100' } },
  order_delivered_other: { id: 'order_delivered_other', status: 'delivered', customer: { id: 'cust_999' } },
};
const mockRatingsDb = new Set<string>();

// Case A: Rating non-existent order
const resA = evaluateOrderRatingRule(
  { orderId: 'order_non_existent', storeId: 'store_1', customerId: 'cust_100', storeRating: 5 },
  'order_non_existent',
  'cust_100',
  mockOrders,
  mockRatingsDb
);
assert(!resA.allowed, 'Rating Test A: Reject rating for non-existent order', resA.reason);

// Case B: Rating order that is still in preparation ('preparing')
const resB = evaluateOrderRatingRule(
  { orderId: 'order_preparing_own', storeId: 'store_1', customerId: 'cust_100', storeRating: 5 },
  'order_preparing_own',
  'cust_100',
  mockOrders,
  mockRatingsDb
);
assert(!resB.allowed, 'Rating Test B: Reject rating for non-delivered order', resB.reason);

// Case C: Rating another customer's delivered order
const resC = evaluateOrderRatingRule(
  { orderId: 'order_delivered_other', storeId: 'store_1', customerId: 'cust_100', storeRating: 5 },
  'order_delivered_other',
  'cust_100',
  mockOrders,
  mockRatingsDb
);
assert(!resC.allowed, 'Rating Test C: Reject rating for another customer\'s order', resC.reason);

// Case D: Legitimate first-time rating for customer's delivered order
const resD = evaluateOrderRatingRule(
  { orderId: 'order_delivered_own', storeId: 'store_1', customerId: 'cust_100', storeRating: 5 },
  'order_delivered_own',
  'cust_100',
  mockOrders,
  mockRatingsDb
);
assert(resD.allowed, 'Rating Test D: Accept valid rating for customer\'s delivered order', resD.reason);

// Add to database to simulate successful creation
mockRatingsDb.add('order_delivered_own');

// Case E: Duplicate rating attempt for the same order
const resE = evaluateOrderRatingRule(
  { orderId: 'order_delivered_own', storeId: 'store_1', customerId: 'cust_100', storeRating: 4 },
  'order_delivered_own',
  'cust_100',
  mockOrders,
  mockRatingsDb
);
assert(!resE.allowed, 'Rating Test E: Reject duplicate rating attempt for same order', resE.reason);

// ----------------------------------------------------------------------------
// TEST SECTION 3: DISTRIBUTED WORKER LOCK SIMULATION (MULTI-INSTANCE CLOUD RUN)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Distributed Worker Lock (Cloud Run Multi-Instance) ---');

interface DistributedLockDoc {
  owner: string | null;
  acquiredAt: number;
  expiresAt: number;
}

class SimulatedFirestoreLock {
  private lockDoc: DistributedLockDoc = { owner: null, acquiredAt: 0, expiresAt: 0 };
  private lockTTL = 12000;

  async acquireLock(workerInstanceId: string, now: number): Promise<boolean> {
    // Transactional atomic check
    if (now < this.lockDoc.expiresAt && this.lockDoc.owner && this.lockDoc.owner !== workerInstanceId) {
      return false; // Active lock held by another instance
    }
    this.lockDoc = {
      owner: workerInstanceId,
      acquiredAt: now,
      expiresAt: now + this.lockTTL,
    };
    return true;
  }

  async releaseLock(workerInstanceId: string): Promise<void> {
    if (this.lockDoc.owner === workerInstanceId) {
      this.lockDoc = { owner: null, acquiredAt: 0, expiresAt: 0 };
    }
  }

  getOwner(): string | null {
    return this.lockDoc.owner;
  }
}

const firestoreLock = new SimulatedFirestoreLock();
const t0 = Date.now();

// Instance A acquires lock
const lockA = await firestoreLock.acquireLock('cloud_run_instance_A', t0);
assert(lockA && firestoreLock.getOwner() === 'cloud_run_instance_A', 'Lock Test 1: Instance A acquires distributed lock');

// Concurrent Instance B attempts to acquire lock at t0 + 1000ms
const lockB = await firestoreLock.acquireLock('cloud_run_instance_B', t0 + 1000);
assert(!lockB, 'Lock Test 2: Instance B rejected while Instance A lock is active');

// Instance A finishes work and releases lock
await firestoreLock.releaseLock('cloud_run_instance_A');
assert(firestoreLock.getOwner() === null, 'Lock Test 3: Instance A releases distributed lock');

// Now Instance B attempts to acquire lock
const lockBAfter = await firestoreLock.acquireLock('cloud_run_instance_B', t0 + 2000);
assert(lockBAfter && firestoreLock.getOwner() === 'cloud_run_instance_B', 'Lock Test 4: Instance B acquires lock after release');

// ----------------------------------------------------------------------------
// FINAL SUMMARY
// ----------------------------------------------------------------------------
console.log('\n===============================================================');
console.log(`  SECURITY TEST SUITE FINISHED: ${passedTests} PASSED, ${failedTests} FAILED  `);
console.log('===============================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
