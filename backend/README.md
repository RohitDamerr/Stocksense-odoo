# StockSense Backend

Node.js + Express + MongoDB inventory management API.

---

## Authentication

All auth endpoints live under `/api/auth`.

### Environment variables

Copy `.env.example` to `.env` and fill in the values before starting the server.
The three JWT secrets **must** be different, high-entropy strings (≥ 64 random bytes each).

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Endpoints

#### `POST /api/auth/signup`

Register a new user account.

**Body**

| Field      | Type   | Required | Notes                                              |
|------------|--------|----------|----------------------------------------------------|
| `name`     | string | ✓        | 2–100 characters                                   |
| `email`    | string | ✓        | Valid email; stored lowercase                      |
| `password` | string | ✓        | Min 8 chars, must contain at least 1 letter + 1 digit |
| `role`     | string | ✓        | `inventory_manager` or `warehouse_staff` only — `admin` cannot self-register |
| `phone`    | string |          | Optional                                           |

**Success `201`**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "_id": "...", "name": "...", "email": "...", "role": "...", ... },
    "accessToken": "<JWT>"
  }
}
```
A `refreshToken` is set as an `httpOnly` cookie (`refreshToken`).

**Errors**

| Status | Code             | Reason                         |
|--------|------------------|--------------------------------|
| 409    | `EMAIL_EXISTS`   | Email already registered       |
| 422    | `VALIDATION_ERROR` | Body fails schema validation |

---

#### `POST /api/auth/login`

Authenticate and receive tokens.

Rate-limited to **5 attempts per IP per 15 minutes**.

**Body**

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | ✓        |
| `password` | string | ✓        |

**Success `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "<JWT>",
    "redirectTo": "/dashboard"
  }
}
```
`refreshToken` set as `httpOnly` cookie.

**Errors**

| Status | Code                 | Reason                              |
|--------|----------------------|-------------------------------------|
| 401    | `INVALID_CREDENTIALS`| Wrong email or password             |
| 403    | `ACCOUNT_INACTIVE`   | Account has been deactivated        |
| 429    | `RATE_LIMITED`       | Too many login attempts             |

---

#### `POST /api/auth/logout`

🔒 Requires `Authorization: Bearer <accessToken>`.

Clears the `refreshToken` cookie. The short-lived access token expires on its own — clients should discard it locally.

**Success `200`**
```json
{ "success": true, "message": "Logged out successfully", "data": null }
```

---

#### `POST /api/auth/forgot-password`

Trigger an OTP-based password reset.

Rate-limited to **3 requests per IP per 15 minutes**.

Always returns `200` regardless of whether the email exists (prevents user enumeration).

**Body**

| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | ✓        |

**Success `200`**
```json
{
  "success": true,
  "message": "If an account with that email exists, a reset code has been sent.",
  "data": null
}
```

In development the OTP is printed to the console (no SMTP required). In production, wire up a real transport in `src/services/email.service.js`.

---

#### `POST /api/auth/verify-otp`

Validate the 6-digit OTP and receive a single-use reset token.

- OTP expires after **10 minutes**.
- Locked out after **5 failed attempts** — user must request a new OTP.

**Body**

| Field   | Type   | Required | Notes                    |
|---------|--------|----------|--------------------------|
| `email` | string | ✓        |                          |
| `otp`   | string | ✓        | Exactly 6 digits         |

**Success `200`**
```json
{
  "success": true,
  "message": "OTP verified. Use the reset token to set a new password.",
  "data": { "resetToken": "<short-lived JWT>" }
}
```

**Errors**

| Status | Code          | Reason                                     |
|--------|---------------|--------------------------------------------|
| 400    | `OTP_INVALID` | Wrong OTP, expired, or no pending reset    |
| 429    | `OTP_LOCKED`  | 5+ failed attempts; request a new OTP      |

---

#### `POST /api/auth/reset-password`

Consume the reset token and set a new password.

- Reset token is valid for **5 minutes** (single-purpose JWT, `purpose: "password_reset"`).
- On success: password updated, `passwordReset` sub-doc cleared, all refresh tokens treated as stale.

**Body**

| Field         | Type   | Required | Notes                              |
|---------------|--------|----------|------------------------------------|
| `resetToken`  | string | ✓        | Received from `/verify-otp`        |
| `newPassword` | string | ✓        | Same strength rules as signup      |

**Success `200`**
```json
{
  "success": true,
  "message": "Password reset successfully. Please log in with your new password.",
  "data": null
}
```

**Errors**

| Status | Code                  | Reason                                  |
|--------|-----------------------|-----------------------------------------|
| 400    | `RESET_TOKEN_INVALID` | Token invalid, expired, or wrong purpose |
| 400    | `RESET_ALREADY_USED`  | No pending reset on the account         |

---

### Auth middleware

Import and compose these on any protected route:

```js
const { verifyToken }  = require('./middleware/auth.middleware');
const { requireRole }  = require('./middleware/role.middleware');
const ROLES            = require('./constants/roles');

// Any authenticated user
router.get('/profile', verifyToken, profileController.get);

// Only inventory_manager and admin
router.post('/receipts/:id/validate',
  verifyToken,
  requireRole(ROLES.INVENTORY_MANAGER, ROLES.ADMIN),
  receiptController.validate
);

