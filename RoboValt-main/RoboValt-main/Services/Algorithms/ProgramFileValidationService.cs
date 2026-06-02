using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates robot program files (LS files) for:
    /// 1. Comment existence in /ATTR section
    /// 2. Comment length not exceeding 16 characters
    /// </summary>
    public static class ProgramFileValidationService
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

        /// <summary>
        /// Validates that all program files have comments and length <= 16 characters
        /// </summary>
        public static ValidationResult ValidateProgramFileComments(
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
                    var commentResult = ValidateFileComment(file.FullName);

                    if (commentResult.IsValid)
                    {
                        validationDetails.Add($"✓ {file.Name} has comment and length not greater than 16");
                    }
                    else
                    {
                        if (string.IsNullOrWhiteSpace(commentResult.Comment))
                        {
                            issues.Add($"✗ {file.Name} comment not exist");
                        }
                        else
                        {
                            issues.Add($"✗ {file.Name} comment exceeds 16 characters: \"{commentResult.Comment}\" (length: {commentResult.CommentLength})");
                        }
                    }
                }

                // Generate result
                result.IsCompliant = issues.Count == 0;                result.Status = result.IsCompliant ? "OK" : "NOK";                result.StatusMessage = result.IsCompliant ? "OK" : "NOK";
                result.ValidationDetails = validationDetails;
                result.ValidationIssues = issues;

                // Build summary - show actual file validation details
                if (issues.Count == 0 && validationDetails.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", validationDetails);
                }
                else if (issues.Count > 0)
                {
                    result.ValidationSummary = string.Join(" | ", issues);
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
        /// Validates a single program file's comment
        /// </summary>
        private static FileCommentResult ValidateFileComment(string filePath)
        {
            var result = new FileCommentResult
            {
                IsValid = false,
                Comment = string.Empty,
                CommentLength = 0
            };

            try
            {
                if (!File.Exists(filePath))
                    return result;

                var content = File.ReadAllText(filePath);
                
                // Extract comment from /ATTR section
                // Pattern: COMMENT = "value";
                var commentMatch = Regex.Match(content, @"COMMENT\s*=\s*[""']([^""']*)[""'];", RegexOptions.IgnoreCase);

                if (!commentMatch.Success)
                {
                    // Comment not found
                    return result;
                }

                string comment = commentMatch.Groups[1].Value.Trim();

                // Comment must exist and not be empty
                if (string.IsNullOrEmpty(comment))
                {
                    return result;
                }

                result.Comment = comment;
                result.CommentLength = comment.Length;

                // Check length constraint (max 16 characters)
                result.IsValid = comment.Length <= 16;

                return result;
            }
            catch
            {
                return result;
            }
        }

        /// <summary>
        /// Result of file comment validation
        /// </summary>
        private class FileCommentResult
        {
            public bool IsValid { get; set; }
            public string Comment { get; set; }
            public int CommentLength { get; set; }
        }
    }
}
