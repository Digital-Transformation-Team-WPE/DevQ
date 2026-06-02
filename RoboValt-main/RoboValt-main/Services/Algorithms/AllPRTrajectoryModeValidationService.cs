using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Robot_Program_Validation.Services;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// ============================================================================
    /// ALL PR TRAJECTORY MODE VALIDATION SERVICE
    /// 
    /// WHEN TO CALL:
    /// - Logic column = "All_PR_Traj_Joint" or "All_PR_Traj_Cartesian"
    /// 
    /// VALIDATES:
    /// - Extracts ALL Position Registers (PRs) from trajectory file
    /// - Validates each PR exists in POSREG.VA
    /// - Checks if each PR matches the expected mode (JOINT or CARTESIAN)
    /// 
    /// RESULT STATUS:
    /// - OK: All PRs exist and are in the expected mode
    /// - NOK: One or more PRs missing or in wrong mode
    /// - NA: No trajectory files matched pattern
    /// - ERROR: POSREG.VA not found or other errors
    /// 
    /// DATABASE COLUMNS USED FOR INPUT:
    /// - Files Requiring Verification: "POSREG.VA, TRAJ100.SRC" (comma-separated, POSREG.VA and trajectory file)
    /// - What to Check: Not used (can be empty)
    /// - Logic: Must = "All_PR_Traj_Joint" or "All_PR_Traj_Cartesian" tab-separated format
    /// 
    /// DATABASE COLUMNS UPDATED WITH RESULT:
    /// - Status: OK/NOK/ERROR/NA (displayed in UI)
    /// - Summary: Validation result message
    /// ============================================================================
    /// </summary>
    public static class AllPRTrajectoryModeValidationService
    {
        public class ValidationResult
        {
            public string Status { get; set; } = "";
            public string StatusColor { get; set; } = "";
            public int FilesSearched { get; set; }
            public int FilesFound { get; set; }
            public int FilesNotFound { get; set; }
            public string Summary { get; set; } = "";
            public List<FileSearchResult> FileResults { get; set; } = new();
            public string CommandSearched { get; set; } = "";
            public string FolderPath { get; set; } = "";
            public DateTime ProcessedAt { get; set; }
        }

        public class FileSearchResult
        {
            public string FileName { get; set; } = "";
            public string FilePath { get; set; } = "";
            public string CommandSearched { get; set; } = "";
            public bool Found { get; set; }
            public int LineNumber { get; set; }
            public string LineContent { get; set; } = "";
            public float Confidence { get; set; }
        }

        /// <summary>
        /// Validates all PRs and P positions in trajectory file in specified mode
        /// </summary>
        /// <param name="folderPath">Folder containing files</param>
        /// <param name="filesRequiringVerificationString">Comma-separated: POSREG.VA, trajectory file pattern</param>
        /// <param name="expectedMode">Expected mode: "joint" or "cartesian"</param>
        /// <returns>ValidationResult with OK/NOK/NA/ERROR status</returns>
        public static ValidationResult ValidateAllPRTrajectoryMode(
            string folderPath,
            string filesRequiringVerificationString,
            string expectedMode)
        {
            var result = new ValidationResult
            {
                CommandSearched = $"All PRs and P positions in {expectedMode} mode",
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count < 2)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = $"ALL_PR_TRAJ_{expectedMode.ToUpper()} validation requires two files: POSREG.VA and trajectory file";
                    return result;
                }

                // Find POSREG.VA (case-insensitive)
                var directory = new DirectoryInfo(folderPath);
                var posregFile = directory.EnumerateFiles("POSREG.VA", SearchOption.AllDirectories).FirstOrDefault();
                
                if (posregFile == null)
                {
                    var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                    posregFile = allFiles.FirstOrDefault(f => f.Name.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                }

                if (posregFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "POSREG.VA file not found";
                    return result;
                }

                // Find trajectory file (case-insensitive)
                var trajectoryPattern = filePatterns.FirstOrDefault(f => !f.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                
                if (string.IsNullOrEmpty(trajectoryPattern))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "Could not identify trajectory file pattern";
                    return result;
                }

                // Find trajectory files with case-insensitive matching
                var trajectoryFiles = new List<FileInfo>();
                
                if (trajectoryPattern.Contains('*'))
                {
                    trajectoryFiles.AddRange(directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories));
                }
                else
                {
                    var file = directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories).FirstOrDefault();
                    
                    if (file == null)
                    {
                        var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                        file = allFiles.FirstOrDefault(f => f.Name.Equals(trajectoryPattern, StringComparison.OrdinalIgnoreCase));
                        
                        if (file == null)
                        {
                            var baseNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryPattern);
                            file = allFiles.FirstOrDefault(f => 
                                Path.GetFileNameWithoutExtension(f.Name).Equals(baseNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                        }
                    }
                    
                    if (file != null) trajectoryFiles.Add(file);
                }

                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryPattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;

                // Validate each trajectory file
                var fileResults = new List<FileSearchResult>();
                var allCompliant = true;

                foreach (var trajectoryFile in trajectoryFiles)
                {
                    // Extract unique PRs and P positions from trajectory file
                    var (uniquePRs, uniquePPositions) = ExtractUniquePRAndPPositions(trajectoryFile.FullName);
                    
                    // Check P positions mode from /POS section
                    var pPositionModes = ExtractPPositionModes(trajectoryFile.FullName);

                    // Validate PRs against POSREG.VA using PositionRegisterValidationService
                    var prValidationResult = PositionRegisterValidationService.ValidateAllPRTrajectoryMode(
                        trajectoryFile.FullName,
                        posregFile.FullName,
                        expectedMode);

                    // Check P positions mode
                    var pPositionIssues = new List<string>();
                    foreach (var pNum in uniquePPositions)
                    {
                        if (pPositionModes.TryGetValue(pNum, out var pMode))
                        {
                            // If expecting JOINT mode but P position is CARTESIAN (has X, Y, Z), it's wrong
                            if (expectedMode.Equals("joint", StringComparison.OrdinalIgnoreCase) && 
                                pMode.Equals("cartesian", StringComparison.OrdinalIgnoreCase))
                            {
                                pPositionIssues.Add($"P[{pNum}] is CARTESIAN (not {expectedMode.ToUpper()})");
                            }
                            // If expecting CARTESIAN mode but P position is JOINT (has J1-J6), it's wrong
                            else if (expectedMode.Equals("cartesian", StringComparison.OrdinalIgnoreCase) && 
                                     pMode.Equals("joint", StringComparison.OrdinalIgnoreCase))
                            {
                                pPositionIssues.Add($"P[{pNum}] is JOINT (not {expectedMode.ToUpper()})");
                            }
                        }
                    }

                    var isCompliant = prValidationResult.Success && pPositionIssues.Count == 0;
                    if (!isCompliant) allCompliant = false;

                    // Build detailed summary
                    var summaryParts = new List<string>();
                    if (uniquePRs.Count > 0)
                    {
                        summaryParts.Add($"PR: [{string.Join(", ", uniquePRs.OrderBy(x => int.Parse(x)))}]");
                    }
                    if (uniquePPositions.Count > 0)
                    {
                        summaryParts.Add($"P: [{string.Join(", ", uniquePPositions.Select(p => $"P[{p}]").OrderBy(x => x))}]");
                    }
                    if (pPositionIssues.Count > 0)
                    {
                        summaryParts.Add($"Issues: {string.Join(", ", pPositionIssues)}");
                    }
                    if (uniquePPositions.Count == 0 && pPositionIssues.Count == 0)
                    {
                        summaryParts.Add("No P[n] positions found");
                    }

                    var detailedSummary = string.Join(" | ", summaryParts);
                    if (pPositionIssues.Count == 0)
                    {
                        detailedSummary += $" - All positions are in {expectedMode.ToUpper()} mode";
                    }

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = $"All PRs and P positions in {expectedMode} mode",
                        Found = isCompliant,
                        LineNumber = 0,
                        LineContent = detailedSummary,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (allCompliant && fileResults.Count > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = fileResults.Count;
                    result.FilesNotFound = 0;
                    result.Summary = fileResults[0].LineContent;
                }
                else if (fileResults.Count > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = fileResults.Count;
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = "No valid results";
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating all PR trajectory modes: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Extracts unique PR and P position numbers from trajectory file (removes duplicates)
        /// </summary>
        private static (List<string> PRs, List<int> PPositions) ExtractUniquePRAndPPositions(string trajectoryFilePath)
        {
            var uniquePRs = new HashSet<string>();
            var uniquePPositions = new HashSet<int>();

            try
            {
                var lines = File.ReadAllLines(trajectoryFilePath);
                var inMnBlock = false;

                foreach (var line in lines)
                {
                    // Stop at /POS section
                    if (line.Trim().Equals("/POS", StringComparison.OrdinalIgnoreCase))
                        break;

                    if (line.Trim().Equals("/MN", StringComparison.OrdinalIgnoreCase))
                    {
                        inMnBlock = true;
                        continue;
                    }

                    if (!inMnBlock) continue;

                    // Extract PR[n] - pattern: PR[123] or PR[123:Name]
                    var prMatches = System.Text.RegularExpressions.Regex.Matches(line, @"PR\s*\[\s*(\d+)\s*(?::|])", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    foreach (System.Text.RegularExpressions.Match match in prMatches)
                    {
                        uniquePRs.Add(match.Groups[1].Value);
                    }

                    // Extract P[n] - pattern: P[1] or P[123]
                    var pMatches = System.Text.RegularExpressions.Regex.Matches(line, @"P\s*\[\s*(\d+)\s*\]", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    foreach (System.Text.RegularExpressions.Match match in pMatches)
                    {
                        if (int.TryParse(match.Groups[1].Value, out int pNum))
                        {
                            uniquePPositions.Add(pNum);
                        }
                    }
                }
            }
            catch
            {
                // Return empty lists on error
            }

            return (uniquePRs.ToList(), uniquePPositions.ToList());
        }

        /// <summary>
        /// Extracts P position modes from /POS section (CARTESIAN: X,Y,Z or JOINT: J1-J6)
        /// </summary>
        private static Dictionary<int, string> ExtractPPositionModes(string trajectoryFilePath)
        {
            var pPositionModes = new Dictionary<int, string>();

            try
            {
                var content = File.ReadAllText(trajectoryFilePath);
                
                // Find /POS section
                var posIndex = content.IndexOf("/POS", StringComparison.OrdinalIgnoreCase);
                if (posIndex < 0) return pPositionModes;

                var endIndex = content.IndexOf("/END", posIndex, StringComparison.OrdinalIgnoreCase);
                if (endIndex < 0) endIndex = content.Length;

                var posSection = content.Substring(posIndex, endIndex - posIndex);

                // Extract P[n]{...} blocks
                var pPatternRegex = new System.Text.RegularExpressions.Regex(
                    @"P\s*\[\s*(\d+)\s*\]\s*\{([^}]+)\}",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                foreach (System.Text.RegularExpressions.Match match in pPatternRegex.Matches(posSection))
                {
                    if (int.TryParse(match.Groups[1].Value, out int pNum))
                    {
                        var posBlock = match.Groups[2].Value;

                        // Check if it has X, Y, Z (CARTESIAN)
                        if (System.Text.RegularExpressions.Regex.IsMatch(posBlock, @"X\s*=", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            pPositionModes[pNum] = "cartesian";
                        }
                        // Check if it has J1, J2, J3, J4, J5, J6 (JOINT)
                        else if (System.Text.RegularExpressions.Regex.IsMatch(posBlock, @"J1\s*=", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            pPositionModes[pNum] = "joint";
                        }
                    }
                }
            }
            catch
            {
                // Return empty dictionary on error
            }

            return pPositionModes;
        }
    }
}
