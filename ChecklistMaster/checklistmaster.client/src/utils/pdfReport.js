import { jsPDF } from 'jspdf';
import stellantisLogoUrl from '../assets/stellantis-logo.jpg';

const PRIMARY   = [63, 81, 181];   // #3f51b5
const DARK      = [26, 26, 46];    // #1a1a2e
const MID       = [80, 80, 100];
const LIGHT     = [245, 247, 255];
const BORDER    = [200, 204, 230];
const GREEN     = [39, 174, 96];
const RED       = [198, 40, 40];
const YELLOW    = [245, 127, 23];
const AVP_CLR   = [21, 101, 192];
const WGDE_CLR  = [106, 27, 154];
const ORANGE    = [245, 124, 0];
const GREY_LIGHT= [250, 250, 255];

const fmt = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtFull = v => v ? new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

const statusColor = s => {
  if (s==='Open')             return [21,101,192];
  if (s==='In Progress')      return [245,127,23];
  if (s==='Completed Ok')     return [46,125,50];
  if (s==='Completed Not Ok') return [198,40,40];
  return [85,85,85];
};

function addPage(doc, pageNum, totalPages) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;

  // Outer border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.rect(8, 8, W-16, H-16);

  // Header bar
  doc.setFillColor(...PRIMARY);
  doc.rect(8, 8, W-16, 22, 'F');

  // App name (logo text)
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  doc.setTextColor(255,255,255);
  doc.text('ChecklistMaster', 15, 22);

  // Report title
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text('Issue Report', W/2, 22, {align:'center'});

  // Date + page
  const dateStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  doc.setFontSize(8);
  doc.text(`${dateStr}   |   Page ${pageNum} of ${totalPages}`, W-15, 22, {align:'right'});

  // Footer bar
  doc.setFillColor(...LIGHT);
  doc.rect(8, H-18, W-16, 10, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...MID);
  doc.text('CONFIDENTIAL — For internal use only', W/2, H-11, {align:'center'});

  return { top: 38, bottom: H-22, left: 15, right: W-15, width: W-30 };
}

function sectionTitle(doc, y, title, { left, width }) {
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(left, y, width, 7, 1, 1, 'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(255,255,255);
  doc.text(title.toUpperCase(), left+4, y+5);
  return y+10;
}


function kvGrid(doc, y, pairs, bounds) {
  const { left, width } = bounds;
  const half = width/2 - 2;
  let x = left;
  let rowY = y;
  pairs.forEach(([label,value,full,color],i) => {
    if (full) {
      if (i > 0 && x > left) { rowY += 11; x = left; }
      doc.setFillColor(248,249,255);
      doc.roundedRect(left, rowY, width, 9, 1, 1, 'F');
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.1);
      doc.roundedRect(left, rowY, width, 9, 1, 1, 'S');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...MID);
      doc.text(label.toUpperCase(), left+3, rowY+3.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...(color||DARK));
      const lines = doc.splitTextToSize(String(value||'—'), width-6);
      doc.text(lines[0]||'—', left+3, rowY+7);
      rowY += 11; x = left;
    } else {
      doc.setFillColor(248,249,255);
      doc.roundedRect(x, rowY, half, 9, 1, 1, 'F');
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.1);
      doc.roundedRect(x, rowY, half, 9, 1, 1, 'S');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...MID);
      doc.text(label.toUpperCase(), x+3, rowY+3.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...(color||DARK));
      doc.text(String(value||'—').slice(0,38), x+3, rowY+7);
      if (x === left) {
        x = left + half + 4;
      } else {
        x = left; rowY += 11;
      }
    }
  });
  if (x > left) rowY += 11;
  return rowY;
}


