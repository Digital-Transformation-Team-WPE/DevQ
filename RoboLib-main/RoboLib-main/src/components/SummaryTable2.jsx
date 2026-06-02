import React, { useMemo, useEffect, memo } from 'react';
import './summaryTable.css';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';

const SummaryTable2 = ({ tableData }) => {
  // Headers for columns A-I (frozen columns)
  const HEADERS = {
    0: 'Forecast Plant & Project',
    1: 'Decision Date',
    2: 'Order Date',
    3: 'Onsite\nDelivery date',
    4: 'X0 Date',
    5: 'Total Robots',
    6: 'Reused Robots',
    7: 'New Robots',
    // 8: 'Reuse Assumption'
  };

  // Parse cell value to extract display value (strip color indicators)
  const parseCellValue = (cellValue) => {
    if (!cellValue) return { displayValue: '', mode: null };
    
    const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
    const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);
    
    if (greenMatch) return { displayValue: greenMatch[1].trim(), mode: 'single' };
    if (orangeMatch) return { displayValue: orangeMatch[1].trim(), mode: 'double' };
    
    return { displayValue: cellValue, mode: null };
  };

  // Calculate Reused Robots for a row (sum of columns J+ for that row)
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

  // Calculate New Robots for a row (Total Robots - Reused Robots)
  const calculateNewRobots = (rowIndex, reusedRobots) => {
    const totalRobots = parseFloat(tableData[rowIndex]?.[5]);
    const reusedRobotsNum = parseFloat(reusedRobots);
    if (isNaN(totalRobots) || isNaN(reusedRobotsNum)) {
      return '';
    }
    const newRobots = totalRobots - reusedRobotsNum;
    return newRobots.toString();
  };

  // Extract data from rows 14+ (rowIndex >= 13), columns A-I (colIndex 0-8)
  const summaryData = useMemo(() => {
    if (!tableData || tableData.length <= 13) {
      return [];
    }

    const data = [];
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      
      // Check if the row has any data in column A (Forecast Plant & Project)
      if (row?.[0]?.trim() !== '') {
        const reusedRobots = calculateReusedRobots(rowIndex);
        const newRobots = calculateNewRobots(rowIndex, reusedRobots);

        data.push({
          sn: rowIndex - 12, // Serial number (1-based)
          forecastPlantProject: row[0] || '',
          decisionDate: row[1] || '',
          orderDate: row[2] || '',
          onsiteDeliveryDate: row[3] || '',
          x0Date: row[4] || '',
          totalRobots: row[5] || '',
          reusedRobots: reusedRobots,
          newRobots: newRobots,
          // reuseAssumption: row[8] || ''
        });
      }
    }
    return data;
  }, [tableData]);

  // Save summary data to database whenever it changes
  useEffect(() => {
    if (summaryData && summaryData.length > 0) {
      const saveToDatabase = async () => {
        try {
          const response = await fetch(
            addRegionParam(API_ENDPOINTS.SAVE_SUMMARY2),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ summaryData })
            }
          );
          if (!response.ok) {
            console.error('Failed to save Summary Table 2 to database');
          }
        } catch (error) {
          console.error('Error saving Summary Table 2:', error);
        }
      };
      saveToDatabase();
    }
  }, [summaryData]);

  if (!tableData || summaryData.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        No data available to display in Summary Table 2
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
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #d1d5db', minWidth: '50px', backgroundColor: '#5c90f7' }}>
              SN
            </th>
            {Object.values(HEADERS).map((header, idx) => (
              <th
                key={idx}
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  border: '1px solid #d1d5db',
                  minWidth: '150px',
                  backgroundColor: '#5c90f7',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaryData.map((rowData, rowIdx) => (
            <tr
              key={rowIdx}
              style={{
                backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                borderBottom: '1px solid #d1d5db',
                '&:hover': { backgroundColor: '#f0f0f0' }
              }}
            >
              <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: 'bold' }}>
                {rowData.sn}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.forecastPlantProject}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.decisionDate}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.orderDate}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.onsiteDeliveryDate}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.x0Date}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.totalRobots}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.reusedRobots}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.newRobots}
              </td>
              {/* <td style={{ padding: '10px', border: '1px solid #d1d5db' }}>
                {rowData.reuseAssumption}
              </td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(SummaryTable2);
