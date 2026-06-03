using ChecklistMaster.Server.Data;
using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;

namespace ChecklistMaster.Server.Controllers
{
    /// <summary>
    /// Authentication � login, logout, session restore, and first-run bootstrap.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class AuthController : ControllerBase
    {
        private const string CookieName = "cm_auth";

        private readonly IAuthService            _authService;
        private readonly IUserService            _userService;
        private readonly AppDbContext            _db;
        private readonly IConfiguration          _config;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            IAuthService            authService,
            IUserService            userService,
            AppDbContext            db,
            IConfiguration          config,
            ILogger<AuthController> logger)
        {
            _authService = authService;
            _userService = userService;
            _db          = db;
            _config      = config;
            _logger      = logger;
        }

        // -- POST /api/auth/login ---------------------------------------------
        /// <summary>
        /// Validates credentials via Azure AD ROPC, fetches role from DB,
        /// and issues a signed JWT in an HttpOnly cookie.
        /// </summary>
        [HttpPost("login")]
        [ProducesResponseType(typeof(AuthResponse), 200)]
        [ProducesResponseType(typeof(AuthResponse), 400)]
        [ProducesResponseType(typeof(AuthResponse), 401)]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new AuthResponse(false, "Username and password are required.", null));

            // 1 – Validate credentials: local DB auth or Azure AD depending on config
            var azureEnabled = _config.GetValue<bool>("AzureAd:Enabled", true);
            var (success, upn, error) = azureEnabled
                ? await _authService.ValidateAzureAdAsync(request.Username, request.Password)
                : await _authService.ValidateLocalAsync(request.Username, request.Password);

            if (!success)
                return Unauthorized(new AuthResponse(false, error, null));

            // 2 � Look up the user in our database
            var user = await _authService.GetUserFromDatabaseAsync(upn!);
            if (user is null)
            {
                _logger.LogWarning("Azure AD user {Upn} has no record in the application database.", upn);
                return Unauthorized(new AuthResponse(false,
                    "Your account is not registered in this system. Contact your administrator.", null));
            }

            if (string.Equals(user.Status, "inactive", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(user.Status, "disabled", StringComparison.OrdinalIgnoreCase))
                return Unauthorized(new AuthResponse(false,
                    "Your account is inactive. Contact your administrator.", null));

            // 3 � Update last-login timestamp
            await _userService.UpdateLastLoginAsync(user.UId);

            // 4 � Issue JWT in HttpOnly cookie
            var expiryMins = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 30;
            var token      = _authService.GenerateJwtToken(user);

            Response.Cookies.Append(CookieName, token, new CookieOptions
            {
                HttpOnly = true,
                Secure   = true,
                SameSite = SameSiteMode.Lax,
                Expires  = DateTimeOffset.UtcNow.AddMinutes(expiryMins),
                Path     = "/"
            });

            _logger.LogInformation("User {UserId} logged in with role {Role}.", user.UserId, user.Role);

            return Ok(new AuthResponse(true, "Login successful.", ToDto(user), expiryMins * 60));
        }

        // -- POST /api/auth/logout --------------------------------------------
        /// <summary>Clears the auth cookie and ends the session.</summary>
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete(CookieName, new CookieOptions
            {
                HttpOnly = true, Secure = true,
                SameSite = SameSiteMode.Lax, Path = "/"
            });
            return Ok(new { Message = "Logged out successfully." });
        }

        // -- GET /api/auth/me -------------------------------------------------
        /// <summary>
        /// Returns the current user from the JWT cookie.
        /// Called by the SPA on every page refresh to restore React context.
        /// </summary>
        [HttpGet("me")]
        [Authorize]
        [ProducesResponseType(typeof(AuthResponse), 200)]
        [ProducesResponseType(401)]
        public IActionResult Me()
        {
            var uid    = User.FindFirstValue(JwtRegisteredClaimNames.Sub)   ?? string.Empty;
            var email  = User.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty;
            var name   = User.FindFirstValue(JwtRegisteredClaimNames.Name)  ?? string.Empty;
            var userId = User.FindFirstValue("userId") ?? string.Empty;
            var role   = User.FindFirstValue("role")   ?? string.Empty;
            var status = User.FindFirstValue("status") ?? string.Empty;

            int? remaining = null;
            if (long.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Exp), out var expUnix))
            {
                var secs = (int)(DateTimeOffset.FromUnixTimeSeconds(expUnix) - DateTimeOffset.UtcNow).TotalSeconds;
                remaining = secs > 0 ? secs : 0;
            }

            return Ok(new AuthResponse(true, null, new AuthUserDto(uid, userId, name, email, role, status), remaining));
        }

        // -- POST /api/auth/validate-email ------------------------------------
        /// <summary>
        /// Checks whether an email belongs to an allowed organisation domain.
        /// Used by the registration form for real-time feedback (no auth required).
        /// </summary>
        [HttpPost("validate-email")]
        [ProducesResponseType(200)]
        [ProducesResponseType(400)]
        public IActionResult ValidateEmail([FromBody] ValidateEmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { valid = false, message = "Email is required." });

            if (!_config.GetValue<bool>("Registration:EnableEmailValidation", false))
                return Ok(new { valid = true, message = "Email accepted." });

            var allowedDomains = _config.GetSection("Registration:AllowedEmailDomains")
                .Get<string[]>() ?? [];

            var atIndex = request.Email.IndexOf('@');
            var domain  = atIndex >= 0 ? request.Email[(atIndex + 1)..].ToLowerInvariant() : string.Empty;

            var isValid = allowedDomains.Length == 0 ||
                          allowedDomains.Any(d => d.Equals(domain, StringComparison.OrdinalIgnoreCase));

            return Ok(new
            {
                valid   = isValid,
                message = isValid
                    ? "Email is from a recognized organisation domain."
                    : "This email is not from a recognized organisation domain. Please use your company email address.",
            });
        }

        // -- POST /api/auth/register ------------------------------------------
        /// <summary>
        /// Self-registration: saves user as Inactive with default password.
        /// An admin must approve the account before the user can log in.
        /// </summary>
        [HttpPost("register")]
        [ProducesResponseType(typeof(AuthResponse), 201)]
        [ProducesResponseType(typeof(AuthResponse), 400)]
        [ProducesResponseType(typeof(AuthResponse), 409)]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserId) ||
                string.IsNullOrWhiteSpace(request.UserName) ||
                string.IsNullOrWhiteSpace(request.EmailId))
                return BadRequest(new AuthResponse(false, "User ID, Full Name and Email are required.", null));

            // ── Organisation email domain check ───────────────────────────────
            if (_config.GetValue<bool>("Registration:EnableEmailValidation", false))
            {
                var allowedDomains = _config.GetSection("Registration:AllowedEmailDomains")
                    .Get<string[]>() ?? [];

                var atIndex = request.EmailId.IndexOf('@');
                var domain  = atIndex >= 0 ? request.EmailId[(atIndex + 1)..].ToLowerInvariant() : string.Empty;

                var domainAllowed = allowedDomains.Length == 0 ||
                                    allowedDomains.Any(d => d.Equals(domain, StringComparison.OrdinalIgnoreCase));

                if (!domainAllowed)
                {
                    _logger.LogWarning("Registration blocked for {Email}: domain not in allowed list.", request.EmailId);
                    return BadRequest(new AuthResponse(false,
                        "This email is not from a recognized organisation domain. Please use your company email address.", null));
                }
            }

            // ── Duplicate username check ──────────────────────────────────────
            var existing = await _userService.GetByUserIdAsync(request.UserId.Trim());
            if (existing is not null)
                return Conflict(new AuthResponse(false, "This username is already taken. Please choose a different one.", null));

            // ── Duplicate email check ─────────────────────────────────────────
            var emailTaken = await _db.Users.AnyAsync(u => u.EmailId == request.EmailId.Trim());
            if (emailTaken)
                return Conflict(new AuthResponse(false, "An account with this email address already exists.", null));

            var validRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "AVP_User", "WGDE_User", "Viewer" };

            var user = new User
            {
                UId         = Guid.NewGuid().ToString("N")[..10].ToUpper(),
                UserId      = request.UserId.Trim(),
                UserName    = request.UserName.Trim(),
                EmailId     = request.EmailId.Trim(),
                Role        = validRoles.Contains(request.Role ?? "") ? request.Role : "Viewer",
                Status      = "Inactive",
                Password    = PasswordHasher.Hash("Pass@May2026"),
                CreatedDate = DateTime.UtcNow,
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Self-registration: {UserId} ({Email}) — pending admin approval.", user.UserId, user.EmailId);
            return StatusCode(201, new AuthResponse(true,
                "Registration successful. Your account is pending admin approval. You will be able to log in with the default password once approved.",
                ToDto(user)));
        }

        // -- POST /api/auth/bootstrap -----------------------------------------
        /// <summary>
        /// ONE-TIME endpoint: creates the very first Admin user when the Users
        /// table is completely empty. Automatically disabled once any user exists.
        /// </summary>
        [HttpPost("bootstrap")]
        [ProducesResponseType(typeof(AuthResponse), 201)]
        [ProducesResponseType(typeof(AuthResponse), 400)]
        [ProducesResponseType(409)]
        public async Task<IActionResult> Bootstrap([FromBody] CreateUserRequest request)
        {
            // Guard: only available when table is empty
            if (await _db.Users.AnyAsync())
                return Conflict(new { Message = "Bootstrap is disabled � users already exist. Contact your administrator." });

            if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.UserName))
                return BadRequest(new AuthResponse(false, "UserId and UserName are required.", null));

            var validRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Admin", "AVP_Admin", "WGDE_Admin", "AVP_User", "WGDE_User", "Viewer" };

            var user = new User
            {
                UId         = Guid.NewGuid().ToString("N")[..10].ToUpper(),
                UserId      = request.UserId.Trim(),
                UserName    = request.UserName.Trim(),
                EmailId     = request.EmailId.Trim(),
                Role        = validRoles.Contains(request.Role) ? request.Role : "Admin",
                Status      = "Active",
                CreatedDate = DateTime.UtcNow,
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Bootstrap: first user created � {UserId} ({Role}).", user.UserId, user.Role);
            return StatusCode(201, new AuthResponse(true, "Bootstrap user created successfully.", ToDto(user)));
        }

        // -- GET /api/auth/microsoft/admin-consent ----------------------------
        /// <summary>
        /// ONE-TIME endpoint: an Azure AD admin visits this URL to grant
        /// organisation-wide consent for the app. After consent is granted,
        /// regular users can sign in via /microsoft/login without seeing a
        /// consent prompt.
        /// </summary>
        [HttpGet("microsoft/admin-consent")]
        [AllowAnonymous]
        public IActionResult MicrosoftAdminConsent()
        {
            var tenantId    = _config["AzureAd:TenantId"] ?? throw new InvalidOperationException("AzureAd:TenantId not configured.");
            var clientId    = _config["AzureAd:ClientId"] ?? throw new InvalidOperationException("AzureAd:ClientId not configured.");
            var frontendUrl = _config["AzureAd:FrontendUrl"] ?? "https://localhost:52648";

            // Microsoft's dedicated admin-consent endpoint (not the standard auth endpoint)
            var consentUrl =
                $"https://login.microsoftonline.com/{tenantId}/adminconsent" +
                $"?client_id={Uri.EscapeDataString(clientId)}" +
                $"&redirect_uri={Uri.EscapeDataString($"{frontendUrl}/")}" +
                $"&state=admin_consent_done";

            return Redirect(consentUrl);
        }

        // -- GET /api/auth/microsoft/login ------------------------------------
        /// <summary>
        /// Starts the Microsoft OAuth2 Authorization Code flow.
        /// Redirects the browser to the Microsoft login page.
        /// </summary>
        [HttpGet("microsoft/login")]
        [AllowAnonymous]
        public IActionResult MicrosoftLogin()
        {
            var tenantId    = _config["AzureAd:TenantId"]    ?? throw new InvalidOperationException("AzureAd:TenantId not configured.");
            var clientId    = _config["AzureAd:ClientId"]    ?? throw new InvalidOperationException("AzureAd:ClientId not configured.");
            var redirectUri = _config["AzureAd:RedirectUri"] ?? throw new InvalidOperationException("AzureAd:RedirectUri not configured.");

            // Random state value stored in cookie to prevent CSRF attacks
            var state = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
            Response.Cookies.Append("oauth_state", state, new CookieOptions
            {
                HttpOnly = true,
                Secure   = true,
                SameSite = SameSiteMode.Lax,
                Expires  = DateTimeOffset.UtcNow.AddMinutes(10),
                Path     = "/"
            });

            var authUrl =
                $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize" +
                $"?client_id={Uri.EscapeDataString(clientId)}" +
                $"&response_type=code" +
                $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                $"&scope={Uri.EscapeDataString("openid profile email")}" +
                $"&state={Uri.EscapeDataString(state)}" +
                $"&response_mode=query" +
                $"&prompt=select_account";

            return Redirect(authUrl);
        }

        // -- GET /api/auth/microsoft/callback ---------------------------------
        /// <summary>
        /// Microsoft OAuth2 callback: exchanges the auth code for an ID token,
        /// resolves the user in the DB, and issues a local JWT cookie.
        /// </summary>
        [HttpGet("microsoft/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> MicrosoftCallback(
            [FromQuery] string? code,
            [FromQuery] string? state,
            [FromQuery] string? error,
            [FromQuery(Name = "error_description")] string? errorDescription)
        {
            var frontendUrl = _config["AzureAd:FrontendUrl"] ?? "https://localhost:52646";

            // ── Error from Microsoft ──────────────────────────────────────────
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogWarning("Microsoft OAuth error: {Error} — {Desc}", error, errorDescription);
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");
            }

            if (string.IsNullOrEmpty(code))
                return Redirect($"{frontendUrl}/?ms_error=no_code");

            // ── CSRF: validate state ──────────────────────────────────────────
            var storedState = Request.Cookies["oauth_state"];
            Response.Cookies.Delete("oauth_state", new CookieOptions { Path = "/" });

            if (string.IsNullOrEmpty(storedState) || storedState != state)
            {
                _logger.LogWarning("Microsoft OAuth: state mismatch (CSRF protection triggered).");
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");
            }

            // ── Exchange authorization code for tokens ────────────────────────
            var tenantId     = _config["AzureAd:TenantId"];
            var clientId     = _config["AzureAd:ClientId"];
            var clientSecret = _config["AzureAd:ClientSecret"];
            var redirectUri  = _config["AzureAd:RedirectUri"];

            using var http = new HttpClient();
            var tokenRes = await http.PostAsync(
                $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"]    = "authorization_code",
                    ["client_id"]     = clientId!,
                    ["client_secret"] = clientSecret!,
                    ["code"]          = code,
                    ["redirect_uri"]  = redirectUri!,
                    ["scope"]         = "openid profile email",
                }));

            if (!tokenRes.IsSuccessStatusCode)
            {
                _logger.LogError("Microsoft OAuth: token exchange failed ({Status}).", tokenRes.StatusCode);
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");
            }

            // ── Extract email & name from the ID token ────────────────────────
            var tokenJson = await tokenRes.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(tokenJson);

            if (!doc.RootElement.TryGetProperty("id_token", out var idTokenEl))
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");

            var idToken = idTokenEl.GetString();
            if (string.IsNullOrEmpty(idToken))
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");

            // Read claims from the ID token (we trust Microsoft's token; state validates integrity)
            var jwtHandler = new JwtSecurityTokenHandler();
            var jwt        = jwtHandler.ReadJwtToken(idToken);

            var email = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value
                     ?? jwt.Claims.FirstOrDefault(c => c.Type == "preferred_username")?.Value;
            var name  = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value;

            if (string.IsNullOrEmpty(email))
            {
                _logger.LogWarning("Microsoft OAuth: ID token contained no email or preferred_username claim.");
                return Redirect($"{frontendUrl}/?ms_error=auth_failed");
            }

            // ── Resolve user in the application database ──────────────────────
            var user = await _db.Users.FirstOrDefaultAsync(u =>
                u.EmailId == email || u.UserId == email);

            if (user is null)
            {
                // Auto-register as Inactive — admin must approve before first login
                user = new User
                {
                    UId         = Guid.NewGuid().ToString("N")[..10].ToUpper(),
                    UserId      = email,
                    UserName    = name ?? email,
                    EmailId     = email,
                    Role        = "Viewer",
                    Status      = "Inactive",
                    Password    = PasswordHasher.Hash("Pass@May2026"),
                    CreatedDate = DateTime.UtcNow,
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Microsoft SSO: auto-registered {Email} — pending admin approval.", email);
                return Redirect($"{frontendUrl}/?ms_error=pending_approval");
            }

            if (!string.Equals(user.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Microsoft SSO: login blocked for {Email} — status is {Status}.", email, user.Status);
                return Redirect($"{frontendUrl}/?ms_error=account_inactive");
            }

            // ── Issue local JWT cookie and redirect to dashboard ──────────────
            await _userService.UpdateLastLoginAsync(user.UId);

            var expiryMins = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 30;
            var token      = _authService.GenerateJwtToken(user);

            Response.Cookies.Append(CookieName, token, new CookieOptions
            {
                HttpOnly = true,
                Secure   = true,
                SameSite = SameSiteMode.Lax,
                Expires  = DateTimeOffset.UtcNow.AddMinutes(expiryMins),
                Path     = "/"
            });

            _logger.LogInformation("Microsoft SSO: {Email} logged in as {Role}.", email, user.Role);
            return Redirect($"{frontendUrl}/dashboard");
        }

        private static AuthUserDto ToDto(User u) =>
            new(u.UId, u.UserId, u.UserName, u.EmailId, u.Role, u.Status);
    }
}
