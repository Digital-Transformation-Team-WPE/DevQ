using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Links Projects to Issue numbers – manage the many-to-many mapping between projects and issues.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ProjectIssueLinksController : ControllerBase
    {
        private readonly IProjectIssueLinkService _service;
        private readonly ILogger<ProjectIssueLinksController> _logger;

        public ProjectIssueLinksController(IProjectIssueLinkService service, ILogger<ProjectIssueLinksController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all project–issue links.</summary>
        /// <response code="200">List returned successfully.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ProjectIssueLink>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all project issue links");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a link by its Uid.</summary>
        /// <param name="id">Link Uid.</param>
        /// <response code="200">Link found.</response>
        /// <response code="404">Link not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(ProjectIssueLink), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns all links for a given project Uid.</summary>
        /// <param name="uid">Project Uid.</param>
        /// <response code="200">Matching links.</response>
        [HttpGet("byProject/{uid}")]
        [ProducesResponseType(typeof(IEnumerable<ProjectIssueLink>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByProject(string uid) =>
            Ok(await _service.GetByProjectUidAsync(uid));

        /// <summary>Returns all links for a given issue number.</summary>
        /// <param name="issueNumber">Issue number.</param>
        /// <response code="200">Matching links.</response>
        [HttpGet("byIssueNumber/{issueNumber}")]
        [ProducesResponseType(typeof(IEnumerable<ProjectIssueLink>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber) =>
            Ok(await _service.GetByIssueNumberAsync(issueNumber));

        /// <summary>Creates a new project–issue link.</summary>
        /// <param name="entity">Link payload.</param>
        /// <response code="201">Link created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(ProjectIssueLink), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] ProjectIssueLink entity)
        {
            _logger.LogInformation("Creating project issue link {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates an existing project–issue link.</summary>
        /// <param name="id">Uid of the link to update.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(ProjectIssueLink), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] ProjectIssueLink entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a link by Uid.</summary>
        /// <param name="id">Link Uid.</param>
        /// <response code="204">Deleted.</response>
        /// <response code="404">Not found.</response>
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(string id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted) return NotFound();
            return NoContent();
        }
    }
}
