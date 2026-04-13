import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../m5-data.mjs');
const STUB_PATH = path.resolve(__dirname, './stub-fetch.mjs');

const runCli = (args, env = {}) => new Promise((resolve) => {
  const child = spawn('node', [CLI_PATH, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.on('close', (code) => {
    resolve({ code, stdout, stderr });
  });
});

test('device-list without token exits with error', async () => {
  const result = await runCli(['device-list'], { M5_AUTH_TOKEN: '' });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Missing token/);
});

test('firmware-list uses stub fetch output', async () => {
  const result = await runCli(['firmware-list'], { M5_FETCH_STUB: STUB_PATH });
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed[0].fid, 'demo-fid');
});
