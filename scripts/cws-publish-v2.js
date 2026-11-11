#!/usr/bin/env node
/**
 * Max Subtitles - Chrome Web Store API v2 Automation Script
 * Decoupled Upload -> Status Check -> Publish pipeline using CWS API v2.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildDeployPercentageUrl,
  buildPublishUrl,
  buildStatusUrl,
  buildUploadUrl,
  getAccessTokenFromRefreshToken,
  parseCwsPublishResponse,
  parseCwsStatusResponse
} from '../src/shared/cws-api-v2.js';

// Automatically load local runtime environment variables if available
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch (_) {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

async function getAccessToken() {
  if (process.env.CWS_ACCESS_TOKEN) {
    return process.env.CWS_ACCESS_TOKEN.trim();
  }

  const clientId = process.env.CWS_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.CWS_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const refreshToken =
    process.env.CWS_REFRESH_TOKEN || process.env.CWS_REFRESHTOKEN || process.env.REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const token = await getAccessTokenFromRefreshToken({ clientId, clientSecret, refreshToken });
      if (token) return token;
    } catch (err) {
      console.warn(`[CWS API v2] OAuth exchange warning: ${err.message}`);
    }
  }

  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    if (token) return token;
  } catch (_) {}

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const isUpload = args.includes('--upload') || args.includes('--upload-only') || args.length === 0;
  const isStatus = args.includes('--status');
  const isPublish = args.includes('--publish');

  const publisherId = process.env.CWS_PUBLISHER_ID || process.env.PUBLISHER_ID;
  const itemId =
    process.env.CWS_ITEM_ID || process.env.CWS_EXTENSION_ID || process.env.EXTENSION_ID;

  if (!publisherId || !itemId) {
    console.error(
      '[CWS API v2] Missing CWS_PUBLISHER_ID or CWS_ITEM_ID (or CWS_EXTENSION_ID).\n' +
        'Set them via environment variables or define them in your environment.'
    );
    process.exitCode = 1;
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    console.error(
      '[CWS API v2] No access token found. Please set CWS_ACCESS_TOKEN or run `gcloud auth application-default login`.'
    );
    process.exitCode = 1;
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`
  };

  if (isStatus) {
    console.log(`[CWS API v2] Checking item status for ${itemId}...`);
    const res = await fetch(buildStatusUrl(publisherId, itemId), { headers });
    const data = await res.json();
    const status = parseCwsStatusResponse(data);
    console.log('[CWS API v2] Status Result:', JSON.stringify(status, null, 2));
    return;
  }

  if (isUpload) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf-8'));
    const zipName = `max-subtitles-v${manifest.version}.zip`;
    const zipPath = path.join(ROOT_DIR, 'dist', zipName);

    if (!fs.existsSync(zipPath)) {
      console.log(`[CWS API v2] Package not found at ${zipPath}. Running build...`);
      execSync('python3 scripts/package.py', { cwd: ROOT_DIR, stdio: 'inherit' });
    }

    console.log(`[CWS API v2] Uploading ${zipPath} to Chrome Web Store API v2...`);
    const zipBytes = fs.readFileSync(zipPath);

    const uploadRes = await fetch(buildUploadUrl(publisherId, itemId), {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/zip'
      },
      body: zipBytes
    });

    const uploadData = await uploadRes.json();
    const status = parseCwsStatusResponse(uploadData);

    if (!status.isSuccess) {
      console.error('[CWS API v2] Upload failed:', status.errorMessage);
      process.exitCode = 1;
      return;
    }

    console.log(`[CWS API v2] Upload SUCCESS! CrxVersion: ${status.crxVersion}`);
  }

  if (isPublish) {
    console.log(`[CWS API v2] Publishing item ${itemId} for review...`);
    const publishRes = await fetch(buildPublishUrl(publisherId, itemId), {
      method: 'POST',
      headers
    });
    const publishData = await publishRes.json();
    const pubStatus = parseCwsPublishResponse(publishData);
    console.log('[CWS API v2] Publish Result:', JSON.stringify(pubStatus, null, 2));
  }
}

main().catch((err) => {
  console.error('[CWS API v2] Error:', err.message);
  process.exitCode = 1;
});
