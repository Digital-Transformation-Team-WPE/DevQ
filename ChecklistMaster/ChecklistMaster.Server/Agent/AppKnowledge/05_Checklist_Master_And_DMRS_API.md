# ChecklistMaster — Checklist Master & DMRS Checklist API

---

## PART A: Checklist Master API

**Base Route:** `/api/checklistmaster`  
**Controller Auth:** `[AllowAnonymous]`  
**Max Request Body:** 52 MB (`[RequestSizeLimit(52_428_800)]`)

The `checklist_Master` table is the **master template library** for all quality checkpoints. It defines every checkpoint that can appear on any issue checklist across the plant. Users browse and filter these templates to apply them to specific issues.

---

### ChecklistMasterEntity Model — Full Schema

**Table:** `checklist_Master`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `ChkId` | NVARCHAR | Business-level checkpoint ID (e.g. "CHK-101"). Used in `IssueListChecklist.Checlist_id` |
| `CheckPointS` | NVARCHAR(500) | Short checkpoint name/title (the question or requirement) |
| `CheckpointDesc` | NVARCHAR(MAX) | Full detailed description of the checkpoint |
| `Department` | NVARCHAR | Owning department: `"AVP"`, `"WGDE"`, `"Common"` |
| `Status` | NVARCHAR(50) | Active / Inactive |
| `Mandatory` | NVARCHAR(10) | Whether this checkpoint is mandatory: `"Yes"` / `"No"` |
| `Zone` | NVARCHAR(200) | Plant zone where this checkpoint applies |
| `Station` | NVARCHAR(200) | Work station within the zone |
| `Owner` | NVARCHAR(200) | Person or team responsible for this checkpoint |
| `Category` | NVARCHAR(200) | Category: Safety / Quality / Process / Audit / Compliance / Maintenance / Environment / Engineering |
| `Area` | NVARCHAR(200) | Manufacturing area: Assembly / Body Shop / Paint Shop / Trim / Final Line / Engine Bay / Chassis / Electrical |
| `Material` | NVARCHAR(200) | Applicable material specification |
| `CreatedBy` | NVARCHAR(200) | UserId of creator |
| `CreatedDate` | NVARCHAR(50) | Creation date stored as string (not DATETIME) |
| `ModifiedBy` | NVARCHAR(200) | Last modifier |
| `ModifiedDate` | NVARCHAR(50) | Last modification date stored as string |
| `Flag1` | NVARCHAR(200) | Reserved |
| `Flag2` | NVARCHAR(200) | Reserved |
| `Flag3` | NVARCHAR(200) | Reserved |
| `RefDocument` | NVARCHAR(MAX) | JSON object: `{"fileName": "doc.pdf", "data": "data:application/pdf;base64,..." }` |
| `Images` | NVARCHAR(MAX) | JSON array of base64 data-URL strings: `["data:image/png;base64,...", ...]` |

### Domain Notes

- **ChkId** is the stable business identifier used to link `IssueListChecklist` rows back to their template. It is not the `Uid` (which is a GUID-based key).
- **RefDocument**: Stores a reference document (PDF, Word, Excel) as a base64 encoded data URL embedded in JSON. Format: `{"fileName": "SOP-001.pdf", "data": "data:application/pdf;base64,<base64-content>"}`.
- **Images**: Stores an array of base64 data URLs for images associated with this checkpoint. Format: `["data:image/png;base64,<base64>", "data:image/jpeg;base64,<base64>"]`.
- **CreatedDate / ModifiedDate** are stored as NVARCHAR strings in this table (unlike other tables that use DATETIME). Callers should use ISO date strings (e.g. `"2026-05-27"`).
- **Mandatory**: `"Yes"` or `"No"` — determines if the checkpoint must be completed before an issue can be closed.
- **Department**: Determines which department's users see and complete this checkpoint. `"Common"` means both AVP and WGDE.

---

### GET /api/checklistmaster
Returns all checklist master records.

**Response:** `200 OK` — array of ChecklistMasterEntity objects.

---

### GET /api/checklistmaster/{id}
Returns a single record by `Uid`.

**Route constraint:** Excludes the literal string `"batch"` to avoid routing conflict with `POST /api/checklistmaster/batch`.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### GET /api/checklistmaster/byZone/{zone}
Returns all checklist master records for the given zone.

**Filter:** `Zone == zone` (exact case-sensitive match).

**Example:** `GET /api/checklistmaster/byZone/Zone%201`

---

### GET /api/checklistmaster/byArea/{area}
Returns all records for the given area.

**Filter:** `Area == area` (exact match).

**Example:** `GET /api/checklistmaster/byArea/Assembly`

---

### GET /api/checklistmaster/byDepartment/{department}
Returns all records for the given department.

**Filter:** `Department == department` (exact match).

**Valid values:** `AVP`, `WGDE`, `Common`

---

### POST /api/checklistmaster
Creates a single checklist master record.

