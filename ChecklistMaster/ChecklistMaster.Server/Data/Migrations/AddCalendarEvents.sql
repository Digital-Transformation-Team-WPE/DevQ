-- ============================================================
-- Migration: Add CalendarEvents table
-- Database : rbt
-- Run on   : SQL Server (LOCALDEV instance or any target env)
-- ============================================================

USE [rbt];
GO

-- ── Create table ────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[CalendarEvents]')
      AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[CalendarEvents] (
        -- Primary key
        [Uid]          NVARCHAR(64)   NOT NULL,

        -- Event data
        [Title]        NVARCHAR(256)  NULL,
        [EventType]    NVARCHAR(64)   NULL,   -- Holiday | Vacation | NonWorking | WorkingDay | Milestone
        [StartDate]    DATETIME2(7)   NULL,
        [EndDate]      DATETIME2(7)   NULL,

        -- Scope
        [IsGlobal]     BIT            NULL    DEFAULT 1,   -- 1 = all users, 0 = personal
        [UserId]       NVARCHAR(128)  NULL,   -- NULL for global events; owner UserId for personal

        -- Filters
        [Department]   NVARCHAR(32)   NULL,   -- AVP | WGDE | NULL = all
        [IsRecurring]  BIT            NULL    DEFAULT 0,   -- 1 = repeats annually

        -- Notes
        [Notes]        NVARCHAR(1024) NULL,

        -- Audit
        [CreatedBy]    NVARCHAR(128)  NULL,
        [CreatedDate]  DATETIME2(7)   NULL,
        [ModifiedBy]   NVARCHAR(128)  NULL,
        [ModifiedDate] DATETIME2(7)   NULL,

        -- Flags (future use: colour override, linked project UID, etc.)
        [Flag1]        NVARCHAR(256)  NULL,
        [Flag2]        NVARCHAR(256)  NULL,

        CONSTRAINT [PK_CalendarEvents] PRIMARY KEY CLUSTERED ([Uid] ASC)
    );

    PRINT 'Table [CalendarEvents] created.';
END
ELSE
BEGIN
    PRINT 'Table [CalendarEvents] already exists – skipped.';
END
GO

-- ── Performance indexes ──────────────────────────────────────

-- Speed up the most common query: get events by user (global + personal)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CalendarEvents_IsGlobal_UserId'
      AND object_id = OBJECT_ID(N'[dbo].[CalendarEvents]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_CalendarEvents_IsGlobal_UserId]
        ON [dbo].[CalendarEvents] ([IsGlobal], [UserId]);
    PRINT 'Index IX_CalendarEvents_IsGlobal_UserId created.';
END
GO

-- Speed up date-range filtering (calendar month queries)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CalendarEvents_StartDate_EndDate'
      AND object_id = OBJECT_ID(N'[dbo].[CalendarEvents]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_CalendarEvents_StartDate_EndDate]
        ON [dbo].[CalendarEvents] ([StartDate], [EndDate])
        INCLUDE ([Title], [EventType], [IsGlobal], [UserId], [Department]);
    PRINT 'Index IX_CalendarEvents_StartDate_EndDate created.';
END
GO

-- ── Optional: seed public holidays for the current year ─────
-- Remove or comment this block if you prefer to add holidays via the UI.

DECLARE @Year NVARCHAR(4) = CAST(YEAR(GETDATE()) AS NVARCHAR(4));

-- Helper to build a UID-like key
DECLARE @Prefix NVARCHAR(8) = 'HOLIDAY0';

-- Insert a few representative holidays (ISO calendar, adjust to your locale)
INSERT INTO [dbo].[CalendarEvents]
    ([Uid],[Title],[EventType],[StartDate],[EndDate],[IsGlobal],[UserId],[Department],[IsRecurring],[Notes],[CreatedBy],[CreatedDate])
SELECT v.[Uid], v.[Title], 'Holiday',
       CAST(@Year + v.[MM_DD_Start] AS DATETIME2),
       CAST(@Year + v.[MM_DD_End]   AS DATETIME2),
       1, NULL, NULL, 1,
       'Auto-seeded public holiday', 'system', GETUTCDATE()
FROM (VALUES
    (NEWID(), 'New Year''s Day',       '-01-01', '-01-01'),
    (NEWID(), 'Republic Day',          '-01-26', '-01-26'),
    (NEWID(), 'Independence Day',      '-08-15', '-08-15'),
    (NEWID(), 'Gandhi Jayanti',        '-10-02', '-10-02'),
    (NEWID(), 'Christmas Day',         '-12-25', '-12-25')
) AS v([Uid],[Title],[MM_DD_Start],[MM_DD_End])
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[CalendarEvents]
    WHERE [Title] = v.[Title]
      AND YEAR([StartDate]) = YEAR(GETDATE())
);

PRINT 'Seed holidays inserted (if not already present).';
GO

PRINT '=== CalendarEvents migration complete ===';
GO
