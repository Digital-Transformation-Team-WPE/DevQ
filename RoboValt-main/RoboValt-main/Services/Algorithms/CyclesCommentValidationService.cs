using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    public static class CyclesCommentValidationService
    {
        // Compiled regex for better performance on repeated calls
        // Matches: LBL[number:comment] or LBL[number]
        private static readonly Regex CyclePattern = new(
            @"LBL\[(\d+)(?::([^\]]*))?\]",
            RegexOptions.Compiled);
        
        // Matches: JMP LBL[9999] - marks end of cycle section
        private static readonly Regex JumpToEndPattern = new(
            @"JMP\s+LBL\[9999\]",
            RegexOptions.Compiled);

        public class CycleInfo
        {
            public string CycleNumber { get; set; } = "";
            public string CycleName { get; set; } = "";
            public int CommentLength { get; set; }
            public bool IsValid { get; set; }
            public string RawLabel { get; set; } = "";
        }

        public class ValidationResult
        {
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = "";
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
            public List<CycleInfo> AllCycles { get; set; } = new();
            public List<CycleInfo> InvalidCycles { get; set; } = new();
        }

        public static ValidationResult ValidateCyclesComment(string filePath)
        {
            if (!File.Exists(filePath))
            {
                return new ValidationResult
                {
                    IsCompliant = false,
                    StatusMessage = "ERROR",
                    ValidationSummary = $"File not found: {filePath}"
                };
            }

            try
            {
                var lines = File.ReadAllLines(filePath);
                var allCycles = ExtractCycles(lines);

                if (allCycles.Count == 0)
                {
                    return new ValidationResult
                    {
                        IsCompliant = true,
                        StatusMessage = "OK",
                        ValidationSummary = "No cycles found in file",
                        AllCycles = allCycles
                    };
                }

                var invalidCycles = allCycles.Where(c => !c.IsValid).ToList();
                bool isCompliant = invalidCycles.Count == 0;

                return new ValidationResult
                {
                    IsCompliant = isCompliant,
                    StatusMessage = isCompliant ? "OK" : "NOK",
                    ValidationSummary = isCompliant
                        ? $"All {allCycles.Count} cycles have valid comments (≤ 16 letters)"
                        : $"Cycles {string.Join(", ", invalidCycles.Select(c => c.CycleNumber).OrderBy(x => int.Parse(x)))} have invalid comments (empty or > 16 letters)",
                    ValidationDetails = allCycles.Select(FormatCycleDetail).ToList(),
                    AllCycles = allCycles,
                    InvalidCycles = invalidCycles
                };
            }
            catch (Exception ex)
            {
                return new ValidationResult
                {
                    IsCompliant = false,
                    StatusMessage = "ERROR",
                    ValidationSummary = $"Error validating cycles: {ex.Message}"
                };
            }
        }

        private static List<CycleInfo> ExtractCycles(string[] lines)
        {
            var cycles = new List<CycleInfo>();
            bool lastWasJumpTo9999 = true; // Start of file is treated as after JMP LBL[9999]

            foreach (var line in lines)
            {
                // Check if this line ends a cycle section
                if (JumpToEndPattern.IsMatch(line))
                {
                    lastWasJumpTo9999 = true;
                    continue;
                }

                // Check if this line contains a LBL pattern
                var match = CyclePattern.Match(line);
                if (!match.Success) continue;

                var cycleNumber = match.Groups[1].Value;
                var cycleName = match.Groups[2].Success ? match.Groups[2].Value : "";

                // Only count as cycle start if:
                // 1. We just saw JMP LBL[9999] (at cycle boundary)
                // 2. The cycle number is not 9999 (program exit label)
                if (lastWasJumpTo9999 && cycleNumber != "9999")
                {
                    cycles.Add(new CycleInfo
                    {
                        CycleNumber = cycleNumber,
                        CycleName = cycleName,
                        CommentLength = cycleName.Length,
                        IsValid = cycleName.Length is > 0 and <= 16,
                        RawLabel = line.Trim()
                    });
                    lastWasJumpTo9999 = false; // We're now inside a cycle section
                }
                // If lastWasJumpTo9999 is false, any other LBL is internal (ignored)
            }

            return cycles;
        }

        private static string FormatCycleDetail(CycleInfo c)
            => $"Cycle {c.CycleNumber}: '{c.CycleName}' ({c.CommentLength} letters) {(c.IsValid ? "✓" : "✗ INVALID")}";
    }
}