import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { milestoneMasterApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import '../../styles/module.css';

const PAGE_SIZE = 10;

const EMPTY = {
  uid: '', milestoneName: '', description: '', noOfDays: '',
  milestoneOrder: '', status: 'Active',
  createdBy: '', createdDate: '', modifiedBy: '', modifiedDate: '',
};

const genUid = () => crypto.randomUUID().replace(/-/g, '').toUpperCase();
const fmtDate = v => v ? new Date(v).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const EyeIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BanIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const FlagIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;

const StatusBadge = ({ v }) => (
  <span className={`mod-badge ${v?.toLowerCase() === 'active' ? 'mod-badge-active' : 'mod-badge-inactive'}`}>{v || '—'}</span>
);

const VF = ({ label, value, badge, wide }) => (
  <div className={`mod-vf${wide ? ' mod-vf-wide' : ''}`}>
    <span className="mod-vf-label">{label}</span>
    <span className="mod-vf-value">{badge ?? (value || '—')}</span>
  </div>
);
const Sec = ({ title }) => <div className="mod-section-title">{title}</div>;
const Sel = ({ value, onChange, options, placeholder = 'Select…' }) => (
  <div className="mod-select-wrap">
    <select value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <span className="mod-select-arrow">▾</span>
  </div>
);
const CloseBtn = ({ onClick }) => (
  <button className="mod-drawer-close" onClick={onClick} type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
);

export default function ChecklistMilestones() {
  const { user } = useAuth();
  const perm     = usePermissions();
  const actor    = user?.userId || user?.email || 'system';

  const [rows,     setRows]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filters,  setFilters]  = useState({ status: '', search: '' });
  const [page,     setPage]     = useState(1);

  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerMode,  setDrawerMode]  = useState('view');
  const [drawerRow,   setDrawerRow]   = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    setLoading(true);
    milestoneMasterApi.getAll()
      .then(d => { setRows(d ?? []); setFiltered(d ?? []); })
      .catch(err => Swal.fire({ icon: 'error', title: 'Load failed', text: err.message, confirmButtonColor: '#3f51b5' }))
      .finally(() => setLoading(false));
  }, []);

  const reload = () =>
    milestoneMasterApi.getAll()
      .then(d => { setRows(d ?? []); setPage(1); })
      .catch(err => Swal.fire({ icon: 'error', title: 'Reload failed', text: err.message, confirmButtonColor: '#3f51b5' }));

  const applyFilters = (src = rows, f = filters) => {
    let r = [...src];
    if (f.status) r = r.filter(x => x.status === f.status);
    if (f.search) {
      const q = f.search.toLowerCase();
      r = r.filter(x =>
        (x.milestoneName || '').toLowerCase().includes(q) ||
        (x.description   || '').toLowerCase().includes(q)
      );
    }
    return r;
  };
  useEffect(() => { setFiltered(applyFilters(rows, filters)); setPage(1); }, [filters, rows]);
  const handleReset = () => setFilters({ status: '', search: '' });
  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  const openDrawer = (mode, row = null) => {
    setDrawerMode(mode); setDrawerRow(row); setSaving(false);
    setForm(row ? { ...EMPTY, ...row, noOfDays: row.noOfDays ?? '', milestoneOrder: row.milestoneOrder ?? '' } : { ...EMPTY, uid: genUid() });
    setDrawerMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerOpen(true)));
  };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => { setDrawerMount(false); setSaving(false); }, 320); };
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async e => {
    e.preventDefault();
    if (!form.milestoneName?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Milestone Name is required.', confirmButtonColor: '#3f51b5' });
      return;
    }
    if (!form.milestoneOrder || isNaN(parseInt(form.milestoneOrder, 10))) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Milestone Order is required.', confirmButtonColor: '#3f51b5' });
      return;
    }
    setSaving(true);
    const now    = new Date().toISOString();
    const isEdit = drawerMode === 'edit';
    const payload = {
      ...form,
      noOfDays:       form.noOfDays       ? parseInt(form.noOfDays, 10)       : null,
      milestoneOrder: form.milestoneOrder ? parseInt(form.milestoneOrder, 10) : null,
      modifiedBy:   actor,
      modifiedDate: now,
      ...(isEdit ? {} : { createdBy: actor, createdDate: now }),
    };
    try {
      isEdit
        ? await milestoneMasterApi.update(form.uid, payload)
        : await milestoneMasterApi.create(payload);
      closeDrawer();
      await reload();
      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Milestone Updated!' : 'Milestone Created!',
        timer: 2500, showConfirmButton: false, timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Save failed', text: err.message, confirmButtonColor: '#3f51b5' });
    } finally { setSaving(false); }
  };

  const handleDeactivate = async row => {
    if (row.status?.toLowerCase() === 'inactive') {
      Swal.fire({ icon: 'info', title: 'Already inactive', confirmButtonColor: '#3f51b5' }); return;
    }
    const res = await Swal.fire({
      title: 'Deactivate milestone?',
      html: `<b>${row.milestoneName}</b><br/><small style="color:#888">Status will be set to Inactive.</small>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#e67e22', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Deactivate', reverseButtons: true,
    });
    if (!res.isConfirmed) return;
    try {
      await milestoneMasterApi.update(row.uid, { ...row, status: 'Inactive', modifiedBy: actor, modifiedDate: new Date().toISOString() });
      await reload();
      Swal.fire({ icon: 'success', title: 'Deactivated!', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    } catch (err) { Swal.fire({ icon: 'error', title: 'Failed', text: err.message, confirmButtonColor: '#3f51b5' }); }
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageNums   = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  const drawerColors = { view: '#2980b9', edit: '#e67e22', create: '#27ae60' };
  const drawerTitles = { view: 'View Milestone', edit: 'Edit Milestone', create: 'New Milestone' };
  const drawerIcons  = { view: <EyeIcon/>, edit: <EditIcon/>, create: <PlusIcon/> };

  return (
    <div className="mod-page">
      <div className="mod-page-header">
        <div>
          <h1 className="mod-title">Milestone Master</h1>
          <p className="mod-subtitle">Define the default milestone sequence — name, description, and days between each milestone</p>
        </div>
        <div className="mod-header-actions">
          {perm.canCreate('milestones') && (
            <button className="mod-btn mod-btn-primary" onClick={() => openDrawer('create')}>
              <PlusIcon/> New Milestone
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mod-filter-card">
        <div className="mod-filter-label">Filter &amp; Search</div>
        <div className="mod-filter-row">
          <div className="mod-filter-field">
            <label>Status</label>
            <select value={filters.status} onChange={e => setF('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="mod-filter-field">
            <label>Search</label>
            <input
              placeholder="Milestone name, description…"
              value={filters.search}
              onChange={e => setF('search', e.target.value)}/>
          </div>
          <div className="mod-filter-actions">
            <button className="mod-btn mod-btn-outline" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mod-grid-card">
        <div className="mod-grid-meta">
          <span className="mod-count">
            {loading ? 'Loading…' : `${filtered.length} milestone${filtered.length !== 1 ? 's' : ''} found`}
          </span>
          {loading && <span className="mod-loading-text">Fetching…</span>}
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Order</th>
                <th>Milestone Name</th>
                <th>Description</th>
                <th style={{ width: 110 }}>No. of Days</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="mod-state-row"><td colSpan={6}>
                  <div className="mod-state-box loading"><div className="mod-spinner"/><span>Loading milestones…</span></div>
                </td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr className="mod-state-row"><td colSpan={6}>
                  <div className="mod-state-box"><FlagIcon/><span>No milestones found.</span></div>
                </td></tr>
              )}
              {!loading && pageRows.map(row => (
                <tr key={row.uid} className="mod-tr">
                  <td className="mod-td-num" style={{ textAlign: 'center' }}>
                    <span className="mod-badge mod-badge-primary">{row.milestoneOrder ?? '—'}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#2c3e50' }}>{row.milestoneName || '—'}</span>
                  </td>
                  <td style={{ color: '#555', fontSize: 12 }}>{row.description || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {row.noOfDays != null
                      ? <span className="mod-badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}>{row.noOfDays}d</span>
                      : '—'}
                  </td>
                  <td><StatusBadge v={row.status}/></td>
                  <td className="mod-td-actions">
                    <button className="mod-action-btn mod-action-view"       title="View"       onClick={() => openDrawer('view', row)}><EyeIcon/></button>
                    {perm.canEdit('milestones', row)   && <button className="mod-action-btn mod-action-edit"       title="Edit"       onClick={() => openDrawer('edit', row)}><EditIcon/></button>}
                    {perm.canDelete('milestones', row) && (
                      <button className="mod-action-btn mod-action-deactivate" title="Deactivate"
                        onClick={() => handleDeactivate(row)} disabled={row.status?.toLowerCase() === 'inactive'}>
                        <BanIcon/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="mod-pagination">
            <button className="mod-page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="mod-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {pageNums.map((p, idx) => {
              const prev = pageNums[idx - 1];
              return (
                <span key={p} style={{ display: 'contents' }}>
                  {prev && p - prev > 1 && <span className="mod-page-ellipsis">…</span>}
                  <button className={`mod-page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                </span>
              );
            })}
            <button className="mod-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="mod-page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            <span className="mod-page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerMount && (<>
        <div className={`mod-drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={closeDrawer}/>
        <aside className={`mod-drawer${drawerOpen ? ' open' : ''}`}>
          <div className="mod-drawer-header" style={{ borderBottomColor: drawerColors[drawerMode] + '33' }}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon"
                style={{ background: drawerColors[drawerMode] + '18', color: drawerColors[drawerMode] }}>
                {drawerIcons[drawerMode]}
              </div>
              <div>
                <h2 className="mod-drawer-title">{drawerTitles[drawerMode]}</h2>
                <p className="mod-drawer-subtitle">
                  {drawerMode === 'create' ? 'Define a new default milestone' : (drawerRow?.milestoneName || '')}
                </p>
              </div>
            </div>
            <CloseBtn onClick={closeDrawer}/>
          </div>

          {/* ── VIEW ── */}
          {drawerMode === 'view' && (<>
            <div className="mod-drawer-body">
              <div className="mod-view-block"><Sec title="Milestone Details"/>
                <div className="mod-vf-grid">
                  <VF label="Milestone Name"  value={drawerRow?.milestoneName} wide/>
                  <VF label="Milestone Order" value={drawerRow?.milestoneOrder != null ? String(drawerRow.milestoneOrder) : '—'}/>
                  <VF label="Status"          badge={<StatusBadge v={drawerRow?.status}/>}/>
                  <VF label="No. of Days"     value={drawerRow?.noOfDays != null ? `${drawerRow.noOfDays} days` : '—'}/>
                  <VF label="Description"     value={drawerRow?.description} wide/>
                </div>
              </div>
              <div className="mod-view-block"><Sec title="Audit"/>
                <div className="mod-vf-grid">
                  <VF label="Created By"    value={drawerRow?.createdBy}/>
                  <VF label="Created Date"  value={fmtDate(drawerRow?.createdDate)}/>
                  <VF label="Modified By"   value={drawerRow?.modifiedBy}/>
                  <VF label="Modified Date" value={fmtDate(drawerRow?.modifiedDate)}/>
                </div>
              </div>
            </div>
            <div className="mod-drawer-footer">
              <button className="mod-btn mod-btn-outline" onClick={closeDrawer}>Close</button>
              {perm.canEdit('milestones', drawerRow) && (
                <button className="mod-btn mod-btn-primary" onClick={() => setDrawerMode('edit')}><EditIcon/> Edit</button>
              )}
            </div>
          </>)}

          {/* ── CREATE / EDIT ── */}
          {(drawerMode === 'edit' || drawerMode === 'create') && (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="mod-drawer-body">
                <div className="mod-form-block"><Sec title="Milestone Details"/>
                  <div className="mod-form-grid">

                    <div className="mod-field mod-field-full">
                      <label>Milestone Name <span className="req">*</span></label>
                      <input
                        value={form.milestoneName}
                        onChange={e => sf('milestoneName', e.target.value)}
                        placeholder="e.g. Sync 1"
                        required/>
                    </div>

                    <div className="mod-field">
                      <label>Milestone Order <span className="req">*</span></label>
                      <input
                        type="number" min="1"
                        value={form.milestoneOrder}
                        onChange={e => sf('milestoneOrder', e.target.value)}
                        placeholder="e.g. 1"/>
                    </div>

                    <div className="mod-field">
                      <label>No. of Days</label>
                      <input
                        type="number" min="1"
                        value={form.noOfDays}
                        onChange={e => sf('noOfDays', e.target.value)}
                        placeholder="Days after previous"/>
                    </div>

                    <div className="mod-field">
                      <label>Status</label>
                      <Sel value={form.status} onChange={e => sf('status', e.target.value)} options={['Active','Inactive']}/>
                    </div>

                    <div className="mod-field mod-field-full">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={e => sf('description', e.target.value)}
                        placeholder="Optional description or notes"/>
                    </div>

                  </div>
                </div>
              </div>
              <div className="mod-drawer-footer">
                <button type="button" className="mod-btn mod-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                <button type="submit" className="mod-btn mod-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : drawerMode === 'edit' ? 'Update Milestone' : 'Create Milestone'}
                </button>
              </div>
            </form>
          )}
        </aside>
      </>)}
    </div>
  );
}
