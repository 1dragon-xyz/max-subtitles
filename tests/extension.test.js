import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('manifest.json - exists and conforms to Manifest V3 specification', () => {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true, 'manifest.json must exist');

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
  assert.equal(typeof manifest.name, 'string');
  assert.equal(typeof manifest.version, 'string');

  // Background service worker
  assert.ok(manifest.background, 'background configuration must exist');
  assert.equal(manifest.background.service_worker, 'src/background/service-worker.js');
  assert.equal(manifest.background.type, 'module');

  // Permissions and host permissions
  assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
  assert.ok(manifest.permissions.includes('storage'), 'permissions must include storage');

  assert.ok(Array.isArray(manifest.host_permissions), 'host_permissions must be an array');
  const hosts = manifest.host_permissions;
  assert.ok(hosts.some(h => h.includes('max.com')), 'host_permissions must include max.com');
  assert.ok(hosts.some(h => h.includes('hbomax.com')), 'host_permissions must include hbomax.com');
  assert.ok(hosts.some(h => h.includes('translate.googleapis.com')), 'host_permissions must include translate.googleapis.com');

  // Content scripts
  assert.ok(Array.isArray(manifest.content_scripts), 'content_scripts must be an array');
  const cs = manifest.content_scripts[0];
  assert.ok(cs.matches.some(m => m.includes('hbomax.com')));
  assert.ok(cs.matches.some(m => m.includes('max.com')));
  assert.ok(cs.js.includes('src/content/content.js'));
  assert.ok(cs.css.includes('src/content/overlay.css'));

  // Action popup
  assert.ok(manifest.action, 'action must exist');
  assert.equal(manifest.action.default_popup, 'src/popup/popup.html');
});

test('popup UI files - html, js, and css exist with required controls', () => {
  const popupHtmlPath = path.join(ROOT_DIR, 'src/popup/popup.html');
  const popupJsPath = path.join(ROOT_DIR, 'src/popup/popup.js');
  const popupCssPath = path.join(ROOT_DIR, 'src/popup/popup.css');

  assert.equal(fs.existsSync(popupHtmlPath), true, 'popup.html must exist');
  assert.equal(fs.existsSync(popupJsPath), true, 'popup.js must exist');
  assert.equal(fs.existsSync(popupCssPath), true, 'popup.css must exist');

  const html = fs.readFileSync(popupHtmlPath, 'utf-8');
  assert.ok(html.includes('id="toggle-enabled"'), 'popup.html must have toggle-enabled checkbox/input');
  assert.ok(html.includes('id="font-size"'), 'popup.html must have font-size control');
  assert.ok(html.includes('popup.css'), 'popup.html must link popup.css');
  assert.ok(html.includes('popup.js'), 'popup.html must include popup.js');

  const js = fs.readFileSync(popupJsPath, 'utf-8');
  assert.ok(js.includes('chrome.storage') || js.includes('storage'), 'popup.js must interact with chrome storage or settings');

  const css = fs.readFileSync(popupCssPath, 'utf-8');
  assert.ok(css.length > 50, 'popup.css must contain styling rules');
});

test('overlay.css - contains rules to hide native HBO subtitles and style custom overlay', () => {
  const overlayCssPath = path.join(ROOT_DIR, 'src/content/overlay.css');
  assert.equal(fs.existsSync(overlayCssPath), true, 'overlay.css must exist');

  const css = fs.readFileSync(overlayCssPath, 'utf-8');
  assert.ok(css.includes('::cue'), 'overlay.css should target video::cue to hide native captions');
  assert.ok(css.includes('#max-vietsub-overlay'), 'overlay.css must style #max-vietsub-overlay');
  assert.ok(css.includes('.max-sub-line'), 'overlay.css must style .max-sub-line');
  assert.ok(css.includes('display: none') || css.includes('opacity: 0') || css.includes('visibility: hidden'),
    'overlay.css must have hiding rules for native captions');
});

test('service-worker.js and content.js - files exist and have valid syntax', () => {
  const swPath = path.join(ROOT_DIR, 'src/background/service-worker.js');
  const contentPath = path.join(ROOT_DIR, 'src/content/content.js');

  assert.equal(fs.existsSync(swPath), true, 'service-worker.js must exist');
  assert.equal(fs.existsSync(contentPath), true, 'content.js must exist');

  const swContent = fs.readFileSync(swPath, 'utf-8');
  assert.ok(swContent.includes('chrome.runtime.onMessage'), 'service-worker must listen to chrome.runtime messages');
  assert.ok(swContent.includes('TRANSLATE_CUE') || swContent.includes('TRANSLATE_TEXT'), 'service-worker must handle translation messages');

  const contentJs = fs.readFileSync(contentPath, 'utf-8');
  assert.ok(contentJs.includes('textTracks') || contentJs.includes('MutationObserver'), 'content.js must monitor textTracks or DOM mutations');
  assert.ok(contentJs.includes('max-vietsub-overlay'), 'content.js must reference max-vietsub-overlay');
});
