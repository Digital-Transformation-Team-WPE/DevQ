import React, { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import './toolbar.css';
import { LiaSave } from "react-icons/lia";
import { FcAddColumn } from "react-icons/fc";
import { FcAddRow } from "react-icons/fc";
import { IoArrowUndoOutline } from "react-icons/io5";
import { IoArrowRedoOutline } from "react-icons/io5";
import { PiExportBold } from "react-icons/pi";
import { FcDeleteRow } from "react-icons/fc";
import { FcDeleteColumn } from "react-icons/fc";
import { FaUserLarge } from "react-icons/fa6";
import { HiOutlineLogout } from "react-icons/hi";
import { LuNewspaper } from "react-icons/lu";
import { FaRegEye } from "react-icons/fa";
import { FaUserShield } from "react-icons/fa6";
import { IoSearch } from "react-icons/io5";
import { SlEye } from "react-icons/sl"; 
import { IoHomeOutline } from "react-icons/io5";
import { FiUserCheck } from "react-icons/fi";
import { RiFullscreenExitFill } from "react-icons/ri";
import { RiFullscreenFill } from "react-icons/ri";
import { CiBoxList } from "react-icons/ci";
import { CiImport } from "react-icons/ci";
const REGIONS = [
  { code: 'EE', name: 'Enlarged Europe' },
  { code: 'NA', name: 'North America' },
  { code: 'SA', name: 'South America' },
  { code: 'IAP', name: 'India Asia Pacific' }
];

const Toolbar = ({ onUndo, onRedo, onAddRow, onAddColumn, onDeleteRow, onDeleteColumn, onExport, onSave, onAccessClick, onDropdownManagementClick, onSearchToggle, onViewSummary, onCloseSummary, onSmartViewToggle, onImport, canUndo = true, canRedo = true, isSaving = false, isSmartViewEnabled = false, tableData = [] }) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSummaryMenuOpen, setIsSummaryMenuOpen] = useState(false);
  const [isViewerMenuOpen, setIsViewerMenuOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const summaryMenuRef = useRef(null);
  const viewerMenuRef = useRef(null);
  const adminMenuRef = useRef(null);
  const [showSummaryView, setShowSummaryView] = useState(false);

  // Fetch user data from localStorage employee ID
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const employeeId = localStorage.getItem('employeeId');
        if (!employeeId) {
          setLoading(false);
          return;
        }

        // First, fetch user authorization data (includes role and region)
        const authResponse = await fetch(`/api/check-authorized/${employeeId}`);
        let authResult = {};
        try {
          const authContentType = authResponse.headers.get('content-type');
          if (authResponse.ok && authContentType && authContentType.includes('application/json')) {
            authResult = await authResponse.json();
          } else {
            // Not JSON, fallback
            throw new Error(`Auth API returned non-JSON: ${authResponse.status} ${authResponse.statusText}`);
          }
        } catch (err) {
          console.error('Auth API response error:', err);
          authResult = {};
        }

        // Then fetch Azure Graph data for additional details
        const response = await fetch(`/api/user-by-employee-id/${employeeId}`);
        let result = {};
        try {
          const contentType = response.headers.get('content-type');
          if (response.ok && contentType && contentType.includes('application/json')) {
            result = await response.json();
          } else {
            // Not JSON, fallback
            throw new Error(`User API returned non-JSON: ${response.status} ${response.statusText}`);
          }
        } catch (err) {
          console.error('User API response error:', err);
          result = {};
        }

        if (result.success && result.data) {
          // Merge Azure Graph data with authorization data (role and region)
          const mergedUser = {
            ...result.data,
            role: authResult.success && authResult.user ? authResult.user.role : null,
            region: authResult.success && authResult.user ? authResult.user.region : null
          };

          // Store the merged user object with all available details
          setUser(mergedUser);
        } else {
          // Fallback if API fails
          setUser({
            displayName: 'User',
            employeeId: employeeId,
            jobTitle: 'Employee'
          });
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setUser({
          displayName: 'User',
          employeeId: localStorage.getItem('employeeId') || '-',
          jobTitle: 'Employee'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleProfileClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    setIsDropdownOpen(false);
    localStorage.clear();
    navigate('/');
  };
  const handleSummaryMenuClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSummaryMenuOpen(!isSummaryMenuOpen);
  };

  const handleOpenSummary = () => {
    setShowSummaryView(true);
  };

  const handleCloseSummary = () => {
    if (onCloseSummary) {
      onCloseSummary();
    }
  };

  const handleViewSummary = () => {
    setIsSummaryMenuOpen(false);
    if (onViewSummary) {
      onViewSummary();
    }
  };

  const handleUpdateSummary = () => {
    setIsSummaryMenuOpen(false);
  };

  const handleViewRequest = () => {
    setIsSummaryMenuOpen(false);
  };

  const handleRegionChange = (regionCode) => {
    localStorage.setItem('selectedRegion', regionCode);
    setIsDropdownOpen(false);
    // Reload the page to apply region change
    window.location.reload();
  };

  // Get icon based on user role
  const getUserIcon = () => {
    const role = user?.role?.toLowerCase();
    if (role === 'admin') {
      return <FaUserShield />;
    }
    if (role === 'viewer') {
      return <FaRegEye />;
    }
    return <FaUserLarge />;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      // Add slight delay to prevent interfering with the click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close summary menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (summaryMenuRef.current && !summaryMenuRef.current.contains(event.target)) {
        setIsSummaryMenuOpen(false);
      }
    };

    if (isSummaryMenuOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSummaryMenuOpen]);

  // Close viewer menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (viewerMenuRef.current && !viewerMenuRef.current.contains(event.target)) {
        setIsViewerMenuOpen(false);
      }
    };

    if (isViewerMenuOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewerMenuOpen]);

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setIsAdminMenuOpen(false);
      }
    };

    if (isAdminMenuOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminMenuOpen]);

  // Viewer toolbar - simplified view with eye icon
  if (user?.role?.toLowerCase() === 'viewer') {
    return (
      <div className="viewer-toolbar" ref={viewerMenuRef}>
        <button
          className="viewer-eye-btn"
          onClick={() => setIsViewerMenuOpen(!isViewerMenuOpen)}
          title="Menu"
        >
          <FaRegEye />
        </button>

        {isViewerMenuOpen && (
          <div className="viewer-menu-expanded">
            <div className="profile-container" ref={dropdownRef}>
              <button
                className="toolbar-icon-btn"
                onClick={handleProfileClick}
                title="Viewer Profile"
              >
                <FaRegEye />
              </button>

              {isDropdownOpen && user && (
                <div className="profile-dropdown viewer-profile-dropdown">
                  <div className="profile-header">
                    <div className="profile-avatar">
                      <FaRegEye />
                    </div>
                  </div>

                  <div className="profile-info">
                    <p className="profile-label">Logged in as</p>
                    <p className="profile-name">{user.displayName || user.name || 'User'}</p>

                    {(user.region === 'global' || user.region === 'GLOBAL') && (
                      <div className="region-selector-section">
                        <label className="region-selector-label">Switch Region:</label>
                        <select
                          className="region-selector-dropdown"
                          defaultValue={(() => {
                            const stored = localStorage.getItem('selectedRegion');
                            return stored && stored.toLowerCase() !== 'global' ? stored : 'EE';
                          })()}
                          onChange={(e) => handleRegionChange(e.target.value)}
                        >
                          {REGIONS.map(region => (
                            <option key={region.code} value={region.code}>
                              {region.icon} {region.code} - {region.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="profile-details">
                      {user.role && <p><span className="detail-label">Role:</span> <span className="detail-value">{user.role}</span></p>}
                      {user.region && <p><span className="detail-label">Region:</span> <span className="detail-value">{user.region}</span></p>}
                      {user.employeeId && <p><span className="detail-label">Employee ID:</span> <span className="detail-value">{user.employeeId}</span></p>}
                      {user.jobTitle && <p><span className="detail-label">Job Title:</span> <span className="detail-value">{user.jobTitle}</span></p>}
                      {user.department && <p><span className="detail-label">Department:</span> <span className="detail-value">{user.department}</span></p>}
                      {(user.userPrincipalName || user.mail) && <p><span className="detail-label">Email:</span> <span className="detail-value">{user.userPrincipalName || user.mail}</span></p>}
                    </div>
                  </div>

                  <button className="profile-logout-btn" onClick={handleLogout}>
                    <HiOutlineLogout /> Logout
                  </button>
                </div>
              )}
            </div>

            <button
              className="toolbar-icon-btn"
              title="Export"
              onClick={onExport}
            >
              <PiExportBold />
            </button>

            {/* <button
              className="toolbar-icon-btn"
              title="Search"
              onClick={onSearchToggle}
            >
              <IoSearch />
            </button> */}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-profile">
          <div className="profile-container" ref={dropdownRef}>
            <button
              className="profile-icon-btn"
              onClick={handleProfileClick}
              title="Profile"
            >
              {getUserIcon()}
            </button>

            {isDropdownOpen && user && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {getUserIcon()}
                  </div>
                </div>

                <div className="profile-info">
                  <p className="profile-label">Logged in as</p>
                  <p className="profile-name">{user.displayName || user.name || 'User'}</p>

                  {(user.region === 'global' || user.region === 'GLOBAL') && (
                    <div className="region-selector-section">
                      <label className="region-selector-label">Switch Region:</label>
                      <select
                        className="region-selector-dropdown"
                        defaultValue={(() => {
                          const stored = localStorage.getItem('selectedRegion');
                          return stored && stored.toLowerCase() !== 'global' ? stored : 'EE';
                        })()}
                        onChange={(e) => handleRegionChange(e.target.value)}
                      >
                        {REGIONS.map(region => (
                          <option key={region.code} value={region.code}>
                            {region.icon} {region.code} - {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="profile-details">

                    {user.role && <p><span className="detail-label">Role:</span> <span className="detail-value">{user.role}</span></p>}
                    {user.region && <p><span className="detail-label">Region:</span> <span className="detail-value">{user.region}</span></p>}
                    {user.employeeId && <p><span className="detail-label">Employee ID:</span> <span className="detail-value">{user.employeeId}</span></p>}
                    {user.jobTitle && <p><span className="detail-label">Job Title:</span> <span className="detail-value">{user.jobTitle}</span></p>}
                    {user.department && <p><span className="detail-label">Department:</span> <span className="detail-value">{user.department}</span></p>}
                    {(user.userPrincipalName || user.mail) && <p><span className="detail-label">Email:</span> <span className="detail-value">{user.userPrincipalName || user.mail}</span></p>}
                    {user.mobilePhone && <p><span className="detail-label">Mobile:</span> <span className="detail-value">{user.mobilePhone}</span></p>}
                    {user.officeLocation && <p><span className="detail-label">Office:</span> <span className="detail-value">{user.officeLocation}</span></p>}
                    {user.city && <p><span className="detail-label">City:</span> <span className="detail-value">{user.city}</span></p>}
                    {/* {user.state && <p><span className="detail-label">State:</span> <span className="detail-value">{user.state}</span></p>} */}
                    {/* {user.postalCode && <p><span className="detail-label">Postal Code:</span> <span className="detail-value">{user.postalCode}</span></p>} */}
                    {/* {user.companyName && <p><span className="detail-label">Company:</span> <span className="detail-value">{user.companyName}</span></p>} */}
                    {/* {user.businessPhones && user.businessPhones.length > 0 && <p><span className="detail-label">Business Phone:</span> <span className="detail-value">{user.businessPhones[0]}</span></p>} */}
                  </div>
                </div>

                <button className="profile-logout-btn" onClick={handleLogout}>
                  <HiOutlineLogout /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="toolbar-buttons">
          {user?.role?.toLowerCase() !== 'viewer' && (
            <>
              <button
                onClick={handleCloseSummary}
                className="toolbar-icon-btn"
                title="Home">

                <IoHomeOutline />
              </button>
              {user?.role?.toLowerCase() === 'admin' && (
              <div ref={adminMenuRef} style={{ position: 'relative' }}>
                <button
                  className="toolbar-icon-btn"
                  title="Admin Panel"
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                >
                  <FaUserShield />
                </button>
                {isAdminMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    marginTop: '5px',
                    minWidth: '180px',
                    whiteSpace: 'nowrap'
                  }}>
                    <button
                      className="toolbar-icon-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 15px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        justifyContent: 'flex-start',
                        fontWeight: 500
                      }}
                      onClick={() => {
                        onAccessClick();
                        setIsAdminMenuOpen(false);
                      }}
                    >
                      <FiUserCheck /> Access
                    </button>
                    <button
                      className="toolbar-icon-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 15px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        justifyContent: 'flex-start',
                        fontWeight: 500,
                        borderTop: '1px solid #eee'
                      }}
                      onClick={() => {
                        onDropdownManagementClick();
                        setIsAdminMenuOpen(false);
                      }}
                    >
                      <CiBoxList /> Standard Management
                    </button>
                  </div>
                )}
              </div>
              )}
              <button
                className="toolbar-icon-btn"
                title="View Summary"
                onClick={handleViewSummary}
              >
                <LuNewspaper />
              </button>
              <button
                className="toolbar-icon-btn"
                title="Smart View"
                onClick={onSmartViewToggle}
              >
                {isSmartViewEnabled ? <RiFullscreenFill /> : <RiFullscreenExitFill />}
              </button>
              <button
                className="toolbar-icon-btn"
                title="Undo"
                onClick={onUndo}
                disabled={!canUndo}
                style={{ opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'not-allowed' }}
              >
                <IoArrowUndoOutline />
              </button>

              <button
                className="toolbar-icon-btn"
                title="Redo"
                onClick={onRedo}
                disabled={!canRedo}
                style={{ opacity: canRedo ? 1 : 0.5, cursor: canRedo ? 'pointer' : 'not-allowed' }}
              >
                <IoArrowRedoOutline />
              </button>

              <button
                className="toolbar-icon-btn"
                title={isSaving ? "Saving..." : "Save"}
                onClick={onSave}
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? (
                  <div className="spinner-ring"></div>
                ) : (
                  <LiaSave size={20} />
                )}
                {/* <LiaSave style={{ animation: isSaving ? 'spin 1s linear infinite' : 'none' }} /> */}
              </button>
            </>
          )}

          <button
            className="toolbar-icon-btn"
            title="Export"
            onClick={onExport}
          >
            <PiExportBold />
          </button>
          
          {/* 
          <button
            className="toolbar-icon-btn"
            title="Import from Excel"
            onClick={onImport}
          >
            <CiImport />
          </button> */}


          {user?.role?.toLowerCase() !== 'viewer' && (
            <>
              <button
                className="toolbar-icon-btn"
                title="Add Row"
                onClick={onAddRow}
              >
                <FcAddRow />
              </button>

              <button
                className="toolbar-icon-btn"
                title="Add Column"
                onClick={onAddColumn}
              >
                <FcAddColumn />
              </button>

            </>
          )}
          {user?.role?.toLowerCase() === 'admin' && (
            <>
              <button
                className="toolbar-icon-btn"
                title="Delete Row"
                onClick={onDeleteRow}
                disabled={tableData.length <= 33}
              >
                <FcDeleteRow />
              </button>
              <button
                className="toolbar-icon-btn"
                title="Delete Column"
                onClick={onDeleteColumn}
              >
                <FcDeleteColumn />
              </button>




            </>
          )}


        </div>


      </div>
    </>
  );
}

export default memo(Toolbar);
