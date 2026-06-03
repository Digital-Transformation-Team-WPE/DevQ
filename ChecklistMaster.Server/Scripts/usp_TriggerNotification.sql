-- ============================================================
-- Stored Procedure: usp_TriggerNotification
-- Purpose : Builds and sends an HTML notification email via
--           SQL Server Database Mail whenever a project event
--           occurs (created, updated, status changed).
--
-- Parameters:
--   @EventType   : PROJECT_CREATED | PROJECT_UPDATED | STATUS_CHANGED
--   @EntityType  : Entity kind (e.g. 'Project')
--   @EntityId    : Primary key (Uid) of the entity
--   @TriggeredBy : UserId / display name of the acting user
--   @MailProfile : Database Mail profile name (default: RStudioMailProfile)
--
-- Prerequisites:
--   1. SQL Server Database Mail must be enabled and configured.
--   2. A mail profile named (default) 'RStudioMailProfile' must exist.
--      To create one: SQL Server Management Studio →
--        Management → Database Mail → Configure Database Mail.
-- ============================================================

CREATE OR ALTER PROCEDURE [dbo].[usp_TriggerNotification]
    @EventType   NVARCHAR(100),
    @EntityType  NVARCHAR(50),
    @EntityId    NVARCHAR(100),
    @TriggeredBy NVARCHAR(200),
    @MailProfile NVARCHAR(100) = N'RStudioMailProfile'
