using ChecklistMaster.Server.Models;

namespace ChecklistMaster.Server.Services
{
    public interface IAuthService
    {
        /// <summary>
        /// Validates credentials against SQL (PBKDF2) then verifies the user
        /// exists in Entra ID via Microsoft Graph. Used when AzureAd:Enabled is true.
        /// </summary>
        Task<(bool Success, string? Upn, string? Error)> ValidateAzureAdAsync(string username, string password);

        /// <summary>
        /// Validates credentials directly against the Users table (basic auth).
        /// Used when AzureAd:Enabled is false.
        /// If the user's Password field is null, any password is accepted (first-login / dev setup).
        /// </summary>
        Task<(bool Success, string? Upn, string? Error)> ValidateLocalAsync(string username, string password);

        Task<User?> GetUserFromDatabaseAsync(string upn);
        string GenerateJwtToken(User user);
    }
}
