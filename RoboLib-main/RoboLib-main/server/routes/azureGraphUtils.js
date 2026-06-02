import axios from 'axios';

// You should store these in environment variables
// process.env.AZURE_CLIENT_ID
// process.env.AZURE_CLIENT_SECRET
// process.env.AZURE_TENANT_ID

export async function getGraphAccessToken(clientId, clientSecret, tenantId) {
  try {
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;


    // Azure AD expects application/x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('[getGraphAccessToken]  Error getting Azure AD token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Azure AD: ' + (error.response?.data?.error_description || error.message));
  }
}

export async function getUserDetailsFromGraph(accessToken, userId) {
  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}?$select=id,displayName,userPrincipalName,employeeId,jobTitle,department,mail,mobilePhone,officeLocation,city,state,postalCode,businessPhones,companyName`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('[getUserDetailsFromGraph] Error fetching user details:', error.response?.data || error.message);
    throw new Error('Failed to fetch user details from Azure AD');
  }
}

// Get all users in tenant (for admin purposes)
export async function getAllUsers(accessToken) {
  try {
    const response = await axios.get(
      'https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,employeeId,jobTitle,department,mail,mobilePhone,officeLocation,city,state,postalCode,businessPhones,companyName',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.value;
  } catch (error) {
    console.error('[getAllUsers] Error fetching all users:', error.response?.data || error.message);
    throw new Error('Failed to fetch users from Azure AD');
  }
}

// Search user by employee ID
export async function searchUserByEmployeeId(accessToken, employeeId) {
  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users?$filter=employeeId eq '${employeeId}'&$select=id,displayName,userPrincipalName,employeeId,jobTitle,department,mail,mobilePhone,officeLocation,city,state,postalCode,businessPhones,companyName`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.value;
  } catch (error) {
    console.error('[searchUserByEmployeeId] Error searching user:', error.response?.data || error.message);
    throw new Error('User not found');
  }
}

// Search users by query (employee ID, display name, email, or principal name)
export async function searchUsers(accessToken, query) {
  try {
    // Search by employee ID, display name, email, and user principal name
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users?$filter=startswith(employeeId, '${query}') or startswith(displayName, '${query}') or startswith(mail, '${query}') or startswith(userPrincipalName, '${query}')&$select=id,displayName,userPrincipalName,employeeId,jobTitle,department,mail,mobilePhone,officeLocation,city,state,postalCode,businessPhones,companyName`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const users = response.data.value || [];
    return users;
  } catch (error) {
    console.error('[searchUsers] Error searching users:', error.response?.data || error.message);
    throw new Error('Failed to search users');
  }
}
