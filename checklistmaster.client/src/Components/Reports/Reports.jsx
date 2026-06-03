import { useState, useEffect, useMemo } from 'react';
import { projectsApi, issueDocApi, checklistMasterApi } from '../../services/apiService';
import { generateProjectsGridPdf, generateIssuesGridPdf, generateChecklistsGridPdf } from '../../utils/pdfReport';
import { exportToExcel } from '../../utils/excelUtils';
import '../../styles/module.css';

const PAGE_SIZE = 15;

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const DownloadIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const PdfIcon       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const FolderIcon    = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const AlertCircle   = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const ListIcon      = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const BarChartIcon  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const EmptyTableIc  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
const XIcon         = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = v =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusBadgeClass = s => ({
  Open:               'mod-badge-open',
  'In Progress':      'mod-badge-progress',
  'Completed Ok':     'mod-badge-completed-ok',
  'Completed Not Ok': 'mod-badge-completed-notok',
  Active:             'mod-badge-active',
  Inactive:           'mod-badge-inactive',
}[s] ?? 'mod-badge-viewer');

const StatusBadge = ({ v }) => (
  <span className={`mod-badge ${statusBadgeClass(v)}`}>{v || '—'}</span>
);

// ── Field normalisers ─────────────────────────────────────────────────────────
const normProject = p => ({
  ...p,
  uid:         p.uid         || p.Uid          || '',
  projectName: p.projectName || p.ProjectName  || '',
  program:     p.program     || p.Program      || '',
  plant:       p.plant       || p.Plant        || '',
  plant_year:  p.plant_year  || p.PlantYear    || '',
  status:      p.status      || p.Status       || 'Active',
  flag1:       p.flag1       || p.Flag1        || '',
  flag2:       p.flag2       || p.Flag2        || '',
  flag3:       p.flag3       || p.Flag3        || '',
  avp_owner:   p.flag1       || p.Flag1        || '',
  wgte_owner:  p.flag2       || p.Flag2        || '',
});

const normIssue = i => ({
  ...i,
  uid:                 i.uid                 || i.Uid                  || '',
  issue_number:        i.issue_number        || i.Issue_number         || '',
  issue_title:         i.issue_title         || i.Issue_title          || '',
  partNumber:          i.partNumber          || i.PartNumber           || '',
  owner:               i.owner               || i.Owner                || '',
  status:              i.status              || i.Status               || 'Open',
  flag2:               i.flag2               || i.Flag2                || '',
  date_Opened:         i.date_Opened         || i.Date_Opened          || null,
  req_Completion_Date: i.req_Completion_Date || i.Req_Completion_Date  || null,
});

const normChecklist = c => ({
  ...c,
  uid:            c.uid            || c.Uid            || '',
  chkId:          c.chkId          || c.ChkId          || '',
  checkPointS:    c.checkPointS    || c.CheckPointS    || '',
  checkpointDesc: c.checkpointDesc || c.CheckpointDesc || '',
  department:     c.department     || c.Department     || '',
  zone:           c.zone           || c.Zone           || '',
  category:       c.category       || c.Category       || '',
  mandatory:      c.mandatory      || c.Mandatory      || '',
  status:         c.status         || c.Status         || 'Active',
});

// ── Excel column definitions ──────────────────────────────────────────────────
const PRJ_XL = [
  { header: 'Project Name', key: 'projectName', width: 36 },
  { header: 'Program',      key: 'program',     width: 20 },
  { header: 'Plant',        key: 'plant',       width: 16 },
  { header: 'Year',         key: 'plant_year',  width: 10 },
  { header: 'AVP Owner',    key: 'avp_owner',   width: 22 },
  { header: 'WGDE Owner',   key: 'wgte_owner',  width: 22 },
  { header: 'Department',   key: 'flag3',       width: 16 },
  { header: 'Status',       key: 'status',      width: 14 },
];

