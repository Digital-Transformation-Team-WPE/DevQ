using ChecklistMaster.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ChecklistMaster.Server.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(AppDbContext db, IConfiguration config, ILogger logger)
        {
            await EnsureTablesAsync(db, logger);
            await SeedUsersAsync(db, config, logger);
            await SeedComponentMetadataAsync(db, logger);
        }

        // ── DDL: create any missing tables ────────────────────────────────────
        private static async Task EnsureTablesAsync(AppDbContext db, ILogger logger)
        {
            const string sql = @"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Project_Milestones')
BEGIN
    CREATE TABLE Project_Milestones (
        Uid               NVARCHAR(100)  NOT NULL PRIMARY KEY,
        ProjectUid        NVARCHAR(100)  NULL,
        MilestoneName     NVARCHAR(500)  NULL,
        MilestoneOrder    INT            NULL,
        PlannedDate       DATETIME2      NULL,
        Status            NVARCHAR(100)  NULL,
        Department        NVARCHAR(100)  NULL,
        AvpCompletedDate  DATETIME2      NULL,
        WgdeCompletedDate DATETIME2      NULL,
        Notes             NVARCHAR(MAX)  NULL,
        CreatedBy         NVARCHAR(200)  NULL,
        CreatedDate       DATETIME2      NULL,
        ModifiedBy        NVARCHAR(200)  NULL,
        ModifiedDate      DATETIME2      NULL,
        Flag1             NVARCHAR(200)  NULL,
        Flag2             NVARCHAR(200)  NULL,
        Flag3             NVARCHAR(200)  NULL
    );
    CREATE INDEX IX_ProjectMilestones_ProjectUid ON Project_Milestones (ProjectUid);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Part_Milestones')
BEGIN
    CREATE TABLE Part_Milestones (
        Uid            NVARCHAR(100)  NOT NULL PRIMARY KEY,
        IssueNumber    NVARCHAR(100)  NULL,
        ProjectUid     NVARCHAR(100)  NULL,
        MilestoneName  NVARCHAR(500)  NULL,
        MilestoneOrder INT            NULL,
        PlannedDate    DATETIME2      NULL,
        CompletedDate  DATETIME2      NULL,
        Status         NVARCHAR(100)  NULL,
        Notes          NVARCHAR(MAX)  NULL,
        CreatedBy      NVARCHAR(200)  NULL,
        CreatedDate    DATETIME2      NULL,
        ModifiedBy     NVARCHAR(200)  NULL,
        ModifiedDate   DATETIME2      NULL,
        Flag1          NVARCHAR(200)  NULL,
        Flag2          NVARCHAR(200)  NULL
    );
    CREATE INDEX IX_PartMilestones_IssueNumber ON Part_Milestones (IssueNumber);
    CREATE INDEX IX_PartMilestones_ProjectUid  ON Part_Milestones (ProjectUid);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'checklist_Master')
BEGIN
    CREATE TABLE checklist_Master (
        Uid             NVARCHAR(100)  NOT NULL PRIMARY KEY,
        ChkId           NVARCHAR(100)  NULL,
        CheckPointS     NVARCHAR(500)  NULL,
        CheckpointDesc  NVARCHAR(MAX)  NULL,
        Department      NVARCHAR(100)  NULL,
        Status          NVARCHAR(50)   NULL,
        Mandatory       NVARCHAR(10)   NULL,
        Zone            NVARCHAR(200)  NULL,
        Station         NVARCHAR(200)  NULL,
        Owner           NVARCHAR(200)  NULL,
        Category        NVARCHAR(200)  NULL,
        Area            NVARCHAR(200)  NULL,
        Material        NVARCHAR(200)  NULL,
        CreatedBy       NVARCHAR(200)  NULL,
        CreatedDate     NVARCHAR(50)   NULL,
        ModifiedBy      NVARCHAR(200)  NULL,
        ModifiedDate    NVARCHAR(50)   NULL,
        Flag1           NVARCHAR(200)  NULL,
        Flag2           NVARCHAR(200)  NULL,
        Flag3           NVARCHAR(200)  NULL,
        RefDocument     NVARCHAR(MAX)  NULL,
        Images          NVARCHAR(MAX)  NULL
    );
    CREATE INDEX IX_ChecklistMaster_Department ON checklist_Master (Department);
    CREATE INDEX IX_ChecklistMaster_Status     ON checklist_Master (Status);
