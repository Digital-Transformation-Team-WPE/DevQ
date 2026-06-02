using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Robot_Program_Validation.Controllers
{
    public class DatabaseController : Controller
    {
        private readonly string ConnectionString = "Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True";
        private const string MASTER_TABLE = "MASTER DB";

        // ======== REQUEST MODELS ========
        public sealed class UpdateRowRequest
        {
            public int Id { get; set; }
            public List<string> Values { get; set; } = new();
        }

        public sealed class UpdateRowsRequest
        {
            public List<UpdateRowRequest> Rows { get; set; } = new();
        }

        public sealed class SaveTableRequest
        {
            public string TableName { get; set; } = "";
            public List<List<string>> Data { get; set; } = new();
        }

        // ======== LOAD DATABASE PAGE ========
        [HttpGet]
        public IActionResult Database(string selectedDb)
        {
            selectedDb = string.IsNullOrWhiteSpace(selectedDb) ? "Master" : selectedDb.Trim();
            if (selectedDb.Equals("Standard", StringComparison.OrdinalIgnoreCase))
                return LoadStandardTable();
            if (selectedDb.Equals("Program", StringComparison.OrdinalIgnoreCase))
                return LoadProgramTables();
            return LoadMasterTable();
        }

        private IActionResult LoadMasterTable()
        {
            var data = LoadTable(MASTER_TABLE);
            ViewBag.SelectedDb = "Master";
            return PartialView("~/Views/Database/Database.cshtml", data);
        }

        private IActionResult LoadProgramTables()
        {
            ViewBag.SelectedDb = "Program";
            return PartialView("~/Views/Database/Database.cshtml", new List<Dictionary<string, object>>());
        }

        private IActionResult LoadStandardTable()
        {
            var data = LoadTable("robo_standard_types");
            ViewBag.SelectedDb = "Standard";
            return PartialView("~/Views/Database/Database.cshtml", data);
        }

        // ======== SAVE TABLE (MASTER OR PROGRAM) ========
        [HttpPost]
        public async Task<JsonResult> SaveTable([FromBody] SaveTableRequest payload)
        {
            if (payload == null || string.IsNullOrWhiteSpace(payload.TableName) || payload.Data == null)
                return Json(new { success = false, message = "No table or data specified." });

            try
            {
                using var con = new SqlConnection(ConnectionString);
                await con.OpenAsync();

                // Get column metadata
                var cols = await GetColumnMetadataAsync(con, "dbo", payload.TableName);
                if (cols.Count == 0)
                    return Json(new { success = false, message = $"No columns found for dbo.[{payload.TableName}]." });

                var nonComputed = cols.Where(c => !c.IsComputed).ToList();
                var identityCol = cols.FirstOrDefault(c => c.IsIdentity);
                var insertableCols = nonComputed.Where(c => !c.IsIdentity).ToList();

                using var tx = con.BeginTransaction();

                await ExecuteNonQueryAsync(con, tx, $"DELETE FROM dbo.[{payload.TableName}]");
                if (identityCol != null)
                    await ExecuteNonQueryAsync(con, tx, $"DBCC CHECKIDENT('dbo.[{payload.TableName}]', RESEED, 0);");

                // Insert new rows
                var colNames = string.Join(",", insertableCols.Select(c => $"[{c.Name}]"));
                var paramNames = string.Join(",", insertableCols.Select((c, i) => $"@p{i}"));
                var baseSql = $"INSERT INTO dbo.[{payload.TableName}] ({colNames}) VALUES ({paramNames});";

                foreach (var row in payload.Data)
                {
                    using var cmd = new SqlCommand(baseSql, con, tx);
                    for (int i = 0; i < insertableCols.Count; i++)
                    {
                        int originalIdx = cols.FindIndex(x => x.Name.Equals(insertableCols[i].Name, StringComparison.OrdinalIgnoreCase));
                        string strVal = (originalIdx >= 0 && originalIdx < row.Count) ? row[originalIdx]?.Trim() ?? "" : "";

                        object val;

                        if (string.IsNullOrWhiteSpace(strVal))
                        {
                            val = DBNull.Value;
                        }
                        else
                        {
                            // Convert value according to column type
                            switch (insertableCols[i].SqlDataType.ToLower())
                            {
                                case "int":
                                case "bigint":
                                case "smallint":
                                case "tinyint":
                                    val = int.TryParse(strVal, out int intVal) ? intVal : (object)DBNull.Value;
                                    break;
                                case "float":
                                case "real":
                                    val = double.TryParse(strVal, out double dblVal) ? dblVal : (object)DBNull.Value;
                                    break;
                                case "decimal":
                                case "numeric":
                                case "money":
                                case "smallmoney":
                                    val = decimal.TryParse(strVal, out decimal decVal) ? decVal : (object)DBNull.Value;
                                    break;
                                case "bit":
                                    val = bool.TryParse(strVal, out bool bVal) ? bVal : (object)DBNull.Value;
                                    break;
                                case "datetime":
                                case "smalldatetime":
                                case "date":
                                case "datetime2":
                                    val = DateTime.TryParse(strVal, out DateTime dtVal) ? dtVal : (object)DBNull.Value;
                                    break;
                                default:
                                    val = strVal; // string/nvarchar
                                    break;
                            }
                        }

                        cmd.Parameters.AddWithValue($"@p{i}", val);
                    }

                    await cmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
                return Json(new { success = true, message = $"Table '{payload.TableName}' saved successfully!" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Error saving table.", detail = ex.Message });
            }
        }

        // ======== LOAD SINGLE PROGRAM TABLE ========
        [HttpGet]
        public IActionResult LoadProgramTable(string tableName)
        {
            var data = LoadTable(tableName);
            return PartialView("_ProgramTablePartial", data);
        }

        // ======== GET ALL PROGRAM TABLES ========
        [HttpGet]
        public JsonResult GetProgramTables()
        {
            var tables = new List<string>();

            using var conn = new SqlConnection(ConnectionString);
            conn.Open();

            string query = @"
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
              AND TABLE_NAME LIKE '%[_]%';";

            using (SqlCommand cmd = new SqlCommand(query, conn))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    tables.Add(reader["TABLE_NAME"].ToString());
                }
            }
            return Json(tables);
        }

        // ======== HELPER: LOAD TABLE DATA ========
        private List<Dictionary<string, object>> LoadTable(string tableName)
        {
            var list = new List<Dictionary<string, object>>();
            using var con = new SqlConnection(ConnectionString);
            con.Open();

            // Get the primary key column name
            string pkColumn = GetPrimaryKeyColumnName(con, tableName);
            string orderByClause = !string.IsNullOrEmpty(pkColumn) ? $" ORDER BY [{pkColumn}] ASC" : "";

            string sql = $"SELECT * FROM dbo.[{tableName}]{orderByClause}";

            using var cmd = new SqlCommand(sql, con);
            using var dr = cmd.ExecuteReader();
            while (dr.Read())
            {
                var row = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                for (int i = 0; i < dr.FieldCount; i++)
                    row[dr.GetName(i)] = dr.IsDBNull(i) ? "" : dr.GetValue(i);
                list.Add(row);
            }

            return list;
        }

        // ======== HELPER: GET PRIMARY KEY COLUMN NAME ========
        private string GetPrimaryKeyColumnName(SqlConnection con, string tableName)
        {
            const string query = @"
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = @table 
                  AND CONSTRAINT_NAME LIKE 'PK%'
                ORDER BY ORDINAL_POSITION";

            using var cmd = new SqlCommand(query, con);
            cmd.Parameters.AddWithValue("@table", tableName);

            var result = cmd.ExecuteScalar();
            return result?.ToString() ?? "";
        }

        // ======== HELPER: GET COLUMN INFO ========
        private sealed class ColumnInfo
        {
            public string Name { get; set; } = "";
            public bool IsIdentity { get; set; }
            public bool IsComputed { get; set; }
            public string SqlDataType { get; set; } = "";
        }

        private async Task<List<ColumnInfo>> GetColumnMetadataAsync(SqlConnection con, string schema, string table)
        {
            const string metaSql = @"
                SELECT 
                    c.name AS ColumnName,
                    COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS IsIdentity,
                    c.is_computed AS IsComputed,
                    t.name AS SqlDataType
                FROM sys.columns c
                JOIN sys.objects o ON c.object_id = o.object_id
                JOIN sys.types t ON c.user_type_id = t.user_type_id
                WHERE o.type = 'U'
                  AND o.name = @table
                  AND SCHEMA_NAME(o.schema_id) = @schema
                ORDER BY c.column_id;";

            var result = new List<ColumnInfo>();
            using var cmd = new SqlCommand(metaSql, con);
            cmd.Parameters.AddWithValue("@table", table);
            cmd.Parameters.AddWithValue("@schema", schema);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                result.Add(new ColumnInfo
                {
                    Name = r.GetString(r.GetOrdinal("ColumnName")),
                    IsIdentity = (r["IsIdentity"] != DBNull.Value && Convert.ToInt32(r["IsIdentity"]) == 1),
                    IsComputed = (r["IsComputed"] != DBNull.Value && Convert.ToBoolean(r["IsComputed"])),
                    SqlDataType = r["SqlDataType"]?.ToString() ?? "nvarchar"
                });
            }
            return result;
        }

        // ======== HELPER: EXECUTE NONQUERY ========
        private static async Task ExecuteNonQueryAsync(SqlConnection con, SqlTransaction tx, string sql)
        {
            using var cmd = new SqlCommand(sql, con, tx);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}