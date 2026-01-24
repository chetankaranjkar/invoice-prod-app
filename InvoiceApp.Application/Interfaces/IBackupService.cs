using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IBackupService
    {
        Task<BackupResult> CreateBackupAsync();
        Task<RestoreResult> RestoreBackupAsync(string backupFilePath);
        Task<List<BackupInfo>> ListBackupsAsync();
    }

    public class BackupResult
    {
        public bool Success { get; set; }
        public string? FilePath { get; set; }
        public string? FileName { get; set; }
        public long FileSize { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class RestoreResult
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class BackupInfo
    {
        public string? FileName { get; set; }
        public long FileSize { get; set; }
        public System.DateTime CreatedDate { get; set; }
    }
}
