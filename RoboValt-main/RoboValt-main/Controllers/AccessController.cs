using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robot_Program_Validation.EntityModels;
using Robot_Program_Validation.Services;
using Robot_Program_Validation.ViewModels;
using System.Data;

namespace Robot_Program_Validation.Controllers
{
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public class AccessController : Controller
    {
        private readonly RobotProgramValidationContext _db;
        private readonly IGraphDirectoryService _graph;

        public AccessController(RobotProgramValidationContext db, IGraphDirectoryService graph)
        {
            _db = db;
            _graph = graph;
        }

        // -------------------------
        // ACCESS PAGE (Partial)
        // -------------------------
        [HttpGet]
        public IActionResult Access()
        {
            return View(new AccessViewModel());
        }

        // -------------------------
        // AUTOCOMPLETE / SUGGESTIONS
        // -------------------------
        [HttpGet]
        public async Task<IActionResult> SearchSuggestions(string term, string actionType)
        {
            if (string.IsNullOrWhiteSpace(term))
                return Json(Array.Empty<object>());

            term = term.Trim();

            if (string.Equals(actionType, "Existing", StringComparison.OrdinalIgnoreCase))
            {
                var results = await _db.EmployeeTables
                    .Where(e => EF.Functions.Like(e.Name, $"%{term}%"))
                    .Select(e => new
                    {
                        label = $"{e.Name} ({e.EmployeeId})",
                        value = e.Name,             
                        employeeId = e.EmployeeId,   
                        role = e.Role,               
                        //status = e.Status
                    })
                    .Take(10)
                    .ToListAsync();

                return Json(results);
            }
            else
            {
                // For "New" users from Graph (your service)
                var graphUsers = await _graph.SearchUsersAsync(term);
                return Json(graphUsers);
            }
        }

        // -------------------------
        // FILL BY NAME (optional helper for UI)
        // -------------------------
        [HttpGet]
        public async Task<IActionResult> GetEmployeeByName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest("Name is required.");

            var normalized = name.Trim().ToLowerInvariant();

            var emp = await _db.EmployeeTables
                .Where(e => e.Name.Trim().ToLower() == normalized)
                .Select(e => new
                {
                    name = e.Name,
                    employeeId = e.EmployeeId,
                    role = e.Role,
                    //status = e.Status
                })
                .FirstOrDefaultAsync();

            if (emp == null)
                return NotFound();

            return Json(emp);
        }

