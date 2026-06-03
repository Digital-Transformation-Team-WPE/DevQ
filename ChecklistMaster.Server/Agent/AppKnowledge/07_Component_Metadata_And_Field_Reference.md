# ChecklistMaster — Component Metadata, Field Reference & Error Handling

---

## PART A: Component Metadata API

**Base Route:** `/api/componentmetadata`  
**Controller Auth:** `[AllowAnonymous]`

`ComponentMetadata` stores the dropdown option lists used throughout the UI (Zone, Area, Station, Category and any other dynamic select fields). The frontend fetches these on load to populate filter controls and form dropdowns without hardcoding values.

---

### ComponentMetadata Model — Full Schema

**Table:** `ComponentMetadata`

| Field | DB Type | Description |
|---|---|---|
| `Ouid` | INT PK | Auto-assigned integer primary key (not a GUID). Seeded entries start at 1 |
| `ComponentName` | NVARCHAR | Logical component this entry belongs to (e.g. `"ChecklistMaster"`) |
| `ComponentCode` | NVARCHAR | Short code for the component (e.g. `"CHK"`) |
| `Activity` | NVARCHAR | What this entry is used for (e.g. `"Dropdown"`) |
| `Action` | NVARCHAR | When it is loaded (e.g. `"Load"`) |
| `Parameter` | NVARCHAR | The field/dimension name (e.g. `"Zone"`, `"Area"`, `"station_name"`, `"Category"`) |
| `ParameterCode` | NVARCHAR | Short code for the option (e.g. `"Z001"`, `"AR01"`, `"ST-A"`) |
| `Label` | NVARCHAR | Display label shown in the UI (e.g. `"Zone 1"`, `"Assembly"`) |
| `Status` | NVARCHAR | `Active` / `Inactive` |
| `CreatedBy` | NVARCHAR | Creator (usually `"system"` for seeded entries) |
| `CreatedDate` | DATETIME | Creation timestamp |
| `ModifiedBy` | NVARCHAR | Last modifier |
| `ModifiedDate` | DATETIME | Last modification timestamp |
| `Language` | INT | Language code: `1` = English (default). Used for multi-language support |

### Seeded Dropdown Data (33 entries, auto-seeded at first startup)

**Zone (Parameter = "Zone"):**
| Label | ParameterCode |
|---|---|
| Zone 1 | Z001 |
| Zone 2 | Z002 |
| Zone 3 | Z003 |
| Zone 4 | Z004 |
| Zone 5 | Z005 |
| North | ZN |
| South | ZS |
| East | ZE |
| West | ZW |

**Area (Parameter = "Area"):**
| Label | ParameterCode |
|---|---|
| Assembly | AR01 |
| Body Shop | AR02 |
| Paint Shop | AR03 |
| Trim | AR04 |
| Final Line | AR05 |
| Engine Bay | AR06 |
| Chassis | AR07 |
| Electrical | AR08 |

**Station (Parameter = "station_name"):**
| Label | ParameterCode |
|---|---|
| Station A | ST-A |
| Station B | ST-B |
| Station C | ST-C |
| Station D | ST-D |
| Station E | ST-E |
| Station 01 | ST-01 |
| Station 02 | ST-02 |
| Station 03 | ST-03 |
| Station 04 | ST-04 |
| Station 05 | ST-05 |

**Category (Parameter = "Category"):**
| Label | ParameterCode |
|---|---|
| Safety | CAT-01 |
| Quality | CAT-02 |
| Process | CAT-03 |
| Audit | CAT-04 |
| Compliance | CAT-05 |
| Maintenance | CAT-06 |
| Environment | CAT-07 |
| Engineering | CAT-08 |

> **Note:** The Station parameter key is `"station_name"` (not `"Station"`) — this is the exact string used in the `Parameter` column for station entries.

---

### GET /api/componentmetadata
Returns all component metadata records.

**Response:** `200 OK` — array of all ComponentMetadata objects.

---

### GET /api/componentmetadata/{id}
Returns a record by its integer `Ouid`.

**Route constraint:** `{id:int}` — must be an integer.

**Responses:**
- `200 OK`
- `404 Not Found`

> **Implementation note:** The `UpdateAsync` and `DeleteAsync` methods for `ComponentMetadata` are overridden in `ComponentMetadataService` to use `FirstOrDefaultAsync(c => c.Ouid == ouid)` instead of `FindAsync(id)` because the EF DbContext does not have a configured primary key for this table.

---

### GET /api/componentmetadata/byComponentCode/{componentCode}
Returns all metadata records for a given component code.

**Filter:** `ComponentCode == componentCode` (exact match).

**Example:** `GET /api/componentmetadata/byComponentCode/CHK`

---

### GET /api/componentmetadata/byLanguage/{language}
Returns all records for a given language code.

**Route constraint:** `{language:int}` — must be an integer.

