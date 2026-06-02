using Microsoft.Graph;

namespace Robot_Program_Validation.Services
{
    public interface IGraphDirectoryService
    {
        Task<List<GraphUserSuggestion>> SearchUsersAsync(string name);
    }

    public class GraphUserSuggestion
    {
        public string Label { get; set; }
        public string Value { get; set; }
        public string EmployeeId { get; set; }
    }

    public class GraphDirectoryService : IGraphDirectoryService
    {
        private readonly GraphServiceClient _client;

        public GraphDirectoryService(GraphServiceClient client)
        {
            _client = client;
        }

        public async Task<List<GraphUserSuggestion>> SearchUsersAsync(string name)
        {
            var page = await _client.Users.GetAsync(r =>
            {
                r.QueryParameters.Select = new[]
                {
                    "displayName","userPrincipalName","mail"
                };
                r.QueryParameters.Filter = $"startswith(displayName,'{name}')";
                r.QueryParameters.Top = 10;
            });

            var results = new List<GraphUserSuggestion>();

            foreach (var u in page.Value)
            {

                var empId = (u.UserPrincipalName ?? u.EmployeeId ?? "").Split('@')[0];
                results.Add(new GraphUserSuggestion
                {
                    Label = $"{u.DisplayName ?? "Unknown"} ({empId})",
                    Value = u.DisplayName ?? "",
                    EmployeeId = empId
                });
            }

            return results;
        }
    }
}