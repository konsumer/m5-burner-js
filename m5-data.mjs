#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

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

const [,, command, ...args] = process.argv;

const usage = () => {
  console.error(`Usage:
  m5-data login <email> <password>
  m5-data device-list <token | env:M5_AUTH_TOKEN>
  m5-data firmware-list
  m5-data own-firmware <token | env:M5_AUTH_TOKEN> [username]
  m5-data publish-firmware <token | env:M5_AUTH_TOKEN> <payload.json>
  m5-data update-firmware <token | env:M5_AUTH_TOKEN> <fid> <version> <payload.json>
  m5-data remove-firmware <token | env:M5_AUTH_TOKEN> <fid> <version>
  m5-data set-publish <token | env:M5_AUTH_TOKEN> <fid> <version> <on|off|1|0>
  m5-data share-code <token | env:M5_AUTH_TOKEN> <fid> <file>
  m5-data revoke-share <token | env:M5_AUTH_TOKEN> <shareId>
  m5-data share-lookup <code>
  m5-data firmware-comments
  m5-data comment-by-fid <fid>
  m5-data comment <token | env:M5_AUTH_TOKEN> <fid> <username> <content>
  m5-data media-token <mac>`);
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

const requireToken = (index = 0) => {
  const token = args[index] ?? process.env.M5_AUTH_TOKEN;
  if (!token) {
    console.error('Missing token. Pass as an argument or set M5_AUTH_TOKEN.');
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
      const { data, token } = await login({ email, password }, withFetch());
      console.log(JSON.stringify({ token, profile: data?.data ?? data }, null, 2));
      return;
    }
    case 'device-list': {
      const tokenArg = requireToken(0);
      const devices = await getDeviceList(tokenArg, withFetch());
      console.log(JSON.stringify(devices, null, 2));
      return;
    }
    case 'firmware-list': {
      const firmware = await getFirmwareList(withFetch());
      console.log(JSON.stringify(firmware, null, 2));
      return;
    }
    case 'own-firmware': {
      const tokenArg = requireToken(0);
      const username = args[1];
      const result = await getOwnFirmware(tokenArg, withFetch(username ? { username } : undefined));
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'publish-firmware': {
      const tokenArg = requireToken(0);
      const payloadPath = args[1];
      if (!payloadPath) {
        console.error('Missing payload JSON.');
        process.exit(1);
      }
      const payload = await buildFormPayload(payloadPath);
      const result = await publishFirmware(tokenArg, payload, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'update-firmware': {
      const tokenArg = requireToken(0);
      const fid = args[1];
      const version = args[2];
      const payloadPath = args[3];
      if (!fid || !version || !payloadPath) {
        console.error('Usage: m5-data update-firmware <token> <fid> <version> <payload.json>');
        process.exit(1);
      }
      const payload = await buildFormPayload(payloadPath);
      const result = await updateFirmware(tokenArg, fid, version, payload, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'remove-firmware': {
      const tokenArg = requireToken(0);
      const fid = args[1];
      const version = args[2];
      if (!fid || !version) {
        console.error('Usage: m5-data remove-firmware <token> <fid> <version>');
        process.exit(1);
      }
      const result = await removeFirmwareVersion(tokenArg, fid, version, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'set-publish': {
      const tokenArg = requireToken(0);
      const fid = args[1];
      const version = args[2];
      const state = args[3];
      if (!fid || !version || !state) {
        console.error('Usage: m5-data set-publish <token> <fid> <version> <on|off|1|0>');
        process.exit(1);
      }
      const publish = state === 'on' || state === '1' || state === 'true';
      const result = await setFirmwarePublishState(tokenArg, fid, version, publish, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'share-code': {
      const tokenArg = requireToken(0);
      const fid = args[1];
      const file = args[2];
      if (!fid || !file) {
        console.error('Usage: m5-data share-code <token> <fid> <firmwareFileName>');
        process.exit(1);
      }
      const result = await getShareCode(tokenArg, fid, file, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'revoke-share': {
      const tokenArg = requireToken(0);
      const shareId = args[1];
      if (!shareId) {
        console.error('Usage: m5-data revoke-share <token> <shareId>');
        process.exit(1);
      }
      const result = await revokeShareCode(tokenArg, shareId, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'share-lookup': {
      const code = args[0];
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
      const tokenArg = requireToken(0);
      const fid = args[1];
      const user = args[2];
      const contentParts = args.slice(3);
      if (!fid || !user || contentParts.length === 0) {
        console.error('Usage: m5-data comment <token> <fid> <username> <content>');
        process.exit(1);
      }
      const content = contentParts.join(' ');
      const result = await postComment({ fid, user, content, token: tokenArg }, withFetch());
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'media-token': {
      const mac = args[0];
      if (!mac) {
        console.error('Usage: m5-data media-token <mac>');
        process.exit(1);
      }
      const result = await requestMediaToken(mac, withFetch());
      console.log(result);
      return;
    }
    case 'comment-by-fid': {
      const fid = args[0];
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
