-- =============================================================================
-- SeedUsers.sql  -  ChecklistMaster initial Users seed
-- =============================================================================
-- HOW TO USE:
--   1. Replace every  <upn@yourdomain.com>  value with the actual Azure AD
--      UPN of each person (e.g. john.smith@stellantis.com).
--      The UserId column MUST match the Azure AD UPN exactly.
--   2. Run this script in SSMS against the [Digital] database.
-- =============================================================================

USE [Digital];
GO

-- Guard: only insert when the table is empty
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users])
BEGIN
    INSERT INTO [dbo].[Users]
        ([UId], [UserId], [UserName], [EmailId], [Role], [Status], [CreatedDate])
    VALUES
        (UPPER(LEFT(NEWID(), 10)), '<admin@yourdomain.com>',     'System Administrator', '<admin@yourdomain.com>',     'Admin',      'Active', GETUTCDATE()),
        (UPPER(LEFT(NEWID(), 10)), '<avpadmin@yourdomain.com>',  'AVP Administrator',    '<avpadmin@yourdomain.com>',  'AVP_Admin',  'Active', GETUTCDATE()),
        (UPPER(LEFT(NEWID(), 10)), '<wgteadmin@yourdomain.com>', 'WGDE Administrator',   '<wgteadmin@yourdomain.com>', 'WGDE_Admin', 'Active', GETUTCDATE()),
        (UPPER(LEFT(NEWID(), 10)), '<avpuser@yourdomain.com>',   'AVP User',             '<avpuser@yourdomain.com>',   'AVP_User',   'Active', GETUTCDATE()),
        (UPPER(LEFT(NEWID(), 10)), '<wgteuser@yourdomain.com>',  'WGDE User',            '<wgteuser@yourdomain.com>',  'WGDE_User',  'Active', GETUTCDATE()),
        (UPPER(LEFT(NEWID(), 10)), '<viewer@yourdomain.com>',    'Viewer',               '<viewer@yourdomain.com>',    'Viewer',     'Active', GETUTCDATE());

    PRINT 'Seed complete: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user(s) inserted.';
END
ELSE
BEGIN
    PRINT 'Skipped: Users table already has data.';
END
GO

-- Verify
SELECT [UId], [UserId], [UserName], [Role], [Status], [CreatedDate]
FROM   [dbo].[Users]
ORDER  BY [CreatedDate];
GO
