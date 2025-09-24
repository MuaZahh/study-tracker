#!/usr/bin/env node

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Service account JSON should be provided via env var GCP_SERVICE_ACCOUNT (stringified JSON)
// or path via GCP_SERVICE_ACCOUNT_PATH
function initAdmin() {
  const jsonFromEnv = process.env.GCP_SERVICE_ACCOUNT;
  const jsonPath = process.env.GCP_SERVICE_ACCOUNT_PATH;
  let credentials;
  if (jsonFromEnv) {
    credentials = JSON.parse(jsonFromEnv);
  } else if (jsonPath) {
    credentials = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } else {
    throw new Error('Missing GCP service account. Set GCP_SERVICE_ACCOUNT or GCP_SERVICE_ACCOUNT_PATH');
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
  }
}

const USER_DOC_PATH = 'userData/default-user';
const BACKUPS_COLLECTION_PATH = 'userData/default-user/backups';

function generateBackupName(context, timestamp) {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0];
  if (context?.type === 'daily') {
    const istDate = context.description ? context.description.replace('Daily backup for ', '') : dateStr;
    return `Daily snapshot ${istDate}`;
  }
  return `Backup ${dateStr}`;
}

function getTodayInIST() {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().split('T')[0];
}

async function getCurrentUserData(db) {
  const snap = await db.doc(USER_DOC_PATH).get();
  if (!snap.exists) return { subjects: [], dismissedRevisions: [] };
  const data = snap.data();
  return {
    subjects: data.subjects || [],
    dismissedRevisions: data.dismissedRevisions || []
  };
}

async function getBackupHistory(db, limitCount = 50) {
  const q = await db.collection(BACKUPS_COLLECTION_PATH)
    .orderBy('timestamp', 'desc')
    .limit(limitCount)
    .get();
  return q.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createBackup(db, userData, context = {}) {
  const timestamp = new Date().toISOString();
  const backupId = `backup_${Date.now()}`;
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
      subjectCount: (userData.subjects || []).length,
      totalChapters: (userData.subjects || []).reduce((t, s) => t + ((s.chapters || []).length), 0),
      totalStudySessions: (userData.subjects || []).reduce((t, s) => t + ((s.studySessions || []).length), 0)
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection(BACKUPS_COLLECTION_PATH).doc(backupId).set(backupData);
  return backupId;
}

async function run() {
  initAdmin();
  const db = admin.firestore();
  const todayIST = getTodayInIST();
  const recent = await getBackupHistory(db, 50);
  const existing = recent.find(b => b.backupType === 'daily' && typeof b.name === 'string' && b.name.includes(`Daily snapshot ${todayIST}`));
  if (existing) {
    console.log(`[DAILY BACKUP] Already exists for ${todayIST}: ${existing.name}`);
    return;
  }

  const userData = await getCurrentUserData(db);
  if (!userData.subjects || userData.subjects.length === 0) {
    console.log('[DAILY BACKUP] No subjects found; skipping');
    return;
  }

  const id = await createBackup(db, userData, {
    type: 'daily',
    action: 'daily-snapshot',
    description: `Daily backup for ${todayIST}`
  });
  console.log(`[DAILY BACKUP] Created ${id}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


