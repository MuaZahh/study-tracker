import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { createBackup, createDailyBackupIfNeeded } from './backupService';

// Collection names
const COLLECTIONS = {
  USER_DATA: 'userData'
};

// User ID - for now using a fixed ID, but you can implement auth later
const USER_ID = 'default-user';

// Get user document reference
const getUserDocRef = () => doc(db, COLLECTIONS.USER_DATA, USER_ID);

// Save subjects to Firestore
export const saveSubjects = async (subjects) => {
  try {
    // Create backup before saving (if significant changes)
    const userDocRef = getUserDocRef();
    const currentDoc = await getDoc(userDocRef);

    if (currentDoc.exists()) {
      const currentData = currentDoc.data();
      const userData = {
        subjects: currentData.subjects || [],
        dismissedRevisions: new Set(currentData.dismissedRevisions || [])
      };

      // Create daily backup if needed
      await createDailyBackupIfNeeded(userData);

      // Manual backups are now handled by individual operations, no need for auto-backup here
    }

    await setDoc(userDocRef, {
      subjects,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    console.log('Subjects saved to Firebase');
  } catch (error) {
    console.error('Error saving subjects:', error);
    throw error;
  }
};

// Save dismissed revisions to Firestore
export const saveDismissedRevisions = async (dismissedRevisions) => {
  try {
    // Create backup before saving (if significant changes)
    const userDocRef = getUserDocRef();
    const currentDoc = await getDoc(userDocRef);

    if (currentDoc.exists()) {
      const currentData = currentDoc.data();
      const userData = {
        subjects: currentData.subjects || [],
        dismissedRevisions: new Set(currentData.dismissedRevisions || [])
      };

      // Create daily backup if needed
      await createDailyBackupIfNeeded(userData);
    }

    await setDoc(userDocRef, {
      dismissedRevisions: Array.from(dismissedRevisions),
      lastUpdated: serverTimestamp()
    }, { merge: true });
    console.log('Dismissed revisions saved to Firebase');
  } catch (error) {
    console.error('Error saving dismissed revisions:', error);
    throw error;
  }
};

// Load user data from Firestore
export const loadUserData = async () => {
  try {
    const userDocRef = getUserDocRef();
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        subjects: data.subjects || [],
        dismissedRevisions: new Set(data.dismissedRevisions || [])
      };
    } else {
      // Return empty data if document doesn't exist
      return {
        subjects: [],
        dismissedRevisions: new Set()
      };
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    throw error;
  }
};

// Set up real-time listener for user data
export const subscribeToUserData = (callback) => {
  const userDocRef = getUserDocRef();

  return onSnapshot(userDocRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback({
        subjects: data.subjects || [],
        dismissedRevisions: new Set(data.dismissedRevisions || [])
      });
    } else {
      callback({
        subjects: [],
        dismissedRevisions: new Set()
      });
    }
  }, (error) => {
    console.error('Error listening to user data:', error);
  });
};