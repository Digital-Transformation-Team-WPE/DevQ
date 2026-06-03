using System.Security.Cryptography;

namespace ChecklistMaster.Server.Services
{
    /// <summary>
    /// PBKDF2-SHA256 password hashing. Stored format: "PBKDF2:{base64-salt}:{base64-hash}"
    /// </summary>
    public static class PasswordHasher
    {
        private const int    SaltSize   = 16;
        private const int    HashSize   = 32;
        private const int    Iterations = 100_000;
        private const string Prefix     = "PBKDF2";

        public static string Hash(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            var hash = Rfc2898DeriveBytes.Pbkdf2(
                password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
            return $"{Prefix}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
        }

        public static bool Verify(string input, string stored)
        {
            try
            {
                var parts = stored.Split(':');
                if (parts.Length != 3 || parts[0] != Prefix) return false;
                var salt     = Convert.FromBase64String(parts[1]);
                var expected = Convert.FromBase64String(parts[2]);
                var actual   = Rfc2898DeriveBytes.Pbkdf2(
                    input, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
                return CryptographicOperations.FixedTimeEquals(actual, expected);
            }
            catch { return false; }
        }
    }
}
