import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  projectsApi, issueDocApi, checklistMasterApi,
  checklistMilestoneApi, dmrsApi,
  projectIssueLinkApi, partMilestoneApi,
} from '../../services/apiService';
import './HomeDashboard.css';

// ── palette ───────────────────────────────────────────────────────
const C = {
  blue:'#3f51b5', indigo:'#5c6bc0', green:'#27ae60', red:'#e74c3c',
  orange:'#e67e22', yellow:'#f39c12', purple:'#8e24aa', teal:'#00897b',
  cyan:'#0097a7', pink:'#e91e63', gray:'#78909c', lime:'#689f38',
};
const STATUS_CLR = { Open:C.orange, 'In Progress':C.blue, Closed:C.green, 'On Hold':C.gray };
const DEPT_CLR   = { AVP:'#1565c0', WGDE:'#6a1b9a', Common:C.teal };
const PALETTE    = Object.values(C);
const clr = i => PALETTE[i % PALETTE.length];

const groupCount = (arr, keyFn) => {
  const map = {};
  arr.forEach(x => { const k = keyFn(x); if (k) map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
};
const fmtShort = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const monthLbl  = (y, m) => new Date(y, m).toLocaleString('en-GB',{month:'short',year:'2-digit'});

// ── ISO-week helpers ──────────────────────────────────────────────
function isoWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
function getLastNWeeks(n) {
  const result = [], seen = new Set(), now = new Date();
  for (let i = 0; result.length < n && i <= n * 2; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i * 7);
    const key = isoWeekKey(d.toISOString());
    if (key && !seen.has(key)) {
      seen.add(key);
      const [yr, wn] = key.split('-W');
      result.push({ key, label: `W${wn}`, sub: `'${yr.slice(2)}` });
    }
  }
  return result.reverse();
}

// ── DonutChart ────────────────────────────────────────────────────
function DonutChart({ data, size = 160, thick = 28, cText, cSub }) {
  const R    = (size - thick) / 2;
  const cx   = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * R;
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#eef0f8" strokeWidth={thick}/>
      {total > 0 && data.map((d, i) => {
        const pct = d.value / total;
        const ang = acc * 360 - 90;
        acc += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={d.color} strokeWidth={thick - 5}
            strokeDasharray={`${pct * circ} ${circ}`}
            style={{ transform:`rotate(${ang}deg)`, transformOrigin:`${cx}px ${cy}px`, transition:'stroke-dasharray .6s ease' }}
          />
        );
      })}
      {cText !== undefined && <>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1a1a2e">{cText}</text>
        {cSub && <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#aaa" letterSpacing="0.3">{cSub}</text>}
      </>}
      {total === 0 && <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fill="#ccc">No data</text>}
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────
function Legend({ data }) {
  return (
    <div className="hd-legend">
      {data.map((d, i) => (
        <div key={i} className="hd-leg-row">
          <span className="hd-leg-dot" style={{ background: d.color }}/>
          <span className="hd-leg-lbl">{d.label}</span>
          <span className="hd-leg-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── HBar ──────────────────────────────────────────────────────────
function HBar({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  if (!data.length) return <div className="hd-empty">No data</div>;
  return (
    <div className="hd-hbar">
      {data.slice(0, 8).map((d, i) => (
        <div key={i} className="hd-hbar-row">
          <span className="hd-hbar-lbl" title={d.label}>{d.label}</span>
          <div className="hd-hbar-track">
            <div className="hd-hbar-fill" style={{ width:`${Math.max((d.value/max)*100,3)}%`, background:d.color||C.blue }}/>
          </div>
          <span className="hd-hbar-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── VBar ──────────────────────────────────────────────────────────
function VBar({ data, h = 120 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="hd-vbar-wrap">
      <div className="hd-vbar-bars" style={{ height: h }}>
        {data.map((d, i) => (
          <div key={i} className="hd-vbar-col">
            <span className="hd-vbar-num">{d.value > 0 ? d.value : ''}</span>
            <div className="hd-vbar-fill"
              style={{ height:`${Math.max((d.value/max)*100, d.value>0?3:0)}%`, background:d.color||C.blue }}
              title={`${d.label}: ${d.value}`}/>
            <span className="hd-vbar-lbl">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DualBar ───────────────────────────────────────────────────────
function DualBar({ months }) {
  const maxV = Math.max(...months.flatMap(m => [m.opened, m.closed]), 1);
  return (
    <div className="hd-dual">
      <div className="hd-dual-chart">
        {months.map((m, i) => (
          <div key={i} className="hd-dual-grp">
            <div className="hd-dual-pair">
              <div className="hd-dual-col">
                <span className="hd-dual-num">{m.opened || ''}</span>
                <div className="hd-dual-bar op" style={{ height:`${Math.max((m.opened/maxV)*100, m.opened>0?4:0)}%` }} title={`Opened: ${m.opened}`}/>
              </div>
              <div className="hd-dual-col">
                <span className="hd-dual-num">{m.closed || ''}</span>
                <div className="hd-dual-bar cl" style={{ height:`${Math.max((m.closed/maxV)*100, m.closed>0?4:0)}%` }} title={`Closed: ${m.closed}`}/>
              </div>
            </div>
            <span className="hd-dual-lbl">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="hd-dual-leg">
        <span className="hd-dl-dot op"/> <span>Opened</span>
        <span className="hd-dl-dot cl"/> <span>Closed</span>
      </div>
    </div>
  );
}

// ── SyncRow (stacked) ─────────────────────────────────────────────
function SyncRow({ label, ok, notOk, na, pending, total }) {
  return (
    <div className="hd-srow">
      <span className="hd-srow-lbl">{label}</span>
      <div className="hd-srow-track">
        {total > 0 ? <>
          {ok      > 0 && <div className="hd-seg" style={{ width:`${(ok/total)*100}%`,      background:'#27ae60' }} title={`OK: ${ok}`}/>}
          {notOk   > 0 && <div className="hd-seg" style={{ width:`${(notOk/total)*100}%`,   background:'#e74c3c' }} title={`Not OK: ${notOk}`}/>}
          {pending > 0 && <div className="hd-seg" style={{ width:`${(pending/total)*100}%`, background:'#e67e22' }} title={`Pending: ${pending}`}/>}
          {na      > 0 && <div className="hd-seg" style={{ width:`${(na/total)*100}%`,      background:'#d0d5e8' }} title={`N/A: ${na}`}/>}
        </> : <span className="hd-seg-none">No records</span>}
      </div>
      <div className="hd-srow-nums">
        <span style={{color:'#27ae60'}}>{ok}</span>
        <span style={{color:'#e74c3c'}}>{notOk}</span>
        <span style={{color:'#e67e22'}}>{pending}</span>
        <span style={{color:'#aaa'}}>{na}</span>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────
function Spark({ data, color = C.blue, w = 72, h = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const id = `sp${color.replace(/[^0-9a-f]/gi,'')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow:'visible'}}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".3"/>
          <stop offset="100%" stopColor={color} stopOpacity=".02"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Icons ─────────────────────────────────────────────────────────
const Ic = {
  Folder:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Alert:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Issues:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Check:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Clipboard: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
  Calendar:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Refresh:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>,
};

// ── Primitives ────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, spark, onClick }) => (
  <div className="hd-kpi" style={{ '--kc': color, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}
    title={onClick ? `Click to view ${label}` : undefined}>
    <div className="hd-kpi-l">
      <div className="hd-kpi-ico" style={{ background:`${color}1a`, color }}>{icon}</div>
      <div>
        <div className="hd-kpi-v">{value ?? '—'}</div>
        <div className="hd-kpi-lbl">{label}</div>
        {sub && <div className="hd-kpi-sub">{sub}</div>}
      </div>
    </div>
    {spark && <Spark data={spark} color={color}/>}
  </div>
);

const Card = ({ title, children, className = '' }) => (
  <div className={`hd-card ${className}`}>
    {title && <div className="hd-card-ttl">{title}</div>}
    {children}
  </div>
);

const SecHdr = ({ title, sub }) => (
  <div className="hd-sec">
    <h2 className="hd-sec-t">{title}</h2>
    {sub && <p className="hd-sec-s">{sub}</p>}
  </div>
);

const Divider = () => <div className="hd-div"/>;

// ── ProgramChart ──────────────────────────────────────────────────
function ProgramChart({ data }) {
  if (!data || !data.length) return <div className="hd-empty">No program data</div>;
  const maxAll = Math.max(...data.map(d => Math.max(d.issues.total, d.checklistCount, d.milestoneCount)), 1);
  return (
    <div className="hd-pchart">
      <div className="hd-pchart-leg">
        <span><span className="hd-pleg-dot" style={{background:STATUS_CLR.Open}}/> Open</span>
        <span><span className="hd-pleg-dot" style={{background:STATUS_CLR['In Progress']}}/> In Progress</span>
        <span><span className="hd-pleg-dot" style={{background:STATUS_CLR.Closed}}/> Closed</span>
        <span><span className="hd-pleg-dot" style={{background:STATUS_CLR['On Hold']}}/> On Hold</span>
        <span><span className="hd-pleg-dot" style={{background:C.purple}}/> Checklists</span>
        <span><span className="hd-pleg-dot" style={{background:C.teal}}/> Milestones</span>
      </div>
      <div className="hd-pchart-hdrs">
        <span/>
        <span className="hd-pchart-bar-hdr">Issues</span>
        <span className="hd-pchart-bar-hdr">Checklists</span>
        <span className="hd-pchart-bar-hdr">Milestones</span>
      </div>
      {data.map((row, i) => (
        <div key={i} className="hd-pchart-row">
          <span className="hd-pchart-prog" title={row.program}>{row.program}</span>

          <div className="hd-pchart-bar-wrap">
            <div className="hd-pchart-track">
              {row.issues.total > 0 ? <>
                {row.issues.open       > 0 && <div className="hd-pchart-seg" style={{width:`${(row.issues.open/maxAll)*100}%`,       background:STATUS_CLR.Open}}           title={`Open: ${row.issues.open}`}/>}
                {row.issues.inProgress > 0 && <div className="hd-pchart-seg" style={{width:`${(row.issues.inProgress/maxAll)*100}%`, background:STATUS_CLR['In Progress']}} title={`In Progress: ${row.issues.inProgress}`}/>}
                {row.issues.closed     > 0 && <div className="hd-pchart-seg" style={{width:`${(row.issues.closed/maxAll)*100}%`,     background:STATUS_CLR.Closed}}         title={`Closed: ${row.issues.closed}`}/>}
                {row.issues.onHold     > 0 && <div className="hd-pchart-seg" style={{width:`${(row.issues.onHold/maxAll)*100}%`,     background:STATUS_CLR['On Hold']}}     title={`On Hold: ${row.issues.onHold}`}/>}
              </> : <div className="hd-pchart-seg" style={{width:'3%', background:'#eef0f8'}}/>}
            </div>
            <span className="hd-pchart-count">{row.issues.total}</span>
          </div>

          <div className="hd-pchart-bar-wrap">
            <div className="hd-pchart-track">
              <div className="hd-pchart-seg"
                style={{width:row.checklistCount>0?`${(row.checklistCount/maxAll)*100}%`:'3%', background:row.checklistCount>0?C.purple:'#eef0f8'}}
                title={`Checklists: ${row.checklistCount}`}/>
            </div>
            <span className="hd-pchart-count">{row.checklistCount}</span>
          </div>

          <div className="hd-pchart-bar-wrap">
            <div className="hd-pchart-track">
              <div className="hd-pchart-seg"
                style={{width:row.milestoneCount>0?`${(row.milestoneCount/maxAll)*100}%`:'3%', background:row.milestoneCount>0?C.teal:'#eef0f8'}}
                title={`Milestones: ${row.milestoneCount}`}/>
            </div>
            <span className="hd-pchart-count">{row.milestoneCount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hierarchical Heatmap ─────────────────────────────────────────
const HM_CFG = {
  critical: { bg:'#e74c3c', fg:'#fff',    legend:'Critical (Overdue)' },
  open:     { bg:'#e67e22', fg:'#fff',    legend:'Open'               },
  progress: { bg:'#3f51b5', fg:'#fff',    legend:'In Progress'        },
  closed:   { bg:'#27ae60', fg:'#fff',    legend:'Closed'             },
  none:     { bg:'#eef0f8', fg:'#c8cbda', legend:'No Issues'          },
};

function getCell(issueNums, weekKey, issueByNum, issueWeekMap, today) {
  const matched = issueNums.filter(n => issueWeekMap[n] === weekKey);
  if (!matched.length) return { type:'none', count:0, tip:'No issues this week' };
  const list     = matched.flatMap(n => issueByNum[n] || []);
  const overdue  = list.filter(i =>
    (i.status==='Open'||i.status==='In Progress') &&
    i.req_Completion_Date && new Date(i.req_Completion_Date) < today
  ).length;
  const open     = list.filter(i => i.status==='Open').length;
  const progress = list.filter(i => i.status==='In Progress').length;
  const closed   = list.filter(i => i.status==='Closed').length;
  const type     = overdue>0?'critical':open>0?'open':progress>0?'progress':'closed';
  return {
    type, count:list.length, open, progress, closed, overdue,
    tip:`${list.length} issue(s)  Open:${open}  InProg:${progress}  Closed:${closed}${overdue?`  ⚠ Overdue:${overdue}`:''}`,
  };
}

function HierarchicalHeatmap({ hierarchy, issueByNum, issueWeekMap }) {
  const [expandedProgs,  setExpandedProgs]  = useState(new Set());
  const [expandedPlants, setExpandedPlants] = useState(new Set());
  const [wkCount,        setWkCount]        = useState(12);
  const [filterProg,     setFilterProg]     = useState('');
  const [filterPlant,    setFilterPlant]    = useState('');

  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(() => getLastNWeeks(wkCount), [wkCount]);

  const allPrograms = useMemo(() => hierarchy.map(p => p.program), [hierarchy]);
  const allPlants   = useMemo(() =>
    [...new Set(hierarchy.flatMap(p => p.plants.map(pl => pl.plant)))],
    [hierarchy]);

  const visRows = useMemo(() => {
    let rows = hierarchy;
    if (filterProg)  rows = rows.filter(p => p.program === filterProg);
    if (filterPlant) rows = rows
      .map(p => ({ ...p, plants: p.plants.filter(pl => pl.plant === filterPlant) }))
      .filter(p => p.plants.length > 0);
    return rows;
  }, [hierarchy, filterProg, filterPlant]);

  const toggleProg  = p => setExpandedProgs( s => { const n=new Set(s); n.has(p)?n.delete(p):n.add(p); return n; });
  const togglePlant = k => setExpandedPlants(s => { const n=new Set(s); n.has(k)?n.delete(k):n.add(k); return n; });

  const cellMap = useMemo(() => {
    const map = {};
    const store = (key, nums) =>
      weeks.forEach(w => { map[`${key}:::${w.key}`] = getCell(nums, w.key, issueByNum, issueWeekMap, today); });
    hierarchy.forEach(prog => {
      const pNums = prog.plants.flatMap(pl => pl.parts.flatMap(pt => pt.issueNumbers));
      store(`P:${prog.program}`, pNums);
      prog.plants.forEach(pl => {
        const plNums = pl.parts.flatMap(pt => pt.issueNumbers);
        store(`L:${prog.program}:${pl.plant}`, plNums);
        pl.parts.forEach(pt => store(`T:${prog.program}:${pl.plant}:${pt.part}`, pt.issueNumbers));
      });
    });
    return map;
  }, [hierarchy, weeks, issueByNum, issueWeekMap, today]);

  const trendData = useMemo(() => weeks.map(wk => {
    let open=0, closed=0;
    Object.values(issueByNum).forEach(arr =>
      arr.filter(i => isoWeekKey(i.date_Opened) === wk.key).forEach(i => {
        if (i.status==='Closed') closed++; else open++;
      })
    );
    return { ...wk, open, closed };
  }), [weeks, issueByNum]);

  const maxTrend = Math.max(...trendData.flatMap(d => [d.open, d.closed]), 1);

  const kpis = useMemo(() => {
    const allNums   = [...new Set(hierarchy.flatMap(p => p.plants.flatMap(pl => pl.parts.flatMap(pt => pt.issueNumbers))))];
    const allIssues = allNums.flatMap(n => issueByNum[n] || []);
    const overdue   = allIssues.filter(i =>
      (i.status==='Open'||i.status==='In Progress') &&
      i.req_Completion_Date && new Date(i.req_Completion_Date) < today
    ).length;
    const closed    = allIssues.filter(i => i.status==='Closed').length;
    return {
      programs: hierarchy.length,
      parts:    hierarchy.flatMap(p => p.plants.flatMap(pl => pl.parts)).length,
      overdue,
      greenPct: allIssues.length > 0 ? Math.round((closed / allIssues.length) * 100) : 0,
    };
  }, [hierarchy, issueByNum, today]);

  const TW=268, TH=78, TP=10;
  const tLine = (key, color) => {
    if (trendData.length < 2) return null;
    const pts = trendData.map((d, i) => {
      const x = (TP + (i / (trendData.length - 1)) * (TW - TP * 2)).toFixed(1);
      const y = (TH - TP - (d[key] / maxTrend) * (TH - TP * 2)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');
    return <polyline key={key} points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>;
  };

  // Build table rows as a flat array to avoid keyed-fragment issues
  const rows = [];
  visRows.forEach(prog => {
    const progExp = expandedProgs.has(prog.program);
    rows.push(
      <tr key={`P:${prog.program}`} className="hm-tr hm-tr-prog" onClick={() => toggleProg(prog.program)}>
        <td className="hm-td-lbl hm-lbl-prog">
          <span className="hm-arrow">{progExp ? '▾' : '▸'}</span>
          <span className="hm-badge-p">P</span>
          <span className="hm-name" title={prog.program}>{prog.program}</span>
          <span className="hm-cnt">{prog.plants.length} plant{prog.plants.length!==1?'s':''}</span>
        </td>
        {weeks.map(w => {
          const ci = cellMap[`P:${prog.program}:::${w.key}`] || { type:'none', count:0, tip:'' };
          const cfg = HM_CFG[ci.type];
          return (
            <td key={w.key} className="hm-td-cell" title={ci.tip}>
              <div className="hm-cell" style={{ background:cfg.bg, color:cfg.fg }}>{ci.count||''}</div>
            </td>
          );
        })}
      </tr>
    );
    if (!progExp) return;
    prog.plants.forEach(pl => {
      const pk       = `${prog.program}|||${pl.plant}`;
      const plantExp = expandedPlants.has(pk);
      rows.push(
        <tr key={`L:${pk}`} className="hm-tr hm-tr-plant" onClick={() => togglePlant(pk)}>
          <td className="hm-td-lbl hm-lbl-plant">
            <span className="hm-arrow">{plantExp ? '▾' : '▸'}</span>
            <span className="hm-badge-l">L</span>
            <span className="hm-name" title={pl.plant}>{pl.plant}</span>
            <span className="hm-cnt">{pl.parts.length} part{pl.parts.length!==1?'s':''}</span>
          </td>
          {weeks.map(w => {
            const ci = cellMap[`L:${prog.program}:${pl.plant}:::${w.key}`] || { type:'none', count:0, tip:'' };
            const cfg = HM_CFG[ci.type];
            return (
              <td key={w.key} className="hm-td-cell" title={ci.tip}>
                <div className="hm-cell" style={{ background:cfg.bg, color:cfg.fg }}>{ci.count||''}</div>
              </td>
            );
          })}
        </tr>
      );
      if (!plantExp) return;
      pl.parts.slice(0, 15).forEach(pt => {
        rows.push(
          <tr key={`T:${pk}:${pt.part}`} className="hm-tr hm-tr-part">
            <td className="hm-td-lbl hm-lbl-part">
              <span className="hm-dot-p">◦</span>
              <span className="hm-name" title={pt.part}>{pt.part}</span>
              <span className="hm-cnt-sm">{pt.issueNumbers.length}</span>
            </td>
            {weeks.map(w => {
              const ci = cellMap[`T:${prog.program}:${pl.plant}:${pt.part}:::${w.key}`] || { type:'none', count:0, tip:'' };
              const cfg = HM_CFG[ci.type];
              return (
                <td key={w.key} className="hm-td-cell" title={ci.tip}>
                  <div className="hm-cell" style={{ background:cfg.bg, color:cfg.fg }}>{ci.count||''}</div>
                </td>
              );
            })}
          </tr>
        );
      });
    });
  });

  return (
    <div className="hm-root">
      {/* ── Section KPIs ── */}
      <div className="hm-kpi-row">
        {[
          { label:'Programs',     value:kpis.programs,       color:C.blue   },
          { label:'Tracked Parts',value:kpis.parts,          color:C.purple },
          { label:'Overdue',      value:kpis.overdue,        color:C.red    },
          { label:'Resolution',   value:`${kpis.greenPct}%`, color:C.green  },
        ].map(k => (
          <div key={k.label} className="hm-kpi" style={{'--hmkc':k.color}}>
            <div className="hm-kpi-v">{k.value}</div>
            <div className="hm-kpi-l">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="hm-filters">
        <select className="hm-sel" value={filterProg} onChange={e => setFilterProg(e.target.value)}>
          <option value="">All Programs</option>
          {allPrograms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="hm-sel" value={filterPlant} onChange={e => setFilterPlant(e.target.value)}>
          <option value="">All Plants</option>
          {allPlants.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="hm-wk-grp">
          {[8, 12, 26].map(n => (
            <button key={n} className={`hm-wk-btn${wkCount===n?' hm-wk-on':''}`} onClick={() => setWkCount(n)}>{n}W</button>
          ))}
        </div>
        <span className="hm-hint">Click rows to expand · Hover cells for details</span>
      </div>

      {/* ── Body: heatmap + side panel ── */}
      <div className="hm-body">
        {/* Scrollable heatmap table */}
        <div className="hm-scroll">
          <table className="hm-tbl">
            <thead>
              <tr>
                <th className="hm-th-lbl">Hierarchy</th>
                {weeks.map(w => (
                  <th key={w.key} className="hm-th-wk">
                    {w.label}<span className="hm-th-sub">{w.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={weeks.length + 1} className="hd-empty">
                    No hierarchy data — link projects to issues via Project Issue Links to populate this view.
                  </td>
                </tr>
              )}
              {rows}
            </tbody>
          </table>
        </div>

        {/* Side panel: trend chart + legend */}
        <div className="hm-side">
          <div className="hm-side-ttl">Weekly Issue Trend</div>
          <svg width={TW} height={TH} viewBox={`0 0 ${TW} ${TH}`} className="hm-svg" style={{overflow:'visible'}}>
            {[0.25, 0.5, 0.75, 1].map(f => {
              const y = (TH - TP - (TH - TP*2)*f).toFixed(1);
              return <line key={f} x1={TP} x2={TW-TP} y1={y} y2={y} stroke="#eef0f8" strokeWidth="1"/>;
            })}
            {tLine('open',   C.orange)}
            {tLine('closed', C.green)}
            {trendData.map((d, i) => {
              const x  = (TP + (i/(trendData.length-1||1))*(TW-TP*2)).toFixed(1);
              const yo = (TH-TP-(d.open  /maxTrend)*(TH-TP*2)).toFixed(1);
              const yc = (TH-TP-(d.closed/maxTrend)*(TH-TP*2)).toFixed(1);
              return [
                <circle key={`o${i}`} cx={x} cy={yo} r="3" fill={C.orange} title={`${d.label}: ${d.open} opened`}/>,
                <circle key={`c${i}`} cx={x} cy={yc} r="3" fill={C.green}  title={`${d.label}: ${d.closed} closed`}/>,
              ];
            })}
          </svg>
          <div className="hm-tleg">
            <span><span className="hm-tld" style={{background:C.orange}}/>Opened</span>
            <span><span className="hm-tld" style={{background:C.green}}/>Closed</span>
          </div>
          <div className="hm-legend-ttl">Cell Status</div>
          {Object.entries(HM_CFG).map(([k, v]) => (
            <div key={k} className="hm-leg">
              <span className="hm-leg-dot" style={{background:v.bg, outline:k==='none'?'1px solid #d0d5e8':'none'}}/>
              <span className="hm-leg-lbl">{v.legend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function HomeDashboard() {
  const navigate = useNavigate();
  const [projects,          setProjects]          = useState([]);
  const [issues,            setIssues]            = useState([]);
  const [checklists,        setChecklists]        = useState([]);
  const [milestones,        setMilestones]        = useState([]);
  const [dmrs,              setDmrs]              = useState([]);
  const [projectIssueLinks, setProjectIssueLinks] = useState([]);
  const [partMilestones,    setPartMilestones]    = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [refreshAt,         setRefreshAt]         = useState(null);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      projectsApi.getAll(), issueDocApi.getAll(),
      checklistMasterApi.getAll(), checklistMilestoneApi.getAll(), dmrsApi.getAll(),
      projectIssueLinkApi.getAll(), partMilestoneApi.getAll(),
    ]).then(([p,i,c,m,d,pil,pm]) => {
      if (p.status==='fulfilled')   setProjects(p.value??[]);
      if (i.status==='fulfilled')   setIssues(i.value??[]);
      if (c.status==='fulfilled')   setChecklists(c.value??[]);
      if (m.status==='fulfilled')   setMilestones(m.value??[]);
      if (d.status==='fulfilled')   setDmrs(d.value??[]);
      if (pil.status==='fulfilled') setProjectIssueLinks(pil.value??[]);
      if (pm.status==='fulfilled')  setPartMilestones(pm.value??[]);
      setRefreshAt(new Date());
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // ── KPI numbers ───────────────────────────────────────────────
  const activeProj  = useMemo(() => projects.filter(p => p.status?.toLowerCase()==='active').length, [projects]);
  const openIss     = useMemo(() => issues.filter(i => i.status==='Open').length, [issues]);
  const closedIss   = useMemo(() => issues.filter(i => i.status==='Closed').length, [issues]);
  const inProgIss   = useMemo(() => issues.filter(i => i.status==='In Progress').length, [issues]);
  const onHoldIss   = useMemo(() => issues.filter(i => i.status==='On Hold').length, [issues]);
  const overdueIss  = useMemo(() => issues.filter(i => {
    if (i.status==='Closed'||!i.req_Completion_Date) return false;
    return new Date(i.req_Completion_Date) < new Date();
  }).length, [issues]);
  const dmrsIssues  = useMemo(() => new Set(dmrs.map(d=>d.issue_number).filter(Boolean)).size, [dmrs]);
  const today = new Date();
  const activeMss   = useMemo(() => milestones.filter(m => {
    if (!m.milestone) return false;
    const s=new Date(m.milestone), e=new Date(s);
    e.setDate(e.getDate()+(m.noofDays||30));
    return today>=s && today<=e;
  }).length, [milestones]);

  // ── chart data ────────────────────────────────────────────────
  const issueStatusData = useMemo(() => [
    {label:'Open',        value:openIss,   color:STATUS_CLR.Open},
    {label:'In Progress', value:inProgIss, color:STATUS_CLR['In Progress']},
    {label:'Closed',      value:closedIss, color:STATUS_CLR.Closed},
    {label:'On Hold',     value:onHoldIss, color:STATUS_CLR['On Hold']},
  ].filter(d=>d.value>0), [openIss,inProgIss,closedIss,onHoldIss]);

  const projStatusData  = useMemo(() => [
    {label:'Active',   value:activeProj,                   color:C.blue},
    {label:'Inactive', value:projects.length-activeProj,   color:C.gray},
  ].filter(d=>d.value>0), [projects,activeProj]);

  const projByPlant   = useMemo(() => groupCount(projects, p=>p.plant  ).slice(0,8).map(([l,v],i)=>({label:l,value:v,color:clr(i)})),   [projects]);
  const projByProgram = useMemo(() => groupCount(projects, p=>p.program).slice(0,8).map(([l,v],i)=>({label:l,value:v,color:clr(i+2)})), [projects]);
  const projByZone    = useMemo(() => groupCount(projects, p=>p.zone   ).slice(0,8).map(([l,v],i)=>({label:l,value:v,color:clr(i+4)})), [projects]);

  const chkByDept = useMemo(() => groupCount(checklists, c=>c.department||'Unknown')
    .map(([l,v])=>({label:l,value:v,color:DEPT_CLR[l]||C.orange})), [checklists]);

  const msByDept  = useMemo(() => groupCount(milestones, m=>m.department||'Unknown')
    .map(([l,v])=>({label:l,value:v,color:DEPT_CLR[l]||C.lime})), [milestones]);

  const msByStatus = useMemo(() => {
    const future = milestones.filter(m=>m.milestone&&new Date(m.milestone)>today).length;
    const past   = milestones.filter(m=>m.milestone&&new Date(m.milestone)<today).length;
    return [
      {label:'Active',   value:activeMss, color:C.green},
      {label:'Upcoming', value:future,    color:C.blue},
      {label:'Past',     value:past,      color:C.gray},
    ].filter(d=>d.value>0);
  }, [milestones,activeMss]);

  const dmrsByIssue = useMemo(() => {
    const map={};
    dmrs.forEach(d=>{ if(d.issue_number) map[d.issue_number]=(map[d.issue_number]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([l,v],i)=>({label:l,value:v,color:clr(i+6)}));
  }, [dmrs]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({length:6},(_,i)=>{
      const d=new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return {year:d.getFullYear(),month:d.getMonth(),opened:0,closed:0,label:monthLbl(d.getFullYear(),d.getMonth())};
    });
    issues.forEach(iss => {
      const op=iss.date_Opened?new Date(iss.date_Opened):null;
      const cl=iss.date_Closed?new Date(iss.date_Closed):null;
      months.forEach(m=>{
        if(op&&op.getFullYear()===m.year&&op.getMonth()===m.month) m.opened++;
        if(cl&&cl.getFullYear()===m.year&&cl.getMonth()===m.month) m.closed++;
      });
    });
    return months;
  }, [issues]);
  const sparkOpened = monthlyTrend.map(m=>m.opened);

  const SYNC_KEYS = ['sync1','sync2','sync3','sync4','sync5','postSync5'];
  const SYNC_LBL  = {sync1:'Sync 1',sync2:'Sync 2',sync3:'Sync 3',sync4:'Sync 4',sync5:'Sync 5',postSync5:'Post S5'};
  const syncSummary = useMemo(() => SYNC_KEYS.map(k => {
    const ok=dmrs.filter(d=>d[k]==='OK').length;
    const notOk=dmrs.filter(d=>d[k]==='Not OK').length;
    const na=dmrs.filter(d=>d[k]==='N/A').length;
    const pending=dmrs.filter(d=>d[k]==='Pending').length;
    return {key:k,label:SYNC_LBL[k],ok,notOk,na,pending,total:ok+notOk+na+pending};
  }), [dmrs]);

  const syncCompletion = useMemo(() => syncSummary.map(s=>({
    label:s.label,
    value:s.total>0?Math.round((s.ok/s.total)*100):0,
    color:C.green,
  })), [syncSummary]);

  const recentIssues = useMemo(() =>
    [...issues].filter(i=>i.date_Opened)
      .sort((a,b)=>new Date(b.date_Opened)-new Date(a.date_Opened)).slice(0,6),
    [issues]);

  const topProjects = useMemo(() =>
    [...projects].sort((a,b)=>(b.no_of_issues||0)-(a.no_of_issues||0)).slice(0,6),
    [projects]);

  // ── program summary (for Program Overview chart) ──────────
  const programSummary = useMemo(() => {
    const programs = [...new Set(projects.map(p => p.program).filter(Boolean))];
    return programs.map(prog => {
      const progProjects = projects.filter(p => p.program === prog);
      const projUids     = new Set(progProjects.map(p => p.uid));
      const progLinks    = projectIssueLinks.filter(l => l.program === prog);
      const issueNums    = new Set(progLinks.map(l => l.issue_number).filter(Boolean));
      const progIssues   = issues.filter(i => issueNums.has(i.issue_number));
      return {
        program: prog,
        issues: {
          open:       progIssues.filter(i => i.status === 'Open').length,
          inProgress: progIssues.filter(i => i.status === 'In Progress').length,
          closed:     progIssues.filter(i => i.status === 'Closed').length,
          onHold:     progIssues.filter(i => i.status === 'On Hold').length,
          total:      progIssues.length,
        },
        checklistCount: 0,
        milestoneCount: partMilestones.filter(m => projUids.has(m.projectUid)).length,
      };
    }).sort((a, b) => b.issues.total - a.issues.total);
  }, [projects, issues, projectIssueLinks, partMilestones]);

  // ── heatmap data ──────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const issueByNum   = {};
    const issueWeekMap = {};
    issues.forEach(i => {
      if (!i.issue_number) return;
      if (!issueByNum[i.issue_number]) issueByNum[i.issue_number] = [];
      issueByNum[i.issue_number].push(i);
      issueWeekMap[i.issue_number] = isoWeekKey(i.date_Opened);
    });
    const progMap = {};
    projectIssueLinks.forEach(lnk => {
      const prog  = lnk.program    || 'Unknown Program';
      const plant = lnk.plant      || 'Unknown Plant';
      const part  = lnk.partNumber || 'Unknown Part';
      if (!progMap[prog])             progMap[prog]              = {};
      if (!progMap[prog][plant])      progMap[prog][plant]       = {};
      if (!progMap[prog][plant][part])progMap[prog][plant][part] = new Set();
      if (lnk.issue_number) progMap[prog][plant][part].add(lnk.issue_number);
    });
    const hierarchy = Object.entries(progMap).map(([program, plantMap]) => ({
      program,
      plants: Object.entries(plantMap).map(([plant, partMap]) => ({
        plant,
        parts: Object.entries(partMap)
          .map(([part, nums]) => ({ part, issueNumbers: [...nums] }))
          .sort((a, b) => b.issueNumbers.length - a.issueNumbers.length),
      })).sort((a, b) =>
        b.parts.reduce((s,p)=>s+p.issueNumbers.length,0) -
        a.parts.reduce((s,p)=>s+p.issueNumbers.length,0)
      ),
    })).sort((a, b) =>
      b.plants.flatMap(pl=>pl.parts).reduce((s,p)=>s+p.issueNumbers.length,0) -
      a.plants.flatMap(pl=>pl.parts).reduce((s,p)=>s+p.issueNumbers.length,0)
    );
    return { hierarchy, issueByNum, issueWeekMap };
  }, [issues, projectIssueLinks]);

  // ── render ────────────────────────────────────────────────────
  if (loading) return (
    <div className="hd-load">
      <div className="hd-spinner"/>
      <span>Loading dashboard…</span>
    </div>
  );

  const fmtTime = refreshAt ? refreshAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—';

  return (
    <div className="hd-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="hd-page-hdr">
        <div>
          <h1 className="hd-page-title">Analytics Dashboard</h1>
          <p className="hd-page-sub">Projects · Issues · Checklists · DMRS Sign-off</p>
        </div>
        <div className="hd-hdr-r">
          <span className="hd-updated">Updated {fmtTime}</span>
          <button className="hd-refresh-btn" onClick={load}><Ic.Refresh/> Refresh</button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <div className="hd-kpi-grid">
        <KpiCard icon={<Ic.Folder/>}    label="Total Projects"    value={projects.length}   sub={`${activeProj} active · ${projects.length-activeProj} inactive`} color={C.blue}   spark={null}         onClick={()=>navigate('/dashboard/projects')}/>
        <KpiCard icon={<Ic.Alert/>}     label="Open Issues"       value={openIss}           sub={overdueIss>0?`⚠ ${overdueIss} overdue`:'No overdue'}             color={C.orange} spark={sparkOpened}  onClick={()=>navigate('/dashboard/issues')}/>
        <KpiCard icon={<Ic.Issues/>}    label="Total Issues"      value={issues.length}     sub={`${closedIss} closed · ${inProgIss} in progress`}                color={C.green}  spark={null}         onClick={()=>navigate('/dashboard/issues')}/>
        <KpiCard icon={<Ic.Check/>}     label="Checklist Items"   value={checklists.length} sub={`${chkByDept.length} dept${chkByDept.length!==1?'s':''}`}         color={C.purple} spark={null}         onClick={()=>navigate('/dashboard/checklists')}/>
        <KpiCard icon={<Ic.Clipboard/>} label="DMRS Records"      value={dmrs.length}       sub={`${dmrsIssues} distinct issue${dmrsIssues!==1?'s':''}`}          color={C.teal}   spark={null}         onClick={()=>navigate('/dashboard/dmrs')}/>
        <KpiCard icon={<Ic.Calendar/>}  label="Active Milestones" value={activeMss}         sub={`of ${milestones.length} total`}                                 color={C.cyan}   spark={null}         onClick={()=>navigate('/dashboard/milestones')}/>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION — Program Overview
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Program Overview" sub="Issues · Checklists · Milestones per program"/>
      <Card title="Program Summary">
        <ProgramChart data={programSummary}/>
      </Card>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 — Issue & Project Overview
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Issue &amp; Project Overview" sub="Status breakdown and 6-month activity trend"/>
      <div className="hd-g3">

        <Card title="Issues by Status">
          <div className="hd-donut-center">
            <DonutChart data={issueStatusData} size={164} thick={30} cText={issues.length} cSub="Total Issues"/>
          </div>
          <Divider/>
          <Legend data={issueStatusData}/>
        </Card>

        <Card title="Opened vs Closed — Last 6 Months">
          <DualBar months={monthlyTrend}/>
        </Card>

        <Card title="Projects by Status">
          <div className="hd-donut-center">
            <DonutChart data={projStatusData} size={164} thick={30} cText={projects.length} cSub="Total Projects"/>
          </div>
          <Divider/>
          <Legend data={projStatusData}/>
        </Card>

      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 — Project Breakdown (Donut charts per dimension)
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Project Breakdown" sub="Distribution by plant, program and zone"/>
      <div className="hd-g3">
        <Card title="By Plant">
          <div className="hd-donut-center">
            <DonutChart data={projByPlant.slice(0,6)} size={148} thick={24} cText={projByPlant.length} cSub="Plants"/>
          </div>
          <Divider/>
          <Legend data={projByPlant.slice(0,5)}/>
        </Card>
        <Card title="By Program">
          <div className="hd-donut-center">
            <DonutChart data={projByProgram.slice(0,6)} size={148} thick={24} cText={projByProgram.length} cSub="Programs"/>
          </div>
          <Divider/>
          <Legend data={projByProgram.slice(0,5)}/>
        </Card>
        <Card title="By Zone">
          <div className="hd-donut-center">
            <DonutChart data={projByZone.slice(0,6)} size={148} thick={24} cText={projByZone.length} cSub="Zones"/>
          </div>
          <Divider/>
          <Legend data={projByZone.slice(0,5)}/>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 — Checklists & Milestones
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Checklists &amp; Milestones" sub="Department distribution and milestone status"/>
      <div className="hd-g3">
        <Card title="Checklist Items by Department">
          <div className="hd-donut-center">
            <DonutChart data={chkByDept} size={148} thick={26} cText={checklists.length} cSub="Items"/>
          </div>
          <Divider/>
          <Legend data={chkByDept}/>
        </Card>

        <Card title="Milestones by Department">
          <div className="hd-donut-center">
            <DonutChart data={msByDept} size={148} thick={26} cText={milestones.length} cSub="Milestones"/>
          </div>
          <Divider/>
          <Legend data={msByDept}/>
        </Card>

        <Card title="Milestone Status">
          <div className="hd-donut-center">
            <DonutChart data={msByStatus} size={148} thick={26} cText={milestones.length} cSub="Total"/>
          </div>
          <Divider/>
          <div className="hd-ms-tiles">
            {[{label:'Active',v:activeMss,c:C.green},{label:'Upcoming',v:msByStatus.find(d=>d.label==='Upcoming')?.value||0,c:C.blue},{label:'Past',v:msByStatus.find(d=>d.label==='Past')?.value||0,c:C.gray}].map(t=>(
              <div key={t.label} className="hd-ms-tile" style={{'--mc':t.c}}>
                <span className="hd-ms-n">{t.v}</span>
                <span className="hd-ms-l">{t.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 4 — DMRS Sign-off — VBar + Donut (no HBars)
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="DMRS Sign-off Progress" sub="Sync stage completion across all checklist records"/>
      <div className="hd-g2">
        <Card title="OK Completion % per Sync Stage">
          <VBar data={syncCompletion} h={150}/>
        </Card>
        <Card title="Stage-wise Status Breakdown">
          <div className="hd-sleg">
            <span><span className="hd-sdot" style={{background:'#27ae60'}}/> OK</span>
            <span><span className="hd-sdot" style={{background:'#e74c3c'}}/> Not OK</span>
            <span><span className="hd-sdot" style={{background:'#e67e22'}}/> Pending</span>
            <span><span className="hd-sdot" style={{background:'#d0d5e8'}}/> N/A</span>
          </div>
          <div className="hd-schart">
            {syncSummary.map(s=>(
              <SyncRow key={s.key} label={s.label} ok={s.ok} notOk={s.notOk} na={s.na} pending={s.pending} total={s.total}/>
            ))}
          </div>
          <div className="hd-stotals">
            {syncSummary.map(s=>(
              <div key={s.key} className="hd-stotal">
                <span className="hd-st-l">{s.label}</span>
                <span className="hd-st-v">{s.total} rec</span>
                <span className="hd-st-p" style={{color:s.total>0&&s.ok/s.total>0.7?C.green:s.total>0&&s.ok/s.total>0.4?C.orange:C.red}}>
                  {s.total>0?Math.round((s.ok/s.total)*100):0}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 5 — Recent Activity + Top Projects
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Recent Activity &amp; Top Projects" sub="Latest issues and most active projects"/>
      <div className="hd-g21">
        <Card title="Recent Issues">
          <table className="hd-tbl">
            <thead><tr><th>Issue #</th><th>Title</th><th>Owner</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>
              {!recentIssues.length && <tr><td colSpan={5} className="hd-empty">No issues found</td></tr>}
              {recentIssues.map(iss=>(
                <tr key={iss.uid}>
                  <td><span className="hd-tag-i">{iss.issue_number||'—'}</span></td>
                  <td className="hd-td-main" title={iss.issue_title}>{iss.issue_title||'—'}</td>
                  <td className="hd-td-sub">{iss.owner||'—'}</td>
                  <td><span className="hd-sbadge" style={{background:(STATUS_CLR[iss.status]||'#888')+'18',color:STATUS_CLR[iss.status]||'#888'}}>{iss.status||'—'}</span></td>
                  <td className="hd-td-date">{fmtShort(iss.date_Opened)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Top Projects by Issue Count">
          {!topProjects.length && <div className="hd-empty">No data</div>}
          <div className="hd-toplist">
            {topProjects.map((p,i)=>{
              const pct = (p.no_of_issues||0) / (topProjects[0]?.no_of_issues||1) * 100;
              return (
                <div key={p.uid} className="hd-top-row">
                  <span className="hd-rank">{i+1}</span>
                  <div className="hd-top-info">
                    <div className="hd-top-name" title={p.projectName}>{p.projectName||'—'}</div>
                    <div className="hd-top-meta">{p.plant||'—'} · {p.program||'—'}</div>
                    <div className="hd-top-track"><div className="hd-top-fill" style={{width:`${pct}%`,background:C.blue}}/></div>
                  </div>
                  <span className="hd-top-cnt">{p.no_of_issues||0}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 6 — Issue Resolution Summary (full width)
      ══════════════════════════════════════════════════════════ */}
      <SecHdr title="Issue Resolution Summary" sub="Status distribution with resolution rate"/>
      <Card title="">
        <div className="hd-prog-row">
          {[
            {label:'Open',       v:openIss,   c:STATUS_CLR.Open},
            {label:'In Progress',v:inProgIss, c:STATUS_CLR['In Progress']},
            {label:'On Hold',    v:onHoldIss, c:STATUS_CLR['On Hold']},
            {label:'Closed',     v:closedIss, c:STATUS_CLR.Closed},
          ].map(s=>(
            <div key={s.label} className="hd-prog-col" style={{'--pc':s.c}}>
              <div className="hd-prog-num">{s.v}</div>
              <div className="hd-prog-lbl">{s.label}</div>
              <div className="hd-prog-pct">{issues.length>0?Math.round((s.v/issues.length)*100):0}%</div>
              <div className="hd-prog-bar">
                <div className="hd-prog-fill" style={{width:issues.length>0?`${(s.v/issues.length)*100}%`:0}}/>
              </div>
            </div>
          ))}
          <div className="hd-resolution">
            <span className="hd-res-num">{issues.length>0?Math.round((closedIss/issues.length)*100):0}%</span>
            <span className="hd-res-lbl">Resolution<br/>Rate</span>
          </div>
        </div>
          <div className="hd-resolution">
            <span className="hd-res-num">{issues.length>0?Math.round((closedIss/issues.length)*100):0}%</span>
            <span className="hd-res-lbl">Resolution<br/>Rate</span>
          </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════
          SECTION 7 — Hierarchical Status Heatmap Dashboard
      ══════════════════════════════════════════════════════════ */}
      <SecHdr
        title="Hierarchical Status Heatmap"
        sub="Program → Plant → Part · Weekly issue status · Click rows to drill down"
      />
      <Card title="">
        <HierarchicalHeatmap
          hierarchy={heatmapData.hierarchy}
          issueByNum={heatmapData.issueByNum}
          issueWeekMap={heatmapData.issueWeekMap}
        />
      </Card>

      </div>
  );
}
