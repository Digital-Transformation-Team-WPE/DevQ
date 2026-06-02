import React, { useState, useEffect, useRef } from 'react';
import './UserAccessDialog.css';
import { FaTimes } from 'react-icons/fa';
import { BiSearch } from 'react-icons/bi';

const UserAccessDialog = ({ isOpen, onClose, users, onAddUser, onRemoveUser, onUpdateUser }) => {
  const [mode, setMode] = useState('modify'); // 'modify' or 'add'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('user');
  const [newRegion, setNewRegion] = useState('global');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const debounceTimerRef = useRef(null);

  // Reset form when mode changes
  useEffect(() => {
    setSearchTerm('');
    setSelectedUser(null);
    setNewRole('user');
    setNewRegion('global');
    setSearchResults([]);
  }, [mode]);

  // Cleanup debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Search existing users (Modify mode)
  const handleSearchExistingUsers = (query) => {
    setSearchTerm(query);
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    const searchLower = query.toLowerCase();
    const filtered = users.filter(user =>
      user.employeeId.toLowerCase().includes(searchLower) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchLower))
    );
    setSearchResults(filtered);
  };

  // Search users from Azure API (Add mode)
  const handleSearchAzureUsers = (query) => {
    setSearchTerm(query);
    
    // Clear previous timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    // Set a new timeout to debounce the API call
    debounceTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`);
        const result = await response.json();


        if (!response.ok) {
          console.error('API Error:', result.error);
          setSearchResults([]);
          return;
        }

        if (result.success && result.data) {
          // Mark users that are already added
          const existingIds = users.map(u => u.employeeId);
          const resultsWithFlag = result.data.map(user => ({
            ...user,
            isExisting: existingIds.includes(user.employeeId || user.id)
          }));
          setSearchResults(resultsWithFlag);
        } else {
          console.warn('No data in response');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 1000); // 300ms delay for debounce
  };

  // Handle user selection
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    const existingUser = users.find(u => u.employeeId === (user.employeeId || user.id));
    if (existingUser) {
      setNewRole(existingUser.role);
      setNewRegion(existingUser.region);
    } else {
      setNewRole('user');
      setNewRegion('global');
    }
  };

  // Handle modify user
  const handleModifyUser = () => {
    if (selectedUser && newRole) {
      onUpdateUser(selectedUser.employeeId, newRole, newRegion);
      setSearchTerm('');
      setSelectedUser(null);
      setSearchResults([]);
    }
  };

  // Handle remove user
  const handleRemoveUser = (employeeId) => {
    if (window.confirm(`Are you sure you want to remove user ${employeeId}?`)) {
      onRemoveUser(employeeId);
      setSearchTerm('');
      setSelectedUser(null);
      setSearchResults([]);
    }
  };

  // Handle add user
  const handleAddUser = () => {
    if (selectedUser && newRole) {
      onAddUser({
        employeeId: selectedUser.employeeId || selectedUser.id,
        displayName: selectedUser.displayName || 'Unknown',
        role: newRole,
        region: newRegion
      });
      setSearchTerm('');
      setSelectedUser(null);
      setSearchResults([]);
    }
  };

// User Access Management - Full page view, only close on X button click
  if (!isOpen) return null;

  return (
    <div className="user-access-fullpage">
      <div className="user-access-container">
        <div className="modal-header">
          <h2>User Access Management</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${mode === 'modify' ? 'active' : ''}`}
            onClick={() => setMode('modify')}
          >
            Modify Access
          </button>
          <button
            className={`tab ${mode === 'add' ? 'active' : ''}`}
            onClick={() => setMode('add')}
          >
            Add New Access
          </button>
        </div>

        <div className="modal-content">
          <div className="content-wrapper">
            {mode === 'modify' ? (
              // Modify Mode
              <div className="modify-section">
                <div className="search-section">
                  <div className="search-input-wrapper">
                    <BiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search existing users by Employee ID or Name"
                      value={searchTerm}
                      onChange={(e) => handleSearchExistingUsers(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="users-list-section">
                  <h3>Existing Users</h3>
                  {users && users.length > 0 ? (
                    <div className="search-results">
                      {users
                        .filter((user) => {
                          if (!searchTerm) return true;
                          const searchLower = searchTerm.toLowerCase();
                          return (
                            user.employeeId.toLowerCase().includes(searchLower) ||
                            (user.displayName && user.displayName.toLowerCase().includes(searchLower))
                          );
                        })
                        .map((user) => (
                          <div
                            key={user.employeeId}
                            className={`result-item ${selectedUser?.employeeId === user.employeeId ? 'selected' : ''}`}
                            onClick={() => handleSelectUser(user)}
                          >
                            <div className="result-info">
                              <div className="result-id">{user.employeeId}</div>
                              <div className="result-name">{user.displayName || 'Unknown'}</div>
                              <div className="result-role">Role: {user.role}</div>
                              <div className="result-region">Region: {user.region}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="no-results">No existing users</div>
                  )}
                </div>

              {selectedUser && (
                  <div className="user-details-modal-overlay" onClick={() => setSelectedUser(null)}>
                  <div className="user-details-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="user-details-header">
                      <h3>User Details</h3>
                      <button className="modal-close-btn" onClick={() => setSelectedUser(null)}>
                        <FaTimes />
                      </button>
                    </div>
                    <div className="user-details-content">
                      <div className="user-info">
                        <p><strong>Employee ID:</strong> {selectedUser.employeeId}</p>
                        <p><strong>Name:</strong> {selectedUser.displayName || 'Unknown'}</p>
                        {selectedUser.department && <p><strong>Department:</strong> {selectedUser.department}</p>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="modify-role">Role:</label>
                        <select
                          id="modify-role"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="form-input"
                        >
                          <option value="admin">Admin</option>
                          <option value="user">User</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="modify-region">Region:</label>
                        <select
                          id="modify-region"
                          value={newRegion}
                          onChange={(e) => setNewRegion(e.target.value)}
                          className="form-input"
                        >
                          <option value="EE">EE</option>
                          <option value="NA">NA</option>
                          <option value="SA">SA</option>
                          <option value="IAP">IAP</option>
                          <option value="GLOBAL">GLOBAL</option>
                        </select>
                      </div>

                      <div className="action-buttons">
                        <button className="btn btn-primary" onClick={handleModifyUser}>
                          Update User
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRemoveUser(selectedUser.employeeId)}
                        >
                          Remove User
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : mode === 'add' ? (
            // Add Mode
            <div className="add-section">
              <div className="search-section">
                <div className="search-input-wrapper">
                  <BiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by Employee ID or Name"
                    value={searchTerm}
                    onChange={(e) => handleSearchAzureUsers(e.target.value)}
                    className="search-input"
                    disabled={searchLoading}
                  />
                </div>
              </div>

              {searchLoading && <div className="loading">Searching...</div>}

              {searchResults.length > 0 ? (
                <div className="search-results">
                  {searchResults.map((user) => (
                    <div
                      key={user.employeeId || user.id}
                      className={`result-item ${user.isExisting ? 'result-item-existing' : ''} ${selectedUser?.employeeId === (user.employeeId || user.id) && !user.isExisting ? 'selected' : ''}`}
                      onClick={() => !user.isExisting && handleSelectUser(user)}
                      style={{ cursor: user.isExisting ? 'not-allowed' : 'pointer', opacity: user.isExisting ? 0.7 : 1 }}
                    >
                      <div className="result-info">
                        <div className="result-id">{user.employeeId || user.id}</div>
                        <div className="result-name">{user.displayName}</div>
                        <div className="result-email">{user.userPrincipalName || user.mail}</div>
                        {user.department && <div className="result-department">{user.department}</div>}
                        {user.isExisting && <div className="result-existing-badge">User Already Exists</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchTerm && !searchLoading ? (
                <div className="no-results">No users found </div>
              ) : null}

              {selectedUser && !selectedUser.isExisting && (
                <div className="user-details-section">
                  <h3>Add New User</h3>
                  <div className="user-info">
                    <p><strong>Employee ID:</strong> {selectedUser.employeeId || selectedUser.id}</p>
                    <p><strong>Name:</strong> {selectedUser.displayName}</p>
                    <p><strong>Email:</strong> {selectedUser.userPrincipalName || selectedUser.mail}</p>
                    {selectedUser.department && <p><strong>Department:</strong> {selectedUser.department}</p>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="add-role">Role:</label>
                    <select
                      id="add-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="form-input"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="add-region">Region:</label>
                    <select
                      id="add-region"
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      className="form-input"
                    >
                      <option value="EE">EE</option>
                      <option value="NA">NA</option>
                      <option value="SA">SA</option>
                      <option value="IAP">IAP</option>
                      <option value="GLOBAL">GLOBAL</option>
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={handleAddUser}>
                    Add User
                  </button>
                </div>
              )}
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAccessDialog;
