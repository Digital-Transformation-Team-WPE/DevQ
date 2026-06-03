import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { issueDocApi, issuePartApi, componentMetaApi, projectsApi, projectIssueLinkApi } from '../../services/apiService';
import { generateIssuePdf, generateIssuesGridPdf } from '../../utils/pdfReport';
import { useAuth } from '../../contexts/AuthContext';
import { downloadTemplate, exportToExcel, parseExcel } from '../../utils/excelUtils';
import usePermissions from '../../hooks/usePermissions';

const STATUS_OPTIONS    = ['Open','In Progress','Completed Ok','Completed Not Ok'];
const ESCALATION_OPTS   = ['Low','Medium','High','Critical'];
const PAGE_SIZE      = 10;

const ISS_XL_COLS = [
  {header:'Issue Number',     key:'issue_number'},   {header:'Issue Title',       key:'issue_title'},
  {header:'Description',      key:'issue_description'},{header:'Part Number',      key:'partNumber'},
  {header:'Material',         key:'material'},        {header:'Initiator',         key:'initiator'},
  {header:'Owner',            key:'owner'},           {header:'PDEF # RH',         key:'pDEF_Number_RH'},
  {header:'PDEF # LH',        key:'pDEF_Number_LH'},  {header:'LA # RH',           key:'lA_Num_RH'},
  {header:'LA # LH',          key:'lA_Num_LH'},       {header:'PA # RH',           key:'pA_Num_RH'},
  {header:'PA # LH',          key:'pA_Num_LH'},       {header:'Derogation Sheet #',key:'derogation_sht_num'},
  {header:'Date Opened',      key:'date_Opened'},     {header:'Req Completion',    key:'req_Completion_Date'},
  {header:'Status',           key:'status'},
];
const ISS_XL_MAP = Object.fromEntries(ISS_XL_COLS.map(c=>[c.header.toLowerCase(),c.key]));


const DownIc  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const UpIc    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const DlRowIc = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

const EMPTY = {
  uid:'', partNumber:'', issue_number:'', issue_title:'', issue_description:'',
  initiator:'', owner:'', material:'',
  pDEF_Number_RH:'', pDEF_Number_LH:'', lA_Num_RH:'', lA_Num_LH:'',
  pA_Num_RH:'', pA_Num_LH:'', derogation_sht_num:'',
  date_Opened:'', req_Completion_Date:'', date_Closed:'',
  created_by:'', created_date:'', modified_by:'', modified_date:'', status:'Open',
  flag1:'',
  flag2:'',   // Escalation Level
  flag3:'',   // CW Open
};

const genUid      = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate     = v => v ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const fmtDateShort = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const toDateInput = v => v ? new Date(v).toISOString().split('T')[0] : '';

const ListIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const EyeIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BanIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

const statusBadgeClass = s => ({
  'Open':             'mod-badge-open',
  'In Progress':      'mod-badge-progress',
  'Completed Ok':     'mod-badge-completed-ok',
  'Completed Not Ok': 'mod-badge-completed-notok',
  'Closed':           'mod-badge-closed',
  'On Hold':          'mod-badge-viewer',
}[s] ?? 'mod-badge-viewer');
const StatusBadge = ({v}) => <span className={`mod-badge ${statusBadgeClass(v)}`}>{v||'—'}</span>;
const VF  = ({label,value,badge,wide}) => <div className={`mod-vf${wide?' mod-vf-wide':''}`}><span className="mod-vf-label">{label}</span><span className="mod-vf-value">{badge??(value||'—')}</span></div>;
const Sec = ({title}) => <div className="mod-section-title">{title}</div>;
const Sel = ({value,onChange,options,placeholder='Select…'}) => <div className="mod-select-wrap"><select value={value} onChange={onChange}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select><span className="mod-select-arrow">▾</span></div>;
const CloseBtn = ({onClick}) => <button className="mod-drawer-close" onClick={onClick} type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>;
const RO = ({label,value}) => <div className="mod-ro-field"><span className="mod-ro-label">{label}</span><span className="mod-ro-value">{value||'—'}</span></div>;

