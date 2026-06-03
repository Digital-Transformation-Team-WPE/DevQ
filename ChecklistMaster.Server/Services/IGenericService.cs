namespace ChecklistMaster.Server.Services
{
    public interface IGenericService<T> where T : class
    {
        Task<IEnumerable<T>> GetAllAsync();
        Task<T?> GetByIdAsync(object id);
        Task<T> CreateAsync(T entity);
        Task<T?> UpdateAsync(object id, T entity);
        Task<bool> DeleteAsync(object id);
    }
}
