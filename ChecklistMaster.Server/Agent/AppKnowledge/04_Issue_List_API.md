# ChecklistMaster — Issue List API

The Issue List is the core quality tracking domain. An "issue" is a quality, engineering, or manufacturing problem associated with a part. Each issue is split across four tables for separation of concerns:

| Table | Purpose |
|---|---|
| `Issue_List_Docinfo` | Document header: titles, descriptions, owners, dates, PDEF/LA/PA numbers |
| `Issue_List_Partinfo` | Part-specific data: revisions, maturity states, pictures, proposals, solutions |
| `Issue_list_checklist` | Checklist response: which checkpoints passed/failed for this issue (RH & LH) |
| `Issue_list_history` | Audit trail: who changed what and when |

All four tables share:
- `Issue_number` — the common linking key
- `PartNumber` — identifies which physical part this row relates to
- Standard `Uid` primary key (string)

---

## PART A: Issue List Document Info API

**Base Route:** `/api/issuelistdocinfos`  
**Controller Auth:** `[AllowAnonymous]`

---

### IssueListDocinfo Model — Full Schema

**Table:** `Issue_List_Docinfo`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `PartNumber` | NVARCHAR | Part number this doc-info belongs to |
| `Issue_number` | NVARCHAR | Issue identifier (links all issue tables) |
| `Issue_title` | NVARCHAR | Short title for the issue |
| `Issue_description` | NVARCHAR | Detailed description of the problem |
| `Initiator` | NVARCHAR | Person who opened/initiated the issue |
| `Owner` | NVARCHAR | Person responsible for resolving the issue |
| `Material` | NVARCHAR | Material specification or material grade |
| `PDEF_Number_RH` | NVARCHAR | PDEF (Part Drawing/Engineering File) number — Right-Hand |
| `PDEF_Number_LH` | NVARCHAR | PDEF number — Left-Hand |
| `LA_Num_RH` | NVARCHAR | LA (Launch Approval?) number — Right-Hand |
| `LA_Num_LH` | NVARCHAR | LA number — Left-Hand |
| `PA_Num_RH` | NVARCHAR | PA (Part Approval?) number — Right-Hand |
| `PA_Num_LH` | NVARCHAR | PA number — Left-Hand |
| `Created_by` | NVARCHAR | UserId of creator |
| `Derogation_sht_num` | NVARCHAR | Derogation sheet number (temporary deviation approval) |
| `Date_Opened` | DATETIME | Date the issue was formally opened |
| `Req_Completion_Date` | DATETIME | Requested completion/resolution date |
| `Date_Closed` | DATETIME | Actual date the issue was closed (null = still open) |
| `Created_date` | DATETIME | Record creation timestamp |
| `Modified_by` | NVARCHAR | UserId of last modifier |
| `Modified_date` | DATETIME | Last modification timestamp |
| `Status` | NVARCHAR | Open / Closed / In Progress / etc. |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR | Reserved |
| `Flag3` | NVARCHAR | Reserved |

### Domain Notes

- **PDEF** = Part Design Engineering File number. Each part may have separate RH and LH PDEF numbers.
- **LA** = Launch Approval number. Formal approval reference.
- **PA** = Part Approval number. Sign-off reference.
- **Derogation Sheet** = Temporary deviation from specification. If present, `Derogation_sht_num` links to the formal deviation document.
- `Date_Opened` and `Date_Closed` define the lifecycle of the issue. If `Date_Closed` is null, the issue is still open.
- `Req_Completion_Date` is the target date for resolution, used in milestone tracking.

---

### GET /api/issuelistdocinfos
Returns all document-info records across all issues and parts.

**Response:** `200 OK` — array of IssueListDocinfo objects.

---

### GET /api/issuelistdocinfos/{id}
Returns a single record by `Uid`.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### GET /api/issuelistdocinfos/byIssueNumber/{issueNumber}
Returns all doc-info records for a given issue number.

**Filter:** `Issue_number == issueNumber` (exact match).

---

### GET /api/issuelistdocinfos/byPartNumber/{partNumber}
Returns all doc-info records for a given part number.

**Filter:** `PartNumber == partNumber` (exact match).

---

### POST /api/issuelistdocinfos
Creates a new doc-info record.

**Response:** `201 Created`

---

### PUT /api/issuelistdocinfos/{id}
Full update of a doc-info record.

**Responses:**
- `200 OK`
- `404 Not Found`

---

### DELETE /api/issuelistdocinfos/{id}
Hard-deletes a doc-info record.

**Responses:**
- `204 No Content`
- `404 Not Found`

---

## PART B: Issue List Part Info API

**Base Route:** `/api/issuelistpartinfos`

---

### IssueListPartinfo Model — Full Schema

