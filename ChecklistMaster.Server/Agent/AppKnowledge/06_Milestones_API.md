# ChecklistMaster — Milestones API

The application tracks milestones at three levels:

| Level | Table | API Base Route | Purpose |
|---|---|---|---|
| Checkpoint level | `Checklists_Milestones` | `/api/checklistmilestones` | Target dates and day-count targets per checklist template item |
| Issue / Part level | `Part_Milestones` | `/api/partmilestones` | Planned/completed dates per issue and milestone, ordered by sequence |
| Project level | `Project_Milestones` | `/api/projectmilestones` | Programme-level milestone schedule with AVP/WGDE department tracking |

---

## PART A: Checklist Milestones API

**Base Route:** `/api/checklistmilestones`

These records link checklist template items (`ChecklistMasterEntity`) to milestone events. They define when each checkpoint must be completed (target date and number-of-days target), and which department is responsible.

---

### ChecklistMilestone Model — Full Schema

**Table:** `Checklists_Milestones`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `ChkId` | NVARCHAR | References `ChecklistMasterEntity.ChkId` — which checkpoint this milestone belongs to |
| `CheckPointS` | NVARCHAR | Checkpoint short name (denormalised from ChecklistMaster) |
| `CheckpointDesc` | NVARCHAR | Checkpoint description (denormalised) |
| `Milestoneid` | NVARCHAR | Milestone identifier (e.g. "M001", "DVP", "SOP") |
| `Milestone` | DATETIME | Target milestone date |
| `NoofDays` | INT | Target number of days for completion of this checkpoint |
| `Status` | NVARCHAR | Active / Completed / Pending |
| `Department` | NVARCHAR | Responsible department: `AVP` / `WGDE` / `Common` |
| `CreatedBy` | NVARCHAR | Creator UserId |
| `CreatedDate` | DATETIME | Creation timestamp |
| `ModifiedBy` | NVARCHAR | Last modifier |
| `ModifiedDate` | DATETIME | Last modification timestamp |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR | Reserved |
| `Flag3` | NVARCHAR | Reserved |

### Domain Notes

- A single `ChkId` can have multiple milestone rows (one per programme milestone: DVP, Pilot, SOP, etc.).
- `NoofDays` represents the target lead time in days for completing this checkpoint before the milestone date.
- `Milestoneid` is the milestone reference identifier that aligns with project-level milestones.

---

### GET /api/checklistmilestones
Returns all checklist milestone records.

---

### GET /api/checklistmilestones/{id}
Returns a record by `Uid`.

**Responses:** `200 OK` / `404 Not Found`

---

### GET /api/checklistmilestones/byDepartment/{department}
Returns all milestone records for a given department.

**Filter:** `Department == department` (exact match).

**Valid values:** `AVP`, `WGDE`, `Common`

---

### GET /api/checklistmilestones/byChkId/{chkId}
Returns all milestone records for a given checkpoint ID.

**Filter:** `ChkId == chkId`

---

### GET /api/checklistmilestones/byMilestoneId/{milestoneId}
Returns all milestone records for a given milestone identifier.

**Filter:** `Milestoneid == milestoneId`

---

### POST /api/checklistmilestones
Creates a new checklist milestone record. **Response:** `201 Created`

---

### PUT /api/checklistmilestones/{id}
Full update. **Responses:** `200 OK` / `404 Not Found`

---

### DELETE /api/checklistmilestones/{id}
Hard-delete. **Responses:** `204 No Content` / `404 Not Found`

---

## PART B: Part Milestones API

**Base Route:** `/api/partmilestones`  
**Controller Auth:** `[Authorize]` — **JWT required** (all endpoints require authentication).

Part Milestones track milestone progress at the issue level. Each issue has a set of milestone rows ordered by `MilestoneOrder`, with planned dates and actual completion dates.

---

### PartMilestone Model — Full Schema

**Table:** `Part_Milestones`

