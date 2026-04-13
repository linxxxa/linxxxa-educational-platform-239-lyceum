import type { MatchingBoardLineSegment } from "./matchingModeTypes";

/** Наложение SVG-линий поверх сетки плиток. */
export function MatchingModeSvgLineLayer(props: {
  lineSegments: MatchingBoardLineSegment[];
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
      aria-hidden
    >
      {props.lineSegments.map((segment) => (
        <line
          key={segment.segmentKey}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.strokeColor}
          strokeWidth={segment.strokeWidthPixels}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
