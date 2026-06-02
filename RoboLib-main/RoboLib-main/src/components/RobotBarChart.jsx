import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import './robotBarChart.css';
import { API_ENDPOINTS, addRegionParam } from '../config/apiConfig';

// ==================== CONSTANTS (unchanged) ====================
// const COLORS = [
//   '#817cd6', '#65c489', '#ffc658', '#ff7c7c', '#499aac',
//   '#d084d0', '#ffa500', '#90ee90', '#52c3f0', '#ffa07a',
//   '#0c456d', '#b06b6b', '#4fb1ac', '#ff69b4', '#cd5c5c',
//   '#7b68ee', '#479d7c', '#96584f', '#6e8826', '#f98054',
//   '#693e8d', '#ff8c00',
// ];
const COLORS = [
  '#3d3da2'
];
const D_COLORS = [
  '#b72a2a', '#c2551f', '#c7850c', '#a59607', '#89b407',
  '#6dd328', '#15b854', '#04936f', '#1ca9bb', '#1e90be',
  '#1e84c3', '#1e78c3', '#2a71c0', '#355ec5', '#3c44c3',
  '#5236c3', '#7340c3', '#963ec1', '#b53dbd', '#c137a3',
  '#c23a7a', '#c24a55'
];

const GREEN_REGEX = /^(.*?)\s*\(green\)$/;
const ORANGE_REGEX = /^(.*?)\s*\(orange\)$/;

// ==================== STATIC STYLES (unchanged) ====================
const DROPDOWN_STYLE = {
  padding: '5px 0px',
  fontSize: '12px',
  fontWeight: 'bold',
  border: 'solid 1px #000000',
  borderRadius: '7px',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
};

const TOOLTIP_STYLE = { backgroundColor: '#f9f9f9', border: '1px solid #bebebe' };

const TABLE_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#ffffff',
  overflow: 'hidden'
};

const TABLE_SCROLL_STYLE = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'block'
};

const TABLE_STYLE = {
  width: 'auto',
  minWidth: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
  fontFamily: 'Arial, sans-serif',
  backgroundColor: '#ffffff'
};

const TABLE_THEAD_STYLE = { position: 'sticky', top: 0, zIndex: 10 };

const TABLE_HEADER_ROW_STYLE = {
  backgroundColor: '#4169a5',
  color: '#ffffff',
  fontWeight: 'bold',
  textAlign: 'center'
};

const TH_STYLE_BASE = { padding: '10px 12px', border: '1px solid #4169a5' };
const TH_STYLE_80 = { ...TH_STYLE_BASE, minWidth: '80px' };
const TH_STYLE_100 = { ...TH_STYLE_BASE, minWidth: '100px' };
const TH_STYLE_110 = { ...TH_STYLE_BASE, minWidth: '110px' };

const TD_STYLE_BASE = { padding: '10px 12px', border: '1px solid #ddd', textAlign: 'center' };
const TD_STYLE_80 = { ...TD_STYLE_BASE, minWidth: '80px' };
const TD_STYLE_80_BOLD = { ...TD_STYLE_80, fontWeight: 'bold' };
const TD_STYLE_100 = { ...TD_STYLE_BASE, minWidth: '100px' };
const TD_STYLE_110 = { ...TD_STYLE_BASE, minWidth: '110px' };

const LEGEND_CONSUMED_STYLE = {
  position: 'absolute', top: 0, right: 10, zIndex: 10,
  display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 'bold',
  backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px'
};

const LEGEND_FORECAST_STYLE = {
  position: 'absolute', top: 0, right: 10, zIndex: 10,
  display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '9px', fontWeight: 'bold',
  backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', maxWidth: '60%'
};

