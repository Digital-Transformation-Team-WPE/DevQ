namespace Robot_Program_Validation.ViewModels
{
    public class AccessViewModel
    {
        public string? ActionType { get; set; } // "New" | "Existing"
        public string? EmployeeName { get; set; }
        public string EmployeeId { get; set; } = string.Empty;
        public string? Role { get; set; }      // Admin | User
        public string? Status { get; set; }    // Active | Inactive

        // For display after operation
        public string? CurrentRole { get; set; }
        public string? CurrentStatus { get; set; }

    }
}
