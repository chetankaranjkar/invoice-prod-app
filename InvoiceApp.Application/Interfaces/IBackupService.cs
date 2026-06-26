using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IBackupService
    {
        Task<BackupResult> CreateBackupAsync();
        Task<RestoreResult> RestoreBackupAsync(string backupFilePath);
        Task<List<BackupInfo>> ListBackupsAsync();
        Task<BackupResult?> GetBackupFileAsync(string fileName);
        Task<BackupStatus> GetBackupStatusAsync();
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

    public class BackupStatus
    {
        public bool HasBackup { get; set; }
        public System.DateTime? LastBackupAt { get; set; }
        public string? LastBackupFileName { get; set; }
        public long LastBackupSize { get; set; }
        public int TotalBackups { get; set; }
        public int? DaysSinceBackup { get; set; }
        public int StaleAfterDays { get; set; } = 7;
        public bool IsStale { get; set; }
    }
}
