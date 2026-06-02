// import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, memo } from 'react';
// import './table.css';

// const MIN_COL_WIDTH = 80;
// const ROW_HEADER_WIDTH = 50;
// const FROZEN_COLS = 9;
// const SCROLLABLE_COL_WIDTH = 150;

// // ===== ROW VIRTUALIZATION CONSTANTS =====
// const ROW_HEIGHT = 32;
// const OVERSCAN = 5;
// const STICKY_ROWS = 13;

// // Pre-computed style constants
// const SMART_VIEW_CELL_STYLE = Object.freeze({
//   whiteSpace: 'pre-wrap',
//   fontSize: '9px',
//   lineHeight: '1.2',
//   padding: '2px',
//   textAlign: 'center',
//   fontWeight: 'bold',
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'center',
//   overflow: 'hidden'
// });

// const CALCULATED_CELL_STYLE = Object.freeze({
//   fontWeight: 'bold',
//   borderRadius: '0px',
//   width: '100%',
//   boxSizing: 'border-box',
//   height: '100%',
//   marginLeft: '-2.5px'
// });

// const DATE_WRAPPER_STYLE = Object.freeze({
//   cursor: 'pointer',
//   padding: '4px'
// });

// // LRU Cache for expensive parser operations
// class ParserCache {
//   constructor(maxSize = 500) {
//     this.cache = new Map();
//     this.maxSize = maxSize;
//   }

//   get(key) {
//     if (!this.cache.has(key)) return undefined;
//     const value = this.cache.get(key);
//     this.cache.delete(key);
//     this.cache.set(key, value);
//     return value;
//   }

//   set(key, value) {
//     if (this.cache.has(key)) {
//       this.cache.delete(key);
//     } else if (this.cache.size >= this.maxSize) {
//       const oldestKey = this.cache.keys().next().value;
//       this.cache.delete(oldestKey);
//     }
//     this.cache.set(key, value);
//   }

//   clear() {
//     this.cache.clear();
//   }
// }

// const parserCacheInstance = new ParserCache();

// // ===== COLUMN VIRTUALIZATION HOOK =====
// const useVirtualCols = (totalCols, containerRef, colWidth = SCROLLABLE_COL_WIDTH) => {
//   const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(totalCols, 15) });

//   useEffect(() => {
//     const container = containerRef.current;
//     if (!container) return;

//     let rafId = null;

//     const updateVisibleRange = () => {
//       const scrollLeft = container.scrollLeft;
//       const viewportWidth = container.clientWidth;

//       // Calculate which columns are visible using actual column width
//       const start = Math.max(0, Math.floor(scrollLeft / colWidth) - 2); // overscan left
//       const visibleCount = Math.ceil(viewportWidth / colWidth) + 4; // overscan both sides
//       const end = Math.min(totalCols, start + visibleCount);

//       setVisibleRange(prev => {
//         if (prev.start === start && prev.end === end) return prev;
//         return { start, end };
//       });
//     };

//     const handleScroll = () => {
//       if (rafId) cancelAnimationFrame(rafId);
//       rafId = requestAnimationFrame(updateVisibleRange);
//     };

//     updateVisibleRange();
//     container.addEventListener('scroll', handleScroll, { passive: true });

//     return () => {
//       container.removeEventListener('scroll', handleScroll);
//       if (rafId) cancelAnimationFrame(rafId);
//     };
//   }, [totalCols, containerRef, colWidth]);

//   return visibleRange;
// };

// // ===== ROW VIRTUALIZATION HOOK =====
// const useVirtualRows = (totalRows, containerRef) => {
//   const [visibleRange, setVisibleRange] = useState({ start: STICKY_ROWS, end: STICKY_ROWS + 50 });

//   useEffect(() => {
//     const container = containerRef.current;
//     if (!container) return;

//     let rafId = null;

//     const updateVisibleRange = () => {
//       const scrollTop = container.scrollTop;
//       const viewportHeight = container.clientHeight;
//       const stickyHeight = STICKY_ROWS * ROW_HEIGHT;

//       const adjustedScrollTop = Math.max(0, scrollTop - stickyHeight);
//       const start = Math.max(STICKY_ROWS, Math.floor(adjustedScrollTop / ROW_HEIGHT) + STICKY_ROWS - OVERSCAN);
//       const end = Math.min(totalRows, start + Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);

//       setVisibleRange(prev => {
//         if (prev.start === start && prev.end === end) return prev;
//         return { start, end };
//       });
//     };

//     const handleScroll = () => {
//       if (rafId) cancelAnimationFrame(rafId);
//       rafId = requestAnimationFrame(updateVisibleRange);
//     };

//     updateVisibleRange();
//     container.addEventListener('scroll', handleScroll, { passive: true });

//     return () => {
//       container.removeEventListener('scroll', handleScroll);
//       if (rafId) cancelAnimationFrame(rafId);
//     };
//   }, [totalRows, containerRef]);

//   return visibleRange;
// };

// // ===== EDITABLE CELL COMPONENT (FIXED - debounced live updates, no typing lag) =====
// const EditableCell = memo(({ 
//   initialValue, 
//   onCommit, 
//   onKeyDown, 
//   onClick, 
//   onContextMenu, 
//   disabled, 
//   className, 
//   style, 
//   title 
// }) => {
//   const [localValue, setLocalValue] = useState(initialValue);
//   const prevInitialRef = useRef(initialValue);
//   const localValueRef = useRef(localValue);

//   // Keep ref in sync with local state
//   useEffect(() => {
//     localValueRef.current = localValue;
//   }, [localValue]);

//   // Only sync when initialValue ACTUALLY changes from outside (undo/redo, sort, etc.)
//   useEffect(() => {
//     if (prevInitialRef.current !== initialValue) {
//       prevInitialRef.current = initialValue;
//       setLocalValue(initialValue);
//     }
//   }, [initialValue]);

//   // Type in cell - updates local state immediately
//   const handleChange = useCallback((e) => {
//     setLocalValue(e.target.value);
//   }, []);

//   // On blur - commit to parent if value changed
//   const handleBlur = useCallback(() => {
//     const current = localValueRef.current;
//     if (current !== prevInitialRef.current) {
//       prevInitialRef.current = current;
//       onCommit(current);
//     }
//   }, [onCommit]);

//   // On key down - handle navigation keys
//   const handleKeyDown = useCallback((e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       const current = localValueRef.current;
//       if (current !== prevInitialRef.current) {
//         prevInitialRef.current = current;
//         onCommit(current);
//       }
//       onKeyDown?.(e);
//     } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
//       const current = localValueRef.current;
//       if (current !== prevInitialRef.current) {
//         prevInitialRef.current = current;
//         onCommit(current);
//       }
//       onKeyDown?.(e);
//     } else if (e.key === 'Tab') {
//       const current = localValueRef.current;
//       if (current !== prevInitialRef.current) {
//         prevInitialRef.current = current;
//         onCommit(current);
//       }
//     }
//     // All other keys (regular typing) - let input handle them naturally
//   }, [onCommit, onKeyDown]);

//   return (
//     <input
//       type="text"
//       value={localValue}
//       onChange={handleChange}
//       onBlur={handleBlur}
//       onKeyDown={handleKeyDown}
//       onClick={onClick}
//       onContextMenu={onContextMenu}
//       disabled={disabled}
//       className={className}
//       style={style}
//       title={title}
//     />
//   );
// }, (prevProps, nextProps) => {
//   // Custom memo: only re-render if these specific props change
//   return (
//     prevProps.initialValue === nextProps.initialValue &&
//     prevProps.disabled === nextProps.disabled &&
//     prevProps.className === nextProps.className &&
//     prevProps.title === nextProps.title &&
//     prevProps.style === nextProps.style &&
//     prevProps.onCommit === nextProps.onCommit &&
//     prevProps.onKeyDown === nextProps.onKeyDown
//   );
// });

// EditableCell.displayName = 'EditableCell';

// // ===== SCROLLABLE TABLE CELL (FIXED - proper save + live calculations) =====
// const ScrollableTableCell = memo(({
//   rowIndex, colIndex, isSmartView, isViewer, isRowSelected, isColSelected,
//   onCellClick, onCellContextMenu,
//   handleCellKeyDown, editingCellRef,
//   isColumnAFilled, isRow1FilledForColumn, getColWidth,
//   isDateCell: isDateCellFn, isDropdownCell: isDropdownCellFn,
//   getDropdownOptionsWithCustom, handleCellChangeWithTracking, handleCellBlurWithTracking,
//   parseCellValue, getCellBackgroundColor, hasColoredBackground, shouldCellBeRed,
//   convertToDateInput, convertFromDateInput, getCalculateRow12Value, getSmartViewRow13Values,
//   getCalculateColGValue, getCalculateColHValue, isFilterActive, tableDataRef,
//   setEditingCell, cellValue, row12Values, colGValues, colHValues
// }) => {
//   const actualColIndex = FROZEN_COLS + colIndex;
//   const isHidden = isFilterActive && !isColSelected;

//   // Check editing state from ref (doesn't cause re-renders when other cells edit)
//   const isEditing = editingCellRef.current?.row === rowIndex && editingCellRef.current?.col === actualColIndex;

//   // Memoize cell type calculations
//   const cellTypeData = useMemo(() => {
//     return {
//       parsed: parseCellValue(cellValue),
//       isDropdown: isDropdownCellFn(rowIndex, actualColIndex),
//       isDate: isDateCellFn(rowIndex, actualColIndex),
//       isCalculated: (rowIndex === 11 && actualColIndex >= 9),
//       isSmartViewCell: (rowIndex === 12 && isSmartView && actualColIndex >= 9),
//       isHeaderRow: (rowIndex === 12)
//     };
//   }, [cellValue, rowIndex, actualColIndex, isSmartView, isDropdownCellFn, isDateCellFn, parseCellValue]);

//   const displayCell = cellTypeData.parsed.displayValue;
//   const { isDropdown, isDate, isCalculated, isSmartViewCell, isHeaderRow } = cellTypeData;

//   // Memoize dropdown options
//   const dropdownOptions = useMemo(() => 
//     isDropdown ? getDropdownOptionsWithCustom(rowIndex) : null,
//     [isDropdown, rowIndex, getDropdownOptionsWithCustom]
//   );

//   // Memoize red cell check
//   const isRedCell = useMemo(() => 
//     shouldCellBeRed(rowIndex, actualColIndex, cellValue),
//     [rowIndex, actualColIndex, cellValue, shouldCellBeRed]
//   );

//   // Determine if this cell affects calculations (needs live updates)
//   // Stable commit handler for this specific cell
//   const handleCommit = useCallback((value) => {
//     handleCellBlurWithTracking(rowIndex, actualColIndex, value);
//   }, [rowIndex, actualColIndex, handleCellBlurWithTracking]);

//   // Stable key handler for this specific cell
//   const handleKeyDown = useCallback((e) => {
//     handleCellKeyDown(e, rowIndex, actualColIndex);
//   }, [rowIndex, actualColIndex, handleCellKeyDown]);

//   // Stable click handler
//   const handleClick = useCallback(() => {
//     onCellClick(rowIndex, actualColIndex);
//   }, [rowIndex, actualColIndex, onCellClick]);

//   // Stable context menu handler
//   const handleContextMenu = useCallback((e) => {
//     onCellContextMenu(e, rowIndex, actualColIndex);
//   }, [rowIndex, actualColIndex, onCellContextMenu]);

//   const isDisabled = isViewer;

//   const cellBgStyle = useMemo(() => 
//     getCellBackgroundColor(rowIndex, actualColIndex, cellValue),
//     [rowIndex, actualColIndex, cellValue, getCellBackgroundColor]
//   );

//   const hasColored = useMemo(() => 
//     hasColoredBackground(rowIndex, actualColIndex, cellValue),
//     [rowIndex, actualColIndex, cellValue, hasColoredBackground]
//   );

//   const cellStyle = useMemo(() => ({
//     ...(isRedCell ? { color: 'red' } : {}),
//     ...cellBgStyle
//   }), [isRedCell, cellBgStyle]);

//   return (
//     <td
//       data-row={rowIndex}
//       data-col={colIndex}
//       className={`data-cell ${rowIndex < 12 && actualColIndex < 8 ? 'white-cell-no-border' : ''} ${rowIndex >= 13 && actualColIndex >= 9 ? 'grey-cell-after-col-i-row-13' : ''} ${isRowSelected || isColSelected ? 'selected' : ''}`}
//       style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}
//     >
//       {isSmartViewCell ? (
//         <div className="cell-input" style={SMART_VIEW_CELL_STYLE}>
//           {getSmartViewRow13Values(actualColIndex)}
//         </div>
//       ) : isHeaderRow ? (
//         <input type="text" value={cellValue} disabled={true} className="cell-input" title={cellValue} />
//       ) : isCalculated ? (
//         (() => {
//           const calcValue = row12Values[actualColIndex] ?? '';
//           const numValue = parseFloat(calcValue);
//            const bgColor = !isNaN(numValue) && numValue !== 0 
//             ? '#458efa'
//             : (numValue === 0 ? '#fa7878' : undefined);
//           return (
//             <input
//               type="text"
//               value={calcValue}
//               disabled={true}
//               className="cell-input"
//               style={{ ...CALCULATED_CELL_STYLE, backgroundColor: bgColor }}
//             />
//           );
//         })()
//       ) : isDropdown ? (
//         isEditing ? (
//           <EditableCell
//             initialValue={displayCell}
//             onCommit={(value) => {
//               setEditingCell(null);
//               handleCellBlurWithTracking(rowIndex, actualColIndex, value);
//             }}

//             onKeyDown={handleKeyDown}
//             onClick={handleClick}
//             onContextMenu={handleContextMenu}
//             disabled={isDisabled}
//             className={`cell-input ${hasColored ? 'colored-cell' : ''}`}
//             style={cellBgStyle}
//             title={displayCell}
//           />
//         ) : !displayCell || dropdownOptions?.includes(displayCell) ? (
//           <select
//             value={displayCell}
//             onChange={(e) => {
//               if (e.target.value === 'custom') {
//                 setEditingCell({ row: rowIndex, col: actualColIndex });
//               } else {
//                 handleCellChangeWithTracking(rowIndex, actualColIndex, e.target.value);
//               }
//             }}
//             onClick={handleClick}
//             onContextMenu={handleContextMenu}
//             onBlur={(e) => handleCellBlurWithTracking(rowIndex, actualColIndex, e.target.value)}
//             disabled={isDisabled}
//             className={`cell-input dropdown-input ${hasColored ? 'colored-cell' : ''}`}
//             style={cellBgStyle}
//             onKeyDown={handleKeyDown}
//             title={displayCell}
//           >
//             <option value="" style={{ display: 'none' }}></option>
//             {dropdownOptions?.map((option) => (
//               <option key={option} value={option}>{option}</option>
//             ))}
//             <option value="custom">-- Custom --</option>
//           </select>
//         ) : (
//           <div
//             onClick={() => setEditingCell({ row: rowIndex, col: actualColIndex })}
//             className={`cell-input dropdown-custom-display ${hasColored ? 'colored-cell' : ''}`}
//             style={{ ...DATE_WRAPPER_STYLE, ...cellBgStyle }}
//             title={displayCell}
//           >
//             {displayCell}
//           </div>
//         )
//       ) : isDate ? (
//         <div className={`date-cell-wrapper ${hasColored ? 'colored-cell' : ''}`} style={cellBgStyle} title={displayCell}>
//           <span className="date-display">{displayCell}</span>
//           <input
//             type="date"
//             value={convertToDateInput(displayCell)}
//             onChange={(e) => {
//               const formatted = convertFromDateInput(e.target.value);
//               handleCellChangeWithTracking(rowIndex, actualColIndex, formatted);
//             }}
//             onKeyDown={handleKeyDown}
//             onClick={(e) => {
//               onCellClick(rowIndex, actualColIndex);
//               e.target.showPicker?.();
//             }}
//             onContextMenu={handleContextMenu}
//             onBlur={(e) => handleCellBlurWithTracking(rowIndex, actualColIndex, convertFromDateInput(e.target.value))}
//             disabled={isDisabled}
//             className="cell-input date-input"
//           />
//         </div>
//       ) : (
//         <EditableCell
//           initialValue={displayCell}
//           onCommit={handleCommit}
//           onKeyDown={handleKeyDown}
//           onClick={handleClick}
//           onContextMenu={handleContextMenu}
//           disabled={isDisabled}
//           className={`cell-input ${hasColored ? 'colored-cell' : ''}`}
//           style={cellStyle}
//           title={displayCell}
//         />
//       )}
//     </td>
//   );
// }, (prevProps, nextProps) => {
//   if (prevProps.cellValue !== nextProps.cellValue) return false;
//   if (prevProps.rowIndex !== nextProps.rowIndex) return false;
//   if (prevProps.colIndex !== nextProps.colIndex) return false;
//   if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
//   if (prevProps.isColSelected !== nextProps.isColSelected) return false;
//   if (prevProps.isSmartView !== nextProps.isSmartView) return false;
//   if (prevProps.isViewer !== nextProps.isViewer) return false;
//   if (prevProps.isFilterActive !== nextProps.isFilterActive) return false;
//   if (prevProps.row12Values !== nextProps.row12Values) return false;
//   if (prevProps.colGValues !== nextProps.colGValues) return false;
//   if (prevProps.colHValues !== nextProps.colHValues) return false;
//   return true;
// });

// ScrollableTableCell.displayName = 'ScrollableTableCell';

// // ===== FROZEN TABLE CELL =====
// const FrozenTableCell = memo(({ 
//   rowIndex, colIndex, cell, isSmartView, isViewer, isRowSelected, isColSelected,
//   onCellChange, onCellBlur,
//   handleCellKeyDown,
//   isRow13Header: isRow13HeaderFn, isColIHeader: isColIHeaderFn, isDateCell: isDateCellFn, isDropdownCell: isDropdownCellFn,
//   getRow13HeaderValue, getColIHeaderValue, getDropdownOptions, getCalculateColGValue, getCalculateColHValue,
//   getColWidth, convertFromDateInput, convertToDateInput, isColumnAFilled,
//   sortTableByDeliveryDate, sortAscending, colGValues, colHValues
// }) => {
//   const handleKeyDown = useCallback((e) => {
//     handleCellKeyDown(e, rowIndex, colIndex);
//   }, [handleCellKeyDown, rowIndex, colIndex]);

//   const handleChange = useCallback((e) => {
//     onCellChange(rowIndex, colIndex, e.target.value);
//   }, [onCellChange, rowIndex, colIndex]);

//   const handleBlur = useCallback((e) => {
//     // Ensure frozen cells also save properly
//     const value = e?.target?.value;
//     if (value !== undefined) {
//       onCellChange(rowIndex, colIndex, value);
//     }
//     onCellBlur();
//   }, [onCellChange, onCellBlur, rowIndex, colIndex]);

//   const isDisabled = isViewer;

