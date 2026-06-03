using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChecklistMaster.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService            _service;
        private readonly ILogger<NotificationsController> _logger;

        public NotificationsController(INotificationService service, ILogger<NotificationsController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        /// <summary>
        /// Triggers a notification by executing usp_TriggerNotification.
        /// The SP builds the mail content and sends it via SQL Server Database Mail.
        /// </summary>
        [HttpPost("trigger")]
        public async Task<IActionResult> Trigger([FromBody] NotificationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.EventType) ||
                string.IsNullOrWhiteSpace(request.EntityId))
                return BadRequest(new { message = "EventType and EntityId are required." });

            try
            {
                await _service.TriggerAsync(request);
                return Ok(new { message = "Notification triggered." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Notification trigger failed — EventType={EventType}, EntityId={EntityId}",
                    request.EventType, request.EntityId);
                // Return 200 so the frontend is not blocked by mail failures
                return Ok(new { message = "Notification trigger failed (logged).", error = ex.Message });
            }
        }
    }
}
