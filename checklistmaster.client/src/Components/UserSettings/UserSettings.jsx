import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { usersApi, componentMetaApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { roleLabel, roleColor } from '../../utils/permissions';
import './UserSettings.css';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Svg = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const PersonIcon   = () => <Svg d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />;
const LockIcon     = () => <Svg d={<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>} />;
const SaveIcon     = () => <Svg d={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>} />;
const EyeIcon      = () => <Svg d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>} />;
const EyeOffIcon   = () => <Svg d={<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>} />;
const InfoIcon     = () => <Svg d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>} />;
const CheckCircle  = () => <Svg d={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>} />;
const DatabaseIcon = () => <Svg d={<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>} />;
const EditIcon     = () => <Svg size={13} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}/>;
const TrashIcon    = () => <Svg size={13} d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>}/>;
const PlusIcon     = () => <Svg d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>;
const XIcon        = () => <Svg size={14} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>;

// Known metadata label categories
const KNOWN_LABELS = [
  'Zone','Area','Category','Program','Station Name','Plant','Year','Owner','Material',
];

// ── Password strength ─────────────────────────────────────────────────────────
function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: 'Too short',  color: '#e74c3c' },
    { label: 'Weak',       color: '#e74c3c' },
    { label: 'Fair',       color: '#e67e22' },
    { label: 'Good',       color: '#f39c12' },
    { label: 'Strong',     color: '#27ae60' },
    { label: 'Very strong',color: '#1e8449' },
  ];
  return { score, ...map[score] };
}

const Field = ({ label, children, hint }) => (
  <div className="us-field">
    <label className="us-label">{label}</label>
    {children}
    {hint && <span className="us-hint">{hint}</span>}
  </div>
);

const ReadOnly = ({ value }) => (
  <div className="us-readonly">{value || '—'}</div>
);

