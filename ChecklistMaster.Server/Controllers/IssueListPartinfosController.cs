using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages Issue Part Information – revisions, maturity states, pictures, proposals, and solutions.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class IssueListPartinfosController : ControllerBase
    {
        private readonly IIssueListPartinfoService _service;
        private readonly ILogger<IssueListPartinfosController> _logger;

        public IssueListPartinfosController(IIssueListPartinfoService service, ILogger<IssueListPartinfosController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all part-info records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<IssueListPartinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all issue list partinfos");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a part-info record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(IssueListPartinfo), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns part-info records for a given issue number.</summary>
        /// <param name="issueNumber">Issue number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byIssueNumber/{issueNumber}")]
        [ProducesResponseType(typeof(IEnumerable<IssueListPartinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber) =>
            Ok(await _service.GetByIssueNumberAsync(issueNumber));

        /// <summary>Returns part-info records for a given part number.</summary>
        /// <param name="partNumber">Part number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byPartNumber/{partNumber}")]
        [ProducesResponseType(typeof(IEnumerable<IssueListPartinfo>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByPartNumber(string partNumber) =>
            Ok(await _service.GetByPartNumberAsync(partNumber));

        /// <summary>Creates a new part-info record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(IssueListPartinfo), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] IssueListPartinfo entity)
        {
            _logger.LogInformation("Creating issue partinfo {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates a part-info record.</summary>
        /// <param name="id">Record Uid.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(IssueListPartinfo), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] IssueListPartinfo entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a part-info record by Uid.</summary>
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
