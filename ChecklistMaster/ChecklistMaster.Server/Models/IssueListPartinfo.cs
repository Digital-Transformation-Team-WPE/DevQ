using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Issue_List_Partinfo")]
    public class IssueListPartinfo
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public string? Issue_number { get; set; }
        public string? Part_Revision_RH { get; set; }
        public string? Part_Revision_LH { get; set; }
        public string? Maturity_State_RH { get; set; }
        public string? Maturity_State_LH { get; set; }
        public string? Picture_rh { get; set; }
        public string? Picture_lh { get; set; }
        public string? Proposals { get; set; }
        public string? Solutions { get; set; }
        public string? Comments_on_picture_LH { get; set; }
        public string? Comments_on_picture_RH { get; set; }
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