const ISS_XL = [
  { header: 'Issue Number',  key: 'issue_number',        width: 22 },
  { header: 'Title',         key: 'issue_title',         width: 40 },
  { header: 'Part Number',   key: 'partNumber',          width: 20 },
  { header: 'Owner',         key: 'owner',               width: 20 },
  { header: 'Escalation',    key: 'flag2',               width: 16 },
  { header: 'Date Opened',   key: 'date_Opened',         width: 18 },
  { header: 'Due Date',      key: 'req_Completion_Date', width: 18 },
  { header: 'Status',        key: 'status',              width: 20 },
];

const CHK_XL = [
  { header: 'ID',          key: 'chkId',          width: 14 },
  { header: 'Checkpoint',  key: 'checkPointS',    width: 40 },
  { header: 'Description', key: 'checkpointDesc', width: 50 },
  { header: 'Department',  key: 'department',     width: 18 },
  { header: 'Zone',        key: 'zone',           width: 14 },
  { header: 'Category',    key: 'category',       width: 20 },
  { header: 'Mandatory',   key: 'mandatory',      width: 12 },
  { header: 'Status',      key: 'status',         width: 14 },
];

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const items = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      items.push(i);
    } else if (i === page - 2 || i === page + 2) {
      items.push('…');
    }
  }
  const seen = new Set();
  const deduped = items.filter(p => { if (seen.has(p)) return false; seen.add(p); return true; });

  return (
    <div className="mod-pagination">
      <button className="mod-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {deduped.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="mod-page-ellipsis">…</span>
          : <button key={p} className={`mod-page-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      )}
      <button className="mod-page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>›</button>
      <span className="mod-page-info">{total.toLocaleString()} records</span>
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function StatCard({ icon, iconBg, iconColor, label, total, badges, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--dash-card-bg)',
        borderRadius: 12,
        border: `2px solid ${active ? '#3f51b5' : 'var(--dash-border)'}`,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'border-color .2s, box-shadow .2s, transform .15s',
        boxShadow: active ? '0 4px 20px rgba(63,81,181,.18)' : '0 1px 6px rgba(0,0,0,.06)',
        transform: active ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          background: iconBg,
          borderRadius: 10,
          width: 46,
          height: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', lineHeight: 1 }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3, fontWeight: 500 }}>{label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {badges.map((b, i) => (
          <span key={i} className={`mod-badge ${b.cls}`}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [activeTab, setActiveTab] = useState('projects');
  const [search, setSearch]       = useState('');

  const [projects,   setProjects]   = useState([]);
  const [issues,     setIssues]     = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [loading,    setLoading]    = useState(false);

  // Per-tab filters
  const [prjStatus, setPrjStatus] = useState('');
  const [prjDept,   setPrjDept]   = useState('');
  const [issStatus, setIssStatus] = useState('');
  const [issEsc,    setIssEsc]    = useState('');
  const [chkStatus, setChkStatus] = useState('');
  const [chkMand,   setChkMand]   = useState('');

  // Pagination
  const [prjPage, setPrjPage] = useState(1);
  const [issPage, setIssPage] = useState(1);
  const [chkPage, setChkPage] = useState(1);

  const [exporting, setExporting] = useState(false);

  // ── Load all data in parallel ─────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      projectsApi.getAll(),
      issueDocApi.getAll(),
      checklistMasterApi.getAll(),
    ]).then(([prjRes, issRes, chkRes]) => {
      if (prjRes.status === 'fulfilled') {
        const raw = Array.isArray(prjRes.value) ? prjRes.value : (prjRes.value?.data ?? []);
        setProjects(raw.map(normProject));
      }
      if (issRes.status === 'fulfilled') {
        const raw = Array.isArray(issRes.value) ? issRes.value : (issRes.value?.data ?? []);
        setIssues(raw.map(normIssue));
      }
      if (chkRes.status === 'fulfilled') {
        const raw = Array.isArray(chkRes.value) ? chkRes.value : (chkRes.value?.data ?? []);
        setChecklists(raw.map(normChecklist));
      }
    }).finally(() => setLoading(false));
  }, []);

  // Reset pages when filters change
  useEffect(() => setPrjPage(1), [search, prjStatus, prjDept]);
  useEffect(() => setIssPage(1), [search, issStatus, issEsc]);
  useEffect(() => setChkPage(1), [search, chkStatus, chkMand]);

  // ── Filtered data ─────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      if (prjStatus && p.status?.toLowerCase() !== prjStatus.toLowerCase()) return false;
      if (prjDept) {
        const dept = (p.flag3 || '').toLowerCase();
        if (prjDept === 'AVP'  && !dept.includes('avp'))  return false;
        if (prjDept === 'WGDE' && !dept.includes('wgde')) return false;
        if (prjDept === 'Both' && !(dept.includes('avp') && dept.includes('wgde'))) return false;
      }
      if (!q) return true;
      return [p.projectName, p.program, p.plant, p.avp_owner, p.wgte_owner, p.flag3]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [projects, search, prjStatus, prjDept]);

  const filteredIssues = useMemo(() => {
    const q = search.toLowerCase();
    return issues.filter(i => {
      if (issStatus && i.status !== issStatus) return false;
      if (issEsc    && i.flag2  !== issEsc)    return false;
      if (!q) return true;
      return [i.issue_number, i.issue_title, i.partNumber, i.owner]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [issues, search, issStatus, issEsc]);

  const filteredChecklists = useMemo(() => {
    const q = search.toLowerCase();
    return checklists.filter(c => {
      if (chkStatus && c.status?.toLowerCase() !== chkStatus.toLowerCase()) return false;
      if (chkMand   && c.mandatory?.toLowerCase() !== chkMand.toLowerCase()) return false;
      if (!q) return true;
      return [c.chkId, c.checkPointS, c.checkpointDesc, c.department, c.zone, c.category]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [checklists, search, chkStatus, chkMand]);

  // Paginated slices
  const prjSlice = filteredProjects.slice((prjPage - 1) * PAGE_SIZE, prjPage * PAGE_SIZE);
  const issSlice = filteredIssues.slice((issPage - 1) * PAGE_SIZE,   issPage * PAGE_SIZE);
  const chkSlice = filteredChecklists.slice((chkPage - 1) * PAGE_SIZE, chkPage * PAGE_SIZE);

  // ── Stats ─────────────────────────────────────────────────────────
  const prjActive   = projects.filter(p => p.status?.toLowerCase() === 'active').length;
  const prjInactive = projects.length - prjActive;
  const issOpen     = issues.filter(i => i.status === 'Open').length;
  const issProgress = issues.filter(i => i.status === 'In Progress').length;
  const issComplete = issues.filter(i => i.status?.startsWith('Completed')).length;
  const chkActive   = checklists.filter(c => c.status?.toLowerCase() === 'active').length;
  const chkMandatory= checklists.filter(c => c.mandatory?.toLowerCase() === 'yes').length;

  // ── Handlers ─────────────────────────────────────────────────────
  const switchTab = tab => { setActiveTab(tab); setSearch(''); };

  const clearFilters = () => {
    setSearch('');
    setPrjStatus(''); setPrjDept('');
    setIssStatus(''); setIssEsc('');
    setChkStatus(''); setChkMand('');
  };

  const exportPdf = () => {
    setExporting(true);
    try {
      if (activeTab === 'projects') {
        generateProjectsGridPdf({ rows: filteredProjects, projectCodeOf: new Map(), filename: 'projects-report.pdf' });
      } else if (activeTab === 'issues') {
        generateIssuesGridPdf({ rows: filteredIssues, filename: 'issues-report.pdf' });
      } else {
        generateChecklistsGridPdf({ rows: filteredChecklists, filename: 'checklists-report.pdf' });
      }
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = () => {
    setExporting(true);
    try {
      if (activeTab === 'projects') {
        exportToExcel(filteredProjects, PRJ_XL, 'projects-report.xlsx');
      } else if (activeTab === 'issues') {
        exportToExcel(filteredIssues, ISS_XL, 'issues-report.xlsx');
      } else {
        exportToExcel(filteredChecklists, CHK_XL, 'checklists-report.xlsx');
      }
    } finally {
      setExporting(false);
    }
  };

  const tabCount = activeTab === 'projects'
    ? filteredProjects.length
    : activeTab === 'issues'
      ? filteredIssues.length
      : filteredChecklists.length;

  const hasFilters = search || prjStatus || prjDept || issStatus || issEsc || chkStatus || chkMand;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="mod-page">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="mod-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: '#eef0ff', borderRadius: 12,
            width: 48, height: 48, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#3f51b5', flexShrink: 0,
          }}>
            <BarChartIcon />
          </div>
          <div>
            <h1 className="mod-title">Reports</h1>
            <p className="mod-subtitle">Search, filter and export Projects, Issues and Checklists in one place</p>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards (also act as tab selectors) ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <StatCard
          icon={<FolderIcon />}
          iconBg="#eef0ff" iconColor="#3f51b5"
          label="Total Projects" total={projects.length}
          badges={[
            { cls: 'mod-badge-active',   label: `${prjActive} Active` },
            { cls: 'mod-badge-inactive', label: `${prjInactive} Inactive` },
          ]}
          active={activeTab === 'projects'}
          onClick={() => switchTab('projects')}
        />
        <StatCard
          icon={<AlertCircle />}
          iconBg="#e3f2fd" iconColor="#1565c0"
          label="Total Issues" total={issues.length}
          badges={[
            { cls: 'mod-badge-open',     label: `${issOpen} Open` },
            { cls: 'mod-badge-progress', label: `${issProgress} In Progress` },
            { cls: 'mod-badge-active',   label: `${issComplete} Completed` },
          ]}
          active={activeTab === 'issues'}
          onClick={() => switchTab('issues')}
        />
        <StatCard
          icon={<ListIcon />}
          iconBg="#f3e5f5" iconColor="#7b1fa2"
          label="Total Checklists" total={checklists.length}
          badges={[
            { cls: 'mod-badge-active',           label: `${chkActive} Active` },
            { cls: 'mod-badge-completed-notok',  label: `${chkMandatory} Mandatory` },
          ]}
          active={activeTab === 'checklists'}
          onClick={() => switchTab('checklists')}
        />
      </div>

      {/* ── Filter card ───────────────────────────────────────────── */}
      <div className="mod-filter-card">
        <div className="mod-filter-label">
          {activeTab === 'projects' ? 'Projects' : activeTab === 'issues' ? 'Issues' : 'Checklists'}
          {' '}— Search & Filter
        </div>
        <div className="mod-filter-row">

          {/* Global search */}
          <div className="mod-filter-field" style={{ flex: 2, minWidth: 220 }}>
            <label>Search</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, color: '#aaa', pointerEvents: 'none', display: 'flex' }}>
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'projects'   ? 'Name, program, plant, owner…'    :
                  activeTab === 'issues'     ? 'Issue #, title, part no, owner…' :
                                              'ID, checkpoint, description…'
                }
                style={{ paddingLeft: 32, paddingRight: search ? 30 : 11 }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', alignItems: 'center', padding: 2 }}
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>

          {/* Projects-specific filters */}
          {activeTab === 'projects' && (
            <>
              <div className="mod-filter-field">
                <label>Status</label>
                <select value={prjStatus} onChange={e => setPrjStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div className="mod-filter-field">
                <label>Department</label>
                <select value={prjDept} onChange={e => setPrjDept(e.target.value)}>
                  <option value="">All Dept</option>
                  <option>AVP</option>
                  <option>WGDE</option>
                  <option>Both</option>
                </select>
              </div>
            </>
          )}

          {/* Issues-specific filters */}
          {activeTab === 'issues' && (
            <>
              <div className="mod-filter-field">
                <label>Status</label>
                <select value={issStatus} onChange={e => setIssStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Completed Ok</option>
                  <option>Completed Not Ok</option>
                </select>
              </div>
              <div className="mod-filter-field">
                <label>Escalation</label>
                <select value={issEsc} onChange={e => setIssEsc(e.target.value)}>
                  <option value="">All Levels</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
            </>
          )}

          {/* Checklists-specific filters */}
          {activeTab === 'checklists' && (
            <>
              <div className="mod-filter-field">
                <label>Status</label>
                <select value={chkStatus} onChange={e => setChkStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div className="mod-filter-field">
                <label>Mandatory</label>
                <select value={chkMand} onChange={e => setChkMand(e.target.value)}>
                  <option value="">Any</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </>
          )}

          <div className="mod-filter-actions">
            {hasFilters && (
              <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Data grid ─────────────────────────────────────────────── */}
      <div className="mod-grid-card">

        {/* Tab bar + export actions */}
        <div className="mod-grid-meta" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--dash-border)', flexShrink: 0 }}>
            {[
              ['projects',   'Projects',   filteredProjects.length],
              ['issues',     'Issues',     filteredIssues.length],
              ['checklists', 'Checklists', filteredChecklists.length],
            ].map(([key, label, count], idx, arr) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                style={{
                  padding: '7px 18px',
                  border: 'none',
                  borderRight: idx < arr.length - 1 ? '1.5px solid var(--dash-border)' : 'none',
                  background: activeTab === key ? '#3f51b5' : '#fff',
                  color:      activeTab === key ? '#fff'    : '#555',
                  fontWeight: activeTab === key ? 700       : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background .15s, color .15s',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                {label}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeTab === key ? 'rgba(255,255,255,.22)' : '#eef0ff',
                  color:      activeTab === key ? '#fff' : '#3f51b5',
                  borderRadius: 12,
                  minWidth: 22,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <span className="mod-loading-text">Loading…</span>}
            <button
              className="mod-btn mod-btn-outline mod-btn-sm"
              onClick={exportExcel}
              disabled={exporting || loading || tabCount === 0}
              title={`Export ${activeTab} to Excel`}
            >
              <DownloadIcon /> Excel
            </button>
            <button
              className="mod-btn mod-btn-primary mod-btn-sm"
              onClick={exportPdf}
              disabled={exporting || loading || tabCount === 0}
              title={`Export ${activeTab} to PDF`}
            >
              <PdfIcon /> PDF
            </button>
          </div>
        </div>

        {/* ── Projects table ──────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <div className="mod-table-wrap">
            <table className="mod-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>#</th>
                  <th>Project Name</th>
                  <th>Program</th>
                  <th>Plant</th>
                  <th>Year</th>
                  <th>Department</th>
                  <th>AVP Owner</th>
                  <th>WGDE Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box loading">
                        <div className="mod-spinner" />
                        <span>Loading projects…</span>
                      </div>
                    </td>
                  </tr>
                ) : prjSlice.length === 0 ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box">
                        <EmptyTableIc />
                        <span>{hasFilters ? 'No projects match the current filters.' : 'No projects found.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : prjSlice.map((row, i) => {
                  const dept = (row.flag3 || '').toLowerCase();
                  const bothDept  = dept.includes('avp') && dept.includes('wgde');
                  const deptLabel = bothDept ? 'AVP + WGDE' : dept.includes('avp') ? 'AVP' : dept.includes('wgde') ? 'WGDE' : '—';
                  const deptColor = bothDept ? '#555' : dept.includes('avp') ? '#1565c0' : dept.includes('wgde') ? '#6a1b9a' : '#888';
                  return (
                    <tr key={row.uid || i} className="mod-tr">
                      <td className="mod-td-num">{(prjPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="mod-td-main" title={row.projectName}>{row.projectName || '—'}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{row.program || '—'}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{row.plant || '—'}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{row.plant_year || '—'}</td>
                      <td><span style={{ color: deptColor, fontWeight: 700, fontSize: 12 }}>{deptLabel}</span></td>
                      <td className="mod-td-sub">{row.avp_owner || '—'}</td>
                      <td className="mod-td-sub">{row.wgte_owner || '—'}</td>
                      <td><StatusBadge v={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Issues table ────────────────────────────────────────── */}
        {activeTab === 'issues' && (
          <div className="mod-table-wrap">
            <table className="mod-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>#</th>
                  <th>Issue #</th>
                  <th>Title</th>
                  <th>Part Number</th>
                  <th>Owner</th>
                  <th>Date Opened</th>
                  <th>Due Date</th>
                  <th>Escalation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box loading">
                        <div className="mod-spinner" />
                        <span>Loading issues…</span>
                      </div>
                    </td>
                  </tr>
                ) : issSlice.length === 0 ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box">
                        <EmptyTableIc />
                        <span>{hasFilters ? 'No issues match the current filters.' : 'No issues found.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : issSlice.map((row, i) => {
                  const escColor = { Critical: '#c62828', High: '#f57c00', Medium: '#f9a825', Low: '#388e3c' }[row.flag2] || '#888';
                  return (
                    <tr key={row.uid || i} className="mod-tr">
                      <td className="mod-td-num">{(issPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td><span className="mod-id-tag">{row.issue_number || '—'}</span></td>
                      <td className="mod-td-main" title={row.issue_title}>{row.issue_title || '—'}</td>
                      <td className="mod-td-sub">{row.partNumber || '—'}</td>
                      <td className="mod-td-sub">{row.owner || '—'}</td>
                      <td style={{ fontSize: 12, color: '#777' }}>{fmtDate(row.date_Opened)}</td>
                      <td style={{ fontSize: 12, color: '#777' }}>{fmtDate(row.req_Completion_Date)}</td>
                      <td>
                        {row.flag2
                          ? <span style={{ fontWeight: 700, fontSize: 12, color: escColor }}>{row.flag2}</span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td><StatusBadge v={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Checklists table ─────────────────────────────────────── */}
        {activeTab === 'checklists' && (
          <div className="mod-table-wrap">
            <table className="mod-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>#</th>
                  <th>ID</th>
                  <th>Checkpoint</th>
                  <th>Description</th>
                  <th>Department</th>
                  <th>Zone</th>
                  <th>Category</th>
                  <th>Mandatory</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box loading">
                        <div className="mod-spinner" />
                        <span>Loading checklists…</span>
                      </div>
                    </td>
                  </tr>
                ) : chkSlice.length === 0 ? (
                  <tr className="mod-state-row">
                    <td colSpan={9}>
                      <div className="mod-state-box">
                        <EmptyTableIc />
                        <span>{hasFilters ? 'No checklists match the current filters.' : 'No checklists found.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : chkSlice.map((row, i) => {
                  const dept = (row.department || '').toLowerCase();
                  const deptColor = dept.includes('avp') ? '#1565c0' : dept.includes('wgde') ? '#6a1b9a' : '#555';
                  const isMandatory = row.mandatory?.toLowerCase() === 'yes';
                  return (
                    <tr key={row.uid || i} className="mod-tr">
                      <td className="mod-td-num">{(chkPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td><span className="mod-id-tag">{row.chkId || '—'}</span></td>
                      <td className="mod-td-main" title={row.checkPointS}>{row.checkPointS || '—'}</td>
                      <td className="mod-td-sub" title={row.checkpointDesc}>{row.checkpointDesc || '—'}</td>
                      <td><span style={{ color: deptColor, fontWeight: 600, fontSize: 12 }}>{row.department || '—'}</span></td>
                      <td className="mod-td-sub">{row.zone || '—'}</td>
                      <td className="mod-td-sub">{row.category || '—'}</td>
                      <td>
                        <span className={`mod-badge ${isMandatory ? 'mod-badge-completed-notok' : 'mod-badge-viewer'}`}>
                          {isMandatory ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td><StatusBadge v={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {activeTab === 'projects'   && <Pagination page={prjPage} total={filteredProjects.length}   pageSize={PAGE_SIZE} onChange={setPrjPage} />}
        {activeTab === 'issues'     && <Pagination page={issPage} total={filteredIssues.length}     pageSize={PAGE_SIZE} onChange={setIssPage} />}
        {activeTab === 'checklists' && <Pagination page={chkPage} total={filteredChecklists.length} pageSize={PAGE_SIZE} onChange={setChkPage} />}
      </div>
    </div>
  );
}
