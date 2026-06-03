import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { projectsApi, projectIssueLinkApi, issueDocApi, projectMilestoneApi, componentMetaApi, partMilestoneApi, dmrsApi } from '../../services/apiService';
import { downloadTemplate, downloadTemplateWithDropdowns, exportToExcel, parseExcel } from '../../utils/excelUtils';
import { generateIssuePdf, generateProjectDetailPdf } from '../../utils/pdfReport';

const SYNC_KEY_MAP = {
  'sync 1':'sync1','sync 2':'sync2','sync 3':'sync3',
  'sync 4':'sync4','sync 5':'sync5','post sync 5':'postSync5',
};
const MBOM_STATUS_CFG = {
  disabled: { bg:'#f5f5f5', color:'#bdbdbd', border:'#e0e0e0', label:'No Doc'      },
  grey:     { bg:'#eeeeee', color:'#757575', border:'#bdbdbd', label:'Not Started' },
  orange:   { bg:'#fff3e0', color:'#bf360c', border:'#ffb74d', label:'In Progress' },
  green:    { bg:'#e8f5e9', color:'#1b5e20', border:'#a5d6a7', label:'Completed'   },
  red:      { bg:'#ffebee', color:'#b71c1c', border:'#ef9a9a', label:'Delayed'     },
};

const metaOpts = (meta, lbl) =>
  [...new Set(meta.filter(m => m.label?.toLowerCase() === lbl.toLowerCase() && m.status?.toUpperCase() === 'ACTIVE').map(m => m.parameter).filter(Boolean))].sort();

const Sel = ({ value, onChange, options, placeholder = 'Select…' }) => (
  <div className="mod-select-wrap">
    <select value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <span className="mod-select-arrow">▾</span>
  </div>
);
import { useAuth } from '../../contexts/AuthContext';

const genUid   = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate  = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : null;
const today    = new Date();

// ── Milestone helpers ─────────────────────────────────────────────────────────
const SYNC_LABEL = {
  SYNC1:'Sync 1', SYNC2:'Sync 2', SYNC3:'Sync 3',
  SYNC4:'Sync 4', SYNC5:'Sync 5', POSTSYNC5:'Post S5',
};
const msLabel = id => SYNC_LABEL[(id||'').toUpperCase().replace(/[-_ ]/g,'')] || id || '—';

// Returns {active, upcoming} milestones for a given issue_number
const getMilestones = (issueNum, allMs) => {
  const rel = allMs.filter(m => m.flag1 === issueNum && m.milestone);
  const enriched = rel.map(m => {
    const start = new Date(m.milestone);
    const end   = new Date(start); end.setDate(end.getDate() + (m.noofDays||30));
    const active   = today >= start && today <= end;
    const upcoming = today < start;
    return { ...m, start, end, active, upcoming };
  }).sort((a,b) => a.start - b.start);
  return {
    active:   enriched.filter(m => m.active),
    upcoming: enriched.filter(m => m.upcoming),
    all:      enriched,
  };
};

// ── Milestone badge ───────────────────────────────────────────────────────────
const MsBadge = ({ ms, kind }) => {
  const cfg = kind === 'active'
    ? { bg:'#e8f5e9', color:'#1b5e20', border:'#a5d6a7', dot:'#27ae60' }
    : { bg:'#e3f2fd', color:'#1565c0', border:'#90caf9', dot:'#1976d2' };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 8px', borderRadius:5,
      background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      fontSize:11, fontWeight:700, whiteSpace:'nowrap',
    }}>
      <span style={{width:6,height:6,borderRadius:'50%',background:cfg.dot,flexShrink:0}}/>
      {msLabel(ms.milestoneid)}
      {fmtDate(ms.start) && <span style={{fontWeight:400,opacity:.8}}> · {fmtDate(ms.start)}</span>}
    </span>
  );
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const FolderIcon    = () => <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const BackIcon      = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const PlusIcon      = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EyeIcon       = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon      = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
const DownloadIcon  = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const MilestoneIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;
const ChevUp   = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
const ChevDown = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

// ── Part Image Input — supports click, Ctrl+V paste, drag & drop ──────────────
function PartImageInput({ label, value, onChange }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const readFile = file => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.5px'}}>{label}</span>
      <div
        tabIndex={0}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);readFile(e.dataTransfer.files[0]);}}
        onPaste={e=>{
          const item=Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
          if(item){e.preventDefault();readFile(item.getAsFile());}
        }}
        onClick={()=>fileRef.current?.click()}
        style={{
          position:'relative',border:`2px dashed ${dragging?'#3f51b5':'#c5cae9'}`,
          borderRadius:10,background:dragging?'#e8eaf6':'#fafbff',
          minHeight:110,display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',cursor:'pointer',transition:'all .2s',outline:'none',
          overflow:'hidden',
        }}>
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e=>{readFile(e.target.files?.[0]);e.target.value='';}}/>
        {value
          ? <>
              <img src={value} alt={label} style={{width:'100%',height:110,objectFit:'contain',borderRadius:8}}/>
              <button type="button"
                onClick={e=>{e.stopPropagation();onChange('');}}
                style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,.5)',border:'none',
                  borderRadius:'50%',width:22,height:22,color:'#fff',cursor:'pointer',
                  fontSize:13,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                ×
              </button>
            </>
          : <div style={{textAlign:'center',padding:'0 12px',pointerEvents:'none'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c5cae9" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Click, Paste or Drop</div>
              <div style={{fontSize:9,color:'#ccc'}}>Ctrl+V · Drag &amp; Drop</div>
            </div>
        }
      </div>
    </div>
  );
}

// ── Default milestone template ─────────────────────────────────────────────────
const DEFAULT_MILESTONE_NAMES = [
  { name:'CM',               order:1},
  { name:'Sync 1',           order:2 },
  { name:'Sync 2',           order:3 },
  { name:'Sync 3',           order:4 },
  { name:'Sync 4',           order:5 },
  { name:'Sync 5',           order:6 },
  { name:'Post Sync 5',      order:7 },
  { name:'SOP',              order:8 },
];

// ── Milestone Timeline SVG ────────────────────────────────────────────────────
// Normalise a raw milestone object (handles both camelCase API and PascalCase API responses)
const normMs = m => ({
  uid:            m.uid            || m.Uid            || '',
  milestoneName:  m.milestoneName  || m.MilestoneName  || '',
  milestoneOrder: m.milestoneOrder ?? m.MilestoneOrder ?? 0,
  plannedDate:    m.plannedDate    || m.PlannedDate     || null,
  completedDate:  m.completedDate  || m.CompletedDate   || null,
  status:         m.status         || m.Status          || 'Next Milestone',
  notes:          m.notes          || m.Notes           || '',
  department:     m.department     || m.Department      || '',
  owner:          m.owner          || m.Owner           || '',
});

function MilestoneTimeline({ milestones }) {
  const TRACK_Y = 92, LPAD = 64, RPAD = 64;
  const EL_RX = 11, EL_RY = 7, CIR_R = 7;
  const H = 136, SPACING = 96;

  const norm = milestones.map(normMs)
    .sort((a,b) => (a.milestoneOrder||0) - (b.milestoneOrder||0));

  const isEmpty = norm.length === 0;
  const msRows = isEmpty
    ? DEFAULT_MILESTONE_NAMES.map(d => ({
        uid: d.name, milestoneName: d.name, milestoneOrder: d.order,
        status: 'Next Milestone', plannedDate: null,
      }))
    : norm;

  const n     = msRows.length;
  const today = new Date();

  const validDates = msRows.map(m => m.plannedDate ? new Date(m.plannedDate) : null).filter(Boolean);
  const hasRealDates = !isEmpty && validDates.length >= 1;

  const trackW = Math.max(400, (n - 1) * SPACING);

  let tStart = null, tEnd = null;
  let xPositions;
  if (hasRealDates) {
    // Always include today so the TODAY pin is always visible within the track
    const allTimes = [...validDates.map(d => d.getTime()), today.getTime()];
    const minT = Math.min(...allTimes);
    const maxT = Math.max(...allTimes);
    // Enforce a minimum 30-day range so a single milestone doesn't collapse to a point
    const range = Math.max(maxT - minT, 30 * 24 * 3600 * 1000);
    const pad   = range * 0.10;
    tStart = minT - pad;
    tEnd   = maxT + pad;
    const tRange = tEnd - tStart;
    xPositions = msRows.map(m =>
      m.plannedDate
        ? LPAD + ((new Date(m.plannedDate).getTime() - tStart) / tRange) * trackW
        : null
    );
    xPositions = xPositions.map((x, i) =>
      x !== null ? x : LPAD + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2)
    );
  } else {
    xPositions = msRows.map((_, i) =>
      n === 1 ? LPAD + trackW / 2 : LPAD + (i / (n - 1)) * trackW
    );
  }
  // Enforce minimum gap so labels never collide
  const MIN_SEP = 72;
  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - xPositions[i - 1] < MIN_SEP) xPositions[i] = xPositions[i - 1] + MIN_SEP;
  }
  const W = Math.max(LPAD + trackW + RPAD, xPositions[n - 1] + RPAD);

  let todayX;
  if (hasRealDates && tStart !== null && tEnd !== null) {
    // today is always within [tStart, tEnd] because it was included in the range
    todayX = LPAD + ((today.getTime() - tStart) / (tEnd - tStart)) * trackW;
  } else {
    todayX = LPAD + Math.round(trackW * 0.35);
  }

  const fmtDate = v => {
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

  const done        = msRows.filter(m => (m.status||'').toLowerCase()==='completed').length;
  const inProg      = msRows.filter(m => (m.status||'').toLowerCase()==='on going').length;
  const pct         = Math.round((done / n) * 100);
  const lastDoneIdx = msRows.reduce((acc, m, i) =>
    (m.status||'').toLowerCase()==='completed' ? i : acc, -1);

  const todayStr = fmtDate(today);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>

      {/* Progress strip */}
      <div style={{padding:'12px 20px 10px',background:'#faf7ff',
        borderBottom:'1px solid #e8d5f7',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:'#7b1fa2'}}>
              {done} / {n} milestones completed
            </span>
            <span style={{fontSize:14,fontWeight:800,color:pct===100?'#27ae60':'#7b1fa2'}}>{pct}%</span>
          </div>
          <div style={{height:7,background:'#e8d5f7',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,transition:'width .4s',
              background:pct===100?'#27ae60':'linear-gradient(90deg,#7b1fa2,#ab47bc)',
              borderRadius:4}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:14}}>
          {[['#1a1a1a','Completed',done],['#7b1fa2','On Going',inProg],['#aaa','Next Milestone',n-done-inProg]].map(([c,l,cnt])=>(
            <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#555',fontWeight:500}}>
              <span style={{width:9,height:9,borderRadius:'50%',background:c,flexShrink:0}}/>
              {cnt} {l}
            </span>
          ))}
        </div>
      </div>

      {isEmpty && (
        <div style={{padding:'6px 20px 0',fontSize:11,color:'#bbb',fontStyle:'italic'}}>
          No milestones — switch to <b style={{color:'#7b1fa2'}}>Edit</b> to create them.
        </div>
      )}

      {/* SVG Timeline */}
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
          {msRows.map((ms, i) => {
            const x   = xPositions[i];
            const cfg = dotCfg(isEmpty ? 'next milestone' : ms.status);
            const lbl = ms.milestoneName || `M${i+1}`;
            const ds  = fmtDate(ms.plannedDate);

            return (
              <g key={ms.uid || i}>
                {/* Glow for on-going */}
                {!isEmpty && (ms.status||'').toLowerCase()==='on going' && (
                  <ellipse cx={x} cy={TRACK_Y} rx={EL_RX+5} ry={EL_RY+4}
                    fill="none" stroke="#ce93d8" strokeWidth="2" opacity=".5"/>
                )}

                {/* Dot */}
                {cfg.type === 'ellipse'
                  ? <ellipse cx={x} cy={TRACK_Y} rx={EL_RX} ry={EL_RY} fill={cfg.fill}/>
                  : <circle cx={x} cy={TRACK_Y} r={CIR_R}
                      fill={cfg.fill} stroke={isEmpty ? '#ddd' : cfg.stroke} strokeWidth="2"/>
                }

                {/* Check mark */}
                {!isEmpty && (ms.status||'').toLowerCase()==='completed' && (
                  <text x={x} y={TRACK_Y+3.5} textAnchor="middle"
                    fontSize="8" fill="#fff" fontWeight="900">✓</text>
                )}

                {/* Date above track */}
                {ds && (
                  <text x={x} y={TRACK_Y-14} textAnchor="middle"
                    fontSize="9" fill={isEmpty ? '#ccc' : '#444'}>
                    {ds}
                  </text>
                )}

                {/* Downward pole */}
                <line x1={x} y1={TRACK_Y+EL_RY+1} x2={x} y2={TRACK_Y+EL_RY+16}
                  stroke={isEmpty ? '#ddd' : (cfg.type==='ellipse' ? cfg.fill : '#ccc')}
                  strokeWidth="1.5"/>

                {/* Name below */}
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

      {/* Legend */}
      <div style={{display:'flex',gap:16,flexWrap:'wrap',padding:'8px 20px',
        borderTop:'1px solid #f3eaff',background:'#fdf9ff'}}>
        {[
          { c:'#1a1a1a', label:'Completed',      type:'ellipse' },
          { c:'#7b1fa2', label:'On Going',       type:'ellipse' },
          { c:'#aaa',    label:'Next Milestone', type:'circle'  },
        ].map(({c, label, type}) => (
          <span key={label} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,color:'#666'}}>
            <svg width="14" height="10" style={{flexShrink:0}}>
              {type === 'ellipse'
                ? <ellipse cx="7" cy="5" rx="6" ry="4" fill={c}/>
                : <circle cx="5" cy="5" r="4" fill="#fff" stroke={c} strokeWidth="1.5"/>
              }
            </svg>
            {label}
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
}

const InfoField = ({ label, value }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:110 }}>
    <span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'.5px' }}>{label}</span>
    <span style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>{value || '—'}</span>
  </div>
);

