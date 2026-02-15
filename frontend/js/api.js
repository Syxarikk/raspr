const DEFAULT_API_BASE = '/api/v1';

function extractErrorDetail(payload, fallback) {
  if (!payload) {
    return fallback;
  }
  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }
  if (Array.isArray(payload.detail)) {
    return payload.detail.map((item) => (typeof item?.msg === 'string' ? item.msg : JSON.stringify(item))).join('; ');
  }
  return fallback;
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return { detail: text };
}

function buildError(status, payload, fallback) {
  const detail = extractErrorDetail(payload, fallback);
  const error = new Error(detail);
  error.status = status;
  error.payload = payload;
  return error;
}

export function createApiClient({
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearAuth,
}) {
  const apiBase = window.__ADCONTROL_API_URL__ || localStorage.getItem('adcontrol.api.base') || DEFAULT_API_BASE;

  async function performRequest(method, path, { body, headers, auth = true, retry = true } = {}) {
    const finalHeaders = new Headers(headers || {});

    if (body && !(body instanceof FormData) && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }

    if (auth) {
      const token = getAccessToken();
      if (token) {
        finalHeaders.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && auth && retry) {
      const refreshed = await refreshToken().catch(() => null);
      if (refreshed) {
        return performRequest(method, path, { body, headers, auth, retry: false });
      }
      clearAuth();
      throw buildError(401, await readPayload(response), 'Требуется повторный вход.');
    }

    if (!response.ok) {
      const payload = await readPayload(response);
      throw buildError(response.status, payload, `Request failed (${response.status})`);
    }

    if (response.status === 204) {
      return null;
    }

    return readPayload(response);
  }

  async function refreshToken() {
    const refresh = getRefreshToken();
    const payload = refresh ? { refresh_token: refresh } : {};

    const data = await performRequest('POST', '/auth/refresh', {
      body: payload,
      auth: false,
      retry: false,
    });

    setTokens(data.tokens.access_token, data.tokens.refresh_token, data.user);
    return data;
  }

  return {
    apiBase,

    login(username, password) {
      return performRequest('POST', '/auth/login', {
        body: { username, password },
        auth: false,
        retry: false,
      });
    },

    telegramLogin(initData) {
      return performRequest('POST', '/auth/telegram', {
        body: { init_data: initData },
        auth: false,
        retry: false,
      });
    },

    logout() {
      return performRequest('POST', '/auth/logout', {
        body: { refresh_token: getRefreshToken() },
        auth: false,
        retry: false,
      });
    },

    refreshToken,

    getMe() {
      return performRequest('GET', '/users/me');
    },

    listOrders() {
      return performRequest('GET', '/orders');
    },

    getOrder(orderId) {
      return performRequest('GET', `/orders/${orderId}`);
    },

    setOrderStatus(orderId, status) {
      return performRequest('PATCH', `/orders/${orderId}/status`, { body: { status } });
    },

    createOrder(payload) {
      return performRequest('POST', '/orders', { body: payload });
    },

    listPromoters() {
      return performRequest('GET', '/users/promoters');
    },

    updatePromoterAvailability(promoterId, payload) {
      return performRequest('PATCH', `/users/promoters/${promoterId}/availability`, { body: payload });
    },

    listPayouts() {
      return performRequest('GET', '/payouts');
    },

    listWorkTypes() {
      return performRequest('GET', '/work-types');
    },

    listAddresses() {
      return performRequest('GET', '/addresses');
    },

    listOrderPhotos(orderId) {
      return performRequest('GET', `/photos/order/${orderId}`);
    },

    reviewPhoto(photoId, payload) {
      return performRequest('PATCH', `/photos/${photoId}/review`, { body: payload });
    },

    uploadPhoto(payload) {
      const formData = new FormData();
      formData.set('order_item_id', String(payload.order_item_id));
      formData.set('work_type_id', String(payload.work_type_id));
      if (typeof payload.geo_lat === 'number' && Number.isFinite(payload.geo_lat)) {
        formData.set('geo_lat', String(payload.geo_lat));
      }
      if (typeof payload.geo_lng === 'number' && Number.isFinite(payload.geo_lng)) {
        formData.set('geo_lng', String(payload.geo_lng));
      }
      formData.set('file', payload.file);

      return performRequest('POST', '/photos', { body: formData });
    },

    async fetchPhotoBlob(photoId) {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let response = await fetch(`${apiBase}/photos/file/${photoId}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      if (response.status === 401) {
        const refreshed = await refreshToken().catch(() => null);
        if (!refreshed) {
          clearAuth();
          throw buildError(401, await readPayload(response), 'Требуется повторный вход.');
        }

        const nextToken = getAccessToken();
        response = await fetch(`${apiBase}/photos/file/${photoId}`, {
          method: 'GET',
          credentials: 'include',
          headers: nextToken ? { Authorization: `Bearer ${nextToken}` } : {},
        });
      }

      if (!response.ok) {
        throw buildError(response.status, await readPayload(response), `Request failed (${response.status})`);
      }

      return response.blob();
    },

    handleError(error, fallback) {
      if (error && typeof error === 'object' && typeof error.message === 'string') {
        return error.message;
      }
      return fallback;
    },
  };
}
