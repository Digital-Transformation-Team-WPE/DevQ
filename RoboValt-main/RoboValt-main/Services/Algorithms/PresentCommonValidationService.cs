using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// ============================================================================
    /// PRESENT COMMON VALIDATION SERVICE
    /// 
    /// WHEN TO CALL:
    /// - Logic column = "Present_Common" (case insensitive, equals check)
    /// 
    /// VALIDATES:
    /// - Unwanted/deprecated patterns are NOT present in specified files
    /// 
    /// EXAMPLE:
    /// - Logic Column: "UTOOLNUM = 0,UFRAME_NUM = 0\tPresent_Common\t...\t..."
    /// - What to Check: "UTOOLNUM = 0,UFRAME_NUM = 0"
    /// - Files Requiring Verification: "*.LS" or "FRAME.DG"
    /// - Searches files and checks if patterns are absent (OK) or present (NOK)
    /// 
    /// RESULT STATUS:
    /// - OK: All unwanted patterns absent from files
    /// - NOK: Any unwanted pattern found, or no files to check
    /// 
    /// DATABASE COLUMNS USED FOR INPUT:
    /// - Files Requiring Verification: File patterns to search (e.g., "*.LS", "FRAME.DG")
    /// - What to Check: Comma-separated patterns to ensure are absent
    ///   Examples: "UTOOLNUM = 0, UFRAME_NUM = 0" or "DEPRECATED_KEYWORD"
    /// - Logic: Must = "Present_Common" 
    /// 
    /// FILE MATCHING:
    /// - Supports wildcards: "*.LS" searches all .LS files
    /// - Supports exact names: "FRAME.DG" searches for exact file
    /// - Searches recursively within uploaded folder
    /// 
    /// PATTERN MATCHING:
    /// - Flexible whitespace around = : "UTOOLNUM=0" matches "UTOOLNUM = 0", "UTOOLNUM   =   0"
    /// - Simple keywords: "TOOL" matches as literal string
    /// - Case-insensitive matching
    /// 
    /// DATABASE COLUMNS UPDATED WITH RESULT:
    /// - Status: OK/NOK (displayed in UI)
    /// - Summary: Validation summary message
    /// ============================================================================
    /// </summary>
    public static class PresentCommonValidationService
    {
        /// <summary>
        /// Validates that unwanted patterns are not present in files
        /// </summary>
        /// <param name="folderPath">Folder containing uploaded robot program files</param>
        /// <param name="filePatterns">List of file patterns to search (e.g., "*.LS",   "FRAME.DG")</param>
        /// <param name="whatToCheck">Comma-separated patterns that should be absent</param>
        /// <returns>Tuple: (status, message, lineContent) where status is "OK"/"NOK"/"NA"</returns>
        public static (string Status, string Message, string FoundInFile, string LineContent) ValidatePresentCommon(string folderPath, List<string> filePatterns, string whatToCheck)
        {
            try
            {
                if (!Directory.Exists(folderPath))
                {
                    return ("NA", "Folder not found", "", "");
                }

                // Parse patterns from What to Check column (comma-separated)
                var patternsToFind = ParsePatterns(whatToCheck);
                if (patternsToFind.Count == 0)
                {
                    return ("OK", "", "", "");
                }

                // Find files in folderPath matching the patterns
                var directory = new DirectoryInfo(folderPath);
                var filesToCheck = new List<FileInfo>();

                foreach (var pattern in filePatterns)
                {
                    if (string.IsNullOrWhiteSpace(pattern))
                        continue;

                    try
                    {
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
                    catch
                    {
                        // Skip patterns that cause errors
                    }
                }

                if (filesToCheck.Count == 0)
                {
                    return ("NA", "No files found matching pattern", "", "");
                }

                // Check each pattern in each file
                foreach (var pattern in patternsToFind)
                {
                    foreach (var file in filesToCheck)
                    {
                        try
                        {
                            var content = File.ReadAllText(file.FullName);
                            var foundLine = PatternFoundInContent(pattern, content);
                            if (!string.IsNullOrEmpty(foundLine))
                            {
                                // Pattern found - extract pattern name (before any wildcard)
                                var patternName = pattern.Split('[')[0].Trim();
                                return ("NOK", $"{patternName} found in file, {foundLine}", file.Name, foundLine);
                            }
                        }
                        catch
                        {
                            // Skip files that can't be read
                        }
                    }
                }

                // All patterns absent - validation passed
                return ("OK", $"{string.Join(", ", patternsToFind)} not found", "", "");
            }
            catch
            {
                return ("NA", "Error during validation", "", "");
            }
        }

        /// <summary>
        /// Parse comma-separated patterns from What to Check column
        /// </summary>
        private static List<string> ParsePatterns(string whatToCheck)
        {
            if (string.IsNullOrWhiteSpace(whatToCheck))
                return new List<string>();

            return whatToCheck
                .Split(',')
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrEmpty(p))
                .ToList();
        }

        /// <summary>
        /// Check if pattern is found in content with flexible whitespace handling and wildcard support
        /// Supports * as wildcard (means "anything")
        /// Returns the matching line if found, empty string if not found
        /// </summary>
        private static string PatternFoundInContent(string pattern, string content)
        {
            var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            
            // Convert pattern to regex with flexible spacing and wildcard support
            var regexPattern = ConvertPatternToRegex(pattern);
            var regex = new Regex(regexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);
            
            // Check each line
            foreach (var line in lines)
            {
                if (regex.IsMatch(line))
                {
                    return line.Trim(); // Return the matching line
                }
            }
            
            return ""; // Pattern not found
        }

        /// <summary>
        /// Convert pattern to regex with flexible whitespace around = and wildcard support
        /// Example: "DO[*]" → "DO\[.*\]" (matches DO[anything])
        /// Example: "UTOOLNUM = 0" → @"UTOOLNUM\s*=\s*0"
        /// </summary>
        private static string ConvertPatternToRegex(string pattern)
        {
            // Handle [*] wildcard pattern (e.g., "DO[*]" matches "DO[anything]")
            if (pattern.Contains("[*]"))
            {
                // Split by [*] and escape each part, then join with regex for anything in brackets
                var parts = pattern.Split(new[] { "[*]" }, StringSplitOptions.None);
                var escapedParts = parts.Select(p => Regex.Escape(p)).ToArray();
                // Join with pattern that matches [ + anything + ]
                return string.Join(@"\[.*\]", escapedParts);
            }
            
            if (pattern.Contains("="))
            {
                // Pattern with assignment - make whitespace flexible
                var parts = pattern.Split('=');
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var value = parts[1].Trim();
                    
                    // Create regex: key\s*=\s*value (flexible spacing around =)
                    var regexPattern = $@"{Regex.Escape(key)}\s*=\s*{Regex.Escape(value)}";
                    return regexPattern;
                }
            }
            
            // Simple keyword pattern with potential wildcards
            if (pattern.Contains("*"))
            {
                // Convert * to .* for any character match
                return Regex.Escape(pattern).Replace(@"\*", ".*");
            }
            
            // Default: escape and match as-is (case-insensitive)
            return Regex.Escape(pattern);
        }
    }
}
