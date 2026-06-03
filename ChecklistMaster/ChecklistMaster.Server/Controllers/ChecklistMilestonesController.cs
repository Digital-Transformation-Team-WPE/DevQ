using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages Checklist Milestones – tracks checkpoint target dates, no-of-days targets,
    /// and department assignments for each checklist item.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ChecklistMilestonesController : ControllerBase
    {
        private readonly IChecklistMilestoneService          _service;
        private readonly ILogger<ChecklistMilestonesController> _logger;

        public ChecklistMilestonesController(
            IChecklistMilestoneService             service,
            ILogger<ChecklistMilestonesController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        /// <summary>Returns all checklist milestone records.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all checklist milestones");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a milestone record by Uid.</summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(ChecklistMilestone), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns milestone records filtered by department.</summary>
        [HttpGet("byDepartment/{department}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByDepartment(string department) =>
            Ok(await _service.GetByDepartmentAsync(department));

        /// <summary>Returns milestone records for a given checklist ID.</summary>
        [HttpGet("byChkId/{chkId}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByChkId(string chkId) =>
            Ok(await _service.GetByChkIdAsync(chkId));

        /// <summary>Returns milestone records for a given milestone ID.</summary>
        [HttpGet("byMilestoneId/{milestoneId}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMilestone>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByMilestoneId(string milestoneId) =>
            Ok(await _service.GetByMilestoneIdAsync(milestoneId));

        /// <summary>Creates a new checklist milestone record.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(ChecklistMilestone), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] ChecklistMilestone entity)
        {
            _logger.LogInformation("Creating checklist milestone {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates an existing checklist milestone record.</summary>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(ChecklistMilestone), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] ChecklistMilestone entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a checklist milestone record.</summary>
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