const SCROLL_CONTAINER_STYLE = { width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden' };
const RELATIVE_CONTAINER_STYLE = { width: '100%', height: '100%', position: 'relative' };

// ==================== HELPER FUNCTIONS ====================

// 🔧 Optimization 1: Cache parseCellValue results
const parseCellValueCache = new Map();

const parseCellValue = (cellValue) => {
  if (!cellValue) return { displayValue: '', mode: null };

  if (parseCellValueCache.has(cellValue)) {
    return parseCellValueCache.get(cellValue);
  }

  let result;
  const greenMatch = cellValue.match(GREEN_REGEX);
  const orangeMatch = cellValue.match(ORANGE_REGEX);

  if (greenMatch) result = { displayValue: greenMatch[1].trim(), mode: 'single' };
  else if (orangeMatch) result = { displayValue: orangeMatch[1].trim(), mode: 'double' };
  else result = { displayValue: cellValue, mode: null };

  // Limit cache size to prevent memory leaks
  if (parseCellValueCache.size > 5000) {
    parseCellValueCache.clear();
  }
  parseCellValueCache.set(cellValue, result);
  return result;
};

const extractYear = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;

  const fourDigitMatch = dateString.match(/\b(19|20)\d{2}\b/);
  if (fourDigitMatch) return fourDigitMatch[0];

  const allMatches = dateString.match(/\b(\d{2})\b/g);
  if (allMatches && allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1];
    let yearNum = parseInt(lastMatch);
    if (yearNum >= 0 && yearNum <= 99) {
      yearNum = yearNum <= 50 ? 2000 + yearNum : 1900 + yearNum;
      return yearNum.toString();
    }
  }
  return null;
};

// 🔧 Optimization 2: Tooltip formatter extracted as stable reference
const tooltipFormatter = (value) => value;

// ==================== CUSTOM TICK COMPONENT ====================

const CustomXAxisTick = memo(({ x, y, payload }) => {
  const maxCharsPerLine = 10;
  const text = payload.value || '';

  // 🔧 Optimization 3: Memoize line splitting logic
  const lines = useMemo(() => {
    const words = text.split(/[\s\-]+/);
    const result = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) result.push(currentLine);
    return result;
  }, [text]);

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={index}
          x={0}
          y={0}
          dy={12 + index * 12}
          textAnchor="middle"
          fill="#000000"
          fontSize={9}
          fontWeight="900"
        >
          {line}
        </text>
      ))}
    </g>
  );
});

CustomXAxisTick.displayName = 'CustomXAxisTick';

// ==================== MAIN COMPONENT ====================

