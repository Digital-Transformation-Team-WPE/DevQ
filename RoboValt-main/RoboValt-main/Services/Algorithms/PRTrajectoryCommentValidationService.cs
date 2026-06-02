using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// ============================================================================
    /// PR TRAJECTORY COMMENT VALIDATION SERVICE
    /// 
    /// WHEN TO CALL:
    /// - Logic column = "PR_TRAJ_Comment"
    /// 
    /// VALIDATES:
    /// - First and last PR from trajectory file have comments matching expected patterns
    /// 
    /// EXAMPLE:
    /// - Logic Column: "PEO,Pos*\tPR_TRAJ_Comment\t...\t..."
    /// - What to Check: "PEO,Pos*"
    /// - Files Requiring Verification: "POSREG.VA, TRAJ100.SRC"
    /// - Extracts first/last PR from trajectory, checks their comments match patterns
    /// 
    /// RESULT STATUS:
    /// - OK: Both first and last PR comments match one of the patterns
    /// - NOK: Any PR missing comment or comment doesn't match patterns
    /// 
    /// DATABASE COLUMNS USED FOR INPUT:
    /// - Files Requiring Verification: POSREG.VA and trajectory file
    /// - What to Check: Comma-separated comment patterns (support * wildcard)
    ///   Examples: "PEO", "Pos*", "PEO,Pos*", "Cal*,Rep*"
    /// - Logic: Must = "PR_TRAJ_Comment"
    /// 
    /// PATTERN MATCHING:
    /// - Exact match: "PEO" matches "PEO" only
    /// - Wildcard: "Pos*" matches "Pos3", "Pos12", "Position", etc.
    /// - Multiple: "PEO,Pos*" matches either pattern
    /// - Case-insensitive matching
    /// 
    /// DATABASE COLUMNS UPDATED WITH RESULT:
    /// - Status: OK/NOK (displayed in UI)
    /// - Summary: Validation result message
    /// ============================================================================
    /// </summary>
    public static class PRTrajectoryCommentValidationService
    {
        /// <summary>
        /// Validates that first and last PR from trajectory have comments matching expected patterns
        /// </summary>
        /// <param name="trajectoryFilePath">Trajectory file to extract PR from</param>
        /// <param name="posregFilePath">POSREG.VA file to check PR comments</param>
        /// <param name="expectedCommentPatterns">Comma-separated patterns to match (support * wildcard)</param>
        /// <returns>(Status, Message) where status is "OK"/"NOK"/"NA"</returns>
        public static (string Status, string Message) ValidatePRTrajectoryComment(
            string trajectoryFilePath,
            string posregFilePath,
            string expectedCommentPatterns)
        {
            try
            {
                if (!File.Exists(trajectoryFilePath))
                {
                    return ("NA", "Trajectory file not found");
                }

                if (!File.Exists(posregFilePath))
                {
                    return ("NA", "POSREG.VA file not found");
                }

                // Parse expected comment patterns
                var patterns = ParseCommentPatterns(expectedCommentPatterns);
                if (patterns.Count == 0)
                {
                    return ("NA", "No comment patterns specified");
                }

                // Extract all PR numbers from the /MN block of the trajectory file
                var allPRNumbers = ExtractPRNumbersFromTrajectory(trajectoryFilePath);
                if (allPRNumbers.Count == 0)
                {
                    return ("NA", "No PR[*] patterns found in trajectory file");
                }

                // Get first and last PR in file order from the /MN block
                var firstPR = allPRNumbers.First();
                var lastPR = allPRNumbers.Count > 1 ? allPRNumbers.Last() : firstPR;

                // Parse POSREG.VA to get PR comments
                var prComments = ExtractPRCommentsFromPOSREG(posregFilePath, new List<int> { firstPR, lastPR });

                // Check if both PRs exist with comments
                if (!prComments.TryGetValue(firstPR, out var firstPRComment))
                {
                    return ("NOK", $"PR[{firstPR}] not found in POSREG.VA");
                }

                if (!prComments.TryGetValue(lastPR, out var lastPRComment))
                {
                    return ("NOK", $"PR[{lastPR}] not found in POSREG.VA");
                }

                // Check if comments are empty
                if (string.IsNullOrWhiteSpace(firstPRComment))
                {
                    return ("NOK", $"PR[{firstPR}] has no comment");
                }

                if (string.IsNullOrWhiteSpace(lastPRComment))
                {
                    return ("NOK", $"PR[{lastPR}] has no comment");
                }

                // Check if comments match patterns
                var firstMatches = CommentMatchesAnyPattern(firstPRComment, patterns);
                var lastMatches = CommentMatchesAnyPattern(lastPRComment, patterns);

                if (!firstMatches)
                {
                    return ("NOK", $"PR[{firstPR}] comment '{firstPRComment}' doesn't match patterns '{expectedCommentPatterns}'");
                }

                if (!lastMatches)
                {
                    return ("NOK", $"PR[{lastPR}] comment '{lastPRComment}' doesn't match patterns '{expectedCommentPatterns}'");
                }

                // Both match
                return ("OK", $"PR[{firstPR}] ('{firstPRComment}') and PR[{lastPR}] ('{lastPRComment}') match expected comments");
            }
            catch
            {
                return ("NA", "Error during validation");
            }
        }

        /// <summary>
        /// Extract all PR[*] numbers from the /MN block of the trajectory file.
        /// Preserves file order and stops before /POS.
        /// </summary>
        private static List<int> ExtractPRNumbersFromTrajectory(string trajectoryFilePath)
        {
            var prNumbers = new List<int>();

            try
            {
                var lines = File.ReadAllLines(trajectoryFilePath);
                var inMnBlock = false;

                foreach (var rawLine in lines)
                {
                    var line = rawLine.Trim();

                    if (line.Equals("/MN", StringComparison.OrdinalIgnoreCase))
                    {
                        inMnBlock = true;
                        continue;
                    }

                    if (line.Equals("/POS", StringComparison.OrdinalIgnoreCase))
                        break;

                    if (!inMnBlock)
                        continue;

                    var prMatches = Regex.Matches(line, @"PR\s*\[\s*(\d+)\s*(?::|])", RegexOptions.IgnoreCase);
                    foreach (Match match in prMatches)
                    {
                        if (int.TryParse(match.Groups[1].Value, out int prNumber))
                        {
                            prNumbers.Add(prNumber);
                        }
                    }
                }
            }
            catch
            {
                // Return empty list on error
            }

            return prNumbers;
        }

        /// <summary>
        /// Extract PR comments from POSREG.VA file for specific PR numbers
        /// </summary>
        private static Dictionary<int, string> ExtractPRCommentsFromPOSREG(string posregFilePath, List<int> prNumbers)
        {
            var prComments = new Dictionary<int, string>();

            try
            {
                var lines = File.ReadAllLines(posregFilePath);

                foreach (var line in lines)
                {
                    // Match PR definition: [1,52] = 'Pos2'
                    var match = Regex.Match(line, @"\[1,(\d+)\]\s*=\s*'([^']*)'");
                    if (match.Success)
                    {
                        int prNumber = int.Parse(match.Groups[1].Value);
                        string prComment = match.Groups[2].Value.Trim();

                        if (prNumbers.Contains(prNumber))
                        {
                            prComments[prNumber] = prComment;
                        }
                    }
                }
            }
            catch
            {
                // Return empty dictionary on error
            }

            return prComments;
        }

        /// <summary>
        /// Parse comma-separated comment patterns
        /// </summary>
        private static List<string> ParseCommentPatterns(string patternsString)
        {
            if (string.IsNullOrWhiteSpace(patternsString))
                return new List<string>();

            return patternsString
                .Split(',')
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrEmpty(p))
                .ToList();
        }

        /// <summary>
        /// Check if comment matches any of the given patterns (with wildcard support)
        /// Patterns like "Pos*" match "Pos3", "Pos12", etc.
        /// </summary>
        private static bool CommentMatchesAnyPattern(string comment, List<string> patterns)
        {
            foreach (var pattern in patterns)
            {
                if (CommentMatchesPattern(comment, pattern))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Check if comment matches a single pattern (supports * wildcard)
        /// </summary>
        private static bool CommentMatchesPattern(string comment, string pattern)
        {
            if (string.IsNullOrWhiteSpace(comment))
                return false;

            // Convert wildcard pattern to regex
            // "Pos*" → "^Pos.*$"
            // "PEO" → "^PEO$"
            var regexPattern = "^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$";
            var regex = new Regex(regexPattern, RegexOptions.IgnoreCase);

            return regex.IsMatch(comment);
        }
    }
}
