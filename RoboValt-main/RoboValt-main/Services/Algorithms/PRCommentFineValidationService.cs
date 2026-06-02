using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates that a specific PR with comment exists anywhere in trajectory file with FINE keyword.
    /// Parses PR[number:comment] format directly from trajectory file.
    /// Example: "5:Calpos" means find PR[5] with comment "Calpos" and ensure line has FINE keyword.
    /// </summary>
    public static class PRCommentFineValidationService
    {
        // Pattern to match PR[number:comment] or P[number:comment] format (e.g., PR[5:Calpos] or P[5:Calpos])
        private static readonly Regex PRWithCommentPattern = new Regex(@"P(?:R)?\[(\d+)\s*:\s*([^\]]+)\]", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex FineKeywordPattern = new Regex(@"\bFINE\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Validate that a specific PR with comment exists anywhere in trajectory file with FINE keyword.
        /// Supports two formats:
        /// - "5:Calpos" = find PR[5] with comment "Calpos" and FINE keyword
        /// - "Calpos" = find ANY PR with comment "Calpos" and FINE keyword
        /// </summary>
        /// <param name="trajectoryFilePath">Path to trajectory file containing PR[number:comment] entries</param>
        /// <param name="prCommentString">Format: "prNumber:comment" (e.g., "5:Calpos") or just "comment" (e.g., "Calpos")</param>
        /// <returns>Tuple with (Status, Message)</returns>
        public static (string Status, string Message) ValidatePRCommentFine(
            string trajectoryFilePath,
            string prCommentString)
        {
            try
            {
                // Check if input has colon (prNumber:comment format) or just comment
                int? expectedPRNumber = null;
                string expectedComment = null;

                if (prCommentString.Contains(':'))
                {
                    // Format: "5:Calpos" - specific PR number and comment
                    var spec = ParsePRSpec(prCommentString);
                    if (spec == null)
                    {
                        return ("NOK", $"Invalid format: '{prCommentString}'. Expected format: 'prNumber:comment' (e.g., '5:Calpos') or just comment (e.g., 'Calpos')");
                    }
                    expectedPRNumber = spec.Value.PRNumber;
                    expectedComment = spec.Value.Comment;
                }
                else
                {
                    // Format: "Calpos" - any PR with this comment
                    expectedComment = prCommentString.Trim();
                    if (string.IsNullOrWhiteSpace(expectedComment))
                    {
                        return ("NOK", "Comment cannot be empty");
                    }
                }

                // Extract all PR data from trajectory file
                var prDataFromTrajectory = ExtractPRDataFromTrajectory(trajectoryFilePath);

                if (prDataFromTrajectory.Count == 0)
                {
                    return ("NOK", "No PR[*:*] patterns found in trajectory file");
                }

                // Find matching PR
                PRLineData matchingPR = null;

                if (expectedPRNumber.HasValue)
                {
                    // Specific PR number - find PR with exact number and comment
                    matchingPR = prDataFromTrajectory.FirstOrDefault(pr =>
                        pr.PRNumber == expectedPRNumber.Value &&
                        pr.Comment.Equals(expectedComment, StringComparison.OrdinalIgnoreCase));

                    if (matchingPR == null)
                    {
                        return ("NOK", $"PR[{expectedPRNumber}:{expectedComment}] not found in trajectory file");
                    }
                }
                else
                {
                    // No specific PR number - find ANY PR with matching comment
                    matchingPR = prDataFromTrajectory.FirstOrDefault(pr =>
                        pr.Comment.Equals(expectedComment, StringComparison.OrdinalIgnoreCase));

                    if (matchingPR == null)
                    {
                        return ("NOK", $"No PR with comment '{expectedComment}' found in trajectory file");
                    }
                }

                // Check if line has FINE keyword
                if (!FineKeywordPattern.IsMatch(matchingPR.LineContent))
                {
                    return ("NOK", $"PR[{matchingPR.PRNumber}:{matchingPR.Comment}] found but missing 'FINE' keyword on line");
                }

                // Validation passed
                return ("OK", $"PR[{matchingPR.PRNumber}:{matchingPR.Comment}] found with FINE keyword");
            }
            catch (Exception ex)
            {
                return ("ERROR", $"Error validating PR comment FINE: {ex.Message}");
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
        /// Extract all PR data (number and comment) from trajectory file
        /// Parses format: PR[number:comment]
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

                foreach (var line in lines)
                {
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
            public string Comment { get; set; }
            public string LineContent { get; set; }
        }
    }
}
