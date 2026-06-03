using ChecklistMaster.Server.Data;
using ChecklistMaster.Server.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ChecklistMaster.Server.Services
{
    public class UserService : GenericService<User>, IUserService
    {
        public UserService(AppDbContext context) : base(context) { }

        public async Task<User?> GetByUserIdAsync(string userId) =>
            await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId || u.EmailId == userId);

        public async Task<IEnumerable<User>> GetByRoleAsync(string role) =>
            await _context.Users.AsNoTracking().Where(u => u.Role == role).ToListAsync();

        public async Task UpdateLastLoginAsync(string uId)
        {
            var user = await _context.Users.FindAsync(uId);
            if (user is not null)
            {
                user.Lastlogin = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }
    }

    public class ProjectService : GenericService<Project>, IProjectService
    {
        public ProjectService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<Project>> GetByCreatedByAsync(string createdBy) =>
            await _context.Projects.AsNoTracking().Where(p => p.Created_by == createdBy).ToListAsync();
    }

    public class ProjectIssueLinkService : GenericService<ProjectIssueLink>, IProjectIssueLinkService
    {
        public ProjectIssueLinkService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<ProjectIssueLink>> GetByProjectUidAsync(string uid) =>
            await _context.ProjectIssueLinks.AsNoTracking().Where(p => p.Project == uid).ToListAsync();

        public async Task<IEnumerable<ProjectIssueLink>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.ProjectIssueLinks.AsNoTracking().Where(p => p.Issue_number == issueNumber).ToListAsync();
    }

    public class IssueListDocinfoService : GenericService<IssueListDocinfo>, IIssueListDocinfoService
    {
        public IssueListDocinfoService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<IssueListDocinfo>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.IssueListDocinfos.AsNoTracking().Where(i => i.Issue_number == issueNumber).ToListAsync();

        public async Task<IEnumerable<IssueListDocinfo>> GetByPartNumberAsync(string partNumber) =>
            await _context.IssueListDocinfos.AsNoTracking().Where(i => i.PartNumber == partNumber).ToListAsync();
    }

    public class IssueListPartinfoService : GenericService<IssueListPartinfo>, IIssueListPartinfoService
    {
        public IssueListPartinfoService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<IssueListPartinfo>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.IssueListPartinfos.AsNoTracking().Where(i => i.Issue_number == issueNumber).ToListAsync();

        public async Task<IEnumerable<IssueListPartinfo>> GetByPartNumberAsync(string partNumber) =>
            await _context.IssueListPartinfos.AsNoTracking().Where(i => i.PartNumber == partNumber).ToListAsync();
    }

    public class IssueListHistoryService : GenericService<IssueListHistory>, IIssueListHistoryService
    {
        public IssueListHistoryService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<IssueListHistory>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.IssueListHistories.AsNoTracking().Where(i => i.Issue_number == issueNumber).ToListAsync();
    }

    public class IssueListChecklistService : GenericService<IssueListChecklist>, IIssueListChecklistService
    {
        public IssueListChecklistService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<IssueListChecklist>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.IssueListChecklists.AsNoTracking().Where(i => i.Issue_number == issueNumber).ToListAsync();

        public async Task<IEnumerable<IssueListChecklist>> GetByPartNumberAsync(string partNumber) =>
            await _context.IssueListChecklists.AsNoTracking().Where(i => i.PartNumber == partNumber).ToListAsync();
    }

    public class DmrsChecklistService : GenericService<DmrsChecklist>, IDmrsChecklistService
    {
        public DmrsChecklistService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<DmrsChecklist>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.DmrsChecklists.AsNoTracking().Where(d => d.Issue_number == issueNumber).ToListAsync();

        public async Task<IEnumerable<DmrsChecklist>> GetByPartNumberAsync(string partNumber) =>
            await _context.DmrsChecklists.AsNoTracking().Where(d => d.PartNumber == partNumber).ToListAsync();
    }

    public class ChecklistMasterService : GenericService<ChecklistMasterEntity>, IChecklistMasterService
    {
        public ChecklistMasterService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<ChecklistMasterEntity>> GetByZoneAsync(string zone) =>
            await _context.ChecklistMasters.AsNoTracking().Where(c => c.Zone == zone).ToListAsync();

        public async Task<IEnumerable<ChecklistMasterEntity>> GetByAreaAsync(string area) =>
            await _context.ChecklistMasters.AsNoTracking().Where(c => c.Area == area).ToListAsync();

        public async Task<IEnumerable<ChecklistMasterEntity>> GetByDepartmentAsync(string department) =>
            await _context.ChecklistMasters.AsNoTracking().Where(c => c.Department == department).ToListAsync();
    }

    public class ComponentMetadataService : GenericService<ComponentMetadata>, IComponentMetadataService
    {
        public ComponentMetadataService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<ComponentMetadata>> GetByComponentCodeAsync(string componentCode) =>
            await _context.ComponentMetadata.AsNoTracking().Where(c => c.ComponentCode == componentCode).ToListAsync();

        public async Task<IEnumerable<ComponentMetadata>> GetByLanguageAsync(int language) =>
            await _context.ComponentMetadata.AsNoTracking().Where(c => c.Language == language).ToListAsync();

        // Override to use FirstOrDefault instead of FindAsync since Ouid has no DB PK constraint
        public override async Task<ComponentMetadata?> UpdateAsync(object id, ComponentMetadata entity)
        {
            var ouid = Convert.ToInt32(id);
            var existing = await _context.ComponentMetadata.FirstOrDefaultAsync(c => c.Ouid == ouid);
            if (existing is null) return null;
            _context.Entry(existing).CurrentValues.SetValues(entity);
            await _context.SaveChangesAsync();
            return existing;
        }

        public override async Task<bool> DeleteAsync(object id)
        {
            var ouid = Convert.ToInt32(id);
            var existing = await _context.ComponentMetadata.FirstOrDefaultAsync(c => c.Ouid == ouid);
            if (existing is null) return false;
            _context.ComponentMetadata.Remove(existing);
            await _context.SaveChangesAsync();
            return true;
        }
    }

    public class ChecklistMilestoneService : GenericService<ChecklistMilestone>, IChecklistMilestoneService
    {
        public ChecklistMilestoneService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<ChecklistMilestone>> GetByDepartmentAsync(string department) =>
            await _context.ChecklistMilestones.AsNoTracking()
                .Where(m => m.Department == department).ToListAsync();

        public async Task<IEnumerable<ChecklistMilestone>> GetByChkIdAsync(string chkId) =>
            await _context.ChecklistMilestones.AsNoTracking()
                .Where(m => m.ChkId == chkId).ToListAsync();

        public async Task<IEnumerable<ChecklistMilestone>> GetByMilestoneIdAsync(string milestoneId) =>
            await _context.ChecklistMilestones.AsNoTracking()
                .Where(m => m.Milestoneid == milestoneId).ToListAsync();
    }

    public class PartMilestoneService : GenericService<PartMilestone>, IPartMilestoneService
    {
        public PartMilestoneService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<PartMilestone>> GetByIssueNumberAsync(string issueNumber) =>
            await _context.PartMilestones.AsNoTracking()
                .Where(m => m.IssueNumber == issueNumber)
                .OrderBy(m => m.MilestoneOrder)
                .ToListAsync();

        public async Task<IEnumerable<PartMilestone>> GetByProjectUidAsync(string projectUid) =>
            await _context.PartMilestones.AsNoTracking()
                .Where(m => m.ProjectUid == projectUid)
                .OrderBy(m => m.MilestoneOrder)
                .ToListAsync();

        public async Task<IEnumerable<PartMilestone>> BulkUpsertAsync(string issueNumber, IEnumerable<PartMilestone> milestones)
        {
            var existing = await _context.PartMilestones
                .Where(m => m.IssueNumber == issueNumber)
                .ToListAsync();

            var incoming = milestones.ToList();
            var incomingUids = incoming.Select(m => m.Uid).ToHashSet();

            // Remove deleted rows
            var toDelete = existing.Where(e => !incomingUids.Contains(e.Uid)).ToList();
            _context.PartMilestones.RemoveRange(toDelete);

            foreach (var m in incoming)
            {
                var ex = existing.FirstOrDefault(e => e.Uid == m.Uid);
                if (ex is not null)
                {
                    _context.Entry(ex).CurrentValues.SetValues(m);
                }
                else
                {
                    await _context.PartMilestones.AddAsync(m);
                }
            }

            await _context.SaveChangesAsync();
            return await GetByIssueNumberAsync(issueNumber);
        }
    }

    public class ProjectMilestoneService : GenericService<ProjectMilestone>, IProjectMilestoneService
    {
        public ProjectMilestoneService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<ProjectMilestone>> GetByProjectUidAsync(string projectUid) =>
            await _context.ProjectMilestones.AsNoTracking()
                .Where(m => m.ProjectUid == projectUid)
                .OrderBy(m => m.MilestoneOrder)
                .ToListAsync();

        public async Task<IEnumerable<ProjectMilestone>> BulkUpsertAsync(string projectUid, IEnumerable<ProjectMilestone> milestones)
        {
            var existing = await _context.ProjectMilestones
                .Where(m => m.ProjectUid == projectUid)
                .ToListAsync();

            var incoming    = milestones.ToList();
            var incomingUids = incoming.Select(m => m.Uid).ToHashSet();

            var toDelete = existing.Where(e => !incomingUids.Contains(e.Uid)).ToList();
            _context.ProjectMilestones.RemoveRange(toDelete);

            foreach (var m in incoming)
            {
                var ex = existing.FirstOrDefault(e => e.Uid == m.Uid);
                if (ex is not null)
                    _context.Entry(ex).CurrentValues.SetValues(m);
                else
                    await _context.ProjectMilestones.AddAsync(m);
            }

            await _context.SaveChangesAsync();
            return await GetByProjectUidAsync(projectUid);
        }
    }

    public class CalendarEventService : GenericService<CalendarEvent>, ICalendarEventService
    {
        public CalendarEventService(AppDbContext context) : base(context) { }

        /// <summary>
        /// Returns all global events plus the personal events owned by <paramref name="userId"/>.
        /// Global events have IsGlobal == true; personal events have IsGlobal == false and UserId == userId.
        /// </summary>
        public async Task<IEnumerable<CalendarEvent>> GetByUserAsync(string userId) =>
            await _context.CalendarEvents
                .AsNoTracking()
                .Where(e => e.IsGlobal == true ||
                            (e.IsGlobal == false && e.UserId == userId))
                .OrderBy(e => e.StartDate)
                .ToListAsync();
    }

    public class MilestoneMasterService : GenericService<MilestoneMaster>, IMilestoneMasterService
    {
        public MilestoneMasterService(AppDbContext context) : base(context) { }

        public async Task<IEnumerable<MilestoneMaster>> GetActiveOrderedAsync() =>
            await _context.MilestoneMasters.AsNoTracking()
                .Where(m => m.Status == "Active")
                .OrderBy(m => m.MilestoneOrder)
                .ToListAsync();
    }

    public class NotificationService : INotificationService
{
    private readonly AppDbContext    _db;
    private readonly ILogger<NotificationService> _logger;
    private readonly string          _mailProfile;

    public NotificationService(AppDbContext db, IConfiguration config, ILogger<NotificationService> logger)
    {
        _db          = db;
        _logger      = logger;
        _mailProfile = config["Notifications:MailProfile"] ?? "RStudioMailProfile";
    }

    public async Task TriggerAsync(NotificationRequest request)
    {
        _logger.LogInformation(
            "Notification trigger: {EventType} / {EntityType} / {EntityId} by {TriggeredBy}",
            request.EventType, request.EntityType, request.EntityId, request.TriggeredBy);

        await _db.Database.ExecuteSqlRawAsync(
            "EXEC dbo.usp_TriggerNotification @EventType, @EntityType, @EntityId, @TriggeredBy, @MailProfile",
            new SqlParameter("@EventType",   request.EventType),
            new SqlParameter("@EntityType",  request.EntityType),
            new SqlParameter("@EntityId",    request.EntityId),
            new SqlParameter("@TriggeredBy", request.TriggeredBy),
            new SqlParameter("@MailProfile", _mailProfile));
    }
}
}
