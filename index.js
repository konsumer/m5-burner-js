const BASE_URLS = Object.freeze({
  account: 'https://uiflow2.m5stack.com',
  admin: 'http://m5burner-api.m5stack.com',
  firmwareCdn: 'http://m5burner-api-fc-hk-cdn.m5stack.com',
  cover: 'http://m5burner.m5stack.com',
  mediaToken: 'http://flow.m5stack.com:5003',
});

const ensureFetch = () => {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable. Use Node.js 18+ or supply a ponyfill.');
  }
  return fetch;
};

const captureAuthCookie = (response) => {
  const header = response.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/m5_auth_token=([^;]+)/i);
  return match ? match[1] : null;
};

const parseJson = async (response, fallbackMessage) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const err = new Error(fallbackMessage);
    err.status = response.status;
    err.body = text;
    throw err;
  }
};

const handleResponse = async (response, expectJson = true) => {
  const payload = expectJson ? await parseJson(response, 'Invalid JSON received from server.') : await response.text();
  if (!response.ok) {
    const err = new Error(`Request failed with status ${response.status}`);
    err.status = response.status;
    err.body = payload;
    throw err;
  }
  return payload;
};

const authHeader = (token) => {
  if (!token) {
    throw new Error('This endpoint requires a valid m5_auth_token.');
  }
  return `m5_auth_token=${token}`;
};

const isBinary = (value) => {
  if (!value) return false;
  return value instanceof Blob || Buffer.isBuffer(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
};

const toBlob = (value, type) => {
  if (value instanceof Blob) return value;
  if (Buffer.isBuffer(value)) return new Blob([value], type ? { type } : undefined);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return new Blob([value], type ? { type } : undefined);
  }
  if (typeof value === 'string') return new Blob([value], type ? { type } : undefined);
  throw new Error('Unsupported binary value.');
};

const toFormData = (payload = {}) => {
  if (payload instanceof FormData) {
    return payload;
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'object' && 'value' in value) {
      const blob = toBlob(value.value, value.type);
      const filename = value.filename ?? undefined;
      form.append(key, blob, filename);
      continue;
    }

    if (isBinary(value)) {
      form.append(key, toBlob(value));
      continue;
    }

    form.append(key, String(value));
  }

  return form;
};

export const urls = {
  firmwareCover: (coverId) => {
    if (!coverId) throw new Error('coverId is required');
    return new URL(`/cover/${coverId}`, BASE_URLS.cover).toString();
  },
};

export async function login({ email, password }, options = {}) {
  if (!email || !password) {
    throw new Error('email and password are required.');
  }

  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.account}/api/v1/account/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await handleResponse(response, true);
  return { data, token: captureAuthCookie(response) };
}

export async function getDeviceList(token, options = {}) {
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.account}/api/v1/device/list`, {
    headers: { Cookie: authHeader(token) },
  });
  return handleResponse(response, true);
}

export async function getFirmwareList(options = {}) {
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.firmwareCdn}/api/firmware`);
  return handleResponse(response, true);
}

export async function getOwnFirmware(token, options = {}) {
  const fetchImpl = options.fetch ?? ensureFetch();
  const url = new URL(`${BASE_URLS.admin}/api/admin/firmware`);
  if (options.username) {
    url.searchParams.set('username', options.username);
  }
  const response = await fetchImpl(url.toString(), {
    headers: { Cookie: authHeader(token) },
  });
  return handleResponse(response, true);
}

export async function publishFirmware(token, formPayload = {}, options = {}) {
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware`, {
    method: 'POST',
    headers: { Cookie: authHeader(token) },
    body: toFormData(formPayload),
  });
  return handleResponse(response, true);
}

export async function updateFirmware(token, fid, version, formPayload = {}, options = {}) {
  if (!fid || !version) {
    throw new Error('fid and version are required.');
  }
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware/${fid}/version/${version}`, {
    method: 'PUT',
    headers: { Cookie: authHeader(token) },
    body: toFormData(formPayload),
  });
  return handleResponse(response, true);
}

export async function removeFirmwareVersion(token, fid, version, options = {}) {
  if (!fid || !version) {
    throw new Error('fid and version are required.');
  }
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware/remove/${fid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authHeader(token),
    },
    body: JSON.stringify({ version }),
  });
  return handleResponse(response, true);
}

export async function setFirmwarePublishState(token, fid, version, publish, options = {}) {
  if (!fid || !version) {
    throw new Error('fid and version are required.');
  }
  const flag = publish ? 1 : 0;
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware/${fid}/publish/${version}/${flag}`, {
    method: 'PUT',
    headers: { Cookie: authHeader(token) },
  });
  return handleResponse(response, true);
}

export async function getShareCode(token, fid, file, options = {}) {
  if (!fid || !file) {
    throw new Error('fid and firmware file name are required.');
  }
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware/share/${fid}/${file}`, {
    method: 'POST',
    headers: { Cookie: authHeader(token) },
  });
  return handleResponse(response, true);
}

export async function revokeShareCode(token, shareId, options = {}) {
  if (!shareId) {
    throw new Error('shareId is required.');
  }
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/admin/firmware/share/${shareId}`, {
    method: 'PUT',
    headers: { Cookie: authHeader(token) },
  });
  return handleResponse(response, true);
}

export async function getFirmwareComments(options = {}) {
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/firmware/comments`);
  return handleResponse(response, true);
}

export async function getCommentByFid(fid, options = {}) {
  if (!fid) throw new Error('fid is required.');
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/firmware/comment/${fid}`);
  return handleResponse(response, true);
}

export async function postComment({ fid, content, user, token }, options = {}) {
  if (!fid || !content || !user) {
    throw new Error('fid, content, and user fields are required.');
  }
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/firmware/comment/${fid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authHeader(token),
    },
    body: JSON.stringify({ content, user }),
  });
  return handleResponse(response, true);
}

export async function lookupShareCode(code, options = {}) {
  if (!code) throw new Error('share code is required.');
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.admin}/api/firmware/share/${code}`);
  return handleResponse(response, true);
}

export async function requestMediaToken(mac, options = {}) {
  if (!mac) throw new Error('mac is required.');
  const fetchImpl = options.fetch ?? ensureFetch();
  const response = await fetchImpl(`${BASE_URLS.mediaToken}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mac }),
  });
  return handleResponse(response, false);
}

export const baseUrls = BASE_URLS;
