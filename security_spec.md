# TALABI Security Specification

## Data Invariants
1. **User Identity**: A user cannot change their own `role` field.
2. **Order Integrity**: A customer can only read their own orders (where `customer.id == auth.uid`).
3. **Store Ownership**: Only the `merchantUserId` associated with a store can update its details or its products.
4. **Courier Exclusivity**: An order can only be claimed by a courier if `courierId` is null. Once claimed, it cannot be claimed by another.
5. **Pricing Authority**: Only an `admin` can read/write `platform_settings`.
6. **Audit Logs**: Users can only create audit logs; only admins can read them. No one can update or delete them.
7. **Onboarding**: Anyone can create an application, but only admins can update/approve them.

## The Dirty Dozen Payloads (Red Team Test Cases)

1. **Self-Promotion**: A customer attempts to update `/users/{uid}` with `{ "role": "admin" }`.
2. **Order Snooping**: User A attempts to read `/orders/{orderId}` belonging to User B.
3. **Price Tampering**: A customer attempts to update `/platform_settings/delivery_fees` to `{ "defaultDeliveryFee": 0 }`.
4. **Order Hijacking**: Courier A attempts to update an order already claimed by Courier B (`resource.data.courierId != null`).
5. **Menu Sabotage**: User A (not a merchant) attempts to delete a product from Store X.
6. **Application Approval**: A merchant attempts to update their own `/restaurant_applications/{id}` to `{ "status": "approved" }`.
7. **Audit Erasure**: An admin attempts to delete an audit log.
8. **Rating Spoofing**: User A attempts to create a rating for an order they didn't place.
9. **Financial Manipulation**: A merchant attempts to update `/store_payments/{id}` to record a fake payout.
10. **Global Read**: An unauthenticated user attempts to list all documents in `/users`.
11. **Profile Impersonation**: User A attempts to update User B's profile.
12. **Status Skip**: A customer attempts to update an order status directly to `delivered` without it being `picked_up`.

## Security Rule Pillars Implementation
1. **Master Gate**: All rules start with a check for `isSignedIn()`.
2. **Standalone Validation**: `isValidUser`, `isValidOrder`, `isValidProduct` helpers.
3. **Role-Based Access**: Role lookup via `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role`.
4. **Action-Based Updates**: Specific field allow-lists for status transitions.
5. **Terminal State Locking**: Prevent updates to `delivered` or `cancelled` orders.
