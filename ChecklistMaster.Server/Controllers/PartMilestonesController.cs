using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [Authorize]
    public class PartMilestonesController : ControllerBase
    {
        private readonly IPartMilestoneService _service;

        public PartMilestonesController(IPartMilestoneService service)
            => _service = service;

        [HttpGet]
        public async Task<IActionResult> GetAll()
            => Ok(await _service.GetAllAsync());

        [HttpGet("{uid}")]
        public async Task<IActionResult> GetById(string uid)
        {
            var item = await _service.GetByIdAsync(uid);
            return item is null ? NotFound() : Ok(item);
        }

        [HttpGet("byIssueNumber/{issueNumber}")]
        public async Task<IActionResult> GetByIssueNumber(string issueNumber)
            => Ok(await _service.GetByIssueNumberAsync(issueNumber));

        [HttpGet("byProject/{projectUid}")]
        public async Task<IActionResult> GetByProject(string projectUid)
            => Ok(await _service.GetByProjectUidAsync(projectUid));

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] PartMilestone entity)
        {
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { uid = created.Uid }, created);
        }

        [HttpPut("{uid}")]
        public async Task<IActionResult> Update(string uid, [FromBody] PartMilestone entity)
        {
            var updated = await _service.UpdateAsync(uid, entity);
            return updated is null ? NotFound() : Ok(updated);
        }

        [HttpDelete("{uid}")]
        public async Task<IActionResult> Delete(string uid)
        {
            var deleted = await _service.DeleteAsync(uid);
            return deleted ? NoContent() : NotFound();
        }

        /// <summary>Bulk-upsert milestones for a part (replaces all rows for that issueNumber).</summary>
        [HttpPut("byIssueNumber/{issueNumber}")]
        public async Task<IActionResult> BulkUpsert(string issueNumber, [FromBody] IEnumerable<PartMilestone> entities)
        {
            var result = await _service.BulkUpsertAsync(issueNumber, entities);
            return Ok(result);
        }
    }
}
