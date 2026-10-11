const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 204) return null;

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export function uploadVideo(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/videos/import`);
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener('load', () => {
      let body = {};
      try {
        body = JSON.parse(request.responseText || '{}');
      } catch {
        body = {};
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body.error || `Upload failed (${request.status})`));
        return;
      }
      resolve(body);
    });
    request.addEventListener('error', () => reject(new Error('Video upload was interrupted.')));
    request.addEventListener('abort', () => reject(new Error('Video upload was cancelled.')));
    request.send(file);
  });
}

export function uploadReceivedFile(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/receive?filename=${encodeURIComponent(file.name)}`);
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener('load', () => {
      let body = {};
      try {
        body = JSON.parse(request.responseText || '{}');
      } catch {
        reject(new Error('The server returned an invalid upload response.'));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body.error || `Upload failed (${request.status})`));
        return;
      }
      resolve(body);
    });
    request.addEventListener('error', () => reject(new Error('Upload connection was interrupted.')));
    request.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));
    request.send(file);
  });
}

export async function estimateStorageUsage() {
  try {
    const info = await api.get('/storage');
    return { usage: info.bytes || 0, quota: null, path: info.path };
  } catch {
    return null;
  }
}

export async function getHealth() {
  return api.get('/health');
}
