#!/usr/bin/env node

/**
 * Implement Automatic Maintenance Mode
 * Creates infinite maintenance cycles automatically when study sessions are created
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

// Generate infinite maintenance cycles automatically
const generateInfiniteMaintenanceCycles = (studyDate, yearsAhead = 5) => {
  const date = new Date(studyDate);
  const revisions = [];

  // Initial 4 revisions (3, 7, 14, 30 days)
  const initialRevisions = [
    { days: 3, cycle: 'Day 3' },
    { days: 7, cycle: 'Day 7' },
    { days: 14, cycle: 'Day 14' },
    { days: 30, cycle: 'Day 30' }
  ];

  // Add initial revisions
  initialRevisions.forEach((rev, index) => {
    const revisionDate = new Date(date);
    revisionDate.setDate(revisionDate.getDate() + rev.days);

    revisions.push({
      id: `rev-${index}`,
      date: revisionDate.toISOString().split('T')[0],
      cycle: rev.cycle,
      completed: false
    });
  });

  // Add infinite maintenance cycles (every 30 days after Day 30)
  let maintenanceDate = new Date(date);
  maintenanceDate.setDate(maintenanceDate.getDate() + 30); // Start after Day 30

  // Generate maintenance cycles for the next few years
  const endDate = new Date(date);
  endDate.setFullYear(endDate.getFullYear() + yearsAhead);

  let cycleCount = 1;
  while (maintenanceDate <= endDate) {
    maintenanceDate.setDate(maintenanceDate.getDate() + 30); // Every 30 days

    revisions.push({
      id: `rev-${revisions.length}`,
      date: maintenanceDate.toISOString().split('T')[0],
      cycle: 'Maintenance (30 days)',
      completed: false
    });

    cycleCount++;
    maintenanceDate = new Date(maintenanceDate);
  }

  return revisions;
};

async function implementAutoMaintenance() {
  try {
    console.log('🔄 Implementing automatic infinite maintenance mode...\n');

    // Get current data
    const userDocRef = doc(db, 'userData', 'default-user');
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.error('❌ No data found');
      process.exit(1);
    }

    const userData = docSnap.data();
    const subjects = userData.subjects || [];

    console.log('🎯 Generating infinite maintenance cycles for all study sessions...\n');

    const updatedSubjects = subjects.map(subject => {
      if (!subject.studySessions || subject.studySessions.length === 0) {
        return subject;
      }

      console.log(`📖 ${subject.name}: Processing ${subject.studySessions.length} sessions`);

      const updatedSessions = subject.studySessions.map(session => {
        const studyDate = session.studyDate;

        // Generate infinite maintenance cycles
        const infiniteRevisions = generateInfiniteMaintenanceCycles(studyDate);

        console.log(`   - ${session.chapterName} (${studyDate})`);
        console.log(`     → Generated ${infiniteRevisions.length} total revisions (4 initial + ${infiniteRevisions.length - 4} maintenance)`);

        // Find the last maintenance cycle date
        const lastMaintenanceDate = infiniteRevisions[infiniteRevisions.length - 1].date;
        console.log(`     → Maintenance cycles until: ${lastMaintenanceDate}`);

        return {
          ...session,
          revisions: infiniteRevisions,
          lastRevisionCompleted: -1 // Start fresh
        };
      });

      return {
        ...subject,
        studySessions: updatedSessions
      };
    });

    // Update Firebase
    console.log('\n🔄 Updating Firebase with infinite maintenance cycles...');
    await setDoc(userDocRef, {
      subjects: updatedSubjects,
      dismissedRevisions: userData.dismissedRevisions,
      lastUpdated: serverTimestamp()
    });

    console.log('✅ Automatic infinite maintenance mode implemented!\n');

    // Summary
    console.log('📊 Infinite Maintenance Mode Summary:');
    let totalSessions = 0;
    let totalRevisions = 0;

    updatedSubjects.forEach(subject => {
      if (subject.studySessions && subject.studySessions.length > 0) {
        console.log(`\n   ${subject.name}:`);
        subject.studySessions.forEach(session => {
          const maintenanceCycles = session.revisions.filter(r => r.cycle.includes('Maintenance')).length;
          console.log(`     - ${session.chapterName}: ${session.revisions.length} total revisions (${maintenanceCycles} maintenance)`);
          totalRevisions += session.revisions.length;
        });
        totalSessions += subject.studySessions.length;
      }
    });

    console.log(`\n   📈 Total: ${totalSessions} sessions with ${totalRevisions} scheduled revisions`);
    console.log('\n🎉 Maintenance mode is now fully automatic!');
    console.log('🔄 Every study session now has infinite 30-day maintenance cycles pre-generated');
    console.log('📅 No manual completion required - cycles are automatic and infinite');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

implementAutoMaintenance();