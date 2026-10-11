// Thin re-export so existing imports of estimateStorageUsage keep working.
// Persistence is now SQLite via the Node backend — see server/db.js.
export { estimateStorageUsage } from './api.js';
