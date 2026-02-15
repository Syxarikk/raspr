import { useState } from 'react';

import { telegramLogin } from '../../lib/api';

interface AuthScreenProps {
  onLogin: (token: string) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const token = await telegramLogin();
      onLogin(token);
    } catch {
      alert('Ошибка входа. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">A</div>
        <h1>AdControl</h1>
        <p>Управление нарядами для промоутеров. Войдите, чтобы начать работу.</p>
        <button className="primary-btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Входим...' : '🚀 Войти через Telegram'}
        </button>
      </div>
    </div>
  );
}
