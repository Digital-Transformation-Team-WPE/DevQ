import React, { useMemo, useEffect, memo } from 'react';
import './summaryTable.css';
import Toolbar from './Toolbar';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';
const SummaryTable3 = ({ tableData }) => {
  // Parse cell value to extract display value and color mode
  const parseCellValue = (cellValue) => {
    if (!cellValue) return { displayValue: '', mode: null };
    
    const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
    const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);
    
    if (greenMatch) return { displayValue: greenMatch[1].trim(), mode: 'green' };
    if (orangeMatch) return { displayValue: orangeMatch[1].trim(), mode: 'orange' };
    
    return { displayValue: cellValue, mode: null };
  };

  // Get cell style based on color mode
  const getCellStyle = (mode) => {
    const baseStyle = {
      padding: '10px',
      border: '1px solid #d1d5db',
      textAlign: 'center'
    };

    return baseStyle;
  };

  // Calculate Reused Robots (sum of scrollable columns J+)
  const calculateReusedRobots = (rowIndex) => {
    const row = tableData[rowIndex];
    let sum = 0;
    // Sum all values from column J (index 9) onwards
    for (let colIndex = 9; colIndex < row.length; colIndex++) {
      const cellValue = row?.[colIndex];
      const parsed = parseCellValue(cellValue);
      const numValue = parseFloat(parsed.displayValue);
      if (!isNaN(numValue)) {
        sum += numValue;
      }
    }
    return sum > 0 ? sum.toString() : '';
  };

  // Calculate New Robots (Total - Reused)
  const calculateNewRobots = (totalRobots, reusedRobots) => {
    const totalNum = parseFloat(totalRobots);
    const reusedNum = parseFloat(reusedRobots);
    if (isNaN(totalNum) || isNaN(reusedNum)) {
      return '';
    }
    return (totalNum - reusedNum).toString();
  };

  // Build summary data from table
  const summaryData = useMemo(() => {
    if (!tableData || tableData.length <= 13) {
      return { headers: [], rows: [] };
    }

    // Get headers from Row 2 (index 1), columns J+ (index 9+)
    const scrollableHeaders = [];
    const startCol = 9; // Column J
    let lastCol = startCol;

    // Find last non-empty column in row 2 (starting from column J)
    for (let col = startCol; col < tableData[1].length; col++) {
      if (tableData[1][col] && tableData[1][col].trim() !== '') {
        lastCol = col;
      }
    }

    // Collect headers from row 2
    for (let col = startCol; col <= lastCol; col++) {
      const headerValue = tableData[1]?.[col] || '';
      scrollableHeaders.push({
        colIndex: col,
        headerValue: headerValue
      });
    }

    // Build rows from rows 14+ (index 13+) - Forecast rows
    const rows = [];
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      
      // Check if forecast plant (column A) is filled
      if (row?.[0]?.trim() !== '') {
        const forecastPlant = row[0];
        const cells = [];

        // Total Robots (from column F, index 5)
        const totalValue = parseCellValue(row?.[5] || '');
        cells.push({
          displayValue: totalValue.displayValue,
          mode: totalValue.mode
        });

        // Reused Robots (calculated: sum of columns J+)
        const reusedValue = calculateReusedRobots(rowIndex);
        cells.push({
          displayValue: reusedValue,
          mode: null
        });

        // New Robots (calculated: Total - Reused)
        const newValue = calculateNewRobots(totalValue.displayValue, reusedValue);
        cells.push({
          displayValue: newValue,
          mode: null
        });

        // Get values from scrollable columns
        for (const header of scrollableHeaders) {
          const cellValue = row?.[header.colIndex] || '';
          const parsed = parseCellValue(cellValue);
          cells.push({
            displayValue: parsed.displayValue,
            mode: parsed.mode
          });
        }

        rows.push({
          forecastPlant: forecastPlant,
          cells: cells,
          isSummaryRow: false
        });
      }
    }

    return { scrollableHeaders, rows };
  }, [tableData]);

  // Save summary data to database whenever it changes
  useEffect(() => {
    if (summaryData && summaryData.rows && summaryData.rows.length > 0) {
      const saveToDatabase = async () => {
        try {
          // Transform data for database storage
          const summaryDataForDB = summaryData.rows.map((row) => ({
            forecastPlantProject: row.forecastPlant || '',
            decisionDate: '',
            orderDate: '',
            onsiteDeliveryDate: '',
            x0Date: '',
            totalRobots: row.cells[0]?.displayValue || '',
            reusedRobots: row.cells[1]?.displayValue || '',
            newRobots: row.cells[2]?.displayValue || '',
            reuseAssumption: ''
          }));

          const response = await fetch(
            addRegionParam(API_ENDPOINTS.SAVE_SUMMARY3),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ summaryData: summaryDataForDB })
            }
          );
          if (!response.ok) {
            console.error('Failed to save Summary Table 3 to database');
          }
        } catch (error) {
          console.error('Error saving Summary Table 3:', error);
        }
      };
      saveToDatabase();
    }
  }, [summaryData]);

  if (!tableData || summaryData.rows.length === 0 || summaryData.scrollableHeaders.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        No data available to display in Summary Table 3
      </div>
    );
  }

  return (
    <div className="summary-table-container" style={{ padding: '20px', overflowX: 'auto' }}>
     
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #d1d5db',
          backgroundColor: '#f5f5f5',
          fontSize: '13px'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#e5e7eb', borderBottom: '2px solid #d1d5db' }}>
            {/* First column header */}
            <th
              style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '180px',
                left: 0,
                backgroundColor: '#e5e7eb',
                zIndex: 1,
              }}
            >
              Forecast Plant & Project
            </th>
            {/* Total header */}
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '100px',

              }}
            >
              Total Robots
            </th>
            {/* Reused header */}
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '100px',
                
              }}
            >
              Reused Robots
            </th>
            {/* New header */}
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '100px'
              }}
            >
              New Robots
            </th>
            {/* Headers from Row 2 for columns J+ */}
            {summaryData.scrollableHeaders.map((header, idx) => (
              <th
                key={idx}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  border: '1px solid #d1d5db',
                  minWidth: '150px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {header.headerValue}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaryData.rows.map((rowData, rowIdx) => (
            <tr
              key={rowIdx}
              style={{
                backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                borderBottom: '1px solid #d1d5db'
              }}
            >
              {/* Forecast Plant & Project / Summary label */}
              <td
                style={{
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  fontWeight: 'bold',
                  // position: 'sticky',
                  left: 0,
                  backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                  zIndex: 0
                }}
              >
                {rowData.forecastPlant}
              </td>
        
              {/* Data cells (Total, Reused, New + Scrollable columns) */}
              {rowData.cells.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={getCellStyle(cell.mode)}
                >
                  {cell.displayValue}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
};

export default memo(SummaryTable3);
