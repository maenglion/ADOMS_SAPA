import QRCode from "qrcode";

/**
 * QR 코드 — 서버에서 SVG 로 그려 넣는다.
 * 외부 서비스에 주소를 보내지 않고, 인터넷이 끊겨도 뜬다(시연장에서 중요하다).
 */
export default async function Qr({ text, size = 190, label }:
  { text: string; size?: number; label?: string }) {
  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: 1,
    width: size,
    color: { dark: "#172b4d", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{ width: size, height: size, background: "#fff", border: "1px solid var(--line)",
                 borderRadius: 10, padding: 6, lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {label && <span className="muted" style={{ fontSize: ".82rem" }}>{label}</span>}
    </div>
  );
}