END;

-- Add columns that may be missing from an existing checklist_Master table
IF COL_LENGTH('checklist_Master','RefDocument') IS NULL
    ALTER TABLE checklist_Master ADD RefDocument NVARCHAR(MAX) NULL;

IF COL_LENGTH('checklist_Master','Images') IS NULL
    ALTER TABLE checklist_Master ADD Images NVARCHAR(MAX) NULL;

-- Add remarks columns to Issue_list_checklist if missing
IF COL_LENGTH('Issue_list_checklist','Remarks_RH') IS NULL
    ALTER TABLE Issue_list_checklist ADD Remarks_RH NVARCHAR(MAX) NULL;

IF COL_LENGTH('Issue_list_checklist','Remarks_LH') IS NULL
    ALTER TABLE Issue_list_checklist ADD Remarks_LH NVARCHAR(MAX) NULL;

-- Fix typo: 'Asessy' → 'Assembly' in ComponentMetadata
UPDATE ComponentMetadata SET Parameter = 'Assembly' WHERE Parameter = 'Asessy';

-- Add SyncData column to dmrs_Checklist and migrate existing per-sync columns
IF COL_LENGTH('dmrs_Checklist', 'SyncData') IS NULL
BEGIN
    ALTER TABLE dmrs_Checklist ADD SyncData NVARCHAR(MAX) NULL;
    -- Only migrate if old per-sync columns still exist (skipped on fresh installs)
    IF COL_LENGTH('dmrs_Checklist', 'Sync1') IS NOT NULL
    BEGIN
        UPDATE dmrs_Checklist
        SET SyncData = CONCAT(
            '{',
            '""Sync 1"":""',     ISNULL(Sync1,''),          '|', ISNULL(Sync1_Comments,''), '"",',
            '""Sync 2"":""',     ISNULL(Sync2,''),          '|', ISNULL(Sync2_Comments,''), '"",',
            '""Sync 3"":""',     ISNULL(Sync3,''),          '|', ISNULL(Sync3_Comments,''), '"",',
            '""Sync 4"":""',     ISNULL(Sync4,''),          '|', ISNULL(Sync4_Comments,''), '"",',
            '""Sync 5"":""',     ISNULL(Sync5,''),          '|', ISNULL(Sync5_Comments,''), '"",',
            '""Post Sync 5"":""',ISNULL(PostSync5,''),      '|""',
            '}'
        )
        WHERE SyncData IS NULL;
    END;