Caller provides the full record including `Uid` and `ChkId`. The `RefDocument` and `Images` fields should be populated with their JSON/base64 formats if applicable.

**Response:** `201 Created`

---

### POST /api/checklistmaster/batch

Batch-creates multiple checklist master records in a single request (typically used for Excel import).

**Request Body:** JSON array of `ChecklistMasterEntity` objects.
```json
[
  { "uid": "A001", "chkId": "CHK-001", "checkPointS": "Check torque spec", "department": "AVP", ... },
  { "uid": "A002", "chkId": "CHK-002", "checkPointS": "Verify seal integrity", "department": "WGDE", ... }
]
```

**Business Logic:**
1. If the array is null or empty → `400 Bad Request`.
2. Iterates over each record and calls `CreateAsync` individually.
3. Catches exceptions per-record; failed records are collected but do not abort the batch.
4. Returns a summary of results.

**Response Body — 200 OK:**
```json
{
  "created": 45,
  "failed": 2,
  "errors": [
    "CHK-031: Violation of PRIMARY KEY constraint 'PK_checklist_Master'.",
    "CHK-089: ?"
  ]
}
```

| Field | Description |
|---|---|
| `created` | Number of records successfully saved |
| `failed` | Number of records that threw exceptions |
| `errors` | List of per-record error messages in format `"{ChkId}: {error message}"` |

> **Important:** The batch endpoint always returns `200 OK` even if some records failed. Always check the `failed` count in the response.

---

### PUT /api/checklistmaster/{id}
Full update of an existing checklist master record.

**Responses:**
- `200 OK` — Updated record
- `404 Not Found`

---

### POST /api/checklistmaster/upload

Upload a file (image or document) to associate with a checklist master record.

**Content-Type:** `multipart/form-data`  
**Form field name:** `file`

**Allowed file types:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt`

**Business Logic:**
1. Validates file is non-null and non-empty.
2. Checks file extension against allowed list. If not allowed → `400 Bad Request`.
3. Creates directory `wwwroot/uploads/checklists/` if it does not exist.
4. Saves file as `{new GUID without hyphens}{extension}` (e.g. `a3f7c9d201b4e5f6a7b8c9d0e1f2a3b4.pdf`).
5. Returns the server-relative path and original filename.

**Response — 200 OK:**
```json
{
  "path": "/uploads/checklists/a3f7c9d201b4e5f6a7b8c9d0e1f2a3b4.pdf",
  "fileName": "SOP-Torque-Spec.pdf"
}
```

**Response — 400 Bad Request:**
```json
{ "message": "File type '.exe' is not allowed." }
```

---

### DELETE /api/checklistmaster/{id}
Hard-deletes a checklist master record.

> **Warning:** Deleting a master record that has `IssueListChecklist` rows referencing its `ChkId` will orphan those rows. No cascade logic is implemented at the database level.

**Responses:**
- `204 No Content`
- `404 Not Found`

---

## PART B: DMRS Checklist API

**Base Route:** `/api/dmrschecklists`

**DMRS** = Design, Manufacturing, and Release Sign-off. These records track whether each quality checkpoint was reviewed and signed off at each synchronisation milestone (sync events that occur during the product development programme).

---

### DmrsChecklist Model — Full Schema

**Table:** `dmrs_Checklist`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `PartNumber` | NVARCHAR | Part number |
| `Issue_number` | NVARCHAR | Issue identifier |
| `Check_Point` | NVARCHAR | Checkpoint name or code |
| `MRS` | NVARCHAR | MRS code/reference (Manufacturing Release Specification or similar) |
| `Description` | NVARCHAR | Full description of the checkpoint |
| `Source_Link` | NVARCHAR | URL or document reference for the source specification |
| `Zone` | NVARCHAR | Zone this checkpoint applies to |
| `Stations` | NVARCHAR | Station(s) within the zone |
| `Owner` | NVARCHAR | Responsible person or team |
| `SyncData` | NVARCHAR(MAX) | **JSON dictionary** of milestone results (see format below) |
| `MIMS_ID` | NVARCHAR | MIMS (Manufacturing Issue Management System) reference ID |
| `Remarks` | NVARCHAR | General remarks |
| `ChangeManagement` | NVARCHAR | Change management reference or flag |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR | Reserved |
| `Flag3` | NVARCHAR | Reserved |
| `Status` | NVARCHAR | Record status |
| `CreatedBy` | NVARCHAR | Creator UserId |
| `CreatedDate` | DATETIME | Creation timestamp |
| `ModifiedBy` | NVARCHAR | Last modifier |
| `ModifiedDate` | DATETIME | Last modification timestamp |

### SyncData JSON Format

The `SyncData` field stores a JSON dictionary where each key is a milestone name and each value is a pipe-separated string: `"result|comment"`.

```json
{
  "Sync 1": "OK|Approved in DVP review",
  "Sync 2": "NOK|Surface finish not acceptable",
  "Sync 3": "OK|Rework completed and verified",
  "Sync 4": "",
  "Sync 5": "",
  "Post Sync 5": ""
}
```

| Component | Description |
|---|---|
| Key | Milestone name (e.g. "Sync 1", "Sync 2", "Post Sync 5") |
| Value before pipe `\|` | Result: `"OK"`, `"NOK"`, `"N/A"`, or empty string |
| Value after pipe `\|` | Free-text comment/observation for this sync |

**Legacy column migration:** Older database installations had individual columns (`Sync1`, `Sync1_Comments`, `Sync2`, `Sync2_Comments`, ..., `Sync5`, `Sync5_Comments`, `PostSync5`). The `DbSeeder` automatically migrates these into the `SyncData` JSON format on first startup after upgrade.

### Domain Notes

- **DMRS vs IssueListChecklist**: `IssueListChecklist` tracks whether a checklist checkpoint was completed for an issue (pass/fail per RH/LH). `DmrsChecklist` tracks the sign-off review results across sequential programme sync events (milestones) for each checkpoint.
- **Sync events** are sequential review gates (Sync 1 through Sync 5, plus Post Sync 5) that occur at defined programme milestones. Each sync is a formal design review.
- **MRS** = Manufacturing Release Specification. The `MRS` field links the checkpoint to the formal specification that defines the requirement.
- **MIMS_ID**: If the plant uses a Manufacturing Issue Management System, this field links the DMRS checkpoint to that external system's record.

---

### POST /api/dmrschecklists/upload

Upload an image or document for a DMRS checklist record.

**Content-Type:** `multipart/form-data`  
**Form field name:** `file`

**Allowed file types:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`, `.pdf`

