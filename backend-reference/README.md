# Backend reference (NOT part of the app)

These files are **starting points** to merge into your EXISTING Firebase project. Do not deploy them
blindly: the website and Admin Portal already use this backend, and replacing its rules or functions
could break them. Read each file, compare with what is deployed, and merge.

| File | Purpose |
|---|---|
| `firestore.rules` | Read rules the mobile app needs, plus the small write surface it uses. |
| `firestore.indexes.json` | Composite indexes required by the paginated queries. |
| `functions/index.ts` | Cloud Functions that send push notifications when the Admin Portal publishes content or goes live. |
