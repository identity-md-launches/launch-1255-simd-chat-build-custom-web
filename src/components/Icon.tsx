export type IconName =
  | "home"
  | "chart"
  | "guide"
  | "settings"
  | "arrow"
  | "refresh"
  | "search"
  | "chevron"
  | "download"
  | "check"
  | "info"
  | "external"
  | "activity"
  | "clock"
  | "shield"
  | "globe"
  | "pause"
  | "play"
  | "close"
  | "plus"
  | "trend"
  | "layers";
const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15l4-5 4 3 5-8" />
    </>
  ),
  guide: (
    <>
      <path d="M12 5v16M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 3 2 2v3l2 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2V6l-3-1-2 1-2-3Z" />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  chevron: <path d="m8 5 7 7-7 7" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-11v1" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
    </>
  ),
  activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-10M15 5h6v6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5" />
    </>
  ),
};
export default function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
