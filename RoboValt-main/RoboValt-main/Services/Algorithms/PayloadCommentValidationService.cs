using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates payloads based on Payload_Comment logic:
    /// 1. If declared correctly (commented AND non-zero):
    ///    - Search trajectory files for usage
    ///    - If found → OK (properly declared and used)
    ///    - If not found → NOK (declared but never used)
    /// 2. If NOT declared correctly (missing comment OR all zeros):
    ///    - Always NOK (declared incorrectly)
    /// </summary>
    public static class PayloadCommentValidationService
    {
        /// <summary>
        /// Validates a specific payload based on Payload_Comment logic
        /// </summary>
        public static ValidationResult ValidatePayloadComment(
            int payloadNumber,
            string payloadDtFilePath,
            string trajectorySearchDirectory)
        {
            var result = new ValidationResult();

            try
            {
                // Step 1: Parse PAYLOAD.DT to get payload definition
                var payloadDefinitions = ParsePayloadDtFile(payloadDtFilePath);
                var payloadKey = $"PAYLOAD[{payloadNumber}]";

                if (!payloadDefinitions.ContainsKey(payloadNumber))
                {
                    result.IsCompliant = false;
                    result.StatusMessage = "ERROR";
                    result.ValidationSummary = $"{payloadKey} not found in PAYLOAD.DT";
                    result.ValidationIssues = new List<string> { $"{payloadKey} not found in PAYLOAD.DT" };
                    return result;
                }

                var payloadDef = payloadDefinitions[payloadNumber];
                var isCommented = !string.IsNullOrWhiteSpace(payloadDef.Comment);
                var isZero = payloadDef.IsAllZeroCoordinates();
                var isDeclaredCorrectly = isCommented && !isZero;

                // Step 2: If payload has zero coordinates, return NA instead of NOK
                if (isZero)
                {
                    var declarationIssue = !isCommented
                        ? $"{payloadKey} is uncommented and values all are 0"
                        : $"{payloadKey} values all are 0";

                    result.IsCompliant = false;
                    result.StatusMessage = "NA";
                    result.ValidationSummary = declarationIssue;
                    result.ValidationDetails = new List<string>
                    {
                        $"Payload Status: Commented={isCommented}, HasNonZeroCoordinates={!isZero}",
                        $"Coordinates: X={payloadDef.X}, Y={payloadDef.Y}, Z={payloadDef.Z}",
                        "Usage: Not evaluated because payload coordinates are all zero"
                    };
                    result.ValidationIssues = new List<string> { declarationIssue };
                    return result;
                }

                // Step 3: If payload is missing comment, keep NOK
                if (!isCommented)
                {
                    var declarationIssue = $"{payloadKey} is uncommented";

                    var usageFilesNOK = SearchPayloadInTrajectoryFiles(payloadNumber, trajectorySearchDirectory, stopAtFirstMatch: false);

                    result.IsCompliant = false;
                    result.StatusMessage = "NOK";

                    if (usageFilesNOK.Count > 0)
                    {
                        result.ValidationSummary = $"{declarationIssue}, found in: {string.Join(", ", usageFilesNOK)}";
                        result.ValidationDetails = new List<string>
                        {
                            $"Payload Status: Commented={isCommented}, HasNonZeroCoordinates={!isZero}",
                            $"Coordinates: X={payloadDef.X}, Y={payloadDef.Y}, Z={payloadDef.Z}",
                            $"Files using {payloadKey}: {string.Join(", ", usageFilesNOK)}"
                        };
                        result.ValidationIssues = new List<string> { declarationIssue };
                    }
                    else
                    {
                        result.ValidationSummary = declarationIssue;
                        result.ValidationDetails = new List<string>
                        {
                            $"Payload Status: Commented={isCommented}, HasNonZeroCoordinates={!isZero}",
                            $"Coordinates: X={payloadDef.X}, Y={payloadDef.Y}, Z={payloadDef.Z}",
                            "Usage: Not found in any trajectory files"
                        };
                        result.ValidationIssues = new List<string> { declarationIssue };
                    }
                    return result;
                }

                // Step 3: Payload is declared correctly, search trajectory files for usage (stop at first match for OK)
                var usageFilesOK = SearchPayloadInTrajectoryFiles(payloadNumber, trajectorySearchDirectory, stopAtFirstMatch: true);

                if (usageFilesOK.Count > 0)
                {
                    // Payload is properly declared and used, OK
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = $"{payloadKey} declared properly and used in: {usageFilesOK[0]}";
                    result.ValidationDetails = new List<string>
                    {
                        $"Comment: {payloadDef.Comment}",
                        $"Coordinates: X={payloadDef.X}, Y={payloadDef.Y}, Z={payloadDef.Z}",
                        $"File using {payloadKey}: {usageFilesOK[0]}"
                    };
                    return result;
                }

                // Payload is declared correctly but not used anywhere, NOK
                result.IsCompliant = false;
                result.StatusMessage = "NOK";
                result.ValidationSummary = $"{payloadKey} is declared properly but never used in any trajectory files";
                result.ValidationDetails = new List<string>
                {
                    $"Comment: {payloadDef.Comment}",
                    $"Coordinates: X={payloadDef.X}, Y={payloadDef.Y}, Z={payloadDef.Z}",
                    "Usage: Not found in any trajectory files"
                };
                result.ValidationIssues = new List<string> { $"{payloadKey} declared but never used" };

                return result;
            }
            catch (Exception ex)
            {
                result.IsCompliant = false;
                result.StatusMessage = "ERROR";
                result.ValidationSummary = $"Error during validation: {ex.Message}";
                result.ValidationIssues = new List<string> { ex.Message };
                return result;
            }
        }

        /// <summary>
        /// Searches for payload usage in trajectory files
        /// Searches in: TRAJ*.LS, T_REPRISE*.LS, TN_*.LS, TC_*.LS, T_*.LS
        /// Excludes: T_P_OUTx.LS, T_D_OUTx.LS
        /// </summary>
        private static List<string> SearchPayloadInTrajectoryFiles(int payloadNumber, string searchDirectory, bool stopAtFirstMatch = false)
        {
            var foundInFiles = new List<string>();

            try
            {
                if (!Directory.Exists(searchDirectory))
                    return foundInFiles;

                var payloadPattern = $@"PAYLOAD\s*\[\s*{payloadNumber}\s*\]";

                // Get all trajectory files
                var trajectoryFiles = Directory.GetFiles(searchDirectory, "*.LS", SearchOption.AllDirectories);

                foreach (var file in trajectoryFiles)
                {
                    var fileName = Path.GetFileName(file);

                    // Check if file matches required patterns
                    if (!MatchesRequiredPattern(fileName))
                        continue;

                    // Check if file should be excluded
                    if (ShouldExcludeFile(fileName))
                        continue;

                    // Search for payload in file
                    try
                    {
                        var content = File.ReadAllText(file);
                        if (Regex.IsMatch(content, payloadPattern, RegexOptions.IgnoreCase))
                        {
                            foundInFiles.Add(fileName);
                            if (stopAtFirstMatch)
                                return foundInFiles; // Stop searching after first match
                        }
                    }
                    catch
                    {
                        // Skip files that can't be read
                    }
                }
            }
            catch
            {
                // Return empty list on error
            }

            return foundInFiles;
        }

        /// <summary>
        /// Checks if file matches required trajectory file patterns
        /// </summary>
        private static bool MatchesRequiredPattern(string fileName)
        {
            var patterns = new[]
            {
                @"^TRAJ.*\.LS$",
                @"^T_REPRISE.*\.LS$",
                @"^TN_.*\.LS$",
                @"^TC_.*\.LS$",
                @"^T_.*\.LS$"
            };

            return patterns.Any(pattern => 
                Regex.IsMatch(fileName, pattern, RegexOptions.IgnoreCase));
        }

        /// <summary>
        /// Checks if file should be excluded
        /// Excludes: T_P_OUTx.LS, T_D_OUTx.LS
        /// </summary>
        private static bool ShouldExcludeFile(string fileName)
        {
            var excludePatterns = new[]
            {
                @"^T_P_OUT\d+\.LS$",
                @"^T_D_OUT\d+\.LS$"
            };

            return excludePatterns.Any(pattern =>
                Regex.IsMatch(fileName, pattern, RegexOptions.IgnoreCase));
        }

        /// <summary>
        /// Parses PAYLOAD.DT file and extracts payload definitions
        /// </summary>
        private static Dictionary<int, PayloadDefinition> ParsePayloadDtFile(string filePath)
        {
            var definitions = new Dictionary<int, PayloadDefinition>();

            try
            {
                if (!File.Exists(filePath))
                    return definitions;

                var lines = File.ReadAllLines(filePath);

                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line) || !line.Contains("PAYLOAD"))
                        continue;

                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("//"))
                        continue;

                    var parts = line.Split(';');
                    if (parts.Length < 4)
                        continue;

                    var payloadMatch = Regex.Match(line, @"PAYLOAD\s*\[\s*(\d+)\s*\]");
                    if (!payloadMatch.Success || !int.TryParse(payloadMatch.Groups[1].Value, out int payloadNum))
                        continue;

                    if (!definitions.ContainsKey(payloadNum))
                    {
                        definitions[payloadNum] = new PayloadDefinition { Number = payloadNum };
                    }

                    var description = parts[1].ToLowerInvariant();

                    // Extract comment
                    if (description.Contains("commentaire"))
                    {
                        if (parts.Length > 3)
                        {
                            string commentValue = parts[3].Trim();
                            if (!string.IsNullOrEmpty(commentValue) && !commentValue.StartsWith("*SYSTEM*", StringComparison.OrdinalIgnoreCase))
                            {
                                definitions[payloadNum].Comment = commentValue;
                            }
                        }
                    }

                    // Extract X coordinate
                    if (description.Contains("cdg x"))
                    {
                        if (parts.Length > 3 && double.TryParse(parts[3].Trim(), out double xValue))
                        {
                            definitions[payloadNum].X = xValue;
                        }
                    }

                    // Extract Y coordinate
                    if (description.Contains("cdg y"))
                    {
                        if (parts.Length > 3 && double.TryParse(parts[3].Trim(), out double yValue))
                        {
                            definitions[payloadNum].Y = yValue;
                        }
                    }

                    // Extract Z coordinate
                    if (description.Contains("cdg z"))
                    {
                        if (parts.Length > 3 && double.TryParse(parts[3].Trim(), out double zValue))
                        {
                            definitions[payloadNum].Z = zValue;
                        }
                    }
                }
            }
            catch
            {
                // Return empty dictionary on error
            }

            return definitions;
        }

        private class PayloadDefinition
        {
            public int Number { get; set; }
            public string Comment { get; set; } = string.Empty;
            public double X { get; set; }
            public double Y { get; set; }
            public double Z { get; set; }

            public bool IsAllZeroCoordinates()
            {
                const double tolerance = 0.0001;
                return Math.Abs(X) < tolerance &&
                       Math.Abs(Y) < tolerance &&
                       Math.Abs(Z) < tolerance;
            }
        }
    }
}
