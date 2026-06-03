using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChecklistMaster.Server.Models
{
    /// <summary>
    /// Represents a calendar event: holiday, vacation, non-working day,
    /// special working day, or milestone target date.
    /// </summary>
    [Table("CalendarEvents")]
    public class CalendarEvent
    {
        /// <summary>Primary key — GUID string (no dashes, uppercase).</summary>
        [Key]
        public string Uid { get; set; } = string.Empty;

        /// <summary>Display title, e.g. "Independence Day" or "John's vacation".</summary>
        public string? Title { get; set; }

        /// <summary>
        /// Event category.
        /// Allowed values: Holiday | Vacation | NonWorking | WorkingDay | Milestone
        /// </summary>
        public string? EventType { get; set; }

        /// <summary>Inclusive start date (stored as UTC midnight).</summary>
        public DateTime? StartDate { get; set; }

        /// <summary>Inclusive end date (stored as UTC midnight). Equal to StartDate for single-day events.</summary>
        public DateTime? EndDate { get; set; }

        /// <summary>
        /// Scope flag.
        /// true  = global event visible to every user.
        /// false = personal event visible only to the owning user.
        /// </summary>
        public bool? IsGlobal { get; set; } = true;

        /// <summary>
        /// Owner's UserId.
        /// Null / empty for global events; set to a specific UserId for personal events.
        /// </summary>
        public string? UserId { get; set; }

        /// <summary>Department filter: AVP | WGDE | null (= all departments).</summary>
        public string? Department { get; set; }

        /// <summary>When true the event repeats annually on the same month/day.</summary>
        public bool? IsRecurring { get; set; } = false;

        /// <summary>Optional free-text notes or description.</summary>
        public string? Notes { get; set; }

        // ── Audit ──────────────────────────────────────────────────────────────
        public string?   CreatedBy   { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string?   ModifiedBy  { get; set; }
        public DateTime? ModifiedDate{ get; set; }

        /// <summary>
        /// General-purpose flag for future use (e.g. colour override, linked project UID).
        /// </summary>
        public string? Flag1 { get; set; }
        public string? Flag2 { get; set; }
    }
}
