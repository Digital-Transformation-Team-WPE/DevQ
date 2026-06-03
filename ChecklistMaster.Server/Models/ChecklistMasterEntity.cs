using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("checklist_Master")]
    public class ChecklistMasterEntity
    {
        [Key]
        public string? Uid { get; set; }
        public string? ChkId { get; set; }
        public string? CheckPointS { get; set; }
        public string? CheckpointDesc { get; set; }
        public string? Department { get; set; }
        public string? Status { get; set; }
        public string? Mandatory { get; set; }
        public string? Zone { get; set; }
        public string? Station { get; set; }
        public string? Owner { get; set; }
        public string? Category { get; set; }
        public string? Area { get; set; }
        public string? Material { get; set; }
        public string? CreatedBy { get; set; }
        public string? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public string? ModifiedDate { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }
        public string? RefDocument { get; set; }   // JSON: {fileName, data (base64 data-URL)}
        public string? Images      { get; set; }   // JSON array of base64 data-URL strings
    }
}
