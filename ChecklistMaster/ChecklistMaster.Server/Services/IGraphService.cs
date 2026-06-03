namespace ChecklistMaster.Server.Services
{
    public record EntraUserProfile(
        string? Id,
        string? DisplayName,
        string? Mail,
        string? UserPrincipalName,
        string? Department,
        string? JobTitle,
        string? OfficeLocation
    );

    public interface IGraphService
    {
        /// <summary>True when AzureAd:Enabled is set to true in configuration.</summary>
        bool IsAzureEnabled { get; }

        /// <summary>Checks whether a user exists in Entra ID by email or UPN.</summary>
        Task<bool> UserExistsAsync(string emailOrUpn);

        /// <summary>Fetches profile fields from Entra ID; returns null if not found.</summary>
        Task<EntraUserProfile?> GetUserProfileAsync(string emailOrUpn);

        /// <summary>Returns all enabled users in the organisation, ordered by display name.</summary>
        Task<IEnumerable<EntraUserProfile>> GetAllUsersAsync();

        /// <summary>Searches enabled users by display name, mail or UPN. Returns up to 50 matches.</summary>
        Task<IEnumerable<EntraUserProfile>> SearchUsersAsync(string query);
    }
}
