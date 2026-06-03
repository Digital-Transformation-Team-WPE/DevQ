import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  issueDocApi, issuePartApi, issueHistoryApi,
  projectIssueLinkApi, projectsApi, componentMetaApi,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import { generateIssuePdf } from '../../utils/pdfReport';
import './IssueManage.css';

// ── Issue Ref Doc status options ───────────────────────────────────────────────
const REF_STATUSES = [
  { value:'1', color:'#27ae60', label:'Robust',               desc:'No issues identified. Requirement is fully satisfied.' },
  { value:'2', color:'#f39c12', label:'Minor Risk (With PA)', desc:'Minor risk exists, but a Preventive/Action Plan (PA) is in place.' },
  { value:'3', color:'#e74c3c', label:'Unfeasibility / Problem', desc:'Significant issue or technical feasibility concern requiring immediate attention.' },
  { value:'4', color:'#e67e22', label:'No DFN for Robustness', desc:'No DFN has been created for a robustness concern. Action required.' },
  { value:'5', color:'#2980b9', label:'Not Rated (CFER)',      desc:'Assessment has not yet been performed.' },
];

// ── helpers ────────────────────────────────────────────────────────────────────
const genUid      = () => crypto.randomUUID().replace(/-/g,'').toUpperCase();
const fmtDate     = v => v ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const toDateInput = v => v ? new Date(v).toISOString().split('T')[0] : '';
const metaOpts    = (meta, lbl) => [...new Set(meta.filter(m=>m.label?.toLowerCase()===lbl.toLowerCase()&&m.status?.toUpperCase()==='ACTIVE').map(m=>m.parameter).filter(Boolean))].sort();

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Ic = {
  Back:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Edit:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Save:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Down:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Plus:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  History:  ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>,
  Check:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Img:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Camera:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Undo:     ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  ChevDown: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevUp:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  Link:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Eye:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ── Shared primitives ──────────────────────────────────────────────────────────
const StatusBadge = ({v}) => {
  const cls={
    'Open':             'im-badge-open',
    'In Progress':      'im-badge-progress',
    'Completed Ok':     'im-badge-completed-ok',
    'Completed Not Ok': 'im-badge-completed-notok',
    'Closed':           'im-badge-closed',
    'On Hold':          'im-badge-hold',
  }[v]||'im-badge-hold';
  return <span className={`im-badge ${cls}`}>{v||'—'}</span>;
};
const KV = ({label,value,badge,wide}) => (
  <div className={`im-kv${wide?' im-kv-wide':''}`}>
    <div className="im-kv-label">{label}</div>
    <div className="im-kv-value">{badge??(value||'—')}</div>
  </div>
);
const Sel = ({value,onChange,options,placeholder='Select…'}) => (
  <div className="im-sel-wrap">
    <select value={value||''} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
    <span className="im-sel-arrow">▾</span>
  </div>
);

// ── Collapsible section card ───────────────────────────────────────────────────
function SectionCard({title,iconBg,iconColor,iconEl,actions,children,defaultOpen=true}) {
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div className={`im-card${open?'':' im-card-collapsed'}`}>
      <div className="im-card-header">
        <div className="im-card-title-row">
          <div className="im-card-icon" style={{background:iconBg,color:iconColor}}>{iconEl}</div>
          <h3 className="im-card-title">{title}</h3>
        </div>
        <div className="im-card-header-right">
          {actions}
          <button className="im-toggle-btn" onClick={()=>setOpen(o=>!o)} title={open?'Collapse':'Expand'}>
            {open ? <Ic.ChevUp/> : <Ic.ChevDown/>}
          </button>
        </div>
      </div>
      {open && <div className="im-card-body">{children}</div>}
    </div>
  );
}


// ── Drawing Canvas (layered: movable images + ink strokes) ───────────────────
const DRAW_TOOLS = ['select','pen','highlighter','arrow','box','text'];
const TOOL_LBL   = {select:'Select',pen:'Pen',highlighter:'Highlight',arrow:'Arrow',box:'Box',text:'Text'};
const WIDTHS     = ['1','2','3','5','8'];
const ASPECT = 320 / 720; // H/W ratio kept from original — maintained on resize
const HNDL_R = 6; // resize handle radius (canvas px)

