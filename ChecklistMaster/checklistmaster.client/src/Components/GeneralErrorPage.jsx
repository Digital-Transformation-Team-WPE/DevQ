import React from 'react';

const GeneralErrorPage = ({ message }) => (
  <div style={{ padding: 40, textAlign: 'center' }}>
    <h1>Something went wrong</h1>
    <p>{message || 'An unexpected error occurred. Please try again later.'}</p>
  </div>
);

export default GeneralErrorPage;