**Table:** `Issue_List_Partinfo`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `PartNumber` | NVARCHAR | Part number |
| `Issue_number` | NVARCHAR | Issue identifier |
| `Part_Revision_RH` | NVARCHAR | Drawing revision level for the RH part |
| `Part_Revision_LH` | NVARCHAR | Drawing revision level for the LH part |
| `Maturity_State_RH` | NVARCHAR | Engineering maturity state for RH part (e.g. "Prototype", "SOP", "DVP") |
| `Maturity_State_LH` | NVARCHAR | Engineering maturity state for LH part |
| `Picture_rh` | NVARCHAR | URL or base64 of the RH part image/photo |
| `Picture_lh` | NVARCHAR | URL or base64 of the LH part image/photo |
| `Proposals` | NVARCHAR | Proposed solutions or corrective actions (free text or structured) |
| `Solutions` | NVARCHAR | Implemented solutions (free text) |
| `Comments_on_picture_LH` | NVARCHAR | Annotations or observations on the LH part image |
| `Comments_on_picture_RH` | NVARCHAR | Annotations or observations on the RH part image |
| `Created_by` | NVARCHAR | UserId of creator |
| `Created_date` | DATETIME | Creation timestamp |
| `Modified_by` | NVARCHAR | Last modifier |
| `Modified_date` | DATETIME | Last modification timestamp |
| `Status` | NVARCHAR | Record status |
| `Flag1` | NVARCHAR | Reserved |
| `Flag2` | NVARCHAR | Reserved |
| `Flag3` | NVARCHAR | Reserved |

### Domain Notes

- **Part_Revision**: Engineering drawing revision letter (e.g. "A", "B", "C1"). Tracks which version of the drawing is in effect.
- **Maturity_State**: Indicates where in the product development cycle the part is (e.g. "Proto", "Pilot", "DVP", "SOP"). Critical for milestone alignment.
- **Picture fields** (`Picture_rh`, `Picture_lh`): May contain server-relative URL paths (`/uploads/dmrs/...`) or base64 data URLs depending on workflow.
- **Proposals / Solutions**: Free-text fields capturing the corrective action workflow. Proposals are candidate fixes; Solutions are confirmed implementations.

---

### GET /api/issuelistpartinfos
Returns all part-info records.

### GET /api/issuelistpartinfos/{id}
Returns a record by `Uid`.

### GET /api/issuelistpartinfos/byIssueNumber/{issueNumber}
Returns all part-info records for a given issue number.

### GET /api/issuelistpartinfos/byPartNumber/{partNumber}
Returns all part-info records for a given part number.

### POST /api/issuelistpartinfos
Creates a new part-info record. **Response:** `201 Created`

### PUT /api/issuelistpartinfos/{id}
Full update. **Responses:** `200 OK` / `404 Not Found`

### DELETE /api/issuelistpartinfos/{id}
Hard-delete. **Responses:** `204 No Content` / `404 Not Found`

---

## PART C: Issue List Checklist API

**Base Route:** `/api/issuelistchecklists`

These records represent the actual responses to checklist checkpoints for a specific issue and part. Each row corresponds to one checkpoint (identified by `Checlist_id` → `ChecklistMasterEntity.ChkId`) applied to one issue/part.

---

### IssueListChecklist Model — Full Schema

**Table:** `Issue_list_checklist`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `PartNumber` | NVARCHAR | Part number this checklist response is for |
| `Issue_number` | NVARCHAR | Issue identifier |
| `Checlist_id` | NVARCHAR | Checkpoint ID (note: typo in DB — `Checlist_id` not `Checklist_id`). References `ChecklistMasterEntity.ChkId` |
| `Checklist_Desc` | NVARCHAR | Description of the checkpoint (denormalised from ChecklistMaster for display) |
| `Status` | NVARCHAR | Response status (e.g. "OK", "NOK", "N/A", "Pending") |
| `RH` | NVARCHAR | Right-Hand response/status for this checkpoint |
| `LH` | NVARCHAR | Left-Hand response/status for this checkpoint |
| `Remarks_RH` | NVARCHAR(MAX) | Free-text remarks or observations for the RH response |
| `Remarks_LH` | NVARCHAR(MAX) | Free-text remarks or observations for the LH response |
| `CreatedBy` | NVARCHAR | UserId of creator |
| `CreatedDate` | DATETIME | Creation timestamp |
| `ModifiedBy` | NVARCHAR | Last modifier |
| `ModifiedDate` | DATETIME | Last modification timestamp |

### Domain Notes

- **Checlist_id**: This field name contains a typo from the original database schema. It references the `ChkId` field on `ChecklistMasterEntity`. The relationship is: each checklist template item (`ChecklistMasterEntity.ChkId`) maps to issue-specific response rows (`IssueListChecklist.Checlist_id`).
- **RH / LH status values**: Typically `"OK"`, `"NOK"`, `"N/A"`, or empty/null (not yet evaluated).
- **Remarks**: Added via `DbSeeder.EnsureTablesAsync()` — these columns may not exist in older database installations and are added automatically on startup if missing.
- **Status field**: Represents the overall status of the checklist item for this issue (may be `"OK"`, `"NOK"`, `"Pending"`, `"N/A"`).

