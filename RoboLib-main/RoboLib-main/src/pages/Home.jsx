import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import Toolbar from '../components/Toolbar';
import './Home.css';
import Table from "../components/table.jsx";
import RobotBarChart from "../components/RobotBarChart";
import UserDetailsCard from "../components/UserDetailsCard";
import UserAccessDialog from '../components/UserAccessDialog';
import DropdownManagementDialog from '../components/DropdownManagementDialog';
import UserProfileFloat from '../components/UserProfileFloat';
import SummaryTable from '../components/SummaryTable';
import SummaryTable2 from '../components/SummaryTable2';
import SummaryTable3 from '../components/SummaryTable3';
import SummaryTable4 from '../components/SummaryTable4';
import ExcelJS from 'exceljs';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';
import { parseExcelFile, importDataToDatabase } from '../utils/excelImporter';




const Home = () => {
  const initialRows = 25;
  const initialCols = 52;
  const [showSummaryView, setShowSummaryView] = useState(false);
  const [activeSummaryTab, setActiveSummaryTab] = useState(1); 
  const [isSmartView, setIsSmartView] = useState(false);
  const chartRef = useRef(null);
  const tableRef = useRef(null);
  const searchPanelRef = useRef(null);
  const contentContainerRef = useRef(null);
  const summaryTable1Ref = useRef(null);
  const summaryTable2Ref = useRef(null);
  const summaryTable3Ref = useRef(null);
  const summaryTable4Ref = useRef(null);
  const [tableContainerLeft, setTableContainerLeft] = useState(0);

  // Column widths for A-H (matching table.jsx FROZEN_COL_WIDTHS)
  const COLUMN_WIDTHS_A_TO_H = [120, 80, 70, 110, 65, 70, 70, 70];
  const ROW_HEADER_WIDTH = 49;
  const chartWidth = COLUMN_WIDTHS_A_TO_H.reduce((sum, w) => sum + w, 0) + ROW_HEADER_WIDTH + 1;

  // Calculate column widths based on chartWidth when smart view is enabled
  const getColumnWidths = () => {
    if (showSummaryView) {
      // Distribute chartWidth evenly across columns A-H
      const numCols = COLUMN_WIDTHS_A_TO_H.length;
      const evenWidth = Math.floor((chartWidth - ROW_HEADER_WIDTH) / numCols);
      return Array(numCols).fill(evenWidth);
    }
    return COLUMN_WIDTHS_A_TO_H;
  };
  const columnWidths = getColumnWidths();
  // Height for rows 1-12: header(28px) + 12 rows(32px each) = 412px
  const chartHeight = 30 + (11 * 32.2);
  // User access management state
  const [users, setUsers] = useState([]);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isDropdownManagementDialogOpen, setIsDropdownManagementDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userRegion, setUserRegion] = useState(localStorage.getItem('selectedRegion') || 'EE');
  // Initialize selectedRegion: if user selected 'Global' in login, default to 'EE' (Enlarged Europe)
  const [selectedRegion, setSelectedRegion] = useState(() => {
    const stored = localStorage.getItem('selectedRegion');
    return stored && stored.toLowerCase() !== 'global' ? stored : 'EE';
  });
  const [displayName, setDisplayName] = useState(null);

  // Fetch current user's role, region, and display name on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const employeeId = localStorage.getItem('employeeId');
        if (!employeeId) return;

        // Fetch authorization data (role and region)
        const authResponse = await fetch(`/api/check-authorized/${employeeId}`);
        const authResult = await authResponse.json();

        if (authResult.success && authResult.user) {
          setUserRole(authResult.user.role);
          setUserRegion(authResult.user.region);
        }

        // Fetch user details from Azure Graph (displayName)
        const userResponse = await fetch(`/api/user-by-employee-id/${employeeId}`);
        const userResult = await userResponse.json();

        if (userResult.success && userResult.data) {
          setDisplayName(userResult.data.displayName);
        }
      } catch (error) {
        // User data fetch error - silent fail
      }
    };

    fetchUserData();
  }, []);

  const createEmptyTable = (rows, cols) => {
    return Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(''));
  };

  const [tableData, setTableDataState] = useState(createEmptyTable(initialRows, initialCols));
  const [history, setHistory] = useState([createEmptyTable(initialRows, initialCols)]);
  const [historyStep, setHistoryStep] = useState(0);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedCols, setSelectedCols] = useState(new Set());
  const [isFilterActive, setIsFilterActive] = useState(false); // Track when graph bar filter is active
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const tableDataRef = useRef(createEmptyTable(initialRows, initialCols)); // Track latest tableData SYNCHRONOUSLY
  const [lastSavedData, setLastSavedData] = useState(createEmptyTable(initialRows, initialCols));
  const hasChangesRef = useRef(false); // Track if there are unsaved changes without heavy comparisons

  // CRITICAL: Update both ref AND state together to fix async closure issue
  // The ref is updated SYNCHRONOUSLY so auto-save timer always gets latest data
  const updateTableData = useCallback((newData) => {
    tableDataRef.current = newData; // Sync update - immediate
    setTableDataState(newData);     // Async update - batched by React
  }, []);

  // Add to history for undo/redo
  const addToHistory = useCallback((newData) => {
    setHistory(prevHistory => {
      const newHistory = prevHistory.slice(0, historyStep + 1);
      newHistory.push(newData);
      return newHistory;
    });
    setHistoryStep(prevStep => prevStep + 1);
    updateTableData(newData);
  }, [updateTableData, historyStep]);

  // Handle cell change with debouncing for Excel-like undo/redo
  const handleCellChange = (rowIndex, colIndex, value) => {
    
    // Mark that there are changes (non-blocking)
    hasChangesRef.current = true;
    
    // Use ref for base data to handle rapid successive edits correctly
    const currentData = tableDataRef.current;
    let newData = currentData.map((row, rIdx) =>
      rIdx === rowIndex
        ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
        : row
    );

    // Auto-calculate 93% for row 8 (index 7) if editing row 7 (index 6) after column I (index 9)
    if (rowIndex === 6 && colIndex >= 9) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue !== '') {
        const calculatedValue = Math.floor(numValue * 0.93).toString();
        newData = newData.map((row, rIdx) =>
          rIdx === 7
            ? row.map((cell, cIdx) => (cIdx === colIndex ? calculatedValue : cell))
            : row
        );
      }
    }

    // UPDATE BOTH REF AND STATE IMMEDIATELY for instant visual feedback
    // User must see what they type in real-time in the input field
    tableDataRef.current = newData;
    startTransition(() => {
      setTableDataState(newData);
    });

    // Debounce history save - clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to save to history after 250ms of no changes
    debounceTimerRef.current = setTimeout(() => {
      addToHistory(newData);
      debounceTimerRef.current = null;
    }, 250);
  };

  // Force save pending changes to history (called on cell blur)
  const handleCellBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      // CRITICAL: Use ref, not state - state is async and may be stale!
      addToHistory(tableDataRef.current);
    }
  };

  // Add new row
  const handleAddRow = () => {
    const newData = [...tableData, Array(tableData[0].length).fill('')];
    addToHistory(newData);
    
    // Scroll to the newly added row
    if (tableRef.current) {
      setTimeout(() => {
        tableRef.current.scrollToNewRow();
      }, 0);
    }
  };

  // Add new column (with database sync)
  const handleAddColumn = async () => {
    try {
      const newColumnIndex = tableData[0].length; // Index of the new column
      
      const url = addRegionParam(API_ENDPOINTS.ADD_COLUMN, selectedRegion);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnIndex: newColumnIndex, region: selectedRegion })
      });

      const result = await response.json();


      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        // Add empty column to all rows
        const newData = tableData.map((row) => [...row, '']);
        addToHistory(newData);
        
        // Scroll to the newly added column
        if (tableRef.current) {
          setTimeout(() => {
            tableRef.current.scrollToNewColumn();
          }, 0);
        }
      } else {
        alert('Failed to add column: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error adding column: ' + error.message);
    }
  };

  // Insert row at specific position
  const handleInsertRow = (rowIndex, position, shouldScroll = true) => {
    const insertAt = position === 'below' ? rowIndex + 1 : rowIndex;
    const newData = [
      ...tableData.slice(0, insertAt),
      Array(tableData[0].length).fill(''),
      ...tableData.slice(insertAt)
    ];
    addToHistory(newData);
    
    // Scroll to inserted row only if shouldScroll is true
    if (shouldScroll && tableRef.current) {
      setTimeout(() => {
        tableRef.current.scrollToNewRow();
      }, 0);
    }
  };

  // Insert column at specific position
  const handleInsertCol = (colIndex, position, shouldScroll = true) => {
    const insertAt = position === 'right' ? colIndex + 1 : colIndex;
    const newData = tableData.map(row => [
      ...row.slice(0, insertAt),
      '',
      ...row.slice(insertAt)
    ]);
    addToHistory(newData);
    
    // Scroll to inserted column only if shouldScroll is true
    if (shouldScroll && tableRef.current) {
      setTimeout(() => {
        tableRef.current.scrollToNewColumn();
      }, 0);
    }
  };

  // Delete row
  const handleDeleteRow = () => {
    if (selectedRows.size === 0) {
      alert('Please select a row to delete');
      return;
    }
    if (tableData.length - selectedRows.size < 33) {
      alert('There must be at least 33 rows minimum, so cannot delete it');
      return;
    }
    const newData = tableData.filter((_, idx) => !selectedRows.has(idx));
    setSelectedRows(new Set());
    addToHistory(newData);
  };

  // Delete column (with database sync)
  const handleDeleteColumn = async () => {
    if (selectedCols.size === 0) {
      alert('Please select a column to clear');
      return;
    }

    try {
      // Clear selected columns (set all values to empty strings)
      const newData = tableData.map((row) =>
        row.map((cell, idx) => selectedCols.has(idx) ? '' : cell)
      );
      
      const columnIndicesArray = Array.from(selectedCols);

      const url = addRegionParam(API_ENDPOINTS.DELETE_COLUMN, selectedRegion);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnIndices: columnIndicesArray, region: selectedRegion, action: 'clear' })
      });

      const result = await response.json();


      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        setSelectedCols(new Set());
        addToHistory(newData);
      } else {
        alert('Failed to clear columns: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error clearing columns: ' + error.message);
    }
  };

  // Undo
  const handleUndo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      updateTableData(history[newStep]);
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      updateTableData(history[newStep]);
    }
  };

  // Handle Smart View toggle
  const handleSmartViewToggle = () => {
    setIsSmartView(prev => !prev);
    if (tableRef.current?.toggleSmartView) {
      tableRef.current.toggleSmartView();
    }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z for undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history]);

  // Helper function to parse cell values (copy from table.jsx)
  const parseCellValue = (cellValue) => {
    if (!cellValue) return { displayValue: '', mode: null };
    
    const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
    const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);
    
    if (greenMatch) return { displayValue: greenMatch[1].trim(), mode: 'single' };
    if (orangeMatch) return { displayValue: orangeMatch[1].trim(), mode: 'double' };
    
    return { displayValue: cellValue, mode: null };
  };

  // Helper function to prepare complete export data with headers and calculated values
  const prepareExportData = (tableData) => {
    const ROW_13_HEADERS = {
      0: 'Forecast Plant - Project',
      1: 'Decision Date',
      2: 'Order Date',
      3: 'Onsite\nDelivery date',
      4: 'X0 Date',
      5: 'Total Robots',
      6: 'Reused Robots',
      7: 'New Robots',
      8: 'Reuse Assumptions'
    };

    const COL_I_HEADERS = {
      0: 'Stock Plant - Project',
      1: 'Robot Standard',
      2: 'Standard Controller',
      3: 'Standard Family',
      4: 'Comment',
      5: 'Run Out Date',
      6: 'Amount Of Robots Avaliable',
      7: 'Stock Avaliable (After 7% Spare)',
      8: 'Spare parts & Specific Need',
      9: 'Scraps',
      10: 'Onsite Production',
      11: 'Total (Avaliable Robots)'
    };

    // Create a deep copy of tableData
    const exportData = tableData.map(row => [...row]);

    // Fill in ROW_13_HEADERS in row 12 (index 12), columns 0-8
    for (let col = 0; col < 9; col++) {
      exportData[12][col] = ROW_13_HEADERS[col] || '';
    }

    // Fill in COL_I_HEADERS in column 8 (index 8), rows 0-11
    for (let row = 0; row < 12; row++) {
      if (row < 12) {
        exportData[row][8] = COL_I_HEADERS[row] || '';
      }
    }

    // Calculate row 12 values (index 11) for columns 9+ (sum calculation)
    // Formula: row8 - row9 - row10 + row11 - sum(rows 14+)
    const FROZEN_COLS = 9;
    const numCols = exportData[0].length;
    
    for (let colIndex = FROZEN_COLS; colIndex < numCols; colIndex++) {
      const row8Value = parseFloat(exportData[7]?.[colIndex]) || 0;
      const row9Value = parseFloat(exportData[8]?.[colIndex]) || 0;
      const row10Value = parseFloat(exportData[9]?.[colIndex]) || 0;
      const row11Value = parseFloat(exportData[10]?.[colIndex]) || 0;
      
      let sumOfRows14Plus = 0;
      for (let rowIndex = 13; rowIndex < exportData.length; rowIndex++) {
        const rawValue = exportData[rowIndex]?.[colIndex];
        const parsed = parseCellValue(rawValue);
        sumOfRows14Plus += parseFloat(parsed.displayValue) || 0;
      }
      
      if (row8Value === 0 && row9Value === 0 && row10Value === 0 && row11Value === 0 && sumOfRows14Plus === 0) {
        exportData[11][colIndex] = '';
      } else {
        let calculatedValue = row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus;
        // Convert negative values to 0
        if (calculatedValue < 0) {
          calculatedValue = 0;
        }
        exportData[11][colIndex] = calculatedValue.toString();
      }
    }

    // Calculate column G values (index 6) for rows 13+ (sum of allocations)
    // Formula: Sum all values from column J (index 9) onwards
    for (let rowIndex = 13; rowIndex < exportData.length; rowIndex++) {
      let sum = 0;
      for (let colIndex = 9; colIndex < exportData[rowIndex].length; colIndex++) {
        const cellValue = exportData[rowIndex]?.[colIndex];
        const parsed = parseCellValue(cellValue);
        const numValue = parseFloat(parsed.displayValue);
        if (!isNaN(numValue)) {
          sum += numValue;
        }
      }
      exportData[rowIndex][6] = sum > 0 ? sum.toString() : '';
    }

    // Calculate column H values (index 7) for rows 13+ (remaining robots)
    // Formula: col5 (Total Robots) - col6 (Reused Robots)
    for (let rowIndex = 13; rowIndex < exportData.length; rowIndex++) {
      const colFValue = parseFloat(exportData[rowIndex]?.[5]);
      const colGValue = parseFloat(exportData[rowIndex]?.[6]);
      exportData[rowIndex][7] = (isNaN(colFValue) || isNaN(colGValue)) ? '' : (colFValue - colGValue).toString();
    }

    // Strip "(green)" and "(orange)" text from all cells - keep only numbers/values
    for (let row = 0; row < exportData.length; row++) {
      for (let col = 0; col < exportData[row].length; col++) {
        const cellValue = exportData[row][col];
        if (typeof cellValue === 'string') {
          // Remove color indicators, keeping only the numeric value
          exportData[row][col] = cellValue.replace(/\s*\((green|orange)\)$/i, '').trim();
        }
      }
    }

    return exportData;
  };

  // Handle export to XLSX with colors using ExcelJS for proper styling
  const handleExport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Use tableDataRef instead of tableData for latest data (ref is updated synchronously)
      let currentTableData = tableDataRef.current;
      
      // Prepare export data with headers and calculated values
      currentTableData = prepareExportData(currentTableData);

      // ===== SHEET 1: Main Robot Data =====
      const worksheet = workbook.addWorksheet('Main_table');
      
      // Get actual cell colors from the rendered DOM (for cells with CSS-based colors)
      const getCellColorFromDOM = (rowIndex, colIndex) => {
        try {
          // Calculate section: frozen or scrollable
          const isFrozen = colIndex < 9;
          const section = isFrozen ? '.frozen-section' : '.scrollable-section';
          const sectionEl = document.querySelector(section);
          
          if (!sectionEl) return null;
          
          // For scrollable section, adjust column index
          const actualColIndex = isFrozen ? colIndex : colIndex - 9;
          
          // Get the cell from the table
          const table = sectionEl.querySelector('table tbody');
          if (!table) return null;
          
          const rows = table.querySelectorAll('tr');
          if (!rows[rowIndex]) return null;
          
          const cells = rows[rowIndex].querySelectorAll('td');
          if (!cells[actualColIndex]) return null;
          
          // Get background color from cell or its input element
          const cellEl = cells[actualColIndex];
          const cellInput = cellEl.querySelector('.cell-input, .date-cell-wrapper');
          
          if (cellInput) {
            const bgColor = window.getComputedStyle(cellInput).backgroundColor;
            // Convert RGB to hex
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
              const match = bgColor.match(/\d+/g);
              if (match && match.length >= 3) {
                const hex = [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])]
                  .map(x => x.toString(16).padStart(2, '0').toUpperCase())
                  .join('');
                return hex;
              }
            }
          }
        } catch (e) {
          // Silently fail - will use default color
        }
        return null;
      };
      
      // Add data and apply styles
      for (let row = 0; row < currentTableData.length; row++) {
        const excelRow = worksheet.getRow(row + 1);
        
        for (let col = 0; col < currentTableData[row].length; col++) {
          const cell = excelRow.getCell(col + 1);
          
          let cellValue = currentTableData[row][col] || '';
          let fillColor = 'FFFFFF'; // default white
          let fontBold = false;

          // First, try to get color from DOM (actual rendered color)
          const domColor = getCellColorFromDOM(row, col);
          if (domColor) {
            fillColor = domColor;
          } else {
            // Fallback: Check for color indicators in cell value
            const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/i);
            const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/i);
            
            if (greenMatch) {
              cellValue = greenMatch[1].trim();
              fillColor = 'a2e19c'; // Green
            } else if (orangeMatch) {
              cellValue = orangeMatch[1].trim();
              fillColor = 'f9d5b6'; // Orange
            }
  
            // Apply colors based on row and column conditions (only if no color indicator)
            else if (row === 12) {
              fillColor = '8ABCFE';
              fontBold = true;
            } 
            // Column I (index 8), rows 0-11 - stock headers with specific colors
            else if (col === 8 && row >= 0 && row < 12) {
              fontBold = true;
              // Apply specific colors based on row position (matching frontend)
              switch (row) {
                case 0: // Stock Plant - Project
                case 1: // Robot Standard
                case 2: // Standard Controller
                case 3: // Standard Family
                  fillColor = 'D3D3D3'; // Gray
                  break;
                case 4: // Comment
                case 5: // Run Out Date
                  fillColor = 'FFFF99'; // Yellow
                  break;
                case 6: // Amount Of Robots Available
                  fillColor = '87CEEB'; // Cyan/Light Blue
                  break;
                case 7: // Stock Available (After 7% Spare)
                  fillColor = '90EE90'; // Light Green
                  break;
                case 8: // Spare parts & Specific Need
                  fillColor = 'F0F0F0'; // Light Gray
                  break;
                case 9: // Scraps
                  fillColor = 'FF6B6B'; // Red
                  break;
                case 10: // Onsite Production
                  fillColor = 'FFB366'; // Orange
                  break;
                case 11: // Total (Available Robots)
                  fillColor = '90EE90'; // Light Green
                  break;
                default:
                  fillColor = 'B4C7E7'; // Default light blue
              }
            }
          }
          
          cell.value = cellValue;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + fillColor }
          };
          cell.font = { bold: fontBold };
          cell.border = {
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } }
          };
          cell.alignment = { horizontal: 'left', vertical: 'center' };
        }
      }

      // Auto-fit column widths based on content with improved calculation
      const colWidthMap = {};
      for (let col = 0; col < currentTableData[0].length; col++) {
        let maxWidth = 6; // Minimum width
        for (let row = 0; row < currentTableData.length; row++) {
          const cellValue = currentTableData[row][col]?.toString() || '';
          // Conservative width calculation: use simpler approach
          // Average character width is ~0.7 units, with padding
          const cellWidth = Math.ceil(cellValue.length * 0.9);
          maxWidth = Math.max(maxWidth, cellWidth);
        }
        // Add minimal padding and cap at 35 (much more reasonable)
        colWidthMap[col] = Math.min(maxWidth + 1, 35);
      }

      // Apply calculated widths to worksheet
      for (let i = 0; i < currentTableData[0].length; i++) {
        worksheet.getColumn(i + 1).width = colWidthMap[i];
      }

      // Helper function to auto-fit column widths for summary tables
      const autoFitSummaryColumns = (sheet, headers, rows) => {
        const colWidths = {};
        
        // Calculate from headers with conservative approach
        headers.forEach((header, index) => {
          colWidths[index] = Math.ceil(header.length * 0.9) + 1;
        });
        
        // Calculate from row data, keeping the maximum
        rows.forEach(row => {
          row.forEach((cell, index) => {
            const cellWidth = Math.ceil(cell.toString().length * 0.9) + 1;
            colWidths[index] = Math.max(colWidths[index] || 0, cellWidth);
          });
        });
        
        // Apply widths with a reasonable maximum cap of 35
        Object.entries(colWidths).forEach(([index, width]) => {
          sheet.getColumn(parseInt(index) + 1).width = Math.min(width, 35);
        });
      };

      // Helper function to add a summary sheet from API data
      const addSummarySheet = async (endpoint, sheetName, columnsMap) => {
        try {
          const url = addRegionParam(endpoint);
          const response = await fetch(url);
          
          if (!response.ok) {
            return;
          }
          
          const result = await response.json();
          if (!result.success || !result.data) {
            return;
          }
          
          const summarySheet = workbook.addWorksheet(sheetName);
          
          // Build headers from columnsMap
          const headers = Object.keys(columnsMap);
          summarySheet.addRow(headers);
          
          // Add data rows
          const rowsData = [];
          result.data.forEach(row => {
            const rowData = headers.map(header => {
              const value = row[columnsMap[header]] || '';
              return value.toString();
            });
            summarySheet.addRow(rowData);
            rowsData.push(rowData);
          });
          
          if (headers.length > 0 && rowsData.length > 0) {
            autoFitSummaryColumns(summarySheet, headers, rowsData);
          }
        } catch (error) {
          // Error adding sheet to workbook
        }
      };

      // ===== SHEET 2: Stock Table (Summary Table 1) =====
      await addSummarySheet(
        API_ENDPOINTS.GET_SUMMARY,
        'Stock Table',
        {
          'Stock Plant & Project': 'stockPlantProject',
          'Robot Standard': 'robotStandard',
          'Standard Controller': 'standardController',
          'Standard Family': 'standardFamily',
          'Run Out Date': 'runOutDate',
          'Amount of Robots Available': 'amountOfRobotsAvailable',
          'Spare Parts & Specific Need': 'sparePartsSpecificNeed',
          'Scraps': 'scraps',
          'Onsite Production': 'onsiteProduction',
          'Total Available Robots': 'totalAvailableRobots'
        }
      );

      // ===== SHEET 3: Requirement Table (Summary Table 2) =====
      await addSummarySheet(
        API_ENDPOINTS.GET_SUMMARY2,
        'Requirement Table',
        {
          'Forecast Plant & Project': 'forecastPlantProject',
          'Decision Date': 'decisionDate',
          'Order Date': 'orderDate',
          'Onsite Delivery Date': 'onsiteDeliveryDate',
          'X0 Date': 'x0Date',
          'Total Robots': 'totalRobots',
          'Reused Robots': 'reusedRobots',
          'New Robots': 'newRobots'
        }
      );

      // ===== SHEET 4: Quick Summary (Summary Table 3) =====
      await addSummarySheet(
        API_ENDPOINTS.GET_SUMMARY3,
        'Quick Summary',
        {
          'Forecast Plant & Project': 'forecastPlantProject',
          'Total Robots': 'totalRobots',
          'Reused Robots': 'reusedRobots',
          'New Robots': 'newRobots'
        }
      );

      // ===== SHEET 5: Yearly Summary (Summary Table 4) =====
      await addSummarySheet(
        API_ENDPOINTS.GET_SUMMARY4,
        'Yearly Summary',
        {
          'Year': 'year',
          'Available Stock': 'availableStock',
          'Pool New Entry': 'poolNewEntry',
          'Expected Robots': 'expectedRobots',
          'Robots in Use': 'robotsInUse',
          'Scraps': 'scraps',
          'Free Robots': 'freeRobots'
        }
      );

      // Write and download the file (browser-compatible)
      const fileName = `Robot_Lib_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting file: ' + error.message);
    }
  };

  // Load data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const url = addRegionParam(API_ENDPOINTS.LOAD_TABLE, selectedRegion);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();

        
        if (result.success && result.data && result.data.length > 0) {
          // Update both ref and state for loaded data
          tableDataRef.current = result.data;
          setTableDataState(result.data);
          setHistory([result.data]);
          setHistoryStep(0);
          setLastSavedData(result.data); // Mark as saved so auto-save doesn't trigger immediately
        } else {
          // No data in database, using default empty table
        }
      } catch (error) {
        // Silently fail - user can still edit the default empty table
      }
    };

    // Load authorized users from server on mount
    const loadAuthorizedUsers = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.GET_AUTHORIZED_USERS);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setUsers(result.data);
        } else {
          // No authorized users on server - check if current user is logged in
          const employeeId = localStorage.getItem('employeeId');
          if (employeeId) {
            // First user to log in becomes admin
            
            // Fetch user details from Azure to get display name
            const userResponse = await fetch(`/api/user-by-employee-id/${employeeId}`);
            const userData = await userResponse.json();
            
            if (userData.success && userData.data) {
              const firstAdmin = {
                employeeId: employeeId,
                displayName: userData.data.displayName,
                role: 'admin',
                region: 'global'
              };
              
              setUsers([firstAdmin]);
              
              // Sync first admin to server
              try {
                await fetch(API_ENDPOINTS.SYNC_AUTHORIZED_USERS, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ users: [firstAdmin] })
                });
              } catch (syncError) {
                // Sync error - continue
              }
            }
          } else {
            // No authorized users and no current user logged in
          }
        }
      } catch (error) {
        // Error loading authorized users - continue with defaults
      }
    };
    
    // Call load on mount only
    loadData();
    loadAuthorizedUsers();
  }, []);

  // Calculate table container's left position dynamically for chart alignment
  useEffect(() => {
    const calculateTablePosition = () => {
      const excelContainer = document.querySelector('.excel-table-container');
      const parentContainer = contentContainerRef.current;
      
      if (excelContainer && parentContainer) {
        const tableRect = excelContainer.getBoundingClientRect();
        const parentRect = parentContainer.getBoundingClientRect();
        
        // Calculate left position relative to parent container
        const relativeLeft = tableRect.left - parentRect.left;
        setTableContainerLeft(relativeLeft);
      }
    };

    // Calculate on mount and after short delay to ensure DOM is ready
    setTimeout(() => {
      calculateTablePosition();
    }, 100);

    // Recalculate on window resize to handle responsive changes
    window.addEventListener('resize', calculateTablePosition);

    return () => {
      window.removeEventListener('resize', calculateTablePosition);
    };
  }, []);

  // Sync authorized users with server whenever users change (with debounce)
  useEffect(() => {
    // Skip sync on initial mount to avoid unnecessary call
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const syncUsers = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.SYNC_AUTHORIZED_USERS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users })
        });

        const result = await response.json();
        
        if (!result.success) {
          // Sync failed - continue
        }
      } catch (error) {
        // Error syncing users - continue
      }
    };

    // Debounce sync - wait 500ms after last change
    const timer = setTimeout(() => {
      syncUsers();
    }, 500);

    return () => clearTimeout(timer);
  }, [users]);

  // Save data to backend
  const handleSave = async () => {
    try {
      // If summary view is open and SummaryTable4 is active, save it
      if (showSummaryView && activeSummaryTab === 4) {
        if (summaryTable4Ref.current && summaryTable4Ref.current.save) {
          const success = await summaryTable4Ref.current.save();
          if (success) {
            alert('Saved successfully');
          } else {
            console.error('Failed to save Summary Table 4');
          }
        }
        return;
      }

      // Otherwise, save main table data
      // Use ref instead of state to avoid async setState closure issue
      const currentTableData = tableDataRef.current;
      
      if (!currentTableData || currentTableData.length === 0) {
        alert(' No data to save');
        return;
      }

      // Use startTransition to defer UI updates during save, preventing chart flicker
      startTransition(() => {
        setIsSaving(true);
      });
      const url = addRegionParam(API_ENDPOINTS.SAVE_TABLE, selectedRegion);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableData: currentTableData, region: selectedRegion })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        alert('Saved successfully');
        startTransition(() => {
          setLastSavedData(currentTableData);
        });
      }
    } catch (error) {
      // Save error - continue
    } finally {
      startTransition(() => {
        setIsSaving(false);
      });
    }
  };

  // Handle search results
  const handleSearchResult = (result) => {
    if (result.found) {
      if (result.type === 'row') {
        setSelectedRows(new Set([result.index]));
        setSelectedCols(new Set());
      } else if (result.type === 'column') {
        setSelectedCols(new Set([result.index]));
        setSelectedRows(new Set());
      }
    } else {
      setSelectedRows(new Set());
      setSelectedCols(new Set());
    }
  };

  // User Access Management Handlers
  const handleOpenAccessDialog = () => {
    setIsAccessDialogOpen(true);
  };

  const handleCloseAccessDialog = () => {
    setIsAccessDialogOpen(false);
    // Refresh robot standards in the table component when dialog closes
    if (tableRef.current?.refreshRobotStandards) {
      tableRef.current.refreshRobotStandards();
    }
  };

  const handleOpenDropdownManagementDialog = () => {
    setIsDropdownManagementDialogOpen(true);
  };

  const handleCloseDropdownManagementDialog = () => {
    setIsDropdownManagementDialogOpen(false);
  };

  const handleOpenSummary = () => {
    setShowSummaryView(true);
  };

  const handleCloseSummary = () => {
    setShowSummaryView(false);
  };

  const handleAddUser = (newUser) => {
    // Check if user already exists
    const userExists = users.some(u => u.employeeId === newUser.employeeId);
    if (!userExists) {
      setUsers([...users, newUser]);
      alert(`User ${newUser.employeeId} added successfully with role: ${newUser.role} and region: ${newUser.region}`);
    } else {
      alert(`User ${newUser.employeeId} already exists`);
    }
  };

  const handleRemoveUser = (employeeId) => {
    // Don't allow removing the default admin user
    if (employeeId === 'TA29732') {
      alert('Cannot remove the default admin user');
      return;
    }
    setUsers(users.filter(u => u.employeeId !== employeeId));
  };

  const handleUpdateUser = (employeeId, newRole, newRegion) => {
    setUsers(users.map(u =>
      u.employeeId === employeeId
        ? { ...u, role: newRole, region: newRegion }
        : u
    ));
    alert(`User ${employeeId} updated successfully`);
  };

  // Insert row before (top)
  const handleInsertRowTop = (rowIndex) => {
    if (rowIndex === undefined || rowIndex === null) {
      alert('Please select a row first');
      return;
    }
    const newData = [...tableData];
    newData.splice(rowIndex, 0, Array(tableData[0].length).fill(''));
    addToHistory(newData);
  };

  // Handle Excel import
  const handleImportExcel = async (file) => {
    try {
      if (!file) {
        alert('Please select a file');
        return;
      }

      // Parse Excel file
      console.log('Parsing Excel file...');
      const importData = await parseExcelFile(file);
      console.log(`Parsed ${importData.totalRows} rows, ${importData.totalColumns} columns`);

      // Ask user which row to start importing from
      const startRowInput = prompt(
        `Import ${importData.totalRows} rows to ${selectedRegion} region.\n\nEnter starting row number (1-based):\nExample: 1 will update from row 1`,
        '1'
      );

      if (startRowInput === null) {
        return; // User cancelled
      }

      const startRow = parseInt(startRowInput, 10);
      if (isNaN(startRow) || startRow < 1) {
        alert('❌ Invalid row number. Please enter a number >= 1');
        return;
      }

      // Confirm import
      const confirmImport = window.confirm(
        `Import ${importData.totalRows} rows starting from row ${startRow}?\n\nThis will update/insert rows in the ${selectedRegion} region table.`
      );

      if (!confirmImport) {
        return;
      }

      // Import data to database
      console.log(`Importing data starting from row ${startRow}...`);
      const result = await importDataToDatabase(importData, selectedRegion, startRow);

      if (result.success) {
        const imported = result.rowsImported || 0;
        alert(`✅ Import successful!\nRows imported and replaced: ${imported}`);
        
        // Reload table data from server
        try {
          const url = addRegionParam(API_ENDPOINTS.LOAD_TABLE, selectedRegion);
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const reloadResult = await response.json();
            if (reloadResult.success && reloadResult.data) {
              tableDataRef.current = reloadResult.data;
              setTableDataState(reloadResult.data);
              setHistory([reloadResult.data]);
              setHistoryStep(0);
            }
          }
        } catch (reloadError) {
          console.error('Failed to reload data:', reloadError);
          alert('Data imported but failed to reload table. Please refresh the page.');
        }
      } else {
        alert(`❌ Import failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(`❌ Error importing Excel: ${error.message}`);
    }
  };

  // Trigger file input for Excel import
  const triggerExcelImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImportExcel(file);
      }
    };
    input.click();
  };

  // Insert row after (bottom)
  const handleInsertRowBottom = (rowIndex) => {
    if (rowIndex === undefined || rowIndex === null) {
      alert('Please select a row first');
      return;
    }
    const newData = [...tableData];
    newData.splice(rowIndex + 1, 0, Array(tableData[0].length).fill(''));
    addToHistory(newData);
  };

  // Insert column before (left)
  const handleInsertColumnLeft = (colIndex) => {
    if (colIndex === undefined || colIndex === null) {
      alert('Please select a column first');
      return;
    }
    const newData = tableData.map((row) => {
      const newRow = [...row];
      newRow.splice(colIndex, 0, '');
      return newRow;
    });
    addToHistory(newData);
  };

  // Insert column after (right)
  const handleInsertColumnRight = (colIndex) => {
    if (colIndex === undefined || colIndex === null) {
      alert('Please select a column first');
      return;
    }
    const newData = tableData.map((row) => {
      const newRow = [...row];
      newRow.splice(colIndex + 1, 0, '');
      return newRow;
    });
    addToHistory(newData);
  };

  // Clear cell content
  const handleClearCell = (rowIndex, colIndex) => {
    if (rowIndex === undefined || rowIndex === null || colIndex === undefined || colIndex === null) {
      alert('Please select a cell first');
      return;
    }
    const newData = tableData.map((row, rIdx) =>
      rIdx === rowIndex
        ? row.map((cell, cIdx) => (cIdx === colIndex ? '' : cell))
        : row
    );
    addToHistory(newData);
  };

  // Extract chart-relevant data and memoize it to prevent unnecessary chart re-renders
  // Note: We now rely on RobotBarChart's memo comparison to prevent re-renders
  // when non-chart-relevant rows change

  // Auto-save every 1 minute in background (Excel-like behavior)
  // No re-renders on keystroke - only saves if changes exist
  useEffect(() => {
    // Set up 1-minute interval for periodic save
    const autoSaveInterval = setInterval(() => {
      // Only save if there are actual changes
      if (!hasChangesRef.current) return;

      hasChangesRef.current = false;
      setIsSaving(true);

      // Use requestIdleCallback to save in background without blocking UI
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          handleSave();
          setIsSaving(false);
        });
      } else {
        // Fallback for older browsers
        handleSave();
        setIsSaving(false);
      }
    }, 60000); // 1 minute interval (Excel-like)

    return () => clearInterval(autoSaveInterval);
  }, []); // Empty dependency - runs once on mount, interval handles timing

  return (
    <div className="home-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      <UserProfileFloat 
        userName={displayName} 
        role={userRole} 
        region={selectedRegion} 
      />
      <Toolbar 
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddRow={handleAddRow}
        onAddColumn={handleAddColumn}
        onDeleteRow={handleDeleteRow}
        onDeleteColumn={handleDeleteColumn}
        onExport={handleExport}
        onSave={handleSave}
        onAccessClick={handleOpenAccessDialog}
        onDropdownManagementClick={handleOpenDropdownManagementDialog}
        onSearchToggle={() => searchPanelRef.current?.toggle()}
        onViewSummary={handleOpenSummary}
        onCloseSummary={handleCloseSummary}
        onSmartViewToggle={handleSmartViewToggle}
        onImport={triggerExcelImport}
        canUndo={historyStep > 0}
        canRedo={historyStep < history.length - 1}
        isSaving={isSaving}
        isSmartViewEnabled={isSmartView}
        tableData={tableData}
      />
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }} ref={contentContainerRef}>
        {showSummaryView ? (
          <div style={{ padding: '20px' }}>
            
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
             
              
              {/* Toggle tabs for Summary views */}
              <div style={{ display: 'flex', gap: '5px', marginLeft: '5%', marginTop: '3%' }}>
                <button
                  onClick={() => setActiveSummaryTab(1)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeSummaryTab === 1 ? '#1b99e8' : '#e0e0e0',
                    color: activeSummaryTab === 1 ? 'white' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSummaryTab === 1 ? 'bold' : 'normal'
                  }}
                >
                  Stock  Table
                </button>
                <button
                  onClick={() => setActiveSummaryTab(2)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeSummaryTab === 2 ? '#1b99e8' : '#e0e0e0',
                    color: activeSummaryTab === 2 ? 'white' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSummaryTab === 2 ? 'bold' : 'normal'
                  }}
                >
                  Requirement Table
                </button>
                <button
                  onClick={() => setActiveSummaryTab(3)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeSummaryTab === 3 ? '#1b99e8' : '#e0e0e0',
                    color: activeSummaryTab === 3 ? 'white' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSummaryTab === 3 ? 'bold' : 'normal'
                  }}
                >
                  Quick Summary
                </button>
                <button
                  onClick={() => setActiveSummaryTab(4)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeSummaryTab === 4 ? '#1b99e8' : '#e0e0e0',
                    color: activeSummaryTab === 4 ? 'white' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSummaryTab === 4 ? 'bold' : 'normal'
                  }}
                >
                  Yearly Summary
                </button>
              </div>
            </div>
            
            {activeSummaryTab === 1 ? (
              <div ref={summaryTable1Ref}>
                <SummaryTable tableData={tableData} />
              </div>
            ) : activeSummaryTab === 2 ? (
              <div ref={summaryTable2Ref}>
                <SummaryTable2 tableData={tableData} />
              </div>
            ) : activeSummaryTab === 3 ? (
              <div ref={summaryTable3Ref}>
                <SummaryTable3 tableData={tableData} />
              </div>
            ) : (
              <div>
                <SummaryTable4 ref={summaryTable4Ref} tableData={tableData} />
              </div>
            )}
          </div>
        ) : (
          <>
            <UserDetailsCard />
            <Table 
              ref={tableRef}
              tableData={tableData}
              onCellChange={handleCellChange}
              onCellBlur={handleCellBlur}
              onUpdateTableData={addToHistory}
              canUndo={historyStep > 0}
              canRedo={historyStep < history.length - 1}
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
              selectedCols={selectedCols}
              setSelectedCols={setSelectedCols}
              isFilterActive={isFilterActive}
              isViewer={userRole?.toLowerCase() === 'viewer'}
              onInsertRow={handleInsertRow}
              onInsertCol={handleInsertCol}
            />
            {!isSmartView && (
              <div 
                ref={chartRef} 
                style={{ 
                  zIndex: 100,
                  marginLeft: '5.35%'
                }}
              >
                <RobotBarChart 
                  tableData={tableData} 
                  chartPosition={{ width: chartWidth, height: chartHeight, top: 40, left: tableContainerLeft }}
                  setSelectedCols={setSelectedCols}
                  setIsFilterActive={setIsFilterActive}
                />
              </div>
            )}
          </>
        )}
      </div>
      
      <UserAccessDialog
        isOpen={isAccessDialogOpen}
        onClose={handleCloseAccessDialog}
        users={users}
        onAddUser={handleAddUser}
        onRemoveUser={handleRemoveUser}
        onUpdateUser={handleUpdateUser}
        onRobotStandardsChange={() => {
          if (tableRef.current?.refreshRobotStandards) {
            tableRef.current.refreshRobotStandards();
          }
          if (tableRef.current?.refreshStandardControllers) {
            tableRef.current.refreshStandardControllers();
          }
          if (tableRef.current?.refreshStandardFamilies) {
            tableRef.current.refreshStandardFamilies();
          }
        }}
      />

      <DropdownManagementDialog
        isOpen={isDropdownManagementDialogOpen}
        onClose={handleCloseDropdownManagementDialog}
        onDropdownsChange={() => {
          if (tableRef.current?.refreshRobotStandards) {
            tableRef.current.refreshRobotStandards();
          }
          if (tableRef.current?.refreshStandardControllers) {
            tableRef.current.refreshStandardControllers();
          }
          if (tableRef.current?.refreshStandardFamilies) {
            tableRef.current.refreshStandardFamilies();
          }
        }}
      />
    </div>
  );
};

export default Home;
