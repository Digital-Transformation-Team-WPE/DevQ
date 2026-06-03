using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages Issue Document Information – titles, descriptions, owners, dates, part numbers, and derogation data.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class IssueListDocinfosController : ControllerBase
    {
        private readonly IIssueListDocinfoService _service;
        private readonly ILogger<IssueListDocinfosController> _logger;

        public IssueListDocinfosController(IIssueListDocinfoService service, ILogger<IssueListDocinfosController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all issue doc-info records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<IssueListDocinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all issue list docinfos");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a doc-info record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(IssueListDocinfo), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns doc-info records for a given issue number.</summary>
        /// <param name="issueNumber">Issue number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byIssueNumber/{issueNumber}")]
        [ProducesResponseType(typeof(IEnumerable<IssueListDocinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber) =>
            Ok(await _service.GetByIssueNumberAsync(issueNumber));

        /// <summary>Returns doc-info records for a given part number.</summary>
        /// <param name="partNumber">Part number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byPartNumber/{partNumber}")]
        [ProducesResponseType(typeof(IEnumerable<IssueListDocinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByPartNumber(string partNumber) =>
            Ok(await _service.GetByPartNumberAsync(partNumber));

        /// <summary>Creates a new issue doc-info record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(IssueListDocinfo), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] IssueListDocinfo entity)
        {
            _logger.LogInformation("Creating issue docinfo {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates an existing issue doc-info record.</summary>
        /// <param name="id">Record Uid.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(IssueListDocinfo), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] IssueListDocinfo entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a doc-info record by Uid.</summary>
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
