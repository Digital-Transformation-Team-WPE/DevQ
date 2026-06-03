using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("ComponentMetadata")]
    public class ComponentMetadata
    {
        [Key]
        public int Ouid { get; set; }
        public string? ComponentName { get; set; }
        public string? ComponentCode { get; set; }
        public string? Activity { get; set; }
        public string? Action { get; set; }
        public string? Label { get; set; }
        public string? Parameter { get; set; }
        public string? ParameterCode { get; set; }
        public string? Status { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public int? Language { get; set; }
    }
}
