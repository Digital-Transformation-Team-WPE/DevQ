import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from "./loginform.module.css";
import stellantisLogo from '../assets/stellantis-logo.jpg';
import digitaltransformationlogo from '../assets/digital-transformation.png';
import { API_ENDPOINTS } from '../config/apiConfig';

const LoginForm = ({ onLoginSuccess }) => {
  const [tid, setTid] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!tid.trim()) {
        setError('Please enter your Employee ID');
        setLoading(false);
        return;
      }

      // Trim and uppercase the employee ID for consistency
      const normalizedTid = tid.trim().toUpperCase();

      // First check if user is authorized
      const authResponse = await fetch(API_ENDPOINTS.CHECK_AUTHORIZED(normalizedTid));
      const authData = await authResponse.json();

      if (!authResponse.ok || !authData.success || !authData.authorized) {
        setError('Access denied. Your ID is not authorized in the system.');
        setLoading(false);
        return;
      }

      // Validate region matches user's authorized region
      const userAuthorizedRegion = authData.user?.region?.toLowerCase();
      const selectedRegionLower = selectedRegion.toLowerCase();

      if (!userAuthorizedRegion) {
        setError('User region not found in authorization data.');
        setLoading(false);
        return;
      }

      // User can only login if:
      // 1. Their authorized region is "global" (they can select any region), OR
      // 2. The selected region matches their authorized region exactly
      if (userAuthorizedRegion !== 'global' && userAuthorizedRegion !== selectedRegionLower) {
        setError(`Invalid region selection. Your authorized region is ${userAuthorizedRegion.toUpperCase()}. You cannot access ${selectedRegion}.`);
        setLoading(false);
        return;
      }

      // Then validate employee ID against Azure AD
      const response = await fetch(API_ENDPOINTS.USER_BY_EMPLOYEE_ID(normalizedTid));
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError('Invalid Employee ID. User not found.');
        setLoading(false);
        return;
      }

      localStorage.setItem('employeeId', normalizedTid);
      localStorage.setItem('selectedRegion', selectedRegion);

      setIsLoggingIn(true);
      setTimeout(() => {
        navigate('/home');
        setLoading(false);
      }, 800);
    } catch (err) {
      console.error("Login error:", err);
      setError("Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className={styles['login-page-wrapper']}>
      <div className={`${styles['login-wrapper']} ${isLoggingIn ? styles['zoom-out'] : ''}`}>
        {/* <img
          src={robo}
          alt="robot"
          className={styles['robo-logo']}
        /> */}
        <div className={styles['login-container']}>
          
          <img
            src={digitaltransformationlogo}
            alt="Digital Transformation Logo"
            className={styles['digital-logo']}
          />
          <img
            src={stellantisLogo}
            alt="Stellantis Logo"
            className={styles['stellantis-logo']}
          /> 
          <h2 className={styles['login-heading']}>
            ROBOT LIBRARY
          </h2>

          {error && <div className={styles['error-message']}>{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className={styles['form-group']}>
              <label>Employee ID:</label>
              <input
                type="text"
                value={tid}
                onChange={(e) => setTid(e.target.value.trim().toUpperCase())}
                placeholder="Enter your Employee ID"
                required
              />
            </div>

            <div className={styles['form-group']}>
              <label>Select Region:</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className={styles['region-select']}
                required
              >
                <option value="Global">Global</option>
                <option value="EE"> Enlarged Europe </option>
                <option value="NA">North America </option>
                <option value="SA">South America </option>
                <option value="IAP">India Asia Pacific </option>
              </select>
            </div>
            
            <button
              className={styles['signin']}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;