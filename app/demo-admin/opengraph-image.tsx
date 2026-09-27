import { ImageResponse } from "next/og";

export const alt = "ADOMS 시연용 관리자 시스템";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3f7f2a",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontSize: 144,
          fontWeight: 700,
          letterSpacing: 8,
        }}
      >
        ADOMS
      </div>
    ),
    size,
  );
}
