using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Audit trail for Issue List changes – tracks who modified records and when.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class IssueListHistoriesController : ControllerBase
    {
        private readonly IIssueListHistoryService _service;
        private readonly ILogger<IssueListHistoriesController> _logger;

        public IssueListHistoriesController(IIssueListHistoryService service, ILogger<IssueListHistoriesController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all history records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<IssueListHistory>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all issue list histories");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a history record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(IssueListHistory), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns history records for a given issue number.</summary>
        /// <param name="issueNumber">Issue number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byIssueNumber/{issueNumber}")]
        [ProducesResponseType(typeof(IEnumerable<IssueListHistory>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber) =>
            Ok(await _service.GetByIssueNumberAsync(issueNumber));

        /// <summary>Creates a new history record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(IssueListHistory), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] IssueListHistory entity)
        {
            _logger.LogInformation("Creating issue history {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates a history record.</summary>
        /// <param name="id">Record Uid.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(IssueListHistory), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] IssueListHistory entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a history record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
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
