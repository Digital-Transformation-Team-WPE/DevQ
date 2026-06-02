using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robot_Program_Validation.EntityModels;

namespace Robot_Program_Validation.Controllers
{
    public class LoginController : Controller
    {
        private readonly RobotProgramValidationContext _context;

        //   Use DI instead of new()
        public LoginController(RobotProgramValidationContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Loginpage()
        {
            // If already logged in, you can redirect to main
            if (!string.IsNullOrEmpty(HttpContext.Session.GetString("EmpId")))
            {
                return RedirectToAction("MainPage", "MainPage");
            }
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken] //   Anti-forgery protection
        public async Task<IActionResult> CheckLoginpage(string employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId))
            {
                ViewBag.Error = "Please enter Employee ID";
                return View("Loginpage");
            }

            employeeId = employeeId.Trim();

           

            var emp = await _context.EmployeeTables.AsNoTracking()
                .FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

            if (emp == null)
            {
                ViewBag.Error = "Invalid Employee ID";
                return View("Loginpage");
            }

            // Optional: block inactive users
            if (!string.IsNullOrWhiteSpace(emp.Status) &&
                emp.Status.Equals("Inactive", StringComparison.OrdinalIgnoreCase))
            {
                ViewBag.Error = "Your access is Inactive. Please contact the administrator.";
                return View("Loginpage");
            }

            //   Set session
            HttpContext.Session.SetString("EmpName", emp.Name ?? "");
            HttpContext.Session.SetString("EmpId", emp.EmployeeId ?? "");
            HttpContext.Session.SetString("EmpRole", emp.Role ?? "");
            HttpContext.Session.SetString("IsAuthenticated", "true");

            // No-cache headers (also consider adding globally for protected routes)
            Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
            Response.Headers["Pragma"] = "no-cache";
            Response.Headers["Expires"] = "0";

            return RedirectToAction("MainPage", "MainPage");

        }

        //[HttpGet]
        //public IActionResult Logout()
        //{
        //    HttpContext.Session.Clear();

        //    Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
        //    Response.Headers["Pragma"] = "no-cache";
        //    Response.Headers["Expires"] = "0";

        //    return RedirectToAction("Loginpage");
        //}

        [HttpPost]
        public IActionResult Logout()
        {
            HttpContext.Session.Clear();

            Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
            Response.Headers["Pragma"] = "no-cache";
            Response.Headers["Expires"] = "0";

            return RedirectToAction("Loginpage");
        }


    }
}