//   return (
//     <td
//       data-row={rowIndex}
//       data-col={colIndex}
//       className={`data-cell ${rowIndex === 12 && colIndex < 9 ? 'highlight-row-13' : ''} ${rowIndex < 12 && colIndex < 8 ? 'white-cell-no-border' : ''} ${rowIndex <= 12 && colIndex === 8 ? `highlight-col-i-${rowIndex}` : ''} ${isRowSelected || isColSelected ? 'selected' : ''}`}
//       style={{ width: `${getColWidth(colIndex)}px` }}
//     >
//       {isRow13HeaderFn(rowIndex, colIndex) ? (
//         <div 
//           className="cell-input header-cell" 
//           style={{ whiteSpace: 'pre-wrap', fontSize: isSmartView ? '9px' : '13px', lineHeight: isSmartView ? '1.2' : '1.5', padding: isSmartView ? '2px' : '0 8px', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: isSmartView ? 'hidden' : 'visible', cursor: colIndex === 3 ? 'pointer' : 'default' }}
//           onClick={() => colIndex === 3 && sortTableByDeliveryDate()}
//         >
//           {getRow13HeaderValue(colIndex)}
//           {colIndex === 3 && <span style={{ marginLeft: '4px', fontSize: '12px' }}>{sortAscending ? '▲' : '▼'}</span>}
//         </div>
//       ) : rowIndex === 12 ? (
//         <input type="text" value={cell} disabled={true} className="cell-input" />
//       ) : isColIHeaderFn(rowIndex, colIndex) ? (
//         <input
//           type="text"
//           value={getColIHeaderValue(rowIndex)}
//           disabled={true}
//           className="cell-input"
//           style={{ fontWeight: 'bold' }}
//         />
//       ) : rowIndex >= 13 && colIndex === 6 ? (
//         <input
//           type="text"
//           value={colGValues[rowIndex] ?? ''}
//           disabled={true}
//           className="cell-input"
//         />
//       ) : rowIndex >= 13 && colIndex === 7 ? (
//         <input
//           type="text"
//           value={colHValues[rowIndex] ?? ''}
//           disabled={true}
//           className="cell-input"
//         />
//       ) : isDropdownCellFn(rowIndex, colIndex) ? (
//         <select
//           value={cell}
//           onChange={handleChange}
//           disabled={isDisabled}
//           onBlur={handleBlur}
//           onKeyDown={handleKeyDown}
//           className="cell-input dropdown-input"
//         >
//           <option value="" style={{ display: 'none' }}></option>
//           {getDropdownOptions(rowIndex).map((option) => (
//             <option key={option} value={option}>{option}</option>
//           ))}
//           <option value="custom">-- Custom --</option>
//         </select>
//       ) : isDateCellFn(rowIndex, colIndex) ? (
//         <div className="date-cell-wrapper">
//           <span className="date-display">{cell}</span>
//           <input
//             type="date"
//             value={convertToDateInput(cell)}
//             onChange={(e) => {
//               const formatted = convertFromDateInput(e.target.value);
//               onCellChange(rowIndex, colIndex, formatted);
//             }}
//             onKeyDown={handleKeyDown}
//             onClick={(e) => e.target.showPicker?.()}
//             disabled={isDisabled}
//             onBlur={handleBlur}
//             className="cell-input date-input"
//           />
//         </div>
//       ) : (
//         <input
//           type="text"
//           value={cell}
//           onChange={handleChange}
//           onKeyDown={handleKeyDown}
//           disabled={isDisabled}
//           onBlur={handleBlur}
//           className="cell-input"
//         />
//       )}
//     </td>
//   );
// }, (prevProps, nextProps) => {
//   return (
//     prevProps.cell === nextProps.cell &&
//     prevProps.rowIndex === nextProps.rowIndex &&
//     prevProps.colIndex === nextProps.colIndex &&
//     prevProps.isRowSelected === nextProps.isRowSelected &&
//     prevProps.isColSelected === nextProps.isColSelected &&
//     prevProps.isSmartView === nextProps.isSmartView &&
//     prevProps.isViewer === nextProps.isViewer &&
//     prevProps.sortAscending === nextProps.sortAscending &&
//     prevProps.colGValues === nextProps.colGValues &&
//     prevProps.colHValues === nextProps.colHValues
//   );
// });

// FrozenTableCell.displayName = 'FrozenTableCell';

// // ===== FROZEN TABLE ROW =====
// const FrozenTableRow = memo(({
//   rowIndex, row, isSmartView, isRowSelected,
//   getColWidth, isRow13Header, isColIHeader, isDateCell, isDropdownCell,
//   getRow13HeaderValue, getColIHeaderValue, getDropdownOptions, getCalculateColGValue, getCalculateColHValue,
//   onCellChange, onCellBlur, handleCellKeyDown, isViewer, isColumnAFilled,
//   isColSelected, convertFromDateInput, convertToDateInput, onRowSelect, onRowHeaderContextMenu,
//   sortTableByDeliveryDate, sortAscending, colGValues, colHValues
// }) => {
//   return (
//     <tr 
//       className={`data-row ${rowIndex <= 12 ? 'sticky-row-13' : ''} ${isRowSelected ? 'selected' : ''}`}
//       style={{ display: isSmartView && rowIndex < 12 ? 'none' : '', ...(rowIndex <= 12 && { position: 'sticky' }), ...(isSmartView && rowIndex === 12 && { top: '28px' }) }}
//     >
//       <td 
//         className={`row-number-cell ${rowIndex === 12 ? 'highlight-row-13' : ''} ${isRowSelected ? 'selected' : ''}`}
//         onClick={() => onRowSelect(rowIndex)}
//         onContextMenu={(e) => onRowHeaderContextMenu(e, rowIndex)}
//         style={{ cursor: 'pointer', ...(rowIndex === 12 && { color: 'black' }) }}
//       >
//         {rowIndex === 12 ? 'S.no' : rowIndex < 13 ? '' : rowIndex - 12}
//       </td>
//       {Array.from({ length: FROZEN_COLS }, (_, colIndex) => (
//         <FrozenTableCell
//           key={`frozen-cell-${rowIndex}-${colIndex}`}
//           rowIndex={rowIndex}
//           colIndex={colIndex}
//           cell={row[colIndex] ?? ''}
//           isSmartView={isSmartView}
//           isViewer={isViewer}
//           isRowSelected={isRowSelected}
//           isColSelected={isColSelected(colIndex)}
//           onCellChange={onCellChange}
//           onCellBlur={onCellBlur}
//           handleCellKeyDown={handleCellKeyDown}
//           isRow13Header={isRow13Header}
//           isColIHeader={isColIHeader}
//           isDateCell={isDateCell}
//           isDropdownCell={isDropdownCell}
//           getRow13HeaderValue={getRow13HeaderValue}
//           getColIHeaderValue={getColIHeaderValue}
//           getDropdownOptions={getDropdownOptions}
//           getCalculateColGValue={getCalculateColGValue}
//           getCalculateColHValue={getCalculateColHValue}
//           getColWidth={getColWidth}
//           convertFromDateInput={convertFromDateInput}
//           convertToDateInput={convertToDateInput}
//           isColumnAFilled={isColumnAFilled}
//           sortTableByDeliveryDate={sortTableByDeliveryDate}
//           sortAscending={sortAscending}
//           colGValues={colGValues}
//           colHValues={colHValues}
//         />
//       ))}
//     </tr>
//   );
// }, (prevProps, nextProps) => {
//   if (prevProps.rowIndex !== nextProps.rowIndex) return false;
//   if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
//   if (prevProps.isSmartView !== nextProps.isSmartView) return false;
//   if (prevProps.sortAscending !== nextProps.sortAscending) return false;
//   if (prevProps.row !== nextProps.row) return false;
//   if (prevProps.colGValues !== nextProps.colGValues) return false;
//   if (prevProps.colHValues !== nextProps.colHValues) return false;
//   return true;
// });

// FrozenTableRow.displayName = 'FrozenTableRow';

// // ===== SCROLLABLE TABLE ROW =====
// const ScrollableTableRow = memo(({
//   rowIndex, isSmartView, isRowSelected,
//   numCols, getColWidth, isDateCell, isDropdownCell,
//   handleCellKeyDown, isViewer, isColSelected,
//   convertFromDateInput, convertToDateInput, isColumnAFilled, isRow1FilledForColumn,
//   editingCellRef, setEditingCell, getDropdownOptionsWithCustom,
//   handleCellChangeWithTracking, handleCellBlurWithTracking, parseCellValue, getCellBackgroundColor,
//   hasColoredBackground, shouldCellBeRed,
//   getCalculateRow12Value, getSmartViewRow13Values, getCalculateColGValue, getCalculateColHValue,
//   onCellClick, onCellContextMenu, isFilterActive, tableDataRef, rowData, row12Values, colGValues, colHValues,
//   visibleColStart, visibleColEnd
// }) => {
//   // Calculate spacer widths for hidden columns
//   const leftSpacerWidth = useMemo(() => {
//     let width = 0;
//     for (let i = 0; i < visibleColStart; i++) {
//       width += getColWidth(FROZEN_COLS + i);
//     }
//     return width;
//   }, [visibleColStart, getColWidth]);

//   const rightSpacerWidth = useMemo(() => {
//     let width = 0;
//     for (let i = visibleColEnd; i < numCols - FROZEN_COLS; i++) {
//       width += getColWidth(FROZEN_COLS + i);
//     }
//     return width;
//   }, [visibleColEnd, numCols, getColWidth]);

//   return (
//     <tr 
//       className={`data-row ${rowIndex <= 12 ? 'sticky-row-13' : ''} ${isRowSelected ? 'selected' : ''}`}
//       style={{ display: isSmartView && rowIndex < 12 ? 'none' : '', ...(rowIndex <= 12 && { position: 'sticky' }), ...(isSmartView && rowIndex === 12 && { top: '28px' }) }}
//     >
//       {/* Left spacer for hidden columns */}
//       {leftSpacerWidth > 0 && (
//         <td colSpan={visibleColStart} style={{ width: `${leftSpacerWidth}px`, padding: 0, border: 'none', height: '32px' }} />
//       )}

//       {Array.from({ length: visibleColEnd - visibleColStart }, (_, idx) => {
//         const colIndex = visibleColStart + idx;
//         const actualColIndex = FROZEN_COLS + colIndex;
//         const cellValue = rowData?.[actualColIndex] ?? '';
//         return (
//           <ScrollableTableCell
//             key={`scroll-cell-${rowIndex}-${actualColIndex}`}
//             rowIndex={rowIndex}
//             colIndex={colIndex}
//             cellValue={cellValue}
//             isSmartView={isSmartView}
//             isViewer={isViewer}
//             isRowSelected={isRowSelected}
//             isColSelected={isColSelected(actualColIndex)}
//             onCellClick={onCellClick}
//             onCellContextMenu={onCellContextMenu}
//             handleCellKeyDown={handleCellKeyDown}
//             editingCellRef={editingCellRef}
//             setEditingCell={setEditingCell}
//             isColumnAFilled={isColumnAFilled}
//             isRow1FilledForColumn={isRow1FilledForColumn}
//             getColWidth={getColWidth}
//             isDateCell={isDateCell}
//             isDropdownCell={isDropdownCell}
//             getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
//             handleCellChangeWithTracking={handleCellChangeWithTracking}
//             handleCellBlurWithTracking={handleCellBlurWithTracking}
//             parseCellValue={parseCellValue}
//             getCellBackgroundColor={getCellBackgroundColor}
//             hasColoredBackground={hasColoredBackground}
//             shouldCellBeRed={shouldCellBeRed}
//             convertToDateInput={convertToDateInput}
//             convertFromDateInput={convertFromDateInput}
//             getCalculateRow12Value={getCalculateRow12Value}
//             getSmartViewRow13Values={getSmartViewRow13Values}
//             getCalculateColGValue={getCalculateColGValue}
//             getCalculateColHValue={getCalculateColHValue}
//             isFilterActive={isFilterActive}
//             tableDataRef={tableDataRef}
//             row12Values={row12Values}
//             colGValues={colGValues}
//             colHValues={colHValues}
//           />
//         );
//       })}

//       {/* Right spacer for hidden columns */}
//       {rightSpacerWidth > 0 && (
//         <td colSpan={Math.max(0, numCols - FROZEN_COLS - visibleColEnd)} style={{ width: `${rightSpacerWidth}px`, padding: 0, border: 'none', height: '32px' }} />
//       )}
//     </tr>
//   );
// }, (prevProps, nextProps) => {
//   if (prevProps.rowIndex !== nextProps.rowIndex) return false;
//   if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
//   if (prevProps.isSmartView !== nextProps.isSmartView) return false;
//   if (prevProps.numCols !== nextProps.numCols) return false;
//   if (prevProps.isFilterActive !== nextProps.isFilterActive) return false;
//   if (prevProps.rowData !== nextProps.rowData) return false;
//   if (prevProps.row12Values !== nextProps.row12Values) return false;
//   if (prevProps.colGValues !== nextProps.colGValues) return false;
//   if (prevProps.colHValues !== nextProps.colHValues) return false;
//   if (prevProps.visibleColStart !== nextProps.visibleColStart) return false;
//   if (prevProps.visibleColEnd !== nextProps.visibleColEnd) return false;
//   return true;
// });

// ScrollableTableRow.displayName = 'ScrollableTableRow';

// // ===== CONSTANTS =====
// const FROZEN_COL_WIDTHS_NORMAL = {
//   0: 185, 1: 80, 2: 70, 3: 110, 4: 0, 5: 70, 6: 70, 7: 70, 8: 228
// };

// const FROZEN_COL_WIDTHS_SMART = {
//   0: 120, 1: 0, 2: 0, 3: 110, 4: 0, 5: 70, 6: 70, 7: 70, 8: 0
// };

// const ROW_13_HEADERS = {
//   0: 'Forecast Plant - Project',
//   1: 'Decision Date',
//   2: 'Order Date',
//   3: 'Onsite\n Delivery date',
//   4: 'X0 Date',
//   5: 'Total Robots',
//   6: 'Reused Robots',
//   7: 'New Robots',
//   8: 'Reuse Asumptions'
// };

// const COL_I_HEADERS = {
//   0: 'Stock Plant - Project',
//   1: 'Robot Standard',
//   2: 'Standard Controller',
//   3: 'Standard Family',
//   4: 'Comment',
//   5: 'Run Out Date',
//   6: 'Amount Of Robots Avaliable',
//   7: 'Stock Avaliable (After 7% Spare)',
//   8: 'Spare parts & Specific Need',
//   9: 'Scraps',
//   10: 'Onsite Production',
//   11: 'Total (Avaliable Robots)'
// };

// const DROPDOWN_OPTIONS = {
//   1: ['xP ABB', 'xP FANUC', 'xVB FANUC', 'xF COMAU', 'xO FUNAC', 'xVG ABB', 'xP FANUC RJ3B std D2 ou B5', 'xP FANUC RJ3B std 2003-2006', 'xF FANUC R30B Std V3', 'xP ABB S4C+A Std B5', 'xP ABB S4C+A Std 2003-2006', 'xP ABB IRC5 Std New_Ml_V4', 'P51/52 hors ouvrant', 'fanucucc', 'XABB'],
//   2: ['RJ3B B5/D2', 'RJ3B 2003-2006', 'RJ3B Legacy', 'RJ3B Global 1', 'R30A New_Ml_V4', 'R30A New_Ml_V6', 'R30B S Global 2', 'R30B New_Ml_V7', 'R30B New_Ml_V9', 'R30B Global 3', 'R30B+ New_Ml_V11', 'R30B+ New_Ml_V19', 'S4C A8', 'S4C+4', 'S4C+A 2003-2006', 'IRC5 M2004 B7', 'IRC5 M2009 New_Ml_V4', 'C3G C3G', 'C5G+ C5G+', 'Not Applicable'],
//   3: ['F1', 'F2', 'F3', 'F4', 'Q1', 'Q2', 'Q3', 'Q4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'V2', 'V3', 'Not Applicable']
// };

// const isDateCell = (rowIndex, colIndex) => {
//   if (rowIndex === 5) return true;
//   if (colIndex >= 1 && colIndex <= 4) return true;
//   return false;
// };

// const isDropdownCell = (rowIndex, colIndex) => {
//   return (rowIndex >= 1 && rowIndex <= 3) && colIndex >= 9;
// };

// const isRow13Header = (rowIndex, colIndex) => {
//   return rowIndex === 12 && colIndex <= 8;
// };

// const isColIHeader = (rowIndex, colIndex) => {
//   return colIndex === 8 && rowIndex < 12;
// };

// const getColumnLetter = (index) => {
//   let letter = '';
//   let num = index;
//   while (num >= 0) {
//     letter = String.fromCharCode(65 + (num % 26)) + letter;
//     num = Math.floor(num / 26) - 1;
//   }
//   return letter;
// };

// const getDisplayColumnLetter = (index) => {
//   if (index < 9) return '';
//   return getColumnLetter(index - 9);
// };

// const formatCellValue = (value, mode) => {
//   if (!value || value.trim() === '') return '';
//   const cleanValue = value.replace(/\s*\((green|orange)\)$/i, '').trim();
//   if (mode === 'single') return `${cleanValue} (green)`;
//   if (mode === 'double') return `${cleanValue} (orange)`;
//   return cleanValue;
// };

// const convertToDateInput = (value) => {
//   if (!value) return '';
//   try {
//     let date;
//     if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
//       date = new Date(value);
//     } else if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(value)) {
//       date = new Date(value);
//     } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
//       date = new Date(value);
//     } else if (/^[A-Za-z]+ \d{2,4}$/.test(value)) {
//       const parts = value.split(' ');
//       let month = parts[0];
//       let year = parts[1];
//       if (year.length === 2) year = '20' + year;
//       date = new Date(`${month} 1, ${year}`);
//     } else {
//       date = new Date(value);
//     }
//     if (!isNaN(date.getTime())) {
//       const year = date.getFullYear();
//       const month = String(date.getMonth() + 1).padStart(2, '0');
//       const day = String(date.getDate()).padStart(2, '0');
//       return `${year}-${month}-${day}`;
//     }
//   } catch (e) {}
//   return '';
// };

// const convertFromDateInput = (dateString) => {
//   if (!dateString) return '';
//   try {
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) return '';
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = date.toLocaleString('en-US', { month: 'short' });
//     const year = String(date.getFullYear()).slice(-2);
//     return `${day}-${month}-${year}`;
//   } catch (e) {}
//   return '';
// };

// const parseCustomDate = (dateStr) => {
//   if (!dateStr || typeof dateStr !== 'string') return null;
//   try {
//     let date;
//     if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
//       date = new Date(dateStr);
//     } else if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(dateStr)) {
//       date = new Date(dateStr);
//     } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
//       date = new Date(dateStr);
//     } else if (/^[A-Za-z]+ \d{2,4}$/.test(dateStr)) {
//       const parts = dateStr.trim().split(' ');
//       let month = parts[0];
//       let year = parts[1];
//       if (year.length === 2) {
//         const parsedYear = parseInt(year, 10);
//         year = (parsedYear < 50) ? '20' + year : '19' + year;
//       }
//       date = new Date(`${month} 1, ${year}`);
//     } else {
//       date = new Date(dateStr);
//     }
//     return !isNaN(date.getTime()) ? date : null;
//   } catch (e) {
//     return null;
//   }
// };

// const getCellKey = (rowIndex, colIndex) => `${rowIndex}-${colIndex}`;

// // Memoized cell value parser
// const parseCellValueMemoized = (cellValue) => {
//   if (!cellValue) {
//     return { displayValue: '', mode: null };
//   }

//   const cached = parserCacheInstance.get(cellValue);
//   if (cached) return cached;

