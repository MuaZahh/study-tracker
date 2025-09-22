import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Collection names
const COLLECTIONS = {
  SUBJECTS: 'subjects',
  USER_DATA: 'userData'
};

// User ID - for now using a fixed ID, but you can implement auth later
const USER_ID = 'default-user';

// Get user document reference
const getUserDocRef = () => doc(db, COLLECTIONS.USER_DATA, USER_ID);

// Save subjects to Firestore
export const saveSubjects = async (subjects) => {
  try {
    const userDocRef = getUserDocRef();
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
    const userDocRef = getUserDocRef();
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