END;";
            try
            {
                await db.Database.ExecuteSqlRawAsync(sql);
                logger.LogInformation("DbSeeder: DDL tables ensured (Part_Milestones, checklist_Master).");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "DbSeeder: EnsureTablesAsync failed – {Msg}", ex.Message);
            }
        }

        // ── Users ──────────────────────────────────────────────────────────────
        private static async Task SeedUsersAsync(AppDbContext db, IConfiguration config, ILogger logger)
        {
            if (await db.Users.AnyAsync())
            {
                logger.LogInformation("DbSeeder: Users already seeded – skipping.");
                return;
            }

            var seeds = config.GetSection("SeedUsers").Get<List<SeedUserEntry>>();
            if (seeds is null || seeds.Count == 0)
            {
                logger.LogWarning("DbSeeder: No SeedUsers in config. Use POST /api/auth/bootstrap to create the first admin.");
                return;
            }

            var validRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Admin", "AVP_Admin", "WGDE_Admin", "AVP_User", "WGDE_User", "Viewer" };

            var users = seeds
                .Where(s => !string.IsNullOrWhiteSpace(s.UserId))
                .Select(s => new User
                {
                    UId         = Guid.NewGuid().ToString("N").ToUpper(),
                    UserId      = s.UserId.Trim(),
                    UserName    = s.UserName?.Trim() ?? s.UserId.Trim(),
                    EmailId     = (s.EmailId ?? s.UserId).Trim(),
                    Role        = validRoles.Contains(s.Role ?? "") ? s.Role! : "Viewer",
                    Status      = "Active",
                    CreatedDate = DateTime.UtcNow,
                })
                .ToList();

            try
            {
                await db.Users.AddRangeAsync(users);
                await db.SaveChangesAsync();
                logger.LogInformation("DbSeeder: Seeded {Count} user(s).", users.Count);
            }
            catch (DbUpdateException ex)
            {
                logger.LogError(ex, "DbSeeder: User seed failed – {Msg}", ex.InnerException?.Message ?? ex.Message);
            }
        }

        // ── ComponentMetadata (dropdown options) ───────────────────────────────
        private static async Task SeedComponentMetadataAsync(AppDbContext db, ILogger logger)
        {
            if (await db.ComponentMetadata.AnyAsync())
            {
                logger.LogInformation("DbSeeder: ComponentMetadata already seeded – skipping.");
                return;
            }

            var now    = DateTime.UtcNow;
            int ouid   = 1;

            // Helper: build a metadata row
            ComponentMetadata Row(string param, string label, string code) => new()
            {
                Ouid          = ouid++,
                ComponentName = "ChecklistMaster",
                ComponentCode = "CHK",
                Activity      = "Dropdown",
                Action        = "Load",
                Parameter     = param,
                ParameterCode = code,
                Label         = label,
                Status        = "Active",
                Language      = 1,
                CreatedBy     = "system",
                CreatedDate   = now,
                ModifiedBy    = "system",
                ModifiedDate  = now,
            };

            var entries = new List<ComponentMetadata>
            {
                // Zone
                Row("Zone", "Zone 1",   "Z001"),
                Row("Zone", "Zone 2",   "Z002"),
                Row("Zone", "Zone 3",   "Z003"),
                Row("Zone", "Zone 4",   "Z004"),
                Row("Zone", "Zone 5",   "Z005"),
                Row("Zone", "North",    "ZN"),
                Row("Zone", "South",    "ZS"),
                Row("Zone", "East",     "ZE"),
                Row("Zone", "West",     "ZW"),

                // Area
                Row("Area", "Assembly",     "AR01"),
                Row("Area", "Body Shop",    "AR02"),
                Row("Area", "Paint Shop",   "AR03"),
                Row("Area", "Trim",         "AR04"),
                Row("Area", "Final Line",   "AR05"),
                Row("Area", "Engine Bay",   "AR06"),
                Row("Area", "Chassis",      "AR07"),
                Row("Area", "Electrical",   "AR08"),

                // Station (parameter key used in frontend filter: "station_name")
                Row("station_name", "Station A",   "ST-A"),
                Row("station_name", "Station B",   "ST-B"),
                Row("station_name", "Station C",   "ST-C"),
                Row("station_name", "Station D",   "ST-D"),
                Row("station_name", "Station E",   "ST-E"),
                Row("station_name", "Station 01",  "ST-01"),
                Row("station_name", "Station 02",  "ST-02"),
                Row("station_name", "Station 03",  "ST-03"),
                Row("station_name", "Station 04",  "ST-04"),
                Row("station_name", "Station 05",  "ST-05"),

                // Category
                Row("Category", "Safety",       "CAT-01"),
                Row("Category", "Quality",      "CAT-02"),
                Row("Category", "Process",      "CAT-03"),
                Row("Category", "Audit",        "CAT-04"),
                Row("Category", "Compliance",   "CAT-05"),
                Row("Category", "Maintenance",  "CAT-06"),
                Row("Category", "Environment",  "CAT-07"),
                Row("Category", "Engineering",  "CAT-08"),
            };

            try
            {
                await db.ComponentMetadata.AddRangeAsync(entries);
                await db.SaveChangesAsync();
                logger.LogInformation("DbSeeder: Seeded {Count} ComponentMetadata entries.", entries.Count);
            }
            catch (DbUpdateException ex)
            {
                logger.LogError(ex, "DbSeeder: ComponentMetadata seed failed – {Msg}", ex.InnerException?.Message ?? ex.Message);
            }
        }
    }

    public sealed class SeedUserEntry
    {
        public string  UserId   { get; set; } = string.Empty;
        public string? UserName { get; set; }
        public string? EmailId  { get; set; }
        public string? Role     { get; set; }
    }
}
