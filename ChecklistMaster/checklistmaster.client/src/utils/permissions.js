/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RBAC — Role-Based Access Control matrix
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Role         Department   Scope
 *  -----------  -----------  --------------------------------------------------
 *  Admin        —            Full control over everything
 *  AVP_Admin    AVP          Full control over all AVP activities & checklists
 *  WGDE_Admin   WGDE         Full control over all WGDE activities & checklists
 *  AVP_User     AVP          Create + edit their OWN issues only
 *  WGDE_User    WGDE         Create + edit their OWN issues only
 *  Viewer       —            Read-only on every page they can reach
 *
 *  "ownOnly" roles (AVP_User, WGDE_User) may only mutate records where
 *    record.created_by === userId  OR  record.createdBy === userId
 */

// ── Role constants ────────────────────────────────────────────────────────────
export const ROLE = {
  Admin:      'Admin',
  AVP_Admin:  'AVP_Admin',
  WGDE_Admin: 'WGDE_Admin',
  AVP_User:   'AVP_User',
  WGDE_User:  'WGDE_User',
  Viewer:     'Viewer',
};

// ── Module-level access (which roles may VISIT the page) ─────────────────────
export const MODULE_ROLES = {
  users:      [ROLE.Admin, ROLE.AVP_Admin],
  projects:   [ROLE.Admin, ROLE.AVP_Admin, ROLE.WGDE_Admin, ROLE.AVP_User, ROLE.WGDE_User, ROLE.Viewer],
  issues:     [ROLE.Admin, ROLE.AVP_Admin, ROLE.WGDE_Admin, ROLE.AVP_User, ROLE.WGDE_User, ROLE.Viewer],
  checklists: [ROLE.Admin, ROLE.WGDE_Admin, ROLE.WGDE_User, ROLE.Viewer],
  milestones: [ROLE.Admin, ROLE.WGDE_Admin, ROLE.WGDE_User],
  dmrs:       [ROLE.Admin, ROLE.WGDE_Admin, ROLE.WGDE_User, ROLE.Viewer],
  reports:    [ROLE.Admin, ROLE.AVP_Admin, ROLE.WGDE_Admin, ROLE.AVP_User, ROLE.Viewer],
  settings:   [ROLE.Admin, ROLE.AVP_Admin, ROLE.WGDE_Admin, ROLE.AVP_User, ROLE.WGDE_User, ROLE.Viewer],
};

// ── Per-role action capabilities ──────────────────────────────────────────────
// create / edit / delete: '*' = all modules  |  string[] = only listed modules
const CAPS = {
  [ROLE.Admin]: {
    create: '*', edit: '*', delete: '*',
    ownOnly: false, dept: null,
  },
  [ROLE.AVP_Admin]: {
    create: ['users', 'projects', 'issues'],
    edit:   ['users', 'projects', 'issues'],
    delete: ['projects', 'issues'],
    ownOnly: false, dept: 'AVP',
  },
  [ROLE.WGDE_Admin]: {
    create: ['projects', 'issues', 'checklists', 'milestones', 'dmrs'],
    edit:   ['projects', 'issues', 'checklists', 'milestones', 'dmrs'],
    delete: ['projects', 'issues', 'checklists', 'milestones', 'dmrs'],
    ownOnly: false, dept: 'WGDE',
  },
  [ROLE.AVP_User]: {
    create: ['issues'],
    edit:   ['issues'],
    delete: [],
    ownOnly: true, dept: 'AVP',
  },
  [ROLE.WGDE_User]: {
    create: ['dmrs'],
    edit:   ['dmrs'],
    delete: [],
    ownOnly: true, dept: 'WGDE',
  },
  [ROLE.Viewer]: {
    create: [], edit: [], delete: [],
    ownOnly: false, dept: null,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCaps = role => CAPS[role] ?? CAPS[ROLE.Viewer];
const inList  = (list, mod) => list === '*' || (Array.isArray(list) && list.includes(mod));
const isOwner = (record, userId) =>
  !!userId && !!record && ((record.created_by ?? record.createdBy) === userId);

// Modules where AVP_Admin / WGDE_Admin are restricted to their own department's records
const DEPT_SCOPED = new Set(['checklists', 'milestones']);

/** True when a dept-scoped admin's department matches the record's department. */
const deptAllowed = (c, record, module) => {
  if (!c.dept || !record) return true;          // unrestricted role or no record
  if (!DEPT_SCOPED.has(module)) return true;    // guard only on relevant modules
  const rd = (record.department ?? '').toLowerCase().trim();
  if (!rd || rd === 'common' || rd === 'all') return true; // unset / common = allowed
  return rd === c.dept.toLowerCase();
};

// ── Public helpers ────────────────────────────────────────────────────────────

/** True if the role may navigate to / load this module's page. */
export const canAccess = (role, module) =>
  (MODULE_ROLES[module] ?? Object.values(ROLE)).includes(role);

/** True if the role may create new records in this module. */
export const canCreate = (role, module) =>
  inList(getCaps(role).create, module);

/**
 * True if the role may edit `record` in this module.
 * — ownOnly roles: record must be owned by userId
 * — dept-scoped admins (AVP_Admin / WGDE_Admin): checklists & milestones must
 *   belong to their department
 */
export const canEdit = (role, module, record = null, userId = null) => {
  const c = getCaps(role);
  if (!inList(c.edit, module)) return false;
  if (c.ownOnly) return isOwner(record, userId);
  if (DEPT_SCOPED.has(module)) return deptAllowed(c, record, module);
  return true;
};

/**
 * True if the role may delete / deactivate `record` in this module.
 * Same department restrictions apply as for canEdit.
 */
export const canDelete = (role, module, record = null, userId = null) => {
  const c = getCaps(role);
  if (!inList(c.delete, module)) return false;
  if (c.ownOnly) return isOwner(record, userId);
  if (DEPT_SCOPED.has(module)) return deptAllowed(c, record, module);
  return true;
};

/** Department tied to this role, or null for unrestricted roles. */
export const roleDept   = role => getCaps(role).dept;

/** True for roles that may only mutate their own records. */
export const isOwnOnly  = role => !!getCaps(role).ownOnly;

/** Display label for a role. */
export const roleLabel  = role => ({
  Admin:      'Administrator',
  AVP_Admin:  'AVP Administrator',
  WGDE_Admin: 'WGDE Administrator',
  AVP_User:   'AVP User',
  WGDE_User:  'WGDE User',
  Viewer:     'Viewer',
}[role] ?? role);

/** Badge colour for a role. */
export const roleColor  = role => ({
  Admin:      '#3f51b5',
  AVP_Admin:  '#1565c0',
  WGDE_Admin: '#6a1b9a',
  AVP_User:   '#1565c0',
  WGDE_User:  '#6a1b9a',
  Viewer:     '#78909c',
}[role] ?? '#78909c');
