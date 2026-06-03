namespace ChecklistMaster.Server.Models
{
    public record LoginRequest(string Username, string Password);

    public record ValidateEmailRequest(string Email);

    public record RegisterRequest(
        string UserId,
        string UserName,
        string EmailId,
        string? Role
    );

    public record CreateUserRequest(
        string UserId,
        string UserName,
        string EmailId,
        string Role
    );

    public record AuthUserDto(
        string  UId,
        string? UserId,
        string? UserName,
        string? EmailId,
        string? Role,
        string? Status
    );

    public record AuthResponse(
        bool        Success,
        string?     Message,
        AuthUserDto? User,
        int?        ExpiresInSeconds = null
    );

    public record ChangePasswordRequest(
        string CurrentPassword,
        string NewPassword
    );

    public record UpdateProfileRequest(
        string? UserName,
        string? EmailId
    );
}
