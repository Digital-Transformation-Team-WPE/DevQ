using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates PR Comment Order with FINE keyword in trajectory file.
    /// Parses PR[number:comment] format directly from trajectory file.
    /// First PR must match expected number/comment and have FINE keyword.
    /// Last PR must match expected number/comment and have FINE keyword.
    /// Requires only ONE file: the trajectory file (embedded PR[number:comment] format).
    /// </summary>
    public static class PRCommentOrderFineValidationService
    {
        // Pattern to match PR[number:comment] or P[number:comment] format (e.g., PR[1:Repli] or P[1:Repli])
        private static readonly Regex PRWithCommentPattern = new Regex(@"P(?:R)?\[(\d+)\s*:\s*([^\]]+)\]", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex FineKeywordPattern = new Regex(@"\bFINE\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Validate that PR(s) in trajectory file match expected PR numbers with comments and FINE keywords
        /// Parses PR info directly from trajectory file (PR[number:comment] format)
        /// Format: "1:Repli" - check only first PR is PR[1] with comment "Repli" and FINE keyword
        /// Format: "1:Repli, 2:Peo" - check first PR is PR[1]:"Repli" and last PR is PR[2]:"Peo", both with FINE keywords
        /// </summary>
        /// <param name="trajectoryFilePath">Path to trajectory file containing PR[number:comment] entries</param>
        /// <param name="posregFilePath">Ignored - kept for compatibility with handler</param>
        /// <param name="prCommentOrderString">Format: "prNumber1:comment1" or "prNumber1:comment1, prNumber2:comment2"</param>
        /// <returns>Tuple with (Status, Message)</returns>
        public static (string Status, string Message) ValidatePRCommentOrderFine(
            string trajectoryFilePath,
            string posregFilePath,
            string prCommentOrderString)
        {
            try
            {
                // Parse expected PR numbers and comments from input
                // Supports: "1:Repli" (check first only) or "1:Repli, 2:Peo" (check first and last)
                var prSpecs = prCommentOrderString.Split(',')
                    .Select(c => c.Trim())
                    .ToList();

                if (prSpecs.Count < 1 || prSpecs.Count > 2)
                {
                    return ("NOK", "Expected 1 or 2 PR specs: '1:Repli' (check first only) or '1:Repli, 2:Peo' (check first and last)");
                }

                // Parse first PR spec
                var firstSpec = ParsePRSpec(prSpecs[0]);
                if (firstSpec == null)
                {
                    return ("NOK", $"Invalid format for first PR spec: '{prSpecs[0]}'. Expected format: 'prNumber:comment'");
                }

                var expectedFirstPRNumber = firstSpec.Value.PRNumber;
                var expectedFirstComment = firstSpec.Value.Comment;
                int? expectedSecondPRNumber = null;
                string? expectedSecondComment = null;

                // Parse second PR spec if provided (optional)
                if (prSpecs.Count == 2)
                {
                    var secondSpec = ParsePRSpec(prSpecs[1]);
                    if (secondSpec == null)
                    {
                        return ("NOK", $"Invalid format for second PR spec: '{prSpecs[1]}'. Expected format: 'prNumber:comment'");
                    }
                    expectedSecondPRNumber = secondSpec.Value.PRNumber;
                    expectedSecondComment = secondSpec.Value.Comment;
                }

                // Extract all PR data from the /MN block of the trajectory file.
                var prDataFromTrajectory = ExtractPRDataFromTrajectory(trajectoryFilePath);

                if (prDataFromTrajectory.Count == 0)
                {
                    return ("NOK", "No PR[*:*] patterns found in trajectory file");
                }

                // Get first PR
                var firstPRData = prDataFromTrajectory.First();

                // Validate first PR number
                if (firstPRData.PRNumber != expectedFirstPRNumber)
                {
                    return ("NOK", $"First PR is PR[{firstPRData.PRNumber}] but expected PR[{expectedFirstPRNumber}]");
                }

                // Validate first PR comment (case-insensitive)
                if (!firstPRData.Comment.Equals(expectedFirstComment, StringComparison.OrdinalIgnoreCase))
                {
                    return ("NOK", $"First PR[{firstPRData.PRNumber}] comment '{firstPRData.Comment}' doesn't match expected '{expectedFirstComment}'");
                }

                // Check first PR line has FINE keyword
                if (!FineKeywordPattern.IsMatch(firstPRData.LineContent))
                {
                    return ("NOK", $"First PR[{firstPRData.PRNumber}] line missing 'FINE' keyword");
                }

                // If only checking first PR, validation passed
                if (prSpecs.Count == 1)
                {
                    return ("OK", $"PR[{firstPRData.PRNumber}:{firstPRData.Comment}] has correct number, comment and FINE keyword");
                }

                // Get last PR (only if checking both)
                var lastPRData = prDataFromTrajectory.Last();

                // Validate last PR number
                if (lastPRData.PRNumber != expectedSecondPRNumber)
                {
                    return ("NOK", $"Last PR is PR[{lastPRData.PRNumber}] but expected PR[{expectedSecondPRNumber}]");
                }

                // Validate last PR comment (case-insensitive)
                if (!lastPRData.Comment.Equals(expectedSecondComment, StringComparison.OrdinalIgnoreCase))
                {
                    return ("NOK", $"Last PR[{lastPRData.PRNumber}] comment '{lastPRData.Comment}' doesn't match expected '{expectedSecondComment}'");
                }

                // Check last PR line has FINE keyword
                if (!FineKeywordPattern.IsMatch(lastPRData.LineContent))
                {
                    return ("NOK", $"Last PR[{lastPRData.PRNumber}] line missing 'FINE' keyword");
                }

                // All validations passed
                return ("OK", $"PR[{firstPRData.PRNumber}:{firstPRData.Comment}] and PR[{lastPRData.PRNumber}:{lastPRData.Comment}] have correct numbers, comments and FINE keywords");
            }
            catch (Exception ex)
            {
                return ("ERROR", $"Error validating PR comment order: {ex.Message}");
            }
        }

        /// <summary>
        /// Parse PR specification format: "prNumber:comment"
        /// </summary>
        private static (int PRNumber, string Comment)? ParsePRSpec(string spec)
        {
            var parts = spec.Split(':');
            if (parts.Length != 2)
            {
                return null;
            }

            if (!int.TryParse(parts[0].Trim(), out int prNumber))
            {
                return null;
            }

            var comment = parts[1].Trim();
            if (string.IsNullOrWhiteSpace(comment))
            {
                return null;
            }

            return (prNumber, comment);
        }

        /// <summary>
        /// Extract all PR data (number and comment) from the /MN block of the trajectory file.
        /// Preserves file order and stops before /POS.
        /// </summary>
        private static List<PRLineData> ExtractPRDataFromTrajectory(string trajectoryFilePath)
        {
            var prDataList = new List<PRLineData>();

            try
            {
                if (!File.Exists(trajectoryFilePath))
                {
                    return prDataList;
                }

                var lines = File.ReadAllLines(trajectoryFilePath);
                var inMnBlock = false;

                foreach (var line in lines)
                {
                    var trimmedLine = line.Trim();

                    if (trimmedLine.Equals("/MN", StringComparison.OrdinalIgnoreCase))
                    {
                        inMnBlock = true;
                        continue;
                    }

                    if (trimmedLine.Equals("/POS", StringComparison.OrdinalIgnoreCase))
                        break;

                    if (!inMnBlock)
                        continue;

                    var match = PRWithCommentPattern.Match(line);
                    if (match.Success)
                    {
                        if (int.TryParse(match.Groups[1].Value, out int prNumber))
                        {
                            var comment = match.Groups[2].Value.Trim();
                            
                            prDataList.Add(new PRLineData
                            {
                                PRNumber = prNumber,
                                Comment = comment,
                                LineContent = line.Trim()
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Error reading trajectory file: {ex.Message}");
            }

            return prDataList;
        }

        /// <summary>
        /// Helper class to store PR line data
        /// </summary>
        private class PRLineData
        {
            public int PRNumber { get; set; }
            public string Comment { get; set; } = string.Empty;
            public string LineContent { get; set; } = string.Empty;
        }
    }
}
