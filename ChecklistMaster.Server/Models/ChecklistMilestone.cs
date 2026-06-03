using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Checklists_Milestones")]
    public class ChecklistMilestone
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? ChkId { get; set; }
        public string? CheckPointS { get; set; }
        public string? CheckpointDesc { get; set; }
        public string? Milestoneid { get; set; }
        public DateTime? Milestone { get; set; }
        public int? NoofDays { get; set; }
        public string? Status { get; set; }
        public string? Department { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
    }
}
