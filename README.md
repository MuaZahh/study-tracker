# Study Tracker

## Automated Daily Backup (00:00 IST)

This repo uses a GitHub Actions workflow to create a daily backup at 00:00 IST (scheduled at 18:30 UTC).

Setup:
- In GitHub repo settings → Secrets and variables → Actions, add a secret named `GCP_SERVICE_ACCOUNT` containing your Firebase service account JSON.
- The workflow runs `scripts/daily-backup.mjs`, which uses Firebase Admin to write to Firestore.

Manual run:
```bash
node scripts/daily-backup.mjs
# Requires env GCP_SERVICE_ACCOUNT or GCP_SERVICE_ACCOUNT_PATH
```
