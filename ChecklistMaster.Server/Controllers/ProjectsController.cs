using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages Projects – create, read, update, and delete project records.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService _service;
        private readonly ILogger<ProjectsController> _logger;

        public ProjectsController(IProjectService service, ILogger<ProjectsController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all projects.</summary>
        /// <response code="200">List of projects.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<Project>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all projects");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a single project by Uid.</summary>
        /// <param name="id">Project Uid.</param>
        /// <response code="200">Project found.</response>
        /// <response code="404">Project not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(Project), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns all projects created by a specific user.</summary>
        /// <param name="createdBy">Username of the creator.</param>
        /// <response code="200">Matching projects.</response>
        [HttpGet("byCreatedBy/{createdBy}")]
        [ProducesResponseType(typeof(IEnumerable<Project>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByCreatedBy(string createdBy) =>
            Ok(await _service.GetByCreatedByAsync(createdBy));

        /// <summary>Creates a new project.</summary>
        /// <param name="entity">Project payload.</param>
        /// <response code="201">Project created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(Project), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] Project entity)
        {
            _logger.LogInformation("Creating project {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates an existing project.</summary>
        /// <param name="id">Uid of the project to update.</param>
        /// <param name="entity">Updated project payload.</param>
        /// <response code="200">Project updated.</response>
        /// <response code="404">Project not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(Project), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] Project entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a project by Uid.</summary>
        /// <param name="id">Uid of the project to delete.</param>
        /// <response code="204">Project deleted.</response>
        /// <response code="404">Project not found.</response>
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
