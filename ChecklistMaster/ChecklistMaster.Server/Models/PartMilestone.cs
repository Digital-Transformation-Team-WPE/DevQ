using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Part_Milestones")]
    public class PartMilestone
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? IssueNumber   { get; set; }
        public string? ProjectUid    { get; set; }
        public string? MilestoneName { get; set; }
        public int?    MilestoneOrder{ get; set; }
        public DateTime? PlannedDate   { get; set; }
        public DateTime? CompletedDate { get; set; }
        public string? Status    { get; set; }
        public string? Notes     { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate  { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
        [Column("Flag1")]
        public string? Department { get; set; }
        [Column("Flag2")]
        public string? Owner      { get; set; }
    }
}
