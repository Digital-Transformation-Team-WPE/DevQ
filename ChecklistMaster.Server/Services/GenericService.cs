using ChecklistMaster.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ChecklistMaster.Server.Services
{
    public class GenericService<T> : IGenericService<T> where T : class
    {
        protected readonly AppDbContext _context;
        private readonly DbSet<T> _dbSet;

        public GenericService(AppDbContext context)
        {
            _context = context;
            _dbSet = context.Set<T>();
        }

        public async Task<IEnumerable<T>> GetAllAsync() =>
            await _dbSet.AsNoTracking().ToListAsync();

        public async Task<T?> GetByIdAsync(object id) =>
            await _dbSet.FindAsync(id);

        public async Task<T> CreateAsync(T entity)
        {
            await _dbSet.AddAsync(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public virtual async Task<T?> UpdateAsync(object id, T entity)
        {
            var existing = await _dbSet.FindAsync(id);
            if (existing is null) return null;
            _context.Entry(existing).CurrentValues.SetValues(entity);
            await _context.SaveChangesAsync();
            return existing;
        }

        public virtual async Task<bool> DeleteAsync(object id)
        {
            var existing = await _dbSet.FindAsync(id);
            if (existing is null) return false;
            _dbSet.Remove(existing);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
