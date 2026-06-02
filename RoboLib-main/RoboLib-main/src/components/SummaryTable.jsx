import React, { useState, useEffect, memo, useMemo } from 'react';
import './SummaryTable1.css';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';

const SummaryTable = ({ data: propData, tableData }) => {
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [prevTableDataRef, setPrevTableDataRef] = useState(null);

  // Row indices mapping (0-indexed in actual data array)
  const ROW_INDICES = {
    stockPlant: 0,        // Row 1
    robotStandard: 1,     // Row 2
    standardController: 2, // Row 3
    standardFamily: 3,    // Row 4
    row8: 7,              // Row 8
    row9: 8,              // Row 9
    row10: 9,             // Row 10
    row11: 10,            // Row 11
    spareParts: 8,        // Row 9
    scraps: 9,            // Row 10
    onsiteProduction: 10, // Row 11
    runOutDate: 5,        // Row 6
    amountOfRobots: 6,    // Row 7
  };

  // OPTIMIZATION: Only recalculate changed columns instead of entire table
  const getChangedColumns = (prevData, newData) => {
    if (!prevData || !newData || prevData.length !== newData.length) {
      return null; // Full recalculation needed
    }
    
    const changedCols = new Set();
    const relevantRows = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10];
    
    // Track which columns have changes in relevant rows
    for (let rowIdx of relevantRows) {
      for (let colIdx = 9; colIdx < newData[rowIdx]?.length; colIdx++) {
        if (prevData[rowIdx]?.[colIdx] !== newData[rowIdx]?.[colIdx]) {
          changedCols.add(colIdx);
        }
      }
    }
    
    // Also check rows 13+ for forecast row changes
    for (let rowIdx = 13; rowIdx < newData.length; rowIdx++) {
      if (prevData[rowIdx]?.length !== newData[rowIdx]?.length) {
        return null; // Structure changed, full recalculation
      }
      for (let colIdx = 9; colIdx < newData[rowIdx]?.length; colIdx++) {
        if (prevData[rowIdx]?.[colIdx] !== newData[rowIdx]?.[colIdx]) {
          changedCols.add(colIdx);
        }
      }
    }
    
    return changedCols.size > 0 ? changedCols : new Set();
  };

  // Calculate row 12 value (Total Available Robots)
  const calculateRow12Value = (mainTableData, colIndex) => {
    if (!mainTableData || mainTableData.length < 11) {
      return '';
    }

    const row8Value = parseFloat(mainTableData[ROW_INDICES.row8]?.[colIndex]) || 0;
    const row9Value = parseFloat(mainTableData[ROW_INDICES.row9]?.[colIndex]) || 0;
    const row10Value = parseFloat(mainTableData[ROW_INDICES.row10]?.[colIndex]) || 0;
    const row11Value = parseFloat(mainTableData[ROW_INDICES.row11]?.[colIndex]) || 0;

    // Sum all values from rows 14+ (index 13+) for this column
    let sumOfRows14Plus = 0;
    for (let rowIndex = 13; rowIndex < mainTableData.length; rowIndex++) {
      const value = parseFloat(mainTableData[rowIndex]?.[colIndex]) || 0;
      sumOfRows14Plus += value;
    }

    // Formula: row8 - row9 - row10 + row11 - sumOfRows14Plus
    const calculated = row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus;

    // Return empty string if all inputs are 0
    if (row8Value === 0 && row9Value === 0 && row10Value === 0 && row11Value === 0 && sumOfRows14Plus === 0) {
      return '';
    }

    return calculated.toString();
  };

  // Transform horizontal data from main table to vertical summary table
  const transformTableDataToSummary = (mainTableData) => {
    if (!mainTableData || mainTableData.length === 0) {
      return [];
    }

    const summaryRows = [];
    const startCol = 9; // Column J (index 9)

    // Find last non-empty column in row 1 (starting from column J)
    let lastCol = startCol;
    for (let col = startCol; col < mainTableData[ROW_INDICES.stockPlant].length; col++) {
      if (mainTableData[ROW_INDICES.stockPlant][col] && mainTableData[ROW_INDICES.stockPlant][col].trim() !== '') {
        lastCol = col;
      }
    }

    // For each plan column (J, K, L, ...), create a summary row
    for (let col = startCol; col <= lastCol; col++) {
      const planName = mainTableData[ROW_INDICES.stockPlant][col] || '';

      // Only create row if there's a plan name
      if (planName.trim() !== '') {
        // Calculate total robots using the same formula as main table
        const totalRobotsValue = calculateRow12Value(mainTableData, col);
        
        summaryRows.push({
          stockPlantProject: planName,
          robotStandard: mainTableData[ROW_INDICES.robotStandard][col] || '',
          standardController: mainTableData[ROW_INDICES.standardController][col] || '',
          standardFamily: mainTableData[ROW_INDICES.standardFamily][col] || '',
          runOutDate: mainTableData[ROW_INDICES.runOutDate][col] || '',
          amountOfRobotsAvailable: mainTableData[ROW_INDICES.amountOfRobots][col] || '',
          sparePartsSpecificNeed: mainTableData[ROW_INDICES.spareParts][col] || '',
          scraps: mainTableData[ROW_INDICES.scraps][col] || '',
          onsiteProduction: mainTableData[ROW_INDICES.onsiteProduction][col] || '',
          totalAvailableRobots: totalRobotsValue
        });
      }
    }

    return summaryRows;
  };

  // OPTIMIZATION: Differential update handler - only recalculate changed columns
  const handleDifferentialUpdate = (prevData, newData, changedCols) => {
    if (changedCols === null || changedCols.size === 0) {
      // Full recalculation needed
      return transformTableDataToSummary(newData);
    }

    // Only update rows corresponding to changed columns
    const prevSummary = [...summaryData];
    const startCol = 9;
    
    // Update affected rows based on changed columns
    for (let colIdx of changedCols) {
      const rowIdx = colIdx - startCol; // Map column index to summary row index
      
      if (rowIdx >= 0 && rowIdx < prevSummary.length) {
        const planName = newData[ROW_INDICES.stockPlant][colIdx] || '';
        
        // If plan name exists, update the summary row
        if (planName.trim() !== '') {
          prevSummary[rowIdx] = {
            stockPlantProject: planName,
            robotStandard: newData[ROW_INDICES.robotStandard][colIdx] || '',
            standardController: newData[ROW_INDICES.standardController][colIdx] || '',
            standardFamily: newData[ROW_INDICES.standardFamily][colIdx] || '',
            runOutDate: newData[ROW_INDICES.runOutDate][colIdx] || '',
            amountOfRobotsAvailable: newData[ROW_INDICES.amountOfRobots][colIdx] || '',
            sparePartsSpecificNeed: newData[ROW_INDICES.spareParts][colIdx] || '',
            scraps: newData[ROW_INDICES.scraps][colIdx] || '',
            onsiteProduction: newData[ROW_INDICES.onsiteProduction][colIdx] || '',
            totalAvailableRobots: calculateRow12Value(newData, colIdx)
          };
        }
      }
    }
    
    return prevSummary;
  };

  // Auto-transform when tableData is passed - uses differential updates for performance
  useEffect(() => {
    if (tableData && tableData.length > 0) {
      // Check if we should do differential update
      const changedCols = getChangedColumns(prevTableDataRef, tableData);
      
      if (changedCols === null) {
        // Full recalculation
        const transformed = transformTableDataToSummary(tableData);
        setSummaryData(transformed);
      } else if (changedCols.size > 0) {
        // Differential update
        const updated = handleDifferentialUpdate(prevTableDataRef, tableData, changedCols);
        setSummaryData(updated);
      }
      
      setPrevTableDataRef(tableData);
      setLoading(false);
    } else {
      // Fetch from backend if no tableData provided
      const fetchSummaryData = async () => {
        try {
          const url = addRegionParam(API_ENDPOINTS.GET_SUMMARY);
          const response = await fetch(url);
          
          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              console.error('Server error:', errorData.error);
            } else {
              const text = await response.text();
              console.error('Server returned non-JSON response:', text.substring(0, 200));
            }
            setSummaryData([]);
            setLoading(false);
            return;
          }
          
          const result = await response.json();
          
          if (result.success && result.data) {
            setSummaryData(result.data);
          } else {
            setSummaryData([]);
          }
        } catch (error) {
          console.error('Failed to fetch summary data:', error);
          setSummaryData([]);
        } finally {
          setLoading(false);
        }
      };

      fetchSummaryData();
    }
  }, [tableData]);

  // Auto-save summary data to database when it's calculated from tableData
  useEffect(() => {
    if (summaryData && summaryData.length > 0 && tableData && tableData.length > 0) {
      const autoSaveToDatabase = async () => {
        try {
          const response = await fetch(addRegionParam(API_ENDPOINTS.SAVE_SUMMARY), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summaryData })
          });

          if (!response.ok) {
            console.warn('Auto-save: Failed to save Summary Table 1 to database');
          } else {
          }
        } catch (error) {
          console.warn('Auto-save error for Summary Table 1:', error);
        }
      };

      autoSaveToDatabase();
    }
  }, [summaryData, tableData]);

  // Handle cell editing
  const handleCellChange = (rowIdx, field, value) => {
    const newData = [...summaryData];
    if (!newData[rowIdx]) {
      newData[rowIdx] = {};
    }
    newData[rowIdx][field] = value;
    setSummaryData(newData);
  };

  // Add new row
  const handleAddRow = () => {
    setSummaryData([...summaryData, {
      stockPlantProject: '',
      robotStandard: '',
      standardController: '',
      standardFamily: '',
      runOutDate: '',
      amountOfRobotsAvailable: '',
      sparePartsSpecificNeed: '',
      scraps: '',
      onsiteProduction: '',
      totalAvailableRobots: ''
    }]);
  };

  // Save to backend
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(API_ENDPOINTS.SAVE_SUMMARY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryData })
      });

      // Check if response is ok
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `HTTP ${response.status}`;
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          // Response is not JSON (maybe HTML error page)
          const text = await response.text();
          console.error('Server returned non-JSON response:', text.substring(0, 200));
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        
        alert('Failed to save: ' + errorMessage);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Server returned non-JSON response');
        alert('Error: Server returned invalid response format');
        return;
      }

      const result = await response.json();
      
      if (result.success) {
        alert('Summary saved successfully!');
      } else {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving summary: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete row
  const handleDeleteRow = (rowIdx) => {
    const newData = summaryData.filter((_, idx) => idx !== rowIdx);
    setSummaryData(newData);
  };

  // Group data by Robot Standard
  const groupDataByRobotStandard = () => {
    const groups = {};
    
    summaryData.forEach((row) => {
      const standard = row.robotStandard || 'Unknown';
      if (!groups[standard]) {
        groups[standard] = [];
      }
      groups[standard].push(row);
    });

    return groups;
  };

  // Calculate totals for a group
  const calculateGroupTotals = (rows) => {
    return {
      amountOfRobotsAvailable: rows.reduce((sum, row) => sum + (parseFloat(row.amountOfRobotsAvailable) || 0), 0),
      sparePartsSpecificNeed: rows.reduce((sum, row) => sum + (parseFloat(row.sparePartsSpecificNeed) || 0), 0),
      scraps: rows.reduce((sum, row) => sum + (parseFloat(row.scraps) || 0), 0),
      onsiteProduction: rows.reduce((sum, row) => sum + (parseFloat(row.onsiteProduction) || 0), 0),
      totalAvailableRobots: rows.reduce((sum, row) => sum + (parseFloat(row.totalAvailableRobots) || 0), 0),
    };
  };

  // Toggle group expansion
  const toggleGroupExpansion = (standard) => {
    setExpandedGroups(prev => ({
      ...prev,
      [standard]: !prev[standard]
    }));
  };

  const fields = [
    { key: 'robotStandard', label: 'Robot Standard' },
    { key: 'amountOfRobotsAvailable', label: 'Amount Of Robots Available' },
    { key: 'sparePartsSpecificNeed', label: 'Spare Parts & Specific Need' },
    { key: 'scraps', label: 'Scraps' },
    { key: 'onsiteProduction', label: 'Onsite Production' },
    { key: 'totalAvailableRobots', label: 'Total (Available Robots)' }
  ]; 

  const detailFields = [
    { key: 'stockPlantProject', label: 'Stock Plant & Project' },
    // { key: 'robotStandard', label: 'Robot Standard' },
    { key: 'standardController', label: 'Standard Controller' },
    { key: 'standardFamily', label: 'Standard Family' },
    { key: 'runOutDate', label: 'Run Out Date' },
    { key: 'amountOfRobotsAvailable', label: 'Amount Of Robots Available' },
    { key: 'sparePartsSpecificNeed', label: 'Spare Parts & Specific Need' },
    { key: 'scraps', label: 'Scraps' },
    { key: 'onsiteProduction', label: 'Onsite Production' },
    { key: 'totalAvailableRobots', label: 'Total (Available Robots)' }
  ];

  if (loading) {
    return <div className="summary1-container"><p>Loading summary data...</p></div>;
  }

  return (
    <div className="summary1-container">
      {/* <div className="summary1-header">
        <h2>Summary</h2>
      </div> */}

      <div className="summary1-table-wrapper">
        <table className="summary1-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              {fields.map(field => (
                <th key={field.key}>{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryData && summaryData.length > 0 ? (
              Object.entries(groupDataByRobotStandard()).map(([standard, rows]) => {
                const totals = calculateGroupTotals(rows);
                const isExpanded = expandedGroups[standard];
                
                return (
                  <React.Fragment key={standard}>
                    {/* Group Header Row */}
                    <tr className="summary1-group-header">
                      <td 
                        className="summary1-expand-btn"
                        onClick={() => toggleGroupExpansion(standard)}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td>{standard}</td>
                      <td>{totals.amountOfRobotsAvailable}</td>
                      <td>{totals.sparePartsSpecificNeed}</td>
                      <td>{totals.scraps}</td>
                      <td>{totals.onsiteProduction}</td>
                      <td>{totals.totalAvailableRobots}</td>
                    </tr>

                    {/* Detail Section - Separate Table */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                          <table className="summary1-detail-table">
                            <thead>
                              <tr className="summary1-detail-header">
                                {detailFields.map(field => (
                                  <th key={field.key}>{field.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => (
                                <tr key={`${standard}-${idx}`} className="summary1-detail-row">
                                  {detailFields.map(field => (
                                    <td
                                      key={`${standard}-${idx}-${field.key}`}
                                      className={`summary1-editable-cell ${editingCell === `${standard}-${idx}-${field.key}` ? 'editing' : ''}`}
                                      onClick={() => setEditingCell(`${standard}-${idx}-${field.key}`)}
                                    >
                                      {editingCell === `${standard}-${idx}-${field.key}` ? (
                                        <input
                                          type="text"
                                          value={row[field.key] || ''}
                                          onChange={(e) => {
                                            const newData = [...summaryData];
                                            const originalIdx = newData.findIndex(r => r === row);
                                            if (originalIdx !== -1) {
                                              newData[originalIdx][field.key] = e.target.value;
                                              setSummaryData(newData);
                                            }
                                          }}
                                          onBlur={() => setEditingCell(null)}
                                          autoFocus
                                        />
                                      ) : (
                                        row[field.key] || ''
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr><td colSpan={7} className="summary1-empty-state"><p>No summary data available.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(SummaryTable);
