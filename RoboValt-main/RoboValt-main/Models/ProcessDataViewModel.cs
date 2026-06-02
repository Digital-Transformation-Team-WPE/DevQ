namespace Robot_Program_Validation.Models
{
  
    public class ProcessDataViewModel
    {
        public string Project { get; set; } = "";
        public string Revision { get; set; } = "";
        public string TableJson { get; set; } = "";
        public List<IFormFile>? Files { get; set; }
    }


}
