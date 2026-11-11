import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeployPercentageUrl,
  buildPublishUrl,
  buildStatusUrl,
  buildUploadUrl,
  parseCwsPublishResponse,
  parseCwsStatusResponse
} from '../src/shared/cws-api-v2.js';

test('CWS API v2 URL builders - constructs correct decoupled endpoints with publisherId and itemId', () => {
  const pub = 'pub-123456';
  const item = 'abcdefghijklmnopqrstuvwxyz123456';

  assert.equal(
    buildUploadUrl(pub, item),
    'https://chromewebstore.googleapis.com/upload/v2/publishers/pub-123456/items/abcdefghijklmnopqrstuvwxyz123456:upload'
  );

  assert.equal(
    buildStatusUrl(pub, item),
    'https://chromewebstore.googleapis.com/v2/publishers/pub-123456/items/abcdefghijklmnopqrstuvwxyz123456:fetchStatus'
  );

  assert.equal(
    buildPublishUrl(pub, item),
    'https://chromewebstore.googleapis.com/v2/publishers/pub-123456/items/abcdefghijklmnopqrstuvwxyz123456:publish'
  );

  assert.equal(
    buildDeployPercentageUrl(pub, item),
    'https://chromewebstore.googleapis.com/v2/publishers/pub-123456/items/abcdefghijklmnopqrstuvwxyz123456:setPublishedDeployPercentage'
  );
});

test('parseCwsStatusResponse - extracts uploadState, crxVersion, and validation errors', () => {
  const successData = {
    kind: 'chromewebstore#itemStatus',
    itemId: 'abc',
    uploadState: 'SUCCESS',
    crxVersion: '1.0.0'
  };
  const parsed = parseCwsStatusResponse(successData);
  assert.equal(parsed.isSuccess, true);
  assert.equal(parsed.uploadState, 'SUCCESS');
  assert.equal(parsed.crxVersion, '1.0.0');

  const errorData = {
    kind: 'chromewebstore#itemStatus',
    uploadState: 'FAILURE',
    itemError: [{ error_code: 'MANIFEST_INVALID', error_detail: 'Version mismatch' }]
  };
  const parsedError = parseCwsStatusResponse(errorData);
  assert.equal(parsedError.isSuccess, false);
  assert.equal(parsedError.errorMessage.includes('MANIFEST_INVALID'), true);
});

test('parseCwsPublishResponse - checks status and statusDetail of publish operation', () => {
  const published = {
    kind: 'chromewebstore#item',
    status: ['OK'],
    statusDetail: ['ITEM_PENDING_REVIEW']
  };
  const res = parseCwsPublishResponse(published);
  assert.equal(res.isPendingReview, true);
  assert.equal(res.status, 'OK');
});
