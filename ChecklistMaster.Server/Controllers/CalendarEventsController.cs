using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Manages CalendarEvents — holidays, vacations, non-working days,
    /// special working days, and milestone targets.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class CalendarEventsController : ControllerBase
    {
        private readonly ICalendarEventService _service;
        private readonly ILogger<CalendarEventsController> _logger;

        public CalendarEventsController(ICalendarEventService service, ILogger<CalendarEventsController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        // ── GET /api/calendarevents ──────────────────────────────────────────
        /// <summary>Returns all calendar events (global and personal).</summary>
        /// <response code="200">List of all calendar events.</response>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<CalendarEvent>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("Fetching all calendar events");
            return Ok(await _service.GetAllAsync());
        }

        // ── GET /api/calendarevents/{id} ─────────────────────────────────────
        /// <summary>Returns a single calendar event by Uid.</summary>
        /// <param name="id">Event Uid.</param>
        /// <response code="200">Event found.</response>
        /// <response code="404">Event not found.</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(CalendarEvent), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item is null) return NotFound();
            return Ok(item);
        }

        // ── GET /api/calendarevents/byUser/{userId} ──────────────────────────
        /// <summary>
        /// Returns all global events plus personal events belonging to the specified user.
        /// </summary>
        /// <param name="userId">UserId of the requesting user.</param>
        /// <response code="200">Matching events.</response>
        [HttpGet("byUser/{userId}")]
        [ProducesResponseType(typeof(IEnumerable<CalendarEvent>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetByUser(string userId)
        {
            _logger.LogInformation("Fetching calendar events for user {UserId}", userId);
            return Ok(await _service.GetByUserAsync(userId));
        }

        // ── POST /api/calendarevents ─────────────────────────────────────────
        /// <summary>Creates a new calendar event.</summary>
        /// <param name="entity">CalendarEvent payload.</param>
        /// <response code="201">Event created.</response>
        [HttpPost]
        [ProducesResponseType(typeof(CalendarEvent), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create([FromBody] CalendarEvent entity)
        {
            _logger.LogInformation("Creating calendar event {Uid} – {Title}", entity.Uid, entity.Title);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.Uid }, created);
        }

        // ── PUT /api/calendarevents/{id} ─────────────────────────────────────
        /// <summary>Updates an existing calendar event.</summary>
        /// <param name="id">Uid of the event to update.</param>
        /// <param name="entity">Updated payload.</param>
        /// <response code="200">Event updated.</response>
        /// <response code="404">Event not found.</response>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(CalendarEvent), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(string id, [FromBody] CalendarEvent entity)
        {
            var updated = await _service.UpdateAsync(id, entity);
            if (updated is null) return NotFound();
            return Ok(updated);
        }

        // ── DELETE /api/calendarevents/{id} ─────────────────────────────────
        /// <summary>Deletes a calendar event by Uid.</summary>
        /// <param name="id">Uid of the event to delete.</param>
        /// <response code="204">Event deleted.</response>
        /// <response code="404">Event not found.</response>
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
