#!/usr/bin/env node

/**
 * Fix Maintenance Cycles for Study Sessions
 * Adds proper maintenance revisions for older sessions based on current date
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

// Generate all revision cycles including maintenance for a study session
const generateRevisionsWithMaintenance = (studyDate, currentDate = new Date()) => {
  const date = new Date(studyDate);
  const today = new Date(currentDate);

  // Initial 4 revisions (3, 7, 14, 30 days)
  const initialRevisions = [
    { days: 3, completed: false },
    { days: 7, completed: false },
    { days: 14, completed: false },
    { days: 30, completed: false }
  ];

  const revisions = initialRevisions.map((rev, index) => {
    const revisionDate = new Date(date);
    revisionDate.setDate(revisionDate.getDate() + rev.days);

    // Mark as completed if the revision date has passed
    const isCompleted = revisionDate < today;

    return {
      id: `rev-${index}`,
      date: revisionDate.toISOString().split('T')[0],
      cycle: `Day ${rev.days}`,
      completed: isCompleted
    };
  });

  // Add maintenance cycles (every 30 days after the 30-day revision)
  const lastInitialRevision = new Date(date);
  lastInitialRevision.setDate(lastInitialRevision.getDate() + 30);

  let maintenanceCounter = 1;
  let nextMaintenanceDate = new Date(lastInitialRevision);

  // Keep adding maintenance cycles until we reach the current date + some buffer
  while (nextMaintenanceDate < today) {
    nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + 30);

    const isCompleted = nextMaintenanceDate < today;

    revisions.push({
      id: `rev-${revisions.length}`,
      date: nextMaintenanceDate.toISOString().split('T')[0],
      cycle: 'Maintenance (30 days)',
      completed: isCompleted
    });

    maintenanceCounter++;
    nextMaintenanceDate = new Date(nextMaintenanceDate);
  }

  // Add one more future maintenance cycle
  nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + 30);
  revisions.push({
    id: `rev-${revisions.length}`,
    date: nextMaintenanceDate.toISOString().split('T')[0],
    cycle: 'Maintenance (30 days)',
    completed: false
  });

  return revisions;
};

async function fixMaintenanceCycles() {
  try {
    console.log('🔧 Fixing maintenance cycles for study sessions...\n');

    // Get current data from Firebase
    const userDocRef = doc(db, 'userData', 'default-user');
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.error('❌ No data found in Firebase');
      process.exit(1);
    }

    const userData = docSnap.data();
    const subjects = userData.subjects || [];
    const currentDate = new Date('2025-09-23'); // Use your current date

    console.log(`📅 Current date: ${currentDate.toISOString().split('T')[0]}`);
    console.log(`📚 Processing ${subjects.length} subjects...\n`);

    // Update each subject's study sessions with proper maintenance cycles
    const updatedSubjects = subjects.map(subject => {
      if (!subject.studySessions || subject.studySessions.length === 0) {
        return subject;
      }

      console.log(`📖 ${subject.name}: Updating ${subject.studySessions.length} sessions`);

      const updatedSessions = subject.studySessions.map(session => {
        const studyDate = session.studyDate;
        const daysSinceStudy = Math.floor((currentDate - new Date(studyDate)) / (1000 * 60 * 60 * 24));

        console.log(`   - ${session.chapterName} (${studyDate}) - ${daysSinceStudy} days ago`);

        // Generate revisions with maintenance cycles
        const newRevisions = generateRevisionsWithMaintenance(studyDate, currentDate);

        // Calculate last completed revision
        const completedRevisions = newRevisions.filter(r => r.completed);
        const lastRevisionCompleted = completedRevisions.length > 0 ? completedRevisions.length - 1 : -1;

        console.log(`     → ${newRevisions.length} total revisions (${completedRevisions.length} completed)`);

        return {
          ...session,
          revisions: newRevisions,
          lastRevisionCompleted
        };
      });

      return {
        ...subject,
        studySessions: updatedSessions
      };
    });

    // Update Firebase
    console.log('\n🔄 Updating Firebase with maintenance cycles...');
    await setDoc(userDocRef, {
      subjects: updatedSubjects,
      dismissedRevisions: userData.dismissedRevisions,
      lastUpdated: serverTimestamp()
    });

    console.log('✅ Maintenance cycles fixed successfully!\n');

    // Summary
    console.log('📊 Maintenance Cycles Summary:');
    updatedSubjects.forEach(subject => {
      if (subject.studySessions && subject.studySessions.length > 0) {
        console.log(`\n   ${subject.name}:`);
        subject.studySessions.forEach(session => {
          const completedCount = session.revisions.filter(r => r.completed).length;
          const totalCount = session.revisions.length;
          const nextRevision = session.revisions.find(r => !r.completed);

          console.log(`     - ${session.chapterName}: ${completedCount}/${totalCount} revisions completed`);
          if (nextRevision) {
            console.log(`       Next: ${nextRevision.cycle} on ${nextRevision.date}`);
          }
        });
      }
    });

    console.log('\n🎉 Your study sessions now have proper maintenance cycles!');
    console.log('📅 Check your calendar for upcoming revision reminders.');

  } catch (error) {
    console.error('❌ Failed to fix maintenance cycles:', error);
    process.exit(1);
  }
}

fixMaintenanceCycles();