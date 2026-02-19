const icons = {
  saved: (
    <path d="M7 3a2 2 0 0 0-2 2v14l7-4 7 4V5a2 2 0 0 0-2-2H7z" />
  ),
  start: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </>
  ),
  stops: (
    <>
      <rect x="3.5" y="5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="5" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  end: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  navigation: (
    <path d="M12 2 4 20l8-3 8 3L12 2z" />
  ),
  optimize: (
    <>
      <circle cx="5" cy="7" r="2" />
      <circle cx="19" cy="17" r="2" />
      <path d="M7 7h6a4 4 0 1 1 0 8H8" />
      <path d="m10 13-2 2 2 2" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h5a4 4 0 0 1 0 8H9" />
      <path d="m11 14-2 2 2 2" />
    </>
  ),
  map: (
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5zm6-.8v11.8m6-10.9v11.8" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  drive: (
    <>
      <path d="M4 12h16l-1-4.5A2 2 0 0 0 17.1 6H6.9A2 2 0 0 0 5 7.5L4 12zm0 0v4h2m14-4v4h-2" />
      <circle cx="7.5" cy="14.5" r="1.2" />
      <circle cx="16.5" cy="14.5" r="1.2" />
    </>
  )
};

const UiIcon = ({ name, className = '' }) => {
  const icon = icons[name];
  if (!icon) {
    return null;
  }

  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon}
    </svg>
  );
};

export default UiIcon;