**Filter:** `Language == language`

**Example:** `GET /api/componentmetadata/byLanguage/1` (English)

---

### POST /api/componentmetadata
Creates a new metadata record. Caller must provide `Ouid` (integer, must be unique).

**Response:** `201 Created` with Location header.

---

### PUT /api/componentmetadata/{id}
Updates an existing record by `Ouid`.

**Responses:** `200 OK` / `404 Not Found`

---

### DELETE /api/componentmetadata/{id}
Hard-deletes a record by `Ouid`.

**Responses:** `204 No Content` / `404 Not Found`

---

## PART B: Universal Field Reference

### Common Timestamp Pattern

Most entities use this audit field pattern:

| C# Property | DB Column | Type | Purpose |
|---|---|---|---|
| `CreatedBy` | CreatedBy | NVARCHAR | UserId of the record creator. Caller must populate. |
| `CreatedDate` | CreatedDate | DATETIME / DATETIME2 | UTC timestamp of creation. Caller must populate (exception: User.CreatedDate is auto-set by the controller). |
| `ModifiedBy` | ModifiedBy | NVARCHAR | UserId of the last person to modify the record. Caller must populate on each PUT. |
| `ModifiedDate` | ModifiedDate | DATETIME / DATETIME2 | UTC timestamp of last modification. Caller must populate on each PUT. |

> **Exception:** `ChecklistMasterEntity.CreatedDate` and `ModifiedDate` are stored as NVARCHAR strings, not DATETIME. Use ISO date strings.

### Common Status Values by Entity

| Entity | Status Values |
|---|---|
| User | `Active`, `Inactive`, `disabled` |
| Project | `Active`, `Inactive`, `Closed` (or any custom string) |
| ProjectIssueLink | `Active`, `Closed` (or custom) |
| IssueListDocinfo | `Open`, `In Progress`, `Closed`, `On Hold` |
| IssueListChecklist | `OK`, `NOK`, `N/A`, `Pending` |
| ChecklistMasterEntity | `Active`, `Inactive` |
| DmrsChecklist | `Active`, `Inactive` |
| ChecklistMilestone | `Active`, `Completed`, `Pending` |
| PartMilestone | `pending`, `in progress`, `completed` |
| ProjectMilestone | `pending`, `in progress`, `completed` |
| ComponentMetadata | `Active`, `Inactive` |

### UID Generation Pattern

For all entities where the caller generates the UID:
```csharp
// Pattern used in AuthController for seeded UIDs:
Guid.NewGuid().ToString("N")[..10].ToUpper()
// Example output: "A3F7C9D201"
// Format: 10 uppercase hexadecimal characters
```

For entities where the caller sets the `Uid` directly (most CRUD operations), any unique string is accepted. The standard convention is the 10-char uppercase hex pattern.

---

## PART C: Error Handling Reference

### Standard HTTP Status Codes

| Code | When Used |
|---|---|
| `200 OK` | Successful GET, PUT, or special operations (batch returns 200 even with partial failure) |
| `201 Created` | Successful POST (resource created) |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Missing required fields, invalid input, failed business rule check |
| `401 Unauthorized` | Invalid credentials, inactive account, expired JWT |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate key (username or email already exists) |
| `500 Internal Server Error` | Unhandled exception (logged by Serilog) |

### Error Response Formats

Different controllers use slightly different error response shapes:

**Auth Controller (AuthResponse):**
```json
{
  "success": false,
  "message": "Your account is inactive. Contact your administrator.",
  "user": null,
  "expiresInSeconds": null
}
```

**Auth Controller (non-auth errors):**
```json
{ "valid": false, "message": "Email is required." }
```

**Users Controller (password change):**
```json
{ "message": "Current password is incorrect." }
```

**ChecklistMaster batch:**
```json
{
  "created": 45,
  "failed": 2,
  "errors": ["CHK-031: Violation of PRIMARY KEY constraint.", "CHK-089: Value cannot be null."]
}
```

**All other controllers:**
Controllers return either:
- The entity directly on success
- Empty response body with `404 Not Found` status
- No explicit error body format (just HTTP status code)

---

## PART D: Configuration Reference