//   const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
//   const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);

//   let result;
//   if (greenMatch) result = { displayValue: greenMatch[1].trim(), mode: 'single' };
//   else if (orangeMatch) result = { displayValue: orangeMatch[1].trim(), mode: 'double' };
//   else result = { displayValue: cellValue, mode: null };

//   parserCacheInstance.set(cellValue, result);
//   return result;
// };

// // ===== MAIN TABLE COMPONENT =====
// const Table = forwardRef(({ 
//   tableData, onCellChange, onCellBlur, onUpdateTableData, canUndo, canRedo, 
//   selectedRows = new Set(), setSelectedRows, selectedCols = new Set(), setSelectedCols, 
//   isFilterActive = false, isViewer = false, onSmartViewToggle, onInsertRow, onInsertCol 
// }, ref) => {

//   const [colWidths, setColWidths] = useState({});
//   const [resizingCol, setResizingCol] = useState(null);
//   const [containerWidth, setContainerWidth] = useState(window.innerWidth);
//   const [isSmartView, setIsSmartView] = useState(false);
//   const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
//   const [customDropdownValues, setCustomDropdownValues] = useState({});
//   const [insertRowMenu, setInsertRowMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null });
//   const [insertColMenu, setInsertColMenu] = useState({ visible: false, x: 0, y: 0, colIndex: null });
//   const [robotStandards, setRobotStandards] = useState([]);
//   const [standardControllers, setStandardControllers] = useState([]);
//   const [standardFamilies, setStandardFamilies] = useState([]);
//   const [sortAscending, setSortAscending] = useState(true);

//   // Use ref for editingCell to avoid re-rendering ALL cells
//   const [editingCellState, setEditingCellState] = useState(null);
//   const editingCellRef = useRef(null);

//   const setEditingCell = useCallback((value) => {
//     editingCellRef.current = value;
//     setEditingCellState(value);
//   }, []);

//   const cellClickModeRef = useRef({});
//   const frozenSectionRef = useRef(null);
//   const scrollableSectionRef = useRef(null);
//   const cellInputValuesRef = useRef({});

//   // ===== STABLE REFS =====

//   const tableDataRef = useRef(tableData);
//   const onCellChangeRef = useRef(onCellChange);
//   const onCellBlurRef = useRef(onCellBlur);

//   useEffect(() => { tableDataRef.current = tableData; }, [tableData]);
//   useEffect(() => { onCellChangeRef.current = onCellChange; }, [onCellChange]);
//   useEffect(() => { onCellBlurRef.current = onCellBlur; }, [onCellBlur]);

//   // ===== ROW VIRTUALIZATION =====
//   const { start: visibleStart, end: visibleEnd } = useVirtualRows(tableData.length, frozenSectionRef);

