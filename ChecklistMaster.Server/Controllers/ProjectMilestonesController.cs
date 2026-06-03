using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages Project Milestones – project-level milestones with per-department
    /// completion tracking (AVP and WGDE dates stored as first-class columns).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ProjectMilestonesController : ControllerBase
    {
        private readonly IProjectMilestoneService          _service;
        private readonly ILogger<ProjectMilestonesController> _logger;

        public ProjectMilestonesController(
            IProjectMilestoneService             service,
            ILogger<ProjectMilestonesController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        /// <summary>Returns all project milestone records.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ProjectMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all project milestones");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a project milestone by Uid.</summary>
        [HttpGet("{uid}")]
        [ProducesResponseType(typeof(ProjectMilestone), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string uid)
        {
            var item = await _service.GetByIdAsync(uid);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns all milestones for a given project, ordered by MilestoneOrder.</summary>
        [HttpGet("byProject/{projectUid}")]
        [ProducesResponseType(typeof(IEnumerable<ProjectMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByProject(string projectUid) =>
            Ok(await _service.GetByProjectUidAsync(projectUid));

        /// <summary>Creates a new project milestone.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(ProjectMilestone), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] ProjectMilestone entity)
        {
            _logger.LogInformation("Creating project milestone {Uid} for project {ProjectUid}", entity.Uid, entity.ProjectUid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { uid = created.Uid }, created);
        }

        /// <summary>Updates an existing project milestone.</summary>
        [HttpPut("{uid}")]
        [ProducesResponseType(typeof(ProjectMilestone), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string uid, [FromBody] ProjectMilestone entity)
        {
            var updated = await _service.UpdateAsync(uid, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>
        /// Replaces all milestones for a project in a single transaction.
        /// Rows not present in the payload are deleted; existing rows are updated; new rows are inserted.
        /// </summary>
        [HttpPut("byProject/{projectUid}")]
        [ProducesResponseType(typeof(IEnumerable<ProjectMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> BulkUpsert(string projectUid, [FromBody] IEnumerable<ProjectMilestone> milestones)
        {
            _logger.LogInformation("Bulk-upserting project milestones for project {ProjectUid}", projectUid);
            var result = await _service.BulkUpsertAsync(projectUid, milestones);
            return Ok(result);
        }

        /// <summary>Deletes a project milestone.</summary>
        [HttpDelete("{uid}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(string uid)
        {
            var deleted = await _service.DeleteAsync(uid);
            if (!deleted) return NotFound();
            return NoContent();
        }
    }
}
