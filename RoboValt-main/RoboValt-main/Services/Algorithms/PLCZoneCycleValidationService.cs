using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Robot_Program_Validation.Services.Algorithms
{
    /// <summary>
    /// Validates PLC Zone uniqueness within each cycle
    /// Logic:
    /// 1. Extract all cycles (LBL[XX])
    /// 2. For each cycle, collect all zone numbers from:
    ///    - ZON_IN(...) - comma-separated values
    ///    - CALL_PRG(..., zone) - last parameter
    /// 3. Check for duplicate zone numbers within each cycle
    /// 4. If any duplicates found → NOK with details
    /// 5. If all zones are unique → OK
    /// </summary>
    public static class PLCZoneCycleValidationService
    {
        private static readonly Regex CyclePattern = new(@"LBL\[(\d+)(?::([^\]]*))?\]", RegexOptions.Compiled);
        private static readonly Regex ZonInPattern = new(@"ZON_IN\(([^)]+)\)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        // Pattern: CALL_PRG(..., ..., zone_number)
        private static readonly Regex CallPrgPattern = new(@"CALL_PRG\s*\(\s*[^,]+\s*,\s*[^,]+\s*,\s*(\d+)\s*\)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public class CycleZoneInfo
        {
            public string CycleNumber { get; set; } = "";
            public string CycleName { get; set; } = "";
            public List<int> AllZones { get; set; } = new();
            public Dictionary<int, int> DuplicateZones { get; set; } = new(); // zone -> count
            public bool IsValid { get; set; }
        }

        /// <summary>
        /// Validates PLC Zone uniqueness in cycles
        /// </summary>
        /// <param name="filePath">Path to trajectory/program file</param>
        /// <returns>Tuple: (status, message) where status is "OK"/"NOK"/"NA"</returns>
        public static (string Status, string Message) ValidatePLCZoneCycle(string filePath)
        {
            try
            {
                if (!File.Exists(filePath))
                {
                    return ("NA", "File not found");
                }

                var content = File.ReadAllText(filePath);
                var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

                // Extract all cycles
                var cycles = ExtractCyclesWithZones(lines);

                if (cycles.Count == 0)
                {
                    return ("OK", "No cycles found");
                }

                // Check for invalid cycles (with duplicate zones)
                var invalidCycles = cycles.Where(c => !c.IsValid).ToList();

                if (invalidCycles.Count == 0)
                {
                    return ("OK", "All cycle zones are unique");
                }

                // Build error message with details
                var errorDetails = new List<string>();
                foreach (var cycle in invalidCycles)
                {
                    var duplicateInfo = string.Join(", ", 
                        cycle.DuplicateZones.Select(d => $"{d.Key} ({d.Value}x)"));
                    errorDetails.Add($"Cycle {cycle.CycleNumber}: duplicate zones {duplicateInfo}");
                }

                var message = string.Join(" | ", errorDetails);
                return ("NOK", message);
            }
            catch
            {
                return ("NA", "Error during validation");
            }
        }

        /// <summary>
        /// Extracts cycles and their zone numbers from file content
        /// Uses state machine: first LBL = cycle 1, then only LBL after JMP LBL[9999] are new cycles
        /// </summary>
        private static List<CycleZoneInfo> ExtractCyclesWithZones(string[] lines)
        {
            var cycles = new List<CycleZoneInfo>();
            var jumpPattern = new Regex(@"JMP\s+LBL\[9999\]", RegexOptions.Compiled | RegexOptions.IgnoreCase);
            bool lastWasJumpTo9999 = true; // Start: first LBL is a cycle
            int cycleStartIdx = -1;
            string cycleNumber = "";
            string cycleName = "";

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];

                // Check for JMP LBL[9999] boundary
                if (jumpPattern.IsMatch(line))
                {
                    lastWasJumpTo9999 = true;
                    continue;
                }

                // Check for LBL[...]
                var cycleMatch = CyclePattern.Match(line);
                if (!cycleMatch.Success) continue;

                var newCycleNumber = cycleMatch.Groups[1].Value;

                // Only count as new cycle if: at boundary AND not program exit
                if (lastWasJumpTo9999 && newCycleNumber != "9999")
                {
                    // Finalize previous cycle if exists
                    if (cycleStartIdx >= 0 && cycleNumber != "")
                    {
                        var cycleContent = string.Join("\n", lines.Skip(cycleStartIdx).Take(i - cycleStartIdx));
                        var cycleInfo = ExtractZonesFromCycle(cycleNumber, cycleName, cycleContent);
                        cycles.Add(cycleInfo);
                    }

                    // Start new cycle
                    cycleNumber = newCycleNumber;
                    cycleName = cycleMatch.Groups[2].Success ? cycleMatch.Groups[2].Value : "";
                    cycleStartIdx = i;
                    lastWasJumpTo9999 = false; // Now inside a cycle
                }
                // If lastWasJumpTo9999 is false, this LBL is internal (ignored)
            }

            // Finalize last cycle
            if (cycleStartIdx >= 0 && cycleNumber != "")
            {
                var cycleContent = string.Join("\n", lines.Skip(cycleStartIdx));
                var cycleInfo = ExtractZonesFromCycle(cycleNumber, cycleName, cycleContent);
                cycles.Add(cycleInfo);
            }

            return cycles;
        }

        /// <summary>
        /// Extracts zone numbers from a single cycle
        /// </summary>
        private static CycleZoneInfo ExtractZonesFromCycle(string cycleNumber, string cycleName, string cycleContent)
        {
            var zones = new List<int>();

            // Extract zones from ZON_IN(...)
            var zonInMatches = ZonInPattern.Matches(cycleContent);
            foreach (Match match in zonInMatches)
            {
                var zoneStr = match.Groups[1].Value;
                // Parse comma-separated zones
                var zoneNumbers = zoneStr.Split(',')
                    .Select(z => z.Trim())
                    .Where(z => int.TryParse(z, out _))
                    .Select(z => int.Parse(z))
                    .ToList();
                zones.AddRange(zoneNumbers);
            }

            // Extract zones from CALL_PRG(..., zone)
            var callPrgMatches = CallPrgPattern.Matches(cycleContent);
            foreach (Match match in callPrgMatches)
            {
                var zoneStr = match.Groups[1].Value.Trim();
                if (int.TryParse(zoneStr, out var zoneNum))
                {
                    zones.Add(zoneNum);
                }
            }

            // Check for duplicates
            var duplicates = new Dictionary<int, int>();
            var seenZones = new HashSet<int>();

            foreach (var zone in zones)
            {
                if (seenZones.Contains(zone))
                {
                    if (!duplicates.ContainsKey(zone))
                        duplicates[zone] = 2; // Already seen once, now seeing second time
                    else
                        duplicates[zone]++;
                }
                else
                {
                    seenZones.Add(zone);
                }
            }

            var cycleInfo = new CycleZoneInfo
            {
                CycleNumber = cycleNumber,
                CycleName = cycleName,
                AllZones = zones.OrderBy(z => z).Distinct().ToList(),
                DuplicateZones = duplicates,
                IsValid = duplicates.Count == 0
            };

            return cycleInfo;
        }
    }
}
