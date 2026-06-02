using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates PLC Zone Count in trajectory files
    /// Logic:
    /// 1. Determine if trajectory is a HANDLING type (contains GRIP_* instructions or specific keywords in comments)
    /// 2. If HANDLING → Status = "NA", Message = "it is a handling traj"
    /// 3. If NOT HANDLING → Count ZON_IN, ZON_OUT, ZONS_OUT separately
    ///    - If ANY count > 1 → NOK (e.g., 2 ZON_OUT or 2 ZON_IN)
    ///    - If all counts ≤ 1 → OK (e.g., 1 ZON_IN + 1 ZON_OUT = one pair)
    /// </summary>
    public static class PLCZoneCountValidationService
    {
        // Keywords that indicate a HANDLING trajectory
        private static readonly string[] HandlingInstructions = { "GRIP_OPN", "GRIP_CLS", "GRIP_CHK" };
        private static readonly string[] HandlingComments = { "Prise", "Pick", "Place", "MPP", "TAC", "Out_" };

        /// <summary>
        /// Validates PLC Zone Count for a trajectory file
        /// </summary>
        /// <param name="trajectoryFilePath">Path to the trajectory file to validate</param>
        /// <returns>Tuple: (status, message) where status is "OK"/"NOK"/"NA"</returns>
        public static (string Status, string Message) ValidatePLCZoneCount(string trajectoryFilePath)
        {
            try
            {
                if (!File.Exists(trajectoryFilePath))
                {
                    return ("NA", "Trajectory file not found");
                }

                var content = File.ReadAllText(trajectoryFilePath);

                // Step 1: Check if it's a HANDLING trajectory
                if (IsHandlingTrajectory(content))
                {
                    return ("NA", "it is a handling traj");
                }

                // Step 2: Count PLC Zone instructions separately (if not handling)
                var (zonInCount, zonOutCount, zonsOutCount) = CountPLCZoneInstructionsSeparately(content);

                // Step 3: Apply rule logic - if ANY count > 1, then NOK
                int maxCount = Math.Max(Math.Max(zonInCount, zonOutCount), zonsOutCount);
                if (maxCount > 1)
                {
                    return ("NOK", $"Too many PLC zones count={maxCount}");
                }
                else
                {
                    return ("OK", $"PLC zone count valid");
                }
            }
            catch
            {
                return ("NA", "Error during validation");
            }
        }

        /// <summary>
        /// Determines if trajectory is a HANDLING type
        /// Checks for:
        /// 1. GRIP_OPN, GRIP_CLS, or GRIP_CHK instructions
        /// 2. PR comment keywords: Prise, Pick, Place, MPP, TAC, Out_
        /// </summary>
        private static bool IsHandlingTrajectory(string content)
        {
            // Check for GRIP instructions (case-insensitive)
            foreach (var instruction in HandlingInstructions)
            {
                if (Regex.IsMatch(content, $@"\b{Regex.Escape(instruction)}\b", RegexOptions.IgnoreCase))
                {
                    return true;
                }
            }

            // Check for handling keywords in PR comments
            // Pattern: PR[num:comment]
            var prCommentPattern = @"PR\[\d+:([^\]]*)\]";
            var matches = Regex.Matches(content, prCommentPattern, RegexOptions.IgnoreCase);

            foreach (Match match in matches)
            {
                var comment = match.Groups[1].Value;
                foreach (var keyword in HandlingComments)
                {
                    if (comment.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Counts occurrences of each PLC Zone instruction separately
        /// Returns: (ZON_IN count, ZON_OUT count, ZONS_OUT count)
        /// Example: 2 ZON_OUT + 1 ZON_IN = (1, 2, 0)
        /// Rule: If any count > 1 → NOK
        /// </summary>
        private static (int zonInCount, int zonOutCount, int zonsOutCount) CountPLCZoneInstructionsSeparately(string content)
        {
            int zonInCount = 0;
            int zonOutCount = 0;
            int zonsOutCount = 0;

            // Count ZON_IN
            var zonInPattern = @"\bZON_IN\b";
            var zonInMatches = Regex.Matches(content, zonInPattern, RegexOptions.IgnoreCase);
            zonInCount = zonInMatches.Count;

            // Count ZON_OUT
            var zonOutPattern = @"\bZON_OUT\b";
            var zonOutMatches = Regex.Matches(content, zonOutPattern, RegexOptions.IgnoreCase);
            zonOutCount = zonOutMatches.Count;

            // Count ZONS_OUT
            var zonsOutPattern = @"\bZONS_OUT\b";
            var zonsOutMatches = Regex.Matches(content, zonsOutPattern, RegexOptions.IgnoreCase);
            zonsOutCount = zonsOutMatches.Count;

            return (zonInCount, zonOutCount, zonsOutCount);
        }
    }
}
