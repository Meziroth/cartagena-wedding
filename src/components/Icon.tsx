// Line icons from reference/prototype.html (one path each, 24×24 grid).
const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  checklist: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  budget: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2zM16.5 14h.01',
  vendors: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM9.5 20v-6h5v6',
  inspiration: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  guests: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  notes: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5',
  details: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.6-1.7',
  plus: 'M12 5v14M5 12h14',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, width = 1.8 }: { name: IconName; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={name === 'more' ? 3.2 : width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

/** Cement-tile pattern definition. Render once near the root; TilesBackground references it. */
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern id="tilePat" width="56" height="56" patternUnits="userSpaceOnUse">
          <g className="t">
            <circle cx="28" cy="17" r="9" /><circle cx="39" cy="28" r="9" /><circle cx="28" cy="39" r="9" /><circle cx="17" cy="28" r="9" />
            <path d="M0 0h8a8 8 0 0 1-8 8zM56 0v8a8 8 0 0 1-8-8zM0 56v-8a8 8 0 0 1 8 8zM56 56h-8a8 8 0 0 1 8-8z" />
          </g>
          <circle cx="28" cy="28" r="4.5" fill="var(--surface)" />
        </pattern>
      </defs>
    </svg>
  );
}

export function TilesBackground() {
  return (
    <svg className="tiles" aria-hidden="true">
      <rect width="100%" height="100%" fill="url(#tilePat)" />
    </svg>
  );
}
