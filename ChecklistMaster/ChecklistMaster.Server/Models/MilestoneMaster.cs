using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Milestone_Master")]
    public class MilestoneMaster
    {
        [Key]
        public string Uid { get; set; } = string.Empty;

        public string? MilestoneName { get; set; }
        public string? Description   { get; set; }

        /// <summary>Days after the previous milestone (or project creation for the first).</summary>
        public int? NoOfDays { get; set; }

        /// <summary>Display/sort order (1, 2, 3 …).</summary>
        public int? MilestoneOrder { get; set; }

        public string? Status { get; set; }

        public string?   CreatedBy    { get; set; }
        public DateTime? CreatedDate  { get; set; }
        public string?   ModifiedBy   { get; set; }
        public DateTime? ModifiedDate { get; set; }

        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
    }
}