function RobotBarChart({ tableData, chartPosition = { width: 960, height: 412, top: 0, left: 0 }, setSelectedCols, setIsFilterActive }) {
  const [selectedGraph, setSelectedGraph] = useState('available');
  const [poolNewEntryValues, setPoolNewEntryValues] = useState({});
  const [activeFilterName, setActiveFilterName] = useState(null);

  // 🔧 Optimization 4: Use ref to track if component is mounted (avoid state updates after unmount)
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // 🔧 Optimization 5: Use AbortController for fetch cleanup
  useEffect(() => {
    const controller = new AbortController();

    const loadPoolNewEntryValues = async () => {
      try {
        const savedLocally = localStorage.getItem('poolNewEntryValues');
        if (savedLocally) {
          try {
            const localValues = JSON.parse(savedLocally);
            if (isMountedRef.current) setPoolNewEntryValues(localValues);
          } catch (e) {
            console.warn('Failed to parse localStorage poolNewEntryValues');
          }
        }

        const response = await fetch(addRegionParam(API_ENDPOINTS.GET_SUMMARY4), {
          signal: controller.signal
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const poolValues = {};
            result.data.forEach(row => {
              if (row.poolNewEntry) {
                poolValues[row.year] = row.poolNewEntry;
              }
            });
            if (Object.keys(poolValues).length > 0 && isMountedRef.current) {
              setPoolNewEntryValues(poolValues);
              localStorage.setItem('poolNewEntryValues', JSON.stringify(poolValues));
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error loading Pool New Entry values:', error);
        }
      }
    };
    loadPoolNewEntryValues();

    return () => controller.abort();
  }, []);

  // 🔧 Optimization 6: Stable reference for handleBarClick using ref for activeFilterName
  const activeFilterNameRef = useRef(activeFilterName);
  activeFilterNameRef.current = activeFilterName;

  const handleBarClick = useCallback((clickedName) => {
    if (!tableData || tableData.length < 2 || !setSelectedCols) return;

    if (activeFilterNameRef.current === clickedName) {
      setSelectedCols(new Set());
      setActiveFilterName(null);
      if (setIsFilterActive) setIsFilterActive(false);
      return;
    }

    const matchingCols = new Set();
    const row = tableData[1];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellValue = row[colIndex];
      if (cellValue && cellValue.trim() === clickedName) {
        matchingCols.add(colIndex);
      }
    }

    if (matchingCols.size > 0) {
      setSelectedCols(matchingCols);
      setActiveFilterName(clickedName);
      if (setIsFilterActive) setIsFilterActive(true);
    }
  }, [tableData, setSelectedCols, setIsFilterActive]);

  // 🔧 Optimization 7: Precompute row12 values once for all columns (used by multiple computations)
  const row12ValuesMap = useMemo(() => {
    if (!tableData || tableData.length <= 13) return null;

    const map = new Map();
    const robotStandardRow = tableData[1];
    if (!robotStandardRow) return map;

    for (let colIndex = 9; colIndex < robotStandardRow.length; colIndex++) {
      const row8Value = parseFloat(tableData[7]?.[colIndex]) || 0;
      const row9Value = parseFloat(tableData[8]?.[colIndex]) || 0;
      const row10Value = parseFloat(tableData[9]?.[colIndex]) || 0;
      const row11Value = parseFloat(tableData[10]?.[colIndex]) || 0;

      let sumOfRows14Plus = 0;
      for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
        const rawValue = tableData[rowIndex]?.[colIndex];
        const parsed = parseCellValue(rawValue);
        sumOfRows14Plus += parseFloat(parsed.displayValue) || 0;
      }

      map.set(colIndex, row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus);
    }
    return map;
  }, [tableData]);

  // 🔧 Optimization 8: Precompute per-row reused/new robots (used by consumed + yearly)
  const rowRobotData = useMemo(() => {
    if (!tableData || tableData.length <= 13) return null;

    const data = new Map();
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      if (!row) continue;

      let reusedRobots = 0;
      for (let colIndex = 9; colIndex < row.length; colIndex++) {
        const cellValue = row[colIndex];
        const parsed = parseCellValue(cellValue);
        const numValue = parseFloat(parsed.displayValue);
        if (!isNaN(numValue)) {
          reusedRobots += numValue;
        }
      }
      reusedRobots = Math.max(0, reusedRobots);

      const totalRobots = parseFloat(row[5]) || 0;
      const newRobots = Math.max(0, totalRobots - reusedRobots);

      data.set(rowIndex, { reusedRobots, newRobots, totalRobots });
    }
    return data;
  }, [tableData]);

  // Available chart data
  const chartData = useMemo(() => {
    if (selectedGraph !== 'available' || !row12ValuesMap || !tableData) return [];

    const robotStandardRow = tableData[1];
    const aggregatedData = new Map();

    for (let colIndex = 9; colIndex < robotStandardRow.length; colIndex++) {
      const robotStandard = robotStandardRow[colIndex];
      if (!robotStandard || robotStandard.trim() === '') continue;

      const name = robotStandard.trim();
      const totalRobots = row12ValuesMap.get(colIndex) || 0;
aggregatedData.set(name, (aggregatedData.get(name) || 0) + totalRobots);
    }

    const result = [];
    aggregatedData.forEach((total, name) => {
      result.push({
        name,
        total,
        color: COLORS[result.length % COLORS.length]
      });
    });

    return result;
  }, [selectedGraph, row12ValuesMap, tableData]);

  // Consumed chart data
  const consumedChartData = useMemo(() => {
    if (selectedGraph !== 'consumed' || !rowRobotData || !tableData) return [];

    const dataMap = new Map();
    const currentYear = new Date().getFullYear().toString();

    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      const forecastPlant = row?.[0]?.trim();
      const onsiteDeliveryDate = row?.[3]?.trim();

      if (!forecastPlant) continue;

      const robotData = rowRobotData.get(rowIndex);
      if (!robotData) continue;

      const { reusedRobots, newRobots } = robotData;
      const totalRobots = reusedRobots + newRobots;
      if (totalRobots === 0) continue;

      const year = extractYear(onsiteDeliveryDate) || currentYear;
      const key = `${year}|${forecastPlant}`;

      if (dataMap.has(key)) {
        const existing = dataMap.get(key);
        existing.reusedRobots += reusedRobots;
        existing.newRobots += newRobots;
        existing.totalRobots += totalRobots;
      } else {
        dataMap.set(key, {
          name: `${year} - ${forecastPlant}`,
          year,
          forecastPlant,
          reusedRobots,
          newRobots,
          totalRobots
        });
      }
    }

    const result = Array.from(dataMap.values());
    result.sort((a, b) => {
      const yearCompare = a.year.localeCompare(b.year);
      if (yearCompare !== 0) return yearCompare;
      return a.forecastPlant.localeCompare(b.forecastPlant);
    });

    return result;
  }, [tableData, selectedGraph, rowRobotData]);

  // Forecast chart data
  const forecastChartData = useMemo(() => {
    if (selectedGraph !== 'forecast' || !tableData || tableData.length <= 13) return [];

    const dataMap = new Map();

    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      const forecastPlant = row?.[0]?.trim();
      if (!forecastPlant) continue;

      if (!dataMap.has(forecastPlant)) {
        dataMap.set(forecastPlant, { forecastPlant });
      }

      const plantData = dataMap.get(forecastPlant);

      for (let colIndex = 9; colIndex < row.length; colIndex++) {
        const robotStandard = tableData[1]?.[colIndex];
        const standardName = robotStandard?.trim();
        if (!standardName) continue;

        const cellValue = row[colIndex] || '';
        const parsed = parseCellValue(cellValue);
        const numValue = parseFloat(parsed.displayValue) || 0;

        if (numValue > 0) {
          plantData[standardName] = (plantData[standardName] || 0) + numValue;
        }
      }
    }

    return Array.from(dataMap.values());
  }, [tableData, selectedGraph]);

  // Unique robot standards from forecast data
  const uniqueRobotStandardsFromData = useMemo(() => {
    if (!forecastChartData || forecastChartData.length === 0) return [];

    const standards = new Set();
    for (const dataPoint of forecastChartData) {
      for (const key in dataPoint) {
        if (key !== 'forecastPlant') {
          standards.add(key);
        }
      }
    }
    return Array.from(standards);
  }, [forecastChartData]);

  // Yearly summary data
  const yearlySummaryData = useMemo(() => {
    if ((selectedGraph !== 'yearly' && selectedGraph !== 'yearly-table') || !tableData || tableData.length <= 13) return [];

    const yearMap = {};

    // Process columns for available stock and scraps
    const startCol = 9;
    let lastCol = startCol;
    const stockPlantRow = tableData[0];

    if (stockPlantRow) {
      for (let col = startCol; col < stockPlantRow.length; col++) {
        if (stockPlantRow[col] && stockPlantRow[col].trim() !== '') {
          lastCol = col;
        }
      }
    }

    for (let col = startCol; col <= lastCol; col++) {
      const planName = stockPlantRow?.[col] || '';
      if (planName.trim() === '') continue;

      const runOutDate = tableData[5]?.[col] || '';
      let year = extractYear(runOutDate);
      if (!year) year = extractYear(planName);
      if (!year) continue;

      if (!yearMap[year]) {
        yearMap[year] = { year, availableStock: 0, expectedRobots: 0, robotsInUse: 0, scraps: 0, freeRobots: 0 };
      }

      const availableStockValue = row12ValuesMap?.get(col) || 0;
      yearMap[year].availableStock += availableStockValue;

      const scrapsValue = parseFloat(tableData[9]?.[col]) || 0;
      yearMap[year].scraps += scrapsValue;
    }

    // Process rows 13+ for expected robots and robots in use
    for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      if (!row?.[0]?.trim()) continue;

      let year = extractYear(row?.[3] || '');
      if (!year) year = extractYear(row?.[1] || '');
      if (!year) year = extractYear(row?.[2] || '');
      if (!year) year = extractYear(row?.[4] || '');
      if (!year) year = 'Undated';

      if (!yearMap[year]) {
        yearMap[year] = { year, availableStock: 0, expectedRobots: 0, robotsInUse: 0, scraps: 0, freeRobots: 0 };
      }

      const robotData = rowRobotData?.get(rowIndex);
      if (robotData) {
        yearMap[year].expectedRobots += robotData.reusedRobots + robotData.newRobots;
        yearMap[year].robotsInUse += robotData.reusedRobots;
      }
    }

    const data = Object.values(yearMap).sort((a, b) => {
      const yearA = parseInt(a.year);
      const yearB = parseInt(b.year);
      if (!isNaN(yearA) && !isNaN(yearB)) return yearA - yearB;
      return a.year.localeCompare(b.year);
    });

    data.forEach(item => {
      item.freeRobots = Math.max(0, item.availableStock - item.expectedRobots - item.scraps);
    });

    return data;
  }, [tableData, selectedGraph, row12ValuesMap, rowRobotData]);

  // Filtered chart data for available graph
  const filteredChartData = useMemo(() => {
    return chartData.filter(entry => entry.total > 0);
  }, [chartData]);

  // Filtered forecast data// Filtered forecast data
