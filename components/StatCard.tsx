"use client";

interface Props {
  label: string;
  value: string;
  color: string;
}

export default function StatCard({ label, value, color }: Props) {
  return (
    <div
      style={{
        background: "#0c0f14",
        border: "1px solid #1a2030",
        borderLeft: `3px solid ${color}`,
        padding: "13px 15px",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 18, color: "#f0f4f8" }}>
        {value}
      </div>
    </div>
  );
}
