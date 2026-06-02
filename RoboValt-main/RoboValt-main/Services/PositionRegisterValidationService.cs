using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Robot_Program_Validation.Services
{
    /// <summary>
    /// Validates Position Register (PR) modes from POSREG.VA files
    /// Supports flexible query parsing and comprehensive PR mode detection
    /// </summary>
    public class PositionRegisterValidationService
    {
        public enum PRMode
        {
            JointMode,      // J1, J2, J3, J4, J5, J6
            CartesianMode,  // X, Y, Z, W, P, R
            Uninitialized   // No coordinates
        }

        public class PRInfo
        {
            public int PRNumber { get; set; }
            public string PRName { get; set; } = "";
            public PRMode Mode { get; set; }
            public string RawContent { get; set; } = "";
        }

        public class ValidationCheckResult
        {
            public bool Success { get; set; }
            public string ExpectedMode { get; set; } = "";
            public List<int> RequestedPRNumbers { get; set; } = new();
            public List<PRInfo> MatchingPRs { get; set; } = new();  // All PRs that match expected mode
            public List<PRInfo> NonCompliantPRs { get; set; } = new(); // PRs that don't match
            public string ValidationSummary { get; set; } = "";
            public string DetailedMessage { get; set; } = "";
        }

        /// <summary>
        /// Parse flexible check statements to extract PR range and expected mode
        /// Handles: "check PR 13-71 are in joint mode", "check if PR 13-71 is joint"
        /// Also handles: "check pr 25, 29 - 31, 33 are in cartesian mode" (without repeating pr)
        /// Also handles: "Check that PR[5] has the comment CalPos"
        /// </summary>
        public static (List<int> prNumbers, string expectedMode, string expectedComment, int specificPRNumber) ParseCheckStatement(string checkStatement)
        {
            var prNumbers = new List<int>();
            var expectedMode = "";
            var expectedComment = "";
            int specificPRNumber = -1;

            if (string.IsNullOrWhiteSpace(checkStatement))
                return (prNumbers, expectedMode, expectedComment, specificPRNumber);

            // Normalize statement
            string normalized = checkStatement.ToLowerInvariant();

            // Check for specific PR comment validation: "Check that PR[5] has the comment CalPos"
            var prCommentMatch = Regex.Match(checkStatement, @"pr\s*\[\s*(\d+)\s*\].*?(?:has\s+)?(?:the\s+)?comment\s+(.+?)(?:\.|$)", RegexOptions.IgnoreCase);
            if (prCommentMatch.Success)
            {
                specificPRNumber = int.Parse(prCommentMatch.Groups[1].Value);
                expectedComment = prCommentMatch.Groups[2].Value.Trim();
                return (new List<int> { specificPRNumber }, "", expectedComment, specificPRNumber);
            }

            // Extract PR numbers - find all numbers and ranges between "pr" keyword and mode keywords
            // First, find the part that contains PR specifications (between "pr" and mode keyword)
            var prSectionMatch = Regex.Match(normalized, @"pr\s+([^(joint|cartesian|uninitialized)]+?)\s+(?:are|is|in)");
            
            if (prSectionMatch.Success)
            {
                string prSection = prSectionMatch.Groups[1].Value;
                
                // Extract all numbers and ranges from the PR section
                // Pattern matches: "25, 29 - 31, 33" → [25, 29-31, 33]
                var rangePattern = @"(\d+)\s*(?:-|to)\s*(\d+)|(\d+)";
                var rangeMatches = Regex.Matches(prSection, rangePattern);
                
                var extractedPRs = new HashSet<int>();
                
                foreach (Match match in rangeMatches)
                {
                    if (match.Groups[1].Success && match.Groups[2].Success)
                    {
                        // Range: 29-31
                        int start = int.Parse(match.Groups[1].Value);
                        int end = int.Parse(match.Groups[2].Value);
                        for (int i = start; i <= end; i++)
                        {
                            extractedPRs.Add(i);
                        }
                    }
                    else if (match.Groups[3].Success)
                    {
                        // Single: 25
                        int pr = int.Parse(match.Groups[3].Value);
                        extractedPRs.Add(pr);
                    }
                }

                prNumbers = extractedPRs.OrderBy(x => x).ToList();
            }

            // Extract expected mode
            if (normalized.Contains("joint") || normalized.Contains("joint mode"))
                expectedMode = "joint";
            else if (normalized.Contains("cartesian") || normalized.Contains("cartesian mode"))
                expectedMode = "cartesian";
            else if (normalized.Contains("uninitialized"))
                expectedMode = "uninitialized";

            return (prNumbers, expectedMode, expectedComment, specificPRNumber);
        }

        /// <summary>
        /// Read and parse POSREG.VA file to extract PR information
        /// </summary>
        public static Dictionary<int, PRInfo> ParsePOSREGFile(string filePath)
        {
            var prData = new Dictionary<int, PRInfo>();

            if (!File.Exists(filePath))
                return prData;

            try
            {
                var lines = File.ReadAllLines(filePath);
                int i = 0;

                while (i < lines.Length)
                {
                    string line = lines[i];

                    // Match PR definition: [1,52] = 'Pos2'
                    var prMatch = Regex.Match(line, @"\[1,(\d+)\]\s*=\s*'([^']*)'");
                    if (prMatch.Success)
                    {
                        int prNumber = int.Parse(prMatch.Groups[1].Value);
                        string prName = prMatch.Groups[2].Value.Trim();
                        var prLines = new List<string> { line };

                        // Collect following lines until we hit the next PR definition or end of file
                        i++;
                        while (i < lines.Length)
                        {
                            string nextLine = lines[i];
                            
                            // Check if this is the start of a new PR definition
                            if (Regex.IsMatch(nextLine, @"\[1,\d+\]"))
                            {
                                // Don't increment i, we'll process this PR in the next iteration
                                break;
                            }

                            // Skip empty lines and comments, but include them in case they contain info
                            if (!string.IsNullOrWhiteSpace(nextLine))
                            {
                                prLines.Add(nextLine);
                            }

                            i++;
                        }

                        // Detect mode for this PR
                        var prInfo = DetectPRMode(prNumber, prName, prLines);
                        prData[prNumber] = prInfo;
                    }
                    else
                    {
                        i++;
                    }
                }

                return prData;
            }
            catch (Exception ex)
            {
                throw new Exception($"Error parsing POSREG file: {ex.Message}");
            }
        }

        /// <summary>
        /// Detect if PR is in Joint, Cartesian, or Uninitialized mode
        /// </summary>
        private static PRInfo DetectPRMode(int prNumber, string prName, List<string> prLines)
        {
            var prInfo = new PRInfo
            {
                PRNumber = prNumber,
                PRName = prName,
                RawContent = string.Join("\n", prLines)
            };

            string content = string.Join(" ", prLines).ToLowerInvariant();

            // Check for Uninitialized (must be checked first)
            if (content.Contains("uninitialized"))
            {
                prInfo.Mode = PRMode.Uninitialized;
            }
            // Check for Cartesian mode (X, Y, Z, W, P, R coordinates)
            // Looking for patterns like: X:  -894.321 or X = 123.45
            else if (Regex.IsMatch(content, @"x\s*[:=]\s*-?[\d.]+") &&
                     Regex.IsMatch(content, @"y\s*[:=]\s*-?[\d.]+") &&
                     Regex.IsMatch(content, @"z\s*[:=]\s*-?[\d.]+"))
            {
                prInfo.Mode = PRMode.CartesianMode;
            }
            // Check for Joint mode (J1, J2, J3, J4, J5, J6)
            // Pattern: J1 = -36.265 deg (with flexible spacing)
            else if (Regex.IsMatch(content, @"j[1-6]\s*=\s*-?[\d.]+\s*deg"))
            {
                prInfo.Mode = PRMode.JointMode;
            }
            else
            {
                prInfo.Mode = PRMode.Uninitialized;
            }

            return prInfo;
        }

        /// <summary>
        /// Validate PR modes or comments against expected values
        /// </summary>
        public static ValidationCheckResult ValidatePRModes(
            string checkStatement,
            string posregFilePath)
        {
            var result = new ValidationCheckResult();

            try
            {
                // Check if this is a "PR are commented" validation
                if (Regex.IsMatch(checkStatement, @"all\s+the\s+pr\s+used\s+are\s+commented|pr\s+used\s+are\s+commented", RegexOptions.IgnoreCase))
                {
                    return ValidatePRCommented(posregFilePath);
                }

                // Parse the check statement
                var (prNumbers, expectedMode, expectedComment, specificPRNumber) = ParseCheckStatement(checkStatement);
                
                // Check if this is a specific PR comment validation
                if (specificPRNumber != -1 && !string.IsNullOrEmpty(expectedComment))
                {
                    return ValidatePRSpecificComment(posregFilePath, specificPRNumber, expectedComment);
                }

                result.RequestedPRNumbers = prNumbers;
                result.ExpectedMode = expectedMode;

                if (prNumbers.Count == 0 || string.IsNullOrEmpty(expectedMode))
                {
                    result.ValidationSummary = "  Could not parse PR numbers or expected mode from check statement";
                    return result;
                }

                // Parse POSREG file
                var prData = ParsePOSREGFile(posregFilePath);

                if (prData.Count == 0)
                {
                    result.ValidationSummary = "  Could not parse POSREG.VA file";
                    return result;
                }

                // Convert expected mode string to enum
                var expectedModeEnum = expectedMode.ToLower() switch
                {
                    "joint" => PRMode.JointMode,
                    "cartesian" => PRMode.CartesianMode,
                    "uninitialized" => PRMode.Uninitialized,
                    _ => PRMode.JointMode
                };

                // Validate each PR
                var compliant = new List<PRInfo>();
                var nonCompliant = new List<PRInfo>();

                foreach (var prNum in prNumbers)
                {
                    if (prData.TryGetValue(prNum, out var prInfo))
                    {
                        // SKIP uninitialized PRs - don't report them at all
                        if (prInfo.Mode == PRMode.Uninitialized)
                        {
                            continue;
                        }

                        if (prInfo.Mode == expectedModeEnum)
                        {
                            compliant.Add(prInfo);
                        }
                        else
                        {
                            nonCompliant.Add(prInfo);
                        }
                    }
                    else
                    {
                        // PR not found - treat as uninitialized and IGNORE
                        continue;
                    }
                }

                result.MatchingPRs = compliant;
                result.NonCompliantPRs = nonCompliant;

                // Generate validation summary
                if (nonCompliant.Count == 0)
                {
                    // All pass (or all were uninitialized and ignored)
                    result.Success = true;
                    if (compliant.Count > 0)
                    {
                        var prList = string.Join(", ", compliant.Select(p => $"PR {p.PRNumber}"));
                        result.ValidationSummary = $"  All initialized PRs [{prList}] are in {expectedMode} mode";
                    }
                    else
                    {
                        // All were uninitialized, so all ignored
                        result.ValidationSummary = $"  All checked PRs are either uninitialized (ignored) or in {expectedMode} mode";
                    }
                }
                else
                {
                    // Some initialized PRs are in wrong mode
                    result.Success = false;

                    // Group non-compliant by mode (excluding uninitialized since we filtered them)
                    var byMode = nonCompliant.GroupBy(p => p.Mode);
                    var groupedSummaries = new List<string>();

                    foreach (var group in byMode)
                    {
                        var prNums = string.Join(", ", group.Select(p => $"PR {p.PRNumber}"));
                        var modeStr = group.Key switch
                        {
                            PRMode.JointMode => "Joint",
                            PRMode.CartesianMode => "Cartesian",
                            PRMode.Uninitialized => "Uninitialized",
                            _ => "Unknown"
                        };
                        groupedSummaries.Add($"{modeStr}: [{prNums}]");
                    }

                    var expectedStr = expectedMode switch
                    {
                        "joint" => "Joint",
                        "cartesian" => "Cartesian",
                        "uninitialized" => "Uninitialized",
                        _ => expectedMode
                    };

                    result.ValidationSummary = $"  Expected {expectedStr} mode. Non-compliant: {string.Join(" | ", groupedSummaries)}";
                    result.DetailedMessage = $"Compliant (Initialized): {compliant.Count} | Non-Compliant (Wrong Mode): {nonCompliant.Count}";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validate that a specific PR has a specific comment
        /// </summary>
        private static ValidationCheckResult ValidatePRSpecificComment(string posregFilePath, int prNumber, string expectedComment)
        {
            var result = new ValidationCheckResult
            {
                RequestedPRNumbers = new List<int> { prNumber },
                ExpectedMode = expectedComment
            };

            try
            {
                var prData = ParsePOSREGFile(posregFilePath);

                if (prData.Count == 0)
                {
                    result.ValidationSummary = "  Could not parse POSREG.VA file";
                    return result;
                }

                if (!prData.TryGetValue(prNumber, out var prInfo))
                {
                    result.Success = false;
                    result.ValidationSummary = $"  PR {prNumber} not found in POSREG.VA";
                    return result;
                }

                // Compare actual comment with expected comment (case-insensitive, trimmed)
                string actualComment = prInfo.PRName.Trim();
                string expectedCommentTrimmed = expectedComment.Trim();

                if (actualComment.Equals(expectedCommentTrimmed, StringComparison.OrdinalIgnoreCase))
                {
                    result.Success = true;
                    result.MatchingPRs = new List<PRInfo> { prInfo };
                    result.ValidationSummary = $"  PR {prNumber} has the comment '{actualComment}'";
                }
                else if (string.IsNullOrWhiteSpace(actualComment))
                {
                    result.Success = false;
                    result.NonCompliantPRs = new List<PRInfo> { prInfo };
                    result.ValidationSummary = $"  PR {prNumber} is not commented (expected '{expectedCommentTrimmed}')";
                }
                else
                {
                    result.Success = false;
                    result.NonCompliantPRs = new List<PRInfo> { prInfo };
                    result.ValidationSummary = $"  PR {prNumber} has the comment '{actualComment}' but expected '{expectedCommentTrimmed}'";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validate that all used (initialized) PRs have comments
        /// </summary>
        private static ValidationCheckResult ValidatePRCommented(string posregFilePath)
        {
            var result = new ValidationCheckResult
            {
                ExpectedMode = "commented"
            };

            try
            {
                var prData = ParsePOSREGFile(posregFilePath);

                if (prData.Count == 0)
                {
                    result.ValidationSummary = "  Could not parse POSREG.VA file";
                    return result;
                }

                // Find all initialized (not uninitialized) PRs
                var initializedPRs = prData.Where(p => p.Value.Mode != PRMode.Uninitialized).ToList();
                
                if (initializedPRs.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No initialized PRs found to check";
                    return result;
                }

                // Check which ones have comments (non-empty name)
                var commented = new List<PRInfo>();
                var notCommented = new List<PRInfo>();

                foreach (var prPair in initializedPRs)
                {
                    var pr = prPair.Value;
                    if (string.IsNullOrWhiteSpace(pr.PRName) || pr.PRName == "")
                    {
                        notCommented.Add(pr);
                    }
                    else
                    {
                        commented.Add(pr);
                    }
                }

                result.MatchingPRs = commented;
                result.NonCompliantPRs = notCommented;

                // Generate summary
                if (notCommented.Count == 0)
                {
                    result.Success = true;
                    var prList = string.Join(", ", commented.Select(p => $"PR {p.PRNumber}"));
                    result.ValidationSummary = $"  All PR used are commented: [{prList}]";
                }
                else
                {
                    result.Success = false;
                    var uncommentedList = string.Join(", ", notCommented.Select(p => $"PR {p.PRNumber}"));
                    var commentedCount = commented.Count;
                    result.ValidationSummary = $"  PR used but not commented: [{uncommentedList}]. ";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Extract PR[*] numbers from the /MN block of a trajectory file.
        /// Preserves file order and stops before /POS.
        /// </summary>
        public static List<int> ExtractPRNumbersFromTrajectoryFile(string trajectoryFilePath)
        {
            var prNumbers = new List<int>();

            try
            {
                if (!File.Exists(trajectoryFilePath))
                    return prNumbers;

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
        /// Validate PR trajectory mode
        /// Extracts PR numbers from trajectory file and validates ONLY first and last PR against POSREG.VA
        /// </summary>
        public static ValidationCheckResult ValidatePRTrajectoryMode(
            string trajectoryFilePath,
            string posregFilePath,
            string expectedMode)
        {
            var result = new ValidationCheckResult
            {
                ExpectedMode = expectedMode
            };

            try
            {
                // Extract ALL PR numbers from trajectory file
                var allPRNumbers = ExtractPRNumbersFromTrajectoryFile(trajectoryFilePath);

                if (allPRNumbers.Count == 0)
                {
                    result.ValidationSummary = "⚠ No PR[*] patterns found in trajectory file";
                    return result;
                }

                // Get ONLY first and last PR in file order from the /MN block
                var prNumbersToCheck = new List<int> { allPRNumbers.First() };
                if (allPRNumbers.Count > 1)
                {
                    prNumbersToCheck.Add(allPRNumbers.Last());
                }
                
                result.RequestedPRNumbers = prNumbersToCheck;

                // Parse POSREG file
                var prData = ParsePOSREGFile(posregFilePath);

                if (prData.Count == 0)
                {
                    result.ValidationSummary = "  Could not parse POSREG.VA file";
                    return result;
                }

                // Convert expected mode string to enum
                var expectedModeEnum = expectedMode.ToLower() switch
                {
                    "joint" => PRMode.JointMode,
                    "cartesian" => PRMode.CartesianMode,
                    "uninitialized" => PRMode.Uninitialized,
                    _ => PRMode.JointMode
                };

                // Validate ONLY first and last PR
                var compliant = new List<PRInfo>();
                var nonCompliant = new List<PRInfo>();

                foreach (var prNum in prNumbersToCheck)
                {
                    if (prData.TryGetValue(prNum, out var prInfo))
                    {
                        if (prInfo.Mode == expectedModeEnum)
                        {
                            compliant.Add(prInfo);
                        }
                        else
                        {
                            nonCompliant.Add(prInfo);
                        }
                    }
                    else
                    {
                        // PR not found in POSREG.VA
                        var missingPR = new PRInfo { PRNumber = prNum, Mode = PRMode.Uninitialized };
                        nonCompliant.Add(missingPR);
                    }
                }

                result.MatchingPRs = compliant;
                result.NonCompliantPRs = nonCompliant;

                // Generate summary
                if (nonCompliant.Count == 0)
                {
                    result.Success = true;
                    var prList = string.Join(", ", compliant.Select(p => $"PR[{p.PRNumber}]"));
                    result.ValidationSummary = $"OK - First and last PR are in {expectedMode} mode: {prList}";
                }
                else
                {
                    result.Success = false;
                    var issues = new List<string>();
                    foreach (var pr in nonCompliant)
                    {
                        if (pr.Mode == PRMode.Uninitialized)
                        {
                            issues.Add($"PR[{pr.PRNumber}] not found in POSREG.VA");
                        }
                        else
                        {
                            var actualMode = pr.Mode.ToString().Replace("Mode", "").ToLower();
                            issues.Add($"PR[{pr.PRNumber}] is in {actualMode} mode");
                        }
                    }
                    result.ValidationSummary = "NOK - " + string.Join(", ", issues);
                }

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validate that ALL PR in trajectory file are in expected mode (Joint or Cartesian)
        /// </summary>
        public static ValidationCheckResult ValidateAllPRTrajectoryMode(
            string trajectoryFilePath,
            string posregFilePath,
            string expectedMode)
        {
            var result = new ValidationCheckResult
            {
                ExpectedMode = expectedMode
            };

            try
            {
                // Extract ALL PR numbers from trajectory file
                var allPRNumbers = ExtractPRNumbersFromTrajectoryFile(trajectoryFilePath);

                if (allPRNumbers.Count == 0)
                {
                    result.ValidationSummary = "⚠ No PR[*] patterns found in trajectory file";
                    return result;
                }

                result.RequestedPRNumbers = allPRNumbers;

                // Parse POSREG file
                var prData = ParsePOSREGFile(posregFilePath);

                if (prData.Count == 0)
                {
                    result.ValidationSummary = "  Could not parse POSREG.VA file";
                    return result;
                }

                // Convert expected mode string to enum
                var expectedModeEnum = expectedMode.ToLower() switch
                {
                    "joint" => PRMode.JointMode,
                    "cartesian" => PRMode.CartesianMode,
                    "uninitialized" => PRMode.Uninitialized,
                    _ => PRMode.JointMode
                };

                // Validate ALL PRs
                var compliant = new List<PRInfo>();
                var nonCompliant = new List<PRInfo>();

                foreach (var prNum in allPRNumbers)
                {
                    if (prData.TryGetValue(prNum, out var prInfo))
                    {
                        if (prInfo.Mode == expectedModeEnum)
                        {
                            compliant.Add(prInfo);
                        }
                        else
                        {
                            nonCompliant.Add(prInfo);
                        }
                    }
                    else
                    {
                        // PR not found in POSREG.VA
                        var missingPR = new PRInfo { PRNumber = prNum, Mode = PRMode.Uninitialized };
                        nonCompliant.Add(missingPR);
                    }
                }

                result.MatchingPRs = compliant;
                result.NonCompliantPRs = nonCompliant;

                // Generate summary
                if (nonCompliant.Count == 0)
                {
                    result.Success = true;
                    var prList = string.Join(", ", compliant.Select(p => $"PR[{p.PRNumber}]"));
                    result.ValidationSummary = $"OK - All {compliant.Count} PRs are in {expectedMode} mode: {prList}";
                }
                else
                {
                    result.Success = false;
                    var issues = new List<string>();
                    foreach (var pr in nonCompliant)
                    {
                        if (pr.Mode == PRMode.Uninitialized)
                        {
                            issues.Add($"PR[{pr.PRNumber}] not found in POSREG.VA");
                        }
                        else
                        {
                            var actualMode = pr.Mode.ToString().Replace("Mode", "").ToLower();
                            issues.Add($"PR[{pr.PRNumber}] is in {actualMode} mode");
                        }
                    }
                    result.ValidationSummary = $"NOK - All PRs must be in {expectedMode} mode. Issues: {string.Join(", ", issues)}";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }
    }
}
