using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChecklistMaster.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMilestoneMaster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EventType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsGlobal = table.Column<bool>(type: "bit", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsRecurring = table.Column<bool>(type: "bit", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "checklist_Master",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ChkId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CheckPointS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CheckpointDesc = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Mandatory = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Station = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Owner = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Area = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Material = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RefDocument = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Images = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checklist_Master", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Checklists_Milestones",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ChkId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CheckPointS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CheckpointDesc = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Milestoneid = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Milestone = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NoofDays = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Checklists_Milestones", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "ComponentMetadata",
                columns: table => new
                {
                    Ouid = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ComponentName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ComponentCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Activity = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Parameter = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ParameterCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Language = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComponentMetadata", x => x.Ouid);
                });

            migrationBuilder.CreateTable(
                name: "dmrs_Checklist",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Check_Point = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MRS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Source_Link = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Stations = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Owner = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SyncData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MIMS_ID = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangeManagement = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dmrs_Checklist", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Issue_list_checklist",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    checlist_id = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    checklist_Desc = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Issue_list_checklist", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Issue_List_Docinfo",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Initiator = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Owner = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Material = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PDEF_Number_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PDEF_Number_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LA_Num_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LA_Num_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PA_Num_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PA_Num_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Derogation_sht_num = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Date_Opened = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Req_Completion_Date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Date_Closed = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Created_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Modified_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Issue_List_Docinfo", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Issue_list_history",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Issue_list_history", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Issue_List_Partinfo",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Part_Revision_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Part_Revision_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Maturity_State_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Maturity_State_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Picture_rh = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Picture_lh = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Proposals = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Solutions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Comments_on_picture_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Comments_on_picture_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Modified_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Issue_List_Partinfo", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Milestone_Master",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    MilestoneName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NoOfDays = table.Column<int>(type: "int", nullable: true),
                    MilestoneOrder = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Milestone_Master", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Part_Milestones",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IssueNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProjectUid = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MilestoneName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MilestoneOrder = table.Column<int>(type: "int", nullable: true),
                    PlannedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Part_Milestones", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Project_issue_link",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Project = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Program = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Area = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Plant = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Plant_year = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Issue_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Part_number_RH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Part_number_LH = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Part_Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Modified_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Project_issue_link", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Project_Milestones",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProjectUid = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MilestoneName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MilestoneOrder = table.Column<int>(type: "int", nullable: true),
                    PlannedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AvpCompletedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WgdeCompletedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Project_Milestones", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Uid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Project = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Program = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PartNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PartName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Area = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Plant = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Plant_year = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Assy_Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    No_of_issues = table.Column<int>(type: "int", nullable: true),
                    Created_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Created_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Modified_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Modified_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Uid);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Password = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EmailId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Role = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Flag3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Lastlogin = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarEvents");

            migrationBuilder.DropTable(
                name: "checklist_Master");

            migrationBuilder.DropTable(
                name: "Checklists_Milestones");

            migrationBuilder.DropTable(
                name: "ComponentMetadata");

            migrationBuilder.DropTable(
                name: "dmrs_Checklist");

            migrationBuilder.DropTable(
                name: "Issue_list_checklist");

            migrationBuilder.DropTable(
                name: "Issue_List_Docinfo");

            migrationBuilder.DropTable(
                name: "Issue_list_history");

            migrationBuilder.DropTable(
                name: "Issue_List_Partinfo");

            migrationBuilder.DropTable(
                name: "Milestone_Master");

            migrationBuilder.DropTable(
                name: "Part_Milestones");

            migrationBuilder.DropTable(
                name: "Project_issue_link");

            migrationBuilder.DropTable(
                name: "Project_Milestones");

            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