| Field | DB Type | C# Property | Description |
|---|---|---|---|
| `Uid` | NVARCHAR PK | `Uid` | Unique record identifier |
| `IssueNumber` | NVARCHAR | `IssueNumber` | Issue identifier (links to `ProjectIssueLink.Issue_number`) |
| `ProjectUid` | NVARCHAR | `ProjectUid` | FK → `Projects.Uid` |
| `MilestoneName` | NVARCHAR(500) | `MilestoneName` | Display name: "DVP Freeze", "Pilot Build", "SOP", etc. |
| `MilestoneOrder` | INT | `MilestoneOrder` | Sequence number for ordering milestones (ascending = chronological) |
| `PlannedDate` | DATETIME2 | `PlannedDate` | Target/planned completion date |
| `CompletedDate` | DATETIME2 | `CompletedDate` | Actual date this milestone was completed (null = not yet complete) |
| `Status` | NVARCHAR(100) | `Status` | `pending` / `in progress` / `completed` |
| `Notes` | NVARCHAR(MAX) | `Notes` | Free-text notes about this milestone |
| `CreatedBy` | NVARCHAR(200) | `CreatedBy` | Creator UserId |
| `CreatedDate` | DATETIME2 | `CreatedDate` | Creation timestamp |
| `ModifiedBy` | NVARCHAR(200) | `ModifiedBy` | Last modifier |
| `ModifiedDate` | DATETIME2 | `ModifiedDate` | Last modification timestamp |
| `Flag1` (DB) | NVARCHAR(200) | `Department` | **DB column is Flag1, C# property is Department** — the department responsible for this milestone |
| `Flag2` (DB) | NVARCHAR(200) | `Owner` | **DB column is Flag2, C# property is Owner** — the person responsible |

> **Column mapping note:** The DB columns `Flag1` and `Flag2` in `Part_Milestones` are mapped to the C# properties `Department` and `Owner` respectively via `[Column("Flag1")]` and `[Column("Flag2")]` attributes. When reading/writing this table via raw SQL, use column names `Flag1`/`Flag2`. When using the JSON API, use property names `department`/`owner`.

### Service Behaviour

- `GetByIssueNumberAsync`: Returns records ordered by `MilestoneOrder ASC`.
- `GetByProjectUidAsync`: Returns records for all issues in the project, ordered by `MilestoneOrder ASC`.

---

### GET /api/partmilestones
Returns all part milestone records.

---

### GET /api/partmilestones/{uid}
Returns a record by `Uid`.

**Responses:** `200 OK` / `404 Not Found`

---

### GET /api/partmilestones/byIssueNumber/{issueNumber}
Returns all milestones for a given issue, ordered by `MilestoneOrder` ascending.

---

### GET /api/partmilestones/byProject/{projectUid}
Returns all part milestones for all issues within a project, ordered by `MilestoneOrder` ascending.

---

### POST /api/partmilestones
Creates a single part milestone.

**Response:** `201 Created` with Location header pointing to `GET /api/partmilestones/{uid}`.

---

### PUT /api/partmilestones/{uid}
Full update of a part milestone.

**Responses:** `200 OK` / `404 Not Found`

---

### DELETE /api/partmilestones/{uid}
Hard-deletes a part milestone.

**Responses:** `204 No Content` / `404 Not Found`

---

### PUT /api/partmilestones/byIssueNumber/{issueNumber} — Bulk Upsert

**The most important endpoint for Part Milestones.** Replaces all milestone rows for a given issue in a single atomic transaction.

**Purpose:** When the frontend saves the milestone schedule for an issue, it sends the complete desired state. The server reconciles it by inserting, updating, or deleting rows as needed.

**Request Body:** JSON array of `PartMilestone` objects.

```json
[
  {
    "uid": "PM001A2B3C4",
    "issueNumber": "ISS-0042",
    "projectUid": "PROJ-001",
    "milestoneName": "DVP Freeze",
    "milestoneOrder": 1,
    "plannedDate": "2026-06-15T00:00:00Z",
    "completedDate": null,
    "status": "pending",
    "notes": "",
    "department": "AVP",
    "owner": "jane.doe@stellantis.com",
    "createdBy": "john.doe@stellantis.com",
    "createdDate": "2026-05-27T10:00:00Z"
  },
  {
    "uid": "PM002A2B3C4",
    "issueNumber": "ISS-0042",
    "projectUid": "PROJ-001",
    "milestoneName": "Pilot Build",
    "milestoneOrder": 2,
    "plannedDate": "2026-08-01T00:00:00Z",
    "completedDate": null,
    "status": "pending",
    "department": "WGDE",
    "owner": "wgde.lead@stellantis.com"
  }
]
```

