# ChecklistMaster — System Overview & Architecture

## 1. What is ChecklistMaster?

ChecklistMaster is a manufacturing quality-management web application used at automotive production plants (Stellantis context). It tracks:

- **Projects** — manufacturing programs with part numbers, plant assignments, zones, and areas.
- **Issues** — quality or engineering problems linked to projects, each with document metadata, part information, checklists, and audit history.
- **Checklist Master** — the authoritative template library of all quality checkpoints, organised by department, zone, area, station, and category.
- **DMRS Checklists** — Design, Manufacturing, and Release Sign-off checkpoint records per issue and part, tracking synchronisation results across configurable milestones.
- **Milestones** — project-level and issue-level (part-level) milestone schedules tracked separately for the AVP and WGDE engineering departments.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 10 (C#), Entity Framework Core 9 |
| Database | SQL Server (NVARCHAR-based UIDs, DATETIME2 dates) |
| Authentication | JWT Bearer in HttpOnly cookie (`cm_auth`) |
| Identity Provider | Azure AD / Entra ID (optional) + Local PBKDF2 |
| File Storage | wwwroot/uploads on the server |
| Frontend | React 19 + Vite (SPA hosted by the same server) |

---

## 3. Key Design Conventions

### 3.1 Primary Keys
All entities except `ComponentMetadata` use a **string UID** primary key (10-character uppercase hex from GUID, e.g. `A3F7C9D201`). `ComponentMetadata` uses an integer `Ouid`.

### 3.2 RH / LH Pattern
The domain tracks parts with Right-Hand (RH) and Left-Hand (LH) variants. Many entities carry parallel fields:
- `Part_number_RH` / `Part_number_LH`
- `PDEF_Number_RH` / `PDEF_Number_LH`
- `LA_Num_RH` / `LA_Num_LH`
- `PA_Num_RH` / `PA_Num_LH`
- `Part_Revision_RH` / `Part_Revision_LH`
- `Maturity_State_RH` / `Maturity_State_LH`
- `Picture_rh` / `Picture_lh`
- `RH` / `LH` status flags on checklist items

### 3.3 Flag Columns
Most entities carry `Flag1`, `Flag2`, `Flag3` (NVARCHAR) for extensibility. In some entities these are semantically overloaded:
- `PartMilestone.Flag1` → mapped as `Department` column
- `PartMilestone.Flag2` → mapped as `Owner` column
- `ProjectIssueLink.Flag2` / `Flag3` → large JSON fields (NVARCHAR(MAX))
- `DmrsChecklist.SyncData` → JSON dictionary of milestone results

### 3.4 Audit Columns
Most entities carry: `CreatedBy`, `CreatedDate`, `ModifiedBy`, `ModifiedDate`. The API does not automatically set these; the caller is responsible for populating them.

### 3.5 Status Values (Common)
- `Active` — record is live/usable
- `Inactive` — record is soft-disabled (for Users: pending admin approval)
- `disabled` — explicitly locked (Users)

---

## 4. Entity Relationship Overview

```
Projects (Uid)
    └─ ProjectIssueLinks (Project → Projects.Uid, Issue_number)
          └─ IssueListDocinfo   (Issue_number, PartNumber)
          └─ IssueListPartinfo  (Issue_number, PartNumber)
          └─ IssueListChecklist (Issue_number, PartNumber, Checlist_id → ChecklistMasterEntity.ChkId)
          └─ IssueListHistory   (Issue_number, PartNumber)
          └─ DmrsChecklist      (Issue_number, PartNumber)
          └─ PartMilestones     (IssueNumber, ProjectUid → Projects.Uid)

Projects (Uid)
    └─ ProjectMilestones (ProjectUid → Projects.Uid)

ChecklistMasterEntity (ChkId / Uid)
    └─ ChecklistMilestones (ChkId → ChecklistMasterEntity.ChkId, Milestoneid)

Users (UId)

ComponentMetadata (Ouid) — lookup/dropdown data; no FK relationships
```

> **Note:** Foreign key constraints are not enforced at the database level (no EF migrations run). Relationships are maintained by application logic.

---

## 5. User Roles

| Role | Description |
|---|---|
| `Admin` | Full access; approves user accounts; can create/delete anything |
| `AVP_Admin` | Administrator for the AVP engineering department |
| `WGDE_Admin` | Administrator for the WGDE engineering department |
| `AVP_User` | Standard user in the AVP department |
| `WGDE_User` | Standard user in the WGDE department |
| `Viewer` | Read-only access |

Self-registered users are given role `Viewer` by default unless they request `AVP_User` or `WGDE_User`. Roles `Admin`, `AVP_Admin`, `WGDE_Admin` cannot be self-selected.

---

## 6. Authentication Flow Summary

```
1. POST /api/auth/login
   ├── Validates credentials (Azure AD ROPC or local PBKDF2)
   ├── Looks up user in DB (must exist and be Active)
   ├── Updates user.Lastlogin
   └── Sets HttpOnly secure cookie cm_auth containing JWT (default 480 min)

2. GET /api/auth/me  [Authorize]
   └── Reads claims from cm_auth cookie, returns AuthUserDto

3. POST /api/auth/logout
   └── Deletes cm_auth cookie

4. POST /api/auth/register  [public]
   ├── Creates user with Status=Inactive, default password Hash("Pass@May2026")
   └── Admin must call PUT /api/users/{id}/approve to activate

5. POST /api/auth/bootstrap  [public, one-time]
   └── Creates first Admin user when Users table is empty

6. GET  /api/auth/microsoft/login    → redirects to Microsoft login page
   GET  /api/auth/microsoft/callback → exchanges code, issues cm_auth cookie
   GET  /api/auth/microsoft/admin-consent → admin grants org-wide consent
```

---

## 7. JWT Cookie Details

| Property | Value |
|---|---|
| Cookie name | `cm_auth` |
| HttpOnly | true |
| Secure | true |
| SameSite | Lax |
| Expiry | Configured via `Jwt:ExpiryMinutes` (default 480 minutes = 8 hours) |

**JWT Claims:**

| Claim | Value |
|---|---|
| `sub` | User.UId (database primary key) |
| `email` | User.EmailId |
| `name` | User.UserName |
| `userId` | User.UserId (login username) |
| `role` | User.Role |
| `status` | User.Status |
| `exp` | Unix epoch expiry time |

---

## 8. Request / Response Conventions

- All endpoints produce and consume `application/json` unless noted.
- File upload endpoints use `multipart/form-data`.
- Maximum request body: **52 MB** (enforced on ChecklistMaster and DMRS upload endpoints).
- Error responses return the HTTP status code with a JSON body (format varies by endpoint — see individual controller docs).
- Successful single-record reads return the record directly. Missing records return `404 Not Found`.
- Successful creates return `201 Created` with the record body.
- Successful updates return `200 OK` with the updated record body.
- Successful deletes return `204 No Content`.

---

## 9. Application Startup Behaviour (DbSeeder)

On every application start, `DbSeeder.SeedAsync` runs three steps:

**Step 1 — DDL Migrations (idempotent)**
Creates the following tables if they do not exist:
- `Project_Milestones`
- `Part_Milestones`
- `checklist_Master`

Also adds missing columns to existing tables:
- `checklist_Master.RefDocument` (NVARCHAR MAX)
- `checklist_Master.Images` (NVARCHAR MAX)
- `Issue_list_checklist.Remarks_RH` (NVARCHAR MAX)
- `Issue_list_checklist.Remarks_LH` (NVARCHAR MAX)
- `dmrs_Checklist.SyncData` (NVARCHAR MAX) — and migrates legacy per-sync columns (Sync1–Sync5, PostSync5) into the new JSON format

**Step 2 — User Seeding**
Only runs if the `Users` table is empty. Reads `SeedUsers` array from `appsettings.json` and inserts users with `Status=Active` and no password (first login uses default or admin sets password).

**Step 3 — ComponentMetadata Seeding**
Only runs if `ComponentMetadata` table is empty. Inserts 33 standard dropdown entries (9 Zones, 8 Areas, 10 Stations, 8 Categories).

---

## 10. File Storage Paths

| Upload endpoint | Storage folder | URL path |
|---|---|---|
| `POST /api/checklistmaster/upload` | `wwwroot/uploads/checklists/` | `/uploads/checklists/{guid}.ext` |
| `POST /api/dmrschecklists/upload` | `wwwroot/uploads/dmrs/` | `/uploads/dmrs/{guid}.ext` |

Files are renamed to a new GUID on upload; original filename is returned in the response for display purposes only.

---

## 11. Document Index

| Document | Contents |
|---|---|
| 01_Overview_And_Architecture.md | **This file** — system overview, roles, conventions |
| 02_Authentication_API.md | Auth controller — login, logout, register, bootstrap, Microsoft SSO |
| 03_Users_And_Projects_API.md | Users, Projects, ProjectIssueLinks |
| 04_Issue_List_API.md | IssueListDocinfo, IssueListPartinfo, IssueListChecklist, IssueListHistory |
| 05_Checklist_Master_And_DMRS_API.md | ChecklistMaster, DmrsChecklist |
| 06_Milestones_API.md | ChecklistMilestones, PartMilestones, ProjectMilestones |
| 07_Component_Metadata_And_Field_Reference.md | ComponentMetadata, all field schemas, business rules |
