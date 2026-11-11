/**
 * Chrome Web Store API v2 (chromewebstore.googleapis.com/v2) Client Utilities
 * Compliant with Google CWS API v2 specification (API v1 sunsetted Oct 2026).
 */

export const CWS_API_BASE_URL = 'https://chromewebstore.googleapis.com/v2';
export const CWS_UPLOAD_BASE_URL = 'https://chromewebstore.googleapis.com/upload/v2';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Exchanges an OAuth2 refresh token for a short-lived access token.
 * @param {{ clientId: string, clientSecret: string, refreshToken: string }} creds
 * @returns {Promise<string>}
 */
export async function getAccessTokenFromRefreshToken({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing required OAuth credentials (clientId, clientSecret, or refreshToken)');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Failed to exchange refresh token: ${data.error_description || data.error || res.statusText}`
    );
  }

  return data.access_token;
}

/**
 * Builds the CWS API v2 package upload URL.
 * @param {string} publisherId
 * @param {string} itemId
 * @returns {string}
 */
export function buildUploadUrl(publisherId, itemId) {
  return `${CWS_UPLOAD_BASE_URL}/publishers/${publisherId}/items/${itemId}:upload`;
}

/**
 * Builds the CWS API v2 item status URL.
 * @param {string} publisherId
 * @param {string} itemId
 * @returns {string}
 */
export function buildStatusUrl(publisherId, itemId) {
  return `${CWS_API_BASE_URL}/publishers/${publisherId}/items/${itemId}:fetchStatus`;
}

/**
 * Builds the CWS API v2 publish URL.
 * @param {string} publisherId
 * @param {string} itemId
 * @returns {string}
 */
export function buildPublishUrl(publisherId, itemId) {
  return `${CWS_API_BASE_URL}/publishers/${publisherId}/items/${itemId}:publish`;
}

/**
 * Builds the CWS API v2 deploy percentage URL for staged rollouts.
 * @param {string} publisherId
 * @param {string} itemId
 * @returns {string}
 */
export function buildDeployPercentageUrl(publisherId, itemId) {
  return `${CWS_API_BASE_URL}/publishers/${publisherId}/items/${itemId}:setPublishedDeployPercentage`;
}

/**
 * Parses the response from fetchStatus or upload endpoints.
 * @param {object} data
 * @returns {{ isSuccess: boolean, uploadState: string, crxVersion: string, errorMessage: string }}
 */
export function parseCwsStatusResponse(data) {
  if (!data || typeof data !== 'object') {
    return {
      isSuccess: false,
      uploadState: 'UNKNOWN',
      crxVersion: '',
      errorMessage: 'Invalid or empty response from Chrome Web Store API'
    };
  }

  const uploadState =
    data.uploadState ||
    data.lastAsyncUploadState ||
    (data.publicKey || data.itemId ? 'READY' : 'UNKNOWN');
  const isSuccess =
    uploadState === 'SUCCESS' || uploadState === 'SUCCEEDED' || uploadState === 'READY';
  const crxVersion =
    data.crxVersion ||
    data.submittedItemRevisionStatus?.crxVersion ||
    data.publishedItemRevisionStatus?.crxVersion ||
    data.itemRevisionStatus?.crxVersion ||
    '';

  let errorMessage = '';
  if (!isSuccess) {
    if (Array.isArray(data.itemError) && data.itemError.length > 0) {
      errorMessage = data.itemError
        .map((e) => `[${e.error_code || 'ERROR'}] ${e.error_detail || JSON.stringify(e)}`)
        .join('; ');
    } else {
      errorMessage = `Upload state returned: ${uploadState}`;
    }
  }

  return {
    isSuccess,
    uploadState,
    crxVersion,
    errorMessage
  };
}

/**
 * Parses the response from publish endpoint.
 * @param {object} data
 * @returns {{ isPendingReview: boolean, status: string, statusDetail: string[] }}
 */
export function parseCwsPublishResponse(data) {
  if (!data || typeof data !== 'object') {
    return {
      isPendingReview: false,
      status: 'UNKNOWN',
      statusDetail: []
    };
  }

  const statusArr = Array.isArray(data.status) ? data.status : [data.status || 'OK'];
  const statusDetailArr = Array.isArray(data.statusDetail) ? data.statusDetail : [];
  const isPendingReview =
    statusDetailArr.includes('ITEM_PENDING_REVIEW') || statusArr.includes('OK');

  return {
    isPendingReview,
    status: statusArr[0] || 'OK',
    statusDetail: statusDetailArr
  };
}
