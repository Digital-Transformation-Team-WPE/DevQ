USE [RBT]
GO


/****** Object:  Table [dbo].[checklist_Master]    Script Date: 5/13/2026 3:18:43 PM ******/
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
	[flag3] [varchar](255) NULL
) ON [PRIMARY]
GO



/****** Object:  Table [dbo].[Checklists_Milestones]    Script Date: 5/13/2026 4:39:03 PM ******/
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

/****** Object:  Table [dbo].[ComponentMetadata]    Script Date: 5/13/2026 4:39:42 PM ******/
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

/****** Object:  Table [dbo].[dmrs_Checklist]    Script Date: 5/13/2026 4:39:57 PM ******/
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


/****** Object:  Table [dbo].[Issue_list_checklist]    Script Date: 5/13/2026 4:40:14 PM ******/
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
	[ModifiedDate] [datetime] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

USE [RBT]
GO

/****** Object:  Table [dbo].[Issue_List_Docinfo]    Script Date: 5/13/2026 4:40:33 PM ******/
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



/****** Object:  Table [dbo].[Issue_list_history]    Script Date: 5/13/2026 4:50:40 PM ******/
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


/****** Object:  Table [dbo].[Issue_List_Partinfo]    Script Date: 5/13/2026 4:50:50 PM ******/
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
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO


/****** Object:  Table [dbo].[Project_issue_link]    Script Date: 5/13/2026 4:51:03 PM ******/
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
	[flag1] [nvarchar](255) NULL,
	[flag2] [nvarchar](255) NULL,
	[flag3] [nvarchar](255) NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Projects]    Script Date: 5/13/2026 4:51:22 PM ******/
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



/****** Object:  Table [dbo].[Users]    Script Date: 5/13/2026 4:51:44 PM ******/
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

CREATE TABLE [dbo].[CalendarEvents](
	[Uid]          [nvarchar](100)  NULL,
	[Title]        [nvarchar](255)  NULL,
	[EventType]    [nvarchar](100)  NULL,
	[StartDate]    [datetime]       NULL,
	[EndDate]      [datetime]       NULL,
	[IsGlobal]     [bit]            NULL,
	[UserId]       [nvarchar](255)  NULL,
	[Department]   [nvarchar](100)  NULL,
	[IsRecurring]  [bit]            NULL,
	[Notes]        [nvarchar](1000) NULL,
	[CreatedBy]    [nvarchar](255)  NULL,
	[CreatedDate]  [datetime]       NULL,
	[ModifiedBy]   [nvarchar](255)  NULL,
	[ModifiedDate] [datetime]       NULL,
	[flag1]        [nvarchar](255)  NULL,
	[flag2]        [nvarchar](255)  NULL
) ON [PRIMARY]