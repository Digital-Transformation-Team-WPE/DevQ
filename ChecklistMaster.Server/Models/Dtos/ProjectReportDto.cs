namespace ChecklistMaster.Server.Models.Dtos
{
    public class ProjectReportDto
    {
        public ProjectInfoDto           ProjectInfo { get; set; } = new();
        public List<MilestoneColumnDto> Milestones  { get; set; } = new();
        public List<DataPointDto>       DataPoints  { get; set; } = new();
        public List<PartTableRowDto>    PartsTable  { get; set; } = new();
        public SummaryKpiDto            Summary     { get; set; } = new();
    }

    public class ProjectInfoDto
    {
        public string Uid         { get; set; } = "";
        public string ProjectName { get; set; } = "";
        public string Program     { get; set; } = "";
        public string Plant       { get; set; } = "";
        public string PlantYear   { get; set; } = "";
        public string Zone        { get; set; } = "";
        public string Area        { get; set; } = "";
        public string Status      { get; set; } = "";
    }

    public class MilestoneColumnDto
    {
        public string    Name           { get; set; } = "";
        public DateTime? PlannedDate    { get; set; }
        public int?      WeekNumber     { get; set; }
        public int       RelativeWeek   { get; set; }
        public string    WeekLabel      { get; set; } = "";
        public int       MilestoneOrder { get; set; }
        public bool      IsSync         { get; set; }
    }

    public class DataPointDto
    {
        public string MilestoneName    { get; set; } = "";
        public int    MilestoneOrder   { get; set; }
        public int?   WeekNumber       { get; set; }
        public int    RelativeWeek     { get; set; }
        public string WeekLabel        { get; set; } = "";
        public int    TotalParts       { get; set; }
        public int    GreenCount       { get; set; }
        public int    YellowCount      { get; set; }
        public int    OrangeCount      { get; set; }
        public int    RedCount         { get; set; }
        public double ProjectGoPercent    { get; set; }
        public double ProjectGreenPercent { get; set; }
        public double TargetGreenPercent  { get; set; }
    }

    public class PartTableRowDto
    {
        public int    SNo                  { get; set; }
        public string Code                 { get; set; } = "";
        public string Program              { get; set; } = "";
        public string Project              { get; set; } = "";
        public string Plant                { get; set; } = "";
        public string Year                 { get; set; } = "";
        public string Milestone            { get; set; } = "";
        public string DepartmentAvp        { get; set; } = "";
        public string DepartmentWgde       { get; set; } = "";
        public string PilotAvp             { get; set; } = "";
        public string PilotWgde            { get; set; } = "";
        public string ValidationStatusAvp  { get; set; } = "";
        public string ValidationStatusWgde { get; set; } = "";
        public int    TotalChecksAvp       { get; set; }
        public int    TotalChecksWgde      { get; set; }
        public string IssuesAvp            { get; set; } = "";
        public string IssuesWgde           { get; set; } = "";
        public string StatusAvp            { get; set; } = "";
        public string StatusWgde           { get; set; } = "";
    }

    public class SummaryKpiDto
    {
        public int?   WeekOfSync           { get; set; }
        public int?   FirstWeekCotation    { get; set; }
        public int?   FirstWeekTargetGreen { get; set; }
        public double TargetPercent        { get; set; } = 85;
        public string SyncMilestoneName    { get; set; } = "";
        public int    TotalParts           { get; set; }
    }
}
