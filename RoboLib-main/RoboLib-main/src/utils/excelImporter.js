
import * as XLSX from 'xlsx';

/**
 * Check if a cell should be formatted as a date
 * Row 6 (index 5) and Columns B-E (indices 1-4) are date fields
 */
function isDateField(rowIndex, colIndex) {
  // Row 6 (0-based index 5) - all columns
  if (rowIndex === 5) return true;
  // Columns B, C, D, E (0-based indices 1, 2, 3, 4) - all rows
  if (colIndex >= 1 && colIndex <= 4) return true;
  return false;
}

/**
 * Format date to DD-MMM-YY format (e.g., "05-Jan-26")
 */
function formatDate(value) {
  if (!value) return '';
  
  try {
    let date;
    
    // If it's already a Date object
    if (value instanceof Date) {
      date = value;
    }
    // If it's a number (Excel serial date)
    else if (typeof value === 'number') {
      // Excel stores dates as serial numbers (days since 1900-01-01)
      date = new Date((value - 25569) * 86400 * 1000);
    }
    // If it's a string, try to parse it
    else if (typeof value === 'string') {
      value = value.trim();
      if (value === '') return '';
      
      // Already in DD-MMM-YY format
      if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(value)) {
        return value;
      }
      
      // Try ISO format
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        date = new Date(value);
      }
      // Try MM/DD/YYYY or D/M/YYYY
      else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
        date = new Date(value);
      }
      // Try other common formats
      else {
        date = new Date(value);
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = String(date.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    }
  } catch (e) {
    // If parsing fails, return original value
  }
  
  return value ? String(value) : '';
}

/**
 * Parse Excel file and extract all data from A1 onwards
 * Maps directly by position: A1→Col1, B1→Col2, etc.
 * @param {File} file - Excel file
 * @returns {Promise<Object>} - { rows: array of rows with values }
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Get all data range
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        
        // Extract all rows starting from row 1 (index 0)
        for (let row = 0; row <= range.e.r; row++) {
          const rowData = [];
          let hasData = false;
          
          // Extract all columns from A onwards
          for (let col = 0; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellRef];
            
            // Get cell value
            let cellValue = cell?.v || '';
            
            if (cellValue !== '' && cellValue !== null && cellValue !== undefined) {
              // Format as date ONLY if it's in a date field (row 6 or columns B-E)
              if (isDateField(row, col)) {
                cellValue = formatDate(cellValue);
              } else {
                cellValue = cellValue.toString().trim();
              }
              hasData = true;
            } else {
              cellValue = '';
            }
            
            rowData.push(cellValue);
          }
          
          // Add row if it has any data
          if (hasData) {
            rows.push(rowData);
          }
        }
        
        resolve({
          rows,
          totalColumns: rows.length > 0 ? rows[0].length : 0,
          totalRows: rows.length
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Import parsed Excel data to database
 * Updates existing rows or inserts if rows don't exist
 * Direct column-to-column mapping (A→ColA, B→ColB, etc.)
 * @param {Object} importData - { rows: array }
 * @param {String} region - Selected region (EE, NA, etc.)
 * @param {Number} startRow - Starting row number (1-based, default 1)
 * @returns {Promise<Object>} - { success, message, rowsUpdated, rowsInserted }
 */
export async function importDataToDatabase(importData, region, startRow = 1) {
  try {
    const response = await fetch('/api/import-excel-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Region': region
      },
      body: JSON.stringify({
        rows: importData.rows,
        region: region,
        startRow: startRow
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Import failed');
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to import data: ${error.message}`);
  }
}
