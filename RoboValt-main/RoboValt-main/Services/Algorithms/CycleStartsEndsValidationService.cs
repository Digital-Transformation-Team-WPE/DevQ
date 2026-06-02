using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates FANUC TP robot program cycles for Cycle_Starts_Ends_X logic:
    /// - X can be any comment type (PEO, CALPOS, REPLI, etc.)
    /// - First trajectory in each cycle: first P/PR instruction must have comment containing X
    /// - Last trajectory in each cycle: last P/PR instruction must have comment containing X
    /// </summary>
    public static class CycleStartsEndsValidationService
    {
        public class ValidationResult
        {
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = ""; // OK or NOK
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
        }

        /// <summary>
        /// Validates all cycles in a robot program file for specified comment type on trajectory starts/ends
        /// </summary>
        public static ValidationResult ValidateCycleStartsEnds(string filePath, string commentType)
        {
            var result = new ValidationResult();

            try
            {
                if (!File.Exists(filePath))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = $"File not found: {filePath}";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(commentType))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = "Comment type must be specified";
                    return result;
                }

                var lines = File.ReadAllLines(filePath);
                var fileDirectory = Path.GetDirectoryName(filePath);
                var validationErrors = new List<string>();

                // Extract cycles using state machine: first LBL = cycle 1, then only LBL after JMP LBL[9999]
                var cyclePattern = @"LBL\[(\d+)(?::([^\]]*))?\]";
                var jumpPattern = @"JMP\s+LBL\[9999\]";
                bool lastWasJumpTo9999 = true; // Start: first LBL is a cycle
                int cycleStartIdx = -1;

                for (int i = 0; i < lines.Length; i++)
                {
                    // Check for JMP LBL[9999] boundary
                    if (Regex.IsMatch(lines[i], jumpPattern, RegexOptions.IgnoreCase))
                    {
                        lastWasJumpTo9999 = true;
                        continue;
                    }

                    // Check for LBL[...]
                    var cycleMatch = Regex.Match(lines[i], cyclePattern, RegexOptions.IgnoreCase);
                    if (!cycleMatch.Success) continue;

                    var cycleNumber = cycleMatch.Groups[1].Value;

                    // Only process if: at cycle boundary AND not program exit label
                    if (lastWasJumpTo9999 && cycleNumber != "9999")
                    {
                        cycleStartIdx = i;

                        // Find cycle end (next LBL or JMP LBL[9999])
                        int cycleEndIdx = i + 1;
                        while (cycleEndIdx < lines.Length)
                        {
                            if (Regex.IsMatch(lines[cycleEndIdx], jumpPattern, RegexOptions.IgnoreCase))
                                break;
                            if (Regex.IsMatch(lines[cycleEndIdx], cyclePattern, RegexOptions.IgnoreCase))
                                break;
                            cycleEndIdx++;
                        }

                        var cycleContent = string.Join("\n", lines.Skip(cycleStartIdx).Take(cycleEndIdx - cycleStartIdx));
                        var trajectoryCalls = ExtractTrajectoryCallsInOrder(cycleContent);

                        if (trajectoryCalls.Count > 0)
                        {
                            // Check first trajectory
                            var firstTrajName = trajectoryCalls[0];
                            var firstTrajValidation = ValidateTrajectoryStart(fileDirectory, firstTrajName, commentType);
                            if (!firstTrajValidation.IsValid)
                            {
                                validationErrors.Add($"for the cycle {cycleNumber} the first call file {firstTrajName} has {firstTrajValidation.Comment} instead of {commentType.ToLower()}");
                            }

                            // Check last trajectory
                            var lastTrajName = trajectoryCalls[trajectoryCalls.Count - 1];
                            var lastTrajValidation = ValidateTrajectoryEnd(fileDirectory, lastTrajName, commentType);
                            if (!lastTrajValidation.IsValid)
                            {
                                validationErrors.Add($"for the cycle {cycleNumber} the last call file {lastTrajName} has {lastTrajValidation.Comment} instead of {commentType.ToLower()}");
                            }
                        }

                        lastWasJumpTo9999 = false; // Now inside a cycle
                    }
                    // If lastWasJumpTo9999 is false, this LBL is internal (ignored)
                }

                if (validationErrors.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = $"All cycles have trajectories with {commentType.ToUpper()} comments at start and end";
                }
                else
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "NOK";
                    result.ValidationDetails = validationErrors;
                    result.ValidationSummary = string.Join(" | ", validationErrors);
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

        private static List<string> ExtractTrajectoryCallsInOrder(string cycleContent)
        {
            var trajectories = new List<string>();

            // Pattern 1: CALL_PRG(num,'TRAJ*',num)
            var pattern1 = @"CALL_PRG\s*\(\s*\d+\s*,\s*'(TRAJ\d+)'";
            var matches1 = Regex.Matches(cycleContent, pattern1, RegexOptions.IgnoreCase);

            foreach (Match match in matches1)
            {
                var trajName = match.Groups[1].Value;
                if (!trajectories.Contains(trajName))
                {
                    trajectories.Add(trajName);
                }
            }

            // Pattern 2: CALL TRAJ* (direct calls, not using CALL_PRG)
            var pattern2 = @"CALL\s+(TRAJ\d+)";
            var matches2 = Regex.Matches(cycleContent, pattern2, RegexOptions.IgnoreCase);

            foreach (Match match in matches2)
            {
                var trajName = match.Groups[1].Value;
                if (!trajectories.Contains(trajName))
                {
                    trajectories.Add(trajName);
                }
            }

            return trajectories;
        }

        private static (bool IsValid, string Comment) ValidateTrajectoryStart(string fileDirectory, string trajName, string commentType)
        {
            var trajFilePath = Path.Combine(fileDirectory, $"{trajName}.ls");
            if (!File.Exists(trajFilePath))
            {
                return (false, "file not found");
            }

            try
            {
                var trajContent = File.ReadAllText(trajFilePath);
                var firstPRInstruction = ExtractFirstPRInstruction(trajContent);

                if (firstPRInstruction == null)
                {
                    return (false, "no P/PR instruction found");
                }

                var comment = ExtractCommentFromInstruction(firstPRInstruction);
                if (comment != null && comment.Contains(commentType, StringComparison.OrdinalIgnoreCase))
                {
                    return (true, comment);
                }

                return (false, comment ?? "no comment");
            }
            catch
            {
                return (false, "error reading file");
            }
        }

        private static (bool IsValid, string Comment) ValidateTrajectoryEnd(string fileDirectory, string trajName, string commentType)
        {
            var trajFilePath = Path.Combine(fileDirectory, $"{trajName}.ls");
            if (!File.Exists(trajFilePath))
            {
                return (false, "file not found");
            }

            try
            {
                var trajContent = File.ReadAllText(trajFilePath);
                var lastPRInstruction = ExtractLastPRInstruction(trajContent);

                if (lastPRInstruction == null)
                {
                    return (false, "no P/PR instruction found");
                }

                var comment = ExtractCommentFromInstruction(lastPRInstruction);
                if (comment != null && comment.Contains(commentType, StringComparison.OrdinalIgnoreCase))
                {
                    return (true, comment);
                }

                return (false, comment ?? "no comment");
            }
            catch
            {
                return (false, "error reading file");
            }
        }

        private static string ExtractFirstPRInstruction(string trajContent)
        {
            var lines = trajContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            foreach (var line in lines)
            {
                if (Regex.IsMatch(line, @"\bPR\[", RegexOptions.IgnoreCase))
                {
                    return line.Trim();
                }
            }
            return null;
        }

        private static string ExtractLastPRInstruction(string trajContent)
        {
            var lines = trajContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            for (int i = lines.Length - 1; i >= 0; i--)
            {
                if (Regex.IsMatch(lines[i], @"\bPR\[", RegexOptions.IgnoreCase))
                {
                    return lines[i].Trim();
                }
            }
            return null;
        }

        private static string ExtractCommentFromInstruction(string instruction)
        {
            // Extract comment from PR[number:comment] format
            // Pattern: PR[digits:comment]
            var match = Regex.Match(instruction, @"PR\[\d+:([^\]]*)\]", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value.Trim();
            }
            return null;
        }
    }
}
