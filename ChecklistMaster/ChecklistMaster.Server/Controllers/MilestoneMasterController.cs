using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages the Milestone Master — the admin-defined ordered list of default
    /// milestones (name, description, days-after-previous) that seed every new project.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class MilestoneMasterController : ControllerBase
    {
        private readonly IMilestoneMasterService          _service;
        private readonly ILogger<MilestoneMasterController> _logger;

        public MilestoneMasterController(
            IMilestoneMasterService             service,
            ILogger<MilestoneMasterController>  logger)
        {
            _service = service;
            _logger  = logger;
        }

        /// <summary>Returns all milestone master records.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<MilestoneMaster>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all milestone masters");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns active milestone masters ordered by MilestoneOrder.</summary>
        [HttpGet("active")]
        [ProducesResponseType(typeof(IEnumerable<MilestoneMaster>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetActive() =>
            Ok(await _service.GetActiveOrderedAsync());

        /// <summary>Returns a milestone master by Uid.</summary>
        [HttpGet("{uid}")]
        [ProducesResponseType(typeof(MilestoneMaster), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string uid)
        {
            var item = await _service.GetByIdAsync(uid);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Creates a new milestone master record.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(MilestoneMaster), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] MilestoneMaster entity)
        {
            _logger.LogInformation("Creating milestone master '{Name}'", entity.MilestoneName);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { uid = created.Uid }, created);
        }

        /// <summary>Updates an existing milestone master.</summary>
        [HttpPut("{uid}")]
        [ProducesResponseType(typeof(MilestoneMaster), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string uid, [FromBody] MilestoneMaster entity)
        {
            var updated = await _service.UpdateAsync(uid, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a milestone master record.</summary>
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
