using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("dmrs_Checklist")]
    public class DmrsChecklist
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public string? Issue_number { get; set; }
        public string? Check_Point { get; set; }
        public string? MRS { get; set; }
        public string? Description { get; set; }
        public string? Source_Link { get; set; }
        public string? Zone { get; set; }
        public string? Stations { get; set; }
        public string? Owner { get; set; }
        public string? SyncData { get; set; }  // JSON: {"Milestone Name":"result|comment", ...}
        public string? MIMS_ID { get; set; }
        public string? Remarks { get; set; }
        public string? ChangeManagement { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
        public string? Status { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
