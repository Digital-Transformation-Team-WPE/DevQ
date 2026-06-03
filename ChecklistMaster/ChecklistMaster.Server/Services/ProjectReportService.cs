using ChecklistMaster.Server.Data;
using ChecklistMaster.Server.Models;
using ChecklistMaster.Server.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace ChecklistMaster.Server.Services
{
    public interface IProjectReportService
    {
        Task<ProjectReportDto?> GetReportAsync(string projectUid);
    }

    public class ProjectReportService : IProjectReportService
    {
        private readonly AppDbContext _context;

        public ProjectReportService(AppDbContext context) => _context = context;

        public async Task<ProjectReportDto?> GetReportAsync(string projectUid)
        {
            // ── 1. Project ────────────────────────────────────────────────────────
            var project = await _context.Projects.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Uid == projectUid);
            if (project is null) return null;

            // ── 2. All parts (issue links) for this project ───────────────────────
            var links = await _context.ProjectIssueLinks.AsNoTracking()
                .Where(l => l.Project == projectUid)
                .ToListAsync();

            var issueNumbers = links
                .Select(l => l.Issue_number)
                .Where(n => !string.IsNullOrEmpty(n))
                .Distinct()
                .ToList();

            int totalParts = links.Count;

            // ── 3. Project milestones (x-axis columns) ────────────────────────────
            var projectMilestones = await _context.ProjectMilestones.AsNoTracking()
                .Where(m => m.ProjectUid == projectUid)
                .OrderBy(m => m.MilestoneOrder)
                .ThenBy(m => m.PlannedDate)
                .ToListAsync();

            // ── 4. DMRS checklists for all issues (one batch query) ───────────────
            var allDmrs = issueNumbers.Count > 0
                ? await _context.DmrsChecklists.AsNoTracking()
                    .Where(d => issueNumbers.Contains(d.Issue_number))
                    .ToListAsync()
                : new List<DmrsChecklist>();

            var dmrsByIssue = allDmrs
                .GroupBy(d => d.Issue_number ?? "")
                .ToDictionary(g => g.Key, g => g.ToList());

            // ── 5. Part milestones for all issues (for parts table pilot/status) ──
            var allPartMs = issueNumbers.Count > 0
                ? await _context.PartMilestones.AsNoTracking()
                    .Where(m => issueNumbers.Contains(m.IssueNumber))
                    .OrderBy(m => m.MilestoneOrder)
                    .ToListAsync()
                : new List<PartMilestone>();

            var partMsByIssue = allPartMs
                .GroupBy(m => m.IssueNumber ?? "")
                .ToDictionary(g => g.Key, g => g.ToList());

            // ── 6. Identify target (last) milestone for relative-week reference ───
            var syncMilestone = projectMilestones.LastOrDefault();
            int? syncWeekNum  = syncMilestone?.PlannedDate is not null
                ? GetIsoWeek(syncMilestone.PlannedDate.Value) : null;

            // ── 7. Build milestone columns ────────────────────────────────────────
            var milestoneColumns = projectMilestones.Select((ms, i) =>
            {
                int? wk = ms.PlannedDate is not null ? GetIsoWeek(ms.PlannedDate.Value) : null;
                int  rw = (wk.HasValue && syncWeekNum.HasValue)
                    ? wk.Value - syncWeekNum.Value
                    : i - projectMilestones.Count + 1;
                return new MilestoneColumnDto
                {
                    Name           = ms.MilestoneName ?? $"Milestone {i + 1}",
                    PlannedDate    = ms.PlannedDate,
                    WeekNumber     = wk,
                    RelativeWeek   = rw,
                    WeekLabel      = wk.HasValue ? $"W{wk}" : "—",
                    MilestoneOrder = ms.MilestoneOrder ?? i,
                    IsSync         = ms == syncMilestone,
                };
            }).ToList();

            // ── 8. Compute data points per milestone ──────────────────────────────
            double maxOrder = projectMilestones.Count > 1
                ? (double)(projectMilestones.Last().MilestoneOrder ?? projectMilestones.Count - 1)
                : 1.0;
            if (maxOrder <= 0) maxOrder = 1.0;

            int? firstGreenWeek = null;

            var dataPoints = projectMilestones.Select((ms, i) =>
            {
                var msName = ms.MilestoneName ?? $"Milestone {i + 1}";
                int? wk    = ms.PlannedDate is not null ? GetIsoWeek(ms.PlannedDate.Value) : null;
                int  rw    = (wk.HasValue && syncWeekNum.HasValue)
                    ? wk.Value - syncWeekNum.Value
                    : i - projectMilestones.Count + 1;

                int green = 0, yellow = 0, orange = 0, red = 0;
                foreach (var link in links)
                {
                    var iss    = link.Issue_number ?? "";
                    var rows   = dmrsByIssue.TryGetValue(iss, out var r) ? r : new List<DmrsChecklist>();
                    var parsed = rows.Select(d => ParseSyncResult(d.SyncData, msName)).ToList();
                    switch (ComputeColor(parsed))
                    {
                        case "Green":  green++;  break;
                        case "Yellow": yellow++; break;
                        case "Orange": orange++; break;
                        default:       red++;    break;
                    }
                }

                double goPct    = totalParts > 0 ? (green + orange) * 100.0 / totalParts : 0;
                double greenPct = totalParts > 0 ? green             * 100.0 / totalParts : 0;
                double order    = ms.MilestoneOrder ?? i;
                double target   = maxOrder > 0 ? order / maxOrder * 85.0 : 0;

                if (firstGreenWeek is null && greenPct >= 85 && wk.HasValue)
                    firstGreenWeek = wk;

                return new DataPointDto
                {
                    MilestoneName      = msName,
                    MilestoneOrder     = ms.MilestoneOrder ?? i,
                    WeekNumber         = wk,
                    RelativeWeek       = rw,
                    WeekLabel          = wk.HasValue ? $"W{wk}" : "—",
                    TotalParts         = totalParts,
                    GreenCount         = green,
                    YellowCount        = yellow,
                    OrangeCount        = orange,
                    RedCount           = red,
                    ProjectGoPercent   = Math.Round(goPct,    1),
                    ProjectGreenPercent= Math.Round(greenPct, 1),
                    TargetGreenPercent = Math.Round(target,   1),
                };
            }).ToList();

            // ── 9. Parts table ────────────────────────────────────────────────────
            // Current milestone = last ProjectMilestone name (or last active PartMilestone)
            var defaultMsName = syncMilestone?.MilestoneName ?? "";

            var partsTable = links.Select((link, i) =>
            {
                var iss    = link.Issue_number ?? "";
                var dept   = (link.Flag1 ?? "").Trim();
                bool isAvp  = dept.Contains("AVP",  StringComparison.OrdinalIgnoreCase);
                bool isWgde = dept.Contains("WGDE", StringComparison.OrdinalIgnoreCase)
                           || dept.Contains("WDGE", StringComparison.OrdinalIgnoreCase);

                var partMs = partMsByIssue.TryGetValue(iss, out var pms) ? pms : new List<PartMilestone>();

                // Current/active milestone: last non-Pending, else last overall
                var activePm = partMs
                    .Where(m => !string.Equals(m.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(m => m.MilestoneOrder ?? 0)
                    .FirstOrDefault()
                    ?? partMs.OrderByDescending(m => m.MilestoneOrder ?? 0).FirstOrDefault();

                var currentMs = activePm?.MilestoneName ?? defaultMsName;

                // Aggregate DMRS for current milestone
                var dmrsRows   = dmrsByIssue.TryGetValue(iss, out var dr) ? dr : new List<DmrsChecklist>();
                var results    = dmrsRows.Select(d => ParseSyncResult(d.SyncData, currentMs)).ToList();
                var colorStatus= ComputeColor(results);
                int notOkCount = results.Count(r => r.Equals("Not OK", StringComparison.OrdinalIgnoreCase));
                int totalChecks= results.Count(r => !string.IsNullOrEmpty(r));

                // Pilot (owner field) from PartMilestone by department
                var avpPm  = partMs
                    .Where(m => (m.Department ?? "").Contains("AVP", StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(m => m.MilestoneOrder ?? 0).FirstOrDefault();
                var wgdePm = partMs
                    .Where(m => (m.Department ?? "").Contains("WGDE", StringComparison.OrdinalIgnoreCase)
                             || (m.Department ?? "").Contains("WDGE", StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(m => m.MilestoneOrder ?? 0).FirstOrDefault();

                return new PartTableRowDto
                {
                    SNo                  = i + 1,
                    Code                 = link.PartNumber ?? iss,
                    Program              = link.Program    ?? project.Program    ?? "",
                    Project              = project.ProjectName                   ?? "",
                    Plant                = link.Plant      ?? project.Plant      ?? "",
                    Year                 = link.Plant_year ?? project.Plant_year ?? "",
                    Milestone            = currentMs,
                    DepartmentAvp        = isAvp  ? "AVP"  : "",
                    DepartmentWgde       = isWgde ? "WGDE" : "",
                    PilotAvp             = isAvp  ? (avpPm?.Owner  ?? "") : "",
                    PilotWgde            = isWgde ? (wgdePm?.Owner ?? "") : "",
                    ValidationStatusAvp  = isAvp  ? colorStatus : "",
                    ValidationStatusWgde = isWgde ? colorStatus : "",
                    TotalChecksAvp       = isAvp  ? totalChecks : 0,
                    TotalChecksWgde      = isWgde ? totalChecks : 0,
                    IssuesAvp            = isAvp  ? notOkCount.ToString() : "",
                    IssuesWgde           = isWgde ? notOkCount.ToString() : "",
                    StatusAvp            = isAvp  ? colorStatus : "",
                    StatusWgde           = isWgde ? colorStatus : "",
                };
            }).ToList();

            // ── 10. KPIs ──────────────────────────────────────────────────────────
            int? firstWeekCotation = milestoneColumns.FirstOrDefault()?.WeekNumber;

            return new ProjectReportDto
            {
                ProjectInfo = new ProjectInfoDto
                {
                    Uid         = project.Uid,
                    ProjectName = project.ProjectName ?? "",
                    Program     = project.Program     ?? "",
                    Plant       = project.Plant       ?? "",
                    PlantYear   = project.Plant_year  ?? "",
                    Zone        = project.Zone        ?? "",
                    Area        = project.Area        ?? "",
                    Status      = project.Status      ?? "",
                },
                Milestones = milestoneColumns,
                DataPoints = dataPoints,
                PartsTable = partsTable,
                Summary    = new SummaryKpiDto
                {
                    WeekOfSync           = syncWeekNum,
                    FirstWeekCotation    = firstWeekCotation,
                    FirstWeekTargetGreen = firstGreenWeek,
                    TargetPercent        = 85,
                    SyncMilestoneName    = syncMilestone?.MilestoneName ?? "",
                    TotalParts           = totalParts,
                },
            };
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static int GetIsoWeek(DateTime date) =>
            ISOWeek.GetWeekOfYear(date);

        private static string ParseSyncResult(string? syncData, string milestoneName)
        {
            if (string.IsNullOrWhiteSpace(syncData)) return "";
            try
            {
                var obj = JsonSerializer.Deserialize<Dictionary<string, string>>(syncData);
                if (obj is null || !obj.TryGetValue(milestoneName, out var combined)
                    || string.IsNullOrEmpty(combined)) return "";
                var pipe = combined.IndexOf('|');
                return (pipe >= 0 ? combined[..pipe] : combined).Trim();
            }
            catch { return ""; }
        }

        private static string ComputeColor(IEnumerable<string> results)
        {
            var list = results.Where(r => !string.IsNullOrEmpty(r)).ToList();
            if (list.Count == 0) return "Yellow";

            bool anyNotOk = list.Any(r => r.Equals("Not OK", StringComparison.OrdinalIgnoreCase));
            bool anyOk    = list.Any(r => r.Equals("OK",  StringComparison.OrdinalIgnoreCase)
                                       || r.Equals("N/A", StringComparison.OrdinalIgnoreCase));

            if (!anyNotOk) return "Green";
            if (!anyOk)    return "Red";
            return "Orange";
        }
    }
}
