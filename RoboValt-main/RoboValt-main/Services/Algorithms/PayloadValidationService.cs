using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates that all payloads declared in trajectory files are:
    /// 1. Commented (have a non-empty comment in PAYLOAD.DT)
    /// 2. Not Zero (have at least one non-zero coordinate: X, Y, or Z)
    /// </summary>
    public static class PayloadValidationService
    {
        /// <summary>
        /// Validates payloads used in trajectory file against PAYLOAD.DT definitions
        /// </summary>
        public static ValidationResult ValidatePayloadsCommentedAndNotZero(
            string trajectoryFilePath, 
            string payloadDtFilePath)
        {
            var result = new ValidationResult();

            try
            {
                // Step 1: Extract PAYLOAD[n] numbers from trajectory file
                var usedPayloads = ExtractPayloadNumbersFromFile(trajectoryFilePath);
                if (usedPayloads.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "No payloads used in trajectory file";
                    return result;
                }

                // Step 2: Parse PAYLOAD.DT file to get payload definitions
                var payloadDefinitions = ParsePayloadDtFile(payloadDtFilePath);

                // Step 3: Validate each payload
                var validationDetails = new List<string>();
                var issues = new List<string>();

                foreach (var payloadNum in usedPayloads.OrderBy(x => x))
                {
                    var payloadKey = $"PAYLOAD[{payloadNum}]";
                    
                    if (!payloadDefinitions.ContainsKey(payloadNum))
                    {
                        issues.Add($"{payloadKey} not found in PAYLOAD.DT");
                        continue;
                    }

                    var payloadDef = payloadDefinitions[payloadNum];
                    var isCommented = !string.IsNullOrWhiteSpace(payloadDef.Comment);
                    var isZero = payloadDef.IsAllZeroCoordinates();

                    // Validation logic
                    if (isCommented && !isZero)
                    {
                        validationDetails.Add($"✓ {payloadKey} is commented and used");
                    }
                    else if (!isCommented && isZero)
                    {
                        issues.Add($"✗ {payloadKey} not commented and is zero not used");
                    }
                    else if (!isCommented)
                    {
                        issues.Add($"✗ {payloadKey} not commented");
                    }
                    else if (isZero)
                    {
                        issues.Add($"✗ {payloadKey} is zero not used");
                    }
                }

                // Step 4: Generate result
                result.IsCompliant = issues.Count == 0;
                result.StatusMessage = result.IsCompliant ? "OK" : "NOK";
                result.ValidationDetails = validationDetails;
                result.ValidationIssues = issues;

                // Build summary
                var summaryParts = new List<string>();
                if (validationDetails.Count > 0)
                {
                    summaryParts.Add($"Compliant: {string.Join(", ", validationDetails.Select(d => d.Substring(2)))}");
                }
                if (issues.Count > 0)
                {
                    summaryParts.Add($"Non-Compliant: {string.Join(", ", issues.Select(i => i.Substring(2)))}");
                }

                result.ValidationSummary = string.Join(" | ", summaryParts);

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

        /// <summary>
        /// Validates that no two payloads have identical parameter values (Mass, CDG X/Y/Z, Inertia IX/IY/IZ)
        /// </summary>
        public static ValidationResult ValidatePayloadDuplicateValues(string payloadDtFilePath)
        {
            var result = new ValidationResult();

            try
            {
                // Parse PAYLOAD.DT file to get all payload definitions
                var payloadDefinitions = ParsePayloadDtFileComplete(payloadDtFilePath);

                if (payloadDefinitions.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "No payloads found in PAYLOAD.DT";
                    return result;
                }

                // Find payloads with duplicate values
                var duplicateGroups = FindDuplicatePayloads(payloadDefinitions);

                if (duplicateGroups.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "All payloads have unique values";
                    return result;
                }

                // Build non-compliant result
                result.IsCompliant = false;
                result.StatusMessage = "NOK";

                var issues = new List<string>();
                foreach (var group in duplicateGroups)
                {
                    var payloadNumbers = string.Join(", ", group.Select(p => $"PAYLOAD[{p.Number}]"));
                    issues.Add($"{payloadNumbers} have same values");
                }

                result.ValidationIssues = issues;
                result.ValidationSummary = string.Join(" | ", issues);

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

        /// <summary>
        /// Validates that all Tool Frame comments from FRAME.DG are used in PAYLOAD.DT comments
        /// Removes "OUT_" prefix from tool frame comments before checking
        /// </summary>
        public static ValidationResult ValidateToolFrameCommentsUsedInPayload(
            string frameFilePath,
            string payloadDtFilePath)
        {
            var result = new ValidationResult();

            try
            {
                // Step 1: Extract tool frame comments from FRAME.DG
                var toolFrameComments = ExtractToolFrameComments(frameFilePath);
                
                if (toolFrameComments.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "No tool frame comments found";
                    return result;
                }

                // Step 2: Remove "OUT_" prefix from tool frame comments
                var cleanedToolFrameComments = toolFrameComments
                    .Select(comment => comment.StartsWith("OUT_", StringComparison.OrdinalIgnoreCase) 
                        ? comment.Substring(4) 
                        : comment)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Step 3: Extract all payload comments from PAYLOAD.DT
                var payloadComments = ExtractPayloadComments(payloadDtFilePath);

                // Step 4: Check which tool frame comments are NOT used in payload comments
                var unusedComments = new List<string>();
                foreach (var toolComment in cleanedToolFrameComments)
                {
                    if (!payloadComments.Any(pc => pc.Equals(toolComment, StringComparison.OrdinalIgnoreCase)))
                    {
                        unusedComments.Add(toolComment);
                    }
                }

                // Step 5: Generate result
                if (unusedComments.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "All tool frame comments are used in PAYLOAD";
                    return result;
                }

                // Non-compliant: some tool frame comments are not used
                result.IsCompliant = false;
                result.StatusMessage = "NOK";
                
                var issues = new List<string>();
                foreach (var unused in unusedComments)
                {
                    issues.Add($"Tool frame comment {unused} not used in any PAYLOAD");
                }

                result.ValidationIssues = issues;
                result.ValidationSummary = "Tool frame comments " + string.Join(", ", unusedComments) + " not used in any PAYLOAD";

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

        /// <summary>
        /// Extracts all comments from Tool Frame section in FRAME.DG file
        /// </summary>
        private static List<string> ExtractToolFrameComments(string frameFilePath)
        {
            var comments = new List<string>();

            try
            {
                if (!File.Exists(frameFilePath))
                    return comments;

                var lines = File.ReadAllLines(frameFilePath);
                bool inToolFrameSection = false;
                bool inJogFrameSection = false;

                foreach (var line in lines)
                {
                    var trimmed = line.Trim();

                    // Check for Tool Frame section start
                    if (trimmed.Equals("Tool Frame", StringComparison.OrdinalIgnoreCase))
                    {
                        inToolFrameSection = true;
                        inJogFrameSection = false;
                        continue;
                    }

                    // Check for other sections (Jog Frame, User Frame)
                    if (trimmed.Equals("Jog Frame", StringComparison.OrdinalIgnoreCase) ||
                        trimmed.Equals("User Frame", StringComparison.OrdinalIgnoreCase))
                    {
                        inToolFrameSection = false;
                        inJogFrameSection = true;
                        continue;
                    }

                    // Extract comments from Tool Frame section
                    if (inToolFrameSection && !string.IsNullOrWhiteSpace(trimmed) && !trimmed.StartsWith("//"))
                    {
                        // Lines with coordinates and comment look like:
                        // 96.8   500.1   427.7     0.0     0.0     0.0 OUT_PREH1_P64
                        // Extract the last non-empty token as comment (if it exists and is not all digits/decimals/spaces)
                        var tokens = trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        
                        if (tokens.Length > 6)
                        {
                            // The comment is everything after the 6 coordinates
                            var potentialComment = string.Join(" ", tokens.Skip(6));
                            
                            // Only add if it's not all zeros and is not the coordinate itself
                            if (!string.IsNullOrWhiteSpace(potentialComment) && 
                                !potentialComment.All(c => char.IsDigit(c) || c == '.' || c == '-' || c == ' '))
                            {
                                comments.Add(potentialComment.Trim());
                            }
                        }
                    }
                }
            }
            catch
            {
                // Return empty list on error
            }

            return comments;
        }

        /// <summary>
        /// Extracts all non-empty comments from PAYLOAD.DT file
        /// </summary>
        private static List<string> ExtractPayloadComments(string payloadDtFilePath)
        {
            var comments = new List<string>();

            try
            {
                if (!File.Exists(payloadDtFilePath))
                    return comments;

                var lines = File.ReadAllLines(payloadDtFilePath);

                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line) || !line.Contains("Commentaire"))
                        continue;

                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("//"))
                        continue;

                    var parts = line.Split(';');
                    if (parts.Length < 4)
                        continue;

                    // Comment is in parts[3]
                    string commentValue = parts[3].Trim();
                    
                    // Only add if it's not empty and doesn't start with system reference
                    if (!string.IsNullOrEmpty(commentValue) && 
                        !commentValue.StartsWith("*SYSTEM*", StringComparison.OrdinalIgnoreCase))
                    {
                        comments.Add(commentValue);
                    }
                }
            }
            catch
            {
                // Return empty list on error
            }

            return comments;
        }

        /// <summary>
        /// Finds groups of payloads that have identical values for all 7 parameters
        /// </summary>
        private static List<List<PayloadDefinition>> FindDuplicatePayloads(Dictionary<int, PayloadDefinition> payloads)
        {
            var duplicateGroups = new List<List<PayloadDefinition>>();
            var processedPayloads = new HashSet<int>();

            var payloadList = payloads.Values.ToList();

            for (int i = 0; i < payloadList.Count; i++)
            {
                if (processedPayloads.Contains(payloadList[i].Number))
                    continue;

                // SKIP payloads with zero position/inertia values (not properly configured)
                if (IsPayloadIgnored(payloadList[i]))
                    continue;

                var group = new List<PayloadDefinition> { payloadList[i] };
                processedPayloads.Add(payloadList[i].Number);

                // Find all payloads with identical values
                for (int j = i + 1; j < payloadList.Count; j++)
                {
                    if (processedPayloads.Contains(payloadList[j].Number))
                        continue;

                    // SKIP payloads with zero position/inertia values (not properly configured)
                    if (IsPayloadIgnored(payloadList[j]))
                        continue;

                    if (PayloadsHaveSameValues(payloadList[i], payloadList[j]))
                    {
                        group.Add(payloadList[j]);
                        processedPayloads.Add(payloadList[j].Number);
                    }
                }

                // Only add to duplicates if group has more than one payload
                if (group.Count > 1)
                {
                    duplicateGroups.Add(group);
                }
            }

            return duplicateGroups;
        }

        /// <summary>
        /// Check if payload should be IGNORED from duplicate validation
        /// A payload is ignored if all geometric/inertia values are zero (not properly configured)
        /// Rule: If X=0, Y=0, Z=0, IX=0, IY=0, IZ=0 → IGNORE (Mass value doesn't matter)
        /// </summary>
        private static bool IsPayloadIgnored(PayloadDefinition payload)
        {
            const double tolerance = 0.0001;

            // If all position and inertia values are ~0, this payload is not configured
            // Ignore it from duplicate checking
            return Math.Abs(payload.X) < tolerance &&
                   Math.Abs(payload.Y) < tolerance &&
                   Math.Abs(payload.Z) < tolerance &&
                   Math.Abs(payload.InertiaIX) < tolerance &&
                   Math.Abs(payload.InertiaIY) < tolerance &&
                   Math.Abs(payload.InertiaIZ) < tolerance;
        }

        /// <summary>
        /// Checks if two payloads have identical values for all 7 parameters
        /// </summary>
        private static bool PayloadsHaveSameValues(PayloadDefinition p1, PayloadDefinition p2)
        {
            const double tolerance = 0.0001;

            // Compare all 7 parameters
            return Math.Abs(p1.Mass - p2.Mass) < tolerance &&
                   Math.Abs(p1.X - p2.X) < tolerance &&
                   Math.Abs(p1.Y - p2.Y) < tolerance &&
                   Math.Abs(p1.Z - p2.Z) < tolerance &&
                   Math.Abs(p1.InertiaIX - p2.InertiaIX) < tolerance &&
                   Math.Abs(p1.InertiaIY - p2.InertiaIY) < tolerance &&
                   Math.Abs(p1.InertiaIZ - p2.InertiaIZ) < tolerance;
        }

        /// <summary>
        /// Parses PAYLOAD.DT file and extracts complete payload definitions including Mass and Inertia
        /// </summary>
        private static Dictionary<int, PayloadDefinition> ParsePayloadDtFileComplete(string filePath)
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

                    // Extract Mass (Masse)
                    if (description.Contains("masse") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double massValue))
                        {
                            definitions[payloadNum].Mass = massValue;
                        }
                    }

                    // Extract X coordinate (CDG X)
                    if (description.Contains("cdg x") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double xValue))
                        {
                            definitions[payloadNum].X = xValue;
                        }
                    }

                    // Extract Y coordinate (CDG Y)
                    if (description.Contains("cdg y") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double yValue))
                        {
                            definitions[payloadNum].Y = yValue;
                        }
                    }

                    // Extract Z coordinate (CDG Z)
                    if (description.Contains("cdg z") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double zValue))
                        {
                            definitions[payloadNum].Z = zValue;
                        }
                    }

                    // Extract Inertia IX
                    if (description.Contains("inertie ix") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double ixValue))
                        {
                            definitions[payloadNum].InertiaIX = ixValue;
                        }
                    }

                    // Extract Inertia IY
                    if (description.Contains("inertie iy") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double iyValue))
                        {
                            definitions[payloadNum].InertiaIY = iyValue;
                        }
                    }

                    // Extract Inertia IZ
                    if (description.Contains("inertie iz") && parts.Length > 3)
                    {
                        if (double.TryParse(parts[3].Trim(), out double izValue))
                        {
                            definitions[payloadNum].InertiaIZ = izValue;
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

        /// <summary>
        /// Extracts all PAYLOAD[n] numbers used in a trajectory file
        /// </summary>
        private static List<int> ExtractPayloadNumbersFromFile(string filePath)
        {
            var payloads = new HashSet<int>();

            try
            {
                if (!File.Exists(filePath))
                    return new List<int>();

                var content = File.ReadAllText(filePath);
                
                // Match PAYLOAD[n] where n is a number
                var matches = Regex.Matches(content, @"PAYLOAD\s*\[\s*(\d+)\s*\]", RegexOptions.IgnoreCase);
                
                foreach (Match match in matches)
                {
                    if (int.TryParse(match.Groups[1].Value, out int payloadNum))
                    {
                        payloads.Add(payloadNum);
                    }
                }
            }
            catch
            {
                // Return empty list on error
            }

            return payloads.ToList();
        }

        /// <summary>
        /// Parses PAYLOAD.DT file and extracts payload definitions
        /// Format: Commentaire PAYLOAD[n]; [field];[comment];...
        ///         CDG X PAYLOAD[n]; [field]; [X_value]...
        ///         CDG Y PAYLOAD[n]; [field]; [Y_value]...
        ///         CDG Z PAYLOAD[n]; [field]; [Z_value]...
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

                    // Skip lines that are comments (start with //)
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("//"))
                        continue;

                    // Parse line format: ID;Description;Field;Value;...
                    var parts = line.Split(';');
                    if (parts.Length < 4)
                        continue;

                    // Extract PAYLOAD[n] number
                    var payloadMatch = Regex.Match(line, @"PAYLOAD\s*\[\s*(\d+)\s*\]");
                    if (!payloadMatch.Success || !int.TryParse(payloadMatch.Groups[1].Value, out int payloadNum))
                        continue;

                    // Ensure entry exists
                    if (!definitions.ContainsKey(payloadNum))
                    {
                        definitions[payloadNum] = new PayloadDefinition { Number = payloadNum };
                    }

                    var description = parts[1].ToLowerInvariant();

                    // Extract comment (Commentaire line)
                    if (description.Contains("commentaire"))
                    {
                        // Comment is in parts[3] (4th field)
                        // Check if parts[3] exists, is not empty, and doesn't start with "*SYSTEM*" (system reference)
                        if (parts.Length > 3)
                        {
                            string commentValue = parts[3].Trim();
                            // Only set comment if it's not empty AND not a system reference
                            if (!string.IsNullOrEmpty(commentValue) && !commentValue.StartsWith("*SYSTEM*", StringComparison.OrdinalIgnoreCase))
                            {
                                definitions[payloadNum].Comment = commentValue;
                            }
                            // If it's empty or starts with "*SYSTEM*", leave Comment as empty string (not commented)
                        }
                        // If parts.Length <= 3, the comment field is missing entirely, so leave as empty
                    }

                    // Extract X coordinate (CDG X line)
                    if (description.Contains("cdg x"))
                    {
                        if (parts.Length > 3 && double.TryParse(parts[3].Trim(), out double xValue))
                        {
                            definitions[payloadNum].X = xValue;
                        }
                    }

                    // Extract Y coordinate (CDG Y line)
                    if (description.Contains("cdg y"))
                    {
                        if (parts.Length > 3 && double.TryParse(parts[3].Trim(), out double yValue))
                        {
                            definitions[payloadNum].Y = yValue;
                        }
                    }

                    // Extract Z coordinate (CDG Z line)
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

        /// <summary>
        /// Represents a payload definition from PAYLOAD.DT
        /// </summary>
        private class PayloadDefinition
        {
            public int Number { get; set; }
            public string Comment { get; set; } = string.Empty;
            public double Mass { get; set; }
            public double X { get; set; }
            public double Y { get; set; }
            public double Z { get; set; }
            public double InertiaIX { get; set; }
            public double InertiaIY { get; set; }
            public double InertiaIZ { get; set; }

            /// <summary>
            /// Checks if all coordinates are zero (or very close to zero)
            /// </summary>
            public bool IsAllZeroCoordinates()
            {
                const double tolerance = 0.0001;
                return Math.Abs(X) < tolerance && 
                       Math.Abs(Y) < tolerance && 
                       Math.Abs(Z) < tolerance;
            }
        }
    }

    /// <summary>
    /// Validation result containing compliance status and details
    /// </summary>
    public class ValidationResult
    {
        public bool IsCompliant { get; set; }
        public string StatusMessage { get; set; } = string.Empty;
        public string ValidationSummary { get; set; } = string.Empty;
        public List<string> ValidationDetails { get; set; } = new List<string>();
        public List<string> ValidationIssues { get; set; } = new List<string>();
    }
}