// Coloured clickable document number badge
const DocBadge = ({ docNum, bg, color, border, onClick, title: ttl }) => (
  docNum
    ? <span onClick={onClick} title={ttl}
        style={{
          display:'inline-flex', alignItems:'center',
          padding:'3px 9px', borderRadius:5,
          background:bg, color, border:`1px solid ${border}`,
          fontSize:11, fontWeight:700,
          fontFamily:'Consolas,"Courier New",monospace',
          cursor:'pointer', whiteSpace:'nowrap', userSelect:'none',
          transition:'filter .15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.filter='brightness(.93)'}
        onMouseLeave={e=>e.currentTarget.style.filter=''}>
        {docNum}
      </span>
    : <span style={{color:'#ccc',fontSize:12}}>—</span>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { uid }  = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const actor    = user?.userId || user?.email || 'system';

  const [loading,      setLoading]      = useState(true);
  const [project,      setProject]      = useState(null);
  const [allProjs,     setAllProjs]     = useState([]);
  const [links,        setLinks]        = useState([]);
  const [allIssueDocs, setAllIssueDocs] = useState([]);
  const [allMilestones,setAllMilestones]= useState([]);
  const [allDmrs,      setAllDmrs]      = useState([]);
  const [error,        setError]        = useState(null);
  const [meta,         setMeta]         = useState([]);
  const [infoOpen,     setInfoOpen]     = useState(true);
  const [partsOpen,    setPartsOpen]    = useState(true);

  // Part milestone drawer
  const [msDrawerMount, setMsDrawerMount] = useState(false);
  const [msDrawerOpen,  setMsDrawerOpen]  = useState(false);
  const [msDrawerTab,   setMsDrawerTab]   = useState('edit');
  const [msDrawerLnk,   setMsDrawerLnk]  = useState(null);
  const [msRows,        setMsRows]        = useState([]);
  const [msSaving,      setMsSaving]      = useState(false);
  const [msLoading,     setMsLoading]     = useState(false);

  // Project milestone editor drawer
  const [projMsMount,   setProjMsMount]   = useState(false);
  const [projMsOpen,    setProjMsOpen]    = useState(false);
  const [projMsRows,    setProjMsRows]    = useState([]);
  const [projMsSaving,  setProjMsSaving]  = useState(false);
  const [projMsLoading, setProjMsLoading] = useState(false);

  // ── Part extras: stored as JSON in ProjectIssueLink.flag2 ────────────────────
  const parsePartExtras = (flag2) => {
    try { return JSON.parse(flag2 || '{}'); } catch { return {}; }
  };
  const serializePartExtras = (form) => JSON.stringify({
    partType:   form.partType    || '',
    partNameLH: form.partNameLH  || '',
    partNameRH: form.partNameRH  || '',
    imgLH:      form.imgLH       || '',
    imgRH:      form.imgRH       || '',
    material:   form.material    || '',
    initiator: form.initiator       || '',
    owner:     form.owner           || '',
    pdefRH:    form.pDEF_Number_RH  || '',
    pdefLH:    form.pDEF_Number_LH  || '',
    laRH:      form.lA_Num_RH       || '',
    laLH:      form.lA_Num_LH       || '',
    paRH:                 form.pA_Num_RH           || '',
    paLH:                 form.pA_Num_LH           || '',
    targetCompletionAVP:  form.targetCompletionAVP  || '',
    targetCompletionWGDE: form.targetCompletionWGDE || '',
    revisionRH:      form.revisionRH      || '',
    maturityStateRH: form.maturityStateRH || '',
    revisionLH:      form.revisionLH      || '',
    maturityStateLH: form.maturityStateLH || '',
    zoneArea:        form.zoneArea        || '',
    priorityAVP:     form.priorityAVP     || '',
    priorityWGDE:    form.priorityWGDE    || '',
  });

  // Add / Edit Part drawer
  const PART_EMPTY = {
    part_number_lh:'', part_number_rh:'', part_description:'',
    department:'', deptAVP: false, deptWGDE: false, lockAVP: false, lockWGDE: false,
    partType:'',
    partNameLH:'', partNameRH:'',
    imgLH:'', imgRH:'',
    material:'', initiator:'', owner:'',
    pDEF_Number_RH:'', pDEF_Number_LH:'',
    lA_Num_RH:'', lA_Num_LH:'',
    pA_Num_RH:'', pA_Num_LH:'',
    targetCompletionAVP:'', targetCompletionWGDE:'',
    revisionRH:'', maturityStateRH:'', revisionLH:'', maturityStateLH:'',
    zoneArea:'', priorityAVP:'', priorityWGDE:'',
  };
  const xlPartRef                               = useRef(null);
  const [partImporting,    setPartImporting]    = useState(false);
  const [partDrawerMount,  setPartDrawerMount]  = useState(false);
  const [partDrawerOpen,   setPartDrawerOpen]   = useState(false);
  const [partDrawerMode,   setPartDrawerMode]   = useState('add'); // 'add' | 'edit'
  const [editingLnk,       setEditingLnk]       = useState(null);
  const [partForm,         setPartForm]         = useState(PART_EMPTY);
  const [addPartSaving,    setAddPartSaving]    = useState(false);
  const [partViewMount,    setPartViewMount]    = useState(false);
  const [partViewOpen,     setPartViewOpen]     = useState(false);
  const [viewingLnk,       setViewingLnk]       = useState(null);

  const openPartDrawer = (mode = 'add', lnk = null) => {
    setPartDrawerMode(mode);
    setEditingLnk(lnk);
    if (mode === 'edit' && lnk) {
      const ex        = parsePartExtras(lnk.flag2 || lnk.Flag2 || '');
      const deptRaw   = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
      const avpDoc    = lnk.issue_number || lnk.Issue_number || '';
      const wgdeDoc   = lnk.flag3       || lnk.Flag3        || '';
      setPartForm({
        part_number_lh:   lnk.part_number_LH   || lnk.Part_number_LH  || '',
        part_number_rh:   lnk.part_number_RH   || lnk.Part_number_RH  || '',
        part_description: lnk.part_Description || lnk.Part_Description || '',
        department:       lnk.flag1            || lnk.Flag1            || '',
        deptAVP:          deptRaw.includes('avp'),
        deptWGDE:         deptRaw.includes('wgde'),
        // lock flags — dept cannot be removed once its doc exists
        lockAVP:          !!avpDoc,              // AVP doc always exists once created
        lockWGDE:         !!wgdeDoc,             // WGDE doc exists when flag3 is set
        partType:         ex.partType    || '',
        partNameLH:       ex.partNameLH  || '',
        partNameRH:       ex.partNameRH  || '',
        imgLH:            ex.imgLH       || '',
        imgRH:            ex.imgRH       || '',
        material:         ex.material    || '',
        initiator:        ex.initiator || '',
        owner:            ex.owner     || '',
        pDEF_Number_RH:   ex.pdefRH   || '',
        pDEF_Number_LH:   ex.pdefLH   || '',
        lA_Num_RH:        ex.laRH     || '',
        lA_Num_LH:        ex.laLH     || '',
        pA_Num_RH:            ex.paRH                  || '',
        pA_Num_LH:            ex.paLH                  || '',
        targetCompletionAVP:  ex.targetCompletionAVP   || ex.targetCompletion || '',
        targetCompletionWGDE: ex.targetCompletionWGDE  || ex.targetCompletion || '',
        revisionRH:      ex.revisionRH      || '',
        maturityStateRH: ex.maturityStateRH || '',
        revisionLH:      ex.revisionLH      || '',
        maturityStateLH: ex.maturityStateLH || '',
        zoneArea:        ex.zoneArea        || '',
        priorityAVP:     ex.priorityAVP     || '',
        priorityWGDE:    ex.priorityWGDE    || '',
      });
    } else {
      // New part: pre-populate department from the project's own department (flag3)
      const projDept = (project?.flag3 || project?.Flag3 || '').toLowerCase();
      setPartForm({
        ...PART_EMPTY,
        deptAVP:  projDept.includes('avp'),
        deptWGDE: projDept.includes('wgde'),
        lockAVP:  false,
        lockWGDE: false,
      });
    }
    setPartDrawerMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setPartDrawerOpen(true)));
  };
  const closePartDrawer = () => {
    setPartDrawerOpen(false);
    setTimeout(() => { setPartDrawerMount(false); setAddPartSaving(false); setEditingLnk(null); }, 320);
  };
  const openPartView = (lnk) => {
    setViewingLnk(lnk);
    setPartViewMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setPartViewOpen(true)));
  };
  const closePartView = () => {
    setPartViewOpen(false);
    setTimeout(() => { setPartViewMount(false); setViewingLnk(null); }, 320);
  };
  const spf = (k, v) => setPartForm(p => ({ ...p, [k]: v }));

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      projectsApi.getAll(),
      projectIssueLinkApi.byProject(uid),
      issueDocApi.getAll(),
      projectMilestoneApi.byProject(uid),
      componentMetaApi.getAll(),
      dmrsApi.getAll(),
    ]).then(([projsRes, linksRes, issuesRes, msRes, metaRes, dmrsRes]) => {
      if (projsRes.status === 'fulfilled') {
        const all = projsRes.value ?? [];
        setAllProjs(all);
        const found = all.find(p => p.uid === uid);
        if (found) setProject(found);
        else setError('Project not found.');
      } else {
        setError('Failed to load project.');
      }
      if (linksRes.status === 'fulfilled')  setLinks(linksRes.value ?? []);
      if (issuesRes.status === 'fulfilled') setAllIssueDocs(issuesRes.value ?? []);
      if (msRes.status === 'fulfilled')     setAllMilestones(msRes.value ?? []);
      if (metaRes.status === 'fulfilled')   setMeta(metaRes.value ?? []);
      if (dmrsRes.status === 'fulfilled')   setAllDmrs(dmrsRes.value ?? []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [uid]);

  // Project code from creation-date-sorted list
  const projectCode = useMemo(() => {
    if (!allProjs.length || !project) return '—';
    const sorted = [...allProjs].sort((a,b) => new Date(a.created_date||0) - new Date(b.created_date||0));
    const idx = sorted.findIndex(p => p.uid === uid);
    return idx >= 0 ? `P${String(idx+1).padStart(3,'0')}` : '—';
  }, [allProjs, project, uid]);

  // ── Current sync key derived from project milestones ─────────────────────────
  const currentSyncKey = useMemo(() => {
    const syncMs = allMilestones
      .map(m => ({ ...m, nameLc: (m.milestoneName || '').toLowerCase().trim() }))
      .filter(m => m.nameLc.includes('sync'))
      .sort((a, b) => (a.milestoneOrder || 0) - (b.milestoneOrder || 0));
    const active = syncMs.find(m => (m.status || '').toLowerCase() !== 'completed');
    const target = active || syncMs[syncMs.length - 1] || null;
    return target ? (SYNC_KEY_MAP[target.nameLc] || null) : null;
  }, [allMilestones]);

  const getDocStatus = (docNum, targetDateStr) => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const tDate   = targetDateStr ? (() => { const d = new Date(targetDateStr); d.setHours(0,0,0,0); return d; })() : null;
    const overdue = tDate && today > tDate;

    if (!docNum) return 'disabled';

    const items = allDmrs.filter(d => (d.issue_number || d.Issue_number || '') === docNum);

    if (items.length === 0) return overdue ? 'red' : 'grey';

    const total = items.length;
    const sk    = currentSyncKey;

    if (sk) {
      const okCount   = items.filter(d => (d[sk] || '').trim() === 'OK').length;
      const anyFilled = items.filter(d => (d[sk] || '').trim()).length;
      if (okCount === total) return 'green';
      if (overdue)           return 'red';
      if (anyFilled > 0)     return 'orange';
      return 'grey';
    }
    const allOk = items.every(d =>
      ['sync1','sync2','sync3','sync4','sync5'].every(k => d[k] === 'OK')
    );
    if (allOk)   return 'green';
    if (overdue) return 'red';
    const anyActivity = items.some(d =>
      ['sync1','sync2','sync3','sync4','sync5'].some(k => (d[k] || '').trim())
    );
    return anyActivity ? 'orange' : 'grey';
  };

  // ── Add Part ─────────────────────────────────────────────────────────────────
  const nextDocNum = projectCode !== '—'
    ? `${projectCode}-${String(links.length + 1).padStart(4,'0')}`
    : '—';

  const handleSavePart = async () => {
    if (!partForm.part_number_lh.trim() && !partForm.part_number_rh.trim()) {
      Swal.fire({icon:'warning',title:'Required',text:'Enter at least Part Number LH or RH.',confirmButtonColor:'#3f51b5'});
      return;
    }
    const now       = new Date().toISOString();
    const primaryPn = partForm.part_number_rh.trim() || partForm.part_number_lh.trim();
    const deptValue = [partForm.deptAVP && 'AVP', partForm.deptWGDE && 'WGDE'].filter(Boolean).join(',');
    setAddPartSaving(true);

    // ── Upload images if they are base64 data URLs (too large for DB column) ──
    const dataUrlToFile = (dataUrl, name) => {
      const [header, data] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(data); let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      return new File([u8], name, { type: mime });
    };
    const resolvedForm = { ...partForm };
    try {
      if (resolvedForm.imgLH?.startsWith('data:')) {
        const res = await dmrsApi.uploadImage(dataUrlToFile(resolvedForm.imgLH, `part-lh-${Date.now()}.png`));
        resolvedForm.imgLH = res.path || resolvedForm.imgLH;
      }
      if (resolvedForm.imgRH?.startsWith('data:')) {
        const res = await dmrsApi.uploadImage(dataUrlToFile(resolvedForm.imgRH, `part-rh-${Date.now()}.png`));
        resolvedForm.imgRH = res.path || resolvedForm.imgRH;
      }
    } catch { /* non-critical — keep original if upload fails */ }
    try {
      if (partDrawerMode === 'edit' && editingLnk) {
        // ── Update link — all part info lives in flag2 (JSON), flag1 = department
        const lnkUid = editingLnk.uid || editingLnk.Uid;
        const existingWgdeDoc = editingLnk.flag3       || editingLnk.Flag3        || '';
        const existingIssNum  = editingLnk.issue_number || editingLnk.Issue_number || '';
        // For AVP,WGDE: preserve existing WGDE doc, or auto-generate if missing
        // For single dept: clear WGDE doc (only if not yet locked)
        const newWgdeDoc = deptValue === 'AVP,WGDE'
          ? (existingWgdeDoc || existingIssNum + '-W')
          : (partForm.lockWGDE ? existingWgdeDoc : ''); // keep if locked, clear if unlocked single-dept
        await projectIssueLinkApi.update(lnkUid, {
          ...editingLnk,
          partNumber:       primaryPn,
          Part_number_RH:   partForm.part_number_rh.trim(),
          Part_number_LH:   partForm.part_number_lh.trim(),
          Part_Description: partForm.part_description.trim(),
          flag1:            deptValue,
          flag2:            serializePartExtras(resolvedForm),
          flag3:            newWgdeDoc,
          modified_by:      actor,
          modified_date:    now,
        });
        const updMsg = deptValue === 'AVP,WGDE'
          ? `AVP doc: <b>${existingIssNum}</b><br/>WGDE doc: <b>${newWgdeDoc}</b>`
          : `Checklist doc: <b>${existingIssNum}</b>`;
        Swal.fire({icon:'success',title:'Part Updated!',html:updMsg,timer:2200,showConfirmButton:false,timerProgressBar:true});
      } else {
        // ── Create new link — part info in flag2, no IssueDoc created
        // When both depts are selected, flag3 = WGDE doc number (issue_number + '-W')
        const wgdeDocNum = deptValue === 'AVP,WGDE' ? nextDocNum + '-W' : '';
        await projectIssueLinkApi.create({
          uid:              genUid(),
          project:          uid,
          partNumber:       primaryPn,
          Part_number_RH:   partForm.part_number_rh.trim(),
          Part_number_LH:   partForm.part_number_lh.trim(),
          Part_Description: partForm.part_description.trim(),
          issue_number:     nextDocNum,
          flag1:            deptValue,
          flag2:            serializePartExtras(resolvedForm),
          flag3:            wgdeDocNum,
          program:          project?.program    || '',
          plant:            project?.plant      || '',
          plant_year:       project?.plant_year || '',
          zone:             project?.zone       || '',
          area:             project?.area       || '',
          status:           'Active',
          created_by:       actor,
          created_date:     now,
        });
        const createMsg = deptValue === 'AVP,WGDE'
          ? `AVP doc: <b>${nextDocNum}</b><br/>WGDE doc: <b>${wgdeDocNum}</b>`
          : deptValue === 'WGDE'
            ? `WGDE checklist doc: <b>${nextDocNum}</b>`
            : `AVP checklist doc: <b>${nextDocNum}</b>`;
        Swal.fire({icon:'success',title:'Part Added — Checklist Docs Created!',html:createMsg,timer:2500,showConfirmButton:false,timerProgressBar:true});
      }
      closePartDrawer();
      loadData();
    } catch(err) {
      Swal.fire({icon:'error',title:'Failed',text:err.message,confirmButtonColor:'#3f51b5'});
    } finally { setAddPartSaving(false); }
  };

  // ── Parts export / import ─────────────────────────────────────────────────────
  const PART_XL_COLS = [
    // ── Mandatory fields (orange header) ─────────────────────────────
    {header:'Part # LH',        key:'part_number_lh',   mandatory:true,  width:18},
    {header:'Part # RH',        key:'part_number_rh',   mandatory:true,  width:18},
    {header:'Part Name LH',     key:'partNameLH',        mandatory:true,  width:22},
    {header:'Part Name RH',     key:'partNameRH',        mandatory:true,  width:22},
    {header:'Part Description', key:'part_description', mandatory:true,  width:30},
    {header:'Type',             key:'partType',          mandatory:true,  width:14},
    {header:'Zone / Area',      key:'zoneArea',          mandatory:true,  width:18},
    {header:'Material',         key:'material',          mandatory:true,  width:18},
    // ── Optional fields (yellow header) ──────────────────────────────
    {header:'Initiator',        key:'initiator',         mandatory:false, width:20},
    {header:'Owner',            key:'owner',             mandatory:false, width:20},
    {header:'PDEF # RH',        key:'pDEF_Number_RH',   mandatory:false, width:16},
    {header:'PDEF # LH',        key:'pDEF_Number_LH',   mandatory:false, width:16},
    {header:'LA # RH',          key:'lA_Num_RH',        mandatory:false, width:14},
    {header:'LA # LH',          key:'lA_Num_LH',        mandatory:false, width:14},
    {header:'PA # RH',          key:'pA_Num_RH',        mandatory:false, width:14},
    {header:'PA # LH',          key:'pA_Num_LH',        mandatory:false, width:14},
  ];
  // Build map from header text (lowercased, strip trailing ' *') → field key
  const PART_XL_MAP = Object.fromEntries(
    PART_XL_COLS.map(c => [c.header.toLowerCase(), c.key])
  );

  const handleExportPartTemplate = () => {
    const colsWithOptions = PART_XL_COLS.map(col => ({
      ...col,
      options: col.key === 'partType' ? metaOpts(meta, 'Category')
             : col.key === 'zoneArea' ? metaOpts(meta, 'Zone')
             : col.key === 'material' ? metaOpts(meta, 'Material')
             : col.key === 'owner'    ? metaOpts(meta, 'Owner')
             : undefined,
    }));
    downloadTemplateWithDropdowns(colsWithOptions, `${projectCode}-parts-template.xlsx`);
  };

  const handlePrintDetailPdf = () => generateProjectDetailPdf({
    project,
    projectCode,
    milestones: allMilestones,
    links,
    filename: `${projectCode}-detail-${Date.now()}.pdf`,
  });

  const handleExportParts = () => {
    const rows = links.map(lnk => {
      const ex = parsePartExtras(lnk.flag2 || lnk.Flag2 || '');
      return {
        part_number_lh:   lnk.part_number_LH   || lnk.Part_number_LH   || '',
        part_number_rh:   lnk.part_number_RH   || lnk.Part_number_RH   || '',
        part_description: lnk.part_Description || lnk.Part_Description || '',
        material:         ex.material  || '',
        initiator:        ex.initiator || '',
        owner:            ex.owner     || '',
        pDEF_Number_RH:   ex.pdefRH   || '',
        pDEF_Number_LH:   ex.pdefLH   || '',
        lA_Num_RH:        ex.laRH     || '',
        lA_Num_LH:        ex.laLH     || '',
        pA_Num_RH:        ex.paRH     || '',
        pA_Num_LH:        ex.paLH     || '',
      };
    });
    exportToExcel(rows, PART_XL_COLS, `${projectCode}-parts-${Date.now()}.xlsx`);
  };

  const handleImportParts = async e => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setPartImporting(true);
    try {
      const raw = await parseExcel(file);
      if (!raw.length) { Swal.fire({icon:'info',title:'Empty file',confirmButtonColor:'#3f51b5'}); return; }
      const now = new Date().toISOString();
      let created = 0;
      for (const row of raw) {
        const rec = {};
        Object.entries(row).forEach(([h,v]) => {
          // strip trailing ' *' added to mandatory headers in the template
          const norm = h.trim().toLowerCase().replace(/\s*\*$/, '');
          const k = PART_XL_MAP[norm];
          if (k) rec[k] = String(v??'');
        });
        if (!rec.part_number_lh && !rec.part_number_rh) continue;
        const docNum  = `${projectCode}-${String(links.length + created + 1).padStart(4,'0')}`;
        const primary = (rec.part_number_rh||'').trim() || (rec.part_number_lh||'').trim();
        await projectIssueLinkApi.create({
          uid: genUid(), project: uid, partNumber: primary,
          Part_number_RH:   (rec.part_number_rh||'').trim(),
          Part_number_LH:   (rec.part_number_lh||'').trim(),
          Part_Description: (rec.part_description||'').trim(),
          issue_number: docNum, program: project?.program||'',
          plant: project?.plant||'', plant_year: project?.plant_year||'',
          zone: project?.zone||'', area: project?.area||'',
          flag1: '',
          flag2: serializePartExtras({
            partNameLH: rec.partNameLH||'', partNameRH: rec.partNameRH||'',
            partType: rec.partType||'', zoneArea: rec.zoneArea||'',
            material: rec.material||'', initiator: rec.initiator||'', owner: rec.owner||'',
            pDEF_Number_RH: rec.pDEF_Number_RH||'', pDEF_Number_LH: rec.pDEF_Number_LH||'',
            lA_Num_RH: rec.lA_Num_RH||'', lA_Num_LH: rec.lA_Num_LH||'',
            pA_Num_RH: rec.pA_Num_RH||'', pA_Num_LH: rec.pA_Num_LH||'',
          }),
          status: 'Active', created_by: actor, created_date: now,
        });
        created++;
      }
      loadData();
      Swal.fire({icon:'success',title:'Import done',html:`<b>${created}</b> part${created!==1?'s':''} imported`,confirmButtonColor:'#3f51b5'});
    } catch(err) { Swal.fire({icon:'error',title:'Import failed',text:err.message,confirmButtonColor:'#3f51b5'}); }
    finally { setPartImporting(false); }
  };

  const handleDeletePart = async (lnk) => {
    const res = await Swal.fire({
      title:'Delete this part?',
      html:`Checklist doc <b>${lnk.issue_number}</b> and its linked issue will be removed.`,
      icon:'warning', showCancelButton:true,
      confirmButtonColor:'#e53935', cancelButtonColor:'#6c757d',
      confirmButtonText:'Delete', reverseButtons:true,
    });
    if (!res.isConfirmed) return;
    try {
      await projectIssueLinkApi.remove(lnk.uid);
      const issueDoc = allIssueDocs.find(d => d.issue_number === lnk.issue_number);
      if (issueDoc) await issueDocApi.remove(issueDoc.uid);
      loadData();
      Swal.fire({icon:'success',title:'Deleted',timer:1600,showConfirmButton:false,timerProgressBar:true});
    } catch(err) {
      Swal.fire({icon:'error',title:'Delete failed',text:err.message,confirmButtonColor:'#3f51b5'});
    }
  };

  const handleDownloadPart = async (lnk) => {
    const issNum  = lnk.issue_number || lnk.Issue_number || '';
    const ex      = parsePartExtras(lnk.flag2 || lnk.Flag2 || '');
    const issueDoc = allIssueDocs.find(d => d.issue_number === issNum) || {};

    // Resolve images — base64 or server paths
    const resolveImg = async (src) => {
      if (!src) return null;
      if (src.startsWith('data:')) return src;
      try {
        const res  = await fetch(src, { credentials:'include' });
        const blob = await res.blob();
        return await new Promise(resolve => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result);
          r.readAsDataURL(blob);
        });
      } catch { return null; }
    };

    try {
      const [imgLH, imgRH] = await Promise.all([
        resolveImg(ex.imgLH),
        resolveImg(ex.imgRH),
      ]);

      const images = [imgLH, imgRH].filter(Boolean);

      await generateIssuePdf({
        docInfo: {
          issue_number:  issNum,
          issue_title:   lnk.part_Description || lnk.Part_Description || '',
          status:        lnk.status || 'Active',
          partNumber:    lnk.part_number_RH || lnk.Part_number_RH || lnk.part_number_LH || lnk.Part_number_LH || '',
          ...issueDoc,
        },
        partExtras: {
          ...ex,
          pdefRH: ex.pDEF_Number_RH || ex.pdefRH || '',
          pdefLH: ex.pDEF_Number_LH || ex.pdefLH || '',
          laRH:   ex.lA_Num_RH || ex.laRH || '',
          laLH:   ex.lA_Num_LH || ex.laLH || '',
          paRH:   ex.pA_Num_RH || ex.paRH || '',
          paLH:   ex.pA_Num_LH || ex.paLH || '',
        },
        linkData: {
          program:    project?.program    || '',
          plant:      project?.plant      || '',
          plant_year: project?.plant_year || '',
          dept:       lnk.flag1 || lnk.Flag1 || '',
          projStatus: project?.status     || '',
          partRH:     lnk.part_number_RH  || lnk.Part_number_RH  || '',
          partLH:     lnk.part_number_LH  || lnk.Part_number_LH  || '',
        },
        projectName: project?.projectName || '',
        checklists:  [],
        images,
      });
    } catch(err) {
      Swal.fire({icon:'error',title:'Download failed',text:err.message,confirmButtonColor:'#3f51b5'});
    }
  };

  // ── Milestone drawer ─────────────────────────────────────────────────────────
  const openMsDrawer = async (lnk) => {
    setMsDrawerLnk(lnk);
    setMsDrawerTab('edit');
    setMsDrawerMount(true);
    setMsLoading(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMsDrawerOpen(true)));
    try {
      const issNum = lnk.issue_number || lnk.Issue_number;
      const data   = await partMilestoneApi.byIssueNumber(issNum);
      if (data && data.length > 0) {
        setMsRows(data.map(normMs));
      } else {
        const now = new Date().toISOString();
        setMsRows(DEFAULT_MILESTONE_NAMES.map(d => ({
          uid: genUid(), issueNumber: issNum, projectUid: uid,
          milestoneName: d.name, milestoneOrder: d.order,
          plannedDate: null, completedDate: null,
          status: 'Next Milestone', department: '', owner: '', notes: '',
          createdBy: actor, createdDate: now,
        })));
      }
    } catch(err) {
      Swal.fire({icon:'error',title:'Failed to load milestones',text:err.message,confirmButtonColor:'#3f51b5'});
    } finally { setMsLoading(false); }
  };

  const closeMsDrawer = () => {
    setMsDrawerOpen(false);
    setTimeout(() => { setMsDrawerMount(false); setMsDrawerLnk(null); setMsRows([]); }, 320);
  };

  const smr = (rowUid, key, val) =>
    setMsRows(prev => prev.map(r => r.uid === rowUid ? { ...r, [key]: val || null } : r));

  const addMsRow = () => {
    const now = new Date().toISOString();
    setMsRows(prev => [...prev, {
      uid: genUid(), issueNumber: msDrawerLnk?.issue_number || msDrawerLnk?.Issue_number || '',
      projectUid: uid, milestoneName: '', milestoneOrder: prev.length + 1,
      plannedDate: null, completedDate: null, status: 'Next Milestone',
      department: '', owner: '', notes: '',
      createdBy: actor, createdDate: now,
    }]);
  };

  const removeMsRow = (rowUid) => setMsRows(prev => prev.filter(r => r.uid !== rowUid));

  const handleSaveMilestones = async () => {
    const issNum = msDrawerLnk?.issue_number || msDrawerLnk?.Issue_number;
    if (!issNum) return;
    setMsSaving(true);
    const now = new Date().toISOString();
    try {
      const payload = msRows.map((r, i) => ({
        ...r, milestoneOrder: i + 1, issueNumber: issNum,
        projectUid: uid, modifiedBy: actor, modifiedDate: now,
      }));
      await partMilestoneApi.bulkUpsert(issNum, payload);

      // Auto-complete part when all milestones done
      const allDone = payload.length > 0 && payload.every(m => m.status === 'Completed');
      if (allDone) {
        const lnk = links.find(l => (l.issue_number || l.Issue_number) === issNum);
        if (lnk && lnk.status !== 'Completed') {
          await projectIssueLinkApi.update(lnk.uid, {
            ...lnk, status: 'Completed', modified_by: actor, modified_date: now,
          });
          loadData();
        }
      }
      Swal.fire({icon:'success',title:'Milestones Saved!',timer:1800,showConfirmButton:false,timerProgressBar:true});
      closeMsDrawer();
    } catch(err) {
      Swal.fire({icon:'error',title:'Save failed',text:err.message,confirmButtonColor:'#3f51b5'});
    } finally { setMsSaving(false); }
  };

  // ── Project milestone editor ──────────────────────────────────────────────────
  const openProjMsDrawer = async () => {
    setProjMsRows([]); setProjMsLoading(true);
    setProjMsMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setProjMsOpen(true)));
    try {
      const data = await projectMilestoneApi.byProject(uid);
      if (data && data.length > 0) {
        const defaultByOrder = new Map(DEFAULT_MILESTONE_NAMES.map(d => [d.order, d]));
        setProjMsRows(data.map(normMs).map((m, i) => ({
          ...m,
          milestoneName: m.milestoneName
            || defaultByOrder.get(m.milestoneOrder)?.name
            || DEFAULT_MILESTONE_NAMES[i]?.name
            || `M${i + 1}`,
        })));
      } else {
        const now = new Date().toISOString();
        setProjMsRows(DEFAULT_MILESTONE_NAMES.map(d => ({
          uid: genUid(), projectUid: uid,
          milestoneName: d.name, milestoneOrder: d.order,
          plannedDate: null, status: 'Next Milestone', notes: '',
          createdBy: actor, createdDate: now,
        })));
      }
    } catch(err) {
      Swal.fire({ icon:'error', title:'Failed to load milestones', text:err.message, confirmButtonColor:'#7b1fa2' });
    } finally { setProjMsLoading(false); }
  };
  const closeProjMsDrawer = () => {
    setProjMsOpen(false);
    setTimeout(() => { setProjMsMount(false); setProjMsRows([]); }, 320);
  };
  const addProjMsRow = () => {
    const now = new Date().toISOString();
    setProjMsRows(prev => [...prev, {
      uid: genUid(), projectUid: uid, milestoneName: '',
      milestoneOrder: prev.length + 1, plannedDate: null,
      status: 'Next Milestone', notes: '', createdBy: actor, createdDate: now,
    }]);
  };
  const removeProjMsRow = rowUid => setProjMsRows(prev => prev.filter(r => r.uid !== rowUid));
  const sprojMs = (rowUid, key, val) => setProjMsRows(prev => prev.map(r => r.uid===rowUid ? {...r,[key]:val??null} : r));
  const handleSaveProjMs = async () => {
    setProjMsSaving(true);
    const now = new Date().toISOString();
    try {
      const payload = projMsRows.map((r, i) => ({
        ...r, milestoneOrder: i + 1, projectUid: uid, modifiedBy: actor, modifiedDate: now,
      }));
      await projectMilestoneApi.bulkUpsert(uid, payload);
      const fresh = await projectMilestoneApi.byProject(uid);
      setAllMilestones(Array.isArray(fresh) ? fresh : []);
      Swal.fire({ icon:'success', title:'Milestones Saved!', timer:1800, showConfirmButton:false, timerProgressBar:true });
      closeProjMsDrawer();
    } catch(err) {
      Swal.fire({ icon:'error', title:'Save failed', text:err.message, confirmButtonColor:'#7b1fa2' });
    } finally { setProjMsSaving(false); }
  };

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'80px 0', color:'#3f51b5' }}>
      <div className="mod-spinner"/>
      <span style={{ fontSize:14 }}>Loading project details…</span>
    </div>
  );

  if (error || !project) return (
    <div className="mod-page">
      <div className="mod-state-box" style={{ padding:'80px 0' }}>
        <FolderIcon/>
        <span>{error || 'Project not found.'}</span>
        <button className="mod-btn mod-btn-outline" onClick={()=>navigate('/dashboard/projects')}>← Back to Projects</button>
      </div>
    </div>
  );

  return (
    <div className="mod-page">

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button className="mod-btn mod-btn-outline mod-btn-sm"
          onClick={()=>navigate('/dashboard/projects')}
          style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
          <BackIcon/> Back to Projects
        </button>
        <span style={{ fontSize:12, color:'#aaa' }}>›</span>
        <span style={{ fontSize:14, fontWeight:700, color:'#3f51b5' }}>{projectCode}</span>
        <span style={{ fontSize:14, color:'#444', fontWeight:500,
          maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {project.projectName}
        </span>
      </div>

      {/* ── Project info card — two-column layout ──────────────────── */}
      <div style={{ background:'var(--dash-card-bg)', borderRadius:10,
        border:'1px solid var(--dash-border)', boxShadow:'0 1px 8px rgba(0,0,0,.06)', overflow:'clip' }}>

        {/* Collapsible header */}
        <div style={{ display:'flex', alignItems:'center', padding:'12px 20px',
          borderBottom: infoOpen ? '1px solid var(--dash-border)' : 'none',
          cursor:'pointer', userSelect:'none', background: infoOpen ? 'transparent' : '#fafbff' }}
          onClick={()=>setInfoOpen(o=>!o)}>
          <span style={{ fontSize:11, fontWeight:700, color:'#3f51b5', textTransform:'uppercase', letterSpacing:'.6px', flex:1 }}>
            Project Information
          </span>
          <span style={{ color:'#aaa', display:'flex', alignItems:'center' }}>
            {infoOpen ? <ChevUp/> : <ChevDown/>}
          </span>
        </div>

        {infoOpen && <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'38% 1fr', gap:0 }}>

        {/* ── LEFT: Project fields ── */}
        <div style={{ paddingRight:24, borderRight:'1px solid var(--dash-border)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#3f51b5', textTransform:'uppercase',
            letterSpacing:'.6px', marginBottom:14 }}>Project Information</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px' }}>

            {/* Code */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Code</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#3f51b5', marginTop:2 }}>{projectCode}</div>
            </div>
            {/* Program */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Program</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', marginTop:2 }}>{project.program || project.Program || '—'}</div>
            </div>

            {/* Project Name — full width */}
            <div style={{ gridColumn:'1 / -1' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Project</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginTop:2 }}>{project.projectName || '—'}</div>
            </div>

            {/* Plant */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Plant</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', marginTop:2 }}>{project.plant || project.Plant || '—'}</div>
            </div>
            {/* Year */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Year</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', marginTop:2 }}>{project.plant_year || project.Plant_year || '—'}</div>
            </div>

            {/* Status */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Status</div>
              <div style={{ marginTop:4 }}>
                <span style={{
                  display:'inline-block', padding:'2px 10px', borderRadius:5, fontSize:12, fontWeight:700,
                  background: (project.status||'').toLowerCase()==='active' ? '#e8f5e9' : '#fff3e0',
                  color:      (project.status||'').toLowerCase()==='active' ? '#1b5e20' : '#e65100',
                  border:    `1px solid ${(project.status||'').toLowerCase()==='active' ? '#a5d6a7' : '#ffcc80'}`,
                }}>{project.status || project.Status || '—'}</span>
              </div>
            </div>
            {/* Department */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Department</div>
              <div style={{ marginTop:4, display:'flex', gap:5, flexWrap:'wrap' }}>
                {(project.flag3 || project.Flag3 || '').split(',').filter(Boolean).map(d => {
                  const isAVP = d.trim().toUpperCase() === 'AVP';
                  return (
                    <span key={d} style={{
                      padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
                      background: isAVP ? '#e3f2fd' : '#f3e5f5',
                      color:      isAVP ? '#1565c0' : '#6a1b9a',
                      border:    `1px solid ${isAVP ? '#90caf9' : '#ce93d8'}`,
                    }}>{d.trim()}</span>
                  );
                })}
                {!(project.flag3 || project.Flag3) && <span style={{color:'#ccc',fontSize:12}}>—</span>}
              </div>
            </div>

            {/* AVP Pilot */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>AVP Pilot</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1565c0', marginTop:2 }}>{project.avp_owner || project.Avp_owner || '—'}</div>
            </div>
            {/* WGDE Pilot */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>WGDE Pilot</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#6a1b9a', marginTop:2 }}>{project.wgte_owner || project.Wgte_owner || '—'}</div>
            </div>

          </div>

          {/* Audit row
          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--dash-border)',
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
            {[
              ['Created By',    project.created_by    || project.Created_by],
              ['Created Date',  fmtDate(project.created_date  || project.Created_date)],
              ['Modified By',   project.modified_by   || project.Modified_by],
              ['Modified Date', fmtDate(project.modified_date || project.Modified_date)],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>{lbl}</div>
                <div style={{ fontSize:12, fontWeight:500, color:'#666', marginTop:2 }}>{val || '—'}</div>
              </div>
            ))}
          </div> */}
        </div>

        {/* ── RIGHT: Milestone timeline ── */}
        {(() => {
          const TRACK_Y = 92, LPAD = 64, RPAD = 64;
          const EL_RX = 11, EL_RY = 7, CIR_R = 7;
          const H = 136, SPACING = 96;

          const norm = allMilestones.map(normMs)
            .sort((a,b) => (a.milestoneOrder||0) - (b.milestoneOrder||0));

          const isEmpty = norm.length === 0;
          const projMs = isEmpty
            ? DEFAULT_MILESTONE_NAMES.map(d => ({
                uid: d.name, milestoneName: d.name, milestoneOrder: d.order,
                status: 'Next Milestone', plannedDate: null,
              }))
            : norm;

          const n     = projMs.length;
          const today = new Date();

          const validDates = projMs.map(m => m.plannedDate ? new Date(m.plannedDate) : null).filter(Boolean);
          const hasRealDates = !isEmpty && validDates.length >= 1;

          const trackW = Math.max(400, (n - 1) * SPACING);

          let tStart = null, tEnd = null;
          let xPositions;
          if (hasRealDates) {
            // Always include today so the TODAY pin is always visible within the track
            const allTimes = [...validDates.map(d => d.getTime()), today.getTime()];
            const minT = Math.min(...allTimes);
            const maxT = Math.max(...allTimes);
            // Enforce a minimum 30-day range so a single milestone doesn't collapse to a point
            const range = Math.max(maxT - minT, 30 * 24 * 3600 * 1000);
            const pad   = range * 0.10;
            tStart = minT - pad;
            tEnd   = maxT + pad;
            const tRange = tEnd - tStart;
            xPositions = projMs.map(m =>
              m.plannedDate
                ? LPAD + ((new Date(m.plannedDate).getTime() - tStart) / tRange) * trackW
                : null
            );
            xPositions = xPositions.map((x, i) =>
              x !== null ? x : LPAD + (n > 1 ? (i / (n - 1)) * trackW : trackW / 2)
            );
          } else {
            xPositions = projMs.map((_, i) =>
              n === 1 ? LPAD + trackW / 2 : LPAD + (i / (n - 1)) * trackW
            );
          }
          // Enforce minimum gap so labels never collide
          const MIN_SEP = 72;
          for (let i = 1; i < xPositions.length; i++) {
            if (xPositions[i] - xPositions[i - 1] < MIN_SEP) xPositions[i] = xPositions[i - 1] + MIN_SEP;
          }
          const W = Math.max(LPAD + trackW + RPAD, xPositions[n - 1] + RPAD);

          // TODAY: always date-proportional when real dates; fixed ~35% for empty/no-date state
          let todayX;
          if (hasRealDates && tStart !== null && tEnd !== null) {
            // today is always within [tStart, tEnd] because it was included in the range
            todayX = LPAD + ((today.getTime() - tStart) / (tEnd - tStart)) * trackW;
          } else {
            todayX = LPAD + Math.round(trackW * 0.35);
          }

          const fmtDate = v => {
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

          const done        = projMs.filter(m => (m.status||'').toLowerCase()==='completed').length;
          const inProg      = projMs.filter(m => (m.status||'').toLowerCase()==='on going').length;
          const lastDoneIdx = projMs.reduce((acc, m, i) =>
            (m.status||'').toLowerCase()==='completed' ? i : acc, -1);

          const todayStr = fmtDate(today);

          return (
            <div style={{ paddingLeft:24, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
              {/* Header with Edit button */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#3f51b5', textTransform:'uppercase', letterSpacing:'.6px' }}>
                  Milestone Timeline
                </div>
                <span style={{ fontSize:11, color:'#888' }}>
                  {done}/{n} done{inProg > 0 ? ` · ${inProg} active` : ''}
                </span>
              </div>

              {isEmpty && (
                <div style={{ fontSize:11, color:'#bbb', fontStyle:'italic' }}>
                  No milestones configured for this project.
                </div>
              )}

              <div style={{ overflowX:'auto', overflowY:'visible', paddingBottom:4, minWidth:0 }}>
                <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display:'block' }}>

                  {/* Track */}
                  <line x1={LPAD} y1={TRACK_Y} x2={W-RPAD} y2={TRACK_Y}
                    stroke={isEmpty ? '#eee' : '#c8c8c8'} strokeWidth="5" strokeLinecap="round"/>

                  {/* Completed segment */}
                  {!isEmpty && lastDoneIdx >= 0 && (
                    <line x1={xPositions[0]} y1={TRACK_Y} x2={xPositions[lastDoneIdx]} y2={TRACK_Y}
                      stroke="#27ae60" strokeWidth="5" strokeLinecap="round"/>
                  )}

                  {/* TODAY: clean pin marker */}
                  {todayX !== null && (
                    <g>
                      {/* Date chip */}
                      <rect x={todayX-22} y={5} width={44} height={16} rx={3}
                        fill={isEmpty ? '#fff8f8' : '#ffebee'} stroke="#e53935" strokeWidth="1"/>
                      <text x={todayX} y={16} textAnchor="middle"
                        fontSize="8" fontWeight="700" fill="#e53935">{todayStr}</text>
                      {/* TODAY label */}
                      <text x={todayX} y={29} textAnchor="middle"
                        fontSize="7" fontWeight="800" fill="#e53935" letterSpacing=".5" opacity=".8">TODAY</text>
                      {/* Dashed vertical line */}
                      <line x1={todayX} y1={32} x2={todayX} y2={TRACK_Y-6}
                        stroke="#e53935" strokeWidth="1.5" strokeDasharray="4,3" opacity=".7"/>
                      {/* Filled circle at track */}
                      <circle cx={todayX} cy={TRACK_Y} r={5} fill="#e53935"/>
                    </g>
                  )}

                  {/* Milestones */}
                  {projMs.map((ms, i) => {
                    const x   = xPositions[i];
                    const cfg = dotCfg(isEmpty ? 'next milestone' : ms.status);
                    const lbl = ms.milestoneName || `M${i+1}`;
                    const ds  = fmtDate(ms.plannedDate);

                    return (
                      <g key={ms.uid || i}>
                        {/* Glow for on-going */}
                        {!isEmpty && (ms.status||'').toLowerCase()==='on going' && (
                          <ellipse cx={x} cy={TRACK_Y} rx={EL_RX+5} ry={EL_RY+4}
                            fill="none" stroke="#ce93d8" strokeWidth="2" opacity=".5"/>
                        )}

                        {/* Dot: ellipse for done/active, circle for pending */}
                        {cfg.type === 'ellipse'
                          ? <ellipse cx={x} cy={TRACK_Y} rx={EL_RX} ry={EL_RY} fill={cfg.fill}/>
                          : <circle cx={x} cy={TRACK_Y} r={CIR_R}
                              fill={cfg.fill} stroke={isEmpty ? '#ddd' : cfg.stroke} strokeWidth="2"/>
                        }

                        {/* ✓ check mark */}
                        {!isEmpty && (ms.status||'').toLowerCase()==='completed' && (
                          <text x={x} y={TRACK_Y+3.5} textAnchor="middle"
                            fontSize="8" fill="#fff" fontWeight="900">✓</text>
                        )}

                        {/* Date above track */}
                        {ds && (
                          <text x={x} y={TRACK_Y-14} textAnchor="middle"
                            fontSize="9" fill={isEmpty ? '#ccc' : '#444'}>
                            {ds}
                          </text>
                        )}

                        {/* Downward pole to name */}
                        <line x1={x} y1={TRACK_Y+EL_RY+1} x2={x} y2={TRACK_Y+EL_RY+16}
                          stroke={isEmpty ? '#ddd' : (cfg.type==='ellipse' ? cfg.fill : '#ccc')}
                          strokeWidth="1.5"/>

                        {/* Name below */}
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

              {/* Legend */}
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[
                  { c:'#1a1a1a', label:'Completed',      type:'ellipse' },
                  { c:'#7b1fa2', label:'On Going',       type:'ellipse' },
                  { c:'#aaa',    label:'Next Milestone', type:'circle'  },
                ].map(({c, label, type}) => (
                  <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, color:'#666' }}>
                    <svg width="14" height="10" style={{flexShrink:0}}>
                      {type === 'ellipse'
                        ? <ellipse cx="7" cy="5" rx="6" ry="4" fill={c}/>
                        : <circle cx="5" cy="5" r="4" fill="#fff" stroke={c} strokeWidth="1.5"/>
                      }
                    </svg>
                    {label}
                  </span>
                ))}
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, color:'#e53935' }}>
                  <svg width="10" height="10" style={{flexShrink:0}}>
                    <circle cx="5" cy="5" r="4" fill="#e53935"/>
                  </svg>
                  Today
                </span>
              </div>
            </div>
          );
        })()}
        </div>}
      </div>

      {/* ── Parts & Checklists table ─────────────────────────────────── */}
      <div className="mod-grid-card">

        {/* Toolbar */}
        <div className="mod-grid-meta" style={{ cursor:'default' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#3f51b5', textTransform:'uppercase', letterSpacing:'.6px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
            onClick={()=>setPartsOpen(o=>!o)}>
            MBOM Info
            <span style={{ color:'#aaa', display:'flex', alignItems:'center' }}>
              {partsOpen ? <ChevUp/> : <ChevDown/>}
            </span>
          </span>
          <span className="mod-count" style={{ marginLeft:8 }}>
            {links.length} part{links.length !== 1 ? 's' : ''}
          </span>
          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportPartTemplate}
              style={{display:'inline-flex',alignItems:'center',gap:5}}>
              ↓ Template
            </button>
            <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handleExportParts}
              style={{display:'inline-flex',alignItems:'center',gap:5}}>
              ↓ Export
            </button>
            <button className="mod-btn mod-btn-outline mod-btn-sm" onClick={handlePrintDetailPdf}
              style={{display:'inline-flex',alignItems:'center',gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print PDF
            </button>
            <button className="mod-btn mod-btn-outline mod-btn-sm"
              onClick={()=>xlPartRef.current?.click()} disabled={partImporting}
              style={{display:'inline-flex',alignItems:'center',gap:5}}>
              ↑ {partImporting?'Importing…':'Import'}
            </button>
            <input ref={xlPartRef} type="file" accept=".xlsx,.xls,.csv"
              style={{display:'none'}} onChange={handleImportParts}/>
            <button className="mod-btn mod-btn-primary mod-btn-sm"
              onClick={() => openPartDrawer('add')}
              style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
              <PlusIcon/> Add Part
            </button>
          </div>
        </div>

        {/* Table — hidden when collapsed */}
        {partsOpen && <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr>
              <th style={{width:36}}>#</th>
              <th>Type</th>
              <th>Part # LH</th>
              <th>Part # RH</th>
              <th>Part Name LH</th>
              <th>Part Name RH</th>
              <th style={{width:80}}>Part Rev RH</th>
              <th style={{width:100}}>Maturity State RH</th>
              <th style={{width:80}}>Part Rev LH</th>
              <th style={{width:100}}>Maturity State LH</th>
              {/* <th>Material</th> */}
              <th>Created By</th>
              {/* <th>Initiator</th> */}
              <th>LA # RH</th>
              <th>LA # LH</th>
              <th style={{width:100}}>Department</th>
              <th style={{width:100}}>Status</th>
              <th style={{width:96}}>Priority</th>
              <th style={{width:110}}>Target Completion</th>
              <th style={{width:90,textAlign:'center'}}>Issue Count</th>
              <th style={{width:80,textAlign:'center'}}>Actions</th>
            </tr></thead>
            <tbody>
              {links.length === 0 && (
                <tr className="mod-state-row">
                  <td colSpan={19}>
                    <div className="mod-state-box">
                      <FolderIcon/>
                      <span>No parts yet. Click <b>Add Part</b> to create the first checklist.</span>
                    </div>
                  </td>
                </tr>
              )}

              {links.map((lnk, i) => {
                const ex   = parsePartExtras(lnk.flag2 || lnk.Flag2 || '');
                const cell = (v) => <span style={{fontSize:12,color:'#555'}}>{v||'—'}</span>;

                return (
                  <tr key={lnk.uid} className="mod-tr">
                    <td className="mod-td-num">{i+1}</td>
                    <td>{cell(ex.partType)}</td>
                    <td style={{fontSize:13}}>{lnk.part_number_LH || lnk.Part_number_LH || '—'}</td>
                    <td style={{fontSize:13}}>{lnk.part_number_RH || lnk.Part_number_RH || '—'}</td>
                    <td style={{fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                      title={ex.partNameLH}>{ex.partNameLH || '—'}</td>
                    <td style={{fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                      title={ex.partNameRH}>{ex.partNameRH || '—'}</td>
                    {/* Revision Details */}
                    <td style={{fontSize:12,color:'#333'}}>{ex.revisionRH || <span style={{color:'#ccc'}}>—</span>}</td>
                    <td style={{fontSize:12,color:'#333'}}>{ex.maturityStateRH || <span style={{color:'#ccc'}}>—</span>}</td>
                    <td style={{fontSize:12,color:'#333'}}>{ex.revisionLH || <span style={{color:'#ccc'}}>—</span>}</td>
                    <td style={{fontSize:12,color:'#333'}}>{ex.maturityStateLH || <span style={{color:'#ccc'}}>—</span>}</td>
                    {/* <td>{cell(ex.material)}</td> */}
                    <td>{cell(ex.owner || lnk.created_by)}</td>
                    {/* <td>{cell(ex.initiator)}</td> */}
                    <td>{cell(ex.laRH)}</td>
                    <td>{cell(ex.laLH)}</td>

                    {/* Department + Checklist Doc (combined, each badge clickable) */}
                    <td>
                      {(() => {
                        const raw     = lnk.flag1 || lnk.Flag1 || '';
                        const depts   = raw.split(',').map(d=>d.trim()).filter(Boolean);
                        const avpDoc  = lnk.issue_number  || lnk.Issue_number  || '';
                        const wgdeDoc = lnk.flag3         || lnk.Flag3         || '';
                        if (!depts.length) return <span style={{color:'#ccc',fontSize:12}}>—</span>;
                        return (
                          <div style={{display:'flex',flexDirection:'column',gap:5}}>
                            {depts.map(d => {
                              const isAVP   = d.toUpperCase() === 'AVP';
                              const isMulti = depts.length > 1;
                              // AVP always uses issue_number; WGDE uses flag3 when both, else issue_number
                              const docNum  = isAVP ? avpDoc : (isMulti ? wgdeDoc || avpDoc : avpDoc);
                              const cfg = isAVP
                                ? {bg:'#e3f2fd',color:'#1565c0',border:'#90caf9',hbg:'#1565c0'}
                                : {bg:'#f3e5f5',color:'#6a1b9a',border:'#ce93d8',hbg:'#6a1b9a'};
                              return (
                                <div key={d}
                                  onClick={()=>docNum&&navigate(`/dashboard/dmrs/manage/${encodeURIComponent(docNum)}`,{state:{from:`/dashboard/projects/${uid}`,fromLabel:'Project Detail'}})}
                                  title={docNum ? `Open ${d} Checklist: ${docNum}` : `No checklist doc for ${d}`}
                                  style={{display:'inline-flex',alignItems:'center',
                                    padding:'2px 10px',borderRadius:5,cursor:docNum?'pointer':'default',
                                    background:cfg.bg,border:`1px solid ${cfg.border}`,
                                    transition:'filter .15s'}}
                                  onMouseEnter={e=>{if(docNum)e.currentTarget.style.filter='brightness(.93)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.filter='';}}
                                >
                                  <span style={{fontSize:11,fontWeight:700,color:cfg.color}}>{d}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>

                    {/* MBOM Status — dept-wise */}
                    <td>
                      {(() => {
                        const deptRaw = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
                        const hasAVP  = deptRaw.includes('avp');
                        const hasWGDE = deptRaw.includes('wgde');
                        const avpDoc  = lnk.issue_number || lnk.Issue_number || '';
                        const wgdeDoc = lnk.flag3        || lnk.Flag3        || '';
                        const avpTarget  = ex.targetCompletionAVP  || ex.targetCompletion || '';
                        const wgdeTarget = ex.targetCompletionWGDE || ex.targetCompletion || '';
                        if (!hasAVP && !hasWGDE) return <span style={{color:'#ccc',fontSize:12}}>—</span>;
                        const Badge = ({docNum, targetDateStr, deptClr, deptLabel}) => {
                          const key = getDocStatus(docNum, targetDateStr);
                          const cfg = MBOM_STATUS_CFG[key];
                          return (
                            <div style={{display:'flex',alignItems:'center',gap:4}}>
                              {/* <span style={{fontSize:9,fontWeight:800,color:deptClr,minWidth:28}}>{deptLabel}</span> */}
                              <span style={{
                                display:'inline-flex',alignItems:'center',
                                padding:'1px 7px',borderRadius:4,
                                background:cfg.bg,border:`1px solid ${cfg.border}`,
                                fontSize:10,fontWeight:700,color:cfg.color,
                                whiteSpace:'nowrap',letterSpacing:.2,
                              }}>{cfg.label}</span>
                            </div>
                          );
                        };
                        return (
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {hasAVP  && <Badge docNum={avpDoc}  targetDateStr={avpTarget}  deptClr='#1565c0' deptLabel='AVP'  />}
                            {hasWGDE && <Badge docNum={wgdeDoc} targetDateStr={wgdeTarget} deptClr='#6a1b9a' deptLabel='WGDE' />}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Priority — per department, manually set */}
                    <td>
                      {(() => {
                        const deptRaw = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
                        const hasAVP  = deptRaw.includes('avp');
                        const hasWGDE = deptRaw.includes('wgde');
                        if (!hasAVP && !hasWGDE) return <span style={{color:'#ccc',fontSize:12}}>—</span>;
                        const priCfg = p => {
                          if (p === 'High')   return {color:'#b71c1c', bg:'#ffebee', border:'#ef9a9a'};
                          if (p === 'Medium') return {color:'#bf360c', bg:'#fff3e0', border:'#ffb74d'};
                          if (p === 'Low')    return {color:'#1565c0', bg:'#e3f2fd', border:'#90caf9'};
                          return null;
                        };
                        const PBadge = ({pri, deptClr, deptLabel}) => {
                          const cfg = priCfg(pri);
                          return (
                            <div style={{display:'flex',alignItems:'center',gap:4}}>
                              {/* <span style={{fontSize:9,fontWeight:800,color:deptClr,minWidth:28}}>{deptLabel}</span> */}
                              {cfg
                                ? <span style={{padding:'1px 7px',borderRadius:4,fontSize:10,fontWeight:700,
                                    background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`,whiteSpace:'nowrap'}}>
                                    {pri}
                                  </span>
                                : <span style={{color:'#ccc',fontSize:11}}>—</span>
                              }
                            </div>
                          );
                        };
                        return (
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {hasAVP  && <PBadge pri={ex.priorityAVP}  deptClr='#1565c0' deptLabel='AVP'/>}
                            {hasWGDE && <PBadge pri={ex.priorityWGDE} deptClr='#6a1b9a' deptLabel='WGDE'/>}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Target Completion — dept-wise */}
                    <td>
                      {(() => {
                        const deptRaw = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
                        const hasAVP  = deptRaw.includes('avp');
                        const hasWGDE = deptRaw.includes('wgde');
                        const avpTgt  = ex.targetCompletionAVP  || ex.targetCompletion || '';
                        const wgdeTgt = ex.targetCompletionWGDE || ex.targetCompletion || '';
                        if (!hasAVP && !hasWGDE) return <span style={{color:'#ccc',fontSize:12}}>—</span>;
                        const today = new Date(); today.setHours(0,0,0,0);
                        const overdue = d => d && new Date(d).setHours(0,0,0,0) < today.getTime();
                        return (
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {hasAVP && (
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                {/* <span style={{fontSize:9,fontWeight:800,color:'#1565c0',minWidth:28}}>AVP</span> */}
                                <span style={{fontSize:11,fontWeight:500,
                                  color: avpTgt ? (overdue(avpTgt)?'#c62828':'#1565c0') : '#ccc'}}>
                                  {avpTgt ? fmtDate(avpTgt) : '—'}
                                </span>
                              </div>
                            )}
                            {hasWGDE && (
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                {/* <span style={{fontSize:9,fontWeight:800,color:'#6a1b9a',minWidth:28}}>WGDE</span> */}
                                <span style={{fontSize:11,fontWeight:500,
                                  color: wgdeTgt ? (overdue(wgdeTgt)?'#c62828':'#6a1b9a') : '#ccc'}}>
                                  {wgdeTgt ? fmtDate(wgdeTgt) : '—'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Issue Count — dept-wise stacked */}
                    <td style={{textAlign:'center'}}>
                      {(() => {
                        const avpDoc  = lnk.issue_number || lnk.Issue_number || '';
                        const wgdeDoc = lnk.flag3        || lnk.Flag3        || '';
                        const raw     = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
                        const hasAVP  = raw.includes('avp');
                        const hasWGDE = raw.includes('wgde');
                        const avpCnt  = avpDoc  ? allIssueDocs.filter(d=>d.flag1===avpDoc).length  : 0;
                        const wgdeCnt = wgdeDoc ? allIssueDocs.filter(d=>d.flag1===wgdeDoc).length : 0;
                        const badge = (cnt, doc, clr, bg, border, label) => cnt > 0
                          ? <span onClick={()=>navigate('/dashboard/issues',{state:{flag1:doc}})}
                              style={{display:'inline-flex',alignItems:'center',gap:4,padding:'1px 7px',
                                borderRadius:4,background:bg,color:clr,border:`1px solid ${border}`,
                                fontWeight:700,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}
                              title={`${cnt} ${label} issue${cnt!==1?'s':''}`}>
                              <span style={{fontSize:9,opacity:.7}}></span>{cnt}
                            </span>
                          : <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'1px 7px',
                              fontSize:11,color:'#ccc',whiteSpace:'nowrap'}}>
                              <span style={{fontSize:9}}></span>—
                            </span>;
                        return (
                          <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                            {hasAVP  && badge(avpCnt,  avpDoc,  '#1565c0','#e3f2fd','#90caf9','AVP')}
                            {hasWGDE && badge(wgdeCnt, wgdeDoc, '#6a1b9a','#f3e5f5','#ce93d8','WGDE')}
                            {!hasAVP && !hasWGDE && <span style={{color:'#ccc',fontSize:12}}>—</span>}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'inline-flex',gap:5,alignItems:'center'}}>
                        {/* Edit */}
                        <button title="Edit part"
                          onClick={()=>openPartDrawer('edit',lnk)}
                          style={{width:28,height:28,border:'none',borderRadius:6,cursor:'pointer',
                            display:'inline-flex',alignItems:'center',justifyContent:'center',
                            background:'#eef0ff',color:'#3f51b5',transition:'background .15s,color .15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#3f51b5';e.currentTarget.style.color='#fff';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#eef0ff';e.currentTarget.style.color='#3f51b5';}}>
                          <EditIcon/>
                        </button>
                        {/* Download */}
                        <button title="Download part report (PDF)"
                          onClick={()=>handleDownloadPart(lnk)}
                          style={{width:28,height:28,border:'none',borderRadius:6,cursor:'pointer',
                            display:'inline-flex',alignItems:'center',justifyContent:'center',
                            background:'#e8f5e9',color:'#2e7d32',transition:'background .15s,color .15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#2e7d32';e.currentTarget.style.color='#fff';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#e8f5e9';e.currentTarget.style.color='#2e7d32';}}>
                          <DownloadIcon/>
                        </button>
                        {/* View Part */}
                        <button title="View part details"
                          onClick={()=>openPartView(lnk)}
                          style={{width:28,height:28,border:'none',borderRadius:6,cursor:'pointer',
                            display:'inline-flex',alignItems:'center',justifyContent:'center',
                            background:'#e8f5e9',color:'#2e7d32',transition:'background .15s,color .15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#2e7d32';e.currentTarget.style.color='#fff';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#e8f5e9';e.currentTarget.style.color='#2e7d32';}}>
                          <EyeIcon/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </div>

      {/* ── View Part drawer ─────────────────────────────────────── */}
      {partViewMount && (<>
        <div className={`mod-drawer-overlay${partViewOpen?' open':''}`} onClick={closePartView}/>
        <aside className={`mod-drawer${partViewOpen?' open':''}`} style={{width:'42vw',minWidth:480,maxWidth:'96vw'}}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#2e7d3233'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e8f5e9',color:'#2e7d32'}}><EyeIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Part Info</h2>
                <p className="mod-drawer-subtitle">
                  {viewingLnk?.part_number_RH || viewingLnk?.Part_number_RH || viewingLnk?.part_number_LH || viewingLnk?.Part_number_LH || '—'}
                </p>
              </div>
            </div>
            <button className="mod-drawer-close" onClick={closePartView}>✕</button>
          </div>

          <div className="mod-drawer-body" style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>
            {(() => {
              if (!viewingLnk) return null;
              const vx = parsePartExtras(viewingLnk.flag2 || viewingLnk.Flag2 || '');
              const deptRaw  = (viewingLnk.flag1 || viewingLnk.Flag1 || '').toLowerCase();
              const hasAVP   = deptRaw.includes('avp');
              const hasWGDE  = deptRaw.includes('wgde');
              const avpDoc   = viewingLnk.issue_number || viewingLnk.Issue_number || '';
              const wgdeDoc  = viewingLnk.flag3 || viewingLnk.Flag3 || '';
              const avpTgt   = vx.targetCompletionAVP  || vx.targetCompletion || '';
              const wgdeTgt  = vx.targetCompletionWGDE || vx.targetCompletion || '';
              const today    = new Date(); today.setHours(0,0,0,0);
              const isOverdue= d => d && new Date(d).setHours(0,0,0,0) < today.getTime();

              const Section = ({title, children}) => (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:800,color:'#2e7d32',textTransform:'uppercase',
                    letterSpacing:.8,marginBottom:6,paddingBottom:3,
                    borderBottom:'1.5px solid #e8f5e9'}}>
                    {title}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px'}}>
                    {children}
                  </div>
                </div>
              );
              const VF = ({label, value, full}) => (
                <div style={{...(full ? {gridColumn:'1/-1'} : {}), display:'flex', alignItems:'baseline', gap:6, padding:'2px 0', borderBottom:'1px solid #f5f5f5'}}>
                  <span style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase',
                    letterSpacing:.4,flexShrink:0,minWidth:90}}>{label}</span>
                  <span style={{fontSize:12,color: value ? '#1a1a2e' : '#ccc', fontWeight: value ? 500 : 400}}>
                    {value || '—'}
                  </span>
                </div>
              );

              return (<>
                {/* Part Identity */}
                <Section title="Part Identity">
                  <VF label="Part # RH"       value={viewingLnk.part_number_RH || viewingLnk.Part_number_RH}/>
                  <VF label="Part # LH"       value={viewingLnk.part_number_LH || viewingLnk.Part_number_LH}/>
                  <VF label="Part Name RH"    value={vx.partNameRH}/>
                  <VF label="Part Name LH"    value={vx.partNameLH}/>
                  <VF label="Part Description" value={viewingLnk.part_Description || viewingLnk.Part_Description} full/>
                  <VF label="Type"       value={vx.partType}/>
                  <VF label="Zone / Area"     value={vx.zoneArea}/>
                  <VF label="Material"        value={vx.material}/>
                </Section>

                {/* Reference Numbers */}
                <Section title="Reference Numbers">
                  <VF label="PDEF # RH" value={vx.pdefRH}/>
                  <VF label="PDEF # LH" value={vx.pdefLH}/>
                  <VF label="LA # RH"   value={vx.laRH}/>
                  <VF label="LA # LH"   value={vx.laLH}/>
                  <VF label="PA # RH"   value={vx.paRH}/>
                  <VF label="PA # LH"   value={vx.paLH}/>
                </Section>

                {/* Department & Docs */}
                <Section title="Department & Checklist Docs">
                  {hasAVP && <VF label="AVP Doc #"  value={avpDoc}/>}
                  {hasWGDE && <VF label="WGDE Doc #" value={wgdeDoc}/>}
                  {hasAVP && (
                    <VF label="AVP Target Completion" value={avpTgt
                      ? <span style={{color: isOverdue(avpTgt)?'#c62828':'#1565c0'}}>{fmtDate(avpTgt)}</span>
                      : null}/>
                  )}
                  {hasWGDE && (
                    <VF label="WGDE Target Completion" value={wgdeTgt
                      ? <span style={{color: isOverdue(wgdeTgt)?'#c62828':'#6a1b9a'}}>{fmtDate(wgdeTgt)}</span>
                      : null}/>
                  )}
                </Section>

                {/* Parties */}
                <Section title="Parties">
                  <VF label="Owner"     value={vx.owner}/>
                  <VF label="Initiator" value={vx.initiator}/>
                  <VF label="Created By" value={viewingLnk.created_by}/>
                </Section>

                {/* Revision Details */}
                {(vx.revisionRH || vx.maturityStateRH || vx.revisionLH || vx.maturityStateLH) && (
                  <Section title="Revision Details">
                    <VF label="Part Revision RH"  value={vx.revisionRH}/>
                    <VF label="Maturity State RH" value={vx.maturityStateRH}/>
                    <VF label="Part Revision LH"  value={vx.revisionLH}/>
                    <VF label="Maturity State LH" value={vx.maturityStateLH}/>
                  </Section>
                )}

                {/* Part Images */}
                {(vx.imgLH || vx.imgRH) && (
                  <div>
                    <div style={{fontSize:10,fontWeight:800,color:'#2e7d32',textTransform:'uppercase',
                      letterSpacing:.8,marginBottom:10,paddingBottom:4,
                      borderBottom:'1.5px solid #e8f5e9'}}>
                      Part Images
                    </div>
                    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                      {['imgRH','imgLH'].map(key => vx[key] ? (
                        <div key={key} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:.5}}>
                            {key==='imgRH'?'RH':'LH'}
                          </span>
                          <img src={vx[key]} alt={key}
                            style={{maxWidth:180,maxHeight:140,borderRadius:8,border:'1px solid #eee',objectFit:'contain'}}/>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </>);
            })()}
          </div>

          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closePartView}>Close</button>
            <button className="mod-btn mod-btn-primary" onClick={()=>{ closePartView(); openPartDrawer('edit', viewingLnk); }}>
              Edit Part
            </button>
          </div>
        </aside>
      </>)}

      {/* ── Milestone side drawer ────────────────────────────────── */}
      {msDrawerMount && (<>
        <div className={`mod-drawer-overlay${msDrawerOpen?' open':''}`} onClick={closeMsDrawer}/>
        <aside className={`mod-drawer${msDrawerOpen?' open':''}`} style={{width:760,maxWidth:'96vw'}}>

          {/* Header */}
          <div className="mod-drawer-header" style={{borderBottomColor:'#7b1fa233'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#f3e5f5',color:'#7b1fa2'}}><MilestoneIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Milestones</h2>
                <p className="mod-drawer-subtitle">
                  {msDrawerLnk?.issue_number || msDrawerLnk?.Issue_number}
                  {(msDrawerLnk?.Part_Description || msDrawerLnk?.part_Description) &&
                    <> — {msDrawerLnk?.Part_Description || msDrawerLnk?.part_Description}</>}
                </p>
              </div>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center',marginRight:8}}>
              {['edit','chart'].map(t=>(
                <button key={t} onClick={()=>setMsDrawerTab(t)}
                  style={{padding:'5px 16px',borderRadius:6,border:'none',cursor:'pointer',
                    fontSize:12,fontWeight:600,transition:'background .15s',
                    background:msDrawerTab===t?'#7b1fa2':'#f3e5f5',
                    color:msDrawerTab===t?'#fff':'#7b1fa2'}}>
                  {t==='edit'?'✏ Edit':'📊 Chart'}
                </button>
              ))}
            </div>
            <button className="mod-drawer-close" onClick={closeMsDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="mod-drawer-body">
            {msLoading && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'48px 0',color:'#7b1fa2'}}>
                <div className="mod-spinner"/><span>Loading milestones…</span>
              </div>
            )}

            {/* ── EDIT TAB ── */}
            {!msLoading && msDrawerTab==='edit' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>

                {/* Progress summary bar */}
                {msRows.length>0 && (() => {
                  const done = msRows.filter(m=>m.status==='Completed').length;
                  const inProg = msRows.filter(m=>m.status==='On Going').length;
                  const pct = Math.round((done/msRows.length)*100);
                  return (
                    <div style={{background:'#faf7ff',border:'1px solid #e8d5f7',borderRadius:10,padding:'12px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#7b1fa2'}}>
                          Progress — {done} of {msRows.length} completed
                        </span>
                        <span style={{fontSize:13,fontWeight:800,color: pct===100?'#27ae60':'#7b1fa2'}}>{pct}%</span>
                      </div>
                      <div style={{height:8,background:'#e8d5f7',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,
                          background: pct===100?'#27ae60':'linear-gradient(90deg,#7b1fa2,#ab47bc)',
                          borderRadius:4,transition:'width .4s ease'}}/>
                      </div>
                      <div style={{display:'flex',gap:16,marginTop:8}}>
                        {[['#27ae60','Completed',done],['#3f51b5','On Going',inProg],['#bdc3c7','Next Milestone',msRows.length-done-inProg]].map(([c,l,n])=>(
                          <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#666'}}>
                            <span style={{width:8,height:8,borderRadius:'50%',background:c,flexShrink:0}}/>
                            {n} {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Grid */}
                <div style={{border:'1px solid #e8d5f7',borderRadius:10,overflow:'hidden',background:'#fff'}}>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,tableLayout:'fixed'}}>
                      <colgroup>
                        <col style={{width:36}}/>
                        <col style={{width:140}}/>
                        <col style={{width:136}}/>
                        <col style={{width:136}}/>
                        <col style={{width:126}}/>
                        <col style={{width:110}}/>
                        <col style={{width:130}}/>
                        <col/>
                        <col style={{width:40}}/>
                      </colgroup>
                      <thead>
                        <tr style={{background:'linear-gradient(135deg,#7b1fa2,#9c27b0)'}}>
                          {['#','Milestone Name','Planned Date','Completed Date','Status','Department','Owner','Notes',''].map((h,i)=>(
                            <th key={i} style={{
                              padding:'11px 12px',textAlign:'left',fontSize:10,fontWeight:700,
                              color:'rgba(255,255,255,0.9)',textTransform:'uppercase',
                              letterSpacing:'.6px',whiteSpace:'nowrap',
                              borderRight: i<6 ? '1px solid rgba(255,255,255,0.15)' : 'none'}}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msRows.length === 0 && (
                          <tr><td colSpan={7} style={{padding:'40px 0',textAlign:'center',color:'#bbb',fontSize:13}}>
                            No milestones yet. Click <strong>+ Add Milestone</strong> below.
                          </td></tr>
                        )}
                        {msRows.map((row, i) => {
                          const s = row.status || 'Next Milestone';
                          const sCfg = s==='Completed'
                            ? {dot:'#27ae60',bg:'#e8f5e9',text:'#1b5e20',border:'#a5d6a7'}
                            : s==='On Going'
                            ? {dot:'#3f51b5',bg:'#e8eaf6',text:'#283593',border:'#9fa8da'}
                            : {dot:'#bdc3c7',bg:'#fafafa',text:'#666',border:'#e0e0e0'};
                          const inp = {
                            height:36,padding:'0 10px',border:'1.5px solid #e8d5f7',
                            borderRadius:7,fontSize:13,outline:'none',
                            fontFamily:'inherit',background:'#fff',color:'#2d2d2d',
                            width:'100%',boxSizing:'border-box',
                          };
                          return (
                            <tr key={row.uid}
                              style={{borderBottom:'1px solid #f3eaff',background: i%2===0?'#fff':'#fdf9ff',
                                transition:'background .12s'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#f7f0ff'}
                              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fdf9ff'}>

                              {/* # */}
                              <td style={{padding:'10px 12px',textAlign:'center',verticalAlign:'middle'}}>
                                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                                  width:22,height:22,borderRadius:'50%',background:'#f3eaff',
                                  color:'#7b1fa2',fontSize:11,fontWeight:700}}>
                                  {i+1}
                                </span>
                              </td>

                              {/* Name */}
                              <td style={{padding:'8px 6px 8px 4px',verticalAlign:'middle'}}>
                                <input value={row.milestoneName||''} onChange={e=>smr(row.uid,'milestoneName',e.target.value)}
                                  placeholder="Milestone name…"
                                  style={{...inp,fontWeight:600,color:'#111'}}/>
                              </td>

                              {/* Planned Date */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input type="date"
                                  value={row.plannedDate?new Date(row.plannedDate).toISOString().split('T')[0]:''}
                                  onChange={e=>smr(row.uid,'plannedDate',e.target.value||null)}
                                  style={inp}/>
                              </td>

                              {/* Completed Date */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input type="date"
                                  value={row.completedDate?new Date(row.completedDate).toISOString().split('T')[0]:''}
                                  onChange={e=>smr(row.uid,'completedDate',e.target.value||null)}
                                  style={{...inp,borderColor:row.completedDate?'#a5d6a7':'#e8d5f7'}}/>
                              </td>

                              {/* Status */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <div style={{position:'relative'}}>
                                  <div style={{display:'flex',alignItems:'center',gap:7,
                                    height:36,padding:'0 10px',border:`1.5px solid ${sCfg.border}`,
                                    borderRadius:7,background:sCfg.bg,cursor:'pointer',position:'relative'}}>
                                    <span style={{width:7,height:7,borderRadius:'50%',background:sCfg.dot,flexShrink:0}}/>
                                    <select value={s} onChange={e=>smr(row.uid,'status',e.target.value)}
                                      style={{flex:1,border:'none',background:'transparent',fontSize:12,
                                        fontWeight:700,color:sCfg.text,outline:'none',
                                        fontFamily:'inherit',cursor:'pointer',appearance:'none',
                                        paddingRight:16}}>
                                      <option value="Next Milestone">Next Milestone</option>
                                      <option value="On Going">On Going</option>
                                      <option value="Completed">Completed</option>
                                    </select>
                                    <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                                      fontSize:9,color:sCfg.text,pointerEvents:'none'}}>▾</span>
                                  </div>
                                </div>
                              </td>

                              {/* Department */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <div style={{position:'relative'}}>
                                  <select value={row.department||''} onChange={e=>smr(row.uid,'department',e.target.value)}
                                    style={{...inp,paddingRight:26,appearance:'none',cursor:'pointer',
                                      color:row.department?'#3a1060':'#999'}}>
                                    <option value="">Dept…</option>
                                    <option value="AVP">AVP</option>
                                    <option value="WGDE">WGDE</option>
                                    <option value="Common">Common</option>
                                  </select>
                                  <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                                    fontSize:9,color:'#7b1fa2',pointerEvents:'none'}}>▾</span>
                                </div>
                              </td>

                              {/* Owner */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input value={row.owner||''} onChange={e=>smr(row.uid,'owner',e.target.value)}
                                  placeholder="Owner…"
                                  style={inp}/>
                              </td>

                              {/* Notes */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle'}}>
                                <input value={row.notes||''} onChange={e=>smr(row.uid,'notes',e.target.value)}
                                  placeholder="Optional notes…"
                                  style={inp}/>
                              </td>

                              {/* Delete */}
                              <td style={{padding:'8px 6px',verticalAlign:'middle',textAlign:'center'}}>
                                <button onClick={()=>removeMsRow(row.uid)} title="Remove milestone"
                                  style={{width:28,height:28,border:'none',borderRadius:7,cursor:'pointer',
                                    background:'#fff0f0',color:'#e53935',display:'inline-flex',
                                    alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.background='#e53935';e.currentTarget.style.color='#fff';e.currentTarget.style.transform='scale(1.1)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.background='#fff0f0';e.currentTarget.style.color='#e53935';e.currentTarget.style.transform='scale(1)';}}>
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

                {/* Add row + completion banner */}
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={addMsRow}
                    style={{display:'inline-flex',alignItems:'center',gap:7,
                      padding:'8px 18px',background:'#fff',color:'#7b1fa2',
                      border:'1.5px dashed #ce93d8',borderRadius:8,fontSize:12,
                      fontWeight:700,cursor:'pointer',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f9f0ff';e.currentTarget.style.borderStyle='solid';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderStyle='dashed';}}>
                    <PlusIcon/> Add Milestone
                  </button>

                  {msRows.length>0 && msRows.every(m=>m.status==='Completed') && (
                    <div style={{flex:1,padding:'9px 16px',background:'#e8f5e9',
                      border:'1px solid #a5d6a7',borderRadius:8,color:'#1b5e20',
                      fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16}}>🎉</span>
                      All milestones completed — part will be marked <strong>Completed</strong> on save.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── CHART TAB ── */}
            {!msLoading && msDrawerTab==='chart' && (
              <MilestoneTimeline milestones={msRows}/>
            )}
          </div>

          {/* Footer */}
          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeMsDrawer} disabled={msSaving}>
              Close
            </button>
            {msDrawerTab==='edit' && (
              <button onClick={handleSaveMilestones} disabled={msSaving}
                style={{height:38,padding:'0 20px',background:'#7b1fa2',color:'#fff',
                  border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',
                  opacity:msSaving?0.6:1}}>
                {msSaving?'Saving…':'Save Milestones'}
              </button>
            )}
          </div>
        </aside>
      </>)}

      {/* ── Project Milestone editor drawer ─────────────────────── */}
      {projMsMount && (<>
        <div className={`mod-drawer-overlay${projMsOpen?' open':''}`} onClick={closeProjMsDrawer}/>
        <aside className={`mod-drawer${projMsOpen?' open':''}`} style={{width:720,maxWidth:'96vw'}}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#7b1fa233'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#f3e5f5',color:'#7b1fa2'}}><MilestoneIcon/></div>
              <div>
                <h2 className="mod-drawer-title">Project Milestones</h2>
                <p className="mod-drawer-subtitle">{project?.projectName || ''}</p>
              </div>
            </div>
            <button className="mod-drawer-close" onClick={closeProjMsDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="mod-drawer-body">
            {projMsLoading
              ? <div style={{textAlign:'center',padding:'40px 0',color:'#888'}}>Loading milestones…</div>
              : <>
                  {/* Progress bar */}
                  {projMsRows.length > 0 && (() => {
                    const doneC = projMsRows.filter(r => (r.status||'').toLowerCase()==='completed').length;
                    const pct   = Math.round(doneC / projMsRows.length * 100);
                    return (
                      <div style={{marginBottom:16,padding:'12px 16px',background:'#f8f0ff',border:'1px solid #e1bee7',borderRadius:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:12,fontWeight:600,color:'#6a1b9a'}}>Progress — {doneC} of {projMsRows.length} completed</span>
                          <span style={{fontSize:12,fontWeight:700,color:'#6a1b9a'}}>{pct}%</span>
                        </div>
                        <div style={{height:6,background:'#e1bee7',borderRadius:3}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'#7b1fa2',borderRadius:3,transition:'width .3s'}}/>
                        </div>
                        <div style={{marginTop:8,display:'flex',gap:16,fontSize:11,color:'#888'}}>
                          <span style={{color:'#27ae60'}}>● {doneC} Completed</span>
                          <span style={{color:'#3f51b5'}}>● {projMsRows.filter(r=>(r.status||'').toLowerCase()==='on going').length} On Going</span>
                          <span>● {projMsRows.filter(r=>(r.status||'').toLowerCase()==='next milestone').length} Next Milestone</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Milestone table */}
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <colgroup>
                        <col style={{width:36}}/><col/><col style={{width:140}}/>
                        <col style={{width:130}}/><col style={{width:40}}/>
                      </colgroup>
                      <thead>
                        <tr style={{background:'#7b1fa2'}}>
                          {['#','Milestone','Date','Status',''].map(h => (
                            <th key={h} style={{padding:'10px 8px',color:'#fff',fontSize:11,fontWeight:700,
                              textTransform:'uppercase',letterSpacing:'.5px',textAlign:'left'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projMsRows.length === 0 && (
                          <tr><td colSpan={5} style={{textAlign:'center',padding:'24px',color:'#bbb',fontStyle:'italic'}}>
                            No milestones — click "+ Add Milestone" below.
                          </td></tr>
                        )}
                        {projMsRows.map((ms,i) => (
                          <tr key={ms.uid} style={{borderBottom:'1px solid #f3e5f5'}}>
                            <td style={{padding:'8px 6px',color:'#aaa',textAlign:'center',fontSize:12,fontWeight:600}}>{i+1}</td>
                            <td style={{padding:'8px 6px'}}>
                              <input value={ms.milestoneName||''} onChange={e=>sprojMs(ms.uid,'milestoneName',e.target.value)}
                                placeholder="Milestone name…"
                                style={{width:'100%',border:'1px solid #e1bee7',borderRadius:5,padding:'5px 8px',
                                  fontSize:12,outline:'none',background:'#fafafa',color:'#111',fontWeight:600}}/>
                            </td>
                            <td style={{padding:'8px 6px'}}>
                              <input type="date" value={ms.plannedDate ? ms.plannedDate.substring(0,10) : ''}
                                onChange={e=>sprojMs(ms.uid,'plannedDate',e.target.value||null)}
                                style={{width:'100%',border:'1px solid #e1bee7',borderRadius:5,padding:'5px 8px',
                                  fontSize:12,outline:'none',background:'#fafafa'}}/>
                            </td>
                            <td style={{padding:'8px 6px'}}>
                              <select value={ms.status||'Next Milestone'} onChange={e=>sprojMs(ms.uid,'status',e.target.value)}
                                style={{width:'100%',border:'1px solid #e1bee7',borderRadius:5,padding:'5px 8px',
                                  fontSize:12,background:'#fafafa',color:'#111',outline:'none'}}>
                                {['Next Milestone','On Going','Completed'].map(s=><option key={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{padding:'8px 4px',textAlign:'center'}}>
                              <button type="button" onClick={()=>removeProjMsRow(ms.uid)}
                                style={{background:'none',border:'none',cursor:'pointer',color:'#e57373',padding:4,
                                  display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:4}}>
                                <TrashIcon/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button type="button" onClick={addProjMsRow}
                    style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:7,
                      padding:'7px 16px',background:'#fff',color:'#7b1fa2',
                      border:'1.5px dashed #ce93d8',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    <PlusIcon/> Add Milestone
                  </button>
                </>
            }
          </div>

          <div className="mod-drawer-footer">
            <button onClick={closeProjMsDrawer}
              style={{height:38,padding:'0 18px',background:'#fff',color:'#555',
                border:'1.5px solid #ddd',borderRadius:7,fontSize:13,fontWeight:500,cursor:'pointer'}}>
              Close
            </button>
            <button onClick={handleSaveProjMs} disabled={projMsSaving}
              style={{height:38,padding:'0 20px',background:'#7b1fa2',color:'#fff',
                border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',
                opacity:projMsSaving?0.6:1}}>
              {projMsSaving ? 'Saving…' : 'Save Milestones'}
            </button>
          </div>
        </aside>
      </>)}

      {/* ── Add Part side drawer ─────────────────────────────────── */}
      {partDrawerMount && (<>
        <div className={`mod-drawer-overlay${partDrawerOpen?' open':''}`} onClick={closePartDrawer}/>
        <aside className={`mod-drawer${partDrawerOpen?' open':''}`}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#27ae6033'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e8f5e9',color:'#1b5e20'}}><PlusIcon/></div>
              <div>
                <h2 className="mod-drawer-title">{partDrawerMode==='edit'?'Edit Part':'Add Part'}</h2>
                <p className="mod-drawer-subtitle">
                  {partDrawerMode==='edit'
                    ? `Editing — ${editingLnk?.issue_number||''}`
                    : 'Enter part details — checklist document auto-assigned'}
                </p>
              </div>
            </div>
            <button className="mod-drawer-close" onClick={closePartDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="mod-drawer-body">

            {/* ── Part Identity ── */}
            <div className="mod-form-block"><div className="mod-section-title">Part Identity</div>
              <div className="mod-form-grid">
                <div className="mod-field">
                  <label>Part Number LH</label>
                  <input
                    value={partDrawerMode==='edit' ? (partForm.part_number_lh||'—') : (partForm.part_number_lh||'')}
                    readOnly={partDrawerMode==='edit'}
                    onChange={partDrawerMode==='add' ? e=>spf('part_number_lh',e.target.value) : undefined}
                    style={partDrawerMode==='edit' ? {background:'#f5f5f5',color:'#555',cursor:'default'} : {}}/>
                </div>
                <div className="mod-field">
                  <label>Part Number RH</label>
                  <input
                    value={partDrawerMode==='edit' ? (partForm.part_number_rh||'—') : (partForm.part_number_rh||'')}
                    readOnly={partDrawerMode==='edit'}
                    onChange={partDrawerMode==='add' ? e=>spf('part_number_rh',e.target.value) : undefined}
                    style={partDrawerMode==='edit' ? {background:'#f5f5f5',color:'#555',cursor:'default'} : {}}/>
                </div>
                <div className="mod-field mod-field-full">
                  <label>Part Description</label>
                  <input
                    value={partDrawerMode==='edit' ? (partForm.part_description||'—') : (partForm.part_description||'')}
                    readOnly={partDrawerMode==='edit'}
                    onChange={partDrawerMode==='add' ? e=>spf('part_description',e.target.value) : undefined}
                    style={partDrawerMode==='edit' ? {background:'#f5f5f5',color:'#555',cursor:'default'} : {}}/>
                </div>
                <div className="mod-field">
                  <label>Part Name LH</label>
                  <input
                    value={partDrawerMode==='edit' ? (partForm.partNameLH||'—') : (partForm.partNameLH||'')}
                    readOnly={partDrawerMode==='edit'}
                    onChange={partDrawerMode==='add' ? e=>spf('partNameLH',e.target.value) : undefined}
                    style={partDrawerMode==='edit' ? {background:'#f5f5f5',color:'#555',cursor:'default'} : {}}/>
                </div>
                <div className="mod-field">
                  <label>Part Name RH</label>
                  <input
                    value={partDrawerMode==='edit' ? (partForm.partNameRH||'—') : (partForm.partNameRH||'')}
                    readOnly={partDrawerMode==='edit'}
                    onChange={partDrawerMode==='add' ? e=>spf('partNameRH',e.target.value) : undefined}
                    style={partDrawerMode==='edit' ? {background:'#f5f5f5',color:'#555',cursor:'default'} : {}}/>
                </div>
                <div className="mod-field">
                  <label>Type</label>
                  {partDrawerMode==='edit' ? (
                    <input value={partForm.partType||'—'} readOnly
                      style={{background:'#f5f5f5',color:'#555',cursor:'default'}}/>
                  ) : (
                    <Sel value={partForm.partType||''} onChange={e=>spf('partType',e.target.value)}
                      options={metaOpts(meta,'Category')} placeholder="Select category…"/>
                  )}
                </div>
                <div className="mod-field">
                  <label>Zone / Area</label>
                  {partDrawerMode==='edit' ? (
                    <input value={partForm.zoneArea||'—'} readOnly
                      style={{background:'#f5f5f5',color:'#555',cursor:'default'}}/>
                  ) : (
                    <Sel value={partForm.zoneArea||''} onChange={e=>spf('zoneArea',e.target.value)}
                      options={metaOpts(meta,'Zone')} placeholder="Select zone…"/>
                  )}
                </div>
                {(partForm.deptAVP || partForm.deptWGDE) && (
                  <div className="mod-field">
                    <label>Priority</label>
                    {[
                      {show: partForm.deptAVP,  key:'priorityAVP',  deptLabel:'AVP',  deptClr:'#1565c0'},
                      {show: partForm.deptWGDE, key:'priorityWGDE', deptLabel:'WGDE', deptClr:'#6a1b9a'},
                    ].filter(d=>d.show).map(({key,deptLabel,deptClr})=>(
                      <div key={key} style={{marginTop:8}}>
                        <div style={{fontSize:10,fontWeight:800,color:deptClr,textTransform:'uppercase',
                          letterSpacing:'.4px',marginBottom:5}}>{deptLabel}</div>
                        <div style={{display:'flex',gap:8}}>
                          {[
                            {val:'High',   clr:'#b71c1c', bg:'#ffebee', border:'#ef9a9a'},
                            {val:'Medium', clr:'#bf360c', bg:'#fff3e0', border:'#ffb74d'},
                            {val:'Low',    clr:'#1565c0', bg:'#e3f2fd', border:'#90caf9'},
                          ].map(({val,clr,bg,border})=>(
                            <label key={val} style={{
                              display:'flex',alignItems:'center',gap:6,
                              padding:'4px 14px',borderRadius:6,cursor:'pointer',
                              fontSize:12,fontWeight:600,userSelect:'none',transition:'all .15s',
                              background: partForm[key]===val ? bg      : '#f5f5f5',
                              color:      partForm[key]===val ? clr     : '#888',
                              border:    `1.5px solid ${partForm[key]===val ? border : '#e0e0e0'}`,
                            }}>
                              <input type="radio" name={key} value={val}
                                checked={partForm[key]===val}
                                onChange={()=>spf(key,val)}
                                style={{accentColor:clr}}/>
                              {val}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mod-field">
                  <label>Department Applicability</label>
                  <div style={{display:'flex',gap:12,paddingTop:6,alignItems:'flex-start'}}>
                    {[['deptAVP','AVP','lockAVP','#1565c0','#e3f2fd','#90caf9'],
                      ['deptWGDE','WGDE','lockWGDE','#6a1b9a','#f3e5f5','#ce93d8']
                    ].map(([key,label,lockKey,clr,bg,border])=>{
                      const locked   = !!partForm[lockKey];
                      const checked  = !!partForm[key];
                      return (
                        <div key={key} style={{display:'flex',flexDirection:'column',gap:3}}>
                          <label style={{display:'flex',alignItems:'center',gap:8,
                            cursor: locked ? 'not-allowed' : 'pointer',
                            fontSize:13,fontWeight:600,
                            color: checked ? clr : '#555',
                            padding:'6px 14px',borderRadius:7,
                            background: checked ? bg : '#f5f5f5',
                            border: `1.5px solid ${checked ? border : '#e0e0e0'}`,
                            opacity: locked && !checked ? 0.5 : 1,
                            transition:'all .15s',userSelect:'none'}}>
                            <input type="checkbox" checked={checked}
                              disabled={locked}
                              onChange={e=>{ if(!locked) spf(key, e.target.checked); }}
                              style={{width:15,height:15,accentColor:clr,
                                cursor: locked ? 'not-allowed' : 'pointer'}}/>
                            {label}
                            {locked && (
                              <span title="Checklist document already created — cannot remove this department"
                                style={{fontSize:11,marginLeft:2}}>🔒</span>
                            )}
                          </label>
                          {locked && checked && (
                            <span style={{fontSize:10,color:'#888',paddingLeft:4}}>
                              Doc exists — locked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {partForm.deptAVP && (
                  <div className="mod-field">
                    <label style={{color:'#1565c0'}}>Target Completion — AVP</label>
                    <input type="date"
                      value={partForm.targetCompletionAVP ? partForm.targetCompletionAVP.slice(0,10) : ''}
                      onChange={e=>spf('targetCompletionAVP', e.target.value)}/>
                  </div>
                )}
                {partForm.deptWGDE && (
                  <div className="mod-field">
                    <label style={{color:'#6a1b9a'}}>Target Completion — WGDE</label>
                    <input type="date"
                      value={partForm.targetCompletionWGDE ? partForm.targetCompletionWGDE.slice(0,10) : ''}
                      onChange={e=>spf('targetCompletionWGDE', e.target.value)}/>
                  </div>
                )}
                <div className="mod-field mod-field-full">
                  <label>Material</label>
                  <Sel value={partForm.material} onChange={e=>spf('material',e.target.value)}
                    options={metaOpts(meta,'Material')} placeholder="Select material…"/>
                </div>
              </div>
            </div>

            {/* ── Parties ── */}
            <div className="mod-form-block"><div className="mod-section-title">Parties</div>
              <div className="mod-form-grid">
                <div className="mod-field">
                  <label>Initiator</label>
                  <input value={partForm.initiator}
                    onChange={e=>spf('initiator',e.target.value)}
                    placeholder="Initiator name…"/>
                </div>
                <div className="mod-field">
                  <label>Owner</label>
                  <Sel value={partForm.owner} onChange={e=>spf('owner',e.target.value)}
                    options={metaOpts(meta,'Owner')} placeholder="Select owner…"/>
                </div>
              </div>
            </div>

            {/* ── Document References ── */}
            <div className="mod-form-block" style={{marginBottom:0}}>
              <div className="mod-section-title">Document References</div>
              <div className="mod-form-grid">
                <div className="mod-field"><label>PDEF # RH</label>
                  <input value={partForm.pDEF_Number_RH} onChange={e=>spf('pDEF_Number_RH',e.target.value)} placeholder="RH"/>
                </div>
                <div className="mod-field"><label>PDEF # LH</label>
                  <input value={partForm.pDEF_Number_LH} onChange={e=>spf('pDEF_Number_LH',e.target.value)} placeholder="LH"/>
                </div>
                <div className="mod-field"><label>LA # RH</label>
                  <input value={partForm.lA_Num_RH} onChange={e=>spf('lA_Num_RH',e.target.value)} placeholder="RH"/>
                </div>
                <div className="mod-field"><label>LA # LH</label>
                  <input value={partForm.lA_Num_LH} onChange={e=>spf('lA_Num_LH',e.target.value)} placeholder="LH"/>
                </div>
                <div className="mod-field"><label>PA # RH</label>
                  <input value={partForm.pA_Num_RH} onChange={e=>spf('pA_Num_RH',e.target.value)} placeholder="RH"/>
                </div>
                <div className="mod-field"><label>PA # LH</label>
                  <input value={partForm.pA_Num_LH} onChange={e=>spf('pA_Num_LH',e.target.value)} placeholder="LH"/>
                </div>
              </div>
            </div>

            {/* ── Revision Details ── */}
            <div className="mod-form-block"><div className="mod-section-title">Revision Details</div>
              <div className="mod-form-grid">
                <div className="mod-field">
                  <label>Part Revision RH</label>
                  <input value={partForm.revisionRH||''}
                    onChange={e=>spf('revisionRH',e.target.value)}
                    placeholder="e.g. A, B, C…"/>
                </div>
                <div className="mod-field">
                  <label>Maturity State RH</label>
                  <Sel value={partForm.maturityStateRH}
                    onChange={e=>spf('maturityStateRH',e.target.value)}
                    options={['Frozen','Shared','WHAITAPP']}
                    placeholder="— Select —"/>
                </div>
                <div className="mod-field">
                  <label>Part Revision LH</label>
                  <input value={partForm.revisionLH||''}
                    onChange={e=>spf('revisionLH',e.target.value)}
                    placeholder="e.g. A, B, C…"/>
                </div>
                <div className="mod-field">
                  <label>Maturity State LH</label>
                  <Sel value={partForm.maturityStateLH}
                    onChange={e=>spf('maturityStateLH',e.target.value)}
                    options={['Frozen','Shared','WHAITAPP']}
                    placeholder="— Select —"/>
                </div>
              </div>
            </div>

            {/* ── Part Images ── */}
            <div className="mod-form-block" style={{marginBottom:0}}>
              <div className="mod-section-title">Part Images</div>
              <div className="mod-form-grid">
                <div className="mod-field">
                  <PartImageInput
                    label="Part Image LH"
                    value={partForm.imgLH||''}
                    onChange={v=>spf('imgLH',v)}
                  />
                </div>
                <div className="mod-field">
                  <PartImageInput
                    label="Part Image RH"
                    value={partForm.imgRH||''}
                    onChange={v=>spf('imgRH',v)}
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closePartDrawer} disabled={addPartSaving}>
              Cancel
            </button>
            <button className="mod-btn mod-btn-primary" onClick={handleSavePart} disabled={addPartSaving}>
              {addPartSaving ? 'Saving…' : partDrawerMode==='edit' ? 'Update Part' : 'Add Part'}
            </button>
          </div>
        </aside>
      </>)}

    </div>
  );
}
