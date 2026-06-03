import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  dmrsApi, checklistMasterApi, checklistMilestoneApi,
  issueDocApi, componentMetaApi, projectIssueLinkApi,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { downloadTemplate, exportToExcel, parseExcel } from '../../utils/excelUtils';
import usePermissions from '../../hooks/usePermissions';
import './DmrsChecklists.css';

// ── constants ──────────────────────────────────────────────────────────────────
const SYNC_STATUS = ['','OK','Not OK','N/A','Pending'];
const PAGE_SIZE   = 12;

const EMPTY = {
  uid:'', partNumber:'', issue_number:'', check_Point:'', mrs:'',
  description:'', source_Link:'', zone:'', stations:'', owner:'',
  syncData:'{}',
  mimS_ID:'',remarks:'',changeManagement:'',
  flag1:'',flag2:'',flag3:'',status:'Active',
  createdBy:'',createdDate:'',modifiedBy:'',modifiedDate:'',
};

// Excel column definitions — sync data stored as a single JSON column
const XL_COLS = [
  {header:'Part Number',  key:'partNumber'},
  {header:'Issue Number', key:'issue_number'},
  {header:'Check Point',  key:'check_Point'},
  {header:'Description',  key:'description'},
  {header:'Zone',         key:'zone'},
  {header:'Stations',     key:'stations'},
  {header:'Owner',        key:'owner'},
  {header:'Source Link',  key:'source_Link'},
  {header:'MIMS ID',      key:'mimS_ID'},
  {header:'Sync Data',    key:'syncData'},
  {header:'Remarks',      key:'remarks'},
  {header:'Change Mgmt',  key:'changeManagement'},
  {header:'Status',       key:'status'},
];

// header → model key mapping for import
const XL_MAP = Object.fromEntries(XL_COLS.map(c=>[c.header.toLowerCase(), c.key]));

// ── helpers ────────────────────────────────────────────────────────────────────
const genUid     = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate    = v => v ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const today      = new Date();
const syncColor  = v => ({OK:'#27ae60','Not OK':'#e74c3c',Pending:'#e67e22','N/A':'#888'}[v]||'#bbb');

// Returns the active milestone label (milestoneid) for the current date window, or null.
const getActiveMilestoneLabel = (issueNumber, milestones, projectLinks) => {
  if (!milestones.length) return null;
  const link       = (projectLinks || []).find(l => l.issue_number === issueNumber);
  const projectUid = link?.project;
  if (!projectUid) return null;
  const relevant = milestones.filter(m => m.milestone && m.flag1 === projectUid);
  for (const ms of relevant.sort((a,b)=>new Date(a.milestone)-new Date(b.milestone))) {
    const start = new Date(ms.milestone);
    const end   = new Date(start);
    end.setDate(end.getDate() + (ms.noofDays||30));
    if (today >= start && today <= end) return ms.milestoneid || null;
  }
  return null;
};

// Parse SyncData JSON and return {result, comment} for a given milestone label.
const parseSyncEntry = (row, milestoneLabel) => {
  if (!milestoneLabel) return { result: '', comment: '' };
  let parsed = {};
  try { parsed = JSON.parse(row.syncData || '{}'); } catch {}
  const combined = parsed[milestoneLabel] || '';
  const pipeIdx  = combined.indexOf('|');
  return {
    result:  pipeIdx >= 0 ? combined.slice(0, pipeIdx) : combined,
    comment: pipeIdx >= 0 ? combined.slice(pipeIdx + 1) : '',
  };
};

// Return all milestone entries from SyncData as [{label, result, comment}].
const allSyncEntries = (row) => {
  let parsed = {};
  try { parsed = JSON.parse(row.syncData || '{}'); } catch {}
  return Object.entries(parsed).map(([label, combined]) => {
    const pipeIdx = combined.indexOf('|');
    return {
      label,
      result:  pipeIdx >= 0 ? combined.slice(0, pipeIdx) : combined,
      comment: pipeIdx >= 0 ? combined.slice(pipeIdx + 1) : '',
    };
  });
};

// ── icons ──────────────────────────────────────────────────────────────────────
const PlusIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EyeIcon       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
const ImgIcon       = () => <svg viewBox="0 0 24 24" width="15px" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18px" height="18px" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const SeedIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 8v4l3 3"/></svg>;
const DownloadIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const UploadIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const ExportIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

const StatusBadge = ({v}) => <span className={`dmrs-badge ${v?.toLowerCase()==='active'?'dmrs-badge-active':'dmrs-badge-inactive'}`}>{v||'—'}</span>;

