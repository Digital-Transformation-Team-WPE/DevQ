import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  dmrsApi, checklistMasterApi, checklistMilestoneApi, issueDocApi,
  projectIssueLinkApi, projectsApi, partMilestoneApi, projectMilestoneApi,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import { generateChecklistManagePdf } from '../../utils/pdfReport';
import './DmrsManage.css';

// ── Helpers ────────────────────────────────────────────────────────────────────
const genUid     = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate      = v => v
  ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  : '—';
const fmtDateShort = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtDisplay = v => v
  ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  : '—';
const todayISO   = () => new Date().toISOString().split('T')[0];

// Milestone columns are fully dynamic — built from partMilestones at runtime.
const SYNC_OPTS = ['OK','Not OK','N/A'];
const SYNC_COLOR = { OK:'#27ae60', 'Not OK':'#e74c3c', Pending:'#e67e22', 'N/A':'#888' };
const SYNC_BG    = { OK:'#e8f9ee', 'Not OK':'#ffecec', Pending:'#fff3e0', 'N/A':'#f5f5f5' };

// ── Icons ──────────────────────────────────────────────────────────────────────
const Ic = {
  Back:()=>(
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Save:()=>(
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  Doc:()=>(
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Mile:()=>(
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Chk:()=>(
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Hist:()=>(
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
    </svg>
  ),
  Img:()=>(
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  ChevDown:()=>(
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevUp:()=>(
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  Eye:()=>(
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Trash:()=>(
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
    </svg>
  ),
  Pen:()=>(
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  ),
  Issue:()=>(
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const ClipboardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

// ── Primitives ─────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Open:          ['#e3f2fd','#1565c0'],
  Closed:        ['#f5f5f5','#555'],
  'In Progress': ['#fff3e0','#e65100'],
  'On Hold':     ['#fce4ec','#c62828'],
  Active:        ['#e8f5e9','#1b5e20'],
  Inactive:      ['#fce4ec','#c62828'],
};
const StatusBadge = ({v}) => {
  const [bg='#f5f5f5', col='#555'] = STATUS_CFG[v] || [];
  return <span className="dm-badge" style={{background:bg,color:col}}>{v||'—'}</span>;
};

const DF = ({label,value,wide,badge}) => (
  <div className={`dm-df${wide?' dm-df-wide':''}`}>
    <div className="dm-df-label">{label}</div>
    <div className="dm-df-value">{badge ?? (value||'—')}</div>
  </div>
);

function SectionCard({title,icon,iconBg,iconColor,children,actions,defaultOpen=true}) {
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div className={`dm-card${open?'':' dm-card-collapsed'}`}>
      <div className="dm-card-hdr">
        <div className="dm-card-title-row">
          <div className="dm-card-icon" style={{background:iconBg,color:iconColor}}>{icon}</div>
          <h3 className="dm-card-title">{title}</h3>
        </div>
        <div className="dm-card-hdr-right">
          {actions}
          <button className="dm-toggle-btn" type="button" onClick={()=>setOpen(o=>!o)}>
            {open ? <Ic.ChevUp/> : <Ic.ChevDown/>}
          </button>
        </div>
      </div>
      {open && <div className="dm-card-body">{children}</div>}
    </div>
  );
}

// Compact image/file attachment for table cell — uploads file to server, stores path
function MrsCell({value, onChange, disabled}) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    setUploading(true);
    try {
      const result = await dmrsApi.uploadImage(file);
      onChange(result.path);
    } catch (err) {
      Swal.fire({icon:'error', title:'Upload failed', text: err?.message || 'Could not save the file.', confirmButtonColor:'#3f51b5'});
    } finally {
      setUploading(false);
    }
  };

  const onFile = e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value=''; };

  const handlePasteBtn = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) { upload(await item.getType(imgType)); return; }
      }
      Swal.fire({icon:'info', title:'No image in clipboard', text:'Copy an image first, then click Paste.', confirmButtonColor:'#3f51b5', timer:2500, showConfirmButton:false, timerProgressBar:true});
    } catch {
      Swal.fire({icon:'warning', title:'Clipboard access denied', text:'Allow clipboard access or use Ctrl+V after clicking the cell.', confirmButtonColor:'#3f51b5'});
    }
  };

  // value is either a server path (/uploads/dmrs/...) or legacy base64 (data:image/...)
  const imgSrc = value || '';

  if (disabled) {
    return (
      <div className="dm-mrs-cell">
        {imgSrc
          ? <img src={imgSrc} alt="attachment" className="dm-mrs-thumb" style={{cursor:'default'}}/>
          : <span style={{color:'#bbb',fontSize:12}}>—</span>}
      </div>
    );
  }

  return (
    <div className="dm-mrs-cell" tabIndex={0} onPaste={e => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      upload(item.getAsFile());
    }}>
      <input ref={ref} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={onFile}/>
      {uploading
        ? <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#3f51b5',padding:'4px 0'}}>
            <div style={{width:12,height:12,border:'2px solid #3f51b5',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>
            Uploading…
          </div>
        : imgSrc
          ? <div className="dm-mrs-thumb-wrap">
              <img src={imgSrc} alt="attachment" className="dm-mrs-thumb"
                onClick={()=>ref.current.click()} title="Click to replace"/>
              <button type="button" className="dm-mrs-clr" onClick={()=>onChange('')} title="Remove">✕</button>
            </div>
          : <div className="dm-mrs-btn-row">
              <button type="button" className="dm-mrs-add" onClick={()=>ref.current.click()} title="Browse file">
                <Ic.Img/> Attach
              </button>
              <button type="button" className="dm-mrs-paste" onClick={handlePasteBtn} title="Paste image from clipboard">
                <ClipboardIcon/> Paste
              </button>
            </div>
      }
    </div>
  );
}

// ── Part Milestone Timeline (same chart as ProjectDetail milestone drawer) ──────
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
  if (!milestones.length) return (
    <div style={{textAlign:'center',padding:'60px 0',color:'#aaa',fontSize:14}}>
      No part milestones configured for this project. Add them via the Parts grid.
    </div>
  );

  const norm = milestones.map(normMs)
    .sort((a,b) => (a.milestoneOrder||0)-(b.milestoneOrder||0));

  const W = 900, LPAD = 70, RPAD = 70, LINE_Y = 155, H = 270;
  const trackW = W - LPAD - RPAD;

  const withDates = norm.filter(m => m.plannedDate);
  const useDates  = withDates.length >= 2;

  let minT = 0, maxT = 1;
  if (useDates) {
    const times = norm.filter(m => m.plannedDate).map(m => new Date(m.plannedDate).getTime());
    minT = Math.min(...times);
    maxT = Math.max(...times);
    if (minT === maxT) maxT = minT + 1;
  }

  const xOf = (m, i) => {
    if (useDates && m.plannedDate)
      return LPAD + ((new Date(m.plannedDate).getTime() - minT) / (maxT - minT)) * trackW;
    return LPAD + (norm.length === 1 ? trackW/2 : (i / (norm.length-1)) * trackW);
  };

  const fmtD = d => {
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  };

  const STATUS = {
    Completed:        { stroke:'#27ae60', fill:'#27ae60', lbl:'#1b5e20', ring:'#a5d6a7' },
    'On Going':       { stroke:'#7b1fa2', fill:'#9c27b0', lbl:'#4a148c', ring:'#ce93d8' },
    'Next Milestone': { stroke:'#bdbdbd', fill:'#fff',    lbl:'#666',    ring:'#e0e0e0' },
  };
  const cfg = s => STATUS[s] || STATUS['Next Milestone'];

  const done   = norm.filter(m => m.status==='Completed').length;
  const inProg = norm.filter(m => m.status==='On Going').length;
  // Use per-milestone completionRate if available (DmrsManage context), else binary
  const totalRate = norm.reduce((sum, m) => sum + (m.completionRate ?? (m.status === 'Completed' ? 1 : 0)), 0);
  const pct = Math.round((totalRate / norm.length) * 100);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0,marginTop:16,
      borderTop:'1px solid #f0f0f0',paddingTop:12}}>

      {/* Progress strip */}
      <div style={{padding:'12px 20px 10px',background:'#faf7ff',
        borderBottom:'1px solid #e8d5f7',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:'#7b1fa2'}}>
              {done} / {norm.length} milestones completed{inProg > 0 ? ` · ${inProg} on going` : ''}
            </span>
            <span style={{fontSize:14,fontWeight:800,color:pct===100?'#27ae60':'#7b1fa2'}}>{pct}%</span>
          </div>
          <div style={{height:7,background:'#e8d5f7',borderRadius:4,overflow:'hidden',position:'relative'}}>
            <div style={{position:'absolute',left:0,top:0,height:'100%',
              width:`${pct}%`,transition:'width .4s',
              background:pct===100?'#27ae60':'linear-gradient(90deg,#7b1fa2,#ab47bc)',
              borderRadius:4}}/>
            {done > 0 && (
              <div style={{position:'absolute',left:0,top:0,height:'100%',
                width:`${Math.round((done/norm.length)*100)}%`,transition:'width .4s',
                background:'#27ae60',borderRadius:4,opacity:0.85}}/>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:14}}>
          {[['#27ae60','Completed',done],['#9c27b0','On Going',inProg],['#bdbdbd','Next Milestone',norm.length-done-inProg]].map(([c,l,n])=>(
            <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#555',fontWeight:500}}>
              <span style={{width:9,height:9,borderRadius:'50%',background:c,flexShrink:0}}/>
              {n} {l}
            </span>
          ))}
        </div>
      </div>

      {/* SVG Timeline */}
      <div style={{overflowX:'auto',padding:'8px 0 4px'}}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
          style={{minWidth:520,display:'block'}}>

          {/* Completed segment fill */}
          {norm.length >= 2 && (() => {
            const completedUpto = [...norm].reverse().findIndex(m => m.status==='Completed');
            const lastDoneIdx = completedUpto>=0 ? norm.length-1-completedUpto : -1;
            if (lastDoneIdx >= 0) {
              const x0 = xOf(norm[0], 0);
              const x1 = xOf(norm[lastDoneIdx], lastDoneIdx);
              return <line x1={x0} y1={LINE_Y} x2={x1} y2={LINE_Y} stroke="#27ae60" strokeWidth="3" opacity=".5"/>;
            }
            return null;
          })()}

          {/* Background axis */}
          <line x1={LPAD-20} y1={LINE_Y} x2={W-RPAD+20} y2={LINE_Y} stroke="#dde" strokeWidth="2.5"/>

          {norm.map((ms, i) => {
            const x      = xOf(ms, i);
            const above  = i % 2 === 0;
            const c      = cfg(ms.status);
            const connY1 = above ? LINE_Y - 15 : LINE_Y + 15;
            const connY2 = above ? LINE_Y - 52 : LINE_Y + 52;
            const lblY   = above ? LINE_Y - 68 : LINE_Y + 84;
            const dateY  = above ? LINE_Y + 22 : LINE_Y - 22;

            return (
              <g key={ms.uid || i}>
                {ms.status==='On Going' && (
                  <circle cx={x} cy={LINE_Y} r={15} fill="none" stroke={c.ring} strokeWidth="2" opacity=".5"/>
                )}
                <line x1={x} y1={connY1} x2={x} y2={connY2}
                  stroke={c.ring} strokeWidth="1.5" strokeDasharray="4,3"/>
                <circle cx={x} cy={LINE_Y} r={10} fill={c.fill} stroke={c.stroke} strokeWidth="2.5"/>
                {ms.status==='Completed' && (
                  <text x={x} y={LINE_Y+4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="900">✓</text>
                )}
                {ms.status==='On Going' && (
                  <text x={x} y={LINE_Y+4} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">▶</text>
                )}
                <text x={x} y={lblY} textAnchor="middle" fontSize="12" fontWeight="700" fill={c.lbl}>
                  {ms.milestoneName}
                </text>
                <text x={x} y={dateY} textAnchor="middle" fontSize="10" fill="#999">
                  {ms.plannedDate ? fmtD(ms.plannedDate) : '—'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:20,justifyContent:'center',padding:'10px 0',
        borderTop:'1px solid #f3eaff',background:'#fdf9ff'}}>
        {[['#27ae60','Completed'],['#9c27b0','On Going'],['#bdbdbd','Next Milestone']].map(([col,lbl])=>(
          <span key={lbl} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,color:'#666'}}>
            <span style={{width:10,height:10,borderRadius:'50%',background:col}}/>
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Annotation Canvas (compact, for attaching drawn notes to checklist rows) ───
const DC_LOGICAL_W = 480, DC_LOGICAL_H = 280; // CSS / logical size
const DC_W = DC_LOGICAL_W, DC_H = DC_LOGICAL_H; // kept for compat; physical size set per-DPR in init
const DC_TOOLS = ['pen','highlighter','arrow','box','text','select'];
const DC_LBL   = { pen:'Pen', highlighter:'Hl', arrow:'Arrow', box:'Box', text:'Note', select:'Move' };
const dcHandles = l => [
  {id:'nw',cx:l.x,     cy:l.y      }, {id:'ne',cx:l.x+l.w,cy:l.y      },
  {id:'sw',cx:l.x,     cy:l.y+l.h  }, {id:'se',cx:l.x+l.w,cy:l.y+l.h  },
];
const dcHitHandle = (x,y,l) => {
  for (const h of dcHandles(l)) if (Math.abs(x-h.cx)<=8 && Math.abs(y-h.cy)<=8) return h.id;
  return null;
};

function DmrsCanvas({ targetLabel, targetInfo, onCapture, canvasMode = 'normal', onModeChange }) {
  const mainRef=useRef(null), inkRef=useRef(null), fileRef=useRef(null);
  const imgRef=useRef([]), selRef=useRef(null);
  const dragRef=useRef({active:false,lx:0,ly:0});
  const resRef=useRef({active:false,hid:null,sx:0,sy:0,orig:null});
  const drawRef=useRef({active:false,x0:0,y0:0,snap:null});
  const undoRef=useRef([]);
  const [tick,     setTick    ] = useState(0);
  const [uLen,     setULen    ] = useState(0);
  const [tool,     setTool    ] = useState('pen');
  const [col,      setCol     ] = useState('#e74c3c');
  const [lw,       setLw      ] = useState('3');
  const [cvSize,   setCvSize  ] = useState({w: DC_W, h: DC_H});
  const [attached, setAttached] = useState(false);
  const attachTimer = useRef(null);
  const bump = useCallback(() => setTick(t=>t+1), []);

  const handleCapture = useCallback(() => {
    if (!mainRef.current || !onCapture) return;
    onCapture(mainRef.current.toDataURL('image/png'));
    setAttached(true);
    clearTimeout(attachTimer.current);
    attachTimer.current = setTimeout(() => setAttached(false), 2500);
  }, [onCapture]);

  // Init ink canvas once at screen resolution × DPR — never resized after this
  useEffect(() => {
    const dpr  = Math.min(window.devicePixelRatio || 1, 3);
    const initW = Math.min(Math.round((window.screen?.width || 1920) * dpr), 4096);
    const initH = Math.round(initW * (DC_LOGICAL_H / DC_LOGICAL_W));
    const ink = document.createElement('canvas');
    ink.width = initW; ink.height = initH;
    inkRef.current = ink;
    setCvSize({ w: initW, h: initH });
    bump();
  }, [bump]);

  useEffect(() => {
    const main=mainRef.current, ink=inkRef.current;
    if (!main || !ink) return;
    const ctx = main.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, main.width, main.height);
    imgRef.current.forEach(l => {
      ctx.drawImage(l.imgEl, l.x, l.y, l.w, l.h);
      if (l.id === selRef.current) {
        ctx.save(); ctx.strokeStyle='#3f51b5'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.strokeRect(l.x-2, l.y-2, l.w+4, l.h+4); ctx.restore();
        dcHandles(l).forEach(h => {
          ctx.beginPath(); ctx.arc(h.cx, h.cy, 5, 0, Math.PI*2);
          ctx.fillStyle='#fff'; ctx.strokeStyle='#3f51b5'; ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
        });
      }
    });
    ctx.drawImage(ink, 0, 0);
  }, [tick]);

  const getPos = e => {
    const c=mainRef.current, r=c.getBoundingClientRect(), sx=c.width/r.width, sy=c.height/r.height;
    const s = e.touches ? e.touches[0] : e;
    return { x:(s.clientX-r.left)*sx, y:(s.clientY-r.top)*sy };
  };

  const pushUndo = useCallback(() => {
    const ink = inkRef.current; if (!ink) return;
    undoRef.current = [...undoRef.current.slice(-19), {
      inkData: ink.getContext('2d').getImageData(0, 0, ink.width, ink.height),
      layers:  imgRef.current.map(l => ({...l})),
    }];
    setULen(undoRef.current.length);
  }, []);

  const addImg = useCallback(src => {
    const img = new Image();
    img.onload = () => {
      const cw=inkRef.current?.width||DC_W, ch=inkRef.current?.height||DC_H;
      const sc=Math.min(cw/img.naturalWidth, ch/img.naturalHeight, 0.85);
      const w=img.naturalWidth*sc, h=img.naturalHeight*sc;
      pushUndo();
      imgRef.current = [...imgRef.current, {id:genUid(), imgEl:img, x:(cw-w)/2, y:(ch-h)/2, w, h}];
      bump();
    };
    img.src = src;
  }, [pushUndo, bump]);

  useEffect(() => {
    const h = e => {
      const item = Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
      if (item) addImg(URL.createObjectURL(item.getAsFile()));
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }, [addImg]);

  const doUndo = () => {
    if (!undoRef.current.length) return;
    const s = undoRef.current[undoRef.current.length-1];
    inkRef.current.getContext('2d').putImageData(s.inkData, 0, 0);
    imgRef.current = s.layers.map(l=>({...l})); selRef.current = null;
    undoRef.current = undoRef.current.slice(0, -1); setULen(undoRef.current.length); bump();
  };

  const doClear = () => {
    if (!inkRef.current) return;
    pushUndo();
    const ctx = inkRef.current.getContext('2d');
    ctx.clearRect(0, 0, inkRef.current.width, inkRef.current.height);
    imgRef.current = []; selRef.current = null; bump();
  };

  const applyCtx = (ctx, hl) => {
    ctx.strokeStyle = col; ctx.lineWidth = hl ? parseInt(lw)*7 : parseInt(lw);
    ctx.lineCap = 'square'; ctx.lineJoin = 'round';
    ctx.globalAlpha = hl ? 0.38 : 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawArr = (ctx,x1,y1,x2,y2) => {
    const h=14, a=Math.atan2(y2-y1, x2-x1);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2,y2); ctx.lineTo(x2-h*Math.cos(a-Math.PI/6), y2-h*Math.sin(a-Math.PI/6));
    ctx.moveTo(x2,y2); ctx.lineTo(x2-h*Math.cos(a+Math.PI/6), y2-h*Math.sin(a+Math.PI/6));
    ctx.stroke();
  };

  const onDown = e => {
    e.preventDefault(); const p = getPos(e);
    if (tool === 'select') {
      if (selRef.current) {
        const sl = imgRef.current.find(l=>l.id===selRef.current);
        if (sl) { const hid=dcHitHandle(p.x,p.y,sl); if (hid) { pushUndo(); resRef.current={active:true,hid,sx:p.x,sy:p.y,orig:{...sl}}; return; } }
      }
      const hit = [...imgRef.current].reverse().find(l=>p.x>=l.x&&p.x<=l.x+l.w&&p.y>=l.y&&p.y<=l.y+l.h);
      selRef.current=hit?.id||null; dragRef.current={active:!!hit,lx:p.x,ly:p.y}; bump(); return;
    }
    if (tool === 'text') {
      const txt = window.prompt('Enter note:');
      if (txt) {
        pushUndo();
        const ctx = inkRef.current.getContext('2d');
        ctx.globalAlpha = 1; ctx.fillStyle = col;
        ctx.font = `${parseInt(lw)*5+12}px "Segoe UI",sans-serif`;
        ctx.fillText(txt, p.x, p.y);
        bump();
      }
      return;
    }
    pushUndo();
    const ctx = inkRef.current.getContext('2d'); applyCtx(ctx, tool==='highlighter');
    const ink=inkRef.current;
    drawRef.current = {active:true, x0:p.x, y0:p.y, snap:ctx.getImageData(0,0,ink.width,ink.height)};
    if (tool==='pen') { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    if (tool==='highlighter') { drawRef.current.pts = [{x:p.x, y:p.y}]; }
  };

  const onMove = e => {
    e.preventDefault(); const p = getPos(e);
    if (tool==='select' && resRef.current.active) {
      const dx=p.x-resRef.current.sx, dy=p.y-resRef.current.sy, o=resRef.current.orig;
      let nx=o.x, ny=o.y, nw=o.w, nh=o.h;
      switch(resRef.current.hid) {
        case 'se': nw=o.w+dx; nh=o.h+dy; break; case 'sw': nx=o.x+dx; nw=o.w-dx; nh=o.h+dy; break;
        case 'ne': nw=o.w+dx; ny=o.y+dy; nh=o.h-dy; break; case 'nw': nx=o.x+dx; ny=o.y+dy; nw=o.w-dx; nh=o.h-dy; break;
      }
      nw=Math.max(20,nw); nh=Math.max(20,nh);
      imgRef.current = imgRef.current.map(l=>l.id===o.id?{...l,x:nx,y:ny,w:nw,h:nh}:l); bump(); return;
    }
    if (tool==='select' && dragRef.current.active) {
      const dx=p.x-dragRef.current.lx, dy=p.y-dragRef.current.ly;
      dragRef.current.lx=p.x; dragRef.current.ly=p.y;
      const id=selRef.current; if (id) { imgRef.current=imgRef.current.map(l=>l.id===id?{...l,x:l.x+dx,y:l.y+dy}:l); bump(); } return;
    }
    if (!drawRef.current.active) return;
    const ink=inkRef.current, ctx=ink.getContext('2d'), hl=tool==='highlighter';
    applyCtx(ctx, hl);
    if (tool==='pen') { ctx.lineTo(p.x,p.y); ctx.stroke(); bump(); }
    else if (tool==='highlighter') {
      // Rubber-band: restore snap then redraw full path once — prevents alpha accumulation
      drawRef.current.pts.push({x:p.x, y:p.y});
      ctx.putImageData(drawRef.current.snap, 0, 0);
      applyCtx(ctx, true);
      const pts = drawRef.current.pts;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); bump();
    } else {
      ctx.putImageData(drawRef.current.snap, 0, 0); ctx.globalAlpha=1; ctx.strokeStyle=col; ctx.lineWidth=parseInt(lw);
      if (tool==='box')   ctx.strokeRect(drawRef.current.x0, drawRef.current.y0, p.x-drawRef.current.x0, p.y-drawRef.current.y0);
      if (tool==='arrow') drawArr(ctx, drawRef.current.x0, drawRef.current.y0, p.x, p.y);
      bump();
    }
  };

  const onUp = e => {
    if (drawRef.current.active||dragRef.current.active||resRef.current.active) e.preventDefault?.();
    drawRef.current.active=false; dragRef.current.active=false; resRef.current.active=false;
    if (inkRef.current) { const c=inkRef.current.getContext('2d'); c.globalAlpha=1; c.globalCompositeOperation='source-over'; }
    bump();
  };

  const onFile = e => { Array.from(e.target.files||[]).forEach(f=>addImg(URL.createObjectURL(f))); e.target.value=''; };
  const csr = tool!=='select' ? 'crosshair' : dragRef.current.active ? 'grabbing' : 'default';
  const tBtn = t => (
    <button key={t} type="button" onClick={()=>setTool(t)}
      style={{padding:'3px 7px',fontSize:10,borderRadius:4,cursor:'pointer',border:'1px solid',
        background:tool===t?'#3f51b5':'#fff', color:tool===t?'#fff':'#444',
        borderColor:tool===t?'#3f51b5':'#ddd', whiteSpace:'nowrap'}}>
      {DC_LBL[t]}
    </button>
  );

  const isMin = canvasMode === 'minimized';
  const isMax = canvasMode === 'maximized';

  const iconBtn = (title, onClick, children, active = false) => (
    <button type="button" onClick={onClick} title={title}
      style={{width:24,height:24,border:'1px solid #dde2f0',borderRadius:4,cursor:'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0,
        background: active ? '#3f51b5' : '#f8f9fa',
        color:      active ? '#fff'    : '#555',
        transition:'background .15s,color .15s'}}>
      {children}
    </button>
  );

  // Header — always visible in every mode
  const header = (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{flex:1,minWidth:0}}>
        {targetLabel ? (
          <div style={{padding:'5px 8px',background:'#e8edf8',borderRadius:5,borderLeft:'3px solid #3f51b5'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#3f51b5',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {targetLabel}
            </div>
            {targetInfo?.description && (
              <div style={{fontSize:10,color:'#5c6bc0',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {targetInfo.description}
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize:11,color:'#aaa',padding:'4px 8px',background:'#f8f9fa',
            borderRadius:5,border:'1px dashed #ddd',textAlign:'center',whiteSpace:'nowrap'}}>
            {isMin ? 'Canvas' : 'Click on a row to target it'}
          </div>
        )}
      </div>
      {/* Minimize button — hidden when already maximized */}
      {!isMax && iconBtn(
        isMin ? 'Restore canvas' : 'Minimize canvas',
        () => onModeChange?.(isMin ? 'normal' : 'minimized'),
        isMin ? '▲' : '▬',
        isMin,
      )}
      {/* Maximize / Restore button */}
      {iconBtn(
        isMax ? 'Restore canvas' : 'Maximize canvas',
        () => onModeChange?.(isMax ? 'normal' : 'maximized'),
        isMax ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        ),
        isMax,
      )}
    </div>
  );

  // Body (toolbar + canvas + capture) — hidden when minimized, shown otherwise
  const body = (
    <div style={{display: isMin ? 'none' : 'flex', flexDirection:'column', gap:6, position:'relative'}}>
      {!targetLabel && (
        <div style={{position:'absolute',inset:0,zIndex:5,borderRadius:6,
          background:'rgba(248,249,252,0.88)',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:8,backdropFilter:'blur(1px)'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span style={{fontSize:13,color:'#bbb',fontWeight:600}}>Select a row first</span>
          <span style={{fontSize:11,color:'#ccc'}}>Click any row in the table to begin</span>
        </div>
      )}
      {/* Toolbar */}
      <div style={{display:'flex',flexWrap:'wrap',gap:3,alignItems:'center',padding:'5px 6px',
        background:'#f8f9fa',border:'1px solid #e0e4ef',borderRadius:6}}>
        <div style={{display:'flex',gap:3}}>{DC_TOOLS.map(tBtn)}</div>
        <div style={{display:'flex',gap:4,alignItems:'center',marginLeft:'auto'}}>
          <input type="color" value={col} onChange={e=>setCol(e.target.value)}
            style={{width:22,height:22,border:'none',padding:0,cursor:'pointer',borderRadius:3}}/>
          <select value={lw} onChange={e=>setLw(e.target.value)}
            style={{fontSize:10,padding:'2px 3px',border:'1px solid #ddd',borderRadius:3}}>
            {['2','3','5','8'].map(w=><option key={w} value={w}>{w}px</option>)}
          </select>
          <button type="button" onClick={doUndo} disabled={uLen===0} title="Undo last stroke"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,
              padding:'2px 7px',fontSize:10,borderRadius:4,cursor:uLen?'pointer':'not-allowed',
              border:'1px solid #ddd',background:'#fff',color:'#111',opacity:uLen?1:0.4}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
            </svg>
            Undo
          </button>
          <button type="button" onClick={()=>fileRef.current.click()} title="Add image to canvas"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,
              padding:'2px 7px',fontSize:10,borderRadius:4,cursor:'pointer',
              border:'1px solid #ddd',background:'#fff',color:'#111'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            +Img
          </button>
          <button type="button" onClick={doClear} title="Clear entire canvas"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,
              padding:'2px 7px',fontSize:10,borderRadius:4,cursor:'pointer',
              border:'1px solid #f5c6c6',background:'#fff5f5',color:'#c0392b'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Clear
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={onFile}/>
        </div>
      </div>
      {/* Canvas */}
      <div style={{position:'relative',border:'1px solid #dde2f0',borderRadius:5,background:'#fff',overflow:'hidden'}}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();Array.from(e.dataTransfer.files||[]).filter(f=>f.type.startsWith('image/')).forEach(f=>addImg(URL.createObjectURL(f)));}}>
        <canvas ref={mainRef} width={cvSize.w} height={cvSize.h}
          style={{display:'block',width:'100%',height:'auto',touchAction:'none',cursor:csr}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
        <div style={{position:'absolute',bottom:4,left:'50%',transform:'translateX(-50%)',
          fontSize:10,color:'#ccc',pointerEvents:'none',whiteSpace:'nowrap'}}>
          Drag &amp; Drop • Ctrl+V
        </div>
      </div>
      {/* Capture */}
      <button type="button"
        onClick={handleCapture}
        disabled={!targetLabel}
        style={{padding:'7px 14px',background:attached?'#27ae60':targetLabel?'#3f51b5':'#ccc',color:'#fff',border:'none',
          borderRadius:6,fontSize:12,fontWeight:700,cursor:targetLabel?'pointer':'not-allowed',
          display:'flex',alignItems:'center',justifyContent:'center',gap:5,transition:'background .2s'}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {attached
            ? <polyline points="20 6 9 17 4 12"/>
            : <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}
        </svg>
        {attached ? '✓ Attached!' : targetLabel ? 'Capture & Attach to Row' : 'Select a row first (→)'}
      </button>
    </div>
  );

  // ── Maximized: right-side drawer ─────────────────────────────
  // Rendered via portal at document.body so the fixed overlay always sits above
  // any sticky/z-index stacking contexts created by ancestor table headers.
  if (isMax) {
    return createPortal(
      <>
        {/* Backdrop */}
        <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.48)',backdropFilter:'blur(2px)'}}
          onClick={() => onModeChange?.('normal')}/>

        {/* Drawer panel — strict flex column, no overflow:hidden so children control their own layout */}
        <div style={{position:'fixed',top:0,right:0,bottom:0,zIndex:1001,
          width:'min(78vw,1020px)',background:'#fff',
          boxShadow:'-6px 0 40px rgba(0,0,0,0.22)',
          display:'flex',flexDirection:'column'}}>

          {/* ① Header — pinned */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
            flexShrink:0,background:'#f0f2ff',borderBottom:'2px solid #d8ddf5'}}>
            <div style={{flex:1,minWidth:0}}>
              {targetLabel ? (
                <div>
                  <div style={{fontWeight:700,color:'#3f51b5',fontSize:14,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {targetLabel}
                  </div>
                  {targetInfo?.description && (
                    <div style={{fontSize:11,color:'#5c6bc0',marginTop:2,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {targetInfo.description}
                    </div>
                  )}
                </div>
              ) : (
                <span style={{fontSize:13,color:'#aaa'}}>Click on a row to target it</span>
              )}
            </div>
            <button type="button" onClick={() => onModeChange?.('normal')} title="Restore canvas"
              style={{width:32,height:32,border:'none',borderRadius:8,background:'#e8edf8',
                color:'#3f51b5',cursor:'pointer',display:'flex',alignItems:'center',
                justifyContent:'center',flexShrink:0,transition:'background .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#3f51b5';e.currentTarget.style.color='#fff';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#e8edf8';e.currentTarget.style.color='#3f51b5';}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
              </svg>
            </button>
          </div>

          {/* ② Toolbar — pinned */}
          <div style={{flexShrink:0,display:'flex',flexWrap:'wrap',gap:3,alignItems:'center',
            padding:'6px 12px',background:'#f8f9fa',borderBottom:'1px solid #e0e4ef'}}>
            <div style={{display:'flex',gap:3}}>{DC_TOOLS.map(tBtn)}</div>
            <div style={{display:'flex',gap:4,alignItems:'center',marginLeft:'auto'}}>
              <input type="color" value={col} onChange={e=>setCol(e.target.value)}
                style={{width:22,height:22,border:'none',padding:0,cursor:'pointer',borderRadius:3}}/>
              <select value={lw} onChange={e=>setLw(e.target.value)}
                style={{fontSize:10,padding:'2px 3px',border:'1px solid #ddd',borderRadius:3}}>
                {['2','3','5','8'].map(w=><option key={w} value={w}>{w}px</option>)}
              </select>
              <button type="button" onClick={doUndo} disabled={uLen===0} title="Undo"
                style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',fontSize:10,
                  borderRadius:4,cursor:uLen?'pointer':'not-allowed',border:'1px solid #ddd',
                  background:'#fff',color:'#111',opacity:uLen?1:0.4}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
                Undo
              </button>
              <button type="button" onClick={()=>fileRef.current.click()} title="Add image"
                style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',fontSize:10,
                  borderRadius:4,cursor:'pointer',border:'1px solid #ddd',background:'#fff',color:'#111'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                +Img
              </button>
              <button type="button" onClick={doClear} title="Clear canvas"
                style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',fontSize:10,
                  borderRadius:4,cursor:'pointer',border:'1px solid #f5c6c6',background:'#fff5f5',color:'#c0392b'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
                Clear
              </button>
            </div>
          </div>

          {/* ③ Canvas — fills all remaining height */}
          <div style={{flex:1,minHeight:0,position:'relative',margin:'10px 12px 0',
            border:'1px solid #dde2f0',borderRadius:6,background:'#fff',overflow:'hidden'}}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();Array.from(e.dataTransfer.files||[]).filter(f=>f.type.startsWith('image/')).forEach(f=>addImg(URL.createObjectURL(f)));}}>
            {!targetLabel && (
              <div style={{position:'absolute',inset:0,zIndex:5,background:'rgba(248,249,252,0.88)',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,
                backdropFilter:'blur(1px)'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span style={{fontSize:13,color:'#bbb',fontWeight:600}}>Select a row first</span>
              </div>
            )}
            <canvas ref={mainRef} width={cvSize.w} height={cvSize.h}
              style={{display:'block',width:'100%',height:'100%',touchAction:'none',cursor:csr}}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
            <div style={{position:'absolute',bottom:6,left:'50%',transform:'translateX(-50%)',
              fontSize:10,color:'#ccc',pointerEvents:'none',whiteSpace:'nowrap'}}>
              Drag &amp; Drop • Ctrl+V
            </div>
          </div>

          {/* hidden file input for +Img */}
          <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={onFile}/>

          {/* ④ Capture button — pinned */}
          <div style={{flexShrink:0,padding:'10px 12px'}}>
            <button type="button"
              onClick={handleCapture}
              disabled={!targetLabel}
              style={{width:'100%',padding:'9px 14px',background:attached?'#27ae60':targetLabel?'#3f51b5':'#ccc',
                color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:700,
                cursor:targetLabel?'pointer':'not-allowed',
                display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'background .2s'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {attached
                  ? <polyline points="20 6 9 17 4 12"/>
                  : <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}
              </svg>
              {attached ? '✓ Attached!' : targetLabel ? 'Capture & Attach to Row' : 'Select a row first (→)'}
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── Normal / Minimized: inline panel ─────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {header}
      {body}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DmrsManage() {
  const { issueNumber: raw } = useParams();
  const issueNumber = decodeURIComponent(raw || '');
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user }    = useAuth();
  const perm        = usePermissions();
  const isReadOnly  = perm.role === 'Viewer';
  const actor       = user?.userId || user?.email || 'system';

  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [docInfo,      setDocInfo]      = useState(null);
  const [partLink,     setPartLink]     = useState(null);
  const [project,      setProject]      = useState(null);
  const [dmrsRows,       setDmrsRows]       = useState([]);
  const [wgteMaster,     setWgteMaster]     = useState([]);
  const [allMasterDm,    setAllMasterDm]    = useState([]);
  const [checklistMilestones, setChecklistMilestones] = useState([]);
  const [annotateUid,    setAnnotateUid]    = useState(null);
  const [canvasMode,     setCanvasMode]     = useState('normal'); // 'normal' | 'minimized' | 'maximized'
  const [allDocs,        setAllDocs]        = useState([]);
  const [allProjects,    setAllProjects]    = useState([]);

  // Checkpoint preview drawer (DmrsManage)
  const [dmCpMount,   setDmCpMount]   = useState(false);
  const [dmCpOpen,    setDmCpOpen]    = useState(false);
  const [dmCpRow,     setDmCpRow]     = useState(null);
  const [dmCpLightbox,setDmCpLightbox]= useState(null);

  const _projUid4Back = project?.uid || project?.Uid;
  const backPath  = _projUid4Back
    ? `/dashboard/projects/${_projUid4Back}`
    : (location.state?.from || '/dashboard/projects');
  const backLabel = _projUid4Back
    ? (project?.projectName || project?.ProjectName || 'Project')
    : (location.state?.fromLabel || 'Projects');

  const openDmCp  = r => { setDmCpRow(r); setDmCpMount(true); requestAnimationFrame(()=>requestAnimationFrame(()=>setDmCpOpen(true))); };
  const closeDmCp = () => { setDmCpOpen(false); setTimeout(()=>{ setDmCpMount(false); setDmCpRow(null); setDmCpLightbox(null); },320); };

  const parseDmImg = s => { try { return s?JSON.parse(s):[]; } catch { return []; } };
  const parseDmDoc = s => { try { return s?JSON.parse(s):null; } catch { return null; } };
  const fmtDmDate  = v => v?new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

  const [partMilestones,       setPartMilestones]       = useState([]);
  const [projectMilestones,    setProjectMilestones]    = useState([]);
  const [activeMilestone,      setActiveMilestone]      = useState('ms0');
  const [activeMilestoneLabel, setActiveMilestoneLabel] = useState('');   // empty = defaulted, not from a date window
  const [autoMilestone,        setAutoMilestone]        = useState('ms0'); // the date-window result
  const [manualOverride,       setManualOverride]       = useState(false);
  const [extraSyncCols,        setExtraSyncCols]        = useState([]);   // additional visible sync cols
  const [syncToggleOpen,       setSyncToggleOpen]       = useState(false); // toggle panel open
  const [otherColsVisible,     setOtherColsVisible]     = useState(false); // single toggle for all non-active milestone cols
  const [edits,                setEdits]                = useState({});
  const [viewRow,         setViewRow]         = useState(null);
  const [viewDrawerMount, setViewDrawerMount] = useState(false);
  const [viewDrawerOpen,  setViewDrawerOpen]  = useState(false);
  const [rowSaving,       setRowSaving]       = useState(null);
  const [creatingIssueUid, setCreatingIssueUid] = useState(null);

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    if (!issueNumber) return;
    setLoading(true);
    Promise.allSettled([
      issueDocApi.getAll(),
      dmrsApi.byIssueNumber(issueNumber),
      checklistMasterApi.getAll(),
      checklistMilestoneApi.getAll(),
      projectIssueLinkApi.byIssueNumber(issueNumber),
      projectsApi.getAll(),
      partMilestoneApi.byIssueNumber(issueNumber),
      projectMilestoneApi.getAll(),
    ]).then(async ([docRes, dmrsRes, masterRes, msRes, linkRes, projRes, partMsRes, projMsRes]) => {
      // Extract doc + link early so we can derive department before filtering the master
      const foundDoc = docRes.status === 'fulfilled'
        ? (docRes.value || []).find(d => d.issue_number === issueNumber) || null
        : null;
      const links = linkRes.status === 'fulfilled' ? (linkRes.value || []) : [];
      let link0 = links[0] || null;

      // ── Fallback: if issue_number not found directly, search by flag3 (WGDE doc) ──
      let isWgdeDoc = false;
      if (!link0) {
        try {
          const allLinks = await projectIssueLinkApi.getAll();
          const byFlag3  = allLinks.find(l => (l.flag3 || l.Flag3 || '') === issueNumber);
          if (byFlag3) { link0 = byFlag3; isWgdeDoc = true; }
        } catch { /* non-critical */ }
      }

      if (docRes.status === 'fulfilled') setAllDocs(docRes.value || []);
      if (foundDoc) setDocInfo(foundDoc);
      if (link0)    setPartLink(link0);
      if (dmrsRes.status === 'fulfilled') setDmrsRows(dmrsRes.value || []);

      if (masterRes.status === 'fulfilled') {
        const allMaster = masterRes.value || [];
        // Use the department stored on the part link (flag1: 'AVP' or 'WGDE').
        // Falls back to WGDE if no department is set (legacy behaviour).
        const rawDept  = (link0?.flag1 || link0?.Flag1 || '').trim().toLowerCase();
        const userDept = (user?.flag1 || user?.Flag1 || user?.role || '').trim().toLowerCase();
        const isMultiDept = rawDept.includes(',');
        // If we resolved this doc via flag3, it's the WGDE doc → force wgde dept
        const docDept  = isWgdeDoc
          ? 'wgde'
          : isMultiDept
            ? (userDept.includes('avp') ? 'avp' : userDept.includes('wgde') ? 'wgde' : rawDept.split(',')[0].trim())
            : rawDept;

        const filtered = allMaster.filter(m => {
          const d = (m.department || '').trim().toLowerCase();
          const s = (m.status    || '').trim().toLowerCase();
          if (s && s !== 'active' && s !== 'y') return false;
          if (!d || d === 'common' || d === 'all') return true;
          if (!docDept) return d === 'wgde' || d === 'wdge'; // legacy fallback
          // handle the WDGE / WGDE typo variant
          const normD      = d === 'wdge' ? 'wgde' : d;
          const normTarget = docDept === 'wdge' ? 'wgde' : docDept;
          return normD === normTarget;
        });
        setWgteMaster(filtered);
        setAllMasterDm(allMaster);
      } else {
        console.error('checklistMasterApi.getAll() failed:', masterRes.reason);
      }

      if (msRes.status === 'fulfilled') {
        const allMilestones = msRes.value || [];
        const projectUid = link0?.project || null;
        if (projectUid) setChecklistMilestones(allMilestones.filter(m => m.flag1 === projectUid));
        if (projRes.status === 'fulfilled') {
          const allProjs = projRes.value || [];
          setAllProjects(allProjs);
          if (projectUid) {
            const found = allProjs.find(p => (p.uid || p.Uid) === projectUid);
            if (found) setProject(found);
          }
        }
        const milestones = projectUid
          ? allMilestones.filter(m => m.flag1 === projectUid)
          : [];
        const now = new Date();
        for (const ms of [...milestones].sort((a, b) => new Date(a.milestone||0) - new Date(b.milestone||0))) {
          const start = new Date(ms.milestone);
          const end   = new Date(start);
          end.setDate(end.getDate() + (ms.noofDays || 30));
          if (now >= start && now <= end) {
            // Store the label; a separate effect maps it to the dynMilestone key once partMilestones load
            setActiveMilestoneLabel(ms.milestoneid || ms.checkPointS || 'Active Milestone');
            break;
          }
        }
      }

      if (partMsRes?.status === 'fulfilled') {
        setPartMilestones((partMsRes.value || []).map(m => ({
          uid:           m.uid           || m.Uid           || '',
          milestoneName: m.milestoneName || m.MilestoneName || '',
          issueNumber:   m.issueNumber   || m.IssueNumber   || '',
          projectUid:    m.projectUid    || m.ProjectUid    || '',
          plannedDate:   m.plannedDate   || m.PlannedDate   || null,
          completedDate: m.completedDate || m.CompletedDate || null,
          status:        m.status        || m.Status        || 'Next Milestone',
          milestoneOrder:m.milestoneOrder?? m.MilestoneOrder?? 0,
          department:    m.department    || m.Department    || '',
          owner:         m.owner         || m.Owner         || '',
          notes:         m.notes         || m.Notes         || '',
        })));
      }

      if (projMsRes?.status === 'fulfilled' && link0) {
        const pUid = link0.project || link0.Project || '';
        const filtered = (projMsRes.value || []).filter(
          m => (m.projectUid || m.ProjectUid || '') === pUid
        );
        setProjectMilestones(
          filtered.map(m => ({
            milestoneName:  m.milestoneName  || m.MilestoneName  || '',
            milestoneOrder: m.milestoneOrder ?? m.MilestoneOrder ?? 0,
            plannedDate:    m.plannedDate    || m.PlannedDate    || null,
          }))
        );
      }

    }).finally(() => setLoading(false));
  }, [issueNumber]);

  // Part extras from ProjectIssueLink.flag2 (Projects domain — no IssueListDocinfo needed)
  const partEx = useMemo(() => {
    try { return JSON.parse(partLink?.flag2 || partLink?.Flag2 || '{}'); } catch { return {}; }
  }, [partLink]);

  // Dynamic milestone columns — one entry per partMilestone, unlimited count.
  // Each ms uses an index-based key (ms0, ms1…) for state; storageKey is the milestone name used in SyncData JSON.
  // Fallback chain: partMilestones → checklistMilestones (by date) → single hardcoded "Sync 1".
  const dynMilestones = useMemo(() => {
    const sorted = [...partMilestones].sort((a, b) => (a.milestoneOrder ?? 0) - (b.milestoneOrder ?? 0));
    if (sorted.length > 0) {
      return sorted.map((pm, i) => ({
        key:        `ms${i}`,
        cmtKey:     `ms${i}_cmt`,
        label:      pm.milestoneName || `Milestone ${i + 1}`,
        storageKey: pm.milestoneName || `Milestone ${i + 1}`,
      }));
    }
    // No partMilestones — fall back to projectMilestones (has MilestoneOrder, reliable sort)
    const pmSorted = [...projectMilestones].sort(
      (a, b) => (a.milestoneOrder ?? 0) - (b.milestoneOrder ?? 0)
    );
    if (pmSorted.length > 0) {
      return pmSorted.map((pm, i) => {
        const label = pm.milestoneName || `Milestone ${i + 1}`;
        return { key: `ms${i}`, cmtKey: `ms${i}_cmt`, label, storageKey: label };
      });
    }
    return [{ key: 'ms0', cmtKey: 'ms0_cmt', label: 'Sync 1', storageKey: 'Sync 1' }];
  }, [partMilestones, projectMilestones]);

  // Map the active date-window's milestone label to the matching dynMilestone key.
  // Must be placed AFTER dynMilestones so the dependency array evaluates without TDZ.
  useEffect(() => {
    if (!dynMilestones.length || !checklistMilestones.length || manualOverride) return;
    const now = new Date();
    for (const ms of [...checklistMilestones].sort((a, b) => new Date(a.milestone||0) - new Date(b.milestone||0))) {
      const start = new Date(ms.milestone);
      const end   = new Date(start);
      end.setDate(end.getDate() + (ms.noofDays || 30));
      if (now >= start && now <= end) {
        const label = ms.milestoneid || ms.checkPointS || '';
        const dynMs = dynMilestones.find(m => m.label.toLowerCase().trim() === label.toLowerCase().trim());
        if (dynMs) {
          setAutoMilestone(dynMs.key);
          setActiveMilestone(dynMs.key);
          setActiveMilestoneLabel(label);
          setOtherColsVisible(false);
        }
        break;
      }
    }
  }, [checklistMilestones, dynMilestones, manualOverride]);

  // Resolved part number: partLink > existing DMRS rows
  const resolvedPartNum = partLink?.partNumber || partLink?.PartNumber
    || dmrsRows[0]?.partNumber || '';

  // Issues linked to this D2MRS document — derived from already-loaded allDocs (no extra network call)
  const dmrsIssues = useMemo(
    () => allDocs.filter(d => d.flag1 === issueNumber),
    [allDocs, issueNumber],
  );

  // ── O(1) lookup map: check_Point → existing DMRS row ────────
  // Stores entries for BOTH chkId and checkPointS so legacy rows (saved with checkPointS) still match.
  const dmrsRowMap = useMemo(() => {
    const m = new Map();
    dmrsRows.forEach(d => { if (d.check_Point) m.set(d.check_Point, d); });
    return m;
  }, [dmrsRows]);

  // ── Merge master checklists with existing DMRS records ───────
  // Uses chkId as the unique key so rows with duplicate checkPointS don't collide.
  const mergedRows = useMemo(() => {
    const parseSyncFields = (row) => {
      let parsed = {};
      try { parsed = JSON.parse(row.syncData || '{}'); } catch {}
      const fields = {};
      dynMilestones.forEach(ms => {
        const combined = parsed[ms.storageKey] || '';
        const pipeIdx  = combined.indexOf('|');
        fields[ms.key]    = pipeIdx >= 0 ? combined.slice(0, pipeIdx) : combined;
        fields[ms.cmtKey] = pipeIdx >= 0 ? combined.slice(pipeIdx + 1) : '';
      });
      return fields;
    };

    const emptySync = {};
    dynMilestones.forEach(ms => { emptySync[ms.key] = ''; emptySync[ms.cmtKey] = ''; });

    const partNum = docInfo?.partNumber || dmrsRows[0]?.partNumber || '';
    return wgteMaster.map((m, idx) => {
      const uniqueKey = m.chkId || m.checkPointS || '';
      const existing  = dmrsRowMap.get(uniqueKey) || dmrsRowMap.get(m.checkPointS) || undefined;
      if (existing) return { ...existing, ...parseSyncFields(existing), _isNew: false };
      return {
        uid:           `_new_${m.uid || idx}`,
        _isNew:        true,
        partNumber:    partNum,
        issue_number:  issueNumber,
        check_Point:   uniqueKey,
        description:   m.checkpointDesc || '',
        source_Link:   '',
        zone:          m.zone    || '',
        stations:      m.station || '',
        owner:         m.owner   || '',
        ...emptySync,
        syncData:      '{}',
        mimS_ID:'', remarks:'', changeManagement:'', flag1:'', flag2:'', flag3:'',
        mrs:'', status:'Active',
      };
    });
  }, [wgteMaster, dmrsRowMap, docInfo, dmrsRows, issueNumber, dynMilestones]);

  // ── O(1) lookup map: checkPointS/chkId → master item ────────
  const masterDmMap = useMemo(() => {
    const m = new Map();
    allMasterDm.forEach(item => {
      if (item.checkPointS) m.set(item.checkPointS, item);
      if (item.chkId)       m.set(item.chkId, item);
    });
    return m;
  }, [allMasterDm]);

  // ── Derive sync completion from checklist row values ─────────
  // Milestone label from checklistMilestones is matched against dynMilestone labels;
  // if matched, completion is computed live from row values. Otherwise uses stored DB status.
  const syncProgressMilestones = useMemo(() => {
    const computeSyncStatus = (msKey) => {
      const total = mergedRows.length;
      if (total === 0) return { status:'Next Milestone', completionRate:0 };
      const doneCount = mergedRows.filter(r => {
        const v = (edits[r.uid]?.[msKey] ?? r[msKey] ?? '').toLowerCase();
        return v === 'ok' || v === 'n/a';
      }).length;
      const validatedCount = mergedRows.filter(r => {
        const v = (edits[r.uid]?.[msKey] ?? r[msKey] ?? '').trim();
        return v !== '' && v.toLowerCase() !== 'pending';
      }).length;
      const completionRate = doneCount / total;
      const status = validatedCount === total ? 'Completed'
                   : validatedCount > 0 || doneCount > 0 ? 'On Going'
                   : 'Next Milestone';
      return { status, completionRate };
    };

    // ── Primary path: user has mapped milestones — show ALL of them ──
    if (checklistMilestones.length > 0) {
      return [...checklistMilestones]
        .sort((a, b) => new Date(a.milestone || 0) - new Date(b.milestone || 0))
        .map((clMs, idx) => {
          const label = clMs.milestoneid || clMs.checkPointS || `Milestone ${idx + 1}`;
          const dynMs = dynMilestones.find(m =>
            m.label.toLowerCase().trim() === label.toLowerCase().trim()
          );
          const msKey = dynMs?.key ?? null;

          if (msKey) {
            const { status, completionRate } = computeSyncStatus(msKey);
            return {
              uid:            clMs.uid || msKey,
              milestoneName:  label,
              milestoneOrder: idx,
              status, completionRate,
              plannedDate:    clMs.milestone || null,
              completedDate:  status === 'Completed' ? new Date().toISOString() : null,
              notes: '', department: '', owner: '',
            };
          }

          const storedStatus = clMs.status || 'Next Milestone';
          return {
            uid:            clMs.uid || `custom_${idx}`,
            milestoneName:  label,
            milestoneOrder: idx,
            status:         storedStatus,
            completionRate: storedStatus === 'Completed' ? 1 : 0,
            plannedDate:    clMs.milestone || null,
            completedDate:  storedStatus === 'Completed' ? (clMs.modified_date || new Date().toISOString()) : null,
            notes: '', department: '', owner: '',
          };
        });
    }

    // ── Fallback: no mapped milestones — show all dynMilestones ──
    return dynMilestones.map((ms, idx) => {
      const { status, completionRate } = computeSyncStatus(ms.key);
      return {
        uid:            ms.key,
        milestoneName:  ms.label,
        milestoneOrder: idx,
        status, completionRate,
        plannedDate:    null,
        completedDate:  status === 'Completed' ? new Date().toISOString() : null,
        notes: '', department: '', owner: '',
      };
    });
  }, [mergedRows, edits, checklistMilestones, dynMilestones]);

  const getVal = (uid, field, fallback='') => edits[uid]?.[field] ?? fallback ?? '';
  const setVal = (uid, field, value) =>
    setEdits(prev => ({ ...prev, [uid]: { ...(prev[uid]||{}), [field]: value } }));

  const milestoneInfo = (activeMilestone ? dynMilestones.find(m => m.key === activeMilestone) : null) ?? dynMilestones[0];

  // ── Save all edited rows ─────────────────────────────────────
  const handleSaveAll = async () => {
    const changedUids = Object.keys(edits).filter(uid => Object.keys(edits[uid] || {}).length > 0);
    if (!changedUids.length) {
      Swal.fire({icon:'info',title:'No changes to save',text:'Edit some fields before saving.',confirmButtonColor:'#3f51b5'});
      return;
    }
    setSaving(true);
    const now    = new Date().toISOString();
    const partNum= resolvedPartNum;

    try {
      // Helper: extract result value for the active milestone from a raw API row (has syncData JSON)
      const activeDm = dynMilestones.find(m => m.key === activeMilestone) ?? dynMilestones[0];
      const getFreshVal = (r) => {
        let parsed = {};
        try { parsed = JSON.parse(r.syncData || '{}'); } catch {}
        const combined = parsed[activeDm?.storageKey] || '';
        const pipeIdx  = combined.indexOf('|');
        return (pipeIdx >= 0 ? combined.slice(0, pipeIdx) : combined).toLowerCase();
      };

      // Helper: build syncData JSON from a row that has ms0/ms0_cmt etc. fields
      const msFieldKeys = dynMilestones.flatMap(ms => [ms.key, ms.cmtKey]);
      const buildSyncPayload = (row) => {
        const obj = {};
        dynMilestones.forEach(ms => {
          const result  = (row[ms.key]    || '').trim();
          const comment = (row[ms.cmtKey] || '').trim();
          obj[ms.storageKey] = `${result}|${comment}`;
        });
        return JSON.stringify(obj);
      };

      const ops = changedUids.map(uid => {
        const row = mergedRows.find(r => r.uid === uid);
        if (!row) return null;
        const rowEdits = edits[uid] || {};
        // eslint-disable-next-line no-unused-vars
        const { _isNew, ...cleanRow } = { ...row, ...rowEdits };
        // Build syncData and strip the flat ms* fields from the payload
        cleanRow.syncData = buildSyncPayload(cleanRow);
        msFieldKeys.forEach(k => delete cleanRow[k]);

        if (row._isNew) {
          const newUid = genUid();
          return dmrsApi.create({
            ...cleanRow,
            uid:           newUid,
            partNumber:    partNum || cleanRow.partNumber,
            issue_number:  issueNumber,
            createdBy:     actor,
            createdDate:   now,
            modifiedBy:    actor,
            modifiedDate:  now,
          });
        } else {
          return dmrsApi.update(row.uid, {
            ...cleanRow,
            modifiedBy:   actor,
            modifiedDate: now,
          });
        }
      }).filter(Boolean);

      await Promise.allSettled(ops);
      const fresh = await dmrsApi.byIssueNumber(issueNumber);
      setDmrsRows(fresh);
      setEdits({});

      // Auto-create one issue document per "Not OK" row (skip if already exists for that checkpoint + sync)
      const syncKey    = activeMilestone;
      const syncLabel  = milestoneInfo?.label ?? activeDm?.label ?? syncKey;
      const notOkRows  = fresh.filter(r => getFreshVal(r) === 'not ok');
      const newIssueOps = notOkRows
        .filter(r => !allDocs.some(d => d.flag1 === issueNumber && d.flag2 === r.check_Point && d.flag3 === syncKey))
        .map((r, idx) => {
          const now2 = new Date().toISOString();
          return issueDocApi.create({
            uid:               genUid(),
            partNumber:        resolvedPartNum || r.partNumber || '',
            issue_number:      generateIssueNumber(idx),
            issue_title:       `${r.check_Point} — ${syncLabel} Not OK`,
            issue_description: r.description || r.check_Point || '',
            status:            'Open',
            initiator:         actor,
            owner:             partEx.owner     || '',
            material:          partEx.material  || '',
            flag1:             issueNumber,
            flag2:             r.check_Point,
            flag3:             syncKey,
            created_by:        actor,
            created_date:      now2,
            modified_by:       actor,
            modified_date:     now2,
          });
        });
      if (newIssueOps.length) {
        const issueResults = await Promise.allSettled(newIssueOps);
        const created = issueResults.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (created.length) setAllDocs(prev => [...prev, ...created]);
      }

      // Auto-close issue docs whose DMRS row is now OK or N/A
      const resolvedCheckpoints = fresh
        .filter(r => { const v = getFreshVal(r); return v === 'ok' || v === 'n/a'; })
        .map(r => r.check_Point);
      const docsToClose = resolvedCheckpoints.length
        ? allDocs.filter(d =>
            d.flag1 === issueNumber &&
            d.flag3 === syncKey &&
            resolvedCheckpoints.includes(d.flag2) &&
            (d.status || '').toLowerCase() !== 'closed'
          )
        : [];
      if (docsToClose.length) {
        const nowClose = new Date().toISOString();
        await Promise.allSettled(docsToClose.map(d =>
          issueDocApi.update(d.uid, { ...d, status: 'Closed', modified_by: actor, modified_date: nowClose })
        ));
        const closedUids = new Set(docsToClose.map(d => d.uid));
        setAllDocs(prev => prev.map(d => closedUids.has(d.uid) ? { ...d, status: 'Closed' } : d));
      }

      // ── Auto-complete milestone when all checkpoints are validated ──────────
      const freshMap = new Map(fresh.map(r => [r.check_Point, r]));
      const allValidated = wgteMaster.length > 0 && wgteMaster.every(master => {
        const key = master.chkId || master.checkPointS || '';
        const dbRow = freshMap.get(key);
        if (!dbRow) return false;
        const v = getFreshVal(dbRow).trim();
        return v !== '' && v !== 'pending';
      });

      if (allValidated) {
        // 1. Update the matching PartMilestone (match by milestone label)
        const matchPartMs = partMilestones.find(pm =>
          (pm.milestoneName || '').toLowerCase().trim() === (activeDm?.label || '').toLowerCase().trim()
        );
        if (matchPartMs && (matchPartMs.status || '').toLowerCase() !== 'completed') {
          try {
            const nowMs = new Date().toISOString();
            await partMilestoneApi.update(matchPartMs.uid, {
              ...matchPartMs,
              status:       'Completed',
              completedDate: nowMs,
              modifiedBy:   actor,
              modifiedDate:  nowMs,
            });
            setPartMilestones(prev => prev.map(m =>
              m.uid === matchPartMs.uid ? { ...m, status:'Completed', completedDate:nowMs } : m
            ));
          } catch { /* non-critical */ }
        }

        // 2. Update the matching ChecklistMilestone (match by milestoneid label)
        const matchClMs = checklistMilestones.find(ms =>
          (ms.milestoneid || '').toLowerCase().trim() === (activeDm?.label || '').toLowerCase().trim()
        );
        if (matchClMs && (matchClMs.status || '').toLowerCase() !== 'completed') {
          try {
            const nowMs = new Date().toISOString();
            await checklistMilestoneApi.update(matchClMs.uid, {
              ...matchClMs, status:'Completed',
              modified_by: actor, modified_date: nowMs,
            });
            setChecklistMilestones(prev => prev.map(m =>
              m.uid === matchClMs.uid ? { ...m, status:'Completed' } : m
            ));
          } catch { /* non-critical */ }
        }
      }

      const msCompletedMsg = allValidated
        ? ` Milestone "${milestoneInfo.label}" marked Completed.`
        : '';

      Swal.fire({icon:'success',title:'Saved!',
        text: (notOkRows.length
          ? `${notOkRows.length} "Not OK" row${notOkRows.length>1?'s':''} — issue documents created.`
          : docsToClose.length
          ? `${docsToClose.length} issue document${docsToClose.length>1?'s':''} closed.`
          : '') + msCompletedMsg || undefined,
        timer:3000,showConfirmButton:false,timerProgressBar:true});
    } catch(e) {
      Swal.fire({icon:'error',title:'Save failed',text:e.message,confirmButtonColor:'#3f51b5'});
    } finally {
      setSaving(false);
    }
  };

  // ── Save single row ──────────────────────────────────────────
  const handleSaveRow = async (row) => {
    const rowEdits = edits[row.uid] || {};
    if (!row._isNew && !Object.keys(rowEdits).length) {
      Swal.fire({icon:'info',title:'No changes on this row',timer:1500,showConfirmButton:false,timerProgressBar:true});
      return;
    }
    setRowSaving(row.uid);
    const now     = new Date().toISOString();
    try {
      // eslint-disable-next-line no-unused-vars
      const { _isNew, ...cleanRow } = { ...row, ...rowEdits };
      // Build syncData and strip flat ms* fields
      const msFieldKeys = dynMilestones.flatMap(ms => [ms.key, ms.cmtKey]);
      const syncObj = {};
      dynMilestones.forEach(ms => {
        const result  = (cleanRow[ms.key]    || '').trim();
        const comment = (cleanRow[ms.cmtKey] || '').trim();
        syncObj[ms.storageKey] = `${result}|${comment}`;
      });
      cleanRow.syncData = JSON.stringify(syncObj);
      msFieldKeys.forEach(k => delete cleanRow[k]);

      if (row._isNew) {
        await dmrsApi.create({
          ...cleanRow, uid:genUid(),
          partNumber:resolvedPartNum||cleanRow.partNumber, issue_number:issueNumber,
          createdBy:actor, createdDate:now, modifiedBy:actor, modifiedDate:now,
        });
      } else {
        await dmrsApi.update(row.uid, { ...cleanRow, modifiedBy:actor, modifiedDate:now });
      }
      const fresh = await dmrsApi.byIssueNumber(issueNumber);
      setDmrsRows(fresh);
      setEdits(prev => { const n={...prev}; delete n[row.uid]; return n; });
      Swal.fire({icon:'success',title:'Saved!',timer:1500,showConfirmButton:false,timerProgressBar:true});
    } catch(e) {
      Swal.fire({icon:'error',title:'Save failed',text:e.message,confirmButtonColor:'#3f51b5'});
    } finally {
      setRowSaving(null);
    }
  };

  // ── Delete single row ─────────────────────────────────────────
  const handleDeleteRow = async (row) => {
    if (row._isNew) {
      setEdits(prev => { const n={...prev}; delete n[row.uid]; return n; });
      return;
    }
    const res = await Swal.fire({
      title:'Delete this row?', html:`<b>${row.check_Point||row.uid}</b>`,
      icon:'warning', showCancelButton:true,
      confirmButtonColor:'#e74c3c', cancelButtonColor:'#6c757d',
      confirmButtonText:'Delete', reverseButtons:true,
    });
    if (!res.isConfirmed) return;
    try {
      await dmrsApi.remove(row.uid);
      const fresh = await dmrsApi.byIssueNumber(issueNumber);
      setDmrsRows(fresh);
      Swal.fire({icon:'success',title:'Deleted',timer:1500,showConfirmButton:false,timerProgressBar:true});
    } catch(e) {
      Swal.fire({icon:'error',title:'Failed',text:e.message,confirmButtonColor:'#3f51b5'});
    }
  };

  // Auto-create an IssueListDocinfo when a checkpoint is marked Not OK
  const handleNotOk = async (row, syncKey) => {
    if (isReadOnly) return;
    const alreadyExists = dmrsIssues.some(d => d.flag2 === row.check_Point && d.flag3 === syncKey);
    if (alreadyExists) return;
    setCreatingIssueUid(row.uid);
    const now       = new Date().toISOString();
    const syncLabel = dynMilestones.find(m => m.key === syncKey)?.label || syncKey;
    const newIssue  = {
      uid:               genUid(),
      partNumber:        resolvedPartNum,
      issue_number:      generateIssueNumber(0),
      issue_title:       `${row.check_Point} — ${syncLabel} Not OK`,
      issue_description: row.description || row.check_Point || '',
      status:            'Open',
      initiator:         actor,
      owner:             partEx.owner    || '',
      material:          partEx.material || '',
      flag1:             issueNumber,
      flag2:             row.check_Point,
      flag3:             syncKey,
      created_by:        actor,
      created_date:      now,
      modified_by:       actor,
      modified_date:     now,
    };
    try {
      const created = await issueDocApi.create(newIssue);
      setAllDocs(prev => [...prev, created || newIssue]);
    } catch {
      setAllDocs(prev => [...prev, newIssue]);
    } finally {
      setCreatingIssueUid(null);
    }
  };

  // Merge current edits into row for view drawer
  const getViewData = (row) => ({ ...row, ...(edits[row.uid]||{}) });

  const openViewDrawer = row => {
    setViewRow(getViewData(row));
    setViewDrawerMount(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setViewDrawerOpen(true)));
  };
  const closeViewDrawer = () => {
    setViewDrawerOpen(false);
    setTimeout(() => { setViewDrawerMount(false); setViewRow(null); }, 320);
  };

  // Generate an issue number that follows the same P{NNN}{NNNN} series as IssueList.
  // offset allows generating unique numbers within a single batch (0, 1, 2, …).
  const generateIssueNumber = useCallback((offset = 0) => {
    const projectUid = project?.uid || project?.Uid;
    if (!projectUid || !allProjects.length) return `D2-${genUid().slice(0, 8)}`;
    const sorted = [...allProjects].sort((a, b) =>
      new Date(a.created_date || a.Created_date || 0) - new Date(b.created_date || b.Created_date || 0)
    );
    const idx = sorted.findIndex(p => (p.uid || p.Uid) === projectUid);
    if (idx < 0) return `D2-${genUid().slice(0, 8)}`;
    const code    = `P${String(idx + 1).padStart(3, '0')}`;
    // Strict match: code + exactly 4 digits, no hyphens or extra chars
    const pattern = new RegExp(`^${code}(\\d{4})$`);
    const existing = allDocs
      .map(d => { const m = (d.issue_number || '').match(pattern); return m ? parseInt(m[1], 10) : null; })
      .filter(n => n !== null);
    const seq = Math.max(existing.length ? Math.max(...existing) : 0, 0) + 1 + offset;
    return `${code}${String(seq).padStart(4, '0')}`;
  }, [project, allProjects, allDocs]);

  // ── Print PDF ─────────────────────────────────────────────────
  const handlePrintPdf = () => {
    let ex = {};
    try { ex = JSON.parse(partLink?.flag2 || partLink?.Flag2 || '{}'); } catch {}
    generateChecklistManagePdf({
      docInfo,
      partLink,
      project,
      partExtras: ex,
      dynMilestones,
      mergedRows,
      edits,
      activeMilestone,
      activeMilestoneLabel,
      filename: `checklist-${issueNumber}-${Date.now()}.pdf`,
    });
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="dm-page">

      {/* Back / breadcrumb */}
      <div className="dm-back-bar">
        <button className="dm-back-btn" type="button" onClick={()=>navigate(backPath)}>
          <Ic.Back/>{backLabel}
        </button>
        <span className="dm-bc-sep">/</span>
        <span className="dm-bc-cur">{issueNumber}</span>
      </div>

      {/* Page header */}
      <div className="dm-page-hdr">
        <div className="dm-page-hdr-left">
          <div className="dm-page-icon">D2</div>
          <div>
            <h1 className="dm-page-title">D2MRS — {issueNumber}</h1>
            <p className="dm-page-sub">{docInfo?.issue_title || 'DMRS Document Review'}</p>
          </div>
        </div>
        <div className="dm-page-hdr-right">
          <button className="dm-btn dm-btn-outline" type="button" onClick={handlePrintPdf}
            style={{display:'inline-flex',alignItems:'center',gap:5}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print PDF
          </button>
          <button className="dm-btn dm-btn-primary" type="button" onClick={handleSaveAll} disabled={saving || isReadOnly}>
            <Ic.Save/> {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dm-loading-state">
          <div className="dm-spinner"/>
          <span>Loading document…</span>
        </div>
      ) : (<>

        {/* ── 1. Document Info ── */}
        <SectionCard
          title="Document Info"
          icon={<Ic.Doc/>}
          iconBg="#e8f4fd"
          iconColor="#2980b9"
        >
          {/* Dense full-width grid — all fields in one block, 6 columns */}
          {(() => {
            let ex = {};
            try { ex = JSON.parse(partLink?.flag2 || partLink?.Flag2 || '{}'); } catch {}
            const dept = partLink?.flag1 || partLink?.Flag1 || '';
            const deptCfg = dept.toUpperCase()==='AVP'
              ? {bg:'#e3f2fd',color:'#1565c0',border:'#90caf9'}
              : dept ? {bg:'#f3e5f5',color:'#6a1b9a',border:'#ce93d8'} : null;
            const F = ({l,v,badge,span=1}) => (
              <div style={{gridColumn:`span ${span}`,minWidth:0}}>
                <div style={{fontSize:9,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{l}</div>
                <div style={{fontSize:12,fontWeight:600,color:'#1a1a2e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {badge ?? (v || '—')}
                </div>
              </div>
            );
            return (
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'8px 16px'}}>
                <F l="Project"      v={project?.projectName||project?.ProjectName}            span={2}/>
                <F l="Program"      v={project?.program    ||project?.Program    ||partLink?.program}/>
                <F l="Plant"        v={project?.plant      ||project?.Plant      ||partLink?.plant}/>
                <F l="Plant Year"   v={project?.plant_year ||project?.Plant_year ||partLink?.plant_year}/>
                <F l="Proj Status"  v={project?.status     ||project?.Status}/>
                <F l="Part # LH"    v={partLink?.Part_number_LH ||partLink?.part_number_LH}/>
                <F l="Part # RH"    v={partLink?.Part_number_RH ||partLink?.part_number_RH}/>
                <F l="Part Name LH" v={ex.partNameLH || partLink?.Part_Description || partLink?.part_Description}/>
                <F l="Part Name RH" v={ex.partNameRH || partLink?.Part_Description || partLink?.part_Description}/>
                {deptCfg
                  ? <F l="Dept" span={2} badge={<span style={{display:'inline-block',padding:'1px 8px',borderRadius:4,fontSize:11,fontWeight:700,background:deptCfg.bg,color:deptCfg.color,border:`1px solid ${deptCfg.border}`}}>{dept}</span>}/>
                  : <F l="Dept" v="—" span={2}/>}
                <F l="Material"    v={ex.material}/>
                <F l="Owner"       v={ex.owner}/>
                <F l="Initiator"   v={ex.initiator}/>
                <F l="PDEF # RH"   v={ex.pdefRH}/>
                <F l="PDEF # LH"   v={ex.pdefLH}/>
                <F l="LA # RH"     v={ex.laRH}/>
                <F l="LA # LH"     v={ex.laLH}/>
                <F l="PA # RH"     v={ex.paRH}/>
                <F l="PA # LH"     v={ex.paLH}/>
                {docInfo && <>
                  <F l="Doc Status" badge={<StatusBadge v={docInfo.status}/>}/>
                  <F l="Date Opened"    v={fmtDate(docInfo.date_Opened)}/>
                  <F l="Req Complete"   v={fmtDate(docInfo.req_Completion_Date)}/>
                  {(docInfo.derogation_sht_num||docInfo.Derogation_sht_num)&&
                    <F l="Derogation"   v={docInfo.derogation_sht_num||docInfo.Derogation_sht_num} span={2}/>}
                </>}
              </div>
            );
          })()}
        </SectionCard>

        {/* ── 2. Milestone Info ── */}
        <SectionCard
          title="Milestone Info"
          icon={<Ic.Mile/>}
          iconBg="#fce4ec"
          iconColor="#c62828"
        >
          {/* Single compact row */}
          <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
            {/* Date */}
            <div style={{display:'flex',flexDirection:'column',gap:1}}>
              <span style={{fontSize:9,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.4px'}}>Date</span>
              <span style={{fontSize:12,fontWeight:700,color:'#3f51b5'}}>{fmtDisplay(new Date())}</span>
            </div>
            <span style={{color:'#e8eaf6',fontSize:18}}>|</span>
            {/* Active Milestone */}
            <div style={{display:'flex',flexDirection:'column',gap:1}}>
              <span style={{fontSize:9,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.4px'}}>Active Milestone</span>
              <span style={{fontSize:12,fontWeight:700,
                color: activeMilestoneLabel&&!manualOverride?'#c62828':'#888',
                background: activeMilestoneLabel&&!manualOverride?'#fce4ec':'#f1f3f5',
                border: `1px solid ${activeMilestoneLabel&&!manualOverride?'#ef9a9a':'#ccc'}`,
                padding:'2px 10px',borderRadius:20,display:'inline-block'}}>
                {manualOverride ? 'Manual override' : activeMilestoneLabel || 'No milestone — default'}
              </span>
            </div>
            <span style={{color:'#e8eaf6',fontSize:18}}>|</span>
            {/* Sync Column selector */}
            <div style={{display:'flex',flexDirection:'column',gap:1}}>
              <span style={{fontSize:9,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.4px'}}>Active Sync</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div className="dm-sel-wrap">
                  <select value={activeMilestone}
                    onChange={e=>{
                      const key=e.target.value;
                      setActiveMilestone(key);
                      setManualOverride(key!==autoMilestone);
                      setExtraSyncCols([]);
                      setSyncToggleOpen(false);
                      setOtherColsVisible(false);
                    }}>
                    {dynMilestones.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <span className="dm-sel-arrow">▾</span>
                </div>
                {manualOverride&&(
                  <button type="button" className="dm-ms-reset-btn"
                    onClick={()=>{setActiveMilestone(autoMilestone);setManualOverride(false);}}>
                    Reset
                  </button>
                )}
              </div>
            </div>
            {/* Status hint */}
            {!activeMilestoneLabel&&!manualOverride&&(
              <span style={{fontSize:11,color:'#888',padding:'3px 10px',background:'#f8f9fa',borderRadius:6,border:'1px solid #dee2e6'}}>
                No active window — defaulting to <strong>{dynMilestones[0]?.label ?? 'first milestone'}</strong>
              </span>
            )}
            {manualOverride&&(
              <span style={{fontSize:11,color:'#e65100',padding:'3px 10px',background:'#fff8e1',borderRadius:6,border:'1px solid #ffe082'}}>
                Manually set to <strong>{milestoneInfo.label}</strong>
              </span>
            )}
          </div>
        </SectionCard>

        {/* ── 3. Checklist Table ── */}
        {(() => {
          const allSyncOk = mergedRows.length > 0 && mergedRows.every(row => {
            const v = (edits[row.uid]?.[activeMilestone] ?? row[activeMilestone] ?? '').toLowerCase();
            return v === 'ok' || v === 'n/a';
          });
          const nextMsIdx = dynMilestones.findIndex(m => m.key === activeMilestone) + 1;
          const nextMs    = nextMsIdx < dynMilestones.length ? dynMilestones[nextMsIdx] : null;
          return (
        <SectionCard
          title={`Checklist — ${milestoneInfo.label}`}
          icon={<Ic.Chk/>}
          iconBg="#e8f9ee"
          iconColor="#27ae60"
          actions={
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {allSyncOk && nextMs && (
                <button
                  type="button"
                  className="dm-btn dm-btn-sm"
                  style={{background:'#27ae60',color:'#fff',borderColor:'#27ae60'}}
                  onClick={() => {
                    setActiveMilestone(nextMs.key);
                    setActiveMilestoneLabel(nextMs.label);
                    setManualOverride(false);
                    setOtherColsVisible(false);
                    Swal.fire({icon:'success',title:`${milestoneInfo.label} Complete!`,
                      text:`All checkpoints OK — advancing to ${nextMs.label}`,
                      timer:2200,showConfirmButton:false,timerProgressBar:true});
                  }}>
                  ✓ Advance to {nextMs.label}
                </button>
              )}
              <button className="dm-btn dm-btn-primary dm-btn-sm" type="button"
                onClick={handleSaveAll} disabled={saving || isReadOnly}>
                <Ic.Save/> {saving ? 'Saving…' : 'Save All'}
              </button>
            </div>
          }
        >
          {mergedRows.length === 0 ? (
            <div className="dm-empty-cl">
              No checklist items found in the checklist master.
            </div>
          ) : (
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div className="dm-cl-scroll-wrap" style={{flex:1,minWidth:0,overflowX:'auto',overflowY:'auto',maxHeight:'calc(100vh - 320px)',minHeight:260,borderRadius:6,border:'1px solid var(--dash-border)'}}>
              <table className="dm-cl-table">
                <thead>
                  <tr>
                    <th className="dm-th-seq">Seq No</th>
                    <th className="dm-th-chk">Checklist</th>
                    {/* Dynamic milestone columns — active shown by default; "+" expands only milestones to the right (after active) in asc order */}
                    {dynMilestones.map((ms, msIdx) => {
                      const activeIdx = dynMilestones.findIndex(m => m.key === activeMilestone);
                      const isActive  = ms.key === activeMilestone;
                      if (!isActive && (!otherColsVisible || msIdx < activeIdx)) return null;
                      return [
                        <th key={ms.key} className="dm-th-sync"
                          style={isActive
                            ? {background:'#e8f0fe',color:'#1565c0',borderBottom:'2px solid #1565c0'}
                            : {}}>
                          {ms.label}
                        </th>,
                        <th key={`${ms.key}-cmt`} className="dm-th-cmt">
                          <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:4}}>
                            {ms.label} Comments
                            {isActive && (
                              <button
                                type="button"
                                onClick={() => setOtherColsVisible(v => !v)}
                                title={otherColsVisible ? 'Collapse other milestones' : 'Expand all milestones'}
                                style={{
                                  flexShrink:0, width:18, height:18,
                                  border:'1px solid #bbb', borderRadius:3,
                                  background: otherColsVisible ? '#3f51b5' : '#f5f5f5',
                                  color: otherColsVisible ? '#fff' : '#555',
                                  cursor:'pointer', fontSize:13, fontWeight:700,
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  lineHeight:1, padding:0,
                                }}>
                                {otherColsVisible ? '−' : '+'}
                              </button>
                            )}
                          </span>
                        </th>,
                      ];
                    })}
                    <th className="dm-th-att">Source Attachment</th>
                    <th className="dm-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row, idx) => {
                    return (
                      <tr key={row.uid}
                        className={`dm-cl-tr${row._isNew?' dm-cl-tr-new':''}${annotateUid===row.uid?' dm-cl-tr-selected':''}`}
                        onClick={() => setAnnotateUid(row.uid)}>


                        {/* Seq No */}
                        <td className="dm-td-seq">{idx + 1}</td>

                        {/* Checklist */}
                        <td>
                          <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                            <div style={{flex:1}}>
                              {(() => {
                                const masterItem = masterDmMap.get(row.check_Point);
                                const desc = row.description || masterItem?.checkpointDesc || '';
                                return desc
                                  ? <div className="dm-cl-point">{desc}</div>
                                  : <div className="dm-cl-desc" style={{fontStyle:'italic',color:'#ccc'}}>No description</div>;
                              })()}
                            </div>
                            {(() => {
                              const m = masterDmMap.get(row.check_Point);
                              return m ? (
                                <button onClick={()=>openDmCp(m)} title="View checkpoint details"
                                  style={{flexShrink:0,width:20,height:20,border:'none',borderRadius:4,
                                    cursor:'pointer',display:'inline-flex',alignItems:'center',
                                    justifyContent:'center',background:'#e3f2fd',color:'#1565c0',
                                    padding:0,marginTop:2,transition:'background .15s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.background='#1565c0';e.currentTarget.style.color='#fff';}}
                                  onMouseLeave={e=>{e.currentTarget.style.background='#e3f2fd';e.currentTarget.style.color='#1565c0';}}>
                                  <Ic.Eye/>
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </td>

                        {/* Dynamic milestone columns — active visible by default; "+" reveals milestones to the right (after active) in asc order */}
                        {dynMilestones.map((ms, msIdx) => {
                          const activeIdx = dynMilestones.findIndex(m => m.key === activeMilestone);
                          const isActive  = ms.key === activeMilestone;
                          if (!isActive && (!otherColsVisible || msIdx < activeIdx)) return null;
                          const val = getVal(row.uid, ms.key, row[ms.key] || '');
                          const bg  = SYNC_BG[val]    || '#fff';
                          const col = SYNC_COLOR[val] || '#333';
                          return [
                            <td key={ms.key} className="dm-td-sync"
                              style={isActive ? {borderLeft:'2px solid #1565c0'} : {}}>
                              <div className="dm-sync-sel-wrap">
                                <select
                                  className="dm-sync-sel"
                                  style={{ background:bg, color:col, borderColor:val?col+'55':undefined }}
                                  value={val}
                                  onChange={e=>setVal(row.uid, ms.key, e.target.value)}
                                  disabled={isReadOnly}>
                                  <option value="">—</option>
                                  {SYNC_OPTS.map(s=><option key={s} value={s}>{s}</option>)}
                                </select>
                                <span className="dm-sync-arr" style={{color:col}}>▾</span>
                              </div>
                            </td>,
                            ms.cmtKey ? (
                              <td key={`${ms.key}-cmt`}>
                                <textarea
                                  className="dm-cl-ta"
                                  rows={2}
                                  value={getVal(row.uid, ms.cmtKey, row[ms.cmtKey] || '')}
                                  onChange={e=>setVal(row.uid, ms.cmtKey, e.target.value)}
                                  placeholder="Comments…"
                                  readOnly={isReadOnly}/>
                              </td>
                            ) : null,
                          ];
                        })}

                        {/* Source Attachment */}
                        <td>
                          <MrsCell
                            value={getVal(row.uid,'mrs', row.mrs || '')}
                            onChange={v=>setVal(row.uid,'mrs',v)}
                            disabled={isReadOnly}/>
                        </td>

                        {/* Actions */}
                        <td className="dm-td-actions">
                          <div className="dm-row-actions">
                            <button
                              type="button"
                              className="dm-act-btn dm-act-view"
                              title="View row details"
                              onClick={e=>{e.stopPropagation();openViewDrawer(row);}}>
                              <Ic.Eye/>
                            </button>
                            {!isReadOnly && (
                              <button
                                type="button"
                                className="dm-act-btn dm-act-save"
                                title="Save this row"
                                disabled={rowSaving===row.uid}
                                onClick={()=>handleSaveRow(row)}>
                                {rowSaving===row.uid
                                  ? <span className="dm-act-spin"/>
                                  : <Ic.Save/>}
                              </button>
                            )}
                            {!isReadOnly && (() => {
                              const activeVal = getVal(row.uid, activeMilestone, row[activeMilestone] || '');
                              const issueExists = dmrsIssues.some(d => d.flag2 === row.check_Point && d.flag3 === activeMilestone);
                              const isNotOk = activeVal === 'Not OK';
                              if (!isNotOk && !issueExists) return null;
                              return (
                                <button
                                  type="button"
                                  className="dm-act-btn dm-act-issue"
                                  title={issueExists ? 'Issue already created' : 'Create Issue'}
                                  disabled={!isNotOk || issueExists || creatingIssueUid === row.uid}
                                  onClick={()=>handleNotOk(row, activeMilestone)}>
                                  {creatingIssueUid === row.uid
                                    ? <span className="dm-act-spin"/>
                                    : <Ic.Issue/>}
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              <div style={{
                width: canvasMode === 'minimized' ? 44 : 400,
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                transition: 'width 0.2s ease',
                overflow: canvasMode === 'minimized' ? 'hidden' : 'visible',
              }}>
                <DmrsCanvas
                  targetLabel={annotateUid
                    ? (mergedRows.find(r=>r.uid===annotateUid)?.check_Point || 'Selected Row')
                    : null}
                  targetInfo={annotateUid ? (() => {
                    const r = mergedRows.find(row=>row.uid===annotateUid);
                    if (!r) return null;
                    const masterItem = masterDmMap.get(r.check_Point);
                    return { checkpointId: r.check_Point, description: r.description || masterItem?.checkpointDesc || '' };
                  })() : null}
                  onCapture={dataUrl => {
                    if (annotateUid) { setVal(annotateUid, 'mrs', dataUrl); }
                  }}
                  canvasMode={canvasMode}
                  onModeChange={setCanvasMode}
                />
              </div>
            </div>
          )}
        </SectionCard>
        );})()}

        {/* ── 3b. Not OK Issues — auto-created on Save ── */}
        <SectionCard
            title={`Not OK Issues — ${dmrsIssues.length} raised${dmrsIssues.length ? ` (${dmrsIssues.filter(d=>d.flag3===activeMilestone).length} for ${milestoneInfo.label})` : ' · None yet'}`}
            icon={<Ic.Chk/>}
            iconBg="#fff3e0"
            iconColor="#e67e22"
            defaultOpen={true}
          >
            {dmrsIssues.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px 0',color:'#aaa',fontSize:13}}>
                No issues raised yet — rows marked "Not OK" on Save will appear here automatically.
              </div>
            ) : (
            <div style={{overflowX:'auto'}}>
              <table className="dm-cl-table">
                <thead>
                  <tr>
                    <th style={{width:36,textAlign:'center'}}>#</th>
                    <th>Issue #</th>
                    <th>Checkpoint</th>
                    <th>Sync</th>
                    <th>Part Number</th>
                    <th>Project</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Date Opened</th>
                    <th>Req Completion</th>
                    <th>Date Closed</th>
                    <th>Created By</th>
                    <th>Created Date</th>
                    <th>Derogation Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {dmrsIssues.map((d,i) => (
                    <tr key={d.uid} style={{background:d.flag3===activeMilestone?'#fffbf0':''}}>
                      <td style={{textAlign:'center',color:'#aaa',fontSize:12}}>{i+1}</td>
                      <td style={{whiteSpace:'nowrap'}}>
                        <button
                          type="button"
                          onClick={()=>navigate(`/dashboard/issues/${d.uid}`,{state:{from:location.pathname,fromLabel:`Checklist — ${issueNumber}` }})}
                          style={{background:'none',border:'none',padding:0,cursor:'pointer',
                            fontWeight:600,fontSize:12,color:'#3f51b5',textDecoration:'underline',
                            textDecorationColor:'#3f51b533',textUnderlineOffset:2}}>
                          {d.issue_number}
                        </button>
                      </td>
                      <td style={{fontSize:12}}>{d.flag2}</td>
                      <td>
                        <span style={{fontSize:11,padding:'2px 7px',borderRadius:8,
                          background: d.flag3===activeMilestone?'#fff3e0':'#e8ecf8',
                          color:      d.flag3===activeMilestone?'#e65100':'#3f51b5',
                          fontWeight:600}}>
                          {dynMilestones.find(m=>m.key===d.flag3)?.label || d.flag3}
                        </span>
                      </td>
                      <td style={{fontSize:12}}>{d.partNumber || resolvedPartNum || '—'}</td>
                      <td style={{fontSize:12}}>{project?.projectName||project?.ProjectName||'—'}</td>
                      <td style={{fontSize:12}}>{project?.program||project?.Program||partLink?.program||'—'}</td>
                      <td><StatusBadge v={d.status}/></td>
                      <td style={{fontSize:12,whiteSpace:'nowrap'}}>{fmtDateShort(d.date_Opened)}</td>
                      <td style={{fontSize:12,whiteSpace:'nowrap'}}>{fmtDateShort(d.req_Completion_Date)}</td>
                      <td style={{fontSize:12,whiteSpace:'nowrap'}}>{fmtDateShort(d.date_Closed)}</td>
                      <td style={{fontSize:12}}>{d.created_by||'—'}</td>
                      <td style={{fontSize:12,whiteSpace:'nowrap'}}>{fmtDateShort(d.created_date)}</td>
                      <td style={{fontSize:12}}>{d.derogation_sht_num||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </SectionCard>

        {/* ── 4. History ── */}
        <SectionCard
          title="History"
          icon={<Ic.Hist/>}
          iconBg="#fff3e0"
          iconColor="#e67e22"
          defaultOpen={false}
        >
          {dmrsRows.length === 0 ? (
            <div className="dm-empty-hist">No history available yet.</div>
          ) : (
            <div className="dm-hist-list">
              {[...dmrsRows]
                .sort((a,b)=>new Date(b.modifiedDate||b.createdDate||0)-new Date(a.modifiedDate||a.createdDate||0))
                .map(row=>(
                  <div key={row.uid} className="dm-hist-item">
                    <div className="dm-hist-dot"/>
                    <div className="dm-hist-body">
                      <div className="dm-hist-point" title={row.check_Point}>{row.check_Point || '—'}</div>
                      <div className="dm-hist-meta">
                        <span className="dm-hist-who">{row.modifiedBy || row.createdBy || '—'}</span>
                        <span className="dm-hist-when">{fmtDate(row.modifiedDate || row.createdDate)}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>

      </>)}

      {/* ── Row View Side Drawer ── */}
      {viewDrawerMount && (<>
        <div className={`mod-drawer-overlay${viewDrawerOpen?' open':''}`} onClick={closeViewDrawer}/>
        <aside className={`mod-drawer${viewDrawerOpen?' open':''}`} style={{maxWidth:500}}>
          <div className="mod-drawer-header">
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e8edf8',color:'#3f51b5'}}><Ic.Eye/></div>
              <div style={{minWidth:0}}>
                <h2 className="mod-drawer-title" style={{fontSize:14}}>{viewRow?.check_Point || '—'}</h2>
                <p className="mod-drawer-subtitle">{viewRow?.description || 'Row detail view'}</p>
              </div>
            </div>
            <button className="mod-drawer-close" onClick={closeViewDrawer} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="mod-drawer-body" style={{display:'flex',flexDirection:'column',gap:18}}>
            {/* Source Attachment */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Source Attachment</div>
              {viewRow?.mrs
                ? <img src={viewRow.mrs} alt="Source Attachment"
                    style={{width:'100%',maxHeight:'45vh',objectFit:'contain',borderRadius:8,border:'1.5px solid var(--dash-border)',background:'#f8f8f8',display:'block'}}/>
                : <div style={{width:'100%',height:120,borderRadius:8,border:'1.5px dashed var(--dash-border)',background:'#fafbff',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,color:'#ccc',fontSize:12}}>
                    <Ic.Img/><span>No attachment</span>
                  </div>}
            </div>

            {/* Identity */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',paddingBottom:4,borderBottom:'1px solid #e8eaf6',marginBottom:10}}>Identity</div>
              <div className="dm-df-grid">
                <DF label="Zone"         value={viewRow?.zone}/>
                <DF label="Station"      value={viewRow?.stations}/>
                <DF label="Reference"    value={viewRow?.source_Link}/>
                <DF label="MIMS-ID#"     value={viewRow?.mimS_ID}/>
                <DF label="State"        value={viewRow?.flag2}/>
              </div>
            </div>

            {/* Sync */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',paddingBottom:4,borderBottom:'1px solid #e8eaf6',marginBottom:10}}>{milestoneInfo.label}</div>
              <div className="dm-df-grid">
                <DF label={milestoneInfo.label} value={viewRow?.[activeMilestone]}/>
                {milestoneInfo.cmtKey && <DF label="Comments" value={viewRow?.[milestoneInfo.cmtKey]} wide/>}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',paddingBottom:4,borderBottom:'1px solid #e8eaf6',marginBottom:10}}>Notes</div>
              <div className="dm-df-grid">
                <DF label="Actual Remarks"    value={viewRow?.remarks}          wide/>
                <DF label="Change Management" value={viewRow?.changeManagement} wide/>
              </div>
            </div>

            {/* Audit */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',paddingBottom:4,borderBottom:'1px solid #e8eaf6',marginBottom:10}}>Audit</div>
              <div className="dm-df-grid">
                <DF label="Created By"  value={viewRow?.createdBy}/>
                <DF label="Created"     value={fmtDate(viewRow?.createdDate)}/>
                <DF label="Modified By" value={viewRow?.modifiedBy}/>
                <DF label="Modified"    value={fmtDate(viewRow?.modifiedDate)}/>
              </div>
            </div>
          </div>

          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeViewDrawer}>Close</button>
          </div>
        </aside>
      </>)}

      {/* ── Checkpoint Preview Side Drawer ──────────────── */}
      {dmCpMount&&(<>
        <div className={`mod-drawer-overlay${dmCpOpen?' open':''}`} onClick={closeDmCp}/>
        <aside className={`mod-drawer${dmCpOpen?' open':''}`} style={{maxWidth:480}}>
          <div className="mod-drawer-header" style={{borderBottomColor:'#1565c033'}}>
            <div className="mod-drawer-header-left">
              <div className="mod-drawer-mode-icon" style={{background:'#e3f2fd',color:'#1565c0'}}><Ic.Eye/></div>
              <div>
                <h2 className="mod-drawer-title">{dmCpRow?.checkPointS || dmCpRow?.chkId}</h2>
                <p className="mod-drawer-subtitle">{dmCpRow?.chkId}</p>
              </div>
            </div>
            <button className="mod-drawer-close" onClick={closeDmCp} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="mod-drawer-body" style={{display:'flex',flexDirection:'column',gap:18}}>
            <div style={{background:'#f8faff',border:'1px solid #dde3f7',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:'#3f51b5',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:6}}>Description</div>
              <p style={{margin:0,fontSize:13,color:'#333',lineHeight:1.6}}>{dmCpRow?.checkpointDesc||<span style={{color:'#bbb'}}>No description.</span>}</p>
              <div style={{display:'flex',gap:14,marginTop:8,flexWrap:'wrap'}}>
                {dmCpRow?.department&&<span style={{fontSize:11,color:'#666'}}><b>Dept:</b> {dmCpRow.department}</span>}
                {dmCpRow?.category&&<span style={{fontSize:11,color:'#666'}}><b>Category:</b> {dmCpRow.category}</span>}
                {dmCpRow?.mandatory&&<span style={{fontSize:11,color:'#666'}}><b>Mandatory:</b> {dmCpRow.mandatory}</span>}
              </div>
            </div>
            {parseDmDoc(dmCpRow?.refDocument)?(
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8}}>Reference Document</div>
                <a href={parseDmDoc(dmCpRow.refDocument).path || parseDmDoc(dmCpRow.refDocument).data}
                  download={parseDmDoc(dmCpRow.refDocument).fileName}
                  target="_blank" rel="noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:10,padding:'10px 16px',
                    background:'#e8f4ff',border:'1.5px solid #90caf9',borderRadius:10,
                    color:'#1565c0',fontSize:13,fontWeight:700,textDecoration:'none'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {parseDmDoc(dmCpRow.refDocument).fileName}
                </a>
              </div>
            ):<div style={{padding:'10px',background:'#fafafa',borderRadius:8,border:'1px dashed #e0e0e0',color:'#bbb',fontSize:12,textAlign:'center'}}>No document attached</div>}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8}}>
                Images {parseDmImg(dmCpRow?.images).length>0&&`(${parseDmImg(dmCpRow.images).length})`}
              </div>
              {parseDmImg(dmCpRow?.images).length===0
                ?<div style={{padding:'10px',background:'#fafafa',borderRadius:8,border:'1px dashed #e0e0e0',color:'#bbb',fontSize:12,textAlign:'center'}}>No images attached</div>
                :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:8}}>
                  {parseDmImg(dmCpRow.images).map((src,i)=>(
                    <img key={i} src={src} alt={`img-${i+1}`} onClick={()=>setDmCpLightbox(src)}
                      style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:8,border:'1px solid #e0e4f0',cursor:'zoom-in'}}/>
                  ))}
                </div>
              }
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>History</div>
              <div style={{borderLeft:'2px solid #e8eaf6',paddingLeft:16,display:'flex',flexDirection:'column',gap:0}}>
                {dmCpRow?.createdBy&&<div style={{position:'relative',paddingBottom:10}}>
                  <span style={{position:'absolute',left:-21,top:4,width:8,height:8,borderRadius:'50%',background:'#3f51b5',border:'2px solid #fff',boxShadow:'0 0 0 2px #c5cae9'}}/>
                  <div style={{fontSize:12,fontWeight:700,color:'#3f51b5'}}>Created</div>
                  <div style={{fontSize:12,color:'#555'}}>{dmCpRow.createdBy}</div>
                  <div style={{fontSize:11,color:'#aaa'}}>{fmtDmDate(dmCpRow.createdDate)}</div>
                </div>}
                {dmCpRow?.modifiedBy&&<div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:-21,top:4,width:8,height:8,borderRadius:'50%',background:'#e67e22',border:'2px solid #fff',boxShadow:'0 0 0 2px #ffe0b2'}}/>
                  <div style={{fontSize:12,fontWeight:700,color:'#e67e22'}}>Last Modified</div>
                  <div style={{fontSize:12,color:'#555'}}>{dmCpRow.modifiedBy}</div>
                  <div style={{fontSize:11,color:'#aaa'}}>{fmtDmDate(dmCpRow.modifiedDate)}</div>
                </div>}
              </div>
            </div>
          </div>
          <div className="mod-drawer-footer">
            <button className="mod-btn mod-btn-outline" onClick={closeDmCp}>Close</button>
          </div>
        </aside>
        {dmCpLightbox&&(
          <div onClick={()=>setDmCpLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
            <img src={dmCpLightbox} alt="preview" style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 8px 40px rgba(0,0,0,.6)',objectFit:'contain'}}/>
            <button onClick={()=>setDmCpLightbox(null)}
              style={{position:'absolute',top:20,right:24,background:'rgba(255,255,255,.15)',border:'none',
                color:'#fff',fontSize:22,cursor:'pointer',width:40,height:40,borderRadius:'50%',
                display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
        )}
      </>)}
    </div>
  );
}
