#!/usr/bin/env node

/**
 * Migration Script: localStorage to Firebase
 *
 * This script migrates the extracted localStorage data to Firebase Firestore.
 * It uses the existing Firebase service functions from your app.
 *
 * Usage: node migrate-localStorage-data.js
 */

import { readFileSync } from 'fs';
import { saveSubjects, saveDismissedRevisions } from './src/services/firebaseService.js';

async function migrateData() {
  try {
    console.log('🚀 Starting localStorage to Firebase migration...\n');

    // Read the formatted migration data
    const migrationDataPath = './extracted-localStorage-data/firebase-migration-data.json';
    console.log(`📖 Reading migration data from: ${migrationDataPath}`);

    const migrationData = JSON.parse(readFileSync(migrationDataPath, 'utf8'));

    console.log(`📊 Found ${migrationData.subjects.length} subjects to migrate:`);
    migrationData.subjects.forEach(subject => {
      console.log(`   - ${subject.name} (${subject.chapters.length} chapters)`);
    });

    console.log(`📋 Found ${migrationData.dismissedRevisions.length} dismissed revisions to migrate\n`);

    // Migrate subjects
    console.log('🔄 Migrating subjects to Firebase...');
    await saveSubjects(migrationData.subjects);
    console.log('✅ Subjects migrated successfully');

    // Migrate dismissed revisions
    console.log('🔄 Migrating dismissed revisions to Firebase...');
    await saveDismissedRevisions(migrationData.dismissedRevisions);
    console.log('✅ Dismissed revisions migrated successfully');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Migration Summary:');
    console.log(`   - Subjects: ${migrationData.subjects.length}`);
    console.log(`   - Total Chapters: ${migrationData.subjects.reduce((sum, s) => sum + s.chapters.length, 0)}`);
    console.log(`   - Dismissed Revisions: ${migrationData.dismissedRevisions.length}`);

    console.log('\n🔍 Next Steps:');
    console.log('   1. Open your study tracker app');
    console.log('   2. Verify all subjects and chapters are loaded');
    console.log('   3. Check that dismissed revisions are preserved');
    console.log('   4. Test adding new study sessions');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure Firebase credentials are correct');
    console.error('   2. Check internet connection');
    console.error('   3. Verify Firebase rules allow writes');
    console.error('   4. Ensure the migration data file exists');
    process.exit(1);
  }
}

// Add package.json type check
console.log('🔍 Checking if this is an ES Module project...');
try {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
  if (packageJson.type !== 'module') {
    console.log('⚠️  This project is not configured as ES Module.');
    console.log('💡 To run this migration script:');
    console.log('   1. Add "type": "module" to package.json, OR');
    console.log('   2. Rename this file to migrate-localStorage-data.mjs, OR');
    console.log('   3. Use the manual migration method instead');
    console.log('\n📋 Manual Migration Steps:');
    console.log('   1. Copy the data from firebase-migration-data.json');
    console.log('   2. Open Firebase Console');
    console.log('   3. Navigate to Firestore Database');
    console.log('   4. Create/update the userData/default-user document');
    console.log('   5. Paste the subjects and dismissedRevisions arrays');
    process.exit(0);
  }
} catch (error) {
  console.log('⚠️  Could not read package.json');
}

// Run migration
migrateData();