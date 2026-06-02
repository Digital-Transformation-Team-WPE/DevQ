using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    public static class TrajectoryHeaderValidationService
    {
        /// <summary>
        /// ============================================================================
        /// TRAJECTORY HEADER VALIDATION SERVICE
        /// 
        /// WHEN TO CALL:
        /// - Logic column = "Traj_Instruction" (case insensitive, equals check)
        /// 
        /// VALIDATES:
        /// - Trajectory files contain required header keywords:
        ///   • PAYLOAD [*]
        ///   • UFRAME_NUM = *
        ///   • UTOOL_NUM = *
        ///   • CTRLPOSITION (*)
        /// 
        /// RESULT STATUS:
        /// - OK: All required keywords present
        /// - NOK: One or more keywords missing
        /// - NA: No files matched pattern
        /// - ERROR: Exception occurred
        /// 
        /// DATABASE COLUMNS USED FOR INPUT:
        /// - Files Requiring Verification: File patterns to search (e.g., "*.LS")
        /// - What to Check: Can contain keyword references
        /// - Logic: Must = "Traj_Instruction" tab-separated format
        /// 
        /// DATABASE COLUMNS UPDATED WITH RESULT:
        /// - Status: OK/NOK/ERROR/NA (displayed in UI)
        /// - Summary: Validation result message
        /// ============================================================================
        /// </summary>
        private static readonly List<string> ExceptionFilePatterns = new List<string>
        {
            "T_REPLI",
            "T_LANCE",
            "T_CALPOS",
            "T_SERV"
        };

        public class ValidationResult
        {
            public string Status { get; set; } = "";  // "OK", "NOK", "NA", "ERROR"
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = "";
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
            public List<string> ValidationIssues { get; set; } = new();
        }

        /// <summary>
        /// Validates trajectory file headers for required keywords
        /// </summary>
        public static ValidationResult ValidateTrajectoryHeaders(
            string folderPath,
            List<string> filePatterns)
        {
            var result = new ValidationResult();

            try
            {
                if (!Directory.Exists(folderPath))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = $"Folder not found: {folderPath}";
                    return result;
                }

                // Find all matching files
                var directory = new DirectoryInfo(folderPath);
                var filesToCheck = new List<FileInfo>();

                foreach (var pattern in filePatterns)
                {
                    if (string.IsNullOrWhiteSpace(pattern))
                        continue;

                    // Handle wildcard patterns
                    if (pattern.Contains('*'))
                    {
                        var expandedFiles = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).ToList();
                        filesToCheck.AddRange(expandedFiles);
                    }
                    else
                    {
                        // Exact filename
                        var file = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                        if (file != null)
                        {
                            filesToCheck.Add(file);
                        }
                    }
                }

                if (filesToCheck.Count == 0)
                {
                    result.Status = "NA";
                    result.IsCompliant = true;
                    result.StatusMessage = "NA";
                    result.ValidationSummary = "No files found matching the pattern";
                    return result;
                }

                // Validate each file
                var validationDetails = new List<string>();
                var issues = new List<string>();

                foreach (var file in filesToCheck)
                {
                    var headerResult = ValidateFileHeader(file);

                    if (headerResult.IsValid)
                    {
                        validationDetails.Add($"✓ {file.Name} has all required header keywords");
                        // Add each keyword on separate line
                        foreach (var keyword in headerResult.FormattedKeywords)
                        {
                            validationDetails.Add($"  ✓ {keyword}");
                        }
                    }
                    else
                    {
                        // Format missing keywords as comma-separated list
                        string missingList = string.Join(",", headerResult.MissingKeywords);
                        issues.Add($"✗ {file.Name} missing required keywords: {missingList}");
                    }
                }

                // Generate result
                result.IsCompliant = issues.Count == 0;
                result.Status = result.IsCompliant ? "OK" : "NOK";
                result.StatusMessage = result.IsCompliant ? "OK" : "NOK";
                result.ValidationDetails = validationDetails;
                result.ValidationIssues = issues;

                // Build summary
                if (issues.Count == 0 && validationDetails.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", validationDetails.Take(filesToCheck.Count));
                }
                else if (issues.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", issues.Take(filesToCheck.Count));
                }
                else
                {
                    result.ValidationSummary = "No validation details available";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.IsCompliant = false;
                result.Status = "ERROR";
                result.StatusMessage = "ERROR";
                result.ValidationSummary = $"Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validates a single trajectory file's header
        /// </summary>
        private static FileHeaderResult ValidateFileHeader(FileInfo file)
        {
            var result = new FileHeaderResult
            {
                IsValid = false,
                FormattedKeywords = new List<string>(),
                MissingKeywords = new List<string>()
            };

            try
            {
                if (!file.Exists)
                    return result;

                var content = File.ReadAllText(file.FullName);

                // Check if file is an exception (doesn't require UFRAME_NUM and UTOOL_NUM)
                bool isExceptionFile = IsExceptionFile(file.Name);

                // Define required keywords with their regex patterns and display format
                var requiredKeywords = new Dictionary<string, KeywordInfo>
                {
                    { "PAYLOAD [*]", new KeywordInfo { Pattern = @"PAYLOAD\s*\[\s*(\d+)\s*\]", DisplayFormat = "PAYLOAD [{0}]" } },
                    { "UFRAME_NUM = *", new KeywordInfo { Pattern = @"UFRAME_NUM\s*=\s*(-?\d+)", DisplayFormat = "UFRAME_NUM = {0}" } },
                    { "UTOOL_NUM = *", new KeywordInfo { Pattern = @"UTOOL_NUM\s*=\s*(-?\d+)", DisplayFormat = "UTOOL_NUM = {0}" } },
                    { "CTRLPOSITION (*)", new KeywordInfo { Pattern = @"CTRLPOSITION\s*\(\s*([^)]*)\s*\)", DisplayFormat = "CTRLPOSITION ({0})" } }
                };

                // Check each keyword
                foreach (var kwEntry in requiredKeywords)
                {
                    string keywordName = kwEntry.Key;
                    KeywordInfo keywordInfo = kwEntry.Value;

                    // Skip optional keywords for exception files
                    if (isExceptionFile && 
                        (keywordName == "UFRAME_NUM = *" || keywordName == "UTOOL_NUM = *"))
                    {
                        continue;
                    }

                    // Check if keyword exists in file
                    var match = Regex.Match(content, keywordInfo.Pattern, RegexOptions.IgnoreCase);

                    if (match.Success)
                    {
                        string value = match.Groups[1].Value;
                        string formattedKeyword = string.Format(keywordInfo.DisplayFormat, value);
                        result.FormattedKeywords.Add(formattedKeyword);
                    }
                    else
                    {
                        result.MissingKeywords.Add(keywordName);
                    }
                }

                // File is valid if no mandatory keywords are missing
                result.IsValid = result.MissingKeywords.Count == 0;

                return result;
            }
            catch
            {
                return result;
            }
        }

        /// <summary>
        /// Checks if file is an exception (doesn't require all 4 keywords)
        /// Exception files: T_REPLI, T_LANCE, T_CALPOS, T_SERV
        /// </summary>
        private static bool IsExceptionFile(string fileName)
        {
            return ExceptionFilePatterns.Any(pattern =>
                fileName.StartsWith(pattern, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Result of file header validation
        /// </summary>
        private class FileHeaderResult
        {
            public bool IsValid { get; set; }
            public List<string> FormattedKeywords { get; set; }
            public List<string> MissingKeywords { get; set; }
        }

        /// <summary>
        /// Keyword information with pattern and display format
        /// </summary>
        private class KeywordInfo
        {
            public string Pattern { get; set; }
            public string DisplayFormat { get; set; }
        }
    }
}
