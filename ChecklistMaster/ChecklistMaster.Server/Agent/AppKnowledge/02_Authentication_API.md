# ChecklistMaster — Authentication API

**Base Route:** `/api/auth`

All authentication responses are JSON. Session state is maintained via the HttpOnly cookie `cm_auth` (JWT). The SPA reads session state from `GET /api/auth/me` on every page refresh.

---

## Common Response Types

### AuthResponse
```json
{
  "success": true,
  "message": "Login successful.",
  "user": {
    "uId": "A3F7C9D201",
    "userId": "john.doe@stellantis.com",
    "userName": "John Doe",
    "emailId": "john.doe@stellantis.com",
    "role": "AVP_User",
    "status": "Active"
  },
  "expiresInSeconds": 28800
}
```

### AuthUserDto Fields
| Field | Type | Description |
|---|---|---|
| `uId` | string | Database primary key (10-char uppercase hex) |
| `userId` | string | Login username (usually email) |
| `userName` | string | Display name |
| `emailId` | string | Email address |
| `role` | string | One of: Admin, AVP_Admin, WGDE_Admin, AVP_User, WGDE_User, Viewer |
| `status` | string | Active / Inactive / disabled |

---

## POST /api/auth/login

**Authentication required:** No  
**Purpose:** Validate credentials, issue JWT session cookie.

### Request Body
```json
{
  "username": "john.doe@stellantis.com",
  "password": "YourPassword123"
}
```

| Field | Required | Description |
|---|---|---|
| `username` | Yes | User login ID or email address |
| `password` | Yes | Plain-text password (never stored; validated against hash) |

### Business Logic (Step-by-Step)
1. Validates that both `username` and `password` are non-empty.
2. Checks `AzureAd:Enabled` config flag:
   - If `true`: calls `AuthService.ValidateAzureAdAsync()` — validates PBKDF2 password locally AND queries Microsoft Graph to confirm user exists in Entra ID.
   - If `false`: calls `AuthService.ValidateLocalAsync()` — validates PBKDF2 password only.
3. Looks up the user in the `Users` table by UserId or EmailId.
4. Checks user `Status`:
   - `"inactive"` → `401 Unauthorized` with message "Your account is inactive."
   - `"disabled"` → `401 Unauthorized` with same message.
5. Calls `UpdateLastLoginAsync()` — sets `Users.Lastlogin = DateTime.UtcNow`.
6. Generates a signed JWT with claims: sub (UId), email, name, userId, role, status, exp.
7. Appends `cm_auth` HttpOnly secure cookie.
8. Returns `200 OK` with AuthResponse including `expiresInSeconds`.

### Responses
| Status | Condition |
|---|---|
| `200 OK` | Login successful — `cm_auth` cookie set |
| `400 Bad Request` | Username or password is empty |
| `401 Unauthorized` | Invalid credentials, user not in DB, or account inactive |

### Success Response
```json
{
  "success": true,
  "message": "Login successful.",
  "user": { "uId": "...", "userId": "...", "userName": "...", "emailId": "...", "role": "AVP_User", "status": "Active" },
  "expiresInSeconds": 28800
}
```

### Failure Response
```json
{
  "success": false,
  "message": "Your account is inactive. Contact your administrator.",
  "user": null,
  "expiresInSeconds": null
}
```

---

## POST /api/auth/logout

**Authentication required:** No  
**Purpose:** End the session by deleting the `cm_auth` cookie.

### Business Logic
1. Deletes the `cm_auth` cookie (HttpOnly, Secure, SameSite=Lax, Path=/).
2. No database changes are made.
3. Always succeeds regardless of whether the cookie existed.

### Response
```json
{ "message": "Logged out successfully." }
```

---

## GET /api/auth/me

**Authentication required:** Yes (`[Authorize]` — valid `cm_auth` cookie required)  
**Purpose:** Restore React session context on SPA page refresh.

### Business Logic
1. Reads claims from the validated JWT in `cm_auth` cookie.
2. Computes `expiresInSeconds` from the JWT `exp` claim minus current UTC time.
3. Returns `0` for `expiresInSeconds` if the token is already expired (middleware would block before this, but included as a safeguard).

