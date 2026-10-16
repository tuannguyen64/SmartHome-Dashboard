// Icon minh hoạ lấy từ Figma (src/assets/icons) + bộ icon nét dùng cho nút thao tác.
import thermometer from '../assets/icons/thermometer.svg';
import drop from '../assets/icons/drop.svg';
import sun from '../assets/icons/sun.svg';
import bulb from '../assets/icons/bulb.svg';
import rainbow from '../assets/icons/rainbow.svg';
import fan from '../assets/icons/fan.svg';
import fanTile from '../assets/icons/fan-tile.svg';
import house from '../assets/icons/house.svg';
import bell from '../assets/icons/bell.svg';
import wave from '../assets/icons/wave.svg';
import warning from '../assets/icons/warning.svg';
import eye from '../assets/icons/eye.svg';
import brandMark from '../assets/icons/brand-mark.svg';
import thermometerWhite from '../assets/icons/thermometer-white.svg';
import circleSm from '../assets/icons/circle-sm.svg';
import circleLg from '../assets/icons/circle-lg.svg';

export const FIGMA_ICONS = {
  thermometer,
  drop,
  sun,
  bulb,
  rainbow,
  fan,
  fanTile,
  house,
  bell,
  wave,
  warning,
  eye,
  brandMark,
  thermometerWhite,
  circleSm,
  circleLg,
};

export function FigmaIcon({ name, size = 24, width, height, alt = '', style, className }) {
  return (
    <img
      src={FIGMA_ICONS[name]}
      width={width ?? size}
      height={height ?? size}
      alt={alt}
      style={style}
      className={className}
    />
  );
}

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6L6 18',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 9v4M12 17h.01M10.3 4.3L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5-2.5M19 12.6a10 10 0 0 0-2.4-1.7M12 20h.01',
  home: 'M4 11l8-6 8 6v9H4zM10 20v-5h4v5',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3',
};

export function Icon({ name, size = 18, stroke = 2, style, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
