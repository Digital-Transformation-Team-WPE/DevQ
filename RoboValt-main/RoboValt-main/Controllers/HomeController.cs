using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Robot_Program_Validation.Models;
using System.Data;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Controllers
{

    public class ProjectTableInfo
    {
        public string project { get; set; }
        public int revision { get; set; }
        public DateTime? createdOn { get; set; }
        public string createdBy { get; set; }
    }

    public class HomeViewModel
    {
        public List<ProjectTableInfo> TableData { get; set; }
        public bool ShowTable { get; set; } = true;
    }

    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private string ConnectionString =
            "Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True";

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        // ============================= HOME PAGE =============================
        public IActionResult Home()
        {
            return View(new HomeViewModel
            {
                TableData = GetProjectTableDataList(),
                ShowTable = true
            });
        }

        // ========================== CREATE PROJECT ==========================
        [HttpPost]
        public IActionResult CreateProject(string projectType, string projectText, string revision)
        {
            if (projectType != "new")
            {
                TempData["Message"] = "  Only NEW projects can be created.";
                return RedirectToAction("MainPage", "MainPage");
            }

            if (string.IsNullOrWhiteSpace(projectText))
            {
                TempData["Message"] = "  Project name required.";
                return RedirectToAction("MainPage", "MainPage");
            }

            if (!int.TryParse(revision, out int rev))
            {
                TempData["Message"] = "  Invalid revision number.";
                return RedirectToAction("MainPage", "MainPage");
            }

            string result = CreateProjectRevisionTable(projectText, rev);

            if (result.StartsWith(" "))
            {
                TempData["Message"] = result;
                return RedirectToAction("MainPage", "MainPage");
            }
            //return RedirectToAction("Dataprocessing", "Dataprocessing");
            return RedirectToAction("Dataprocessing", "Dataprocessing", new { projectSelect = projectText, revision = rev });
        }

        // =========================== VIEW PROJECT ============================
        [HttpPost]
        public IActionResult ViewProject(string projectType, string projectSelect, string revision)
        {
            if (projectType != "existing")
            {
                TempData["Message"] = "  Only EXISTING projects can be viewed.";
                return RedirectToAction("MainPage", "MainPage");
            }

            if (string.IsNullOrWhiteSpace(projectSelect))
            {
                TempData["Message"] = "  Select a project.";
                return RedirectToAction("MainPage", "MainPage");
            }

            if (string.IsNullOrWhiteSpace(revision))
            {
                TempData["Message"] = "  Revision is required.";
                return RedirectToAction("MainPage", "MainPage");
            }

            if (!int.TryParse(revision, out int rev))
            {
                TempData["Message"] = "  Revision must be numeric.";
                return RedirectToAction("MainPage", "MainPage");
            }

            string safe = SafeName(projectSelect);
            string tableName = $"{safe}_{rev}";

            //return RedirectToAction("Dataprocessing", "Dataprocessing");
            return RedirectToAction("Dataprocessing", "Dataprocessing", new { projectSelect = projectSelect, revision = revision });
        }

        // ======================= AUTO NEXT REVISION ===========================
        public JsonResult GetNextRevision(string projectName)
        {
            if (string.IsNullOrWhiteSpace(projectName))
                return Json(1);

            string safe = SafeName(projectName);
            int maxRev = 0;

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                string sql = @"
                    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA='dbo'
                      AND TABLE_NAME LIKE @p + '\_%' ESCAPE '\'
                ";

                using (SqlCommand cmd = new SqlCommand(sql, con))
                {
                    cmd.Parameters.AddWithValue("@p", safe);

                    using (SqlDataReader dr = cmd.ExecuteReader())
                    {
                        while (dr.Read())
                        {
                            string table = dr.GetString(0);

                            if (!table.StartsWith(safe + "_")) continue;

                            int idx = table.LastIndexOf('_');

                            if (idx > 0 &&
                                int.TryParse(table.Substring(idx + 1), out int revision))
                            {
                                maxRev = Math.Max(maxRev, revision);
                            }
                        }
                    }
                }
            }

            return Json(maxRev == 0 ? 1 : maxRev + 1);
        }

        // ============================ GET PROJECTS ============================
        public JsonResult GetProjects()
        {
            var list = new HashSet<string>();

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                using (SqlCommand cmd = new SqlCommand(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo'", con))
                using (SqlDataReader dr = cmd.ExecuteReader())
                {
                    while (dr.Read())
                    {
                        string name = dr.GetString(0);

                        int idx = name.LastIndexOf("_");
                        if (idx > 0)
                        {
                            list.Add(name[..idx]);
                        }
                    }
                }
            }

            return Json(list.OrderBy(x => x).ToList());
        }

        // =========================== GET REVISIONS =============================
        public JsonResult GetRevisions(string projectName)
        {
            var revisions = new List<int>();

            if (string.IsNullOrWhiteSpace(projectName))
                return Json(revisions);

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                string sql = @"
                    SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA='dbo'
                      AND TABLE_NAME LIKE @p + '\_%' ESCAPE '\'
                ";

                using (SqlCommand cmd = new SqlCommand(sql, con))
                {
                    cmd.Parameters.AddWithValue("@p", projectName);

                    using (SqlDataReader dr = cmd.ExecuteReader())
                    {
                        while (dr.Read())
                        {
                            string tableName = dr.GetString(0);

                            if (!tableName.StartsWith(projectName + "_")) continue;

                            int idx = tableName.LastIndexOf('_');

                            if (idx > 0 &&
                                int.TryParse(tableName[(idx + 1)..], out int rev))
                            {
                                revisions.Add(rev);
                            }
                        }
                    }
                }
            }

            return Json(revisions.Distinct().OrderBy(x => x).ToList());
        }

        // ======================= CREATE NEW PROJECT TABLE ======================
        private string CreateProjectRevisionTable(string projectName, int revision)
        {
            string safe = SafeName(projectName);
            string newTable = $"{safe}_{revision}";

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                // 1️⃣ CHECK IF TABLE ALREADY EXISTS
                using (SqlCommand cmd = new SqlCommand(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=@t", con))
                {
                    cmd.Parameters.AddWithValue("@t", newTable);

                    if ((int)cmd.ExecuteScalar() > 0)
                        return $"ℹ Table '{newTable}' already exists.";
                }

                // 2️⃣ COPY MASTER DB TABLE
                using (SqlCommand cmd = new SqlCommand(
                    $"SELECT * INTO dbo.[{newTable}] FROM dbo.[MASTER DB];", con))
                {
                    cmd.ExecuteNonQuery();
                }

                // 3️⃣ GET NEXT AVAILABLE ID
                int nextId = 1;
                using (SqlCommand cmd = new SqlCommand(
                    "SELECT ISNULL(MAX(Id),0) + 1 FROM dbo.[Project Details]", con))
                {
                    nextId = (int)cmd.ExecuteScalar();
                }

                // 4️⃣ INSERT INTO PROJECT DETAILS
                //string createdBy = HttpContext.Session.GetString("EmpName") ?? "SYSTEM";



                // Get from session or default
                var empRaw = HttpContext.Session.GetString("EmpName");
                var createdBy = string.IsNullOrWhiteSpace(empRaw) ? "SYSTEM" : empRaw.Trim();

                // Split on any non-letter/digit (Unicode-aware). This includes spaces, underscores, hyphens, commas, etc.
                var tokens = Regex
                    .Split(createdBy, @"[^\p{L}\p{N}]+")
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToArray();

                // If we have at least one token after split, take the first (index 0); otherwise, keep original.
                var createdByFirst = tokens.Length > 0 ? tokens[0] : createdBy;


                using (SqlCommand cmd = new SqlCommand(@"
                INSERT INTO dbo.[Project Details]
                (Id, [Project Name], Revision, [Created By], [Created On])
                VALUES (@id, @p, @r, @c, @d)", con))
                {
                    cmd.Parameters.AddWithValue("@id", nextId);
                    cmd.Parameters.AddWithValue("@p", projectName);
                    cmd.Parameters.AddWithValue("@r", revision);
                    cmd.Parameters.AddWithValue("@c", createdByFirst);
                    cmd.Parameters.AddWithValue("@d", DateTime.Now);

                    cmd.ExecuteNonQuery();
                }
            }

            return newTable;
        }

        // Clean safe table name
        private string SafeName(string name)
        {
            return Regex.Replace(name, @"[^a-zA-Z0-9_]", "");
        }

        // ======================== EXISTING PROJECT TABLE ========================
        private List<ProjectTableInfo> GetProjectTableDataList()
        {
            var list = new List<ProjectTableInfo>();

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                using (SqlCommand cmd = new SqlCommand(
                    @"SELECT [Project Name], Revision, [Created By], [Created On] 
                      FROM dbo.[Project Details] 
                      ORDER BY [Project Name], Revision", con))
                using (SqlDataReader dr = cmd.ExecuteReader())
                {
                    while (dr.Read())
                    {
                        list.Add(new ProjectTableInfo
                        {
                            project = dr.GetString(0).Trim(),
                            revision = int.Parse(dr.GetString(1).Trim()),
                            createdBy = dr.GetString(2).Trim(),
                            createdOn = DateTime.Parse(dr.GetString(3).Trim())
                        });
                    }
                }
            }

            return list;
        }

        public JsonResult GetProjectTableData()
        {
            return Json(GetProjectTableDataList());
        }


        public JsonResult GetProjectRevisionGraph()
        {
            var data = new List<object>();

            using (SqlConnection con = new SqlConnection(ConnectionString))
            {
                con.Open();

                using (SqlCommand cmd = new SqlCommand(@"
                    SELECT 
                        [Project Name], 
                        Revision, 
                        COUNT(*) AS CNT
                    FROM dbo.[Project Details]
                    GROUP BY [Project Name], Revision
                    ORDER BY [Project Name], Revision
                ", con))
                using (SqlDataReader dr = cmd.ExecuteReader())
                {
                    while (dr.Read())
                    {
                        data.Add(new
                        {
                            label = dr.GetString(0).Trim() + " - Rev " + dr.GetString(1).Trim(),
                            count = (int)dr["CNT"]
                        });
                    }
                }
            }

            return Json(data);
        }
    }
}