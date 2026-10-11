import { api } from './api.js';

export function runCsvAudit(fileName, csvText, mode = 'clean') {
  return api.post('/dataset-runs', { fileName, csvText, mode });
}

export function listCsvAudits() {
  return api.get('/dataset-runs');
}