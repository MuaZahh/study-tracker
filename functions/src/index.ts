import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

// Firestore paths
const USER_DOC_PATH = 'userData/default-user';
const BACKUPS_COLLECTION_PATH = 'userData/default-user/backups';

type BackupContext = {
  type?: string;
  action?: string;
  target?: string | null;
  description?: string | null;
};

function generateBackupName(context: BackupContext, timestamp: string): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().slice(0, 5).replace(':', '');

  if (context.type === 'daily') {
    const istDate = context.description ? context.description.replace('Daily backup for ', '') : dateStr;
    return `Daily snapshot ${istDate}`;
  }
  return `Backup ${dateStr} at ${timeStr}`;
}

async function getTodayInIST(): Promise<string> {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().split('T')[0];
}

async function getCurrentUserData() {
  const snap = await admin.firestore().doc(USER_DOC_PATH).get();
  if (!snap.exists) {
    return { subjects: [], dismissedRevisions: [] as string[] };
  }
  const data = snap.data() as any;
  return {
    subjects: data.subjects || [],
    dismissedRevisions: data.dismissedRevisions || []
  };
}

async function getBackupHistory(limitCount = 50) {
  const ref = admin.firestore().collection(BACKUPS_COLLECTION_PATH)
    .orderBy('timestamp', 'desc')
    .limit(limitCount);
  const q = await ref.get();
  return q.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

async function createBackup(userData: any, context: BackupContext = {}) {
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
      totalChapters: (userData.subjects || []).reduce((t: number, s: any) => t + ((s.chapters || []).length), 0),
      totalStudySessions: (userData.subjects || []).reduce((t: number, s: any) => t + ((s.studySessions || []).length), 0)
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await admin.firestore().collection(BACKUPS_COLLECTION_PATH).doc(backupId).set(backupData);
  return backupId;
}

async function createDailyBackupIfNeededServer() {
  const todayIST = await getTodayInIST();
  const recent = await getBackupHistory(50);
  const todayBackup = recent.find(b => b.backupType === 'daily' && b.name && typeof b.name === 'string' && b.name.includes(`Daily snapshot ${todayIST}`));
  if (todayBackup) return null;

  const userData = await getCurrentUserData();
  if (!userData.subjects || userData.subjects.length === 0) return null;

  return await createBackup(userData, {
    type: 'daily',
    action: 'daily-snapshot',
    description: `Daily backup for ${todayIST}`
  });
}

// Runs every day at 18:30 UTC (which is 00:00 IST next day)
export const dailyBackupIST = functions.pubsub.schedule('30 18 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    await createDailyBackupIfNeededServer();
    return null;
  });


