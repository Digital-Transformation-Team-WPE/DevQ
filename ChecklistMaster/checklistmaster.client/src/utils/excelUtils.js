/**
 * excelUtils.js – shared Excel download / import utilities.
 * Uses the `xlsx` (SheetJS) library for standard templates and exports.
 * Uses `exceljs` (loaded lazily) for templates that need dropdown validation.
 */
import * as XLSX from 'xlsx';

/**
 * Download an empty Excel template with column headers.
 * Mandatory columns (mandatory:true) get an orange fill + bold + asterisk suffix.
 * Optional columns get a light-yellow fill, not bold.
 * @param {Array<{header:string, key:string, width?:number, mandatory?:boolean}>} columns
 * @param {string} filename  e.g. 'projects-template.xlsx'
 */
export function downloadTemplate(columns, filename) {
  const headers = columns.map(c => c.mandatory ? `${c.header} *` : c.header);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? 24 }));
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (!cell) continue;
    const isMandatory = !!columns[C]?.mandatory;
    cell.s = {
      fill: { fgColor: { rgb: isMandatory ? 'FFE0B2' : 'FFF9C4' } },
      font: { bold: isMandatory, color: { rgb: isMandatory ? 'BF360C' : '555555' } },
      alignment: { horizontal: 'center', wrapText: true },
      border: {
        bottom: { style: 'thin', color: { rgb: isMandatory ? 'FF6F00' : 'CCCCCC' } },
      },
    };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, filename, { cellStyles: true });
}

/**
 * Export data rows to Excel.
 * @param {Array<object>} rows       Data records
 * @param {Array<{header,key}>} columns
 * @param {string} filename
 */
export function exportToExcel(rows, columns, filename) {
  const headers = columns.map(c => c.header);
  const data = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toLocaleDateString('en-GB');
      return String(v);
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

/**
 * Download an Excel template with column headers AND optional in-cell dropdowns.
 * Uses ExcelJS (loaded lazily) for full data-validation support.
 *
 * @param {Array<{header, key, width?, mandatory?, options?}>} columns
 *   – `options` is a string[] of allowed values; if omitted the cell is free-text.
 * @param {string} filename
 */
export async function downloadTemplateWithDropdowns(columns, filename) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  // Hidden sheet that holds the dropdown lists (one per dropdown column).
  const refSheet = wb.addWorksheet('_Options');
  refSheet.state = 'hidden';

  const sheet = wb.addWorksheet('Template');

  // Column widths
  sheet.columns = columns.map(col => ({ width: col.width ?? 24 }));

  // Header row
  const headerRow = sheet.getRow(1);
  columns.forEach((col, ci) => {
    const cell = headerRow.getCell(ci + 1);
    cell.value     = col.mandatory ? `${col.header} *` : col.header;
    cell.fill      = { type:'pattern', pattern:'solid',
                       fgColor:{ argb: col.mandatory ? 'FFFFE0B2' : 'FFFFF9C4' } };
    cell.font      = { bold: !!col.mandatory,
                       color:{ argb: col.mandatory ? 'FFBF360C' : 'FF555555' } };
    cell.alignment = { horizontal:'center', wrapText:true };
    cell.border    = { bottom:{ style:'thin',
                                color:{ argb: col.mandatory ? 'FFFF6F00' : 'FFCCCCCC' } } };
  });
  headerRow.commit();

  // For each column that carries options: write values to the ref sheet and
  // apply data-validation to 1000 data rows.
  columns.forEach((col, ci) => {
    if (!col.options || col.options.length === 0) return;

    // Column letter (A-Z for up to 26 columns — sufficient here).
    const colLetter = String.fromCharCode(65 + ci);

    // Write options vertically in the ref sheet.
    col.options.forEach((opt, oi) => {
      refSheet.getCell(oi + 1, ci + 1).value = opt;
    });

    // Attach list validation to data rows 2–1001.
    const formula = `_Options!$${colLetter}$1:$${colLetter}$${col.options.length}`;
    for (let r = 2; r <= 1001; r++) {
      sheet.getCell(r, ci + 1).dataValidation = {
        type:         'list',
        allowBlank:   true,
        showDropDown: false,   // false = show the dropdown arrow in Excel
        formulae:     [formula],
      };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an Excel / CSV file uploaded by the user.
 * Returns an array of plain objects keyed by the first-row headers.
 * @param {File} file
 * @returns {Promise<Array<object>>}
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb     = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const wsName = wb.SheetNames.find(n => n === 'Template' || n === 'Data') ?? wb.SheetNames[0];
        const ws     = wb.Sheets[wsName];
        const data   = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
