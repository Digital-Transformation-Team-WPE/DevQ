using ChecklistMaster.Server.Data;
using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChecklistMaster.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [AllowAnonymous]
    public class UsersController : ControllerBase
    {
        private readonly IUserService            _service;
        private readonly AppDbContext            _db;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IUserService service, AppDbContext db, ILogger<UsersController> logger)
        {
            _service = service;
            _db      = db;
            _logger  = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll() =>
            Ok(await _service.GetAllAsync());

        [HttpGet("{id:regex(^(?!byUserId|byRole).*)}")]
        public async Task<IActionResult> GetById(string id)
        {
            var item = await _service.GetByIdAsync(id);
            return item is null ? NotFound() : Ok(item);
        }

        [HttpGet("byUserId/{userId}")]
        public async Task<IActionResult> GetByUserId(string userId)
        {
            var item = await _service.GetByUserIdAsync(userId);
            return item is null ? NotFound() : Ok(item);
        }

        [HttpGet("byRole/{role}")]
        public async Task<IActionResult> GetByRole(string role) =>
            Ok(await _service.GetByRoleAsync(role));

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] User entity)
        {
            // Hash plain-text password before storing
            if (!string.IsNullOrWhiteSpace(entity.Password) && !entity.Password.StartsWith("PBKDF2:"))
                entity.Password = PasswordHasher.Hash(entity.Password);

            entity.CreatedDate = DateTime.UtcNow;
            _logger.LogInformation("Creating user {UserId}", entity.UserId);
            var created = await _service.CreateAsync(entity);
            return CreatedAtAction(nameof(GetById), new { id = created.UId }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] User entity)
        {
            // Hash plain-text password; empty/null password means "keep existing" — handled on the frontend
            if (!string.IsNullOrWhiteSpace(entity.Password) && !entity.Password.StartsWith("PBKDF2:"))
                entity.Password = PasswordHasher.Hash(entity.Password);

            var updated = await _service.UpdateAsync(id, entity);
            return updated is null ? NotFound() : Ok(updated);
        }

        [HttpPut("{id}/approve")]
        public async Task<IActionResult> Approve(string id)
        {
            // Targeted update — only touch Status, never overwrite Password or other fields
            var rows = await _db.Users
                .Where(u => u.UId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.Status, "Active"));

            if (rows == 0) return NotFound();

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UId == id);
            _logger.LogInformation("Admin approved user {UserId} (UId={UId}).", user!.UserId, user.UId);
            return Ok(user);
        }

        [HttpPatch("{id}/change-password")]
        public async Task<IActionResult> ChangePassword(string id, [FromBody] ChangePasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new { message = "Current password and new password are required." });

            var user = await _service.GetByIdAsync(id);
            if (user is null) return NotFound();

            if (!PasswordHasher.Verify(request.CurrentPassword, user.Password ?? ""))
                return BadRequest(new { message = "Current password is incorrect." });

            var rows = await _db.Users
                .Where(u => u.UId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.Password, PasswordHasher.Hash(request.NewPassword)));

            if (rows == 0) return NotFound();
            _logger.LogInformation("User {Id} changed their password.", id);
            return Ok(new { message = "Password updated successfully." });
        }

        [HttpPatch("{id}/profile")]
        public async Task<IActionResult> UpdateProfile(string id, [FromBody] UpdateProfileRequest request)
        {
            var user = await _service.GetByIdAsync(id);
            if (user is null) return NotFound();

            await _db.Users
                .Where(u => u.UId == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.UserName, request.UserName ?? user.UserName)
                    .SetProperty(u => u.EmailId,  request.EmailId  ?? user.EmailId));

            var updated = await _service.GetByIdAsync(id);
            _logger.LogInformation("User {Id} updated their profile.", id);
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var deleted = await _service.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
    }
}
