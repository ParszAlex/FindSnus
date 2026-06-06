import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f1117",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 32,
          }}
        >
          findsnus
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#a0a8b8",
            textAlign: "center",
            maxWidth: 720,
            lineHeight: 1.4,
          }}
        >
          Find UK shops that stock your nicotine pouches
        </div>
      </div>
    ),
    size,
  );
}