### Response — 200 OK
```json
{
  "success": true,
  "message": null,
  "user": {
    "uId": "A3F7C9D201",
    "userId": "john.doe@stellantis.com",
    "userName": "John Doe",
    "emailId": "john.doe@stellantis.com",
    "role": "AVP_User",
    "status": "Active"
  },
  "expiresInSeconds": 14400
}
```

### Response — 401 Unauthorized
Returned when no valid `cm_auth` cookie is present or the JWT is expired/invalid.

---

## POST /api/auth/validate-email

**Authentication required:** No  
**Purpose:** Real-time email domain check on the registration form. Checks if the email belongs to an allowed organisation domain.

### Request Body
```json
{ "email": "john.doe@stellantis.com" }
```

### Business Logic
1. If `Registration:EnableEmailValidation` is `false` in config → always returns `valid: true`.
2. Extracts the domain portion of the email (after `@`).
3. Compares (case-insensitive) against the `Registration:AllowedEmailDomains` list in config.
4. If `AllowedEmailDomains` list is empty → all domains are accepted.

### Responses
```json
{ "valid": true, "message": "Email is from a recognized organisation domain." }
```
```json
{ "valid": false, "message": "This email is not from a recognized organisation domain. Please use your company email address." }
```

---

## POST /api/auth/register

**Authentication required:** No  
**Purpose:** Self-service user registration. Creates account in `Inactive` state; admin must approve before the user can log in.

### Request Body
```json
{
  "userId": "john.doe@stellantis.com",
  "userName": "John Doe",
  "emailId": "john.doe@stellantis.com",
  "role": "AVP_User"
}
```

| Field | Required | Validation |
|---|---|---|
| `userId` | Yes | Unique login username |
| `userName` | Yes | Display name |
| `emailId` | Yes | Must pass email domain check if `EnableEmailValidation=true` |
| `role` | No | Allowed self-select values: `AVP_User`, `WGDE_User`, `Viewer`. Any other value defaults to `Viewer`. Admin roles cannot be self-assigned. |

### Business Logic (Step-by-Step)
1. Validates all required fields are non-empty.
2. If `Registration:EnableEmailValidation=true`: checks email domain against allowed list; rejects if not in list.
3. Queries DB for duplicate `UserId` (case-sensitive exact match after trim). Returns `409 Conflict` if found.
4. Queries DB for duplicate `EmailId` (exact match after trim). Returns `409 Conflict` if found.
5. Sets `Role` to the requested role if it is `AVP_User`, `WGDE_User`, or `Viewer`; otherwise defaults to `Viewer`.
6. Sets `Status = "Inactive"`.
7. Hashes default password: `PasswordHasher.Hash("Pass@May2026")`.
8. Sets `UId = Guid.NewGuid().ToString("N")[..10].ToUpper()` — 10-char uppercase hex.
9. Sets `CreatedDate = DateTime.UtcNow`.
10. Saves user to DB.
11. Returns `201 Created` with user DTO and message about pending approval.

> **Important:** The default password `Pass@May2026` is set at registration time. Once the admin approves the account, the user logs in with this password and should change it immediately via `PATCH /api/users/{id}/change-password`.

### Responses
| Status | Condition |
|---|---|
| `201 Created` | Registration successful, account pending approval |
| `400 Bad Request` | Missing required fields or email domain not allowed |
| `409 Conflict` | UserId or EmailId already exists |

---

## POST /api/auth/bootstrap

**Authentication required:** No  
**Purpose:** Create the very first Admin user when the `Users` table is completely empty. This endpoint automatically becomes unavailable once any user exists.

### Request Body
```json
{
  "userId": "admin@company.com",
  "userName": "System Administrator",
  "emailId": "admin@company.com",
  "role": "Admin"
}
```

### Business Logic
1. Checks if `Users` table has any records. If yes, returns `409 Conflict`.
2. Validates `userId` and `userName` are non-empty.
3. Creates user with:
   - `Status = "Active"` (immediately active, no approval required)
   - `Role` = requested role if valid (`Admin`, `AVP_Admin`, `WGDE_Admin`, `AVP_User`, `WGDE_User`, `Viewer`), else defaults to `"Admin"`
   - **No password is set** (password field is null/empty — admin must set it separately)
