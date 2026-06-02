/**
 * Azure AD Configuration
 * 
 * To set up:
 * 1. Go to https://portal.azure.com
 * 2. Navigate to Azure Active Directory > App registrations > New registration
 * 3. Name: "Robot Library"
 * 4. Supported account types: "Accounts in this organizational directory only"
 * 5. Set Redirect URI to your app URL (e.g., http://localhost:5173 for dev)
 * 6. Copy the Client ID from the Overview page
 * 7. Replace VITE_AZURE_CLIENT_ID with your actual Client ID
 */

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'your-client-id-here',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || 'http://localhost:5173',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};

export const graphRequest = {
  scopes: ['User.Read'],
};
