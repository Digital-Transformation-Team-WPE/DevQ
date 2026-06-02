using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    
    public class FrameCoordinateValidationService
    {
        public class FrameInfo
        {
            public string FrameName { get; set; } = "";
            public double X { get; set; }
            public double Y { get; set; }
            public double Z { get; set; }
            public double W { get; set; }
            public double P { get; set; }
            public double R { get; set; }
            public string FrameType { get; set; } = ""; 
            public string RawLine { get; set; } = "";

            public bool IsAllZeros => X == 0 && Y == 0 && Z == 0 && W == 0 && P == 0 && R == 0;

            public string CoordinateKey => $"{X:G15}|{Y:G15}|{Z:G15}|{W:G15}|{P:G15}|{R:G15}";
        }

        public class ValidationResult
        {
            public bool Success { get; set; }
            public string ValidationSummary { get; set; } = "";
            public string DetailedMessage { get; set; } = "";
            public List<FrameInfo> DuplicateFrames { get; set; } = new();
            public List<(string coordinates, List<FrameInfo> frames)> DuplicateGroups { get; set; } = new();
        }

      
        public static Dictionary<string, List<FrameInfo>> ParseFrameFile(string filePath)
        {
            var frames = new Dictionary<string, List<FrameInfo>>();

            if (!File.Exists(filePath))
                return frames;

            try
            {
                var lines = File.ReadAllLines(filePath);
                string currentFrameType = "";

                foreach (var line in lines)
                {
                    // Detect frame type headers
                    if (line.Contains("Tool Frame"))
                    {
                        currentFrameType = "Tool";
                        continue;
                    }
                    else if (line.Contains("Jog Frame"))
                    {
                        currentFrameType = "Jog";
                        continue;
                    }
                    else if (line.Contains("User Frame"))
                    {
                        currentFrameType = "User";
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(line))
                        continue;
                    
                    var trimmedLine = line.TrimStart();
                    if (trimmedLine.Length == 0 || (!char.IsDigit(trimmedLine[0]) && trimmedLine[0] != '-'))
                        continue;

                    var frameInfo = ParseFrameLine(line, currentFrameType);
                    if (frameInfo != null)
                    {
                        if (!frames.ContainsKey(currentFrameType))
                            frames[currentFrameType] = new List<FrameInfo>();

                        frames[currentFrameType].Add(frameInfo);
                    }
                }

                return frames;
            }
            catch (Exception ex)
            {
                throw new Exception($"Error parsing FRAME file: {ex.Message}");
            }
        }

        
        private static FrameInfo ParseFrameLine(string line, string frameType)
        {
            try
            {
                var match = Regex.Match(line, @"^\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*(.*)$");
                
                if (!match.Success)
                    return null;

                var frameInfo = new FrameInfo
                {
                    X = double.Parse(match.Groups[1].Value),
                    Y = double.Parse(match.Groups[2].Value),
                    Z = double.Parse(match.Groups[3].Value),
                    W = double.Parse(match.Groups[4].Value),
                    P = double.Parse(match.Groups[5].Value),
                    R = double.Parse(match.Groups[6].Value),
                    FrameName = match.Groups[7].Value.Trim(),
                    FrameType = frameType,
                    RawLine = line
                };

                return frameInfo;
            }
            catch
            {
                return null;
            }
        }

       
        public static ValidationResult ValidateDuplicateToolFrames(string frameFilePath)
        {
            var result = new ValidationResult();

            try
            {
                var frames = ParseFrameFile(frameFilePath);

                if (!frames.ContainsKey("Tool") || frames["Tool"].Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No Tool Frames found to validate";
                    return result;
                }

                var toolFrames = frames["Tool"];

                // Filter out all-zero frames
                var nonZeroFrames = toolFrames.Where(f => !f.IsAllZeros).ToList();

                if (nonZeroFrames.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No non-zero Tool Frames found";
                    return result;
                }

                // Group by coordinate values to find duplicates
                var groupedByCoords = nonZeroFrames.GroupBy(f => f.CoordinateKey).ToList();

                // Find coordinates that appear more than once
                var duplicateCoords = groupedByCoords.Where(g => g.Count() > 1).ToList();

                if (duplicateCoords.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  All Tool Frames have unique coordinates";
                    return result;
                }

                result.Success = false;
                var summaryParts = new List<string>();

                foreach (var dupGroup in duplicateCoords)
                {
                    var frames_in_group = dupGroup.ToList();
                    var coords = $"({frames_in_group[0].X}, {frames_in_group[0].Y}, {frames_in_group[0].Z}, {frames_in_group[0].W}, {frames_in_group[0].P}, {frames_in_group[0].R})";
                    var frameNames = string.Join(", ", frames_in_group.Select(f => f.FrameName).Distinct());
                    var count = frames_in_group.Count;
                    
                    summaryParts.Add($"{coords} - {frameNames} (appears {count} times)");
                    
                    result.DuplicateFrames.AddRange(frames_in_group);
                    result.DuplicateGroups.Add((coords, frames_in_group));
                }

                result.ValidationSummary = $"Duplicate coordinates found: {string.Join(" | ", summaryParts)}";
                result.DetailedMessage = $"Duplicate coordinate sets: {duplicateCoords.Count}";

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        public static ValidationResult ValidateDuplicateJogFrames(string frameFilePath)
        {
            var result = new ValidationResult();

            try
            {
                var frames = ParseFrameFile(frameFilePath);

                if (!frames.ContainsKey("Jog") || frames["Jog"].Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No Jog Frames found to validate";
                    return result;
                }

                var jogFrames = frames["Jog"];
                var nonZeroFrames = jogFrames.Where(f => !f.IsAllZeros).ToList();

                if (nonZeroFrames.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No non-zero Jog Frames found";
                    return result;
                }

                // Group by coordinate values to find duplicates
                var groupedByCoords = nonZeroFrames.GroupBy(f => f.CoordinateKey).ToList();

                // Find coordinates that appear more than once
                var duplicateCoords = groupedByCoords.Where(g => g.Count() > 1).ToList();

                if (duplicateCoords.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  All Jog Frames have unique coordinates";
                    return result;
                }

                // Build duplicate summary - show coordinates that appear multiple times
                result.Success = false;
                var summaryParts = new List<string>();

                foreach (var dupGroup in duplicateCoords)
                {
                    var frames_in_group = dupGroup.ToList();
                    var coords = $"({frames_in_group[0].X}, {frames_in_group[0].Y}, {frames_in_group[0].Z}, {frames_in_group[0].W}, {frames_in_group[0].P}, {frames_in_group[0].R})";
                    var frameNames = string.Join(", ", frames_in_group.Select(f => f.FrameName).Distinct());
                    var count = frames_in_group.Count;
                    
                    summaryParts.Add($"{coords} - {frameNames} (appears {count} times)");
                    
                    result.DuplicateFrames.AddRange(frames_in_group);
                    result.DuplicateGroups.Add((coords, frames_in_group));
                }

                result.ValidationSummary = $"Duplicate coordinates found: {string.Join(" | ", summaryParts)}";
                result.DetailedMessage = $"Duplicate coordinate sets: {duplicateCoords.Count}";

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validate for duplicate User Frame coordinates
        /// </summary>
        public static ValidationResult ValidateDuplicateUserFrames(string frameFilePath)
        {
            var result = new ValidationResult();

            try
            {
                var frames = ParseFrameFile(frameFilePath);

                if (!frames.ContainsKey("User") || frames["User"].Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No User Frames found to validate";
                    return result;
                }

                var userFrames = frames["User"];
                var nonZeroFrames = userFrames.Where(f => !f.IsAllZeros).ToList();

                if (nonZeroFrames.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  No non-zero User Frames found";
                    return result;
                }

                // Group by coordinate values to find duplicates
                var groupedByCoords = nonZeroFrames.GroupBy(f => f.CoordinateKey).ToList();

                // Find coordinates that appear more than once
                var duplicateCoords = groupedByCoords.Where(g => g.Count() > 1).ToList();

                if (duplicateCoords.Count == 0)
                {
                    result.Success = true;
                    result.ValidationSummary = "  All User Frames have unique coordinates";
                    return result;
                }

                // Build duplicate summary - show coordinates that appear multiple times
                result.Success = false;
                var summaryParts = new List<string>();

                foreach (var dupGroup in duplicateCoords)
                {
                    var frames_in_group = dupGroup.ToList();
                    var coords = $"({frames_in_group[0].X}, {frames_in_group[0].Y}, {frames_in_group[0].Z}, {frames_in_group[0].W}, {frames_in_group[0].P}, {frames_in_group[0].R})";
                    var frameNames = string.Join(", ", frames_in_group.Select(f => f.FrameName).Distinct());
                    var count = frames_in_group.Count;
                    
                    summaryParts.Add($"{coords} - {frameNames} (appears {count} times)");
                    
                    result.DuplicateFrames.AddRange(frames_in_group);
                    result.DuplicateGroups.Add((coords, frames_in_group));
                }

                result.ValidationSummary = $"Duplicate coordinates found: {string.Join(" | ", summaryParts)}";
                result.DetailedMessage = $"Duplicate coordinate sets: {duplicateCoords.Count}";

                return result;
            }
            catch (Exception ex)
            {
                result.ValidationSummary = $"  Error during validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Validate if a specific frame by name has all zero coordinates
        /// </summary>
        public static ValidationResult ValidateFrameIsZero(string frameFilePath, string frameType, string frameName)
        {
            var result = new ValidationResult();

            try
            {
                var frames = ParseFrameFile(frameFilePath);

                // Check if frame type exists
                if (!frames.ContainsKey(frameType) || frames[frameType].Count == 0)
                {
                    result.Success = false;
                    result.ValidationSummary = $"  No {frameType} Frames found in file";
                    return result;
                }

                var frameList = frames[frameType];

                // Find the specific frame by name
                var targetFrame = frameList.FirstOrDefault(f => f.FrameName.Equals(frameName, StringComparison.OrdinalIgnoreCase));

                if (targetFrame == null)
                {
                    result.Success = false;
                    result.ValidationSummary = $"  {frameName} {frameType} frame not found";
                    return result;
                }

                // Check if all coordinates are zero
                if (targetFrame.IsAllZeros)
                {
                    result.Success = true;
                    result.ValidationSummary = $"  {frameName} {frameType} frame is 0";
                    return result;
                }
                else
                {
                    // Frame found but has non-zero coordinates
                    result.Success = false;
                    var coords = $"({targetFrame.X}, {targetFrame.Y}, {targetFrame.Z}, {targetFrame.W}, {targetFrame.P}, {targetFrame.R})";
                    result.ValidationSummary = $"  {frameName} {frameType} frame is {coords} (not zero)";
                    result.DetailedMessage = $"Expected all zero coordinates but found non-zero values";
                    return result;
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ValidationSummary = $"  Error validating frame: {ex.Message}";
                return result;
            }
        }
    }
}
