/**
 * Centralized API client for ChecklistMaster.
 *
 * All requests go through `request()` which:
 *  - Prepends VITE_API_BASE_URL (empty in dev → Vite proxy handles /api/*)
 *  - Sends the HttpOnly auth cookie automatically (credentials: "include")
 *  - Parses the JSON response
 *  - Throws a structured ApiError on non-2xx so callers can catch and display it
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.data   = data;
  }
}

async function request(method, path, body, timeoutMs = 120_000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const init = { method, credentials: 'include', headers: {}, signal: ctrl.signal };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  try {
    const res  = await fetch(`${BASE}${path}`, init);
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (res.status === 401) {
      // Session expired or not authenticated — redirect to login
      if (!path.includes('/api/auth/')) {
        window.dispatchEvent(new CustomEvent('cm:session-expired'));
      }
      // Prefer backend message if present, else show a friendly default
      const msg = data?.message && typeof data.message === 'string'
        ? data.message
        : 'Session expired or invalid credentials. Please log in again.';
      throw new ApiError(msg, 401, data);
    }

    if (!res.ok) {
      throw new ApiError(
        data?.message ?? `HTTP ${res.status}`,
        res.status,
        data,
      );
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out — the payload may be too large. Try removing some images.',
        408,
        null,
      );
    }
    // If it's a network error (TypeError) or ApiError with status 408/500+, dispatch a global error event
    if (
      (err instanceof TypeError) ||
      (err instanceof ApiError && (err.status === 408 || err.status >= 500))
    ) {
      window.dispatchEvent(new CustomEvent('cm:server-down', { detail: err.message }));
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:         (username, password) => request('POST', '/api/auth/login',           { username, password }),
  logout:        ()                   => request('POST', '/api/auth/logout'),
  me:            ()                   => request('GET',  '/api/auth/me'),
  register:      (data)               => request('POST', '/api/auth/register',         data),
  validateEmail: (email)              => request('POST', '/api/auth/validate-email',   { email }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll:      ()         => request('GET',    '/api/users'),
  getById:     (id)       => request('GET',    `/api/users/${id}`),
  getByUserId: (userId)   => request('GET',    `/api/users/byUserId/${encodeURIComponent(userId)}`),
  getByRole:   (role)     => request('GET',    `/api/users/byRole/${encodeURIComponent(role)}`),
  create:      (data)     => request('POST',   '/api/users', data),
  update:      (id, data) => request('PUT',    `/api/users/${id}`, data),
  approve:     (id)       => request('PUT',    `/api/users/${id}/approve`),
  remove:      (id)       => request('DELETE', `/api/users/${id}`),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  getAll:  ()         => request('GET',    '/api/projects'),
  getById: (id)       => request('GET',    `/api/projects/${id}`),
  create:  (data)     => request('POST',   '/api/projects', data),
  update:  (id, data) => request('PUT',    `/api/projects/${id}`, data),
  remove:  (id)       => request('DELETE', `/api/projects/${id}`),
};

// ── Issue List – Doc Info ──────────────────────────────────────────────────────
export const issueDocApi = {
  getAll:  ()         => request('GET',    '/api/issuelistdocinfos'),
  getById: (id)       => request('GET',    `/api/issuelistdocinfos/${id}`),
  create:  (data)     => request('POST',   '/api/issuelistdocinfos', data),
  update:  (id, data) => request('PUT',    `/api/issuelistdocinfos/${id}`, data),
  remove:  (id)       => request('DELETE', `/api/issuelistdocinfos/${id}`),
};

// ── Issue List – Part Info ─────────────────────────────────────────────────────
export const issuePartApi = {
  getAll:         ()         => request('GET',    '/api/issuelistpartinfos'),
  getById:        (id)       => request('GET',    `/api/issuelistpartinfos/${id}`),
  byIssueNumber:  (n)        => request('GET',    `/api/issuelistpartinfos/byIssueNumber/${encodeURIComponent(n)}`),
  create:         (data)     => request('POST',   '/api/issuelistpartinfos', data),
  update:         (id, data) => request('PUT',    `/api/issuelistpartinfos/${id}`, data),
  remove:         (id)       => request('DELETE', `/api/issuelistpartinfos/${id}`),
};

// ── Issue List – History ───────────────────────────────────────────────────────
export const issueHistoryApi = {
  getAll:         ()         => request('GET',    '/api/issuelisthistories'),
  getById:        (id)       => request('GET',    `/api/issuelisthistories/${id}`),
  byIssueNumber:  (n)        => request('GET',    `/api/issuelisthistories/byIssueNumber/${encodeURIComponent(n)}`),
  create:         (data)     => request('POST',   '/api/issuelisthistories', data),
  update:         (id, data) => request('PUT',    `/api/issuelisthistories/${id}`, data),
  remove:         (id)       => request('DELETE', `/api/issuelisthistories/${id}`),
};


// ── Project–Issue Links ───────────────────────────────────────────────────────
export const projectIssueLinkApi = {
  getAll:        ()         => request('GET',    '/api/projectissuelinks'),
  getById:       (id)       => request('GET',    `/api/projectissuelinks/${id}`),
  byIssueNumber: (n)        => request('GET',    `/api/projectissuelinks/byIssueNumber/${encodeURIComponent(n)}`),
  byProject:     (uid)      => request('GET',    `/api/projectissuelinks/byProject/${encodeURIComponent(uid)}`),
  create:        (data)     => request('POST',   '/api/projectissuelinks', data),
  update:        (id, data) => request('PUT',    `/api/projectissuelinks/${id}`, data),
  remove:        (id)       => request('DELETE', `/api/projectissuelinks/${id}`),
};

// ── Azure AD / Graph ──────────────────────────────────────────────────────────
export const graphApi = {
  getUsers:    ()  => request('GET', '/api/graph/users'),
  searchUsers: (q) => request('GET', `/api/graph/users/search?q=${encodeURIComponent(q)}`),
};

// ── DMRS Checklists ───────────────────────────────────────────────────────────
export const dmrsApi = {
  getAll:         ()         => request('GET',    '/api/dmrschecklists'),
  getById:        (id)       => request('GET',    `/api/dmrschecklists/${id}`),
  byIssueNumber:  (n)        => request('GET',    `/api/dmrschecklists/byIssueNumber/${encodeURIComponent(n)}`),
  byPartNumber:   (n)        => request('GET',    `/api/dmrschecklists/byPartNumber/${encodeURIComponent(n)}`),
  create:         (data)     => request('POST',   '/api/dmrschecklists', data),
  update:         (id, data) => request('PUT',    `/api/dmrschecklists/${id}`, data),
  remove:         (id)       => request('DELETE', `/api/dmrschecklists/${id}`),

  /** Upload an image/PDF file. Returns { path: "/uploads/dmrs/filename.ext" } */
  uploadImage: async (file) => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${BASE}/api/dmrschecklists/upload`, {
        method: 'POST', credentials: 'include', body: form, signal: ctrl.signal,
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) throw new ApiError(data?.message ?? `HTTP ${res.status}`, res.status, data);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new ApiError('Upload timed out.', 408, null);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── Checklist Master ──────────────────────────────────────────────────────────
export const checklistMasterApi = {
  getAll:       ()            => request('GET',    '/api/checklistmaster'),
  getById:      (id)          => request('GET',    `/api/checklistmaster/${id}`),
  create:       (data)        => request('POST',   '/api/checklistmaster', data),
  createBatch:  (records)     => request('POST',   '/api/checklistmaster/batch', records),
  update:       (id, data)    => request('PUT',    `/api/checklistmaster/${id}`, data),
  remove:       (id)          => request('DELETE', `/api/checklistmaster/${id}`),

  /** Upload a file to /uploads/checklists/. Returns { path, fileName } */
  uploadFile: async (file) => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${BASE}/api/checklistmaster/upload`, {
        method: 'POST', credentials: 'include', body: form, signal: ctrl.signal,
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) throw new ApiError(data?.message ?? `HTTP ${res.status}`, res.status, data);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new ApiError('Upload timed out.', 408, null);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── Checklist Milestones ──────────────────────────────────────────────────────
export const checklistMilestoneApi = {
  getAll:          ()         => request('GET',    '/api/checklistmilestones'),
  getById:         (id)       => request('GET',    `/api/checklistmilestones/${id}`),
  byDepartment:    (dept)     => request('GET',    `/api/checklistmilestones/byDepartment/${encodeURIComponent(dept)}`),
  byChkId:         (chkId)    => request('GET',    `/api/checklistmilestones/byChkId/${encodeURIComponent(chkId)}`),
  byMilestoneId:   (mid)      => request('GET',    `/api/checklistmilestones/byMilestoneId/${encodeURIComponent(mid)}`),
  create:          (data)     => request('POST',   '/api/checklistmilestones', data),
  update:          (id, data) => request('PUT',    `/api/checklistmilestones/${id}`, data),
  remove:          (id)       => request('DELETE', `/api/checklistmilestones/${id}`),
};