export default function Issues() {
  const { user }    = useAuth();
  const perm        = usePermissions();
  const navigate    = useNavigate();
  const location    = useLocation();
  const xlRef       = useRef(null);
  const prefillDone = useRef(false);

  const [rows,      setRows]      = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [filters,   setFilters]   = useState({
    status: '', projectUid: '', dept: '', search: '',
    flag1: location.state?.flag1 || '',
  });
  const [page,     setPage]     = useState(1);
  const [projects, setProjects] = useState([]);

  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [meta,         setMeta]        = useState([]);
  const [allLinks,     setAllLinks]    = useState([]);
  const [allPartInfos, setAllPartInfos] = useState([]);

  const metaOpts     = lk => [...new Set(meta.filter(m=>m.label?.toLowerCase()===lk?.toLowerCase()&&m.status?.toUpperCase()==='ACTIVE').map(m=>m.parameter).filter(Boolean))].sort();
  const materialOpts = metaOpts('Material');
  const ownerOpts    = metaOpts('Owner');

  // ── link info map: all project/part info keyed by issue_number from ProjectIssueLink ──
  const linkInfoMap = useMemo(() => {
    const m = new Map();
    allLinks.forEach(l => {
      const key = l.issue_number || l.Issue_number || '';
      if (!key) return;
      let ex = {};
      try { ex = JSON.parse(l.flag2 || l.Flag2 || '{}'); } catch {}
      m.set(key, {
        project:         l.project      || l.Project      || '',
        program:         l.program      || l.Program      || '',
        plant:           l.plant        || l.Plant        || '',
        plant_year:      l.plant_year   || l.PlantYear    || '',
        dept:            (l.flag1       || l.Flag1        || '').toUpperCase(),
        partNumber:      l.partNumber   || l.PartNumber   || l.part_number_rh || l.Part_number_RH || '',
        partRH:          l.partNumber   || l.PartNumber   || l.part_number_rh || l.Part_number_RH || '',
        partLH:          l.part_number_lh || l.Part_number_LH || '',
        owner:           ex.owner       || '',
        initiator:       ex.initiator   || '',
        material:        ex.material    || '',
        partType:        ex.partType    || '',
        partNameRH:      ex.partNameRH  || '',
        partNameLH:      ex.partNameLH  || '',
        pdefRH:          ex.pdefRH      || '',
        pdefLH:          ex.pdefLH      || '',
        laRH:            ex.laRH        || '',
        laLH:            ex.laLH        || '',
        paRH:            ex.paRH        || '',
        paLH:            ex.paLH        || '',
        revisionRH:      ex.revisionRH  || '',
        revisionLH:      ex.revisionLH  || '',
        maturityStateRH: ex.maturityStateRH || '',
        maturityStateLH: ex.maturityStateLH || '',
        zoneArea:        ex.zoneArea    || '',
      });
    });
    return m;
  }, [allLinks]);

  // Part info map keyed by issue_number — for Publication Release on Time
  const partInfoMap = useMemo(() => {
    const m = new Map();
    allPartInfos.forEach(p => { if(p.issue_number) m.set(p.issue_number, p); });
    return m;
  }, [allPartInfos]);

  // Resolve the link record for a row — try flag1 (DMRS checklist doc#) then issue_number
  const resolveLink = (row) => {
    if (!row) return {};
    return linkInfoMap.get(row.flag1 || '') || linkInfoMap.get(row.issue_number || '') || {};
  };

  // Prefer stored value on the issue row; fall back to link info
  const resolveField = (row, field) => {
    const stored = row?.[field] || '';
    if (stored) return stored;
    return resolveLink(row)[field] || '';
  };

  // ── project helpers ───────────────────────────────────────────────
  const projectsSorted = useMemo(() =>
    [...projects].sort((a,b)=>new Date(a.created_date||0)-new Date(b.created_date||0)),
    [projects]);

  const projectCodeOf = useMemo(() => {
    const m = new Map();
    projectsSorted.forEach((p,i)=>m.set(p.uid,`P${String(i+1).padStart(3,'0')}`));
    return m;
  }, [projectsSorted]);

  const projectByUid  = useMemo(() => new Map(projects.map(p=>[p.uid, p])), [projects]);
  const projectByName = useMemo(() => new Map(projects.map(p=>[(p.projectName||'').toLowerCase(), p])), [projects]);

  const resolveProjectName = (lnk) => {
    const ref = lnk?.project || '';
    if (!ref) return '';
    const byUid = projectByUid.get(ref);
    if (byUid) return byUid.projectName || byUid.ProjectName || ref;
    const byName = projectByName.get(ref.toLowerCase());
    if (byName) return byName.projectName || byName.ProjectName || ref;
    return ref;
  };

  const nextIssueNumber = useCallback((projectUid) => {
    const code = projectCodeOf.get(projectUid) ?? 'P000';
    const existing = rows
      .map(r=>r.issue_number||'')
      .filter(n=>n.startsWith(code))
      .map(n=>parseInt(n.slice(code.length),10))
      .filter(n=>!isNaN(n));
    const seq = existing.length ? Math.max(...existing)+1 : 1;
    return `${code}${String(seq).padStart(4,'0')}`;
  }, [projectCodeOf, rows]);

  // ── load ──────────────────────────────────────────────────────────
  useEffect(()=>{
    setLoading(true);
    Promise.allSettled([issueDocApi.getAll(), componentMetaApi.getAll(), projectsApi.getAll(), projectIssueLinkApi.getAll(), issuePartApi.getAll()])
      .then(([iss,m,prj,lnk,prt])=>{
        if(iss.status==='fulfilled'){ setRows(iss.value??[]); setFiltered(iss.value??[]); }
        else Swal.fire({icon:'error',title:'Load failed',text:iss.reason?.message,confirmButtonColor:'#3f51b5'});
        if(m.status==='fulfilled')   setMeta(m.value??[]);
        if(prj.status==='fulfilled') setProjects(prj.value??[]);
        if(lnk.status==='fulfilled') setAllLinks(lnk.value??[]);
        if(prt.status==='fulfilled') setAllPartInfos(prt.value??[]);
      }).finally(()=>setLoading(false));
  },[]);

  const reload = () => issueDocApi.getAll()
    .then(d=>{ setRows(d); setFiltered(d); setPage(1); })
    .catch(err=>Swal.fire({icon:'error',title:'Reload failed',text:err.message,confirmButtonColor:'#3f51b5'}));

  // ── filters ───────────────────────────────────────────────────────
  const applyFilters = useCallback((src=rows, f=filters) => {
    let r=[...src];
    if(f.flag1)      r=r.filter(x=>(x.flag1||'')=== f.flag1);
    if(f.status)     r=r.filter(x=>x.status===f.status);
    if(f.projectUid) r=r.filter(x=>{
      const code=projectCodeOf.get(f.projectUid);
      return code && (x.issue_number||'').startsWith(code);
    });
    if(f.dept) r=r.filter(x=>(x.created_by||'').toLowerCase().includes(f.dept.toLowerCase())||
                               (x.issue_number||'').toLowerCase().includes(f.dept.toLowerCase()));
    if(f.search){
      const q=f.search.toLowerCase();
      r=r.filter(x=>x.issue_title?.toLowerCase().includes(q)||
                    x.issue_number?.toLowerCase().includes(q)||
                    x.partNumber?.toLowerCase().includes(q)||
                    x.owner?.toLowerCase().includes(q));
    }
    setFiltered(r); setPage(1);
  }, [rows, filters, projectCodeOf]);

  useEffect(()=>{ applyFilters(rows, filters); }, [filters, rows]);

  useEffect(() => {
    if (prefillDone.current) return;
    const p = location.state?.prefill;
    if (!p || !rows.length || !projects.length) return;
    prefillDone.current = true;
    const issNum = nextIssueNumber(p.projectUid);
    openDrawer('create', null, { partNumber: p.partNumber||'', projectUid: p.projectUid||'', issue_number: issNum });
  }, [rows, projects]);

  const handleReset = () => { setFilters({status:'',projectUid:'',dept:'',search:''}); setFiltered(rows); setPage(1); };
  const setF = (k,v) => setFilters(p=>({...p,[k]:v}));

  const openDrawer = (mode, row=null, prefill=null) => {
    setDrawerMode(mode); setDrawerRow(row); setSaving(false);
    setForm(row ? {...EMPTY,...row} : {...EMPTY, uid:genUid(), flag1:perm.dept||'', ...(prefill||{})});
    setDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setDrawerOpen(true)));
  };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(()=>{setDrawerMount(false);setSaving(false);},320); };
  const sf = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleProjectSelect = (projectUid) => {
    sf('projectUid', projectUid);
    if (drawerMode==='create' && projectUid) sf('issue_number', nextIssueNumber(projectUid));
  };

  const handleSave = async e => {
    e.preventDefault();
    if(!form.issue_title?.trim()){ Swal.fire({icon:'warning',title:'Required',text:'Issue Title is required.',confirmButtonColor:'#3f51b5'}); return; }
    if(drawerMode==='create'&&!form.projectUid){ Swal.fire({icon:'warning',title:'Required',text:'Please select a project.',confirmButtonColor:'#3f51b5'}); return; }
    setSaving(true);
    const now=new Date().toISOString(); const actor=user?.userId||user?.email||'system';
    const isEdit=drawerMode==='edit';
    const payload={...form, modified_by:actor, modified_date:now, ...(isEdit?{}:{created_by:actor,created_date:now})};
    try {
      isEdit ? await issueDocApi.update(form.uid,payload) : await issueDocApi.create(payload);
      if (!isEdit && form.projectUid) {
        const project = projects.find(p=>p.uid===form.projectUid);
        await projectIssueLinkApi.create({
          uid:genUid(), project:form.projectUid, program:project?.program||'',
          partNumber:form.partNumber||project?.partNumber||'', area:project?.area||'',
          plant:project?.plant||'', plant_year:project?.plant_year||'', zone:project?.zone||'',
          issue_number:form.issue_number, created_by:actor, created_date:now, status:'Active',
          flag1: form.flag1 || '',
        });
        if (project) {
          await projectsApi.update(project.uid,{...project,no_of_issues:(project.no_of_issues??0)+1,modified_by:actor,modified_date:now});
        }
      }
      closeDrawer(); await reload();
      Swal.fire({icon:'success',title:isEdit?'Issue Updated!':'Issue Created!',text:`"${form.issue_title}" ${isEdit?'updated':'created'} successfully.`,timer:2500,showConfirmButton:false,timerProgressBar:true});
    } catch(err){ Swal.fire({icon:'error',title:'Save failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setSaving(false); }
  };

  const handleClose = async row => {
    if(row.status==='Closed'){ Swal.fire({icon:'info',title:'Already closed',confirmButtonColor:'#3f51b5'}); return; }
    const res=await Swal.fire({title:'Close this issue?',html:`<b>${row.issue_number||row.issue_title}</b><br/><small style="color:#888">Status will be set to Closed.</small>`,icon:'warning',showCancelButton:true,confirmButtonColor:'#e67e22',cancelButtonColor:'#6c757d',confirmButtonText:'Close Issue',reverseButtons:true});
    if(!res.isConfirmed) return;
    try {
      const now=new Date().toISOString();
      await issueDocApi.update(row.uid,{...row,status:'Closed',date_Closed:now});
      await reload();
      Swal.fire({icon:'success',title:'Issue Closed!',timer:2000,showConfirmButton:false,timerProgressBar:true});
    } catch(err){ Swal.fire({icon:'error',title:'Failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
  };

  const handleDownloadRow = async (row) => {
    const lnk     = resolveLink(row);
    const prtInfo = partInfoMap.get(row.issue_number||'') || null;
    await generateIssuePdf({
      docInfo:     { ...row, issueRefDocStatus: row.issueRefDocStatus || row.IssueRefDocStatus || '' },
      partExtras:  { partType:lnk.partType, partNameRH:lnk.partNameRH, partNameLH:lnk.partNameLH,
                     material:resolveField(row,'material'), initiator:resolveField(row,'initiator'),
                     owner:resolveField(row,'owner'), zoneArea:lnk.zoneArea,
                     pdefRH:row.pDEF_Number_RH||lnk.pdefRH, pdefLH:row.pDEF_Number_LH||lnk.pdefLH,
                     laRH:row.lA_Num_RH||lnk.laRH, laLH:row.lA_Num_LH||lnk.laLH,
                     paRH:row.pA_Num_RH||lnk.paRH, paLH:row.pA_Num_LH||lnk.paLH },
      linkData:    { project:lnk.project, program:lnk.program, plant:lnk.plant,
                     plant_year:lnk.plant_year, dept:lnk.dept,
                     partRH:row.partNumber||lnk.partRH, partLH:lnk.partLH },
      projectName: resolveProjectName(lnk),
      checklists:  [],
      histories:   [],
      proposals:   prtInfo?.proposals || '',
      solutions:   prtInfo?.solutions || '',
      pubOnTime:   prtInfo?.flag1 === 'Y',
      pubDate:     prtInfo?.flag2 || '',
      comments:    prtInfo?.comments_on_picture_rh || '',
    });
  };

  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows   = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const pageNums   = Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1);

  const drawerColors = {view:'#2980b9',edit:'#e67e22',create:'#27ae60'};
  const drawerTitles = {view:'View Issue',edit:'Edit Issue',create:'New Issue'};
  const drawerIcons  = {view:<EyeIcon/>,edit:<EditIcon/>,create:<PlusIcon/>};

  const handleExportTemplate = () => downloadTemplate(ISS_XL_COLS, 'issues-template.xlsx');
  const handleExportData     = () => exportToExcel(filtered, ISS_XL_COLS, `issues-${Date.now()}.xlsx`);
  const handleImport = async e => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setImporting(true);
    try {
      const raw = await parseExcel(file);
      if (!raw.length) { Swal.fire({icon:'info',title:'Empty file',confirmButtonColor:'#3f51b5'}); return; }
      const now=new Date().toISOString(); const actor=user?.userId||user?.email||'system';
      const mapped = raw.map(row => {
        const rec = {...EMPTY, uid:genUid(), created_by:actor, created_date:now, status:'Open'};
        Object.entries(row).forEach(([h,v])=>{ const k=ISS_XL_MAP[h.trim().toLowerCase()]; if(k) rec[k]=String(v??''); });
        return rec;
      });
      const res = await Promise.allSettled(mapped.map(r=>issueDocApi.create(r)));
      const ok  = res.filter(r=>r.status==='fulfilled').length;
      await reload();
      Swal.fire({icon:ok<mapped.length?'warning':'success',title:'Import done',html:`<b>${ok}</b> of ${mapped.length} imported`,confirmButtonColor:'#3f51b5'});
    } catch(err){ Swal.fire({icon:'error',title:'Import failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setImporting(false); }
  };

  // Pre-compute drawer link info to avoid repeated calls in JSX
  const drawerLnk     = resolveLink(drawerRow);
  const drawerProjName = resolveProjectName(drawerLnk);

  return (
    <div className="mod-page">
      <div className="mod-page-header">
        <div>
          <h1 className="mod-title">Issue List</h1>
          <p className="mod-subtitle">Track and manage issue documentation records</p>
        </div>
        <div className="mod-header-actions">
          <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportTemplate}><DownIc/> Template</button>
          <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportData}><DownIc/> Export</button>
          <button className="mod-btn mod-btn-outline mod-btn-sm" title="Print grid as PDF"
            onClick={()=>generateIssuesGridPdf({rows:filtered,filename:`issues-report-${Date.now()}.pdf`})}>
            <DlRowIc/> Print PDF
          </button>
          {perm.canCreate('issues')&&<>
            <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={()=>xlRef.current.click()} disabled={importing}><UpIc/> {importing?'…':'Import'}</button>
            <input ref={xlRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleImport}/>
          </>}
          {perm.canCreate('issues')&&<button className="mod-btn mod-btn-primary" onClick={()=>openDrawer('create')}><PlusIcon/> New Issue</button>}
        </div>
      </div>

      {perm.ownOnly&&(
        <div className="mod-role-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          You can create new issues and edit only your own records ({perm.roleLabel} — {perm.dept} dept).
        </div>
      )}

      <div className="mod-filter-card">
        <div className="mod-filter-label">Filter &amp; Search</div>
        <div className="mod-filter-row">
          <div className="mod-filter-field"><label>Status</label>
            <select value={filters.status} onChange={e=>setF('status',e.target.value)}>
              <option value="">All Statuses</option>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="mod-filter-field"><label>Project</label>
            <select value={filters.projectUid} onChange={e=>setF('projectUid',e.target.value)}>
              <option value="">All Projects</option>
              {projectsSorted.map(p=><option key={p.uid} value={p.uid}>{projectCodeOf.get(p.uid)} — {p.projectName}</option>)}
            </select>
          </div>
          <div className="mod-filter-field"><label>Search</label>
            <input placeholder="Issue title, number, part or owner…" value={filters.search} onChange={e=>setF('search',e.target.value)}/>
          </div>
          <div className="mod-filter-actions">
            <button className="mod-btn mod-btn-outline" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {filters.flag1&&(
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',marginBottom:8,borderRadius:8,background:'#fff8e1',border:'1px solid #ffe082',fontSize:13,color:'#7c5a00',fontWeight:500}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filtered by Checklist Doc:&nbsp;<strong>{filters.flag1}</strong>
          <button onClick={()=>setFilters(p=>({...p,flag1:''}))} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#b45309',fontWeight:700,padding:'0 4px'}}>✕ Clear filter</button>
        </div>
      )}

      <div className="mod-grid-card">
        <div className="mod-grid-meta">
          <span className="mod-count">{loading?'Loading…':`${filtered.length} issue${filtered.length!==1?'s':''} found`}</span>
          {loading&&<span className="mod-loading-text">Fetching…</span>}
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr>
              <th style={{width:36}}>#</th>
              <th>Program</th>
              <th>Project</th>
              <th>Dept</th>
              <th>Type</th>
              <th>Part # LH</th>
              <th>Part # RH</th>
              <th>LA LH</th>
              <th>LA RH</th>
              <th>Issue #</th>
              <th>Title</th>
              <th>Owner</th>
              <th>Initiator</th>
              <th>Escalation</th>
              <th>Date Opened</th>
              <th>Req. Completion</th>
              <th>Date Closed</th>
              <th>Pub on Time</th>
              <th>CW Open</th>
              <th>Status</th>
              <th style={{width:120}}>Actions</th>
            </tr></thead>
            <tbody>
              {loading&&<tr className="mod-state-row"><td colSpan={21}><div className="mod-state-box loading"><div className="mod-spinner"/><span>Loading issues…</span></div></td></tr>}
              {!loading&&pageRows.length===0&&<tr className="mod-state-row"><td colSpan={21}><div className="mod-state-box"><ListIcon/><span>No issues found.</span></div></td></tr>}
              {!loading&&pageRows.map((row,i)=>{
                const lnk     = resolveLink(row);
                const projName = resolveProjectName(lnk);
                const prtInfo  = partInfoMap.get(row.issue_number||'');
                const pubOT    = prtInfo?.flag1 === 'Y';
                const escLevel = row.flag2 || '';
                const escStyle = escLevel==='Critical'?{background:'#ffebee',color:'#c62828',padding:'2px 7px',borderRadius:12,fontSize:11,fontWeight:700}
                               : escLevel==='High'    ?{background:'#fff3e0',color:'#e65100',padding:'2px 7px',borderRadius:12,fontSize:11,fontWeight:700}
                               : escLevel==='Medium'  ?{background:'#fffde7',color:'#f57f17',padding:'2px 7px',borderRadius:12,fontSize:11,fontWeight:700}
                               : escLevel==='Low'     ?{background:'#e8f5e9',color:'#2e7d32',padding:'2px 7px',borderRadius:12,fontSize:11,fontWeight:700}
                               : {};
                return (
                  <tr key={row.uid} className="mod-tr">
                    <td className="mod-td-num">{(page-1)*PAGE_SIZE+i+1}</td>
                    <td className="mod-td-sub">{lnk.program||'—'}</td>
                    <td className="mod-td-sub" title={projName}>{projName||'—'}</td>
                    <td className="mod-td-sub">{lnk.dept||'—'}</td>
                    <td className="mod-td-sub">{lnk.partType||'—'}</td>
                    <td className="mod-td-sub">{lnk.partLH||'—'}</td>
                    <td className="mod-td-sub">{resolveField(row,'partNumber')||lnk.partRH||'—'}</td>
                    <td className="mod-td-sub">{lnk.laLH||row.lA_Num_LH||'—'}</td>
                    <td className="mod-td-sub">{lnk.laRH||row.lA_Num_RH||'—'}</td>
                    <td><span className="mod-id-tag mod-id-tag-link" style={{cursor:'pointer'}} title="Open issue detail" onClick={()=>navigate(`/dashboard/issues/${row.uid}`,{state:{from:'/dashboard/issues',fromLabel:'Issue List'}})}>{row.issue_number||'—'}</span></td>
                    <td className="mod-td-main" title={row.issue_title}>{row.issue_title||'—'}</td>
                    <td className="mod-td-sub">{resolveField(row,'owner')||'—'}</td>
                    <td className="mod-td-sub">{resolveField(row,'initiator')||'—'}</td>
                    <td className="mod-td-sub">{escLevel?<span style={escStyle}>{escLevel}</span>:'—'}</td>
                    <td className="mod-td-sub">{fmtDateShort(row.date_Opened)}</td>
                    <td className="mod-td-sub">{fmtDateShort(row.req_Completion_Date)}</td>
                    <td className="mod-td-sub">{fmtDateShort(row.date_Closed)}</td>
                    <td className="mod-td-sub">
                      {prtInfo
                        ? <span style={{fontWeight:700,color:pubOT?'#2e7d32':'#c62828',fontSize:12}}>{pubOT?'Yes':'No'}</span>
                        : '—'}
                    </td>
                    <td className="mod-td-sub">{row.flag3||'—'}</td>
                    <td><StatusBadge v={row.status}/></td>
                    <td className="mod-td-actions">
                      <button className="mod-action-btn mod-action-view"     title="View"         onClick={()=>openDrawer('view',row)}><EyeIcon/></button>
                      {perm.canEdit('issues',row)&&<button className="mod-action-btn mod-action-edit" title="Edit" onClick={()=>openDrawer('edit',row)}><EditIcon/></button>}
                      <button className="mod-action-btn mod-action-download" title="Download Excel" onClick={()=>handleDownloadRow(row)}><DlRowIc/></button>
                      {perm.canDelete('issues',row)&&<button className="mod-action-btn mod-action-deactivate" title="Close Issue" onClick={()=>handleClose(row)} disabled={row.status==='Closed'}><BanIcon/></button>}
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

      {drawerMount&&(<>
        <div className={`mod-drawer-overlay${drawerOpen?' open':''}`} onClick={closeDrawer}/>
        <aside className={`mod-drawer${drawerOpen?' open':''}`}>
          <div className="mod-drawer-header" style={{borderBottomColor:drawerColors[drawerMode]+'33'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:drawerColors[drawerMode]+'18',color:drawerColors[drawerMode]}}>{drawerIcons[drawerMode]}</div>
              <div>
                <h2 className="mod-drawer-title">{drawerTitles[drawerMode]}</h2>
                <p className="mod-drawer-subtitle">{drawerMode==='create'?'Fill in the details to log a new issue':drawerRow?.issue_number||drawerRow?.issue_title}</p>
              </div>
            </div>
            <CloseBtn onClick={closeDrawer}/>
          </div>

          {/* ── VIEW DRAWER ── */}
          {drawerMode==='view'&&(<>
            <div className="mod-drawer-body">
              <div className="mod-view-block">
                <Sec title="Project Info"/>
                <div className="mod-vf-grid">
                  <VF label="Project"    value={drawerProjName}/>
                  <VF label="Program"    value={drawerLnk.program}/>
                  <VF label="Plant"      value={drawerLnk.plant}/>
                  <VF label="Plant Year" value={drawerLnk.plant_year}/>
                  <VF label="Department" value={drawerLnk.dept}/>
                </div>
              </div>
              <div className="mod-view-block">
                <Sec title="Part Info"/>
                <div className="mod-vf-grid">
                  <VF label="Part # RH"    value={resolveField(drawerRow,'partNumber')||drawerLnk.partRH}/>
                  <VF label="Part # LH"    value={drawerLnk.partLH}/>
                  <VF label="Part Name RH" value={drawerLnk.partNameRH}/>
                  <VF label="Part Name LH" value={drawerLnk.partNameLH}/>
                  <VF label="Part Type"    value={drawerLnk.partType}/>
                  <VF label="Zone / Area"  value={drawerLnk.zoneArea}/>
                  <VF label="Material"     value={resolveField(drawerRow,'material')}/>
                  <VF label="Initiator"    value={resolveField(drawerRow,'initiator')}/>
                  <VF label="Owner"        value={resolveField(drawerRow,'owner')}/>
                  <VF label="PDEF # RH"    value={drawerRow?.pDEF_Number_RH||drawerLnk.pdefRH}/>
                  <VF label="PDEF # LH"    value={drawerRow?.pDEF_Number_LH||drawerLnk.pdefLH}/>
                  <VF label="LA # RH"      value={drawerRow?.lA_Num_RH||drawerLnk.laRH}/>
                  <VF label="LA # LH"      value={drawerRow?.lA_Num_LH||drawerLnk.laLH}/>
                  <VF label="PA # RH"      value={drawerRow?.pA_Num_RH||drawerLnk.paRH}/>
                  <VF label="PA # LH"      value={drawerRow?.pA_Num_LH||drawerLnk.paLH}/>
                  <VF label="Derogation Sheet" value={drawerRow?.derogation_sht_num} wide/>
                </div>
              </div>
              <div className="mod-view-block">
                <Sec title="Issue Details"/>
                {(() => {
                  const drwPrt = partInfoMap.get(drawerRow?.issue_number||'');
                  const drwPub = drwPrt?.flag1 === 'Y';
                  return (
                    <div className="mod-vf-grid">
                      <VF label="Issue Number"    value={drawerRow?.issue_number}/>
                      <VF label="Status"          badge={<StatusBadge v={drawerRow?.status}/>}/>
                      <VF label="Escalation"      value={drawerRow?.flag2||''}/>
                      <VF label="CW Open"         value={drawerRow?.flag3||''}/>
                      <VF label="Issue Title"     value={drawerRow?.issue_title} wide/>
                      <VF label="Description"     value={drawerRow?.issue_description} wide/>
                      <VF label="Date Opened"     value={fmtDate(drawerRow?.date_Opened)}/>
                      <VF label="Req. Completion" value={fmtDate(drawerRow?.req_Completion_Date)}/>
                      <VF label="Date Closed"     value={fmtDate(drawerRow?.date_Closed)}/>
                      <VF label="Pub. on Time"    value={drwPrt ? (drwPub?'Yes':'No') : '—'}/>
                      <VF label="Pub. Date"       value={fmtDate(drwPrt?.flag2)}/>
                      <VF label="Created By"      value={drawerRow?.created_by}/>
                      <VF label="Created Date"    value={fmtDate(drawerRow?.created_date)}/>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mod-drawer-footer">
              <button className="mod-btn mod-btn-outline" onClick={()=>handleDownloadRow(drawerRow)}><DownIc/> Download</button>
              <button className="mod-btn mod-btn-outline" onClick={closeDrawer}>Close</button>
              {perm.canEdit('issues',drawerRow)&&<button className="mod-btn mod-btn-primary" onClick={()=>setDrawerMode('edit')}><EditIcon/> Edit</button>}
            </div>
          </>)}

          {/* ── EDIT / CREATE DRAWER ── */}
          {(drawerMode==='edit'||drawerMode==='create')&&(
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
              <div className="mod-drawer-body">
                {/* Read-only project & part context (edit only) */}
                {drawerMode==='edit'&&(drawerProjName||drawerLnk.program||drawerLnk.partRH||drawerLnk.partType)&&(
                  <div className="mod-form-block">
                    <Sec title="Project &amp; Part Context"/>
                    <div className="mod-ro-grid">
                      {drawerProjName       && <RO label="Project"      value={drawerProjName}/>}
                      {drawerLnk.program    && <RO label="Program"      value={drawerLnk.program}/>}
                      {drawerLnk.plant      && <RO label="Plant"        value={drawerLnk.plant}/>}
                      {drawerLnk.plant_year && <RO label="Plant Year"   value={drawerLnk.plant_year}/>}
                      {drawerLnk.dept       && <RO label="Department"   value={drawerLnk.dept}/>}
                      {(drawerRow?.partNumber||drawerLnk.partRH) && <RO label="Part # RH" value={drawerRow?.partNumber||drawerLnk.partRH}/>}
                      {drawerLnk.partLH     && <RO label="Part # LH"   value={drawerLnk.partLH}/>}
                      {drawerLnk.partType   && <RO label="Part Type"   value={drawerLnk.partType}/>}
                      {drawerLnk.partNameRH && <RO label="Part Name RH" value={drawerLnk.partNameRH}/>}
                      {drawerLnk.partNameLH && <RO label="Part Name LH" value={drawerLnk.partNameLH}/>}
                    </div>
                  </div>
                )}

                <div className="mod-form-block"><Sec title="Identity"/>
                  <div className="mod-form-grid">
                    {drawerMode==='create'&&(
                      <div className="mod-field mod-field-full">
                        <label>Project <span className="req">*</span></label>
                        <div className="mod-select-wrap">
                          <select value={form.projectUid||''} onChange={e=>handleProjectSelect(e.target.value)} required>
                            <option value="">Select project…</option>
                            {projectsSorted.map(p=><option key={p.uid} value={p.uid}>{projectCodeOf.get(p.uid)} — {p.projectName}</option>)}
                          </select>
                          <span className="mod-select-arrow">▾</span>
                        </div>
                      </div>
                    )}
                    <div className="mod-field">
                      <label>Issue Number</label>
                      <input value={form.issue_number} onChange={e=>sf('issue_number',e.target.value)}
                        placeholder={drawerMode==='create'?'Auto-generated on project select':'e.g. P0010001'}
                        readOnly={drawerMode==='create'&&!!form.projectUid}
                        style={drawerMode==='create'&&form.issue_number?{background:'#f0f8ff',fontWeight:600,color:'#1a1a2e'}:{}}/>
                    </div>
                    <div className="mod-field">
                      <label>Department <span className="req">*</span></label>
                      {perm.dept
                        ? <input value={form.flag1||perm.dept} readOnly
                            style={{background:'#f0f8ff',fontWeight:600,color:'#1a1a2e'}}/>
                        : <Sel value={form.flag1||''} onChange={e=>sf('flag1',e.target.value)}
                            options={['AVP','WGDE']} placeholder="Select department…"/>
                      }
                    </div>
                    <div className="mod-field"><label>Status</label><Sel value={form.status} onChange={e=>sf('status',e.target.value)} options={STATUS_OPTIONS}/></div>
                    <div className="mod-field"><label>Escalation Level</label><Sel value={form.flag2||''} onChange={e=>sf('flag2',e.target.value)} options={ESCALATION_OPTS} placeholder="Select level…"/></div>
                    <div className="mod-field"><label>CW Open</label><input value={form.flag3||''} onChange={e=>sf('flag3',e.target.value)} placeholder="e.g. CW24"/></div>
                    <div className="mod-field mod-field-full"><label>Issue Title <span className="req">*</span></label><input value={form.issue_title} onChange={e=>sf('issue_title',e.target.value)} placeholder="Short descriptive title" required/></div>
                    <div className="mod-field mod-field-full"><label>Description</label><textarea value={form.issue_description} onChange={e=>sf('issue_description',e.target.value)} placeholder="Detailed description…" rows={2}/></div>
                  </div>
                </div>

                {drawerMode==='edit'&&(<>
                  <div className="mod-form-block"><Sec title="Parties &amp; Part"/>
                    <div className="mod-form-grid">
                      <div className="mod-field"><label>Initiator</label><input value={form.initiator} onChange={e=>sf('initiator',e.target.value)} placeholder="Initiator name"/></div>
                      <div className="mod-field"><label>Owner</label><Sel value={form.owner} onChange={e=>sf('owner',e.target.value)} options={ownerOpts} placeholder="Select owner…"/></div>
                      <div className="mod-field"><label>Material</label><Sel value={form.material} onChange={e=>sf('material',e.target.value)} options={materialOpts} placeholder="Select material…"/></div>
                      <div className="mod-field"><label>Part Number</label><input value={form.partNumber} onChange={e=>sf('partNumber',e.target.value)} placeholder="Part number"/></div>
                    </div>
                  </div>
                  <div className="mod-form-block"><Sec title="Document References"/>
                    <div className="mod-form-grid">
                      <div className="mod-field"><label>PDEF # RH</label><input value={form.pDEF_Number_RH} onChange={e=>sf('pDEF_Number_RH',e.target.value)} placeholder="RH"/></div>
                      <div className="mod-field"><label>PDEF # LH</label><input value={form.pDEF_Number_LH} onChange={e=>sf('pDEF_Number_LH',e.target.value)} placeholder="LH"/></div>
                      <div className="mod-field"><label>LA # RH</label><input value={form.lA_Num_RH} onChange={e=>sf('lA_Num_RH',e.target.value)} placeholder="RH"/></div>
                      <div className="mod-field"><label>LA # LH</label><input value={form.lA_Num_LH} onChange={e=>sf('lA_Num_LH',e.target.value)} placeholder="LH"/></div>
                      <div className="mod-field"><label>PA # RH</label><input value={form.pA_Num_RH} onChange={e=>sf('pA_Num_RH',e.target.value)} placeholder="RH"/></div>
                      <div className="mod-field"><label>PA # LH</label><input value={form.pA_Num_LH} onChange={e=>sf('pA_Num_LH',e.target.value)} placeholder="LH"/></div>
                      <div className="mod-field mod-field-full"><label>Derogation Sheet #</label><input value={form.derogation_sht_num} onChange={e=>sf('derogation_sht_num',e.target.value)} placeholder="Derogation sheet number"/></div>
                    </div>
                  </div>
                </>)}

                <div className="mod-form-block" style={{marginBottom:0}}><Sec title="Dates"/>
                  <div className="mod-form-grid">
                    <div className="mod-field"><label>Date Opened</label><input type="date" value={toDateInput(form.date_Opened)} onChange={e=>sf('date_Opened',e.target.value)}/></div>
                    <div className="mod-field"><label>Required Completion</label><input type="date" value={toDateInput(form.req_Completion_Date)} onChange={e=>sf('req_Completion_Date',e.target.value)}/></div>
                    <div className="mod-field"><label>Date Closed</label><input type="date" value={toDateInput(form.date_Closed)} onChange={e=>sf('date_Closed',e.target.value)}/></div>
                  </div>
                </div>
              </div>
              <div className="mod-drawer-footer">
                <button type="button" className="mod-btn mod-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                <button type="submit" className="mod-btn mod-btn-primary" disabled={saving}>{saving?'Saving…':drawerMode==='edit'?'Update Issue':'Create Issue'}</button>
              </div>
            </form>
          )}
        </aside>
      </>)}
    </div>
  );
}
