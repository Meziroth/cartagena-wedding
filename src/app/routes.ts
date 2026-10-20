import type { IconName } from '../components/Icon';

export type RouteId = 'home' | 'checklist' | 'budget' | 'vendors' | 'inspiration' | 'guests' | 'notes' | 'details';

/** Sidebar order, as in the prototype. Paths are hash routes (#/budget) because GitHub Pages has no SPA rewrites. */
export const ROUTES: { id: RouteId; path: string; icon: IconName }[] = [
  { id: 'home', path: '/', icon: 'home' },
  { id: 'checklist', path: '/checklist', icon: 'checklist' },
  { id: 'budget', path: '/budget', icon: 'budget' },
  { id: 'vendors', path: '/vendors', icon: 'vendors' },
  { id: 'inspiration', path: '/inspiration', icon: 'inspiration' },
  { id: 'guests', path: '/guests', icon: 'guests' },
  { id: 'notes', path: '/notes', icon: 'notes' },
  { id: 'details', path: '/details', icon: 'details' },
];

/** Phone tab bar; everything else lives under More. */
export const TABS: RouteId[] = ['home', 'checklist', 'budget', 'inspiration'];

export const pathOf = (id: RouteId): string => ROUTES.find((r) => r.id === id)!.path;
