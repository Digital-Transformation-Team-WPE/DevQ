using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// DMRS Checklist – Design, Manufacturing, and Release Sign-off checkpoints per issue and part.
    /// Sync results and comments are stored as a single SyncData JSON column (dynamic milestone support).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class DmrsChecklistsController : ControllerBase
    {
        private readonly IDmrsChecklistService _service;
        private readonly ILogger<DmrsChecklistsController> _logger;
        private readonly IWebHostEnvironment _env;

        public DmrsChecklistsController(IDmrsChecklistService service, ILogger<DmrsChecklistsController> logger, IWebHostEnvironment env)
        {
            _service = service;
            _logger  = logger;
            _env     = env;
        }

        /// <summary>Uploads an image attachment and returns its server-relative URL path.</summary>
        /// <response code="200">Returns { path: "/uploads/dmrs/filename.ext" }</response>
        /// <response code="400">No file or unsupported type.</response>
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            var allowed = new[] { ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".pdf" };
            var ext     = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowed.Contains(ext)) ext = ".png";

            var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "dmrs");
            Directory.CreateDirectory(folder);

            var fileName = $"{Guid.NewGuid():N}{ext}";
            var filePath = Path.Combine(folder, fileName);

            await using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);

            _logger.LogInformation("Uploaded DMRS image {FileName}", fileName);
            return Ok(new { path = $"/uploads/dmrs/{fileName}" });
        }

        /// <summary>Returns all DMRS checklist records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<DmrsChecklist>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all DMRS checklists");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a DMRS checklist record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(DmrsChecklist), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns DMRS records for a given issue number.</summary>
        /// <param name="issueNumber">Issue number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byIssueNumber/{issueNumber}")]
        [ProducesResponseType(typeof(IEnumerable<DmrsChecklist>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber) =>
            Ok(await _service.GetByIssueNumberAsync(issueNumber));

        /// <summary>Returns DMRS records for a given part number.</summary>
        /// <param name="partNumber">Part number.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byPartNumber/{partNumber}")]
        [ProducesResponseType(typeof(IEnumerable<DmrsChecklist>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByPartNumber(string partNumber) =>
            Ok(await _service.GetByPartNumberAsync(partNumber));

        /// <summary>Creates a new DMRS checklist record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(DmrsChecklist), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] DmrsChecklist entity)
        {
            _logger.LogInformation("Creating DMRS checklist {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>Updates a DMRS checklist record.</summary>
        /// <param name="id">Record Uid.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(DmrsChecklist), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] DmrsChecklist entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a DMRS checklist record by Uid.</summary>
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
