import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDeviceList,
  login,
  publishFirmware,
} from '../index.js';

const mockResponse = (body, init = {}) => new Response(body, {
  status: 200,
  headers: init.headers,
  ...init,
});

test('login extracts auth token and payload', async () => {
  let captured;
  const fetchStub = async (url, options) => {
    captured = { url, options };
    return mockResponse(JSON.stringify({ code: 200, data: { username: 'tester' } }), {
      headers: { 'set-cookie': 'm5_auth_token=abc123; Path=/;' },
    });
  };

  const result = await login({ email: 'test@example.com', password: 'pw' }, { fetch: fetchStub });
  assert.equal(captured.url, 'https://uiflow2.m5stack.com/api/v1/account/login');
  assert.equal(captured.options.method, 'POST');
  assert.equal(result.token, 'abc123');
  assert.equal(result.data.data.username, 'tester');
});

test('getDeviceList surfaces invalid JSON responses', async () => {
  const fetchStub = async () => new Response('not json', { status: 200 });
  await assert.rejects(
    () => getDeviceList('token', { fetch: fetchStub }),
    /Invalid JSON received from server\./,
  );
});

test('publishFirmware builds multipart payloads with binary data', async () => {
  const fetchStub = async (url, options) => {
    assert.equal(url, 'http://m5burner-api.m5stack.com/api/admin/firmware');
    assert.equal(options.headers.Cookie, 'm5_auth_token=token');
    assert.ok(options.body instanceof FormData, 'Body should be FormData');
    assert.equal(options.body.get('name'), 'Demo');
    const firmware = options.body.get('firmware');
    assert.ok(firmware instanceof Blob);
    const contents = Buffer.from(await firmware.arrayBuffer()).toString('utf8');
    assert.equal(contents, 'payload');
    return mockResponse(JSON.stringify({ status: 1, message: 'success' }));
  };

  await publishFirmware('token', {
    name: 'Demo',
    firmware: { value: Buffer.from('payload'), filename: 'demo.bin' },
  }, { fetch: fetchStub });
});
