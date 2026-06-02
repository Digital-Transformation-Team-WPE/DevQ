using Microsoft.EntityFrameworkCore;

namespace Robot_Program_Validation.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<Employee> Employees => Set<Employee>();
    }
}