export async function generateIssuePdf({
  docInfo,
  partExtras = {},
  linkData   = {},
  projectName= '',
  checklists = [],
  histories  = [],
  proposals  = '',
  solutions  = '',
  pubOnTime  = false,
  pubDate    = '',
  comments   = '',
  images     = [],
}) {
  const logoDataUrl = await loadStellantisLogo();
  const estPages    = Math.max(2, 2 + Math.ceil(checklists.length / 22) + (images.length > 0 ? 1 : 0));
  const doc         = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let pageNum = 1;
  let bounds  = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
  let y       = bounds.top;

  const nb = (need) => {
    if (y + need > bounds.bottom) {
      doc.addPage(); pageNum++;
      bounds = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
      y = bounds.top;
    }
  };

  // ── Title block ───────────────────────────────────────────────────────────
  const refStat   = refStatusSet(docInfo.issueRefDocStatus);
  const badgeClr  = refStat ? refStat.badge : statusClrSet(docInfo.status).badge;
  const badgeLbl  = refStat ? refStat.label : (docInfo.status || '').toUpperCase();
  // Doc number
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(22, 32, 78);
  doc.text(docInfo.issue_number || '—', bounds.left, y + 7);
  // Status badge (wider to fit longer ref-status labels)
  doc.setFillColor(...badgeClr);
  doc.roundedRect(bounds.left + 52, y, 48, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text(badgeLbl, bounds.left + 76, y + 5.4, { align: 'center' });
  // Title
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 90, 110);
  const titleLines = doc.splitTextToSize(docInfo.issue_title || '', bounds.width);
  doc.text(titleLines.slice(0, 2), bounds.left, y + 16);
  y += 22;

  // ── 1. Project Information ────────────────────────────────────────────────
  nb(55);
  y = drawSectionBar(doc, y, 'Project Information', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Project',     value: projectName },
    { label: 'Program',     value: linkData.program },
    { label: 'Plant',       value: linkData.plant },
    { label: 'Plant Year',  value: linkData.plant_year },
    { label: 'Department',  value: linkData.dept },
    { label: 'Proj. Status',value: linkData.projStatus,
      clr: (linkData.projStatus || '').toLowerCase() === 'active' ? [39, 130, 55] : [110, 110, 120] },
  ], bounds);

  // ── 2. Part Information ───────────────────────────────────────────────────
  nb(80);
  y = drawSectionBar(doc, y, 'Part Information', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Part # RH',    value: docInfo.partNumber || linkData.partRH },
    { label: 'Part # LH',    value: linkData.partLH },
    { label: 'Part Name RH', value: partExtras.partNameRH },
    { label: 'Part Name LH', value: partExtras.partNameLH },
    { label: 'Type',         value: partExtras.partType },
    { label: 'Zone / Area',  value: partExtras.zoneArea },
    { label: 'Material',     value: partExtras.material || docInfo.material },
    { label: 'Initiator',    value: partExtras.initiator || docInfo.initiator },
    { label: 'Owner',        value: partExtras.owner || docInfo.owner },
    { label: 'Revision RH',  value: partExtras.revisionRH },
    { label: 'Revision LH',  value: partExtras.revisionLH },
    { label: 'Maturity RH',  value: partExtras.maturityStateRH },
    { label: 'Maturity LH',  value: partExtras.maturityStateLH },
    { label: 'PDEF # RH',    value: partExtras.pdefRH || docInfo.pDEF_Number_RH },
    { label: 'PDEF # LH',    value: partExtras.pdefLH || docInfo.pDEF_Number_LH },
    { label: 'LA # RH',      value: partExtras.laRH   || docInfo.lA_Num_RH },
    { label: 'LA # LH',      value: partExtras.laLH   || docInfo.lA_Num_LH },
    { label: 'PA # RH',      value: partExtras.paRH   || docInfo.pA_Num_RH },
    { label: 'PA # LH',      value: partExtras.paLH   || docInfo.pA_Num_LH },
    { label: 'Derogation',   value: docInfo.derogation_sht_num, full: true },
  ], bounds);

  // ── 3. Issue Details ──────────────────────────────────────────────────────
  nb(60);
  y = drawSectionBar(doc, y, 'Issue Details', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Date Opened',        value: fmt(docInfo.date_Opened) },
    { label: 'Req. Completion',    value: fmt(docInfo.req_Completion_Date) },
    { label: 'Date Closed',        value: fmt(docInfo.date_Closed) },
    { label: 'Escalation',         value: docInfo.flag2 || '—',
      clr: escalClrSet(docInfo.flag2) },
    { label: 'CW Open',            value: docInfo.flag3 },
    { label: 'Pub. on Time',       value: pubOnTime ? 'Yes' : 'No',
      clr: pubOnTime ? [39, 130, 55] : [198, 40, 40] },
    { label: 'Pub. Date',          value: fmt(pubDate) },
    { label: 'Created By',         value: docInfo.created_by },
    { label: 'Created Date',       value: fmt(docInfo.created_date) },
    ...(refStat ? [{ label: 'Ref Doc Status', value: refStat.label, clr: refStat.badge }] : []),
    { label: 'Description',        value: docInfo.issue_description, full: true },
  ], bounds);

  // ── 4. Checklist ──────────────────────────────────────────────────────────
  if (checklists.length > 0) {
    nb(28);
    y = drawSectionBar(doc, y, `Checklist  (${checklists.length} items)`, bounds);

    // Column definitions
    const CHK_COLS = [
      { label: '#',           w: 6  },
      { label: 'Checkpoint',  w: 55 },
      { label: 'RH',          w: 18 },
      { label: 'LH',          w: 18 },
      { label: 'Remarks RH',  w: 42 },
      { label: 'Remarks LH',  w: 43 },
    ];
    const chkTW = CHK_COLS.reduce((s, c) => s + c.w, 0);
    const chkSc = bounds.width / chkTW;
    const chkX  = {};
    let chkOff  = bounds.left;
    CHK_COLS.forEach(c => { chkX[c.label] = chkOff; chkOff += c.w * chkSc; });

    const drawChkHdr = (atY) => {
      CHK_COLS.forEach(c => {
        const cw = c.w * chkSc;
        doc.setFillColor(228, 236, 248);
        doc.rect(chkX[c.label], atY, cw, 7, 'F');
        doc.setDrawColor(155, 168, 195); doc.setLineWidth(0.2);
        doc.rect(chkX[c.label], atY, cw, 7, 'S');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(25, 50, 120);
        doc.text(c.label, chkX[c.label] + cw / 2, atY + 4.8, { align: 'center' });
      });
      return atY + 7;
    };
    y = drawChkHdr(y);

    checklists.forEach((c, i) => {
      nb(8);
      if (y + 8 > bounds.bottom) {
        doc.addPage(); pageNum++;
        bounds = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
        y = bounds.top;
        y = drawSectionBar(doc, y, 'Checklist (continued)', bounds);
        y = drawChkHdr(y);
      }
      const even = i % 2 === 0;
      doc.setFillColor(even ? 250 : 255, even ? 252 : 255, even ? 255 : 255);
      doc.rect(bounds.left, y, bounds.width, 7, 'F');
      doc.setDrawColor(155, 168, 195); doc.setLineWidth(0.12);
      doc.rect(bounds.left, y, bounds.width, 7, 'S');
      CHK_COLS.forEach(col => doc.line(chkX[col.label] + col.w * chkSc, y, chkX[col.label] + col.w * chkSc, y + 7));

      const ty = y + 4.8;
      // #
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(90, 90, 100);
      doc.text(String(i + 1), chkX['#'] + CHK_COLS[0].w * chkSc / 2, ty, { align: 'center' });
      // Checkpoint
      doc.setTextColor(25, 35, 80);
      doc.text((c.checklist_Desc || c.checkPointS || c.checlist_id || '').slice(0, 42), chkX['Checkpoint'] + 1, ty);
      // RH / LH with colored badges
      (['RH', 'LH']).forEach(side => {
        const val  = side === 'RH' ? (c.rh || '') : (c.lh || '');
        const cset = statusClrSet(val);
        const cx2  = chkX[side];
        const cw2  = (side === 'RH' ? CHK_COLS[2] : CHK_COLS[3]).w * chkSc;
        if (val) {
          doc.setFillColor(...cset.bg);
          doc.rect(cx2 + 1, y + 1, cw2 - 2, 5, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...cset.text);
          doc.text(val.toUpperCase(), cx2 + cw2 / 2, ty, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(180, 180, 185);
          doc.text('—', cx2 + cw2 / 2, ty, { align: 'center' });
        }
      });
      // Remarks
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(60, 70, 90);
      doc.text((c.remarks_RH || '').slice(0, 32), chkX['Remarks RH'] + 1, ty);
      doc.text((c.remarks_LH || '').slice(0, 32), chkX['Remarks LH'] + 1, ty);
      y += 7;
    });
    y += 4;
  }

  // ── 5. Annotations ───────────────────────────────────────────────────────
  if (images.length > 0) {
    nb(30);
    y = drawSectionBar(doc, y, `Annotations  (${images.length})`, bounds);
    const imgW = (bounds.width - 5) / 2;
    const imgH = imgW * 0.62;
    let ix = bounds.left;
    for (let i = 0; i < images.length; i++) {
      nb(imgH + 12);
      try {
        doc.addImage(images[i], 'PNG', ix, y, imgW, imgH);
        doc.setDrawColor(180, 188, 200); doc.setLineWidth(0.2);
        doc.rect(ix, y, imgW, imgH, 'S');
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(120, 130, 148);
        doc.text(`Annotation ${i + 1}`, ix + imgW / 2, y + imgH + 4, { align: 'center' });
      } catch { /* skip corrupt */ }
      if (i % 2 === 0) { ix = bounds.left + imgW + 5; }
      else             { ix = bounds.left; y += imgH + 10; }
    }
    if (images.length % 2 !== 0) y += imgH + 10;
    y += 4;
  }

  // ── 6. Proposal(s) / Solution(s) ──────────────────────────────────────────
  if (proposals || solutions || comments) {
    nb(25);
    y = drawSectionBar(doc, y, 'Proposal(s) / Solution(s)', bounds);

    const drawBlock = (heading, text, clr) => {
      if (!text) return;
      nb(18);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...clr);
      doc.text(heading, bounds.left, y + 5); y += 8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(25, 35, 80);
      const lines = doc.splitTextToSize(text, bounds.width);
      lines.forEach(l => { nb(6); doc.text(l, bounds.left, y); y += 5; });
      y += 3;
    };
    drawBlock('Proposal(s):',  proposals, [21, 101, 192]);
    drawBlock('Solution(s):',  solutions, [39, 130, 55]);
    drawBlock('Comments:',     comments,  [100, 110, 130]);
    y += 2;
  }

  // ── 7. History ────────────────────────────────────────────────────────────
  if (histories.length > 0) {
    nb(25);
    y = drawSectionBar(doc, y, 'History', bounds);
    const histEntries = [
      { action: 'Issue Created', by: docInfo.created_by || '—', on: fmtFull(docInfo.created_date) },
      ...histories.map(h => ({ action: h.flag1 || 'Updated', by: h.modified_by || '—', on: fmtFull(h.modified_date) })),
    ];
    histEntries.forEach((h, i) => {
      nb(11);
      const dotClr = i === 0 ? [25, 50, 120] : i === histEntries.length - 1 ? [39, 130, 55] : [180, 188, 210];
      doc.setFillColor(...dotClr); doc.circle(bounds.left + 2.5, y + 4, 1.5, 'F');
      if (i < histEntries.length - 1) {
        doc.setDrawColor(210, 218, 235); doc.setLineWidth(0.3);
        doc.line(bounds.left + 2.5, y + 5.5, bounds.left + 2.5, y + 11);
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(22, 32, 78);
      doc.text(h.action, bounds.left + 7, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110, 120, 140);
      doc.text(`${h.by}   ·   ${h.on}`, bounds.left + 7, y + 8.5);
      y += 12;
    });
  }

  doc.save(`issue-${docInfo.issue_number || docInfo.uid || 'report'}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared invoice header/footer used by grid reports
// ─────────────────────────────────────────────────────────────────────────────
function invoicePage(doc, pageNum, totalPages, reportTitle, subtitle = '') {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;

  // Outer border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(7, 7, W - 14, H - 14);

  // ── Header band ──
  doc.setFillColor(...PRIMARY);
  doc.rect(7, 7, W - 14, 28, 'F');

  // Decorative accent strip
  doc.setFillColor(...WGDE_CLR);
  doc.rect(7, 33, W - 14, 3, 'F');

  // Logo / app name (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('ChecklistMaster', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 255);
  doc.text('Quality Management System', 14, 27);

  // Report title (center)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle, W / 2, 18, { align: 'center' });
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 255);
    doc.text(subtitle, W / 2, 26, { align: 'center' });
  }

  // Date + page (right)
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 255);
  doc.text(`Printed: ${dateStr}`, W - 14, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Page ${pageNum} / ${totalPages}`, W - 14, 27, { align: 'right' });

  // ── Footer ──
  doc.setFillColor(...GREY_LIGHT);
  doc.rect(7, H - 20, W - 14, 13, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(7, H - 20, W - 7, H - 20);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...MID);
  doc.text('CONFIDENTIAL — For internal use only.  Do not distribute without authorisation.', W / 2, H - 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`${reportTitle}  ·  ${dateStr}  ·  Page ${pageNum} of ${totalPages}`, W / 2, H - 7, { align: 'center' });

  return { top: 42, bottom: H - 24, left: 14, right: W - 14, width: W - 28 };
}

