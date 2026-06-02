import React, { useState, useEffect, useRef } from 'react';
import './UserAccessDialog.css';
import { FaTimes } from 'react-icons/fa';

const DropdownManagementDialog = ({ isOpen, onClose, onDropdownsChange }) => {
  const [mode, setMode] = useState('standards'); // 'standards', 'controllers', or 'families'

  // Robot Standards state
  const [robotStandards, setRobotStandards] = useState([]);
  const [newStandard, setNewStandard] = useState('');
  const [standardsLoading, setStandardsLoading] = useState(false);

  // Standard Controllers state
  const [standardControllers, setStandardControllers] = useState([]);
  const [newController, setNewController] = useState('');
  const [controllersLoading, setControllersLoading] = useState(false);

  // Standard Families state
  const [standardFamilies, setStandardFamilies] = useState([]);
  const [newFamily, setNewFamily] = useState('');
  const [familiesLoading, setFamiliesLoading] = useState(false);

  // Reset form when mode changes and fetch data
  useEffect(() => {
    if (mode === 'standards') {
      fetchRobotStandards();
    } else if (mode === 'controllers') {
      fetchStandardControllers();
    } else if (mode === 'families') {
      fetchStandardFamilies();
    }
  }, [mode]);

  // Fetch robot standards from API
  const fetchRobotStandards = async () => {
    try {
      setStandardsLoading(true);
      const response = await fetch('/api/robot-standards');
      const result = await response.json();
      
      if (result.success) {
        setRobotStandards(result.data || []);
      } else {
        console.error('Failed to fetch robot standards:', result.error);
        setRobotStandards([]);
      }
    } catch (error) {
      console.error('Error fetching robot standards:', error);
      setRobotStandards([]);
    } finally {
      setStandardsLoading(false);
    }
  };

  // Fetch standard controllers from API
  const fetchStandardControllers = async () => {
    try {
      setControllersLoading(true);
      const response = await fetch('/api/standard-controllers');
      const result = await response.json();
      
      if (result.success) {
        setStandardControllers(result.data || []);
      } else {
        console.error('Failed to fetch standard controllers:', result.error);
        setStandardControllers([]);
      }
    } catch (error) {
      console.error('Error fetching standard controllers:', error);
      setStandardControllers([]);
    } finally {
      setControllersLoading(false);
    }
  };

  // Fetch standard families from API
  const fetchStandardFamilies = async () => {
    try {
      setFamiliesLoading(true);
      const response = await fetch('/api/standard-families');
      const result = await response.json();
      
      if (result.success) {
        setStandardFamilies(result.data || []);
      } else {
        console.error('Failed to fetch standard families:', result.error);
        setStandardFamilies([]);
      }
    } catch (error) {
      console.error('Error fetching standard families:', error);
      setStandardFamilies([]);
    } finally {
      setFamiliesLoading(false);
    }
  };

  // Handle add robot standard
  const handleAddRobotStandard = async () => {
    if (!newStandard.trim()) {
      alert('Please enter a robot standard name');
      return;
    }

    try {
      const response = await fetch('/api/robot-standards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ standard: newStandard.trim() })
      });

      const result = await response.json();

      if (result.success) {
        setNewStandard('');
        await fetchRobotStandards();
        alert('Robot standard added successfully');
        if (onDropdownsChange) {
          onDropdownsChange();
        }
      } else {
        alert('Error adding robot standard: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding robot standard:', error);
      alert('Failed to add robot standard');
    }
  };

  // Handle delete robot standard
  const handleDeleteRobotStandard = async (id, standard) => {
    if (window.confirm(`Are you sure you want to delete "${standard}"?`)) {
      try {
        const response = await fetch(`/api/robot-standards/${id}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
          await fetchRobotStandards();
          alert('Robot standard deleted successfully');
          if (onDropdownsChange) {
            onDropdownsChange();
          }
        } else {
          alert('Error deleting robot standard: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting robot standard:', error);
        alert('Failed to delete robot standard');
      }
    }
  };

  // Handle add standard controller
  const handleAddStandardController = async () => {
    if (!newController.trim()) {
      alert('Please enter a standard controller name');
      return;
    }

    try {
      const response = await fetch('/api/standard-controllers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ controller: newController.trim() })
      });

      const result = await response.json();

      if (result.success) {
        setNewController('');
        await fetchStandardControllers();
        alert('Standard controller added successfully');
        if (onDropdownsChange) {
          onDropdownsChange();
        }
      } else {
        alert('Error adding standard controller: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding standard controller:', error);
      alert('Failed to add standard controller');
    }
  };

  // Handle delete standard controller
  const handleDeleteStandardController = async (id, controller) => {
    if (window.confirm(`Are you sure you want to delete "${controller}"?`)) {
      try {
        const response = await fetch(`/api/standard-controllers/${id}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
          await fetchStandardControllers();
          alert('Standard controller deleted successfully');
          if (onDropdownsChange) {
            onDropdownsChange();
          }
        } else {
          alert('Error deleting standard controller: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting standard controller:', error);
        alert('Failed to delete standard controller');
      }
    }
  };

  // Handle add standard family
  const handleAddStandardFamily = async () => {
    if (!newFamily.trim()) {
      alert('Please enter a standard family name');
      return;
    }

    try {
      const response = await fetch('/api/standard-families', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ family: newFamily.trim() })
      });

      const result = await response.json();

      if (result.success) {
        setNewFamily('');
        await fetchStandardFamilies();
        alert('Standard family added successfully');
        if (onDropdownsChange) {
          onDropdownsChange();
        }
      } else {
        alert('Error adding standard family: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding standard family:', error);
      alert('Failed to add standard family');
    }
  };

  // Handle delete standard family
  const handleDeleteStandardFamily = async (id, family) => {
    if (window.confirm(`Are you sure you want to delete "${family}"?`)) {
      try {
        const response = await fetch(`/api/standard-families/${id}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
          await fetchStandardFamilies();
          alert('Standard family deleted successfully');
          if (onDropdownsChange) {
            onDropdownsChange();
          }
        } else {
          alert('Error deleting standard family: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting standard family:', error);
        alert('Failed to delete standard family');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="user-access-fullpage">
      <div className="user-access-container">
        <div className="modal-header">
          <h2>Standards Management</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${mode === 'standards' ? 'active' : ''}`}
            onClick={() => setMode('standards')}
          >
            Robot Standards
          </button>
          <button
            className={`tab ${mode === 'controllers' ? 'active' : ''}`}
            onClick={() => setMode('controllers')}
          >
            Standard Controller
          </button>
          <button
            className={`tab ${mode === 'families' ? 'active' : ''}`}
            onClick={() => setMode('families')}
          >
            Standard Family
          </button>
        </div>

        <div className="modal-content">
          <div className="content-wrapper">
            {mode === 'standards' && (
              // Robot Standards Management Mode
              <div className="dropdown-section">
                <h3>Robot Standards Management</h3>
                
                {/* Add New Robot Standard Form */}
                <div className="add-standard-form">
                  <div className="form-group">
                    <label htmlFor="new-standard">New Robot Standard:</label>
                    <input
                      id="new-standard"
                      type="text"
                      value={newStandard}
                      onChange={(e) => setNewStandard(e.target.value)}
                      placeholder="Enter robot standard name"
                      className="form-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddRobotStandard();
                        }
                      }}
                    />
                  </div>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleAddRobotStandard}
                  >
                    Add 
                  </button>
                </div>

                {/* Robot Standards Table */}
                {standardsLoading ? (
                  <div className="loading">Loading standards...</div>
                ) : robotStandards.length > 0 ? (
                  <table className="standards-table">
                    <thead>
                      <tr>
                        <th>Robot Standard</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {robotStandards.map((standard) => (
                        <tr key={standard.id}>
                          <td>{standard.standard}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteRobotStandard(standard.id, standard.standard)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-results">No robot standards found</div>
                )}
              </div>
            )}

            {mode === 'controllers' && (
              // Standard Controller Management Mode
              <div className="dropdown-section">
                <h3>Standard Controller Management</h3>
                
                {/* Add New Standard Controller Form */}
                <div className="add-standard-form">
                  <div className="form-group">
                    <label htmlFor="new-controller">New Standard Controller:</label>
                    <input
                      id="new-controller"
                      type="text"
                      value={newController}
                      onChange={(e) => setNewController(e.target.value)}
                      placeholder="Enter standard controller name"
                      className="form-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddStandardController();
                        }
                      }}
                    />
                  </div>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleAddStandardController}
                  >
                    Add 
                  </button>
                </div>

                {/* Standard Controllers Table */}
                {controllersLoading ? (
                  <div className="loading">Loading standard controllers...</div>
                ) : standardControllers.length > 0 ? (
                  <table className="standards-table">
                    <thead>
                      <tr>
                        <th>Standard Controller</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardControllers.map((controller) => (
                        <tr key={controller.id}>
                          <td>{controller.controller}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteStandardController(controller.id, controller.controller)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-results">No standard controllers found</div>
                )}
              </div>
            )}

            {mode === 'families' && (
              // Standard Family Management Mode
              <div className="dropdown-section">
                <h3>Standard Family Management</h3>
                
                {/* Add New Standard Family Form */}
                <div className="add-standard-form">
                  <div className="form-group">
                    <label htmlFor="new-family">New Standard Family:</label>
                    <input
                      id="new-family"
                      type="text"
                      value={newFamily}
                      onChange={(e) => setNewFamily(e.target.value)}
                      placeholder="Enter standard family name"
                      className="form-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddStandardFamily();
                        }
                      }}
                    />
                  </div>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleAddStandardFamily}
                  >
                    Add 
                  </button>
                </div>

                {/* Standard Families Table */}
                {familiesLoading ? (
                  <div className="loading">Loading standard families...</div>
                ) : standardFamilies.length > 0 ? (
                  <table className="standards-table">
                    <thead>
                      <tr>
                        <th>Standard Family</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardFamilies.map((family) => (
                        <tr key={family.id}>
                          <td>{family.family}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteStandardFamily(family.id, family.family)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-results">No standard families found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropdownManagementDialog;
