using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Aggregates project robustness report data from existing tables —
    /// no new DB tables; reads Project, ProjectIssueLinks, ProjectMilestones,
    /// DmrsChecklists, and PartMilestones then computes chart series, KPIs,
    /// and parts-detail table in one response.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ProjectReportController : ControllerBase
    {
        private readonly IProjectReportService _service;
        private readonly ILogger<ProjectReportController> _logger;

        public ProjectReportController(IProjectReportService service,
                                       ILogger<ProjectReportController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        /// <summary>
        /// Returns the full robustness report for a project:
        /// milestone columns, chart data points (Green/Orange/Red counts + %),
        /// KPI summary, and the parts-detail table.
        /// </summary>
        /// <param name="projectUid">Projects.Uid</param>
        /// <response code="200">Report data returned.</response>
        /// <response code="404">Project not found.</response>
        [HttpGet("{projectUid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetReport(string projectUid)
        {
            _logger.LogInformation("Generating robustness report for project {Uid}", projectUid);
            var dto = await _service.GetReportAsync(projectUid);
            if (dto is null) return NotFound(new { message = $"Project '{projectUid}' not found." });
            return Ok(dto);
        }
    }
}