// Only warehouse_staff and admin
router.post('/transfers',
  verifyToken,
  requireRole(ROLES.WAREHOUSE_STAFF, ROLES.ADMIN),
  transferController.create
);
```

**`verifyToken`** — reads `Authorization: Bearer <token>`, verifies the access JWT, attaches `req.user = { userId, role }`. Returns `401` on missing/invalid/expired token.

**`requireRole(...roles)`** — must be placed after `verifyToken`. Returns `403` if `req.user.role` is not in the allowed list.

---

### Response envelope

All responses use a consistent shape:

```json
// Success
{ "success": true,  "message": "...", "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "code": "MACHINE_CODE" } }
```

HTTP status codes follow standard semantics: `200`/`201` success, `400` bad request, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `422` validation error, `429` rate limited.


---

## Product Management

All endpoints require `Authorization: Bearer <accessToken>`.

Role legend — **W** = `inventory_manager` + `admin` | **R** = all three roles including `warehouse_staff`.

---

### Categories

#### `POST /api/categories` — W

Create a category. Duplicate names at the same parent level are rejected.

**Body**
```json
{ "name": "Electronics", "parentCategory": null }
```

**Success `201`** — `{ category: { _id, name, parentCategory, createdAt, updatedAt } }`

| Error | Code | Reason |
|---|---|---|
| 409 | `CATEGORY_DUPLICATE` | Name already exists at this level |
| 404 | `PARENT_NOT_FOUND` | parentCategory id doesn't exist |

---

#### `GET /api/categories` — R

Returns all categories as a **nested tree**.

**Success `200`**
```json
{
  "categories": [
    { "_id": "...", "name": "Electronics", "children": [
        { "_id": "...", "name": "Phones", "children": [] }
    ]}
  ]
}
```

---

#### `PATCH /api/categories/:id` — W

Rename or reparent. Send only the fields you want to change.

**Body** *(at least one field required)*
```json
{ "name": "Consumer Electronics" }
```

| Error | Code | Reason |
|---|---|---|
| 404 | `NOT_FOUND` | Category not found |
| 409 | `CATEGORY_DUPLICATE` | New name already taken at target level |
| 400 | `INVALID_PARENT` | Category set as its own parent |

---

#### `DELETE /api/categories/:id` — W

Hard delete. Blocked if active products or child categories still reference it.

| Error | Code | Reason |
|---|---|---|
| 409 | `CATEGORY_IN_USE` | Active products reference this category |
| 409 | `CATEGORY_HAS_CHILDREN` | Sub-categories exist |

---

### Products

#### `POST /api/products` — W

Create a product. Provide `initialStock` to seed opening stock in the same transaction.

**Body**
```json
{
  "name": "USB-C Hub 7-port",
  "sku": "USB-HUB-7P",
  "barcode": "1234567890123",
  "category": "<categoryId>",
  "unitOfMeasure": "pcs",
  "description": "7-port USB-C hub with power delivery",
  "reorderRule": {
    "minQty": 10,
    "maxQty": 100,
    "reorderQty": 50,
    "preferredSupplier": "<supplierId>"
  },
  "initialStock": {
    "warehouse": "<warehouseId>",
    "location": "<locationId>",
    "quantity": 50
  }
}
```

Allowed `unitOfMeasure` values: `pcs`, `kg`, `g`, `l`, `ml`, `box`, `carton`, `pack`, `pair`, `roll`, `m`, `cm`

**Success `201`** — `{ product: { ... } }`

| Error | Code | Reason |
|---|---|---|
| 409 | `SKU_EXISTS` | SKU already taken (case-insensitive) |
| 404 | `CATEGORY_NOT_FOUND` | Category id doesn't exist |
| 404 | `NOT_FOUND` | Warehouse or Location not found |
| 400 | `LOCATION_WAREHOUSE_MISMATCH` | Location doesn't belong to given warehouse |

If `initialStock` is provided, one `StockQuantity` row and one `StockLedger` entry (`movementType: "adjustment"`, `docNumber: "INIT-<SKU>"`) are written atomically in the same transaction.

---

#### `GET /api/products` — R

Paginated product list. Each product includes `totalAvailable` and `totalOnHand` aggregated across all locations.

**Query params**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Partial match on name, sku, barcode |
| `category` | ObjectId | — | Filter by category |
| `isActive` | boolean | — | `true` / `false` |
| `page` | number | `1` | |
| `limit` | number | `20` | max 100 |
| `sortBy` | string | `createdAt` | `name` \| `sku` \| `createdAt` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |

**Success `200`**
```json
{
  "products": [ { "_id": "...", "name": "...", "totalAvailable": 47, "totalOnHand": 50, ... } ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

---

#### `GET /api/products/reorder-alerts` — R

Products whose total `quantityAvailable` (summed across all locations) is below `reorderRule.minQty`. Sorted by most urgent first.

**Success `200`**
```json
{
  "alerts": [
    {
      "_id": "...",
      "name": "USB-C Hub 7-port",
      "sku": "USB-HUB-7P",
      "totalAvailable": 3,
      "reorderRule": { "minQty": 10, "reorderQty": 50, "preferredSupplier": { "name": "...", ... } }
    }
  ],
  "total": 4
}
```

---

#### `GET /api/products/:id` — R

Single product with **per-location stock breakdown**.

**Success `200`**
```json
{
  "product": { "_id": "...", "name": "...", "category": { "name": "Electronics" }, ... },
  "stockByLocation": [
    {
      "location":          { "_id": "...", "name": "Rack A", "type": "storage" },
      "warehouse":         { "_id": "...", "name": "Main WH", "code": "WH01" },
      "quantityOnHand":    50,
      "quantityReserved":  3,
      "quantityAvailable": 47,
      "lastMovementAt":    "2026-09-26T10:00:00.000Z"
    }
  ]
}
```

---

#### `PATCH /api/products/:id` — W

Update product fields. **SKU is immutable** — sending `sku` in the body returns `400 SKU_IMMUTABLE`. Stock quantities cannot be changed here; use the Receipts / Deliveries / Transfers / Adjustments modules.

**Body** *(at least one field)*
```json
{
  "name": "USB-C Hub 7-port Pro",
  "reorderRule": { "minQty": 15, "maxQty": 150, "reorderQty": 75 }
}
```

---

#### `DELETE /api/products/:id` — W

**Soft deactivate** (sets `isActive: false`). Hard deletion is not supported.

Blocked if the product has any `quantityOnHand > 0` across any location — zero it out via a Stock Adjustment first.

| Error | Code | Reason |
|---|---|---|
| 409 | `STOCK_NOT_ZERO` | Physical stock still on hand |
| 400 | `ALREADY_INACTIVE` | Product is already inactive |


---

## Receipts (Incoming Stock)

All endpoints require `Authorization: Bearer <accessToken>`.

Role legend — **M** = `inventory_manager` + `admin` | **A** = all three roles.

### Status transitions

```
draft ──► waiting ──► ready ──► done
  │          │          │
  └──────────┴──────────┴──► canceled
```

| Transition | Trigger |
|---|---|
| `draft` → `waiting` | At least one line has `receivedQty > 0` |
| `waiting` → `ready` | Every line has `receivedQty >= expectedQty` |
| any → `done` | `POST /:id/validate` (managers only) |
| draft/waiting/ready → `canceled` | `POST /:id/cancel` |
| `done` → *(anything)* | **Blocked** — use a Stock Adjustment to reverse |

---

### `GET /api/receipts/pending-count` — A

Dashboard KPI — count of receipts with status `draft`, `waiting`, or `ready`.

**Success `200`** `{ count: 12 }`

---

### `GET /api/receipts` — A

Paginated list with optional filters.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `status` | string | `draft` \| `waiting` \| `ready` \| `done` \| `canceled` |
| `destinationWarehouse` | ObjectId | |
| `supplier` | ObjectId | |
| `dateFrom` | ISO date | |
| `dateTo` | ISO date | Must be ≥ `dateFrom` |
| `page` | number | default `1` |
| `limit` | number | default `20`, max `100` |

**Success `200`** `{ receipts: [...], total, page, limit }`

---

### `GET /api/receipts/:id` — A

Full receipt with all references populated (supplier, warehouse, product, location, createdBy, validatedBy).

**Success `200`** `{ receipt: { ... } }`

---

### `POST /api/receipts` — M

Create a new receipt in `draft` status.

**Body**
```json
{
  "supplier": "<supplierId>",
  "destinationWarehouse": "<warehouseId>",
  "scheduledDate": "2026-10-01",
  "lines": [
    { "product": "<productId>", "expectedQty": 100, "destinationLocation": "<locationId>" }
  ]
}
```
`lines` is optional at creation — they can be added later.

**Success `201`** `{ receipt: { receiptNumber: "RCV-00001", status: "draft", ... } }`

| Error | Code | Reason |
|---|---|---|
| 404 | `NOT_FOUND` | Supplier/Warehouse/Product/Location not found |
| 400 | `LOCATION_WAREHOUSE_MISMATCH` | Location doesn't belong to the given warehouse |
| 400 | `SUPPLIER_INACTIVE` / `WAREHOUSE_INACTIVE` / `PRODUCT_INACTIVE` | Referenced entity is inactive |

---

### `PATCH /api/receipts/:id` — M

Update header fields and/or replace the lines array. Only allowed while status is `draft` or `waiting`.

**Body** *(at least one field)*
```json
{
  "scheduledDate": "2026-10-05",
  "lines": [
    { "product": "<productId>", "expectedQty": 150, "destinationLocation": "<locationId>" }
  ]
}
```

| Error | Code | Reason |
|---|---|---|
| 409 | `RECEIPT_IMMUTABLE` | Receipt is `done` or `canceled` |

---

### `POST /api/receipts/:id/lines` — M

Add a single line to a draft/waiting receipt.

**Body**
```json
{ "product": "<productId>", "expectedQty": 50, "destinationLocation": "<locationId>" }
```

**Success `200`** — returns updated receipt.

---

### `DELETE /api/receipts/:id/lines/:lineId` — M

Remove a line from a draft/waiting receipt.

**Success `200`** — returns updated receipt.

---

### `PATCH /api/receipts/:id/lines/:lineId/receive` — A

Enter the physically received quantity for one line. Triggers automatic status transition.

**Body**
```json
{ "receivedQty": 95 }
```

Status auto-transitions:
- Any `receivedQty > 0` → `waiting`
- All lines `receivedQty >= expectedQty` → `ready`

**Success `200`** — returns updated receipt.

---

### `POST /api/receipts/:id/validate` — M

**The stock-increasing step.** Atomically:
1. `$inc` `quantityOnHand` + `quantityAvailable` in `StockQuantity` for every line
2. Inserts one `StockLedger` entry per line (`movementType: "receipt"`)
3. Sets receipt `status → done`, stamps `validatedAt` + `validatedBy`

All writes happen inside a single MongoDB transaction — if any step fails, the entire operation rolls back.

**Success `200`**
```json
{
  "receipt": { "status": "done", "validatedAt": "...", ... },
  "stockChanges": [
    { "product": "<id>", "location": "<id>", "qtyAdded": 95, "newBalance": 145 }
  ]
}
```

| Error | Code | Reason |
|---|---|---|
| 409 | `RECEIPT_IMMUTABLE` | Already `done` or `canceled` |
| 400 | `NO_QUANTITIES` | Every line still has `receivedQty === 0` |

---

### `POST /api/receipts/:id/cancel` — M

Cancel a draft/waiting/ready receipt. No stock changes (validation never ran).

| Error | Code | Reason |
|---|---|---|
| 409 | `RECEIPT_DONE` | Validated receipts cannot be canceled — use Stock Adjustment |
| 409 | `ALREADY_CANCELED` | Already canceled |


---

## Delivery Orders (Outgoing Stock)

All endpoints require `Authorization: Bearer <accessToken>`.

Role legend — **M** = `inventory_manager` + `admin` | **A** = all three roles.

### Status transitions

```
draft ──► waiting ──► ready ──► done
  │          │          │
  └──────────┴──────────┴──► canceled
```

| Transition | Trigger |
|---|---|
| `draft` → `waiting` | At least one line has `pickedQty > 0` |
| `waiting` → `ready` | Every line: `packedQty > 0` AND `packedQty === orderedQty` |
| any → `done` | `POST /:id/validate` (managers only) |
| draft/waiting/ready → `canceled` | `POST /:id/cancel` |
| `done` → *(anything)* | **Blocked** — use a Stock Adjustment to correct |

### Availability checks

| Step | Check | Error |
|---|---|---|
| **Pick** | `pickedQty ≤ StockQuantity.quantityAvailable` at that product+location | `409 INSUFFICIENT_STOCK` |
| **Validate (pre-flight)** | ALL lines re-verified before any write — reports every shortfall at once | `409 INSUFFICIENT_STOCK` |

---

### `GET /api/delivery-orders/pending-count` — A

**Success `200`** `{ count: 5 }`

---

### `GET /api/delivery-orders` — A

**Query params:** `status`, `sourceWarehouse`, `dateFrom`, `dateTo`, `page` (default 1), `limit` (default 20).

**Success `200`** `{ orders: [...], total, page, limit }`

---

### `GET /api/delivery-orders/:id` — A

Full order with warehouse, product, and location populated per line.

---

### `POST /api/delivery-orders` — M

**Body**
```json
{
  "customer": { "name": "Acme Corp", "address": "123 Main St", "contact": "+1-555-0100" },
  "sourceWarehouse": "<warehouseId>",
  "scheduledDate": "2026-10-15",
  "lines": [
    { "product": "<productId>", "orderedQty": 10, "sourceLocation": "<locationId>" }
  ]
}
```

**Success `201`** `{ order: { deliveryNumber: "DEL-00001", status: "draft", ... } }`

---

### `PATCH /api/delivery-orders/:id` — M

Update customer, sourceWarehouse, scheduledDate, or replace lines. Draft/waiting only.

---

### `POST /api/delivery-orders/:id/lines` — M

Add a line. Draft/waiting only. Body: `{ product, orderedQty, sourceLocation }`.

---

### `DELETE /api/delivery-orders/:id/lines/:lineId` — M

Remove a line. Draft/waiting only.

---

### `PATCH /api/delivery-orders/:id/lines/:lineId/pick` — A

Warehouse staff record picked quantity.

**Body** `{ "pickedQty": 8 }`

Checks: `pickedQty ≤ orderedQty` AND `pickedQty ≤ quantityAvailable` at the source location.

| Error | Code | Reason |
|---|---|---|
| 400 | `PICK_EXCEEDS_ORDER` | pickedQty > orderedQty |
| 409 | `INSUFFICIENT_STOCK` | Not enough available stock |

---

### `PATCH /api/delivery-orders/:id/lines/:lineId/pack` — A

**Body** `{ "packedQty": 8 }`

Checks: `packedQty ≤ pickedQty`.

| Error | Code | Reason |
|---|---|---|
| 400 | `PACK_EXCEEDS_PICKED` | packedQty > pickedQty |

---

### `POST /api/delivery-orders/:id/validate` — M

**Stock-decreasing step.** Before any write, re-verifies availability for all lines and reports all shortfalls in one response. Inside a single transaction: `$inc quantityOnHand` and `quantityAvailable` by `-packedQty` + inserts one `StockLedger` entry per line (`movementType: "delivery"`).

**Success `200`**
```json
{
  "order": { "status": "done", "validatedAt": "...", ... },
  "stockChanges": [
    { "product": "<id>", "location": "<id>", "qtyRemoved": 8, "newBalance": 42 }
  ]
}
```

---

### `POST /api/delivery-orders/:id/cancel` — M

Cancels draft/waiting/ready orders. No stock changes.

| Error | Code | Reason |
|---|---|---|
| 409 | `ORDER_DONE` | Cannot cancel a validated order |

---

## Running the server

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.example .env   # then edit .env

# 3. Start
npm start              # node src/server.js

# 4. Health check
curl http://localhost:5000/health
```

The server connects to MongoDB first (with retry), then starts the HTTP listener. Graceful shutdown on `SIGTERM`/`SIGINT` closes the DB connection before exiting.

### All mounted routes

| Prefix | Module |
|---|---|
| `GET /health` | Health check (no auth) |
| `/api/auth` | Authentication |
| `/api/categories` | Category management |
| `/api/products` | Product management |
| `/api/receipts` | Receipts (incoming stock) |
| `/api/delivery-orders` | Delivery orders (outgoing stock) |
| `/api/warehouses` | Warehouse management |
| `/api/locations` | Location management |
| `/api/suppliers` | Supplier management |
| `/api/transfers` | Internal transfers *(stub — coming soon)* |
| `/api/adjustments` | Stock adjustments *(stub — coming soon)* |
| `/api/notifications` | Notifications |
| `/api/dashboard` | Dashboard KPIs |


---

## Internal Transfers

All endpoints require `Authorization: Bearer <accessToken>`.

Role legend — **ALL** = all three roles | **A** = all three roles (same here).

> **⚠️ Role policy note (intentional design decision):**
> Unlike Receipts (vendor boundary) and Deliveries (customer fulfilment), internal transfers
> are pure warehouse operations. `warehouse_staff` can create, edit, confirm, **and validate**
> transfers. This is explicit policy — not an oversight — because "perform transfers" is the
> primary job of warehouse staff per the spec.

### Status transitions

```
draft ──► waiting ──► ready ──► done
  │           │          │
  └───────────┴──────────┴──► canceled
```

| Transition | Trigger |
|---|---|
| `draft` → `waiting` | At least one line confirmed |
| `waiting` → `ready` | Every line confirmed |
| any → `done` | `POST /:id/validate` |
| draft/waiting/ready → `canceled` | `POST /:id/cancel` |
| `done` → *(anything)* | **Blocked** — use a Stock Adjustment |

### Double-entry ledger (key difference from Receipts/Deliveries)

Every validated line writes **two** `StockLedger` entries and touches **two** `StockQuantity` rows:

| Entry | `movementType` | `quantityChange` | Location |
|---|---|---|---|
| Source | `transfer_out` | `-quantity` | sourceLocation |
| Destination | `transfer_in` | `+quantity` | destinationLocation |

**Total company-wide stock is unchanged.** The `stockChanges` array in the validation response includes `netStockChange: 0` for each line to make this explicit.

---

### `GET /api/internal-transfers/scheduled-count` — ALL

Dashboard KPI — count of transfers with status `draft`, `waiting`, or `ready`.

**Success `200`** `{ count: 3 }`

---

### `GET /api/internal-transfers` — ALL

**Query params**

| Param | Type | Notes |
|---|---|---|
| `status` | string | `draft` \| `waiting` \| `ready` \| `done` \| `canceled` |
| `warehouse` | ObjectId | Matches lines where source **or** destination warehouse equals this |
| `dateFrom` | ISO date | |
| `dateTo` | ISO date | Must be ≥ `dateFrom` |
| `page` | number | default `1` |
| `limit` | number | default `20`, max `100` |

**Success `200`** `{ transfers: [...], total, page, limit }`

---

### `GET /api/internal-transfers/:id` — ALL

Full transfer with all four location/warehouse refs populated per line.

---

### `POST /api/internal-transfers` — ALL

Create a new transfer in `draft` status. Lines are optional at creation.

**Body**
```json
{
  "scheduledDate": "2026-10-10",
  "lines": [
    {
      "product":              "<productId>",
      "quantity":             50,
      "sourceWarehouse":      "<warehouseId>",
      "sourceLocation":       "<locationId>",
      "destinationWarehouse": "<warehouseId>",
      "destinationLocation":  "<locationId>"
    }
  ]
}
```

**Success `201`** `{ transfer: { transferNumber: "TRF-00001", status: "draft", ... } }`

| Error | Code | Reason |
|---|---|---|
| 404 | `NOT_FOUND` | Product/Warehouse/Location not found |
| 400 | `LOCATION_WAREHOUSE_MISMATCH` | Location doesn't belong to the stated warehouse |
| 400 | `SAME_LOCATION` | sourceLocation === destinationLocation |
| 400 | `PRODUCT_INACTIVE` / `WAREHOUSE_INACTIVE` / `LOCATION_INACTIVE` | Inactive reference |

---

### `PATCH /api/internal-transfers/:id` — ALL

Replace `scheduledDate` or the full `lines` array. Draft/waiting only. Resets all `confirmed` flags when lines are replaced.

---

### `POST /api/internal-transfers/:id/lines` — ALL

Add a single line. Subject to the same per-line validation as creation.

---

### `DELETE /api/internal-transfers/:id/lines/:lineId` — ALL

Remove a line. Draft/waiting only.

---

### `PATCH /api/internal-transfers/:id/lines/:lineId/confirm` — ALL

Check physical availability at the source location **without committing stock**. Sets `line.confirmed = true`.

**Availability check:** `quantity ≤ StockQuantity.quantityAvailable` at `{ product, sourceLocation }`.

| Error | Code | Reason |
|---|---|---|
| 409 | `INSUFFICIENT_STOCK` | Not enough available — shows product, location, requested vs available |

When all lines are confirmed, status auto-transitions to `ready`.

---

### `POST /api/internal-transfers/:id/validate` — ALL

**Stock relocation step.** Before any write, re-verifies availability for **all** lines and reports every shortfall at once. Inside a single transaction, for each line:

1. Decrements source `StockQuantity` (`quantityOnHand` & `quantityAvailable` by `-quantity`)
2. Inserts `StockLedger` entry: `movementType: "transfer_out"`, `quantityChange: -quantity`
3. Upserts destination `StockQuantity` (creates row from 0 if none exists) by `+quantity`
4. Inserts `StockLedger` entry: `movementType: "transfer_in"`, `quantityChange: +quantity`

**Success `200`**
```json
{
  "transfer": { "status": "done", "validatedAt": "...", ... },
  "stockChanges": [
    {
      "product":          "<id>",
      "sourceLocation":   "<id>",
      "destLocation":     "<id>",
      "quantity":         50,
      "newSourceBalance": 10,
      "newDestBalance":   50,
      "netStockChange":   0
    }
  ]
}
```

| Error | Code | Reason |
|---|---|---|
| 409 | `TRANSFER_IMMUTABLE` | Already `done` or `canceled` |
| 400 | `NO_LINES` | Transfer has no lines |
| 409 | `INSUFFICIENT_STOCK` | Source stock insufficient for one or more lines |

---

### `POST /api/internal-transfers/:id/cancel` — ALL

Cancel a draft/waiting/ready transfer. No stock changes.

| Error | Code | Reason |
|---|---|---|
| 409 | `TRANSFER_DONE` | Validated transfers cannot be canceled |
| 409 | `ALREADY_CANCELED` | Already canceled |


---

## Stock Adjustments

All endpoints require `Authorization: Bearer <accessToken>`.

Role legend — **A** = all three roles | **M** = `inventory_manager` + `admin`.

> **⚠️ Key difference from the other three Operations modules:**
> Stock adjustments use `$set quantityOnHand = countedQty` — an **absolute correction** — not `$inc`.
> The physical count IS the new ground truth. The system computes `difference = countedQty - systemQty`
> server-side; clients never send `difference` directly.

> **Reservation warning:** If `quantityReserved` exceeds the new `countedQty` after validation,
> `quantityAvailable` is clamped to `0` and a warning is returned. This means an open delivery order
> may no longer be fully fulfillable — a manager should review affected delivery orders.

### Status transitions

```
draft ──► done
  │
  └──► canceled
```

There is no `waiting` or `ready` state — adjustments have no pick/pack sub-steps.
A `done` adjustment **cannot be canceled** — create a new corrective adjustment to reverse it.

| Transition | Trigger |
|---|---|
| `draft` → `done` | `POST /:id/validate` (managers only) |
| `draft` → `canceled` | `POST /:id/cancel` (managers only) |

### Valid reasons

`damaged` · `miscount` · `theft` · `expired` · `found` · `other`

---

### `GET /api/stock-adjustments` — A

**Query params**

| Param | Type | Notes |
|---|---|---|
| `status` | string | `draft` \| `done` \| `canceled` |
| `warehouse` | ObjectId | Filter by warehouse |
| `reason` | string | Filter by reason on any line |
| `dateFrom` | ISO date | |
| `dateTo` | ISO date | Must be ≥ `dateFrom` |
| `page` | number | default `1` |
| `limit` | number | default `20`, max `100` |

**Success `200`** `{ adjustments: [...], total, page, limit }`

---

### `GET /api/stock-adjustments/:id` — A

Full adjustment with product + location populated per line. Returns `systemQty`, `countedQty`, `difference`, and `reason` for each line.

---

### `POST /api/stock-adjustments` — A

Create a draft adjustment. Lines are optional — they can be added later.

**Body**
```json
{
  "warehouse": "<warehouseId>",
  "lines": [
    { "product": "<productId>", "location": "<locationId>", "countedQty": 47, "reason": "miscount" }
  ]
}
```

`countedQty` is optional at creation. If omitted, the line is created with `countedQty: null` and must be filled in via the `/count` endpoint before validation.

`systemQty` is **snapshotted from the live `StockQuantity`** at the moment each line is added — clients never provide it.

**Success `201`** `{ adjustment: { adjustmentNumber: "ADJ-00001", status: "draft", ... } }`

| Error | Code | Reason |
|---|---|---|
| 404 | `NOT_FOUND` | Warehouse/Product/Location not found |
| 400 | `LOCATION_WAREHOUSE_MISMATCH` | Location doesn't belong to the stated warehouse |

---

### `POST /api/stock-adjustments/:id/lines` — A

Add a single line to a draft. Snapshots `systemQty` live at the time of addition.

**Body** `{ "product": "<productId>", "location": "<locationId>", "countedQty?": 12, "reason?": "found" }`

---

### `DELETE /api/stock-adjustments/:id/lines/:lineId` — A

Remove a line. Draft only.

---

### `PATCH /api/stock-adjustments/:id/lines/:lineId/count` — A

**"Enter counted quantity"** — the core step per the spec.

1. Re-fetches live `StockQuantity.quantityOnHand` to refresh `systemQty` (guards against stock changes since the line was added)
2. Stores `countedQty` and computes `difference = countedQty - liveSystemQty` server-side

**Body**
```json
{ "countedQty": 44, "reason": "damaged" }
```

`countedQty: 0` is **valid** — it means "the shelf is empty".

**Success `200`** — returns updated adjustment.

---

### `POST /api/stock-adjustments/:id/validate` — M

**"System auto-updates and logs the adjustment"** — the commit step.

Inside a single transaction, for each line:
1. Final race-condition check: re-reads live `StockQuantity` one last time and recomputes `difference` against the truly current value (discards stale snapshots)
2. `$set StockQuantity.quantityOnHand = countedQty` (absolute, not relative)
3. `$set StockQuantity.quantityAvailable = max(0, countedQty - quantityReserved)`
4. Inserts `StockLedger` entry: `movementType: "adjustment"`, `quantityChange: difference` (signed), `balanceAfter: countedQty`

Lines where `difference === 0` after the final check still update `StockQuantity` (confirms the count is correct) but **skip the ledger entry** — no movement occurred.

**Success `200`**
```json
{
  "adjustment": { "status": "done", "validatedAt": "...", ... },
  "summary": [
    {
      "product":      "<id>",
      "location":     "<id>",
      "systemQty":    47,
      "countedQty":   44,
      "difference":   -3,
      "reason":       "damaged",
      "ledgerWritten": true
    }
  ],
  "warnings": [
    {
      "product":  "<id>",
      "location": "<id>",
      "message":  "quantityReserved (10) exceeds new countedQty (3). quantityAvailable clamped to 0. Review open delivery orders for this product."
    }
  ]
}
```

| Error | Code | Reason |
|---|---|---|
| 409 | `ADJUSTMENT_IMMUTABLE` | Already `done` or `canceled` |
| 400 | `NO_LINES` | No lines on the adjustment |
| 400 | `UNCOUNTED_LINES` | One or more lines have no `countedQty` yet |

---

### `POST /api/stock-adjustments/:id/cancel` — M

Cancel a draft adjustment. No stock changes.

| Error | Code | Reason |
|---|---|---|
| 409 | `ADJUSTMENT_DONE` | Already validated — create a new adjustment to reverse |
| 409 | `ALREADY_CANCELED` | Already canceled |

---

## Operations Modules Summary

| Module | Counter prefix | Stock operation | Ledger entries/line | Validation role |
|---|---|---|---|---|
| Receipts | `RCV` | `$inc +receivedQty` | 1 (`receipt`) | manager/admin |
| Delivery Orders | `DEL` | `$inc -packedQty` | 1 (`delivery`) | manager/admin |
| Internal Transfers | `TRF` | `$inc ±quantity` (both locations) | 2 (`transfer_out` + `transfer_in`) | all roles |
| Stock Adjustments | `ADJ` | `$set countedQty` (absolute) | 1 (`adjustment`, skipped if diff=0) | manager/admin |


---

## Multi-Warehouse Gap Fixes

### GAP 1 — Dashboard per-warehouse breakdown

#### `GET /api/dashboard/summary` (updated)

Now accepts an optional `?warehouse=<warehouseId>` query param.

| Behaviour | When |
|---|---|
| Global KPIs (original, unchanged) | `?warehouse=` omitted |
| Warehouse-scoped KPIs | `?warehouse=<id>` provided |

**Query params**

| Param | Type | Notes |
|---|---|---|
| `warehouse` | ObjectId | Optional. Must be an active warehouse — 404 if not found, 400 if inactive |

**Global response (no warehouse param) — backward-compatible:**
```json
{
  "scope": "global",
  "pendingReceipts": 5,
  "pendingDeliveries": 3,
  "pendingTransfers": 2,
  "totalProducts": 120,
  "lowStockCount": 4
}
```

**Warehouse-scoped response:**
```json
{
  "scope": "warehouse:64abc...",
  "pendingReceipts": 2,
  "pendingDeliveries": 1,
  "pendingTransfers": 1,
  "productsInStock": 47,
  "lowStockCount": 2
}
```

Note: global returns `totalProducts` (active products regardless of stock); warehouse-scoped returns `productsInStock` (distinct products with `quantityOnHand > 0` at that warehouse).

---

#### `GET /api/dashboard/summary/by-warehouse` (new)

Returns one KPI object per active warehouse in a **single aggregation pass** (not N+1 queries). Powers a "compare warehouses" view.

**No query params required.**

**Success `200`**
```json
{
  "warehouses": [
    {
      "warehouse": { "_id": "...", "name": "Main Warehouse", "code": "WH01" },
      "pendingReceipts":   3,
      "pendingDeliveries": 1,
      "pendingTransfers":  2,
      "productsInStock":   58,
      "lowStockCount":     3
    },
    {
      "warehouse": { "_id": "...", "name": "Production Floor", "code": "WH02" },
      "pendingReceipts":   0,
      "pendingDeliveries": 2,
      "pendingTransfers":  2,
      "productsInStock":   12,
      "lowStockCount":     1
    }
  ]
}
```

All counts default to `0` for warehouses with no matching documents.

---

### GAP 2 — StockLedger warehouse index + listing endpoint

#### Index added

`{ warehouse: 1, timestamp: -1 }` added to `StockLedger` schema. Created automatically by Mongoose on startup. Used by all `?warehouse=` queries on the new listing endpoint.

#### `GET /api/stock-ledger` (new)

Read-only movement history. Sorted by `timestamp` descending (newest first). All query params are optional and combinable.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `warehouse` | ObjectId | Uses `{ warehouse: 1, timestamp: -1 }` index |
| `product` | ObjectId | |
| `location` | ObjectId | Combined with `product`, uses `{ product, location, timestamp }` index |
| `movementType` | string | `receipt` \| `delivery` \| `transfer_in` \| `transfer_out` \| `adjustment` |
| `dateFrom` | ISO date | |
| `dateTo` | ISO date | Must be ≥ `dateFrom` |
| `page` | number | default `1` |
| `limit` | number | default `50`, max `200` |

**Success `200`**
```json
{
  "entries": [
    {
      "_id": "...",
      "product":      { "name": "Steel Rod", "sku": "STL-ROD-001" },
      "warehouse":    { "name": "Main Warehouse", "code": "WH01" },
      "location":     { "name": "Rack A", "type": "storage" },
      "movementType": "receipt",
      "quantityChange": 50,
      "balanceAfter":   150,
      "reference":    { "docType": "Receipt", "docNumber": "RCV-00001" },
      "performedBy":  { "name": "Ahmed Youssef", "email": "..." },
      "timestamp":    "2026-09-26T10:00:00.000Z"
    }
  ],
  "total": 342,
  "page": 1,
  "limit": 50
}
```

#### `GET /api/stock-ledger/:id` (new)

Single ledger entry by ID, fully populated.

---

### GAP 3 — Location type filtering

#### `GET /api/locations` (updated)

Now accepts both `?warehouse=` and `?type=` — combinable.

| Param | Type | Notes |
|---|---|---|
| `warehouse` | ObjectId | Filter by warehouse (existing) |
| `type` | string | **New.** One of: `storage`, `receiving`, `shipping`, `production`, `staging` |

Both params are optional. When both are provided, only locations matching both are returned.

**Examples**

```
GET /api/locations?type=receiving
→ All receiving locations across all warehouses

GET /api/locations?warehouse=<id>&type=storage
→ Storage locations in Warehouse X only

GET /api/locations?warehouse=<id>
→ All locations in Warehouse X (original behaviour, unchanged)
```

Invalid `type` values return `400 VALIDATION_ERROR` with a message listing the valid options.


---

## Category Filtering on Operations Listing Endpoints

All four operations listing endpoints now accept an optional `?category=<categoryId>` query param that is fully combinable with the existing `status`, `warehouse`, and date filters.

**Matching rule:** a document matches if **any** of its lines' products belongs to the given category **or any of its descendant categories** (sub-categories resolved recursively at query time). Top-level category → all sub-categories are included automatically.

Returns `404 NOT_FOUND` if the given category id does not exist.

### Updated endpoints

#### `GET /api/receipts`

| Param | Type | Notes |
|---|---|---|
| `status` | string | existing |
| `destinationWarehouse` | ObjectId | existing |
| `supplier` | ObjectId | existing |
| **`category`** | ObjectId | **new** — matches any line's product category (+ descendants) |
| `dateFrom` / `dateTo` | ISO date | existing |
| `page` / `limit` | number | existing |

#### `GET /api/delivery-orders`

| Param | Type | Notes |
|---|---|---|
| `status` | string | existing |
| `sourceWarehouse` | ObjectId | existing |
| **`category`** | ObjectId | **new** |
| `dateFrom` / `dateTo` | ISO date | existing |
| `page` / `limit` | number | existing |

#### `GET /api/internal-transfers`

| Param | Type | Notes |
|---|---|---|
| `status` | string | existing |
| `warehouse` | ObjectId | existing (source OR destination) |
| **`category`** | ObjectId | **new** |
| `dateFrom` / `dateTo` | ISO date | existing |
| `page` / `limit` | number | existing |

#### `GET /api/stock-adjustments`

| Param | Type | Notes |
|---|---|---|
| `status` | string | existing |
| `warehouse` | ObjectId | existing |
| **`category`** | ObjectId | **new** |
| `reason` | string | existing |
| `dateFrom` / `dateTo` | ISO date | existing |
| `page` / `limit` | number | existing |

---

## Operations Feed

### `GET /api/operations`

A single combined, paginated list across all four document types — Receipts, Delivery Orders, Internal Transfers, and Stock Adjustments. Implements the dashboard "by document type" dynamic filter from the spec.

Accessible to all three roles (`inventory_manager`, `admin`, `warehouse_staff`).

**Implementation:** uses MongoDB `$unionWith` to merge all four collections server-side in a single aggregation. Sort and pagination are applied after the union — no in-memory merging, no N+1 queries.

**Query params**

| Param | Type | Default | Notes |
|---|---|---|---|
| `documentType` | string or array | all four | One or more of: `receipt`, `delivery`, `transfer`, `adjustment`. Pass multiple as repeated params or comma-separated. |
| `status` | string | — | `draft` \| `waiting` \| `ready` \| `done` \| `canceled` — applied across all included types |
| `warehouse` | ObjectId | — | Receipts → `destinationWarehouse`; deliveries → `sourceWarehouse`; adjustments → `warehouse`; transfers → source OR destination on any line |
| `category` | ObjectId | — | Same product-category-via-lines matching as individual endpoints (+ descendants) |
| `dateFrom` / `dateTo` | ISO date | — | |
| `sortBy` | string | `createdAt` | `createdAt` \| `scheduledDate` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |
| `page` | number | `1` | |
| `limit` | number | `20` | max `100` |

**Success `200`**
```json
{
  "operations": [
    {
      "documentType":    "receipt",
      "documentId":      "<ObjectId>",
      "documentNumber":  "RCV-00042",
      "status":          "done",
      "warehouseSummary":"Main Warehouse",
      "lineCount":       3,
      "createdAt":       "2026-09-26T08:00:00.000Z",
      "scheduledDate":   "2026-09-28T00:00:00.000Z",
      "validatedAt":     "2026-09-26T10:30:00.000Z"
    },
    {
      "documentType":    "delivery",
      "documentId":      "<ObjectId>",
      "documentNumber":  "DEL-00017",
      "status":          "ready",
      "warehouseSummary":"Production Floor",
      "lineCount":       1,
      "createdAt":       "2026-09-25T14:00:00.000Z",
      "scheduledDate":   null,
      "validatedAt":     null
    },
    {
      "documentType":    "transfer",
      "documentId":      "<ObjectId>",
      "documentNumber":  "TRF-00008",
      "status":          "draft",
      "warehouseSummary":"Transfer",
      "lineCount":       2,
      "createdAt":       "2026-09-25T09:00:00.000Z",
      "scheduledDate":   null,
      "validatedAt":     null
    }
  ],
  "total": 157,
  "page": 1,
  "limit": 20
}
```

**Notes:**
- `warehouseSummary` is the warehouse name for receipts, deliveries, and adjustments. For transfers it is the literal string `"Transfer"` since each line has its own source/destination — use `GET /api/internal-transfers/:id` to get the full per-line breakdown.
- Excluded document types are not queried at all (not included-then-filtered), so `?documentType=receipt` only queries the receipts collection.
- `total` reflects the cross-type count matching all applied filters.