**Business Logic (Transactional):**

1. Loads all existing `Part_Milestones` rows where `IssueNumber == issueNumber` from the database (with change tracking enabled).
2. Computes the set of UIDs in the incoming payload (`incomingUids`).
3. **Deletes** rows that exist in DB but whose `Uid` is NOT in `incomingUids` (removed rows).
4. **Iterates over each incoming row:**
   - If a row with that `Uid` already exists in DB → **updates** it by calling `Entry(ex).CurrentValues.SetValues(m)` (all fields replaced).
   - If no row with that `Uid` exists → **inserts** it as a new row.
5. Calls `SaveChangesAsync()` once — all changes are committed in a single database transaction.
6. Returns the current state by calling `GetByIssueNumberAsync(issueNumber)` (ordered by `MilestoneOrder`).

**Response — 200 OK:** Array of all Part Milestones for the issue after upsert, ordered by `MilestoneOrder`.

> **Critical behaviour:** Rows present in the DB but NOT present in the request payload will be **deleted**. Always send the complete desired milestone list, not just changed rows.

---

## PART C: Project Milestones API

**Base Route:** `/api/projectmilestones`

Project Milestones track programme-level milestone events for an entire project. Unlike Part Milestones (which are per-issue), these are top-level schedule entries that apply to the whole project. They track completion separately for AVP and WGDE departments.

---

### ProjectMilestone Model — Full Schema

**Table:** `Project_Milestones`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `ProjectUid` | NVARCHAR | FK → `Projects.Uid` — which project this milestone belongs to |
| `MilestoneName` | NVARCHAR(500) | Milestone display name (e.g. "SOP", "DVP Freeze", "Pilot Build") |
| `MilestoneOrder` | INT | Sequence number (ascending = chronological order) |
| `PlannedDate` | DATETIME2 | Target/planned date for this milestone |
| `Status` | NVARCHAR(100) | `pending` / `in progress` / `completed` |
| `Department` | NVARCHAR(100) | Applicable department(s): `AVP` / `WGDE` / `Common` / `AVP,WGDE` |
| `AvpCompletedDate` | DATETIME2 | Date the AVP department completed this milestone (null = not complete) |
| `WgdeCompletedDate` | DATETIME2 | Date the WGDE department completed this milestone (null = not complete) |
| `Notes` | NVARCHAR(MAX) | Free-text notes |
| `CreatedBy` | NVARCHAR(200) | Creator UserId |
| `CreatedDate` | DATETIME2 | Creation timestamp |
| `ModifiedBy` | NVARCHAR(200) | Last modifier |
| `ModifiedDate` | DATETIME2 | Last modification timestamp |
| `Flag1` | NVARCHAR(200) | Reserved |
| `Flag2` | NVARCHAR(200) | Reserved |
| `Flag3` | NVARCHAR(200) | Reserved |

### Domain Notes

- **AvpCompletedDate / WgdeCompletedDate**: The two departments (AVP and WGDE) sign off independently on each milestone. A milestone is fully complete only when both departments have a `CompletedDate` (for milestones where `Department = "AVP,WGDE"` or `"Common"`).
- **Department field values:**
  - `"AVP"` — Only the AVP department tracks this milestone.
  - `"WGDE"` — Only the WGDE department tracks this milestone.
  - `"Common"` — Both departments track this milestone; both `AvpCompletedDate` and `WgdeCompletedDate` are relevant.
  - `"AVP,WGDE"` — Same as Common but explicitly listing both.
- **MilestoneOrder** is used to render the Gantt chart / timeline in the frontend in the correct chronological order.

### Service Behaviour

- `GetByProjectUidAsync`: Returns records ordered by `MilestoneOrder ASC`.

---

### GET /api/projectmilestones
Returns all project milestone records (all projects).

---

### GET /api/projectmilestones/{uid}
Returns a record by `Uid`.

**Responses:** `200 OK` / `404 Not Found`

---

### GET /api/projectmilestones/byProject/{projectUid}
Returns all milestones for a given project, ordered by `MilestoneOrder` ascending.

---

### POST /api/projectmilestones
Creates a single project milestone.

**Response:** `201 Created`

---

### PUT /api/projectmilestones/{uid}
Full update of a project milestone (used to record AVP or WGDE completion dates).

