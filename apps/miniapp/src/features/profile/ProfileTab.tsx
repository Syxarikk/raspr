import { getInitials } from '../../lib/format';
import { TOKEN_STORAGE_KEY } from '../../lib/api';
import type { User } from '../../types/api';

interface ProfileTabProps {
  me: User | null;
}

export function ProfileTab({ me }: ProfileTabProps) {
  if (!me) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Загрузка профиля...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card profile-card">
        <div className="avatar">{getInitials(me.full_name)}</div>
        <div className="profile-name">{me.full_name}</div>
        <div className="profile-username">@{me.username || 'no-username'}</div>
        <div className="profile-status">
          <span className={`status-dot ${me.is_ready ? '' : 'inactive'}`}></span>
          {me.is_ready ? 'Готов брать наряды' : 'Не берет наряды'}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>📞 Контакты</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <span style={{ color: '#718096' }}>{me.phone || 'Не указан'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <span style={{ color: '#718096' }}>@{me.username || 'no-username'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🆔</span>
            <span style={{ color: '#718096' }}>ID: {me.id}</span>
          </div>
        </div>
      </div>

      {me.suspicious_note && (
        <div className="card" style={{ background: '#fff5f5', borderLeft: '4px solid #fc8181' }}>
          <div className="card-title" style={{ color: '#c53030', marginBottom: 8 }}>⚠️ Примечание</div>
          <div style={{ color: '#742a2a' }}>{me.suspicious_note}</div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>⚙️ Настройки</div>
        <button
          className="primary-btn"
          onClick={() => {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            window.location.reload();
          }}
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