const filteredForecastData = useMemo(() => {
  return forecastChartData
    .filter(dataPoint => {
      for (const std of uniqueRobotStandardsFromData) {
        if (dataPoint[std] > 0) return true;
      }
      return false;
    })
    .map(dataPoint => {
      const total = uniqueRobotStandardsFromData.reduce((sum, std) => sum + (dataPoint[std] || 0), 0);
      return { ...dataPoint, _total: total };
    })
    .sort((a, b) => b._total - a._total);
}, [forecastChartData, uniqueRobotStandardsFromData]);

  // 🔧 Optimization 9: Stable label renderers using refs to avoid recreating on every data change
  const consumedChartDataRef = useRef(consumedChartData);
  consumedChartDataRef.current = consumedChartData;

  const renderTotalLabel = useCallback((props) => {
    const { x, y, width, index } = props;
    const entry = consumedChartDataRef.current[index];
    const total = (entry?.reusedRobots || 0) + (entry?.newRobots || 0);
    if (total === 0) return null;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#333" fontSize={11} fontWeight="bold">
        {total}
      </text>
    );
  }, []);

  const filteredForecastDataRef = useRef(filteredForecastData);
  filteredForecastDataRef.current = filteredForecastData;

  const uniqueStandardsRef = useRef(uniqueRobotStandardsFromData);
  uniqueStandardsRef.current = uniqueRobotStandardsFromData;

  const renderForecastTotalLabel = useCallback((props) => {
    const { x, y, width, index } = props;
    const dataPoint = filteredForecastDataRef.current[index];
    const total = uniqueStandardsRef.current.reduce((sum, std) => sum + (dataPoint[std] || 0), 0);
    if (total === 0) return null;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#333" fontSize={11} fontWeight="bold">
        {total}
      </text>
    );
  }, []);

  // Dropdown change handler
  const handleGraphChange = useCallback((e) => {
    setSelectedGraph(e.target.value);
  }, []);

  // Container style
  const containerStyle = useMemo(() => ({
    width: `${chartPosition.width}px`,
    height: `${chartPosition.height}px`,
    top: `${chartPosition.top}px`,
    left: typeof chartPosition.left === 'number' ? `${chartPosition.left}px` : chartPosition.left,
    position: 'absolute'
  }), [chartPosition.width, chartPosition.height, chartPosition.top, chartPosition.left]);

  // Chart widths
  const consumedChartWidth = useMemo(() => {
    return `${Math.max(100, consumedChartData.length * 70)}px`;
  }, [consumedChartData.length]);

  const forecastChartWidth = useMemo(() => {
    return `${Math.max(100, filteredForecastData.length * 70)}px`;
  }, [filteredForecastData.length]);

  // ==================== RENDER ====================
  // 🔧 Optimization 10: Only render the active chart (already done, but ensure no hidden computation)

  return (
    <div className="robot-bar-chart-container" style={containerStyle}>
      <div style={{ position: 'absolute', top: '-7.5%', right: '0px', zIndex: 1000, border: 'none' }}>
        <select value={selectedGraph} onChange={handleGraphChange} style={DROPDOWN_STYLE}>
          <option value="available">Available Robots</option>
          <option value="consumed">Forecast</option>
          <option value="forecast">Consumed</option>
          <option value="yearly-table">Yearly Summary Table</option>
        </select>
      </div>

      <div className="chart-content">
        {selectedGraph === 'available' && (
          <AvailableChart filteredChartData={filteredChartData} handleBarClick={handleBarClick} />
        )}
        {selectedGraph === 'consumed' && (
          <ConsumedChart
            consumedChartData={consumedChartData}
            consumedChartWidth={consumedChartWidth}
            renderTotalLabel={renderTotalLabel}
          />
        )}
        {selectedGraph === 'yearly' && (
          <YearlyChart yearlySummaryData={yearlySummaryData} />
        )}
        {selectedGraph === 'yearly-table' && (
          <YearlyTable yearlySummaryData={yearlySummaryData} poolNewEntryValues={poolNewEntryValues} />
        )}
        {selectedGraph === 'forecast' && (
          <ForecastChart
            filteredForecastData={filteredForecastData}
            uniqueRobotStandardsFromData={uniqueRobotStandardsFromData}
            forecastChartWidth={forecastChartWidth}
            renderForecastTotalLabel={renderForecastTotalLabel}
          />
        )}
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS (memoized) ====================

const AvailableChart = memo(({ filteredChartData, handleBarClick }) => {
  if (filteredChartData.length === 0) {
    return <div className="no-data-message">No robot data to display</div>;
  }

  // 🔧 Optimization 11: Memoize disparity check
  const hasLargeDisparity = useMemo(() => {
    const values = filteredChartData.map(d => d.total).filter(v => v > 0);
    if (values.length < 2) return false;
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    return maxVal / minVal > 50;
  }, [filteredChartData]);

  // 🔧 Optimization 12: Stable onClick handler
  const handleChartClick = useCallback((state) => {
    if (state && state.activeTooltipIndex !== undefined && filteredChartData[state.activeTooltipIndex]) {
      handleBarClick(filteredChartData[state.activeTooltipIndex].name);
    }
  }, [filteredChartData, handleBarClick]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={filteredChartData}
        margin={{ top: 15, right: 0, left: 0, bottom: -4 }}
        barCategoryGap="0%"
        onClick={handleChartClick}
      >
        <XAxis dataKey="name" axisLine={true} tickLine={false} height={20} tick={false} />
        <YAxis
          width={40}
          axisLine={true}
          scale={hasLargeDisparity ? "log" : "auto"}
          domain={hasLargeDisparity ? ['auto', 'auto'] : [0, 'auto']}
          allowDataOverflow={hasLargeDisparity}
        />
        <Tooltip formatter={tooltipFormatter} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="total" fill="#8884d8" radius={[8, 8, 0, 0]} maxBarSize={60} minPointSize={20}>
          {filteredChartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              onClick={() => handleBarClick(entry.name)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          <LabelList dataKey="name" position="center" angle={0} fill="#fff7f7" fontSize={10} fontWeight="bold" />
          <LabelList dataKey="total" position="top" fill="#333" fontSize={11} fontWeight="bold" />
            </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
AvailableChart.displayName = 'AvailableChart';

const ConsumedChart = memo(({ consumedChartData, consumedChartWidth, renderTotalLabel }) => {
  if (consumedChartData.length === 0) {
    return <div className="no-data-message">No consumed robot data to display</div>;
  }

  return (
    <div style={RELATIVE_CONTAINER_STYLE}>
      <div style={LEGEND_CONSUMED_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#c03308', borderRadius: '2px' }}></div>
          <span>Reused Robots</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#0e3b8f', borderRadius: '2px' }}></div>
          <span>New Robots</span>
        </div>
      </div>

      <div style={SCROLL_CONTAINER_STYLE}>
        <div style={{ width: consumedChartWidth, height: '100%', minWidth: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consumedChartData} margin={{ top: 25, right: 30, left: -10, bottom: 10 }} barCategoryGap="2%">
              <XAxis
                dataKey="name"
                tick={<CustomXAxisTick />}
                textAnchor="middle"
                height={50}
                interval={0}
                tickLine={false}
              />
              <YAxis width={40} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFormatter} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="reusedRobots" stackId="robots" fill="#c03308" name="Reused Robots" maxBarSize={60} minPointSize={10}>
                <LabelList dataKey="reusedRobots" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" offset={0} />
              </Bar>
              <Bar dataKey="newRobots" stackId="robots" fill="#0e3b8f" name="New Robots" radius={[4, 4, 0, 0]} maxBarSize={60}>
                <LabelList dataKey="newRobots" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" offset={0} />
                <LabelList content={renderTotalLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});
ConsumedChart.displayName = 'ConsumedChart';

const YearlyChart = memo(({ yearlySummaryData }) => {
  if (yearlySummaryData.length === 0) {
    return <div className="no-data-message">No yearly summary data to display</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={yearlySummaryData} margin={{ top: 15, right: 20, left: -12, bottom: 20 }} barCategoryGap="15%">
        <XAxis dataKey="year" tick={{ fontSize: 10 }} />
        <YAxis width={40} tick={{ fontSize: 10 }} />
        <Tooltip formatter={tooltipFormatter} contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ margin: '-10px', display: 'flex', justifyContent: 'center' }} />
        <Bar dataKey="availableStock" fill="#65c489" name="Available Stock" minPointSize={10} maxBarSize={60}>
          <LabelList dataKey="availableStock" position="top" fill="#333" fontSize={10} fontWeight="bold" />
        </Bar>
        <Bar dataKey="expectedRobots" fill="#ffc658" name="Expected Robots" maxBarSize={60}>
          <LabelList dataKey="expectedRobots" position="top" fill="#333" fontSize={10} fontWeight="bold" />
        </Bar>
        <Bar dataKey="robotsInUse" fill="#ff7c7c" name="Robots in Use" maxBarSize={60}>
          <LabelList dataKey="robotsInUse" position="top" fill="#333" fontSize={10} fontWeight="bold" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
YearlyChart.displayName = 'YearlyChart';

// 🔧 Optimization 13: Memoize table row styles
const getRowStyle = (idx) => ({
  backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#ffffff',
  borderBottom: '1px solid #ddd'
});

const YearlyTable = memo(({ yearlySummaryData, poolNewEntryValues }) => {
  if (yearlySummaryData.length === 0) {
    return <div className="no-data-message">No yearly summary data to display</div>;
  }

  return (
    <div style={TABLE_CONTAINER_STYLE}>
      <div style={TABLE_SCROLL_STYLE}>
        <table style={TABLE_STYLE}>
          <thead style={TABLE_THEAD_STYLE}>
            <tr style={TABLE_HEADER_ROW_STYLE}>
              <th style={TH_STYLE_80}>Year</th>
              <th style={TH_STYLE_110}>Available Stock</th>
              <th style={TH_STYLE_110}>Pool New Entry</th>
              <th style={TH_STYLE_110}>Expected Robots</th>
              <th style={TH_STYLE_110}>Robots in Use</th>
              <th style={TH_STYLE_80}>Scraps</th>
              <th style={TH_STYLE_100}>Free Robots</th>
            </tr>
          </thead>
          <tbody>
            {yearlySummaryData.map((row, idx) => (
              <YearlyTableRow
                key={row.year}
                row={row}
                idx={idx}
                poolNewEntryValue={poolNewEntryValues[row.year]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
YearlyTable.displayName = 'YearlyTable';

// 🔧 Optimization 14: Memoized table row to prevent re-renders of unchanged rows
const YearlyTableRow = memo(({ row, idx, poolNewEntryValue }) => (
  <tr style={getRowStyle(idx)}>
    <td style={TD_STYLE_80_BOLD}>{row.year}</td>
    <td style={TD_STYLE_110}>{row.availableStock}</td>
    <td style={TD_STYLE_110}>{poolNewEntryValue || ''}</td>
    <td style={TD_STYLE_110}>{row.expectedRobots}</td>
    <td style={TD_STYLE_110}>{row.robotsInUse}</td>
    <td style={TD_STYLE_80}>{row.scraps || 0}</td>
    <td style={TD_STYLE_100}>{row.freeRobots || 0}</td>
  </tr>
));
YearlyTableRow.displayName = 'YearlyTableRow';

const ForecastChart = memo(({ filteredForecastData, uniqueRobotStandardsFromData, forecastChartWidth }) => {
  if (filteredForecastData.length === 0) {
    return <div className="no-data-message">No forecast robot data to display</div>;
  }

  const legendItems = useMemo(() => (
    uniqueRobotStandardsFromData.map((standard, idx) => (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          backgroundColor: D_COLORS[idx % D_COLORS.length],
          borderRadius: '2px',
          flexShrink: 0
        }}></div>
        <span style={{ whiteSpace: 'nowrap' }}>{standard}</span>
      </div>
    ))
  ), [uniqueRobotStandardsFromData]);

  return (
    <div style={RELATIVE_CONTAINER_STYLE}>
      <div style={LEGEND_FORECAST_STYLE}>
        {legendItems}
      </div>

      <div style={SCROLL_CONTAINER_STYLE}>
        <div style={{ width: forecastChartWidth, height: '100%', minWidth: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredForecastData} margin={{ top: 25, right: 2, left: -12, bottom: 10 }} barCategoryGap="2%">
              <XAxis
                dataKey="forecastPlant"
                tick={<CustomXAxisTick />}
                textAnchor="middle"
                height={50}
                interval={0}
                tickLine={false}
              />
              <YAxis width={40} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === '_calculatedTotal') return null;
                  return value;
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              {uniqueRobotStandardsFromData.map((standard, idx) => (
                <Bar
                  key={`bar-${standard}`}
                  dataKey={standard}
                  stackId="robots"
                  fill={D_COLORS[idx % D_COLORS.length]}
                  name={standard}
                  maxBarSize={60}
                >
                  <LabelList
                    dataKey={standard}
                    position="center"
                    fill="#000000"
                    fontSize={10}
                    fontWeight="bold"
                    offset={0}
                    formatter={(value) => (value > 0 ? value : '')}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});
ForecastChart.displayName = 'ForecastChart';
// ==================== CUSTOM MEMO COMPARISON ====================

const arePropsEqual = (prevProps, nextProps) => {
  // Shallow compare chartPosition
  const prevPos = prevProps.chartPosition;
  const nextPos = nextProps.chartPosition;
  if (prevPos.width !== nextPos.width || prevPos.height !== nextPos.height ||
      prevPos.top !== nextPos.top || prevPos.left !== nextPos.left) {
    return false;
  }

  // 🔧 Optimization 17: Check function reference equality first (cheap check)
  if (prevProps.setSelectedCols !== nextProps.setSelectedCols ||
      prevProps.setIsFilterActive !== nextProps.setIsFilterActive) {
    return false;
  }

  const prevData = prevProps.tableData;
  const nextData = nextProps.tableData;

  // 🔧 Optimization 18: Reference equality check first (most common case when data hasn't changed)
  if (prevData === nextData) return true;

  if (!prevData && !nextData) return true;
  if (!prevData || !nextData) return false;
  if (prevData.length !== nextData.length) return false;

  // Check row 1 (index 1): robot standards - only columns 9+
  {
    const prevRow = prevData[1] || [];
    const nextRow = nextData[1] || [];
    if (prevRow !== nextRow) {
      const maxLen = Math.max(prevRow.length, nextRow.length);
      for (let i = 9; i < maxLen; i++) {
        if ((prevRow[i] || '') !== (nextRow[i] || '')) return false;
      }
    }
  }

  // Check rows 7-10 (indices 7-10): formula inputs - only columns 9+
  for (let row = 7; row <= 10; row++) {
    const prevRow = prevData[row] || [];
    const nextRow = nextData[row] || [];
    if (prevRow === nextRow) continue;
    const maxLen = Math.max(prevRow.length, nextRow.length);
    for (let i = 9; i < maxLen; i++) {
      if ((prevRow[i] || '') !== (nextRow[i] || '')) return false;
    }
  }

  // Check rows 13+ (all data rows): all columns
  const maxRows = Math.max(prevData.length, nextData.length);
  for (let row = 13; row < maxRows; row++) {
    const prevRow = prevData[row];
    const nextRow = nextData[row];

    if (prevRow === nextRow) continue;
    if (!prevRow && !nextRow) continue;
    if (!prevRow || !nextRow) return false;

    const maxLen = Math.max(prevRow.length, nextRow.length);
    for (let i = 0; i < maxLen; i++) {
      if ((prevRow[i] || '') !== (nextRow[i] || '')) return false;
    }
  }

  return true;
};

export default memo(RobotBarChart, arePropsEqual);