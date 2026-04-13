const { M5_AUTH_TOKEN } = process?.env ?? {};

const wn_apiBaseUrl = 'http://m5burner-api.m5stack.com';

const resolveFetch = (options) => {
  const candidate = options?.fetch ?? globalThis.fetch;
  if (typeof candidate !== 'function') {
    throw new Error('Fetch implementation not available. Provide options.fetch.');
  }
  return candidate;
};

const parseJsonStrict = async (response) => {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (cause) {
    const error = new Error('Invalid JSON received from server.');
    error.status = response.status;
    error.cause = cause;
    error.rawBody = body;
    throw error;
  }
};

const handleJsonResponse = async (response, errorMessage) => {
  const data = await parseJsonStrict(response);
  if (!response.ok) {
    const error = new Error(errorMessage ?? data?.errMsg ?? data?.message ?? 'Request failed.');
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
};

const handleTextResponse = async (response, errorMessage) => {
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(errorMessage ?? 'Request failed.');
    error.status = response.status;
    error.body = text;
    throw error;
  }
  return text;
};

const authHeaders = (token) => {
  if (!token) return {};
  return {
    Cookie: `m5_auth_token=${token}`,
    m5_auth_token: token,
  };
};

const isFileDescriptor = (value) => Boolean(value && typeof value === 'object' && 'value' in value);

const mergeFormPayload = (payload = {}) => {
  if ('fields' in payload || 'files' in payload) {
    return { ...(payload.fields ?? {}), ...(payload.files ?? {}) };
  }
  return payload;
};

const buildFormData = (payload = {}) => {
  const data = mergeFormPayload(payload);
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (isFileDescriptor(value)) {
      const fileBlob = value.value instanceof Blob ? value.value : new Blob([value.value]);
      form.append(key, fileBlob, value.filename ?? key);
      continue;
    }
    if (value instanceof Blob) {
      form.append(key, value, value.name ?? key);
      continue;
    }
    form.append(key, String(value));
  }
  return form;
};

export async function login({ email, password }, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl('https://uiflow2.m5stack.com/api/v1/account/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleJsonResponse(response, 'Login failed.');
  const cookieHeader = response.headers.get('set-cookie') ?? '';
  const tokenMatch = cookieHeader.match(/m5_auth_token=([^;]+)/);
  const token = tokenMatch?.[1];
  return { token, data };
}

export async function getDeviceList(token = M5_AUTH_TOKEN, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl('https://uiflow2.m5stack.com/api/v1/device/list', {
    method: 'GET',
    headers: authHeaders(token),
  });
  return handleJsonResponse(response, 'Failed to fetch device list.');
}

export async function getFirmwareList(options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl('http://m5burner-api-fc-hk-cdn.m5stack.com/api/firmware');
  return handleJsonResponse(response, 'Failed to fetch firmware list.');
}

export async function publishFirmware(token = M5_AUTH_TOKEN, formPayload = {}, options) {
  const fetchImpl = resolveFetch(options);
  const body = buildFormData(formPayload);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware`, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  return handleJsonResponse(response, 'Failed to publish firmware.');
}

export async function getOwnFirmware(token = M5_AUTH_TOKEN, options) {
  const fetchImpl = resolveFetch(options);
  const username = options?.username;
  const url = new URL(`${wn_apiBaseUrl}/api/admin/firmware`);
  if (username) {
    url.searchParams.set('username', username);
  }
  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: authHeaders(token),
  });
  return handleJsonResponse(response, 'Failed to fetch firmware.');
}

export async function updateFirmware(token = M5_AUTH_TOKEN, fid, version, formPayload = {}, options) {
  const fetchImpl = resolveFetch(options);
  const body = buildFormData(formPayload);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware/${fid}/version/${version}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body,
  });
  return handleJsonResponse(response, 'Failed to update firmware.');
}

export async function removeFirmwareVersion(token = M5_AUTH_TOKEN, fid, version, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware/remove/${fid}`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ version }),
  });
  return handleJsonResponse(response, 'Failed to remove firmware version.');
}

export async function setFirmwarePublishState(token = M5_AUTH_TOKEN, fid, version, publish, options) {
  const fetchImpl = resolveFetch(options);
  const state = publish ? 1 : 0;
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware/${fid}/publish/${version}/${state}`, {
    method: 'PUT',
    headers: authHeaders(token),
  });
  return handleJsonResponse(response, 'Failed to update publish state.');
}

export async function getShareCode(token = M5_AUTH_TOKEN, fid, file, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware/share/${fid}/${file}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleJsonResponse(response, 'Failed to get share code.');
}

export async function revokeShareCode(token = M5_AUTH_TOKEN, shareId, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/admin/firmware/share/${shareId}`, {
    method: 'PUT',
    headers: authHeaders(token),
  });
  return handleJsonResponse(response, 'Failed to revoke share code.');
}

export async function getFirmwareComments(options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/firmware/comments`);
  return handleJsonResponse(response, 'Failed to fetch firmware comments.');
}

export async function getCommentByFid(fid, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/firmware/comment/${fid}`);
  return handleJsonResponse(response, 'Failed to fetch comments for firmware.');
}

export async function postComment({ fid, content, user, token = M5_AUTH_TOKEN }, options) {
  if (!fid) throw new Error('fid is required to post a comment.');
  if (!content) throw new Error('content is required to post a comment.');
  if (!user) throw new Error('user is required to post a comment.');
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/firmware/comment/${fid}`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content, user }),
  });
  return handleJsonResponse(response, 'Failed to post comment.');
}

export async function lookupShareCode(code, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl(`${wn_apiBaseUrl}/api/firmware/share/${code}`);
  return handleJsonResponse(response, 'Failed to lookup share code.');
}

export async function requestMediaToken(mac, options) {
  const fetchImpl = resolveFetch(options);
  const response = await fetchImpl('http://flow.m5stack.com:5003/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mac }),
  });
  const payload = await handleTextResponse(response, 'Failed to request media token.');
  try {
    return JSON.parse(payload);
  } catch (error) {
    return payload.trim();
  }
}

export { wn_apiBaseUrl };
