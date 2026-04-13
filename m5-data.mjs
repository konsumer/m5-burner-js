#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  getCommentByFid,
  getDeviceList,
  getFirmwareComments,
  getFirmwareList,
  getOwnFirmware,
  getShareCode,
  login,
  lookupShareCode,
  postComment,
  publishFirmware,
  removeFirmwareVersion,
  requestMediaToken,
  revokeShareCode,
  setFirmwarePublishState,
  updateFirmware,
} from './index.js';

const a = parseArgs({
  options: {
    token: { type: 'string', short: 't' },
    username: { type: 'string' },
  },
  allowPositionals: true,
  strict: false,
});

const { values, positionals } = a

const [command, ...args] = positionals;
const token = values.token ?? process.env.M5_AUTH_TOKEN;

const usage = () => {
  console.error(`Usage:
  m5-data login <email> <password>
  m5-data device-list
  m5-data firmware-list
  m5-data own-firmware [--username <username>]
  m5-data publish-firmware <payload.json>
  m5-data update-firmware <fid> <version> <payload.json>
  m5-data remove-firmware <fid> <version>
  m5-data set-publish <fid> <version> <on|off|1|0>
  m5-data share-code <fid> <file>
  m5-data revoke-share <shareId>
  m5-data share-lookup <code>
  m5-data firmware-comments
  m5-data comment-by-fid <fid>
  m5-data comment <fid> <username> <content>
  m5-data media-token <mac>

Token: pass --token <token> (or -t <token>), or set M5_AUTH_TOKEN env var.`);
};

const resolveFetchOverride = async () => {
  const stub = process.env.M5_FETCH_STUB;
  if (!stub) return null;
  const abs = path.isAbsolute(stub) ? stub : path.resolve(process.cwd(), stub);
  const mod = await import(pathToFileURL(abs));
  const candidate = mod.default ?? mod.fetch ?? mod;
  if (typeof candidate !== 'function') {
    throw new Error('Fetch stub module must export a function.');
  }
  return candidate;
};

const fetchOverride = await resolveFetchOverride();
const withFetch = (options) => {
  if (!fetchOverride) return options;
  return { ...(options ?? {}), fetch: fetchOverride };
};

const readJson = async (filePath) => {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const raw = await readFile(abs, 'utf8');
  return { data: JSON.parse(raw), baseDir: path.dirname(abs) };
};

const buildFormPayload = async (filePath) => {
  const { data, baseDir } = await readJson(filePath);
  const payload = { ...(data.fields ?? {}) };
  const files = data.files ?? {};
  for (const [key, relativePath] of Object.entries(files)) {
    const abs = path.isAbsolute(relativePath) ? relativePath : path.resolve(baseDir, relativePath);
    const fileBuffer = await readFile(abs);
    payload[key] = {
      value: fileBuffer,
      filename: path.basename(abs),
    };
  }
  return payload;
};

const requireToken = () => {
  if (!token) {
    console.error('Missing token. Pass --token <token> (or -t <token>), or set M5_AUTH_TOKEN.');
    process.exit(1);
  }
  return token;
};

const run = async () => {
  switch (command) {
    case 'login': {
      const [email, password] = args;
      if (!email || !password) {
        usage();
        process.exit(1);
      }
      const { data, token: authToken } = await login({ email, password }, withFetch());
      console.log(JSON.stringify({ token: authToken, profile: data?.data ?? data }, null, 2));
      return;
    }
    case 'device-list': {
      const devices = await getDeviceList(requireToken(), withFetch());
      console.log(JSON.stringify(devices, null, 2));
      return;
    }
    case 'firmware-list': {
      const firmware = await getFirmwareList(withFetch());
      console.log(JSON.stringify(firmware, null, 2));
      return;
    }
    case 'own-firmware': {
      const username = values.username;
      const result = await getOwnFirmware(requireToken(), withFetch(username ? { username } : undefined));
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'publish-firmware': {
      const [payloadPath] = args;
      if (!payloadPath) {
        console.error('Missing payload JSON.');
        process.exit(1);
      }
      const payload = await buildFormPayload(payloadPath);
      const result = await publishFirmware(requireToken(), payload, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'update-firmware': {
      const [fid, version, payloadPath] = args;
      if (!fid || !version || !payloadPath) {
        console.error('Usage: m5-data update-firmware <fid> <version> <payload.json>');
        process.exit(1);
      }
      const payload = await buildFormPayload(payloadPath);
      const result = await updateFirmware(requireToken(), fid, version, payload, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'remove-firmware': {
      const [fid, version] = args;
      if (!fid || !version) {
        console.error('Usage: m5-data remove-firmware <fid> <version>');
        process.exit(1);
      }
      const result = await removeFirmwareVersion(requireToken(), fid, version, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'set-publish': {
      const [fid, version, state] = args;
      if (!fid || !version || !state) {
        console.error('Usage: m5-data set-publish <fid> <version> <on|off|1|0>');
        process.exit(1);
      }
      const publish = state === 'on' || state === '1' || state === 'true';
      const result = await setFirmwarePublishState(requireToken(), fid, version, publish, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'share-code': {
      const [fid, file] = args;
      if (!fid || !file) {
        console.error('Usage: m5-data share-code <fid> <firmwareFileName>');
        process.exit(1);
      }
      const result = await getShareCode(requireToken(), fid, file, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'revoke-share': {
      const [shareId] = args;
      if (!shareId) {
        console.error('Usage: m5-data revoke-share <shareId>');
        process.exit(1);
      }
      const result = await revokeShareCode(requireToken(), shareId, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'share-lookup': {
      const [code] = args;
      if (!code) {
        console.error('Usage: m5-data share-lookup <code>');
        process.exit(1);
      }
      const result = await lookupShareCode(code, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'firmware-comments': {
      const result = await getFirmwareComments(withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'comment': {
      const [fid, user, ...contentParts] = args;
      if (!fid || !user || contentParts.length === 0) {
        console.error('Usage: m5-data comment <fid> <username> <content>');
        process.exit(1);
      }
      const content = contentParts.join(' ');
      const result = await postComment({ fid, user, content, token: requireToken() }, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'media-token': {
      const [mac] = args;
      if (!mac) {
        console.error('Usage: m5-data media-token <mac>');
        process.exit(1);
      }
      const result = await requestMediaToken(mac, withFetch());
      console.log(result);
      return;
    }
    case 'comment-by-fid': {
      const [fid] = args;
      if (!fid) {
        console.error('Usage: m5-data comment-by-fid <fid>');
        process.exit(1);
      }
      const result = await getCommentByFid(fid, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      usage();
      process.exit(1);
  }
};

run().catch((error) => {
  console.error(error.message);
  if (error.body) {
    console.error(JSON.stringify(error.body, null, 2));
  }
  process.exit(1);
});