const VF = ({label,value,wide,mono,badge}) => (
  <div className={`dmrs-vf${wide?' dmrs-vf-wide':''}`}>
    <span className="dmrs-vf-label">{label}</span>
    <span className={`dmrs-vf-value${mono?' dmrs-mono':''}`}>{badge??(value||'—')}</span>
  </div>
);
const Sec = ({t}) => <div className="dmrs-sec">{t}</div>;
const Sel = ({value,onChange,options,placeholder='Select…',required}) => (
  <div className="dmrs-sel-wrap">
    <select value={value||''} onChange={onChange} required={required}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
    <span className="dmrs-sel-arrow">▾</span>
  </div>
);

// ── Clipboard icon ────────────────────────────────────────────────────────────
const ClipboardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

// ── MRS attachment ─────────────────────────────────────────────────────────────
function MrsBox({value,onChange,readOnly}) {
  const ref = useRef(null);

  const read = f => {
    const r = new FileReader();
    r.onload = ev => onChange?.(ev.target.result);
    r.readAsDataURL(f);
  };
  const onFile  = e => { if(e.target.files?.[0]) read(e.target.files[0]); e.target.value=''; };
  const onPaste = e => {
    const it = Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
    if(!it) return; e.preventDefault(); read(it.getAsFile());
  };

  // Explicit "Paste" button — reads image from clipboard API
  const handlePasteBtn = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) { read(await item.getType(imgType)); return; }
      }
      Swal.fire({icon:'info',title:'No image in clipboard',text:'Copy an image first, then click Paste.',confirmButtonColor:'#3f51b5',timer:2500,showConfirmButton:false,timerProgressBar:true});
    } catch {
      Swal.fire({icon:'warning',title:'Clipboard access denied',text:'Allow clipboard access or focus the preview area and press Ctrl+V.',confirmButtonColor:'#3f51b5'});
    }
  };

  if (readOnly) return value
    ? <img src={value} alt="MRS" className="dmrs-mrs-full"/>
    : <div className="dmrs-mrs-empty-full"><ImgIcon/><span>No MRS attached</span></div>;

  return (
    <div className="dmrs-mrs-box" tabIndex={0} onPaste={onPaste}>
      <input ref={ref} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={onFile}/>

      {value ? (
        /* ── Image attached: preview + replace + clear ── */
        <>
          <div className="dmrs-mrs-preview" style={{cursor:'pointer'}}
            onClick={()=>ref.current.click()} title="Click to replace image">
            <img src={value} alt="MRS" className="dmrs-mrs-img"/>
          </div>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <button type="button" onClick={()=>ref.current.click()}
              style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,
                height:30,border:'1.5px solid #b0bdf5',borderRadius:6,background:'#f0f4ff',
                color:'#3f51b5',fontSize:11,fontWeight:600,cursor:'pointer'}}>
              <ImgIcon style={{width:12,height:12}}/> Replace
            </button>
            <button type="button" onClick={()=>onChange?.('')}
              style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,
                height:30,border:'1.5px solid #fca5a5',borderRadius:6,background:'#fff0f0',
                color:'#e53935',fontSize:11,fontWeight:600,cursor:'pointer'}}>
              ✕ Remove
            </button>
          </div>
        </>
      ) : (
        /* ── Empty: Upload + Paste buttons ── */
        <>
          <div className="dmrs-mrs-preview" style={{cursor:'default',borderStyle:'dashed'}}>
            <div className="dmrs-mrs-empty">
              <ImgIcon/>
              <span style={{fontSize:12,color:'#aaa'}}>No attachment</span>
            </div>
          </div>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <button type="button" onClick={()=>ref.current.click()}
              style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,
                height:34,border:'1.5px solid #b0bdf5',borderRadius:6,background:'#f0f4ff',
                color:'#3f51b5',fontSize:12,fontWeight:600,cursor:'pointer'}}>
              <ImgIcon style={{width:"13px",height:"13px"}}/> Upload
            </button>
            <button type="button" onClick={handlePasteBtn}
              style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,
                height:34,border:'1.5px solid #a5d6a7',borderRadius:6,background:'#e8f5e9',
                color:'#1b5e20',fontSize:12,fontWeight:600,cursor:'pointer'}}>
              <ClipboardIcon style={{width:"13px",height:"13px"}}/> Paste
            </button>
          </div>
          <p style={{margin:'6px 0 0',textAlign:'center',fontSize:10,color:'#bbb'}}>
            or focus above and press Ctrl+V
          </p>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DmrsChecklists() {
  const {user}   = useAuth();
  const perm     = usePermissions();
  const actor    = user?.userId||user?.email||'system';
  const xlRef    = useRef(null);   // hidden file input for import
  const navigate = useNavigate();
  const location = useLocation();

  const [rows,       setRows]       = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [master,     setMaster]     = useState([]);
  const [issues,     setIssues]     = useState([]);
  const [meta,       setMeta]       = useState([]);
  const [page,       setPage]       = useState(1);
  const [filters,    setFilters]    = useState({
    partNumber:  location.state?.partNumber  || '',
    issueNumber: location.state?.issueNumber || '',
    status:'', zone:'', search:'',
  });

  const [projectLinks, setProjectLinks] = useState([]);

  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState({...EMPTY});
  const [saving,      setSaving]      = useState(false);
  const [seeding,     setSeeding]     = useState(false);

  // ── options ──────────────────────────────────────────────────
  const partOpts  = [...new Set(issues.map(i=>i.partNumber).filter(Boolean))].sort();
  const issueOpts = [...new Set(issues.map(i=>i.issue_number).filter(Boolean))].sort();
  const zoneOpts  = [...new Set([
    ...rows.map(r=>r.zone),
    ...meta.filter(m=>m.label?.toLowerCase()==='zone'&&m.status?.toUpperCase()==='ACTIVE').map(m=>m.parameter),
  ].filter(Boolean))].sort();

  // ── load ─────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      dmrsApi.getAll(),
      checklistMasterApi.getAll(),
      checklistMilestoneApi.getAll(),
      issueDocApi.getAll(),
      componentMetaApi.getAll(),
      projectIssueLinkApi.getAll(),
    ]).then(([dmRes,mstRes,msRes,issRes,metaRes,linkRes]) => {
      if (dmRes.status==='fulfilled')   { setRows(dmRes.value??[]); setFiltered(dmRes.value??[]); }
      if (mstRes.status==='fulfilled')  setMaster(mstRes.value??[]);
      if (msRes.status==='fulfilled')   setMilestones(msRes.value??[]);
      if (issRes.status==='fulfilled')  setIssues(issRes.value??[]);
      if (metaRes.status==='fulfilled') setMeta(metaRes.value??[]);
      if (linkRes.status==='fulfilled') setProjectLinks(linkRes.value??[]);
    }).finally(()=>setLoading(false));
  },[]);

  const reload = () => dmrsApi.getAll()
    .then(d=>{ setRows(d); applyFilters(d); setPage(1); })
    .catch(err=>Swal.fire({icon:'error',title:'Reload failed',text:err.message,confirmButtonColor:'#3f51b5'}));

  const applyFilters = (src=rows, f=filters) => {
    let r=[...src];
    if (f.partNumber)  r=r.filter(x=>x.partNumber===f.partNumber);
    if (f.issueNumber) r=r.filter(x=>x.issue_number===f.issueNumber);
    if (f.status)      r=r.filter(x=>x.status===f.status);
    if (f.zone)        r=r.filter(x=>x.zone===f.zone);
    if (f.search) {
      const q=f.search.toLowerCase();
      r=r.filter(x=>x.check_Point?.toLowerCase().includes(q)||x.description?.toLowerCase().includes(q)||x.mimS_ID?.toLowerCase().includes(q)||x.owner?.toLowerCase().includes(q));
    }
    setFiltered(r); setPage(1);
  };
  // Instant filter on any filter or data change
  useEffect(() => { applyFilters(rows, filters); }, [filters, rows]);
  const setF=(k,v)=>setFilters(p=>({...p,[k]:v}));
  const sf  =(k,v)=>setForm(p=>({...p,[k]:v}));

  // ── drawer ────────────────────────────────────────────────────
  const openDrawer=(mode,row=null)=>{
    setDrawerMode(mode); setDrawerRow(row); setSaving(false);
    setForm(row?{...EMPTY,...row}:{...EMPTY,uid:genUid()});
    setDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setDrawerOpen(true)));
  };
  const closeDrawer=()=>{ setDrawerOpen(false); setTimeout(()=>{setDrawerMount(false);setSaving(false);},320); };

  // ── WGDE seed ─────────────────────────────────────────────────
  const seedWgte = async (partNumber, issueNum) => {
    const wgte=master.filter(m=>{
      const d=(m.department||'').trim().toLowerCase();
      const st=(m.status||'').trim().toLowerCase();
      return (d==='wgte'||d==='') && (st===''||st==='active'||st==='y');
    });
    if (!wgte.length) return 0;
    const now=new Date().toISOString();
    const res=await Promise.allSettled(wgte.map(m=>dmrsApi.create({
      uid:genUid(),partNumber,issue_number:issueNum,
      check_Point:m.checkPointS||m.chkId||'',description:m.checkpointDesc||'',
      zone:m.zone||'',stations:m.station||'',owner:m.owner||'',
      status:'Active',createdBy:actor,createdDate:now,
    })));
    return res.filter(r=>r.status==='fulfilled').length;
  };

  const handleSeedFromMaster=async()=>{
    if(!form.partNumber||!form.issue_number){
      Swal.fire({icon:'warning',title:'Required',text:'Enter Part Number and Issue Number first.',confirmButtonColor:'#3f51b5'}); return;
    }
    setSeeding(true);
    try {
      const n=await seedWgte(form.partNumber,form.issue_number);
      await reload(); closeDrawer();
      Swal.fire({icon:'success',title:`${n} WGDE records seeded!`,timer:2200,showConfirmButton:false,timerProgressBar:true});
    } catch(e) { Swal.fire({icon:'error',title:'Seed failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
    finally { setSeeding(false); }
  };

  // ── save ──────────────────────────────────────────────────────
  const handleSave=async e=>{
    e.preventDefault();
    if(!form.partNumber?.trim()||!form.issue_number?.trim()){
      Swal.fire({icon:'warning',title:'Required',text:'Part Number and Issue Number are required.',confirmButtonColor:'#3f51b5'}); return;
    }
    setSaving(true);
    const now=new Date().toISOString(), isEdit=drawerMode==='edit';
    const payload={...form,modifiedBy:actor,modifiedDate:now,...(isEdit?{}:{createdBy:actor,createdDate:now})};
    try {
      isEdit?await dmrsApi.update(form.uid,payload):await dmrsApi.create(payload);
      closeDrawer(); await reload();
      Swal.fire({icon:'success',title:isEdit?'Updated!':'Created!',timer:2000,showConfirmButton:false,timerProgressBar:true});
    } catch(err){ Swal.fire({icon:'error',title:'Save failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{setSaving(false);}
  };

  // ── delete ────────────────────────────────────────────────────
  const handleDelete=async row=>{
    const res=await Swal.fire({title:'Delete?',html:`<b>${row.check_Point||row.uid}</b>`,icon:'warning',showCancelButton:true,confirmButtonColor:'#e74c3c',cancelButtonColor:'#6c757d',confirmButtonText:'Delete',reverseButtons:true});
    if(!res.isConfirmed) return;
    try{ await dmrsApi.remove(row.uid); await reload(); Swal.fire({icon:'success',title:'Deleted',timer:1800,showConfirmButton:false,timerProgressBar:true}); }
    catch(e){ Swal.fire({icon:'error',title:'Failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
  };

  // ── Excel export ──────────────────────────────────────────────
  const handleExportTemplate=()=>downloadTemplate(XL_COLS,'dmrs-template.xlsx');

  const handleExportData=()=>exportToExcel(filtered, XL_COLS, `dmrs-export-${Date.now()}.xlsx`);

  // ── Excel import ──────────────────────────────────────────────
  const handleImport=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    e.target.value='';
    setImporting(true);
    try {
      const raw=await parseExcel(file);
      if(!raw.length){ Swal.fire({icon:'info',title:'Empty file',confirmButtonColor:'#3f51b5'}); return; }
      const now=new Date().toISOString();
      const mapped=raw.map(row=>{
        const rec={...EMPTY,uid:genUid(),createdBy:actor,createdDate:now};
        Object.entries(row).forEach(([hdr,val])=>{
          const key=XL_MAP[hdr.trim().toLowerCase()];
          if(key) rec[key]=String(val??'');
        });
        return rec;
      });
      const res=await Promise.allSettled(mapped.map(r=>dmrsApi.create(r)));
      const ok=res.filter(r=>r.status==='fulfilled').length;
      const fail=res.length-ok;
      await reload();
      Swal.fire({icon:fail?'warning':'success',title:`Import done`,html:`<b>${ok}</b> imported${fail?`, <b>${fail}</b> failed`:''}`,confirmButtonColor:'#3f51b5'});
    } catch(err){ Swal.fire({icon:'error',title:'Import failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setImporting(false); }
  };

  // ── active sync helper — returns the milestone label (milestoneid) for current date window ──
  const activeSyncOf = row => getActiveMilestoneLabel(row.issue_number, milestones, projectLinks);

  // ── distinct issue rows ────────────────────────────────────────
  // One row per unique issue_number; accumulate checklist count and pick first MRS found
  const filteredDistinct = (() => {
    const seen = new Map();
    for (const row of filtered) {
      const key = row.issue_number || row.uid;
      if (!seen.has(key)) {
        seen.set(key, { ...row, _count: 1, _zones: new Set(row.zone ? [row.zone] : []) });
      } else {
        const entry = seen.get(key);
        if (row.zone) entry._zones.add(row.zone);
        entry._count++;
        if (!entry.mrs && row.mrs) entry.mrs = row.mrs;
        // promote active sync if current entry has none
        if (!activeSyncOf(entry) && activeSyncOf(row)) Object.assign(entry, row, { _count: entry._count, _zones: entry._zones, mrs: entry.mrs||row.mrs });
      }
    }
    return [...seen.values()];
  })();

  // ── pagination ─────────────────────────────────────────────────
  const totalPages=Math.max(1,Math.ceil(filteredDistinct.length/PAGE_SIZE));
  const pageRows=filteredDistinct.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const pageNums=Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1);

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="dmrs-page">

      {/* Header */}
      <div className="dmrs-page-header">
        <div>
          <h1 className="dmrs-title">Checklists</h1>
          <p className="dmrs-subtitle">Design, Manufacturing &amp; Release Sign-off — milestone sync tracking</p>
        </div>
        <div className="dmrs-header-actions">
          <button className="dmrs-btn dmrs-btn-outline dmrs-btn-sm" onClick={handleExportTemplate} title="Download blank Excel template">
            <DownloadIcon/> Template
          </button>
          <button className="dmrs-btn dmrs-btn-outline dmrs-btn-sm" onClick={handleExportData} title="Export current data to Excel">
            <ExportIcon/> Export
          </button>
          {perm.canCreate('dmrs')&&<>
            <button className="dmrs-btn dmrs-btn-outline dmrs-btn-sm" onClick={()=>xlRef.current.click()} disabled={importing} title="Import from Excel">
              <UploadIcon/> {importing?'Importing…':'Import'}
            </button>
            <input ref={xlRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleImport}/>
          </>}
          {perm.canCreate('dmrs')&&<button className="dmrs-btn dmrs-btn-primary" onClick={()=>openDrawer('create')}>
            <PlusIcon/> New DMRS
          </button>}
        </div>
      </div>

      {/* Filters */}
      <div className="dmrs-filter-card">
        <div className="dmrs-filter-label">Filter &amp; Search</div>
        <div className="dmrs-filter-row">
          <div className="dmrs-filter-field"><label>Part #</label>
            <select value={filters.partNumber} onChange={e=>setF('partNumber',e.target.value)}>
              <option value="">All</option>{partOpts.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="dmrs-filter-field"><label>Issue #</label>
            <select value={filters.issueNumber} onChange={e=>setF('issueNumber',e.target.value)}>
              <option value="">All</option>{issueOpts.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="dmrs-filter-field"><label>Zone</label>
            <select value={filters.zone} onChange={e=>setF('zone',e.target.value)}>
              <option value="">All</option>{zoneOpts.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div className="dmrs-filter-field"><label>Status</label>
            <select value={filters.status} onChange={e=>setF('status',e.target.value)}>
              <option value="">All</option><option>Active</option><option>Inactive</option>
            </select>
          </div>
          <div className="dmrs-filter-field"><label>Search</label>
            <input placeholder="Checkpoint, description, MIMS…" value={filters.search}
              onChange={e=>setF('search',e.target.value)}/>
          </div>
          <div className="dmrs-filter-actions">
            <button className="dmrs-btn dmrs-btn-outline" onClick={()=>setFilters({partNumber:'',issueNumber:'',status:'',zone:'',search:''})}>Reset</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="dmrs-grid-card">
        <div className="dmrs-grid-meta">
          <span className="dmrs-count">{loading?'Loading…':`${filteredDistinct.length} issue document${filteredDistinct.length!==1?'s':''}`}</span>
          {loading&&<span className="dmrs-loading-text">Fetching…</span>}
        </div>
        <div className="dmrs-table-scroll">
          <table className="dmrs-table">
            <thead>
              <tr>
                <th style={{width:40}}>#</th>
                <th>Part #</th>
                <th style={{minWidth:150}}>Milestone</th>
                <th style={{minWidth:140}}>Checklist Doc</th>
                <th style={{width:110,textAlign:'center'}}>IssueList Doc</th>
                <th>Zone</th><th>MRS</th>
                <th>Status</th>
                <th style={{minWidth:80}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading&&<tr className="dmrs-state-row"><td colSpan={9}><div className="dmrs-state-box loading"><div className="dmrs-spinner"/><span>Loading…</span></div></td></tr>}
              {!loading&&pageRows.length===0&&<tr className="dmrs-state-row"><td colSpan={9}><div className="dmrs-state-box"><SeedIcon/><span>No DMRS records found.</span></div></td></tr>}
              {!loading&&pageRows.map((row,i)=>{
                const activeLabel = activeSyncOf(row);
                const { result: val } = activeLabel ? parseSyncEntry(row, activeLabel) : {};
                return (
                  <tr key={row.uid} className="dmrs-tr">
                    <td className="dmrs-td-num">{(page-1)*PAGE_SIZE+i+1}</td>
                    <td><span className="dmrs-tag">{row.partNumber||'—'}</span></td>
                    {/* Milestone — current active sync label */}
                    <td>
                      {activeLabel
                        ? <div className="dmrs-active-sync">
                            <span className="dmrs-active-sync-lbl">{activeLabel}</span>
                            <span className="dmrs-sync-badge" style={{background:syncColor(val)+'22',color:syncColor(val),borderColor:syncColor(val)}}>
                              {val||'—'}
                            </span>
                          </div>
                        : <span className="dmrs-no-sync">No active sync</span>}
                    </td>
                    {/* Checklist Doc — D2MRS issue number (clickable link to manage screen) */}
                    <td>
                      {row.issue_number
                        ? <button
                            className="dmrs-tag dmrs-tag-issue dmrs-tag-link"
                            title="Open D2MRS document"
                            onClick={()=>navigate(`/dashboard/dmrs/manage/${encodeURIComponent(row.issue_number)}`,{state:{from:'/dashboard/dmrs',fromLabel:'Checklists'}})}>
                            {row.issue_number}
                          </button>
                        : <span>—</span>}
                    </td>
                    {/* IssueList Doc — count of issue docs linked (flag1) to this checklist doc */}
                    <td style={{textAlign:'center'}}>
                      {(() => {
                        const cnt = issues.filter(d => d.flag1 === row.issue_number).length;
                        return cnt > 0
                          ? <span className="dmrs-tag" style={{background:'#fff3e0',color:'#e65100',border:'1px solid #ffcc80',fontWeight:600,minWidth:28,display:'inline-block',textAlign:'center'}}>{cnt}</span>
                          : <span style={{color:'#bbb',fontSize:12}}>—</span>;
                      })()}
                    </td>
                    <td>{row.zone||'—'}</td>
                    <td className="dmrs-td-mrs">
                      {row.mrs?<img src={row.mrs} alt="MRS" className="dmrs-mrs-thumb"/>:<span className="dmrs-no-mrs">—</span>}
                    </td>
                    <td><StatusBadge v={row.status}/></td>
                    <td>
                      <div className="dmrs-actions">
                        <button className="dmrs-action-btn dmrs-action-view" title="View" onClick={()=>openDrawer('view',row)}><EyeIcon/></button>
                        {perm.canEdit('dmrs',row)&&<button className="dmrs-action-btn dmrs-action-edit" title="Edit" onClick={()=>openDrawer('edit',row)}><EditIcon/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading&&totalPages>1&&(
          <div className="dmrs-pagination">
            <button className="dmrs-page-btn" disabled={page===1} onClick={()=>setPage(1)}>«</button>
            <button className="dmrs-page-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
            {pageNums.map((p,idx)=>{const prev=pageNums[idx-1];return(<span key={p} style={{display:'contents'}}>{prev&&p-prev>1&&<span className="dmrs-ellipsis">…</span>}<button className={`dmrs-page-btn${p===page?' active':''}`} onClick={()=>setPage(p)}>{p}</button></span>);})}
            <button className="dmrs-page-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="dmrs-page-btn" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</button>
            <span className="dmrs-page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerMount&&(<>
        <div className={`dmrs-overlay${drawerOpen?' open':''}`} onClick={closeDrawer}/>
        <aside className={`dmrs-drawer${drawerOpen?' open':''}`}>
          <div className="dmrs-drawer-header" style={{borderBottomColor:drawerMode==='view'?'#2980b933':drawerMode==='edit'?'#e67e2233':'#27ae6033'}}>
            <div className="dmrs-drawer-title-row">
              <div className="dmrs-drawer-icon" style={{background:drawerMode==='view'?'#e8f4fd':drawerMode==='edit'?'#fff3e0':'#e8f9ee',color:drawerMode==='view'?'#2980b9':drawerMode==='edit'?'#e67e22':'#27ae60'}}>
                {drawerMode==='view'?<EyeIcon/>:drawerMode==='edit'?<EditIcon/>:<PlusIcon/>}
              </div>
              <div>
                <h2 className="dmrs-drawer-name">{drawerMode==='view'?'View DMRS':drawerMode==='edit'?'Edit DMRS':'New DMRS Record'}</h2>
                <p className="dmrs-drawer-sub">{drawerMode==='create'?'Fill details or seed from WGDE master':drawerRow?.check_Point||drawerRow?.uid}</p>
              </div>
            </div>
            <button className="dmrs-close" onClick={closeDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* VIEW */}
          {drawerMode==='view'&&drawerRow&&(()=>{
            const activeLabel = activeSyncOf(drawerRow);
            const { result: activeResult, comment: activeComment } = activeLabel
              ? parseSyncEntry(drawerRow, activeLabel)
              : {};
            const syncEntries = allSyncEntries(drawerRow);
            return (<>
              <div className="dmrs-drawer-body">
                <div className="dmrs-view-block"><Sec t="Identity"/>
                  <div className="dmrs-vf-grid">
                    <VF label="Part Number"  value={drawerRow.partNumber} mono/>
                    <VF label="Issue Number" value={drawerRow.issue_number} mono/>
                    <VF label="Check Point"  value={drawerRow.check_Point} wide/>
                    <VF label="Description"  value={drawerRow.description} wide/>
                    <VF label="Zone"         value={drawerRow.zone}/>
                    <VF label="Stations"     value={drawerRow.stations}/>
                    <VF label="Owner"        value={drawerRow.owner}/>
                    <VF label="Source Link"  value={drawerRow.source_Link}/>
                    <VF label="MIMS ID"      value={drawerRow.mimS_ID}/>
                    <VF label="Status"       badge={<StatusBadge v={drawerRow.status}/>}/>
                  </div>
                </div>
                <div className="dmrs-view-block"><Sec t="MRS Attachment"/>
                  <MrsBox value={drawerRow.mrs} readOnly/>
                </div>
                {/* Current milestone sync highlighted */}
                {activeLabel&&(
                  <div className="dmrs-view-block">
                    <Sec t={`Current Milestone — ${activeLabel}`}/>
                    <div className="dmrs-active-ms-card">
                      <div className="dmrs-ams-status" style={{background:syncColor(activeResult)+'18',borderColor:syncColor(activeResult)+'55',color:syncColor(activeResult)}}>
                        {activeResult||'—'}
                      </div>
                      {activeComment&&(
                        <div className="dmrs-ams-comment">
                          <span className="dmrs-ams-clbl">Comments</span>
                          <span className="dmrs-ams-cval">{activeComment}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* All syncs — read from SyncData JSON */}
                {syncEntries.length > 0 && (
                <div className="dmrs-view-block"><Sec t="All Sync Stages"/>
                  <div className="dmrs-sync-grid">
                    {syncEntries.map(({label, result, comment})=>{
                      const isActive = label === activeLabel;
                      return (
                        <div key={label} className={`dmrs-sync-card${isActive?' dmrs-sync-card-active':''}`}>
                          <div className="dmrs-sync-card-header">
                            <span className="dmrs-sync-card-lbl">{label}</span>
                            {isActive&&<span className="dmrs-active-tag">● Active</span>}
                          </div>
                          <div className="dmrs-sync-card-status" style={{color:syncColor(result),background:syncColor(result)+'18',borderColor:syncColor(result)+'44'}}>
                            {result||'—'}
                          </div>
                          {comment&&(
                            <div className="dmrs-sync-card-comment">
                              <span className="dmrs-sync-comment-lbl">Comment</span>
                              <span className="dmrs-sync-comment-val">{comment}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
                <div className="dmrs-view-block"><Sec t="Notes"/>
                  <div className="dmrs-vf-grid">
                    <VF label="Remarks"          value={drawerRow.remarks}          wide/>
                    <VF label="Change Management" value={drawerRow.changeManagement} wide/>
                  </div>
                </div>
                <div className="dmrs-view-block"><Sec t="Audit"/>
                  <div className="dmrs-vf-grid">
                    <VF label="Created By"   value={drawerRow.createdBy}/>
                    <VF label="Created"      value={fmtDate(drawerRow.createdDate)}/>
                    <VF label="Modified By"  value={drawerRow.modifiedBy}/>
                    <VF label="Modified"     value={fmtDate(drawerRow.modifiedDate)}/>
                  </div>
                </div>
              </div>
              <div className="dmrs-drawer-footer">
                <button className="dmrs-btn dmrs-btn-outline" onClick={closeDrawer}>Close</button>
                {perm.canEdit('dmrs',drawerRow)&&<button className="dmrs-btn dmrs-btn-primary" onClick={()=>setDrawerMode('edit')}><EditIcon/> Edit</button>}
              </div>
            </>);
          })()}

          {/* CREATE / EDIT */}
          {(drawerMode==='edit'||drawerMode==='create')&&(
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
              <div className="dmrs-drawer-body">
                <div className="dmrs-form-block"><Sec t="Identity"/>
                  <div className="dmrs-form-grid">
                    <div className="dmrs-field">
                      <label>Part Number <span className="req">*</span></label>
                      <Sel value={form.partNumber} onChange={e=>sf('partNumber',e.target.value)} options={partOpts} placeholder="Select part…" required/>
                    </div>
                    <div className="dmrs-field">
                      <label>Issue Number <span className="req">*</span></label>
                      <Sel value={form.issue_number} onChange={e=>sf('issue_number',e.target.value)} options={issueOpts} placeholder="Select issue…" required/>
                    </div>
                    <div className="dmrs-field dmrs-field-full"><label>Check Point</label>
                      <input value={form.check_Point||''} onChange={e=>sf('check_Point',e.target.value)} placeholder="Checkpoint"/>
                    </div>
                    <div className="dmrs-field dmrs-field-full"><label>Description</label>
                      <textarea value={form.description||''} onChange={e=>sf('description',e.target.value)} rows={2} placeholder="Description…"/>
                    </div>
                    <div className="dmrs-field"><label>Zone</label>
                      <Sel value={form.zone} onChange={e=>sf('zone',e.target.value)} options={zoneOpts} placeholder="Select zone…"/>
                    </div>
                    <div className="dmrs-field"><label>Stations</label>
                      <input value={form.stations||''} onChange={e=>sf('stations',e.target.value)} placeholder="Stations"/>
                    </div>
                    <div className="dmrs-field"><label>Owner</label>
                      <input value={form.owner||''} onChange={e=>sf('owner',e.target.value)} placeholder="Owner"/>
                    </div>
                    <div className="dmrs-field"><label>MIMS ID</label>
                      <input value={form.mimS_ID||''} onChange={e=>sf('mimS_ID',e.target.value)} placeholder="MIMS ID"/>
                    </div>
                    <div className="dmrs-field"><label>Source Link</label>
                      <input value={form.source_Link||''} onChange={e=>sf('source_Link',e.target.value)} placeholder="URL / doc ref"/>
                    </div>
                    <div className="dmrs-field"><label>Status</label>
                      <Sel value={form.status} onChange={e=>sf('status',e.target.value)} options={['Active','Inactive']}/>
                    </div>
                  </div>
                </div>
                <div className="dmrs-form-block"><Sec t="MRS Attachment"/>
                  <MrsBox value={form.mrs||''} onChange={v=>sf('mrs',v)}/>
                </div>
                <div className="dmrs-form-block"><Sec t="Notes"/>
                  <div className="dmrs-form-grid">
                    <div className="dmrs-field dmrs-field-full"><label>Remarks</label>
                      <textarea value={form.remarks||''} onChange={e=>sf('remarks',e.target.value)} rows={2} placeholder="Remarks…"/>
                    </div>
                    <div className="dmrs-field dmrs-field-full"><label>Change Management</label>
                      <textarea value={form.changeManagement||''} onChange={e=>sf('changeManagement',e.target.value)} rows={2} placeholder="Change management notes…"/>
                    </div>
                  </div>
                </div>
              </div>
              <div className="dmrs-drawer-footer">
                <button type="button" className="dmrs-btn dmrs-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                <button type="submit" className="dmrs-btn dmrs-btn-primary" disabled={saving}>
                  {saving?'Saving…':drawerMode==='edit'?'Update Record':'Create Record'}
                </button>
              </div>
            </form>
          )}
        </aside>
      </>)}
    </div>
  );
}
