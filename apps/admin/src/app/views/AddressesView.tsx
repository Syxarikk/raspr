import { useCallback, useMemo, useState } from 'react';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import SwapVertRounded from '@mui/icons-material/SwapVertRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';

import { MapSurface, ModalShell, SearchInput } from '../components/common';
import type { AddressCreatePayload, ApiAddress, Marker, StreetGroup } from '../types';

export function AddressesView({
  addresses,
  mapMarkers,
  onCreateAddress,
  onImportCsv,
  onDeleteAddress,
}: {
  addresses: ApiAddress[];
  mapMarkers: Marker[];
  onCreateAddress: (payload: AddressCreatePayload) => Promise<void>;
  onImportCsv: (file: File) => Promise<number>;
  onDeleteAddress: (addressId: number) => Promise<void>;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    district: '',
    street: '',
    building: '',
    lat: '',
    lng: '',
    comment: '',
  });

  const groups = useMemo<StreetGroup[]>(() => {
    const map = new Map<string, StreetGroup>();

    addresses.forEach((address) => {
      const district = address.district || 'Без района';
      const key = `${district}::${address.street}`;
      const existing = map.get(key);
      if (existing) {
        existing.addresses.push(address);
      } else {
        map.set(key, { district, street: address.street, addresses: [address] });
      }
    });

    const prepared = Array.from(map.values());
    prepared.forEach((group) => group.addresses.sort((left, right) => left.building.localeCompare(right.building, 'ru')));
    prepared.sort((left, right) => {
      const districtDiff = left.district.localeCompare(right.district, 'ru');
      if (districtDiff !== 0) return districtDiff;
      return left.street.localeCompare(right.street, 'ru');
    });

    if (!query.trim()) {
      return prepared;
    }

    const normalized = query.trim().toLowerCase();
    return prepared
      .map((group) => ({
        ...group,
        addresses: group.addresses.filter(
          (address) =>
            address.street.toLowerCase().includes(normalized) ||
            address.building.toLowerCase().includes(normalized) ||
            (address.district || '').toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.addresses.length > 0);
  }, [addresses, query]);

  const submitAddress = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!draft.street.trim() || !draft.building.trim()) {
        return;
      }

      const lat = draft.lat.trim() ? Number.parseFloat(draft.lat) : null;
      const lng = draft.lng.trim() ? Number.parseFloat(draft.lng) : null;

      const payload: AddressCreatePayload = {
        district: draft.district.trim() || null,
        street: draft.street.trim(),
        building: draft.building.trim(),
        lat: Number.isFinite(lat ?? Number.NaN) ? lat : null,
        lng: Number.isFinite(lng ?? Number.NaN) ? lng : null,
        comment: draft.comment.trim() || null,
      };

      setCreateBusy(true);
      try {
        await onCreateAddress(payload);
        setCreateOpen(false);
        setDraft({ district: '', street: '', building: '', lat: '', lng: '', comment: '' });
      } finally {
        setCreateBusy(false);
      }
    },
    [draft, onCreateAddress],
  );

  const submitCsv = useCallback(async () => {
    if (!csvFile) {
      return;
    }
    setImportBusy(true);
    try {
      await onImportCsv(csvFile);
      setCsvFile(null);
    } finally {
      setImportBusy(false);
    }
  }, [csvFile, onImportCsv]);

  let lastDistrict = '';

  return (
    <div className="split-layout double">
      <section className="panel list-panel">
        <div className="section-header">
          <h2>Адреса</h2>
          <div className="inline-actions">
            <button className="ghost-link" type="button" onClick={() => setCreateOpen(true)}>
              <AddRounded fontSize="small" />
              Добавить
            </button>
          </div>
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Поиск адреса по списку" />

        <div className="control-row">
          <span>Адреса в базе</span>
          <div className="control-buttons">
            <button className="icon-btn" type="button"><TuneRounded fontSize="small" /></button>
            <button className="icon-btn" type="button"><SwapVertRounded fontSize="small" /></button>
          </div>
        </div>

        <div className="upload-box">
          <label className="file-btn">
            <FileUploadOutlined fontSize="small" />
            Импорт CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="secondary-btn" type="button" disabled={!csvFile || importBusy} onClick={() => void submitCsv()}>
            {importBusy ? 'Загрузка...' : 'Импортировать'}
          </button>
          {csvFile ? <span className="small-text">{csvFile.name}</span> : <span className="small-text">Файл не выбран</span>}
        </div>

        <div className="scroll-area">
          {groups.map((group) => {
            const districtHeader = lastDistrict !== group.district;
            lastDistrict = group.district;

            return (
              <div key={`${group.district}-${group.street}`} className="address-group reveal">
                {districtHeader ? <h4>{group.district.toUpperCase()}</h4> : null}

                <div className="address-line">
                  <strong>ул. {group.street}</strong>
                  <KeyboardArrowDownRounded fontSize="small" />
                </div>

                <div className="chip-row">
                  {group.addresses.slice(0, 16).map((address) => (
                    <span key={address.id} className="mini-chip" style={{ position: 'relative', paddingRight: 28 }}>
                      {address.building}
                      <button
                        className="icon-btn"
                        type="button"
                        style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', padding: 2, minWidth: 20, height: 20 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteAddress(address.id);
                        }}
                        title="Удалить адрес"
                      >
                        <DeleteOutlineRounded fontSize="inherit" style={{ fontSize: 14 }} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {!groups.length ? <div className="empty-text">Адреса не найдены</div> : null}
        </div>
      </section>

      <section className="panel map-panel">
        <MapSurface markers={mapMarkers} activeDock="addresses" />
      </section>

      <ModalShell open={createOpen} title="Добавить адрес" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitAddress} className="stack">
          <div className="field-row">
            <label className="field">
              <span>Район</span>
              <input value={draft.district} onChange={(event) => setDraft((prev) => ({ ...prev, district: event.target.value }))} />
            </label>
            <label className="field">
              <span>Улица *</span>
              <input
                value={draft.street}
                onChange={(event) => setDraft((prev) => ({ ...prev, street: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Дом *</span>
              <input
                value={draft.building}
                onChange={(event) => setDraft((prev) => ({ ...prev, building: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Комментарий</span>
              <input value={draft.comment} onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>lat</span>
              <input value={draft.lat} onChange={(event) => setDraft((prev) => ({ ...prev, lat: event.target.value }))} />
            </label>
            <label className="field">
              <span>lng</span>
              <input value={draft.lng} onChange={(event) => setDraft((prev) => ({ ...prev, lng: event.target.value }))} />
            </label>
          </div>

          <div className="modal-actions">
            <button className="secondary-btn" type="button" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button className="primary-btn" type="submit" disabled={createBusy}>
              {createBusy ? 'Сохраняем...' : 'Создать адрес'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
