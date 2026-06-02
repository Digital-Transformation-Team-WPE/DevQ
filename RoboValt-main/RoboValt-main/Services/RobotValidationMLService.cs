using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Robot_Program_Validation.Services.Algorithms;

namespace Robot_Program_Validation.Services
{
    
    public class RobotValidationMLService
    {
        private readonly IWebHostEnvironment _env;
        private readonly string _modelPath;
        private readonly string _connectionString;

        public RobotValidationMLService(IWebHostEnvironment env, IConfiguration configuration)
        {
            _env = env;
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True";
            _modelPath = Path.Combine(env.WebRootPath ?? Directory.GetCurrentDirectory(), "models");
        }

        // ============ COMPILED REGEX PATTERNS (Performance Optimization) ============
        // These are compiled once at class load time, not on every request
        private static readonly Regex TrajectoryHeaderExplicitPattern = new Regex(
            @"PAYLOAD\s*\[\*\].*UFRAME_NUM\s*=\s*\*.*UTOOL_NUM\s*=\s*\*.*CTRLPOSITION\s*\(\*\)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex FrameZeroPattern = new Regex(
            @"check\s+(tool|jog|user)\s+frames?\s+(\S+)\s+is\s+0",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex FrameValidationPattern = new Regex(
            @"(tool|jog|user)\s+frames?.*same\s+coordinates?|duplicate.*frames?",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PayloadDuplicatePattern = new Regex(
            @"payload.*same\s+values?|duplicate.*values?|payload.*identical",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex ToolFrameCommentsPattern = new Regex(
            @"tool\s+frame\s+comments?.*used.*payload|frame\s+comments?.*payload",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex ProgramFileCommentPattern = new Regex(
            @"comments?\s+are?\s+filled|comment.*16\s+character|file.*comment",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PresentDuplicatePattern = new Regex(
            @"present_duplicate|duplicate.*present|appear.*once|exists.*once",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex TrajectoryHeaderBroadPattern = new Regex(
            @"header.*trajectory|trajectory.*header|PAYLOAD\s*\[|UFRAME_NUM|UTOOL_NUM|CTRLPOSITION",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PayloadCommentedNotZeroPattern = new Regex(
            @"payload.*commented.*not\s+zero|payload.*not\s+zero.*commented",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PRModePattern = new Regex(
            @"\bpr\b.*\d",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PRModeLookupPattern = new Regex(
            @"(joint|cartesian|uninitialized)\s*mode",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PRCommentPattern = new Regex(
            @"all\s+the\s+pr\s+used\s+are\s+commented|pr\s+used\s+are\s+commented",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex PRSpecificCommentPattern = new Regex(
            @"pr\s*\[\s*\d+\s*\].*?(?:has\s+)?(?:the\s+)?comment",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public async Task<(bool Success, string Message)> InitializeAsync()
        {
            try
            {
                if (!File.Exists(_modelPath))
                {
                    return (false, $"Model not found at {_modelPath}. Please place robo_validation_model.onnx in wwwroot/models/");
                }

                return (true, "ML Model loaded successfully");
            }
            catch (Exception ex)
            {
                return (false, $"Error loading model: {ex.Message}");
            }
        }

        public async Task<ValidationResult> SearchCommandInFilesAsync(string folderPath, string filePattern, string whatToCheck, string logicColumn = "")
        {
            var result = new ValidationResult
            {
                FilePattern = filePattern,
                CommandSearched = whatToCheck,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                if (!Directory.Exists(folderPath))
                {
                    result.Status = "ERROR";
                    result.Summary = $"Folder not found: {folderPath}";
                    return result;
                }

                // ============================================================
                // VALIDATION ROUTING STRATEGY
                // ============================================================
                // INPUT PARAMETERS:
                // - folderPath: Temp folder with uploaded robot program files
                // - filePattern: File patterns to search (comma-separated)
                //                Example: "*.LS", "T_*.SRC"
                // - whatToCheck: Keywords/patterns to validate
                //                Example: "UFRAME_NUM,UTOOL_NUM"
                // - logicColumn: Tab-separated validation metadata
                //                Format: "keywords\tValidationType\tStatus\tSummary"
                //                Example: "UFRAME_NUM,UTOOL_NUM\tPresent_Duplicate\t\t"
                //
                // VALIDATION TYPES (case insensitive, EXACT match required):
                // - "Traj_Instruction" → TrajectoryHeaderValidationService
                // - "Present_Duplicate" → PresentDuplicateValidationService
                // - "Frame" → FrameCoordinateValidationService
                // - "Payload" → PayloadValidationService
                // - "Program" → ProgramFileValidationService
                // - "PR" or "Register" → PositionRegisterValidationService
                //
                // ROUTING PRIORITY (highest to lowest):
                // 1. EXPLICIT Logic column with tab separator (STRICT type matching)
                // 2. EXPLICIT Trajectory Header pattern in "What to Check"
                // 3. PATTERN-BASED routing (legacy fallback only)
                // ============================================================

                // HIGHEST PRIORITY: Check if Logic column contains explicit validation type
                // Format can be EITHER:
                // - Simple: "Present_Duplicate" or "Traj_Instruction"
                // - Extended: "keywords\tValidationType\tStatus\tSummary"
                
                if (!string.IsNullOrWhiteSpace(logicColumn))
                {
                    // Extract validation type - either direct word or from tab-separated format
                    string validationType;
                    
                    if (logicColumn.Contains("\t"))
                    {
                        // Extended format: "keywords\tValidationType\tStatus\tSummary"
                        var logicParts = logicColumn.Split('\t');
                        validationType = logicParts.Length >= 2 ? logicParts[1].Trim().ToLower() : logicColumn.Trim().ToLower();
                    }
                    else
                    {
                        // Simple format: "Present_Duplicate"
                        validationType = logicColumn.Trim().ToLower();
                    }

                    // ============================================================
                    // STRICT VALIDATION TYPE ROUTING
                    // Only exact type matches route to their handlers
                    // ============================================================
                    
                    // Traj_Instruction → TrajectoryHeaderValidationService
                    if (validationType == "traj_instruction")
                    {
                        return HandleTrajectoryHeaderValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // Present_Duplicate → PresentDuplicateValidationService
                    if (validationType == "present_duplicate")
                    {
                        return HandlePresentDuplicateValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // Present_Common → PresentCommonValidationService
                    if (validationType == "present_common")
                    {
                        return HandlePresentCommonValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // Frame → FrameCoordinateValidationService
                    if (validationType == "frame")
                    {
                        return HandleFrameValidation(folderPath, whatToCheck);
                    }
                    
                    // Payload → PayloadValidationService
                    if (validationType == "payload")
                    {
                        return HandlePayloadDuplicateValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // Payload_Comment → PayloadCommentValidationService
                    if (validationType == "payload_comment")
                    {
                        return HandlePayloadCommentValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // Program → ProgramFileValidationService
                    if (validationType == "program")
                    {
                        return HandleProgramFileCommentValidation(folderPath, filePattern, whatToCheck);
                    }
                    
                    // PR or Register → PositionRegisterValidationService
                    if (validationType == "pr" || validationType == "register")
                    {
                        return HandlePRModeValidation(folderPath, whatToCheck);
                    }
                    
                    // PR_TRAJ_JOINT → Extract PRs from trajectory and validate as JOINT mode
                    if (validationType == "pr_traj_joint")
                    {
                        return HandlePRTrajectoryValidation(folderPath, filePattern, "joint");
                    }
                    
                    // PR_TRAJ_CARTESIAN → Extract PRs from trajectory and validate as CARTESIAN mode
                    if (validationType == "pr_traj_cartesian")
                    {
                        return HandlePRTrajectoryValidation(folderPath, filePattern, "cartesian");
                    }
                    
                    // PR_TRAJ_Comment → Extract first/last PR from trajectory and check their comments
                    if (validationType == "pr_traj_comment")
                    {
                        return HandlePRTrajectoryCommentValidation(folderPath, filePattern, whatToCheck);
                    }

                    // TRAJ_COMMENT_STD → Extract comment from trajectory and validate against standard patterns
                    if (validationType == "traj_comment_std")
                    {
                        return HandleTrajectoryCommentStdValidation(folderPath, filePattern);
                    }
                    
                    // ALL_PR_TRAJ_JOINT → Extract ALL PRs from trajectory and validate as JOINT mode
                    if (validationType == "all_pr_traj_joint")
                    {
                        var allPRResult = Algorithms.AllPRTrajectoryModeValidationService.ValidateAllPRTrajectoryMode(folderPath, filePattern, "joint");
                        return new ValidationResult
                        {
                            Status = allPRResult.Status,
                            StatusColor = allPRResult.StatusColor,
                            FilesSearched = allPRResult.FilesSearched,
                            FilesFound = allPRResult.FilesFound,
                            FilesNotFound = allPRResult.FilesNotFound,
                            Summary = allPRResult.Summary,
                            FileResults = allPRResult.FileResults.Select(fr => new FileSearchResult
                            {
                                FileName = fr.FileName,
                                FilePath = fr.FilePath,
                                CommandSearched = fr.CommandSearched,
                                Found = fr.Found,
                                LineNumber = fr.LineNumber,
                                LineContent = fr.LineContent,
                                Confidence = fr.Confidence
                            }).ToList(),
                            CommandSearched = allPRResult.CommandSearched,
                            FolderPath = allPRResult.FolderPath,
                            ProcessedAt = allPRResult.ProcessedAt
                        };
                    }
                    
                    // ALL_PR_TRAJ_CARTESIAN → Extract ALL PRs from trajectory and validate as CARTESIAN mode
                    if (validationType == "all_pr_traj_cartesian")
                    {
                        var allPRResult = Algorithms.AllPRTrajectoryModeValidationService.ValidateAllPRTrajectoryMode(folderPath, filePattern, "cartesian");
                        return new ValidationResult
                        {
                            Status = allPRResult.Status,
                            StatusColor = allPRResult.StatusColor,
                            FilesSearched = allPRResult.FilesSearched,
                            FilesFound = allPRResult.FilesFound,
                            FilesNotFound = allPRResult.FilesNotFound,
                            Summary = allPRResult.Summary,
                            FileResults = allPRResult.FileResults.Select(fr => new FileSearchResult
                            {
                                FileName = fr.FileName,
                                FilePath = fr.FilePath,
                                CommandSearched = fr.CommandSearched,
                                Found = fr.Found,
                                LineNumber = fr.LineNumber,
                                LineContent = fr.LineContent,
                                Confidence = fr.Confidence
                            }).ToList(),
                            CommandSearched = allPRResult.CommandSearched,
                            FolderPath = allPRResult.FolderPath,
                            ProcessedAt = allPRResult.ProcessedAt
                        };
                    }
                    
                    // PR_COMMENT_ORDER_FINE → Validate first/last PR have expected comments and FINE keyword
                    if (validationType == "pr_comment_order_fine")
                    {
                        return HandlePRCommentOrderFineValidation(folderPath, filePattern, whatToCheck);
                    }

                    // PR_COMMENT_FINE → Validate specific PR with comment exists anywhere in trajectory with FINE keyword
                    if (validationType == "pr_comment_fine")
                    {
                        return HandlePRCommentFineValidation(folderPath, filePattern, whatToCheck);
                    }

                    // Cycle_Comment → Validate robot program cycles have comments with ≤ 16 letters
                    if (validationType == "cycle_comment")
                    {
                        return HandleCycleCommentValidation(folderPath, filePattern);
                    }

                    // Cycle_Call → Validate trajectories are called via CALL_PRG, not directly
                    if (validationType == "cycle_call")
                    {
                        return HandleCycleCallValidation(folderPath, filePattern);
                    }

                    // Cycle_Call_Inst → Validate only whitelisted CALL instructions are used in cycles
                    if (validationType == "cycle_call_inst")
                    {
                        return HandleCycleCallInstValidation(folderPath, filePattern);
                    }

                    // Cycle_Starts_Ends_X → Validate first/last trajectories have comments with X (PEO, CALPOS, REPLI, etc.)
                    if (validationType.StartsWith("cycle_starts_ends_", StringComparison.OrdinalIgnoreCase))
                    {
                        var commentType = validationType.Substring("cycle_starts_ends_".Length);
                        return HandleCycleStartsEndsValidation(folderPath, filePattern, commentType);
                    }

                    // Present_Order → Validate patterns appear in consecutive lines in specified order
                    if (validationType == "present_order")
                    {
                        return HandlePresentOrderValidation(folderPath, filePattern, whatToCheck);
                    }

                    // PLC_Zone_Count → Validate PLC zone count in trajectory (HANDLING trajectories return NA)
                    if (validationType == "plc_zone_count")
                    {
                        return HandlePLCZoneCountValidation(folderPath, filePattern);
                    }

                    // PLC_Zone_Cycle → Validate PLC zone uniqueness within each cycle
                    if (validationType == "plc_zone_cycle")
                    {
                        return HandlePLCZoneCycleValidation(folderPath, filePattern);
                    }
                    
                    // If Logic column is recognized as having format but unrecognized type, return error
                    if (logicColumn.Contains("\t"))
                    {
                        var logicParts = logicColumn.Split('\t');
                        var errorResult = new ValidationResult();
                        errorResult.Status = "ERROR";
                        errorResult.StatusColor = "danger";
                        errorResult.Summary = $"Unknown validation type in Logic column: '{logicParts[1].Trim()}'. Expected: Traj_Instruction, Present_Duplicate, Present_Common, Frame, Payload, Payload_Comment, Program, PR, PR_Traj_Joint, PR_Traj_Cartesian, PR_Traj_Comment, Traj_Comment_std, All_PR_Traj_Joint, All_PR_Traj_Cartesian, PR_Comment_Order_Fine, or PR_Comment_Fine";
                        return errorResult;
                    }
                }

                // PRIORITY 2: Check if "What to Check" contains explicit Trajectory Header pattern
                if (!string.IsNullOrWhiteSpace(whatToCheck) && TrajectoryHeaderExplicitPattern.IsMatch(whatToCheck))
                {
                    return HandleTrajectoryHeaderValidation(folderPath, filePattern, whatToCheck);
                }

                // PRIORITY 3: Pattern-based routing (fallback for LEGACY DATA without explicit Logic column type)
                // This only triggers if:
                // - No Logic column was provided, OR
                // - Logic column was empty/null, OR
                // - Logic column didn't have tab separator (old format)
                whatToCheck = whatToCheck ?? string.Empty;

                // Frame zero validation - most specific pattern
                var frameZeroMatch = FrameZeroPattern.Match(whatToCheck);
                if (frameZeroMatch.Success)
                {
                    return HandleFrameZeroValidation(folderPath, frameZeroMatch.Groups[1].Value, frameZeroMatch.Groups[2].Value);
                }

                // Frame validation
                if (FrameValidationPattern.IsMatch(whatToCheck))
                {
                    return HandleFrameValidation(folderPath, whatToCheck);
                }

                // Payload duplicate validation
                if (PayloadDuplicatePattern.IsMatch(whatToCheck))
                {
                    return HandlePayloadDuplicateValidation(folderPath, filePattern, whatToCheck);
                }

                // Tool Frame Comments validation
                if (ToolFrameCommentsPattern.IsMatch(whatToCheck))
                {
                    return HandleToolFrameCommentsValidation(folderPath, filePattern, whatToCheck);
                }

                // Program File Comment validation
                if (ProgramFileCommentPattern.IsMatch(whatToCheck))
                {
                    return HandleProgramFileCommentValidation(folderPath, filePattern, whatToCheck);
                }

                // CRITICAL: Check for Present_Duplicate BEFORE Trajectory Header
                // Present_Duplicate keywords (UFRAME_NUM, UTOOL_NUM) would match broad Trajectory Header pattern
                if (PresentDuplicatePattern.IsMatch(whatToCheck))
                {
                    return HandlePresentDuplicateValidation(folderPath, filePattern, whatToCheck);
                }

                // Trajectory Header validation (broader pattern, checked AFTER Present_Duplicate)
                if (TrajectoryHeaderBroadPattern.IsMatch(whatToCheck))
                {
                    return HandleTrajectoryHeaderValidation(folderPath, filePattern, whatToCheck);
                }

                // Payload commented & not zero validation
                if (PayloadCommentedNotZeroPattern.IsMatch(whatToCheck))
                {
                    return HandlePayloadValidation(folderPath, filePattern, whatToCheck);
                }

                // PR validation (mode, comment, or all-commented check)
                bool isPRModeValidation = PRModePattern.IsMatch(whatToCheck) && PRModeLookupPattern.IsMatch(whatToCheck);
                bool isPRCommentValidation = PRCommentPattern.IsMatch(whatToCheck);
                bool isPRSpecificCommentValidation = PRSpecificCommentPattern.IsMatch(whatToCheck);

                if (isPRModeValidation || isPRCommentValidation || isPRSpecificCommentValidation)
                {
                    return HandlePRModeValidation(folderPath, whatToCheck);
                }

                // DEFAULT: Generic file search (for patterns that don't match any specialized validation)
                return PerformGenericFileSearch(folderPath, filePattern, whatToCheck);
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.Summary = $"Error processing validation: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Generic file search for patterns that don't match any specialized validation
        /// </summary>
        private ValidationResult PerformGenericFileSearch(string folderPath, string filePattern, string whatToCheck)
        {
            var result = new ValidationResult();

            // Convert wildcard pattern to regex
            // TRAJ*.LS → TRAJ.*\.LS
            var regexPattern = "^" + Regex.Escape(filePattern).Replace("\\*", ".*") + "$";
            var regex = new Regex(regexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);

            // Find all matching files
            var directory = new DirectoryInfo(folderPath);
            var matchingFiles = directory.GetFiles("*", SearchOption.AllDirectories).Where(f => regex.IsMatch(f.Name)).ToList();

            if (!matchingFiles.Any())
            {
                result.Status = "NA";
                result.Summary = $"No files matching pattern '{filePattern}' found";
                result.FilesSearched = 0;
                return result;
            }

            result.FilesSearched = matchingFiles.Count;

            // Search command in each file
            var foundFiles = new List<FileSearchResult>();
            var notFoundFiles = new List<FileSearchResult>();

            foreach (var file in matchingFiles)
            {
                var searchResult = SearchCommandInFile(file.FullName, whatToCheck);

                if (searchResult.Found)
                {
                    foundFiles.Add(searchResult);
                }
                else
                {
                    notFoundFiles.Add(searchResult);
                }
            }

            if (foundFiles.Count == 0 && notFoundFiles.Count > 0)
            {
                // NOT FOUND in any file → 🟢 Green
                result.Status = "OK";
                result.StatusColor = "success";
                string notFoundFileNames = string.Join("; ", notFoundFiles.Select(f => f.FileName));

                if (notFoundFiles.Count == 1)
                {
                    result.Summary = $"{whatToCheck} Not found in file: {notFoundFileNames}";
                }
                else
                {
                    result.Summary = $"{whatToCheck} Not found in files: {notFoundFileNames}";
                }
                result.FileResults = notFoundFiles;
            }
            else if (foundFiles.Count > 0)
            {
                // FOUND in at least one file → 🔴 Red
                result.Status = "NOK";
                result.StatusColor = "danger";
                string foundFileNames = string.Join("; ", foundFiles.Select(f => f.FileName));

                if (foundFiles.Count == 1)
                {
                    result.Summary = $"{whatToCheck} Found in file: {foundFileNames}";
                }
                else
                {
                    result.Summary = $"{whatToCheck} Found in {foundFiles.Count} files";
                }
                result.FileResults = foundFiles;
            }

            result.FilesFound = foundFiles.Count;
            result.FilesNotFound = notFoundFiles.Count;

            return result;
        }

        private FileSearchResult SearchCommandInFile(string filePath, string commandToSearch)
        {
            var result = new FileSearchResult
            {
                FileName = Path.GetFileName(filePath),
                FilePath = filePath,
                CommandSearched = commandToSearch
            };

            try
            {
                var lines = File.ReadAllLines(filePath);

                var commandMatch = Regex.Match(commandToSearch, @"\b([A-Z]+)\b", RegexOptions.IgnoreCase);
                
                if (!commandMatch.Success)
                {
                    result.Found = false;
                    return result;
                }

                string searchCommand = commandMatch.Groups[1].Value.ToUpperInvariant();

                // Build regex pattern for the SPECIFIC command being searched
                // Matches: DO[52], WAITDI[1], etc. with optional spaces
                string patternString = $@"\b{Regex.Escape(searchCommand)}\s*\[\s*\d+\s*\]";
                var regex = new Regex(patternString, RegexOptions.IgnoreCase);

                for (int i = 0; i < lines.Length; i++)
                {
                    var line = lines[i].Trim();

                    // Skip comments and empty lines
                    if (string.IsNullOrWhiteSpace(line) || 
                        line.StartsWith("#") || 
                        line.StartsWith("//") ||
                        line.StartsWith("!"))
                        continue;

                    // Search for the SPECIFIC command only
                    if (regex.IsMatch(line))
                    {
                        result.Found = true;
                        result.LineNumber = i + 1;
                        result.LineContent = line.Length > 100 ? line.Substring(0, 100) + "..." : line;
                        result.Confidence = 0.95f; // Pattern match = high confidence
                        break;
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Found = false;
                result.Error = ex.Message;
                return result;
            }
        }

        private ValidationResult HandlePRModeValidation(string folderPath, string checkStatement)
        {
            var result = new ValidationResult
            {
                CommandSearched = checkStatement,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Find POSREG.VA file in the folder
                var directory = new DirectoryInfo(folderPath);
                var posregFile = directory.EnumerateFiles("POSREG.VA", SearchOption.AllDirectories).FirstOrDefault();

                if (posregFile == null)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.Summary = $"POSREG.VA file not found in folder";
                    result.FilesSearched = 0;
                    return result;
                }

                result.FilesSearched = 1;

                // Use PositionRegisterValidationService to validate PR modes
                var validationCheckResult = PositionRegisterValidationService.ValidatePRModes(
                    checkStatement,
                    posregFile.FullName);

                // Map the result back to ValidationResult format
                if (validationCheckResult.Success)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = "POSREG.VA",
                        FilePath = posregFile.FullName,
                        CommandSearched = checkStatement,
                        Found = validationCheckResult.Success,
                        LineNumber = 0,
                        LineContent = validationCheckResult.DetailedMessage,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating PR modes: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePRTrajectoryValidation(string folderPath, string filesRequiringVerificationString, string expectedMode)
        {
            var result = new ValidationResult
            {
                CommandSearched = filesRequiringVerificationString,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                // Expected: "POSREG.VA, TRAJ100.SRC" or similar
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count < 2)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "PR_TRAJ validation requires two files: POSREG.VA and trajectory file";
                    return result;
                }

                // Find POSREG.VA (case-insensitive search)
                var directory = new DirectoryInfo(folderPath);
                var posregFile = directory.EnumerateFiles("POSREG.VA", SearchOption.AllDirectories).FirstOrDefault();
                
                // Fallback: search case-insensitive
                if (posregFile == null)
                {
                    var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                    posregFile = allFiles.FirstOrDefault(f => f.Name.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                }

                if (posregFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "POSREG.VA file not found";
                    return result;
                }

                // Find trajectory file (any file that's not POSREG.VA)
                var trajectoryPattern = filePatterns.FirstOrDefault(f => !f.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                
                if (string.IsNullOrEmpty(trajectoryPattern))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "Could not identify trajectory file pattern";
                    return result;
                }

                // Find trajectory files with case-insensitive matching
                var trajectoryFiles = new List<FileInfo>();
                
                if (trajectoryPattern.Contains('*'))
                {
                    // Wildcard pattern - use as-is
                    trajectoryFiles.AddRange(directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories));
                }
                else
                {
                    // Exact filename - try case-insensitive search
                    var file = directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories).FirstOrDefault();
                    
                    // If not found, search case-insensitively
                    if (file == null)
                    {
                        var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                        // Try exact name match case-insensitive
                        file = allFiles.FirstOrDefault(f => f.Name.Equals(trajectoryPattern, StringComparison.OrdinalIgnoreCase));
                        
                        // Try without extension and match any file with same base name
                        if (file == null)
                        {
                            var baseNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryPattern);
                            file = allFiles.FirstOrDefault(f => 
                                Path.GetFileNameWithoutExtension(f.Name).Equals(baseNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                        }
                    }
                    
                    if (file != null) trajectoryFiles.Add(file);
                }

                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryPattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;

                // Validate each trajectory file
                var fileResults = new List<FileSearchResult>();
                var allCompliant = true;

                foreach (var trajectoryFile in trajectoryFiles)
                {
                    // Use PositionRegisterValidationService to validate PR trajectory mode
                    var validationCheckResult = PositionRegisterValidationService.ValidatePRTrajectoryMode(
                        trajectoryFile.FullName,
                        posregFile.FullName,
                        expectedMode);

                    var isCompliant = validationCheckResult.Success;
                    if (!isCompliant) allCompliant = false;

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = expectedMode,
                        Found = isCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (allCompliant && fileResults.Count > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = fileResults.Count;
                    result.FilesNotFound = 0;
                    result.Summary = fileResults[0].LineContent;
                }
                else if (fileResults.Count > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = fileResults.Count;
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = "No valid results";
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating PR trajectory: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePRTrajectoryCommentValidation(string folderPath, string filesRequiringVerificationString, string expectedCommentPatterns)
        {
            var result = new ValidationResult
            {
                CommandSearched = expectedCommentPatterns,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count < 2)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "PR_TRAJ_Comment validation requires two files: POSREG.VA and trajectory file";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(expectedCommentPatterns))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No comment patterns specified in What to Check";
                    return result;
                }

                // Find POSREG.VA (case-insensitive)
                var directory = new DirectoryInfo(folderPath);
                var posregFile = directory.EnumerateFiles("POSREG.VA", SearchOption.AllDirectories).FirstOrDefault();
                
                if (posregFile == null)
                {
                    var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                    posregFile = allFiles.FirstOrDefault(f => f.Name.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                }

                if (posregFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "POSREG.VA file not found";
                    return result;
                }

                // Find trajectory file (case-insensitive)
                var trajectoryPattern = filePatterns.FirstOrDefault(f => !f.Equals("POSREG.VA", StringComparison.OrdinalIgnoreCase));
                
                if (string.IsNullOrEmpty(trajectoryPattern))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "Could not identify trajectory file pattern";
                    return result;
                }

                // Find trajectory files with case-insensitive matching
                var trajectoryFiles = new List<FileInfo>();
                
                if (trajectoryPattern.Contains('*'))
                {
                    trajectoryFiles.AddRange(directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories));
                }
                else
                {
                    var file = directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories).FirstOrDefault();
                    
                    if (file == null)
                    {
                        var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                        file = allFiles.FirstOrDefault(f => f.Name.Equals(trajectoryPattern, StringComparison.OrdinalIgnoreCase));
                        
                        if (file == null)
                        {
                            var baseNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryPattern);
                            file = allFiles.FirstOrDefault(f => 
                                Path.GetFileNameWithoutExtension(f.Name).Equals(baseNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                        }
                    }
                    
                    if (file != null) trajectoryFiles.Add(file);
                }

                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryPattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;

                // Validate each trajectory file
                var fileResults = new List<FileSearchResult>();
                var allCompliant = true;

                foreach (var trajectoryFile in trajectoryFiles)
                {
                    // Use PRTrajectoryCommentValidationService to validate PR comments
                    var (validationStatus, message) = PRTrajectoryCommentValidationService.ValidatePRTrajectoryComment(
                        trajectoryFile.FullName,
                        posregFile.FullName,
                        expectedCommentPatterns);

                    var isCompliant = validationStatus == "OK";
                    if (!isCompliant) allCompliant = false;

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = expectedCommentPatterns,
                        Found = isCompliant,
                        LineNumber = 0,
                        LineContent = message,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (allCompliant && fileResults.Count > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = fileResults.Count;
                    result.FilesNotFound = 0;
                    result.Summary = fileResults[0].LineContent;
                }
                else if (fileResults.Count > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = fileResults.Count;
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = "No valid results";
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating PR trajectory comments: {ex.Message}";
                return result;
            }
        }


        private ValidationResult HandlePRCommentOrderFineValidation(string folderPath, string filesRequiringVerificationString, string expectedCommentOrder)
        {
            var result = new ValidationResult
            {
                CommandSearched = expectedCommentOrder,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                // Only requires trajectory file now - no POSREG.VA dependency
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count < 1)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "PR_COMMENT_ORDER_FINE validation requires at least one trajectory file";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(expectedCommentOrder))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No comment order specified in What to Check";
                    return result;
                }

                // Find trajectory files with case-insensitive matching
                var directory = new DirectoryInfo(folderPath);
                var trajectoryFiles = new List<FileInfo>();
                
                // Use first file pattern from Files Requiring Verification
                var trajectoryPattern = filePatterns[0];

                if (trajectoryPattern.Contains('*'))
                {
                    trajectoryFiles.AddRange(directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories));
                }
                else
                {
                    var file = directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories).FirstOrDefault();
                    
                    if (file == null)
                    {
                        var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                        file = allFiles.FirstOrDefault(f => f.Name.Equals(trajectoryPattern, StringComparison.OrdinalIgnoreCase));
                        
                        if (file == null)
                        {
                            var baseNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryPattern);
                            file = allFiles.FirstOrDefault(f => 
                                Path.GetFileNameWithoutExtension(f.Name).Equals(baseNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                        }
                    }
                    
                    if (file != null) trajectoryFiles.Add(file);
                }

                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryPattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;

                // Validate each trajectory file
                var fileResults = new List<FileSearchResult>();
                var allCompliant = true;

                foreach (var trajectoryFile in trajectoryFiles)
                {
                    // Use PRCommentOrderFineValidationService to validate PR comment order
                    // Service only needs trajectory file - POSREG.VA parameter is ignored
                    (string validationStatus, string message) = PRCommentOrderFineValidationService.ValidatePRCommentOrderFine(
                        trajectoryFile.FullName,
                        string.Empty,  // posregFilePath ignored - not needed
                        expectedCommentOrder);

                    var isCompliant = validationStatus == "OK";
                    if (!isCompliant) allCompliant = false;

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = expectedCommentOrder,
                        Found = isCompliant,
                        LineNumber = 0,
                        LineContent = message,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (allCompliant && fileResults.Count > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = fileResults.Count;
                    result.FilesNotFound = 0;
                    result.Summary = fileResults[0].LineContent;
                }
                else if (fileResults.Count > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = fileResults.Count;
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = "No valid results";
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating PR comment order with FINE: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePRCommentFineValidation(string folderPath, string filesRequiringVerificationString, string prCommentSpec)
        {
            var result = new ValidationResult
            {
                CommandSearched = prCommentSpec,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count < 1)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "PR_COMMENT_FINE validation requires at least one trajectory file";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(prCommentSpec))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No PR comment specification provided in What to Check";
                    return result;
                }

                // Find trajectory files with case-insensitive matching
                var directory = new DirectoryInfo(folderPath);
                var trajectoryFiles = new List<FileInfo>();
                
                // Use first file pattern from Files Requiring Verification
                var trajectoryPattern = filePatterns[0];

                if (trajectoryPattern.Contains('*'))
                {
                    trajectoryFiles.AddRange(directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories));
                }
                else
                {
                    var file = directory.EnumerateFiles(trajectoryPattern, SearchOption.AllDirectories).FirstOrDefault();
                    
                    if (file == null)
                    {
                        var allFiles = directory.EnumerateFiles("*", SearchOption.AllDirectories);
                        file = allFiles.FirstOrDefault(f => f.Name.Equals(trajectoryPattern, StringComparison.OrdinalIgnoreCase));
                        
                        if (file == null)
                        {
                            var baseNameWithoutExt = Path.GetFileNameWithoutExtension(trajectoryPattern);
                            file = allFiles.FirstOrDefault(f => 
                                Path.GetFileNameWithoutExtension(f.Name).Equals(baseNameWithoutExt, StringComparison.OrdinalIgnoreCase));
                        }
                    }
                    
                    if (file != null) trajectoryFiles.Add(file);
                }

                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryPattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;

                // Validate each trajectory file
                var fileResults = new List<FileSearchResult>();
                var allCompliant = true;

                foreach (var trajectoryFile in trajectoryFiles)
                {
                    // Use PRCommentFineValidationService to validate PR comment FINE
                    (string validationStatus, string message) = PRCommentFineValidationService.ValidatePRCommentFine(
                        trajectoryFile.FullName,
                        prCommentSpec);

                    var isCompliant = validationStatus == "OK";
                    if (!isCompliant) allCompliant = false;

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = prCommentSpec,
                        Found = isCompliant,
                        LineNumber = 0,
                        LineContent = message,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (allCompliant && fileResults.Count > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = fileResults.Count;
                    result.FilesNotFound = 0;
                    result.Summary = fileResults[0].LineContent;
                }
                else if (fileResults.Count > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = fileResults.Count;
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = "No valid results";
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating PR comment FINE: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleFrameValidation(string folderPath, string checkStatement)
        {
            var result = new ValidationResult
            {
                CommandSearched = checkStatement,
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Find FRAME.DG file in the folder
                var directory = new DirectoryInfo(folderPath);
                var frameFile = directory.EnumerateFiles("FRAME.DG", SearchOption.AllDirectories).FirstOrDefault();

                if (frameFile == null)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.Summary = $"FRAME.DG file not found in folder";
                    result.FilesSearched = 0;
                    return result;
                }

                result.FilesSearched = 1;

                // Determine which frame type to validate
                Algorithms.FrameCoordinateValidationService.ValidationResult validationCheckResult = null;

                if (Regex.IsMatch(checkStatement, @"tool\s+frames?", RegexOptions.IgnoreCase))
                {
                    validationCheckResult = Algorithms.FrameCoordinateValidationService.ValidateDuplicateToolFrames(frameFile.FullName);
                }
                else if (Regex.IsMatch(checkStatement, @"jog\s+frames?", RegexOptions.IgnoreCase))
                {
                    validationCheckResult = Algorithms.FrameCoordinateValidationService.ValidateDuplicateJogFrames(frameFile.FullName);
                }
                else if (Regex.IsMatch(checkStatement, @"user\s+frames?", RegexOptions.IgnoreCase))
                {
                    validationCheckResult = Algorithms.FrameCoordinateValidationService.ValidateDuplicateUserFrames(frameFile.FullName);
                }
                else
                {
                    // Default to Tool frames if not specified
                    validationCheckResult = Algorithms.FrameCoordinateValidationService.ValidateDuplicateToolFrames(frameFile.FullName);
                }

                // Map the result back to ValidationResult format
                if (validationCheckResult.Success)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = "FRAME.DG",
                        FilePath = frameFile.FullName,
                        CommandSearched = checkStatement,
                        Found = validationCheckResult.Success,
                        LineNumber = 0,
                        LineContent = validationCheckResult.DetailedMessage,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating frame coordinates: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePayloadValidation(string folderPath, string filePattern, string commandToSearch)
        {
            var result = new ValidationResult();

            try
            {
                // Parse filePattern to extract PAYLOAD.DT and trajectory file names
                // Expected format: "PAYLOAD.DT , TRAJ1.LS" or similar
                var fileParts = filePattern.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (fileParts.Count != 2)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "Payload validation requires two files: PAYLOAD.DT and a trajectory file";
                    return result;
                }

                // Identify PAYLOAD.DT and trajectory file
                string payloadDtFile = fileParts.FirstOrDefault(f => f.Equals("PAYLOAD.DT", StringComparison.OrdinalIgnoreCase));
                string trajectoryFilePattern = fileParts.FirstOrDefault(f => !f.Equals("PAYLOAD.DT", StringComparison.OrdinalIgnoreCase));

                if (string.IsNullOrEmpty(payloadDtFile) || string.IsNullOrEmpty(trajectoryFilePattern))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "Could not identify PAYLOAD.DT and trajectory file";
                    return result;
                }

                // Find files in the folder
                var directory = new DirectoryInfo(folderPath);
                var payloadDtFileInfo = directory.EnumerateFiles(payloadDtFile, SearchOption.AllDirectories).FirstOrDefault();
                
                if (payloadDtFileInfo == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = $"PAYLOAD.DT file not found in folder";
                    return result;
                }

                // Find trajectory files
                var trajectoryFiles = directory.EnumerateFiles(trajectoryFilePattern, SearchOption.AllDirectories).ToList();
                
                if (trajectoryFiles.Count == 0)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"No trajectory files matching '{trajectoryFilePattern}' found";
                    return result;
                }

                result.FilesSearched = trajectoryFiles.Count;
                var fileResults = new List<FileSearchResult>();
                var compliantCount = 0;
                var nonCompliantCount = 0;

                // Validate each trajectory file
                foreach (var trajectoryFile in trajectoryFiles)
                {
                    var validationCheckResult = Algorithms.PayloadValidationService.ValidatePayloadsCommentedAndNotZero(
                        trajectoryFile.FullName,
                        payloadDtFileInfo.FullName);

                    if (validationCheckResult.IsCompliant)
                    {
                        compliantCount++;
                    }
                    else
                    {
                        nonCompliantCount++;
                    }

                    fileResults.Add(new FileSearchResult
                    {
                        FileName = trajectoryFile.Name,
                        FilePath = trajectoryFile.FullName,
                        CommandSearched = commandToSearch,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    });
                }

                // Determine overall status
                if (nonCompliantCount == 0 && compliantCount > 0)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = compliantCount;
                    result.FilesNotFound = 0;
                }
                else if (compliantCount == 0 && nonCompliantCount > 0)
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = nonCompliantCount;
                }
                else
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.FilesFound = compliantCount;
                    result.FilesNotFound = nonCompliantCount;
                }

                // Build summary
                if (fileResults.Count == 1)
                {
                    result.Summary = fileResults[0].LineContent;
                }
                else
                {
                    var compliantFiles = fileResults.Where(f => f.Found).Select(f => f.FileName).ToList();
                    var nonCompliantFiles = fileResults.Where(f => !f.Found).Select(f => f.FileName).ToList();

                    var summaryParts = new List<string>();
                    if (compliantFiles.Count > 0)
                        summaryParts.Add($"✓ Compliant: {string.Join(", ", compliantFiles)}");
                    if (nonCompliantFiles.Count > 0)
                        summaryParts.Add($"✗ Non-Compliant: {string.Join(", ", nonCompliantFiles)}");
                    
                    result.Summary = string.Join(" | ", summaryParts);
                }

                result.FileResults = fileResults;
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating payloads: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Handles Payload_Comment validation:
        /// 1. Check if payload is commented and has non-zero coordinates
        /// 2. If not, search trajectory files for usage
        /// 3. If found in trajectory files → NOK, otherwise → OK
        /// </summary>
        private ValidationResult HandlePayloadCommentValidation(string folderPath, string filePattern, string whatToCheck)
        {
            var result = new ValidationResult();

            try
            {
                // Parse what_to_check to extract payload number
                // Expected format: "3" or "PAYLOAD[3]" or similar
                var payloadNumberMatch = Regex.Match(whatToCheck, @"\d+");
                if (!payloadNumberMatch.Success || !int.TryParse(payloadNumberMatch.Value, out int payloadNumber))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = $"Could not extract payload number from: {whatToCheck}";
                    return result;
                }

                // Find PAYLOAD.DT file
                var directory = new DirectoryInfo(folderPath);
                var payloadDtFile = directory.EnumerateFiles("PAYLOAD.DT", SearchOption.AllDirectories).FirstOrDefault();

                if (payloadDtFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "PAYLOAD.DT file not found";
                    return result;
                }

                // Validate the payload
                var validationResult = PayloadCommentValidationService.ValidatePayloadComment(
                    payloadNumber,
                    payloadDtFile.FullName,
                    folderPath);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" :
                               validationResult.StatusMessage == "NA" ? "NA" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NA" ? "warning" :
                                    result.Status == "NOK" ? "danger" : "danger";

                result.Summary = validationResult.ValidationSummary;
                result.FilesSearched = 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = "PAYLOAD[" + payloadNumber + "]",
                    FilePath = payloadDtFile.FullName,
                    CommandSearched = whatToCheck,
                    Found = validationResult.StatusMessage == "OK",
                    LineNumber = 0,
                    LineContent = validationResult.ValidationSummary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };
                result.FilesFound = validationResult.StatusMessage == "OK" ? 1 : 0;
                result.FilesNotFound = validationResult.StatusMessage == "NOK" ? 1 : 0;

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Payload_Comment validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePayloadDuplicateValidation(string folderPath, string filePattern, string commandToSearch)
        {
            var result = new ValidationResult();

            try
            {
                // Find PAYLOAD.DT file in the folder
                var directory = new DirectoryInfo(folderPath);
                var payloadDtFileInfo = directory.EnumerateFiles("PAYLOAD.DT", SearchOption.AllDirectories).FirstOrDefault();

                if (payloadDtFileInfo == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = $"PAYLOAD.DT file not found in folder";
                    result.FilesSearched = 0;
                    return result;
                }

                result.FilesSearched = 1;

                // Validate for duplicate payload values
                var validationCheckResult = Algorithms.PayloadValidationService.ValidatePayloadDuplicateValues(
                    payloadDtFileInfo.FullName);

                // Map the result back to ValidationResult format
                if (validationCheckResult.IsCompliant)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = "PAYLOAD.DT",
                        FilePath = payloadDtFileInfo.FullName,
                        CommandSearched = commandToSearch,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating payloads: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleProgramFileCommentValidation(string folderPath, string filePattern, string commandToSearch)
        {
            var result = new ValidationResult();

            try
            {
                // Parse filePattern to extract file patterns
                // Can be single file or comma-separated patterns like "TRAJ*.LS"
                var filePatterns = filePattern.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file patterns specified";
                    return result;
                }

                result.FilesSearched = 1;

                // Validate program file comments
                var validationCheckResult = Algorithms.ProgramFileValidationService.ValidateProgramFileComments(
                    folderPath,
                    filePatterns);

                // Map the result back to ValidationResult format
                // Use the Status property directly from validation result (NA, OK, NOK, ERROR)
                result.Status = validationCheckResult.Status;
                
                if (validationCheckResult.Status == "OK")
                {
                    result.StatusColor = "success";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = 0;
                }
                else if (validationCheckResult.Status == "NA")
                {
                    result.StatusColor = "warning";
                    result.FilesFound = 0;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.StatusColor = "danger";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = validationCheckResult.ValidationIssues.Count;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = string.Join(", ", filePatterns),
                        FilePath = folderPath,
                        CommandSearched = commandToSearch,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating program file comments: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleTrajectoryHeaderValidation(string folderPath, string filePattern, string commandToSearch)
        {
            var result = new ValidationResult();

            try
            {
                // Parse filePattern to extract file patterns
                // Can be single file or comma-separated patterns like "TRAJ*.LS"
                var filePatterns = filePattern.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file patterns specified";
                    return result;
                }

                result.FilesSearched = 1;

                // Validate trajectory headers
                var validationCheckResult = Algorithms.TrajectoryHeaderValidationService.ValidateTrajectoryHeaders(
                    folderPath,
                    filePatterns);

                // Map the result back to ValidationResult format
                // Use the Status property directly from validation result (NA, OK, NOK, ERROR)
                result.Status = validationCheckResult.Status;
                
                if (validationCheckResult.Status == "OK")
                {
                    result.StatusColor = "success";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = 0;
                }
                else if (validationCheckResult.Status == "NA")
                {
                    result.StatusColor = "warning";
                    result.FilesFound = 0;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.StatusColor = "danger";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = validationCheckResult.ValidationIssues.Count;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = string.Join(", ", filePatterns),
                        FilePath = folderPath,
                        CommandSearched = commandToSearch,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating trajectory headers: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePresentDuplicateValidation(string folderPath, string filePattern, string keywordsString)
        {
            var result = new ValidationResult();

            try
            {
                // Parse filePattern to extract file patterns
                var filePatterns = filePattern.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file patterns specified";
                    return result;
                }

                // keywordsString is now already extracted from Logic column first field
                // Format: "keyword1,keyword2,keyword3"
                // Just pass it directly to the validation service
                string keywords = keywordsString;

                result.FilesSearched = 1;

                // Validate present duplicate
                var validationCheckResult = Algorithms.PresentDuplicateValidationService.ValidatePresentDuplicate(
                    folderPath,
                    filePatterns,
                    keywords);

                // Map the result back to ValidationResult format
                // Use the Status property directly from validation result (NA, OK, NOK, ERROR)
                result.Status = validationCheckResult.Status;
                
                if (validationCheckResult.Status == "OK")
                {
                    result.StatusColor = "success";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = 0;
                }
                else if (validationCheckResult.Status == "NA")
                {
                    result.StatusColor = "warning";
                    result.FilesFound = 0;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.StatusColor = "danger";
                    result.FilesFound = validationCheckResult.ValidationDetails.Count;
                    result.FilesNotFound = validationCheckResult.ValidationIssues.Count;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = string.Join(", ", filePatterns),
                        FilePath = folderPath,
                        CommandSearched = keywordsString,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating present duplicate: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePresentCommonValidation(string folderPath, string filesRequiringVerificationString, string patternsString)
        {
            var result = new ValidationResult();

            try
            {
                // Parse file patterns from Files Requiring Verification column (comma-separated)
                var filePatterns = filesRequiringVerificationString.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No files specified in Files Requiring Verification";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(patternsString))
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No patterns specified in What to Check";
                    return result;
                }

                result.FilesSearched = 1;

                // Validate present common (patterns should NOT be found)
                var (validationStatus, message, foundInFile, lineContent) = PresentCommonValidationService.ValidatePresentCommon(folderPath, filePatterns, patternsString);

                // Map the result back to ValidationResult format
                if (validationStatus == "OK")
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                    result.Summary = message; // e.g., "DO not found"
                }
                else if (validationStatus == "NOK")
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                    result.Summary = message; // e.g., "DO found in file, J DO[jdbasjbas] 50% FINE ;"
                }
                else // NA or ERROR
                {
                    result.Status = validationStatus;
                    result.StatusColor = "warning";
                    result.FilesFound = 0;
                    result.FilesNotFound = 0;
                    result.Summary = message;
                }

                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = string.IsNullOrEmpty(foundInFile) ? "N/A" : foundInFile,
                        FilePath = folderPath,
                        CommandSearched = patternsString,
                        Found = validationStatus == "OK",
                        LineNumber = 0,
                        LineContent = result.Summary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating present common: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleToolFrameCommentsValidation(string folderPath, string filePattern, string commandToSearch)
        {
            var result = new ValidationResult();

            try
            {
                // Find FRAME.DG and PAYLOAD.DT files in the folder
                var directory = new DirectoryInfo(folderPath);
                var frameFile = directory.EnumerateFiles("FRAME.DG", SearchOption.AllDirectories).FirstOrDefault();
                var payloadDtFile = directory.EnumerateFiles("PAYLOAD.DT", SearchOption.AllDirectories).FirstOrDefault();

                if (frameFile == null || payloadDtFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    if (frameFile == null)
                        result.Summary = $"FRAME.DG file not found in folder";
                    else
                        result.Summary = $"PAYLOAD.DT file not found in folder";
                    result.FilesSearched = 0;
                    return result;
                }

                result.FilesSearched = 1;

                // Validate tool frame comments are used in payload
                var validationCheckResult = Algorithms.PayloadValidationService.ValidateToolFrameCommentsUsedInPayload(
                    frameFile.FullName,
                    payloadDtFile.FullName);

                // Map the result back to ValidationResult format
                if (validationCheckResult.IsCompliant)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = "FRAME.DG + PAYLOAD.DT",
                        FilePath = frameFile.FullName,
                        CommandSearched = commandToSearch,
                        Found = validationCheckResult.IsCompliant,
                        LineNumber = 0,
                        LineContent = validationCheckResult.ValidationSummary,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating tool frame comments: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleFrameZeroValidation(string folderPath, string frameType, string frameName)
        {
            var result = new ValidationResult();

            try
            {
                // Find FRAME.DG file in the folder
                var directory = new DirectoryInfo(folderPath);
                var frameFile = directory.EnumerateFiles("FRAME.DG", SearchOption.AllDirectories).FirstOrDefault();

                if (frameFile == null)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = $"FRAME.DG file not found in folder";
                    result.FilesSearched = 0;
                    return result;
                }

                result.FilesSearched = 1;

                // Validate if the specific frame is zero
                var validationCheckResult = Algorithms.FrameCoordinateValidationService.ValidateFrameIsZero(
                    frameFile.FullName, frameType, frameName);

                // Map the result back to ValidationResult format
                if (validationCheckResult.Success)
                {
                    result.Status = "OK";
                    result.StatusColor = "success";
                    result.FilesFound = 1;
                    result.FilesNotFound = 0;
                }
                else
                {
                    result.Status = "NOK";
                    result.StatusColor = "danger";
                    result.FilesFound = 0;
                    result.FilesNotFound = 1;
                }

                result.Summary = validationCheckResult.ValidationSummary;
                result.FileResults = new List<FileSearchResult>
                {
                    new FileSearchResult
                    {
                        FileName = "FRAME.DG",
                        FilePath = frameFile.FullName,
                        CommandSearched = $"Check {frameType} Frame {frameName} is 0",
                        Found = validationCheckResult.Success,
                        LineNumber = 0,
                        LineContent = validationCheckResult.DetailedMessage,
                        Confidence = 0.95f
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error validating frame: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleCycleCommentValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file pattern specified";
                    return result;
                }

                // Find the first matching robot program file
                FileInfo? programFile = null;
                foreach (var pattern in filePatterns)
                {
                    programFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (programFile != null) break;
                }

                if (programFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "danger";
                    result.Summary = $"Robot program file not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate cycles in the program file
                var validationResult = Algorithms.CyclesCommentValidationService.ValidateCyclesComment(programFile.FullName);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NOK" ? "danger" : "danger";

                result.Summary = validationResult.ValidationSummary;
                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = programFile.Name,
                    FilePath = programFile.FullName,
                    CommandSearched = "Cycle_Comment",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = validationResult.ValidationSummary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Cycle_Comment validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleCycleCallValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file pattern specified";
                    return result;
                }

                // Find the first matching robot program file
                FileInfo? programFile = null;
                foreach (var pattern in filePatterns)
                {
                    programFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (programFile != null) break;
                }

                if (programFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "danger";
                    result.Summary = $"Robot program file not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate trajectory calls in the program file
                var validationResult = Algorithms.CycleCallInstValidationService.ValidateCycleCallInst(programFile.FullName);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NOK" ? "danger" : "danger";

                result.Summary = validationResult.ValidationSummary;
                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = programFile.Name,
                    FilePath = programFile.FullName,
                    CommandSearched = "Cycle_Call",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = validationResult.ValidationSummary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Cycle_Call validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleCycleCallInstValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file pattern specified";
                    return result;
                }

                // Find the first matching robot program file
                FileInfo? programFile = null;
                foreach (var pattern in filePatterns)
                {
                    programFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (programFile != null) break;
                }

                if (programFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "danger";
                    result.Summary = $"Robot program file not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate CALL instructions in the program file
                var validationResult = Algorithms.CycleCallInstValidationService.ValidateCycleCallInst(programFile.FullName);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NOK" ? "danger" : "danger";

                // Build detailed summary including line numbers and instructions for invalid cycles
                string summary = validationResult.ValidationSummary;
                if (!validationResult.IsCompliant && validationResult.InvalidCycles.Count > 0)
                {
                    var invalidDetails = new List<string>();
                    foreach (var cycle in validationResult.InvalidCycles)
                    {
                        var details = new List<string>();
                        for (int i = 0; i < cycle.InvalidCallDetails.Count; i++)
                        {
                            var detail = cycle.InvalidCallDetails[i];
                            if (i == 0)
                            {
                                // First instruction in cycle: "Cycle XX has invalid call instruction: INSTRUCTION"
                                details.Add($"Cycle {cycle.CycleNumber} has invalid call instruction: {detail.Instruction}");
                            }
                            else
                            {
                                // Subsequent instructions in cycle: "Line XX: INSTRUCTION"
                                details.Add($"Line {detail.LineNumber}: {detail.Instruction}");
                            }
                        }
                        invalidDetails.Add(string.Join(" | ", details));
                    }
                    summary = string.Join(" | ", invalidDetails);
                }

                result.Summary = summary;
                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = programFile.Name,
                    FilePath = programFile.FullName,
                    CommandSearched = "Cycle_Call_Inst",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = summary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Cycle_Call_Inst validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleTrajectoryCommentStdValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult
            {
                CommandSearched = "Traj_Comment_std",
                FolderPath = folderPath,
                ProcessedAt = DateTime.UtcNow
            };

            try
            {
                // Parse file patterns from Files Requiring Verification column
                var filePatterns = filePattern.Split(',')
                    .Select(f => f.Trim())
                    .Where(f => !string.IsNullOrEmpty(f))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file patterns specified";
                    return result;
                }

                // Use the first pattern as the trajectory file name
                var trajectoryFileName = filePatterns.First();

                // Validate using the service
                var (status, message, matchedPattern, actualComment) = TrajectoryCommentStdValidationService.ValidateTrajectoryCommentStd(
                    folderPath,
                    trajectoryFileName,
                    "ROBID.DT",
                    _connectionString
                );

                // Map result
                result.Status = status == "OK" ? "OK" : status == "NOK" ? "NOK" : "ERROR";
                result.StatusColor = result.Status == "OK" ? "success" : result.Status == "NOK" ? "danger" : "warning";

                if (result.Status == "OK" && !string.IsNullOrWhiteSpace(matchedPattern))
                {
                    result.Summary = $"Comment '{actualComment}' is in standard format. Matched pattern: {matchedPattern}";
                }
                else
                {
                    result.Summary = message;
                }

                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                var fileResult = new FileSearchResult
                {
                    FileName = trajectoryFileName,
                    FilePath = Path.Combine(folderPath, trajectoryFileName),
                    CommandSearched = "Traj_Comment_std",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = result.Summary,
                    Confidence = result.Status == "OK" ? 0.95f : 0.0f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Traj_Comment_std validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandleCycleStartsEndsValidation(string folderPath, string filePattern, string commentType)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file pattern specified";
                    return result;
                }

                // Find the first matching robot program file
                FileInfo? programFile = null;
                foreach (var pattern in filePatterns)
                {
                    programFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (programFile != null) break;
                }

                if (programFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"Robot program file not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate cycle trajectory comments
                var validationResult = CycleStartsEndsValidationService.ValidateCycleStartsEnds(programFile.FullName, commentType);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NOK" ? "danger" : "danger";

                result.Summary = validationResult.ValidationSummary;
                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = programFile.Name,
                    FilePath = programFile.FullName,
                    CommandSearched = $"Cycle_Starts_Ends_{commentType}",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = result.Summary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Cycle_Starts_Ends_{commentType} validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePresentOrderValidation(string folderPath, string filePattern, string patternString)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file pattern specified";
                    return result;
                }

                // Find the first matching file
                FileInfo? targetFile = null;
                foreach (var pattern in filePatterns)
                {
                    targetFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (targetFile != null) break;
                }

                if (targetFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"File not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate present order
                var validationResult = PresentOrderValidationService.ValidatePresentOrder(targetFile.FullName, patternString);

                // Map validation result to controller result
                result.Status = validationResult.StatusMessage == "OK" ? "OK" :
                               validationResult.StatusMessage == "NOK" ? "NOK" : "ERROR";

                result.StatusColor = result.Status == "OK" ? "success" :
                                    result.Status == "NOK" ? "danger" : "danger";

                result.Summary = validationResult.ValidationSummary;
                result.FilesSearched = 1;
                result.FilesFound = result.Status == "OK" ? 1 : 0;
                result.FilesNotFound = result.Status == "OK" ? 0 : 1;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = targetFile.Name,
                    FilePath = targetFile.FullName,
                    CommandSearched = "Present_Order",
                    Found = result.Status == "OK",
                    LineNumber = 0,
                    LineContent = result.Summary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during Present_Order validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePLCZoneCountValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No trajectory file specified in Files Required for Verification column";
                    return result;
                }

                // Find the first matching trajectory file
                FileInfo? trajectoryFile = null;
                foreach (var pattern in filePatterns)
                {
                    trajectoryFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (trajectoryFile != null) break;
                }

                if (trajectoryFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"Trajectory file not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate PLC Zone Count
                var (status, message) = Algorithms.PLCZoneCountValidationService.ValidatePLCZoneCount(trajectoryFile.FullName);

                // Map validation result to controller result
                result.Status = status;
                result.StatusColor = status == "OK" ? "success" :
                                   status == "NA" ? "warning" : "danger";

                result.Summary = message;
                result.FilesSearched = 1;
                result.FilesFound = (status == "OK" || status == "NA") ? 1 : 0;
                result.FilesNotFound = status == "NOK" ? 1 : 0;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = trajectoryFile.Name,
                    FilePath = trajectoryFile.FullName,
                    CommandSearched = "PLC_Zone_Count",
                    Found = status == "OK",
                    LineNumber = 0,
                    LineContent = result.Summary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during PLC_Zone_Count validation: {ex.Message}";
                return result;
            }
        }

        private ValidationResult HandlePLCZoneCycleValidation(string folderPath, string filePattern)
        {
            var result = new ValidationResult();

            try
            {
                var directory = new DirectoryInfo(folderPath);
                
                // Parse file pattern - can be comma-separated or wildcard
                var filePatterns = filePattern.Split(',')
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                if (filePatterns.Count == 0)
                {
                    result.Status = "ERROR";
                    result.StatusColor = "danger";
                    result.Summary = "No file specified in Files Required for Verification column";
                    return result;
                }

                // Find the first matching file
                FileInfo? targetFile = null;
                foreach (var pattern in filePatterns)
                {
                    targetFile = directory.EnumerateFiles(pattern, SearchOption.AllDirectories).FirstOrDefault();
                    if (targetFile != null) break;
                }

                if (targetFile == null)
                {
                    result.Status = "NA";
                    result.StatusColor = "warning";
                    result.Summary = $"File not found matching pattern: {filePattern}";
                    return result;
                }

                // Validate PLC Zone Cycle
                var (status, message) = Algorithms.PLCZoneCycleValidationService.ValidatePLCZoneCycle(targetFile.FullName);

                // Map validation result to controller result
                result.Status = status;
                result.StatusColor = status == "OK" ? "success" :
                                   status == "NA" ? "warning" : "danger";

                result.Summary = message;
                result.FilesSearched = 1;
                result.FilesFound = (status == "OK" || status == "NA") ? 1 : 0;
                result.FilesNotFound = status == "NOK" ? 1 : 0;

                // Create file result for display
                var fileResult = new FileSearchResult
                {
                    FileName = targetFile.Name,
                    FilePath = targetFile.FullName,
                    CommandSearched = "PLC_Zone_Cycle",
                    Found = status == "OK",
                    LineNumber = 0,
                    LineContent = result.Summary,
                    Confidence = 0.95f
                };

                result.FileResults = new List<FileSearchResult> { fileResult };

                return result;
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.StatusColor = "danger";
                result.Summary = $"Error during PLC_Zone_Cycle validation: {ex.Message}";
                return result;
            }
        }
    }
    public class ValidationResult
    {
        public string FilePattern { get; set; } = "";
        public string CommandSearched { get; set; } = "";
        public string FolderPath { get; set; } = "";
        public string Status { get; set; } = "PENDING"; // NOT_FOUND, FOUND, PARTIAL, ERROR
        public string StatusColor { get; set; } = "secondary"; // success (green), danger (red), warning (yellow)
        public string Summary { get; set; } = "";
        public int FilesSearched { get; set; }
        public int FilesFound { get; set; }
        public int FilesNotFound { get; set; }
        public DateTime ProcessedAt { get; set; }
        public List<FileSearchResult> FileResults { get; set; } = new();
    }

 
    public class FileSearchResult
    {
        public string FileName { get; set; } = "";
        public string FilePath { get; set; } = "";
        public string CommandSearched { get; set; } = "";
        public bool Found { get; set; }
        public int LineNumber { get; set; }
        public string LineContent { get; set; } = "";
        public float Confidence { get; set; }
        public string? Error { get; set; }
    }
}