// ── Component Metadata ────────────────────────────────────────────────────────
export const componentMetaApi = {
  getAll:  ()         => request('GET',    '/api/componentmetadata'),
  getById: (id)       => request('GET',    `/api/componentmetadata/${id}`),
  create:  (data)     => request('POST',   '/api/componentmetadata', data),
  update:  (id, data) => request('PUT',    `/api/componentmetadata/${id}`, data),
  remove:  (id)       => request('DELETE', `/api/componentmetadata/${id}`),
};

// ── Part Milestones ───────────────────────────────────────────────────────────
export const partMilestoneApi = {
  getAll:         ()            => request('GET',    '/api/partmilestones'),
  getById:        (uid)         => request('GET',    `/api/partmilestones/${uid}`),
  byIssueNumber:  (issueNum)    => request('GET',    `/api/partmilestones/byIssueNumber/${encodeURIComponent(issueNum)}`),
  byProject:      (projectUid)  => request('GET',    `/api/partmilestones/byProject/${encodeURIComponent(projectUid)}`),
  create:         (data)        => request('POST',   '/api/partmilestones', data),
  update:         (uid, data)   => request('PUT',    `/api/partmilestones/${uid}`, data),
  remove:         (uid)         => request('DELETE', `/api/partmilestones/${uid}`),
  bulkUpsert:     (issueNum, data) => request('PUT',  `/api/partmilestones/byIssueNumber/${encodeURIComponent(issueNum)}`, data),
};

