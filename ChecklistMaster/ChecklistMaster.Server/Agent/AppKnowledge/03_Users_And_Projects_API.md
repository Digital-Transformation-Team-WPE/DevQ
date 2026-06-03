# ChecklistMaster — Users, Projects & Project-Issue Links API

---

## PART A: Users API

**Base Route:** `/api/users`  
**Controller Auth:** `[AllowAnonymous]` — all endpoints are publicly accessible (no JWT required at the controller level). Row-level permission enforcement is expected at the frontend/middleware level.

---

### User Model — Full Schema

**Table:** `Users`

| Field | DB Type | Description |
|---|---|---|
| `UId` | NVARCHAR PK | 10-char uppercase hex UID (e.g. `A3F7C9D201`) |
| `UserId` | NVARCHAR | Login username, usually an email address |
| `UserName` | NVARCHAR | Display name (full name) |
| `Password` | NVARCHAR | PBKDF2 hash string (`PBKDF2:{salt}:{hash}`) — never plain-text |
| `EmailId` | NVARCHAR | Email address |
| `Role` | NVARCHAR | One of: `Admin`, `AVP_Admin`, `WGDE_Admin`, `AVP_User`, `WGDE_User`, `Viewer` |
| `Status` | NVARCHAR | `Active` / `Inactive` / `disabled` |
| `Flag1` | NVARCHAR | Reserved for extension |
| `Flag2` | NVARCHAR | Reserved for extension |
| `Flag3` | NVARCHAR | Reserved for extension |
| `CreatedDate` | DATETIME | UTC timestamp when user was created |
| `Lastlogin` | DATETIME | UTC timestamp of most recent successful login |

> **Security rule:** The `Password` field is always the PBKDF2 hash. When a User object is returned from any GET endpoint, the `Password` field is included in the JSON. Frontend must never display or use this value.

---

### GET /api/users

Returns all users.

**Response:** `200 OK` — array of User objects.

---

### GET /api/users/{id}

Returns a single user by primary key (`UId`).

**Route constraint:** The `{id}` regex excludes the literal strings `byUserId` and `byRole` to avoid route conflicts.

**Responses:**
- `200 OK` — User object
- `404 Not Found` — no user with that UId

---

### GET /api/users/byUserId/{userId}

Returns a user by `UserId` OR `EmailId` (whichever matches first).

This dual-match is important: it allows lookup by both username and email address since they are often the same value.

**Responses:**
- `200 OK` — User object
- `404 Not Found`

---

### GET /api/users/byRole/{role}

Returns all users with the exact matching `Role` value (case-sensitive).

**Example:** `GET /api/users/byRole/AVP_User`

**Response:** `200 OK` — array of User objects (empty array if none match).

---

### POST /api/users

Creates a new user (admin-initiated creation, not self-registration).

**Request Body:**
```json
{
  "uId": "A3F7C9D201",
  "userId": "jane.doe@stellantis.com",
  "userName": "Jane Doe",
  "password": "InitialPass123",
  "emailId": "jane.doe@stellantis.com",
  "role": "WGDE_User",
  "status": "Active",
  "flag1": null,
  "flag2": null,
  "flag3": null,
  "createdDate": "2026-05-27T10:00:00Z",
  "lastlogin": null
}
```

**Business Logic:**
1. If `Password` is provided and does not already start with `"PBKDF2:"`, it is hashed using `PasswordHasher.Hash()`.
2. If `Password` is already a PBKDF2 hash (starts with `"PBKDF2:"`), it is stored as-is.
3. `CreatedDate` is set to `DateTime.UtcNow` (overrides any client-supplied value).
4. Returns the created record.

**Response:** `201 Created` with Location header pointing to `GET /api/users/{UId}`.

---

### PUT /api/users/{id}

Full update (replace all fields) of an existing user.

**Route param:** `{id}` = `UId` of the user.

**Business Logic:**
1. If `Password` in the body is non-empty and does not start with `"PBKDF2:"` → password is hashed before storage.
2. If `Password` is empty/null → field is stored as-is (frontend should send the existing hash if no password change intended).
3. Uses `GenericService.UpdateAsync` which calls `_context.Entry(existing).CurrentValues.SetValues(entity)` — all fields are replaced.

