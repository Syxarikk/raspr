import { useCallback, useState } from 'react';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';

import { formatMoney } from '../utils';
import type { ApiWorkType, WorkTypeCreatePayload } from '../types';

export function TypesView({
  workTypes,
  onCreateWorkType,
  onDeleteWorkType,
}: {
  workTypes: ApiWorkType[];
  onCreateWorkType: (payload: WorkTypeCreatePayload) => Promise<void>;
  onDeleteWorkType: (workTypeId: number) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('10');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = Number.parseFloat(price);
      if (!name.trim() || !Number.isFinite(parsed)) {
        return;
      }
      setBusy(true);
      try {
        await onCreateWorkType({ name: name.trim(), price_per_unit: parsed, is_active: active });
        setName('');
        setPrice('10');
        setActive(true);
      } finally {
        setBusy(false);
      }
    },
    [active, name, onCreateWorkType, price],
  );

  return (
    <section className="types-view">
      <header className="page-header compact">
        <div>
          <h1>Типы рекламы</h1>
          <p>Управление стоимостью и активностью работ.</p>
        </div>
      </header>

      <form className="card inline-form" onSubmit={submit}>
        <label className="field">
          <span>Название *</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="field">
          <span>Цена за единицу *</span>
          <input value={price} onChange={(event) => setPrice(event.target.value)} required />
        </label>

        <label className="check-item">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>Активный тип</span>
        </label>

        <button className="primary-btn" type="submit" disabled={busy}>
          <AddRounded fontSize="small" />
          {busy ? 'Создаем...' : 'Добавить'}
        </button>
      </form>

      <div className="types-grid">
        {workTypes.map((workType, index) => (
          <article key={workType.id} className="card type-card reveal" style={{ animationDelay: `${index * 40}ms`, position: 'relative' }}>
            <button
              className="icon-btn"
              type="button"
              style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => void onDeleteWorkType(workType.id)}
              title="Удалить тип работы"
            >
              <DeleteOutlineRounded fontSize="small" />
            </button>
            <h3>{workType.name}</h3>
            <strong>{formatMoney(Number(workType.price_per_unit))} ₽</strong>
            <span className={`status-pill ${workType.is_active ? 'is-progress' : 'is-draft'}`}>
              {workType.is_active ? 'Активен' : 'Отключен'}
            </span>
          </article>
        ))}

        {!workTypes.length ? <div className="empty-text">Типы работ отсутствуют</div> : null}
      </div>
    </section>
  );
}
