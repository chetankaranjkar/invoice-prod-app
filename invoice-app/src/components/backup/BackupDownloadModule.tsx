import React, { useCallback } from 'react';
import { Download, FileArchive, HardDrive } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { useDateFormat } from '../../hooks/useDateFormat';

export interface BackupListItem {
  fileName: string;
  fileSize: number;
  createdDate: string;
}

interface BackupDownloadModuleProps {
  backups: BackupListItem[];
  loading: boolean;
  creatingBackup: boolean;
  downloadingFile: string | null;
  onCreateBackup: () => Promise<void>;
  onDownloadBackup: (fileName: string) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

export const BackupDownloadModule: React.FC<BackupDownloadModuleProps> = ({
  backups,
  loading,
  creatingBackup,
  downloadingFile,
  onCreateBackup,
  onDownloadBackup,
}) => {
  const formatDatePref = useDateFormat();

  const formatDateTimeDisplay = useCallback(
    (dateString: string) => {
      const d = new Date(dateString);
      if (Number.isNaN(d.getTime())) return dateString;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return `${formatDatePref(ymd)} ${d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    },
    [formatDatePref],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-600" />
            Download Backup (Local)
          </CardTitle>
          <CardDescription>
            Create a full backup (database + uploads) and save the ZIP file to your computer.
            Backups are also kept on the server for re-download.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            isLoading={creatingBackup}
            leftIcon={<Download className="h-4 w-4" />}
            onClick={onCreateBackup}
          >
            Create backup &amp; download to this PC
          </Button>
          <p className="text-xs text-slate-500 mt-3">
            The ZIP is saved to your browser&apos;s Downloads folder. No cloud upload is performed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-indigo-600" />
            Server Backups
          </CardTitle>
          <CardDescription>
            Previously created backups stored on this machine&apos;s server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
              <p className="mt-4 text-sm text-slate-500">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileArchive className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">No backups yet. Create your first backup above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-5 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-5 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-5 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {backups.map((backup) => (
                    <tr key={backup.fileName} className="hover:bg-slate-50/80">
                      <td className="px-5 sm:px-6 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                        {backup.fileName}
                      </td>
                      <td className="px-5 sm:px-6 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {formatFileSize(backup.fileSize)}
                      </td>
                      <td className="px-5 sm:px-6 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {formatDateTimeDisplay(backup.createdDate)}
                      </td>
                      <td className="px-5 sm:px-6 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={downloadingFile === backup.fileName}
                          leftIcon={<Download className="h-3.5 w-3.5" />}
                          onClick={() => onDownloadBackup(backup.fileName)}
                        >
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
