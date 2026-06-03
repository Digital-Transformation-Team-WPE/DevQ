import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectReportApi } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import './DmrsProjectReport.css';

// ── ISO week helper ────────────────────────────────────────────────────────────
function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const todayWeek = getIsoWeek(new Date());
const todayStr  = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).replace(/\//g, ':');

// ── Color helpers ──────────────────────────────────────────────────────────────
const COLOR_MAP = {
  Green:  { fill: '#27ae60', bg: '#e8f9ee', text: '#1b5e20' },
  Orange: { fill: '#e67e22', bg: '#fff3e0', text: '#6d3b00' },
  Red:    { fill: '#e74c3c', bg: '#ffecec', text: '#7b0000' },
  Yellow: { fill: '#f1c40f', bg: '#fffde7', text: '#5a4a00' },
};
const colorFill = c => (COLOR_MAP[c] || COLOR_MAP.Yellow).fill;
const colorBg   = c => (COLOR_MAP[c] || COLOR_MAP.Yellow).bg;
const colorText = c => (COLOR_MAP[c] || COLOR_MAP.Yellow).text;

const pct = v => (v == null ? '—' : `${Math.round(v)}%`);

// ── SVG Chart ──────────────────────────────────────────────────────────────────
const CW = 900, CH = 280;
const LP = 58, RP = 24, TP = 18, BP = 52;
const PW = CW - LP - RP;
const PH = CH - TP - BP;

function xOf(i, n)   { return LP + (n > 1 ? (i / (n - 1)) : 0.5) * PW; }
function yOf(p)      { return TP + PH * (1 - Math.max(0, Math.min(100, p)) / 100); }
function pts(arr, n) { return arr.map((v, i) => `${xOf(i, n)},${yOf(v)}`).join(' '); }

function RobustnessChart({ dataPoints, summary }) {
  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div className="rpt-chart-empty">
        No milestone data — add Project Milestones with planned dates to see the chart.
      </div>
    );
  }

  const n         = dataPoints.length;
  const goSeries  = dataPoints.map(d => d.projectGoPercent);
  const grnSeries = dataPoints.map(d => d.projectGreenPercent);
  const target    = summary?.targetPercent ?? 85;

  // Current week marker: find the milestone closest to today's ISO week
  let currentX = null;
  let bestDiff = Infinity;
  dataPoints.forEach((d, i) => {
    if (d.weekNumber != null) {
      const diff = Math.abs(d.weekNumber - todayWeek);
      if (diff < bestDiff) { bestDiff = diff; currentX = xOf(i, n); }
    }
  });

  // Diagonal target line: (x_first, y_0%) → (x_last, y_target%)
  const x0 = xOf(0, n), xN = xOf(n - 1, n);
  const y0 = yOf(0),    yT = yOf(target);

  // Background polygons
  const greenPoly = `${x0},${TP} ${xN},${TP} ${xN},${yT} ${x0},${y0}`;
  const redPoly   = `${x0},${y0} ${xN},${yT} ${xN},${TP + PH} ${x0},${TP + PH}`;

  // Grid Y lines at 20%, 40%, 60%, 80%, 100%
  const gridLines = [20, 40, 60, 80, 100];

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" preserveAspectRatio="xMidYMid meet"
      className="rpt-svg" aria-label="Robustness chart">

      {/* Background zones */}
      <polygon points={greenPoly} fill="#d5f5e3" opacity="0.7"/>
      <polygon points={redPoly}   fill="#fadbd8" opacity="0.7"/>

      {/* Grid lines */}
      {gridLines.map(g => (
        <line key={g} x1={LP} y1={yOf(g)} x2={LP + PW} y2={yOf(g)}
          stroke="#ccc" strokeWidth="0.6" strokeDasharray="3,3"/>
      ))}
      {/* Y-axis labels */}
      {gridLines.map(g => (
        <text key={g} x={LP - 5} y={yOf(g) + 4} textAnchor="end"
          fontSize="9" fill="#888">{g}%</text>
      ))}
      <text x={LP - 5} y={yOf(0) + 4} textAnchor="end" fontSize="9" fill="#888">0%</text>

      {/* Diagonal target line */}
      <line x1={x0} y1={y0} x2={xN} y2={yT}
        stroke="#27ae60" strokeWidth="1.8" strokeDasharray="5,3"/>
      {/* 85% label at end of diagonal */}
      <text x={xN + 5} y={yT + 4} fontSize="9" fill="#27ae60" fontWeight="700">
        {target}%
      </text>

      {/* Current week vertical marker */}
      {currentX !== null && (
        <>
          <line x1={currentX} y1={TP} x2={currentX} y2={TP + PH}
            stroke="#111" strokeWidth="1.5"/>
          <rect x={currentX - 14} y={TP + PH + 2} width={28} height={12}
            fill="#111" rx="2"/>
          <text x={currentX} y={TP + PH + 11} textAnchor="middle"
            fontSize="8" fill="#fff" fontWeight="700">
            W{todayWeek}
          </text>
        </>
      )}

      {/* X-axis: milestone labels */}
      {dataPoints.map((d, i) => {
        const x     = xOf(i, n);
        const above = i % 2 === 0;
        return (
          <g key={i}>
            <line x1={x} y1={TP + PH} x2={x} y2={TP + PH + 4} stroke="#bbb" strokeWidth="0.8"/>
            <text x={x} y={TP + PH + (above ? 14 : 24)} textAnchor="middle"
              fontSize="8" fill={d.weekNumber === todayWeek ? '#111' : '#777'}
              fontWeight={d.weekNumber === todayWeek ? '700' : '400'}>
              {d.weekLabel}
            </text>
            <text x={x} y={TP + PH + (above ? 23 : 33)} textAnchor="middle"
              fontSize="7" fill="#aaa">
              {d.relativeWeek > 0 ? `+${d.relativeWeek}` : d.relativeWeek}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={LP} y1={TP} x2={LP} y2={TP + PH} stroke="#bbb" strokeWidth="1"/>
      <line x1={LP} y1={TP + PH} x2={LP + PW} y2={TP + PH} stroke="#bbb" strokeWidth="1"/>

      {/* Series 1: Green + Orange (solid) */}
      {n > 1 && (
        <polyline points={pts(goSeries, n)} fill="none"
          stroke="#2980b9" strokeWidth="2" strokeLinejoin="round"/>
      )}
      {goSeries.map((v, i) => (
        <polygon key={i}
          points={`${xOf(i,n)},${yOf(v)-5} ${xOf(i,n)+4},${yOf(v)+3} ${xOf(i,n)-4},${yOf(v)+3}`}
          fill="#2980b9"/>
      ))}

      {/* Series 2: Only Green (dashed) */}
      {n > 1 && (
        <polyline points={pts(grnSeries, n)} fill="none"
          stroke="#2980b9" strokeWidth="1.5" strokeDasharray="5,3" strokeLinejoin="round"/>
      )}
      {grnSeries.map((v, i) => (
        <polygon key={i}
          points={`${xOf(i,n)},${yOf(v)-5} ${xOf(i,n)+4},${yOf(v)+3} ${xOf(i,n)-4},${yOf(v)+3}`}
          fill="#2980b9" opacity="0.55"/>
      ))}
    </svg>
  );
}

// ── Chart legend ───────────────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div className="rpt-legend">
      <span className="rpt-legend-item">
        <svg width="28" height="10" style={{verticalAlign:'middle',marginRight:4}}>
          <line x1="0" y1="5" x2="28" y2="5" stroke="#2980b9" strokeWidth="2"/>
          <polygon points="14,0 18,8 10,8" fill="#2980b9"/>
        </svg>
        Green + Orange Parts
      </span>
      <span className="rpt-legend-item">
        <svg width="28" height="10" style={{verticalAlign:'middle',marginRight:4}}>
          <line x1="0" y1="5" x2="28" y2="5" stroke="#2980b9" strokeWidth="1.5" strokeDasharray="5,3"/>
          <polygon points="14,0 18,8 10,8" fill="#2980b9" opacity="0.55"/>
        </svg>
        Only Green Parts
      </span>
    </div>
  );
}

