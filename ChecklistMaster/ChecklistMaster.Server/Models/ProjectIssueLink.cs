using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Project_issue_link")]
    public class ProjectIssueLink
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? Project { get; set; }
        public string? Program { get; set; }
        public string? PartNumber { get; set; }
        public string? Area { get; set; }
        public string? Plant { get; set; }
        public string? Plant_year { get; set; }
        public string? Zone { get; set; }
        public string? Issue_number { get; set; }
        [Column("Part_number_RH")]
        public string? Part_number_RH { get; set; }
        [Column("Part_number_LH")]
        public string? Part_number_LH { get; set; }
        [Column("Part_Description")]
        public string? Part_Description { get; set; }
        public string? Created_by { get; set; }
        public DateTime? Created_date { get; set; }
        public string? Modified_by { get; set; }
        public DateTime? Modified_date { get; set; }
        public string? Status { get; set; }
        public string? Flag1 { get; set; }
        [Column(TypeName = "nvarchar(max)")]
        public string? Flag2 { get; set; }
        [Column(TypeName = "nvarchar(max)")]
        public string? Flag3 { get; set; }
    }
}
