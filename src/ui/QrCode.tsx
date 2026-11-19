import { useMemo } from "react";
import { qrMatrix, qrPath } from "./qr";

interface Props {
  text: string;
  label: string;
}

/** A QR code as crisp SVG. Always dark on white, since scanners need that contrast even in dark mode. */
export function QrCode({ text, label }: Props) {
  const { size, path } = useMemo(() => {
    const matrix = qrMatrix(text);
    return { size: matrix.length, path: qrPath(matrix) };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