4. Returns `201 Created`.

> **Security note:** This endpoint must only be called once during initial system setup. After the first user exists, all calls return 409.

### Responses
| Status | Condition |
|---|---|
| `201 Created` | First admin user created |
| `400 Bad Request` | UserId or UserName missing |
| `409 Conflict` | Users already exist in the system |

---

## GET /api/auth/microsoft/login

**Authentication required:** No  
**Purpose:** Initiate Microsoft OAuth2 Authorization Code flow.

### Business Logic
1. Generates a random CSRF `state` token and stores it in a secure HttpOnly cookie `oauth_state` (expires 10 minutes).
2. Builds the Microsoft authorization URL with `openid profile email` scopes and `prompt=select_account`.
3. Redirects the browser to `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize`.

### Response
`302 Redirect` to Microsoft login page.

---

## GET /api/auth/microsoft/callback

**Authentication required:** No  
**Purpose:** Handle Microsoft OAuth2 callback after user authenticates.

### Query Parameters
| Param | Description |
|---|---|
| `code` | Authorization code from Microsoft |
| `state` | CSRF state token (must match `oauth_state` cookie) |
| `error` | Error code from Microsoft (if auth failed) |
| `error_description` | Human-readable error description |

### Business Logic (Step-by-Step)
1. If `error` param present → redirect to frontend `/?ms_error=auth_failed`.
2. If `code` missing → redirect to `/?ms_error=no_code`.
3. Validates `state` matches `oauth_state` cookie (CSRF protection). Mismatch → redirect `/?ms_error=auth_failed`.
4. Exchanges `code` for tokens via POST to `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`.
5. Extracts `id_token` from response, parses JWT claims (without re-validating signature — Microsoft's CSRF state ensures integrity).
6. Extracts `email` (from `email` claim) or `preferred_username` claim, and `name` claim.
7. Looks up user in DB by `EmailId` or `UserId`.
8. **If user not found:** Auto-registers as `Inactive` Viewer with default password, then redirects to `/?ms_error=pending_approval`.
9. **If user Status ≠ "Active":** Redirects to `/?ms_error=account_inactive`.
10. **If user Active:** Updates `Lastlogin`, generates JWT, sets `cm_auth` cookie, redirects to `/dashboard`.

### Redirect Targets
| Outcome | Redirect |
|---|---|
| Auth failed | `{FrontendUrl}/?ms_error=auth_failed` |
| No auth code | `{FrontendUrl}/?ms_error=no_code` |
| New user (auto-registered) | `{FrontendUrl}/?ms_error=pending_approval` |
| Account inactive | `{FrontendUrl}/?ms_error=account_inactive` |
| Login success | `{FrontendUrl}/dashboard` |

---

## GET /api/auth/microsoft/admin-consent

**Authentication required:** No  
**Purpose:** One-time Azure AD admin consent to grant organisation-wide application permissions.

### Business Logic
Redirects an Azure AD admin to the Microsoft admin-consent endpoint so the application is granted required Graph API permissions for all users in the tenant.

### Response
`302 Redirect` to `https://login.microsoftonline.com/{tenantId}/adminconsent?...`

---

## Password Hashing (Internal Detail)

The `PasswordHasher` class uses PBKDF2-SHA256 with 100,000 iterations.

**Hash format stored in DB:**
```
PBKDF2:{base64-salt}:{base64-hash}
```

**Verification:** The `Verify(input, stored)` method uses constant-time comparison to prevent timing attacks.

**When password is hashed:**
- On `POST /api/users` (Create User)
- On `PUT /api/users/{id}` (Update User) — only if the new password does not already start with `"PBKDF2:"`
- On `PATCH /api/users/{id}/change-password`
- On `POST /api/auth/register` (default password)
- On `POST /api/auth/bootstrap` (no password set)
- On Microsoft SSO auto-registration (default password)
