using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Collections.Generic;

namespace Robot_Program_Validation.Controllers
{
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public class MainPageController : Controller
    {
        private bool IsLoggedIn() =>
            !string.IsNullOrEmpty(HttpContext.Session.GetString("EmpId"));

        private void LoadEmployeeIntoViewBag()
        {
            ViewBag.EmpName = HttpContext.Session.GetString("EmpName");
            ViewBag.EmpId = HttpContext.Session.GetString("EmpId");
            ViewBag.EmpRole = HttpContext.Session.GetString("EmpRole");
        }

        // =============================
        // MAIN PAGE SHELL
        // =============================
        public IActionResult MainPage()
        {
            if (!IsLoggedIn())
                return RedirectToAction("Loginpage", "Login");
            LoadEmployeeIntoViewBag();
            return View();
        }

        // =============================
        //  SPA LOADER — ALWAYS RETURNS PARTIAL + DATA
        // =============================
        [HttpGet]
        public IActionResult LoadSection(string section, string? selectedDb = "Master", string? project = null, string? revision = null)
        {
            if (!IsLoggedIn())
                return Unauthorized("Session expired");

            if (string.IsNullOrWhiteSpace(section))
                section = "home";

            LoadEmployeeIntoViewBag();

            switch (section.ToLowerInvariant())
            {
                case "home":
                    //return RedirectToAction("~/Views/Home/Home.cshtml");
                    return RedirectToAction("Home,Home");
                case "access":                   
                    return RedirectToAction("Access","Access");
                case "database":                  
                    return RedirectToAction("Database", "Database");
                case "comparison":
                    return PartialView("~/Views/Comparison/Comparison.cshtml");
                case "settings":
                    return PartialView("~/Views/Settings/Settings.cshtml");
                default:
                    return NotFound("Section not found");
            }
        }
        


        // =============================
        // LOGOUT
        // =============================
        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Loginpage", "Login");
        }
    }
}