//   // Fetch dropdown data from API
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const [standardsRes, controllersRes, familiesRes] = await Promise.all([
//           fetch('/api/robot-standards'),
//           fetch('/api/standard-controllers'),
//           fetch('/api/standard-families')
//         ]);

//         const standardsResult = await standardsRes.json();
//         const controllersResult = await controllersRes.json();
//         const familiesResult = await familiesRes.json();

//         if (standardsResult.success && standardsResult.data) {
//           setRobotStandards(standardsResult.data.map(item => item.standard).sort());
//         }
//         if (controllersResult.success && controllersResult.data) {
//           setStandardControllers(controllersResult.data.map(item => item.controller).sort());
//         }
//         if (familiesResult.success && familiesResult.data) {
//           setStandardFamilies(familiesResult.data.map(item => item.family).sort());
//         }
//       } catch (error) {
//         console.error('Failed to fetch dropdowns:', error);
//       }
//     };
//     fetchData();
//   }, []);

//   // Memoized values
//   const numCols = useMemo(() => tableData[0]?.length || 0, [tableData]);
//   const numColsRef = useRef(numCols);

//   // Keep refs current via consolidated useEffect (performance optimization)
//   useEffect(() => {
//     numColsRef.current = numCols;
//   }, [numCols]);

//   // ===== COLUMN VIRTUALIZATION =====
//   const { start: visibleColStart, end: visibleColEnd } = useVirtualCols(numCols - FROZEN_COLS, scrollableSectionRef);

//   const getOptimalColWidth = useCallback(() => {
//     if (numCols === 0) return MIN_COL_WIDTH;
//     const availableWidth = containerWidth - (ROW_HEADER_WIDTH + 32);
//     return Math.max(MIN_COL_WIDTH, Math.floor(availableWidth / numCols));
//   }, [containerWidth, numCols]);

//   const getColWidth = useCallback((index) => {
//     if (index >= FROZEN_COLS) return SCROLLABLE_COL_WIDTH;
//     const CURRENT_WIDTHS = isSmartView ? FROZEN_COL_WIDTHS_SMART : FROZEN_COL_WIDTHS_NORMAL;
//     if (CURRENT_WIDTHS[index] !== null && CURRENT_WIDTHS[index] !== undefined) {
//       return CURRENT_WIDTHS[index];
//     }
//     return colWidths[index] || getOptimalColWidth();
//   }, [colWidths, getOptimalColWidth, isSmartView]);

//   const frozenWidth = useMemo(() => {
//     let width = ROW_HEADER_WIDTH;
//     for (let i = 0; i < FROZEN_COLS && i < numCols; i++) {
//       width += getColWidth(i);
//     }
//     return width;
//   }, [numCols, getColWidth]);

//   const columnAFilledMap = useMemo(() => {
//     const map = {};
//     for (let i = 13; i < tableData.length; i++) {
//       map[i] = tableData[i]?.[0]?.trim() !== '';
//     }
//     return map;
//   }, [tableData]);

//   const row1FilledMap = useMemo(() => {
//     const map = {};
//     for (let i = 9; i < numCols; i++) {
//       map[i] = tableData[0]?.[i]?.trim() !== '';
//     }
//     return map;
//   }, [tableData, numCols]);

//   // Direct functions - no useCallback wrapper (simple lookups don't benefit from memoization)
//   const isColumnAFilled = (rowIndex) => {
//     if (rowIndex < 13) return true;
//     return columnAFilledMap[rowIndex] ?? false;
//   };

//   const isRow1FilledForColumn = (colIndex) => {
//     if (colIndex < 9) return true;
//     return row1FilledMap[colIndex] ?? false;
//   };

//   // ===== CALCULATED VALUES =====
//   const row12Values = useMemo(() => {
//     const values = {};
//     for (let colIndex = FROZEN_COLS; colIndex < numCols; colIndex++) {
//       const row8Value = parseFloat(tableData[7]?.[colIndex]) || 0;
//       const row9Value = parseFloat(tableData[8]?.[colIndex]) || 0;
//       const row10Value = parseFloat(tableData[9]?.[colIndex]) || 0;
//       const row11Value = parseFloat(tableData[10]?.[colIndex]) || 0;

//       let sumOfRows14Plus = 0;
//       for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
//         const rawValue = tableData[rowIndex]?.[colIndex];
//         const parsed = parseCellValueMemoized(rawValue);
//         sumOfRows14Plus += parseFloat(parsed.displayValue) || 0;
//       }

//       if (row8Value === 0 && row9Value === 0 && row10Value === 0 && row11Value === 0 && sumOfRows14Plus === 0) {
//         values[colIndex] = '';
//       } else {
//         let calculatedValue = row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus;
//         if (calculatedValue < 0) calculatedValue = 0;
//         values[colIndex] = calculatedValue.toString();
//       }
//     }
//     return values;
//   }, [tableData, numCols]);

//   const colGValues = useMemo(() => {
//     const values = {};
//     for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
//       let sum = 0;
//       for (let colIndex = 9; colIndex < (tableData[rowIndex]?.length || 0); colIndex++) {
//         const cellValue = tableData[rowIndex]?.[colIndex];
//         const parsed = parseCellValueMemoized(cellValue);
//         const numValue = parseFloat(parsed.displayValue);
//         if (!isNaN(numValue)) sum += numValue;
//       }
//       values[rowIndex] = sum > 0 ? sum.toString() : '';
//     }
//     return values;
//   }, [tableData]);

//   const colHValues = useMemo(() => {
//     const values = {};
//     for (let rowIndex = 13; rowIndex < tableData.length; rowIndex++) {
//       const colFValue = parseFloat(tableData[rowIndex]?.[5]);
//       const colGValue = parseFloat(colGValues[rowIndex]);
//       if (isNaN(colFValue) || isNaN(colGValue)) {
//         values[rowIndex] = '';
//       } else {
//         values[rowIndex] = (colFValue - colGValue).toString();
//       }
//     }
//     return values;
//   }, [tableData, colGValues]);

//   // Refs for calculated values - CONSOLIDATED into single useEffect (performance optimization)
//   const row12ValuesRef = useRef(row12Values);
//   const colGValuesRef = useRef(colGValues);
//   const colHValuesRef = useRef(colHValues);

//   // Single useEffect instead of 3 separate ones - reduces effect overhead
//   useEffect(() => {
//     row12ValuesRef.current = row12Values;
//     colGValuesRef.current = colGValues;
//     colHValuesRef.current = colHValues;
//   }, [row12Values, colGValues, colHValues]);

//   // STABLE getters that never change reference
//   const getCalculateRow12Value = useCallback((colIndex) => row12ValuesRef.current[colIndex] ?? '', []);
//   const getCalculateColGValue = useCallback((rowIndex) => colGValuesRef.current[rowIndex] ?? '', []);
//   const getCalculateColHValue = useCallback((rowIndex) => colHValuesRef.current[rowIndex] ?? '', []);

//   // Stable wrapper callbacks
//   const stableOnCellChange = useCallback((rowIndex, colIndex, value) => {
//     onCellChangeRef.current(rowIndex, colIndex, value);
//   }, []);

//   const stableOnCellBlur = useCallback(() => {
//     onCellBlurRef.current?.();
//   }, []);

//   // ===== SORT =====
//   const sortTableByDeliveryDate = useCallback(() => {
//     if (tableData.length <= 13) return;

//     const headerRows = tableData.slice(0, 13);
//     const dataRows = tableData.slice(13);

//     const isBlankRow = (row) => !row || row.every(cell => !cell || cell.trim() === '');
//     const nonBlankRows = dataRows.filter(row => !isBlankRow(row));
//     const blankRows = dataRows.filter(row => isBlankRow(row));

//     const sortedDataRows = [...nonBlankRows].sort((a, b) => {
//       const dateA = a[3] ? a[3].trim() : '';
//       const dateB = b[3] ? b[3].trim() : '';

//       const parseDate = (dateStr) => {
//         if (!dateStr) return new Date(0);
//         try {
//           const parts = dateStr.toLowerCase().split(/\s+/);
//           const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

//           if (parts.length >= 2) {
//             const monthIndex = monthNames.indexOf(parts[0].slice(0, 3));
//             if (monthIndex !== -1) {
//               const year = parseInt(parts[1]);
//               if (!isNaN(year)) {
//                 const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
//                 return new Date(fullYear, monthIndex, 1);
//               }
//             }
//           }

//           const dotParts = dateStr.split('.');
//           if (dotParts.length === 3) {
//             return new Date(dotParts[2], dotParts[1] - 1, dotParts[0]);
//           }

//           const parsed = new Date(dateStr);
//           return isNaN(parsed.getTime()) ? new Date(0) : parsed;
//         } catch {
//           return new Date(0);
//         }
//       };

//       const parsedA = parseDate(dateA);
//       const parsedB = parseDate(dateB);
//       return sortAscending ? parsedA - parsedB : parsedB - parsedA;
//     });

//     const newTableData = [...headerRows, ...sortedDataRows, ...blankRows];
//     onUpdateTableData(newTableData);
//     setSortAscending(!sortAscending);
//   }, [tableData, sortAscending, onUpdateTableData]);

//   // ===== CONTEXT MENUS =====
//   const handleRowHeaderContextMenu = useCallback((e, rowIndex) => {
//     e.preventDefault();
//     if (isViewer) return;
//     setInsertRowMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex });
//   }, [isViewer]);

//   const handleColHeaderContextMenu = useCallback((e, colIndex) => {
//     e.preventDefault();
//     if (isViewer) return;
//     setInsertColMenu({ visible: true, x: e.clientX, y: e.clientY, colIndex });
//   }, [isViewer]);

//   const handleRowInsertAbove = useCallback(() => {
//     if (insertRowMenu.rowIndex !== null && onInsertRow) {
//       onInsertRow(insertRowMenu.rowIndex, 'above', false);
//     }
//     setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
//   }, [insertRowMenu, onInsertRow]);

//   const handleRowInsertBelow = useCallback(() => {
//     if (insertRowMenu.rowIndex !== null && onInsertRow) {
//       onInsertRow(insertRowMenu.rowIndex, 'below', false);
//     }
//     setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
//   }, [insertRowMenu, onInsertRow]);

//   const handleColInsertLeft = useCallback(() => {
//     if (insertColMenu.colIndex !== null && onInsertCol) {
//       onInsertCol(insertColMenu.colIndex, 'left', false);
//     }
//     setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
//   }, [insertColMenu, onInsertCol]);

//   const handleColInsertRight = useCallback(() => {
//     if (insertColMenu.colIndex !== null && onInsertCol) {
//       onInsertCol(insertColMenu.colIndex, 'right', false);
//     }
//     setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
//   }, [insertColMenu, onInsertCol]);

//   // Close menus on click away
//   useEffect(() => {
//     const handleClickAway = () => {
//       setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
//       setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
//     };
//     if (insertRowMenu.visible || insertColMenu.visible) {
//       document.addEventListener('click', handleClickAway);
//       return () => document.removeEventListener('click', handleClickAway);
//     }
//   }, [insertRowMenu.visible, insertColMenu.visible]);

//   // ===== IMPERATIVE HANDLE =====
//   useImperativeHandle(ref, () => ({
//     scrollToNewRow: () => {
//       const lastRowIndex = tableData.length - 1;
//       if (frozenSectionRef.current && scrollableSectionRef.current) {
//         const viewportHeight = frozenSectionRef.current.clientHeight;
//         const targetScrollTop = Math.max(0, (lastRowIndex - STICKY_ROWS + 1) * ROW_HEIGHT - viewportHeight / 2 + ROW_HEIGHT);
//         frozenSectionRef.current.scrollTop = targetScrollTop;
//         scrollableSectionRef.current.scrollTop = targetScrollTop;
//       }
//     },
//     scrollToNewColumn: () => {
//       if (scrollableSectionRef.current) {
//         const scrollWidth = scrollableSectionRef.current.scrollWidth;
//         const clientWidth = scrollableSectionRef.current.clientWidth;
//         scrollableSectionRef.current.scrollLeft = scrollWidth - clientWidth;
//       }
//     },
//     toggleSmartView: () => {
//       const newSmartViewState = !isSmartView;
//       setIsSmartView(newSmartViewState);
//       if (onSmartViewToggle) onSmartViewToggle(newSmartViewState);
//     },
//     refreshRobotStandards: async () => {
//       try {
//         const response = await fetch('/api/robot-standards');
//         const result = await response.json();
//         if (result.success && result.data) {
//           setRobotStandards(result.data.map(item => item.standard).sort());
//         }
//       } catch (error) {
//         console.error('Failed to refresh robot standards:', error);
//       }
//     },
//     refreshStandardControllers: async () => {
//       try {
//         const response = await fetch('/api/standard-controllers');
//         const result = await response.json();
//         if (result.success && result.data) {
//           setStandardControllers(result.data.map(item => item.controller).sort());
//         }
//       } catch (error) {
//         console.error('Failed to refresh standard controllers:', error);
//       }
//     },
//     refreshStandardFamilies: async () => {
//       try {
//         const response = await fetch('/api/standard-families');
//         const result = await response.json();
//         if (result.success && result.data) {
//           setStandardFamilies(result.data.map(item => item.family).sort());
//         }
//       } catch (error) {
//         console.error('Failed to refresh standard families:', error);
//       }
//     }
//   }));

//   // ===== DROPDOWN OPTIONS =====
//   const getDropdownOptions = useCallback((rowIndex) => {
//     if (rowIndex === 1) return robotStandards.length > 0 ? robotStandards : DROPDOWN_OPTIONS[1];
//     if (rowIndex === 2) return standardControllers.length > 0 ? standardControllers : DROPDOWN_OPTIONS[2];
//     if (rowIndex === 3) return standardFamilies.length > 0 ? standardFamilies : DROPDOWN_OPTIONS[3];
//     return DROPDOWN_OPTIONS[rowIndex] || [];
//   }, [robotStandards, standardControllers, standardFamilies]);

//   const getDropdownOptionsWithCustom = useCallback((rowIndex) => {
//     const baseOptions = getDropdownOptions(rowIndex);
//     const customValues = customDropdownValues[rowIndex] || [];
//     return [...new Set([...baseOptions, ...customValues])];
//   }, [customDropdownValues, getDropdownOptions]);

//   // ===== CELL NAVIGATION =====
//   const focusCell = useCallback((rowIndex, colIndex) => {
//     try {
//       let targetCell = null;
//       if (colIndex < FROZEN_COLS) {
//         targetCell = frozenSectionRef.current?.querySelector(
//           `td[data-row="${rowIndex}"][data-col="${colIndex}"] input, td[data-row="${rowIndex}"][data-col="${colIndex}"] select`
//         );
//       } else {
//         const scrollColIndex = colIndex - FROZEN_COLS;
//         targetCell = scrollableSectionRef.current?.querySelector(
//           `td[data-row="${rowIndex}"][data-col="${scrollColIndex}"] input, td[data-row="${rowIndex}"][data-col="${scrollColIndex}"] select`
//         );
//       }
//       if (targetCell) {
//         targetCell.focus();
//         if (targetCell.select) targetCell.select();
//       }
//     } catch (e) {
//       console.error('focusCell error:', e);
//     }
//   }, []);

//   // ===== KEY HANDLER (STABLE - uses refs) =====
//   const handleCellKeyDown = useCallback((e, rowIndex, colIndex) => {
//     if (e.key === 'Delete') {
//       e.preventDefault();
//       if (colIndex >= 9 && rowIndex >= 13) {
//         const cellKey = getCellKey(rowIndex, colIndex);
//         delete cellInputValuesRef.current[cellKey];
//         delete cellClickModeRef.current[cellKey];
//       }
//       onCellChangeRef.current(rowIndex, colIndex, '');
//       if (e.target.tagName === 'SELECT') e.target.value = '';
//     }

//     if (e.key === 'Enter') {
//       e.preventDefault();
//       const nextRowIndex = rowIndex + 1;
//       if (nextRowIndex < tableDataRef.current.length) {
//         setTimeout(() => focusCell(nextRowIndex, colIndex), 0);
//       }
//     }

//     if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       if (rowIndex - 1 >= 0) focusCell(rowIndex - 1, colIndex);
//     }
//     if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       if (rowIndex + 1 < tableDataRef.current.length) focusCell(rowIndex + 1, colIndex);
//     }
//     if (e.key === 'ArrowLeft') {
//       e.preventDefault();
//       if (colIndex - 1 >= 0) focusCell(rowIndex, colIndex - 1);
//     }
//     if (e.key === 'ArrowRight') {
//       e.preventDefault();
//       if (colIndex + 1 < numColsRef.current) focusCell(rowIndex, colIndex + 1);
//     }
//   }, [focusCell]);

//   // ===== ROW/COL SELECTION =====
//   const handleRowSelect = useCallback((rowIndex) => {
//     const newSelectedRows = new Set(selectedRows);
//     if (newSelectedRows.has(rowIndex)) {
//       newSelectedRows.delete(rowIndex);
//     } else {
//       newSelectedRows.add(rowIndex);
//     }
//     setSelectedRows(newSelectedRows);
//   }, [selectedRows, setSelectedRows]);

//   const handleColSelect = useCallback((colIndex) => {
//     const newSelectedCols = new Set(selectedCols);
//     if (newSelectedCols.has(colIndex)) {
//       newSelectedCols.delete(colIndex);
//     } else {
//       newSelectedCols.add(colIndex);
//     }
//     setSelectedCols(newSelectedCols);
//   }, [selectedCols, setSelectedCols]);

//   const isColSelected = useCallback((colIndex) => selectedCols.has(colIndex), [selectedCols]);

//   // ===== RESIZE HANDLING =====
//   useEffect(() => {
//     let timeoutId = null;
//     const handleResize = () => {
//       if (timeoutId) return;
//       timeoutId = setTimeout(() => {
//         setContainerWidth(window.innerWidth);
//         timeoutId = null;
//       }, 100);
//     };
//     window.addEventListener('resize', handleResize);
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       if (timeoutId) clearTimeout(timeoutId);
//     };
//   }, []);

//   useEffect(() => {
//     const saved = localStorage.getItem('tableColWidths');
//     if (saved) {
//       try { setColWidths(JSON.parse(saved)); } catch (e) {}
//     }
//   }, []);

//   // Synchronize vertical scroll between frozen and scrollable sections
//   useEffect(() => {
//     const frozenSection = frozenSectionRef.current;
//     const scrollableSection = scrollableSectionRef.current;
//     if (!frozenSection || !scrollableSection) return;

//     let isSyncing = false;
//     let rafId = null;

//     const handleScroll = (e) => {
//       if (isSyncing) return;
//       if (rafId) cancelAnimationFrame(rafId);

//       rafId = requestAnimationFrame(() => {
//         isSyncing = true;
//         let scrollTop = e.target.scrollTop;
//         const maxScroll = e.target.scrollHeight - e.target.clientHeight;
//         const maxScrollAllowed = maxScroll * 0.99;

//         if (scrollTop > maxScrollAllowed) {
//           scrollTop = maxScrollAllowed;
//           e.target.scrollTop = scrollTop;
//         }

//         if (e.target === scrollableSection) {
//           frozenSection.scrollTop = scrollTop;
//         } else {
//           scrollableSection.scrollTop = scrollTop;
//         }
//         isSyncing = false;
//         rafId = null;
//       });
//     };

//     const SCROLL_MULTIPLIER = 1;
//     let wheelRafId = null;

//     const handleWheel = (e) => {
//       e.preventDefault();
//       if (wheelRafId) cancelAnimationFrame(wheelRafId);

//       wheelRafId = requestAnimationFrame(() => {
//         const delta = e.deltaY * SCROLL_MULTIPLIER;
//         const maxScrollFrozen = frozenSection.scrollHeight - frozenSection.clientHeight;
//         const maxScrollAllowed = maxScrollFrozen * 0.99;

//         let newScrollTop = frozenSection.scrollTop + delta;
//         if (newScrollTop > maxScrollAllowed) newScrollTop = maxScrollAllowed;
//         newScrollTop = Math.max(0, newScrollTop);

//         frozenSection.scrollTop = newScrollTop;
//         scrollableSection.scrollTop = newScrollTop;
//         wheelRafId = null;
//       });
//     };

//     frozenSection.addEventListener('scroll', handleScroll, { passive: true });
//     scrollableSection.addEventListener('scroll', handleScroll, { passive: true });
//     frozenSection.addEventListener('wheel', handleWheel, { passive: false });
//     scrollableSection.addEventListener('wheel', handleWheel, { passive: false });

//     return () => {
//       frozenSection.removeEventListener('scroll', handleScroll);
//       scrollableSection.removeEventListener('scroll', handleScroll);
//       frozenSection.removeEventListener('wheel', handleWheel);
//       scrollableSection.removeEventListener('wheel', handleWheel);
//       if (rafId) cancelAnimationFrame(rafId);
//       if (wheelRafId) cancelAnimationFrame(wheelRafId);
//     };
//   }, []);

//   const saveColWidths = useCallback((widths) => {
//     setColWidths(widths);
//     localStorage.setItem('tableColWidths', JSON.stringify(widths));
//   }, []);

//   const handleResizeStart = useCallback((e, colIndex) => {
//     e.preventDefault();
//     setResizingCol({ index: colIndex, startX: e.clientX, startWidth: colWidths[colIndex] || getOptimalColWidth() });
//   }, [colWidths, getOptimalColWidth]);

//   useEffect(() => {
//     if (!resizingCol) return;
//     let rafId = null;

//     const handleMouseMove = (e) => {
//       if (rafId) return;
//       rafId = requestAnimationFrame(() => {
//         const diff = e.clientX - resizingCol.startX;
//         const newWidth = Math.max(MIN_COL_WIDTH, resizingCol.startWidth + diff);
//         setColWidths(prev => ({ ...prev, [resizingCol.index]: newWidth }));
//         rafId = null;
//       });
//     };

//     const handleMouseUp = () => {
//       if (rafId) cancelAnimationFrame(rafId);
//       setColWidths(prev => { saveColWidths(prev); return prev; });
//       setResizingCol(null);
//     };

//     document.addEventListener('mousemove', handleMouseMove);
//     document.addEventListener('mouseup', handleMouseUp);
//     return () => {
//       document.removeEventListener('mousemove', handleMouseMove);
//       document.removeEventListener('mouseup', handleMouseUp);
//       if (rafId) cancelAnimationFrame(rafId);
//     };
//   }, [resizingCol, saveColWidths]);

//   // ===== CELL INTERACTION HANDLERS (ALL STABLE via refs) =====
//   const shouldCellBeRed = useCallback((rowIndex, colIndex, cellValue) => {
//     if (colIndex < 9 || rowIndex < 13) return false;
//     const displayValue = parseCellValueMemoized(cellValue).displayValue;
//     if (!displayValue || displayValue.trim() === '') return false;
//     const referenceDate = parseCustomDate(tableDataRef.current[rowIndex]?.[3]);
//     const comparisonDate = parseCustomDate(tableDataRef.current[5]?.[colIndex]);
//     if (!referenceDate || !comparisonDate) return false;
//     return referenceDate < comparisonDate;
//   }, []);

//   const handleCellChangeWithTracking = useCallback((rowIndex, colIndex, value) => {
//     if (rowIndex === 12) return;
//     onCellChangeRef.current(rowIndex, colIndex, value);
//   }, []);

//   const handleCellClick = useCallback((rowIndex, colIndex) => {
//     // No-op on single click
//   }, []);

//   const handleCellContextMenu = useCallback((e, rowIndex, colIndex) => {
//     if (colIndex < 9 || rowIndex < 13) return;
//     e.preventDefault();

//     const cellKey = getCellKey(rowIndex, colIndex);
//     const currentValue = cellInputValuesRef.current[cellKey] !== undefined 
//       ? cellInputValuesRef.current[cellKey]
//       : tableDataRef.current[rowIndex]?.[colIndex];

//     if (!currentValue || currentValue.trim() === '') return;
//     const parsed = parseCellValueMemoized(currentValue);
//     if (!parsed.displayValue || parsed.displayValue.trim() === '') return;

//     setContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex, colIndex });
//   }, []);

//   const handleAllocationSelect = useCallback((allocationType) => {
//     if (contextMenu.rowIndex === null || contextMenu.colIndex === null) return;

//     const { rowIndex, colIndex } = contextMenu;
//     const cellKey = getCellKey(rowIndex, colIndex);
//     const currentValue = cellInputValuesRef.current[cellKey] !== undefined
//       ? cellInputValuesRef.current[cellKey]
//       : tableDataRef.current[rowIndex]?.[colIndex];

//     if (currentValue && currentValue.trim() !== '') {
//       const parsed = parseCellValueMemoized(currentValue);
//       const mode = allocationType === 'temporary' ? 'double' : 'single';
//       const newValue = formatCellValue(parsed.displayValue, mode);
//       delete cellInputValuesRef.current[cellKey];
//       onCellChangeRef.current(rowIndex, colIndex, newValue);
//     }

//     setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
//   }, [contextMenu]);

//   useEffect(() => {
//     const handleClickAway = () => {
//       setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
//     };
//     if (contextMenu.visible) {
//       document.addEventListener('click', handleClickAway);
//       return () => document.removeEventListener('click', handleClickAway);
//     }
//   }, [contextMenu.visible]);

//   // ===== FIXED: handleCellBlurWithTracking - properly saves ALL cells =====
//   const handleCellBlurWithTracking = useCallback((rowIndex, colIndex, blurValue) => {
//     if (colIndex >= 9 && rowIndex >= 13) {
//       // Scrollable data cells (row 13+, col J+)
//       const cellKey = getCellKey(rowIndex, colIndex);
//       const editedValue = cellInputValuesRef.current[cellKey] !== undefined 
//         ? cellInputValuesRef.current[cellKey]
//         : blurValue;

//       if (editedValue !== undefined && editedValue !== null && editedValue.toString().trim() !== '') {
//         let valueToSave = editedValue.toString().trim();
//         const parsed = parseCellValueMemoized(valueToSave);
//         const mode = cellClickModeRef.current[cellKey];
//         const extractedMode = parsed.mode || mode;
//         const plainValue = parsed.displayValue;
//         valueToSave = extractedMode ? formatCellValue(plainValue, extractedMode) : plainValue;
//         onCellChangeRef.current(rowIndex, colIndex, valueToSave);
//       } else if (!editedValue || editedValue.toString().trim() === '') {
//         onCellChangeRef.current(rowIndex, colIndex, '');
//       }

//       delete cellInputValuesRef.current[cellKey];
//       delete cellClickModeRef.current[cellKey];
//     } else if (colIndex >= 9 && rowIndex >= 1 && rowIndex <= 3) {
//       // Dropdown custom value cells (rows 1-3, col J+)
//       if (blurValue !== undefined && blurValue !== null && blurValue.toString().trim() !== '') {
//         const customValue = blurValue.toString().trim();
//         onCellChangeRef.current(rowIndex, colIndex, customValue);

//         setCustomDropdownValues(prev => {
//           const rowCustomValues = prev[rowIndex] || [];
//           if (!rowCustomValues.includes(customValue) && !getDropdownOptions(rowIndex).includes(customValue)) {

//             return { ...prev, [rowIndex]: [...rowCustomValues, customValue] };
//           }
//           return prev;
//         });
//       }
//     } else {
//       // ALL OTHER CELLS - ensure they save properly too
//       if (blurValue !== undefined && blurValue !== null) {
//         const currentTableValue = tableDataRef.current[rowIndex]?.[colIndex] ?? '';
//         const newValue = blurValue.toString();
//         // Only commit if value actually changed
//         if (newValue !== currentTableValue) {
//           onCellChangeRef.current(rowIndex, colIndex, newValue);
//         }
//       }
//     }

//     onCellBlurRef.current?.();
//   }, [getDropdownOptions]);

//   const getCellBackgroundColor = useCallback((rowIndex, colIndex, cellValue) => {
//   if (colIndex < 9 || rowIndex < 13) return {};
//   const parsed = parseCellValueMemoized(cellValue);
//   if (!parsed.displayValue || parsed.displayValue.trim() === '') return {};
//   if (parsed.mode === 'double') return { backgroundColor: '#f78686', boxShadow: 'inset 0 -0.5px 0 black' };
//   return { backgroundColor: '#91d7d0', boxShadow: 'inset 0 -0.5px 0 black' };
// }, []);

//   const hasColoredBackground = useCallback((rowIndex, colIndex, cellValue) => {
//     if (colIndex < 9 || rowIndex < 13) return false;
//     const parsed = parseCellValueMemoized(cellValue);
//     return parsed.displayValue && parsed.displayValue.trim() !== '';
//   }, []);

//   const getSmartViewRow13Values = useCallback((colIndex) => {
//     const rowIndices = [0, 1, 3, 5, 11];
//     const values = [];

//     for (let i = 0; i < rowIndices.length; i++) {
//       const rowIdx = rowIndices[i];
//       let displayValue = '';

//       if (rowIdx === 11 && colIndex >= FROZEN_COLS) {
//         displayValue = row12ValuesRef.current[colIndex] || '';
//       } else {
//         const cellValue = tableDataRef.current[rowIdx]?.[colIndex];
//         const parsed = parseCellValueMemoized(cellValue);
//         displayValue = parsed.displayValue || '';
//       }

//       values.push(displayValue.trim() ? displayValue : '-');
//     }

//     return values.join('\n');
//   }, []);

//   const getRow13HeaderValue = useCallback((colIndex) => ROW_13_HEADERS[colIndex] || '', []);
//   const getColIHeaderValue = useCallback((rowIndex) => COL_I_HEADERS[rowIndex] || '', []);

//   // ===== RENDER =====
//   return (
//     <div className="table-wrapper">
//       <div className={`excel-table-container ${isViewer ? 'viewer-mode' : ''} ${isSmartView ? 'smart-view-enabled' : ''}`}>
//         {/* FROZEN SECTION */}
//         <div className="frozen-section" ref={frozenSectionRef} style={{ width: `${frozenWidth}px` }}>
//           <table className="excel-table frozen-table">
//             <thead>
//               <tr className="header-row">
//                 <th className="row-header-cell"></th>
//                 {Array.from({ length: FROZEN_COLS }, (_, colIndex) => {
//                   if (isSmartView && FROZEN_COL_WIDTHS_SMART[colIndex] === 0) return null;
//                   return (
//                     <th
//                       key={`frozen-col-${colIndex}`}
//                       className={`col-header-cell ${selectedCols.has(colIndex) ? 'selected' : ''}`}
//                       style={{ width: `${getColWidth(colIndex)}px`, cursor: 'pointer' }}
//                       onClick={() => handleColSelect(colIndex)}
//                       onContextMenu={(e) => handleColHeaderContextMenu(e, colIndex)}
//                     >
//                       <div className="col-header-content">
//                         {getDisplayColumnLetter(colIndex)}
//                         <div
//                           className="col-resize-handle"
//                           onMouseDown={(e) => handleResizeStart(e, colIndex)}
//                           title="Drag to resize"
//                         />
//                       </div>
//                     </th>
//                   );
//                 })}
//               </tr>
//             </thead>
//             <tbody>
//               {/* Sticky rows (0-12) */}
//               {tableData.slice(0, STICKY_ROWS).map((row, rowIndex) => (
//                 <FrozenTableRow
//                   key={`frozen-row-${rowIndex}`}
//                   rowIndex={rowIndex}
//                   row={row}
//                   isSmartView={isSmartView}
//                   isRowSelected={selectedRows.has(rowIndex)}
//                   getColWidth={getColWidth}
//                   isRow13Header={isRow13Header}
//                   isColIHeader={isColIHeader}
//                   isDateCell={isDateCell}
//                   isDropdownCell={isDropdownCell}
//                   getRow13HeaderValue={getRow13HeaderValue}
//                   getColIHeaderValue={getColIHeaderValue}
//                   getDropdownOptions={getDropdownOptions}
//                   getCalculateColGValue={getCalculateColGValue}
//                   getCalculateColHValue={getCalculateColHValue}
//                   onCellChange={stableOnCellChange}
//                   onCellBlur={stableOnCellBlur}
//                   handleCellKeyDown={handleCellKeyDown}
//                   isViewer={isViewer}
//                   isColumnAFilled={isColumnAFilled}
//                   isColSelected={isColSelected}
//                   convertFromDateInput={convertFromDateInput}
//                   convertToDateInput={convertToDateInput}
//                   onRowSelect={handleRowSelect}
//                   onRowHeaderContextMenu={handleRowHeaderContextMenu}
//                   sortTableByDeliveryDate={sortTableByDeliveryDate}
//                   sortAscending={sortAscending}
//                   colGValues={colGValues}
//                   colHValues={colHValues}
//                 />
//               ))}

//               {/* Top spacer for virtualization */}
//               {visibleStart > STICKY_ROWS && (
//                 <tr style={{ height: `${(visibleStart - STICKY_ROWS) * ROW_HEIGHT}px` }}>
//                   <td colSpan={FROZEN_COLS + 1} style={{ padding: 0, border: 'none' }} />
//                 </tr>
//               )}

//               {/* Visible virtualized rows */}
//               {tableData.slice(visibleStart, visibleEnd).map((row, idx) => {
//                 const rowIndex = visibleStart + idx;
//                 return (
//                   <FrozenTableRow
//                     key={`frozen-row-${rowIndex}`}
//                     rowIndex={rowIndex}
//                     row={row}
//                     isSmartView={isSmartView}
//                     isRowSelected={selectedRows.has(rowIndex)}
//                     getColWidth={getColWidth}
//                     isRow13Header={isRow13Header}
//                     isColIHeader={isColIHeader}
//                     isDateCell={isDateCell}
//                     isDropdownCell={isDropdownCell}
//                     getRow13HeaderValue={getRow13HeaderValue}
//                     getColIHeaderValue={getColIHeaderValue}
//                     getDropdownOptions={getDropdownOptions}
//                     getCalculateColGValue={getCalculateColGValue}
//                     getCalculateColHValue={getCalculateColHValue}
//                     onCellChange={stableOnCellChange}
//                     onCellBlur={stableOnCellBlur}
//                     handleCellKeyDown={handleCellKeyDown}
//                     isViewer={isViewer}
//                     isColumnAFilled={isColumnAFilled}
//                     isColSelected={isColSelected}
//                     convertFromDateInput={convertFromDateInput}
//                     convertToDateInput={convertToDateInput}
//                     onRowSelect={handleRowSelect}
//                     onRowHeaderContextMenu={handleRowHeaderContextMenu}
//                     sortTableByDeliveryDate={sortTableByDeliveryDate}
//                     sortAscending={sortAscending}
//                     colGValues={colGValues}
//                     colHValues={colHValues}
//                   />
//                 );
//               })}

//               {/* Bottom spacer for virtualization */}
//               {visibleEnd < tableData.length && (
//                 <tr style={{ height: `${(tableData.length - visibleEnd) * ROW_HEIGHT}px` }}>
//                   <td colSpan={FROZEN_COLS + 1} style={{ padding: 0, border: 'none' }} />
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* SCROLLABLE SECTION */}
//         <div className="scrollable-section" ref={scrollableSectionRef}>
//           <table className="excel-table scrollable-table">
//             <thead>
//               <tr className="header-row">
//                 {/* Left spacer for hidden columns */}
//                 {visibleColStart > 0 && (
//                   <th colSpan={visibleColStart} style={{ width: `${Array.from({ length: visibleColStart }).reduce((w, _, i) => w + getColWidth(FROZEN_COLS + i), 0)}px`, padding: 0, border: 'none' }} />
//                 )}

//                 {/* Visible header cells */}
//                 {Array.from({ length: visibleColEnd - visibleColStart }).map((_, idx) => {
//                   const colIndex = visibleColStart + idx;
//                   const actualColIndex = FROZEN_COLS + colIndex;
//                   const isHidden = isFilterActive && selectedCols.size > 0 && !selectedCols.has(actualColIndex);

//                   return (
//                     <th
//                       key={`scroll-col-${actualColIndex}`}
//                       className={`col-header-cell ${selectedCols.has(actualColIndex) ? 'selected' : ''}`}
//                       style={{ width: `${getColWidth(actualColIndex)}px`, cursor: 'pointer', display: isHidden ? 'none' : undefined }}
//                       onClick={() => handleColSelect(actualColIndex)}
//                       onContextMenu={(e) => handleColHeaderContextMenu(e, actualColIndex)}
//                     >
//                       <div className="col-header-content">
//                         {getDisplayColumnLetter(actualColIndex)}
//                         <div
//                           className="col-resize-handle"
//                           onMouseDown={(e) => handleResizeStart(e, actualColIndex)}
//                           title="Drag to resize"
//                         />
//                       </div>
//                     </th>
//                   );
//                 })}

//                 {/* Right spacer for hidden columns */}
//                 {visibleColEnd < Math.max(0, numCols - FROZEN_COLS) && (
//                   <th colSpan={Math.max(0, numCols - FROZEN_COLS) - visibleColEnd} style={{ width: `${Array.from({ length: (numCols - FROZEN_COLS) - visibleColEnd }).reduce((w, _, i) => w + getColWidth(FROZEN_COLS + visibleColEnd + i), 0)}px`, padding: 0, border: 'none' }} />
//                 )}
//               </tr>
//             </thead>
//             <tbody>
//               {/* Sticky rows (0-12) */}
//               {tableData.slice(0, STICKY_ROWS).map((row, rowIndex) => (
//                 <ScrollableTableRow
//                   key={`scroll-row-${rowIndex}`}
//                   rowIndex={rowIndex}
//                   rowData={row}
//                   isSmartView={isSmartView}
//                   isRowSelected={selectedRows.has(rowIndex)}
//                   numCols={numCols}
//                   getColWidth={getColWidth}
//                   isDateCell={isDateCell}
//                   isDropdownCell={isDropdownCell}
//                   handleCellKeyDown={handleCellKeyDown}
//                   isViewer={isViewer}
//                   isColSelected={isColSelected}
//                   convertFromDateInput={convertFromDateInput}
//                   convertToDateInput={convertToDateInput}
//                   isColumnAFilled={isColumnAFilled}
//                   isRow1FilledForColumn={isRow1FilledForColumn}
//                   editingCellRef={editingCellRef}
//                   setEditingCell={setEditingCell}
//                   getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
//                   handleCellChangeWithTracking={handleCellChangeWithTracking}
//                   handleCellBlurWithTracking={handleCellBlurWithTracking}
//                   parseCellValue={parseCellValueMemoized}
//                   getCellBackgroundColor={getCellBackgroundColor}
//                   hasColoredBackground={hasColoredBackground}
//                   shouldCellBeRed={shouldCellBeRed}
//                   getCalculateRow12Value={getCalculateRow12Value}
//                   getSmartViewRow13Values={getSmartViewRow13Values}
//                   getCalculateColGValue={getCalculateColGValue}
//                   getCalculateColHValue={getCalculateColHValue}
//                   onCellClick={handleCellClick}
//                   onCellContextMenu={handleCellContextMenu}
//                   isFilterActive={isFilterActive}
//                   tableDataRef={tableDataRef}
//                   row12Values={row12Values}
//                   colGValues={colGValues}
//                   colHValues={colHValues}
//                   visibleColStart={visibleColStart}
//                   visibleColEnd={visibleColEnd}
//                 />
//               ))}

//               {/* Top spacer for virtualization */}
//               {visibleStart > STICKY_ROWS && (
//                 <tr style={{ height: `${(visibleStart - STICKY_ROWS) * ROW_HEIGHT}px` }}>
//                   <td colSpan={numCols - FROZEN_COLS} style={{ padding: 0, border: 'none' }} />
//                 </tr>
//               )}

//               {/* Visible virtualized rows */}
//               {tableData.slice(visibleStart, visibleEnd).map((row, idx) => {
//                 const rowIndex = visibleStart + idx;
//                 return (
//                   <ScrollableTableRow
//                     key={`scroll-row-${rowIndex}`}
//                     rowIndex={rowIndex}
//                     rowData={row}
//                     isSmartView={isSmartView}
//                     isRowSelected={selectedRows.has(rowIndex)}
//                     numCols={numCols}
//                     getColWidth={getColWidth}
//                     isDateCell={isDateCell}
//                     isDropdownCell={isDropdownCell}
//                     handleCellKeyDown={handleCellKeyDown}
//                     isViewer={isViewer}
//                     isColSelected={isColSelected}
//                     convertFromDateInput={convertFromDateInput}
//                     convertToDateInput={convertToDateInput}
//                     isColumnAFilled={isColumnAFilled}
//                     isRow1FilledForColumn={isRow1FilledForColumn}
//                     editingCellRef={editingCellRef}
//                     setEditingCell={setEditingCell}
//                     getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
//                     handleCellChangeWithTracking={handleCellChangeWithTracking}
//                     handleCellBlurWithTracking={handleCellBlurWithTracking}
//                     parseCellValue={parseCellValueMemoized}
//                     getCellBackgroundColor={getCellBackgroundColor}
//                     hasColoredBackground={hasColoredBackground}
//                     shouldCellBeRed={shouldCellBeRed}
//                     getCalculateRow12Value={getCalculateRow12Value}
//                     getSmartViewRow13Values={getSmartViewRow13Values}
//                     getCalculateColGValue={getCalculateColGValue}
//                     getCalculateColHValue={getCalculateColHValue}
//                     onCellClick={handleCellClick}
//                     onCellContextMenu={handleCellContextMenu}
//                     isFilterActive={isFilterActive}
//                     tableDataRef={tableDataRef}
//                     row12Values={row12Values}
//                     colGValues={colGValues}
//                     colHValues={colHValues}
//                     visibleColStart={visibleColStart}
//                     visibleColEnd={visibleColEnd}
//                   />
//                 );
//               })}

//               {/* Bottom spacer for virtualization */}
//               {visibleEnd < tableData.length && (
//                 <tr style={{ height: `${(tableData.length - visibleEnd) * ROW_HEIGHT}px` }}>
//                   <td colSpan={numCols - FROZEN_COLS} style={{ padding: 0, border: 'none' }} />
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* Context Menu for Allocation Type */}
//       {contextMenu.visible && (
//         <div
//           className="cell-context-menu"
//           style={{
//             position: 'fixed',
//             left: `${contextMenu.x}px`,
//             top: `${contextMenu.y}px`,
//             zIndex: 1000
//           }}
//         >
//           <div
//             className="context-menu-item"
//             onClick={() => handleAllocationSelect('temporary')}
//           >
//             Temporary allocation
//           </div>
//           <div
//             className="context-menu-item"
//             onClick={() => handleAllocationSelect('permanent')}
//           >
//             Permanent allocation
//           </div>
//         </div>
//       )}

