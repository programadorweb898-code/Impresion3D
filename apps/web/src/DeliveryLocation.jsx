import {
  localityProvinces,
  provinceLocalities,
  getLocality,
} from '@impresion3d/shared/localities';
export default function DeliveryLocation({ delivery, onChange }) {
  // Georef includes both census localities and components with identical labels.
  // Keep one option per name/department, preserving an already selected ID.
  const byLabel = new Map();
  for (const item of provinceLocalities(delivery.provinceId)) {
    const key = JSON.stringify([item.name, item.department]);
    if (!byLabel.has(key) || item.id === delivery.localityId)
      byLabel.set(key, item);
  }
  const localities = [...byLabel.values()];
  return (
    <>
      <label htmlFor="delivery-province">Provincia</label>
      <select
        id="delivery-province"
        autoComplete="address-level1"
        required
        value={delivery.provinceId || ''}
        onChange={(event) => {
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
        {localities.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} — {item.department}
          </option>
        ))}
      </select>
      <p id="delivery-locality-help" className="small">
        El listado indica el partido o departamento para distinguir localidades
        con el mismo nombre. El código postal se ingresa aparte.
      </p>
      {delivery.provinceId && !localities.length && (
        <p role="status" className="small">
          No hay localidades disponibles para esta provincia.
        </p>
      )}
    </>
  );
}
