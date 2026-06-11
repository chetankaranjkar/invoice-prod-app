import React, { useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { BackupDownloadModule, BackupUploadModule } from '../components/backup';
import { api } from '../services/agent';
import { getApiErrorMessage } from '../utils/apiError';
import { downloadBlob, getFilenameFromContentDisposition } from '../utils/downloadBlob';

interface BackupInfo {
  fileName: string;
  fileSize: number;
  createdDate: string;
}

export const BackupPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await api.backup.list();
      setBackups(response.data || []);
      setError('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to load backups');
      console.error('Error loading backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const downloadBackupResponse = (response: AxiosResponse<Blob>, fallbackName: string) => {
    const contentDisposition = response.headers['content-disposition'];
    const filename = getFilenameFromContentDisposition(
      typeof contentDisposition === 'string' ? contentDisposition : undefined,
      fallbackName,
    );
    downloadBlob(new Blob([response.data], { type: 'application/zip' }), filename);
  };

  const handleCreateBackup = async () => {
    if (
      !window.confirm(
        'This will create a backup of all data (database and uploaded files) and download it to your PC. Continue?',
      )
    ) {
      return;
    }

    try {
      setCreatingBackup(true);
      setError('');
      setSuccess('');

      const response = await api.backup.create();
      downloadBackupResponse(response, 'invoiceapp-backup.zip');

      setSuccess('Backup created and downloaded to your computer.');
      await loadBackups();
    } catch (err: unknown) {
      setError(await getApiErrorMessage(err, 'Failed to create backup'));
      console.error('Error creating backup:', err);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (fileName: string) => {
    try {
      setDownloadingFile(fileName);
      setError('');
      setSuccess('');

      const response = await api.backup.download(fileName);
      downloadBackupResponse(response, fileName);

      setSuccess(`Downloaded ${fileName} to your computer.`);
    } catch (err: unknown) {
      setError(await getApiErrorMessage(err, 'Failed to download backup'));
      console.error('Error downloading backup:', err);
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      setRestoringBackup(true);
      setError('');
      setSuccess('');

      await api.backup.restore(file);
      setSuccess('Backup restored successfully! Reloading...');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: unknown) {
      setError(await getApiErrorMessage(err, 'Failed to restore backup'));
      console.error('Error restoring backup:', err);
      throw err;
    } finally {
      setRestoringBackup(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Data Backup &amp; Restore</h1>
        <p className="text-slate-600">
          Download backups to your local machine or upload a backup ZIP file to restore data.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <BackupDownloadModule
          backups={backups}
          loading={loading}
          creatingBackup={creatingBackup}
          downloadingFile={downloadingFile}
          onCreateBackup={handleCreateBackup}
          onDownloadBackup={handleDownloadBackup}
        />
        <BackupUploadModule onRestore={handleRestoreBackup} isRestoring={restoringBackup} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">What&apos;s in a backup ZIP?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <code className="text-xs bg-blue-100 px-1 rounded">database/InvoiceApp.bak</code> — native SQL Server backup (not JSON)
          </li>
          <li>
            <code className="text-xs bg-blue-100 px-1 rounded">uploads/</code> — logos, signatures, and other uploaded files
          </li>
          <li>Backups are saved locally on your PC (Downloads folder). Cloud upload is not enabled.</li>
          <li>Always create a backup before restoring to avoid losing current data.</li>
        </ul>
      </div>
    </div>
  );
};