const getHandles = l => [
  { id:'nw', cx:l.x,     cy:l.y      },
  { id:'ne', cx:l.x+l.w, cy:l.y      },
  { id:'sw', cx:l.x,     cy:l.y+l.h  },
  { id:'se', cx:l.x+l.w, cy:l.y+l.h  },
];
const HANDLE_CURSOR = { nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize' };

const hitHandle = (x, y, l) => {
  for (const h of getHandles(l)) {
    if (Math.abs(x-h.cx) <= HNDL_R+3 && Math.abs(y-h.cy) <= HNDL_R+3) return h.id;
  }
  return null;
};

function DrawingCanvas({onCapture}) {
  const mainRef = useRef(null);   // visible canvas
  const inkRef  = useRef(null);   // offscreen canvas — pen/highlight/arrow/box strokes

  // image objects stored as refs to avoid stale closures during animation
  const imgLayersRef  = useRef([]);   // [{ id, imgEl, x, y, w, h }]
  const selectedIdRef = useRef(null);
  const dragRef   = useRef({ active:false, lastX:0, lastY:0 });
  const resizeRef = useRef({ active:false, handleId:null, startX:0, startY:0, origLayer:null });
  const drawRef   = useRef({ active:false, x0:0, y0:0, snap:null });
  const undoRef   = useRef([]);        // [{ inkData: ImageData, layers: [...] }]

  const [tick,     setTick]     = useState(0);
  const [undoLen,  setUndoLen]  = useState(0);
  const [tool,     setTool]     = useState('pen');
  const [color,    setColor]    = useState('#e74c3c');
  const [lineW,    setLineW]    = useState('3');
  const [attached, setAttached] = useState([]);
  const [isMax,    setIsMax]    = useState(false);
  // Canvas buffer — set once at full-screen resolution, never resized
  const dimRef = useRef({ w: 1920, h: 853 });
  const [dim,  setDim]  = useState({ w: 1920, h: 853 });
  const canvasFileRef = useRef(null);
  const attachFileRef = useRef(null);

  // Escape key exits maximized mode
  useEffect(() => {
    if (!isMax) return;
    const h = e => { if (e.key === 'Escape') setIsMax(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isMax]);

  const bump = useCallback(() => setTick(t => t+1), []);

  // init offscreen ink canvas once — transparent background so strokes render on top of images
  // Init ink canvas once at screen resolution × DPR — never resized after this
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const initW = Math.min(Math.round((window.screen?.width || 1920) * dpr), 4096);
    const initH = Math.round(initW * ASPECT);
    const ink = document.createElement('canvas');
    ink.width = initW; ink.height = initH;
    inkRef.current = ink;
    dimRef.current = { w: initW, h: initH };
    setDim({ w: initW, h: initH });
    bump();
  }, [bump]);

  // re-draw main canvas: white → images → ink strokes on top
  useEffect(() => {
    const main = mainRef.current;
    const ink  = inkRef.current;
    if (!main || !ink) return;
    const ctx = main.getContext('2d');
    // 1. white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, main.width, main.height);
    // 2. movable image layers
    imgLayersRef.current.forEach(l => {
      ctx.drawImage(l.imgEl, l.x, l.y, l.w, l.h);
      if (l.id === selectedIdRef.current) {
        // dashed selection border
        ctx.save();
        ctx.strokeStyle = '#3f51b5';
        ctx.lineWidth   = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(l.x-2, l.y-2, l.w+4, l.h+4);
        ctx.restore();
        // corner resize handles
        ctx.save();
        ctx.setLineDash([]);
        getHandles(l).forEach(h => {
          ctx.beginPath();
          ctx.arc(h.cx, h.cy, HNDL_R, 0, Math.PI*2);
          ctx.fillStyle   = '#fff';
          ctx.strokeStyle = '#3f51b5';
          ctx.lineWidth   = 2;
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    });
    // 3. ink strokes on top of everything
    ctx.drawImage(ink, 0, 0);
  }, [tick]);

  const getPos = e => {
    const c = mainRef.current, r = c.getBoundingClientRect();
    const sx = c.width/r.width, sy = c.height/r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x:(src.clientX-r.left)*sx, y:(src.clientY-r.top)*sy };
  };

  const hitTest = (x, y) => {
    const layers = imgLayersRef.current;
    for (let i = layers.length-1; i >= 0; i--) {
      const l = layers[i];
      if (x >= l.x && x <= l.x+l.w && y >= l.y && y <= l.y+l.h) return l.id;
    }
    return null;
  };

  const pushUndo = useCallback(() => {
    const ink = inkRef.current; if (!ink) return;
    undoRef.current = [...undoRef.current.slice(-29), {
      inkData: ink.getContext('2d').getImageData(0, 0, ink.width, ink.height),
      layers:  imgLayersRef.current.map(l => ({ ...l })),
    }];
    setUndoLen(undoRef.current.length);
  }, []);

  const doUndo = () => {
    if (!undoRef.current.length) return;
    const snap = undoRef.current[undoRef.current.length-1];
    inkRef.current.getContext('2d').putImageData(snap.inkData, 0, 0);
    imgLayersRef.current = snap.layers.map(l => ({ ...l }));
    selectedIdRef.current = null;
    undoRef.current = undoRef.current.slice(0, -1);
    setUndoLen(undoRef.current.length);
    bump();
  };

  const doClear = () => {
    if (!inkRef.current) return;
    pushUndo();
    const ctx = inkRef.current.getContext('2d');
    ctx.clearRect(0, 0, inkRef.current.width, inkRef.current.height);
    imgLayersRef.current = []; selectedIdRef.current = null; bump();
  };

  // add an image (data-url or object-url) as a movable layer
  const addImageLayer = useCallback((src) => {
    const img = new Image();
    img.onload = () => {
      const { w: cw, h: ch } = dimRef.current;
      const scale = Math.min(cw/img.naturalWidth, ch/img.naturalHeight, 0.85);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      pushUndo();
      imgLayersRef.current = [...imgLayersRef.current,
        { id:genUid(), imgEl:img, x:(cw-w)/2, y:(ch-h)/2, w, h }];
      selectedIdRef.current = null;
      bump();
    };
    img.src = src;
  }, [pushUndo, bump]);

  // Ctrl+V / paste
  useEffect(() => {
    const handler = e => {
      const imgItem = Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
      if (!imgItem) return;
      addImageLayer(URL.createObjectURL(imgItem.getAsFile()));
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [addImageLayer]);

  const drawArrow = (ctx, x1, y1, x2, y2) => {
    const h = 16, angle = Math.atan2(y2-y1, x2-x1);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-h*Math.cos(angle-Math.PI/6), y2-h*Math.sin(angle-Math.PI/6));
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-h*Math.cos(angle+Math.PI/6), y2-h*Math.sin(angle+Math.PI/6));
    ctx.stroke();
  };

  const applyInkCtx = (ctx, isHl) => {
    ctx.strokeStyle              = color;
    ctx.lineWidth                = isHl ? parseInt(lineW,10)*7 : parseInt(lineW,10);
    ctx.lineCap                  = 'square';
    ctx.lineJoin                 = 'round';
    ctx.globalAlpha              = isHl ? 0.38 : 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const onDown = e => {
    e.preventDefault();
    const pos = getPos(e);

    // SELECT — resize or move images
    if (tool === 'select') {
      // 1. check resize handles on currently selected layer first
      const selId = selectedIdRef.current;
      if (selId) {
        const selLayer = imgLayersRef.current.find(l => l.id === selId);
        if (selLayer) {
          const hId = hitHandle(pos.x, pos.y, selLayer);
          if (hId) {
            pushUndo();
            resizeRef.current = { active:true, handleId:hId, startX:pos.x, startY:pos.y, origLayer:{...selLayer} };
            return;
          }
        }
      }
      // 2. check body hit → start drag
      const hitId = hitTest(pos.x, pos.y);
      selectedIdRef.current = hitId;
      dragRef.current = { active: !!hitId, lastX: pos.x, lastY: pos.y };
      bump();
      return;
    }

    selectedIdRef.current = null;

    if (tool === 'text') {
      const txt = window.prompt('Enter text:');
      if (txt) {
        pushUndo();
        const ctx = inkRef.current.getContext('2d');
        ctx.globalAlpha = 1; ctx.fillStyle = color;
        ctx.font = `${parseInt(lineW,10)*5+12}px "Segoe UI",sans-serif`;
        ctx.fillText(txt, pos.x, pos.y);
        bump();
      }
      return;
    }

    pushUndo();
    const ink = inkRef.current, ctx = ink.getContext('2d');
    applyInkCtx(ctx, tool==='highlighter');
    drawRef.current = { active:true, x0:pos.x, y0:pos.y,
      snap: ctx.getImageData(0, 0, ink.width, ink.height) };
    if (tool==='pen') { ctx.beginPath(); ctx.moveTo(pos.x,pos.y); }
    if (tool==='highlighter') { drawRef.current.pts = [{x:pos.x, y:pos.y}]; }
  };

  const onMove = e => {
    e.preventDefault();
    const pos = getPos(e);

    // resize selected image
    if (tool==='select' && resizeRef.current.active) {
      const dx = pos.x - resizeRef.current.startX;
      const dy = pos.y - resizeRef.current.startY;
      const o  = resizeRef.current.origLayer;
      let nx=o.x, ny=o.y, nw=o.w, nh=o.h;
      switch (resizeRef.current.handleId) {
        case 'se': nw=o.w+dx; nh=o.h+dy; break;
        case 'sw': nx=o.x+dx; nw=o.w-dx; nh=o.h+dy; break;
        case 'ne': nw=o.w+dx; ny=o.y+dy; nh=o.h-dy; break;
        case 'nw': nx=o.x+dx; ny=o.y+dy; nw=o.w-dx; nh=o.h-dy; break;
      }
      nw=Math.max(20,nw); nh=Math.max(20,nh);
      imgLayersRef.current = imgLayersRef.current.map(l=>
        l.id===o.id ? {...l,x:nx,y:ny,w:nw,h:nh} : l);
      bump();
      return;
    }

    // drag (move) selected image
    if (tool==='select' && dragRef.current.active) {
      const dx = pos.x-dragRef.current.lastX, dy = pos.y-dragRef.current.lastY;
      dragRef.current.lastX = pos.x; dragRef.current.lastY = pos.y;
      const id = selectedIdRef.current;
      if (id) {
        imgLayersRef.current = imgLayersRef.current.map(l=>
          l.id===id ? {...l, x:l.x+dx, y:l.y+dy} : l);
        bump();
      }
      return;
    }

    if (!drawRef.current.active) return;
    const ink = inkRef.current, ctx = ink.getContext('2d');
    const hl  = tool==='highlighter';
    applyInkCtx(ctx, hl);
    if (tool==='pen') { ctx.lineTo(pos.x,pos.y); ctx.stroke(); bump(); }
    else if (tool==='highlighter') {
      // Rubber-band: restore snap then redraw full path once — prevents alpha accumulation
      drawRef.current.pts.push({x:pos.x, y:pos.y});
      ctx.putImageData(drawRef.current.snap, 0, 0);
      applyInkCtx(ctx, true);
      const pts = drawRef.current.pts;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); bump();
    } else {
      ctx.putImageData(drawRef.current.snap, 0, 0);
      ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = parseInt(lineW,10);
      if (tool==='box')   ctx.strokeRect(drawRef.current.x0, drawRef.current.y0, pos.x-drawRef.current.x0, pos.y-drawRef.current.y0);
      if (tool==='arrow') drawArrow(ctx, drawRef.current.x0, drawRef.current.y0, pos.x, pos.y);
      bump();
    }
  };

  const onUp = e => {
    if (drawRef.current.active || dragRef.current.active || resizeRef.current.active) e.preventDefault?.();
    drawRef.current.active  = false;
    dragRef.current.active  = false;
    resizeRef.current.active = false;
    if (inkRef.current) {
      const ctx2 = inkRef.current.getContext('2d');
      ctx2.globalAlpha = 1;
      ctx2.globalCompositeOperation = 'source-over';
    }
    bump();
  };

  // drag-and-drop files onto canvas
  const onDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const onDrop = e => {
    e.preventDefault();
    Array.from(e.dataTransfer.files||[])
      .filter(f=>f.type.startsWith('image/'))
      .forEach(f => addImageLayer(URL.createObjectURL(f)));
  };

  const handleCapture = () => {
    const dataUrl = mainRef.current.toDataURL('image/png');
    setAttached(p=>[...p, dataUrl]);
    if (onCapture) onCapture(dataUrl);
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `annotation-${Date.now()}.png`; a.click();
  };

  // add image files onto the canvas as movable layers
  const handleFileToCanvas = e => {
    Array.from(e.target.files||[]).forEach(f => addImageLayer(URL.createObjectURL(f)));
    e.target.value = '';
  };

  // add files directly to attached list (not on canvas)
  const handleFileAttach = e => {
    Array.from(e.target.files||[]).forEach(f => {
      const r = new FileReader();
      r.onload = ev => setAttached(p=>[...p, ev.target.result]);
      r.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const cursorStyle = (() => {
    if (tool !== 'select') return tool==='text' ? 'text' : 'crosshair';
    if (resizeRef.current.active) return HANDLE_CURSOR[resizeRef.current.handleId] || 'nwse-resize';
    if (dragRef.current.active)   return 'grabbing';
    return 'default';
  })();

  return (
    <div className={`im-canvas-wrap${isMax?' im-canvas-max':''}`}>
      {/* toolbar */}
      <div className="im-canvas-bar">
        <div className="im-tool-grp">
          {DRAW_TOOLS.map(t=>(
            <button key={t} className={`im-tbtn${tool===t?' active':''}`}
              onClick={()=>setTool(t)} title={TOOL_LBL[t]}>{TOOL_LBL[t]}</button>
          ))}
        </div>
        <div className="im-tool-grp im-tool-right">
          <span className="im-tlbl">Color</span>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="im-color-swatch"/>
          <span className="im-tlbl">Width</span>
          <select value={lineW} onChange={e=>setLineW(e.target.value)} className="im-width-sel">
            {WIDTHS.map(w=><option key={w} value={w}>{w}px</option>)}
          </select>
          <button className="im-tbtn" style={{color:'#111'}} onClick={doUndo} disabled={undoLen===0}><Ic.Undo/> Undo</button>
          <button className="im-tbtn" style={{color:'#111'}} onClick={()=>canvasFileRef.current.click()}><Ic.Img/> Add Image</button>
          <button className="im-tbtn im-tbtn-danger" onClick={doClear} title="Clear entire canvas">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Clear
          </button>
          <button className="im-tbtn im-tbtn-max" onClick={()=>setIsMax(m=>!m)}
            title={isMax?'Restore (Esc)':'Maximize canvas'}>
            {isMax
              ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
              : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            }
            {isMax ? 'Restore' : 'Maximise'}
          </button>
        </div>
      </div>

      {/* canvas — drag-and-drop zone */}
      <div className="im-canvas-area" onDragOver={onDragOver} onDrop={onDrop}>
        <canvas ref={mainRef} width={dim.w} height={dim.h} className="im-canvas"
          style={{cursor: cursorStyle}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
        <div className="im-canvas-hint">
          Drag &amp; Drop images here • Ctrl+V to paste • Select tool to move images
        </div>
      </div>

      {/* capture */}
      <div className="im-canvas-footer">
        <button className="im-btn im-btn-capture" onClick={handleCapture}>
          <Ic.Camera/> Capture &amp; Save
        </button>
        <input ref={canvasFileRef} type="file" accept="image/*" multiple
          style={{display:'none'}} onChange={handleFileToCanvas}/>
      </div>

      {/* attached */}
      <div className="im-attach-section">
        <div className="im-attach-bar">
          <span className="im-attach-count">Attached Images ({attached.length})</span>
          <button className="im-btn-add-img" onClick={()=>attachFileRef.current.click()}>+ Add Images</button>
          <input ref={attachFileRef} type="file" accept="image/*" multiple
            style={{display:'none'}} onChange={handleFileAttach}/>
        </div>
        {attached.length===0
          ? <div className="im-attach-empty-msg">No images attached — Capture &amp; Save or + Add Images</div>
          : <div className="im-attach-thumbs">
              {attached.map((src,i)=>(
                <div key={i} className="im-thumb">
                  <img src={src} alt={`img-${i+1}`}/>
                  <button className="im-thumb-rm"
                    onClick={()=>setAttached(p=>p.filter((_,idx)=>idx!==i))}><Ic.Trash/></button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IssueManage() {
  const {uid}     = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const {user}    = useAuth();
  const perm      = usePermissions();
  const actor     = user?.userId||user?.email||'system';

  const backPath  = location.state?.from      || '/dashboard/issues';
  const backLabel = location.state?.fromLabel || 'Issue List';

  // Convenience: can the current user mutate THIS specific issue document?
  // Called lazily after docInfo is loaded (docInfo may be null initially).
  const canEditIssue = (doc = null) => perm.canEdit('issues', doc);

  // data
  const [docInfo,    setDocInfo]    = useState(null);
  const [partInfo,   setPartInfo]   = useState(null);
  const [histories,  setHistories]  = useState([]);
  const [projLinks,  setProjLinks]  = useState([]);
  const [partExtras, setPartExtras] = useState({});  // parsed flag2 from checklist-doc link
  const [chkLink,    setChkLink]    = useState(null); // full checklist-doc ProjectIssueLink
  const [projects,   setProjects]   = useState([]);
  const [meta,       setMeta]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);


  // issue ref doc fields
  const [refDocNo,     setRefDocNo]     = useState('');
  const [refDocDesc,   setRefDocDesc]   = useState('');
  const [refSrcLink,   setRefSrcLink]   = useState('');
  const [refDocStatus, setRefDocStatus] = useState('');
  const [refSaving,    setRefSaving]    = useState(false);
  const [refEditing,   setRefEditing]   = useState(false);

  // proposals
  const [proposals,    setProposals]    = useState('');
  const [solutions,    setSolutions]    = useState('');
  const [pubOnTime,    setPubOnTime]    = useState(false);
  const [pubDate,      setPubDate]      = useState('');
  const [comments,     setComments]     = useState('');
  const [propSaving,   setPropSaving]   = useState(false);
  const [canvasImages, setCanvasImages] = useState([]);

  // project link form
  const [linkForm,   setLinkForm]   = useState(null); // null=hidden
  const [linkSaving, setLinkSaving] = useState(false);
  const [editingLink,setEditingLink]= useState(null);

  // submit
  const [submitting, setSubmitting] = useState(false);

  // ── history helper ────────────────────────────────────────────
  const reloadHistories = useCallback(async issueNum => {
    try {
      const h=await issueHistoryApi.byIssueNumber(issueNum);
      setHistories([...(h||[])].sort((a,b)=>new Date(b.modified_date)-new Date(a.modified_date)));
    } catch{}
  },[]);

  const addHistory = useCallback(async (action,docRef) => {
    const d=docRef||docInfo; if(!d) return;
    try {
      await issueHistoryApi.create({
        uid:genUid(),partNumber:d.partNumber,issue_number:d.issue_number,
        modified_by:actor,modified_date:new Date().toISOString(),flag1:action,
      });
    } catch{}
  },[actor,docInfo]);

  // ── initial load ──────────────────────────────────────────────
  useEffect(()=>{
    if(!uid) return;
    setLoading(true);
    Promise.allSettled([
      issueDocApi.getById(uid),
      projectsApi.getAll(),
      componentMetaApi.getAll(),
    ]).then(async ([docRes,projRes,metaRes])=>{
      if(docRes.status!=='fulfilled'){ setError(docRes.reason?.message||'Not found'); return; }
      const doc=docRes.value;
      setDocInfo(doc);
      setRefDocNo(doc.issuRefDocNo || '');
      setRefDocDesc(doc.issuRefDocDesc || '');
      setRefSrcLink(doc.issueSrcLink || '');
      setRefDocStatus(doc.issueRefDocStatus || '');
      if(projRes.status==='fulfilled') setProjects(projRes.value||[]);
      if(metaRes.status==='fulfilled') setMeta(metaRes.value||[]);

      const issueNum=doc.issue_number;
      const [partsRes,histRes,linksRes]=await Promise.allSettled([
        issuePartApi.byIssueNumber(issueNum),
        issueHistoryApi.byIssueNumber(issueNum),
        projectIssueLinkApi.byIssueNumber(issueNum),
      ]);

      if(partsRes.status==='fulfilled'){
        const p=(partsRes.value||[])[0]||null;
        setPartInfo(p);
        if(p){
          setProposals(p.proposals||'');
          setSolutions(p.solutions||'');
          setPubOnTime(p.flag1==='Y');
          setPubDate(p.flag2?toDateInput(p.flag2):toDateInput(new Date()));
          setComments(p.comments_on_picture_rh||'');
          try { setCanvasImages(p.flag3 ? JSON.parse(p.flag3) : []); } catch { setCanvasImages([]); }
        } else { setPubDate(toDateInput(new Date())); }
      }

      if(histRes.status==='fulfilled'){
        const h=histRes.value||[];
        setHistories([...h].sort((a,b)=>new Date(b.modified_date)-new Date(a.modified_date)));
      }

      const links = linksRes.status==='fulfilled' ? (linksRes.value||[]) : [];
      if(linksRes.status==='fulfilled') setProjLinks(links);

      // ── Load part extras from the checklist-doc ProjectIssueLink ──
      let extras = {};
      const chkDocNum = doc.flag1 || '';
      if (chkDocNum && chkDocNum.includes('-')) {
        try {
          const chkLinks = await projectIssueLinkApi.byIssueNumber(chkDocNum);
          const lnk = (chkLinks || [])[0];
          if (lnk) {
            setChkLink(lnk);
            if (lnk.flag2 || lnk.Flag2) {
              extras = JSON.parse(lnk.flag2 || lnk.Flag2 || '{}');
            }
          }
        } catch {}
      }
      if (!extras.material && links.length > 0) {
        const linkWithExtras = links.find(l => l.flag2 || l.Flag2);
        if (linkWithExtras) {
          try { extras = JSON.parse(linkWithExtras.flag2 || linkWithExtras.Flag2 || '{}'); } catch {}
        }
      }
      setPartExtras(extras);
    }).catch(e=>setError(e.message))
    .finally(()=>setLoading(false));
  },[uid]);

  // ── Proposals save ────────────────────────────────────────────
  const handlePropSave = async () => {
    setPropSaving(true);
    try {
      const now=new Date().toISOString();
      const base=partInfo||{};
      const payload={...base,uid:base.uid||genUid(),partNumber:docInfo.partNumber,issue_number:docInfo.issue_number,
        proposals,solutions,flag1:pubOnTime?'Y':'N',flag2:pubDate,comments_on_picture_rh:comments,
        flag3:JSON.stringify(canvasImages),
        modified_by:actor,modified_date:now,...(base.uid?{}:{created_by:actor,created_date:now})};
      if(base.uid) await issuePartApi.update(base.uid,payload);
      else{ const c=await issuePartApi.create(payload); setPartInfo(c); }
      await addHistory('Proposals / Comments Saved');
      await reloadHistories(docInfo.issue_number);
      Swal.fire({icon:'success',title:'Saved',timer:1800,showConfirmButton:false,timerProgressBar:true});
    } catch(e){ Swal.fire({icon:'error',title:'Save Failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setPropSaving(false); }
  };

  // ── Issue Ref Doc save ────────────────────────────────────────
  const handleRefSave = async () => {
    setRefSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        ...docInfo,
        issuRefDocNo: refDocNo,
        issuRefDocDesc: refDocDesc,
        issueSrcLink: refSrcLink,
        issueRefDocStatus: refDocStatus,
        modified_by: actor,
        modified_date: now,
      };
      const updated = await issueDocApi.update(docInfo.uid, payload);
      setDocInfo(updated);
      setRefEditing(false);
      await addHistory('Issue Ref Doc Updated');
      await reloadHistories(docInfo.issue_number);
      Swal.fire({ icon:'success', title:'Saved', timer:1800, showConfirmButton:false, timerProgressBar:true });
    } catch(e) {
      Swal.fire({ icon:'error', title:'Save Failed', text:e.message, confirmButtonColor:'#3f51b5' });
    } finally {
      setRefSaving(false);
    }
  };

  const handleRefCancel = () => {
    setRefDocNo(docInfo.issuRefDocNo || '');
    setRefDocDesc(docInfo.issuRefDocDesc || '');
    setRefSrcLink(docInfo.issueSrcLink || '');
    setRefDocStatus(docInfo.issueRefDocStatus || '');
    setRefEditing(false);
  };

  // ── Canvas capture — auto-saves image to partInfo.flag3 ──────
  const handleCanvasCapture = useCallback(async (dataUrl) => {
    const newImages = [...canvasImages, dataUrl];
    setCanvasImages(newImages);
    try {
      const now = new Date().toISOString();
      const base = partInfo || {};
      const payload = {
        ...base,
        uid: base.uid || genUid(),
        partNumber: docInfo.partNumber,
        issue_number: docInfo.issue_number,
        proposals, solutions,
        flag1: pubOnTime ? 'Y' : 'N',
        flag2: pubDate,
        comments_on_picture_rh: comments,
        flag3: JSON.stringify(newImages),
        modified_by: actor,
        modified_date: now,
        ...(base.uid ? {} : { created_by: actor, created_date: now }),
      };
      if (base.uid) {
        await issuePartApi.update(base.uid, payload);
      } else {
        const c = await issuePartApi.create(payload);
        setPartInfo(c);
      }
    } catch (e) { console.error('Failed to save canvas image', e); }
  }, [canvasImages, partInfo, docInfo, proposals, solutions, pubOnTime, pubDate, comments, actor]);

  const handleRemoveCanvasImage = useCallback(async (idx) => {
    const newImages = canvasImages.filter((_,i) => i !== idx);
    setCanvasImages(newImages);
    try {
      const base = partInfo || {};
      if (!base.uid) return;
      await issuePartApi.update(base.uid, { ...base, flag3: JSON.stringify(newImages), modified_by: actor, modified_date: new Date().toISOString() });
    } catch (e) { console.error('Failed to remove canvas image', e); }
  }, [canvasImages, partInfo, actor]);

  // ── Project link CRUD ─────────────────────────────────────────
  const LINK_EMPTY = {uid:'',project:'',program:'',flag1:'',plant:'',plant_year:'',status:'Active'};

  const openLinkForm = (link=null) => {
    setEditingLink(link?.uid||null);
    setLinkForm(link?{...link}:{...LINK_EMPTY,uid:genUid(),partNumber:docInfo?.partNumber||''});
  };
  const slk=(k,v)=>setLinkForm(p=>({...p,[k]:v}));

  const handleLinkSave = async () => {
    if(!linkForm.project){ Swal.fire({icon:'warning',title:'Required',text:'Project is required.',confirmButtonColor:'#3f51b5'}); return; }
    setLinkSaving(true);
    try {
      const now=new Date().toISOString();
      const payload={...linkForm,issue_number:docInfo.issue_number,modified_by:actor,modified_date:now,
        ...(editingLink?{}:{created_by:actor,created_date:now})};
      if(editingLink){
        await projectIssueLinkApi.update(editingLink,payload);
        setProjLinks(p=>p.map(l=>l.uid===editingLink?payload:l));
      } else {
        const c=await projectIssueLinkApi.create(payload);
        setProjLinks(p=>[...p,c]);
      }
      setLinkForm(null); setEditingLink(null);
      await addHistory(editingLink?'Project Link Updated':'Project Link Added');
      await reloadHistories(docInfo.issue_number);
    } catch(e){ Swal.fire({icon:'error',title:'Save Failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setLinkSaving(false); }
  };

  const handleLinkDelete = async (link) => {
    const r=await Swal.fire({title:'Remove link?',text:`Remove link to project "${link.project}"?`,icon:'warning',showCancelButton:true,confirmButtonColor:'#e74c3c',cancelButtonColor:'#6c757d',confirmButtonText:'Remove',reverseButtons:true});
    if(!r.isConfirmed) return;
    try {
      await projectIssueLinkApi.remove(link.uid);
      setProjLinks(p=>p.filter(l=>l.uid!==link.uid));
      await addHistory('Project Link Removed');
      await reloadHistories(docInfo.issue_number);
    } catch(e){ Swal.fire({icon:'error',title:'Failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const r=await Swal.fire({title:'Submit Issue?',html:`<b>${docInfo?.issue_number}</b><br/><small style="color:#888">This will mark the issue as Closed.</small>`,icon:'question',showCancelButton:true,confirmButtonColor:'#27ae60',cancelButtonColor:'#6c757d',confirmButtonText:'Submit',reverseButtons:true});
    if(!r.isConfirmed) return;
    setSubmitting(true);
    try {
      const now=new Date().toISOString();
      await issueDocApi.update(docInfo.uid,{...docInfo,status:'Closed',date_Closed:now,modified_by:actor,modified_date:now});
      setDocInfo(d=>({...d,status:'Closed',date_Closed:now}));
      await addHistory('Issue Submitted & Closed');
      await reloadHistories(docInfo.issue_number);
      Swal.fire({icon:'success',title:'Issue Submitted!',text:'Status set to Closed.',timer:2500,showConfirmButton:false,timerProgressBar:true});
    } catch(e){ Swal.fire({icon:'error',title:'Submit Failed',text:e.message,confirmButtonColor:'#3f51b5'}); }
    finally{ setSubmitting(false); }
  };

  // ── PDF download ─────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!docInfo) return;
    const projectLink = chkLink || projLinks[0] || {};
    const lnkProject  = projectLink.project || projLinks[0]?.project || '';
    const linkedProj  = projects.find(p=>(p.projectName||p.ProjectName||p.uid)===lnkProject);
    await generateIssuePdf({
      docInfo: { ...docInfo, issueRefDocStatus: refDocStatus || docInfo.issueRefDocStatus || '' },
      partExtras,
      linkData: {
        project:    lnkProject,
        program:    projectLink.program    || projLinks[0]?.program    || '',
        plant:      projectLink.plant      || projLinks[0]?.plant      || '',
        plant_year: projectLink.plant_year || projLinks[0]?.plant_year || '',
        dept:       (projectLink.flag1 || projLinks[0]?.flag1 || '').toUpperCase(),
        projStatus: linkedProj?.status || '',
        partRH:     chkLink?.part_number_rh || chkLink?.Part_number_RH || '',
        partLH:     chkLink?.part_number_lh || chkLink?.Part_number_LH || '',
      },
      projectName: linkedProj?.projectName || linkedProj?.ProjectName || lnkProject,
      histories,
      proposals,
      solutions,
      pubOnTime,
      pubDate,
      comments,
      images: canvasImages,
    });
  };

  // ── meta options ──────────────────────────────────────────────
  const plantOpts = metaOpts(meta,'Plant');
  const yearOpts  = metaOpts(meta,'Year');
  const projNames = projects.map(p=>p.projectName||p.project||p.uid).filter(Boolean);
  const progOpts  = metaOpts(meta,'Program');
  const deptMetaOpts = metaOpts(meta,'Department');
  const deptOpts  = deptMetaOpts.length ? deptMetaOpts : ['AVP','WGDE','Common'];

  // ── Loading/error ─────────────────────────────────────────────
  if(loading) return (
    <div className="im-center-state">
      <div className="mod-spinner" style={{width:32,height:32,borderWidth:4}}/>
      <span>Loading issue…</span>
    </div>
  );
  if(error||!docInfo) return (
    <div className="im-center-state im-center-error">
      <span>Failed to load: {error||'Not found'}</span>
      <button className="im-btn im-btn-outline" onClick={()=>navigate(backPath)}>← Go Back</button>
    </div>
  );

  // ── Project / part derived display values ─────────────────────
  const lnkProject   = chkLink?.project || chkLink?.Project || projLinks[0]?.project || '';
  const linkedProject = projects.find(p => (p.projectName||p.ProjectName||p.uid) === lnkProject);
  const docDeptDisplay = (chkLink?.flag1 || chkLink?.Flag1 || projLinks[0]?.flag1 || '').toUpperCase() || '—';
  const chkPartRH = chkLink?.part_number_rh || chkLink?.Part_number_RH || chkLink?.partNumberRH || '';
  const chkPartLH = chkLink?.part_number_lh || chkLink?.Part_number_LH || chkLink?.partNumberLH || '';

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="im-page">

      {/* Breadcrumb + project summary */}
      <div className="im-breadcrumb">
        <button className="im-back-btn" onClick={()=>navigate(backPath)}><Ic.Back/> {backLabel}</button>
        <span className="im-bc-sep">›</span>
        <span className="im-bc-cur">{docInfo.issue_number||'Issue Detail'}</span>
        <StatusBadge v={docInfo.status}/>
        {projLinks.length>0&&(
          <div className="im-proj-pills">
            {projLinks.map(l=>(
              <span key={l.uid} className="im-proj-pill">
                <Ic.Link/>
                <span className="im-pp-name">{l.project||'—'}</span>
                {l.program&&<span className="im-pp-meta">{l.program}</span>}
                {l.plant&&<span className="im-pp-meta">{l.plant}{l.plant_year?` ${l.plant_year}`:''}</span>}
                {l.flag1&&<span className="im-pp-dept">{l.flag1}</span>}
                {canEditIssue(docInfo)&&(
                  <button className="im-pp-del" onClick={()=>handleLinkDelete(l)} title="Unlink"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                )}
              </span>
            ))}
            {canEditIssue(docInfo)&&(
              <button className="im-proj-add-btn" onClick={()=>openLinkForm()} title="Link project">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Link Project
              </button>
            )}
          </div>
        )}
        {projLinks.length===0&&canEditIssue(docInfo)&&(
          <button className="im-proj-add-btn" onClick={()=>openLinkForm()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Link Project
          </button>
        )}
      </div>

      {/* Inline project link form (shown when Add/Edit triggered) */}
      {linkForm&&(
        <div className="im-link-form im-link-form-header">
          <div className="im-link-form-grid">
            <div className="im-lf"><label>Project <span className="req">*</span></label>
              <Sel value={linkForm.project} onChange={e=>slk('project',e.target.value)} options={projNames} placeholder="Select project…"/>
            </div>
            <div className="im-lf"><label>Program</label>
              <Sel value={linkForm.program} onChange={e=>slk('program',e.target.value)} options={progOpts} placeholder="Select program…"/>
            </div>
            <div className="im-lf"><label>Department</label>
              <Sel value={linkForm.flag1} onChange={e=>slk('flag1',e.target.value)} options={deptOpts} placeholder="Select department…"/>
            </div>
            <div className="im-lf"><label>Plant</label>
              <Sel value={linkForm.plant} onChange={e=>slk('plant',e.target.value)} options={plantOpts} placeholder="Select plant…"/>
            </div>
            <div className="im-lf"><label>Year</label>
              <Sel value={linkForm.plant_year} onChange={e=>slk('plant_year',e.target.value)} options={yearOpts} placeholder="Select year…"/>
            </div>
          </div>
          <div className="im-link-form-footer">
            <button className="im-btn im-btn-outline im-btn-sm" onClick={()=>{setLinkForm(null);setEditingLink(null);}}>Cancel</button>
            <button className="im-btn im-btn-success im-btn-sm" onClick={handleLinkSave} disabled={linkSaving}><Ic.Save/> {linkSaving?'Saving…':'Save Link'}</button>
          </div>
        </div>
      )}

      {/* ── 1. DocInfo ──────────────────────────────────────────── */}
      <SectionCard title="Document Info" iconBg="#eef0ff" iconColor="#3f51b5"
        iconEl={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        actions={<button className="im-btn im-btn-outline im-btn-sm" onClick={handleDownloadPdf}><Ic.Down/> Download PDF</button>}>
        <div className="im-di-body">

          {/* ── Project Info ── */}
          <div className="im-di-group">
            <div className="im-di-gtitle">Project Info</div>
            <div className="im-di-grid-2">
              <KV label="Project"     value={lnkProject}/>
              <KV label="Program"     value={chkLink?.program    || projLinks[0]?.program    || ''}/>
              <KV label="Plant"       value={chkLink?.plant      || projLinks[0]?.plant      || ''}/>
              <KV label="Plant Year"  value={chkLink?.plant_year || projLinks[0]?.plant_year || ''}/>
              <KV label="Proj Status" value={linkedProject?.status || linkedProject?.Status || ''}/>
              <KV label="Department"  value={docDeptDisplay}/>
            </div>
          </div>

          {/* ── Part Info ── */}
          <div className="im-di-group">
            <div className="im-di-gtitle">Part Info</div>
            <div className="im-di-grid-3">
              <KV label="Part # RH"         value={chkPartRH || docInfo.partNumber || ''}/>
              <KV label="Part # LH"         value={chkPartLH}/>
              <KV label="Part Type"         value={partExtras.partType || ''}/>
              <KV label="Part Name RH"      value={partExtras.partNameRH || ''}/>
              <KV label="Part Name LH"      value={partExtras.partNameLH || ''}/>
              <KV label="Material"          value={partExtras.material  || docInfo.material  || ''}/>
              <KV label="Initiator"         value={partExtras.initiator || docInfo.initiator || ''}/>
              <KV label="Owner"             value={partExtras.owner     || docInfo.owner     || ''}/>
              <KV label="Revision RH"       value={partExtras.revisionRH      || ''}/>
              <KV label="Maturity State RH" value={partExtras.maturityStateRH || ''}/>
              <KV label="Revision LH"       value={partExtras.revisionLH      || ''}/>
              <KV label="Maturity State LH" value={partExtras.maturityStateLH || ''}/>
              <KV label="PDEF # RH"         value={partExtras.pdefRH || docInfo.pDEF_Number_RH || ''}/>
              <KV label="PDEF # LH"         value={partExtras.pdefLH || docInfo.pDEF_Number_LH || ''}/>
              <KV label="LA # RH"           value={partExtras.laRH   || docInfo.lA_Num_RH      || ''}/>
              <KV label="LA # LH"           value={partExtras.laLH   || docInfo.lA_Num_LH      || ''}/>
              <KV label="PA # RH"           value={partExtras.paRH   || docInfo.pA_Num_RH      || ''}/>
              <KV label="PA # LH"           value={partExtras.paLH   || docInfo.pA_Num_LH      || ''}/>
              <KV label="Zone / Area"       value={partExtras.zoneArea || ''}/>
            </div>
          </div>

          {/* ── Checklist & Issue Info ── */}
          <div className="im-di-group">
            <div className="im-di-gtitle">Checklist &amp; Issue Info</div>
            <div className="im-di-grid-2">
              <KV label="Issue Number"   value={docInfo.issue_number}/>
              <KV label="Status" badge={(() => {
                const rs = REF_STATUSES.find(r => r.value === refDocStatus);
                return rs
                  ? <span style={{
                      display:'inline-flex',alignItems:'center',gap:5,
                      padding:'3px 10px 3px 7px',borderRadius:20,
                      background: rs.color + '20',
                      border: `1.5px solid ${rs.color}99`,
                      fontSize:11,fontWeight:700,color:rs.color,
                      whiteSpace:'nowrap',
                    }}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:rs.color,flexShrink:0}}/>
                      {rs.label}
                    </span>
                  : <StatusBadge v={docInfo.status}/>;
              })()}/>
              <KV label="Issue Title"    value={docInfo.issue_title}        wide/>
              <KV label="Description"    value={docInfo.issue_description}  wide/>
              <KV label="Date Opened"    value={fmtDate(docInfo.date_Opened)}/>
              <KV label="Req Completion" value={fmtDate(docInfo.req_Completion_Date)}/>
              <KV label="Date Closed"    value={fmtDate(docInfo.date_Closed)}/>
              <KV label="Created By"     value={docInfo.created_by}/>
              <KV label="Created Date"   value={fmtDate(docInfo.created_date)}/>
              <KV label="Derogation Sheet" value={docInfo.derogation_sht_num || ''}/>
            </div>
          </div>

        </div>
      </SectionCard>


      {/* ── 2. Issue Reference Document ─────────────────────── */}
      <SectionCard title="Issue Reference Document" iconBg="#fff3e0" iconColor="#e65100"
        iconEl={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        actions={
          refEditing
            ? <div style={{display:'flex',gap:6}}>
                <button className="im-btn im-btn-outline im-btn-sm" onClick={handleRefCancel} disabled={refSaving}>Cancel</button>
                <button className="im-btn im-btn-success im-btn-sm" onClick={handleRefSave} disabled={refSaving}>
                  <Ic.Save/> {refSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            : canEditIssue(docInfo) && (
                <button className="im-btn im-btn-outline im-btn-sm" onClick={()=>setRefEditing(true)}>
                  <Ic.Edit/> Edit
                </button>
              )
        }>

        {/* ── View mode ── */}
        {!refEditing && (
          <div className="im-di-body" style={{gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
            <div className="im-di-group" style={{borderRight:'none',paddingLeft:0}}>
              <div className="im-di-gtitle">Reference Info</div>
              <div className="im-di-grid-2">
                <KV label="Issue Ref Doc No" value={refDocNo}/>
                <KV label="Issue Ref Source Link" value={null} badge={
                  refSrcLink
                    ? <a href={refSrcLink} target="_blank" rel="noreferrer" className="im-ref-link"><Ic.Link/>{refDocNo||refSrcLink}</a>
                    : <span style={{fontSize:12,color:'#bbb'}}>—</span>
                }/>
                <KV label="Issue Ref Doc Desc" value={refDocDesc} wide/>
              </div>
            </div>
            <div className="im-di-group" style={{borderRight:'none',paddingLeft:12}}>
              <div className="im-di-gtitle">Ref Doc Status</div>
              {(() => {
                const sel = REF_STATUSES.find(s=>s.value===refDocStatus);
                return sel
                  ? <div style={{display:'flex',flexDirection:'column',gap:4,paddingTop:4}}>
                      <span style={{
                        display:'inline-flex',alignItems:'center',gap:7,
                        padding:'5px 13px 5px 10px',borderRadius:20,width:'fit-content',
                        background:sel.color+'18',border:`1.5px solid ${sel.color}88`,
                        fontSize:12,fontWeight:700,color:sel.color,
                      }}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:sel.color,flexShrink:0}}/>
                        {sel.label}
                      </span>
                      <span style={{fontSize:11,color:sel.color,fontWeight:500,paddingLeft:2}}>{sel.desc}</span>
                    </div>
                  : <span style={{fontSize:12,color:'#bbb',paddingTop:4,display:'block'}}>—</span>;
              })()}
            </div>
          </div>
        )}

        {/* ── Edit mode ── */}
        {refEditing && (
          <div className="im-form-grid im-ref-grid">
            <div className="im-form-field">
              <label>Issue Ref Doc No</label>
              <input value={refDocNo} onChange={e=>setRefDocNo(e.target.value)} placeholder="Reference document number…"/>
            </div>
            <div className="im-form-field">
              <label>Issue Ref Source Link</label>
              <input type="url" value={refSrcLink} onChange={e=>setRefSrcLink(e.target.value)} placeholder="https://…"/>
            </div>
            <div className="im-form-field im-form-field-full">
              <label>Issue Ref Doc Desc</label>
              <textarea value={refDocDesc} onChange={e=>setRefDocDesc(e.target.value)} rows={2} placeholder="Reference document description…"/>
            </div>
            <div className="im-form-field im-form-field-full">
              <label>Issue Ref Doc Status</label>
              <div className="im-ref-status-row">
                {REF_STATUSES.map(s=>(
                  <button key={s.value}
                    className={`im-ref-status-opt${refDocStatus===s.value?' selected':''}`}
                    style={refDocStatus===s.value?{borderColor:s.color,background:s.color+'18'}:{}}
                    onClick={()=>setRefDocStatus(refDocStatus===s.value?'':s.value)}
                    title={s.desc}>
                    <span className="im-ref-status-dot" style={{background:s.color}}/>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              {refDocStatus && (() => {
                const sel = REF_STATUSES.find(s=>s.value===refDocStatus);
                return sel
                  ? <div className="im-ref-status-desc" style={{color:sel.color}}>{sel.desc}</div>
                  : null;
              })()}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Three columns: Drawing (left) | Proposals (right) ── */}
      <div className="im-mid-row">

        {/* Left column: Drawing & Annotations */}
        <SectionCard title="Drawing &amp; Annotations" iconBg="#fce4ec" iconColor="#c62828"
          iconEl={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>}>
          <DrawingCanvas onCapture={handleCanvasCapture}/>
          {canvasImages.length > 0 && (
            <div className="im-canvas-thumbs">
              <div className="im-canvas-thumbs-label">Saved Annotations ({canvasImages.length})</div>
              <div className="im-canvas-thumbs-row">
                {canvasImages.map((img, i) => (
                  <div key={i} className="im-canvas-thumb-wrap">
                    <img src={img} alt={`Annotation ${i+1}`} className="im-canvas-thumb"
                      onClick={()=>window.open(img,'_blank')} title="Click to view full size"/>
                    {canEditIssue(docInfo) && (
                      <button className="im-canvas-thumb-del" onClick={()=>handleRemoveCanvasImage(i)} title="Remove">×</button>
                    )}
                    <span className="im-canvas-thumb-num">{i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Right column: Proposal(s) / Solution(s) */}
        <SectionCard title="Proposal(s) / Solution(s)" iconBg="#e8f4fd" iconColor="#2980b9"
          iconEl={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}>
          <div className="im-prop-body">
            <div className="im-pf">
              <label className="im-plbl">Proposal(s)</label>
              <textarea className="im-pta im-pta-green" value={proposals} onChange={e=>setProposals(e.target.value)} rows={3} placeholder="Describe the proposed solution…" readOnly={!canEditIssue(docInfo)}/>
            </div>
            <div className="im-pf">
              <label className="im-plbl">Solution(s)</label>
              <textarea className="im-pta" value={solutions} onChange={e=>setSolutions(e.target.value)} rows={2} placeholder="Confirmed solution…" readOnly={!canEditIssue(docInfo)}/>
            </div>
            <div className="im-pub-row">
              <label className="im-pub-lbl">
                <input type="checkbox" checked={pubOnTime} onChange={e=>setPubOnTime(e.target.checked)} className="im-pub-chk" disabled={!canEditIssue(docInfo)}/>
                <span className={pubOnTime?'im-pub-on':''}>Publication release on time</span>
              </label>
              <div className="im-pf">
                <label className="im-plbl">Date</label>
                <input type="date" value={pubDate} onChange={e=>setPubDate(e.target.value)} className="im-date-in" disabled={!canEditIssue(docInfo)}/>
              </div>
            </div>
            <div className="im-pf">
              <label className="im-plbl">Comments</label>
              <textarea className="im-pta" value={comments} onChange={e=>setComments(e.target.value)} rows={2} placeholder="Additional comments…" readOnly={!canEditIssue(docInfo)}/>
            </div>
            {canEditIssue(docInfo)&&<div className="im-prop-footer">
              <button className="im-btn im-btn-primary" onClick={handlePropSave} disabled={propSaving}>
                <Ic.Save/> {propSaving?'Saving…':'Save'}
              </button>
            </div>}
          </div>
        </SectionCard>

      </div>

      {/* ── History — full width at the bottom ── */}
      <SectionCard title="History" iconBg="#f3e5f5" iconColor="#8e24aa" iconEl={<Ic.History/>}>
        <div className="im-hist-scroll">
          <div className="im-hist-entry">
            <div className="im-hist-dot im-hist-dot-create"/>
            <div className="im-hist-body">
              <div className="im-hist-action">Issue Created</div>
              <div className="im-hist-row">
                <span className="im-hist-field"><span className="im-hist-lbl">By</span>{docInfo.created_by||'—'}</span>
                <span className="im-hist-field"><span className="im-hist-lbl">On</span>{fmtDate(docInfo.created_date)}</span>
              </div>
            </div>
          </div>
          {histories.length===0
            ? <div className="im-hist-empty">No modifications yet.</div>
            : histories.map((h,i)=>(
              <div key={h.uid} className="im-hist-entry">
                <div className={`im-hist-dot${i===0?' im-hist-dot-latest':''}`}/>
                <div className="im-hist-body">
                  <div className="im-hist-action">{h.flag1||'Updated'}</div>
                  <div className="im-hist-row">
                    <span className="im-hist-field"><span className="im-hist-lbl">By</span>{h.modified_by||'—'}</span>
                    <span className="im-hist-field"><span className="im-hist-lbl">On</span>{fmtDate(h.modified_date)}</span>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </SectionCard>

      {/* ── Submit bar ──────────────────────────────────────────── */}
      {canEditIssue(docInfo)&&<div className="im-submit-bar">
        <button className="im-btn-submit" onClick={handleSubmit} disabled={submitting||docInfo.status==='Closed'}>
          {submitting?'Submitting…':docInfo.status==='Closed'?'✓ Already Closed':'Submit Issue'}
        </button>
      </div>}

    </div>
  );
}
