import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { projectsApi, componentMetaApi, projectIssueLinkApi, issueDocApi, dmrsApi, partMilestoneApi, checklistMilestoneApi, projectMilestoneApi, usersApi, notificationsApi, milestoneMasterApi, graphApi } from '../../services/apiService';
import usePermissions from '../../hooks/usePermissions';
import { downloadTemplate, exportToExcel, parseExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { generateProjectsGridPdf, generateProjectViewPdf } from '../../utils/pdfReport';

// ── Icons ──────────────────────────────────────────────────────────────────────
const EyeIcon       = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const PlusIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const DownIc        = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const UpIc          = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const FolderIcon    = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const CheckIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const GraphIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const ReportIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const MilestoneIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18"/><path d="M3 8h14l-4 4 4 4H3"/></svg>;
const TrashIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const PrintIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const SortIcon      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/></svg>;
const AlertIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

// ── Milestone defaults ────────────────────────────────────────────────────────
const DEFAULT_MILESTONE_NAMES = [
  { name:'CM',          order:1 },
  { name:'Sync 1',      order:2 },
  { name:'Sync 2',      order:3 },
  { name:'Sync 3',      order:4 },
  { name:'Sync 4',      order:5 },
  { name:'Sync 5',      order:6 },
  { name:'Post Sync 5', order:7 },
  { name:'SOP',         order:8 },
];

// ── Priority helpers ──────────────────────────────────────────────────────────
const PRIORITY_CFG = [
  { min:45, label:'Critical', color:'#e53935', bg:'#ffebee', border:'#ef9a9a' },
  { min:25, label:'High',     color:'#f57c00', bg:'#fff3e0', border:'#ffcc80' },
  { min:10, label:'Medium',   color:'#f9a825', bg:'#fffde7', border:'#fff176' },
  { min:0,  label:'Low',      color:'#388e3c', bg:'#e8f5e9', border:'#a5d6a7' },
];
const getPriorityCfg = score => PRIORITY_CFG.find(p => score >= p.min) || PRIORITY_CFG[3];

// ── Helpers ───────────────────────────────────────────────────────────────────
const genUid = () => crypto.randomUUID().replace(/-/g, '').toUpperCase();

const fmtDate = v => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateMs = v => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const metaOpts = (meta, category) =>
  [...new Set(
    meta
      .filter(m => m.label?.toLowerCase() === category.toLowerCase() && m.status?.toUpperCase() === 'ACTIVE')
      .map(m => m.parameter)
      .filter(Boolean)
  )].sort();

const normProject = p => ({
  ...p,
  uid:           p.uid           || p.Uid           || '',
  projectName:   p.projectName   || p.ProjectName   || '',
  program:       p.program       || p.Program       || '',
  plant:         p.plant         || p.Plant         || '',
  plant_year:    p.plant_year    || p.PlantYear      || '',
  zone:          p.zone          || p.Zone           || '',
  area:          p.area          || p.Area           || '',
  owner:         p.owner         || p.Owner          || '',
  status:        p.status        || p.Status         || 'Active',
  flag1:         p.flag1         || p.Flag1          || '',
  flag2:         p.flag2         || p.Flag2          || '',
  flag3:         p.flag3         || p.Flag3          || '',
  avp_owner:     p.avp_owner     || p.flag1          || p.Flag1 || '',
  wgte_owner:    p.wgte_owner    || p.flag2          || p.Flag2 || '',
  created_by:    p.created_by    || p.CreatedBy      || '',
  created_date:  p.created_date  || p.CreatedDate    || '',
  modified_by:   p.modified_by   || p.ModifiedBy     || '',
  modified_date: p.modified_date || p.ModifiedDate   || '',
});

const normMs = m => ({
  ...m,
  uid:            m.uid            || m.Uid            || '',
  milestoneName:  m.milestoneName  || m.MilestoneName  || '',
  milestoneOrder: m.milestoneOrder || m.MilestoneOrder || 0,
  plannedDate:    m.plannedDate    || m.PlannedDate     || null,
  completedDate:  m.completedDate  || m.CompletedDate   || null,
  status:         m.status         || m.Status          || 'Next Milestone',
  notes:          m.notes          || m.Notes           || '',
  avpRemarks:     m.avpRemarks     || m.flag1           || m.Flag1 || '',
  wgdeRemarks:    m.wgdeRemarks    || m.flag2           || m.Flag2 || '',
});

const EMPTY = {
  uid: '', projectName: '', program: '', plant: '', plant_year: '',
  zone: '', area: '', owner: '', status: 'Active',
  flag1: '', flag2: '', flag3: '',
  avp_owner: '', wgte_owner: '',
  deptAVP: false, deptWGDE: false,
  created_by: '', created_date: '', modified_by: '', modified_date: '',
};

const STATUS_OPTIONS = ['Active','Inactive'];
const PAGE_SIZE      = 10;
const genUidMs = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();

const StatusBadge = ({v}) => <span className={`mod-badge ${v?.toLowerCase()==='active'?'mod-badge-active':'mod-badge-inactive'}`}>{v||'—'}</span>;
const Sec = ({title}) => <div className="mod-section-title">{title}</div>;
const Sel = ({value,onChange,options,placeholder='Select…'}) => <div className="mod-select-wrap"><select value={value} onChange={onChange}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select><span className="mod-select-arrow">▾</span></div>;
const CloseBtn = ({onClick}) => <button className="mod-drawer-close" onClick={onClick} type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>;

const PROJ_XL_COLS = [
  {header:'Project Name',  key:'projectName'}, {header:'Program',    key:'program'},
  {header:'Plant',         key:'plant'},       {header:'Plant Year', key:'plant_year'},
  {header:'Zone',          key:'zone'},        {header:'Area',       key:'area'},
  {header:'Owner',         key:'owner'},       {header:'Status',     key:'status'},
];
const PROJ_XL_MAP = Object.fromEntries(PROJ_XL_COLS.map(c=>[c.header.toLowerCase(),c.key]));

// ── Searchable Azure AD user combobox ─────────────────────────────────────────
// Type ≥ 3 chars → debounced Azure Graph search → show results. No preloading.
function UserSearch({ value, onChange, placeholder = 'Type to search…', disabled = false }) {
  const [query,     setQuery]     = useState(value || '');
  const [open,      setOpen]      = useState(false);
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const boxRef      = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleChange = e => {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 3) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await graphApi.searchUsers(q.trim());
        setResults(Array.isArray(res?.users) ? res.users : []);
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 350);
  };

  const select    = name => { setQuery(name); onChange(name); setOpen(false); setResults([]); };
  const hasEnough = query.trim().length >= 3;

  return (
    <div ref={boxRef} style={{position:'relative'}}>
      <input value={query} onChange={handleChange} onFocus={() => setOpen(true)}
        placeholder={placeholder} disabled={disabled} autoComplete="off"
        style={{
          border:'none', borderBottom:`2px solid ${disabled?'#e0e0e0':'#d0d5ea'}`,
          background:'transparent', padding:'5px 0 7px', fontSize:13, fontFamily:'inherit',
          color: disabled?'#aaa':'#1a1a2e', outline:'none', width:'100%',
          boxSizing:'border-box', cursor: disabled?'not-allowed':'text', transition:'border-color .2s',
        }}
      />
      {open && !disabled && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:9999,
          background:'#fff', border:'1px solid #e0e4f0', borderRadius:8,
          boxShadow:'0 6px 24px rgba(0,0,0,.14)', maxHeight:220, overflowY:'auto', marginTop:2,
        }}>
          {!hasEnough && (
            <div style={{padding:'10px 14px',fontSize:12,color:'#aaa',textAlign:'center'}}>
              Type at least 3 characters to search
            </div>
          )}
          {hasEnough && searching && (
            <div style={{padding:'10px 14px',fontSize:12,color:'#3f51b5',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <div className="mod-spinner" style={{width:12,height:12}}/> Searching Azure AD…
            </div>
          )}
          {hasEnough && !searching && results.length === 0 && (
            <div style={{padding:'10px 14px',fontSize:12,color:'#aaa',textAlign:'center'}}>
              No users found for &ldquo;{query}&rdquo;
            </div>
          )}
          {hasEnough && !searching && results.map((u, i) => (
            <div key={i} onMouseDown={() => select(u.displayName || '')}
              style={{padding:'7px 12px',cursor:'pointer',borderBottom:'1px solid #f4f6fb'}}
              onMouseEnter={e => e.currentTarget.style.background='#f5f7ff'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              <div style={{fontWeight:600,fontSize:13,color:'#1a1a2e'}}>{u.displayName}</div>
              {(u.mail||u.userPrincipalName) && <div style={{fontSize:11,color:'#888'}}>{u.mail||u.userPrincipalName}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const perm     = usePermissions();
  const navigate = useNavigate();
  const xlRef    = useRef(null);

  const [rows,       setRows]       = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [meta,       setMeta]       = useState([]);
  const [allLinks,   setAllLinks]   = useState([]);
  const [filters,    setFilters]    = useState({ status:'', plant:'', program:'', search:'' });
  const [page,       setPage]       = useState(1);

  const activeWgde = useMemo(() => rows.filter(r => r.status?.toLowerCase() === 'active' && (r.flag3 || r.Flag3 || '').toLowerCase().includes('wgde')).length, [rows]);
  const activeAvp  = useMemo(() => rows.filter(r => r.status?.toLowerCase() === 'active' && (r.flag3 || r.Flag3 || '').toLowerCase().includes('avp')).length,  [rows]);

  // Project create/edit/view drawer
  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [formMs,           setFormMs]           = useState([]); // milestone rows in create/edit form
  const [milestoneMasters, setMilestoneMasters] = useState([]); // active masters from Milestone_Master

  // Issues side drawer
  const [issueDrawerMount,   setIssueDrawerMount]   = useState(false);
  const [issueDrawerOpen,    setIssueDrawerOpen]    = useState(false);
  const [issueDrawerProject, setIssueDrawerProject] = useState(null);
  const [issueDrawerDocs,    setIssueDrawerDocs]    = useState([]);
  const [issueDrawerLoading, setIssueDrawerLoading] = useState(false);

  // Checklists side drawer
  const [chkDrawerMount,   setChkDrawerMount]   = useState(false);
  const [chkDrawerOpen,    setChkDrawerOpen]    = useState(false);
  const [chkDrawerProject, setChkDrawerProject] = useState(null);
  const [chkDrawerLinks,   setChkDrawerLinks]   = useState([]);
  const [chkDrawerLoading, setChkDrawerLoading] = useState(false);

  // DMRS data for Validated count
  const [allDmrs,       setAllDmrs]       = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);

  // Graph drawer
  const [graphMount,   setGraphMount]   = useState(false);
  const [graphOpen,    setGraphOpen]    = useState(false);
  const [graphProject, setGraphProject] = useState(null);

  // Milestone drawer (project-level)
  const [msDrawerMount,   setMsDrawerMount]   = useState(false);
  const [msDrawerOpen,    setMsDrawerOpen]    = useState(false);
  const [msDrawerProject, setMsDrawerProject] = useState(null);
  const [msRows,          setMsRows]          = useState([]);
  const [msSaving,        setMsSaving]        = useState(false);
  const [msLoading,       setMsLoading]       = useState(false);

  // View drawer – project milestones (Project_Milestones table)
  const [viewDrawerMs,        setViewDrawerMs]        = useState([]);
  const [viewDrawerMsLoading, setViewDrawerMsLoading] = useState(false);


  const programOpts       = metaOpts(meta,'Program');
  const plantMetaOpts     = metaOpts(meta,'Plant');
  const yearOpts          = metaOpts(meta,'Year');
  const avpOwnerOpts      = metaOpts(meta,'AVP Owner');
  const wgteOwnerOpts     = metaOpts(meta,'WGDE Owner');
  const plantOpts         = [...new Set(rows.map(r=>r.plant).filter(Boolean))].sort();
  const programFilterOpts = [...new Set(rows.map(r=>r.program).filter(Boolean))].sort();

  // Project code (P001, P002…) sorted by created_date
  const projectCodeOf = useMemo(() => {
    const sorted = [...rows].sort((a,b)=>new Date(a.created_date||0)-new Date(b.created_date||0));
    const m = new Map();
    sorted.forEach((p,i) => m.set(p.uid, `P${String(i+1).padStart(3,'0')}`));
    return m;
  }, [rows]);
  const nextProjectCode = `P${String(rows.length+1).padStart(3,'0')}`;


  // Validated count split by department — parts with all 5 DMRS syncs OK
  const validatedByDept = useMemo(() => {
    const isValidated = issNum => allDmrs.some(d =>
      d.issue_number === issNum &&
      d.sync1 === 'OK' && d.sync2 === 'OK' && d.sync3 === 'OK' &&
      d.sync4 === 'OK' && d.sync5 === 'OK'
    );
    const avp = new Map(), wgde = new Map();
    rows.forEach(r => {
      const links = allLinks.filter(l => l.project === r.uid);
      avp.set(r.uid,  links.filter(l => (l.flag1||l.Flag1||'').toLowerCase().includes('avp')  && isValidated(l.issue_number)).length);
      wgde.set(r.uid, links.filter(l => (l.flag1||l.Flag1||'').toLowerCase().includes('wgde') && isValidated(l.issue_number)).length);
    });
    return { avp, wgde };
  }, [rows, allLinks, allDmrs]);

  // Parts count split by department (AVP / WGDE) — a part can be both
  const partCountByDept = useMemo(() => {
    const avp = new Map(), wgde = new Map();
    rows.forEach(r => {
      const links = allLinks.filter(l => l.project === r.uid);
      avp.set(r.uid,  links.filter(l => (l.flag1||l.Flag1||'').toLowerCase().includes('avp')).length);
      wgde.set(r.uid, links.filter(l => (l.flag1||l.Flag1||'').toLowerCase().includes('wgde')).length);
    });
    return { avp, wgde };
  }, [rows, allLinks]);

  // Current milestone per project (On Going > first Next Milestone > last Completed > first by order)
  const currentMilestoneOf = useMemo(() => {
    const m = new Map();
    rows.forEach(r => {
      const proj = allMilestones
        .filter(ms => (ms.projectUid||ms.ProjectUid||'') === r.uid)
        .sort((a,b) => (a.milestoneOrder||a.MilestoneOrder||0) - (b.milestoneOrder||b.MilestoneOrder||0));
      if (!proj.length) return;
      const status = ms => (ms.status||ms.Status||'').toLowerCase();
      const date   = ms => {
        if (status(ms) === 'completed') return ms.completedDate||ms.CompletedDate||ms.plannedDate||ms.PlannedDate||null;
        return ms.plannedDate||ms.PlannedDate||null;
      };
      const name = ms => ms.milestoneName||ms.MilestoneName||'—';
      const inProg    = proj.find(ms => status(ms) === 'on going');
      const pending   = proj.find(ms => status(ms) === 'next milestone'); // first by milestoneOrder
      const completed = proj.filter(ms => status(ms) === 'completed').at(-1); // last completed
      const cur = inProg || pending || completed || proj[0];
      m.set(r.uid, { name: name(cur), date: date(cur), status: status(cur) });
    });
    return m;
  }, [rows, allMilestones]);

  // ── Priority score per project (higher = more urgent) ────────────────────
  // ── Priority per department — driven by parts validation + milestone ────────
  // Returns Map<uid, { avp: number|null, wgde: number|null }>
  // null  = dept has no parts → badge not shown
  // score = 0–50, used with getPriorityCfg()
  const priorityByDept = useMemo(() => {
    const today = new Date();
    const m = new Map();
    rows.forEach(r => {
      const ms = currentMilestoneOf.get(r.uid);
      let msScore = 0;
      if (ms?.date) {
        const daysLeft = Math.ceil((new Date(ms.date) - today) / 86400000);
        if (daysLeft < 0)        msScore = 25;
        else if (daysLeft <= 7)  msScore = 12;
        else if (daysLeft <= 30) msScore = 5;
      }
      const scoreFor = key => {
        const total     = partCountByDept[key]?.get(r.uid) ?? 0;
        if (total === 0) return null;             // dept not applicable
        const validated = validatedByDept[key]?.get(r.uid) ?? 0;
        const pct = validated / total;
        let s = msScore;
        if (pct === 0)    s += 25;               // nothing validated
        else if (pct < 0.5) s += 15;            // less than half done
        else if (pct < 1.0) s += 5;             // partially done
        // pct === 1.0 → fully validated → add 0 (Low)
        return s;
      };
      m.set(r.uid, { avp: scoreFor('avp'), wgde: scoreFor('wgde') });
    });
    return m;
  }, [rows, currentMilestoneOf, validatedByDept, partCountByDept]);

  // ── Activity heat map data (last 182 days ≈ 26 weeks) per project ────────
  const heatMapOf = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const startStr = new Date(today);
    startStr.setDate(startStr.getDate() - 181);
    const startIso = startStr.toISOString().slice(0,10);
    const m = new Map();
    rows.forEach(r => {
      const counts = {};
      const projLinks = allLinks.filter(l => l.project === r.uid);
      const issNums   = new Set(projLinks.map(l => l.issue_number).filter(Boolean));
      allDmrs.filter(d => issNums.has(d.issue_number)).forEach(d => {
        const ds = (d.modified_date || d.created_date || '').slice(0,10);
        if (ds && ds >= startIso) counts[ds] = (counts[ds] || 0) + 1;
      });
      allMilestones.filter(ms => (ms.projectUid || ms.ProjectUid || '') === r.uid).forEach(ms => {
        const ds = (ms.modified_date || ms.modifiedDate || ms.created_date || '').slice(0,10);
        if (ds && ds >= startIso) counts[ds] = (counts[ds] || 0) + 1;
      });
      m.set(r.uid, counts);
    });
    return m;
  }, [rows, allLinks, allDmrs, allMilestones]);

  const sortedFiltered = filtered;

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      projectsApi.getAll(),
      componentMetaApi.getAll(),
      projectIssueLinkApi.getAll(),
      dmrsApi.getAll(),
      projectMilestoneApi.getAll(),
      milestoneMasterApi.getActive(),
    ]).then(([prj,m,links,dmrs,ms,masters]) => {
      if(prj.status==='fulfilled') {
        const d = (prj.value??[]).map(normProject);
        setRows(d); setFiltered(d);
      } else Swal.fire({icon:'error',title:'Load failed',text:prj.reason?.message,confirmButtonColor:'#3f51b5'});
      if(m.status==='fulfilled')       setMeta(m.value??[]);
      if(links.status==='fulfilled')   setAllLinks(links.value??[]);
      if(dmrs.status==='fulfilled')    setAllDmrs(dmrs.value??[]);
      if(ms.status==='fulfilled')      setAllMilestones(ms.value??[]);
      if(masters.status==='fulfilled') setMilestoneMasters(masters.value??[]);
    }).finally(()=>setLoading(false));
  },[]);


  const reload = () => Promise.allSettled([
    projectsApi.getAll(),
    projectIssueLinkApi.getAll(),
    dmrsApi.getAll(),
    projectMilestoneApi.getAll(),
  ]).then(([prj,links,dmrs,ms]) => {
    const d = prj.status==='fulfilled' ? (prj.value??[]).map(normProject) : rows;
    setRows(d); setFiltered(d); setPage(1);
    if(links.status==='fulfilled') setAllLinks(links.value??[]);
    if(dmrs.status==='fulfilled')  setAllDmrs(dmrs.value??[]);
    if(ms.status==='fulfilled')    setAllMilestones(ms.value??[]);
  }).catch(err=>Swal.fire({icon:'error',title:'Reload failed',text:err.message,confirmButtonColor:'#3f51b5'}));

  // ── Filters ───────────────────────────────────────────────────────────────────
  const applyFilters = (src=rows, f=filters) => {
    let r=[...src];
    if(f.status)  r=r.filter(x=>x.status===f.status);
    if(f.plant)   r=r.filter(x=>x.plant===f.plant);
    if(f.program) r=r.filter(x=>x.program===f.program);
    if(f.search){ const q=f.search.toLowerCase(); r=r.filter(x=>x.projectName?.toLowerCase().includes(q)||x.program?.toLowerCase().includes(q)||x.owner?.toLowerCase().includes(q)); }
    setFiltered(r); setPage(1);
  };
  useEffect(()=>{ applyFilters(rows, filters); }, [filters, rows]);
  const handleReset = () => { setFilters({status:'',plant:'',program:'',search:''}); setPage(1); };
  const setF = (k,v) => setFilters(p=>({...p,[k]:v}));

  // ── Issues drawer ─────────────────────────────────────────────────────────────
  const openIssueDrawer = async row => {
    setIssueDrawerProject(row); setIssueDrawerDocs([]); setIssueDrawerLoading(true);
    setIssueDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setIssueDrawerOpen(true)));
    try {
      const [links, allDocs] = await Promise.all([
        projectIssueLinkApi.byProject(row.uid),
        issueDocApi.getAll(),
      ]);
      const issueNums = new Set(links.map(l=>l.issue_number).filter(Boolean));
      const seen = new Set();
      const distinct = allDocs.filter(d=>{
        if(!issueNums.has(d.issue_number)||seen.has(d.uid)) return false;
        seen.add(d.uid); return true;
      });
      setIssueDrawerDocs(distinct);
    } catch(err){ Swal.fire({icon:'error',title:'Failed to load issues',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setIssueDrawerLoading(false); }
  };
  const closeIssueDrawer = () => { setIssueDrawerOpen(false); setTimeout(()=>{setIssueDrawerMount(false);setIssueDrawerProject(null);},320); };

  // ── Checklists drawer ─────────────────────────────────────────────────────────
  const openChkDrawer = async row => {
    setChkDrawerProject(row); setChkDrawerLinks([]); setChkDrawerLoading(true);
    setChkDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setChkDrawerOpen(true)));
    try {
      const links = await projectIssueLinkApi.byProject(row.uid);
      setChkDrawerLinks(links ?? []);
    } catch(err){ Swal.fire({icon:'error',title:'Failed to load checklists',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setChkDrawerLoading(false); }
  };
  const closeChkDrawer = () => { setChkDrawerOpen(false); setTimeout(()=>{setChkDrawerMount(false);setChkDrawerProject(null);},320); };

  // ── Milestone cascade helpers ─────────────────────────────────────────────────
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + (days || 0));
    return d.toISOString();
  };
  const buildFromMasters = (masters, anchor = new Date()) => {
    const sorted = [...masters].sort((a, b) => (a.milestoneOrder || 0) - (b.milestoneOrder || 0));
    let prev = new Date(anchor);
    return sorted.map(m => {
      const planned = addDays(prev, m.noOfDays || 0);
      prev = new Date(planned);
      return {
        uid: genUidMs(), milestoneName: m.milestoneName || '',
        milestoneOrder: m.milestoneOrder || 0, noOfDays: m.noOfDays || 0,
        plannedDate: planned, status: 'Next Milestone', masterUid: m.uid,
      };
    });
  };
  const recascade = (msList, changedIdx) => {
    const updated = [...msList];
    for (let i = changedIdx + 1; i < updated.length; i++) {
      const prev = updated[i - 1];
      if (!prev.plannedDate || !updated[i].noOfDays) break;
      updated[i] = { ...updated[i], plannedDate: addDays(new Date(prev.plannedDate), updated[i].noOfDays) };
    }
    return updated;
  };

  // ── Project drawer ────────────────────────────────────────────────────────────
  const openDrawer = (mode,row=null) => {
    setDrawerMode(mode); setDrawerRow(row); setSaving(false);
    const now = new Date().toISOString(); const actor2=user?.userId||user?.email||'system';
    if (row && mode === 'view') {
      setViewDrawerMs([]); setViewDrawerMsLoading(true);
      projectMilestoneApi.byProject(row.uid).then(data => {
        if (data && data.length > 0) {
          setViewDrawerMs(data.map(normMs));
        } else {
          setViewDrawerMs(milestoneMasters.map(m => ({
            uid: m.uid, milestoneName: m.milestoneName, milestoneOrder: m.milestoneOrder,
            status: 'Next Milestone', plannedDate: null, projectUid: row.uid,
          })));
        }
      }).catch(() => {
        setViewDrawerMs(milestoneMasters.map(m => ({
          uid: m.uid, milestoneName: m.milestoneName, milestoneOrder: m.milestoneOrder,
          status: 'Next Milestone', plannedDate: null, projectUid: row.uid,
        })));
      }).finally(() => setViewDrawerMsLoading(false));
    }
    if (row) {
      const dept = (row.flag3 || row.Flag3 || '').toLowerCase();
      setForm({...EMPTY, ...row, deptAVP: dept.includes('avp'), deptWGDE: dept.includes('wgde')});
      // Load project milestones from Project_Milestones table
      const masterByOrder = new Map(milestoneMasters.map(m => [m.milestoneOrder, m]));
      const fillNames = (rows) => rows.map((m, i) => ({
        ...m,
        milestoneName: m.milestoneName
          || masterByOrder.get(m.milestoneOrder)?.milestoneName
          || milestoneMasters[i]?.milestoneName
          || `M${i + 1}`,
      }));
      projectMilestoneApi.byProject(row.uid).then(data => {
        if (data && data.length > 0) {
          setFormMs(fillNames(data.map(normMs)));
        } else {
          setFormMs(buildFromMasters(milestoneMasters));
        }
      }).catch(() => {
        setFormMs(buildFromMasters(milestoneMasters));
      });
    } else {
      const newUid = genUid();
      setForm({...EMPTY, uid: newUid});
      setFormMs(buildFromMasters(milestoneMasters));
    }
    setDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setDrawerOpen(true)));
  };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(()=>{setDrawerMount(false);setSaving(false);setViewDrawerMs([]);},320); };
  const sf = (k,v) => setForm(p=>({...p,[k]:v}));

  // ── Save (create auto-generates first checklist document) ─────────────────────
  const handleSave = async e => {
    e.preventDefault();
    if(!form.projectName?.trim()){
      Swal.fire({icon:'warning',title:'Required',text:'Project Name is required.',confirmButtonColor:'#3f51b5'}); return;
    }
    if(!form.program?.trim()){
      Swal.fire({icon:'warning',title:'Required',text:'Program is required.',confirmButtonColor:'#3f51b5'}); return;
    }
    if(!form.plant?.trim()){
      Swal.fire({icon:'warning',title:'Required',text:'Plant is required.',confirmButtonColor:'#3f51b5'}); return;
    }
    if(!form.plant_year?.trim()){
      Swal.fire({icon:'warning',title:'Required',text:'Plant Year is required.',confirmButtonColor:'#3f51b5'}); return;
    }
    // Prevent backdated milestones on create
    if (drawerMode === 'create' && formMs.some(ms => {
      if (!ms.plannedDate) return false;
      const msDate = new Date(ms.plannedDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      return msDate < today;
    })) {
      Swal.fire({icon:'warning',title:'Invalid Milestone Date',text:'Backdated milestones are not allowed. Please select today or a future date.',confirmButtonColor:'#7b1fa2'});
      return;
    }
    setSaving(true);
    const now=new Date().toISOString(); const actor=user?.userId||user?.email||'system';
    const isEdit=drawerMode==='edit';
    const deptVal = [form.deptAVP && 'AVP', form.deptWGDE && 'WGDE'].filter(Boolean).join(',');
    const payload={
      ...form,
      flag1: form.avp_owner  || '',
      flag2: form.wgte_owner || '',
      flag3: deptVal,
      modified_by:actor, modified_date:now,
      ...(isEdit?{}:{created_by:actor,created_date:now, status:'Active'}), // Always set status Active for new
    };
    try {
      isEdit ? await projectsApi.update(form.uid,payload) : await projectsApi.create(payload);

      // Save milestone grid rows to Project_Milestones table
      if (formMs.length) {
        const msPayload = formMs.map((m, i) => ({
          uid: m.uid, projectUid: form.uid,
          milestoneName: m.milestoneName || '', milestoneOrder: m.milestoneOrder || i + 1,
          plannedDate: m.plannedDate || null, status: m.status || 'Next Milestone', notes: m.notes || '',
          modifiedBy: actor, modifiedDate: now,
        }));
        await projectMilestoneApi.bulkUpsert(form.uid, msPayload).catch(() => null);
      }

      // Fire notification — non-blocking, does not affect the UI flow
      notificationsApi.trigger(
        isEdit ? 'PROJECT_UPDATED' : 'PROJECT_CREATED',
        'Project', form.uid, actor
      ).catch(() => {});

      closeDrawer(); await reload();
      Swal.fire({icon:'success',title:isEdit?'Project Updated!':'Project Created!',text:`"${form.projectName}" ${isEdit?'updated':'created'} successfully.`,timer:2500,showConfirmButton:false,timerProgressBar:true});
    } catch(err){ Swal.fire({icon:'error',title:'Save failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setSaving(false); }
  };

  // ── Milestone drawer (project-level) ─────────────────────────────────────────
  const openMsDrawer = async row => {
    setMsDrawerProject(row); setMsRows([]); setMsLoading(true);
    setMsDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setMsDrawerOpen(true)));
    try {
      const now   = new Date().toISOString();
      const actor = user?.userId || user?.email || 'system';
      const masterByOrder2 = new Map(milestoneMasters.map(m => [m.milestoneOrder, m]));
      const fillNames = (rows) => rows.map((m, i) => ({
        ...m,
        avpRemarks:  m.avpRemarks  || '',
        wgdeRemarks: m.wgdeRemarks || '',
        milestoneName: m.milestoneName
          || masterByOrder2.get(m.milestoneOrder)?.milestoneName
          || milestoneMasters[i]?.milestoneName
          || `M${i + 1}`,
      }));

      const data = await projectMilestoneApi.byProject(row.uid);
      if (data && data.length > 0) {
        setMsRows(fillNames(data.map(normMs)));
      } else {
        setMsRows(buildFromMasters(milestoneMasters).map(m => ({
          ...m, projectUid: row.uid, completedDate: null,
          department: '', owner: '', notes: '', avpRemarks: '', wgdeRemarks: '',
          createdBy: actor, createdDate: now,
        })));
      }
    } catch(err) {
      Swal.fire({icon:'error',title:'Failed to load milestones',text:err.message,confirmButtonColor:'#3f51b5'});
    } finally { setMsLoading(false); }
  };
  const closeMsDrawer = () => { setMsDrawerOpen(false); setTimeout(()=>{setMsDrawerMount(false);setMsDrawerProject(null);setMsRows([]);},320); };
  const smr = (rowUid, key, val) => setMsRows(prev => prev.map(r => r.uid===rowUid ? {...r,[key]:val||null} : r));
  const addMsRow = () => {
    const now=new Date().toISOString(); const actor=user?.userId||user?.email||'system';
    setMsRows(prev=>[...prev,{uid:genUidMs(),issueNumber:msDrawerProject?.uid||'',projectUid:msDrawerProject?.uid||'',
      milestoneName:'',milestoneOrder:prev.length+1,plannedDate:null,completedDate:null,
      status:'Next Milestone',department:'',owner:'',notes:'',avpRemarks:'',wgdeRemarks:'',
      createdBy:actor,createdDate:now}]);
  };
  const removeMsRow = uid => setMsRows(prev=>prev.filter(r=>r.uid!==uid));
  const handleSaveMilestones = async () => {
    const projUid = msDrawerProject?.uid; if(!projUid) return;
    setMsSaving(true);
    const now=new Date().toISOString(); const actor=user?.userId||user?.email||'system';
    try {
      const payload = msRows.map((r,i)=>({
        ...r, milestoneOrder: i+1, projectUid: projUid,
        flag1: r.avpRemarks  || '',
        flag2: r.wgdeRemarks || '',
        modifiedBy: actor, modifiedDate: now,
      }));
      await projectMilestoneApi.bulkUpsert(projUid, payload);
      Swal.fire({icon:'success',title:'Milestones Saved!',timer:1800,showConfirmButton:false,timerProgressBar:true});
      closeMsDrawer();
    } catch(err) { Swal.fire({icon:'error',title:'Save failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally { setMsSaving(false); }
  };

  // ── Graph drawer ─────────────────────────────────────────────────────────────
  const openGraphDrawer = row => {
    setGraphProject(row);
    setGraphMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setGraphOpen(true)));
  };
  const closeGraphDrawer = () => {
    setGraphOpen(false);
    setTimeout(()=>{ setGraphMount(false); setGraphProject(null); }, 320);
  };

  const handleDeactivate = async row => {
    if(row.status?.toLowerCase()==='inactive'){ Swal.fire({icon:'info',title:'Already inactive',confirmButtonColor:'#3f51b5'}); return; }
    const res=await Swal.fire({title:'Deactivate project?',html:`<b>${row.projectName}</b><br/><small style="color:#888">Status will be set to Inactive.</small>`,icon:'warning',showCancelButton:true,confirmButtonColor:'#e67e22',cancelButtonColor:'#6c757d',confirmButtonText:'Deactivate',reverseButtons:true});
    if(!res.isConfirmed) return;
    try {
      const actor = user?.userId || user?.email || 'system';
      await projectsApi.update(row.uid,{...row,status:'Inactive'});
      notificationsApi.trigger('STATUS_CHANGED', 'Project', row.uid, actor).catch(()=>{});
      await reload();
      Swal.fire({icon:'success',title:'Deactivated!',timer:2000,showConfirmButton:false,timerProgressBar:true});
    } catch(err){ Swal.fire({icon:'error',title:'Failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
  };

  const totalPages=Math.max(1,Math.ceil(sortedFiltered.length/PAGE_SIZE));
  const pageRows=sortedFiltered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const pageNums=Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1);
  const drawerColors={view:'#2980b9',edit:'#e67e22',create:'#27ae60'};
  const drawerTitles={view:'View Project',edit:'Edit Project',create:'New Project'};
  const drawerIcons={view:<EyeIcon/>,edit:<EditIcon/>,create:<PlusIcon/>};

  const handleExportTemplate = () => downloadTemplate(PROJ_XL_COLS,'projects-template.xlsx');
  const handleExportData     = () => exportToExcel(filtered, PROJ_XL_COLS, `projects-${Date.now()}.xlsx`);
  const handleImport = async e => {
    const file=e.target.files?.[0]; if(!file) return; e.target.value='';
    setImporting(true);
    try {
      const raw = await parseExcel(file);
      if(!raw.length){ Swal.fire({icon:'info',title:'Empty file',confirmButtonColor:'#3f51b5'}); return; }
      const now=new Date().toISOString(), actor=user?.userId||user?.email||'system';
      const mapped=raw.map(row=>{
        const rec={...EMPTY,uid:genUid(),created_by:actor,created_date:now,status:'Active'};
        Object.entries(row).forEach(([h,v])=>{ const k=PROJ_XL_MAP[h.trim().toLowerCase()]; if(k) rec[k]=String(v??''); });
        return rec;
      });
      const res=await Promise.allSettled(mapped.map(r=>projectsApi.create(r)));
      const ok=res.filter(r=>r.status==='fulfilled').length;
      await reload();
      Swal.fire({icon:ok<mapped.length?'warning':'success',title:'Import done',html:`<b>${ok}</b> of ${mapped.length} imported`,confirmButtonColor:'#3f51b5'});
    } catch(err){ Swal.fire({icon:'error',title:'Import failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setImporting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mod-page">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="mod-page-header">
        <div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
          <div><h1 className="mod-title">Projects</h1><p className="mod-subtitle">Manage project records, programs and part configurations</p></div>
          <div style={{display:'flex',gap:10,alignItems:'center',paddingTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#e3f2fd',border:'1.5px solid #90caf9',borderRadius:10,padding:'6px 14px',minWidth:120}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#1565c0',flexShrink:0}}/>
              <div style={{lineHeight:1.25}}>
                <div style={{fontSize:18,fontWeight:700,color:'#1565c0',letterSpacing:'-0.5px'}}>{activeAvp}</div>
                <div style={{fontSize:10,color:'#1565c0',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>AVP Active</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#f3e5f5',border:'1.5px solid #ce93d8',borderRadius:10,padding:'6px 14px',minWidth:120}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#6a1b9a',flexShrink:0}}/>
              <div style={{lineHeight:1.25}}>
                <div style={{fontSize:18,fontWeight:700,color:'#6a1b9a',letterSpacing:'-0.5px'}}>{activeWgde}</div>
                <div style={{fontSize:10,color:'#6a1b9a',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>WGDE Active</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mod-header-actions">
          {/* <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportTemplate}><DownIc/> Template</button> */}
          <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportData}><DownIc/> Export</button>
          <button className="mod-btn mod-btn-outline mod-btn-sm" title="Print grid as PDF"
            onClick={()=>generateProjectsGridPdf({
              rows: sortedFiltered,
              projectCodeOf,
              validatedByDept,
              partCountByDept,
              currentMilestoneOf,
              filename: `projects-report-${Date.now()}.pdf`,
            })}>
            <PrintIcon/> Print PDF
          </button>
          {perm.canCreate('projects')&&<>
            {/* <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={()=>xlRef.current.click()} disabled={importing}><UpIc/> {importing?'…':'Import'}</button> */}
            <input ref={xlRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleImport}/>
          </>}
          {perm.canCreate('projects')&&<button className="mod-btn mod-btn-primary" onClick={()=>openDrawer('create')}><PlusIcon/> New Project</button>}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="mod-filter-card">
        <div className="mod-filter-label">Filter &amp; Search</div>
        <div className="mod-filter-row">
          <div className="mod-filter-field"><label>Plant</label>
            <select value={filters.plant} onChange={e=>setF('plant',e.target.value)}>
              <option value="">All Plants</option>{plantOpts.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="mod-filter-field"><label>Program</label>
            <select value={filters.program} onChange={e=>setF('program',e.target.value)}>
              <option value="">All Programs</option>{programFilterOpts.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="mod-filter-field"><label>Status</label>
            <select value={filters.status} onChange={e=>setF('status',e.target.value)}>
              <option value="">All Statuses</option>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="mod-filter-field"><label>Search</label>
            <input placeholder="Project name, owner or program…" value={filters.search} onChange={e=>setF('search',e.target.value)}/>
          </div>
          <div className="mod-filter-actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="mod-btn mod-btn-outline" onClick={handleReset}>Reset</button>
            <button className="mod-btn mod-btn-outline" type="button" title="Refresh Grid" style={{padding:'0 12px',display:'flex',alignItems:'center',gap:4}} onClick={e=>{e.preventDefault();reload();}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.37 5.37A9 9 0 0 0 21 15"/></svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <div className="mod-grid-card">
        <div className="mod-grid-meta">
          <span className="mod-count">{loading?'Loading…':`${sortedFiltered.length} project${sortedFiltered.length!==1?'s':''} found`}</span>
          {loading&&<span className="mod-loading-text">Fetching…</span>}
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr>
              <th style={{width:36}}>#</th>
              <th style={{width:64}}>Code</th>
              <th style={{minWidth:90}}>Program</th>
              <th style={{minWidth:130}}>Project</th>
              <th style={{minWidth:70}}>Plant</th>
              <th style={{width:52,textAlign:'center'}}>Year</th>
              <th style={{minWidth:140}}>Milestone</th>
              <th style={{width:82,textAlign:'center'}}>Department</th>
              <th style={{minWidth:110}}>Pilot</th>
              <th style={{width:100,textAlign:'center'}}>Validation Status / Total Part/Assy</th>
              <th style={{width:88,textAlign:'center'}}>Issues</th>
              <th style={{width:76,textAlign:'center'}}>Status</th>
              <th style={{width:116}}>Actions</th>
            </tr></thead>
            <tbody>
              {loading&&<tr className="mod-state-row"><td colSpan={13}><div className="mod-state-box loading"><div className="mod-spinner"/><span>Loading projects…</span></div></td></tr>}
              {!loading&&pageRows.length===0&&<tr className="mod-state-row"><td colSpan={13}><div className="mod-state-box"><FolderIcon/><span>No projects found.</span></div></td></tr>}
              {!loading&&pageRows.map((row,i)=>{
                const code = projectCodeOf.get(row.uid)||'—';
                return (
                  <tr key={row.uid} className="mod-tr">
                    <td className="mod-td-num">{(page-1)*PAGE_SIZE+i+1}</td>
                    <td>
                      <span className="mod-id-tag mod-id-tag-link" style={{cursor:'pointer'}}
                        title="View project details"
                        onClick={()=>navigate(`/dashboard/projects/${row.uid}`)}>
                        {code}
                      </span>
                    </td>
                    <td>{row.program||'—'}</td>
                    <td className="mod-td-main" title={row.projectName}>{row.projectName||'—'}</td>
                    <td style={{fontSize:12}}>{row.plant||'—'}</td>
                    {/* Year */}
                    <td style={{textAlign:'center',fontSize:13,fontWeight:700,color:'#37474f'}}>{row.plant_year||'—'}</td>
                    {/* Milestone */}
                    {(() => {
                      const ms = currentMilestoneOf.get(row.uid);
                      const dot = ms?.status==='in progress'?'#f39c12':ms?.status==='completed'?'#27ae60':'#bdbdbd';
                      return (
                        <td style={{minWidth:140}}>
                          {ms ? (
                            <div style={{display:'flex',alignItems:'flex-start',gap:5}}>
                              <span style={{width:7,height:7,borderRadius:'50%',background:dot,flexShrink:0,marginTop:3}}/>
                              <div>
                                <div style={{fontSize:12,fontWeight:700,color:'#263238',lineHeight:1.3}}>{ms.name}</div>
                                <div style={{fontSize:11,color:'#90a4ae',marginTop:1,display:'flex',alignItems:'center',gap:4}}>
                                  {ms.date ? (
                                    <>
                                      {fmtDateMs(ms.date)}
                                      {/* Show warning if date is in the past */}
                                      {(() => {
                                        const d = new Date(ms.date);
                                        const now = new Date();
                                        if (!isNaN(d) && d < now.setHours(0,0,0,0)) {
                                          return (
                                            <span title="Milestone date crossed" style={{color:'#e53935',marginLeft:2,display:'inline-flex',alignItems:'center'}}>
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1.2"/></svg>
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </>
                                  ) : (
                                    <span style={{color:'#bbb'}}>—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : <span style={{color:'#bbb',fontSize:12}}>—</span>}
                        </td>
                      );
                    })()}
                    {/* Department */}
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'center'}}>
                        {[['AVP','#1565c0','#e3f2fd','#90caf9'],['WGDE','#6a1b9a','#f3e5f5','#ce93d8']].map(([dept,clr,bg,border])=>{
                          const has = (row.flag3||row.Flag3||'').toLowerCase().includes(dept.toLowerCase());
                          return (
                            <span key={dept} style={{
                              display:'block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:'0.3px',width:'80px',
                              background:has?bg:'#f5f5f5', color:has?clr:'#bbb',
                              border:`1px solid ${has?border:'#e8e8e8'}`,
                              opacity:has?1:0.55, cursor:has?'default':'not-allowed',
                            }}>{dept}</span>
                          );
                        })}
                      </div>
                    </td>
                    {/* Pilot */}
                    <td>
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        {[['AVP',row.avp_owner,'#1565c0','#e3f2fd','#90caf9'],['WGDE',row.wgte_owner,'#6a1b9a','#f3e5f5','#ce93d8']].map(([dept,owner,clr,bg,border])=>(
                          <span key={dept} style={{
                            display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,
                            background:owner?bg:'#f5f5f5',
                            color:owner?clr:'#bbb',
                            border:`1px solid ${owner?border:'#e8e8e8'}`,
                            opacity:owner?1:0.55,
                            cursor:owner?'default':'not-allowed',
                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:108,
                          }}>{owner||'—'}</span>
                        ))}
                      </div>
                    </td>
                    {/* Validation */}
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                        {[{key:'avp',clr:'#1565c0',bg:'#e3f2fd',border:'#90caf9'},{key:'wgde',clr:'#6a1b9a',bg:'#f3e5f5',border:'#ce93d8'}].map(({key,clr,bg,border})=>{
                          const validated = validatedByDept[key].get(row.uid)??0;
                          const total     = partCountByDept[key].get(row.uid)??0;
                          const done = total>0&&validated===total;
                          const none = total===0;
                          return (
                            <span key={key} title={`${validated}/${total} ${key.toUpperCase()} parts validated`} style={{
                              display:'inline-flex',alignItems:'center',gap:4,
                              padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,
                              background:done?'#e8f5e9':none?'#f5f5f5':bg,
                              color:done?'#1b5e20':none?'#bbb':clr,
                              border:`1px solid ${done?'#a5d6a7':none?'#e0e0e0':border}`,
                              opacity:none?0.55:1, cursor:none?'not-allowed':'default',
                            }}>
                              {validated>0&&<span style={{width:6,height:6,borderRadius:'50%',background:done?'#27ae60':clr,flexShrink:0}}/>}
                              {validated} / {total}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {/* Issues */}
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                        {[{key:'avp',clr:'#1565c0',bg:'#e3f2fd',border:'#90caf9'},{key:'wgde',clr:'#6a1b9a',bg:'#f3e5f5',border:'#ce93d8'}].map(({key,clr,bg,border})=>{
                          const cnt = partCountByDept[key].get(row.uid)??0;
                          return (
                            <span key={key} style={{
                              display:'inline-flex',alignItems:'center',gap:4,
                              padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,
                              background:cnt===0?'#f5f5f5':bg,
                              color:cnt===0?'#bbb':clr,
                              border:`1px solid ${cnt===0?'#e0e0e0':border}`,
                              opacity:cnt===0?0.55:1, cursor:cnt===0?'not-allowed':'default',
                            }}>
                              {/* <span style={{fontSize:10,opacity:0.8}}></span> */}
                              {cnt}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                        {[['AVP','#1565c0','#e3f2fd','#90caf9'],['WGDE','#6a1b9a','#f3e5f5','#ce93d8']].map(([dept,clr,bg,border])=>{
                          const has      = (row.flag3||row.Flag3||'').toLowerCase().includes(dept.toLowerCase());
                          const isActive = row.status?.toLowerCase()==='active';
                          return (
                            <span key={dept} style={{
                              display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,
                              background: has ? bg : '#f5f5f5',
                              color:      has ? clr : '#bbb',
                              border:    `1px solid ${has ? border : '#e8e8e8'}`,
                              opacity:    has ? 1 : 0.55,
                              cursor:     has ? 'default' : 'not-allowed',
                            }}>
                              {has ? (isActive ? 'Active' : 'Inactive') : '—'}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="mod-td-actions"><div style={{display:'flex',alignItems:'center',gap:8,height:'5.2vh'}}>
                      <button className="mod-action-btn mod-action-view" title="View" onClick={()=>openDrawer('view',row)}><EyeIcon/></button>
                      {perm.canEdit('projects',row)&&<button className="mod-action-btn mod-action-edit" title="Edit" onClick={()=>openDrawer('edit',row)}><EditIcon/></button>}
                      <button className="mod-action-btn" title="Milestones"
                        style={{background:'#f3e5f5',color:'#7b1fa2',border:'none',width:28,height:28,borderRadius:6,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'background .15s,color .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#7b1fa2';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#f3e5f5';e.currentTarget.style.color='#7b1fa2';}}
                        onClick={()=>openMsDrawer(row)}><MilestoneIcon/></button>
                      <button title="Project Graph"
                        style={{background:'#e8f5e9',color:'#1b5e20',border:'none',width:28,height:28,borderRadius:6,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'background .15s,color .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#1b5e20';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#e8f5e9';e.currentTarget.style.color='#1b5e20';}}
                        onClick={()=>openGraphDrawer(row)}><GraphIcon/></button>
                      <button title="Robustness Report"
                        style={{background:'#e8eaf6',color:'#3f51b5',border:'none',width:28,height:28,borderRadius:6,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'background .15s,color .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#3f51b5';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#e8eaf6';e.currentTarget.style.color='#3f51b5';}}
                        onClick={()=>navigate(`/dashboard/projects/${row.uid}/report`)}><ReportIcon/></button></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading&&totalPages>1&&(
          <div className="mod-pagination">
            <button className="mod-page-btn" disabled={page===1} onClick={()=>setPage(1)}>«</button>
            <button className="mod-page-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
            {pageNums.map((p,idx)=>{const prev=pageNums[idx-1];return(<span key={p} style={{display:'contents'}}>{prev&&p-prev>1&&<span className="mod-page-ellipsis">…</span>}<button className={`mod-page-btn${p===page?' active':''}`} onClick={()=>setPage(p)}>{p}</button></span>);})}
            <button className="mod-page-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="mod-page-btn" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</button>
            <span className="mod-page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* ── Checklists side drawer ──────────────────────────────────── */}
      {chkDrawerMount&&(<>
        <div className={`mod-drawer-overlay${chkDrawerOpen?' open':''}`} onClick={closeChkDrawer}/>
        <aside className={`mod-drawer${chkDrawerOpen?' open':''}`}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#27ae6033'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e8f5e9',color:'#1b5e20'}}><CheckIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Checklist Documents</h2>
                <p className="mod-drawer-subtitle">{chkDrawerProject?.projectName}</p>
              </div>
            </div>
            <CloseBtn onClick={closeChkDrawer}/>
          </div>
          <div className="mod-drawer-body" style={{padding:0}}>
            {chkDrawerLoading&&<div className="mod-state-box loading" style={{padding:'48px 0'}}><div className="mod-spinner"/><span>Loading checklists…</span></div>}
            {!chkDrawerLoading&&chkDrawerLinks.length===0&&(
              <div className="mod-state-box" style={{padding:'48px 0'}}><CheckIcon/><span>No checklist documents for this project.</span></div>
            )}
            {!chkDrawerLoading&&chkDrawerLinks.length>0&&(
              <div className="mod-table-wrap">
                <table className="mod-table">
                  <thead><tr>
                    <th style={{width:36}}>#</th>
                    <th>Document No</th>
                    <th>Part Number</th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {chkDrawerLinks.map((lnk,i)=>(
                      <tr key={lnk.uid} className="mod-tr">
                        <td className="mod-td-num">{i+1}</td>
                        <td>
                          <span className="mod-id-tag mod-id-tag-link" style={{cursor:'pointer'}}
                            title="Open Checklist Manager"
                            onClick={()=>{ closeChkDrawer(); navigate(`/dashboard/dmrs/manage/${encodeURIComponent(lnk.issue_number)}`,{state:{from:'/dashboard/projects',fromLabel:'Projects'}}); }}>
                            {lnk.issue_number||'—'}
                          </span>
                        </td>
                        <td>{lnk.partNumber||'—'}</td>
                        <td><span className={`mod-badge ${lnk.status?.toLowerCase()==='active'?'mod-badge-active':'mod-badge-inactive'}`}>{lnk.status||'—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeChkDrawer}>Close</button>
            <span className="mod-page-info" style={{marginLeft:'auto'}}>{chkDrawerLinks.length} document{chkDrawerLinks.length!==1?'s':''}</span>
          </div>
        </aside>
      </>)}

      {/* ── Issues side drawer ──────────────────────────────────────── */}
      {issueDrawerMount&&(<>
        <div className={`mod-drawer-overlay${issueDrawerOpen?' open':''}`} onClick={closeIssueDrawer}/>
        <aside className={`mod-drawer${issueDrawerOpen?' open':''}`}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#2980b933'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#2980b918',color:'#2980b9'}}><EyeIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Issue Documents</h2>
                <p className="mod-drawer-subtitle">{issueDrawerProject?.projectName}</p>
              </div>
            </div>
            <CloseBtn onClick={closeIssueDrawer}/>
          </div>
          <div className="mod-drawer-body" style={{padding:0}}>
            {issueDrawerLoading&&<div className="mod-state-box loading" style={{padding:'48px 0'}}><div className="mod-spinner"/><span>Loading issues…</span></div>}
            {!issueDrawerLoading&&issueDrawerDocs.length===0&&(
              <div className="mod-state-box" style={{padding:'48px 0'}}><FolderIcon/><span>No issue documents linked to this project.</span></div>
            )}
            {!issueDrawerLoading&&issueDrawerDocs.length>0&&(
              <div className="mod-table-wrap">
                <table className="mod-table">
                  <thead><tr>
                    <th style={{width:36}}>#</th>
                    <th>Issue #</th>
                    <th>Title</th>
                    <th>Part No</th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {issueDrawerDocs.map((doc,i)=>(
                      <tr key={doc.uid} className="mod-tr">
                        <td className="mod-td-num">{i+1}</td>
                        <td>
                          {/* Click issue number → open IssueManage screen */}
                          <span className="mod-id-tag mod-id-tag-link" style={{cursor:'pointer'}}
                            title="Open Issue Manager"
                            onClick={()=>{ closeIssueDrawer(); navigate(`/dashboard/issues/${doc.uid}`,{state:{from:'/dashboard/projects',fromLabel:'Projects'}}); }}>
                            {doc.issue_number||'—'}
                          </span>
                        </td>
                        <td className="mod-td-main" title={doc.issue_title}>{doc.issue_title||'—'}</td>
                        <td>{doc.partNumber||'—'}</td>
                        <td><span className={`mod-badge ${doc.status==='Closed'?'mod-badge-inactive':doc.status==='In Progress'?'mod-badge-primary':'mod-badge-active'}`}>{doc.status||'—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeIssueDrawer}>Close</button>
            <span className="mod-page-info" style={{marginLeft:'auto'}}>{issueDrawerDocs.length} document{issueDrawerDocs.length!==1?'s':''}</span>
          </div>
        </aside>
      </>)}

      {/* ── Graph drawer ────────────────────────────────────────────── */}
      {graphMount&&(<>
        <div className={`mod-drawer-overlay${graphOpen?' open':''}`} onClick={closeGraphDrawer}/>
        <aside className={`mod-drawer${graphOpen?' open':''}`} style={{width:680,maxWidth:'96vw'}}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#27ae6033'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e8f5e9',color:'#1b5e20'}}><GraphIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Project Analytics</h2>
                <p className="mod-drawer-subtitle">{graphProject?.projectName}</p>
              </div>
            </div>
            <CloseBtn onClick={closeGraphDrawer}/>
          </div>

          <div className="mod-drawer-body" style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* ── Project Info Summary ── */}
            <div style={{background:'#f8f9ff',borderRadius:10,padding:'14px 18px',border:'1px solid #e8eaf6'}}>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:12}}>Project Information</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {[
                  ['Code',       projectCodeOf.get(graphProject?.uid)||'—'],
                  ['Program',    graphProject?.program||'—'],
                  ['Plant',      graphProject?.plant||'—'],
                  ['Plant Year', graphProject?.plant_year||'—'],
                  ['AVP Pilot',  graphProject?.avp_owner||'—'],
                  ['WGDE Pilot', graphProject?.wgte_owner||'—'],
                  ['Status',     graphProject?.status||'—'],
                ].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:10,color:'#aaa',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px'}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a2e',marginTop:2}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Chart: Validation — Circular Gauge Dials ── */}
            {(() => {
              const uid = graphProject?.uid||'';
              const projLinks = allLinks.filter(l=>l.project===uid);
              const avpLinks  = projLinks.filter(l=>(l.flag1||'').toLowerCase().includes('avp'));
              const wgdeLinks = projLinks.filter(l=>(l.flag1||'').toLowerCase().includes('wgde'));
              const isValid   = issNum => allDmrs.some(d=>d.issue_number===issNum&&d.sync1==='OK'&&d.sync2==='OK'&&d.sync3==='OK'&&d.sync4==='OK'&&d.sync5==='OK');
              const avpVal    = avpLinks.filter(l=>isValid(l.issue_number)).length;
              const wgdeVal   = wgdeLinks.filter(l=>isValid(l.issue_number)).length;
              const Gauge = ({label,validated,total,color}) => {
                const pct = total>0 ? validated/total : 0;
                const R=52, cx=65, cy=65, thick=14;
                // Semi-circle (180°) gauge — from 180° to 0° going clockwise
                const circ=2*Math.PI*R;
                const half=circ/2;
                const fill=pct*half;
                const pctN=Math.round(pct*100);
                const done=pct===1;
                return (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1}}>
                    <svg width={130} height={80} viewBox="0 0 130 80">
                      {/* Track: top semicircle */}
                      <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
                        fill="none" stroke="#f0f2f8" strokeWidth={thick} strokeLinecap="round"/>
                      {/* Fill */}
                      <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
                        fill="none" stroke={done?'#27ae60':color} strokeWidth={thick} strokeLinecap="round"
                        strokeDasharray={`${fill} ${half}`}
                        style={{transition:'stroke-dasharray .6s'}}/>
                      {/* Centre value */}
                      <text x={cx} y={cy-6} textAnchor="middle" fontSize="20" fontWeight="900"
                        fill={done?'#27ae60':color}>{pctN}%</text>
                      <text x={cx} y={cy+8} textAnchor="middle" fontSize="9" fill="#aaa">
                        {validated}/{total} parts
                      </text>
                    </svg>
                    <span style={{fontSize:12,fontWeight:700,color,padding:'2px 12px',borderRadius:12,
                      background:color+'18',border:`1px solid ${color}33`}}>{label}</span>
                  </div>
                );
              };
              return (
                <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',border:'1px solid #e8eaf0'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:16}}>Validation Progress — All 5 Syncs</div>
                  <div style={{display:'flex',gap:16,justifyContent:'space-around'}}>
                    <Gauge label="AVP"  validated={avpVal}  total={avpLinks.length}  color="#1565c0"/>
                    <Gauge label="WGDE" validated={wgdeVal} total={wgdeLinks.length} color="#6a1b9a"/>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeGraphDrawer}>Close</button>
          </div>
        </aside>
      </>)}

      {/* ── Project Milestone drawer ────────────────────────────────── */}
      {msDrawerMount&&(<>
        <div className={`mod-drawer-overlay${msDrawerOpen?' open':''}`} onClick={closeMsDrawer}/>
        <aside className={`mod-drawer${msDrawerOpen?' open':''}`} style={{width:760,maxWidth:'96vw'}}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#7b1fa233'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#f3e5f5',color:'#7b1fa2'}}><MilestoneIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Project Milestones</h2>
                <p className="mod-drawer-subtitle">{msDrawerProject?.projectName}</p>
              </div>
            </div>
            <CloseBtn onClick={closeMsDrawer}/>
          </div>

          <div className="mod-drawer-body">
            {msLoading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'48px 0',color:'#7b1fa2'}}><div className="mod-spinner"/><span>Loading milestones…</span></div>}
            {!msLoading&&(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>

                {/* Progress bar */}
                {msRows.length>0&&(()=>{
                  const done=msRows.filter(r=>r.status==='Completed').length;
                  const inProg=msRows.filter(r=>r.status==='On Going').length;
                  const pct=Math.round((done/msRows.length)*100);
                  return (
                    <div style={{background:'#faf7ff',border:'1px solid #e8d5f7',borderRadius:10,padding:'12px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#7b1fa2'}}>Progress — {done} of {msRows.length} completed</span>
                        <span style={{fontSize:13,fontWeight:800,color:pct===100?'#27ae60':'#7b1fa2'}}>{pct}%</span>
                      </div>
                      <div style={{height:8,background:'#e8d5f7',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:pct===100?'#27ae60':'linear-gradient(90deg,#7b1fa2,#ab47bc)',borderRadius:4,transition:'width .4s ease'}}/>
                      </div>
                      <div style={{display:'flex',gap:16,marginTop:8}}>
                        {[['#27ae60','Completed',done],['#3f51b5','On Going',inProg],['#bdc3c7','Next Milestone',msRows.length-done-inProg]].map(([c,l,n])=>(
                          <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#666'}}>
                            <span style={{width:8,height:8,borderRadius:'50%',background:c,flexShrink:0}}/>{n} {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Milestone grid — columns: #, Milestone, Date, Status, AVP Remarks, WGDE Remarks, Delete */}
                <div style={{border:'1px solid #e8d5f7',borderRadius:10,overflow:'hidden',background:'#fff'}}>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <colgroup>
                        <col style={{width:36}}/><col style={{width:180}}/><col style={{width:130}}/>
                        <col style={{width:120}}/><col/><col/><col style={{width:40}}/>
                      </colgroup>
                      <thead>
                        <tr style={{background:'linear-gradient(135deg,#7b1fa2,#9c27b0)'}}>
                          {['#','Milestone','Date','Status','AVP Remarks','WGDE Remarks',''].map((h,i)=>(
                            <th key={i} style={{padding:'11px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.9)',textTransform:'uppercase',letterSpacing:'.6px',whiteSpace:'nowrap',borderRight:i<5?'1px solid rgba(255,255,255,.15)':'none'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msRows.length===0&&<tr><td colSpan={7} style={{padding:'40px 0',textAlign:'center',color:'#bbb',fontSize:13}}>No milestones yet. Click <strong>+ Add Milestone</strong> below.</td></tr>}
                        {msRows.map((row,i)=>{
                          const s=row.status||'Next Milestone';
                          const sCfg=s==='Completed'?{dot:'#27ae60',bg:'#e8f5e9',text:'#1b5e20',border:'#a5d6a7'}
                            :s==='On Going'?{dot:'#3f51b5',bg:'#e8eaf6',text:'#283593',border:'#9fa8da'}
                            :{dot:'#bdc3c7',bg:'#fafafa',text:'#666',border:'#e0e0e0'};
                          const inp={height:30,padding:'0 8px',border:'1.5px solid #e8d5f7',borderRadius:5,fontSize:11,outline:'none',fontFamily:'inherit',background:'#fff',color:'#111',boxSizing:'border-box'};

                          return (
                            <tr key={row.uid} style={{borderBottom:'1px solid #f3eaff',background:i%2===0?'#fff':'#fdf9ff'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#f7f0ff'}
                              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fdf9ff'}>

                              {/* # */}
                              <td style={{padding:'10px 12px',textAlign:'center',verticalAlign:'middle'}}>
                                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:'50%',background:'#f3eaff',color:'#7b1fa2',fontSize:11,fontWeight:700}}>{i+1}</span>
                              </td>

                              {/* Milestone name */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input value={row.milestoneName||''} onChange={e=>smr(row.uid,'milestoneName',e.target.value)}
                                  placeholder="Milestone name…" style={{...inp,width:'100%',fontWeight:600,color:'#111'}}/>
                              </td>

                              {/* Planned date */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input type="date" style={{...inp,width:'100%'}}
                                  value={row.plannedDate?new Date(row.plannedDate).toISOString().split('T')[0]:''}
                                  onChange={e=>smr(row.uid,'plannedDate',e.target.value||null)}/>
                              </td>

                              {/* Status — select */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <select value={s} onChange={e=>smr(row.uid,'status',e.target.value)}
                                  style={{...inp,width:'100%',cursor:'pointer',
                                    background:sCfg.bg,color:sCfg.text,border:`1.5px solid ${sCfg.border}`,fontWeight:700}}>
                                  {['Next Milestone','On Going','Completed'].map(opt=>(
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>

                              {/* AVP Remarks */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input value={row.avpRemarks||''} onChange={e=>smr(row.uid,'avpRemarks',e.target.value||'')}
                                  placeholder="AVP remarks…"
                                  style={{...inp,width:'100%',minWidth:120,color:'#1565c0'}}/>
                              </td>

                              {/* WGDE Remarks */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input value={row.wgdeRemarks||''} onChange={e=>smr(row.uid,'wgdeRemarks',e.target.value||'')}
                                  placeholder="WGDE remarks…"
                                  style={{...inp,width:'100%',minWidth:120,color:'#6a1b9a'}}/>
                              </td>

                              {/* Delete */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle',textAlign:'center'}}>
                                <button onClick={()=>removeMsRow(row.uid)} title="Remove"
                                  style={{width:28,height:28,border:'none',borderRadius:7,cursor:'pointer',background:'#fff0f0',color:'#e53935',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.background='#e53935';e.currentTarget.style.color='#fff';}}
                                  onMouseLeave={e=>{e.currentTarget.style.background='#fff0f0';e.currentTarget.style.color='#e53935';}}>
                                  <TrashIcon/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={addMsRow}
                    style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 18px',background:'#fff',color:'#7b1fa2',border:'1.5px dashed #ce93d8',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f9f0ff';e.currentTarget.style.borderStyle='solid';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderStyle='dashed';}}>
                    <PlusIcon/> Add Milestone
                  </button>
                  {msRows.length>0&&msRows.every(r=>r.status==='Completed')&&(
                    <div style={{flex:1,padding:'9px 16px',background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:8,color:'#1b5e20',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16}}>🎉</span> All milestones completed!
                    </div>
                  )}
                  {/* Validation readiness banners */}
                  {msDrawerProject&&(()=>{
                    const uid=msDrawerProject.uid;
                    const avpT=partCountByDept.avp.get(uid)??0, avpV=validatedByDept.avp.get(uid)??0;
                    const wgT=partCountByDept.wgde.get(uid)??0, wgV=validatedByDept.wgde.get(uid)??0;
                    if((avpT===0||avpV<avpT)&&(wgT===0||wgV<wgT)) return null;
                    return (
                      <div style={{display:'flex',flexDirection:'column',gap:4,flex:1}}>
                        {avpT>0&&avpV===avpT&&<span style={{padding:'6px 12px',background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:7,fontSize:11,fontWeight:700,color:'#1565c0'}}>✓ AVP: All {avpT} parts validated</span>}
                        {wgT>0&&wgV===wgT&&<span style={{padding:'6px 12px',background:'#f3e5f5',border:'1px solid #ce93d8',borderRadius:7,fontSize:11,fontWeight:700,color:'#6a1b9a'}}>✓ WGDE: All {wgT} parts validated</span>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeMsDrawer} disabled={msSaving}>Close</button>
            <button onClick={handleSaveMilestones} disabled={msSaving}
              style={{height:38,padding:'0 20px',background:'#7b1fa2',color:'#fff',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',opacity:msSaving?0.6:1}}>
              {msSaving?'Saving…':'Save Milestones'}
            </button>
          </div>
        </aside>
      </>)}

      {/* ── Project create/edit/view drawer ─────────────────────────── */}
      {drawerMount&&(<>
        <div className={`mod-drawer-overlay${drawerOpen?' open':''}`} onClick={closeDrawer}/>
        <aside className={`mod-drawer${drawerOpen?' open':''}`} style={{width:'37vw',minWidth:420,maxWidth:'96vw'}}>
          <div className="mod-drawer-header" style={{borderBottomColor:drawerColors[drawerMode]+'33'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:drawerColors[drawerMode]+'18',color:drawerColors[drawerMode]}}>{drawerIcons[drawerMode]}</div>
              <div><h2 className="mod-drawer-title">{drawerTitles[drawerMode]}</h2><p className="mod-drawer-subtitle">{drawerMode==='create'?'Fill in the details to create a new project':drawerRow?.projectName}</p></div>
            </div>
            <CloseBtn onClick={closeDrawer}/>
          </div>

          {/* ── VIEW ── */}
          {drawerMode==='view'&&(<>
            <div className="mod-drawer-body" style={{padding:0}}>

              {/* ── Identity ─────────────────────────────────── */}
              <div style={{padding:'14px 20px',borderBottom:'1px solid #f0f2f8'}}>
                <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>Project Info</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px'}}>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Project Code</div>
                    <span style={{display:'inline-block',padding:'3px 10px',background:'#e8f0fe',color:'#3f51b5',borderRadius:5,fontWeight:700,fontSize:13}}>{projectCodeOf.get(drawerRow?.uid)||'—'}</span>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Program</div>
                    <div style={{fontSize:13,fontWeight:500,color:'#1a1a2e'}}>{drawerRow?.program||'—'}</div>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Project</div>
                    <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>{drawerRow?.projectName||'—'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Plant</div>
                    <div style={{fontSize:13,fontWeight:500,color:'#1a1a2e'}}>{drawerRow?.plant||'—'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Year</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e'}}>{drawerRow?.plant_year||'—'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Status</div>
                    <StatusBadge v={drawerRow?.status}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Department</div>
                    <div style={{display:'flex',gap:6}}>
                      {[['AVP','#1565c0','#e3f2fd','#90caf9'],['WGDE','#6a1b9a','#f3e5f5','#ce93d8']].map(([d,c,b,br])=>{
                        const has=(drawerRow?.flag3||'').toLowerCase().includes(d.toLowerCase());
                        return <span key={d} style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,background:has?b:'#f5f5f5',color:has?c:'#bbb',border:`1px solid ${has?br:'#e8e8e8'}`,opacity:has?1:0.5}}>{d}</span>;
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>AVP Owner</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#1565c0'}}>{drawerRow?.avp_owner||'—'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>WGDE Owner</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#6a1b9a'}}>{drawerRow?.wgte_owner||'—'}</div>
                  </div>
                </div>
              </div>

              {/* ── Milestone Timeline ────────────────────────── */}
              {(()=>{
                const TRACK_Y = 92, LPAD = 64, RPAD = 64;
                const EL_RX = 11, EL_RY = 7, CIR_R = 7;
                const H = 136, SPACING = 96;

                const isEmpty = viewDrawerMs.length === 0 && !viewDrawerMsLoading;
                const msData  = viewDrawerMs.length > 0 ? viewDrawerMs : DEFAULT_MILESTONE_NAMES.map(d => ({
                  uid: d.name, milestoneName: d.name, milestoneOrder: d.order,
                  status: 'Next Milestone', plannedDate: null,
                }));
                const n = msData.length;
                const today = new Date();

                const validDates = msData.map(m => m.plannedDate ? new Date(m.plannedDate) : null).filter(Boolean);
                const hasRealDates = viewDrawerMs.length > 0 && validDates.length >= 2;

                const trackW = Math.max(320, (n - 1) * SPACING);

                let tStart = null, tEnd = null;
                let xPositions;
                if (hasRealDates) {
                  // Include today so the Today marker is always within range
                  const allTimes = [...validDates.map(d => d.getTime()), today.getTime()];
                  const minT = Math.min(...allTimes);
                  const maxT = Math.max(...allTimes);
                  const pad  = (maxT - minT) * 0.08;
                  tStart = minT - pad; tEnd = maxT + pad;
                  const tRange = tEnd - tStart;
                  xPositions = msData.map(m =>
                    m.plannedDate ? LPAD + ((new Date(m.plannedDate).getTime() - tStart) / tRange) * trackW : null
                  );
                  xPositions = xPositions.map((x, i) =>
                    x !== null ? x : LPAD + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2)
                  );
                } else {
                  xPositions = msData.map((_, i) =>
                    n === 1 ? LPAD + trackW / 2 : LPAD + (i / (n - 1)) * trackW
                  );
                }
                // Enforce minimum gap so labels never collide
                const MIN_SEP = 72;
                for (let i = 1; i < xPositions.length; i++) {
                  if (xPositions[i] - xPositions[i - 1] < MIN_SEP) xPositions[i] = xPositions[i - 1] + MIN_SEP;
                }
                const W = Math.max(LPAD + trackW + RPAD, xPositions[n - 1] + RPAD);

                // Today is always included in tStart–tEnd (or use fallback for no-date mode)
                const todayX = (hasRealDates && tStart !== null)
                  ? LPAD + ((today.getTime() - tStart) / (tEnd - tStart)) * trackW
                  : LPAD + Math.round(trackW * 0.35);

                const fmtD = v => {
                  if (!v) return null;
                  const d = new Date(v);
                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                };
                const dotCfg = s => {
                  const sl = (s||'').toLowerCase();
                  if (sl === 'completed') return { fill:'#1a1a1a', type:'ellipse' };
                  if (sl === 'on going')  return { fill:'#7b1fa2', type:'ellipse' };
                  return { fill:'#fff', stroke:'#aaa', type:'circle' };
                };

                const done        = msData.filter(m => (m.status||'').toLowerCase()==='completed').length;
                const inProg      = msData.filter(m => (m.status||'').toLowerCase()==='on going').length;
                const lastDoneIdx = msData.reduce((acc, m, i) =>
                  (m.status||'').toLowerCase()==='completed' ? i : acc, -1);
                const todayStr = fmtD(today);

                return (
                  <div style={{padding:'14px 20px',borderBottom:'1px solid #f0f2f8'}}>
                    {/* Header */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px'}}>Milestone Timeline</div>
                      <span style={{fontSize:11,fontWeight:700,color:done===n?'#27ae60':'#7b1fa2'}}>
                        {viewDrawerMsLoading ? '…' : `${done}/${n} done`}
                        {inProg > 0 ? ` · ${inProg} active` : ''}
                      </span>
                    </div>

                    {isEmpty && (
                      <div style={{fontSize:11,color:'#bbb',fontStyle:'italic',marginBottom:6}}>
                        No milestones — use the <b style={{color:'#7b1fa2'}}>★ Milestone</b> button to configure.
                      </div>
                    )}

                    {viewDrawerMsLoading ? (
                      <div style={{textAlign:'center',padding:'20px 0',color:'#bbb',fontSize:12}}>Loading milestones…</div>
                    ) : (
                      <div style={{overflowX:'auto',overflowY:'visible',paddingBottom:4,minWidth:0}}>
                        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{display:'block'}}>

                          {/* Track */}
                          <line x1={LPAD} y1={TRACK_Y} x2={W-RPAD} y2={TRACK_Y}
                            stroke={isEmpty ? '#eee' : '#c8c8c8'} strokeWidth="5" strokeLinecap="round"/>

                          {/* Completed segment */}
                          {!isEmpty && lastDoneIdx >= 0 && (
                            <line x1={xPositions[0]} y1={TRACK_Y} x2={xPositions[lastDoneIdx]} y2={TRACK_Y}
                              stroke="#27ae60" strokeWidth="5" strokeLinecap="round"/>
                          )}

                          {/* TODAY pin */}
                          {todayX !== null && (
                            <g>
                              <rect x={todayX-22} y={5} width={44} height={16} rx={3}
                                fill={isEmpty ? '#fff8f8' : '#ffebee'} stroke="#e53935" strokeWidth="1"/>
                              <text x={todayX} y={16} textAnchor="middle"
                                fontSize="8" fontWeight="700" fill="#e53935">{todayStr}</text>
                              <text x={todayX} y={29} textAnchor="middle"
                                fontSize="7" fontWeight="800" fill="#e53935" letterSpacing=".5" opacity=".8">TODAY</text>
                              <line x1={todayX} y1={32} x2={todayX} y2={TRACK_Y-6}
                                stroke="#e53935" strokeWidth="1.5" strokeDasharray="4,3" opacity=".7"/>
                              <circle cx={todayX} cy={TRACK_Y} r={5} fill="#e53935"/>
                            </g>
                          )}

                          {/* Milestones */}
                          {msData.map((ms, i) => {
                            const x   = xPositions[i];
                            const cfg = dotCfg(isEmpty ? 'next milestone' : ms.status);
                            const lbl = ms.milestoneName || `M${i+1}`;
                            const ds  = fmtD(ms.plannedDate);
                            return (
                              <g key={ms.uid || i}>
                                {!isEmpty && (ms.status||'').toLowerCase()==='on going' && (
                                  <ellipse cx={x} cy={TRACK_Y} rx={EL_RX+5} ry={EL_RY+4}
                                    fill="none" stroke="#ce93d8" strokeWidth="2" opacity=".5"/>
                                )}
                                {cfg.type === 'ellipse'
                                  ? <ellipse cx={x} cy={TRACK_Y} rx={EL_RX} ry={EL_RY} fill={cfg.fill}/>
                                  : <circle cx={x} cy={TRACK_Y} r={CIR_R}
                                      fill={cfg.fill} stroke={isEmpty ? '#ddd' : cfg.stroke} strokeWidth="2"/>
                                }
                                {!isEmpty && (ms.status||'').toLowerCase()==='completed' && (
                                  <text x={x} y={TRACK_Y+3.5} textAnchor="middle"
                                    fontSize="8" fill="#fff" fontWeight="900">✓</text>
                                )}
                                {ds && (
                                  <text x={x} y={TRACK_Y-14} textAnchor="middle"
                                    fontSize="9" fill={isEmpty ? '#ccc' : '#444'}>{ds}</text>
                                )}
                                <line x1={x} y1={TRACK_Y+EL_RY+1} x2={x} y2={TRACK_Y+EL_RY+16}
                                  stroke={isEmpty ? '#ddd' : (cfg.type==='ellipse' ? cfg.fill : '#ccc')}
                                  strokeWidth="1.5"/>
                                <text x={x} y={TRACK_Y+EL_RY+28} textAnchor="middle"
                                  fontSize="10" fontWeight={cfg.type==='ellipse' ? '700' : '500'}
                                  fill={isEmpty ? '#bbb' : (cfg.type==='ellipse' ? '#1a1a1a' : '#666')}>
                                  {lbl.length > 10 ? lbl.slice(0,10)+'…' : lbl}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    )}

                    {/* Legend */}
                    <div style={{display:'flex',gap:14,marginTop:4,flexWrap:'wrap'}}>
                      {[
                        {c:'#1a1a1a',l:'Completed',      type:'ellipse'},
                        {c:'#7b1fa2',l:'On Going',       type:'ellipse'},
                        {c:'#aaa',   l:'Next Milestone', type:'circle'},
                      ].map(({c,l,type})=>(
                        <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,color:'#666'}}>
                          <svg width="14" height="10" style={{flexShrink:0}}>
                            {type==='ellipse'
                              ? <ellipse cx="7" cy="5" rx="6" ry="4" fill={c}/>
                              : <circle cx="5" cy="5" r="4" fill="#fff" stroke={c} strokeWidth="1.5"/>
                            }
                          </svg>
                          {l}
                        </span>
                      ))}
                      <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,color:'#e53935'}}>
                        <svg width="10" height="10" style={{flexShrink:0}}>
                          <circle cx="5" cy="5" r="4" fill="#e53935"/>
                        </svg>
                        Today
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Audit ────────────────────────────────────── */}
              <div style={{padding:'14px 20px',borderBottom:'1px solid #f0f2f8'}}>
                <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>Audit</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px'}}>
                  {[['Created By',drawerRow?.created_by],['Created Date',fmtDate(drawerRow?.created_date)],
                    ['Modified By',drawerRow?.modified_by],['Modified Date',fmtDate(drawerRow?.modified_date)]].map(([lbl,val])=>(
                    <div key={lbl}>
                      <div style={{fontSize:10,color:'#9e9e9e',fontWeight:700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>{lbl}</div>
                      <div style={{fontSize:13,fontWeight:500,color:'#1a1a2e'}}>{val||'—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── History of Changes ───────────────────────── */}
              {(()=>{
                const projMs = allMilestones.filter(m=>(m.flag1||m.Flag1||'')===drawerRow?.uid);
                const events = [];
                if(drawerRow?.created_date)
                  events.push({clr:'#27ae60',icon:'●',label:'Project Created',by:drawerRow.created_by,at:drawerRow.created_date});
                if(drawerRow?.modified_date && drawerRow.modified_date!==drawerRow.created_date)
                  events.push({clr:'#e67e22',icon:'✎',label:'Project Modified',by:drawerRow.modified_by,at:drawerRow.modified_date});
                projMs.forEach(m=>{
                  const nm = m.milestoneid||m.Milestoneid||m.checkPointS||'Milestone';
                  let cd={};
                  try{ cd=JSON.parse(m.flag2||'{}'); }catch{}
                  if(cd.avp)  events.push({clr:'#1565c0',icon:'●',label:`${nm} — AVP Completed`,by:'',at:cd.avp});
                  if(cd.wgde) events.push({clr:'#6a1b9a',icon:'●',label:`${nm} — WGDE Completed`,by:'',at:cd.wgde});
                });
                events.sort((a,b)=>new Date(b.at)-new Date(a.at));
                return (
                  <div style={{padding:'14px 20px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>History of Changes</div>
                    <div style={{maxHeight:180,overflowY:'auto',paddingRight:4}}>
                      {events.length===0&&<div style={{color:'#bbb',fontSize:12,padding:'16px 0',textAlign:'center'}}>No history available</div>}
                      {events.map((ev,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:i<events.length-1?'1px dashed #f5f5f5':'none'}}>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,flexShrink:0,paddingTop:3}}>
                            <span style={{width:9,height:9,borderRadius:'50%',background:ev.clr,display:'block'}}/>
                            {i<events.length-1&&<span style={{width:1.5,height:20,background:'#f0f2f8',display:'block',margin:'2px 0'}}/>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:'#2d2d2d'}}>{ev.label}</div>
                            <div style={{fontSize:11,color:'#aaa',marginTop:2,display:'flex',gap:8}}>
                              {ev.by&&<span style={{fontWeight:600,color:'#888'}}>{ev.by}</span>}
                              <span>{fmtDate(ev.at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Workflow Readiness ───────────────────────── */}
              {drawerRow&&(()=>{
                const avpTotal  = partCountByDept.avp.get(drawerRow.uid)??0;
                const wgdeTotal = partCountByDept.wgde.get(drawerRow.uid)??0;
                const avpVal    = validatedByDept.avp.get(drawerRow.uid)??0;
                const wgdeVal   = validatedByDept.wgde.get(drawerRow.uid)??0;
                const avpReady  = avpTotal>0 && avpVal===avpTotal;
                const wgdeReady = wgdeTotal>0 && wgdeVal===wgdeTotal;
                if(!avpReady&&!wgdeReady) return null;
                return (
                  <div style={{padding:'12px 20px',borderBottom:'1px solid #f0f2f8',display:'flex',flexDirection:'column',gap:6}}>
                    {avpReady&&(
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',background:'#e3f2fd',border:'1.5px solid #90caf9',borderRadius:8}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <div>
                          <div style={{fontSize:12,fontWeight:800,color:'#1565c0'}}>AVP — Ready to Complete</div>
                          <div style={{fontSize:11,color:'#1565c0',opacity:.8}}>All {avpTotal} AVP parts validated across all 5 DMRS syncs.</div>
                        </div>
                      </div>
                    )}
                    {wgdeReady&&(
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',background:'#f3e5f5',border:'1.5px solid #ce93d8',borderRadius:8}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a1b9a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <div>
                          <div style={{fontSize:12,fontWeight:800,color:'#6a1b9a'}}>WGDE — Ready to Complete</div>
                          <div style={{fontSize:11,color:'#6a1b9a',opacity:.8}}>All {wgdeTotal} WGDE parts validated across all 5 DMRS syncs.</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
            <div className="mod-drawer-footer">
              <button className="mod-btn mod-btn-outline" onClick={closeDrawer}>Close</button>
              <button className="mod-btn mod-btn-outline" style={{color:'#1b5e20',borderColor:'#1b5e20'}}
                onClick={()=>{closeDrawer();openChkDrawer(drawerRow);}}><CheckIcon/> Checklists</button>
              <button className="mod-btn mod-btn-outline" style={{color:'#2980b9',borderColor:'#2980b9'}}
                onClick={()=>{closeDrawer();openIssueDrawer(drawerRow);}}><EyeIcon/> Issues</button>
              <button className="mod-btn mod-btn-outline" style={{color:'#555',borderColor:'#bbb'}} title="Download project PDF"
                onClick={()=>generateProjectViewPdf({
                  project:drawerRow,
                  code:projectCodeOf.get(drawerRow?.uid)||'—',
                  milestones:viewDrawerMs,
                  avpVal:validatedByDept.avp.get(drawerRow?.uid)??0,
                  avpTotal:partCountByDept.avp.get(drawerRow?.uid)??0,
                  wgdeVal:validatedByDept.wgde.get(drawerRow?.uid)??0,
                  wgdeTotal:partCountByDept.wgde.get(drawerRow?.uid)??0,
                })}><PrintIcon/> PDF</button>
              {perm.canEdit('projects',drawerRow)&&<button className="mod-btn mod-btn-primary" onClick={()=>setDrawerMode('edit')}><EditIcon/> Edit</button>}
            </div>
          </>)}

          {/* ── CREATE / EDIT ── */}
          {(drawerMode==='edit'||drawerMode==='create')&&(
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
              <div className="mod-drawer-body">
                <div className="mod-form-block"><Sec title="Identity"/>
                  <div className="mod-form-grid">
                    {/* 1. Project Code (create only) */}
                    {drawerMode==='create'&&(
                      <div className="mod-field">
                        <label>Project Code</label>
                        <input value={nextProjectCode} readOnly
                          style={{background:'#e8f0fe',color:'#3f51b5',fontWeight:700,cursor:'default'}}
                          title="Auto-generated project code"/>
                      </div>
                    )}
                    {/* 2. Program */}
                    <div className="mod-field">
                      <label>Program <span className="req" style={{color:'red'}}>*</span></label>
                      <input value={form.program||''} onChange={e=>sf('program',e.target.value)}
                        list="proj-program-opts" placeholder="Type or select program…"
                        style={{height:38,padding:'0 11px',border:'1.5px solid var(--dash-border)',
                          borderRadius:7,fontSize:13,background:'#fafbff',outline:'none',
                          fontFamily:'inherit',width:'100%',boxSizing:'border-box'}}/>
                      <datalist id="proj-program-opts">
                        {programOpts.map(o=><option key={o} value={o}/>)}
                      </datalist>
                    </div>
                    {/* 3. Project Name — full width */}
                    <div className="mod-field mod-field-full">
                      <label>Project Name <span className="req">*</span></label>
                      <input value={form.projectName} onChange={e=>sf('projectName',e.target.value)} placeholder="Project name" required/>
                    </div>
                    {/* 4. Plant */}
                    <div className="mod-field"><label>Plant <span className="req" style={{color:'red'}}>*</span></label><Sel value={form.plant} onChange={e=>sf('plant',e.target.value)} options={plantMetaOpts} placeholder="Select plant…"/></div>
                    {/* 5. Plant Year */}
                    <div className="mod-field"><label>Plant Year <span className="req" style={{color:'red'}}>*</span></label><Sel value={form.plant_year} onChange={e=>sf('plant_year',e.target.value)} options={yearOpts} placeholder="Select year…"/></div>
                    {/* 6. Status (edit only — display) */}
                    {drawerMode==='edit' && (
                      <div className="mod-field">
                        <label>Status</label>
                        <input value={form.status || '—'} readOnly
                          style={{background:'#f5f5f5',color:'#555',cursor:'default',fontWeight:600}}/>
                      </div>
                    )}
                    {/* 7. Department Applicability — same row as Status */}
                    <div className="mod-field">
                      <label>Department Applicability</label>
                      <div style={{display:'flex',gap:24,paddingTop:6}}>
                        {[['deptAVP','AVP','#1565c0','#e3f2fd','#90caf9'],['deptWGDE','WGDE','#6a1b9a','#f3e5f5','#ce93d8']].map(([key,label,clr,bg,border])=>(
                          <label key={key} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,
                            color: form[key]?clr:'#555',padding:'6px 14px',borderRadius:7,
                            background: form[key]?bg:'#f5f5f5',
                            border:`1.5px solid ${form[key]?border:'#e0e0e0'}`,
                            transition:'all .15s',userSelect:'none'}}>
                            <input type="checkbox" checked={!!form[key]}
                              onChange={e=>{
                                const checked = e.target.checked;
                                setForm(p=>({
                                  ...p,
                                  [key]: checked,
                                  ...(key==='deptAVP'  && !checked ? {avp_owner:''}  : {}),
                                  ...(key==='deptWGDE' && !checked ? {wgte_owner:''} : {}),
                                }));
                              }}
                              style={{width:15,height:15,accentColor:clr,cursor:'pointer'}}/>
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* 8. AVP Owner */}
                    <div className="mod-field">
                      <label>AVP Owner</label>
                      <UserSearch
                        value={form.avp_owner || ''}
                        onChange={v => sf('avp_owner', v)}
                        placeholder="Search AVP owner…"
                      />
                    </div>
                    {/* 9. WGDE Owner */}
                    <div className="mod-field">
                      <label>WGDE Owner</label>
                      <UserSearch
                        value={form.wgte_owner || ''}
                        onChange={v => sf('wgte_owner', v)}
                        placeholder="Search WGDE owner…"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Milestone Grid ── */}
                <div className="mod-form-block" style={{marginBottom:0}}>
                  <Sec title="Milestones"/>
                  <div style={{border:'1px solid #e8d5f7',borderRadius:10,overflow:'hidden',background:'#fff',marginTop:8}}>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <colgroup>
                          <col style={{width:32}}/><col/><col style={{width:130}}/>
                          <col style={{width:120}}/><col style={{width:36}}/>
                        </colgroup>
                        <thead>
                          <tr style={{background:'linear-gradient(135deg,#7b1fa2,#9c27b0)'}}>
                            {['#','Milestone','Date','Status',''].map((h,i)=>(
                              <th key={i} style={{padding:'9px 10px',textAlign:'left',fontSize:10,fontWeight:700,
                                color:'rgba(255,255,255,.9)',textTransform:'uppercase',letterSpacing:'.5px',
                                borderRight:i<3?'1px solid rgba(255,255,255,.15)':'none'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {formMs.length===0&&(
                            <tr><td colSpan={5} style={{padding:'32px 0',textAlign:'center',color:'#bbb',fontSize:12}}>
                              No milestones yet. Click <strong>+ Add Milestone</strong> below.
                            </td></tr>
                          )}
                          {formMs.map((ms,i)=>{
                            const inp={height:28,padding:'0 7px',border:'1.5px solid #e8d5f7',borderRadius:5,fontSize:11,
                              outline:'none',fontFamily:'inherit',background:'#fff',color:'#111',boxSizing:'border-box'};
                            const smfm=(uid,key,val)=>setFormMs(p=>p.map(r=>r.uid===uid?{...r,[key]:val}:r));
                            return (
                              <tr key={ms.uid} style={{borderBottom:'1px solid #f3eaff',background:i%2===0?'#fff':'#fdf9ff'}}
                                onMouseEnter={e=>e.currentTarget.style.background='#f7f0ff'}
                                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fdf9ff'}>

                                <td style={{padding:'8px 10px',textAlign:'center',verticalAlign:'middle'}}>
                                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                                    width:20,height:20,borderRadius:'50%',background:'#f3eaff',color:'#7b1fa2',fontSize:10,fontWeight:700}}>{i+1}</span>
                                </td>

                                {/* Milestone name */}
                                <td style={{padding:'5px 6px',verticalAlign:'middle'}}>
                                  <input value={ms.milestoneName||''} onChange={e=>smfm(ms.uid,'milestoneName',e.target.value)}
                                    placeholder="Milestone name…"
                                    style={{...inp,width:'100%',fontWeight:600,color:'#111'}}/>
                                </td>

                                {/* Planned Date — changing it recascades subsequent milestones */}
                                <td style={{padding:'5px 6px',verticalAlign:'middle'}}>
                                  <input type="date" style={{...inp,width:'100%'}}
                                    value={ms.plannedDate?new Date(ms.plannedDate).toISOString().split('T')[0]:''}
                                    onChange={e => {
                                      const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
                                      setFormMs(prev => recascade(prev.map((m2, idx) => idx === i ? { ...m2, plannedDate: iso } : m2), i));
                                    }}/>
                                </td>

                                {/* Status select */}
                                <td style={{padding:'5px 6px',verticalAlign:'middle'}}>
                                  <select value={ms.status||'Next Milestone'} onChange={e=>smfm(ms.uid,'status',e.target.value)}
                                    style={{...inp,width:'100%',cursor:'pointer'}}>
                                    {['Next Milestone','On Going','Completed'].map(s=>(
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </td>

                                {/* Delete */}
                                <td style={{padding:'5px 6px',verticalAlign:'middle',textAlign:'center'}}>
                                  <button type="button" onClick={()=>setFormMs(p=>p.filter(r=>r.uid!==ms.uid))}
                                    title="Remove" style={{width:26,height:26,border:'none',borderRadius:6,cursor:'pointer',
                                      background:'#fff0f0',color:'#e53935',display:'inline-flex',alignItems:'center',
                                      justifyContent:'center',transition:'all .15s'}}
                                    onMouseEnter={e=>{e.currentTarget.style.background='#e53935';e.currentTarget.style.color='#fff';}}
                                    onMouseLeave={e=>{e.currentTarget.style.background='#fff0f0';e.currentTarget.style.color='#e53935';}}>
                                    <TrashIcon/>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Add Milestone button */}
                  <button type="button"
                    onClick={()=>setFormMs(p=>[...p,{uid:genUidMs(),milestoneName:'',milestoneOrder:p.length+1,plannedDate:null,status:'Next Milestone'}])}
                    style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:7,
                      padding:'7px 16px',background:'#fff',color:'#7b1fa2',
                      border:'1.5px dashed #ce93d8',borderRadius:8,fontSize:12,
                      fontWeight:700,cursor:'pointer',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f9f0ff';e.currentTarget.style.borderStyle='solid';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderStyle='dashed';}}>
                    <PlusIcon/> Add Milestone
                  </button>
                </div>
              </div>
              <div className="mod-drawer-footer">
                <button type="button" className="mod-btn mod-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                <button type="submit" className="mod-btn mod-btn-primary" disabled={saving}>{saving?'Saving…':drawerMode==='edit'?'Update Project':'Create Project'}</button>
              </div>
            </form>
          )}
        </aside>
      </>)}
    </div>
  );
}
