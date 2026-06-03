using ChecklistMaster.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ChecklistMaster.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectIssueLink> ProjectIssueLinks { get; set; }
        public DbSet<IssueListDocinfo> IssueListDocinfos { get; set; }
        public DbSet<IssueListPartinfo> IssueListPartinfos { get; set; }
        public DbSet<IssueListHistory> IssueListHistories { get; set; }
        public DbSet<IssueListChecklist> IssueListChecklists { get; set; }
        public DbSet<DmrsChecklist> DmrsChecklists { get; set; }
        public DbSet<ChecklistMasterEntity> ChecklistMasters { get; set; }
        public DbSet<ComponentMetadata> ComponentMetadata { get; set; }
        public DbSet<ChecklistMilestone> ChecklistMilestones { get; set; }
        public DbSet<PartMilestone>      PartMilestones      { get; set; }
        public DbSet<ProjectMilestone>   ProjectMilestones   { get; set; }
        public DbSet<CalendarEvent>      CalendarEvents      { get; set; }
        public DbSet<MilestoneMaster>    MilestoneMasters    { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Project>()
                .Property(p => p.ProjectName)
                .HasColumnName("Project");

            modelBuilder.Entity<IssueListChecklist>()
                .Property(c => c.Checlist_id)
                .HasColumnName("checlist_id");

            modelBuilder.Entity<IssueListChecklist>()
                .Property(c => c.Checklist_Desc)
                .HasColumnName("checklist_Desc");

            // Flag2 and Flag3 on ProjectIssueLink store JSON (part extras + images) — needs max size
            modelBuilder.Entity<ProjectIssueLink>()
                .Property(p => p.Flag2)
                .HasColumnType("nvarchar(max)");

            modelBuilder.Entity<ProjectIssueLink>()
                .Property(p => p.Flag3)
                .HasColumnType("nvarchar(max)");

            // SyncData stores all milestone sync results + comments as JSON
            modelBuilder.Entity<DmrsChecklist>()
                .Property(d => d.SyncData)
                .HasColumnType("nvarchar(max)");
        }
    }
}
