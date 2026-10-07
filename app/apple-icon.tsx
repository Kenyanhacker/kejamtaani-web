import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 42,
      background: "#064e3b",
    }}>
      <svg width="132" height="132" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 29 32 12l20 17v22a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V29Z" fill="white" />
        <path d="M25 54V36a7 7 0 0 1 14 0v18" fill="#10B981" />
        <path d="M20 30h24" stroke="#047857" strokeLinecap="round" strokeWidth="4" />
        <circle cx="45" cy="19" r="7" fill="#FBBF24" />
      </svg>
    </div>,
    { ...size },
  );
}
