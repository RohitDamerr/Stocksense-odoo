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
