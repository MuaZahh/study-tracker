import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// Collection and document structure
const USER_ID = 'default-user';
const COLLECTIONS = {
  USER_DATA: 'userData',
  BACKUPS: 'backups'
};

// Get user document reference
const getUserDocRef = () => doc(db, COLLECTIONS.USER_DATA, USER_ID);

// Get backups collection reference
const getBackupsCollectionRef = () => collection(db, COLLECTIONS.USER_DATA, USER_ID, COLLECTIONS.BACKUPS);

/**
 * Create a backup of the current user data
 * @param {Object} userData - Current user data to backup
 * @param {Object} context - Backup context information
 * @param {string} context.type - Type of backup (daily, safety, change, manual)
 * @param {string} context.action - Action being performed (add-subject, delete-chapter, etc.)
 * @param {string} context.target - Target of the action (subject name, chapter name, etc.)
 * @param {string} context.description - Human-readable description
 * @returns {Promise<string>} Backup ID
 */
export const createBackup = async (userData, context = {}) => {
  try {
    const timestamp = new Date().toISOString();
    const backupId = `backup_${Date.now()}`;

    // Generate descriptive backup name
    const backupName = generateBackupName(context, timestamp);

    const backupData = {
      id: backupId,
      name: backupName,
      timestamp,
      backupType: context.type || 'manual',
      action: context.action || 'manual-backup',
      target: context.target || null,
      description: context.description || backupName,
      data: {
        subjects: userData.subjects || [],
        dismissedRevisions: Array.from(userData.dismissedRevisions || [])
      },
      metadata: {
        subjectCount: userData.subjects?.length || 0,
        totalChapters: userData.subjects?.reduce((total, subject) => total + (subject.chapters?.length || 0), 0) || 0,
        totalStudySessions: userData.subjects?.reduce((total, subject) => total + (subject.studySessions?.length || 0), 0) || 0
      },
      createdAt: serverTimestamp()
    };

    const backupDocRef = doc(getBackupsCollectionRef(), backupId);
    await setDoc(backupDocRef, backupData);

    console.log(`Backup created: ${backupName} (${backupId})`);
    return backupId;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

/**
 * Sanitize string for use in backup names - keeps proper case and underscores
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum length (default 25)
 * @returns {string} Sanitized string
 */
const sanitizeForBackupName = (str, maxLength = 25) => {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, maxLength); // Truncate to max length
};

/**
 * Generate descriptive backup name based on context
 * @param {Object} context - Backup context
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Descriptive backup name
 */
const generateBackupName = (context, timestamp) => {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = date.toTimeString().slice(0, 5).replace(':', ''); // HHMM

  if (context.type === 'daily') {
    return `Daily snapshot ${dateStr}`;
  }

  if (context.type === 'safety') {
    if (context.action === 'pre-restore') {
      const targetName = context.target ? ` from ${sanitizeForBackupName(context.target, 20)}` : '';
      return `Safety backup before restore${targetName}`;
    }
    if (context.action === 'pre-import') {
      return `Safety backup before import on ${dateStr} at ${timeStr}`;
    }
    return `Safety backup ${dateStr} at ${timeStr}`;
  }

  if (context.type === 'change') {
    const target = context.target ? sanitizeForBackupName(context.target, 15) : '';
    const subject = context.subject ? sanitizeForBackupName(context.subject, 12) : '';

    switch (context.action) {
      // Subject Operations
      case 'add-subject':
        return `Before adding subject ${target}`;
      case 'delete-subject':
        return `Before deleting subject ${target}`;
      case 'rename-subject': {
        const newTarget = context.newTarget ? sanitizeForBackupName(context.newTarget, 20) : '';
        return `Before renaming subject ${target} to ${newTarget}`;
      }

      // Chapter Operations
      case 'add-chapter':
        return `Before adding chapter ${target}${subject ? ` to ${subject}` : ''}`;
      case 'delete-chapter':
        return `Before deleting chapter ${target}${subject ? ` from ${subject}` : ''}`;
      case 'rename-chapter': {
        const newChapter = context.newTarget ? sanitizeForBackupName(context.newTarget, 20) : '';
        return `Before renaming chapter ${target} to ${newChapter}${subject ? ` in ${subject}` : ''}`;
      }
      case 'reorder-chapters':
        return `Before reordering chapters${subject ? ` in ${subject}` : ''}`;
      case 'complete-chapter':
        return `Before completing chapter ${target}${subject ? ` in ${subject}` : ''}`;
      case 'incomplete-chapter':
        return `Before marking incomplete ${target}${subject ? ` in ${subject}` : ''}`;

      // Study Session Operations
      case 'add-study-session': {
        const sessionDate = context.date ? context.date : dateStr;
        return `Before adding study session ${target} on ${sessionDate}${subject ? ` for ${subject}` : ''}`;
      }
      case 'delete-study-session': {
        const deleteDate = context.date ? context.date : dateStr;
        return `Before deleting study session ${target} from ${deleteDate}${subject ? ` in ${subject}` : ''}`;
      }
      case 'edit-study-session':
        return `Before editing study session ${target}${subject ? ` in ${subject}` : ''}`;

      // Past Paper Operations
      case 'add-paper': {
        const paperInfo = context.paperInfo || {};
        const paperStr = `${paperInfo.session || 'XX'} ${paperInfo.year || 'XXXX'} Paper ${paperInfo.paperNumber || 'X'}`;
        return `Before adding paper ${paperStr}${subject ? ` for ${subject}` : ''}`;
      }
      case 'delete-paper': {
        const delPaperInfo = context.paperInfo || {};
        const delPaperStr = `${delPaperInfo.session || 'XX'} ${delPaperInfo.year || 'XXXX'} Paper ${delPaperInfo.paperNumber || 'X'}`;
        return `Before deleting paper ${delPaperStr}${subject ? ` from ${subject}` : ''}`;
      }
      case 'edit-paper': {
        const editPaperInfo = context.paperInfo || {};
        const editPaperStr = `${editPaperInfo.session || 'XX'} ${editPaperInfo.year || 'XXXX'} Paper ${editPaperInfo.paperNumber || 'X'}`;
        return `Before editing paper ${editPaperStr}${subject ? ` in ${subject}` : ''}`;
      }

      // Revision Operations
      case 'complete-revision': {
        const cycle = context.cycle ? sanitizeForBackupName(context.cycle, 15) : 'revision';
        return `Before completing revision ${target} ${cycle}${subject ? ` for ${subject}` : ''}`;
      }
      case 'reset-revision': {
        const resetCycle = context.cycle ? sanitizeForBackupName(context.cycle, 15) : 'revision';
        return `Before resetting revision ${target} ${resetCycle}${subject ? ` in ${subject}` : ''}`;
      }
      case 'dismiss-overdue':
        return `Before dismissing overdue revisions${subject ? ` for ${subject}` : ''}`;

      // Bulk Operations
      case 'bulk-delete-chapters':
        return `Before bulk deleting chapters${subject ? ` in ${subject}` : ''}`;
      case 'bulk-complete-chapters':
        return `Before bulk completing chapters${subject ? ` in ${subject}` : ''}`;
      case 'clear-all-revisions':
        return `Before clearing all revisions${subject ? ` in ${subject}` : ''}`;
      case 'reset-subject-progress':
        return `Before resetting progress${subject ? ` for ${subject}` : ''}`;

      // Import/Export Operations
      case 'merge-data': {
        const source = context.source ? sanitizeForBackupName(context.source, 15) : 'external';
        return `Before merging data from ${source}`;
      }

      // Maintenance Operations
      case 'cleanup-old-sessions':
        return `Before cleaning up old sessions${subject ? ` in ${subject}` : ''}`;
      case 'archive-completed':
        return `Before archiving completed chapters${subject ? ` in ${subject}` : ''}`;
      case 'reset-all-data':
        return `Before resetting all data`;

      // Generic operations
      default:
        return `Before ${context.action}${target ? ` ${target}` : ''}${subject ? ` in ${subject}` : ''}`;
    }
  }

  if (context.type === 'manual') {
    if (context.description) {
      const desc = sanitizeForBackupName(context.description, 30);
      return `Manual backup: ${desc} on ${dateStr} at ${timeStr}`;
    }
    return `Manual checkpoint ${dateStr} at ${timeStr}`;
  }

  if (context.type === 'auto') {
    return `Auto backup on significant changes ${dateStr} at ${timeStr}`;
  }

  // Fallback
  return `Backup ${dateStr} at ${timeStr}`;
};

/**
 * Get all backups for the user, ordered by timestamp (newest first)
 * @param {number} limitCount - Maximum number of backups to fetch
 * @returns {Promise<Array>} Array of backup objects
 */
export const getBackupHistory = async (limitCount = 50) => {
  try {
    const backupsRef = getBackupsCollectionRef();
    const q = query(backupsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);

    const backups = [];
    querySnapshot.forEach((doc) => {
      backups.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return backups;
  } catch (error) {
    console.error('Error fetching backup history:', error);
    throw error;
  }
};

/**
 * Get a specific backup by ID
 * @param {string} backupId - The backup ID to retrieve
 * @returns {Promise<Object|null>} Backup data or null if not found
 */
export const getBackup = async (backupId) => {
  try {
    const backupDocRef = doc(getBackupsCollectionRef(), backupId);
    const docSnap = await getDoc(backupDocRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching backup:', error);
    throw error;
  }
};

/**
 * Restore data from a backup
 * @param {string} backupId - The backup ID to restore from
 * @param {Function} saveSubjectsCallback - Callback to save subjects
 * @param {Function} saveDismissedRevisionsCallback - Callback to save dismissed revisions
 * @returns {Promise<Object>} Restored data
 */
export const restoreFromBackup = async (backupId, saveSubjectsCallback, saveDismissedRevisionsCallback) => {
  try {
    // Get the backup data
    const backup = await getBackup(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const { data } = backup;

    // Create a backup of current state before restoring
    const currentUserData = await getCurrentUserData();
    await createBackup(currentUserData, {
      type: 'safety',
      action: 'pre-restore',
      target: backup.name || backupId,
      description: `Safety backup before restoring from ${backup.name || backupId}`
    });

    // Restore the data using the provided callbacks
    if (data.subjects) {
      await saveSubjectsCallback(data.subjects);
    }

    if (data.dismissedRevisions) {
      await saveDismissedRevisionsCallback(new Set(data.dismissedRevisions));
    }

    console.log(`Data restored from backup: ${backup.name || backupId}`);
    return data;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw error;
  }
};

/**
 * Delete a backup
 * @param {string} backupId - The backup ID to delete
 * @returns {Promise<void>}
 */
export const deleteBackup = async (backupId) => {
  try {
    const backupDocRef = doc(getBackupsCollectionRef(), backupId);
    await deleteDoc(backupDocRef);
    console.log(`Backup deleted: ${backupId}`);
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw error;
  }
};

/**
 * Clean up old backups, keeping only the most recent ones
 * @param {number} keepCount - Number of backups to keep
 * @returns {Promise<number>} Number of backups deleted
 */
export const cleanupOldBackups = async (keepCount = 10) => {
  try {
    const allBackups = await getBackupHistory();
    if (allBackups.length <= keepCount) {
      return 0;
    }

    const backupsToDelete = allBackups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      await deleteBackup(backup.id);
      deletedCount++;
    }

    console.log(`Cleaned up ${deletedCount} old backups`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    throw error;
  }
};

// Track ongoing daily backup creation to prevent race conditions
let dailyBackupInProgress = null;

/**
 * Create an automatic daily backup if one doesn't exist for today
 * @param {Object} userData - Current user data
 * @returns {Promise<string|null>} Backup ID if created, null if already exists
 */
export const createDailyBackupIfNeeded = async (userData) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // If a daily backup is already in progress for today, wait for it to complete
    if (dailyBackupInProgress && dailyBackupInProgress.date === today) {
      return await dailyBackupInProgress.promise;
    }

    const recentBackups = await getBackupHistory(10); // Check more backups to be sure

    // Check if we already have a daily backup for today
    const todayBackup = recentBackups.find(backup =>
      backup.timestamp.startsWith(today) && backup.backupType === 'daily'
    );

    if (todayBackup) {
      return null; // Daily backup already exists for today
    }

    // Create a promise to track the daily backup creation
    const backupPromise = createBackup(userData, {
      type: 'daily',
      action: 'daily-snapshot',
      description: `Daily backup for ${today}`
    }).finally(() => {
      // Clear the in-progress tracker when done
      if (dailyBackupInProgress && dailyBackupInProgress.date === today) {
        dailyBackupInProgress = null;
      }
    });

    // Track this backup creation to prevent concurrent duplicates
    dailyBackupInProgress = {
      date: today,
      promise: backupPromise
    };

    return await backupPromise;
  } catch (error) {
    console.error('Error creating daily backup:', error);
    // Clear the in-progress tracker on error
    if (dailyBackupInProgress) {
      dailyBackupInProgress = null;
    }
    throw error;
  }
};

/**
 * Get current user data from Firestore
 * @returns {Promise<Object>} Current user data
 */
const getCurrentUserData = async () => {
  try {
    const userDocRef = getUserDocRef();
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        subjects: data.subjects || [],
        dismissedRevisions: new Set(data.dismissedRevisions || [])
      };
    }

    return {
      subjects: [],
      dismissedRevisions: new Set()
    };
  } catch (error) {
    console.error('Error getting current user data:', error);
    throw error;
  }
};

/**
 * Export backup data as JSON for download
 * @param {string} backupId - The backup ID to export
 * @returns {Promise<string>} JSON string of backup data
 */
export const exportBackupAsJson = async (backupId) => {
  try {
    const backup = await getBackup(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Error exporting backup as JSON:', error);
    throw error;
  }
};

/**
 * Import and restore data from JSON
 * @param {string} jsonString - JSON string containing backup data
 * @param {Function} saveSubjectsCallback - Callback to save subjects
 * @param {Function} saveDismissedRevisionsCallback - Callback to save dismissed revisions
 * @returns {Promise<Object>} Imported data
 */
export const importFromJson = async (jsonString, saveSubjectsCallback, saveDismissedRevisionsCallback) => {
  try {
    const importData = JSON.parse(jsonString);

    // Validate the JSON structure
    if (!importData.data || (!importData.data.subjects && !importData.data.dismissedRevisions)) {
      throw new Error('Invalid backup file format');
    }

    // Create a backup of current state before importing
    const currentUserData = await getCurrentUserData();
    await createBackup(currentUserData, {
      type: 'safety',
      action: 'pre-import',
      description: 'Safety backup before importing JSON data'
    });

    const { data } = importData;

    // Import the data
    if (data.subjects) {
      await saveSubjectsCallback(data.subjects);
    }

    if (data.dismissedRevisions) {
      await saveDismissedRevisionsCallback(new Set(data.dismissedRevisions));
    }

    console.log('Data imported from JSON');
    return data;
  } catch (error) {
    console.error('Error importing from JSON:', error);
    throw error;
  }
};