import React from 'react';
import './UserAccessTable.css';

const UserAccessTable = ({ users = [] }) => {
  return (
    <div className="user-access-table-wrapper">
      <div className="user-access-table-container">
        <table className="user-access-table">
          <thead>
            <tr className="table-header">
              <th>Employee ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Region</th>
            </tr>
          </thead>
          <tbody>
            {users && users.length > 0 ? (
              users.map((user, index) => (
                <tr key={user.employeeId || index} className="table-row">
                  <td className="table-cell">{user.employeeId}</td>
                  <td className="table-cell">{user.displayName || 'Unknown'}</td>
                  <td className="table-cell">
                    <span className={`role-badge role-${user.role?.toLowerCase()}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="table-cell">{user.region}</td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan="4" className="empty-message">
                  No users added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserAccessTable;
