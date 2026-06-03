using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Projects")]
    public class Project
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? ProjectName { get; set; }
        public string? Program { get; set; }
        public string? PartNumber { get; set; }
        public string? PartName { get; set; }
        public string? Area { get; set; }
        public string? Plant { get; set; }
        public string? Plant_year { get; set; }
        public string? Zone { get; set; }
        public string? Assy_Name { get; set; }
        public string? Category { get; set; }
        public int? No_of_issues { get; set; }
        public string? Created_by { get; set; }
        public DateTime? Created_date { get; set; }
        public string? Modified_by { get; set; }
        public DateTime? Modified_date { get; set; }
        public string? Status { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
    }
}
