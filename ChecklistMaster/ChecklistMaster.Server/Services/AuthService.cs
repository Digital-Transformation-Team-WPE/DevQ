using ChecklistMaster.Server.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ChecklistMaster.Server.Services
{
    public sealed class AuthService : IAuthService
    {
        private readonly IUserService         _userService;
        private readonly IGraphService        _graphService;
        private readonly IConfiguration       _config;
        private readonly ILogger<AuthService> _logger;

        public AuthService(
            IUserService         userService,
            IGraphService        graphService,
            IConfiguration       config,
            ILogger<AuthService> logger)
        {
            _userService  = userService;
            _graphService = graphService;
            _config       = config;
            _logger       = logger;
        }

        // ── Local-only password check (PBKDF2) ─────────────────────────────────
        public async Task<(bool Success, string? Upn, string? Error)> ValidateLocalAsync(
            string username, string password)
        {
            var user = await _userService.GetByUserIdAsync(username);
            if (user is null)
                return (false, null, "Invalid username or password.");

            if (!string.IsNullOrEmpty(user.Password))
            {
                if (!PasswordHasher.Verify(password, user.Password))
                    return (false, null, "Invalid username or password.");
            }
            else
            {
                // No password stored yet — accept any value (first-login convenience).
                // Set a password via User Management to lock this down.
                _logger.LogWarning(
                    "User {UserId} has no password stored — login accepted without password check.", username);
            }

            return (true, user.UserId, null);
        }

        // ── Entra-aware login: SQL password check + Graph existence verification ─
        public async Task<(bool Success, string? Upn, string? Error)> ValidateAzureAdAsync(
            string username, string password)
        {
            // Step 1 — Validate password against SQL (PBKDF2, same as local mode)
            var (localOk, upn, localErr) = await ValidateLocalAsync(username, password);
            if (!localOk)
                return (false, null, localErr);

            // Step 2 — Fetch the user's email to query Entra ID
            var user = await _userService.GetByUserIdAsync(username);
            var lookup = user?.EmailId ?? username;

            // Step 3 — Verify the user exists as an active member in Entra ID
            EntraUserProfile? entraProfile = null;
            try
            {
                entraProfile = await _graphService.GetUserProfileAsync(lookup);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Graph API unreachable during login for {User}.", username);
                return (false, null, "Directory service is temporarily unavailable. Please try again.");
            }

            if (entraProfile is null)
            {
                _logger.LogWarning(
                    "Login blocked: {User} ({Email}) has no record in Entra ID.", username, lookup);
                return (false, null,
                    "Your account was not found in the organization directory. Contact your administrator.");
            }

            _logger.LogInformation(
                "Entra ID verified {User} — DisplayName: {Name}, Department: {Dept}.",
                username, entraProfile.DisplayName, entraProfile.Department);

            return (true, upn, null);
        }

        // ── Database lookup ────────────────────────────────────────────────────
        public Task<User?> GetUserFromDatabaseAsync(string upn) =>
            _userService.GetByUserIdAsync(upn);

        // ── JWT generation ─────────────────────────────────────────────────────
        public string GenerateJwtToken(User user)
        {
            var keyBytes   = Encoding.UTF8.GetBytes(_config["Jwt:Key"]!);
            var creds      = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
            var expiryMins = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 30;

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub,   user.UId),
                new Claim(JwtRegisteredClaimNames.Email, user.EmailId  ?? string.Empty),
                new Claim(JwtRegisteredClaimNames.Name,  user.UserName ?? string.Empty),
                new Claim("userId", user.UserId ?? string.Empty),
                new Claim("role",   user.Role   ?? "Viewer"),
                new Claim("status", user.Status ?? string.Empty),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };

            var token = new JwtSecurityToken(
                issuer:             _config["Jwt:Issuer"],
                audience:           _config["Jwt:Audience"],
                claims:             claims,
                expires:            DateTime.UtcNow.AddMinutes(expiryMins),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
