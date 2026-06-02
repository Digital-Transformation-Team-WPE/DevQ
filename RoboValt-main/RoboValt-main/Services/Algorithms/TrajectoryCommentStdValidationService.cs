using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// ============================================================================
    /// TRAJECTORY COMMENT STANDARD VALIDATION SERVICE
    /// 
    /// WHEN TO CALL:
    /// - Logic column = "Traj_Comment_std"
    /// 
    /// VALIDATES:
    /// - Extracts comment from trajectory file
    /// - Matches against standard patterns from database based on robot application
    /// - Pattern matching: compares fixed parts only, ignores variable parts
    /// 
    /// EXAMPLE PATTERN MATCHING:
    /// - Standard pattern: "T_N°Veh_MDPX_Y"
    /// - Extracted comment: "T_P64_MDP_TAB92E"
    /// - Match logic: T_ (fixed), N°Veh→P64 (variable), _MDP (fixed), X_Y→TAB92E (variable)
    /// - Result: OK - matched pattern "T_N°Veh_MDPX_Y"
    /// 
    /// RESULT STATUS:
    /// - OK: Comment matches one of the standard patterns
    /// - NOK: Comment does not match any standard pattern
    /// 
    /// DATABASE COLUMNS USED:
    /// - dbo.robo_standard_types (contains standard patterns)
    /// - robot application: filtered by app_name
    /// - category: used to group patterns
    /// - Comment column: contains working trajectory patterns
    /// ============================================================================
    /// </summary>
    public static class TrajectoryCommentStdValidationService
    {
        /// <summary>
        /// Validates trajectory comment against standard patterns from database
        /// </summary>
        /// <param name="folderPath">Folder containing trajectory file</param>
        /// <param name="trajectoryFileName">Name of trajectory file to read</param>
        /// <param name="robidFileName">Name of ROBID.DT file to read for app_name</param>
        /// <param name="connectionString">Database connection string</param>
        /// <returns>(Status, Message, MatchedPattern, ActualComment) - Status is "OK"/"NOK"/"NA"</returns>
        public static (string Status, string Message, string MatchedPattern, string ActualComment) ValidateTrajectoryCommentStd(
            string folderPath,
            string trajectoryFileName,
            string robidFileName,
            string connectionString)
        {
            try
            {
                // Step 1: Extract app_name from ROBID.DT file
                var appName = ExtractAppNameFromRobidFile(folderPath, robidFileName);
                if (string.IsNullOrWhiteSpace(appName))
                {
                    return ("NA", "Could not extract app_name from ROBID.DT file", "", "");
                }

                // Step 2: Extract comment from trajectory file
                var trajectoryComment = ExtractCommentFromTrajectoryFile(folderPath, trajectoryFileName);
                if (string.IsNullOrWhiteSpace(trajectoryComment))
                {
                    return ("NA", $"Could not extract COMMENT from {trajectoryFileName}", "", "");
                }

                // Step 3: Get standard patterns from database
                var (categoryNo, standardPatterns) = GetStandardPatternsFromDatabase(connectionString, appName);
                if (categoryNo <= 0)
                {
                    return ("NA", $"Robot application '{appName}' not found in standard types table", "", "");
                }

                if (!standardPatterns.Any())
                {
                    return ("NA", $"No standard patterns found for category {categoryNo}", "", "");
                }

                // Step 4: Match trajectory comment against patterns
                var matchedPattern = MatchCommentAgainstPatterns(trajectoryComment, standardPatterns);
                if (!string.IsNullOrWhiteSpace(matchedPattern))
                {
                    return ("OK", $"Comment is in standard format", matchedPattern, trajectoryComment);
                }

                return ("NOK", $"Comment '{trajectoryComment}' is not in standard pattern. Expected one of: {string.Join(", ", standardPatterns)}", "", trajectoryComment);
            }
            catch (Exception ex)
            {
                return ("NA", $"Error during validation: {ex.Message}", "", "");
            }
        }

        /// <summary>
        /// Extracts app_name from ROBID.DT file (pattern: app_nam=VALUE)
        /// </summary>
        private static string ExtractAppNameFromRobidFile(string folderPath, string robidFileName)
        {
            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Try to find ROBID file with various names and extensions
                var robidFile = directory.EnumerateFiles("ROBID*", SearchOption.AllDirectories)
                    .FirstOrDefault() ??
                    directory.EnumerateFiles("ROB_ID*", SearchOption.AllDirectories)
                    .FirstOrDefault() ??
                    directory.EnumerateFiles("*ROBID*", SearchOption.AllDirectories)
                    .FirstOrDefault() ??
                    directory.EnumerateFiles("*ROB_ID*", SearchOption.AllDirectories)
                    .FirstOrDefault();

                if (robidFile == null && !string.IsNullOrWhiteSpace(robidFileName))
                {
                    robidFile = directory.EnumerateFiles(robidFileName, SearchOption.AllDirectories)
                        .FirstOrDefault();
                }

                if (robidFile == null)
                {
                    return null;
                }

                var lines = File.ReadAllLines(robidFile.FullName);
                var appNameLine = lines.FirstOrDefault(l => 
                    l.Contains("app_nam", StringComparison.OrdinalIgnoreCase) || 
                    l.Contains("app_name", StringComparison.OrdinalIgnoreCase));

                if (appNameLine == null)
                {
                    return null;
                }

                // Extract value after = sign: "app_nam=SELPF" → "SELPF"
                var match = Regex.Match(appNameLine, @"app_na[a-z]*\s*=\s*(.+)", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var value = match.Groups[1].Value.Trim();
                    // Remove any trailing comments or whitespace
                    value = Regex.Replace(value, @"[\s;#].*$", "").Trim();
                    return value;
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Extracts COMMENT string from trajectory file (pattern: COMMENT = "value")
        /// Handles various file extensions: .ls, .tp, .src, etc.
        /// </summary>
        private static string ExtractCommentFromTrajectoryFile(string folderPath, string trajectoryFileName)
        {
            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // First, try exact filename match (case-insensitive)
                var trajFile = directory.EnumerateFiles(trajectoryFileName, SearchOption.AllDirectories)
                    .FirstOrDefault();

                // If not found, try with different extensions
                if (trajFile == null)
                {
                    var fileNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryFileName);
                    trajFile = directory.EnumerateFiles("*", SearchOption.AllDirectories)
                        .FirstOrDefault(f => 
                            Path.GetFileNameWithoutExtension(f.Name)
                                .Equals(fileNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                }

                if (trajFile == null)
                {
                    return null;
                }

                var lines = File.ReadAllLines(trajFile.FullName);
                var commentLine = lines.FirstOrDefault(l => 
                    l.Contains("COMMENT", StringComparison.OrdinalIgnoreCase) &&
                    l.Contains("="));

                if (commentLine == null)
                {
                    return null;
                }

                // Extract value between quotes (e.g., COMMENT = "T_P74MH_MPP1_TAC")
                var match = Regex.Match(commentLine, @"COMMENT\s*=\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                return match.Success ? match.Groups[1].Value.Trim() : null;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Gets standard patterns from database for the given robot application
        /// Returns (categoryNo, list of patterns)
        /// </summary>
        private static (int CategoryNo, List<string> Patterns) GetStandardPatternsFromDatabase(
            string connectionString, 
            string appName)
        {
            try
            {
                using (var con = new SqlConnection(connectionString))
                {
                    con.Open();

                    // First, get the category for the robot application
                    var getCategoryQuery = @"
                        SELECT TOP 1 [category]
                        FROM [dbo].[robo_standard_types]
                        WHERE LOWER([Robot application]) = @appName";

                    int foundCategory = 0;
                    using (var cmd = new SqlCommand(getCategoryQuery, con))
                    {
                        cmd.Parameters.AddWithValue("@appName", (appName ?? "").ToLower().Trim());
                        var result = cmd.ExecuteScalar();
                        
                        if (result != null && int.TryParse(result.ToString(), out int categoryNo))
                        {
                            foundCategory = categoryNo;
                        }
                    }

                    if (foundCategory <= 0)
                    {
                        return (0, new List<string>());
                    }

                    // Now get all standard patterns for this category
                    // Use the exact column name from the schema
                    var getPatternsQuery = @"
                        SELECT DISTINCT [Comment of working trajectory  (I6s1#38)]
                        FROM [dbo].[robo_standard_types]
                        WHERE [category] = @categoryNo
                          AND [Comment of working trajectory  (I6s1#38)] IS NOT NULL
                          AND [Comment of working trajectory  (I6s1#38)] != ''";

                    var patterns = new List<string>();
                    using (var cmd = new SqlCommand(getPatternsQuery, con))
                    {
                        cmd.Parameters.AddWithValue("@categoryNo", foundCategory);
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                var pattern = reader[0]?.ToString()?.Trim();
                                if (!string.IsNullOrWhiteSpace(pattern))
                                {
                                    patterns.Add(pattern);
                                }
                            }
                        }
                    }

                    return (foundCategory, patterns);
                }
            }
            catch (Exception ex)
            {
                return (0, new List<string>());
            }
        }

        /// <summary>
        /// Matches comment against patterns by comparing fixed parts only
        /// Pattern format: T_N°Veh_MDPX_Y where N°Veh and X_Y are variable parts
        /// Returns the matched pattern if found, null otherwise
        /// </summary>
        private static string MatchCommentAgainstPatterns(string comment, List<string> patterns)
        {
            foreach (var pattern in patterns)
            {
                if (CommentMatchesPattern(comment, pattern))
                {
                    return pattern;
                }
            }
            return null;
        }

        /// <summary>
        /// Checks if a comment matches a pattern by comparing fixed parts
        /// Only X, Y, and N°Veh are variable parts - everything else is fixed
        /// </summary>
        private static bool CommentMatchesPattern(string comment, string pattern)
        {
            try
            {
                var variableIndicators = new[] { "N°Veh", "X", "Y" };

                // Split pattern by underscore
                var patternParts = pattern.Split('_');
                var commentParts = comment.Split('_');

                // Must have same number of parts
                if (commentParts.Length != patternParts.Length)
                {
                    return false;
                }

                // Compare each part
                for (int i = 0; i < patternParts.Length; i++)
                {
                    var patPart = patternParts[i];
                    var comPart = commentParts[i];

                    // Check if this part is ENTIRELY variable (is exactly N°Veh, X, or Y)
                    var isEntirelyVariable = variableIndicators.Any(v => 
                        patPart.Equals(v, StringComparison.OrdinalIgnoreCase));

                    if (isEntirelyVariable)
                    {
                        // This part can be anything, just needs to exist
                        if (string.IsNullOrWhiteSpace(comPart))
                        {
                            return false;
                        }
                        continue;
                    }

                    // Part is mixed (has both fixed and variable content)
                    // Extract only the fixed letters (remove N°Veh, X, Y)
                    var fixedContent = ExtractFixedLetters(patPart, variableIndicators);

                    if (!string.IsNullOrWhiteSpace(fixedContent))
                    {
                        // Check if comment part starts with the fixed content
                        if (!comPart.StartsWith(fixedContent, StringComparison.OrdinalIgnoreCase))
                        {
                            return false;
                        }
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Extracts only the fixed letters from a part, removing variable indicators (N°Veh, X, Y)
        /// </summary>
        private static string ExtractFixedLetters(string part, string[] variableIndicators)
        {
            var result = part;
            
            // Remove all variable indicators from the part
            foreach (var indicator in variableIndicators)
            {
                result = result.Replace(indicator, "", StringComparison.OrdinalIgnoreCase);
            }
            
            // Also remove any remaining special characters (but keep letters and numbers)
            result = Regex.Replace(result, @"[^a-zA-Z0-9]", "");
            
            return result.Trim();
        }
    }
}