**Business Logic:**
1. If file is null/empty → `400 Bad Request`.
2. Checks extension. If not in allowed list → uses `.png` as default extension (does NOT reject the file — differs from ChecklistMaster upload which rejects unknown types).
3. Saves to `wwwroot/uploads/dmrs/{guid}.{ext}`.

**Response — 200 OK:**
```json
{ "path": "/uploads/dmrs/a3f7c9d201b4e5f6a7b8c9d0e1f2a3b4.jpg" }
```

> **Note:** DMRS upload only returns `path`, not `fileName` (differs from ChecklistMaster upload response).

---

### GET /api/dmrschecklists
Returns all DMRS checklist records.

---

### GET /api/dmrschecklists/{id}
Returns a record by `Uid`.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### GET /api/dmrschecklists/byIssueNumber/{issueNumber}
Returns all DMRS records for a given issue number.

**Filter:** `Issue_number == issueNumber`

---

### GET /api/dmrschecklists/byPartNumber/{partNumber}
Returns all DMRS records for a given part number.

**Filter:** `PartNumber == partNumber`

---

### POST /api/dmrschecklists
Creates a new DMRS checklist record.

**Request Body Example:**
```json
{
  "uid": "D001A2B3C4",
  "partNumber": "PN-8801-RH",
  "issue_number": "ISS-0042",
  "check_Point": "CHK-DMRS-005",
  "mRS": "MRS-2024-001",
  "description": "Verify surface roughness Ra < 1.6µm",
  "source_Link": "/docs/MRS-2024-001.pdf",
  "zone": "Zone 2",
  "stations": "Station 03",
  "owner": "WGDE Team",
  "syncData": "{\"Sync 1\":\"OK|Meets spec\",\"Sync 2\":\"\",\"Sync 3\":\"\",\"Sync 4\":\"\",\"Sync 5\":\"\",\"Post Sync 5\":\"\"}",
  "mIMS_ID": "MIMS-8801-042",
  "status": "Active",
  "createdBy": "john.doe@stellantis.com",
  "createdDate": "2026-05-27T10:00:00Z"
}
```

**Response:** `201 Created`

---

### PUT /api/dmrschecklists/{id}
Full update of a DMRS record. Typically called when recording the result of a sync review.

**Workflow example:** When Sync 2 review is completed, the frontend sends the full record with `SyncData` updated to include the Sync 2 result.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### DELETE /api/dmrschecklists/{id}
Hard-deletes a DMRS record.

**Responses:**
- `204 No Content`
- `404 Not Found`

---

## Checklist Master vs DMRS Checklist — Key Differences

| Aspect | ChecklistMaster | DmrsChecklist |
|---|---|---|
| Purpose | Template library — defines what checkpoints exist | Per-issue sign-off records — tracks sync review results |
| When created | At project setup / import | At each issue's DMRS review process |
| Linked to | Used as template by IssueListChecklist | Linked directly to Issue_number and PartNumber |
| Primary filter | Zone, Area, Department | Issue_number, PartNumber |
| Key special field | RefDocument (base64 JSON), Images (base64 array) | SyncData (milestone results JSON) |
| File upload | Returns both path and fileName | Returns path only |
| Supports batch import | Yes (POST /batch) | No |
| Max body size | 52 MB explicitly set | Default (inherits from Program.cs global) |
