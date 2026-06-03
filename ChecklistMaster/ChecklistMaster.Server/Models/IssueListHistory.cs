using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Issue_list_history")]
    public class IssueListHistory
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public string? Issue_number { get; set; }
        public string? Modified_by { get; set; }
        public DateTime? Modified_date { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
    }
}
