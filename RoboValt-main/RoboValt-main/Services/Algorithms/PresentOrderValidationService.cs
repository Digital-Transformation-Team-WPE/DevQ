using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates Present_Order logic:
    /// - Checks if patterns appear in consecutive lines in specified order
    /// - Each pattern can appear anywhere in the line (substring match, case-insensitive)
    /// - Patterns must appear in the exact sequence provided
    /// </summary>
    public static class PresentOrderValidationService
    {
        public class ValidationResult
        {
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = ""; // OK or NOK
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
        }

        /// <summary>
        /// Validates that patterns appear in consecutive lines in the specified order
        /// </summary>
        /// <param name="filePath">Path to the file to validate</param>
        /// <param name="patternString">Comma-separated patterns to check (e.g., "pattern1,pattern2,pattern3")</param>
        /// <returns>ValidationResult with OK/NOK status</returns>
        public static ValidationResult ValidatePresentOrder(string filePath, string patternString)
        {
            var result = new ValidationResult();

            try
            {
                if (!File.Exists(filePath))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "NA";
                    result.ValidationSummary = $"File not found: {filePath}";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(patternString))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "NA";
                    result.ValidationSummary = "Pattern string must be specified";
                    return result;
                }

                // Parse patterns from comma-separated string
                var patterns = patternString.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (patterns.Count == 0)
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = "No patterns found in pattern string";
                    return result;
                }

                // Read file lines
                var lines = File.ReadAllLines(filePath);

                // Find starting line where first pattern appears
                int currentLineIndex = -1;
                for (int i = 0; i < lines.Length; i++)
                {
                    if (lines[i].Contains(patterns[0], StringComparison.OrdinalIgnoreCase))
                    {
                        currentLineIndex = i;
                        break;
                    }
                }

                // If first pattern not found, return NOK
                if (currentLineIndex == -1)
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "NOK";
                    result.ValidationSummary = $"Pattern '{patterns[0]}' not found in file";
                    return result;
                }

                // Check remaining patterns in consecutive lines
                var validationErrors = new List<string>();
                int foundPatterns = 1; // First pattern already found

                for (int patternIndex = 1; patternIndex < patterns.Count; patternIndex++)
                {
                    currentLineIndex++;

                    // Check if we've reached end of file
                    if (currentLineIndex >= lines.Length)
                    {
                        validationErrors.Add($"Pattern '{patterns[patternIndex]}' not found in consecutive line (reached end of file)");
                        break;
                    }

                    // Check if current line contains the expected pattern
                    if (lines[currentLineIndex].Contains(patterns[patternIndex], StringComparison.OrdinalIgnoreCase))
                    {
                        foundPatterns++;
                    }
                    else
                    {
                        validationErrors.Add($"Expected pattern '{patterns[patternIndex]}' in line {currentLineIndex + 1}, but found: {lines[currentLineIndex]}");
                        break; // Stop checking if pattern not found
                    }
                }

                // Determine result
                if (validationErrors.Count == 0 && foundPatterns == patterns.Count)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = $"All {patterns.Count} patterns found in consecutive lines in correct order";
                }
                else
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "NOK";
                    result.ValidationDetails = validationErrors;
                    result.ValidationSummary = string.Join(" | ", validationErrors.Count > 0 ? validationErrors : 
                        new List<string> { $"Only {foundPatterns} out of {patterns.Count} patterns found in order" });
                }

                return result;
            }
            catch (Exception ex)
            {
                result.IsCompliant = false;
                result.StatusMessage = "ERROR";
                result.ValidationSummary = $"Error during validation: {ex.Message}";
                return result;
            }
        }
    }
}
