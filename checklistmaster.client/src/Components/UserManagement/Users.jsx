import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { usersApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';

const ROLE_OPTIONS   = ['Admin','AVP_Admin','WGDE_Admin','AVP_User','WGDE_User','Viewer'];
const STATUS_OPTIONS = ['Active','Inactive'];
const PAGE_SIZE      = 10;

const EMPTY = { uId:'', userId:'', userName:'', emailId:'', role:'Viewer', status:'Active', password:'' };

const genUid = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate = v => v ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

// ── Icons ─────────────────────────────────────────────────────
const EyeIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BanIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const UsersIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const PlusIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const CheckIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>;

// ── Badges ────────────────────────────────────────────────────
const roleBadgeClass = r => ({ Admin:'mod-badge-admin', AVP_Admin:'mod-badge-avp-admin', WGDE_Admin:'mod-badge-wgte-admin', AVP_User:'mod-badge-user', WGDE_User:'mod-badge-user', Viewer:'mod-badge-viewer' }[r] ?? 'mod-badge-viewer');
const RoleBadge   = ({ v }) => <span className={`mod-badge ${roleBadgeClass(v)}`}>{v||'—'}</span>;
const StatusBadge = ({ v }) => <span className={`mod-badge ${v?.toLowerCase()==='active'?'mod-badge-active':'mod-badge-inactive'}`}>{v||'—'}</span>;

// ── Sub-components ────────────────────────────────────────────
const VF = ({ label, value, badge, wide }) => (
  <div className={`mod-vf${wide?' mod-vf-wide':''}`}>
    <span className="mod-vf-label">{label}</span>
    <span className="mod-vf-value">{badge ?? (value||'—')}</span>
  </div>
);
const Sec = ({ title }) => <div className="mod-section-title">{title}</div>;
const Sel = ({ value, onChange, options, placeholder='Select…' }) => (
  <div className="mod-select-wrap">
    <select value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
    <span className="mod-select-arrow">▾</span>
  </div>
);
const CloseBtn = ({ onClick }) => (
  <button className="mod-drawer-close" onClick={onClick} type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
);

// ─────────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();
  const perm = usePermissions();

  // AVP_Admin cannot manage Admin / WGDE_Admin users; nobody can deactivate themselves
  const canManageRow = row => {
    const isSelf = me?.userId === row.userId || me?.uId === row.uId;
    if (isSelf) return false;
    if (perm.role === 'AVP_Admin' && (row.role === 'Admin' || row.role === 'WGDE_Admin')) return false;
    return perm.canEdit('users', row);
  };
  // Roles that AVP_Admin is allowed to assign
  const allowedRoles = perm.role === 'Admin'
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(r => r !== 'Admin' && r !== 'WGDE_Admin');
  const [rows,     setRows]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filters,  setFilters]  = useState({ role:'', status:'', search:'' });
  const [page,     setPage]     = useState(1);

  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [changePwd,   setChangePwd]   = useState(false);

  // Load ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    usersApi.getAll()
      .then(data => { setRows(data); setFiltered(data); })
      .catch(err => Swal.fire({ icon:'error', title:'Load failed', text:err.message, confirmButtonColor:'#3f51b5' }))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => usersApi.getAll()
    .then(data => { setRows(data); setFiltered(data); setPage(1); })
    .catch(err => Swal.fire({ icon:'error', title:'Reload failed', text:err.message, confirmButtonColor:'#3f51b5' }));

  // Filter ──────────────────────────────────────────────────
  const handleSearch = () => {
    let r = [...rows];
    if (filters.role)   r = r.filter(x => x.role   === filters.role);
    if (filters.status) r = r.filter(x => x.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(x => x.userName?.toLowerCase().includes(q) || x.userId?.toLowerCase().includes(q) || x.emailId?.toLowerCase().includes(q));
    }
    setFiltered(r); setPage(1);
  };
  const handleReset = () => { setFilters({ role:'', status:'', search:'' }); setFiltered(rows); setPage(1); };
  const setF = (k, v) => setFilters(p=>({...p,[k]:v}));

  // Drawer ──────────────────────────────────────────────────
  const openDrawer = (mode, row=null) => {
    setDrawerMode(mode); setDrawerRow(row); setChangePwd(false); setSaving(false);
    setForm(row ? { ...EMPTY, ...row, password:'' } : { ...EMPTY, uId: genUid() });
    setDrawerMount(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setDrawerOpen(true)));
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(()=>{ setDrawerMount(false); setSaving(false); }, 320);
  };
  const sf = (k,v) => setForm(p=>({...p,[k]:v}));

  // Save ────────────────────────────────────────────────────
  const handleSave = async e => {
    e.preventDefault();
    if (!form.userId?.trim() || !form.userName?.trim() || !form.emailId?.trim()) {
      Swal.fire({ icon:'warning', title:'Required fields', text:'User ID, Name and Email are required.', confirmButtonColor:'#3f51b5' }); return;
    }
    setSaving(true);
    const isEdit = drawerMode === 'edit';
    const payload = { ...form };

    // For edit: if not changing password, preserve existing hash
    if (isEdit && !changePwd) payload.password = drawerRow?.password ?? null;

    try {
      isEdit ? await usersApi.update(form.uId, payload) : await usersApi.create(payload);
      closeDrawer(); await reload();
      Swal.fire({ icon:'success', title: isEdit?'User Updated!':'User Created!', text:`${form.userName} has been ${isEdit?'updated':'created'} successfully.`, timer:2500, showConfirmButton:false, timerProgressBar:true });
    } catch(err) {
      Swal.fire({ icon:'error', title:'Save failed', text:err.message, confirmButtonColor:'#3f51b5' });
    } finally { setSaving(false); }
  };

  // Deactivate ──────────────────────────────────────────────
  const handleDeactivate = async row => {
    if (row.status?.toLowerCase()==='inactive') { Swal.fire({ icon:'info', title:'Already inactive', confirmButtonColor:'#3f51b5' }); return; }
    const res = await Swal.fire({ title:'Deactivate user?', html:`<b>${row.userName}</b> (${row.userId})<br/><small style="color:#888">Status will be set to Inactive.</small>`, icon:'warning', showCancelButton:true, confirmButtonColor:'#e67e22', cancelButtonColor:'#6c757d', confirmButtonText:'Deactivate', reverseButtons:true });
    if (!res.isConfirmed) return;
    try {
      await usersApi.update(row.uId, { ...row, status:'Inactive' });
      await reload();
      Swal.fire({ icon:'success', title:'Deactivated!', timer:2000, showConfirmButton:false, timerProgressBar:true });
    } catch(err) { Swal.fire({ icon:'error', title:'Failed', text:err.message, confirmButtonColor:'#3f51b5' }); }
  };

  // Approve ─────────────────────────────────────────────────
  const handleApprove = async row => {
    const res = await Swal.fire({
      title: 'Approve account?',
      html: `<b>${row.userName}</b> (${row.userId})<br/><small style="color:#888">Status will be set to Active. The user can log in with the default password.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#27ae60',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Approve',
      reverseButtons: true,
    });
    if (!res.isConfirmed) return;
    try {
      await usersApi.approve(row.uId);
      await reload();
      Swal.fire({ icon:'success', title:'Account Approved!', text:`${row.userName} can now log in.`, timer:2500, showConfirmButton:false, timerProgressBar:true });
    } catch(err) { Swal.fire({ icon:'error', title:'Approval failed', text:err.message, confirmButtonColor:'#3f51b5' }); }
  };

  // Pagination ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows   = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const pageNums   = Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1);

  const drawerColors = { view:'#2980b9', edit:'#e67e22', create:'#27ae60' };
  const drawerTitles = { view:'View User', edit:'Edit User', create:'New User' };
  const drawerIcons  = { view:<EyeIcon/>, edit:<EditIcon/>, create:<PlusIcon/> };

  return (
    <div className="mod-page">

      {/* Header */}
      <div className="mod-page-header">
        <div>
          <h1 className="mod-title">User Management</h1>
          <p className="mod-subtitle">Manage system users, roles and access permissions</p>
        </div>
        <button className="mod-btn mod-btn-primary" onClick={()=>openDrawer('create')}>
          <PlusIcon/> New User
        </button>
      </div>

      {/* Filters */}
      <div className="mod-filter-card">
        <div className="mod-filter-label">Filter &amp; Search</div>
        <div className="mod-filter-row">
          <div className="mod-filter-field">
            <label>Role</label>
            <select value={filters.role} onChange={e=>setF('role',e.target.value)}>
              <option value="">All Roles</option>
              {allowedRoles.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="mod-filter-field">
            <label>Status</label>
            <select value={filters.status} onChange={e=>setF('status',e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="mod-filter-field">
            <label>Search</label>
            <input placeholder="Name, User ID or Email…" value={filters.search} onChange={e=>setF('search',e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          </div>
          <div className="mod-filter-actions">
            <button className="mod-btn mod-btn-primary" onClick={handleSearch}>Search</button>
            <button className="mod-btn mod-btn-outline" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mod-grid-card">
        <div className="mod-grid-meta">
          <span className="mod-count">{loading?'Loading…':`${filtered.length} user${filtered.length!==1?'s':''} found`}</span>
          {loading&&<span className="mod-loading-text">Fetching…</span>}
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr>
              <th style={{width:44}}>#</th>
              <th>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th style={{width:100}}>Actions</th>
            </tr></thead>
            <tbody>
              {loading&&<tr className="mod-state-row"><td colSpan={8}><div className="mod-state-box loading"><div className="mod-spinner"/><span>Loading users…</span></div></td></tr>}
              {!loading&&pageRows.length===0&&<tr className="mod-state-row"><td colSpan={8}><div className="mod-state-box"><UsersIcon/><span>No users found.</span></div></td></tr>}
              {!loading&&pageRows.map((row,i)=>(
                <tr key={row.uId} className="mod-tr">
                  <td className="mod-td-num">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td><span className="mod-id-tag">{row.userId||'—'}</span></td>
                  <td className="mod-td-main">{row.userName||'—'}</td>
                  <td className="mod-td-sub">{row.emailId||'—'}</td>
                  <td><RoleBadge v={row.role}/></td>
                  <td><StatusBadge v={row.status}/></td>
                  <td className="mod-td-sub">{fmtDate(row.lastlogin)}</td>
                  <td className="mod-td-actions">
                    <button className="mod-action-btn mod-action-view" title="View" onClick={()=>openDrawer('view',row)}><EyeIcon/></button>
                    {canManageRow(row)&&<button className="mod-action-btn mod-action-edit" title="Edit" onClick={()=>openDrawer('edit',row)}><EditIcon/></button>}
                    {canManageRow(row)&&row.status?.toLowerCase()==='inactive'&&<button className="mod-action-btn mod-action-approve" title="Approve Account" onClick={()=>handleApprove(row)}><CheckIcon/></button>}
                    {canManageRow(row)&&row.status?.toLowerCase()!=='inactive'&&<button className="mod-action-btn mod-action-deactivate" title="Deactivate" onClick={()=>handleDeactivate(row)}><BanIcon/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading&&totalPages>1&&(
          <div className="mod-pagination">
            <button className="mod-page-btn" disabled={page===1}          onClick={()=>setPage(1)}>«</button>
            <button className="mod-page-btn" disabled={page===1}          onClick={()=>setPage(p=>p-1)}>‹</button>
            {pageNums.map((p,idx)=>{const prev=pageNums[idx-1];return(<span key={p} style={{display:'contents'}}>{prev&&p-prev>1&&<span className="mod-page-ellipsis">…</span>}<button className={`mod-page-btn${p===page?' active':''}`} onClick={()=>setPage(p)}>{p}</button></span>);})}
            <button className="mod-page-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="mod-page-btn" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</button>
            <span className="mod-page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerMount&&(
        <>
          <div className={`mod-drawer-overlay${drawerOpen?' open':''}`} onClick={closeDrawer}/>
          <aside className={`mod-drawer${drawerOpen?' open':''}`}>
            <div className="mod-drawer-header" style={{borderBottomColor:drawerColors[drawerMode]+'33'}}>
              <div className="mod-drawer-header-left">
                <div className="mod-drawer-mode-icon" style={{background:drawerColors[drawerMode]+'18',color:drawerColors[drawerMode]}}>{drawerIcons[drawerMode]}</div>
                <div>
                  <h2 className="mod-drawer-title">{drawerTitles[drawerMode]}</h2>
                  <p className="mod-drawer-subtitle">{drawerMode==='create'?'Fill in the details to create a new user':drawerRow?.userId}</p>
                </div>
              </div>
              <CloseBtn onClick={closeDrawer}/>
            </div>

            {/* VIEW */}
            {drawerMode==='view'&&(<>
              <div className="mod-drawer-body">
                <div className="mod-view-block"><Sec title="Identity"/>
                  <div className="mod-vf-grid">
                    <VF label="User ID"   value={drawerRow?.userId}/>
                    <VF label="User Name" value={drawerRow?.userName}/>
                    <VF label="Email"     value={drawerRow?.emailId} wide/>
                  </div>
                </div>
                <div className="mod-view-block"><Sec title="Access"/>
                  <div className="mod-vf-grid">
                    <VF label="Role"   badge={<RoleBadge v={drawerRow?.role}/>}/>
                    <VF label="Status" badge={<StatusBadge v={drawerRow?.status}/>}/>
                  </div>
                </div>
                <div className="mod-view-block"><Sec title="Audit"/>
                  <div className="mod-vf-grid">
                    <VF label="Created Date" value={fmtDate(drawerRow?.createdDate)}/>
                    <VF label="Last Login"   value={fmtDate(drawerRow?.lastlogin)}/>
                  </div>
                </div>
              </div>
              <div className="mod-drawer-footer">
                <button className="mod-btn mod-btn-outline" onClick={closeDrawer}>Close</button>
                {canManageRow(drawerRow??{})&&<button className="mod-btn mod-btn-primary" onClick={()=>setDrawerMode('edit')}><EditIcon/> Edit</button>}
              </div>
            </>)}

            {/* EDIT / CREATE */}
            {(drawerMode==='edit'||drawerMode==='create')&&(
              <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
                <div className="mod-drawer-body">
                  <div className="mod-form-block"><Sec title="Identity"/>
                    <div className="mod-form-grid">
                      <div className="mod-field"><label>User ID <span className="req">*</span></label><input value={form.userId} onChange={e=>sf('userId',e.target.value)} placeholder="e.g. john.doe@company.com" required/></div>
                      <div className="mod-field"><label>User Name <span className="req">*</span></label><input value={form.userName} onChange={e=>sf('userName',e.target.value)} placeholder="Full name" required/></div>
                      <div className="mod-field mod-field-full"><label>Email <span className="req">*</span></label><input type="email" value={form.emailId} onChange={e=>sf('emailId',e.target.value)} placeholder="email@company.com" required/></div>
                    </div>
                  </div>
                  <div className="mod-form-block"><Sec title="Access"/>
                    <div className="mod-form-grid">
                      <div className="mod-field"><label>Role <span className="req">*</span></label><Sel value={form.role} onChange={e=>sf('role',e.target.value)} options={allowedRoles} placeholder="Select role…"/></div>
                      <div className="mod-field"><label>Status <span className="req">*</span></label><Sel value={form.status} onChange={e=>sf('status',e.target.value)} options={STATUS_OPTIONS} placeholder="Select status…"/></div>
                    </div>
                  </div>
                  <div className="mod-form-block" style={{marginBottom:0}}><Sec title="Password"/>
                    {drawerMode==='edit'&&(
                      <label className="mod-pwd-toggle">
                        <input type="checkbox" checked={changePwd} onChange={e=>{ setChangePwd(e.target.checked); if(!e.target.checked) sf('password',''); }}/>
                        Set / change password
                      </label>
                    )}
                    {(drawerMode==='create'||changePwd)&&(
                      <div className="mod-form-grid">
                        <div className="mod-field mod-field-full"><label>{drawerMode==='create'?'Password':'New Password'}</label>
                          <input type="password" value={form.password} onChange={e=>sf('password',e.target.value)} placeholder={drawerMode==='create'?'Leave blank to allow any password':'Enter new password'}/>
                          <span className="mod-field-hint">Leave blank to accept any password on login (until a password is set).</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mod-drawer-footer">
                  <button type="button" className="mod-btn mod-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                  <button type="submit" className="mod-btn mod-btn-primary" disabled={saving}>{saving?'Saving…':drawerMode==='edit'?'Update User':'Create User'}</button>
                </div>
              </form>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
