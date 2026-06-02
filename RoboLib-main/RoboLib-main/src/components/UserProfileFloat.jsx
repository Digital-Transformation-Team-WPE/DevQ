import React, { memo } from 'react';
import './UserProfileFloat.css';

const REGION_MAP = {
  'EE': 'EE',
  'NA': 'NA',
  'SA': 'SA',
  'IAP': 'IAP',
  'global': 'Global',
  'Global': 'Global'
};

const UserProfileFloat = ({ userName, role, region }) => {
  if (!userName) return null;

  const getRegionName = (regionCode) => {
    return REGION_MAP[regionCode] || regionCode;
  };

  return (
    <div className="user-profile-float">
      <div className="profile-content">
        <span className="profile-item">
          <span className="profile-label">Name :  </span>
          <span className="profile-value">{userName}</span>
        </span>
        <span className="profile-divider">|</span>
        <span className="profile-item">
          <span className="profile-label">Role :  </span>
          <span className="profile-value">{role || '-'}</span>
        </span>
        <span className="profile-divider">|</span>
        <span className="profile-item">
          <span className="profile-label">Region :    </span>
          <span className="profile-value">{getRegionName(region)}</span>
        </span>
      </div>
    </div>
  );
};

export default memo(UserProfileFloat);
