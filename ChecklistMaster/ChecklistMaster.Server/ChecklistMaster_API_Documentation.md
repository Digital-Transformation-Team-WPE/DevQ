# ChecklistMaster Backend API Documentation

> **This file is a summary index. Full documentation is in the `Docs/` folder.**

---

## Documentation Set

| Document | Description |
|---|---|
| [Docs/01_Overview_And_Architecture.md](Docs/01_Overview_And_Architecture.md) | System overview, entity relationships, roles, auth flow, conventions |
| [Docs/02_Authentication_API.md](Docs/02_Authentication_API.md) | Login, logout, register, bootstrap, Microsoft SSO — step-by-step business logic |
| [Docs/03_Users_And_Projects_API.md](Docs/03_Users_And_Projects_API.md) | Users, Projects, ProjectIssueLinks — all fields and endpoints |
| [Docs/04_Issue_List_API.md](Docs/04_Issue_List_API.md) | IssueListDocinfo, IssueListPartinfo, IssueListChecklist, IssueListHistory |
| [Docs/05_Checklist_Master_And_DMRS_API.md](Docs/05_Checklist_Master_And_DMRS_API.md) | ChecklistMaster (templates, batch import, file upload), DMRS (SyncData JSON) |
| [Docs/06_Milestones_API.md](Docs/06_Milestones_API.md) | ChecklistMilestones, PartMilestones, ProjectMilestones — bulk upsert transactions |
| [Docs/07_Component_Metadata_And_Field_Reference.md](Docs/07_Component_Metadata_And_Field_Reference.md) | ComponentMetadata dropdowns, all field schemas, error handling, security notes |

---

## Quick Reference: All API Routes

### Authentication (`/api/auth`)
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/login | None | Login with credentials; sets cm_auth cookie |
| POST | /api/auth/logout | None | Clears cm_auth cookie |
| GET | /api/auth/me | Authorize | Returns current user from JWT |
| POST | /api/auth/validate-email | None | Check email domain validity |
| POST | /api/auth/register | None | Self-registration (creates Inactive account) |
| POST | /api/auth/bootstrap | None | One-time first-admin creation |
| GET | /api/auth/microsoft/login | None | Start Microsoft OAuth2 flow |
| GET | /api/auth/microsoft/callback | None | OAuth2 callback; issues cm_auth cookie |
| GET | /api/auth/microsoft/admin-consent | None | Azure AD admin consent redirect |

### Users (`/api/users`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/users | All users |
| GET | /api/users/{id} | User by UId |
| GET | /api/users/byUserId/{userId} | User by UserId or EmailId |
| GET | /api/users/byRole/{role} | Users by role |
| POST | /api/users | Create user |
| PUT | /api/users/{id} | Update user |
| PUT | /api/users/{id}/approve | Approve (set Status=Active) |
| PATCH | /api/users/{id}/change-password | Change password |
| PATCH | /api/users/{id}/profile | Update name/email |
| DELETE | /api/users/{id} | Delete user |

### Projects (`/api/projects`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/projects | All projects |
| GET | /api/projects/{id} | Project by Uid |
| GET | /api/projects/byCreatedBy/{createdBy} | Projects by creator |
| POST | /api/projects | Create project |
| PUT | /api/projects/{id} | Update project |
| DELETE | /api/projects/{id} | Delete project |

### Project-Issue Links (`/api/projectissuelinks`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/projectissuelinks | All links |
| GET | /api/projectissuelinks/{id} | Link by Uid |
| GET | /api/projectissuelinks/byProject/{uid} | Links by project Uid |
| GET | /api/projectissuelinks/byIssueNumber/{issueNumber} | Links by issue number |
| POST | /api/projectissuelinks | Create link |
| PUT | /api/projectissuelinks/{id} | Update link |
| DELETE | /api/projectissuelinks/{id} | Delete link |

### Issue List Doc Info (`/api/issuelistdocinfos`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/issuelistdocinfos | All records |
| GET | /api/issuelistdocinfos/{id} | By Uid |
| GET | /api/issuelistdocinfos/byIssueNumber/{issueNumber} | By issue number |
| GET | /api/issuelistdocinfos/byPartNumber/{partNumber} | By part number |
| POST | /api/issuelistdocinfos | Create |
| PUT | /api/issuelistdocinfos/{id} | Update |
| DELETE | /api/issuelistdocinfos/{id} | Delete |

### Issue List Part Info (`/api/issuelistpartinfos`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/issuelistpartinfos | All records |
| GET | /api/issuelistpartinfos/{id} | By Uid |
| GET | /api/issuelistpartinfos/byIssueNumber/{issueNumber} | By issue number |
| GET | /api/issuelistpartinfos/byPartNumber/{partNumber} | By part number |
| POST | /api/issuelistpartinfos | Create |
| PUT | /api/issuelistpartinfos/{id} | Update |
| DELETE | /api/issuelistpartinfos/{id} | Delete |

### Issue List Checklists (`/api/issuelistchecklists`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/issuelistchecklists | All records |
| GET | /api/issuelistchecklists/{id} | By Uid |
| GET | /api/issuelistchecklists/byIssueNumber/{issueNumber} | By issue number |
| GET | /api/issuelistchecklists/byPartNumber/{partNumber} | By part number |
| POST | /api/issuelistchecklists | Create |
| PUT | /api/issuelistchecklists/{id} | Update |
| DELETE | /api/issuelistchecklists/{id} | Delete |

### Issue List Histories (`/api/issuelisthistories`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/issuelisthistories | All records |
| GET | /api/issuelisthistories/{id} | By Uid |
| GET | /api/issuelisthistories/byIssueNumber/{issueNumber} | By issue number |
| POST | /api/issuelisthistories | Create (append audit entry) |
| PUT | /api/issuelisthistories/{id} | Update (admin only) |
| DELETE | /api/issuelisthistories/{id} | Delete (admin only) |

