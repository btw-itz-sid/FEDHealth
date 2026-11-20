import type { CSSProperties } from 'react';

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  network: 'M12 8V4 M5 16v-4h14v4 M12 12v4 M9 1h6v6H9z M2 17h6v6H2z M9 17h6v6H9z M16 17h6v6h-6z',
  database: 'M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3z M4 6v6c0 2 3.6 3 8 3s8-1 8-3V6 M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6',
  flask: 'M9 3h6 M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3 M8 15h8',
  chart: 'M4 3v17h17 M8 15v-4 M13 15V7 M18 15v-6',
  layers: 'm12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
  pulse: 'M2 12h5l3-8 4 16 3-8h5',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  users: 'M16 21v-2a6 6 0 0 0-12 0v2 M14 4a4 4 0 1 1 0 8 M20 21v-3a5 5 0 0 0-3-4 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2 M12 17h.01',
  close: 'm6 6 12 12 M18 6 6 18',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  logout: 'M9 4H4v16h5 M10 12h11 m-4-4 4 4-4 4',
  chevron: 'm9 5 7 7-7 7',
  chevronDown: 'm6 9 6 6 6-6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 m-2 5 6 6',
  check: 'm5 12 4 4L19 6',
  lock: 'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3',
  upload: 'M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6',
  download: 'M12 3v13 m-5-5 5 5 5-5 M4 17v4h16v-4',
  play: 'm8 4 12 8-12 8z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'm3 3 18 18 M10 5h2c6 0 10 7 10 7a20 20 0 0 1-4 5 M6 6a20 20 0 0 0-4 6s4 7 10 7c2 0 3-.5 4-1 M10 10a3 3 0 0 0 4 4',
  file: 'M14 2H5v20h14V7z M14 2v6h5 M8 13h8 M8 17h5',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01',
  refresh: 'M20 7a9 9 0 1 0 1 9 M20 2v6h-6',
} as const;

export type IconName = keyof typeof paths;
export default function Icon({ name, size = 20, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}><path d={paths[name]} /></svg>;
}