### appsettings.json Structure

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=ChecklistMasterDB;Trusted_Connection=True;"
  },
  "Jwt": {
    "Key": "minimum-32-character-secret-key-here",
    "Issuer": "ChecklistMaster",
    "Audience": "ChecklistMasterClient",
    "ExpiryMinutes": 480
  },
  "AzureAd": {
    "Enabled": false,
    "TenantId": "your-tenant-guid",
    "ClientId": "your-app-client-guid",
    "ClientSecret": "your-client-secret",
    "TokenEndpoint": "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
    "RedirectUri": "https://yourapp.com/api/auth/microsoft/callback",
    "FrontendUrl": "https://yourapp.com"
  },
  "Registration": {
    "EnableEmailValidation": true,
    "AllowedEmailDomains": ["stellantis.com", "yourdomain.com"]
  },
  "Cors": {
    "AllowedOrigins": ["https://localhost:52648", "http://localhost:5173"]
  },
  "SeedUsers": [
    { "UserId": "admin@yourdomain.com", "UserName": "System Administrator", "EmailId": "admin@yourdomain.com", "Role": "Admin" },
    { "UserId": "avpadmin@yourdomain.com", "UserName": "AVP Administrator", "EmailId": "avpadmin@yourdomain.com", "Role": "AVP_Admin" },
    { "UserId": "wgteadmin@yourdomain.com", "UserName": "WGDE Administrator", "EmailId": "wgteadmin@yourdomain.com", "Role": "WGDE_Admin" },
    { "UserId": "avpuser@yourdomain.com", "UserName": "AVP User", "EmailId": "avpuser@yourdomain.com", "Role": "AVP_User" },
    { "UserId": "wgteuser@yourdomain.com", "UserName": "WGDE User", "EmailId": "wgteuser@yourdomain.com", "Role": "WGDE_User" },
    { "UserId": "viewer@yourdomain.com", "UserName": "Viewer", "EmailId": "viewer@yourdomain.com", "Role": "Viewer" }
  ]
}
```

### Configuration Behaviour

| Config Key | Default | Effect |
|---|---|---|
| `AzureAd:Enabled` | `true` | `false` = local-only auth; `true` = PBKDF2 + Microsoft Graph validation |
| `Registration:EnableEmailValidation` | `false` | `true` = email domain must be in `AllowedEmailDomains` |
| `Registration:AllowedEmailDomains` | `[]` (empty) | Empty list = all domains accepted even when validation is enabled |
| `Jwt:ExpiryMinutes` | `30` (fallback) | Set to `480` (8 hours) for typical session length |
| `SeedUsers` | `[]` | Seeded only if Users table is empty on startup. No password is set (admin sets password separately) |

---

## PART E: Security Considerations

### Password Security
- Passwords stored as PBKDF2-SHA256, 100,000 iterations, random salt per password.
- Format: `PBKDF2:{base64-salt}:{base64-hash}` — never the plain-text.
- Default password `Pass@May2026` is set at self-registration and Microsoft SSO auto-registration.
- Users should change their password immediately after first login.

### JWT Security
- Token is stored in HttpOnly + Secure cookie `cm_auth` (inaccessible to JavaScript).
- SameSite=Lax prevents CSRF in most scenarios.
- Microsoft OAuth2 flow uses additional CSRF state cookie `oauth_state` (10-minute expiry).

### Authorization State
| Controller | Auth Level |
|---|---|
| AuthController | Mixed — most endpoints AllowAnonymous; `GET /me` requires Authorize |
| UsersController | AllowAnonymous |
| ProjectsController | AllowAnonymous |
| ProjectIssueLinksController | No explicit annotation (inherits default — may require auth based on middleware) |
| IssueListDocinfosController | AllowAnonymous |
| IssueListPartinfosController | No explicit annotation |
| IssueListHistoriesController | No explicit annotation |
| IssueListChecklistsController | No explicit annotation |
| DmrsChecklistsController | No explicit annotation |
| ChecklistMasterController | AllowAnonymous |
| ComponentMetadataController | AllowAnonymous |
| ChecklistMilestonesController | No explicit annotation |
| **PartMilestonesController** | `[Authorize]` — JWT required |
| ProjectMilestonesController | No explicit annotation |

> **Note:** Controllers without explicit authorization annotations are subject to whatever global auth policy is configured in `Program.cs`. Only `PartMilestonesController` is explicitly marked `[Authorize]`.

---

## PART F: Generic Service Behaviour

All entity services inherit from `GenericService<T>` which implements:

```
GetAllAsync()     → SELECT * FROM table (AsNoTracking)
GetByIdAsync(id)  → SELECT * WHERE PK = id (uses FindAsync)
CreateAsync(entity) → INSERT + SaveChangesAsync
UpdateAsync(id, entity) → FindAsync → Entry.CurrentValues.SetValues → SaveChangesAsync
DeleteAsync(id)   → FindAsync → Remove → SaveChangesAsync
```

### Update Behaviour
`UpdateAsync` uses `_context.Entry(existing).CurrentValues.SetValues(entity)` — this sets ALL fields from the incoming entity onto the existing tracked entity, then saves. This means:
- **If a field is null in the incoming entity, it will be set to null in the database.**
- Always send the complete entity on PUT requests — partial updates are NOT supported by generic update.
- Exceptions: `UsersController.Approve` and `UsersController.ChangePassword` use targeted `ExecuteUpdateAsync` to update specific fields only.

### AsNoTracking
All `GetAll*` queries use `AsNoTracking()` — results are not tracked by EF, which improves performance for read-only operations.
