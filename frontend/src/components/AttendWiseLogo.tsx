import React from "react";

interface AttendWiseLogoProps {
  /** Size of the logomark square (px). Default: 32 */
  size?: number;
  /** Foreground color of the mark. Default: white */
  color?: string;
  /** Background color of the container square. Default: #0f172a */
  bg?: string;
  /** Whether to render the container square. Default: true */
  withBg?: boolean;
  /** Extra className for the outermost element */
  className?: string;
}

/**
 * AttendWise premium geometric logo mark.
 *
 * The symbol is composed of three elements:
 *   1. A calm baseline arc (bottom) — continuity, the full semester arc
 *   2. A clean ascending diagonal path — trend / attendance rising
 *   3. A precise terminal dot — the current moment, precision
 *
 * Together they read as an abstract "AW" movement: grounded yet upward.
 * Monochromatic, scalable to any size, works dark/light.
 */
export const AttendWiseLogo: React.FC<AttendWiseLogoProps> = ({
  size = 32,
  color = "#ffffff",
  bg = "#0f172a",
  withBg = true,
  className = "",
}) => {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AttendWise logo mark"
    >
      {/*
        The mark — three-element geometric composition:

        Element 1: Baseline arc — bottom semi-circle suggesting the
        semester arc / horizon. Calm, grounding.

        Element 2: Rising path — two angular strokes that meet at a
        high central vertex, reading as a "W" turned into a trend line.
        Precise and directional.

        Element 3: Terminal dot — a crisp circle at the peak of the
        ascending line. The current moment. Precision.
      */}

      {/* Baseline arc: calm half-ellipse anchoring the composition */}
      <path
        d="M 7 22 Q 16 28 25 22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Rising double-stroke "W" trend: two upward diagonals meeting at apex */}
      <path
        d="M 7 22 L 12 12 L 16 17 L 20 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Terminal dot at the apex of the trend line */}
      <circle cx="20" cy="9" r="2" fill={color} />
    </svg>
  );

  if (!withBg) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        {mark}
      </div>
    );
  }

  const radius = Math.round(size * 0.3); // ~30% border-radius for rounded-square feel

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {mark}
    </div>
  );
};

/**
 * Standalone SVG string (for favicon generation or server-side usage).
 * Returns the complete <svg> element as a string.
 */
export const getLogoSVGString = (color = "#0f172a"): string => `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 7 22 Q 16 28 25 22" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M 7 22 L 12 12 L 16 17 L 20 9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="20" cy="9" r="2" fill="${color}"/>
</svg>
`;

export default AttendWiseLogo;
