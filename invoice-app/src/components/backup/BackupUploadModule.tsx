import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, FileArchive, Upload, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

interface BackupUploadModuleProps {
  onRestore: (file: File) => Promise<void>;
  isRestoring: boolean;
}

export const BackupUploadModule: React.FC<BackupUploadModuleProps> = ({
  onRestore,
  isRestoring,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');

  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return 'Only ZIP backup files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File size exceeds the maximum allowed size (1 GB).';
    }
    if (file.size === 0) {
      return 'The selected file is empty.';
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File | null) => {
      setLocalError('');
      if (!file) {
        setSelectedFile(null);
        return;
      }
      const error = validateFile(file);
      if (error) {
        setLocalError(error);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    },
    [validateFile],
  );

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setLocalError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    if (
      !window.confirm(
        'WARNING: This will replace ALL existing data with the backup data. This cannot be undone. Continue?',
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        'Final confirmation: This will DELETE all current data and restore from the uploaded backup. Continue?',
      )
    ) {
      return;
    }

    setLocalError('');
    try {
      await onRestore(selectedFile);
      clearSelection();
    } catch {
      // Parent shows error message
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-indigo-600" />
          Upload &amp; Restore Backup
        </CardTitle>
        <CardDescription>
          Upload a backup ZIP file from your local machine to restore database and uploaded files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !isRestoring && inputRef.current?.click()}
          className={[
            'rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
            dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50',
            isRestoring ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={onInputChange}
            disabled={isRestoring}
            className="hidden"
          />
          <FileArchive className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-medium text-slate-800">
            Drag and drop your backup ZIP here, or click to browse
          </p>
          <p className="text-xs text-slate-500 mt-1">ZIP only · Max 1 GB</p>
        </div>

        {localError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {selectedFile && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              disabled={isRestoring}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Restoring replaces all current data (users, customers, invoices, payments, and uploads).
            Create a new backup first if you need to keep today&apos;s data.
          </span>
        </div>

        <Button
          variant="danger"
          className="w-full"
          disabled={!selectedFile || isRestoring}
          isLoading={isRestoring}
          leftIcon={<Upload className="h-4 w-4" />}
          onClick={handleRestore}
        >
          Restore from uploaded backup
        </Button>
      </CardContent>
    </Card>
  );
};
