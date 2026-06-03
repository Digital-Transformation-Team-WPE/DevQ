using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Issue_list_checklist")]
    public class IssueListChecklist
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public string? Issue_number { get; set; }
        public string? Checlist_id { get; set; }
        public string? Checklist_Desc { get; set; }
        public string? Status { get; set; }
        public string? RH { get; set; }
        public string? LH { get; set; }
        public string? Remarks_RH { get; set; }
        public string? Remarks_LH { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
