import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Eye, RefreshCw } from 'lucide-react';
import { api } from '../services/agent';
import { useTheme } from '../contexts/ThemeContext';

interface ErrorLog {
  id: number;
  errorType: string;
  message: string;
  stackTrace?: string;
  innerException?: string;
  source?: string;
  userId?: string;
  userEmail?: string;
  requestPath?: string;
  requestMethod?: string;
  requestBody?: string;
  queryString?: string;
  userAgent?: string;
  ipAddress?: string;
  additionalData?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

interface ErrorStats {
  totalErrors: number;
  unresolvedErrors: number;
  errorsLast24Hours: number;
  errorsLast7Days: number;
}

export const ErrorLogPage: React.FC = () => {
  const { themeColors } = useTheme();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    loadErrorLogs();
    loadStats();
  }, [page, showUnresolvedOnly]);

  const loadErrorLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const response = showUnresolvedOnly
        ? await api.errorLogs.getUnresolved()
        : await api.errorLogs.getAll(page, pageSize);

      setErrorLogs(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load error logs');
      console.error('Error loading error logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.errorLogs.getStats();
      setStats(response.data);
    } catch (err: any) {
      console.error('Error loading error stats:', err);
    }
  };

  const handleResolve = async (errorId: number) => {
    if (!window.confirm('Mark this error as resolved?')) {
      return;
    }

    try {
      setResolving(errorId);
      await api.errorLogs.markResolved(errorId, resolutionNotes);
      setResolutionNotes('');
      setSelectedError(null);
      loadErrorLogs();
      loadStats();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark error as resolved');
    } finally {
      setResolving(null);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getErrorTypeColor = (errorType: string): string => {
    if (errorType.includes("Exception") || errorType.includes("Error")) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Error Logs</h1>
        <p className="text-gray-600">
          View and manage application errors. All errors are automatically logged when they occur.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-sm text-gray-600">Total Errors</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalErrors}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-red-200">
            <div className="text-sm text-red-600">Unresolved</div>
            <div className="text-2xl font-bold text-red-600">{stats.unresolvedErrors}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-sm text-gray-600">Last 24 Hours</div>
            <div className="text-2xl font-bold text-gray-900">{stats.errorsLast24Hours}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-sm text-gray-600">Last 7 Days</div>
            <div className="text-2xl font-bold text-gray-900">{stats.errorsLast7Days}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showUnresolvedOnly}
                onChange={(e) => {
                  setShowUnresolvedOnly(e.target.checked);
                  setPage(1);
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Show unresolved only</span>
            </label>
          </div>
          <button
            onClick={() => {
              loadErrorLogs();
              loadStats();
            }}
            className="flex items-center px-3 py-1 text-sm rounded-md text-gray-700 hover:bg-gray-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Logs Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: themeColors.primary }}></div>
              <p className="mt-4 text-gray-600">Loading error logs...</p>
            </div>
          ) : errorLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No errors found.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {errorLogs.map((errorLog) => (
                  <tr key={errorLog.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {errorLog.isResolved ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Unresolved
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getErrorTypeColor(errorLog.errorType)}`}>
                        {errorLog.errorType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate" title={errorLog.message}>
                        {errorLog.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {errorLog.userEmail || errorLog.userId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{errorLog.requestMethod} {errorLog.requestPath}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(errorLog.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedError(errorLog)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!showUnresolvedOnly && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm rounded-md border disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={errorLogs.length < pageSize}
              className="px-3 py-1 text-sm rounded-md border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Error Details</h2>
                <button
                  onClick={() => {
                    setSelectedError(null);
                    setResolutionNotes('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Error Type</label>
                  <div className="mt-1 text-sm text-gray-900">{selectedError.errorType}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded border">{selectedError.message}</div>
                </div>

                {selectedError.stackTrace && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stack Trace</label>
                    <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-3 rounded border overflow-x-auto max-h-60">
                      {selectedError.stackTrace}
                    </pre>
                  </div>
                )}

                {selectedError.innerException && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Inner Exception</label>
                    <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-3 rounded border overflow-x-auto max-h-40">
                      {selectedError.innerException}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">User</label>
                    <div className="mt-1 text-sm text-gray-900">{selectedError.userEmail || selectedError.userId || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address</label>
                    <div className="mt-1 text-sm text-gray-900">{selectedError.ipAddress || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Request</label>
                    <div className="mt-1 text-sm text-gray-900">{selectedError.requestMethod} {selectedError.requestPath}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <div className="mt-1 text-sm text-gray-900">{formatDate(selectedError.createdAt)}</div>
                  </div>
                </div>

                {selectedError.requestBody && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Request Body</label>
                    <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-3 rounded border overflow-x-auto max-h-40">
                      {selectedError.requestBody}
                    </pre>
                  </div>
                )}

                {selectedError.additionalData && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Additional Data</label>
                    <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-3 rounded border overflow-x-auto max-h-40">
                      {selectedError.additionalData}
                    </pre>
                  </div>
                )}

                {!selectedError.isResolved && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Notes</label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Add notes about how this error was resolved..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      rows={3}
                    />
                    <button
                      onClick={() => handleResolve(selectedError.id)}
                      disabled={resolving === selectedError.id}
                      className="mt-2 px-4 py-2 rounded-md text-white text-sm font-medium"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      {resolving === selectedError.id ? 'Resolving...' : 'Mark as Resolved'}
                    </button>
                  </div>
                )}

                {selectedError.isResolved && (
                  <div className="border-t pt-4">
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="text-sm font-medium text-green-800">Resolved</div>
                      <div className="text-sm text-green-700 mt-1">
                        By: {selectedError.resolvedBy} on {selectedError.resolvedAt ? formatDate(selectedError.resolvedAt) : 'N/A'}
                      </div>
                      {selectedError.resolutionNotes && (
                        <div className="text-sm text-green-700 mt-2">
                          Notes: {selectedError.resolutionNotes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