// ── Weekly Data Table ──────────────────────────────────────────────────────────
function WeeklyDataTable({ milestones, dataPoints }) {
  if (!milestones || milestones.length === 0) return null;

  const rows = [
    { label: 'Green',         bold: false, fn: d => pct(d.totalParts > 0 ? d.greenCount  / d.totalParts * 100 : 0), color: '#27ae60' },
    { label: 'Yellow',        bold: false, fn: d => pct(d.totalParts > 0 ? d.yellowCount / d.totalParts * 100 : 0), color: '#f1c40f' },
    { label: 'Orange',        bold: false, fn: d => pct(d.totalParts > 0 ? d.orangeCount / d.totalParts * 100 : 0), color: '#e67e22' },
    { label: 'Red',           bold: false, fn: d => pct(d.totalParts > 0 ? d.redCount    / d.totalParts * 100 : 0), color: '#e74c3c' },
    { label: '85%',           bold: false, fn: d => pct(d.targetGreenPercent), color: '#888' },
    { label: 'Project G/O',   bold: true,  fn: d => pct(d.projectGoPercent),    color: '#1a1a2e' },
    { label: 'Project Green', bold: true,  fn: d => pct(d.projectGreenPercent), color: '#1a1a2e' },
    { label: 'Total parts',   bold: false, fn: d => d.totalParts,  color: '#555' },
    { label: 'Green Parts',   bold: false, fn: d => d.greenCount,  color: '#27ae60' },
    { label: 'Orange Parts',  bold: false, fn: d => d.orangeCount, color: '#e67e22' },
  ];

  return (
    <div className="rpt-table-scroll">
      <table className="rpt-week-table">
        <thead>
          <tr>
            <th className="rpt-th-label"></th>
            {milestones.map((ms, i) => (
              <th key={i} className={`rpt-th-col${ms.isSync ? ' rpt-th-sync' : ''}`}>
                {ms.name}
              </th>
            ))}
          </tr>
          <tr>
            <th className="rpt-th-label"></th>
            {milestones.map((ms, i) => (
              <th key={i} className="rpt-th-week">{ms.weekLabel}</th>
            ))}
          </tr>
          <tr>
            <th className="rpt-th-label"></th>
            {milestones.map((ms, i) => (
              <th key={i} className="rpt-th-rel">
                {ms.relativeWeek > 0 ? `+${ms.relativeWeek}` : ms.relativeWeek}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={row.bold ? 'rpt-tr-bold' : ''}>
              <td className="rpt-td-label" style={{ color: row.color }}>{row.label}</td>
              {dataPoints.map((d, i) => (
                <td key={i} className="rpt-td-val"
                  style={{ color: row.color, fontWeight: row.bold ? 700 : 400 }}>
                  {row.fn(d)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── KPI Summary ────────────────────────────────────────────────────────────────
function KpiSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="rpt-kpi">
      <div className="rpt-kpi-row">
        <span className="rpt-kpi-label">First Week for cotation</span>
        <span className="rpt-kpi-w">W</span>
        <span className="rpt-kpi-val">{summary.firstWeekCotation ?? '—'}</span>
      </div>
      <div className="rpt-kpi-row">
        <span className="rpt-kpi-label">First week Target Green</span>
        <span className="rpt-kpi-w">W</span>
        <span className="rpt-kpi-val">{summary.firstWeekTargetGreen ?? '—'}</span>
      </div>
      <div className="rpt-kpi-row">
        <span className="rpt-kpi-label">
          Week of{' '}
          <span style={{ color: '#27ae60', fontWeight: 700 }}>
            {summary.syncMilestoneName || 'SYNC'}
          </span>
        </span>
        <span className="rpt-kpi-w">W</span>
        <span className="rpt-kpi-val">{summary.weekOfSync ?? '—'}</span>
      </div>
    </div>
  );
}

// ── Parts Detail Table ─────────────────────────────────────────────────────────
function PartsDetailTable({ partsTable }) {
  return (
    <div className="rpt-table-scroll">
      <table className="rpt-parts-table">
        <thead>
          <tr>
            <th rowSpan="2" className="rpt-pth">S.No</th>
            <th rowSpan="2" className="rpt-pth">Code</th>
            <th rowSpan="2" className="rpt-pth">Program</th>
            <th rowSpan="2" className="rpt-pth">Project</th>
            <th rowSpan="2" className="rpt-pth">Plant</th>
            <th rowSpan="2" className="rpt-pth">Year</th>
            <th rowSpan="2" className="rpt-pth">Milestone</th>
            <th colSpan="2" className="rpt-pth rpt-pth-dept">Department</th>
            <th colSpan="2" className="rpt-pth rpt-pth-dept">Pilot</th>
            <th colSpan="2" className="rpt-pth rpt-pth-dept">Validation Status / Total Part</th>
            <th colSpan="2" className="rpt-pth rpt-pth-dept">Issues</th>
            <th colSpan="2" className="rpt-pth rpt-pth-dept">Status</th>
          </tr>
          <tr>
            {['AVP','WGDE','AVP','WGDE','AVP','WGDE','AVP','WGDE','AVP','WGDE'].map((d, i) => (
              <th key={i}
                className={`rpt-pth-sub ${d === 'AVP' ? 'rpt-sub-avp' : 'rpt-sub-wgde'}`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {partsTable && partsTable.length > 0 ? partsTable.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'rpt-ptr-even' : ''}>
              <td className="rpt-ptd rpt-ptd-center">{row.sNo}</td>
              <td className="rpt-ptd">{row.code || '—'}</td>
              <td className="rpt-ptd">{row.program || '—'}</td>
              <td className="rpt-ptd">{row.project || '—'}</td>
              <td className="rpt-ptd">{row.plant || '—'}</td>
              <td className="rpt-ptd">{row.year || '—'}</td>
              <td className="rpt-ptd">{row.milestone || '—'}</td>
              <td className="rpt-ptd rpt-sub-avp">{row.departmentAvp || '—'}</td>
              <td className="rpt-ptd rpt-sub-wgde">{row.departmentWgde || '—'}</td>
              <td className="rpt-ptd rpt-sub-avp">{row.pilotAvp || '—'}</td>
              <td className="rpt-ptd rpt-sub-wgde">{row.pilotWgde || '—'}</td>
              <td className="rpt-ptd rpt-sub-avp">
                {row.validationStatusAvp
                  ? <span className="rpt-color-dot"
                      style={{ background: colorFill(row.validationStatusAvp) }}/>
                  : '—'}
                {row.validationStatusAvp
                  ? ` ${row.validationStatusAvp} / ${row.totalChecksAvp}`
                  : ''}
              </td>
              <td className="rpt-ptd rpt-sub-wgde">
                {row.validationStatusWgde
                  ? <span className="rpt-color-dot"
                      style={{ background: colorFill(row.validationStatusWgde) }}/>
                  : '—'}
                {row.validationStatusWgde
                  ? ` ${row.validationStatusWgde} / ${row.totalChecksWgde}`
                  : ''}
              </td>
              <td className="rpt-ptd rpt-sub-avp">{row.issuesAvp || '—'}</td>
              <td className="rpt-ptd rpt-sub-wgde">{row.issuesWgde || '—'}</td>
              <td className="rpt-ptd rpt-sub-avp">
                {row.statusAvp
                  ? <span style={{
                      display:'inline-block', padding:'1px 7px', borderRadius:3,
                      fontSize:10, fontWeight:700,
                      background: colorBg(row.statusAvp),
                      color: colorText(row.statusAvp),
                    }}>{row.statusAvp}</span>
                  : '—'}
              </td>
              <td className="rpt-ptd rpt-sub-wgde">
                {row.statusWgde
                  ? <span style={{
                      display:'inline-block', padding:'1px 7px', borderRadius:3,
                      fontSize:10, fontWeight:700,
                      background: colorBg(row.statusWgde),
                      color: colorText(row.statusWgde),
                    }}>{row.statusWgde}</span>
                  : '—'}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="17" className="rpt-ptd" style={{ textAlign:'center', color:'#bbb', padding:'20px 0' }}>
                No parts linked to this project.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Stellantis Logo SVG ────────────────────────────────────────────────────────
function StellantisLogo() {
  return (
    <svg viewBox="0 0 120 28" height="28" xmlns="http://www.w3.org/2000/svg" aria-label="Stellantis">
      <circle cx="14" cy="14" r="12" fill="none" stroke="#003399" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="7"  fill="none" stroke="#003399" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="2"  fill="#003399"/>
      <line x1="2"  y1="14" x2="26" y2="14" stroke="#003399" strokeWidth="1.5"/>
      <line x1="14" y1="2"  x2="14" y2="26" stroke="#003399" strokeWidth="1.5"/>
      <text x="32" y="18" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700"
        fill="#003399" letterSpacing="1">STELLANTIS</text>
    </svg>
  );
}

// ── Main Report Component ──────────────────────────────────────────────────────
export default function DmrsProjectReport() {
  const { uid }   = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [loading, setLoading] = useState(true);
  const [report,  setReport]  = useState(null);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    projectReportApi.getReport(uid)
      .then(data => { setReport(data); setLoading(false); })
      .catch(err => { setError(err?.message || 'Failed to load report.'); setLoading(false); });
  }, [uid]);

  const handlePrint = useCallback(() => window.print(), []);

  // ── Loading / error states ───────────────────────────────────────────────────
  if (loading) return (
    <div className="rpt-state-center">
      <div className="rpt-spinner"/>
      <p>Building report…</p>
    </div>
  );

  if (error) return (
    <div className="rpt-state-center">
      <div style={{ color:'#e74c3c', fontSize:14, marginBottom:12 }}>{error}</div>
      <button className="rpt-btn rpt-btn-back" onClick={() => navigate(-1)}>← Back</button>
    </div>
  );

  if (!report) return null;

  const { projectInfo, milestones, dataPoints, partsTable, summary } = report;
  const chartTitle = `Robustness definitions PTF - WPL/AVP${summary.syncMilestoneName ? ` - ${summary.syncMilestoneName}` : ''}`;
  const userName   = user?.name || user?.userId || 'User';

  return (
    <div className="rpt-root">
      {/* ── Screen-only toolbar ─────────────────────────────────────────────── */}
      <div className="rpt-toolbar no-print">
        <button className="rpt-btn rpt-btn-back" onClick={() => navigate(-1)}>
          ← Back to Projects
        </button>
        <span className="rpt-toolbar-title">
          {projectInfo.projectName || 'Project'} — Robustness Report
        </span>
        <button className="rpt-btn rpt-btn-print" onClick={handlePrint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}>
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Download PDF
        </button>
      </div>

      {/* ── Printable report body ────────────────────────────────────────────── */}
      <div className="rpt-page" id="rpt-print-target">

        {/* Page header */}
        <div className="rpt-page-header">
          <StellantisLogo/>
          <div className="rpt-page-meta">
            <div><strong>Date :</strong> {todayStr}</div>
            <div><strong>User Name :</strong> {userName}</div>
          </div>
        </div>

        {/* Section title */}
        <div className="rpt-section-title">Projects</div>

        {/* Chart title */}
        <div className="rpt-chart-title">{chartTitle}</div>

        {/* Legend */}
        <ChartLegend/>

        {/* SVG chart */}
        <RobustnessChart dataPoints={dataPoints} summary={summary}/>

        {/* Weekly data table */}
        <WeeklyDataTable milestones={milestones} dataPoints={dataPoints}/>

        {/* KPI summary */}
        <KpiSummary summary={summary}/>

        {/* Parts detail table */}
        <div className="rpt-parts-title">Parts Detail</div>
        <PartsDetailTable partsTable={partsTable}/>
      </div>
    </div>
  );
}
