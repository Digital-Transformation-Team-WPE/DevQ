import { useState, useEffect, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import { calendarApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import './Calendar.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SH  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EVENT_TYPES = [
  { value:'Holiday',    label:'Holiday',      color:'#e53935', bg:'#ffebee', border:'#ef9a9a' },
  { value:'Vacation',   label:'Vacation',     color:'#1565c0', bg:'#e3f2fd', border:'#90caf9' },
  { value:'NonWorking', label:'Non-Working',  color:'#607d8b', bg:'#eceff1', border:'#b0bec5' },
  { value:'WorkingDay', label:'Special Work', color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  { value:'Milestone',  label:'Milestone',    color:'#7b1fa2', bg:'#f3e5f5', border:'#ce93d8' },
  { value:'Note',       label:'Note',         color:'#f57c00', bg:'#fff3e0', border:'#ffcc80' },
];
const typeCfg = t => EVENT_TYPES.find(e => e.value === t) || EVENT_TYPES[0];
const genUid  = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();

// ── Exported helper: can be imported by Projects.jsx ─────────────────────────
// Normalize any date value (ISO datetime or plain date string) to "YYYY-MM-DD"
const toDateStr = v => (v ? String(v).slice(0, 10) : '');

export function isWorkingDay(dateStr, events = []) {
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  const day = d.getDay();
  if (day === 0 || day === 6) {
    // Weekend — check if there's a WorkingDay override
    return events.some(ev => {
      if (ev.eventType !== 'WorkingDay') return false;
      return dateStr >= toDateStr(ev.startDate) && dateStr <= toDateStr(ev.endDate);
    });
  }
  // Weekday — check if blocked as Holiday or NonWorking
  const blocked = events.some(ev => {
    if (ev.eventType !== 'Holiday' && ev.eventType !== 'NonWorking' && ev.eventType !== 'Vacation') return false;
    return dateStr >= toDateStr(ev.startDate) && dateStr <= toDateStr(ev.endDate);
  });
  return !blocked;
}

// ── EMPTY form ─────────────────────────────────────────────────────────────────
const EMPTY_EVENT = {
  uid: '', title: '', eventType: 'Holiday',
  startDate: '', endDate: '',
  notes: '', department: '', isGlobal: true,
  isRecurring: false,
};

// ── Mini components ───────────────────────────────────────────────────────────
const CloseBtn = ({ onClick }) => (
  <button className="cal-close-btn" onClick={onClick} type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
);

const ChevronL = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronR = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Main Calendar ─────────────────────────────────────────────────────────────
export default function Calendar() {
  const { user } = useAuth();
  const perm = usePermissions();
  const isAdmin = perm.isAdmin;

  // Event types non-admins may create/edit/delete (their own records only)
  const USER_TYPES = new Set(['Vacation', 'WorkingDay', 'Note']);
  const allowedEventTypes = isAdmin ? EVENT_TYPES : EVENT_TYPES.filter(t => USER_TYPES.has(t.value));
  const canManageEv = (ev) => {
    if (isAdmin) return true;
    return USER_TYPES.has(ev.eventType) &&
      (ev.createdBy === perm.userId || ev.createdBy === user?.email);
  };

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // Side drawer
  const [drawerMount, setDrawerMount] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [isEdit, setIsEdit] = useState(false);

  // Day detail panel
  const [selectedDate, setSelectedDate] = useState(null);

  // Filter
  const [typeFilter, setTypeFilter] = useState('All');

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    calendarApi.getAll()
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Calendar grid computation ─────────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const cells = [];

    // Leading empty cells (prev month days)
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push({ day: prevDays - i, thisMonth: false, date: null });

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, thisMonth: true, date: dateStr });
    }

    // Trailing empty cells
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++)
      cells.push({ day: d, thisMonth: false, date: null });

    return cells;
  }, [year, month]);

  // ── Events for a date ────────────────────────────────────────────────────
  const eventsForDate = useCallback((dateStr) => {
    if (!dateStr) return [];
    return events.filter(ev => {
      const match = typeFilter === 'All' || ev.eventType === typeFilter;
      return match && dateStr >= toDateStr(ev.startDate) && dateStr <= toDateStr(ev.endDate);
    });
  }, [events, typeFilter]);

  // ── Working day stats for current month ───────────────────────────────────
  const monthStats = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let working = 0, holidays = 0, vacations = 0, nonWorking = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (isWorkingDay(ds, events)) working++;
      const dayEvs = eventsForDate(ds);
      if (dayEvs.some(e => e.eventType === 'Holiday'))    holidays++;
      if (dayEvs.some(e => e.eventType === 'Vacation'))   vacations++;
      if (dayEvs.some(e => e.eventType === 'NonWorking')) nonWorking++;
    }
    return { working, holidays, vacations, nonWorking, total: daysInMonth };
  }, [year, month, events, eventsForDate]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(null); };

  // ── Drawer open/close ─────────────────────────────────────────────────────
  const openDrawer = (eventOrNull, prefillDate = null, prefillType = null) => {
    if (eventOrNull) {
      setForm({
        ...EMPTY_EVENT, ...eventOrNull,
        startDate: toDateStr(eventOrNull.startDate),
        endDate:   toDateStr(eventOrNull.endDate),
      });
      setIsEdit(true);
    } else {
      const start = prefillDate || `${year}-${String(month + 1).padStart(2,'0')}-01`;
      const defaultType = prefillType || (isAdmin ? 'Holiday' : 'Vacation');
      setForm({
        ...EMPTY_EVENT, uid: genUid(), startDate: start, endDate: start,
        eventType: defaultType,
        isGlobal: isAdmin,
        ...(isAdmin ? {} : { userId: perm.userId }),
      });
      setIsEdit(false);
    }
    setDrawerMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerOpen(true)));
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerMount(false), 300);
  };
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async e => {
    e.preventDefault();
    if (!form.title.trim()) {
      Swal.fire({ icon:'warning', title:'Required', text:'Event title is required.', confirmButtonColor:'#3f51b5' });
      return;
    }
    if (!form.startDate || !form.endDate) {
      Swal.fire({ icon:'warning', title:'Required', text:'Start and end date are required.', confirmButtonColor:'#3f51b5' });
      return;
    }
    if (form.startDate > form.endDate) {
      Swal.fire({ icon:'warning', title:'Invalid', text:'End date must be on or after start date.', confirmButtonColor:'#3f51b5' });
      return;
    }
    setSaving(true);
    const now   = new Date().toISOString();
    const actor = user?.userId || user?.email || 'system';
    const payload = {
      ...form,
      modifiedBy: actor, modifiedDate: now,
      ...(isEdit ? {} : { createdBy: actor, createdDate: now }),
    };
    try {
      if (isEdit) {
        await calendarApi.update(form.uid, payload);
        setEvents(prev => prev.map(ev => ev.uid === form.uid ? { ...ev, ...payload } : ev));
      } else {
        const created = await calendarApi.create(payload);
        setEvents(prev => [...prev, created ?? payload]);
      }
      closeDrawer();
      Swal.fire({ icon:'success', title: isEdit ? 'Event Updated!' : 'Event Added!', timer: 1800, showConfirmButton: false, timerProgressBar: true });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Save Failed', text: err.message, confirmButtonColor:'#3f51b5' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (uid, title) => {
    const res = await Swal.fire({
      title: 'Delete event?', html: `<b>${title}</b>`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#e53935', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Delete', reverseButtons: true,
    });
    if (!res.isConfirmed) return;
    try {
      await calendarApi.remove(uid);
      setEvents(prev => prev.filter(ev => ev.uid !== uid));
      Swal.fire({ icon:'success', title:'Deleted', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon:'error', title:'Delete Failed', text: err.message, confirmButtonColor:'#3f51b5' });
    }
  };

  // ── Selected day events ───────────────────────────────────────────────────
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cal-page">

      {/* ── Page Header ── */}
      <div className="cal-page-header">
        <div>
          <h1 className="cal-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:8,verticalAlign:'middle'}}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Team Calendar
          </h1>
          <p className="cal-subtitle">Manage holidays, vacations, working days and milestone targets</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button className="cal-btn cal-btn-outline" onClick={goToday}>Today</button>
          <button className="cal-btn cal-btn-primary" onClick={() => openDrawer(null)}>
            <PlusIcon /> {isAdmin ? 'Add Event' : 'Add'}
          </button>
        </div>
      </div>

      {/* ── Month Stats ── */}
      <div className="cal-stats-row">
        {[
          { label: 'Working Days', value: monthStats.working, color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7' },
          { label: 'Holidays',     value: monthStats.holidays,  color: '#e53935', bg: '#ffebee', border: '#ef9a9a' },
          { label: 'Vacations',    value: monthStats.vacations, color: '#1565c0', bg: '#e3f2fd', border: '#90caf9' },
          { label: 'Non-Working',  value: monthStats.nonWorking,color: '#607d8b', bg: '#eceff1', border: '#b0bec5' },
          { label: 'Total Days',   value: monthStats.total,     color: '#3f51b5', bg: '#e8eaf6', border: '#9fa8da' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className="cal-stat-card" style={{ background: bg, border: `1.5px solid ${border}` }}>
            <div className="cal-stat-value" style={{ color }}>{value}</div>
            <div className="cal-stat-label" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Event Type Filter ── */}
      <div className="cal-type-filter">
        {['All', ...EVENT_TYPES.map(t => t.value)].map(t => {
          const cfg = t === 'All' ? null : typeCfg(t);
          const active = typeFilter === t;
          return (
            <button
              key={t}
              className={`cal-type-chip${active ? ' active' : ''}`}
              style={active && cfg ? { background: cfg.bg, color: cfg.color, borderColor: cfg.border } : {}}
              onClick={() => setTypeFilter(t)}>
              {cfg && <span className="cal-type-dot" style={{ background: cfg.color }}/>}
              {t === 'All' ? 'All Events' : cfg?.label}
            </button>
          );
        })}
      </div>

      <div className="cal-layout">
        {/* ── Main Calendar Grid ── */}
        <div className="cal-main">
          {/* Navigation Header */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth}><ChevronL/></button>
            <div className="cal-nav-title">
              <span className="cal-month-name">{MONTHS[month]}</span>
              <span className="cal-year">{year}</span>
              <select className="cal-year-sel" value={year} onChange={e => setYear(+e.target.value)}>
                {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 3 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button className="cal-nav-btn" onClick={nextMonth}><ChevronR/></button>
          </div>

          {/* Day-of-week headers */}
          <div className="cal-dow-row">
            {DAYS_SH.map(d => (
              <div key={d} className={`cal-dow-cell${d==='Sun'||d==='Sat' ? ' weekend' : ''}`}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div className="cal-loading">
              <div className="cal-spinner"/>
              <span>Loading calendar…</span>
            </div>
          ) : (
            <div className="cal-grid">
              {calendarCells.map((cell, idx) => {
                const cellEvents = cell.date ? eventsForDate(cell.date) : [];
                const isToday    = cell.date === todayStr;
                const isSelected = cell.date === selectedDate;
                const isWeekend  = idx % 7 === 0 || idx % 7 === 6;
                const isNonWork  = cell.date && !isWorkingDay(cell.date, events);
                const dominated  = cellEvents[0] ? typeCfg(cellEvents[0].eventType) : null;

                return (
                  <div
                    key={idx}
                    className={[
                      'cal-day-cell',
                      !cell.thisMonth ? 'other-month' : '',
                      isToday       ? 'today'        : '',
                      isSelected    ? 'selected'     : '',
                      isWeekend     ? 'weekend'       : '',
                      isNonWork && cell.thisMonth ? 'non-working' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => cell.date && setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                    style={dominated && cell.thisMonth ? { '--day-accent': dominated.color } : {}}>

                    <div className="cal-day-num">
                      {isToday ? (
                        <span className="cal-today-dot">{cell.day}</span>
                      ) : cell.day}
                    </div>

                    {/* Event chips (max 3 visible) */}
                    <div className="cal-day-events">
                      {cellEvents.slice(0, 3).map((ev, i) => {
                        const cfg = typeCfg(ev.eventType);
                        return (
                          <div key={i} className="cal-event-chip"
                            style={{ background: cfg.bg, color: cfg.color, borderLeft: `3px solid ${cfg.color}` }}>
                            {ev.title.length > 14 ? ev.title.slice(0, 14) + '…' : ev.title}
                          </div>
                        );
                      })}
                      {cellEvents.length > 3 && (
                        <div className="cal-event-more">+{cellEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="cal-legend">
            {EVENT_TYPES.map(t => (
              <span key={t.value} className="cal-legend-item">
                <span className="cal-legend-dot" style={{ background: t.color }}/>
                {t.label}
              </span>
            ))}
            <span className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: '#e0e0e0', border: '1px solid #bbb' }}/>
              Non-Working
            </span>
          </div>
        </div>

        {/* ── Right Panel: Day Detail ── */}
        <div className={`cal-day-panel${selectedDate ? ' open' : ''}`}>
          {selectedDate ? (
            <>
              <div className="cal-day-panel-header">
                <div>
                  <div className="cal-day-panel-date">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                  </div>
                  <div className="cal-day-panel-status">
                    {isWorkingDay(selectedDate, events)
                      ? <span style={{ color:'#2e7d32', fontWeight:700, fontSize:11 }}>● Working Day</span>
                      : <span style={{ color:'#e53935', fontWeight:700, fontSize:11 }}>● Non-Working Day</span>
                    }
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="cal-btn cal-btn-outline" style={{ padding:'5px 12px', fontSize:12 }}
                    onClick={() => openDrawer(null, selectedDate, 'Note')}>
                    <PlusIcon/> Add Note
                  </button>
                  <button className="cal-btn cal-btn-primary" style={{ padding:'5px 12px', fontSize:12 }}
                    onClick={() => openDrawer(null, selectedDate)}>
                    <PlusIcon/> {isAdmin ? 'Add Event' : 'Add'}
                  </button>
                </div>
              </div>

              <div className="cal-day-events-list">
                {selectedEvents.length === 0 ? (
                  <div className="cal-empty-day">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                      <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
                    </svg>
                    <span>No events on this day</span>
                  </div>
                ) : (
                  selectedEvents.map(ev => {
                    const cfg = typeCfg(ev.eventType);
                    return (
                      <div key={ev.uid} className="cal-event-card"
                        style={{ borderLeft: `4px solid ${cfg.color}`, background: cfg.bg }}>
                        <div className="cal-event-card-top">
                          <span className="cal-event-type-chip" style={{ color: cfg.color, background: 'white', border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </span>
                          {canManageEv(ev) && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="cal-icon-btn" onClick={() => openDrawer(ev)} title="Edit"><EditIcon/></button>
                              <button className="cal-icon-btn danger" onClick={() => handleDelete(ev.uid, ev.title)} title="Delete"><TrashIcon/></button>
                            </div>
                          )}
                        </div>
                        <div className="cal-event-title" style={{ color: cfg.color }}>{ev.title}</div>
                        <div className="cal-event-dates">
                          {ev.startDate === ev.endDate
                            ? new Date(ev.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
                            : `${new Date(ev.startDate+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} — ${new Date(ev.endDate+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`
                          }
                          {ev.isRecurring && <span className="cal-recurring-badge">↻ Annual</span>}
                        </div>
                        {ev.department && (
                          <div className="cal-event-dept">{ev.department} Dept</div>
                        )}
                        {ev.notes && <div className="cal-event-notes">{ev.notes}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="cal-day-panel-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c8cce8" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
              <span>Click a day to see events</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Drawer ── */}
      {drawerMount && (
        <>
          <div className={`cal-overlay${drawerOpen ? ' open' : ''}`} onClick={closeDrawer}/>
          <aside className={`cal-drawer${drawerOpen ? ' open' : ''}`}>
            <div className="cal-drawer-header">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div className="cal-drawer-icon" style={{ background: typeCfg(form.eventType).bg, color: typeCfg(form.eventType).color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h2 className="cal-drawer-title">
                    {isEdit
                      ? (form.eventType === 'Note' ? 'Edit Note' : 'Edit Event')
                      : (form.eventType === 'Note' ? 'Add Note' : 'New Event')}
                  </h2>
                  <p className="cal-drawer-subtitle">Fill in the event details</p>
                </div>
              </div>
              <CloseBtn onClick={closeDrawer}/>
            </div>

            <form onSubmit={handleSave} className="cal-drawer-body">
              {/* Event Type */}
              <div className="cal-field">
                <label>Event Type</label>
                <div className="cal-type-grid">
                  {allowedEventTypes.map(t => (
                    <label key={t.value} className={`cal-type-radio${form.eventType === t.value ? ' selected' : ''}`}
                      style={form.eventType === t.value ? { background: t.bg, borderColor: t.border, color: t.color } : {}}>
                      <input type="radio" name="eventType" value={t.value}
                        checked={form.eventType === t.value}
                        onChange={e => sf('eventType', e.target.value)}/>
                      <span className="cal-type-radio-dot" style={{ background: t.color }}/>
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="cal-field">
                <label>Title <span style={{ color:'red' }}>*</span></label>
                <input className="cal-input" value={form.title}
                  onChange={e => sf('title', e.target.value)}
                  placeholder="e.g. Independence Day, John's Vacation…" required/>
              </div>

              {/* Dates */}
              <div className="cal-field-row">
                <div className="cal-field">
                  <label>Start Date <span style={{ color:'red' }}>*</span></label>
                  <input type="date" className="cal-input" value={form.startDate}
                    onChange={e => { sf('startDate', e.target.value); if (e.target.value > form.endDate) sf('endDate', e.target.value); }}
                    required/>
                </div>
                <div className="cal-field">
                  <label>End Date <span style={{ color:'red' }}>*</span></label>
                  <input type="date" className="cal-input" value={form.endDate}
                    min={form.startDate}
                    onChange={e => sf('endDate', e.target.value)} required/>
                </div>
              </div>

              {/* Scope: Global vs Personal — admins only */}
              {isAdmin && (
                <div className="cal-field">
                  <label>Scope</label>
                  <div style={{ display:'flex', gap:12, paddingTop:4 }}>
                    {[
                      { val: true,  label: 'Global (all users)', desc: 'Visible to everyone' },
                      { val: false, label: 'Personal (me only)', desc: 'Only visible to you' },
                    ].map(({ val, label, desc }) => (
                      <label key={String(val)} className={`cal-scope-radio${form.isGlobal === val ? ' selected' : ''}`}>
                        <input type="radio" checked={form.isGlobal === val}
                          onChange={() => sf('isGlobal', val)}/>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{label}</div>
                          <div style={{ fontSize:11, color:'#888' }}>{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Department filter — admins only */}
              {isAdmin && (
                <div className="cal-field">
                  <label>Department (optional)</label>
                  <div className="cal-select-wrap">
                    <select className="cal-input" value={form.department} onChange={e => sf('department', e.target.value)}>
                      <option value="">All departments</option>
                      <option value="AVP">AVP</option>
                      <option value="WGDE">WGDE</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Recurring */}
              <div className="cal-field">
                <label className="cal-checkbox-label">
                  <input type="checkbox" checked={!!form.isRecurring}
                    onChange={e => sf('isRecurring', e.target.checked)}/>
                  <span>Repeat annually (e.g. national holidays)</span>
                </label>
              </div>

              {/* Notes */}
              <div className="cal-field">
                <label>Notes</label>
                <textarea className="cal-input cal-textarea" value={form.notes}
                  onChange={e => sf('notes', e.target.value)}
                  placeholder="Optional notes or description…" rows={3}/>
              </div>

              <div className="cal-drawer-footer">
                <button type="button" className="cal-btn cal-btn-outline" onClick={closeDrawer} disabled={saving}>Cancel</button>
                {isEdit && (
                  <button type="button" className="cal-btn cal-btn-danger"
                    onClick={() => { closeDrawer(); handleDelete(form.uid, form.title); }}
                    disabled={saving}>
                    <TrashIcon/> Delete
                  </button>
                )}
                <button type="submit" className="cal-btn cal-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : isEdit ? 'Update Event' : 'Add Event'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