        // -------------------------
        // ASSIGN ACCESS
        // -------------------------
        [HttpPost]
        public async Task<IActionResult> AssignAccess(AccessViewModel model)
        {
            // Basic validation
            if (string.IsNullOrWhiteSpace(model.EmployeeName))
            {
                TempData["ErrorMessage"] = "Employee Name is required.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }
            if (string.IsNullOrWhiteSpace(model.EmployeeId))
            {
                // You require EmployeeId from selection; if you prefer, generate one here
                TempData["ErrorMessage"] = "Employee ID required.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            var name = model.EmployeeName.Trim();
            var employeeId = model.EmployeeId.Trim();
            var newRole = NormalizeRole(model.Role);
            const string Active = "Active";
            const string Inactive = "Inactive";

            // Find by business EmployeeId
            var existing = await _db.EmployeeTables.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

            // ============================
            // NEW EMPLOYEE (no row by EmployeeId)
            // ============================
            if (existing == null)
            {
                // Try: if there's a row by the same Name (no EmployeeId match), attach this EmployeeId to that row
                var existingByName = await _db.EmployeeTables
                    .FirstOrDefaultAsync(e => e.Name.Trim().ToLower() == name.ToLower());

                // SERIALIZABLE to avoid Id duplicates when using MAX+1
                await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

                try
                {
                    if (existingByName != null)
                    {
                        // Link the ID and update role/status
                        existingByName.EmployeeId = employeeId;
                        existingByName.Role = newRole;
                        existingByName.Status = Active;

                        await _db.SaveChangesAsync();
                        await tx.CommitAsync();

                        TempData["SuccessMessage"] = "Employee linked and updated successfully.";
                        return RedirectToAction("MainPage", "MainPage", new { section = "access" });
                    }
                    else
                    {
                        // Create a brand new row with Id = MAX(Id)+1
                        var nextId = await GetNextIdUnsafeAsync(); // read inside the same transaction

                        var emp = new EmployeeTable
                        {
                            Id = nextId,
                            Name = name,
                            EmployeeId = employeeId,
                            Role = newRole,
                            Status = Active
                        };

                        _db.EmployeeTables.Add(emp);
                        await _db.SaveChangesAsync();
                        await tx.CommitAsync();

                        TempData["SuccessMessage"] = "New Employee Added Successfully.";
                        return RedirectToAction("MainPage", "MainPage", new { section = "access" });
                    }
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync();
                    TempData["ErrorMessage"] = $"Failed to assign access: {ex.Message}";
                    return RedirectToAction("MainPage", "MainPage", new { section = "access" });
                }
            }

       
            var currentStatus = (existing.Status ?? string.Empty).Trim();
            var currentRole = NormalizeRole(existing.Role);

            // If already active with same role → nothing to do
            if (string.Equals(currentStatus, Active, StringComparison.OrdinalIgnoreCase)
                && string.Equals(currentRole, newRole, StringComparison.OrdinalIgnoreCase))
            {
                TempData["ErrorMessage"] = "Access already exists with the same role.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            // If inactive → reactivate (and update role if changed)
            if (string.Equals(currentStatus, Inactive, StringComparison.OrdinalIgnoreCase))
            {
                existing.Status = Active;
                existing.Role = newRole ?? currentRole;
                await _db.SaveChangesAsync();

                TempData["SuccessMessage"] = "Access restored successfully.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            // If active but role different → update role
            if (!string.Equals(currentRole, newRole, StringComparison.OrdinalIgnoreCase))
            {
                existing.Role = newRole;
                // keep Active
                await _db.SaveChangesAsync();

                TempData["SuccessMessage"] = $"Role updated to {existing.Role}.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            // Fallback (should not really hit here)
            TempData["ErrorMessage"] = "No changes applied.";
            return RedirectToAction("MainPage", "MainPage", new { section = "access" });
        }

     
        [HttpPost]    
        public async Task<IActionResult> RevokeAccess(string employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId))
            {
                TempData["ErrorMessage"] = "Employee ID required.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            var emp = await _db.EmployeeTables
                .FirstOrDefaultAsync(e => e.EmployeeId == employeeId.Trim());

            if (emp == null)
            {
                TempData["ErrorMessage"] = "Employee not found.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            if (string.Equals(emp.Status, "Inactive", StringComparison.OrdinalIgnoreCase))
            {
                TempData["ErrorMessage"] = "Employee is already Inactive.";
                return RedirectToAction("MainPage", "MainPage", new { section = "access" });
            }

            emp.Status = "Inactive";
            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = "Access revoked successfully.";
            return RedirectToAction("MainPage", "MainPage", new { section = "access" });
        }

     
        private static string? NormalizeRole(string? role)
        {
            var r = (role ?? string.Empty).Trim().ToLowerInvariant();
            return r switch
            {
                "admin" => "Admin",
                "user" => "User",
                _ => null
            };
        }

      
        private async Task<int> GetNextIdUnsafeAsync()
        {
            int? maxId = await _db.EmployeeTables.MaxAsync(e => (int?)e.Id);
            return (maxId ?? -1) + 1;
        }

        // If you decide to generate a business EmployeeId instead of requiring it:
        private string GenerateEmployeeId()
        {
            var ts = DateTime.Now.ToString("yyyyMMdd-HHmmss");
            var rnd = Guid.NewGuid().ToString("N").Substring(0, 3).ToUpperInvariant();
            return $"EMP{ts}-{rnd}";
        }
    }
}
