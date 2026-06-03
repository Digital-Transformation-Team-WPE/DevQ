namespace ChecklistMaster.Server.Models
{
    public class NotificationRequest
    {
        /// <summary>PROJECT_CREATED | PROJECT_UPDATED | STATUS_CHANGED</summary>
        public string EventType   { get; set; } = string.Empty;
        /// <summary>Entity kind, e.g. "Project"</summary>
        public string EntityType  { get; set; } = string.Empty;
        /// <summary>Primary key (Uid) of the affected entity</summary>
        public string EntityId    { get; set; } = string.Empty;
        /// <summary>UserId or display name of the user who triggered the event</summary>
        public string TriggeredBy { get; set; } = string.Empty;
    }
}
