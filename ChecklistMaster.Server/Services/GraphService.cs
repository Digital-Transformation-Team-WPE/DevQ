using Azure.Identity;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace ChecklistMaster.Server.Services
{
    public sealed class GraphService : IGraphService
    {
        private readonly GraphServiceClient?     _graph;
        private readonly ILogger<GraphService>   _logger;

        public bool IsAzureEnabled { get; }

        public GraphService(IConfiguration config, ILogger<GraphService> logger)
        {
            _logger        = logger;
            IsAzureEnabled = config.GetValue<bool>("AzureAd:Enabled", false);

            if (!IsAzureEnabled) return;

            var tenantId     = config["AzureAd:TenantId"]     ?? throw new InvalidOperationException("AzureAd:TenantId not configured.");
            var clientId     = config["AzureAd:ClientId"]     ?? throw new InvalidOperationException("AzureAd:ClientId not configured.");
            var clientSecret = config["AzureAd:ClientSecret"] ?? throw new InvalidOperationException("AzureAd:ClientSecret not configured.");

            var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            _graph = new GraphServiceClient(credential);
        }

        public async Task<bool> UserExistsAsync(string emailOrUpn)
        {
            if (!IsAzureEnabled) return false;
            return await GetUserProfileAsync(emailOrUpn) is not null;
        }

        public async Task<EntraUserProfile?> GetUserProfileAsync(string emailOrUpn)
        {
            if (!IsAzureEnabled || _graph is null) return null;
            try
            {
                var sanitized = emailOrUpn.Replace("'", "''");
                var result = await _graph.Users.GetAsync(req =>
                {
                    req.QueryParameters.Filter = $"userPrincipalName eq '{sanitized}' or mail eq '{sanitized}'";
                    req.QueryParameters.Select = ["id", "displayName", "mail", "userPrincipalName",
                                                   "department", "jobTitle", "officeLocation"];
                    req.QueryParameters.Top   = 1;
                    req.QueryParameters.Count = true;
                    req.Headers.Add("ConsistencyLevel", "eventual");
                });

                var u = result?.Value?.FirstOrDefault();
                if (u is null) return null;

                return new EntraUserProfile(
                    u.Id, u.DisplayName, u.Mail, u.UserPrincipalName,
                    u.Department, u.JobTitle, u.OfficeLocation);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Graph API GetUserProfile failed for {User}.", emailOrUpn);
                return null;
            }
        }

        /// <summary>
        /// Fetches ALL enabled users by following Graph API pagination (each page ≤ 100 users).
        /// Throws on failure so the controller can return a meaningful 422 error.
        /// </summary>
        public async Task<IEnumerable<EntraUserProfile>> GetAllUsersAsync()
        {
            if (!IsAzureEnabled || _graph is null) return [];

            var allUsers = new List<EntraUserProfile>();

            // Fetch first page — Graph caps each page at 100 even with $top=999
            var firstPage = await _graph.Users.GetAsync(req =>
            {
                req.QueryParameters.Select  = ["id", "displayName", "mail", "userPrincipalName", "department", "jobTitle"];
                req.QueryParameters.Filter  = "accountEnabled eq true";
                req.QueryParameters.Orderby = ["displayName"];
                req.QueryParameters.Top     = 999;
                req.QueryParameters.Count   = true;
                req.Headers.Add("ConsistencyLevel", "eventual");
            });

            // PageIterator follows @odata.nextLink automatically until all pages are consumed
            var pageIterator = PageIterator<User, UserCollectionResponse>
                .CreatePageIterator(
                    _graph,
                    firstPage!,
                    user =>
                    {
                        allUsers.Add(new EntraUserProfile(
                            user.Id,
                            user.DisplayName,
                            user.Mail,
                            user.UserPrincipalName,
                            user.Department,
                            user.JobTitle,
                            null));
                        return true; // continue to next user / page
                    });

            await pageIterator.IterateAsync();

            _logger.LogInformation("Graph API returned {Count} total users across all pages.", allUsers.Count);
            return allUsers;
        }

        /// <summary>
        /// Uses Graph $search (requires ConsistencyLevel:eventual) to find up to 50 users
        /// whose displayName, mail, or userPrincipalName contains the query string.
        /// Throws on failure so the controller can surface a meaningful error.
        /// </summary>
        public async Task<IEnumerable<EntraUserProfile>> SearchUsersAsync(string query)
        {
            if (!IsAzureEnabled || _graph is null) return [];

            var escaped = query.Replace("\"", "\\\"");
            var result  = await _graph.Users.GetAsync(req =>
            {
                req.QueryParameters.Search = $"\"displayName:{escaped}\" OR \"mail:{escaped}\" OR \"userPrincipalName:{escaped}\"";
                req.QueryParameters.Select = ["id", "displayName", "mail", "userPrincipalName", "department", "jobTitle"];
                req.QueryParameters.Top    = 50;
                req.QueryParameters.Count  = true;
                req.Headers.Add("ConsistencyLevel", "eventual");
            });

            return (result?.Value ?? [])
                .OrderBy(u => u.DisplayName)
                .Select(u => new EntraUserProfile(
                    u.Id, u.DisplayName, u.Mail, u.UserPrincipalName, u.Department, u.JobTitle, null));
        }
    }
}
