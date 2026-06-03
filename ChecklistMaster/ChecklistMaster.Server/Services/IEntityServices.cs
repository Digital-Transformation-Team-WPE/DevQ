using ChecklistMaster.Server.Models;

namespace ChecklistMaster.Server.Services
{
    public interface INotificationService
    {
        Task TriggerAsync(NotificationRequest request);
    }

    public interface IUserService : IGenericService<User>
    {
        Task<User?> GetByUserIdAsync(string userId);
        Task<IEnumerable<User>> GetByRoleAsync(string role);
        Task UpdateLastLoginAsync(string uId);
    }

    public interface IProjectService : IGenericService<Project>
    {
        Task<IEnumerable<Project>> GetByCreatedByAsync(string createdBy);
    }

    public interface IProjectIssueLinkService : IGenericService<ProjectIssueLink>
    {
        Task<IEnumerable<ProjectIssueLink>> GetByProjectUidAsync(string uid);
        Task<IEnumerable<ProjectIssueLink>> GetByIssueNumberAsync(string issueNumber);
    }

    public interface IIssueListDocinfoService : IGenericService<IssueListDocinfo>
    {
        Task<IEnumerable<IssueListDocinfo>> GetByIssueNumberAsync(string issueNumber);
        Task<IEnumerable<IssueListDocinfo>> GetByPartNumberAsync(string partNumber);
    }

    public interface IIssueListPartinfoService : IGenericService<IssueListPartinfo>
    {
        Task<IEnumerable<IssueListPartinfo>> GetByIssueNumberAsync(string issueNumber);
        Task<IEnumerable<IssueListPartinfo>> GetByPartNumberAsync(string partNumber);
    }

    public interface IIssueListHistoryService : IGenericService<IssueListHistory>
    {
        Task<IEnumerable<IssueListHistory>> GetByIssueNumberAsync(string issueNumber);
    }

    public interface IIssueListChecklistService : IGenericService<IssueListChecklist>
    {
        Task<IEnumerable<IssueListChecklist>> GetByIssueNumberAsync(string issueNumber);
        Task<IEnumerable<IssueListChecklist>> GetByPartNumberAsync(string partNumber);
    }

    public interface IDmrsChecklistService : IGenericService<DmrsChecklist>
    {
        Task<IEnumerable<DmrsChecklist>> GetByIssueNumberAsync(string issueNumber);
        Task<IEnumerable<DmrsChecklist>> GetByPartNumberAsync(string partNumber);
    }

    public interface IChecklistMasterService : IGenericService<ChecklistMasterEntity>
    {
        Task<IEnumerable<ChecklistMasterEntity>> GetByZoneAsync(string zone);
        Task<IEnumerable<ChecklistMasterEntity>> GetByAreaAsync(string area);
        Task<IEnumerable<ChecklistMasterEntity>> GetByDepartmentAsync(string department);
    }

    public interface IComponentMetadataService : IGenericService<ComponentMetadata>
    {
        Task<IEnumerable<ComponentMetadata>> GetByComponentCodeAsync(string componentCode);
        Task<IEnumerable<ComponentMetadata>> GetByLanguageAsync(int language);
    }

    public interface IChecklistMilestoneService : IGenericService<ChecklistMilestone>
    {
        Task<IEnumerable<ChecklistMilestone>> GetByDepartmentAsync(string department);
        Task<IEnumerable<ChecklistMilestone>> GetByChkIdAsync(string chkId);
        Task<IEnumerable<ChecklistMilestone>> GetByMilestoneIdAsync(string milestoneId);
    }

    public interface IPartMilestoneService : IGenericService<PartMilestone>
    {
        Task<IEnumerable<PartMilestone>> GetByIssueNumberAsync(string issueNumber);
        Task<IEnumerable<PartMilestone>> GetByProjectUidAsync(string projectUid);
        Task<IEnumerable<PartMilestone>> BulkUpsertAsync(string issueNumber, IEnumerable<PartMilestone> milestones);
    }

    public interface IProjectMilestoneService : IGenericService<ProjectMilestone>
    {
        Task<IEnumerable<ProjectMilestone>> GetByProjectUidAsync(string projectUid);
        Task<IEnumerable<ProjectMilestone>> BulkUpsertAsync(string projectUid, IEnumerable<ProjectMilestone> milestones);
    }

    public interface ICalendarEventService : IGenericService<CalendarEvent>
    {
        /// <summary>
        /// Returns all global events plus any personal events that belong to <paramref name="userId"/>.
        /// </summary>
        Task<IEnumerable<CalendarEvent>> GetByUserAsync(string userId);
    }

    public interface IMilestoneMasterService : IGenericService<MilestoneMaster>
    {
        /// <summary>Returns active milestone masters ordered by MilestoneOrder.</summary>
        Task<IEnumerable<MilestoneMaster>> GetActiveOrderedAsync();
    }
}
