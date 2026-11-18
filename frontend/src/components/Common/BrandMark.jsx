import React from 'react';

/**
 * Architectural monolith emblem unique to HARKONNEN.
 * Geometric H-pillar silhouette with precision negative space.
 */
export function BrandMark({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.2"
      />
      <path
        d="M9.5 8.5H12.75V14.4H19.25V8.5H22.5V23.5H19.25V17.4H12.75V23.5H9.5V8.5Z"
        fill="currentColor"
      />
      <rect x="14.4" y="14.9" width="3.2" height="2" rx="0.5" fill="var(--accent)" />
    </svg>
  );
}
