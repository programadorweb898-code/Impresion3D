import { useState } from 'react';
import {
  localityProvinces,
  provinceLocalities,
  getLocality,
} from '@impresion3d/shared/localities';
const searchable = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
export default function DeliveryLocation({ delivery, onChange }) {
  const [search, setSearch] = useState('');
  const localities = provinceLocalities(delivery.provinceId);
  const filtered = localities.filter((item) =>
    searchable(item.name + ' ' + item.department).includes(
      searchable(search.trim()),
    ),
  );
  const selected = getLocality(delivery.localityId);
  if (selected && !filtered.some((item) => item.id === selected.id))
    filtered.unshift(selected);
  return (
    <>
      <label htmlFor="delivery-province">Provincia</label>
      <select
        id="delivery-province"
        autoComplete="address-level1"
        required
        value={delivery.provinceId || ''}
        onChange={(event) => {
          setSearch('');
          onChange({
            ...delivery,
            provinceId: event.target.value,
            localityId: '',
            city: '',
          });
        }}
      >
        <option value="">Elegí una provincia</option>
        {localityProvinces.map((province) => (
          <option key={province.id} value={province.id}>
            {province.name}
          </option>
        ))}
      </select>
      <label htmlFor="delivery-locality-search">Buscar localidad</label>
      <input
        id="delivery-locality-search"
        type="search"
        placeholder="Buscá por nombre o partido"
        disabled={!delivery.provinceId}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label htmlFor="delivery-city">Localidad</label>
      <select
        id="delivery-city"
        required
        autoComplete="address-level2"
        disabled={!delivery.provinceId}
        value={delivery.localityId || ''}
        aria-describedby="delivery-locality-help"
        onChange={(event) => {
          const locality = getLocality(event.target.value);
          onChange({
            ...delivery,
            localityId: locality?.id || '',
            city: locality?.name || '',
          });
        }}
      >
        <option value="">Elegí una localidad de la lista</option>
        {filtered.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} — {item.department}
          </option>
        ))}
      </select>
      <p id="delivery-locality-help" className="small">
        El listado indica el partido o departamento para distinguir localidades
        con el mismo nombre. El código postal se ingresa aparte.
      </p>
      {delivery.provinceId && !filtered.length && (
        <p role="status" className="small">
          No encontramos localidades con esa búsqueda. Probá con otro nombre.
        </p>
      )}
    </>
  );
}
