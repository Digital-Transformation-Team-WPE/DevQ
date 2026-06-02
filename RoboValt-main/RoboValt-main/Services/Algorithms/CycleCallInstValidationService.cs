using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates FANUC TP robot program cycles based on Cycle_Call_Inst logic:
    /// - Only whitelisted CALL instructions are allowed in cycles
    /// - Whitelisted: CALL_PRG, ZON_IN, ZON_OUT, ZONS_OUT, EQ_IN, EQ_OUT, SW_EQIN, SW_EQOUT, TOOLSWITCH
    /// - Any other CALL instruction results in NOK
    /// </summary>
    public static class CycleCallInstValidationService
    {
        // Whitelist of allowed CALL instructions
        private static readonly HashSet<string> AllowedCallInstructions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "CALL_PRG",
            "ZON_IN",
            "ZON_OUT",
            "ZONS_OUT",
            "EQ_IN",
            "EQ_OUT",
            "SW_EQIN",
            "SW_EQOUT",
            "TOOLSWITCH"
        };

        public class InvalidCallDetail
        {
            public int LineNumber { get; set; }
            public string Instruction { get; set; } = "";
        }

        public class CycleCallInstInfo
        {
            public string CycleNumber { get; set; } = "";
            public string CycleName { get; set; } = "";
            public List<string> InvalidCallInstructions { get; set; } = new();
            public List<InvalidCallDetail> InvalidCallDetails { get; set; } = new();
            public bool IsValid { get; set; }
            public int StartLine { get; set; }
            public int EndLine { get; set; }
        }

        public class ValidationResult
        {
            public bool IsCompliant { get; set; }
            public string StatusMessage { get; set; } = ""; // OK or NOK
            public string ValidationSummary { get; set; } = "";
            public List<string> ValidationDetails { get; set; } = new();
            public List<CycleCallInstInfo> AllCycles { get; set; } = new();
            public List<CycleCallInstInfo> InvalidCycles { get; set; } = new();
        }

        /// <summary>
        /// Validates all cycles for proper CALL instruction usage
        /// </summary>
        public static ValidationResult ValidateCycleCallInst(string filePath)
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

                var lines = File.ReadAllLines(filePath);
                result.AllCycles = ExtractCyclesWithCallInstValidation(lines);

                if (result.AllCycles.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = "No cycles found in file";
                    return result;
                }

                // Check which cycles are invalid
                result.InvalidCycles = result.AllCycles
                    .Where(c => !c.IsValid)
                    .ToList();

                if (result.InvalidCycles.Count == 0)
                {
                    result.IsCompliant = true;
                    result.StatusMessage = "OK";
                    result.ValidationSummary = $"All {result.AllCycles.Count} cycles use valid CALL instructions only";
                    result.ValidationDetails = result.AllCycles
                        .Select(c => $"Cycle {c.CycleNumber}: '{c.CycleName}' ✓")
                        .ToList();
                    return result;
                }

                // Cycles with invalid CALL instructions
                result.IsCompliant = false;
                result.StatusMessage = "NOK";
                
                var invalidCycleNumbers = string.Join(", ", 
                    result.InvalidCycles.Select(c => c.CycleNumber).OrderBy(x => int.Parse(x)));
                
                result.ValidationSummary = $"Cycles {invalidCycleNumbers} have invalid CALL instructions";
                
                result.ValidationDetails = result.AllCycles
                    .Select(c => c.IsValid 
                        ? $"Cycle {c.CycleNumber}: '{c.CycleName}' ✓"
                        : $"Cycle {c.CycleNumber}: '{c.CycleName}' ✗ INVALID - {string.Join("; ", c.InvalidCallDetails.Select(d => $"Line {d.LineNumber}: {d.Instruction}"))}")
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                result.IsCompliant = false;
                result.StatusMessage = "ERROR";
                result.ValidationSummary = $"Error validating cycle call instructions: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Extracts all cycles and validates CALL instructions
        /// Uses state machine: first LBL = cycle 1, then only LBL after JMP LBL[9999] are new cycles
        /// </summary>
        private static List<CycleCallInstInfo> ExtractCyclesWithCallInstValidation(string[] lines)
        {
            var cycles = new List<CycleCallInstInfo>();
            var cyclePattern = @"LBL\[(\d+)(?::([^\]]*))?\]";
            var jumpPattern = @"JMP\s+LBL\[9999\]";
            bool lastWasJumpTo9999 = true; // Start of file: first LBL is a cycle
            int cycleStartLine = -1;

            for (int i = 0; i < lines.Length; i++)
            {
                // Check if this line is JMP LBL[9999]
                if (Regex.IsMatch(lines[i], jumpPattern, RegexOptions.IgnoreCase))
                {
                    lastWasJumpTo9999 = true; // Next LBL will be a cycle start
                    continue;
                }

                // Check if this line is LBL[...]
                var cycleMatch = Regex.Match(lines[i], cyclePattern, RegexOptions.IgnoreCase);
                if (!cycleMatch.Success) continue;

                string cycleNumber = cycleMatch.Groups[1].Value;
                string cycleName = cycleMatch.Groups[2].Success ? cycleMatch.Groups[2].Value : "";

                // Only count as cycle if:
                // 1. We're at a cycle boundary (after JMP LBL[9999] or start of file)
                // 2. Cycle number is not 9999 (program exit)
                if (lastWasJumpTo9999 && cycleNumber != "9999")
                {
                    cycleStartLine = i;
                    int cycleEndLine = FindCycleEnd(lines, i + 1);

                    // Validate CALL instructions within this cycle
                    var invalidCalls = new List<string>();
                    var invalidCallDetails = new List<InvalidCallDetail>();

                    for (int j = cycleStartLine; j <= cycleEndLine && j < lines.Length; j++)
                    {
                        string line = lines[j];
                        var callMatches = Regex.Matches(line, @"\bCALL\s+(\w+)", RegexOptions.IgnoreCase);
                        
                        foreach (Match callMatch in callMatches)
                        {
                            string callKeyword = callMatch.Groups[1].Value;
                            if (!AllowedCallInstructions.Contains(callKeyword))
                            {
                                if (!invalidCalls.Contains(callKeyword))
                                    invalidCalls.Add(callKeyword);
                                
                                invalidCallDetails.Add(new InvalidCallDetail
                                {
                                    LineNumber = j + 1,
                                    Instruction = line.Trim()
                                });
                            }
                        }
                    }

                    bool isValid = invalidCalls.Count == 0;
                    cycles.Add(new CycleCallInstInfo
                    {
                        CycleNumber = cycleNumber,
                        CycleName = cycleName,
                        InvalidCallInstructions = invalidCalls,
                        InvalidCallDetails = invalidCallDetails,
                        IsValid = isValid,
                        StartLine = cycleStartLine + 1,
                        EndLine = cycleEndLine + 1
                    });

                    lastWasJumpTo9999 = false; // We're now inside a cycle
                }
                // If lastWasJumpTo9999 is false, this LBL is internal (ignored)
            }

            return cycles;
        }

        /// <summary>
        /// Finds the end of a cycle by looking for JMP LBL[9999]
        /// </summary>
        private static int FindCycleEnd(string[] lines, int startIndex)
        {
            var endPattern = @"JMP\s+LBL\[9999\]";

            for (int i = startIndex; i < lines.Length; i++)
            {
                if (Regex.IsMatch(lines[i], endPattern, RegexOptions.IgnoreCase))
                {
                    return i;
                }
            }

            return lines.Length - 1;
        }
    }
}
