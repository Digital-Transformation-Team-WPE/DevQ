-- ============================================================================
-- Robot Program Validation Database Setup Script
-- Database: Robot Program Validation
-- ============================================================================

-- Create EmployeeTable
CREATE TABLE [dbo].[EmployeeTable] (
    [Id] INT NOT NULL PRIMARY KEY,
    [Name] VARCHAR(MAX),
    [EmployeeId] VARCHAR(MAX),
    [Role] VARCHAR(MAX),
    [Status] VARCHAR(MAX)
);

-- Create Robot Program Validation main table
CREATE TABLE [dbo].[Robot Program Validation] (
    [S.NO] INT,
    [Standard ] VARCHAR(MAX),
    [Document] VARCHAR(MAX),
    [Item] VARCHAR(MAX),
    [What to Check] NVARCHAR(50),
    [What to Validate ] NVARCHAR(50),
    [Files to check] VARCHAR(MAX),
    [How to check] VARCHAR(MAX),
    [Output of the Item] VARCHAR(MAX),
    [Wordings] VARCHAR(MAX),
    [Status] NVARCHAR(50),
    [Modified by] CHAR(10),
    [Validation Summary] NVARCHAR(1000)
);

-- Create robo_standard_types table (for Traj_Comment_std validation)
CREATE TABLE [dbo].[robo_standard_types] (
    [Id] INT PRIMARY KEY IDENTITY(1,1),
    [category] INT NOT NULL,
    [app_nam] VARCHAR(255),
    [Comment of working trajectory  (I6s1#38)] VARCHAR(MAX),
    [CreatedDate] DATETIME,
    [UpdatedDate] DATETIME,
    [CreatedBy] VARCHAR(100),
    [UpdatedBy] VARCHAR(100)
);

-- Create index for robo_standard_types for faster queries
CREATE INDEX IX_robo_standard_types_category ON [dbo].[robo_standard_types]([category]);
CREATE INDEX IX_robo_standard_types_app_nam ON [dbo].[robo_standard_types]([app_nam]);

-- Example: Create a sample Master DB table (replace PROJECT and REVISION with actual names)
-- This is a template - you'll create similar tables for each project/revision combination
CREATE TABLE [dbo].[MASTER_DB] (
    [ID] FLOAT NOT NULL PRIMARY KEY,
    [Standard] NVARCHAR(255),
    [Document] NVARCHAR(255),
    [Item ID] NVARCHAR(255),
    [Sub Item ID] FLOAT,
    [Checkpoint Description] NVARCHAR(255),
    [Files to check] NVARCHAR(255),
    [Search Criteria] NVARCHAR(255),
    [Expected Output] NVARCHAR(255),
    [Files Requiring Verification] NVARCHAR(255),
    [What to Check] NVARCHAR(255),
    [How to Check] NVARCHAR(255),
    [Logic] NVARCHAR(255),
    [Status] NVARCHAR(255),
    [Validation Summary] NVARCHAR(MAX),
    [CreatedDate] DATETIME DEFAULT GETDATE(),
    [UpdatedDate] DATETIME DEFAULT GETDATE(),
    [CreatedBy] VARCHAR(100),
    [UpdatedBy] VARCHAR(100)
);

-- Example: Seed some sample data into robo_standard_types
INSERT INTO [dbo].[robo_standard_types] 
([category], [app_nam], [Comment of working trajectory  (I6s1#38)], [CreatedDate])
VALUES 
(1, 'PLC_APP', 'T_N°Veh_MDPX_Y', GETDATE()),
(1, 'PLC_APP', 'T_N°Veh_GX_Y', GETDATE()),
(1, 'PLC_APP', 'T_N°Veh_MDP_TAB', GETDATE());

-- ============================================================================
-- INSTRUCTIONS FOR CREATING PROJECT-SPECIFIC TABLES
-- ============================================================================
-- For each project/revision combination, create a new table using this template:
--
-- Example: For project "TestProject" and revision "v1"
-- CREATE TABLE [dbo].[TestProject_v1] (
--     [ID] FLOAT NOT NULL PRIMARY KEY,
--     [Standard] NVARCHAR(255),
--     [Document] NVARCHAR(255),
--     [Item ID] NVARCHAR(255),
--     [Sub Item ID] FLOAT,
--     [Checkpoint Description] NVARCHAR(255),
--     [Files to check] NVARCHAR(255),
--     [Search Criteria] NVARCHAR(255),
--     [Expected Output] NVARCHAR(255),
--     [Files Requiring Verification] NVARCHAR(255),
--     [What to Check] NVARCHAR(255),
--     [How to Check] NVARCHAR(255),
--     [Logic] NVARCHAR(255),
--     [Status] NVARCHAR(255),
--     [Validation Summary] NVARCHAR(MAX),
--     [CreatedDate] DATETIME DEFAULT GETDATE(),
--     [UpdatedDate] DATETIME DEFAULT GETDATE(),
--     [CreatedBy] VARCHAR(100),
--     [UpdatedBy] VARCHAR(100)
-- );
-- ============================================================================