**Responses:**
- `200 OK` — Updated User object
- `404 Not Found`

---

### PUT /api/users/{id}/approve

Approves a self-registered user account (sets `Status = "Active"`).

**Route param:** `{id}` = `UId` of the user to approve.

**Business Logic:**
1. Executes a targeted `ExecuteUpdateAsync` — only the `Status` column is changed to `"Active"`. No other fields are touched, including Password.
2. If zero rows affected → `404 Not Found`.
3. Logs: `"Admin approved user {UserId} (UId={UId})."`

**Responses:**
- `200 OK` — Updated User object (full record, read after update)
- `404 Not Found`

> **Important:** This endpoint does NOT change the password. The user logs in with the default password `Pass@May2026` set at self-registration time.

---

### PATCH /api/users/{id}/change-password

Allows a user to change their own password.

**Route param:** `{id}` = `UId` of the user.

**Request Body:**
```json
{
  "currentPassword": "Pass@May2026",
  "newPassword": "NewSecurePass!99"
}
```

**Business Logic:**
1. Validates both fields are non-empty.
2. Fetches the user record.
3. Calls `PasswordHasher.Verify(currentPassword, user.Password)` — if verification fails → `400 Bad Request` with `"Current password is incorrect."`.
4. Executes targeted `ExecuteUpdateAsync` — only `Password` column is updated with `PasswordHasher.Hash(newPassword)`.

**Responses:**
- `200 OK` — `{ "message": "Password updated successfully." }`
- `400 Bad Request` — Empty fields or incorrect current password
- `404 Not Found`

---

### PATCH /api/users/{id}/profile

Updates `UserName` and `EmailId` only (targeted update — other fields are not touched).

**Route param:** `{id}` = `UId`.

**Request Body:**
```json
{
  "userName": "Jane Smith",
  "emailId": "jane.smith@stellantis.com"
}
```

**Business Logic:**
1. Fetches existing user.
2. Executes `ExecuteUpdateAsync` setting only `UserName` and `EmailId`. If request value is null, the existing value is kept.
3. Returns the full updated user record (re-fetched after update).

**Responses:**
- `200 OK` — Updated User object
- `404 Not Found`

---

### DELETE /api/users/{id}

Hard-deletes a user from the database.

**Route param:** `{id}` = `UId`.

**Responses:**
- `204 No Content` — deleted
- `404 Not Found`

---

## PART B: Projects API

**Base Route:** `/api/projects`  
**Controller Auth:** `[AllowAnonymous]`

---

### Project Model — Full Schema

**Table:** `Projects`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique project identifier |
| `ProjectName` | NVARCHAR | Display name of the project (DB column name is "Project") |
| `Program` | NVARCHAR | Manufacturing program name (e.g. "DS3", "BEV Platform") |
| `PartNumber` | NVARCHAR | Main part number associated with this project |
| `PartName` | NVARCHAR | Descriptive name for the part |
| `Area` | NVARCHAR | Manufacturing area (e.g. "Assembly", "Body Shop") |
| `Plant` | NVARCHAR | Plant/factory code |
| `Plant_year` | NVARCHAR | Model year or plant year designation |
| `Zone` | NVARCHAR | Zone within the plant |
| `Assy_Name` | NVARCHAR | Assembly name |
| `Category` | NVARCHAR | Project category (e.g. "Safety", "Quality") |
| `No_of_issues` | INT | Count of issues linked to this project (informational) |
| `Created_by` | NVARCHAR | UserId of the creator |
| `Created_date` | DATETIME | UTC creation timestamp |
| `Modified_by` | NVARCHAR | UserId of last modifier |
| `Modified_date` | DATETIME | UTC last-modified timestamp |
| `Status` | NVARCHAR | Active / Inactive / Closed |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR | Reserved |
| `Flag3` | NVARCHAR | Reserved |

> **Note:** The C# property is `ProjectName` but the database column name is mapped as `"Project"` via `OnModelCreating` in AppDbContext.

---

### GET /api/projects
Returns all project records.

**Response:** `200 OK` — array of Project objects.

