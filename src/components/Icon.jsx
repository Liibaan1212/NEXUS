function segmentToElement(seg, key) {
  if (seg.startsWith('circle:')) {
    const [cx, cy, r] = seg.slice(7).split(',');
    return <circle key={key} cx={cx} cy={cy} r={r} />;
  }
  if (seg.startsWith('ellipse:')) {
    const [cx, cy, rx, ry] = seg.slice(8).split(',');
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} />;
  }
  if (seg.startsWith('rect:')) {
    const [x, y, w, h, rx] = seg.slice(5).split(',');
    return <rect key={key} x={x} y={y} width={w} height={h} rx={rx || undefined} />;
  }
  if (seg.startsWith('line:')) {
    const [x1, y1, x2, y2] = seg.slice(5).split(',');
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />;
  }
  if (seg.endsWith(':polygon')) return <polygon key={key} points={seg.slice(0, -8)} />;
  if (seg.endsWith(':polyline')) return <polyline key={key} points={seg.slice(0, -9)} />;
  if (/^[Mm]/.test(seg)) return <path key={key} d={seg} />;
  return <polyline key={key} points={seg} />;
}

export default function Icon({ icon, className = 'w-4 h-4 shrink-0' }) {
  const segments = icon.split('|');
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24">
      {segments.map((seg, i) => segmentToElement(seg, i))}
    </svg>
  );
}