// ── Badge pill ────────────────────────────────────────────────────────────────
function pill(doc, x, y, text, fillRgb, textRgb = [255, 255, 255], w = 26) {
  doc.setFillColor(...fillRgb);
  doc.roundedRect(x, y - 4, w, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...textRgb);
  doc.text(String(text).toUpperCase().slice(0, 10), x + w / 2, y, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stellantis PDEF Report helpers
// ─────────────────────────────────────────────────────────────────────────────

// Load Stellantis logo once as a base64 data URL (cached after first call)
let _logoCache = null;
async function loadStellantisLogo() {
  if (_logoCache) return _logoCache;
  try {
    const resp = await fetch(stellantisLogoUrl);
    const buf  = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    _logoCache = `data:image/jpeg;base64,${btoa(binary)}`;
  } catch {
    _logoCache = null;
  }
  return _logoCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared design helpers (used by all PDF generators)
// ─────────────────────────────────────────────────────────────────────────────

// Section title bar: 3 mm accent | bold title | thin underline
function drawSectionBar(doc, y, title, bounds, rightText = null) {
  doc.setFillColor(25, 50, 120);
  doc.rect(bounds.left, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(25, 50, 120);
  doc.text(title, bounds.left + 5, y + 4.5);
  if (rightText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 130, 148);
    doc.text(rightText, bounds.right, y + 4.5, { align: 'right' });
  }
  doc.setDrawColor(210, 218, 235);
  doc.setLineWidth(0.3);
  doc.line(bounds.left, y + 7, bounds.right, y + 7);
  return y + 10;
}

// Label : Value grid — 2 columns, no boxes, clean text layout
// pairs: [{label, value, full?, clr?}]
//   full=true  → spans both columns
//   clr        → RGB array for the value text
function drawLVGrid(doc, y, pairs, bounds) {
  const colW  = (bounds.width - 5) / 2;
  const LW    = 29;       // mm reserved for label text
  const ROW_H = 6;        // compact row height
  const LBLC  = [110, 122, 145];
  const VALC  = [22, 32, 78];

  let col = 0;
  let rowY = y;

  const renderOne = (label, value, x, maxLen, clr) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...LBLC);
    const lbl = label + ':';
    doc.text(lbl, x, rowY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...(clr || VALC));
    doc.text(String(value || '—').slice(0, maxLen), x + LW, rowY + 4.2);
  };

  for (const { label, value, full = false, clr } of pairs) {
    if (full) {
      if (col === 1) { rowY += ROW_H; col = 0; }
      renderOne(label, value, bounds.left, 52, clr);
      rowY += ROW_H;
    } else {
      const x = col === 0 ? bounds.left : bounds.left + colW + 5;
      renderOne(label, value, x, 28, clr);
      if (col === 1) { rowY += ROW_H; col = 0; }
      else col = 1;
    }
  }
  if (col === 1) rowY += ROW_H;
  return rowY + 3;
}

// Status color lookup  (returns {bg:[r,g,b], text:[r,g,b]})
function statusClrSet(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('completed ok') || s === 'ok')   return { bg:[232,249,238], text:[27,94,32],   badge:[46,125,50]  };
  if (s.includes('not ok'))                        return { bg:[255,235,238], text:[183,28,28],  badge:[198,40,40]  };
  if (s.includes('completed'))                     return { bg:[232,249,238], text:[27,94,32],   badge:[46,125,50]  };
  if (s.includes('in progress'))                   return { bg:[255,243,224], text:[230,81,0],   badge:[245,124,0]  };
  if (s.includes('open'))                          return { bg:[227,242,253], text:[13,71,161],  badge:[21,101,192] };
  if (s.includes('closed'))                        return { bg:[245,245,245], text:[97,97,97],   badge:[117,117,117]};
  if (s === 'n/a')                                 return { bg:[245,245,245], text:[117,117,117],badge:[158,158,158]};
  return                                                  { bg:[255,255,255], text:[60,60,80],   badge:[100,100,120]};
}

function escalClrSet(esc) {
  const e = (esc || '').toLowerCase();
  if (e === 'critical') return [198, 40, 40];
  if (e === 'high')     return [230, 81,  0];
  if (e === 'medium')   return [245,166,  0];
  return                       [46, 125, 50];
}

// Issue Ref Doc Status — returns { badge, bg, txt, label } or null
function refStatusSet(v) {
  if (v === '1') return { badge:[39,174,96],  bg:[232,249,238], txt:[27,94,32],   label:'Robust'         };
  if (v === '2') return { badge:[243,156,18], bg:[255,248,225], txt:[154,100,0],  label:'Minor Risk'     };
  if (v === '3') return { badge:[231,76,60],  bg:[255,235,238], txt:[183,28,28],  label:'Unfeasibility'  };
  if (v === '4') return { badge:[230,126,34], bg:[255,243,230], txt:[149,75,0],   label:'No DFN'         };
  if (v === '5') return { badge:[41,128,185], bg:[227,242,253], txt:[13,71,161],  label:'Not Rated'      };
  return null;
}

function stellantisReportPage(doc, pageNum, totalPages, logoDataUrl) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const ML = 10, MR = 10;

  // Outer border
  doc.setDrawColor(175, 182, 198);
  doc.setLineWidth(0.4);
  doc.rect(ML, 10, W - ML - MR, H - 20);

  // ── Stellantis logo — top right ──
  const logoW = 34, logoH = 14;
  const logoX = W - MR - logoW - 2;
  const logoY = 11.5;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'JPEG', logoX, logoY, logoW, logoH); } catch {}
  }

  // ── "Project Details" bold left ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(25, 35, 85);
  doc.text('Project Details', ML + 4, 27);

  // ── "Report On: bold-date" right ──
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const reportY   = 27;
  const rightEdge = W - MR - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(25, 35, 85);
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, rightEdge, reportY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Report On: ', rightEdge - dateW, reportY, { align: 'right' });

  // ── Separator line ──
  doc.setDrawColor(175, 182, 198);
  doc.setLineWidth(0.4);
  doc.line(ML, 31, W - MR, 31);

  // ── Page number (bottom, inside border) ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(45, 55, 100);
  doc.text(`${pageNum}/${totalPages}`, W / 2, H - 13, { align: 'center' });

  // ── Below-border footer: timestamp + copyright at 6pt ──
  const ts = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(125, 130, 145);
  doc.text(
    `Generated: ${ts}   ·   © Rstudio@stellantis.com`,
    W / 2, H - 4.5, { align: 'center' },
  );

  return {
    top:    33,
    bottom: H - 16,
    left:   ML + 3,
    right:  W - MR - 3,
    width:  W - ML - MR - 6,
  };
}

