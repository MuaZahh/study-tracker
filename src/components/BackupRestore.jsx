import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Save,
  RotateCcw,
  Trash2,
  Calendar,
  Database,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw
} from 'lucide-react';
import {
  getBackupHistory,
  createBackup,
  deleteBackup,
  restoreFromBackup,
  exportBackupAsJson,
  importFromJson,
  cleanupOldBackups
} from '../services/backupService';
import { saveSubjects, saveDismissedRevisions } from '../services/firebaseService';

const BackupRestore = ({ userData, onDataRestored, onClose }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const backupHistory = await getBackupHistory();
      setBackups(backupHistory);
      setError('');
    } catch (err) {
      setError('Failed to load backup history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsOperationInProgress(true);
      setError('');
      const backupId = await createBackup(userData, {
        type: 'manual',
        action: 'manual-backup',
        description: 'Manual backup created by user'
      });
      setSuccess(`Backup created successfully: ${backupId}`);
      await loadBackups();
    } catch (err) {
      setError('Failed to create backup');
      console.error(err);
    } finally {
      setIsOperationInProgress(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    try {
      setIsOperationInProgress(true);
      setError('');

      const restoredData = await restoreFromBackup(
        backupId,
        saveSubjects,
        saveDismissedRevisions
      );

      setSuccess('Data restored successfully');
      setShowConfirmRestore(false);
      setSelectedBackup(null);

      // Notify parent component about data restoration
      if (onDataRestored) {
        onDataRestored(restoredData);
      }

      await loadBackups();
    } catch (err) {
      setError('Failed to restore backup');
      console.error(err);
    } finally {
      setIsOperationInProgress(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    try {
      setError('');
      await deleteBackup(backupId);
      setSuccess('Backup deleted successfully');
      await loadBackups();
    } catch (err) {
      setError('Failed to delete backup');
      console.error(err);
    }
  };

  const handleExportBackup = async (backupId) => {
    try {
      setError('');
      const jsonData = await exportBackupAsJson(backupId);

      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-tracker-backup-${backupId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Backup exported successfully');
    } catch (err) {
      setError('Failed to export backup');
      console.error(err);
    }
  };

  const handleImportJson = async () => {
    try {
      setIsOperationInProgress(true);
      setError('');

      const importedData = await importFromJson(
        importText,
        saveSubjects,
        saveDismissedRevisions
      );

      setSuccess('Data imported successfully');
      setShowImportModal(false);
      setImportText('');

      // Notify parent component about data restoration
      if (onDataRestored) {
        onDataRestored(importedData);
      }

      await loadBackups();
    } catch (err) {
      setError('Failed to import data: ' + err.message);
      console.error(err);
    } finally {
      setIsOperationInProgress(false);
    }
  };

  const handleCleanupOldBackups = async () => {
    try {
      setError('');
      const deletedCount = await cleanupOldBackups(10);
      setSuccess(`Cleaned up ${deletedCount} old backups`);
      await loadBackups();
    } catch (err) {
      setError('Failed to cleanup old backups');
      console.error(err);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getBackupTypeColor = (type) => {
    switch (type) {
      case 'manual': return 'bg-blue-100 text-blue-800';
      case 'auto': return 'bg-green-100 text-green-800';
      case 'pre-restore': return 'bg-yellow-100 text-yellow-800';
      case 'pre-import': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Backup & Restore</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center">
            <AlertCircle size={20} className="text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center">
            <CheckCircle size={20} className="text-green-600 mr-2" />
            <span className="text-green-700">{success}</span>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-green-400 hover:text-green-600"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleCreateBackup}
            disabled={isOperationInProgress}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            Create Backup
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            disabled={isOperationInProgress}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            Import JSON
          </button>

          <button
            onClick={handleCleanupOldBackups}
            disabled={isOperationInProgress}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Cleanup Old
          </button>

          <button
            onClick={loadBackups}
            disabled={loading}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Backup History */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Backup History</h3>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
              <p className="text-gray-500">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database size={48} className="mx-auto mb-2 opacity-50" />
              <p>No backups found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-800">{backup.name || backup.id}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBackupTypeColor(backup.backupType)}`}>
                          {backup.backupType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(backup.timestamp)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportBackup(backup.id)}
                        className="text-blue-500 hover:text-blue-700 p-2 transition-colors"
                        title="Export as JSON"
                      >
                        <Download size={16} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowConfirmRestore(true);
                        }}
                        className="text-green-500 hover:text-green-700 p-2 transition-colors"
                        title="Restore this backup"
                      >
                        <RotateCcw size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="text-red-500 hover:text-red-700 p-2 transition-colors"
                        title="Delete backup"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {backup.metadata && (
                    <div className="text-sm text-gray-600 flex gap-4">
                      <span>{backup.metadata.subjectCount} subjects</span>
                      <span>{backup.metadata.totalChapters} chapters</span>
                      <span>{backup.metadata.totalStudySessions} sessions</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restore Confirmation Modal */}
        {showConfirmRestore && selectedBackup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4 text-red-600">Confirm Restore</h3>
              <p className="text-gray-700 mb-4">
                Are you sure you want to restore from this backup? This will:
              </p>
              <ul className="list-disc pl-5 mb-4 text-gray-700 space-y-1">
                <li>Replace all current data</li>
                <li>Create a backup of current state first</li>
                <li>Cannot be easily undone</li>
              </ul>
              <p className="text-sm text-gray-600 mb-4">
                Backup: <strong>{selectedBackup.name || selectedBackup.id}</strong><br />
                Created: <strong>{formatDate(selectedBackup.timestamp)}</strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleRestoreBackup(selectedBackup.id)}
                  disabled={isOperationInProgress}
                  className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Yes, Restore
                </button>
                <button
                  onClick={() => {
                    setShowConfirmRestore(false);
                    setSelectedBackup(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import JSON Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
              <h3 className="text-xl font-semibold mb-4">Import from JSON</h3>
              <p className="text-gray-700 mb-4">
                Paste your backup JSON data below. This will replace all current data.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your backup JSON here..."
                className="w-full h-64 border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleImportJson}
                  disabled={!importText.trim() || isOperationInProgress}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  Import Data
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportText('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;