"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const axios_1 = require("axios");
// Point to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'ai-studio-talabi-6a8714a3-14fa-4b58-aad4-fced9a57737b'
    });
}
const db = admin.firestore();
const TIMEOUT_SECRET = 'TALABI_INTERNAL_SECRET';
async function runTests() {
    var _a, _b, _c, _d;
    console.log('--- Starting TALABI System Tests ---');
    try {
        // 1. Setup Test Data
        const merchantId = 'merchant_1';
        const courierId = 'courier_1';
        const otherMerchantId = 'merchant_2';
        await db.doc(`couriers/${courierId}`).set({
            id: courierId,
            name: 'Test Courier',
            isOnline: true,
            isBusy: false,
            currentOfferOrderId: null
        });
        await db.doc(`stores/store_1`).set({
            id: 'store_1',
            name: 'Test Store',
            merchantUserId: merchantId,
            isOpen: true,
            deliveryFee: 2000
        });
        // 2. Scenario: Order created, merchant sees it
        console.log('\nScenario 1: Order creation and merchant visibility');
        const orderId = 'ord_test_1';
        await db.doc(`orders/${orderId}`).set({
            id: orderId,
            storeId: 'store_1',
            merchantUserId: merchantId,
            status: 'created',
            items: [],
            total: 10000,
            customer: { name: 'Test Customer' }
        });
        // Wait for Firestore trigger (simulated here, but in emulator it should happen)
        await new Promise(r => setTimeout(r, 2000));
        const orderSnap = await db.doc(`orders/${orderId}`).get();
        const orderData = orderSnap.data();
        console.log(`Order status: ${orderData === null || orderData === void 0 ? void 0 : orderData.status}`);
        console.log(`Offered to: ${orderData === null || orderData === void 0 ? void 0 : orderData.offeredToCourierId}`);
        // Verify merchant isolation (Merchant 2 shouldn't see it if we query)
        const merchant2Orders = await db.collection('orders').where('merchantUserId', '==', otherMerchantId).get();
        console.log(`Merchant 2 sees ${merchant2Orders.size} orders (Expected: 0)`);
        // 3. Scenario: One offer per courier
        console.log('\nScenario 2: Atomic Reservation (One offer at a time)');
        const courierSnap = await db.doc(`couriers/${courierId}`).get();
        console.log(`Courier reserved for: ${(_a = courierSnap.data()) === null || _a === void 0 ? void 0 : _a.currentOfferOrderId}`);
        // Try to create another order while courier is busy
        const orderId2 = 'ord_test_2';
        await db.doc(`orders/${orderId2}`).set({
            id: orderId2,
            storeId: 'store_1',
            merchantUserId: merchantId,
            status: 'created',
            items: [],
            total: 5000,
            customer: { name: 'Customer 2' }
        });
        await new Promise(r => setTimeout(r, 1000));
        const order2Snap = await db.doc(`orders/${orderId2}`).get();
        console.log(`Order 2 status (Should be 'created' as courier is busy): ${(_b = order2Snap.data()) === null || _b === void 0 ? void 0 : _b.status}`);
        // 4. Scenario: Timeout Handling
        console.log('\nScenario 3: Timeout Handling');
        // Simulate Cloud Task calling the endpoint
        try {
            const response = await axios_1.default.post('http://localhost:5001/ai-studio-talabi-6a8714a3-14fa-4b58-aad4-fced9a57737b/us-central1/handleAssignmentTimeout', { orderId: orderId, courierId: courierId }, { headers: { 'Authorization': `Bearer ${TIMEOUT_SECRET}` } });
            console.log(`Timeout response: ${response.data}`);
        }
        catch (e) {
            console.log(`Timeout call failed (Emulator might not be fully up or port mismatch): ${e.message}`);
        }
        const courierAfterTimeout = await db.doc(`couriers/${courierId}`).get();
        console.log(`Courier after timeout (Reserved?): ${(_c = courierAfterTimeout.data()) === null || _c === void 0 ? void 0 : _c.currentOfferOrderId}`);
        // 5. Scenario: Acceptance prevents reset
        console.log('\nScenario 4: Acceptance prevents reset');
        // Reset state
        await db.doc(`couriers/${courierId}`).update({ currentOfferOrderId: orderId });
        await db.doc(`orders/${orderId}`).update({ status: 'courier_offered', offeredToCourierId: courierId });
        // Accept order (transactionally)
        await db.runTransaction(async (tx) => {
            tx.update(db.doc(`orders/${orderId}`), { status: 'courier_assigned', courierId: courierId });
            tx.update(db.doc(`couriers/${courierId}`), { isBusy: true, currentOfferOrderId: null });
        });
        // Call timeout again
        try {
            await axios_1.default.post('http://localhost:5001/ai-studio-talabi-6a8714a3-14fa-4b58-aad4-fced9a57737b/us-central1/handleAssignmentTimeout', { orderId: orderId, courierId: courierId }, { headers: { 'Authorization': `Bearer ${TIMEOUT_SECRET}` } });
        }
        catch (e) { }
        const orderFinalSnap = await db.doc(`orders/${orderId}`).get();
        console.log(`Order status after late timeout (Should stay assigned): ${(_d = orderFinalSnap.data()) === null || _d === void 0 ? void 0 : _d.status}`);
        console.log('\n--- Tests Completed ---');
    }
    catch (err) {
        console.error('Test script error:', err);
    }
}
runTests();
//# sourceMappingURL=test-system.js.map