//       {/* Context Menu for Insert Row */}
//       {insertRowMenu.visible && (
//         <div
//           className="cell-context-menu"
//           style={{
//             position: 'fixed',
//             left: `${insertRowMenu.x}px`,
//             top: `${insertRowMenu.y}px`,
//             zIndex: 1001
//           }}
//         >
//           <div className="context-menu-item" onClick={handleRowInsertAbove}>
//             Insert Row Above
//           </div>
//           <div className="context-menu-item" onClick={handleRowInsertBelow}>
//             Insert Row Below
//           </div>
//         </div>
//       )}

//       {/* Context Menu for Insert Column */}
//       {insertColMenu.visible && (
//         <div
//           className="cell-context-menu"
//           style={{
//             position: 'fixed',
//             left: `${insertColMenu.x}px`,
//             top: `${insertColMenu.y}px`,
//             zIndex: 1001
//           }}
//         >
//           <div className="context-menu-item" onClick={handleColInsertLeft}>
//             Insert Column Left
//           </div>
//           <div className="context-menu-item" onClick={handleColInsertRight}>
//             Insert Column Right
//           </div>
//         </div>
//       )}
//     </div>
//   );
// });

// Table.displayName = 'Table';

// export default Table;

import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, memo, useDeferredValue } from 'react';
import './table.css';

// ===== CONSTANTS =====
const MIN_COL_WIDTH = 80;
const ROW_HEADER_WIDTH = 50;
const FROZEN_COLS = 9;
const SCROLLABLE_COL_WIDTH = 150;
const ROW_HEIGHT = 32;
const OVERSCAN = 10;
const STICKY_ROWS = 13;

// ===== DEBUGGING FLAGS =====
// Set to false to disable row virtualization (render all rows - useful for debugging)
const ENABLE_ROW_VIRTUALIZATION = false;

const FROZEN_COL_WIDTHS_NORMAL = Object.freeze({
  0: 185, 1: 80, 2: 70, 3: 110, 4: 0, 5: 70, 6: 70, 7: 70, 8: 228
});

const FROZEN_COL_WIDTHS_SMART = Object.freeze({
  0: 185, 1: 0, 2: 0, 3: 110, 4: 0, 5: 70, 6: 70, 7: 70, 8: 0
});

const ROW_13_HEADERS = Object.freeze({
  0: 'Forecast Plant - Project',
  1: 'Decision Date',
  2: 'Order Date',
  3: 'Onsite\n Delivery date',
  4: 'X0 Date',
  5: 'Total Robots',
  6: 'Reused Robots',
  7: 'New Robots',
  8: 'Reuse Asumptions'
});

const COL_I_HEADERS = Object.freeze({
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
});

const DROPDOWN_OPTIONS = Object.freeze({
  1: ['xP ABB', 'xP FANUC', 'xVB FANUC', 'xF COMAU', 'xO FUNAC', 'xVG ABB', 'xP FANUC RJ3B std D2 ou B5', 'xP FANUC RJ3B std 2003-2006', 'xF FANUC R30B Std V3', 'xP ABB S4C+A Std B5', 'xP ABB S4C+A Std 2003-2006', 'xP ABB IRC5 Std New_Ml_V4', 'P51/52 hors ouvrant', 'fanucucc', 'XABB'],
  2: ['RJ3B B5/D2', 'RJ3B 2003-2006', 'RJ3B Legacy', 'RJ3B Global 1', 'R30A New_Ml_V4', 'R30A New_Ml_V6', 'R30B S Global 2', 'R30B New_Ml_V7', 'R30B New_Ml_V9', 'R30B Global 3', 'R30B+ New_Ml_V11', 'R30B+ New_Ml_V19', 'S4C A8', 'S4C+4', 'S4C+A 2003-2006', 'IRC5 M2004 B7', 'IRC5 M2009 New_Ml_V4', 'C3G C3G', 'C5G+ C5G+', 'Not Applicable'],
  3: ['F1', 'F2', 'F3', 'F4', 'Q1', 'Q2', 'Q3', 'Q4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'V2', 'V3', 'Not Applicable']
});

const SMART_VIEW_CELL_STYLE = Object.freeze({
  whiteSpace: 'pre-wrap',
  fontSize: '9px',
  lineHeight: '1.2',
  padding: '2px',
  textAlign: 'center',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
});

const CALCULATED_CELL_STYLE = Object.freeze({
  fontWeight: 'bold',
  borderRadius: '0px',
  width: '100%',
  boxSizing: 'border-box',
  height: '100%',
  marginLeft: '-2.5px'
});

const DATE_WRAPPER_STYLE = Object.freeze({
  cursor: 'pointer',
  padding: '4px'
});

// ===== LRU CACHE =====
class LRUCache {
  constructor(maxSize = 500) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const parserCache = new LRUCache(500);

// ===== UTILITY FUNCTIONS =====
const parseCellValue = (cellValue) => {
  if (!cellValue) return { displayValue: '', mode: null };

  const cached = parserCache.get(cellValue);
  if (cached) return cached;

  const greenMatch = cellValue.match(/^(.*?)\s*\(green\)$/);
  const orangeMatch = cellValue.match(/^(.*?)\s*\(orange\)$/);

  let result;
  if (greenMatch) result = { displayValue: greenMatch[1].trim(), mode: 'single' };
  else if (orangeMatch) result = { displayValue: orangeMatch[1].trim(), mode: 'double' };
  else result = { displayValue: cellValue, mode: null };

  parserCache.set(cellValue, result);
  return result;
};

const formatCellValue = (value, mode) => {
  if (!value || value.trim() === '') return '';
  const cleanValue = value.replace(/\s*\((green|orange)\)$/i, '').trim();
  if (mode === 'single') return `${cleanValue} (green)`;
  if (mode === 'double') return `${cleanValue} (orange)`;
  return cleanValue;
};

const convertToDateInput = (value) => {
  if (!value) return '';
  try {
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date = new Date(value);
    } else if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(value)) {
      date = new Date(value);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
      date = new Date(value);
    } else if (/^[A-Za-z]+ \d{2,4}$/.test(value)) {
      const parts = value.split(' ');
      let year = parts[1];
      if (year.length === 2) year = '20' + year;
      date = new Date(`${parts[0]} 1, ${year}`);
    } else {
      date = new Date(value);
    }
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) { /* ignore */ }
  return '';
};

const convertFromDateInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch (e) { /* ignore */ }
  return '';
};

const parseCustomDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  try {
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = new Date(dateStr);
    } else if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(dateStr)) {
      date = new Date(dateStr);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
      date = new Date(dateStr);
    } else if (/^[A-Za-z]+ \d{2,4}$/.test(dateStr)) {
      const parts = dateStr.trim().split(' ');
      let year = parts[1];
      if (year.length === 2) {
        const parsedYear = parseInt(year, 10);
        year = (parsedYear < 50) ? '20' + year : '19' + year;
      }
      date = new Date(`${parts[0]} 1, ${year}`);
    } else {
      date = new Date(dateStr);
    }
    return !isNaN(date.getTime()) ? date : null;
  } catch (e) {
    return null;
  }
};

const getColumnLetter = (index) => {
  let letter = '';
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode(65 + (num % 26)) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
};

const getDisplayColumnLetter = (index) => {
  if (index < 9) return '';
  return getColumnLetter(index - 9);
};

const isDateCell = (rowIndex, colIndex) => {
  if (rowIndex === 5) return true;
  if (colIndex >= 1 && colIndex <= 4) return true;
  return false;
};

const isDropdownCell = (rowIndex, colIndex) => {
  return (rowIndex >= 1 && rowIndex <= 3) && colIndex >= 9;
};

const isRow13Header = (rowIndex, colIndex) => {
  return rowIndex === 12 && colIndex <= 8;
};

const isColIHeader = (rowIndex, colIndex) => {
  return colIndex === 8 && rowIndex < 12;
};

const getCellKey = (rowIndex, colIndex) => `${rowIndex}-${colIndex}`;

// ===== HOOKS =====
const useVirtualRows = (totalRows, containerRef) => {
  // NO ROW VIRTUALIZATION - render all rows instantly
  return { start: STICKY_ROWS, end: totalRows };
};

const useVirtualCols = (totalCols, containerRef, colWidth = SCROLLABLE_COL_WIDTH) => {
  // NO COLUMN VIRTUALIZATION - render all columns instantly
  return { start: 0, end: totalCols };
};

// ===== EDITABLE CELL COMPONENT =====
const EditableCell = memo(({
  initialValue,
  onCommit,
  onKeyDown,
  onClick,
  onContextMenu,
  disabled,
  className,
  style,
  title
}) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const prevInitialRef = useRef(initialValue);
  const localValueRef = useRef(localValue);

  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    if (prevInitialRef.current!== initialValue) {
      prevInitialRef.current = initialValue;
      setLocalValue(initialValue);
    }
  }, [initialValue]);

  const handleChange = useCallback((e) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    const current = localValueRef.current;
    if (current!== prevInitialRef.current) {
      prevInitialRef.current = current;
      onCommit(current);
    }
  }, [onCommit]);

  const handleKeyDown = useCallback((e) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const current = localValueRef.current;
      if (current!== prevInitialRef.current) {
        prevInitialRef.current = current;
        onCommit(current);
      }
      onKeyDown?.(e);
    }
  }, [onCommit, onKeyDown]);

  const handleClick = useCallback(onClick, [onClick]);
  const handleContextMenu = useCallback(onContextMenu, [onContextMenu]);

  const isDisabled = disabled;

  const cellStyle = {...style };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      disabled={isDisabled}
      className={className}
      style={cellStyle}
      title={title}
    />
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.initialValue === nextProps.initialValue &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.className === nextProps.className &&
    prevProps.title === nextProps.title &&
    prevProps.style === nextProps.style &&
    prevProps.onCommit === nextProps.onCommit &&
    prevProps.onKeyDown === nextProps.onKeyDown
  );
});

