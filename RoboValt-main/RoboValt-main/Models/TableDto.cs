namespace Robot_Program_Validation.Models
{
    public class TableDto
    {

        public class TablePayload
        {
            public List<string> Header { get; set; } = new();
            public List<List<string>> Rows { get; set; } = new();
        }


    }
}
