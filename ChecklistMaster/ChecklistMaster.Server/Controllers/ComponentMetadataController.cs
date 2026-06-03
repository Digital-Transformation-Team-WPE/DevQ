using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// UI Component Metadata – stores labels, parameters, actions and language codes
    /// used to drive dynamic UI rendering across the application.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class ComponentMetadataController : ControllerBase
    {
        private readonly IComponentMetadataService _service;
        private readonly ILogger<ComponentMetadataController> _logger;

        public ComponentMetadataController(IComponentMetadataService service, ILogger<ComponentMetadataController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>Returns all component metadata records.</summary>
        /// <response code="200">Records returned.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ComponentMetadata>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all component metadata");
            return Ok(await _service.GetAllAsync());
        }

        /// <summary>Returns a component metadata record by its integer Ouid.</summary>
        /// <param name="id">Ouid (integer primary key).</param>
        /// <response code="200">Record found.</response>
        /// <response code="404">Not found.</response>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(ComponentMetadata), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(int id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        /// <summary>Returns metadata records for a given component code.</summary>
        /// <param name="componentCode">Component code string.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byComponentCode/{componentCode}")]
        [ProducesResponseType(typeof(IEnumerable<ComponentMetadata>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByComponentCode(string componentCode) =>
            Ok(await _service.GetByComponentCodeAsync(componentCode));

        /// <summary>Returns metadata records for a given language code.</summary>
        /// <param name="language">Integer language code.</param>
        /// <response code="200">Matching records.</response>
        [HttpGet("byLanguage/{language:int}")]
        [ProducesResponseType(typeof(IEnumerable<ComponentMetadata>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByLanguage(int language) =>
            Ok(await _service.GetByLanguageAsync(language));

        /// <summary>Creates a new component metadata record.</summary>
        /// <param name="entity">Payload.</param>
        /// <response code="201">Created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(ComponentMetadata), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] ComponentMetadata entity)
        {
            _logger.LogInformation("Creating component metadata {Ouid}", entity.Ouid);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Ouid }, created);
        }

        /// <summary>Updates a component metadata record.</summary>
        /// <param name="id">Ouid of the record to update.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Updated.</response>
        /// <response code="404">Not found.</response>
        [HttpPut("{id:int}")]
        [ProducesResponseType(typeof(ComponentMetadata), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(int id, [FromBody] ComponentMetadata entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        /// <summary>Deletes a component metadata record by Ouid.</summary>
        /// <param name="id">Ouid of the record to delete.</param>
        /// <response code="204">Deleted.</response>
        /// <response code="404">Not found.</response>
        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted) return NotFound();
            return NoContent();
        }
    }
}
