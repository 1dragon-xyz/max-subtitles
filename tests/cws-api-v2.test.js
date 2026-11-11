import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeployPercentageUrl,
  buildPublishUrl,
  buildStatusUrl,
  buildUploadUrl,
  getAccessTokenFromRefreshToken,
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

  const fetchStatusData = {
    itemId: 'abc',
    lastAsyncUploadState: 'SUCCEEDED',
    submittedItemRevisionStatus: { crxVersion: '1.0.0' }
  };
  const parsedFetch = parseCwsStatusResponse(fetchStatusData);
  assert.equal(parsedFetch.isSuccess, true);
  assert.equal(parsedFetch.uploadState, 'SUCCEEDED');
  assert.equal(parsedFetch.crxVersion, '1.0.0');

  const draftStatusData = {
    itemId: 'abc',
    publicKey: 'MIIBI...'
  };
  const parsedDraft = parseCwsStatusResponse(draftStatusData);
  assert.equal(parsedDraft.isSuccess, true);
  assert.equal(parsedDraft.uploadState, 'READY');

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

  const v2Published = {
    name: 'publishers/123/items/abc',
    itemId: 'abc',
    state: 'PENDING_REVIEW'
  };
  const resV2 = parseCwsPublishResponse(v2Published);
  assert.equal(resV2.isPendingReview, true);
  assert.equal(resV2.status, 'PENDING_REVIEW');

  const preconditionError = {
    error: {
      code: 400,
      message: 'Your publisher account is missing required information.',
      status: 'FAILED_PRECONDITION',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.PreconditionFailure',
          violations: [
            {
              type: 'MISSING_CONTACT_EMAIL',
              description: 'You must provide a contact email before you can publish any item.'
            }
          ]
        }
      ]
    }
  };
  const errRes = parseCwsPublishResponse(preconditionError);
  assert.equal(errRes.isPendingReview, false);
  assert.equal(errRes.status, 'FAILED_PRECONDITION');
  assert.equal(errRes.statusDetail.some((d) => d.includes('MISSING_CONTACT_EMAIL')), true);
});

test('getAccessTokenFromRefreshToken - sends OAuth2 exchange request and returns access_token', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      assert.ok(url.includes('oauth2.googleapis.com/token'));
      assert.ok(opts.body.includes('refresh_token=mock_refresh'));
      assert.ok(opts.body.includes('client_id=mock_client'));
      return {
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token_123',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      };
    };

    const token = await getAccessTokenFromRefreshToken({
      clientId: 'mock_client',
      clientSecret: 'mock_secret_val',
      refreshToken: 'mock_refresh'
    });
    assert.equal(token, 'mock_access_token_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