---

### GET /api/issuelistchecklists
Returns all issue checklist records.

### GET /api/issuelistchecklists/{id}
Returns a record by `Uid`.

### GET /api/issuelistchecklists/byIssueNumber/{issueNumber}
Returns all checklist records for a given issue number.

### GET /api/issuelistchecklists/byPartNumber/{partNumber}
Returns all checklist records for a given part number.

### POST /api/issuelistchecklists
Creates a new checklist response record. **Response:** `201 Created`

### PUT /api/issuelistchecklists/{id}
Full update. **Responses:** `200 OK` / `404 Not Found`

### DELETE /api/issuelistchecklists/{id}
Hard-delete. **Responses:** `204 No Content` / `404 Not Found`

---

## PART D: Issue List History API

**Base Route:** `/api/issuelisthistories`

History records form the immutable audit trail for issues. Each time an issue is modified, a new history record is appended. History records should never be updated or deleted in normal operation (but the API allows it for admin correction).

---

### IssueListHistory Model — Full Schema

**Table:** `Issue_list_history`

| Field | DB Type | Description |
|---|---|---|
| `Uid` | NVARCHAR PK | Unique record identifier |
| `PartNumber` | NVARCHAR | Part number associated with the change |
| `Issue_number` | NVARCHAR | Issue identifier |
| `Modified_by` | NVARCHAR | UserId of the person who made the change |
| `Modified_date` | DATETIME | Timestamp of the change (UTC) |
| `Flag1` | NVARCHAR | Reserved — may be used to store the type of change |
| `Flag2` | NVARCHAR | Reserved — may store the previous value or diff |
| `Flag3` | NVARCHAR | Reserved — additional change context |

### Domain Notes

- History records are append-only by convention. A new history row is inserted each time any issue data changes.
- `Modified_by` + `Modified_date` provide the who/when audit trail.
- `Flag1`, `Flag2`, `Flag3` can be used by the application to encode change type (e.g. `Flag1 = "Status changed"`, `Flag2 = "Old value"`, `Flag3 = "New value"`).

---

### GET /api/issuelisthistories
Returns all history records (all issues, all parts).

### GET /api/issuelisthistories/{id}
Returns a history record by `Uid`.

### GET /api/issuelisthistories/byIssueNumber/{issueNumber}
Returns all history records for a given issue number, sorted implicitly by database order (no explicit ordering in service layer — results are in insertion order).

### POST /api/issuelisthistories
Creates a new history record (append).

**Important:** Callers must set `Modified_by` and `Modified_date` to accurately record when and who made the change.

**Response:** `201 Created`

### PUT /api/issuelisthistories/{id}
Updates an existing history record (admin correction only — use sparingly).

### DELETE /api/issuelisthistories/{id}
Hard-deletes a history record (admin only).

---

## Complete Issue Workflow Example

```
1. Issue is created by linking it to a project:
   POST /api/projectissuelinks
   { "Project": "{projectUid}", "Issue_number": "ISS-0042", "PartNumber": "PN-8801",
     "Part_number_RH": "PN-8801-RH", "Part_number_LH": "PN-8801-LH", ... }

2. Document header is saved:
   POST /api/issuelistdocinfos
   { "Issue_number": "ISS-0042", "PartNumber": "PN-8801",
     "Issue_title": "Surface finish defect", "Initiator": "john.doe@stellantis.com",
     "Date_Opened": "2026-05-27T00:00:00Z", "Status": "Open", ... }

3. Part information is saved:
   POST /api/issuelistpartinfos
   { "Issue_number": "ISS-0042", "PartNumber": "PN-8801",
     "Part_Revision_RH": "B", "Maturity_State_RH": "DVP",
     "Picture_rh": "/uploads/dmrs/abc123.jpg", ... }

4. Checklist responses are filled in (one per checkpoint):
   POST /api/issuelistchecklists
   { "Issue_number": "ISS-0042", "PartNumber": "PN-8801",
     "Checlist_id": "CHK-101", "Status": "NOK",
     "RH": "NOK", "LH": "OK",
     "Remarks_RH": "Scratch visible on front face", ... }

5. History is recorded on each modification:
   POST /api/issuelisthistories
   { "Issue_number": "ISS-0042", "PartNumber": "PN-8801",
     "Modified_by": "john.doe@stellantis.com",
     "Modified_date": "2026-05-27T10:30:00Z",
     "Flag1": "Status changed", "Flag2": "Open", "Flag3": "In Progress" }

6. DMRS checkpoints are tracked separately:
   POST /api/dmrschecklists  (see Document 05)
```
