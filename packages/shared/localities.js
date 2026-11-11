import data from './localities.json' with { type: 'json' };
export const localityProvinces = data.provinces.map(({ id, name }) => ({
  id,
  name,
}));
const byId = new Map();
for (const province of data.provinces)
  for (const locality of province.localities)
    byId.set(locality.id, {
      ...locality,
      provinceId: province.id,
      province: province.name,
    });
export const getLocality = (id) => byId.get(id);
export const provinceLocalities = (provinceId) =>
  data.provinces.find((p) => p.id === provinceId)?.localities || [];
export function validDeliveryLocality(delivery) {
  if (!delivery.localityId && !delivery.provinceId) return true; // Earlier clients.
  const locality = getLocality(delivery.localityId);
  return (
    !!locality &&
    locality.provinceId === delivery.provinceId &&
    locality.name === delivery.city
  );
}
