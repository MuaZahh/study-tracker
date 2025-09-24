"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBackupIST = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
admin.initializeApp();
// Firestore paths
const USER_DOC_PATH = 'userData/default-user';
const BACKUPS_COLLECTION_PATH = 'userData/default-user/backups';
function generateBackupName(context, timestamp) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
    if (context.type === 'daily') {
        const istDate = context.description ? context.description.replace('Daily backup for ', '') : dateStr;
        return `Daily snapshot ${istDate}`;
    }
    return `Backup ${dateStr} at ${timeStr}`;
}
async function getTodayInIST() {
    const now = new Date();
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return istTime.toISOString().split('T')[0];
}
async function getCurrentUserData() {
    const snap = await admin.firestore().doc(USER_DOC_PATH).get();
    if (!snap.exists) {
        return { subjects: [], dismissedRevisions: [] };
    }
    const data = snap.data();
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
    return q.docs.map(d => (Object.assign({ id: d.id }, d.data())));
}
async function createBackup(userData, context = {}) {
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
    await admin.firestore().collection(BACKUPS_COLLECTION_PATH).doc(backupId).set(backupData);
    return backupId;
}
async function createDailyBackupIfNeededServer() {
    const todayIST = await getTodayInIST();
    const recent = await getBackupHistory(50);
    const todayBackup = recent.find(b => b.backupType === 'daily' && b.name && typeof b.name === 'string' && b.name.includes(`Daily snapshot ${todayIST}`));
    if (todayBackup)
        return null;
    const userData = await getCurrentUserData();
    if (!userData.subjects || userData.subjects.length === 0)
        return null;
    return await createBackup(userData, {
        type: 'daily',
        action: 'daily-snapshot',
        description: `Daily backup for ${todayIST}`
    });
}
// Runs every day at 18:30 UTC (which is 00:00 IST next day)
exports.dailyBackupIST = functions.pubsub.schedule('30 18 * * *')
    .timeZone('UTC')
    .onRun(async () => {
    await createDailyBackupIfNeededServer();
    return null;
});
//# sourceMappingURL=index.js.map