function drawCheck(doc, cx, cy, size) {
  doc.setDrawColor(25, 110, 25);
  doc.setLineWidth(0.75);
  doc.line(cx - size * 0.5, cy, cx - size * 0.1, cy + size * 0.5);
  doc.line(cx - size * 0.1, cy + size * 0.5, cx + size * 0.5, cy - size * 0.4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects Grid PDF  — Stellantis PDEF layout
// ─────────────────────────────────────────────────────────────────────────────
export async function generateProjectsGridPdf({
  rows = [],
  projectCodeOf    = new Map(),
  validatedByDept  = null,
  partCountByDept  = null,
  currentMilestoneOf = null,
  filename = 'projects-report.pdf',
}) {
  // Leaf column widths (relative mm, scaled to page)
  const LEAFW = [
    { key: 'code',       w: 9  },
    { key: 'program',    w: 14 },
    { key: 'project',    w: 24 },
    { key: 'plant',      w: 12 },
    { key: 'year',       w: 8  },
    { key: 'milestone',  w: 17 },
    { key: 'dept_avp',   w: 7  },
    { key: 'dept_wgde',  w: 7  },
    { key: 'pilot_avp',  w: 16 },
    { key: 'pilot_wgde', w: 16 },
    { key: 'validation', w: 15 },
    { key: 'issues',     w: 8  },
    { key: 'stat_avp',   w: 10 },
    { key: 'stat_wgde',  w: 10 },
  ];

  const ROW_H       = 7;
  const HDR1_H      = 7;
  const HDR2_H      = 5;
  const HDR_TOTAL   = HDR1_H + HDR2_H;
  const ROWS_PER_PG = 26;

  const totalPages  = Math.max(1, Math.ceil(rows.length / ROWS_PER_PG));
  const logoDataUrl = await loadStellantisLogo();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let pageNum = 1;
  let bounds  = stellantisReportPage(doc, pageNum, totalPages, logoDataUrl);
  let y       = bounds.top;

  const totalW = LEAFW.reduce((s, c) => s + c.w, 0);
  const sc     = bounds.width / totalW;

  // Compute x start of each column
  const colX = {};
  let cx0 = bounds.left;
  LEAFW.forEach(({ key, w }) => { colX[key] = cx0; cx0 += w * sc; });

  // Grouped column spans
  const GROUPS = [
    { label: 'Department', keys: ['dept_avp',  'dept_wgde']  },
    { label: 'PILOT',      keys: ['pilot_avp', 'pilot_wgde'] },
    { label: 'Status',     keys: ['stat_avp',  'stat_wgde']  },
  ];
  const groupKeySet = new Set(GROUPS.flatMap(g => g.keys));

  const HDR_FILL   = [228, 236, 248];
  const HDR_TEXT   = [25, 50, 120];
  const HDR_BORDER = [155, 168, 195];

  // Draw one header cell (fill + border + centered text)
  const drawHdrCell = (x, hy, w, h, text, opts = {}) => {
    const { bold = false, fs = 6.5, fill = HDR_FILL, textClr = HDR_TEXT } = opts;
    doc.setFillColor(...fill);
    doc.rect(x, hy, w, h, 'F');
    doc.setDrawColor(...HDR_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(x, hy, w, h, 'S');
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(...textClr);
    const lines = text.split('\n');
    const lineH = fs * 0.4;
    const blockH = lines.length * lineH;
    let ty = hy + (h - blockH) / 2 + lineH * 0.85;
    lines.forEach(l => {
      doc.text(l, x + w / 2, ty, { align: 'center' });
      ty += lineH;
    });
  };

  const drawHeader = (atY) => {
    // Single-span columns (fill both header rows)
    LEAFW.forEach(({ key, w }) => {
      if (groupKeySet.has(key)) return;
      const labels = {
        code: 'Code', program: 'Program', project: 'Project',
        plant: 'Plant', year: 'Plant\nyear', milestone: 'Milestone',
        validation: 'Validation\nStatus', issues: 'Issues',
      };
      drawHdrCell(colX[key], atY, w * sc, HDR_TOTAL, labels[key] || key, { bold: true });
    });

    // Group row-1 labels + sub-headers in row-2
    GROUPS.forEach(({ label, keys }) => {
      const gx  = colX[keys[0]];
      const gw  = keys.reduce((s, k) => s + LEAFW.find(c => c.key === k).w * sc, 0);
      drawHdrCell(gx, atY, gw, HDR1_H, label, { bold: true });
      const subLabels = ['AVP', 'WGDE'];
      keys.forEach((k, si) => {
        const lw = LEAFW.find(c => c.key === k).w * sc;
        drawHdrCell(colX[k], atY + HDR1_H, lw, HDR2_H, subLabels[si], { fs: 6 });
      });
    });

    return atY + HDR_TOTAL;
  };

  y = drawHeader(y);

  // ── Data rows ──
  const fmtMsName = v => (v || '—').slice(0, 13);

  const statusFill = (val, total) => {
    if (total === 0) return null;
    if (val === total) return [39, 174, 96];   // green
    if (val > 0)      return [204, 160, 0];    // yellow
    return [198, 40, 40];                       // red
  };

  rows.forEach((row, i) => {
    if (i > 0 && i % ROWS_PER_PG === 0) {
      doc.addPage();
      pageNum++;
      bounds = stellantisReportPage(doc, pageNum, totalPages, logoDataUrl);
      y = drawHeader(bounds.top);
    }

    const even = i % 2 === 0;
    doc.setFillColor(even ? 250 : 255, even ? 252 : 255, even ? 255 : 255);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'F');
    doc.setDrawColor(...HDR_BORDER);
    doc.setLineWidth(0.15);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'S');
    // Internal column separators
    LEAFW.forEach(({ key, w }) => {
      doc.line(colX[key] + w * sc, y, colX[key] + w * sc, y + ROW_H);
    });

    const dept     = (row.flag3 || '').toLowerCase();
    const deptAvp  = dept.includes('avp');
    const deptWgde = dept.includes('wgde');
    const code     = projectCodeOf instanceof Map ? projectCodeOf.get(row.uid) || '—' : '—';
    const ms       = currentMilestoneOf ? currentMilestoneOf.get(row.uid) : null;
    const avpTotal = partCountByDept?.avp?.get(row.uid)  ?? 0;
    const wgdeTotal= partCountByDept?.wgde?.get(row.uid) ?? 0;
    const avpVal   = validatedByDept?.avp?.get(row.uid)  ?? 0;
    const wgdeVal  = validatedByDept?.wgde?.get(row.uid) ?? 0;
    const textY    = y + ROW_H * 0.63;

    const put = (key, text, opts = {}) => {
      const { clr = [25, 35, 80], bold = false, fs = 6.5, align = 'left' } = opts;
      const lw = LEAFW.find(c => c.key === key).w * sc;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fs);
      doc.setTextColor(...clr);
      if (align === 'center') {
        doc.text(String(text), colX[key] + lw / 2, textY, { align: 'center' });
      } else {
        doc.text(String(text).slice(0, 28), colX[key] + 1.5, textY);
      }
    };

    put('code',       code,                                  { bold: true, clr: [30, 55, 140], align: 'center' });
    put('program',    String(row.program    || '—').slice(0, 9));
    put('project',    String(row.projectName|| '—').slice(0, 18));
    put('plant',      String(row.plant      || '—').slice(0, 7));
    put('year',       String(row.plant_year || '—'),         { align: 'center' });
    put('milestone',  ms ? fmtMsName(ms.name) : '—');

    // Department checkmarks
    const ckCY = y + ROW_H / 2;
    if (deptAvp)  drawCheck(doc, colX['dept_avp']  + LEAFW.find(c=>c.key==='dept_avp').w  * sc / 2, ckCY, 2.2);
    if (deptWgde) drawCheck(doc, colX['dept_wgde'] + LEAFW.find(c=>c.key==='dept_wgde').w * sc / 2, ckCY, 2.2);

    // Pilot owners
    put('pilot_avp',  String(row.avp_owner  || '—').slice(0, 11));
    put('pilot_wgde', String(row.wgte_owner || '—').slice(0, 11));

    // Validation status (combined fraction, blue)
    const totalAll = avpTotal + wgdeTotal;
    const valAll   = avpVal   + wgdeVal;
    put('validation', `${valAll} / ${totalAll}`,             { clr: [20, 55, 185], bold: true, align: 'center' });

    // Issues (total parts)
    put('issues', String(totalAll),                          { align: 'center' });

    // Status colored cells
    const drawStatCell = (key, val, total) => {
      const lw  = LEAFW.find(c => c.key === key).w * sc;
      const clr = statusFill(val, total);
      if (!clr) return;
      const pad = 1.5;
      doc.setFillColor(...clr);
      doc.rect(colX[key] + pad, y + pad, lw - pad * 2, ROW_H - pad * 2, 'F');
    };
    if (deptAvp)  drawStatCell('stat_avp',  avpVal,  avpTotal);
    if (deptWgde) drawStatCell('stat_wgde', wgdeVal, wgdeTotal);

    y += ROW_H;
  });

  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issues Grid PDF  — Stellantis PDEF layout (matches Projects Grid Print)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateIssuesGridPdf({ rows = [], filename = 'issues-report.pdf' }) {
  const COLS = [
    { key: 'seq',    label: '#',           w: 6  },
    { key: 'issnum', label: 'Issue #',     w: 24 },
    { key: 'title',  label: 'Title',       w: 40 },
    { key: 'part',   label: 'Part #',      w: 18 },
    { key: 'owner',  label: 'Owner',       w: 18 },
    { key: 'opened', label: 'Date Opened', w: 17 },
    { key: 'due',    label: 'Req. Compl.', w: 17 },
    { key: 'closed', label: 'Date Closed', w: 17 },
    { key: 'crby',   label: 'Created By',  w: 17 },
    { key: 'derog',  label: 'Derogation',  w: 16 },
    { key: 'esc',    label: 'Escalation',  w: 13 },
    { key: 'status', label: 'Status',      w: 19 },
  ];

  const ROW_H       = 7;
  const HDR_H       = 7;
  const ROWS_PER_PG = 30;
  const HDR_FILL    = [228, 236, 248];
  const HDR_TEXT_C  = [25, 50, 120];
  const HDR_BORDER  = [155, 168, 195];
  const totalW      = COLS.reduce((s, c) => s + c.w, 0);
  const totalPgs    = Math.max(1, Math.ceil(rows.length / ROWS_PER_PG));
  const logo        = await loadStellantisLogo();
  const doc         = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let pageNum = 1;
  let bounds  = stellantisReportPage(doc, pageNum, totalPgs, logo);
  let y       = bounds.top;
  const sc    = bounds.width / totalW;

  const colX = {};
  let cx0 = bounds.left;
  COLS.forEach(({ key, w }) => { colX[key] = cx0; cx0 += w * sc; });

  // ── Summary status tiles ──
  const TILES = [
    { label: 'Open',             clr: [21,101,192]  },
    { label: 'In Progress',      clr: [245,127,23]  },
    { label: 'Completed Ok',     clr: [46,125,50]   },
    { label: 'Completed Not Ok', clr: [198,40,40]   },
    { label: 'Closed',           clr: [100,100,100] },
  ];
  const tileW = bounds.width / TILES.length - 2;
  TILES.forEach((t, i) => {
    const tx  = bounds.left + i * (tileW + 2);
    const cnt = rows.filter(r => r.status === t.label).length;
    doc.setFillColor(...t.clr);
    doc.roundedRect(tx, y, tileW, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255,255,255);
    doc.text(String(cnt), tx + tileW / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(230,235,255);
    doc.text(t.label.slice(0, 14), tx + tileW / 2, y + 13.2, { align: 'center' });
  });
  y += 18;

  // ── Column header ──
  const drawHeader = (atY) => {
    COLS.forEach(({ key, label, w }) => {
      const cw = w * sc;
      doc.setFillColor(...HDR_FILL);
      doc.rect(colX[key], atY, cw, HDR_H, 'F');
      doc.setDrawColor(...HDR_BORDER); doc.setLineWidth(0.2);
      doc.rect(colX[key], atY, cw, HDR_H, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...HDR_TEXT_C);
      doc.text(label, colX[key] + cw / 2, atY + 4.6, { align: 'center' });
    });
    return atY + HDR_H;
  };
  y = drawHeader(y);

  // ── Color helpers ──
  const statusSet = s => {
    if (s === 'Open')             return { bg:[227,242,253], txt:[13,71,161]  };
    if (s === 'In Progress')      return { bg:[255,243,224], txt:[230,81,0]   };
    if (s === 'Completed Ok')     return { bg:[232,249,238], txt:[27,94,32]   };
    if (s === 'Completed Not Ok') return { bg:[255,235,238], txt:[183,28,28]  };
    if (s === 'Closed')           return { bg:[245,245,245], txt:[97,97,97]   };
    return                               { bg:[255,255,255], txt:[60,60,80]   };
  };
  const escClr2 = e => {
    if (e === 'Critical') return [198,40,40];
    if (e === 'High')     return [230,81,0];
    if (e === 'Medium')   return [245,166,0];
    return                       [46,125,50];
  };
  const fmtD2 = v => v ? new Date(v).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }) : '—';

  // ── Data rows ──
  rows.forEach((row, i) => {
    if (i > 0 && i % ROWS_PER_PG === 0) {
      doc.addPage(); pageNum++;
      bounds = stellantisReportPage(doc, pageNum, totalPgs, logo);
      let _cx = bounds.left;
      COLS.forEach(({ key, w }) => { colX[key] = _cx; _cx += w * sc; });
      y = drawHeader(bounds.top);
    }

    const even = i % 2 === 0;
    doc.setFillColor(even ? 250 : 255, even ? 252 : 255, even ? 255 : 255);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'F');
    doc.setDrawColor(...HDR_BORDER); doc.setLineWidth(0.12);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'S');
    COLS.forEach(({ key, w }) => doc.line(colX[key] + w * sc, y, colX[key] + w * sc, y + ROW_H));

    const ty  = y + ROW_H * 0.66;
    const put = (key, text, clr, bold = false) => {
      const cw = COLS.find(c => c.key === key).w * sc;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(6.5); doc.setTextColor(...clr);
      doc.text(String(text).slice(0, Math.floor(cw / 1.7)), colX[key] + 1.5, ty);
    };
    const putC = (key, text, clr, bold = false) => {
      const cw = COLS.find(c => c.key === key).w * sc;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(6.5); doc.setTextColor(...clr);
      doc.text(String(text), colX[key] + cw / 2, ty, { align: 'center' });
    };

    putC('seq',    String(i + 1),                      [140,140,155]);
    put ('issnum', row.issue_number || '—',             [25,50,140], true);
    put ('title',  row.issue_title  || '—',             [25,35,80]);
    put ('part',   row.partNumber   || '—',             [80,80,100]);
    put ('owner',  row.owner        || '—',             [80,80,100]);
    put ('opened', fmtD2(row.date_Opened),              [80,80,100]);
    put ('due',    fmtD2(row.req_Completion_Date),      [80,80,100]);
    put ('closed', fmtD2(row.date_Closed),              [80,80,100]);
    put ('crby',   row.created_by        || '—',        [80,80,100]);
    put ('derog',  row.derogation_sht_num || '—',       [80,80,100]);
    put ('esc',    row.flag2             || '—',        escClr2(row.flag2));

    // Status — use Ref Doc Status when set, fall back to old issue status
    const rStat      = refStatusSet(row.issueRefDocStatus);
    const { bg, txt } = rStat || statusSet(row.status);
    const statLbl    = rStat ? rStat.label : (row.status || '—');
    const sCw = COLS.find(c => c.key === 'status').w * sc;
    const pad = 1.5;
    doc.setFillColor(...bg);
    doc.rect(colX['status'] + pad, y + pad, sCw - pad * 2, ROW_H - pad * 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...txt);
    doc.text(statLbl.slice(0, 13), colX['status'] + sCw / 2, ty, { align: 'center' });

    y += ROW_H;
  });

  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Project View PDF  (from view drawer)