AS
BEGIN
    SET NOCOUNT ON;

    -- ── Project data ─────────────────────────────────────────────────
    DECLARE @ProjectName NVARCHAR(500);
    DECLARE @Program     NVARCHAR(200);
    DECLARE @Plant       NVARCHAR(200);
    DECLARE @PlantYear   NVARCHAR(50);
    DECLARE @Status      NVARCHAR(50);
    DECLARE @AvpOwner    NVARCHAR(200);   -- stored in Flag1
    DECLARE @WgdeOwner   NVARCHAR(200);   -- stored in Flag2
    DECLARE @Department  NVARCHAR(100);   -- stored in Flag3
    DECLARE @CreatedBy   NVARCHAR(200);

    SELECT
        @ProjectName = ProjectName,
        @Program     = Program,
        @Plant       = Plant,
        @PlantYear   = Plant_year,
        @Status      = Status,
        @AvpOwner    = Flag1,
        @WgdeOwner   = Flag2,
        @Department  = Flag3,
        @CreatedBy   = Created_by
    FROM dbo.Projects
    WHERE Uid = @EntityId;

    IF @ProjectName IS NULL
    BEGIN
        RAISERROR(N'usp_TriggerNotification: Project not found — EntityId=%s', 16, 1, @EntityId);
        RETURN;
    END

    -- ── Build recipient list ─────────────────────────────────────────
    DECLARE @Recipients NVARCHAR(MAX) = N'';

    -- AVP Owner → look up by UserName match in Users
    DECLARE @AvpEmail NVARCHAR(500);
    SELECT TOP 1 @AvpEmail = EmailId
    FROM dbo.Users
    WHERE UserName = @AvpOwner
      AND Role     = N'AVP_Admin'
      AND Status   = N'Active'
      AND EmailId IS NOT NULL
      AND LEN(EmailId) > 0;

    IF @AvpEmail IS NOT NULL
        SET @Recipients = @Recipients + @AvpEmail + N';';

    -- WGDE Owner → look up by UserName match
    DECLARE @WgdeEmail NVARCHAR(500);
    SELECT TOP 1 @WgdeEmail = EmailId
    FROM dbo.Users
    WHERE UserName = @WgdeOwner
      AND Role     = N'WGDE_Admin'
      AND Status   = N'Active'
      AND EmailId IS NOT NULL
      AND LEN(EmailId) > 0;

    IF @WgdeEmail IS NOT NULL
        SET @Recipients = @Recipients + @WgdeEmail + N';';

    -- All active Admins
    SELECT @Recipients = @Recipients + EmailId + N';'
    FROM dbo.Users
    WHERE Role   = N'Admin'
      AND Status = N'Active'
      AND EmailId IS NOT NULL
      AND LEN(EmailId) > 0;

    -- Strip trailing semicolon
    SET @Recipients = RTRIM(@Recipients);
    IF LEN(@Recipients) > 0 AND RIGHT(@Recipients, 1) = N';'
        SET @Recipients = LEFT(@Recipients, LEN(@Recipients) - 1);

    IF LEN(ISNULL(@Recipients, N'')) = 0
        RETURN; -- no recipients configured — exit gracefully

    -- ── Event label ──────────────────────────────────────────────────
    DECLARE @EventLabel NVARCHAR(100);
    SET @EventLabel = CASE @EventType
        WHEN N'PROJECT_CREATED' THEN N'New Project Created'
        WHEN N'PROJECT_UPDATED' THEN N'Project Updated'
        WHEN N'STATUS_CHANGED'  THEN N'Project Status Changed'
        ELSE @EventType
    END;

    -- ── Badge colour for event type ──────────────────────────────────
    DECLARE @BadgeColor NVARCHAR(20);
    SET @BadgeColor = CASE @EventType
        WHEN N'PROJECT_CREATED' THEN N'#27ae60'
        WHEN N'PROJECT_UPDATED' THEN N'#e67e22'
        WHEN N'STATUS_CHANGED'  THEN N'#e53935'
        ELSE N'#3f51b5'
    END;

    -- ── Subject ──────────────────────────────────────────────────────
    DECLARE @Subject NVARCHAR(500);
    SET @Subject = N'[R Studio] ' + @EventLabel + N' — ' + @ProjectName;

    -- ── HTML Body ────────────────────────────────────────────────────
    DECLARE @Body NVARCHAR(MAX);
    SET @Body =
        N'<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fb;">' +
        N'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">' +
        N'<tr><td align="center">' +
        N'<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">' +

        -- Header
        N'<tr><td style="background:#1a237e;padding:20px 28px;">' +
        N'<span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">R Studio</span>' +
        N'<span style="color:#90caf9;font-size:13px;margin-left:12px;">ChecklistMaster</span>' +
        N'</td></tr>' +

        -- Event badge
        N'<tr><td style="padding:20px 28px 8px;">' +
        N'<span style="display:inline-block;background:' + @BadgeColor + N';color:#fff;font-size:12px;font-weight:700;' +
        N'padding:5px 14px;border-radius:20px;letter-spacing:.5px;">' + @EventLabel + N'</span>' +
        N'</td></tr>' +

        -- Project name
        N'<tr><td style="padding:4px 28px 16px;">' +
        N'<h2 style="margin:0;font-size:18px;color:#1a1a2e;">' + ISNULL(@ProjectName, N'—') + N'</h2>' +
        N'</td></tr>' +

        -- Details table
        N'<tr><td style="padding:0 28px 24px;">' +
        N'<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaf6;border-radius:8px;overflow:hidden;font-size:13px;">' +

        N'<tr style="background:#f8f9ff;">' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;width:38%;">Program</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@Program, N'—') + N'</td></tr>' +

        N'<tr>' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">Plant</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@Plant, N'—') + N'</td></tr>' +

        N'<tr style="background:#f8f9ff;">' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">Plant Year</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@PlantYear, N'—') + N'</td></tr>' +

        N'<tr>' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">Department</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@Department, N'—') + N'</td></tr>' +

        N'<tr style="background:#f8f9ff;">' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">Status</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@Status, N'—') + N'</td></tr>' +

        N'<tr>' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">AVP Owner</td>' +
        N'<td style="padding:10px 14px;color:#1565c0;font-weight:600;">' + ISNULL(@AvpOwner, N'—') + N'</td></tr>' +

        N'<tr style="background:#f8f9ff;">' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">WGDE Owner</td>' +
        N'<td style="padding:10px 14px;color:#6a1b9a;font-weight:600;">' + ISNULL(@WgdeOwner, N'—') + N'</td></tr>' +

        N'<tr>' +
        N'<td style="padding:10px 14px;color:#666;font-weight:700;">Action By</td>' +
        N'<td style="padding:10px 14px;color:#263238;">' + ISNULL(@TriggeredBy, N'—') + N'</td></tr>' +

        N'</table></td></tr>' +

        -- Footer
        N'<tr><td style="padding:16px 28px;border-top:1px solid #f0f2f8;">' +
        N'<p style="margin:0;font-size:11px;color:#aaa;">This is an automated notification from R Studio. Do not reply to this email.</p>' +
        N'</td></tr>' +

        N'</table></td></tr></table>' +
        N'</body></html>';

    -- ── Send via Database Mail ────────────────────────────────────────
    EXEC msdb.dbo.sp_send_dbmail
        @profile_name = @MailProfile,
        @recipients   = @Recipients,
        @subject      = @Subject,
        @body         = @Body,
        @body_format  = N'HTML';
END;
GO
