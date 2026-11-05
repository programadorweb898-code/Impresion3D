import scenes from './product-scenes.json';

// Match both ID and original photo: a replacement catalog photo must never
// silently inherit a scene generated for the old product image.
export function productGalleryImages(product) {
  const original = product.image?.url;
  const scene = scenes[product._id];
  const context = product.gallery?.context?.url ||
    (scene?.source === original ? scene.url : null);
  return [
    original && { id: 'principal', url: original, label: 'Principal' },
    original && { id: 'rotated', url: original, label: 'Girado 45°', rotated: true },
    context && { id: 'context', url: context, label: 'En uso' },
  ].filter(Boolean);
}
