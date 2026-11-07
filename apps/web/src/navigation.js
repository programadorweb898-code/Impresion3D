import { legalPageFromPath } from '@impresion3d/shared';
const key = 'impresion3dNavigation';
export function currentPage() {
  let path = location.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* Invalid escapes are handled as unavailable routes. */
  }
  const detail = path.match(
    /^\/(?:descripcion|descripción|descripction|description)(?:\/(.*))?$/u,
  );
  if (detail)
    return { view: 'product', id: (detail[1] || '').replace(/\/$/, '') };
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
  if (!history.state?.[key])
    history.replaceState(
      {
        ...history.state,
        [key]: {
          depth: 0,
          view: location.pathname === '/login' ? 'login' : currentPage().view,
        },
      },
      '',
    );
}
export function navigatePage(view, path, { replace = false } = {}) {
  initializeNavigation();
  const current = history.state[key];
  if (
    current.view === view &&
    location.pathname + location.search + location.hash === path
  )
    return;
  const state = {
    ...history.state,
    [key]: { ...current, depth: current.depth + (replace ? 0 : 1), view },
  };
  if (replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
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
    category: typeof saved?.category === 'string' ? saved.category : 'Todos',
  };
}
export function rememberCatalog(page, category) {
  initializeNavigation();
  history.replaceState(
    {
      ...history.state,
      [key]: { ...history.state[key], catalog: { page, category } },
    },
    '',
  );
}
