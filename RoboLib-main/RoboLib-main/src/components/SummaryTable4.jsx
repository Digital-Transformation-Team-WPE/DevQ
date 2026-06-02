import React, { useMemo, useEffect, useState, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import './summaryTable.css';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';

const SummaryTable4 = forwardRef(({ tableData }, ref) => {
  const [poolNewEntryValues, setPoolNewEntryValues] = useState({});
  const autoSaveTimerRef = useRef(null);
  const lastSavedDataRef = useRef(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const prevTableDataRef = useRef(null);
  const prevSummaryDataRef = useRef(null);
  // Parse cell value to extract display value and color mode
  const parseCellValue = (cellValue) => {
    if (!cellValue) return { displayValue: '', mode: null };
    
    const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
    const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);
    
    if (greenMatch) return { displayValue: greenMatch[1].trim(), mode: 'green' };
    if (orangeMatch) return { displayValue: orangeMatch[1].trim(), mode: 'orange' };
    
    return { displayValue: cellValue, mode: null };
  };

  // Extract year from date string (supports formats: YYYY, YY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, Mon YY, DD-MMM-YY)
  const extractYear = (dateString) => {
    if (!dateString) return null;
    
    // Try 4-digit year first (YYYY format)
    const yearMatch4 = dateString.match(/\b(\d{4})\b/);
    if (yearMatch4) {
      return yearMatch4[1];
    }
    
    // For DD-MMM-YY format, extract the LAST 2-digit sequence (the year at the end)
    const allMatches = dateString.match(/\b(\d{2})\b/g);
    if (allMatches && allMatches.length > 0) {
      // Get the last 2-digit match (most likely the year in DD-MMM-YY format)
      const lastMatch = allMatches[allMatches.length - 1];
      const twoDigitYear = parseInt(lastMatch);
      // Convert 2-digit year to 4-digit (assume 20xx for 00-99)
      if (twoDigitYear >= 0 && twoDigitYear <= 99) {
        return `20${lastMatch}`;
      }
    }
    
    return null;
  };

  // Row indices mapping (0-indexed in actual data array)
  const ROW_INDICES = {
    stockPlant: 0,  // Row 1 - Plan names
    runOutDate: 5,  // Row 6 - Year source for stock table
  };

  // OPTIMIZATION: Detect which columns changed to avoid full recalculation
  const getAffectedYears = (prevData, newData) => {
    if (!prevData || !newData) return null;
    
    const affectedYears = new Set();
    const startCol = 9;
    
    // Check stock table columns (J+) for changes in rows 0-11
    for (let col = startCol; col < Math.max(prevData[0]?.length || 0, newData[0]?.length || 0); col++) {
      const relevantRows = [0, 5, 7, 8, 9, 10]; // Stock plant, run out date, and calculation rows
      
      for (let rowIdx of relevantRows) {
        if (prevData[rowIdx]?.[col] !== newData[rowIdx]?.[col]) {
          // Extract year from run out date to know which year summary row to update
          const runOutDate = newData[5]?.[col] || '';
          let year = extractYear(runOutDate);
          if (!year) {
            year = extractYear(newData[0]?.[col] || ''); // Fallback to plan name
          }
          if (year) affectedYears.add(year);
        }
      }
    }
    
    // Check forecast table rows (13+) for changes in columns 0-8
    for (let rowIdx = 13; rowIdx < Math.max(prevData.length || 0, newData.length || 0); rowIdx++) {
      const dateColumns = [1, 2, 3, 4]; // Date columns
      let yearChanged = false;
      
      for (let colIdx of dateColumns) {
        if (prevData[rowIdx]?.[colIdx] !== newData[rowIdx]?.[colIdx]) {
          yearChanged = true;
          break;
        }
      }
      
      // Also check column F (total robots) and J+ (allocations)
      if (!yearChanged && (prevData[rowIdx]?.[5] !== newData[rowIdx]?.[5])) {
        yearChanged = true;
      }
      
      if (yearChanged) {
        let year = extractYear(newData[rowIdx]?.[3] || '');
        if (!year) year = extractYear(newData[rowIdx]?.[1] || '');
        if (!year) year = extractYear(newData[rowIdx]?.[2] || '');
        if (!year) year = extractYear(newData[rowIdx]?.[4] || '');
        if (!year) year = 'Undated';
        affectedYears.add(year);
      }
    }
    
    return affectedYears.size > 0 ? affectedYears : null;
  };

  // Calculate total available robots for a plan column (row 8 - row 9 - row 10 + row 11 - sum of rows 14+)
  const calculateAvailableStock = (tableData, colIndex) => {
    const row8Value = parseFloat(tableData[7]?.[colIndex]) || 0;
    const row9Value = parseFloat(tableData[8]?.[colIndex]) || 0;
    const row10Value = parseFloat(tableData[9]?.[colIndex]) || 0;
    const row11Value = parseFloat(tableData[10]?.[colIndex]) || 0;

    // Sum values from rows 14+ (forecast rows)
    let sumOfRows14Plus = 0;
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const rawValue = tableData[rowIndex]?.[colIndex];
      const parsed = parseCellValue(rawValue);
      sumOfRows14Plus += parseFloat(parsed.displayValue) || 0;
    }

    const calculated = row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus;
    // Stock can't be negative - clamp to 0
    return isNaN(calculated) ? 0 : Math.max(0, calculated);
  };

  // Calculate reused robots for a forecast row (sum of columns J+)
  const calculateReusedRobots = (row) => {
    let sum = 0;
    for (let colIndex = 9; colIndex < row.length; colIndex++) {
      const cellValue = row?.[colIndex];
      const parsed = parseCellValue(cellValue);
      const numValue = parseFloat(parsed.displayValue);
      if (!isNaN(numValue)) {
        sum += numValue;
      }
    }
    return sum;
  };

  // Build year-grouped summary data with differential updates
  const summaryData = useMemo(() => {
    if (!tableData || tableData.length <= 13) {
      prevTableDataRef.current = tableData;
      prevSummaryDataRef.current = [];
      return [];
    }

    // OPTIMIZATION: Try differential update if possible
    const affectedYears = getAffectedYears(prevTableDataRef.current, tableData);
    let yearMap = {};
    
    // If only certain years changed, start with previous data and update only affected years
    if (affectedYears && prevSummaryDataRef.current) {
      // Copy previous year data
      prevSummaryDataRef.current.forEach(item => {
        yearMap[item.year] = { ...item };
      });
      
      // Reset affected years to recalculate only those
      for (let year of affectedYears) {
        yearMap[year] = {
          year: year,
          availableStock: 0,
          expectedRobots: 0,
          robotsInUse: 0,
          scraps: 0
        };
      }
    }

    // Process stock table data (rows 1-12, columns J+) - only if year is affected
    // Row 6 = Run Out Date (year source)
    // Row 12 = Total Available Robots (calculated: row8 - row9 - row10 + row11 - sumOfRows14Plus)
    // Row 9 = Scraps
    const startCol = 9;  // Column J onwards (stock table columns)
    let lastCol = startCol;

    // Find last non-empty column in row 1 (starting from column J)
    if (tableData[ROW_INDICES.stockPlant]) {
      for (let col = startCol; col < tableData[ROW_INDICES.stockPlant].length; col++) {
        if (tableData[ROW_INDICES.stockPlant][col] && tableData[ROW_INDICES.stockPlant][col].trim() !== '') {
          lastCol = col;
        }
      }
    }

    // Process each plan column (J+) from stock table
    for (let col = startCol; col <= lastCol; col++) {
      const planName = tableData[ROW_INDICES.stockPlant]?.[col] || '';
      if (planName.trim() !== '') {
        // Extract year from row 6 (Run Out Date)
        const runOutDate = tableData[ROW_INDICES.runOutDate]?.[col] || '';
        let year = extractYear(runOutDate);
        
        // If no year found in run out date, use plan name as fallback
        if (!year) {
          year = extractYear(planName);
        }
        
        // Skip this plan column if no year can be extracted or not affected
        if (!year || (affectedYears && !affectedYears.has(year))) {
          continue;
        }

        if (!yearMap[year]) {
          yearMap[year] = {
            year: year,
            availableStock: 0,
            expectedRobots: 0,
            robotsInUse: 0,
            scraps: 0
          };
        }

        // Available Stock calculated: row 8 - row 9 - row 10 + row 11
        const availableStockValue = calculateAvailableStock(tableData, col);
        yearMap[year].availableStock += availableStockValue;

        // Scraps from row 10 (index 9) - parse cell value to extract number from color modes
        const scrapsCellValue = tableData[9]?.[col] || '';
        const scrapsValueParsed = parseCellValue(scrapsCellValue);
        const scrapsValue = parseFloat(scrapsValueParsed.displayValue) || 0;
        yearMap[year].scraps += scrapsValue;
      }
    }
    
    // Process forecast table data (rows 14+, columns A-I) - only if year is affected
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      
      // Check if forecast plant is filled
      if (row?.[0]?.trim() !== '') {
        // Extract year from date columns
        // Using column D (Onsite Delivery date, index 3) as the primary source
        let year = extractYear(row?.[3] || '');
        
        // Fallback to other date columns if needed
        if (!year) {
          year = extractYear(row?.[1] || ''); // Decision Date
        }
        if (!year) {
          year = extractYear(row?.[2] || ''); // Order Date
        }
        if (!year) {
          year = extractYear(row?.[4] || ''); // X0 Date
        }

        if (!year) {
          year = 'Undated';
        }

        // Skip if not affected
        if (affectedYears && !affectedYears.has(year)) {
          continue;
        }

        if (!yearMap[year]) {
          yearMap[year] = {
            year: year,
            availableStock: 0,
            expectedRobots: 0,
            robotsInUse: 0,
            scraps: 0
          };
        }

        // Expected Robots from column F (Total Robots, index 5)
        const totalRobots = parseFloat(row?.[5]) || 0;
        yearMap[year].expectedRobots += totalRobots;

        // Robots in Use from reused robots (sum of columns J+)
        const reusedRobots = calculateReusedRobots(row);
        yearMap[year].robotsInUse += reusedRobots;
      }
    }

    // Convert to array and sort by year
    const data = Object.values(yearMap).sort((a, b) => {
      // Try numeric sort first
      const yearA = parseInt(a.year);
      const yearB = parseInt(b.year);
      if (!isNaN(yearA) && !isNaN(yearB)) {
        return yearA - yearB;
      }
      // Fallback to string sort
      return a.year.localeCompare(b.year);
    });

    // Calculate Free Robots for each year
    data.forEach(row => {
      row.freeRobots = row.availableStock;
      row.poolNewEntry = poolNewEntryValues[row.year] || '';  // Restore poolNewEntry if exists
    });

    prevTableDataRef.current = tableData;
    prevSummaryDataRef.current = data;
    
    return data;
  }, [tableData, poolNewEntryValues]);

  // Handle Pool New Entry value change
  const handlePoolNewEntryChange = (year, value) => {
    const newValues = {
      ...poolNewEntryValues,
      [year]: value
    };
    setPoolNewEntryValues(newValues);
    // Save to localStorage immediately for backup
    localStorage.setItem('poolNewEntryValues', JSON.stringify(newValues));
  };

  // Load stored Pool New Entry values from database and localStorage
  useEffect(() => {
    const loadPoolNewEntryValues = async () => {
      try {
        let loadedValues = {};

        // Try to load from localStorage first
        const savedLocally = localStorage.getItem('poolNewEntryValues');
        if (savedLocally) {
          try {
            loadedValues = JSON.parse(savedLocally);
          } catch (e) {
            console.warn('Failed to parse localStorage poolNewEntryValues');
          }
        }

        // Then fetch from database to ensure we have the latest
        try {
          const response = await fetch(addRegionParam(API_ENDPOINTS.GET_SUMMARY4));
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const poolValues = {};
              result.data.forEach(row => {
                if (row.poolNewEntry) {
                  poolValues[row.year] = row.poolNewEntry;
                }
              });
              if (Object.keys(poolValues).length > 0) {
                // Database values take precedence over localStorage
                loadedValues = { ...loadedValues, ...poolValues };
              }
            }
          }
        } catch (dbError) {
          console.warn('Failed to load from database, using localStorage only:', dbError);
        }

        // Update state with merged values
        setPoolNewEntryValues(loadedValues);
        localStorage.setItem('poolNewEntryValues', JSON.stringify(loadedValues));
        
        // Mark initial load as complete
        setIsInitialLoadComplete(true);
      } catch (error) {
        console.error('Error loading Pool New Entry values:', error);
        setIsInitialLoadComplete(true);
      }
    };
    loadPoolNewEntryValues();
  }, []);

  // Clean up poolNewEntryValues when summaryData changes - remove years that no longer exist
  // Only run this after initial load is complete to avoid clearing values during initial mount
  useEffect(() => {
    if (!isInitialLoadComplete) {
      return; // Don't run until initial load completes
    }

    if (summaryData && summaryData.length > 0) {
      // Get set of valid years in current summaryData
      const validYears = new Set(summaryData.map(row => row.year));
      
      // Check if any poolNewEntryValues need to be removed
      const currentYears = Object.keys(poolNewEntryValues);
      const yearsToRemove = currentYears.filter(year => !validYears.has(year));
      
      if (yearsToRemove.length > 0) {
        // Create new poolNewEntryValues with only valid years
        const cleanedValues = {};
        currentYears.forEach(year => {
          if (validYears.has(year)) {
            cleanedValues[year] = poolNewEntryValues[year];
          }
        });
        
        setPoolNewEntryValues(cleanedValues);
        localStorage.setItem('poolNewEntryValues', JSON.stringify(cleanedValues));
      }
    } else if (summaryData.length === 0 && Object.keys(poolNewEntryValues).length > 0) {
      // If no summaryData, clear all poolNewEntryValues
      setPoolNewEntryValues({});
      localStorage.setItem('poolNewEntryValues', JSON.stringify({}));
    }
  }, [summaryData, isInitialLoadComplete]);

  // Save summary data to database whenever it changes
  useEffect(() => {
    if (summaryData && summaryData.length > 0) {
      // Clear any pending auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Debounce the save to avoid saving empty values before loading from DB
      autoSaveTimerRef.current = setTimeout(() => {
        const saveToDatabase = async () => {
          try {
            // Transform data for database storage - include all fields
            const summaryDataForDB = summaryData.map((row) => ({
              year: row.year || '',
              availableStock: row.availableStock.toString() || '0',
              poolNewEntry: poolNewEntryValues[row.year] || '',
              expectedRobots: row.expectedRobots.toString() || '0',
              robotsInUse: row.robotsInUse.toString() || '0',
              scraps: row.scraps.toString() || '0',
              freeRobots: row.freeRobots.toString() || '0'
            }));

            const response = await fetch(
              addRegionParam(API_ENDPOINTS.SAVE_SUMMARY4),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summaryData: summaryDataForDB })
              }
            );
            if (!response.ok) {
              console.error('Failed to save Summary Table 4 to database:', response.statusText);
            } else {
              const result = await response.json();
              lastSavedDataRef.current = summaryDataForDB;
            }
          } catch (error) {
            console.error('Error auto-saving Summary Table 4:', error);
          }
        };
        saveToDatabase();
        autoSaveTimerRef.current = null;
      }, 500); // Debounce by 500ms

      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }
  }, [summaryData, poolNewEntryValues]);

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      return new Promise((resolve) => {
        // Wait for any pending auto-saves to complete
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }

        if (summaryData && summaryData.length > 0) {
          // Perform the save immediately
          (async () => {
            try {
              // Transform data for database storage - include all fields
              const summaryDataForDB = summaryData.map((row) => ({
                year: row.year || '',
                availableStock: row.availableStock.toString() || '0',
                poolNewEntry: poolNewEntryValues[row.year] || '',
                expectedRobots: row.expectedRobots.toString() || '0',
                robotsInUse: row.robotsInUse.toString() || '0',
                scraps: row.scraps.toString() || '0',
                freeRobots: row.freeRobots.toString() || '0'
              }));

              const response = await fetch(
                addRegionParam(API_ENDPOINTS.SAVE_SUMMARY4),
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ summaryData: summaryDataForDB })
                }
              );
              
              if (!response.ok) {
                console.error('Failed to save Summary Table 4 to database:', response.statusText, response.status);
                resolve(false);
                return;
              }

              const result = await response.json();
              if (result.success) {
                lastSavedDataRef.current = summaryDataForDB;
                resolve(true);
              } else {
                console.error('Server returned failure for Summary Table 4 save:', result);
                resolve(false);
              }
            } catch (error) {
              console.error('Error saving Summary Table 4 from toolbar:', error);
              resolve(false);
            }
          })();
        } else {
          resolve(true);
        }
      });
    }
  }), [summaryData, poolNewEntryValues]);

  if (!tableData || summaryData.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        No data available to display in Summary Table 4
      </div>
    );
  }

  return (
    <div className="summary-table-container" style={{ padding: '20px', width: '80%', overflowX: 'auto', overflowY: 'hidden', display: 'block' }}>
      
      <table
        style={{
          width: '100%',
          minWidth: '1200px',
          borderCollapse: 'collapse',
          border: '1px solid #d1d5db',
          backgroundColor: '#f5f5f5',
          fontSize: '13px',
          tableLayout: 'auto'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#e5e7eb', borderBottom: '2px solid #d1d5db' }}>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '80px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Year
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '120px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Available Stock
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '120px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Pool New Entry
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '120px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Expected Robots
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '120px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Robots in Use
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '80px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Scraps
            </th>
            <th
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #d1d5db',
                minWidth: '100px',
                backgroundColor: '#5c90f7',
                color: '#ffffff'
              }}
            >
              Free Robots
            </th>
          </tr>
        </thead>
        <tbody>
          {summaryData.map((rowData, rowIdx) => (
            <tr
              key={rowIdx}
              style={{
                backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                borderBottom: '1px solid #d1d5db'
              }}
            >
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center', fontWeight: 'bold' }}>
                {rowData.year}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.availableStock.toFixed(0)}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                <input
                  type="number"
                  value={poolNewEntryValues[rowData.year] || ''}
                  onChange={(e) => handlePoolNewEntryChange(rowData.year, e.target.value)}
                  style={{
                    width: '90%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    textAlign: 'center'
                  }}
                  placeholder="Enter value"
                />
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.expectedRobots.toFixed(0)}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.robotsInUse.toFixed(0)}
              </td>
              <td style={{ padding: '10px', border: '1px solid #d1d5db', textAlign: 'center' }}>
                {rowData.scraps.toFixed(0)}
              </td>
              <td 
                style={{ 
                  padding: '10px', 
                  border: '1px solid #d1d5db', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  backgroundColor: rowData.freeRobots < 0 ? '#fee2e2' : 'transparent',
                  color: rowData.freeRobots < 0 ? '#991b1b' : 'inherit'
                }}
              >
                {rowData.freeRobots.toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default memo(SummaryTable4);