// ===== SCROLLABLE TABLE CELL =====
const ScrollableTableCell = memo(({
  rowIndex, colIndex, isSmartView, isViewer, isRowSelected, isColSelected,
  onCellContextMenu,
  handleCellKeyDown, setEditingCell,
  isColumnAFilled, isRow1FilledForColumn, getColWidth,
  isDateCellFn, isDropdownCellFn,
  getDropdownOptionsWithCustom, handleCellChangeWithTracking, handleCellBlurWithTracking,
  getCellBackgroundColor, hasColoredBackground, shouldCellBeRed,
  convertToDateInput, convertFromDateInput, getSmartViewRow13Values,
  isFilterActive, cellValue, row12Value, colGValue, colHValue,
  editingCellRef
}) => {
  const actualColIndex = FROZEN_COLS + colIndex;
  const isHidden = isFilterActive && !isColSelected;

  // Local state for custom editing mode - only this cell re-renders when it starts editing
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  
  // Check if this cell is the one being edited, update local state
  useEffect(() => {
    const isCellEditing = editingCellRef.current?.row === rowIndex && editingCellRef.current?.col === actualColIndex;
    if (isCellEditing && !isCustomEditing) {
      setIsCustomEditing(true);
    } else if (!isCellEditing && isCustomEditing) {
      setIsCustomEditing(false);
    }
  }, [editingCellRef, rowIndex, actualColIndex, isCustomEditing]);

  // Parse cell value
  const parsed = useMemo(() => parseCellValue(cellValue), [cellValue]);
  const displayCell = parsed.displayValue;

  // Cell type checks
  const isCellDropdown = useMemo(() => isDropdownCellFn(rowIndex, actualColIndex), [rowIndex, actualColIndex, isDropdownCellFn]);
  const isCellDate = useMemo(() => isDateCellFn(rowIndex, actualColIndex), [rowIndex, actualColIndex, isDateCellFn]);
  const isCalculated = rowIndex === 11 && actualColIndex >= 9;
  const isSmartViewCell = rowIndex === 12 && isSmartView && actualColIndex >= 9;
  const isHeaderRow = rowIndex === 12;

  // Dropdown options
  const dropdownOptions = useMemo(() =>
    isCellDropdown ? getDropdownOptionsWithCustom(rowIndex) : null,
    [isCellDropdown, rowIndex, getDropdownOptionsWithCustom]
  );

  // Red cell check
  const isRedCell = useMemo(() =>
    shouldCellBeRed(rowIndex, actualColIndex, cellValue),
    [rowIndex, actualColIndex, cellValue, shouldCellBeRed]
  );

  // Refs to stable function references (never update callbacks when these change)
  const handleCellBlurWithTrackingRef = useRef(handleCellBlurWithTracking);
  const handleCellKeyDownRef = useRef(handleCellKeyDown);
  const onCellContextMenuRef = useRef(onCellContextMenu);

  // Keep refs current
  useEffect(() => {
    handleCellBlurWithTrackingRef.current = handleCellBlurWithTracking;
    handleCellKeyDownRef.current = handleCellKeyDown;
    onCellContextMenuRef.current = onCellContextMenu;
  }, [handleCellBlurWithTracking, handleCellKeyDown, onCellContextMenu]);

  // Stable handlers - NO dependencies on function props (use refs instead)
  const handleCommit = useCallback((value) => {
    handleCellBlurWithTrackingRef.current(rowIndex, actualColIndex, value);
  }, [rowIndex, actualColIndex]);

  const handleKeyDown = useCallback((e) => {
    handleCellKeyDownRef.current(e, rowIndex, actualColIndex);
  }, [rowIndex, actualColIndex]);

  const handleContextMenu = useCallback((e) => {
    onCellContextMenuRef.current(e, rowIndex, actualColIndex);
  }, [rowIndex, actualColIndex]);

  const isDisabled = isViewer;

  const cellBgStyle = useMemo(() =>
    getCellBackgroundColor(rowIndex, actualColIndex, cellValue),
    [rowIndex, actualColIndex, cellValue, getCellBackgroundColor]
  );

  const hasColored = useMemo(() =>
    hasColoredBackground(rowIndex, actualColIndex, cellValue),
    [rowIndex, actualColIndex, cellValue, hasColoredBackground]
  );

  const cellStyle = useMemo(() => ({
    ...(isRedCell ? { color: 'red' } : {}),
    ...cellBgStyle
  }), [isRedCell, cellBgStyle]);

  const cellClassName = useMemo(() => {
    const classes = ['data-cell'];
    if (rowIndex < 12 && actualColIndex < 8) classes.push('white-cell-no-border');
    if (rowIndex >= 13 && actualColIndex >= 9) classes.push('grey-cell-after-col-i-row-13');
    if (isRowSelected || isColSelected) classes.push('selected');
    return classes.join(' ');
  }, [rowIndex, actualColIndex, isRowSelected, isColSelected]);

  // Render calculated cell (row 12)
  if (isSmartViewCell) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
        <div className="cell-input" style={SMART_VIEW_CELL_STYLE}>
          {getSmartViewRow13Values(actualColIndex)}
        </div>
      </td>
    );
  }

  if (isHeaderRow) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
        <input type="text" value={cellValue} disabled className="cell-input" title={cellValue} />
      </td>
    );
  }

  if (isCalculated) {
    const calcValue = row12Value ?? '';
    const numValue = parseFloat(calcValue);
    const bgColor = !isNaN(numValue) && numValue !== 0
      ? '#458efa'
      : (numValue === 0 ? '#fa7878' : undefined);

    return (
      <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
        <input
          type="text"
          value={calcValue}
          disabled
          className="cell-input"
          style={{ ...CALCULATED_CELL_STYLE, backgroundColor: bgColor }}
        />
      </td>
    );
  }

  if (isCellDropdown) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
        {isCustomEditing ? (
          <EditableCell
            initialValue={displayCell}
            onCommit={(value) => {
              setEditingCell(null);
              handleCellBlurWithTracking(rowIndex, actualColIndex, value);
            }}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            disabled={isDisabled}
            className={`cell-input ${hasColored ? 'colored-cell' : ''}`}
            style={cellBgStyle}
            title={displayCell}
          />
        ) : !displayCell || dropdownOptions?.includes(displayCell) ? (
          <select
            value={displayCell}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setEditingCell({ row: rowIndex, col: actualColIndex });
              } else {
                handleCellChangeWithTracking(rowIndex, actualColIndex, e.target.value);
              }
            }}
            onContextMenu={handleContextMenu}
            onBlur={(e) => handleCellBlurWithTracking(rowIndex, actualColIndex, e.target.value)}
            disabled={isDisabled}
            className={`cell-input dropdown-input ${hasColored ? 'colored-cell' : ''}`}
            style={cellBgStyle}
            onKeyDown={handleKeyDown}
            title={displayCell}
          >
            <option value="" style={{ display: 'none' }}></option>
            {dropdownOptions?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value="custom">-- Custom --</option>
          </select>
        ) : (
          <div
            className={`cell-input dropdown-custom-display ${hasColored ? 'colored-cell' : ''}`}
            style={{ ...DATE_WRAPPER_STYLE, ...cellBgStyle }}
            title={displayCell}
          >
            {displayCell}
          </div>
        )}
      </td>
    );
  }

  if (isCellDate) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
        <div className={`date-cell-wrapper ${hasColored ? 'colored-cell' : ''}`} style={cellBgStyle} title={displayCell}>
          <span className="date-display">{displayCell}</span>
          <input
            type="date"
            value={convertToDateInput(displayCell)}
            onChange={(e) => {
              const formatted = convertFromDateInput(e.target.value);
              handleCellBlurWithTracking(rowIndex, actualColIndex, formatted);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.target.showPicker?.();
            }}
            onContextMenu={handleContextMenu}
            disabled={isDisabled}
            className="cell-input date-input"
          />
        </div>
      </td>
    );
  }

  // Default: editable text cell (Excel-like - updates only on blur)
  return (
    <td className={cellClassName} style={{ width: `${getColWidth(actualColIndex)}px`, display: isHidden ? 'none' : undefined }}>
      <EditableCell
        initialValue={displayCell}
        onCommit={(value) => {
          handleCellBlurWithTrackingRef.current(rowIndex, actualColIndex, value);
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        disabled={isDisabled}
        className={`cell-input ${hasColored ? 'colored-cell' : ''}`}
        style={cellStyle}
        title={displayCell}
      />
    </td>
  );
}, (prevProps, nextProps) => {
  if (prevProps.cellValue !== nextProps.cellValue) return false;
  if (prevProps.rowIndex !== nextProps.rowIndex) return false;
  if (prevProps.colIndex !== nextProps.colIndex) return false;
  if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
  if (prevProps.isColSelected !== nextProps.isColSelected) return false;
  if (prevProps.isSmartView !== nextProps.isSmartView) return false;
  if (prevProps.isViewer !== nextProps.isViewer) return false;
  if (prevProps.isFilterActive !== nextProps.isFilterActive) return false;
  if (prevProps.isEditing !== nextProps.isEditing) return false;
  if (prevProps.row12Value !== nextProps.row12Value) return false;
  if (prevProps.colGValue !== nextProps.colGValue) return false;
  if (prevProps.colHValue !== nextProps.colHValue) return false;
  return true;
});

ScrollableTableCell.displayName = 'ScrollableTableCell';

// ===== FROZEN TABLE CELL =====
const FrozenTableCell = memo(({
  rowIndex, colIndex, cell, isSmartView, isViewer, isRowSelected, isColSelected,
  onCellChange, onCellBlur, handleCellKeyDown,
  getRow13HeaderValue, getColIHeaderValue, getDropdownOptions, getColWidth,
  convertFromDateInput, convertToDateInput,
  sortTableByDeliveryDate, sortAscending, colGValue, colHValue
}) => {
  const handleKeyDown = useCallback((e) => {
    handleCellKeyDown(e, rowIndex, colIndex);
  }, [handleCellKeyDown, rowIndex, colIndex]);

  const handleChange = useCallback((e) => {
    onCellChange(rowIndex, colIndex, e.target.value);
  }, [onCellChange, rowIndex, colIndex]);

  const handleBlur = useCallback(() => {
    onCellBlur();
  }, [onCellBlur]);

  const isDisabled = isViewer;
  const isRow13HeaderCell = isRow13Header(rowIndex, colIndex);
  const isColIHeaderCell = isColIHeader(rowIndex, colIndex);
  const isCellDate = isDateCell(rowIndex, colIndex);
  const isCellDropdown = isDropdownCell(rowIndex, colIndex);

  const cellClassName = useMemo(() => {
    const classes = ['data-cell'];
    if (rowIndex === 12 && colIndex < 9) classes.push('highlight-row-13');
    if (rowIndex < 12 && colIndex < 8) classes.push('white-cell-no-border');
    if (rowIndex <= 12 && colIndex === 8) classes.push(`highlight-col-i-${rowIndex}`);
    if (isRowSelected || isColSelected) classes.push('selected');
    return classes.join(' ');
  }, [rowIndex, colIndex, isRowSelected, isColSelected]);

  // Row 13 header
  if (isRow13HeaderCell) {
    const headerStyle = {
      whiteSpace: 'pre-wrap',
      fontSize: isSmartView ? '9px' : '13px',
      lineHeight: isSmartView ? '1.2' : '1.5',
      padding: isSmartView ? '2px' : '0 8px',
      textAlign: 'center',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: isSmartView ? 'hidden' : 'visible',
      cursor: colIndex === 3 ? 'pointer' : 'default'
    };

    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <div
          className="cell-input header-cell"
          style={headerStyle}
          onClick={() => colIndex === 3 && sortTableByDeliveryDate()}
        >
          {getRow13HeaderValue(colIndex)}
          {colIndex === 3 && <span style={{ marginLeft: '4px', fontSize: '12px' }}>{sortAscending ? '▲' : '▼'}</span>}
        </div>
      </td>
    );
  }

  // Row 12 (non-header, disabled)
  if (rowIndex === 12) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <input type="text" value={cell} disabled className="cell-input" />
      </td>
    );
  }
  // Col I header
  if (isColIHeaderCell) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <input
          type="text"
          value={getColIHeaderValue(rowIndex)}
          disabled
          className="cell-input"
          style={{ fontWeight: 'bold' }}
        />
      </td>
    );
  }

  // Col G calculated (rowIndex >= 13)
  if (rowIndex >= 13 && colIndex === 6) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <input type="text" value={colGValue ?? ''} disabled className="cell-input" />
      </td>
    );
  }

  // Col H calculated (rowIndex >= 13)
  if (rowIndex >= 13 && colIndex === 7) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <input type="text" value={colHValue ?? ''} disabled className="cell-input" />
      </td>
    );
  }

  // Dropdown cell
  if (isCellDropdown) {
    const options = getDropdownOptions(rowIndex);
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <select
          value={cell}
          onChange={handleChange}
          disabled={isDisabled}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="cell-input dropdown-input"
        >
          <option value="" style={{ display: 'none' }}></option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
          <option value="custom">-- Custom --</option>
        </select>
      </td>
    );
  }

  // Date cell
  if (isCellDate) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <div className="date-cell-wrapper">
          <span className="date-display">{cell}</span>
          <input
            type="date"
            value={convertToDateInput(cell)}
            onChange={(e) => {
              const formatted = convertFromDateInput(e.target.value);
              onCellChange(rowIndex, colIndex, formatted);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.target.showPicker?.()}
            disabled={isDisabled}
            className="cell-input date-input"
          />
        </div>
      </td>
    );
  }

  // Default: text input (Excel-like - updates only on blur for rows 13+)
  if (rowIndex >= 13) {
    return (
      <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
        <EditableCell
          initialValue={cell}
          onCommit={(value) => {
            onCellChange(rowIndex, colIndex, value);
            onCellBlur();
          }}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className="cell-input"
        />
      </td>
    );
  }

  // For rows 1-12: standard blur behavior
  return (
    <td className={cellClassName} style={{ width: `${getColWidth(colIndex)}px` }}>
      <input
        type="text"
        value={cell}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        onBlur={handleBlur}
        className="cell-input"
      />
    </td>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.cell === nextProps.cell &&
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.colIndex === nextProps.colIndex &&
    prevProps.isRowSelected === nextProps.isRowSelected &&
    prevProps.isColSelected === nextProps.isColSelected &&
    prevProps.isSmartView === nextProps.isSmartView &&
    prevProps.isViewer === nextProps.isViewer &&
    prevProps.sortAscending === nextProps.sortAscending &&
    prevProps.colGValue === nextProps.colGValue &&
    prevProps.colHValue === nextProps.colHValue
  );
});

FrozenTableCell.displayName = 'FrozenTableCell';

// ===== FROZEN TABLE ROW =====
const FrozenTableRow = memo(({
  rowIndex, row, isSmartView, isRowSelected,
  getColWidth, getRow13HeaderValue, getColIHeaderValue, getDropdownOptions,
  onCellChange, onCellBlur, handleCellKeyDown, isViewer,
  isColSelected, convertFromDateInput, convertToDateInput,
  onRowSelect, onRowHeaderContextMenu,
  sortTableByDeliveryDate, sortAscending, colGValues, colHValues
}) => {
  const rowStyle = useMemo(() => {
    const style = {};
    if (isSmartView && rowIndex < 12) style.display = 'none';
    if (rowIndex <= 12) style.position = 'sticky';
    if (isSmartView && rowIndex === 12) style.top = '28px';
    return style;
  }, [isSmartView, rowIndex]);

  const rowClassName = useMemo(() => {
    const classes = ['data-row'];
    if (rowIndex <= 12) classes.push('sticky-row-13');
    if (isRowSelected) classes.push('selected');
    return classes.join(' ');
  }, [rowIndex, isRowSelected]);

  return (
    <tr className={rowClassName} style={rowStyle}>
      <td
        className={`row-number-cell ${rowIndex === 12 ? 'highlight-row-13' : ''} ${isRowSelected ? 'selected' : ''}`}
        onClick={() => onRowSelect(rowIndex)}
        onContextMenu={(e) => onRowHeaderContextMenu(e, rowIndex)}
        style={{ cursor: 'pointer', ...(rowIndex === 12 && { color: 'black' }) }}
      >
        {rowIndex === 12 ? 'S.no' : rowIndex < 13 ? '' : rowIndex - 12}
      </td>
      {Array.from({ length: FROZEN_COLS }, (_, colIndex) => (
        <FrozenTableCell
          key={`frozen-${rowIndex}-${colIndex}`}
          rowIndex={rowIndex}
          colIndex={colIndex}
          cell={row[colIndex] ?? ''}
          isSmartView={isSmartView}
          isViewer={isViewer}
          isRowSelected={isRowSelected}
          isColSelected={isColSelected(colIndex)}
          onCellChange={onCellChange}
          onCellBlur={onCellBlur}
          handleCellKeyDown={handleCellKeyDown}
          getRow13HeaderValue={getRow13HeaderValue}
          getColIHeaderValue={getColIHeaderValue}
          getDropdownOptions={getDropdownOptions}
          getColWidth={getColWidth}
          convertFromDateInput={convertFromDateInput}
          convertToDateInput={convertToDateInput}
          sortTableByDeliveryDate={sortTableByDeliveryDate}
          sortAscending={sortAscending}
          colGValue={colGValues[rowIndex]}
          colHValue={colHValues[rowIndex]}
        />
      ))}
    </tr>
  );
}, (prevProps, nextProps) => {
  if (prevProps.rowIndex !== nextProps.rowIndex) return false;
  if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
  if (prevProps.isSmartView !== nextProps.isSmartView) return false;
  if (prevProps.sortAscending !== nextProps.sortAscending) return false;
  if (prevProps.row !== nextProps.row) return false;
  if (prevProps.colGValues !== nextProps.colGValues) return false;
  if (prevProps.colHValues !== nextProps.colHValues) return false;
  return true;
});

FrozenTableRow.displayName = 'FrozenTableRow';

// ===== SCROLLABLE TABLE ROW =====
const ScrollableTableRow = memo(({
  rowIndex, isSmartView, isRowSelected,
  numCols, getColWidth,
  handleCellKeyDown, isViewer, isColSelected,
  convertFromDateInput, convertToDateInput, isColumnAFilled, isRow1FilledForColumn,
  editingCellRef, setEditingCell, getDropdownOptionsWithCustom,
  handleCellChangeWithTracking, handleCellBlurWithTracking,
  getCellBackgroundColor, hasColoredBackground, shouldCellBeRed,
  getSmartViewRow13Values,
  onCellContextMenu, isFilterActive, rowData, row12Values,
  colGValues, colHValues, visibleColStart, visibleColEnd
}) => {
  // Derive editing state from ref to avoid object comparisons
  const isEditingThisRow = editingCellRef.current?.row === rowIndex;
  const rowStyle = useMemo(() => {
    const style = {};
    if (isSmartView && rowIndex < 12) style.display = 'none';
    if (rowIndex <= 12) style.position = 'sticky';
    if (isSmartView && rowIndex === 12) style.top = '28px';
    return style;
  }, [isSmartView, rowIndex]);

  const rowClassName = useMemo(() => {
    const classes = ['data-row'];
    if (rowIndex <= 12) classes.push('sticky-row-13');
    if (isRowSelected) classes.push('selected');
    return classes.join(' ');
  }, [rowIndex, isRowSelected]);

  // Spacer widths for column virtualization
  const leftSpacerWidth = useMemo(() => {
    let width = 0;
    for (let i = 0; i < visibleColStart; i++) {
      width += SCROLLABLE_COL_WIDTH;
    }
    return width;
  }, [visibleColStart]);

  const rightSpacerWidth = useMemo(() => {
    const totalScrollCols = numCols - FROZEN_COLS;
    let width = 0;
    for (let i = visibleColEnd; i < totalScrollCols; i++) {
      width += SCROLLABLE_COL_WIDTH;
    }
    return width;
  }, [visibleColEnd, numCols]);

  return (
    <tr className={rowClassName} style={rowStyle}>
      {/* Left spacer */}
      {leftSpacerWidth > 0 && (
        <td style={{ width: `${leftSpacerWidth}px`, minWidth: `${leftSpacerWidth}px`, padding: 0, border: 'none' }} />
      )}

      {/* Visible cells */}
      {Array.from({ length: visibleColEnd - visibleColStart }, (_, idx) => {
        const colIndex = visibleColStart + idx;
        const actualColIndex = FROZEN_COLS + colIndex;
        const cellValue = rowData?.[actualColIndex] ?? '';

        return (
          <ScrollableTableCell
            key={`scroll-${rowIndex}-${actualColIndex}`}
            rowIndex={rowIndex}
            colIndex={colIndex}
            cellValue={cellValue}
            isSmartView={isSmartView}
            isViewer={isViewer}
            isRowSelected={isRowSelected}
            isColSelected={isColSelected(actualColIndex)}
            onCellContextMenu={onCellContextMenu}
            handleCellKeyDown={handleCellKeyDown}
            setEditingCell={setEditingCell}
            editingCellRef={editingCellRef}
            isColumnAFilled={isColumnAFilled}
            isRow1FilledForColumn={isRow1FilledForColumn}
            getColWidth={getColWidth}
            isDateCellFn={isDateCell}
            isDropdownCellFn={isDropdownCell}
            getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
            handleCellChangeWithTracking={handleCellChangeWithTracking}
            handleCellBlurWithTracking={handleCellBlurWithTracking}
            getCellBackgroundColor={getCellBackgroundColor}
            hasColoredBackground={hasColoredBackground}
            shouldCellBeRed={shouldCellBeRed}
            convertToDateInput={convertToDateInput}
            convertFromDateInput={convertFromDateInput}
            getSmartViewRow13Values={getSmartViewRow13Values}
            isFilterActive={isFilterActive}
            row12Value={row12Values[actualColIndex]}
            colGValue={colGValues[rowIndex]}
            colHValue={colHValues[rowIndex]}
          />
        );
      })}

      {/* Right spacer */}
      {rightSpacerWidth > 0 && (
        <td style={{ width: `${rightSpacerWidth}px`, minWidth: `${rightSpacerWidth}px`, padding: 0, border: 'none' }} />
      )}
    </tr>
  );
}, (prevProps, nextProps) => {
  if (prevProps.rowIndex !== nextProps.rowIndex) return false;
  if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
  if (prevProps.isSmartView !== nextProps.isSmartView) return false;
  if (prevProps.numCols !== nextProps.numCols) return false;
  if (prevProps.isFilterActive !== nextProps.isFilterActive) return false;
  if (prevProps.rowData !== nextProps.rowData) return false;
  if (prevProps.row12Values !== nextProps.row12Values) return false;
  if (prevProps.colGValues !== nextProps.colGValues) return false;
  if (prevProps.colHValues !== nextProps.colHValues) return false;
  return true;
});

