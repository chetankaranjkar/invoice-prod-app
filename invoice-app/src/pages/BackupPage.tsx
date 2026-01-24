import React, { useState, useEffect } from 'react';
import { Download, Upload, Database, FileArchive, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/agent';

interface BackupInfo {
  fileName: string;
  fileSize: number;
  createdDate: string;
}

export const BackupPage: React.FC = () => {
  const { themeColors } = useTheme();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await api.backup.list();
      setBackups(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load backups');
      console.error('Error loading backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!window.confirm('This will create a backup of all data (database and uploaded files). Continue?')) {
      return;
    }

    try {
      setCreatingBackup(true);
      setError('');
      setSuccess('');

      const response = await api.backup.create();
      
      // Create download link for the blob
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'invoiceapp-backup.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('Backup created and downloaded successfully!');
      loadBackups(); // Refresh backup list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create backup');
      console.error('Error creating backup:', err);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: This will replace ALL existing data with the backup data. This action cannot be undone. Are you absolutely sure?')) {
      event.target.value = ''; // Reset file input
      return;
    }

    if (!window.confirm('Final confirmation: This will DELETE all current data and restore from backup. Continue?')) {
      event.target.value = '';
      return;
    }

    try {
      setRestoringBackup(true);
      setError('');
      setSuccess('');

      await api.backup.restore(file);
      setSuccess('Backup restored successfully! Please refresh the page.');
      
      // Clear file input
      event.target.value = '';
      
      // Reload page after 2 seconds to show restored data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restore backup');
      console.error('Error restoring backup:', err);
      event.target.value = ''; // Reset file input on error
    } finally {
      setRestoringBackup(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Backup & Restore</h1>
        <p className="text-gray-600">
          Create backups of all your data (database and uploaded files) or restore from a previous backup.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          <span>{success}</span>
        </div>
      )}

      {/* Backup Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Create Backup */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <Database className="h-6 w-6 mr-3" style={{ color: themeColors.primary }} />
            <h2 className="text-xl font-semibold text-gray-900">Create Backup</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Create a complete backup of your database and all uploaded files. The backup will be downloaded as a ZIP file.
          </p>
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-white font-medium transition-colors ${
              creatingBackup
                ? 'bg-gray-400 cursor-not-allowed'
                : themeColors.primary
            }`}
          >
            {creatingBackup ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Create Backup
              </>
            )}
          </button>
        </div>

        {/* Restore Backup */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <Upload className="h-6 w-6 mr-3" style={{ color: themeColors.primary }} />
            <h2 className="text-xl font-semibold text-gray-900">Restore Backup</h2>
          </div>
          <p className="text-gray-600 mb-4">
            <strong className="text-red-600">Warning:</strong> This will replace all existing data with the backup data. This action cannot be undone.
          </p>
          <label 
            className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-white font-medium transition-colors ${
              restoringBackup
                ? 'bg-gray-400 cursor-not-allowed'
                : themeColors.primary || 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
            }`}
          >
            <input
              type="file"
              accept=".zip"
              onChange={handleRestoreBackup}
              disabled={restoringBackup}
              className="hidden"
            />
            {restoringBackup ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Restoring...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Select Backup File
              </>
            )}
          </label>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileArchive className="h-5 w-5 mr-2" style={{ color: themeColors.primary }} />
            <h2 className="text-lg font-semibold text-gray-900">Available Backups</h2>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: themeColors.primary }}></div>
              <p className="mt-4 text-gray-600">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileArchive className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No backups found. Create your first backup to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {backup.fileName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(backup.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(backup.createdDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Information Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Important Notes:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Backups include all database data (users, customers, invoices, payments) and uploaded files (logos).</li>
          <li>Backup files are stored on the server and can be downloaded.</li>
          <li>Restoring a backup will completely replace all current data.</li>
          <li>Always create a backup before restoring to avoid data loss.</li>
          <li>Backup files are ZIP archives that can be used with the restore scripts if needed.</li>
        </ul>
      </div>
    </div>
  );
};
