using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Query.Internal;
using Robot_Program_Validation.Services;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Robot_Program_Validation.Controllers
{

    public class DataProcessingController : Controller
    {
        private readonly IWebHostEnvironment _env;
        private readonly string _connectionString;
        private readonly RobotValidationMLService _mlService;

        public DataProcessingController(IWebHostEnvironment env, RobotValidationMLService mlService, IConfiguration configuration)
        {
            _env = env;
            _mlService = mlService;
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True";
        }

        // Renders the page
        [HttpGet]
        public IActionResult Dataprocessing(string projectSelect, string revision)
        {
            ViewBag.Project = projectSelect;
            ViewBag.Revision = revision;
            return View();
        }

        // Returns the table HTML
        [HttpGet]
        public IActionResult LoadProjectTable(string projectSelect, string revision)
        {
            
            // Sanitize and build table name
            string safeProject = SafeName(projectSelect);
            string safeRevision = SafeName(revision);
            string tableName = $"{safeProject}_{safeRevision}";

            DataTable dt = new DataTable();

            using (SqlConnection con = new SqlConnection(_connectionString))
            {
                con.Open();

                // IMPORTANT: enforce a stable ordering
                string query = $"SELECT * FROM [{tableName}] ORDER BY [ID]";

                using (SqlDataAdapter da = new SqlDataAdapter(query, con))
                {
                    da.Fill(dt);
                }
            }
            return PartialView("_ProjectTable", dt);
        }

      
        private string SafeName(string input)
        {
            return Regex.Replace(input ?? string.Empty, "[^a-zA-Z0-9_]", "");
        }
        // --------------------------------------------------------------------
        //  ML Processing
        // --------------------------------------------------------------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ProcessWithML([FromForm] ProcessMLRequest request)
        {
            try
            {
                // Validate request
                if (request == null)
                {
                    return Json(new { ok = false, message = "Invalid request" });
                }

                if (request.Files == null || request.Files.Count == 0)
                {
                    return Json(new { ok = false, message = "No files uploaded. Please upload the files." });
                }

                // Sanitize / normalize table name from request
                string safeTableName = SafeName(request.TableName);

                if (string.IsNullOrWhiteSpace(safeTableName))
                {
                    return Json(new { ok = false, message = "Invalid table name." });
                }

                // Create temporary folder for uploaded files
                string baseUploadPath = Path.Combine(_env.WebRootPath ?? Directory.GetCurrentDirectory(), "uploads");
                Directory.CreateDirectory(baseUploadPath);
                string folderSafe = SafeName(request.FolderPath);
                string tempFolder = Path.Combine(baseUploadPath, folderSafe + "_" + DateTime.Now.Ticks);
                Directory.CreateDirectory(tempFolder);

                try
                {
                    // Save uploaded files to temporary folder
                    foreach (var file in request.Files)
                    {
                        if (file != null && file.Length > 0)
                        {
                            // Just use FileName here (no nested folder structure from client)
                            string safeFileName = Path.GetFileName(file.FileName);
                            string filePath = Path.Combine(tempFolder, safeFileName);

                            using (var stream = new FileStream(filePath, FileMode.Create))
                            {
                                await file.CopyToAsync(stream);
                            }
                        }
                    }

                    // Parse table rows from JSON
                    List<TableRowData> rows1 = string.IsNullOrWhiteSpace(request.TableJson)
                        ? new List<TableRowData>()
                        : JsonSerializer.Deserialize<List<TableRowData>>(
                            request.TableJson,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                          ) ?? new List<TableRowData>();

                                      
                    //Processing Deleting and updating the data
                    try
                    {
                        //Updating the Program DB Data...
                        List<ProgramDbData> Updated_Programdb_Data = UpdateProgramdatabase(rows1, request.Files);
                        //Deleting the Existing rows before updating the table 
                        using (SqlConnection con = new SqlConnection(_connectionString))
                        {
                            con.Open();

                            using (SqlCommand cmd = new SqlCommand(
                                $"DELETE FROM [dbo].[{request.TableName}];", con))
                            {
                                cmd.ExecuteNonQuery();

                            }
                            con.Close();
                        }
                        //Update the New datatable to the program table 
                        UpdateRows(Updated_Programdb_Data, request.TableName);
                    }
                    catch (Exception)
                    {

                        throw;
                    }

                    //Load the Updated table to display in the front page...
                    string[] split = request.TableName.Split('_');
                    LoadProjectTable(split[0], split[1]); 
                    
                    // Extract app name from ROBID.DT file
                    string appName = ExtractAppNameFromRobidFile(tempFolder) ?? "Unknown";
                    
                    //Collecting the Updated data to share the data the ML service model
                    List<TableRowData> rows = GetRows(_connectionString,request.TableName);
                    if (!rows.Any())
                    {
                        return Json(new { ok = false, message = "No rows to process." });
                    }

                    var results = new List<ProcessingResult>();
                    // Process each row via ML service
                    foreach (var row in rows)
                    {
                        if (row == null)
                            continue;

                        try
                        {
                            var validationResult = await _mlService.SearchCommandInFilesAsync(tempFolder,row.FilesRequiringVerification,row.WhatToCheck,row.Logic);

                            var processingResult = new ProcessingResult
                            {
                                RowId = row.Id,
                                Status = validationResult.Status,
                                StatusColor = validationResult.StatusColor,
                                Summary = validationResult.Summary,
                                FilesSearched = validationResult.FilesSearched,
                                FilesFound = validationResult.FilesFound,
                                FilesNotFound = validationResult.FilesNotFound

                            };

                            results.Add(processingResult);
                        }
                        catch (Exception ex)
                        {
                            results.Add(new ProcessingResult
                            {
                                RowId = row.Id,
                                Status = "NA",
                                StatusColor = "danger",
                                Summary = $"Error: {ex.Message}",
                                FilesSearched = 0,
                                FilesFound = 0,
                                FilesNotFound = 0
                            });
                        }
                    }

                    // Update DB rows with result
                    try
                    {
                        foreach (var item in results)
                        {
                            if (!string.IsNullOrWhiteSpace(item.RowId))
                            {
                                UpdateRowStatus(safeTableName, item.RowId, item.Status, item.Summary);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log and continue
                        Console.WriteLine($"Failed to update some rows: {ex.Message}");
                    }

                    // Return summary response
                    return Json(new
                    {
                        ok = true,
                        message = $"Processed {results.Count} rows successfully.    app name: {appName}",
                        results = results,
                        reload = true
                    });
                }
                finally
                {
                    // Clean up temporary files after processing
                    try
                    {
                        if (Directory.Exists(tempFolder))
                        {
                            Directory.Delete(tempFolder, true);
                        }
                    }
                    catch
                    {
                       
                    }
                }
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, message = $"Processing failed: {ex.Message}" });
            }
        }

        public  List<TableRowData> GetRows(string connectionString, string tableName)
        {
            try
            {
                //   Validate table name (basic safety). Ideally whitelist allowed names.
                if (!IsSafeSqlIdentifier(tableName))
                    throw new ArgumentException("Invalid table name.", nameof(tableName));

                var results = new List<TableRowData>();

                var sql = $@"
                SELECT 
                    [ID],
                    [Files Requiring Verification],
                    [What to Check],
                    [Logic],
                    [Standard],
                    [Document],
                    [Item ID],
                    [Sub Item ID],
                    [Checkpoint Description],
                    [Files to check],
                    [Search Criteria],
                    [Expected Output]
                FROM dbo.[{tableName}];";

                using var con = new SqlConnection(connectionString);
                using var cmd = new SqlCommand(sql, con);
                con.Open();

                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    results.Add(new TableRowData
                    {
                        Id = reader["ID"]?.ToString() ?? "",
                        FilesRequiringVerification = reader["Files Requiring Verification"]?.ToString() ?? "",
                        WhatToCheck = reader["What to Check"]?.ToString() ?? "",
                        Logic = reader["Logic"]?.ToString() ?? "",
                        Standard = reader["Standard"]?.ToString() ?? "",
                        Document = reader["Document"]?.ToString() ?? "",
                        ItemID = reader["Item ID"]?.ToString() ?? "",
                        Sub_ItemID = reader["Sub Item ID"]?.ToString() ?? "",
                        Checkpoint_Description = reader["Checkpoint Description"]?.ToString() ?? "",
                        FilesTocheck = reader["Files to check"]?.ToString() ?? "",
                        Search_criteria = reader["Search Criteria"]?.ToString() ?? "",
                        Expected_output = reader["Expected Output"]?.ToString() ?? ""
                    });
                }
                con.Close();
                return results;
            }
            catch (Exception ex)
            {

                throw ex;
            }
           
        }

        // Allows letters, digits, underscore only. Adjust if your table names use other characters.
        private static bool IsSafeSqlIdentifier(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            foreach (var ch in name)
            {
                if (!(char.IsLetterOrDigit(ch) || ch == '_'))
                    return false;
            }
            return true;
        }



        public void UpdateRows(List<ProgramDbData> data, string tableNameRaw)
        {
            if (data == null || data.Count == 0)
                return;

            // Ensure proper table name: supports "MASTER DB"
            string tableName = $"[dbo].[{tableNameRaw.Replace("[", "").Replace("]", "")}]";

            string insertQuery = $@"
            INSERT INTO {tableName}
            (
                [ID],
                [Standard],
                [Document],
                [Item ID],
                [Sub Item ID],
                [Checkpoint Description],
                [Files to check],
                [Search Criteria],
                [Expected Output],
                [Files Requiring Verification],
                [What to Check],
                [How to Check],
                [Logic],
                [Status],
                [Validation Summary]
            )
            VALUES
            (
                @ID,
                @Standard,
                @Document,
                @Item_ID,
                @Sub_ItemID,
                @Checkpoint_Description,
                @Files_to_check,
                @Search_Criteria,
                @Expected_Output,
                @Files_Requiring_Verification,
                @What_to_Check,
                @How_to_Check,
                @Logic,
                @Status,
                @ValidationSummary
            );";

            using (SqlConnection con = new SqlConnection(_connectionString))
            {
                con.Open();

                using (SqlCommand cmd = new SqlCommand(insertQuery, con))
                {
                    // Define parameters ONCE
                    cmd.Parameters.Add("@ID", SqlDbType.Float);
                    cmd.Parameters.Add("@Sub_ItemID", SqlDbType.Float);

                    cmd.Parameters.Add("@Standard", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Document", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Item_ID", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Checkpoint_Description", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Files_to_check", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Search_Criteria", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Expected_Output", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Files_Requiring_Verification", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@What_to_Check", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@How_to_Check", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Logic", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@Status", SqlDbType.NVarChar, 255);
                    cmd.Parameters.Add("@ValidationSummary", SqlDbType.NVarChar, 1000);

                    foreach (var item in data)
                    {
                        // FLOAT columns
                        cmd.Parameters["@ID"].Value =
                            string.IsNullOrWhiteSpace(item.ID) ? DBNull.Value : Convert.ToDouble(item.ID);

                        cmd.Parameters["@Sub_ItemID"].Value =
                            string.IsNullOrWhiteSpace(item.Sub_ItemID) ? DBNull.Value : Convert.ToDouble(item.Sub_ItemID);

                        // NVARCHAR columns
                        cmd.Parameters["@Standard"].Value = (object?)item.Standard ?? DBNull.Value;
                        cmd.Parameters["@Document"].Value = (object?)item.Document ?? DBNull.Value;
                        cmd.Parameters["@Item_ID"].Value = (object?)item.ItemID ?? DBNull.Value;
                        cmd.Parameters["@Checkpoint_Description"].Value = (object?)item.Checkpoint_Description ?? DBNull.Value;
                        cmd.Parameters["@Files_to_check"].Value = (object?)item.FilesTocheck ?? DBNull.Value;
                        cmd.Parameters["@Search_Criteria"].Value = (object?)item.Search_criteria ?? DBNull.Value;
                        cmd.Parameters["@Expected_Output"].Value = (object?)item.Expected_output ?? DBNull.Value;
                        cmd.Parameters["@Files_Requiring_Verification"].Value = (object?)item.FilesRequiringvalidation ?? DBNull.Value;
                        cmd.Parameters["@What_to_Check"].Value = (object?)item.What_to_check ?? DBNull.Value;

                        // Optional / empty fields
                        cmd.Parameters["@How_to_Check"].Value = DBNull.Value;
                        cmd.Parameters["@Logic"].Value = (object?)item.Logic ?? DBNull.Value;
                        cmd.Parameters["@Status"].Value = DBNull.Value;
                        cmd.Parameters["@ValidationSummary"].Value = DBNull.Value;

                        cmd.ExecuteNonQuery();
                    }
                }
            }
        }


        private void UpdateRowStatus(string tableName, string rowId, string status, string summary)
        {
            try
            {
                if (!int.TryParse(rowId, out int id))
                {
                    Console.WriteLine($"Invalid rowId: {rowId}");
                    return;
                }

                string safeTableName = SafeName(tableName);

                if (string.IsNullOrWhiteSpace(safeTableName))
                {
                    Console.WriteLine($"Invalid table name: {tableName}");
                    return;
                }

                string query =
                    $"UPDATE [{safeTableName}] " +
                    "SET [Status] = @Status, [Validation Summary] = @Summary " +
                    "WHERE [ID] = @Id";

                using (SqlConnection con = new SqlConnection(_connectionString))
                {
                    con.Open();
                    using (SqlCommand cmd = new SqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@Id", id);
                        cmd.Parameters.AddWithValue("@Status", status ?? string.Empty);
                        cmd.Parameters.AddWithValue("@Summary", summary ?? string.Empty);
                        cmd.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                // Log error but don't throw - continue processing other rows
                Console.WriteLine($"Failed to update row {rowId}: {ex.Message}");
            }
        }

        // --------------------------------------------------------------------
        // Optional: old ProjectTableRow model (kept if you still need it later)
        // --------------------------------------------------------------------
        public class ProjectTableRow
        {
            public string ID { get; set; } = "";
            public string File_Requiring_Validation { get; set; } = "";
            public string What_To_Check { get; set; } = "";
            public string How_To_Check { get; set; } = "";
            public string Logic { get; set; } = "";
        }

        public sealed class ProgramDbData
        {
            public string ID { get; set; }
            public string Standard { get; set; }
            public string Document { get; set; }
            public string ItemID { get; set; }
            public string Sub_ItemID { get; set; }
            public string Checkpoint_Description { get; set; }
            public string FilesTocheck { get; set; }
            public string Search_criteria { get; set; }
            public string Expected_output { get; set; }
            public string FilesRequiringvalidation { get; set; }
            public string What_to_check { get; set; }
            public string Logic { get; set; }
        }

        //List<ProgramDbData> ProgramDB_Data = new();
        

        private List<ProgramDbData> UpdateProgramdatabase(List<TableRowData> rowDatas, List<IFormFile> files)
        {
            var result = new List<ProgramDbData>();
            int id = 0;

            foreach (var row in rowDatas ?? new List<TableRowData>())
            {
                id++;

                // Null-safe
                var patternInput = (row.FilesRequiringVerification ?? string.Empty).Trim();

                // Split by comma to handle multiple patterns (e.g., "PAYLOAD.DT , TRAJ*.LS")
                var patterns = patternInput.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (patterns.Count == 0)
                {
                    continue; // Skip empty patterns
                }

                // Expand each pattern to actual filenames
                var expandedPatterns = new List<List<string>>();
                foreach (var pattern in patterns)
                {
                    var expanded = ExpandPattern(pattern, files);
                    if (expanded.Count > 0)
                    {
                        expandedPatterns.Add(expanded);
                    }
                }

                // If no patterns expanded, create a row with the original pattern
                if (expandedPatterns.Count == 0)
                {
                    result.Add(new ProgramDbData
                    {
                        ID = id.ToString(),
                        Standard = row.Standard,
                        Document = row.Document,
                        ItemID = row.ItemID,
                        Sub_ItemID = row.Sub_ItemID,
                        Checkpoint_Description = row.Checkpoint_Description,
                        FilesTocheck = row.FilesTocheck,
                        Search_criteria = row.Search_criteria,
                        Expected_output = row.Expected_output,
                        FilesRequiringvalidation = patternInput,
                        What_to_check = row.WhatToCheck,
                        Logic = row.Logic
                    });
                    id++;
                    continue;
                }

                // Generate all combinations (Cartesian product)
                var combinations = GenerateCombinations(expandedPatterns);
                foreach (var combination in combinations)
                {
                    var combinedFilename = string.Join(" , ", combination);
                    result.Add(new ProgramDbData
                    {
                        ID = id.ToString(),
                        Standard = row.Standard,
                        Document = row.Document,
                        ItemID = row.ItemID,
                        Sub_ItemID = row.Sub_ItemID,
                        Checkpoint_Description = row.Checkpoint_Description,
                        FilesTocheck = row.FilesTocheck,
                        Search_criteria = row.Search_criteria,
                        Expected_output = row.Expected_output,
                        FilesRequiringvalidation = combinedFilename,
                        What_to_check = row.WhatToCheck,
                        Logic = row.Logic
                    });
                    id++;
                }
            }

            // Deduplication: Remove rows with identical values (except ID and Sub_ItemID)
            var deduplicated = DeduplicateRows(result);

            return deduplicated;
        }

        /// <summary>
        /// Expands a single pattern (e.g., "TRAJ*.LS" or "PAYLOAD.DT") to matching filenames
        /// If pattern contains *, returns matching files
        /// If pattern is literal, returns it as-is
        /// </summary>
        private List<string> ExpandPattern(string pattern, List<IFormFile> files)
        {
            if (!pattern.Contains('*'))
            {
                // Literal filename - return as-is
                return new List<string> { pattern };
            }

            // Pattern with wildcard - find matching files
            var key = pattern.Split('*', StringSplitOptions.RemoveEmptyEntries)
                             .FirstOrDefault()?.Trim() ?? string.Empty;
            string extension = Path.GetExtension(pattern).TrimStart('.');

            var matchedFiles = (files ?? new List<IFormFile>())
                .Where(f =>
                {
                    var baseName = Path.GetFileNameWithoutExtension(f.FileName) ?? string.Empty;
                    var fileExt = Path.GetExtension(f.FileName).TrimStart('.').ToLowerInvariant();

                    bool keyMatch = string.IsNullOrWhiteSpace(key) ||
                                    baseName.StartsWith(key, StringComparison.OrdinalIgnoreCase);

                    bool extMatch = string.IsNullOrWhiteSpace(extension) ||
                                    fileExt.Equals(extension, StringComparison.OrdinalIgnoreCase);

                    return keyMatch && extMatch;
                })
                .Select(f => Path.GetFileName(f.FileName))
                .ToList();

            return matchedFiles.Count > 0 ? matchedFiles : new List<string> { pattern };
        }

        /// <summary>
        /// Generates all combinations (Cartesian product) from expanded pattern lists
        /// E.g., [[AUTO1.LS, AUTO2.LS], [TRAJ1.LS, TRAJ3.LS]] 
        /// → [[AUTO1.LS, TRAJ1.LS], [AUTO1.LS, TRAJ3.LS], [AUTO2.LS, TRAJ1.LS], [AUTO2.LS, TRAJ3.LS]]
        /// </summary>
        private List<List<string>> GenerateCombinations(List<List<string>> expandedPatterns)
        {
            if (expandedPatterns.Count == 0)
                return new List<List<string>>();

            var result = new List<List<string>> { new List<string>() };

            foreach (var patternList in expandedPatterns)
            {
                var newResult = new List<List<string>>();
                foreach (var existing in result)
                {
                    foreach (var item in patternList)
                    {
                        var newCombination = new List<string>(existing) { item };
                        newResult.Add(newCombination);
                    }
                }
                result = newResult;
            }

            return result;
        }

        private string ExtractAppNameFromRobidFile(string folderPath)
        {
            try
            {
                var robidFiles = Directory.GetFiles(folderPath, "*ROBID*", SearchOption.TopDirectoryOnly)
                    .Union(Directory.GetFiles(folderPath, "*ROB_ID*", SearchOption.TopDirectoryOnly))
                    .FirstOrDefault();

                if (string.IsNullOrWhiteSpace(robidFiles))
                    return null;

                var content = System.IO.File.ReadAllText(robidFiles);
                var match = Regex.Match(content, @"app_nam\s*=\s*([^\s,;]+)", RegexOptions.IgnoreCase);

                return match.Success ? match.Groups[1].Value.Trim() : null;
            }
            catch
            {
                return null;
            }
        }

        private List<ProgramDbData> DeduplicateRows(List<ProgramDbData> rows)
        {
            var seen = new HashSet<string>();
            var dedupedRows = new List<ProgramDbData>();

            foreach (var row in rows)
            {
                // Create a composite key of all properties except ID and Sub_ItemID
                var rowKey = $"{row.Standard}|{row.Document}|{row.ItemID}|" +
                             $"{row.Checkpoint_Description}|{row.FilesTocheck}|{row.Search_criteria}|" +
                             $"{row.Expected_output}|{row.FilesRequiringvalidation}|{row.What_to_check}|{row.Logic}";

                // If this exact row hasn't been seen before, add it
                if (seen.Add(rowKey))
                {
                    dedupedRows.Add(row);
                }
                // Otherwise, it's a duplicate - skip it
            }

            // Renumber IDs sequentially starting from 1
            for (int i = 0; i < dedupedRows.Count; i++)
            {
                dedupedRows[i].ID = (i + 1).ToString();
            }

            return dedupedRows;
        }


        



        


      


        



    }






    // ------------------------------------------------------------------------
    // Request / DTO classes
    // ------------------------------------------------------------------------
    public class ProcessMLRequest
    {
        public string FolderPath { get; set; } = "";
        public string TableName { get; set; } = "";
        public string TableJson { get; set; } = "";
        public List<IFormFile> Files { get; set; } = new();
    }

    public class TableRowData
    {
        public string Id { get; set; } = "";
        public string FilesRequiringVerification { get; set; } = "";
        public string WhatToCheck { get; set; } = "";
        public string Logic { get; set; } = "";
        public string Standard { get; set; } = "";
        public string Document { get; set; } = "";
        public string ItemID { get; set; } = "";
        public string Sub_ItemID { get; set; } = "";
        public string Checkpoint_Description { get; set; } = "";
        public string FilesTocheck { get; set; } = "";
        public string Search_criteria { get; set; } = "";
        public string Expected_output { get; set; } = "";
    }

    public class ProcessingResult
    {
        public string RowId { get; set; } = "";
        public string Status { get; set; } = "";
        public string StatusColor { get; set; } = "";
        public string Summary { get; set; } = "";
        public int FilesSearched { get; set; }
        public int FilesFound { get; set; }
        public int FilesNotFound { get; set; }
    }

    
    
}