ScrollableTableRow.displayName = 'ScrollableTableRow';

// ===== MAIN TABLE COMPONENT =====
const Table = forwardRef(({
  tableData, onCellChange, onCellBlur, onUpdateTableData, canUndo, canRedo,
  selectedRows = new Set(), setSelectedRows, selectedCols = new Set(), setSelectedCols,
  isFilterActive = false, isViewer = false, onSmartViewToggle, onInsertRow, onInsertCol
}, ref) => {

  const [colWidths, setColWidths] = useState({});
  const [resizingCol, setResizingCol] = useState(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [isSmartView, setIsSmartView] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
  const [customDropdownValues, setCustomDropdownValues] = useState({});
  const [insertRowMenu, setInsertRowMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null });
  const [insertColMenu, setInsertColMenu] = useState({ visible: false, x: 0, y: 0, colIndex: null });
  const [robotStandards, setRobotStandards] = useState([]);
  const [standardControllers, setStandardControllers] = useState([]);
  const [standardFamilies, setStandardFamilies] = useState([]);
  const [sortAscending, setSortAscending] = useState(true);
  
  // Defer tableData to prevent blocking UI during rapid edits
  const deferredTableData = useDeferredValue(tableData);
  
  // Ref-based editing state to avoid re-rendering all rows on cell click
  const editingCellRef = useRef(null);
  const [editingCellTrigger, setEditingCellTrigger] = useState(0); // Triggers only affected cell
  const setEditingCell = useCallback((cell) => {
    editingCellRef.current = cell;
    setEditingCellTrigger(prev => prev + 1);
  }, []);

  const frozenSectionRef = useRef(null);
  const scrollableSectionRef = useRef(null);
  const tableDataRef = useRef(tableData);
  const onCellChangeRef = useRef(onCellChange);
  const onCellBlurRef = useRef(onCellBlur);

  // Keep refs in sync
  useEffect(() => { tableDataRef.current = tableData; }, [tableData]);
  useEffect(() => { onCellChangeRef.current = onCellChange; }, [onCellChange]);
  useEffect(() => { onCellBlurRef.current = onCellBlur; }, [onCellBlur]);

// ===== ROW & COL VIRTUALIZATION =====
const numCols = useMemo(() => tableData[0]?.length || 0, [tableData]);
const numColsRef = useRef(numCols);
useEffect(() => { numColsRef.current = numCols; }, [numCols]);

const { start: visibleStart, end: visibleEnd } = useVirtualRows(tableData.length, frozenSectionRef);
const { start: visibleColStart, end: visibleColEnd } = useVirtualCols(numCols - FROZEN_COLS, scrollableSectionRef);

// ===== FETCH DROPDOWN DATA =====
useEffect(() => {
  const fetchData = async () => {
    try {
      const [standardsRes, controllersRes, familiesRes] = await Promise.all([
        fetch('/api/robot-standards'),
        fetch('/api/standard-controllers'),
        fetch('/api/standard-families')
      ]);

      const standardsResult = await standardsRes.json();
      const controllersResult = await controllersRes.json();
      const familiesResult = await familiesRes.json();

      if (standardsResult.success && standardsResult.data) {
        setRobotStandards(standardsResult.data.map(item => item.standard).sort());
      }
      if (controllersResult.success && controllersResult.data) {
        setStandardControllers(controllersResult.data.map(item => item.controller).sort());
      }
      if (familiesResult.success && familiesResult.data) {
        setStandardFamilies(familiesResult.data.map(item => item.family).sort());
      }
    } catch (error) {
      console.error('Failed to fetch dropdowns:', error);
    }
  };
  fetchData();
}, []);

// ===== COLUMN WIDTH LOGIC =====
const getOptimalColWidth = useCallback(() => {
  if (numCols === 0) return MIN_COL_WIDTH;
  const availableWidth = containerWidth - (ROW_HEADER_WIDTH + 32);
  return Math.max(MIN_COL_WIDTH, Math.floor(availableWidth / numCols));
}, [containerWidth, numCols]);

const getColWidth = useCallback((index) => {
  if (index >= FROZEN_COLS) return SCROLLABLE_COL_WIDTH;
  const CURRENT_WIDTHS = isSmartView ? FROZEN_COL_WIDTHS_SMART : FROZEN_COL_WIDTHS_NORMAL;
  if (CURRENT_WIDTHS[index] !== null && CURRENT_WIDTHS[index] !== undefined) {
    return CURRENT_WIDTHS[index];
  }
  return colWidths[index] || getOptimalColWidth();
}, [colWidths, getOptimalColWidth, isSmartView]);

const frozenWidth = useMemo(() => {
  let width = ROW_HEADER_WIDTH;
  for (let i = 0; i < FROZEN_COLS && i < numCols; i++) {
    width += getColWidth(i);
  }
  return width;
}, [numCols, getColWidth]);

// ===== MEMOIZED MAPS =====
const columnAFilledMap = useMemo(() => {
  const map = {};
  for (let i = 13; i < tableData.length; i++) {
    map[i] = tableData[i]?.[0]?.trim() !== '';
  }
  return map;
}, [tableData]);

const row1FilledMap = useMemo(() => {
  const map = {};
  for (let i = 9; i < numCols; i++) {
    map[i] = tableData[0]?.[i]?.trim() !== '';
  }
  return map;
}, [tableData, numCols]);

const isColumnAFilled = useCallback((rowIndex) => {
  if (rowIndex < 13) return true;
  return columnAFilledMap[rowIndex] ?? false;
}, [columnAFilledMap]);

const isRow1FilledForColumn = useCallback((colIndex) => {
  if (colIndex < 9) return true;
  return row1FilledMap[colIndex] ?? false;
}, [row1FilledMap]);

// ===== CALCULATED VALUES =====
const row12Values = useMemo(() => {
  const values = {};
  for (let colIndex = FROZEN_COLS; colIndex < numCols; colIndex++) {
    const row8Value = parseFloat(deferredTableData[7]?.[colIndex]) || 0;
    const row9Value = parseFloat(deferredTableData[8]?.[colIndex]) || 0;
    const row10Value = parseFloat(deferredTableData[9]?.[colIndex]) || 0;
    const row11Value = parseFloat(deferredTableData[10]?.[colIndex]) || 0;

    let sumOfRows14Plus = 0;
    for (let rowIndex = 13; rowIndex < deferredTableData.length; rowIndex++) {
      const rawValue = deferredTableData[rowIndex]?.[colIndex];
      const parsed = parseCellValue(rawValue);
      sumOfRows14Plus += parseFloat(parsed.displayValue) || 0;
    }

    if (row8Value === 0 && row9Value === 0 && row10Value === 0 && row11Value === 0 && sumOfRows14Plus === 0) {
      values[colIndex] = '';
    } else {
      let calculatedValue = row8Value - row9Value - row10Value + row11Value - sumOfRows14Plus;
      if (calculatedValue < 0) calculatedValue = 0;
      values[colIndex] = calculatedValue.toString();
    }
  }
  return values;
}, [deferredTableData, numCols]);

const colGValues = useMemo(() => {
  const values = {};
  for (let rowIndex = 13; rowIndex < deferredTableData.length; rowIndex++) {
    let sum = 0;
    for (let colIndex = 9; colIndex < (deferredTableData[rowIndex]?.length || 0); colIndex++) {
      const cellValue = deferredTableData[rowIndex]?.[colIndex];
      const parsed = parseCellValue(cellValue);
      const numValue = parseFloat(parsed.displayValue);
      if (!isNaN(numValue)) sum += numValue;
    }
    values[rowIndex] = sum > 0 ? sum.toString() : '';
  }
  return values;
}, [deferredTableData]);

const colHValues = useMemo(() => {
  const values = {};
  for (let rowIndex = 13; rowIndex < deferredTableData.length; rowIndex++) {
    const colFValue = parseFloat(deferredTableData[rowIndex]?.[5]);
    const colGValue = parseFloat(colGValues[rowIndex]);
    if (isNaN(colFValue) || isNaN(colGValue)) {
      values[rowIndex] = '';
    } else {
      values[rowIndex] = (colFValue - colGValue).toString();
    }
  }
  return values;
}, [deferredTableData, colGValues]);

// Refs for calculated values (used in stable callbacks)
const row12ValuesRef = useRef(row12Values);
const colGValuesRef = useRef(colGValues);
const colHValuesRef = useRef(colHValues);

useEffect(() => {
  row12ValuesRef.current = row12Values;
  colGValuesRef.current = colGValues;
  colHValuesRef.current = colHValues;
}, [row12Values, colGValues, colHValues]);

// ===== STABLE CALLBACKS =====
const stableOnCellChange = useCallback((rowIndex, colIndex, value) => {
  onCellChangeRef.current(rowIndex, colIndex, value);
}, []);

const stableOnCellBlur = useCallback(() => {
  onCellBlurRef.current?.();
}, []);

const getRow13HeaderValue = useCallback((colIndex) => ROW_13_HEADERS[colIndex] || '', []);
const getColIHeaderValue = useCallback((rowIndex) => COL_I_HEADERS[rowIndex] || '', []);

const getDropdownOptions = useCallback((rowIndex) => {
  if (rowIndex === 1) return robotStandards.length > 0 ? robotStandards : DROPDOWN_OPTIONS[1];
  if (rowIndex === 2) return standardControllers.length > 0 ? standardControllers : DROPDOWN_OPTIONS[2];
  if (rowIndex === 3) return standardFamilies.length > 0 ? standardFamilies : DROPDOWN_OPTIONS[3];
  return DROPDOWN_OPTIONS[rowIndex] || [];
}, [robotStandards, standardControllers, standardFamilies]);

const getDropdownOptionsWithCustom = useCallback((rowIndex) => {
  const baseOptions = getDropdownOptions(rowIndex);
  const customValues = customDropdownValues[rowIndex] || [];
  return [...new Set([...baseOptions, ...customValues])];
}, [customDropdownValues, getDropdownOptions]);

const getSmartViewRow13Values = useCallback((colIndex) => {
  const rowIndices = [0, 1, 3, 5, 11];
  const values = [];

  for (let i = 0; i < rowIndices.length; i++) {
    const rowIdx = rowIndices[i];
    let displayValue = '';

    if (rowIdx === 11 && colIndex >= FROZEN_COLS) {
      displayValue = row12ValuesRef.current[colIndex] || '';
    } else {
      const cellValue = tableDataRef.current[rowIdx]?.[colIndex];
      const parsed = parseCellValue(cellValue);
      displayValue = parsed.displayValue || '';
    }

    values.push(displayValue.trim() ? displayValue : '-');
  }

  return values.join('\n');
}, []);

// ===== CELL NAVIGATION =====
const focusCell = useCallback((rowIndex, colIndex) => {
  try {
    let targetCell = null;
    if (colIndex < FROZEN_COLS) {
      targetCell = frozenSectionRef.current?.querySelector(
        `td[data-row="${rowIndex}"][data-col="${colIndex}"] input, td[data-row="${rowIndex}"][data-col="${colIndex}"] select`
      );
    } else {
      const scrollColIndex = colIndex - FROZEN_COLS;
      targetCell = scrollableSectionRef.current?.querySelector(
        `td[data-row="${rowIndex}"][data-col="${scrollColIndex}"] input, td[data-row="${rowIndex}"][data-col="${scrollColIndex}"] select`
      );
    }
    if (targetCell) {
      targetCell.focus();
      if (targetCell.select) targetCell.select();
    }
  } catch (e) {
    console.error('focusCell error:', e);
  }
}, []);

const handleCellKeyDown = useCallback((e, rowIndex, colIndex) => {
  if (e.key === 'Delete') {
    e.preventDefault();
    onCellChangeRef.current(rowIndex, colIndex, '');
    if (e.target.tagName === 'SELECT') e.target.value = '';
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const nextRowIndex = rowIndex + 1;
    if (nextRowIndex < tableDataRef.current.length) {
      setTimeout(() => focusCell(nextRowIndex, colIndex), 0);
    }
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (rowIndex - 1 >= 0) focusCell(rowIndex - 1, colIndex);
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (rowIndex + 1 < tableDataRef.current.length) focusCell(rowIndex + 1, colIndex);
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (colIndex - 1 >= 0) focusCell(rowIndex, colIndex - 1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (colIndex + 1 < numColsRef.current) focusCell(rowIndex, colIndex + 1);
  }
}, [focusCell]);

// ===== ROW/COL SELECTION =====
const handleRowSelect = useCallback((rowIndex) => {
  const newSelectedRows = new Set(selectedRows);
  if (newSelectedRows.has(rowIndex)) {
    newSelectedRows.delete(rowIndex);
  } else {
    newSelectedRows.add(rowIndex);
  }
  setSelectedRows(newSelectedRows);
}, [selectedRows, setSelectedRows]);

const handleColSelect = useCallback((colIndex) => {
  const newSelectedCols = new Set(selectedCols);
  if (newSelectedCols.has(colIndex)) {
    newSelectedCols.delete(colIndex);
  } else {
    newSelectedCols.add(colIndex);
  }
  setSelectedCols(newSelectedCols);
}, [selectedCols, setSelectedCols]);

// const isColSelected = useCallback((colIndex) => selectedCols.has(colIndex), [selectedCols]);

const selectedColsRef = useRef(selectedCols);
useEffect(() => { selectedColsRef.current = selectedCols; }, [selectedCols]);
const isColSelected = useCallback((colIndex) => selectedColsRef.current.has(colIndex), []);

// ===== CELL INTERACTION HANDLERS =====
const shouldCellBeRed = useCallback((rowIndex, colIndex, cellValue) => {
  if (colIndex < 9 || rowIndex < 13) return false;
  const displayValue = parseCellValue(cellValue).displayValue;
  if (!displayValue || displayValue.trim() === '') return false;
  const referenceDate = parseCustomDate(tableDataRef.current[rowIndex]?.[3]);
  const comparisonDate = parseCustomDate(tableDataRef.current[5]?.[colIndex]);
  if (!referenceDate || !comparisonDate) return false;
  return referenceDate < comparisonDate;
}, []);

const getCellBackgroundColor = useCallback((rowIndex, colIndex, cellValue) => {
  if (colIndex < 9 || rowIndex < 13) return {};
  const parsed = parseCellValue(cellValue);
  if (!parsed.displayValue || parsed.displayValue.trim() === '') return {};
  if (parsed.mode === 'double') return { backgroundColor: '#f78686', boxShadow: 'inset 0 -0.5px 0 black' };
  return { backgroundColor: '#91d7d0', boxShadow: 'inset 0 -0.5px 0 black' };
}, []);

const hasColoredBackground = useCallback((rowIndex, colIndex, cellValue) => {
  if (colIndex < 9 || rowIndex < 13) return false;
  const parsed = parseCellValue(cellValue);
  return parsed.displayValue && parsed.displayValue.trim() !== '';
}, []);

const handleCellChangeWithTracking = useCallback((rowIndex, colIndex, value) => {
  if (rowIndex === 12) return;
  onCellChangeRef.current(rowIndex, colIndex, value);
}, []);

const handleCellContextMenu = useCallback((e, rowIndex, colIndex) => {
  if (colIndex < 9 || rowIndex < 13) return;
  e.preventDefault();

  const currentValue = tableDataRef.current[rowIndex]?.[colIndex];
  if (!currentValue || currentValue.trim() === '') return;

  const parsed = parseCellValue(currentValue);
  if (!parsed.displayValue || parsed.displayValue.trim() === '') return;

  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex, colIndex });
}, []);

const handleCellBlurWithTracking = useCallback((rowIndex, colIndex, blurValue) => {
  if (colIndex >= 9 && rowIndex >= 13) {
    // Scrollable data cells (row 13+, col J+) - OPTIMIZED: No ref tracking during typing
    if (blurValue !== undefined && blurValue !== null && blurValue.toString().trim() !== '') {
      let valueToSave = blurValue.toString().trim();
      // Preserve existing mode from CURRENT cell value (not new value)
      const currentCellValue = tableDataRef.current[rowIndex]?.[colIndex] ?? '';
      const existingParsed = parseCellValue(currentCellValue);
      const existingMode = existingParsed.mode;  // Get (green) or (orange) from OLD value
      
      // Apply existing mode to new value
      if (existingMode) {
        valueToSave = formatCellValue(valueToSave, existingMode);
      }
      onCellChangeRef.current(rowIndex, colIndex, valueToSave);
    } else {
      onCellChangeRef.current(rowIndex, colIndex, '');
    }
  } else if (colIndex >= 9 && rowIndex >= 1 && rowIndex <= 3) {
    // Dropdown custom value cells (rows 1-3, col J+)
    if (blurValue !== undefined && blurValue !== null && blurValue.toString().trim() !== '') {
      const customValue = blurValue.toString().trim();
      onCellChangeRef.current(rowIndex, colIndex, customValue);

      setCustomDropdownValues(prev => {
        const rowCustomValues = prev[rowIndex] || [];
        if (!rowCustomValues.includes(customValue) && !getDropdownOptions(rowIndex).includes(customValue)) {
          return { ...prev, [rowIndex]: [...rowCustomValues, customValue] };
        }
        return prev;
      });
    }
  } else {
    // All other cells
    if (blurValue !== undefined && blurValue !== null) {
      const currentTableValue = tableDataRef.current[rowIndex]?.[colIndex] ?? '';
      const newValue = blurValue.toString();
      if (newValue !== currentTableValue) {
        onCellChangeRef.current(rowIndex, colIndex, newValue);
      }
    }
  }

  onCellBlurRef.current?.();
}, [getDropdownOptions]);

// ===== ALLOCATION CONTEXT MENU =====
const handleAllocationSelect = useCallback((allocationType) => {
  if (contextMenu.rowIndex === null || contextMenu.colIndex === null) return;

  const { rowIndex, colIndex } = contextMenu;
  const currentValue = tableDataRef.current[rowIndex]?.[colIndex];

  if (currentValue && currentValue.trim() !== '') {
    const parsed = parseCellValue(currentValue);
    const mode = allocationType === 'temporary' ? 'double' : 'single';
    const newValue = formatCellValue(parsed.displayValue, mode);
    onCellChangeRef.current(rowIndex, colIndex, newValue);
  }

  setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
}, [contextMenu]);

// ===== SORT =====
const sortTableByDeliveryDate = useCallback(() => {
  if (tableData.length <= 13) return;

  const headerRows = tableData.slice(0, 13);
  const dataRows = tableData.slice(13);

  const isBlankRow = (row) => !row || row.every(cell => !cell || cell.trim() === '');
  const nonBlankRows = dataRows.filter(row => !isBlankRow(row));
  const blankRows = dataRows.filter(row => isBlankRow(row));

  const sortedDataRows = [...nonBlankRows].sort((a, b) => {
    const dateA = a[3] ? a[3].trim() : '';
    const dateB = b[3] ? b[3].trim() : '';

    const parseDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      try {
        const parts = dateStr.toLowerCase().split(/\s+/);
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        if (parts.length >= 2) {
          const monthIndex = monthNames.indexOf(parts[0].slice(0, 3));
          if (monthIndex !== -1) {
            const year = parseInt(parts[1]);
            if (!isNaN(year)) {
              const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
              return new Date(fullYear, monthIndex, 1);
            }
          }
        }

        const dotParts = dateStr.split('.');
        if (dotParts.length === 3) {
          return new Date(dotParts[2], dotParts[1] - 1, dotParts[0]);
        }

        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
      } catch {
        return new Date(0);
      }
    };

    const parsedA = parseDate(dateA);
    const parsedB = parseDate(dateB);
    return sortAscending ? parsedA - parsedB : parsedB - parsedA;
  });

  const newTableData = [...headerRows, ...sortedDataRows, ...blankRows];
  onUpdateTableData(newTableData);
  setSortAscending(!sortAscending);
}, [tableData, sortAscending, onUpdateTableData]);