### Checklist Master (`/api/checklistmaster`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/checklistmaster | All records |
| GET | /api/checklistmaster/{id} | By Uid |
| GET | /api/checklistmaster/byZone/{zone} | By zone |
| GET | /api/checklistmaster/byArea/{area} | By area |
| GET | /api/checklistmaster/byDepartment/{department} | By department |
| POST | /api/checklistmaster | Create single record |
| POST | /api/checklistmaster/batch | Batch create (returns created/failed counts) |
| POST | /api/checklistmaster/upload | Upload file (returns path + fileName) |
| PUT | /api/checklistmaster/{id} | Update |
| DELETE | /api/checklistmaster/{id} | Delete |

### DMRS Checklists (`/api/dmrschecklists`)
| Method | Route | Purpose |
|---|---|---|
| POST | /api/dmrschecklists/upload | Upload image (returns path only) |
| GET | /api/dmrschecklists | All records |
| GET | /api/dmrschecklists/{id} | By Uid |
| GET | /api/dmrschecklists/byIssueNumber/{issueNumber} | By issue number |
| GET | /api/dmrschecklists/byPartNumber/{partNumber} | By part number |
| POST | /api/dmrschecklists | Create |
| PUT | /api/dmrschecklists/{id} | Update |
| DELETE | /api/dmrschecklists/{id} | Delete |

### Checklist Milestones (`/api/checklistmilestones`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/checklistmilestones | All records |
| GET | /api/checklistmilestones/{id} | By Uid |
| GET | /api/checklistmilestones/byDepartment/{department} | By department |
| GET | /api/checklistmilestones/byChkId/{chkId} | By checkpoint ID |
| GET | /api/checklistmilestones/byMilestoneId/{milestoneId} | By milestone ID |
| POST | /api/checklistmilestones | Create |
| PUT | /api/checklistmilestones/{id} | Update |
| DELETE | /api/checklistmilestones/{id} | Delete |

### Part Milestones (`/api/partmilestones`) — [Authorize]
| Method | Route | Purpose |
|---|---|---|
| GET | /api/partmilestones | All records |
| GET | /api/partmilestones/{uid} | By Uid |
| GET | /api/partmilestones/byIssueNumber/{issueNumber} | By issue (ordered by MilestoneOrder) |
| GET | /api/partmilestones/byProject/{projectUid} | By project (ordered by MilestoneOrder) |
| POST | /api/partmilestones | Create single |
| PUT | /api/partmilestones/{uid} | Update single |
| PUT | /api/partmilestones/byIssueNumber/{issueNumber} | **Bulk upsert** (replaces all rows for issue) |
| DELETE | /api/partmilestones/{uid} | Delete single |

### Project Milestones (`/api/projectmilestones`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/projectmilestones | All records |
| GET | /api/projectmilestones/{uid} | By Uid |
| GET | /api/projectmilestones/byProject/{projectUid} | By project (ordered by MilestoneOrder) |
| POST | /api/projectmilestones | Create single |
| PUT | /api/projectmilestones/{uid} | Update single |
| PUT | /api/projectmilestones/byProject/{projectUid} | **Bulk upsert** (replaces all rows for project) |
| DELETE | /api/projectmilestones/{uid} | Delete single |

### Component Metadata (`/api/componentmetadata`)
| Method | Route | Purpose |
|---|---|---|
| GET | /api/componentmetadata | All records (dropdown data) |
| GET | /api/componentmetadata/{id} | By integer Ouid |
| GET | /api/componentmetadata/byComponentCode/{code} | By component code |
| GET | /api/componentmetadata/byLanguage/{language} | By language code (int) |
| POST | /api/componentmetadata | Create |
| PUT | /api/componentmetadata/{id} | Update |
| DELETE | /api/componentmetadata/{id} | Delete |

---

## Key Business Rules (Quick Reference)

1. **User Registration Flow:** `POST /register` → Status=Inactive → Admin calls `PUT /{id}/approve` → Status=Active → User logs in with default password `Pass@May2026`.
2. **Bulk Upsert:** Both `PUT /partmilestones/byIssueNumber/{n}` and `PUT /projectmilestones/byProject/{id}` delete any DB rows whose UID is not in the request payload. Always send the complete set.
3. **Password hashing:** Never stored in plain text. Format: `PBKDF2:{salt}:{hash}`. Any value not starting with `PBKDF2:` is automatically hashed by the API.
4. **Session cookie:** `cm_auth` (HttpOnly, Secure, SameSite=Lax). Call `GET /api/auth/me` to restore session after page refresh.
5. **Batch import:** `POST /checklistmaster/batch` returns `200 OK` even on partial failure. Always check `failed` count in response.
6. **SyncData JSON:** `DmrsChecklist.SyncData` format: `{"Milestone Name": "result|comment", ...}` — pipe-separated result and comment per milestone.
7. **ChecklistMaster file storage:** `RefDocument` = `{"fileName":"...", "data":"data:...;base64,..."}`. `Images` = `["data:image/png;base64,..."]`.
8. **IssueListChecklist.Checlist_id:** Note the typo — `Checlist_id` (one 'k') is the correct DB column name. It references `ChecklistMasterEntity.ChkId`.
9. **PartMilestone columns:** DB columns `Flag1`/`Flag2` map to C# properties `Department`/`Owner`. JSON serialisation uses `department`/`owner`.
10. **ComponentMetadata primary key:** `Ouid` is an integer, not a string GUID. Routes use `{id:int}` constraint.