---

### GET /api/projects/{id}
Returns a project by `Uid`.

**Responses:**
- `200 OK` — Project object
- `404 Not Found`

---

### GET /api/projects/byCreatedBy/{createdBy}
Returns all projects where `Created_by` exactly matches the provided string.

**Example:** `GET /api/projects/byCreatedBy/john.doe@stellantis.com`

**Response:** `200 OK` — array of Project objects (empty if none).

---

### POST /api/projects
Creates a new project. Caller is responsible for setting all fields including `Uid`, `Created_by`, and `Created_date`.

**Response:** `201 Created`

---

### PUT /api/projects/{id}
Full replacement update of a project.

**Responses:**
- `200 OK` — Updated Project
- `404 Not Found`

---

### DELETE /api/projects/{id}
Hard-deletes a project.

**Responses:**
- `204 No Content`
- `404 Not Found`

---

## PART C: Project-Issue Links API

**Base Route:** `/api/projectissuelinks`

---

### ProjectIssueLink Model — Full Schema

**Table:** `Project_issue_link`

This is the junction/link table that connects a Project to a set of issues. Each row represents one issue within a project context.

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique link identifier |
| `Project` | NVARCHAR | FK → `Projects.Uid` |
| `Program` | NVARCHAR | Program name (denormalised from Project) |
| `PartNumber` | NVARCHAR | Master part number for this issue row |
| `Area` | NVARCHAR | Area (denormalised from Project) |
| `Plant` | NVARCHAR | Plant (denormalised) |
| `Plant_year` | NVARCHAR | Plant year (denormalised) |
| `Zone` | NVARCHAR | Zone (denormalised) |
| `Issue_number` | NVARCHAR | Issue identifier (e.g. "ISS-0042") |
| `Part_number_RH` | NVARCHAR | Right-Hand part number |
| `Part_number_LH` | NVARCHAR | Left-Hand part number |
| `Part_Description` | NVARCHAR | Descriptive name of the part |
| `Created_by` | NVARCHAR | UserId of creator |
| `Created_date` | DATETIME | UTC creation timestamp |
| `Modified_by` | NVARCHAR | UserId of last modifier |
| `Modified_date` | DATETIME | UTC last-modified timestamp |
| `Status` | NVARCHAR | Active / Closed / etc. |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR(MAX) | Large JSON field — extended data (e.g. checklist sync state) |
| `Flag3` | NVARCHAR(MAX) | Large JSON field — extended data |

> **Note:** `Flag2` and `Flag3` are explicitly typed as `NVARCHAR(MAX)` to support storing large JSON payloads.

---

### GET /api/projectissuelinks
Returns all project-issue links.

---

### GET /api/projectissuelinks/{id}
Returns a link by `Uid`.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### GET /api/projectissuelinks/byProject/{uid}
Returns all issue links for a given project UID.

**Filter:** Matches records where `Project == uid`.

**Example:** `GET /api/projectissuelinks/byProject/A3F7C9D201`

---

### GET /api/projectissuelinks/byIssueNumber/{issueNumber}
Returns all links for a given issue number.

**Filter:** Matches records where `Issue_number == issueNumber`.

---

### POST /api/projectissuelinks
Creates a new project-issue link.

**Response:** `201 Created`

---

### PUT /api/projectissuelinks/{id}
Full update of an existing link.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### DELETE /api/projectissuelinks/{id}
Hard-deletes a link.

**Responses:**
- `204 No Content`
- `404 Not Found`

---

## Data Lifecycle — Projects and Issues

```
1. Admin or User creates a Project (POST /api/projects)
2. Issues are linked to the project (POST /api/projectissuelinks)
   - Each link has a unique Issue_number, RH/LH part numbers
3. For each issue:
   - Document info is created (POST /api/issuelistdocinfos)
   - Part info is created (POST /api/issuelistpartinfos)
   - Checklist items are created (POST /api/issuelistchecklists)
   - History entries are appended on each change (POST /api/issuelisthistories)
   - DMRS checkpoints are managed (POST /api/dmrschecklists)
4. Milestones are tracked per-issue (Part Milestones) and per-project (Project Milestones)
```
