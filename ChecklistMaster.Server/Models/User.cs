using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Users")]
    public class User
    {
        [Key]
        public string UId { get; set; } = string.Empty;
        public string? UserId { get; set; }
        public string? UserName { get; set; }
        public string? Password { get; set; }
        public string? EmailId { get; set; }
        public string? Role { get; set; }
        public string? Status { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
        public DateTime? CreatedDate { get; set; }
        public DateTime? Lastlogin { get; set; }
    }
}