// ─────────────────────────────────────────────────────────────────────────────
export function generateProjectViewPdf({ project, code = '—', milestones = [], avpVal = 0, avpTotal = 0, wgdeVal = 0, wgdeTotal = 0 }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const totalPages = milestones.length > 8 ? 2 : 1;
  let pageNum = 1;
  let bounds  = invoicePage(doc, pageNum, totalPages, 'Project Report', project.projectName || '');
  let y = bounds.top;

  const sc = (need) => {
    if (y + need > bounds.bottom) {
      doc.addPage();
      pageNum++;
      bounds = invoicePage(doc, pageNum, totalPages, 'Project Report', project.projectName || '');
      y = bounds.top;
    }
  };

  // ── Project title block ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...DARK);
  doc.text(project.projectName || '—', bounds.left, y + 7);
  pill(doc, bounds.left + bounds.width - 32, y + 5, project.status || 'Active',
    project.status?.toLowerCase() === 'active' ? GREEN : [120, 120, 120], [255, 255, 255], 30);
  y += 14;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID);
  doc.text(`Code: ${code}  ·  Program: ${project.program || '—'}  ·  Plant: ${project.plant || '—'}  ·  Year: ${project.plant_year || '—'}`, bounds.left, y);
  y += 10;

  // ── Info grid ──
  sc(50);
  y = sectionTitle(doc, y, 'Project Information', bounds);
  y = kvGrid(doc, y, [
    ['Project Code',  code],
    ['Program',       project.program],
    ['Project Name',  project.projectName, true],
    ['Plant',         project.plant],
    ['Plant Year',    project.plant_year],
    ['Department',    (project.flag3 || '—').toUpperCase()],
    ['AVP Owner',     project.avp_owner || project.flag1],
    ['WGDE Owner',    project.wgte_owner || project.flag2],
    ['Status',        project.status],
    ['Zone',          project.zone],
    ['Area',          project.area],
    ['Created By',    project.created_by],
    ['Created Date',  fmt(project.created_date)],
    ['Modified By',   project.modified_by],
    ['Modified Date', fmt(project.modified_date)],
  ], bounds);
  y += 4;

  // ── Validation summary ──
  sc(30);
  y = sectionTitle(doc, y, 'Validation Summary', bounds);
  const half = bounds.width / 2 - 2;
  [[avpVal, avpTotal, 'AVP', AVP_CLR], [wgdeVal, wgdeTotal, 'WGDE', WGDE_CLR]].forEach(([val, total, label, clr], i) => {
    const tx = i === 0 ? bounds.left : bounds.left + half + 4;
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    doc.setFillColor(...clr);
    doc.roundedRect(tx, y, half, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(`${val} / ${total}`, tx + half / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(220, 230, 255);
    doc.text(`${label} Validated  (${pct}%)`, tx + half / 2, y + 13.5, { align: 'center' });
  });
  y += 18;

  // ── Milestone table ──
  if (milestones.length > 0) {
    sc(30);
    y = sectionTitle(doc, y, `Milestones (${milestones.length})`, bounds);
    const msCols = [{ w: 8 }, { w: 60 }, { w: 28 }, { w: 25 }, { w: 60 }];
    const msTotalW = msCols.reduce((s, c) => s + c.w, 0);
    const msScale  = bounds.width / msTotalW;

    doc.setFillColor(...PRIMARY);
    let hx = bounds.left;
    ['#', 'Milestone', 'Planned Date', 'Status', 'Notes'].forEach((h, i) => {
      doc.rect(hx, y, msCols[i].w * msScale, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
      doc.text(h, hx + 2, y + 4.2);
      hx += msCols[i].w * msScale;
    });
    y += 6;

    milestones.forEach((ms, i) => {
      sc(8);
      const sClr = ms.status?.toLowerCase() === 'completed' ? GREEN : ms.status?.toLowerCase() === 'in progress' ? ORANGE : MID;
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 249 : 255, i % 2 === 0 ? 255 : 255);
      doc.rect(bounds.left, y, bounds.width, 7, 'F');
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.1);
      doc.rect(bounds.left, y, bounds.width, 7, 'S');

      let cx = bounds.left;
      const msVals = [
        [String(i + 1),                                                        DARK],
        [String(ms.milestoneName || `M${i + 1}`).slice(0, 36),                 DARK],
        [ms.plannedDate ? fmt(ms.plannedDate) : '—',                           MID],
        [String(ms.status || 'Next Milestone'),                                 sClr],
        [String(ms.notes || '—').slice(0, 36),                                 MID],
      ];
      msVals.forEach(([val, clr], vi) => {
        doc.setFont('helvetica', vi === 3 ? 'bold' : 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...clr);
        doc.text(val, cx + 2, y + 4.8);
        cx += msCols[vi].w * msScale;
      });
      y += 7;
    });
  }

  doc.save(`project-${code}-report.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Detail PDF  — landscape A4
// Header info + milestone timeline + full parts grid
// ─────────────────────────────────────────────────────────────────────────────
export async function generateProjectDetailPdf({
  project,
  projectCode = '—',
  milestones  = [],
  links       = [],
  filename    = 'project-detail.pdf',
}) {
  const logoDataUrl = await loadStellantisLogo();

  // Page estimate: 13mm rows; page 1 loses ~130mm to header/info/milestones (~4 rows),
  // continuation pages hold ~11 rows each.
  const firstRows = 4, subseqRows = 11;
  const extra     = Math.max(0, links.length - firstRows);
  const totalPages = 1 + (extra > 0 ? Math.ceil(extra / subseqRows) : 0);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  let pageNum = 1;
  let bounds  = stellantisReportPage(doc, pageNum, totalPages, logoDataUrl);
  let y       = bounds.top;

  const HF   = [228, 236, 248];   // header fill
  const HB   = [155, 168, 195];   // header border
  const HT   = [25, 50, 120];     // header text

  // Section divider bar
  const secTitle = (text, atY) => {
    doc.setFillColor(...HF);
    doc.rect(bounds.left, atY, bounds.width, 6, 'F');
    doc.setDrawColor(...HB); doc.setLineWidth(0.2);
    doc.rect(bounds.left, atY, bounds.width, 6, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...HT);
    doc.text(text.toUpperCase(), bounds.left + 3, atY + 4.2);
    return atY + 7;
  };

  // ── 1. Project Info ───────────────────────────────────────────────────────
  y = drawSectionBar(doc, y, 'Project Information', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Code',       value: projectCode,
      clr: [30, 55, 140] },
    { label: 'Program',    value: project.program    || project.Program    || '—' },
    { label: 'Project',    value: project.projectName || '—', full: true },
    { label: 'Plant',      value: project.plant      || project.Plant      || '—' },
    { label: 'Year',       value: project.plant_year || project.Plant_year || '—' },
    { label: 'Department', value: (project.flag3 || project.Flag3 || '—'),
      clr: [100, 50, 140] },
    { label: 'AVP Owner',  value: project.avp_owner  || project.Avp_owner  || '—',
      clr: [21, 101, 192] },
    { label: 'WGDE Owner', value: project.wgte_owner || project.Wgte_owner || '—',
      clr: [106, 27, 154] },
    { label: 'Status',     value: project.status || project.Status || '—',
      clr: (project.status || '').toLowerCase() === 'active' ? [39, 130, 55] : [110, 110, 120] },
  ], bounds);

  // ── 2. Milestone Timeline ─────────────────────────────────────────────────
  y = secTitle('Milestone Timeline', y);

  const sorted = [...milestones]
    .map(m => ({
      milestoneName:  m.milestoneName  || m.MilestoneName  || '',
      milestoneOrder: m.milestoneOrder ?? m.MilestoneOrder ?? 0,
      plannedDate:    m.plannedDate    || m.PlannedDate     || null,
      status:         m.status         || m.Status          || 'Next Milestone',
    }))
    .sort((a, b) => a.milestoneOrder - b.milestoneOrder);
  const n = sorted.length;

  if (n > 0) {
    const TY = y + 16;
    const LX = bounds.left + 8, RX = bounds.right - 8, TW = RX - LX;
    const today2 = new Date();
    const validT = sorted.filter(m => m.plannedDate).map(m => new Date(m.plannedDate).getTime());

    let xPos, todayX = null;
    if (validT.length >= 2) {
      const allT = [...validT, today2.getTime()];
      const minT = Math.min(...allT), maxT = Math.max(...allT);
      const rng  = Math.max(maxT - minT, 30 * 86400000), pad = rng * 0.1;
      const tS   = minT - pad, tE = maxT + pad, tR = tE - tS;
      xPos = sorted.map(m => m.plannedDate
        ? LX + ((new Date(m.plannedDate).getTime() - tS) / tR) * TW
        : null);
      xPos = xPos.map((x, i) => x ?? (LX + (n > 1 ? (i / (n - 1)) * TW : TW / 2)));
      const tT = today2.getTime();
      if (tT >= tS && tT <= tE) todayX = LX + ((tT - tS) / tR) * TW;
    } else {
      xPos = sorted.map((_, i) => LX + (n > 1 ? (i / (n - 1)) * TW : TW / 2));
      todayX = LX + TW * 0.4;
    }
    for (let i = 1; i < n; i++) if (xPos[i] - xPos[i - 1] < 18) xPos[i] = xPos[i - 1] + 18;

    const lastDone = sorted.reduce((a, m, i) => (m.status || '').toLowerCase() === 'completed' ? i : a, -1);

    // Grey track + green completed segment
    doc.setDrawColor(200, 202, 208); doc.setLineWidth(2);
    doc.line(LX, TY, RX, TY);
    if (lastDone >= 0) {
      doc.setDrawColor(39, 174, 96); doc.setLineWidth(2);
      doc.line(xPos[0], TY, xPos[lastDone], TY);
    }

    // TODAY pin
    if (todayX !== null) {
      doc.setDrawColor(229, 57, 53); doc.setLineWidth(0.4);
      doc.line(todayX, TY - 7, todayX, TY + 5);
      doc.setFillColor(229, 57, 53); doc.circle(todayX, TY, 1.5, 'F');
      const tds = today2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(229, 57, 53);
      doc.text(tds, todayX, TY - 9, { align: 'center' });
    }

    // Dots + labels
    sorted.forEach((ms, i) => {
      const x = xPos[i], st = (ms.status || '').toLowerCase();
      if (st === 'completed')  { doc.setFillColor(26, 26, 26);   doc.circle(x, TY, 3, 'F'); }
      else if (st === 'on going') { doc.setFillColor(123, 31, 162); doc.circle(x, TY, 3, 'F'); }
      else { doc.setFillColor(255, 255, 255); doc.setDrawColor(175, 175, 175); doc.setLineWidth(0.7); doc.circle(x, TY, 3, 'FD'); }

      if (ms.plannedDate) {
        const d  = new Date(ms.plannedDate);
        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(100, 100, 100);
        doc.text(ds, x, TY - 5, { align: 'center' });
      }
      const lbl = (ms.milestoneName || `M${i + 1}`).slice(0, 10);
      const [r, g, b] = st === 'completed' ? [26,26,26] : st === 'on going' ? [123,31,162] : [110,110,120];
      doc.setFont('helvetica', st !== 'next milestone' ? 'bold' : 'normal');
      doc.setFontSize(5.5); doc.setTextColor(r, g, b);
      doc.text(lbl, x, TY + 7, { align: 'center' });
    });

    // Legend
    const legY = TY + 13;
    let legX   = bounds.left;
    [
      [26, 26, 26,   'Completed',      true ],
      [123, 31, 162, 'On Going',       true ],
      [175, 175, 175,'Next Milestone', false],
      [229, 57, 53,  'Today',       true ],
    ].forEach(([r, g, b, lbl, filled]) => {
      doc.setFillColor(r, g, b);
      if (filled) { doc.circle(legX + 2, legY + 1.5, 1.5, 'F'); }
      else { doc.setDrawColor(r, g, b); doc.setLineWidth(0.4); doc.circle(legX + 2, legY + 1.5, 1.5, 'FD'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(80, 80, 90);
      doc.text(lbl, legX + 5, legY + 2.5);
      legX += doc.getTextWidth(lbl) + 12;
    });
    y = legY + 8;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text('No milestones configured.', bounds.left + 4, y + 6);
    y += 12;
  }

  y += 3;

  // ── 3. Parts Grid — single table, RH/LH stacked in one cell ────────────
  // 19 columns; each paired column shows top=RH/AVP, bottom=LH/WGDE.
  const ROW_H  = 13;   // tall enough for 2 lines
  const HDR_H  = 10;   // header: label + sub-label (RH/LH)

  const COLS = [
    { key:'num',  label:'#',           sub:null,          w:5  },
    { key:'doc',  label:'Doc #',       sub:'AVP / WGDE',  w:21 },
    { key:'pn',   label:'Part #',      sub:'RH / LH',     w:17 },
    { key:'pname',label:'Name',        sub:'RH / LH',     w:17 },
    { key:'desc', label:'Description', sub:null,          w:23 },
    { key:'type', label:'Type',        sub:null,          w:10 },
    { key:'zone', label:'Zone/Area',   sub:null,          w:12 },
    { key:'mat',  label:'Material',    sub:null,          w:12 },
    { key:'init', label:'Initiator',   sub:null,          w:12 },
    { key:'own',  label:'Owner',       sub:null,          w:12 },
    { key:'dept', label:'Dept',        sub:null,          w:10 },
    { key:'pdef', label:'PDEF #',      sub:'RH / LH',     w:14 },
    { key:'la',   label:'LA #',        sub:'RH / LH',     w:12 },
    { key:'pa',   label:'PA #',        sub:'RH / LH',     w:12 },
    { key:'rev',  label:'Revision',    sub:'RH / LH',     w:12 },
    { key:'maty', label:'Maturity',    sub:'RH / LH',     w:14 },
    { key:'tgt',  label:'Target',      sub:'AVP / WGDE',  w:15 },
    { key:'prio', label:'Priority',    sub:'AVP / WGDE',  w:12 },
    { key:'stat', label:'Status',      sub:null,          w:10 },
  ];
  const cTotalW = COLS.reduce((s, c) => s + c.w, 0);  // 262mm → scale ≈ 1.034
  const cSc = bounds.width / cTotalW;
  const cX  = {};
  let cxOff = bounds.left;
  COLS.forEach(c => { cX[c.key] = cxOff; cxOff += c.w * cSc; });

  const drawHdr = (atY) => {
    COLS.forEach(c => {
      const cw = c.w * cSc;
      doc.setFillColor(...HF);
      doc.rect(cX[c.key], atY, cw, HDR_H, 'F');
      doc.setDrawColor(...HB); doc.setLineWidth(0.15);
      doc.rect(cX[c.key], atY, cw, HDR_H, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6); doc.setTextColor(...HT);
      doc.text(c.label, cX[c.key] + cw / 2, atY + (c.sub ? 3.8 : 5.5), { align: 'center' });
      if (c.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.8); doc.setTextColor(100, 120, 165);
        doc.text(c.sub, cX[c.key] + cw / 2, atY + 7.8, { align: 'center' });
      }
    });
    return atY + HDR_H;
  };

  y = drawHdr(y);

  if (links.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text('No parts linked to this project.', bounds.left + 3, y + 6);
  }

  links.forEach((lnk, i) => {
    if (y + ROW_H > bounds.bottom) {
      doc.addPage(); pageNum++;
      bounds = stellantisReportPage(doc, pageNum, totalPages, logoDataUrl);
      y = bounds.top;
      y = secTitle('Parts Information (continued)', y);
      y = drawHdr(y);
    }

    const ex    = (() => { try { return JSON.parse(lnk.flag2 || lnk.Flag2 || '{}'); } catch { return {}; } })();
    const dept  = (lnk.flag1 || lnk.Flag1 || '').toLowerCase();
    const actv  = (lnk.status || '').toLowerCase() === 'active';
    const even  = i % 2 === 0;

    // Row background + outer border
    doc.setFillColor(even ? 250 : 255, even ? 252 : 255, even ? 255 : 255);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'F');
    doc.setDrawColor(...HB); doc.setLineWidth(0.12);
    doc.rect(bounds.left, y, bounds.width, ROW_H, 'S');
    // Vertical separators
    COLS.forEach(c => doc.line(cX[c.key] + c.w * cSc, y, cX[c.key] + c.w * cSc, y + ROW_H));

    // Single-value cell (vertically centred)
    const putS = (key, val, opts = {}) => {
      const { clr = [30,40,80], bold = false, center = false, max = 16 } = opts;
      const cw = COLS.find(c => c.key === key).w * cSc;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(6.5); doc.setTextColor(...clr);
      const s = String(val || '—').slice(0, max);
      if (center) doc.text(s, cX[key] + cw / 2, y + 7, { align: 'center' });
      else        doc.text(s, cX[key] + 1, y + 7);
    };

    // Stacked-pair cell: top line then hairline then bottom line
    const putP = (key, top, bot, opts = {}) => {
      const { cT = [30,40,80], cB = [90,55,130], max = 13 } = opts;
      const cw = COLS.find(c => c.key === key).w * cSc;
      // top
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...cT);
      doc.text(String(top || '—').slice(0, max), cX[key] + 1, y + 4.2);
      // mid hairline
      doc.setDrawColor(215, 220, 230); doc.setLineWidth(0.08);
      doc.line(cX[key] + 0.5, y + ROW_H / 2, cX[key] + cw - 0.5, y + ROW_H / 2);
      // bottom
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...cB);
      doc.text(String(bot || '—').slice(0, max), cX[key] + 1, y + 9.8);
    };

    const deptClr = dept.includes('avp') && dept.includes('wgde')
      ? [100,50,130] : dept.includes('avp') ? [21,101,192] : [106,27,154];

    putS('num',  String(i+1), { clr:[80,80,95], center:true });
    putP('doc',
      lnk.issue_number  || lnk.Issue_number  || '—',
      lnk.flag3         || lnk.Flag3         || '—',
      { cT:[25,50,140], cB:[95,28,128], max:14 });
    putP('pn',
      lnk.part_number_RH || lnk.Part_number_RH || '—',
      lnk.part_number_LH || lnk.Part_number_LH || '—');
    putP('pname', ex.partNameRH || '—', ex.partNameLH || '—');
    putS('desc',  lnk.part_Description || lnk.Part_Description || '—', { max:17 });
    putS('type',  ex.partType  || '—', { max:8  });
    putS('zone',  ex.zoneArea  || '—', { max:9  });
    putS('mat',   ex.material  || '—', { max:9  });
    putS('init',  ex.initiator || '—', { max:9  });
    putS('own',   ex.owner     || '—', { max:9  });
    putP('pdef',  ex.pdefRH || '—', ex.pdefLH || '—',
      { cT:[25,50,140], cB:[25,50,140], max:11 });
    putP('la',    ex.laRH   || '—', ex.laLH   || '—', { max:9  });
    putP('pa',    ex.paRH   || '—', ex.paLH   || '—', { max:9  });
    putP('rev',   ex.revisionRH      || '—', ex.revisionLH      || '—', { max:9  });
    putP('maty',  ex.maturityStateRH || '—', ex.maturityStateLH || '—', { max:11 });
    putP('tgt',
      ex.targetCompletionAVP  || '—',
      ex.targetCompletionWGDE || '—',
      { cT:[40,110,50], cB:[100,25,150], max:12 });
    putP('prio',
      ex.priorityAVP  || '—',
      ex.priorityWGDE || '—',
      { cT:[21,101,192], cB:[106,27,154], max:9  });
    putS('dept', lnk.flag1 || lnk.Flag1 || '—', { clr:deptClr, max:8 });
    putS('stat', actv ? 'Active' : (lnk.status || '—'),
      { clr:actv ? [39,130,55] : [110,110,120], bold:true, max:8 });

    y += ROW_H;
  });

  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist Manage PDF  (DMRS/manage — Document info + Milestones + Checklist)
// Portrait A4; dynamic milestone columns (up to ~8 comfortably)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateChecklistManagePdf({
  docInfo          = null,
  partLink         = null,
  project          = null,
  partExtras       = {},
  dynMilestones    = [],   // [{key, label, cmtKey}]
  mergedRows       = [],   // checklist rows with sync data keyed by ms.key
  edits            = {},   // current in-memory edits {uid: {msKey: value}}
  activeMilestone  = '',
  activeMilestoneLabel = '',
  filename         = 'checklist.pdf',
}) {
  const logoDataUrl = await loadStellantisLogo();
  const msCount     = dynMilestones.length;

  // Decide portrait vs landscape based on milestone count
  const orient = msCount > 5 ? 'landscape' : 'portrait';
  const estPages = Math.max(1, Math.ceil(mergedRows.length / (orient === 'landscape' ? 18 : 22)));
  const doc      = new jsPDF({ unit: 'mm', format: 'a4', orientation: orient });

  let pageNum = 1;
  let bounds  = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
  let y       = bounds.top;

  const nb = (need) => {
    if (y + need > bounds.bottom) {
      doc.addPage(); pageNum++;
      bounds = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
      y = bounds.top;
    }
  };

  // ── 1. Document Information ───────────────────────────────────────────────
  y = drawSectionBar(doc, y, 'Document Information', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Issue #',      value: docInfo?.issue_number || '—',
      clr: [25, 50, 120] },
    { label: 'Title',        value: (docInfo?.issue_title || '—'), full: true },
    { label: 'Project',      value: project?.projectName || project?.ProjectName || '—' },
    { label: 'Program',      value: project?.program     || project?.Program     || partLink?.program || '—' },
    { label: 'Plant',        value: project?.plant       || project?.Plant       || partLink?.plant   || '—' },
    { label: 'Plant Year',   value: project?.plant_year  || project?.Plant_year  || partLink?.plant_year || '—' },
    { label: 'Part # RH',    value: partLink?.Part_number_RH || partLink?.part_number_RH || '—' },
    { label: 'Part # LH',    value: partLink?.Part_number_LH || partLink?.part_number_LH || '—' },
    { label: 'Name RH',      value: partExtras?.partNameRH || '—' },
    { label: 'Name LH',      value: partExtras?.partNameLH || '—' },
    { label: 'Department',   value: (partLink?.flag1 || partLink?.Flag1 || '—').toUpperCase(),
      clr: [100, 50, 140] },
    { label: 'Material',     value: partExtras?.material  || '—' },
    { label: 'Owner',        value: partExtras?.owner     || '—' },
    { label: 'Initiator',    value: partExtras?.initiator || '—' },
    { label: 'PDEF # RH',    value: partExtras?.pdefRH   || '—' },
    { label: 'PDEF # LH',    value: partExtras?.pdefLH   || '—' },
    { label: 'LA # RH',      value: partExtras?.laRH     || '—' },
    { label: 'LA # LH',      value: partExtras?.laLH     || '—' },
    { label: 'PA # RH',      value: partExtras?.paRH     || '—' },
    { label: 'PA # LH',      value: partExtras?.paLH     || '—' },
    { label: 'Doc Status',   value: docInfo?.status || '—',
      clr: statusClrSet(docInfo?.status).badge },
    { label: 'Date Opened',  value: docInfo?.date_Opened
        ? new Date(docInfo.date_Opened).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
  ], bounds);

  // ── 2. Milestone Info ─────────────────────────────────────────────────────
  nb(25);
  y = drawSectionBar(doc, y, 'Milestone Info', bounds);
  y = drawLVGrid(doc, y, [
    { label: 'Print Date',        value: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) },
    { label: 'Active Milestone',  value: activeMilestoneLabel || dynMilestones[0]?.label || '—',
      clr: [140, 20, 20] },
    { label: 'All Milestones',    value: dynMilestones.map(m => m.label).join('  ·  '), full: true },
  ], bounds);

  // ── 3. Checklist ──────────────────────────────────────────────────────────
  nb(25);
  const chkLabel = activeMilestoneLabel
    ? `Checklist — ${activeMilestoneLabel}  (${mergedRows.length} items)`
    : `Checklist  (${mergedRows.length} items)`;
  y = drawSectionBar(doc, y, chkLabel, bounds, `Printed: ${new Date().toLocaleDateString('en-GB')}`);

  if (mergedRows.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text('No checklist items found.', bounds.left + 3, y + 6);
  } else {
    // Build column list — fixed + one per milestone
    const MS_W  = Math.min(15, Math.max(9, Math.floor((bounds.width - 60) / Math.max(msCount, 1))));
    const CL    = [
      { key: 'seq',  label: '#',           w: 6  },
      { key: 'chkp', label: 'Check Point', w: 22 },
      { key: 'desc', label: 'Description', w: bounds.width - 28 - msCount * MS_W },
      ...dynMilestones.map(ms => ({ key: ms.key, label: ms.label, w: MS_W, cmtKey: ms.cmtKey })),
    ];
    const clTW  = CL.reduce((s, c) => s + c.w, 0);
    const clSc  = bounds.width / clTW;
    const clX   = {};
    let clOff = bounds.left;
    CL.forEach(c => { clX[c.key] = clOff; clOff += c.w * clSc; });

    const ROW_H = 7;
    const HDR_H = 9;

    const drawHdr = (atY) => {
      CL.forEach(c => {
        const cw = c.w * clSc;
        // Check if it's a milestone column and color by active/other
        const isActiveMs = c.key === activeMilestone;
        const isMsCol    = dynMilestones.some(m => m.key === c.key);
        const fill = isActiveMs ? [200, 225, 245] : isMsCol ? [228, 236, 248] : [228, 236, 248];
        doc.setFillColor(...fill);
        doc.rect(clX[c.key], atY, cw, HDR_H, 'F');
        doc.setDrawColor(155, 168, 195); doc.setLineWidth(0.15);
        doc.rect(clX[c.key], atY, cw, HDR_H, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isActiveMs ? 6.5 : 6);
        doc.setTextColor(isActiveMs ? 5 : 25, isActiveMs ? 60 : 50, isActiveMs ? 140 : 120);
        // Wrap label into 2 lines if needed
        const lbl = c.label;
        const mid = Math.ceil(lbl.length / 2);
        const line1 = lbl.length > 9 ? lbl.slice(0, mid) : lbl;
        const line2 = lbl.length > 9 ? lbl.slice(mid)    : '';
        if (line2) {
          doc.text(line1, clX[c.key] + cw / 2, atY + 3.5, { align: 'center' });
          doc.text(line2, clX[c.key] + cw / 2, atY + 6.8, { align: 'center' });
        } else {
          doc.text(lbl, clX[c.key] + cw / 2, atY + 5.2, { align: 'center' });
        }
      });
      return atY + HDR_H;
    };

    y = drawHdr(y);

    mergedRows.forEach((row, i) => {
      if (y + ROW_H > bounds.bottom) {
        doc.addPage(); pageNum++;
        bounds = stellantisReportPage(doc, pageNum, estPages, logoDataUrl);
        y = bounds.top;
        y = drawSectionBar(doc, y, 'Checklist (continued)', bounds);
        y = drawHdr(y);
      }

      const even = i % 2 === 0;
      doc.setFillColor(even ? 250 : 255, even ? 252 : 255, even ? 255 : 255);
      doc.rect(bounds.left, y, bounds.width, ROW_H, 'F');
      doc.setDrawColor(155, 168, 195); doc.setLineWidth(0.1);
      doc.rect(bounds.left, y, bounds.width, ROW_H, 'S');
      CL.forEach(c => doc.line(clX[c.key] + c.w * clSc, y, clX[c.key] + c.w * clSc, y + ROW_H));

      const ty = y + ROW_H * 0.65;
      // Row number
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(90, 90, 100);
      doc.text(String(i + 1), clX['seq'] + CL[0].w * clSc / 2, ty, { align: 'center' });
      // Check point + description
      doc.setTextColor(25, 35, 80);
      doc.text((row.check_Point || row.checkPoint || '').slice(0, 16), clX['chkp'] + 1, ty);
      doc.setFontSize(6);
      doc.text((row.description || row.Description || '').slice(0, Math.floor(CL[2].w * clSc / 1.4)), clX['desc'] + 1, ty);

      // Milestone status cells
      dynMilestones.forEach(ms => {
        const rawVal  = edits[row.uid]?.[ms.key] ?? row[ms.key] ?? '';
        const val     = (rawVal || '').trim();
        const cset    = statusClrSet(val);
        const cx2     = clX[ms.key];
        const cw2     = ms.w * clSc; // Note: ms.w may be missing — use column def
        const colDef  = CL.find(c => c.key === ms.key);
        const cw3     = (colDef?.w || MS_W) * clSc;
        if (val) {
          doc.setFillColor(...cset.bg);
          doc.rect(cx2 + 0.5, y + 0.8, cw3 - 1, ROW_H - 1.6, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...cset.text);
          doc.text(val.length > 6 ? val.slice(0, 5) + '…' : val, cx2 + cw3 / 2, ty, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(195, 195, 205);
          doc.text('—', cx2 + cw3 / 2, ty, { align: 'center' });
        }
      });

      y += ROW_H;
    });
  }

  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklists Grid PDF  (landscape A4)
// ─────────────────────────────────────────────────────────────────────────────
export function generateChecklistsGridPdf({ rows = [], filename = 'checklists-report.pdf' }) {
  const COLS = [
    { label: '#',            w: 7  },
    { label: 'ID',           w: 16 },
    { label: 'Checkpoint',   w: 54 },
    { label: 'Description',  w: 56 },
    { label: 'Department',   w: 18 },
    { label: 'Zone',         w: 18 },
    { label: 'Category',     w: 24 },
    { label: 'Mandatory',    w: 16 },
    { label: 'Status',       w: 16 },
  ];
  const ROWS_PER_PAGE = 30;
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  // Summary counts
  const active    = rows.filter(r => r.status?.toLowerCase() === 'active').length;
  const inactive  = rows.length - active;
  const avpCount  = rows.filter(r => (r.department || '').toLowerCase().includes('avp')).length;
  const wgdeCount = rows.filter(r => (r.department || '').toLowerCase().includes('wgde')).length;
  const mandCount = rows.filter(r => (r.mandatory || '').toLowerCase() === 'yes').length;

  let pageNum = 1;
  let bounds  = invoicePage(doc, pageNum, totalPages, 'Checklists Report', `${rows.length} records`);
  let y = bounds.top;

  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  const scale  = bounds.width / totalW;

  // ── Summary tiles ──
  const tiles = [
    { label: 'Total',      value: rows.length, clr: PRIMARY },
    { label: 'Active',     value: active,       clr: [46, 125, 50] },
    { label: 'Inactive',   value: inactive,     clr: [120, 120, 120] },
    { label: 'AVP',        value: avpCount,     clr: AVP_CLR },
    { label: 'WGDE',       value: wgdeCount,    clr: WGDE_CLR },
    { label: 'Mandatory',  value: mandCount,    clr: [198, 40, 40] },
  ];
  const tileW = bounds.width / tiles.length - 2;
  tiles.forEach((t, i) => {
    const tx = bounds.left + i * (tileW + 2);
    doc.setFillColor(...t.clr);
    doc.roundedRect(tx, y, tileW, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text(String(t.value), tx + tileW / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(220, 225, 255);
    doc.text(t.label, tx + tileW / 2, y + 13.5, { align: 'center' });
  });
  y += 18;

  // ── Table header ──
  const drawHeader = (atY) => {
    doc.setFillColor(...PRIMARY);
    let hx = bounds.left;
    COLS.forEach(c => {
      doc.rect(hx, atY, c.w * scale, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
      doc.text(c.label, hx + 2, atY + 4.8);
      hx += c.w * scale;
    });
    return atY + 7;
  };

  y = drawHeader(y);

  rows.forEach((row, i) => {
    if (i > 0 && i % ROWS_PER_PAGE === 0) {
      doc.addPage();
      pageNum++;
      bounds = invoicePage(doc, pageNum, totalPages, 'Checklists Report', `${rows.length} records`);
      y = bounds.top;
      y = drawHeader(y);
    }

    const even = i % 2 === 0;
    doc.setFillColor(even ? 248 : 255, even ? 249 : 255, even ? 255 : 255);
    doc.rect(bounds.left, y, bounds.width, 7, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.1);
    doc.rect(bounds.left, y, bounds.width, 7, 'S');

    const isActive  = row.status?.toLowerCase() === 'active';
    const isMandatory = (row.mandatory || '').toLowerCase() === 'yes';
    const deptLower = (row.department || '').toLowerCase();
    const deptClr   = deptLower.includes('avp') ? AVP_CLR : deptLower.includes('wgde') ? WGDE_CLR : MID;

    const vals = [
      [String(i + 1),                                          DARK],
      [String(row.chkId || '—').slice(0, 10),                  PRIMARY],
      [String(row.checkPointS || '—').slice(0, 36),            DARK],
      [String(row.checkpointDesc || '—').slice(0, 38),         MID],
      [String(row.department || '—').slice(0, 10),             deptClr],
      [String(row.zone || '—').slice(0, 10),                   MID],
      [String(row.category || '—').slice(0, 14),               MID],
      [isMandatory ? 'Yes' : 'No',                             isMandatory ? RED : MID],
      [isActive ? 'Active' : 'Inactive',                       isActive ? GREEN : [120, 120, 120]],
    ];

    let cx = bounds.left;
    vals.forEach(([val, clr], vi) => {
      doc.setFont('helvetica', vi === 1 || vi === 8 ? 'bold' : 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...clr);
      doc.text(val, cx + 2, y + 4.8);
      cx += COLS[vi].w * scale;
    });
    y += 7;
  });

  doc.save(filename);
}
