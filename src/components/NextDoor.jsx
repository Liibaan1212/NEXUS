export default function NextDoor() {
  const nextDoorUrl = new URL('/index.html', window.location.href);
  nextDoorUrl.port = '4174';

  return (
    <a
      className="next-door-link"
      href={nextDoorUrl.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Next Door in a new tab"
      title="Open AI Engineering from Scratch in a new tab"
    >
      <svg className="next-door-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path className="next-door-frame" d="M5 27V8.5L16 3l11 5.5V27" />
        <path className="next-door-panel" d="M10 27V10l12-4v21" />
        <circle className="next-door-knob" cx="19" cy="18" r="1" />
        <path className="next-door-glint" d="m25 6 1-2m2 5 2-1M4 5 3 3" />
      </svg>
      <span className="next-door-label">Next Door</span>
    </a>
  );
}