// ── Project Milestones ────────────────────────────────────────────────────────
export const projectMilestoneApi = {
  getAll:      ()                   => request('GET',    '/api/projectmilestones'),
  getById:     (uid)                => request('GET',    `/api/projectmilestones/${uid}`),
  byProject:   (projectUid)         => request('GET',    `/api/projectmilestones/byProject/${encodeURIComponent(projectUid)}`),
  create:      (data)               => request('POST',   '/api/projectmilestones', data),
  update:      (uid, data)          => request('PUT',    `/api/projectmilestones/${uid}`, data),
  remove:      (uid)                => request('DELETE', `/api/projectmilestones/${uid}`),
  bulkUpsert:  (projectUid, data)   => request('PUT',    `/api/projectmilestones/byProject/${encodeURIComponent(projectUid)}`, data),
};

// ── Milestone Master ───────────────────────────────────────────────────────────
export const milestoneMasterApi = {
  getAll:    ()            => request('GET',    '/api/milestonemaster'),
  getActive: ()            => request('GET',    '/api/milestonemaster/active'),
  getById:   (uid)         => request('GET',    `/api/milestonemaster/${uid}`),
  create:    (data)        => request('POST',   '/api/milestonemaster', data),
  update:    (uid, data)   => request('PUT',    `/api/milestonemaster/${uid}`, data),
  remove:    (uid)         => request('DELETE', `/api/milestonemaster/${uid}`),
};

// ── Project Robustness Report ─────────────────────────────────────────────────
export const projectReportApi = {
  getReport: (projectUid) => request('GET', `/api/projectreport/${encodeURIComponent(projectUid)}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
// Fire-and-forget: trigger(eventType, entityType, entityId, triggeredBy)
// eventType: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'STATUS_CHANGED'
export const notificationsApi = {
  trigger: (eventType, entityType, entityId, triggeredBy) =>
    request('POST', '/api/notifications/trigger', { eventType, entityType, entityId, triggeredBy }),
};

// ── Calendar Events ───────────────────────────────────────────────────────────
export const calendarApi = {
  getAll:    ()            => request('GET',    '/api/calendarevents'),
  getByUser: (userId)      => request('GET',    `/api/calendarevents/byUser/${encodeURIComponent(userId)}`),
  getById:   (uid)         => request('GET',    `/api/calendarevents/${uid}`),
  create:    (data)        => request('POST',   '/api/calendarevents', data),
  update:    (uid, data)   => request('PUT',    `/api/calendarevents/${uid}`, data),
  remove:    (uid)         => request('DELETE', `/api/calendarevents/${uid}`),
};
