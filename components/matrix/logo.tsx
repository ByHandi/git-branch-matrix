type Props = { className?: string };

/** Same mark as app/icon.svg — the ticket × environment grid, filling up. */
function Logo({ className = "size-5" }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Git Branch Matrix">
      <rect width="32" height="32" rx="7" fill="#0EA5E9" />
      <g fill="#FFFFFF">
        <rect x="6" y="6" width="5" height="5" rx="1.5" />
        <rect x="13.5" y="6" width="5" height="5" rx="1.5" />
        <rect x="21" y="6" width="5" height="5" rx="1.5" />
        <rect x="6" y="13.5" width="5" height="5" rx="1.5" />
        <rect x="13.5" y="13.5" width="5" height="5" rx="1.5" />
        <rect x="6" y="21" width="5" height="5" rx="1.5" />
      </g>
      <g fill="#0B5F87">
        <rect x="21" y="13.5" width="5" height="5" rx="1.5" />
        <rect x="13.5" y="21" width="5" height="5" rx="1.5" />
        <rect x="21" y="21" width="5" height="5" rx="1.5" />
      </g>
    </svg>
  );
}

export default Logo;
