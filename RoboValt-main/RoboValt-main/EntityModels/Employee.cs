using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Robot_Program_Validation.Data
{
    [Table("Employee")]
    public class Employee
    {
        [Key]
        [MaxLength(64)]
        public string EmployeeId { get; set; } = default!;

        [MaxLength(256)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(64)]
        public string Role { get; set; } = "User"; // default

        [MaxLength(32)]
        public string Status { get; set; } = "Active"; // Active|Inactive

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
