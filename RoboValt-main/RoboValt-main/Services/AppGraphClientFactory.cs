using Microsoft.Graph;
using Microsoft.Identity.Client;
using Microsoft.Kiota.Abstractions.Authentication;

namespace Robot_Program_Validation.Services
{
    public class GraphOptions
    {
        public string? TenantId { get; set; }
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }
    }

    public static class AppGraphClientFactory
    {
        public static GraphServiceClient Create(string tenantId, string clientId, string clientSecret)
        {
            var provider = new ClientCredentialsTokenProvider(tenantId, clientId, clientSecret);
            var authProvider = new BaseBearerTokenAuthenticationProvider(provider);
            return new GraphServiceClient(authProvider);
        }
    }

    public class ClientCredentialsTokenProvider : IAccessTokenProvider
    {
        private readonly string _tenant;
        private readonly string _client;
        private readonly string _secret;

        public ClientCredentialsTokenProvider(string tenant, string client, string secret)
        {
            _tenant = tenant;
            _client = client;
            _secret = secret;
        }

        public AllowedHostsValidator AllowedHostsValidator { get; } =
            new AllowedHostsValidator(new[] { "graph.microsoft.com" });

        public async Task<string> GetAuthorizationTokenAsync(
            Uri uri,
            Dictionary<string, object> ctx = null,
            CancellationToken token = default)
        {
            var app = ConfidentialClientApplicationBuilder
                .Create(_client)
                .WithClientSecret(_secret)
                .WithAuthority($"https://login.microsoftonline.com/{_tenant}")
                .Build();

            var result = await app
                .AcquireTokenForClient(new[] { "https://graph.microsoft.com/.default" })
                .ExecuteAsync();

            return result.AccessToken;
        }
    }
}