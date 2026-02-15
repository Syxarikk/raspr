import type { Page, Route } from '@playwright/test';

type Role = 'operator' | 'promoter';
type OrderStatus = 'Draft' | 'Assigned' | 'InProgress' | 'Review' | 'Payment' | 'Completed';
type PayoutStatus = 'on_review' | 'to_pay' | 'paid';
type PhotoStatus = 'pending' | 'accepted' | 'rejected';

interface User {
  id: number;
  full_name: string;
  role: Role;
  username: string | null;
  phone: string | null;
  is_ready: boolean;
  suspicious_note: string | null;
}

interface Order {
  id: number;
  title: string;
  status: OrderStatus;
  promoter_id: number | null;
  deadline_at: string | null;
  comment: string | null;
}

interface Payout {
  order_id: number;
  amount_preliminary: number;
  amount_final: number;
  status: PayoutStatus;
}

interface Photo {
  id: number;
  order_item_id: number;
  work_type_id: number;
  status: PhotoStatus;
  reject_reason: string | null;
  url: string;
}

interface OrderDetailItem {
  id: number;
  address_id: number;
  work_type_ids: number[];
  comment: string | null;
}

interface OrderDetail {
  id: number;
  title: string;
  status: OrderStatus;
  promoter_id: number | null;
  items: OrderDetailItem[];
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9Wl6v0wAAAAASUVORK5CYII=',
  'base64',
);

const operatorUser: User = {
  id: 1,
  full_name: 'Operator QA',
  role: 'operator',
  username: 'operator',
  phone: '+79990000001',
  is_ready: true,
  suspicious_note: null,
};

const promoterUser: User = {
  id: 2,
  full_name: 'Promoter QA',
  role: 'promoter',
  username: 'promoter',
  phone: '+79990000002',
  is_ready: true,
  suspicious_note: null,
};

const promoters: User[] = [
  promoterUser,
  {
    id: 3,
    full_name: 'Promoter Backup',
    role: 'promoter',
    username: 'backup',
    phone: '+79990000003',
    is_ready: false,
    suspicious_note: 'Нужен контроль качества',
  },
];

const addresses = [
  { id: 101, district: 'Центр', street: 'Ленина', building: '10', lat: 55.43, lng: 37.54, comment: null },
  { id: 102, district: 'Север', street: 'Кирова', building: '22', lat: 55.41, lng: 37.57, comment: null },
];

const workTypes = [
  { id: 201, name: 'Листовки', price_per_unit: 10, is_active: true },
  { id: 202, name: 'Наклейки', price_per_unit: 8, is_active: true },
];

function json(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function badRequest(route: Route, detail: string, status = 422): Promise<void> {
  return json(route, status, { detail });
}

function parseMultipartField(raw: string, field: string): string | null {
  const pattern = new RegExp(`name="${field}"\\r\\n\\r\\n([^\\r]+)`);
  const match = raw.match(pattern);
  return match ? match[1] : null;
}

function authPayload(user: User, accessToken: string, refreshToken: string) {
  return {
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 1800,
    },
    user,
  };
}

