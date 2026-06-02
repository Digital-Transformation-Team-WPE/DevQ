// API Configuration - Centralized

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper function to add region to query params
export const addRegionParam = (url, region = null) => {
  if (!region) {
    region = localStorage.getItem('selectedRegion') || 'EE';
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}region=${region}`;
};

export const API_ENDPOINTS = {
  USER_BY_EMPLOYEE_ID: (employeeId) => `${API_BASE_URL}/api/user-by-employee-id/${encodeURIComponent(employeeId)}`,
  CHECK_AUTHORIZED: (employeeId) => `${API_BASE_URL}/api/check-authorized/${encodeURIComponent(employeeId)}`,
  SYNC_AUTHORIZED_USERS: `${API_BASE_URL}/api/sync-authorized-users`,
  GET_AUTHORIZED_USERS: `${API_BASE_URL}/api/authorized-users`,
  ADD_COLUMN: `${API_BASE_URL}/api/add-column`,
  DELETE_COLUMN: `${API_BASE_URL}/api/delete-column`,
  LOAD_TABLE: `${API_BASE_URL}/api/load-table`,
  SAVE_TABLE: `${API_BASE_URL}/api/save-table`,
  ALL_USERS: `${API_BASE_URL}/api/all-users`,
  // Consolidated dropdown data endpoint - single call instead of 3 separate calls
  GET_DROPDOWN_DATA: `${API_BASE_URL}/api/dropdown-data`,
  GET_SUMMARY: `${API_BASE_URL}/api/summary`,
  SAVE_SUMMARY: `${API_BASE_URL}/api/summary`,
  GET_SUMMARY2: `${API_BASE_URL}/api/summary2`,
  SAVE_SUMMARY2: `${API_BASE_URL}/api/summary2`,
  GET_SUMMARY3: `${API_BASE_URL}/api/summary3`,
  SAVE_SUMMARY3: `${API_BASE_URL}/api/summary3`,
  GET_SUMMARY4: `${API_BASE_URL}/api/summary4`,
  SAVE_SUMMARY4: `${API_BASE_URL}/api/summary4`,
};
