#!/usr/bin/env node

/**
 * Simple Firebase Migration Script
 * This directly imports Firebase and uploads the localStorage data
 */

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Firebase config from your app
const firebaseConfig = {
  apiKey: "AIzaSyCikri5MQY7nW4xkuwoRRsoz8-TbSZGlv4",
  authDomain: "study-tracker-56d8c.firebaseapp.com",
  projectId: "study-tracker-56d8c",
  storageBucket: "study-tracker-56d8c.firebasestorage.app",
  messagingSenderId: "214027867172",
  appId: "1:214027867172:web:310114b6459717e132f4b1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  try {
    console.log('🚀 Starting localStorage to Firebase migration...\n');

    // Read migration data
    const migrationData = JSON.parse(
      readFileSync('./extracted-localStorage-data/firebase-migration-data.json', 'utf8')
    );

    console.log(`📊 Found ${migrationData.subjects.length} subjects:`);
    migrationData.subjects.forEach(subject => {
      console.log(`   - ${subject.name} (${subject.chapters.length} chapters)`);
    });
    console.log(`📋 Found ${migrationData.dismissedRevisions.length} dismissed revisions\n`);

    // Upload to Firebase
    console.log('🔄 Uploading to Firebase...');

    const userDocRef = doc(db, 'userData', 'default-user');
    await setDoc(userDocRef, {
      subjects: migrationData.subjects,
      dismissedRevisions: migrationData.dismissedRevisions,
      lastUpdated: serverTimestamp()
    });

    console.log('✅ Migration completed successfully!\n');

    console.log('📝 Migration Summary:');
    console.log(`   - Subjects: ${migrationData.subjects.length}`);
    console.log(`   - Total Chapters: ${migrationData.subjects.reduce((sum, s) => sum + s.chapters.length, 0)}`);
    console.log(`   - Dismissed Revisions: ${migrationData.dismissedRevisions.length}\n`);

    console.log('🎉 Your localStorage data is now in Firebase!');
    console.log('🔍 Open your study tracker app to verify the migration.');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();