export async function installApiMock(page: Page): Promise<void> {
  const orders: Order[] = [
    {
      id: 301,
      title: 'Наряд стартовый',
      status: 'Review',
      promoter_id: promoterUser.id,
      deadline_at: null,
      comment: null,
    },
  ];

  const detailsByOrder = new Map<number, OrderDetail>([
    [
      301,
      {
        id: 301,
        title: 'Наряд стартовый',
        status: 'Review',
        promoter_id: promoterUser.id,
        items: [
          {
            id: 401,
            address_id: 101,
            work_type_ids: [201, 202],
            comment: null,
          },
        ],
      },
    ],
  ]);

  const photosByOrder = new Map<number, Photo[]>([
    [
      301,
      [
        {
          id: 501,
          order_item_id: 401,
          work_type_id: 201,
          status: 'pending',
          reject_reason: null,
          url: '/api/v1/photos/file/501',
        },
      ],
    ],
  ]);

  const payouts: Payout[] = [
    {
      order_id: 301,
      amount_preliminary: 1200,
      amount_final: 1200,
      status: 'on_review',
    },
  ];

  let currentUser: User | null = null;
  let nextOrderId = 302;
  let nextOrderItemId = 402;
  let nextPhotoId = 502;

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '') || '/';
    const method = req.method().toUpperCase();

    if (method === 'POST' && path === '/auth/login') {
      currentUser = operatorUser;
      return json(route, 200, authPayload(operatorUser, 'operator-access', 'operator-refresh'));
    }

    if (method === 'POST' && path === '/auth/telegram') {
      currentUser = promoterUser;
      return json(route, 200, authPayload(promoterUser, 'promoter-access', 'promoter-refresh'));
    }

    if (method === 'POST' && path === '/auth/refresh') {
      if (!currentUser) {
        return badRequest(route, 'refresh session expired', 401);
      }
      const token = currentUser.role === 'operator' ? 'operator-access-r' : 'promoter-access-r';
      const refresh = currentUser.role === 'operator' ? 'operator-refresh-r' : 'promoter-refresh-r';
      return json(route, 200, authPayload(currentUser, token, refresh));
    }

    if (method === 'POST' && path === '/auth/logout') {
      currentUser = null;
      return json(route, 200, { ok: true });
    }

    if (!currentUser) {
      return badRequest(route, 'Unauthorized', 401);
    }

    if (method === 'GET' && path === '/users/me') {
      return json(route, 200, currentUser);
    }

    if (method === 'GET' && path === '/users/promoters') {
      if (currentUser.role !== 'operator') {
        return badRequest(route, 'Forbidden', 403);
      }
      return json(route, 200, promoters);
    }

    if (method === 'PATCH' && path.startsWith('/users/promoters/')) {
      if (currentUser.role !== 'operator') {
        return badRequest(route, 'Forbidden', 403);
      }
      const id = Number.parseInt(path.split('/')[3] || '', 10);
      const payload = req.postDataJSON() as { is_ready: boolean; suspicious_note: string | null };
      const promoter = promoters.find((item) => item.id === id);
      if (!promoter) {
        return badRequest(route, 'Promoter not found', 404);
      }
      promoter.is_ready = payload.is_ready;
      promoter.suspicious_note = payload.suspicious_note;
      return json(route, 200, promoter);
    }

    if (method === 'GET' && path === '/addresses') {
      return json(route, 200, addresses);
    }

    if (method === 'GET' && path === '/work-types') {
      return json(route, 200, workTypes);
    }

    if (method === 'GET' && path === '/orders') {
      if (currentUser.role === 'promoter') {
        return json(route, 200, orders.filter((item) => item.promoter_id === currentUser?.id));
      }
      return json(route, 200, orders);
    }

    if (method === 'POST' && path === '/orders') {
      if (currentUser.role !== 'operator') {
        return badRequest(route, 'Forbidden', 403);
      }
      const payload = req.postDataJSON() as {
        title: string;
        promoter_id: number;
        status: OrderStatus;
        items: Array<{ address_id: number; work_type_ids: number[]; comment: string | null }>;
      };

      const order: Order = {
        id: nextOrderId,
        title: payload.title,
        status: payload.status,
        promoter_id: payload.promoter_id,
        deadline_at: null,
        comment: null,
      };
      orders.unshift(order);

      const item = payload.items[0] || { address_id: addresses[0].id, work_type_ids: [workTypes[0].id], comment: null };
      detailsByOrder.set(nextOrderId, {
        id: nextOrderId,
        title: order.title,
        status: order.status,
        promoter_id: payload.promoter_id,
        items: [
          {
            id: nextOrderItemId,
            address_id: item.address_id,
            work_type_ids: item.work_type_ids,
            comment: item.comment,
          },
        ],
      });

      payouts.unshift({
        order_id: nextOrderId,
        amount_preliminary: 900,
        amount_final: 900,
        status: 'on_review',
      });

      photosByOrder.set(nextOrderId, [
        {
          id: nextPhotoId,
          order_item_id: nextOrderItemId,
          work_type_id: item.work_type_ids[0] || workTypes[0].id,
          status: 'pending',
          reject_reason: null,
          url: `/api/v1/photos/file/${nextPhotoId}`,
        },
      ]);

      nextOrderId += 1;
      nextOrderItemId += 1;
      nextPhotoId += 1;
      return json(route, 200, { id: order.id });
    }

    if (method === 'GET' && /^\/orders\/\d+$/.test(path)) {
      const orderId = Number.parseInt(path.split('/')[2] || '', 10);
      const detail = detailsByOrder.get(orderId);
      if (!detail) {
        return badRequest(route, 'Not found', 404);
      }
      if (currentUser.role === 'promoter' && detail.promoter_id !== currentUser.id) {
        return badRequest(route, 'Forbidden', 403);
      }
      return json(route, 200, detail);
    }

    if (method === 'PATCH' && /^\/orders\/\d+\/status$/.test(path)) {
      const orderId = Number.parseInt(path.split('/')[2] || '', 10);
      const payload = req.postDataJSON() as { status: OrderStatus };
      const order = orders.find((item) => item.id === orderId);
      if (!order) {
        return badRequest(route, 'Not found', 404);
      }
      order.status = payload.status;
      const payout = payouts.find((item) => item.order_id === orderId);
      if (payout && payload.status === 'Payment') {
        payout.status = 'to_pay';
      }
      return json(route, 200, { ok: true, status: payload.status });
    }

    if (method === 'GET' && path === '/payouts') {
      if (currentUser.role === 'promoter') {
        const orderIds = new Set(orders.filter((item) => item.promoter_id === currentUser?.id).map((item) => item.id));
        return json(route, 200, payouts.filter((item) => orderIds.has(item.order_id)));
      }
      return json(route, 200, payouts);
    }

    if (method === 'GET' && /^\/photos\/order\/\d+$/.test(path)) {
      const orderId = Number.parseInt(path.split('/')[3] || '', 10);
      const rows = photosByOrder.get(orderId) || [];
      return json(route, 200, rows);
    }

    if (method === 'PATCH' && /^\/photos\/\d+\/review$/.test(path)) {
      const photoId = Number.parseInt(path.split('/')[2] || '', 10);
      const payload = req.postDataJSON() as { status: 'accepted' | 'rejected'; reject_reason?: string | null };
      let targetOrderId = 0;

      photosByOrder.forEach((items, orderId) => {
        const photo = items.find((item) => item.id === photoId);
        if (photo) {
          targetOrderId = orderId;
          photo.status = payload.status;
          photo.reject_reason = payload.reject_reason || null;
        }
      });

      if (targetOrderId) {
        const payout = payouts.find((item) => item.order_id === targetOrderId);
        if (payout) {
          payout.status = payload.status === 'accepted' ? 'to_pay' : 'on_review';
        }
      }

      return json(route, 200, { ok: true });
    }

    if (method === 'POST' && path === '/photos') {
      const raw = req.postData() || '';
      const orderItemId = Number.parseInt(parseMultipartField(raw, 'order_item_id') || '', 10);
      const workTypeId = Number.parseInt(parseMultipartField(raw, 'work_type_id') || '', 10);

      let orderId = 0;
      detailsByOrder.forEach((detail, candidateOrderId) => {
        if (detail.items.some((item) => item.id === orderItemId)) {
          orderId = candidateOrderId;
        }
      });

      if (!orderId) {
        const fallback = orders.find((item) => item.promoter_id === currentUser?.id);
        orderId = fallback?.id || 0;
      }

      if (!orderId) {
        return badRequest(route, 'order item not found', 404);
      }

      const photoId = nextPhotoId++;
      const photo: Photo = {
        id: photoId,
        order_item_id: orderItemId || detailsByOrder.get(orderId)?.items[0]?.id || 0,
        work_type_id: workTypeId || workTypes[0].id,
        status: 'pending',
        reject_reason: null,
        url: `/api/v1/photos/file/${photoId}`,
      };

      const existing = photosByOrder.get(orderId) || [];
      existing.push(photo);
      photosByOrder.set(orderId, existing);

      return json(route, 200, { id: photoId, uploaded_at: '2026-02-15T00:00:00Z' });
    }

    if (method === 'GET' && /^\/photos\/file\/\d+$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: PNG_1PX,
      });
    }

    return badRequest(route, `Unhandled route: ${method} ${path}`, 404);
  });
}