const PwInput = ({ value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="us-pw-wrap">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} className="us-input"/>
      <button type="button" className="us-pw-toggle" onClick={() => setShow(s => !s)}
        tabIndex={-1} title={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
};

// ── Metadata CRUD panel ───────────────────────────────────────────────────────
const EMPTY_META = { ouid: 0, label:'', parameter:'', action:'SELECT', status:'Active' };

function MetadataPanel() {
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [filterLbl, setFilterLbl] = useState('');
  const [filterSrc, setFilterSrc] = useState('');
  const [form,      setForm]      = useState(null);   // null = hidden
  const [saving,    setSaving]    = useState(false);
  const [customLbl, setCustomLbl] = useState('');

  const load = () => {
    setLoading(true);
    componentMetaApi.getAll()
      .then(d => setRows(d ?? []))
      .catch(err => Swal.fire({ icon:'error', title:'Load failed', text:err.message, confirmButtonColor:'#3f51b5' }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filterLbl) r = r.filter(x => x.label?.toLowerCase() === filterLbl.toLowerCase());
    if (filterSrc) {
      const q = filterSrc.toLowerCase();
      r = r.filter(x => x.parameter?.toLowerCase().includes(q) || x.label?.toLowerCase().includes(q));
    }
    return r;
  }, [rows, filterLbl, filterSrc]);

  // Unique label list: DB values take precedence; KNOWN_LABELS fill gaps only
  const allLabels = useMemo(() => {
    const fromData = [...new Set(rows.map(r => r.label).filter(Boolean))];
    const dataLower = new Set(fromData.map(l => l.toLowerCase()));
    const extra = KNOWN_LABELS.filter(l => !dataLower.has(l.toLowerCase()));
    return [...fromData, ...extra].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [rows]);

  const openAdd = () => {
    setCustomLbl('');
    const nextOuid = rows.length > 0 ? Math.max(...rows.map(r => r.ouid ?? 0)) + 1 : 1;
    setForm({ ...EMPTY_META, ouid: nextOuid, label: filterLbl || '' });
  };

  const openEdit = (row) => {
    setCustomLbl('');
    setForm({ ...row });
  };

  const closeForm = () => { setForm(null); setCustomLbl(''); setSaving(false); };

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const lbl = form.label === '__custom__' ? customLbl.trim() : form.label;
    if (!lbl) { Swal.fire({ icon:'warning', title:'Required', text:'Category / Label is required.', confirmButtonColor:'#3f51b5' }); return; }
    if (!form.parameter?.trim()) { Swal.fire({ icon:'warning', title:'Required', text:'Value is required.', confirmButtonColor:'#3f51b5' }); return; }
    setSaving(true);
    const isEdit = rows.some(r => r.ouid === form.ouid);
    const now = new Date().toISOString();
    const payload = {
      ...form,
      label: lbl,
      parameter: form.parameter.trim(),
      componentName: form.componentName ?? 'ChecklistMaster',
      componentCode: form.componentCode ?? 'CHK',
      activity:      form.activity      ?? 'Dropdown',
      language:      form.language      ?? 1,
      modifiedDate:  now,
      ...(isEdit ? {} : { createdDate: now }),
    };
    try {
      if (isEdit) await componentMetaApi.update(form.ouid, payload);
      else        await componentMetaApi.create(payload);
      closeForm();
      load();
      Swal.fire({ icon:'success', title: isEdit ? 'Updated!' : 'Added!', timer:1800, showConfirmButton:false, timerProgressBar:true });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Save failed', text:err.message, confirmButtonColor:'#3f51b5' });
    } finally { setSaving(false); }
  };

  const handleToggleStatus = async (row) => {
    const next = row.status?.toLowerCase() === 'active' ? 'Inactive' : 'Active';
    try {
      await componentMetaApi.update(row.ouid, { ...row, status: next });
      load();
    } catch (err) {
      Swal.fire({ icon:'error', title:'Update failed', text:err.message, confirmButtonColor:'#3f51b5' });
    }
  };

  const handleDelete = async (row) => {
    const res = await Swal.fire({
      title: 'Delete this value?',
      html: `<b>${row.label}</b>: ${row.parameter}<br/><small style="color:#888">This cannot be undone.</small>`,
      icon: 'warning', showCancelButton:true, confirmButtonColor:'#e53935',
      cancelButtonColor:'#6c757d', confirmButtonText:'Delete', reverseButtons:true,
    });
    if (!res.isConfirmed) return;
    try {
      await componentMetaApi.remove(row.ouid);
      load();
      Swal.fire({ icon:'success', title:'Deleted', timer:1600, showConfirmButton:false, timerProgressBar:true });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Delete failed', text:err.message, confirmButtonColor:'#3f51b5' });
    }
  };

  const isEditMode = form && rows.some(r => r.ouid === form.ouid);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5, flex:'1', minWidth:160 }}>
          <label className="us-label">Category</label>
          <div style={{ position:'relative' }}>
            <select value={filterLbl} onChange={e=>setFilterLbl(e.target.value)}
              style={{ height:38, padding:'0 32px 0 11px', border:'1.5px solid var(--dash-border)',
                borderRadius:7, fontSize:13, background:'#fafbff', width:'100%',
                outline:'none', fontFamily:'inherit', appearance:'none' ,color: filterLbl ? '#000' : '#888' }}>
              <option value="">All Categories</option>
              {allLabels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
              pointerEvents:'none', color:'#888', fontSize:11 }}>▾</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, flex:'2', minWidth:180 }}>
          <label className="us-label">Search value</label>
          <input value={filterSrc} onChange={e=>setFilterSrc(e.target.value)}
            placeholder="Search by label or value…"
            style={{ height:38, padding:'0 11px', border:'1.5px solid var(--dash-border)',
              borderRadius:7, fontSize:13, background:'#fafbff', outline:'none', fontFamily:'inherit' }}/>
        </div>
        <button onClick={openAdd} disabled={!!form}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:38, padding:'0 16px',
            background:'#3f51b5', color:'#fff', border:'none', borderRadius:7, fontSize:13,
            fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', opacity:form?0.5:1 }}>
          <PlusIcon/> Add Value
        </button>
        {(filterLbl || filterSrc) &&
          <button onClick={()=>{setFilterLbl('');setFilterSrc('');}}
            style={{ height:38, padding:'0 14px', background:'#fff', color:'#3f51b5',
              border:'1.5px solid #3f51b5', borderRadius:7, fontSize:13, fontWeight:600,
              cursor:'pointer', whiteSpace:'nowrap' }}>
            Reset
          </button>}
      </div>

      {/* ── Add / Edit form ──────────────────────────────────────── */}
      {form && (
        <div style={{ background:'#f0f4ff', border:'1.5px solid #c5cff7', borderRadius:10,
          padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#3f51b5', textTransform:'uppercase', letterSpacing:'.5px' }}>
              {isEditMode ? 'Edit Value' : 'Add New Value'}
            </span>
            <button onClick={closeForm} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', padding:4 }}><XIcon/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:12, alignItems:'flex-end' }}>
            {/* Category / Label */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label className="us-label">Category <span style={{color:'#e53935'}}>*</span></label>
              <div style={{ position:'relative' }}>
                <select value={form.label} onChange={e => { sf('label', e.target.value); if(e.target.value !== '__custom__') setCustomLbl(''); }}
                  style={{ height:38, padding:'0 32px 0 11px', border:'1.5px solid #c5cff7', borderRadius:7,
                    fontSize:13, background:'#fff', width:'100%', outline:'none', fontFamily:'inherit', appearance:'none', color: form.label === '__custom__' ? '#888' : '#000' }}>
                  <option value="">Select category…</option>
                  {allLabels.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="__custom__">+ New category…</option>
                </select>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  pointerEvents:'none', color:'#888', fontSize:11 }}>▾</span>
              </div>
              {form.label === '__custom__' && (
                <input value={customLbl} onChange={e => setCustomLbl(e.target.value)}
                  placeholder="Enter new category name"
                  style={{ height:36, padding:'0 11px', border:'1.5px solid #c5cff7', borderRadius:7,
                    fontSize:13, background:'#fff', outline:'none', fontFamily:'inherit', marginTop:4 }}/>
              )}
            </div>
            {/* Value / Parameter */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label className="us-label">Value <span style={{color:'#e53935'}}>*</span></label>
              <input value={form.parameter || ''} onChange={e => sf('parameter', e.target.value)}
                placeholder="Enter value…"
                style={{ height:38, padding:'0 11px', border:'1.5px solid #c5cff7', borderRadius:7,
                  fontSize:13, background:'#fff', outline:'none', fontFamily:'inherit', color: form.label === '__custom__' ? '#888' : '#000'  }}/>
            </div>
            {/* Status */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label className="us-label">Status</label>
              <div style={{ position:'relative' }}>
                <select value={form.status || 'Active'} onChange={e => sf('status', e.target.value)}
                  style={{ height:38, padding:'0 32px 0 11px', border:'1.5px solid #c5cff7', borderRadius:7,
                    fontSize:13, background:'#fff', width:'100%', outline:'none', fontFamily:'inherit', appearance:'none'  ,color: form.label === '__custom__' ? '#888' : '#000' }}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  pointerEvents:'none', color:'#888', fontSize:11 }}>▾</span>
              </div>
            </div>
            {/* Actions */}
            <div style={{ display:'flex', gap:8, paddingBottom:0, alignSelf:'flex-end' }}>
              <button onClick={handleSave} disabled={saving}
                style={{ height:38, padding:'0 18px', background:'#3f51b5', color:'#fff',
                  border:'none', borderRadius:7, fontSize:13, fontWeight:600,
                  cursor:'pointer', opacity:saving?0.6:1 }}>
                {saving ? 'Saving…' : isEditMode ? 'Update' : 'Add'}
              </button>
              <button onClick={closeForm}
                style={{ height:38, padding:'0 14px', background:'#fff', color:'#666',
                  border:'1.5px solid #ddd', borderRadius:7, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div style={{ border:'1px solid var(--dash-border)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 18px', borderBottom:'1px solid var(--dash-border)', background:'#f8f9ff' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#3f51b5', textTransform:'uppercase', letterSpacing:'.5px' }}>
            {filterLbl ? filterLbl : 'All Metadata'} Values
          </span>
          <span style={{ fontSize:12, color:'#888' }}>
            {loading ? 'Loading…' : `${filtered.length} record${filtered.length!==1?'s':''}`}
          </span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f0f2ff' }}>
                <th style={TH}>#</th>
                <th style={TH}>Category</th>
                <th style={TH}>Value / Parameter</th>
                <th style={TH}>Action Type</th>
                <th style={TH}>Status</th>
                <th style={{...TH, textAlign:'center', width:110}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding:'40px 0', textAlign:'center', color:'#3f51b5' }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
                    <div className="mod-spinner"/>Loading…
                  </div>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding:'40px 0', textAlign:'center', color:'#bbb', fontSize:14 }}>
                  No metadata records found.
                </td></tr>
              )}
              {!loading && filtered.map((row, i) => (
                <tr key={`${row.ouid ?? 0}-${i}`} style={{ borderBottom:'1px solid var(--dash-border)',
                  transition:'background .12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f5f7ff'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={TD}><span style={{ color:'#bbb', fontSize:12 }}>{i+1}</span></td>
                  <td style={TD}>
                    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:4,
                      background:'#eef0ff', color:'#3f51b5', fontSize:11, fontWeight:700 }}>
                      {row.label || '—'}
                    </span>
                  </td>
                  <td style={{...TD, fontWeight:500}}>{row.parameter || '—'}</td>
                  <td style={{...TD, color:'#888', fontSize:12}}>{row.action || '—'}</td>
                  <td style={TD}>
                    <button onClick={()=>handleToggleStatus(row)}
                      title={`Click to set ${row.status?.toLowerCase()==='active'?'Inactive':'Active'}`}
                      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px',
                        borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                        background: row.status?.toLowerCase()==='active' ? '#e8f5e9' : '#ffebee',
                        color: row.status?.toLowerCase()==='active' ? '#1b5e20' : '#b71c1c' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%',
                        background: row.status?.toLowerCase()==='active' ? '#27ae60' : '#e53935' }}/>
                      {row.status || 'Active'}
                    </button>
                  </td>
                  <td style={{ ...TD, textAlign:'center' }}>
                    <div style={{ display:'inline-flex', gap:6 }}>
                      <button onClick={()=>openEdit(row)}
                        title="Edit"
                        style={{ width:28, height:28, border:'none', borderRadius:6, cursor:'pointer',
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          background:'#eef0ff', color:'#3f51b5', transition:'background .15s' }}
                        onMouseEnter={e=>{e.currentTarget.style.background='#3f51b5';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#eef0ff';e.currentTarget.style.color='#3f51b5';}}>
                        <EditIcon/>
                      </button>
                      <button onClick={()=>handleDelete(row)}
                        title="Delete"
                        style={{ width:28, height:28, border:'none', borderRadius:6, cursor:'pointer',
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          background:'#ffebee', color:'#e53935', transition:'background .15s' }}
                        onMouseEnter={e=>{e.currentTarget.style.background='#e53935';e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#ffebee';e.currentTarget.style.color='#e53935';}}>
                        <TrashIcon/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TH = { padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700,
  color:'#2F2F7F', textTransform:'uppercase', letterSpacing:'.5px',
  whiteSpace:'nowrap', borderBottom:'2px solid #d8ddf5' };
const TD = { padding:'9px 16px', verticalAlign:'middle', color:'#333' };

// ─────────────────────────────────────────────────────────────────────────────
export default function UserSettings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const isAdmin = user?.role === 'Admin' || user?.role === 'AVP_Admin';

  // ── Profile form ───────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    userName: user?.userName || '',
    emailId:  user?.emailId  || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const handleProfileChange = (field) => (e) =>
    setProfileForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profileForm.userName.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Full Name cannot be empty.', confirmButtonColor: '#3f51b5' });
      return;
    }
    if (!profileForm.emailId.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.emailId)) {
      Swal.fire({ icon: 'warning', title: 'Invalid Email', text: 'Please enter a valid email address.', confirmButtonColor: '#3f51b5' });
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await usersApi.updateProfile(user.uId, {
        userName: profileForm.userName.trim(),
        emailId:  profileForm.emailId.trim(),
      });
      updateUser({ userName: updated.userName, emailId: updated.emailId });
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Your profile has been updated.', confirmButtonColor: '#3f51b5', timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'Could not save profile.', confirmButtonColor: '#3f51b5' });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Password form ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const strength = pwStrength(pwForm.next);

  const handlePwChange = (field) => (e) =>
    setPwForm(prev => ({ ...prev, [field]: e.target.value }));

  const handlePwSave = async (e) => {
    e.preventDefault();
    if (!pwForm.current) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter your current password.', confirmButtonColor: '#3f51b5' });
      return;
    }
    if (pwForm.next.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Too Short', text: 'New password must be at least 8 characters.', confirmButtonColor: '#3f51b5' });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      Swal.fire({ icon: 'warning', title: 'Mismatch', text: 'New password and confirmation do not match.', confirmButtonColor: '#3f51b5' });
      return;
    }
    setPwSaving(true);
    try {
      await usersApi.changePassword(user.uId, pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      Swal.fire({ icon: 'success', title: 'Password Changed', text: 'Your password has been updated successfully.', confirmButtonColor: '#3f51b5', timer: 2500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'Could not change password.', confirmButtonColor: '#3f51b5' });
    } finally {
      setPwSaving(false);
    }
  };

  const role  = user?.role  ?? 'Viewer';
  const color = roleColor(role);
  const label = roleLabel(role);

  return (
    <div className="us-page" style={{ maxWidth: tab === 'metadata' ? 'none' : 800 }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="us-page-header">
        <div>
          <h1 className="us-title">My Account</h1>
          <p className="us-subtitle">Manage your personal details and security settings</p>
        </div>
        <div className="us-avatar-large" style={{ background: color }}>
          {(user?.userName ?? user?.userId ?? 'U')
            .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="us-tabs">
        <button className={`us-tab${tab === 'profile' ? ' active' : ''}`}
          onClick={() => setTab('profile')}>
          <PersonIcon /> Personal Details
        </button>
        <button className={`us-tab${tab === 'security' ? ' active' : ''}`}
          onClick={() => setTab('security')}>
          <LockIcon /> Security
        </button>
        {isAdmin && (
          <button className={`us-tab${tab === 'metadata' ? ' active' : ''}`}
            onClick={() => setTab('metadata')}>
            <DatabaseIcon /> Metadata
          </button>
        )}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="us-card" style={{ maxWidth: tab === 'metadata' ? 'none' : undefined }}>

        {/* ────────── PROFILE TAB ────────── */}
        {tab === 'profile' && (
          <form className="us-form" onSubmit={handleProfileSave} noValidate>
            <div className="us-section-title">Account Information</div>
            <div className="us-grid">
              <Field label="Full Name">
                <input type="text" className="us-input" value={profileForm.userName}
                  onChange={handleProfileChange('userName')} placeholder="Enter your full name" maxLength={100}/>
              </Field>
              <Field label="Email Address">
                <input type="email" className="us-input" value={profileForm.emailId}
                  onChange={handleProfileChange('emailId')} placeholder="Enter your email address" maxLength={200}/>
              </Field>
              <Field label="User ID"><ReadOnly value={user?.userId} /></Field>
              <Field label="Role">
                <div className="us-readonly">
                  <span className="us-role-badge" style={{ background: color }}>{label}</span>
                </div>
              </Field>
              <Field label="Account Status">
                <div className="us-readonly">
                  <span className={`us-status-badge ${(user?.status ?? '').toLowerCase() === 'active' ? 'active' : 'inactive'}`}>
                    {user?.status || '—'}
                  </span>
                </div>
              </Field>
            </div>
            <div className="us-form-footer">
              <button type="submit" className="us-btn-primary" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : <><SaveIcon /> Save Changes</>}
              </button>
            </div>
          </form>
        )}

        {/* ────────── SECURITY TAB ────────── */}
        {tab === 'security' && (
          <form className="us-form" onSubmit={handlePwSave} noValidate>
            <div className="us-section-title">Change Password</div>
            <div className="us-info-box">
              <InfoIcon />
              <span>
                If you signed in with Microsoft SSO, password changes may not apply.
                Contact your administrator to manage your Microsoft account password.
              </span>
            </div>
            <div className="us-grid us-grid-narrow">
              <Field label="Current Password">
                <PwInput value={pwForm.current} onChange={handlePwChange('current')}
                  placeholder="Enter current password" autoComplete="current-password"/>
              </Field>
              <Field label="New Password" hint="Minimum 8 characters. Mix uppercase, lowercase, numbers, and symbols for a stronger password.">
                <PwInput value={pwForm.next} onChange={handlePwChange('next')}
                  placeholder="Enter new password" autoComplete="new-password"/>
                {pwForm.next && (
                  <div className="us-strength-bar">
                    <div className="us-strength-track">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="us-strength-seg"
                          style={{ background: i <= strength.score ? strength.color : '#e0e4f0' }}/>
                      ))}
                    </div>
                    <span className="us-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </Field>
              <Field label="Confirm New Password">
                <PwInput value={pwForm.confirm} onChange={handlePwChange('confirm')}
                  placeholder="Re-enter new password" autoComplete="new-password"/>
                {pwForm.confirm && pwForm.next && (
                  <div className={`us-match-hint ${pwForm.next === pwForm.confirm ? 'ok' : 'err'}`}>
                    {pwForm.next === pwForm.confirm
                      ? <><CheckCircle /> Passwords match</>
                      : 'Passwords do not match'}
                  </div>
                )}
              </Field>
            </div>
            <div className="us-form-footer">
              <button type="submit" className="us-btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Updating…' : <><LockIcon /> Update Password</>}
              </button>
            </div>
          </form>
        )}

        {/* ────────── METADATA TAB (Admin only) ────────── */}
        {tab === 'metadata' && isAdmin && (
          <div>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div className="us-section-title" style={{ marginBottom:4 }}>Component Metadata</div>
                <p style={{ margin:0, fontSize:13, color:'#888' }}>
                  Manage dropdown values used across Projects, Issues, Checklists and DMRS forms.
                </p>
              </div>
            </div>
            <MetadataPanel/>
          </div>
        )}
      </div>
    </div>
  );
}
