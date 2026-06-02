import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import './SearchPanel.css';
import { FaSearch } from 'react-icons/fa';

const SearchPanel = forwardRef(({ tableData, onSearchResult }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Expose toggle method to parent
  useImperativeHandle(ref, () => ({
    toggle: () => {
      setIsOpen(prev => {
        if (!prev) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
        return !prev;
      });
    },
    open: () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    close: () => {
      setIsOpen(false);
    }
  }));

  // Cleanup debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearch = (value) => {
    setSearchValue(value);

    // Clear previous timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If search is empty, clear immediately
    if (!value.trim()) {
      onSearchResult({ found: false, type: null, index: -1 });
      return;
    }

    // Set a new timeout to debounce the search
    debounceTimerRef.current = setTimeout(() => {
      // Search through table data
      const searchTerm = value.toLowerCase();
      let foundInRow = -1;
      let foundInCol = -1;
      let foundRowIndex = -1;

      // Search through all rows
      for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
        for (let colIndex = 0; colIndex < tableData[rowIndex].length; colIndex++) {
          const cellValue = tableData[rowIndex][colIndex].toLowerCase();
          if (cellValue.includes(searchTerm)) {
            foundInRow = rowIndex;
            foundInCol = colIndex;
            foundRowIndex = rowIndex;

            // Check if found in row >= 13 (row index >= 13, which is row 14 in 1-based)
            if (rowIndex >= 13) {
              // Highlight the row
              onSearchResult({ found: true, type: 'row', index: rowIndex });
              return;
            }
          }
        }
      }

      // If not found in row >= 13, highlight the column
      if (foundInCol !== -1) {
        onSearchResult({ found: true, type: 'column', index: foundInCol });
        return;
      }

      // Not found
      onSearchResult({ found: false, type: null, index: -1, message: 'Value not found' });
    }, 300); // 300ms delay for debounce
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchValue('');
      onSearchResult({ found: false, type: null, index: -1 });
    }
  };

  const handleClear = () => {
    setSearchValue('');
    onSearchResult({ found: false, type: null, index: -1 });
    inputRef.current?.focus();
  };

  return (
    <div className="search-panel">
      {!isOpen ? (
        <button
          className="search-floating-btn"
          onClick={handleToggle}
          title="Search"
        >
          <FaSearch />
        </button>
      ) : (
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in table..."
            className="search-input"
          />
          {searchValue && (
            <button className="clear-btn" onClick={handleClear}>
              ✕
            </button>
          )}
          <button className="close-btn" onClick={handleToggle}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

SearchPanel.displayName = 'SearchPanel';

export default SearchPanel;
