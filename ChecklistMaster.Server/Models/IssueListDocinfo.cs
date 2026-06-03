using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    [Table("Issue_List_Docinfo")]
    public class IssueListDocinfo
    {
        [Key]
        public string Uid { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public string? Issue_number { get; set; }
        public string? Issue_title { get; set; }
        public string? Issue_description { get; set; }
        public string? Initiator { get; set; }
        public string? Owner { get; set; }
        public string? Material { get; set; }
        public string? PDEF_Number_RH { get; set; }
        public string? PDEF_Number_LH { get; set; }
        public string? LA_Num_RH { get; set; }
        public string? LA_Num_LH { get; set; }
        public string? PA_Num_RH { get; set; }
        public string? PA_Num_LH { get; set; }
        public string? Created_by { get; set; }
        public string? Derogation_sht_num { get; set; }
        public DateTime? Date_Opened { get; set; }
        public DateTime? Req_Completion_Date { get; set; }
        public DateTime? Date_Closed { get; set; }
        public DateTime? Created_date { get; set; }
        public string? Modified_by { get; set; }
        public DateTime? Modified_date { get; set; }
        public string? Status { get; set; }
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
        public string? Flag3 { get; set; }

        [Column("IssuRef_doc_No")]
        public string? IssuRefDocNo { get; set; }

        [Column("IssuRef_doc_desc")]
        public string? IssuRefDocDesc { get; set; }

        [Column("Issue_src_link")]
        public string? IssueSrcLink { get; set; }

        [Column("issue_Ref_doc_status")]
        public string? IssueRefDocStatus { get; set; }
    }
}
