USE [master]
GO
/****** Object:  Database [RBT]    Script Date: 5/26/2026 10:22:07 AM ******/
CREATE DATABASE [RBT]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'RBT', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL17.LOCALDEV\MSSQL\DATA\RBT.mdf' , SIZE = 73728KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'RBT_log', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL17.LOCALDEV\MSSQL\DATA\RBT_log.ldf' , SIZE = 73728KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT, LEDGER = OFF
GO
ALTER DATABASE [RBT] SET COMPATIBILITY_LEVEL = 170
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [RBT].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [RBT] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [RBT] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [RBT] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [RBT] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [RBT] SET ARITHABORT OFF 
GO
ALTER DATABASE [RBT] SET AUTO_CLOSE ON 
GO
ALTER DATABASE [RBT] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [RBT] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [RBT] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [RBT] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [RBT] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [RBT] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [RBT] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [RBT] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [RBT] SET  ENABLE_BROKER 
GO
ALTER DATABASE [RBT] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [RBT] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [RBT] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [RBT] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [RBT] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [RBT] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [RBT] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [RBT] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [RBT] SET  MULTI_USER 
GO
ALTER DATABASE [RBT] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [RBT] SET DB_CHAINING OFF 
GO
ALTER DATABASE [RBT] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [RBT] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [RBT] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [RBT] SET OPTIMIZED_LOCKING = OFF 
GO
ALTER DATABASE [RBT] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [RBT] SET QUERY_STORE = ON
GO
ALTER DATABASE [RBT] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [RBT]
GO
/****** Object:  Table [dbo].[checklist_Master]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[checklist_Master](
	[Uid] [nvarchar](100) NULL,
	[ChkId] [varchar](100) NULL,
	[CheckPointS] [varchar](4000) NULL,
	[CheckpointDesc] [varchar](4000) NULL,
	[Department] [nvarchar](200) NULL,
	[status] [varchar](100) NULL,
	[Mandatory] [varchar](10) NULL,
	[Zone] [varchar](255) NULL,
	[Station] [varchar](255) NULL,
	[Owner] [varchar](255) NULL,
	[category] [varchar](255) NULL,
	[Area] [varchar](255) NULL,
	[material] [varchar](255) NULL,
	[CreatedBy] [varchar](255) NULL,
	[CreatedDate] [varchar](255) NULL,
	[ModifiedBy] [varchar](255) NULL,
	[ModifiedDate] [varchar](255) NULL,
	[flag1] [varchar](255) NULL,
	[flag2] [varchar](255) NULL,
	[flag3] [varchar](255) NULL,
	[RefDocument] [nvarchar](max) NULL,
	[Images] [nvarchar](max) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Checklists_Milestones]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Checklists_Milestones](
	[uid] [nvarchar](255) NULL,
	[chkId] [nvarchar](1000) NULL,
	[CheckPointS] [nvarchar](1000) NULL,
	[CheckpointDesc] [nvarchar](1000) NULL,
	[milestoneid] [nvarchar](1000) NULL,
	[milestone] [datetime] NULL,
	[NoofDays] [int] NULL,
	[status] [nvarchar](1000) NULL,
	[department] [nvarchar](1000) NULL,
	[CreatedBy] [nvarchar](1000) NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [nvarchar](1000) NULL,
	[ModifiedDate] [datetime] NULL,
	[flag1] [nvarchar](1000) NULL,
	[flag2] [nvarchar](1000) NULL,
	[flag3] [nvarchar](1000) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComponentMetadata]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComponentMetadata](
	[Ouid] [int] NULL,
	[ComponentName] [nvarchar](100) NULL,
	[ComponentCode] [nvarchar](100) NULL,
	[Activity] [nvarchar](200) NULL,
	[Action] [nvarchar](100) NULL,
	[Label] [nvarchar](100) NULL,
	[Parameter] [nvarchar](100) NULL,
	[ParameterCode] [nvarchar](100) NULL,
	[Status] [nvarchar](100) NULL,
	[CreatedBy] [nvarchar](255) NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [nvarchar](255) NULL,
	[ModifiedDate] [datetime] NULL,
	[Language] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[dmrs_Checklist]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dmrs_Checklist](
	[Uid] [nvarchar](100) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[Check_Point] [nvarchar](255) NULL,
	[MRS] [nvarchar](max) NULL,
	[Description] [nvarchar](max) NULL,
	[Source_Link] [nvarchar](255) NULL,
	[Zone] [nvarchar](255) NULL,
	[Stations] [nvarchar](255) NULL,
	[Owner] [nvarchar](255) NULL,
	[Sync1] [nvarchar](100) NULL,
	[Sync2] [nvarchar](100) NULL,
	[Sync3] [nvarchar](100) NULL,
	[Sync4] [nvarchar](100) NULL,
	[Sync5] [nvarchar](100) NULL,
	[PostSync5] [nvarchar](100) NULL,
	[MIMS_ID] [nvarchar](100) NULL,
	[Remarks] [nvarchar](500) NULL,
	[Sync1_Comments] [nvarchar](500) NULL,
	[Sync2_Comments] [nvarchar](500) NULL,
	[Sync3_Comments] [nvarchar](500) NULL,
	[Sync4_Comments] [nvarchar](500) NULL,
	[Sync5_Comments] [nvarchar](500) NULL,
	[ChangeManagement] [nvarchar](500) NULL,
	[Flag1] [nvarchar](100) NULL,
	[Flag2] [nvarchar](100) NULL,
	[Flag3] [nvarchar](100) NULL,
	[Status] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [nvarchar](100) NULL,
	[ModifiedDate] [datetime] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Issue_list_checklist]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Issue_list_checklist](
	[Uid] [nvarchar](100) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[checlist_id] [nvarchar](255) NULL,
	[checklist_Desc] [nvarchar](max) NULL,
	[status] [nvarchar](100) NULL,
	[RH] [nvarchar](255) NULL,
	[LH] [nvarchar](255) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [nvarchar](100) NULL,
	[ModifiedDate] [datetime] NULL,
	[Remarks_RH] [nvarchar](max) NULL,
	[Remarks_LH] [nvarchar](max) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Issue_List_Docinfo]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Issue_List_Docinfo](
	[Uid] [nvarchar](100) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[Issue_title] [nvarchar](255) NULL,
	[Issue_description] [nvarchar](1000) NULL,
	[Initiator] [nvarchar](255) NULL,
	[Owner] [nvarchar](255) NULL,
	[Material] [nvarchar](255) NULL,
	[PDEF_Number_RH] [nvarchar](255) NULL,
	[PDEF_Number_LH] [nvarchar](255) NULL,
	[LA_Num_RH] [nvarchar](255) NULL,
	[LA_Num_LH] [nvarchar](255) NULL,
	[PA_Num_RH] [nvarchar](255) NULL,
	[PA_Num_LH] [nvarchar](255) NULL,
	[created_by] [nvarchar](255) NULL,
	[Derogation_sht_num] [nvarchar](255) NULL,
	[Date_Opened] [datetime] NULL,
	[Req_Completion_Date] [datetime] NULL,
	[Date_Closed] [datetime] NULL,
	[Created_date] [datetime] NULL,
	[Modified_by] [nvarchar](255) NULL,
	[Modified_date] [datetime] NULL,
	[status] [nvarchar](255) NULL,
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Issue_list_history]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Issue_list_history](
	[Uid] [nvarchar](100) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[Modified_by] [nvarchar](255) NULL,
	[Modified_date] [datetime] NULL,
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Issue_List_Partinfo]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Issue_List_Partinfo](
	[Uid] [nvarchar](100) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[Part_Revision_RH] [nvarchar](255) NULL,
	[Part_Revision_LH] [nvarchar](255) NULL,
	[Maturity_State_RH] [nvarchar](255) NULL,
	[Maturity_State_LH] [nvarchar](255) NULL,
	[Picture_rh] [nvarchar](max) NULL,
	[picture_lh] [nvarchar](max) NULL,
	[Proposals] [nvarchar](max) NULL,
	[Solutions] [nvarchar](max) NULL,
	[Comments_on_picture_LH] [nvarchar](max) NULL,
	[Comments_on_picture_RH] [nvarchar](max) NULL,
	[created_by] [nvarchar](255) NULL,
	[Created_date] [datetime] NULL,
	[Modified_by] [nvarchar](255) NULL,
	[Modified_date] [datetime] NULL,
	[status] [nvarchar](255) NULL,
	[flag1] [nvarchar](max) NULL,
	[flag2] [nvarchar](max) NULL,
	[flag3] [nvarchar](max) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Part_Milestones]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Part_Milestones](
	[Uid] [nvarchar](100) NOT NULL,
	[IssueNumber] [nvarchar](100) NULL,
	[ProjectUid] [nvarchar](100) NULL,
	[MilestoneName] [nvarchar](500) NULL,
	[MilestoneOrder] [int] NULL,
	[PlannedDate] [datetime2](7) NULL,
	[CompletedDate] [datetime2](7) NULL,
	[Status] [nvarchar](100) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedBy] [nvarchar](200) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedBy] [nvarchar](200) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Flag1] [nvarchar](200) NULL,
	[Flag2] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Project_issue_link]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Project_issue_link](
	[Uid] [nvarchar](100) NULL,
	[Project] [nvarchar](255) NULL,
	[Program] [nvarchar](255) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[Area] [nvarchar](255) NULL,
	[Plant] [nvarchar](255) NULL,
	[Plant_year] [nvarchar](255) NULL,
	[Zone] [nvarchar](255) NULL,
	[Issue_number] [nvarchar](255) NULL,
	[Part_number_RH] [nvarchar](255) NULL,
	[Part_number_LH] [nvarchar](255) NULL,
	[created_by] [nvarchar](255) NULL,
	[Created_date] [datetime] NULL,
	[Modified_by] [nvarchar](255) NULL,
	[Modified_date] [datetime] NULL,
	[status] [nvarchar](255) NULL,
	[flag1] [nvarchar](max) NULL,
	[flag2] [nvarchar](max) NULL,
	[flag3] [nvarchar](max) NULL,
	[Part_Description] [nvarchar](500) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Project_Milestones]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Project_Milestones](
	[Uid] [nvarchar](100) NOT NULL,
	[ProjectUid] [nvarchar](100) NULL,
	[MilestoneName] [nvarchar](500) NULL,
	[MilestoneOrder] [int] NULL,
	[PlannedDate] [datetime2](7) NULL,
	[Status] [nvarchar](100) NULL,
	[Department] [nvarchar](100) NULL,
	[AvpCompletedDate] [datetime2](7) NULL,
	[WgdeCompletedDate] [datetime2](7) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedBy] [nvarchar](200) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedBy] [nvarchar](200) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Flag1] [nvarchar](200) NULL,
	[Flag2] [nvarchar](200) NULL,
	[Flag3] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Projects]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Projects](
	[Uid] [nvarchar](100) NULL,
	[Project] [nvarchar](255) NULL,
	[Program] [nvarchar](255) NULL,
	[PartNumber] [nvarchar](255) NULL,
	[PartName] [nvarchar](255) NULL,
	[Area] [nvarchar](255) NULL,
	[Plant] [nvarchar](255) NULL,
	[Plant_year] [nvarchar](255) NULL,
	[Zone] [nvarchar](255) NULL,
	[Assy_Name] [nvarchar](255) NULL,
	[Category] [nvarchar](255) NULL,
	[No_of_issues] [int] NULL,
	[created_by] [nvarchar](255) NULL,
	[Created_date] [datetime] NULL,
	[Modified_by] [nvarchar](255) NULL,
	[Modified_date] [datetime] NULL,
	[status] [nvarchar](255) NULL,
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 5/26/2026 10:22:08 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UId] [nvarchar](200) NULL,
	[UserId] [nvarchar](255) NULL,
	[UserName] [nvarchar](255) NULL,
	[Password] [nvarchar](255) NULL,
	[EmailId] [nvarchar](255) NULL,
	[Role] [nvarchar](200) NULL,
	[Status] [nvarchar](255) NULL,
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL,
	[CreatedDate] [datetime] NULL,
	[Lastlogin] [datetime] NULL
) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ChecklistMaster_Department]    Script Date: 5/26/2026 10:22:08 AM ******/
CREATE NONCLUSTERED INDEX [IX_ChecklistMaster_Department] ON [dbo].[checklist_Master]
(
	[Department] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ChecklistMaster_Status]    Script Date: 5/26/2026 10:22:08 AM ******/
CREATE NONCLUSTERED INDEX [IX_ChecklistMaster_Status] ON [dbo].[checklist_Master]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PartMilestones_IssueNumber]    Script Date: 5/26/2026 10:22:08 AM ******/
CREATE NONCLUSTERED INDEX [IX_PartMilestones_IssueNumber] ON [dbo].[Part_Milestones]
(
	[IssueNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PartMilestones_ProjectUid]    Script Date: 5/26/2026 10:22:08 AM ******/
CREATE NONCLUSTERED INDEX [IX_PartMilestones_ProjectUid] ON [dbo].[Part_Milestones]
(
	[ProjectUid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ProjectMilestones_ProjectUid]    Script Date: 5/26/2026 10:22:08 AM ******/
CREATE NONCLUSTERED INDEX [IX_ProjectMilestones_ProjectUid] ON [dbo].[Project_Milestones]
(
	[ProjectUid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
USE [master]
GO
ALTER DATABASE [RBT] SET  READ_WRITE 
GO
