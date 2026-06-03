import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { checklistMasterApi, componentMetaApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import { generateChecklistsGridPdf } from '../../utils/pdfReport';
import './Checklists.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS    = ['Active', 'Inactive'];
const MANDATORY_OPTIONS = ['Yes', 'No'];

const EMPTY_FORM = {
  uid:'', chkId:'', checkPointS:'', checkpointDesc:'',
  department:'', zone:'', area:'', station:'',
  owner:'', category:'', material:'', mandatory:'No', status:'Active',
  createdBy:'', createdDate:'', modifiedBy:'', modifiedDate:'',
  flag1:'', flag2:'', flag3:'',
  refDocument:'', images:'',
};

// ── Attachment helpers ─────────────────────────────────────────────────────────
const parseImages = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
const parseDoc    = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// ── Helpers ───────────────────────────────────────────────────────────────────
const genUid = () => crypto.randomUUID().replace(/-/g, '').toUpperCase();

/** Compute next CHK#001 style ID from existing rows */
const nextChkId = (existingRows) => {
  let max = 0;
  existingRows.forEach(r => {
    const m = r.chkId?.match(/^CHK#(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `CHK#${String(max + 1).padStart(3, '0')}`;
};

/**
 * Extract dropdown options from ComponentMetadata.
 * API shape: { label: "ZONE", parameter: "FRONT UNIT", action: "Combo", status: "A" }
 *   label     → the category/type key  (filter by this)
 *   parameter → the actual option value (display this)
 *   action    → "Combo" marks it as a dropdown item
 *   status    → "A" = active
 */
const metaOptions = (metadata, labelKey) =>
  [...new Set(
    metadata
      .filter(m =>
        m.label?.toLowerCase() === labelKey?.toLowerCase() &&
        m.status?.toUpperCase() === 'ACTIVE'
      )
      .map(m => m.parameter)
      .filter(Boolean)
  )].sort();

const fmtDate = (v) => v
  ? new Date(v).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : '—';

// Excel column header → entity field mapping (case-insensitive, trimmed)
const EXCEL_COL_MAP = {
  'chkid':        'chkId',
  'checkpoints':  'checkPointS',
  'checkpoint':   'checkPointS',
  'description':  'checkpointDesc',
  'desc':         'checkpointDesc',
  'zone':         'zone',
  'station':      'station',
  'area':         'area',
  'mandatory':    'mandatory',
  'status':       'status',
  'department':   'department',
  'dept':         'department',
  'category':     'category',
  'material':     'material',
  'owner':        'owner',
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const EyeIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BanIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const ListIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const PlusIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const UploadIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const FileIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const ImgIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const TrashIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
const DocIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const PrintIcon    = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;

// ── Badges ────────────────────────────────────────────────────────────────────
const StatusBadge    = ({ v }) => <span className={`chk-badge ${v?.toLowerCase()==='active'?'chk-badge-active':'chk-badge-inactive'}`}>{v||'—'}</span>;
const MandatoryBadge = ({ v }) => <span className={`chk-badge ${v==='Yes'?'chk-badge-mandatory':'chk-badge-optional'}`}>{v||'—'}</span>;

// ── View field ────────────────────────────────────────────────────────────────
const VF = ({ label, value, badge, wide }) => (
  <div className={`chk-vf${wide?' chk-vf-wide':''}`}>
    <span className="chk-vf-label">{label}</span>
    <span className="chk-vf-value">{badge ?? (value || '—')}</span>
  </div>
);

// ── Drawer section title ──────────────────────────────────────────────────────
const Section = ({ title }) => <div className="chk-drawer-section-title">{title}</div>;

// ── Choice Select ─────────────────────────────────────────────────────────────
const ChoiceSelect = ({ value, onChange, options, placeholder = 'Select…', disabled }) => (
  <div className="chk-select-wrap">
    <select value={value} onChange={onChange} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <span className="chk-select-arrow">▾</span>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function Checklists() {
  const { user } = useAuth();
  const perm = usePermissions();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [rows,     setRows]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [metadata, setMetadata] = useState([]);   // ComponentMetadata

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ department:'', chkId:'', checkpoint:'', status:'' });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);

  // ── Checkpoint Preview Drawer ──────────────────────────────────────────────
  const [prevMount,   setPrevMount]   = useState(false);
  const [prevOpen,    setPrevOpen]    = useState(false);
  const [prevRow,     setPrevRow]     = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null); // full-screen image

  const openPreviewDrawer = (row) => {
    setPrevRow(row); setPrevMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setPrevOpen(true)));
  };
  const closePreviewDrawer = () => {
    setPrevOpen(false);
    setTimeout(() => { setPrevMount(false); setPrevRow(null); setLightboxImg(null); }, 320);
  };

  // ── Excel Import ────────────────────────────────────────────────────────────
  const [importOpen,    setImportOpen]    = useState(false);
  const [importRows,    setImportRows]    = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef  = useRef(null);
  const docInputRef   = useRef(null);
  const imgInputRef   = useRef(null);

  // ── Derived metadata option lists (all from ComponentMetadata API) ────────
  // label field = category key (e.g. "ZONE"), parameter field = option value
  const deptOptions     = metaOptions(metadata, 'Department');
  const zoneOptions     = metaOptions(metadata, 'Zone');
  const areaOptions     = metaOptions(metadata, 'Area');
  const stationOptions  = metaOptions(metadata, 'station_name');
  const categoryOptions = metaOptions(metadata, 'Category');
  const materialOptions = metaOptions(metadata, 'Material');
  const ownerOptions    = metaOptions(metadata, 'Owner');

  // ── Initial load — both APIs in parallel, all errors visible ─────────────
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      checklistMasterApi.getAll(),
      componentMetaApi.getAll(),
    ]).then(([chk, meta]) => {
      if (chk.status === 'fulfilled') {
        const data = chk.value ?? [];
        setRows(data);
        setFiltered(data);
      } else {
        console.error('[Checklists] load error:', chk.reason);
        Swal.fire({
          icon: 'error',
          title: 'Could not load checklists',
          html: `<b>Server response:</b> ${chk.reason?.message ?? 'Network error — is the backend running?'}`,
          confirmButtonColor: '#3f51b5',
        });
      }

      if (meta.status === 'fulfilled') {
        setMetadata(meta.value ?? []);
      } else {
        console.warn('[Checklists] metadata load error:', meta.reason);
        Swal.fire({
          icon: 'warning',
          title: 'Dropdown options unavailable',
          text: `Zone / Area / Station / Category lists could not be loaded. (${meta.reason?.message ?? 'Server error'})`,
          confirmButtonColor: '#3f51b5',
        });
      }
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload checklists only (called after save / deactivate) ───────────────
  const reload = async () => {
    try {
      const data = await checklistMasterApi.getAll();
      setRows(data);
      setFiltered(data);
      setPage(1);
    } catch (err) {
      console.error('[Checklists] reload error:', err);
      Swal.fire({ icon:'error', title:'Reload failed', text:err.message, confirmButtonColor:'#3f51b5' });
    }
  };

  // ── Filter / Search ────────────────────────────────────────────────────────
  const applyFilters = (src = rows) => {
    let r = [...src];
    if (filters.department) r = r.filter(x => x.department === filters.department);
    if (filters.chkId)      r = r.filter(x => x.chkId?.toLowerCase().includes(filters.chkId.toLowerCase()));
    if (filters.checkpoint) r = r.filter(x => x.checkPointS?.toLowerCase().includes(filters.checkpoint.toLowerCase()));
    if (filters.status)     r = r.filter(x => x.status === filters.status);
    return r;
  };

  const handleReset = () => { setFilters({ department:'', chkId:'', checkpoint:'', status:'' }); setFiltered(rows); setPage(1); };
  const setFilter   = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  // Instant filter: fires whenever filters or rows change
  useEffect(() => { setFiltered(applyFilters(rows)); setPage(1); }, [filters, rows]);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openDrawer = (mode, row = null) => {
    setDrawerMode(mode);
    setDrawerRow(row);
    setForm(
      row  ? { ...EMPTY_FORM, ...row }
           : { ...EMPTY_FORM, uid: genUid(), chkId: nextChkId(rows) }
    );
    setSaving(false);
    setDrawerMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerOpen(true)));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => { setDrawerMount(false); setSaving(false); }, 320);
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Attachment upload handlers ─────────────────────────────────────────────
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const { path } = await checklistMasterApi.uploadFile(file);
      setField('refDocument', JSON.stringify({ fileName: file.name, path }));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message, confirmButtonColor: '#3f51b5' });
    } finally {
      setUploading(false);
    }
  };

  const handleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    try {
      const results  = await Promise.all(files.map(f => checklistMasterApi.uploadFile(f)));
      const newPaths = results.map(r => r.path);
      const existing = parseImages(form.images);
      setField('images', JSON.stringify([...existing, ...newPaths]));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message, confirmButtonColor: '#3f51b5' });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => {
    const imgs = parseImages(form.images).filter((_, i) => i !== idx);
    setField('images', imgs.length ? JSON.stringify(imgs) : '');
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.chkId?.trim()) {
      Swal.fire({ icon:'warning', title:'Required', text:'Checklist ID is required.', confirmButtonColor:'#3f51b5' }); return;
    }
    if (!form.checkPointS?.trim()) {
      Swal.fire({ icon:'warning', title:'Required', text:'Checkpoint name is required.', confirmButtonColor:'#3f51b5' }); return;
    }
    setSaving(true);
    const now   = new Date().toISOString();
    const actor = user?.userId || user?.email || 'system';
    const isEdit = drawerMode === 'edit';
    const payload = isEdit
      ? { ...form, modifiedBy:actor, modifiedDate:now }
      : { ...form, createdBy:actor, createdDate:now, modifiedBy:actor, modifiedDate:now };

    try {
      isEdit
        ? await checklistMasterApi.update(form.uid, payload)
        : await checklistMasterApi.create(payload);
      closeDrawer();
      await reload();
      Swal.fire({
        icon:'success',
        title: isEdit ? 'Checklist Updated!' : 'Checklist Created!',
        text: `"${form.checkPointS}" has been ${isEdit?'updated':'created'} successfully.`,
        timer:2500, showConfirmButton:false, timerProgressBar:true,
      });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Save Failed', text:err.message, confirmButtonColor:'#3f51b5' });
    } finally {
      setSaving(false);
    }
  };

  // ── Soft Delete (status → Inactive) ───────────────────────────────────────
  const handleDelete = async (row) => {
    if (row.status?.toLowerCase() === 'inactive') {
      Swal.fire({ icon:'info', title:'Already Inactive', text:'This checklist is already deactivated.', confirmButtonColor:'#3f51b5' });
      return;
    }
    const result = await Swal.fire({
      title:'Deactivate this checklist?',
      html:`<b style="color:#2F2F7F">${row.chkId}</b> — ${row.checkPointS||''}<br/>
            <small style="color:#888;display:block;margin-top:6px">Status will be set to <b>Inactive</b>.<br/>No data will be permanently deleted.</small>`,
      icon:'warning',
      showCancelButton:true,
      confirmButtonColor:'#e67e22',
      cancelButtonColor:'#6c757d',
      confirmButtonText:'Yes, deactivate',
      cancelButtonText:'Cancel',
      reverseButtons:true,
    });
    if (!result.isConfirmed) return;

    try {
      const now   = new Date().toISOString();
      const actor = user?.userId || user?.email || 'system';
      await checklistMasterApi.update(row.uid, { ...row, status:'Inactive', modifiedBy:actor, modifiedDate:now });
      await reload();
      Swal.fire({ icon:'success', title:'Deactivated!', text:'Checklist status set to Inactive.', timer:2000, showConfirmButton:false, timerProgressBar:true });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Failed', text:err.message, confirmButtonColor:'#3f51b5' });
    }
  };

  // ── Excel import handlers ──────────────────────────────────────────────────
  const downloadTemplate = () => {
    const headers = [['ChkId','CheckPoints','Description','Department','Zone','Station','Area','Category','Material','Owner','Mandatory','Status']];
    const sample  = [['CHK#001','Sample Checkpoint','Description here','AVP','FRONT UNIT','Station A','Assembly','Safety','Steel','Engineer','Yes','Active']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
    ws['!cols'] = headers[0].map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checklists');
    XLSX.writeFile(wb, 'checklist_import_template.xlsx');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb  = XLSX.read(evt.target.result, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (raw.length === 0) {
          Swal.fire({ icon:'warning', title:'Empty File', text:'The Excel file has no data rows.', confirmButtonColor:'#3f51b5' });
          return;
        }
        const parsed = raw.map(row => {
          const rec = { ...EMPTY_FORM, uid: genUid() };
          Object.entries(row).forEach(([col, val]) => {
            const key = EXCEL_COL_MAP[col.trim().toLowerCase()];
            if (key) rec[key] = String(val).trim();
          });
          return rec;
        });
        setImportRows(parsed);
        setImportOpen(true);
      } catch {
        Swal.fire({ icon:'error', title:'Parse Error', text:'Could not read the file. Please use a valid .xlsx or .csv file.', confirmButtonColor:'#3f51b5' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    const missing = importRows.filter(r => !r.chkId?.trim());
    if (missing.length > 0) {
      Swal.fire({ icon:'warning', title:'Validation Error', text:`${missing.length} row(s) are missing a ChkId.`, confirmButtonColor:'#3f51b5' });
      return;
    }
    setImportLoading(true);
    const now   = new Date().toISOString();
    const actor = user?.userId || user?.email || 'system';
    const records = importRows.map(r => ({ ...r, createdBy:actor, createdDate:now, modifiedBy:actor, modifiedDate:now }));
    try {
      const res = await checklistMasterApi.createBatch(records);
      setImportOpen(false);
      setImportRows([]);
      await reload();
      if (res.failed > 0) {
        Swal.fire({
          icon:'warning', title:'Partial Import',
          html:`<b>${res.created}</b> imported, <b>${res.failed}</b> failed.<br/><small style="color:#888">${res.errors?.join('<br/>') ?? ''}</small>`,
          confirmButtonColor:'#3f51b5',
        });
      } else {
        Swal.fire({ icon:'success', title:'Import Successful!', text:`${res.created} record(s) imported successfully.`, timer:2500, showConfirmButton:false, timerProgressBar:true });
      }
    } catch (err) {
      Swal.fire({ icon:'error', title:'Import Failed', text:err.message, confirmButtonColor:'#3f51b5' });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const pageNums   = Array.from({ length:totalPages }, (_,i)=>i+1)
    .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1);

  // ── Drawer meta ────────────────────────────────────────────────────────────
  const drawerTitles = { view:'View Checklist', edit:'Edit Checklist', create:'New Checklist' };
  const drawerIcons  = { view:<EyeIcon/>, edit:<EditIcon/>, create:<PlusIcon/> };
  const drawerColors = { view:'#2980b9', edit:'#e67e22', create:'#27ae60' };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="chk-page">

      {/* ── Page Header ── */}
      <div className="chk-page-header">
        <div>
          <h1 className="chk-title">Checklists</h1>
          <p className="chk-subtitle">Manage master checklist records — view, create, edit and maintain checkpoints</p>
        </div>
        <div className="chk-header-actions">
          <button className="chk-btn chk-btn-outline" title="Print grid as PDF"
            onClick={() => generateChecklistsGridPdf({ rows: filtered, filename: `checklists-report-${Date.now()}.pdf` })}>
            <PrintIcon /> Print PDF
          </button>
          {perm.canCreate('checklists')&&<>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect} style={{ display:'none' }} />
            <button className="chk-btn chk-btn-success" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon /> Import Excel
            </button>
          </>}
          {perm.canCreate('checklists')&&<button className="chk-btn chk-btn-primary" onClick={() => openDrawer('create')}>
            <PlusIcon /> New Checklist
          </button>}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="chk-filter-card">
        <div className="chk-filter-label">Filter &amp; Search</div>
        <div className="chk-filter-row">

          <div className="chk-filter-field">
            <label>Department</label>
            <select value={filters.department} onChange={e => setFilter('department', e.target.value)}>
              <option value="">All Departments</option>
              {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="chk-filter-field">
            <label>Checklist ID</label>
            <input type="text" placeholder="e.g. CHK#001"
              value={filters.chkId}
              onChange={e => setFilter('chkId', e.target.value)} />
          </div>

          <div className="chk-filter-field">
            <label>Checkpoint</label>
            <input type="text" placeholder="Search name…"
              value={filters.checkpoint}
              onChange={e => setFilter('checkpoint', e.target.value)} />
          </div>

          <div className="chk-filter-field">
            <label>Status</label>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="chk-filter-actions">
            <button className="chk-btn chk-btn-outline" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* ── Data Grid ── */}
      <div className="chk-grid-card">
        <div className="chk-grid-meta">
          <span className="chk-count">
            {loading ? 'Loading…' : `${filtered.length} record${filtered.length!==1?'s':''} found`}
          </span>
          {loading && <span className="chk-loading-text">Fetching data…</span>}
        </div>

        <div className="chk-table-wrap">
          <table className="chk-table">
            <thead>
              <tr>
                <th style={{width:44}}>#</th>
                <th>Checklist ID</th>
                <th>Checkpoint</th>
                <th>Description</th>
                <th>Department</th>
                <th>Zone</th>
                <th>Category</th>
                <th>Mandatory</th>
                <th>Status</th>
                <th style={{width:110}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="chk-state-row"><td colSpan={10}>
                  <div className="chk-state-box loading"><div className="chk-spinner"/><span>Loading checklists…</span></div>
                </td></tr>
              )}
              {!loading && pageRows.length===0 && (
                <tr className="chk-state-row"><td colSpan={10}>
                  <div className="chk-state-box"><ListIcon/><span>No checklists found. Adjust filters or create a new record.</span></div>
                </td></tr>
              )}
              {!loading && pageRows.map((row,i) => (
                <tr key={row.uid} className="chk-tr">
                  <td className="chk-td-num">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td><span className="chk-id-tag">{row.chkId||'—'}</span></td>
                  <td className="chk-td-main">
                    <span style={{display:'inline-flex',alignItems:'center',gap:6,width:'100%'}}>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        title={row.checkPointS}>{row.checkPointS||'—'}</span>
                      <button onClick={()=>openPreviewDrawer(row)} title="View checkpoint details"
                        style={{flexShrink:0,width:22,height:22,border:'none',borderRadius:5,
                          cursor:'pointer',display:'inline-flex',alignItems:'center',
                          justifyContent:'center',background:'#e3f2fd',color:'#1565c0',
                          padding:0,transition:'background .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#1565c0';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#e3f2fd';e.currentTarget.style.color='#1565c0';}}>
                        <EyeIcon/>
                      </button>
                    </span>
                  </td>
                  <td className="chk-td-desc"  title={row.checkpointDesc}>{row.checkpointDesc||'—'}</td>
                  <td>{row.department||'—'}</td>
                  <td>{row.zone      ||'—'}</td>
                  <td>{row.category  ||'—'}</td>
                  <td><MandatoryBadge v={row.mandatory}/></td>
                  <td><StatusBadge    v={row.status}/></td>
                  <td className="chk-td-actions">
                    <button className="chk-action-btn chk-action-view" title="View" onClick={()=>openDrawer('view',row)}><EyeIcon/></button>
                    {perm.canEdit('checklists',row)&&<button className="chk-action-btn chk-action-edit" title="Edit" onClick={()=>openDrawer('edit',row)}><EditIcon/></button>}
                    {perm.canDelete('checklists',row)&&<button className="chk-action-btn chk-action-deactivate" title="Deactivate" onClick={()=>handleDelete(row)} disabled={row.status?.toLowerCase()==='inactive'}><BanIcon/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages>1 && (
          <div className="chk-pagination">
            <button className="chk-page-btn" disabled={page===1}          onClick={()=>setPage(1)}>«</button>
            <button className="chk-page-btn" disabled={page===1}          onClick={()=>setPage(p=>p-1)}>‹</button>
            {pageNums.map((p,idx) => {
              const prev = pageNums[idx-1];
              return (<span key={p} style={{display:'contents'}}>
                {prev && p-prev>1 && <span className="chk-page-ellipsis">…</span>}
                <button className={`chk-page-btn${p===page?' active':''}`} onClick={()=>setPage(p)}>{p}</button>
              </span>);
            })}
            <button className="chk-page-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="chk-page-btn" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</button>
            <span className="chk-page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* ══════════ SIDE DRAWER ══════════ */}
      {drawerMount && (
        <>
          <div className={`chk-drawer-overlay${drawerOpen?' open':''}`} onClick={closeDrawer}/>
          <aside className={`chk-drawer${drawerOpen?' open':''}`}>

            {/* Header */}
            <div className="chk-drawer-header" style={{borderBottomColor: drawerColors[drawerMode]+'33'}}>
              <div className="chk-drawer-header-left">
                <div className="chk-drawer-mode-icon" style={{background:drawerColors[drawerMode]+'18', color:drawerColors[drawerMode]}}>
                  {drawerIcons[drawerMode]}
                </div>
                <div>
                  <h2 className="chk-drawer-title">{drawerTitles[drawerMode]}</h2>
                  <p className="chk-drawer-subtitle">
                    {drawerMode==='create'
                      ? 'Fill in the details to create a new checklist'
                      : `${drawerRow?.chkId||''} — ${drawerRow?.checkPointS||''}`}
                  </p>
                </div>
              </div>
              <button className="chk-drawer-close" onClick={closeDrawer} type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* ── VIEW ── */}
            {drawerMode==='view' && (<>
              <div className="chk-drawer-body">
                <div className="chk-view-block">
                  <Section title="Identity"/>
                  <div className="chk-vf-grid">
                    <VF label="Checklist ID"   value={drawerRow?.chkId}/>
                    <VF label="Status"         badge={<StatusBadge v={drawerRow?.status}/>}/>
                    <VF label="Checkpoint"     value={drawerRow?.checkPointS} wide/>
                    <VF label="Description"    value={drawerRow?.checkpointDesc} wide/>
                  </div>
                </div>
                <div className="chk-view-block">
                  <Section title="Location &amp; Classification"/>
                  <div className="chk-vf-grid">
                    <VF label="Department" value={drawerRow?.department}/>
                    <VF label="Zone"       value={drawerRow?.zone}/>
                    <VF label="Area"       value={drawerRow?.area}/>
                    <VF label="Station"    value={drawerRow?.station}/>
                    <VF label="Category"   value={drawerRow?.category}/>
                    <VF label="Material"   value={drawerRow?.material}/>
                  </div>
                </div>
                <div className="chk-view-block">
                  <Section title="Ownership"/>
                  <div className="chk-vf-grid">
                    <VF label="Owner"     value={drawerRow?.owner}/>
                    <VF label="Mandatory" badge={<MandatoryBadge v={drawerRow?.mandatory}/>}/>
                  </div>
                </div>
                <div className="chk-view-block">
                  <Section title="Audit Trail"/>
                  <div className="chk-vf-grid">
                    <VF label="Created By"    value={drawerRow?.createdBy}/>
                    <VF label="Created Date"  value={fmtDate(drawerRow?.createdDate)}/>
                    <VF label="Modified By"   value={drawerRow?.modifiedBy}/>
                    <VF label="Modified Date" value={fmtDate(drawerRow?.modifiedDate)}/>
                  </div>
                </div>

                {/* Attachments in View */}
                {(drawerRow?.refDocument || drawerRow?.images) && (
                  <div className="chk-view-block">
                    <Section title="Attachments"/>
                    {parseDoc(drawerRow?.refDocument) && (
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Reference Document</div>
                        <a href={parseDoc(drawerRow.refDocument).path || parseDoc(drawerRow.refDocument).data}
                          download={parseDoc(drawerRow.refDocument).fileName}
                          target="_blank" rel="noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 14px',
                            background:'#e8f4ff',border:'1px solid #90caf9',borderRadius:8,
                            color:'#1565c0',fontSize:13,fontWeight:600,textDecoration:'none'}}>
                          <DownloadIcon/>{parseDoc(drawerRow.refDocument).fileName}
                        </a>
                      </div>
                    )}
                    {parseImages(drawerRow?.images).length > 0 && (
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Images ({parseImages(drawerRow.images).length})</div>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                          {parseImages(drawerRow.images).map((src,i)=>(
                            <img key={i} src={src} alt={`img-${i+1}`}
                              style={{width:90,height:90,objectFit:'cover',borderRadius:8,
                                border:'1px solid #e0e4f0',cursor:'pointer'}}
                              onClick={()=>openPreviewDrawer(drawerRow)}/>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="chk-drawer-footer">
                <button className="chk-btn chk-btn-outline" onClick={closeDrawer}>Close</button>
                {perm.canEdit('checklists',drawerRow)&&<button className="chk-btn chk-btn-primary" onClick={()=>setDrawerMode('edit')}><EditIcon/> Edit Record</button>}
              </div>
            </>)}

            {/* ── EDIT / CREATE ── */}
            {(drawerMode==='edit'||drawerMode==='create') && (
              <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
                <div className="chk-drawer-body">

                  {/* Identity */}
                  <div className="chk-form-block">
                    <Section title="Identity"/>
                    <div className="chk-form-grid">

                      <div className="chk-field">
                        <label>Checklist ID <span className="req">*</span></label>
                        <input value={form.chkId}
                          onChange={e=>setField('chkId',e.target.value)}
                          placeholder="CHK#001" required/>
                        <span className="chk-field-hint">Auto-generated — editable if needed</span>
                      </div>

                      <div className="chk-field">
                        <label>Status <span className="req">*</span></label>
                        <ChoiceSelect value={form.status} options={STATUS_OPTIONS}
                          onChange={e=>setField('status',e.target.value)} placeholder="Select status…"/>
                      </div>

                      <div className="chk-field chk-field-full">
                        <label>Checkpoint Name <span className="req">*</span></label>
                        <input value={form.checkPointS}
                          onChange={e=>setField('checkPointS',e.target.value)}
                          placeholder="Enter checkpoint name…" required/>
                      </div>

                      <div className="chk-field chk-field-full">
                        <label>Description</label>
                        <textarea value={form.checkpointDesc}
                          onChange={e=>setField('checkpointDesc',e.target.value)}
                          placeholder="Optional checkpoint description…" rows={2}/>
                      </div>

                    </div>
                  </div>

                  {/* Location */}
                  <div className="chk-form-block">
                    <Section title="Location &amp; Classification"/>
                    <div className="chk-form-grid">

                      <div className="chk-field">
                        <label>Department</label>
                        <ChoiceSelect value={form.department} options={deptOptions}
                          onChange={e=>setField('department',e.target.value)} placeholder="Select department…"/>
                      </div>

                      <div className="chk-field">
                        <label>Zone</label>
                        <ChoiceSelect value={form.zone} options={zoneOptions}
                          onChange={e=>setField('zone',e.target.value)} placeholder="Select zone…"/>
                      </div>

                      <div className="chk-field">
                        <label>Area</label>
                        <ChoiceSelect value={form.area} options={areaOptions}
                          onChange={e=>setField('area',e.target.value)} placeholder="Select area…"/>
                      </div>

                      <div className="chk-field">
                        <label>Station</label>
                        <ChoiceSelect value={form.station} options={stationOptions}
                          onChange={e=>setField('station',e.target.value)} placeholder="Select station…"/>
                      </div>

                      <div className="chk-field">
                        <label>Category</label>
                        <ChoiceSelect value={form.category} options={categoryOptions}
                          onChange={e=>setField('category',e.target.value)} placeholder="Select category…"/>
                      </div>

                      <div className="chk-field">
                        <label>Material</label>
                        <ChoiceSelect value={form.material} options={materialOptions}
                          onChange={e=>setField('material',e.target.value)} placeholder="Select material…"/>
                      </div>

                    </div>
                  </div>

                  {/* Ownership */}
                  <div className="chk-form-block">
                    <Section title="Ownership"/>
                    <div className="chk-form-grid">
                      <div className="chk-field">
                        <label>Owner</label>
                        <ChoiceSelect value={form.owner} options={ownerOptions}
                          onChange={e=>setField('owner',e.target.value)} placeholder="Select owner…"/>
                      </div>
                      <div className="chk-field">
                        <label>Mandatory</label>
                        <ChoiceSelect value={form.mandatory} options={MANDATORY_OPTIONS}
                          onChange={e=>setField('mandatory',e.target.value)} placeholder="Select…"/>
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="chk-form-block" style={{marginBottom:0}}>
                    <Section title="Attachments"/>
                    <div style={{display:'flex',flexDirection:'column',gap:16}}>

                      {/* Reference Document */}
                      <div>
                        <label style={{fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:6}}>
                          Reference Document <span style={{color:'#888',fontWeight:400,textTransform:'none'}}>(single file)</span>
                        </label>
                        {parseDoc(form.refDocument) ? (
                          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                            background:'#f0f4ff',border:'1.5px solid #c5cff7',borderRadius:8}}>
                            <DocIcon/>
                            <span style={{flex:1,fontSize:13,color:'#3f51b5',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {parseDoc(form.refDocument).fileName}
                            </span>
                            <button type="button" onClick={()=>setField('refDocument','')}
                              style={{border:'none',background:'none',cursor:'pointer',color:'#e53935',padding:2}}
                              title="Remove document">
                              <TrashIcon/>
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={()=>docInputRef.current?.click()}
                            disabled={uploading}
                            style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 16px',
                              background:'#fafbff',border:'1.5px dashed #c5cff7',borderRadius:8,
                              cursor:uploading?'not-allowed':'pointer',fontSize:13,color:'#3f51b5',fontWeight:600,
                              opacity:uploading?0.6:1}}>
                            <DocIcon/> {uploading ? 'Uploading…' : 'Upload Document'}
                          </button>
                        )}
                        <input ref={docInputRef} type="file" style={{display:'none'}} onChange={handleDocUpload}/>
                      </div>

                      {/* Images */}
                      <div>
                        <label style={{fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:6}}>
                          Images <span style={{color:'#888',fontWeight:400,textTransform:'none'}}>(multiple)</span>
                        </label>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
                          {parseImages(form.images).map((src,idx)=>(
                            <div key={idx} style={{position:'relative',width:80,height:80,borderRadius:8,overflow:'hidden',
                              border:'1.5px solid #e0e4f0',flexShrink:0}}>
                              <img src={src} alt={`img-${idx+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              <button type="button" onClick={()=>removeImage(idx)}
                                style={{position:'absolute',top:3,right:3,width:18,height:18,border:'none',
                                  borderRadius:'50%',background:'rgba(229,57,53,.9)',color:'#fff',
                                  cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',
                                  lineHeight:1,padding:0}}>✕</button>
                            </div>
                          ))}
                          <button type="button" onClick={()=>imgInputRef.current?.click()}
                            disabled={uploading}
                            style={{width:80,height:80,border:'1.5px dashed #c5cff7',borderRadius:8,
                              background:'#fafbff',cursor:uploading?'not-allowed':'pointer',display:'flex',flexDirection:'column',
                              alignItems:'center',justifyContent:'center',gap:4,color:'#3f51b5',flexShrink:0,
                              opacity:uploading?0.6:1}}>
                            <ImgIcon/><span style={{fontSize:11,fontWeight:600}}>{uploading?'…':'Add'}</span>
                          </button>
                          <input ref={imgInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleImagesUpload}/>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                <div className="chk-drawer-footer">
                  <button type="button" className="chk-btn chk-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                  <button type="submit" className="chk-btn chk-btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : drawerMode==='edit' ? 'Update Checklist' : 'Create Checklist'}
                  </button>
                </div>
              </form>
            )}

          </aside>
        </>
      )}

      {/* ══════════ CHECKPOINT PREVIEW DRAWER ══════════ */}
      {prevMount && (<>
        <div className={`chk-drawer-overlay${prevOpen?' open':''}`} onClick={closePreviewDrawer}/>
        <aside className={`chk-drawer${prevOpen?' open':''}`} style={{width:520,maxWidth:'96vw'}}>

          {/* Header */}
          <div className="chk-drawer-header" style={{borderBottomColor:'#1565c033'}}>
            <div className="chk-drawer-header-left">
              <div className="chk-drawer-mode-icon" style={{background:'#e3f2fd',color:'#1565c0'}}><EyeIcon/></div>
              <div>
                <h2 className="chk-drawer-title">Checkpoint Detail</h2>
                <p className="chk-drawer-subtitle">{prevRow?.chkId} — {prevRow?.checkPointS}</p>
              </div>
            </div>
            <button className="chk-drawer-close" onClick={closePreviewDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="chk-drawer-body" style={{display:'flex',flexDirection:'column',gap:20}}>

            {/* Description */}
            <div style={{background:'#f8faff',border:'1px solid #dde3f7',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8}}>Description</div>
              <p style={{margin:0,fontSize:14,color:'#333',lineHeight:1.6}}>
                {prevRow?.checkpointDesc || <span style={{color:'#bbb'}}>No description provided.</span>}
              </p>
              <div style={{display:'flex',gap:16,marginTop:10,flexWrap:'wrap'}}>
                {prevRow?.department&&<span style={{fontSize:11,color:'#666'}}><b>Dept:</b> {prevRow.department}</span>}
                {prevRow?.category&&<span style={{fontSize:11,color:'#666'}}><b>Category:</b> {prevRow.category}</span>}
                {prevRow?.zone&&<span style={{fontSize:11,color:'#666'}}><b>Zone:</b> {prevRow.zone}</span>}
                {prevRow?.mandatory&&<span style={{fontSize:11,color:'#666'}}><b>Mandatory:</b> {prevRow.mandatory}</span>}
              </div>
            </div>

            {/* Reference Document */}
            {parseDoc(prevRow?.refDocument) ? (
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8}}>Reference Document</div>
                <a href={parseDoc(prevRow.refDocument).path || parseDoc(prevRow.refDocument).data}
                  download={parseDoc(prevRow.refDocument).fileName}
                  target="_blank" rel="noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:10,padding:'12px 18px',
                    background:'linear-gradient(135deg,#e8f4ff,#dbeffe)',
                    border:'1.5px solid #90caf9',borderRadius:10,
                    color:'#1565c0',fontSize:13,fontWeight:700,textDecoration:'none',
                    transition:'filter .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.filter='brightness(.95)'}
                  onMouseLeave={e=>e.currentTarget.style.filter=''}>
                  <DownloadIcon/>
                  <div>
                    <div style={{fontSize:13}}>{parseDoc(prevRow.refDocument).fileName}</div>
                    <div style={{fontSize:11,color:'#5c85c9',fontWeight:400}}>Click to download</div>
                  </div>
                </a>
              </div>
            ) : (
              <div style={{padding:'12px 16px',background:'#fafafa',borderRadius:8,border:'1px dashed #e0e0e0',
                color:'#bbb',fontSize:12,textAlign:'center'}}>No reference document attached</div>
            )}

            {/* Images */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8}}>
                Images {parseImages(prevRow?.images).length > 0 && `(${parseImages(prevRow.images).length})`}
              </div>
              {parseImages(prevRow?.images).length === 0 ? (
                <div style={{padding:'12px 16px',background:'#fafafa',borderRadius:8,border:'1px dashed #e0e0e0',
                  color:'#bbb',fontSize:12,textAlign:'center'}}>No images attached</div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:10}}>
                  {parseImages(prevRow.images).map((src,i)=>(
                    <div key={i} onClick={()=>setLightboxImg(src)}
                      style={{aspectRatio:'1',borderRadius:10,overflow:'hidden',
                        border:'1.5px solid #e0e4f0',cursor:'zoom-in',
                        transition:'transform .15s,box-shadow .15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.12)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='';}}>
                      <img src={src} alt={`img-${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>History</div>
              <div style={{display:'flex',flexDirection:'column',gap:0,borderLeft:'2px solid #e8eaf6',paddingLeft:16}}>
                {prevRow?.createdBy && (
                  <div style={{position:'relative',paddingBottom:12}}>
                    <span style={{position:'absolute',left:-21,top:4,width:8,height:8,borderRadius:'50%',background:'#3f51b5',border:'2px solid #fff',boxShadow:'0 0 0 2px #c5cae9'}}/>
                    <div style={{fontSize:12,fontWeight:700,color:'#3f51b5'}}>Created</div>
                    <div style={{fontSize:12,color:'#555'}}>{prevRow.createdBy}</div>
                    <div style={{fontSize:11,color:'#aaa'}}>{fmtDate(prevRow.createdDate)}</div>
                  </div>
                )}
                {prevRow?.modifiedBy && (
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:-21,top:4,width:8,height:8,borderRadius:'50%',background:'#e67e22',border:'2px solid #fff',boxShadow:'0 0 0 2px #ffe0b2'}}/>
                    <div style={{fontSize:12,fontWeight:700,color:'#e67e22'}}>Last Modified</div>
                    <div style={{fontSize:12,color:'#555'}}>{prevRow.modifiedBy}</div>
                    <div style={{fontSize:11,color:'#aaa'}}>{fmtDate(prevRow.modifiedDate)}</div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="chk-drawer-footer">
            <button className="chk-btn chk-btn-outline" onClick={closePreviewDrawer}>Close</button>
            {perm.canEdit('checklists',prevRow)&&(
              <button className="chk-btn chk-btn-primary" onClick={()=>{closePreviewDrawer();openDrawer('edit',prevRow);}}>
                <EditIcon/> Edit
              </button>
            )}
          </div>
        </aside>

        {/* Lightbox */}
        {lightboxImg && (
          <div onClick={()=>setLightboxImg(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:9999,
              display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
            <img src={lightboxImg} alt="preview"
              style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,
                boxShadow:'0 8px 40px rgba(0,0,0,.6)',objectFit:'contain'}}/>
            <button onClick={()=>setLightboxImg(null)}
              style={{position:'absolute',top:20,right:24,background:'rgba(255,255,255,.15)',
                border:'none',color:'#fff',fontSize:22,cursor:'pointer',width:40,height:40,
                borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
        )}
      </>)}

      {/* ══════════ IMPORT MODAL ══════════ */}
      {importOpen && (
        <div className="chk-modal-overlay" onClick={e => e.target === e.currentTarget && setImportOpen(false)}>
          <div className="chk-import-modal">

            {/* Header */}
            <div className="chk-import-header">
              <div className="chk-import-header-left">
                <div className="chk-import-icon"><FileIcon /></div>
                <div>
                  <h2>Import Excel</h2>
                  <p>{importRows.length} record{importRows.length !== 1 ? 's' : ''} ready to import</p>
                </div>
              </div>
              <div className="chk-import-header-right">
                <button className="chk-btn chk-btn-outline chk-btn-sm" onClick={downloadTemplate} title="Download a blank template">
                  Download Template
                </button>
                <button className="chk-drawer-close" onClick={() => { setImportOpen(false); setImportRows([]); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Preview Grid */}
            <div className="chk-import-body">
              <div className="chk-import-table-wrap">
                <table className="chk-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ChkId</th>
                      <th>CheckPoints</th>
                      <th>Description</th>
                      <th>Zone</th>
                      <th>Station</th>
                      <th>Area</th>
                      <th>Mandatory</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => (
                      <tr key={i} className={`chk-tr${!row.chkId?.trim() ? ' chk-tr-error' : ''}`}>
                        <td className="chk-td-num">{i + 1}</td>
                        <td>
                          {row.chkId?.trim()
                            ? <span className="chk-id-tag">{row.chkId}</span>
                            : <span className="chk-missing">⚠ Missing</span>}
                        </td>
                        <td className="chk-td-main" title={row.checkPointS}>{row.checkPointS || '—'}</td>
                        <td className="chk-td-desc"  title={row.checkpointDesc}>{row.checkpointDesc || '—'}</td>
                        <td>{row.zone    || '—'}</td>
                        <td>{row.station || '—'}</td>
                        <td>{row.area    || '—'}</td>
                        <td><MandatoryBadge v={row.mandatory} /></td>
                        <td><StatusBadge    v={row.status}    /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="chk-import-footer">
              <button className="chk-btn chk-btn-outline" disabled={importLoading}
                onClick={() => fileInputRef.current?.click()}>
                <UploadIcon /> Change File
              </button>
              <div style={{ flex: 1 }} />
              <button className="chk-btn chk-btn-outline" disabled={importLoading}
                onClick={() => { setImportOpen(false); setImportRows([]); }}>
                Cancel
              </button>
              <button className="chk-btn chk-btn-success" disabled={importLoading || importRows.length === 0}
                onClick={handleImportSubmit}>
                {importLoading ? 'Importing…' : `Submit (${importRows.length})`}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