**Responses:** `200 OK` / `404 Not Found`

---

### DELETE /api/projectmilestones/{uid}
Hard-deletes a project milestone.

**Responses:** `204 No Content` / `404 Not Found`

---

### PUT /api/projectmilestones/byProject/{projectUid} — Bulk Upsert

Replaces all milestone rows for a project in a single transaction.

**Request Body:** JSON array of `ProjectMilestone` objects.

```json
[
  {
    "uid": "PM-PROJ-001-01",
    "projectUid": "PROJ-001",
    "milestoneName": "DVP Freeze",
    "milestoneOrder": 1,
    "plannedDate": "2026-06-15T00:00:00Z",
    "status": "pending",
    "department": "Common",
    "avpCompletedDate": null,
    "wgdeCompletedDate": null,
    "notes": "",
    "createdBy": "john.doe@stellantis.com",
    "createdDate": "2026-05-27T10:00:00Z"
  },
  {
    "uid": "PM-PROJ-001-02",
    "projectUid": "PROJ-001",
    "milestoneName": "Pilot Build",
    "milestoneOrder": 2,
    "plannedDate": "2026-09-01T00:00:00Z",
    "status": "pending",
    "department": "AVP",
    "avpCompletedDate": null,
    "wgdeCompletedDate": null
  }
]
```

**Business Logic (Transactional — identical pattern to Part Milestones):**

1. Loads all existing `Project_Milestones` rows for the `projectUid`.
2. Computes `incomingUids` from payload.
3. **Deletes** rows whose `Uid` is NOT in `incomingUids`.
4. **For each incoming row:**
   - Existing Uid → **updates** all fields (including AVP/WGDE completion dates).
   - New Uid → **inserts** as new row.
5. Single `SaveChangesAsync()` call — atomic commit.
6. Returns the updated list ordered by `MilestoneOrder`.

**Response — 200 OK:** Array of all Project Milestones for the project after upsert.

> **Critical behaviour:** Same as Part Milestones bulk upsert — rows not in the request payload are **deleted**. Always send the complete desired list.

---

## Milestone Hierarchy Summary

```
Project (Uid: PROJ-001)
│
├─ ProjectMilestones (byProject/PROJ-001)
│   ├─ Milestone 1: DVP Freeze (Order: 1, PlannedDate: 2026-06-15)
│   │   AvpCompletedDate: 2026-06-14
│   │   WgdeCompletedDate: null (WGDE not yet complete)
│   ├─ Milestone 2: Pilot Build (Order: 2, PlannedDate: 2026-09-01)
│   └─ Milestone 3: SOP (Order: 3, PlannedDate: 2026-12-01)
│
├─ ProjectIssueLinks → Issue ISS-0042
│   └─ PartMilestones (byIssueNumber/ISS-0042)
│       ├─ Milestone 1: DVP Freeze (Order: 1, PlannedDate: 2026-06-15)
│       │   CompletedDate: 2026-06-12 (completed early)
│       │   Department: AVP, Owner: jane.doe@stellantis.com
│       └─ Milestone 2: Pilot Build (Order: 2, PlannedDate: 2026-09-01)
│           CompletedDate: null
│
└─ ChecklistMasterEntity (ChkId: CHK-101)
    └─ ChecklistMilestones (byChkId/CHK-101)
        ├─ Milestoneid: M001, Milestone: 2026-06-01, NoofDays: 14, Department: AVP
        └─ Milestoneid: M002, Milestone: 2026-08-15, NoofDays: 30, Department: WGDE
```

---

## Bulk Upsert Comparison

| Aspect | Part Milestones | Project Milestones |
|---|---|---|
| Scope key | `IssueNumber` | `ProjectUid` |
| Route | `PUT /api/partmilestones/byIssueNumber/{issueNumber}` | `PUT /api/projectmilestones/byProject/{projectUid}` |
| Auth | `[Authorize]` — JWT required | No explicit auth on controller |
| Department tracking | Single `Department` field + `Owner` | `Department` + `AvpCompletedDate` + `WgdeCompletedDate` |
| Return value | Ordered by `MilestoneOrder` | Ordered by `MilestoneOrder` |
| Delete behaviour | Removes rows not in payload | Removes rows not in payload |
