// import React, { useState, useEffect } from 'react';
// import './RegionSelector.css';

// const REGIONS = [
//   { code: 'EE', name: 'Enlarged Europe', },
//   { code: 'NA', name: 'North America', },
//   { code: 'SA', name: 'South America',  },
//   { code: 'IAP', name: 'India Asia Pacific',}
// ];

// export default function RegionSelector({ userRegion = 'global', onRegionSelect, isOpen = true }) {
//   const [selectedRegion, setSelectedRegion] = useState(userRegion === 'global' ? 'EE' : userRegion);
//   const [isGlobal, setIsGlobal] = useState(userRegion === 'global');

//   // Check if user is restricted to their region
//   const isRegionRestricted = userRegion !== 'global' && !['EE', 'NA', 'SA', 'IAP'].includes(userRegion?.toUpperCase());

//   useEffect(() => {
//     // Auto-detect user's region if they're not global
//     if (!isGlobal && userRegion && ['EE', 'NA', 'SA', 'IAP'].includes(userRegion?.toUpperCase())) {
//       setSelectedRegion(userRegion?.toUpperCase());
//     }
//   }, [userRegion, isGlobal]);

//   const handleSelectRegion = (regionCode) => {
//     setSelectedRegion(regionCode);
//     if (onRegionSelect) {
//       onRegionSelect(regionCode);
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="region-selector-overlay">
//       <div className="region-selector-modal">
//         <div className="region-selector-header">
//           <h2>Select Your Working Region</h2>
//           {isGlobal && <p className="region-selector-subtitle">You have access to all regions</p>}
//           {!isGlobal && <p className="region-selector-subtitle">Your assigned region: {userRegion?.toUpperCase()}</p>}
//         </div>

//         <div className="region-selector-grid">
//           {REGIONS.map((region) => {
//             // If user is not global and has a different assigned region, disable other regions
//             const isDisabled = !isGlobal && userRegion?.toUpperCase() !== region.code;
//             const isSelected = selectedRegion === region.code;

//             return (
//               <button
//                 key={region.code}
//                 className={`region-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
//                 onClick={() => !isDisabled && handleSelectRegion(region.code)}
//                 disabled={isDisabled}
//                 title={isDisabled ? `You can only access ${userRegion?.toUpperCase()} region` : `Select ${region.name}`}
//               >
//                 <span className="region-icon">{region.icon}</span>
//                 <span className="region-code">{region.code}</span>
//                 <span className="region-name">{region.name}</span>
//                 {isSelected && <span className="region-checkmark">✓</span>}
//               </button>
//             );
//           })}
//         </div>

//         <div className="region-selector-footer">
//           <button 
//             className="region-confirm-btn"
//             onClick={() => {
//               localStorage.setItem('selectedRegion', selectedRegion);
//               if (onRegionSelect) {
//                 onRegionSelect(selectedRegion);
//               }
//               // Reload the page to apply region change
//               window.location.reload();
//             }}
//           >
//             Continue with {selectedRegion} Region
//           </button>
//         </div>

//         <div className="region-selector-info">
//           {/* <p> <strong>Note:</strong> Data is completely isolated per region. You can switch regions anytime by accessing the Settings menu.</p> */}
//         </div>
//       </div>
//     </div>
//   );
// }
