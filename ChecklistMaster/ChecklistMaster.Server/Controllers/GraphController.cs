using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class GraphController : ControllerBase
    {
        private readonly IGraphService _graph;
        private readonly ILogger<GraphController> _logger;

        public GraphController(IGraphService graph, ILogger<GraphController> logger)
        {
            _graph  = graph;
            _logger = logger;
        }

        /// <summary>
        /// Search users by display name / mail / UPN. Minimum 3 characters.
        /// Returns { azureEnabled, users }.
        /// </summary>
        [HttpGet("users/search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string q)
        {
            if (!_graph.IsAzureEnabled)
                return Ok(new { azureEnabled = false, users = Array.Empty<object>() });

            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 3)
                return Ok(new { azureEnabled = true, users = Array.Empty<object>() });

            try
            {
                var users = (await _graph.SearchUsersAsync(q.Trim())).ToList();
                return Ok(new { azureEnabled = true, users });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Graph search failed for query '{Query}'.", q);
                return Ok(new { azureEnabled = true, users = Array.Empty<object>() });
            }
        }

        /// <summary>
        /// Returns { azureEnabled, users }.
        /// azureEnabled=false  → Azure is off; frontend should fall back to internal users.
        /// azureEnabled=true, users=[...] → Azure working.
        /// azureEnabled=true, users=[]   → Azure enabled but 0 users returned (bad credentials / missing permission).
        /// 422 → Azure enabled but the Graph API call threw (auth error, network, etc.).
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            if (!_graph.IsAzureEnabled)
            {
                _logger.LogInformation("Azure AD is disabled — returning empty user list.");
                return Ok(new { azureEnabled = false, users = Array.Empty<object>() });
            }

            _logger.LogInformation("Fetching all Azure AD users.");
            try
            {
                var users = (await _graph.GetAllUsersAsync()).ToList();
                _logger.LogInformation("Azure AD returned {Count} users.", users.Count);
                return Ok(new { azureEnabled = true, users });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Graph API GetAllUsers failed.");
                return UnprocessableEntity(new
                {
                    message = $"Azure AD call failed: {ex.Message}. Verify the Client Secret is not expired and the app registration has User.Read.All application permission with admin consent."
                });
            }
        }
    }
}
