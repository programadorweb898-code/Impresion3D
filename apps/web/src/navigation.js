import { informationPages } from './site-content.js';
import { legalPageFromPath } from '@impresion3d/shared';
const key = 'impresion3dNavigation';
const positions = new Map();
let activeEntry;
const entryId = () => crypto.randomUUID();
const position = () => ({ x: window.scrollX, y: window.scrollY });
export function savedScrollPosition() {
  const entry = history.state?.[key];
  const saved = positions.get(entry?.id) || entry?.scroll;
  return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? saved
    : null;
}
export function rememberScrollPosition() {
  initializeNavigation();
  const entry = history.state[key];
  const scroll = position();
  positions.set(entry.id, scroll);
  history.replaceState({ ...history.state, [key]: { ...entry, scroll } }, '');
}
export function traverseHistory() {
  const next = history.state?.[key]?.id;
  if (activeEntry && activeEntry !== next)
    positions.set(activeEntry, position());
  initializeNavigation();
  activeEntry = history.state[key].id;
  return savedScrollPosition();
}

export function currentPage() {
  let path = location.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* Invalid escapes are handled as unavailable routes. */
  }
  const offer = path.match(/^\/descripction\/oferta\/([^/]+)\/?$/);
  if (offer) return { view: 'offer', id: offer[1] };
  const detail = path.match(
    /^\/(?:descripcion|descripción|descripction|description)(?:\/(.*))?$/u,
  );
  if (detail)
    return { view: 'product', id: (detail[1] || '').replace(/\/$/, '') };
  const information = Object.keys(informationPages).find(
    (key) => informationPages[key].path === path.replace(/\/$/, ''),
  );
  if (information) return { view: information, id: null };
  const legal = legalPageFromPath(path);
  if (legal) return { view: legal, id: null };
  if (/^\/disenar\/?$/.test(path)) return { view: 'design', id: null };
  if (path === '/perfil') return { view: 'profile', id: null };
  if (path === '/login') return { view: 'catalog', id: null };
  const saved = history.state?.[key]?.view;
  return {
    view: ['catalog', 'orders', 'admin'].includes(saved) ? saved : 'catalog',
    id: null,
  };
}
export function initializeNavigation() {
  if (!history.state?.[key]?.id)
    history.replaceState(
      {
        ...history.state,
        [key]: {
          ...history.state?.[key],
          id: entryId(),
          depth: history.state?.[key]?.depth || 0,
          view: location.pathname === '/login' ? 'login' : currentPage().view,
        },
      },
      '',
    );
  activeEntry ||= history.state[key].id;
}
export function navigatePage(view, path, { replace = false } = {}) {
  initializeNavigation();
  rememberScrollPosition();
  const current = history.state[key];
  if (
    current.view === view &&
    location.pathname + location.search + location.hash === path
  )
    return;
  const state = {
    ...history.state,
    [key]: {
      ...current,
      id: entryId(),
      scroll: null,
      depth: current.depth + (replace ? 0 : 1),
      view,
    },
  };
  if (replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
  activeEntry = state[key].id;
}
export function returnToPreviousPage() {
  if ((history.state?.[key]?.depth || 0) > 0) {
    history.back();
    return true;
  }
  return false;
}

export function catalogContext() {
  const saved = history.state?.[key]?.catalog;
  return {
    page: Number.isInteger(saved?.page) && saved.page > 0 ? saved.page : 1,
    search: typeof saved?.search === 'string' ? saved.search : '',
    priceMin: typeof saved?.priceMin === 'string' ? saved.priceMin : '',
    priceMax: typeof saved?.priceMax === 'string' ? saved.priceMax : '',
    sort: ['relevance', 'price-asc', 'price-desc'].includes(saved?.sort)
      ? saved.sort
      : 'relevance',
    category:
      new URLSearchParams(location.search).get('categoria') ||
      (typeof saved?.category === 'string' ? saved.category : 'Todos'),
  };
}
export function rememberCatalog(page, category, filters = {}) {
  initializeNavigation();
  history.replaceState(
    {
      ...history.state,
      [key]: { ...history.state[key], catalog: { page, category, ...filters } },
    },
    '',
  );
}
