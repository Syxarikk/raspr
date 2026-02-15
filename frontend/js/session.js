const SESSION_KEY = 'adcontrol.standalone.session.v1';

export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const accessToken = typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
    const refreshToken = typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null;
    const user = parsed.user && typeof parsed.user === 'object' ? parsed.user : null;

    if (!accessToken || !user) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      user,
    };
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
