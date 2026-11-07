// Translate familiar CAD/printing labels without guessing what unknown geometry represents.
const labels = new Map(
  Object.entries({
    'main component': 'Componente central',
    'start component': 'Componente inicial',
    'end component': 'Componente final',
    main: 'Pieza principal',
    base: 'Base',
    bottom: 'Parte inferior',
    top: 'Parte superior',
    body: 'Cuerpo',
    'middle body': 'Parte central del cuerpo',
    middlebody: 'Parte central del cuerpo',
    lid: 'Tapa',
    cover: 'Cubierta',
    cap: 'Tapa',
    support: 'Soporte',
    stand: 'Soporte',
    holder: 'Soporte',
    frame: 'Marco',
    ring: 'Aro',
    pin: 'Pasador',
    joint: 'Unión',
    connector: 'Conector',
    handle: 'Asa',
    shade: 'Pantalla',
    lampshade: 'Pantalla de lámpara',
    'lamp shade': 'Pantalla de lámpara',
    face: 'Cara',
    head: 'Cabeza',
    beard: 'Barba',
    'beard2 test': 'Barba',
    hand: 'Mano',
    hand1: 'Mano izquierda',
    hand2: 'Mano derecha',
    'left hand': 'Mano izquierda',
    'right hand': 'Mano derecha',
    bootleft: 'Bota izquierda',
    bootright: 'Bota derecha',
    'left boot': 'Bota izquierda',
    'right boot': 'Bota derecha',
    'left eye': 'Ojo izquierdo',
    'right eye': 'Ojo derecho',
    lefteye: 'Ojo izquierdo',
    righteye: 'Ojo derecho',
    hatwhite: 'Parte blanca del gorro',
    'hat white': 'Parte blanca del gorro',
    hatred: 'Parte roja del gorro',
    'hat red': 'Parte roja del gorro',
    bottomred: 'Parte inferior roja',
    belt: 'Cinturón',
    tree: 'Árbol',
    star: 'Estrella',
    deer: 'Ciervo',
    front: 'Parte delantera',
    back: 'Parte trasera',
    left: 'Pieza izquierda',
    right: 'Pieza derecha',
  }),
);
const spanish =
  /^(?:pieza|parte|base|tapa|cuerpo|cara|cabeza|mano|barba|bota|ojo|gorro|cinturón|union|unión|soporte|pantalla|aro|pasador|conector|componente|árbol|arbol|estrella|ciervo|marco|asa|cubierta)(?:\s|$)/i;
export function pieceNameInSpanish(name, number) {
  const original = String(name || '')
    .replace(/\.(?:stl|3mf|glb|obj)$/i, '')
    .trim();
  const normalized = original
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stem = normalized.replace(/\s+\d+$/, '');
  const translated =
    labels.get(normalized.toLowerCase()) || labels.get(stem.toLowerCase());
  if (translated) return number + '. ' + translated;
  if (spanish.test(normalized)) return number + '. ' + normalized;
  return 'Pieza ' + number;
}
