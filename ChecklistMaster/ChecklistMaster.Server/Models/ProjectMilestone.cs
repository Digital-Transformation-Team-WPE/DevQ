using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Project_Milestones")]
    public class ProjectMilestone
    {
        [Key]
        public string Uid { get; set; } = string.Empty;

        /// <summary>FK to Projects.Uid — every milestone belongs to one project.</summary>
        public string? ProjectUid { get; set; }

        /// <summary>Display name for this milestone (e.g. "SOP", "DVP Freeze").</summary>
        public string? MilestoneName { get; set; }

        /// <summary>Sequence number used to order milestones within a project.</summary>
        public int? MilestoneOrder { get; set; }

        /// <summary>Planned / target completion date.</summary>
        public DateTime? PlannedDate { get; set; }

        /// <summary>Overall status: pending | in progress | completed.</summary>
        public string? Status { get; set; }

        /// <summary>Applicable department(s): AVP | WGDE | Common | AVP,WGDE.</summary>
        public string? Department { get; set; }

        /// <summary>Date the AVP department completed this milestone.</summary>
        public DateTime? AvpCompletedDate { get; set; }

        /// <summary>Date the WGDE department completed this milestone.</summary>
        public DateTime? WgdeCompletedDate { get; set; }

        /// <summary>Optional free-text notes.</summary>
        public string? Notes { get; set; }

        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }

        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
    }
}
