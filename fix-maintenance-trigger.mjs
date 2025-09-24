#!/usr/bin/env node

/**
 * Fix Maintenance Mode Trigger
 * Sets up sessions so they properly trigger maintenance mode when completing revisions
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCikri5MQY7nW4xkuwoRRsoz8-TbSZGlv4",
  authDomain: "study-tracker-56d8c.firebaseapp.com",
  projectId: "study-tracker-56d8c",
  storageBucket: "study-tracker-56d8c.firebasestorage.app",
  messagingSenderId: "214027867172",
  appId: "1:214027867172:web:310114b6459717e132f4b1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Create proper revision cycles that will trigger maintenance mode
const createProperRevisions = (studyDate, currentDate = new Date()) => {
  const date = new Date(studyDate);
  const today = new Date(currentDate);

  // Initial 4 revisions only (3, 7, 14, 30 days)
  const initialRevisions = [
    { days: 3, completed: false },
    { days: 7, completed: false },
    { days: 14, completed: false },
    { days: 30, completed: false }
  ];

  const revisions = initialRevisions.map((rev, index) => {
    const revisionDate = new Date(date);
    revisionDate.setDate(revisionDate.getDate() + rev.days);

    // Mark as completed if the revision date has passed, BUT leave the last one incomplete
    // so that when user completes it, maintenance mode triggers
    const daysSinceRevision = Math.floor((today - revisionDate) / (1000 * 60 * 60 * 24));
    const isCompleted = daysSinceRevision > 0 && index < 3; // Complete first 3, leave 4th for user

    return {
      id: `rev-${index}`,
      date: revisionDate.toISOString().split('T')[0],
      cycle: `Day ${rev.days}`,
      completed: isCompleted
    };
  });

  // Calculate last completed revision index
  const completedCount = revisions.filter(r => r.completed).length;
  const lastRevisionCompleted = completedCount > 0 ? completedCount - 1 : -1;

  return { revisions, lastRevisionCompleted };
};

async function fixMaintenanceTrigger() {
  try {
    console.log('🔧 Fixing maintenance mode trigger...\n');

    // Get current data
    const userDocRef = doc(db, 'userData', 'default-user');
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.error('❌ No data found');
      process.exit(1);
    }

    const userData = docSnap.data();
    const subjects = userData.subjects || [];
    const currentDate = new Date('2025-09-23');

    console.log('🎯 Setting up sessions to trigger maintenance mode properly...\n');

    const updatedSubjects = subjects.map(subject => {
      if (!subject.studySessions || subject.studySessions.length === 0) {
        return subject;
      }

      console.log(`📖 ${subject.name}: Fixing ${subject.studySessions.length} sessions`);

      const updatedSessions = subject.studySessions.map(session => {
        const studyDate = session.studyDate;
        const daysSinceStudy = Math.floor((currentDate - new Date(studyDate)) / (1000 * 60 * 60 * 24));

        // Create proper revision structure
        const { revisions, lastRevisionCompleted } = createProperRevisions(studyDate, currentDate);

        console.log(`   - ${session.chapterName} (${studyDate}) - ${daysSinceStudy} days ago`);
        console.log(`     → ${revisions.length} revisions, ${revisions.filter(r => r.completed).length} completed`);

        const nextRevision = revisions.find(r => !r.completed);
        if (nextRevision) {
          console.log(`     → Next: ${nextRevision.cycle} on ${nextRevision.date}`);

          // Check if this will trigger maintenance mode
          const isLastRevision = revisions.indexOf(nextRevision) === revisions.length - 1;
          if (isLastRevision) {
            console.log(`     🔥 READY FOR MAINTENANCE MODE! Complete this revision to trigger infinite cycle.`);
          }
        }

        return {
          ...session,
          revisions,
          lastRevisionCompleted
        };
      });

      return {
        ...subject,
        studySessions: updatedSessions
      };
    });

    // Update Firebase
    console.log('\n🔄 Updating Firebase...');
    await setDoc(userDocRef, {
      subjects: updatedSubjects,
      dismissedRevisions: userData.dismissedRevisions,
      lastUpdated: serverTimestamp()
    });

    console.log('✅ Maintenance mode trigger fixed!\n');

    // Show status
    console.log('🎯 Maintenance Mode Status:');
    updatedSubjects.forEach(subject => {
      if (subject.studySessions && subject.studySessions.length > 0) {
        console.log(`\n   ${subject.name}:`);
        subject.studySessions.forEach(session => {
          const completedCount = session.revisions.filter(r => r.completed).length;
          const totalCount = session.revisions.length;
          const nextRevision = session.revisions.find(r => !r.completed);
          const isReadyForMaintenance = nextRevision &&
            session.revisions.indexOf(nextRevision) === session.revisions.length - 1;

          console.log(`     - ${session.chapterName}: ${completedCount}/${totalCount} completed`);
          if (nextRevision) {
            console.log(`       Next: ${nextRevision.cycle} (${nextRevision.date})`);
            if (isReadyForMaintenance) {
              console.log(`       🔥 MAINTENANCE READY: Complete this to enter infinite cycle!`);
            }
          }
        });
      }
    });

    console.log('\n🚀 Instructions:');
    console.log('   1. Open your study tracker app');
    console.log('   2. Find sessions marked "MAINTENANCE READY"');
    console.log('   3. Complete the last revision (Day 30)');
    console.log('   4. A new "Maintenance (30 days)" revision will auto-appear');
    console.log('   5. Complete that, and another will appear - infinite cycle!');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

fixMaintenanceTrigger();