// ===== CONTEXT MENUS =====
const handleRowHeaderContextMenu = useCallback((e, rowIndex) => {
  e.preventDefault();
  if (isViewer) return;
  setInsertRowMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex });
}, [isViewer]);

const handleColHeaderContextMenu = useCallback((e, colIndex) => {
  e.preventDefault();
  if (isViewer) return;
  setInsertColMenu({ visible: true, x: e.clientX, y: e.clientY, colIndex });
}, [isViewer]);

const handleRowInsertAbove = useCallback(() => {
  if (insertRowMenu.rowIndex !== null && onInsertRow) {
    onInsertRow(insertRowMenu.rowIndex, 'above', false);
  }
  setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
}, [insertRowMenu, onInsertRow]);

const handleRowInsertBelow = useCallback(() => {
  if (insertRowMenu.rowIndex !== null && onInsertRow) {
    onInsertRow(insertRowMenu.rowIndex, 'below', false);
  }
  setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
}, [insertRowMenu, onInsertRow]);

const handleColInsertLeft = useCallback(() => {
  if (insertColMenu.colIndex !== null && onInsertCol) {
    onInsertCol(insertColMenu.colIndex, 'left', false);
  }
  setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
}, [insertColMenu, onInsertCol]);

const handleColInsertRight = useCallback(() => {
  if (insertColMenu.colIndex !== null && onInsertCol) {
    onInsertCol(insertColMenu.colIndex, 'right', false);
  }
  setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
}, [insertColMenu, onInsertCol]);

// Close menus on click away
useEffect(() => {
  const handleClickAway = () => {
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, colIndex: null });
    setInsertRowMenu({ visible: false, x: 0, y: 0, rowIndex: null });
    setInsertColMenu({ visible: false, x: 0, y: 0, colIndex: null });
  };
  if (contextMenu.visible || insertRowMenu.visible || insertColMenu.visible) {
    document.addEventListener('click', handleClickAway);
    return () => document.removeEventListener('click', handleClickAway);
  }
}, [contextMenu.visible, insertRowMenu.visible, insertColMenu.visible]);

// ===== RESIZE HANDLING =====
useEffect(() => {
  let timeoutId = null;
  const handleResize = () => {
    if (timeoutId) return;
    timeoutId = setTimeout(() => {
      setContainerWidth(window.innerWidth);
      timeoutId = null;
    }, 100);
  };
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
    if (timeoutId) clearTimeout(timeoutId);
  };
}, []);

useEffect(() => {
  const saved = localStorage.getItem('tableColWidths');
  if (saved) {
    try { setColWidths(JSON.parse(saved)); } catch (e) { /* ignore */ }
  }
}, []);

const saveColWidths = useCallback((widths) => {
  setColWidths(widths);
  localStorage.setItem('tableColWidths', JSON.stringify(widths));
}, []);

const handleResizeStart = useCallback((e, colIndex) => {
  e.preventDefault();
  setResizingCol({ index: colIndex, startX: e.clientX, startWidth: colWidths[colIndex] || getOptimalColWidth() });
}, [colWidths, getOptimalColWidth]);

useEffect(() => {
  if (!resizingCol) return;
  let rafId = null;

  const handleMouseMove = (e) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const diff = e.clientX - resizingCol.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizingCol.startWidth + diff);
      setColWidths(prev => ({ ...prev, [resizingCol.index]: newWidth }));
      rafId = null;
    });
  };

  const handleMouseUp = () => {
    if (rafId) cancelAnimationFrame(rafId);
    setColWidths(prev => { saveColWidths(prev); return prev; });
    setResizingCol(null);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, [resizingCol, saveColWidths]);

// ===== SCROLL SYNC =====
useEffect(() => {
  const frozenSection = frozenSectionRef.current;
  const scrollableSection = scrollableSectionRef.current;
  if (!frozenSection || !scrollableSection) return;

  let syncSource = null;
  let rafId = null;
  let wheelVelocity = 0;
  const MOMENTUM_DAMPING = 0.92; // Smooth deceleration (0-1, lower = faster stop)
  const VELOCITY_THRESHOLD = 0.1; // Stop when velocity is this small

  const syncScroll = (source) => {
    if (syncSource && syncSource !== source) return;
    syncSource = source;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const scrollTop = source.scrollTop;

      if (source === frozenSection) {
        scrollableSection.scrollTop = scrollTop;
      } else {
        frozenSection.scrollTop = scrollTop;
      }

      // Reset sync lock after a small delay
      setTimeout(() => { syncSource = null; }, 16);
      rafId = null;
    });
  };

  const handleFrozenScroll = () => syncScroll(frozenSection);
  const handleScrollableScroll = () => syncScroll(scrollableSection);

  const handleWheel = (e) => {
    e.preventDefault();
    wheelVelocity = e.deltaY; // Set velocity from wheel event
    
    if (syncSource) return; // Skip if already syncing

    // Start momentum animation if not already running
    if (!rafId) {
      const animateMomentum = () => {
        if (Math.abs(wheelVelocity) < VELOCITY_THRESHOLD) {
          wheelVelocity = 0;
          rafId = null;
          return;
        }

        const maxScroll = frozenSection.scrollHeight - frozenSection.clientHeight;
        const newScrollTop = Math.max(0, Math.min(maxScroll, frozenSection.scrollTop + wheelVelocity));

        frozenSection.scrollTop = newScrollTop;
        scrollableSection.scrollTop = newScrollTop;

        // Apply damping for momentum effect
        wheelVelocity *= MOMENTUM_DAMPING;

        rafId = requestAnimationFrame(animateMomentum);
      };

      rafId = requestAnimationFrame(animateMomentum);
    }
  };

  frozenSection.addEventListener('scroll', handleFrozenScroll, { passive: true });
  scrollableSection.addEventListener('scroll', handleScrollableScroll, { passive: true });
  frozenSection.addEventListener('wheel', handleWheel, { passive: false });
  scrollableSection.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    frozenSection.removeEventListener('scroll', handleFrozenScroll);
    scrollableSection.removeEventListener('scroll', handleScrollableScroll);
    frozenSection.removeEventListener('wheel', handleWheel);
    scrollableSection.removeEventListener('wheel', handleWheel);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, []);

// ===== IMPERATIVE HANDLE =====
useImperativeHandle(ref, () => ({
  scrollToNewRow: () => {
    const lastRowIndex = tableData.length - 1;
    if (frozenSectionRef.current && scrollableSectionRef.current) {
      const viewportHeight = frozenSectionRef.current.clientHeight;
      const targetScrollTop = Math.max(0, (lastRowIndex - STICKY_ROWS + 1) * ROW_HEIGHT - viewportHeight / 2 + ROW_HEIGHT);
      frozenSectionRef.current.scrollTop = targetScrollTop;
      scrollableSectionRef.current.scrollTop = targetScrollTop;
    }
  },
  scrollToNewColumn: () => {
    if (scrollableSectionRef.current) {
      const scrollWidth = scrollableSectionRef.current.scrollWidth;
      const clientWidth = scrollableSectionRef.current.clientWidth;
      scrollableSectionRef.current.scrollLeft = scrollWidth - clientWidth;
    }
  },
  toggleSmartView: () => {
    const newState = !isSmartView;
    setIsSmartView(newState);
    if (onSmartViewToggle) onSmartViewToggle(newState);
  },
  refreshRobotStandards: async () => {
    try {
      const response = await fetch('/api/robot-standards');
      const result = await response.json();
      if (result.success && result.data) {
        setRobotStandards(result.data.map(item => item.standard).sort());
      }
    } catch (error) {
      console.error('Failed to refresh robot standards:', error);
    }
  },
  refreshStandardControllers: async () => {
    try {
      const response = await fetch('/api/standard-controllers');
      const result = await response.json();
      if (result.success && result.data) {
        setStandardControllers(result.data.map(item => item.controller).sort());
      }
    } catch (error) {
      console.error('Failed to refresh standard controllers:', error);
    }
  },
  refreshStandardFamilies: async () => {
    try {
      const response = await fetch('/api/standard-families');
      const result = await response.json();
      if (result.success && result.data) {
        setStandardFamilies(result.data.map(item => item.family).sort());
      }
    } catch (error) {
      console.error('Failed to refresh standard families:', error);
    }
  }
}));

// ===== RENDER =====
return (
  <div className="table-wrapper">
    <div className={`excel-table-container ${isViewer ? 'viewer-mode' : ''} ${isSmartView ? 'smart-view-enabled' : ''}`}>
      {/* FROZEN SECTION */}
      <div className="frozen-section" ref={frozenSectionRef} style={{ width: `${frozenWidth}px` }}>
        <table className="excel-table frozen-table">
          <thead>
            <tr className="header-row">
              <th className="row-header-cell"></th>
              {Array.from({ length: FROZEN_COLS }, (_, colIndex) => {
                if (isSmartView && FROZEN_COL_WIDTHS_SMART[colIndex] === 0) return null;
                return (
                  <th
                    key={`frozen-col-${colIndex}`}
                    className={`col-header-cell ${selectedCols.has(colIndex) ? 'selected' : ''}`}
                    style={{ width: `${getColWidth(colIndex)}px`, cursor: 'pointer' }}
                    onClick={() => handleColSelect(colIndex)}
                    onContextMenu={(e) => handleColHeaderContextMenu(e, colIndex)}
                  >
                    <div className="col-header-content">
                      {getDisplayColumnLetter(colIndex)}
                      <div
                        className="col-resize-handle"
                        onMouseDown={(e) => handleResizeStart(e, colIndex)}
                        title="Drag to resize"
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Sticky rows (0-12) */}
            {tableData.slice(0, STICKY_ROWS).map((row, rowIndex) => (
              <FrozenTableRow
                key={`frozen-row-${rowIndex}`}
                rowIndex={rowIndex}
                row={row}
                isSmartView={isSmartView}
                isRowSelected={selectedRows.has(rowIndex)}
                getColWidth={getColWidth}
                getRow13HeaderValue={getRow13HeaderValue}
                getColIHeaderValue={getColIHeaderValue}
                getDropdownOptions={getDropdownOptions}
                onCellChange={stableOnCellChange}
                onCellBlur={stableOnCellBlur}
                handleCellKeyDown={handleCellKeyDown}
                isViewer={isViewer}
                isColSelected={isColSelected}
                convertFromDateInput={convertFromDateInput}
                convertToDateInput={convertToDateInput}
                onRowSelect={handleRowSelect}
                onRowHeaderContextMenu={handleRowHeaderContextMenu}
                sortTableByDeliveryDate={sortTableByDeliveryDate}
                sortAscending={sortAscending}
                colGValues={colGValues}
                colHValues={colHValues}
              />
            ))}

            {/* Render all rows - NO VIRTUALIZATION */}
            {tableData.slice(STICKY_ROWS).map((row, idx) => {
              const rowIndex = STICKY_ROWS + idx;
              return (
                <FrozenTableRow
                  key={`frozen-row-${rowIndex}`}
                  rowIndex={rowIndex}
                  row={row}
                  isSmartView={isSmartView}
                  isRowSelected={selectedRows.has(rowIndex)}
                  getColWidth={getColWidth}
                  getRow13HeaderValue={getRow13HeaderValue}
                  getColIHeaderValue={getColIHeaderValue}
                  getDropdownOptions={getDropdownOptions}
                  onCellChange={stableOnCellChange}
                  onCellBlur={stableOnCellBlur}
                  handleCellKeyDown={handleCellKeyDown}
                  isViewer={isViewer}
                  isColSelected={isColSelected}
                  convertFromDateInput={convertFromDateInput}
                  convertToDateInput={convertToDateInput}
                  onRowSelect={handleRowSelect}
                  onRowHeaderContextMenu={handleRowHeaderContextMenu}
                  sortTableByDeliveryDate={sortTableByDeliveryDate}
                  sortAscending={sortAscending}
                  colGValues={colGValues}
                  colHValues={colHValues}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SCROLLABLE SECTION */}
      <div className="scrollable-section" ref={scrollableSectionRef}>
        <table className="excel-table scrollable-table">
          <thead>
            <tr className="header-row">
              {/* Render all columns - NO VIRTUALIZATION */}
              {Array.from({ length: numCols - FROZEN_COLS }, (_, idx) => {
                const colIndex = idx;
                const actualColIndex = FROZEN_COLS + colIndex;
                const isHidden = isFilterActive && selectedCols.size > 0 && !selectedCols.has(actualColIndex);

                return (
                  <th
                    key={`scroll-col-${actualColIndex}`}
                    className={`col-header-cell ${selectedCols.has(actualColIndex) ? 'selected' : ''}`}
                    style={{ width: `${SCROLLABLE_COL_WIDTH}px`, cursor: 'pointer', display: isHidden ? 'none' : undefined }}
                    onClick={() => handleColSelect(actualColIndex)}
                    onContextMenu={(e) => handleColHeaderContextMenu(e, actualColIndex)}
                  >
                    <div className="col-header-content">
                      {getDisplayColumnLetter(actualColIndex)}
                      <div
                        className="col-resize-handle"
                        onMouseDown={(e) => handleResizeStart(e, actualColIndex)}
                        title="Drag to resize"
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Sticky rows (0-12) */}
            {tableData.slice(0, STICKY_ROWS).map((row, rowIndex) => (
              <ScrollableTableRow
                key={`scroll-row-${rowIndex}`}
                rowIndex={rowIndex}
                rowData={row}
                isSmartView={isSmartView}
                isRowSelected={selectedRows.has(rowIndex)}
                numCols={numCols}
                getColWidth={getColWidth}
                handleCellKeyDown={handleCellKeyDown}
                isViewer={isViewer}
                isColSelected={isColSelected}
                convertFromDateInput={convertFromDateInput}
                convertToDateInput={convertToDateInput}
                isColumnAFilled={isColumnAFilled}
                isRow1FilledForColumn={isRow1FilledForColumn}
                editingCellRef={editingCellRef}
                setEditingCell={setEditingCell}
                getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
                handleCellChangeWithTracking={handleCellChangeWithTracking}
                handleCellBlurWithTracking={handleCellBlurWithTracking}
                getCellBackgroundColor={getCellBackgroundColor}
                hasColoredBackground={hasColoredBackground}
                shouldCellBeRed={shouldCellBeRed}
                getSmartViewRow13Values={getSmartViewRow13Values}
                onCellContextMenu={handleCellContextMenu}
                isFilterActive={isFilterActive}
                row12Values={row12Values}
                colGValues={colGValues}
                colHValues={colHValues}
                visibleColStart={visibleColStart}
                visibleColEnd={visibleColEnd}
              />
            ))}

            {/* Render all rows - NO VIRTUALIZATION */}
            {tableData.slice(STICKY_ROWS).map((row, idx) => {
              const rowIndex = STICKY_ROWS + idx;
              return (
                <ScrollableTableRow
                  key={`scroll-row-${rowIndex}`}
                  rowIndex={rowIndex}
                  rowData={row}
                  isSmartView={isSmartView}
                  isRowSelected={selectedRows.has(rowIndex)}
                  numCols={numCols}
                  getColWidth={getColWidth}
                  handleCellKeyDown={handleCellKeyDown}
                  isViewer={isViewer}
                  isColSelected={isColSelected}
                  convertFromDateInput={convertFromDateInput}
                  convertToDateInput={convertToDateInput}
                  isColumnAFilled={isColumnAFilled}
                  isRow1FilledForColumn={isRow1FilledForColumn}
                  editingCellRef={editingCellRef}
                  setEditingCell={setEditingCell}
                  getDropdownOptionsWithCustom={getDropdownOptionsWithCustom}
                  handleCellChangeWithTracking={handleCellChangeWithTracking}
                  handleCellBlurWithTracking={handleCellBlurWithTracking}
                  getCellBackgroundColor={getCellBackgroundColor}
                  hasColoredBackground={hasColoredBackground}
                  shouldCellBeRed={shouldCellBeRed}
                  getSmartViewRow13Values={getSmartViewRow13Values}
                  onCellContextMenu={handleCellContextMenu}
                  isFilterActive={isFilterActive}
                  row12Values={row12Values}
                  colGValues={colGValues}
                  colHValues={colHValues}
                  visibleColStart={0}
                  visibleColEnd={numCols - FROZEN_COLS}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Context Menu for Allocation Type */}
    {contextMenu.visible && (
      <div
        className="cell-context-menu"
        style={{
          position: 'fixed',
          left: `${contextMenu.x}px`,
          top: `${contextMenu.y}px`,
          zIndex: 1000
        }}
      >
        <div
          className="context-menu-item"
          onClick={() => handleAllocationSelect('temporary')}
        >
          Temporary allocation
        </div>
        <div
          className="context-menu-item"
          onClick={() => handleAllocationSelect('permanent')}
        >
          Permanent allocation
        </div>
      </div>
    )}

    {/* Context Menu for Insert Row */}
    {insertRowMenu.visible && (
      <div
        className="cell-context-menu"
        style={{
          position: 'fixed',
          left: `${insertRowMenu.x}px`,
          top: `${insertRowMenu.y}px`,
          zIndex: 1001
        }}
      >
        <div className="context-menu-item" onClick={handleRowInsertAbove}>
          Insert Row Above
        </div>
        <div className="context-menu-item" onClick={handleRowInsertBelow}>
          Insert Row Below
        </div>
      </div>
    )}

    {/* Context Menu for Insert Column */}
    {insertColMenu.visible && (
      <div
        className="cell-context-menu"
        style={{
          position: 'fixed',
          left: `${insertColMenu.x}px`,
          top: `${insertColMenu.y}px`,
          zIndex: 1001
        }}
      >
        <div className="context-menu-item" onClick={handleColInsertLeft}>
          Insert Column Left
        </div>
        <div className="context-menu-item" onClick={handleColInsertRight}>
          Insert Column Right
        </div>
      </div>
    )}
  </div>
);
});

Table.displayName = 'Table';

export default Table;