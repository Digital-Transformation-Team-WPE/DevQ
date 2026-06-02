using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// ============================================================================
    /// PRESENT DUPLICATE VALIDATION SERVICE
    /// 
    /// WHEN TO CALL:
    /// - Logic column = "Present_Duplicate" (case insensitive, equals check)
    /// 
    /// VALIDATES:
    /// - Each keyword appears exactly ONCE in files
    /// - No duplicates of the same keyword
    /// 
    /// EXAMPLE:
    /// - Logic Column: "UFRAME_NUM,UTOOL_NUM\tPresent_Duplicate\t...\t..."
    /// - What to Check: "UFRAME_NUM,UTOOL_NUM"
    /// - Searches files and checks if each keyword appears 1 time (OK) or multiple times (NOK)
    /// 
    /// RESULT STATUS:
    /// - OK: All keywords present exactly once
    /// - NOK: Keyword missing or appears multiple times
    /// - NA: No files matched pattern
    /// - ERROR: Exception occurred
    /// 
    /// DATABASE COLUMNS USED FOR INPUT:
    /// - Files Requiring Verification: File patterns to search (e.g., "*.LS")
    /// - What to Check: Comma-separated keywords (e.g., "UFRAME_NUM,UTOOL_NUM")
    /// - Logic: Must = "Present_Duplicate" tab-separated format
    /// 
    /// DATABASE COLUMNS UPDATED WITH RESULT:
    /// - Status: OK/NOK/ERROR/NA (displayed in UI)
    /// - Summary: List of keywords and their occurrence status
    /// ============================================================================
    /// </summary>
    public static class PresentDuplicateValidationService
    {
        public class ValidationResult
        {
            public string Status { get; set; } = "";  // "OK", "NOK", "NA", "ERROR"
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = "";
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
            public List<string> ValidationIssues { get; set; } = new();
        }
     
        public static ValidationResult ValidatePresentDuplicate(
            string folderPath,
            List<string> filePatterns,
            string keywords)
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

                var keywordList = ParseKeywords(keywords);

                if (keywordList.Count == 0)
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = "No keywords specified to check";
                    return result;
                }

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
                var allValidationDetails = new List<string>();
                var allIssues = new List<string>();

                foreach (var file in filesToCheck)
                {
                    var fileValidationResult = ValidateFileForKeywords(file, keywordList);

                    // Add file-level results
                    foreach (var detail in fileValidationResult.ValidDetails)
                    {
                        allValidationDetails.Add($"{file.Name}: {detail}");
                    }

                    foreach (var issue in fileValidationResult.Issues)
                    {
                        allIssues.Add($"{file.Name}: {issue}");
                    }
                }

                // Generate overall result
                result.IsCompliant = allIssues.Count == 0;
                result.Status = result.IsCompliant ? "OK" : "NOK";
                result.StatusMessage = result.IsCompliant ? "OK" : "NOK";
                result.ValidationDetails = allValidationDetails;
                result.ValidationIssues = allIssues;

                // Build summary
                if (result.IsCompliant && allValidationDetails.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", allValidationDetails);
                }
                else if (allIssues.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", allIssues);
                }
                else
                {
                    result.ValidationSummary = "No validation details available";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.IsCompliant = false;                result.Status = "ERROR";                result.StatusMessage = "ERROR";
                result.ValidationSummary = $"Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validates keywords in a single file
        /// </summary>
        private static FileKeywordValidationResult ValidateFileForKeywords(FileInfo file, List<string> keywords)
        {
            var result = new FileKeywordValidationResult
            {
                ValidDetails = new List<string>(),
                Issues = new List<string>()
            };

            try
            {
                if (!file.Exists)
                    return result;

                var content = File.ReadAllText(file.FullName);

                // Check each keyword
                foreach (var keyword in keywords)
                {
                    int occurrenceCount = CountOccurrences(content, keyword, caseSensitive: true);

                    if (occurrenceCount == 0)
                    {
                        result.Issues.Add($"✗ {keyword} is missing");
                    }
                    else if (occurrenceCount == 1)
                    {
                        result.ValidDetails.Add($"✓ {keyword} appears exactly 1 time");
                    }
                    else
                    {
                        result.Issues.Add($"✗ duplicate found {keyword} appears {occurrenceCount} times");
                    }
                }

                return result;
            }
            catch
            {
                result.Issues.Add("Error reading file");
                return result;
            }
        }

        /// <summary>
        /// Counts occurrences of a keyword in text (case-sensitive)
        /// </summary>
        private static int CountOccurrences(string text, string keyword, bool caseSensitive)
        {
            if (string.IsNullOrEmpty(keyword))
                return 0;

            int count = 0;
            int index = 0;
            
            var comparison = caseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;

            while ((index = text.IndexOf(keyword, index, comparison)) != -1)
            {
                count++;
                index += keyword.Length;
            }

            return count;
        }

        /// <summary>
        /// Parses keywords from string (comma or space-separated)
        /// </summary>
        private static List<string> ParseKeywords(string keywordsString)
        {
            if (string.IsNullOrWhiteSpace(keywordsString))
                return new List<string>();

            // Split by comma or semicolon or space, trim whitespace, remove empty entries
            var separators = new[] { ',', ';', ' ' };
            var keywords = keywordsString.Split(separators, StringSplitOptions.RemoveEmptyEntries)
                .Select(k => k.Trim())
                .Where(k => !string.IsNullOrEmpty(k))
                .Distinct() // Remove duplicate keywords
                .ToList();

            return keywords;
        }

        /// <summary>
        /// Result of file-level keyword validation
        /// </summary>
        private class FileKeywordValidationResult
        {
            public List<string> ValidDetails { get; set; }
            public List<string> Issues { get; set; }
        }
    }
}
