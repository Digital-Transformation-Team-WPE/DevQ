using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http.Features;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Master list of checklist checkpoints – the source of truth for all checklist templates,
    /// filterable by Zone, Area, and Department.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public class ChecklistMasterController : ControllerBase
    {
        private readonly IChecklistMasterService _service;
        private readonly ILogger<ChecklistMasterController> _logger;
        private readonly IWebHostEnvironment _env;

        public ChecklistMasterController(IChecklistMasterService service, ILogger<ChecklistMasterController> logger, IWebHostEnvironment env)
        {
            _service = service;
            _logger  = logger;
            _env     = env;
        }

        /// <summary>Returns all checklist master records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMasterEntity>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all checklist master records");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a checklist master record by Uid.</summary>
        /// <param name="id">Record Uid.</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id:regex(^(?!batch$).+)}")]
        [ProducesResponseType(typeof(ChecklistMasterEntity), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns checklist master records filtered by Zone.</summary>
        /// <param name="zone">Zone name.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byZone/{zone}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMasterEntity>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByZone(string zone) =>
            Ok(await _service.GetByZoneAsync(zone));

        /// <summary>Returns checklist master records filtered by Area.</summary>
        /// <param name="area">Area name.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byArea/{area}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMasterEntity>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByArea(string area) =>
            Ok(await _service.GetByAreaAsync(area));

        /// <summary>Returns checklist master records filtered by Department.</summary>
        /// <param name="department">Department name.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byDepartment/{department}")]
        [ProducesResponseType(typeof(IEnumerable<ChecklistMasterEntity>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByDepartment(string department) =>
            Ok(await _service.GetByDepartmentAsync(department));

        /// <summary>Creates a new checklist master record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(ChecklistMasterEntity), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] ChecklistMasterEntity entity)
        {
            _logger.LogInformation("Creating checklist master {Uid}", entity.Uid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        /// <summary>
        /// Batch-creates multiple checklist master records from an Excel import.
        /// Returns a summary of how many succeeded and any per-row errors.
        /// </summary>
        /// <param name="entities">Array of records to create.</param>
        /// <response code="200">Batch processed (check Created/Failed counts in response).</response>
        /// <response code="400">Empty payload.</response>
        [HttpPost("batch")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateBatch([FromBody] List<ChecklistMasterEntity> entities)
        {
            if (entities is null || entities.Count == 0)
                return BadRequest(new { Message = "No records provided." });

            var created = 0;
            var errors  = new List<string>();

            foreach (var entity in entities)
            {
                try
                {
                    await _service.CreateAsync(entity);
                    created++;
                }
                catch (Exception ex)
                {
                    var msg = ex.InnerException?.Message ?? ex.Message;
                    errors.Add($"{entity.ChkId ?? "?"}: {msg}");
                    _logger.LogError(ex, "Batch create error for ChkId {ChkId}", entity.ChkId);
                }
            }

            _logger.LogInformation("Batch import: {Created} created, {Failed} failed.", created, errors.Count);
            return Ok(new { Created = created, Failed = errors.Count, Errors = errors });
        }

        /// <summary>Updates a checklist master record.</summary>
        /// <param name="id">Record Uid.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(ChecklistMasterEntity), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] ChecklistMasterEntity entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Uploads a file (image or document) for a checklist master record.</summary>
        /// <response code="200">Returns the stored path and original file name.</response>
        /// <response code="400">No file provided or file type not allowed.</response>
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            var ext     = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
                                  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt" };
            if (!allowed.Contains(ext))
                return BadRequest(new { message = $"File type '{ext}' is not allowed." });

            var dir      = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "checklists");
            Directory.CreateDirectory(dir);

            var fileName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(dir, fileName);

            await using var stream = new FileStream(fullPath, FileMode.Create, FileAccess.Write);
            await file.CopyToAsync(stream);

            _logger.LogInformation("ChecklistMaster upload: {File}", fileName);
            return Ok(new { path = $"/uploads/checklists/{fileName}", fileName = file.FileName });
        }

        /// <summary>Deletes a checklist master record by Uid.</summary>
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
