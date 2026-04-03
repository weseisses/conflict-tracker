"use client";

import { useState } from "react";

const BUTTONDOWN_USERNAME = "conflictcost";
const BMC_USERNAME = "conflictcost";

type State = "idle" | "loading" | "success" | "error";

export default function EmailCapture() {
  const [email, setEmail]   = useState("");
  const [state, setState]   = useState<State>("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrMsg("");

    try {
      const formData = new FormData();
      formData.append("email_address", email.trim());
      formData.append("tag", "conflictcost");

      await fetch(
        `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`,
        { method: "POST", body: formData, mode: "no-cors" }
      );

      setState("success");
      setEmail("");
    } catch {
      setState("error");
      setErrMsg("Something went wrong — please try again.");
    }
  }

  return (
    <div style={{
      borderTop: "1px solid #1a2030",
      borderBottom: "1px solid #1a2030",
      padding: "28px 0 24px",
      margin: "28px 0",
      display: "flex",
      gap: 0,
      flexWrap: "wrap",
    }}>

      {/* ── Email capture ── */}
      <div style={{ flex: "1 1 280px", paddingRight: 32, minWidth: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          Stay Informed
        </div>

        {state === "success" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27ae60", flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#7a9a7a", lineHeight: 1.6 }}>
              You're in. We'll notify you when conflict data is updated or new conflicts are added.
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginBottom: 16 }}>
              Get notified when conflict cost figures are updated or new conflicts are added.
              No spam — updates are rare and substantive.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === "loading"}
                style={{
                  flex: "1 1 180px",
                  background: "#080b10",
                  border: "1px solid #1e2a38",
                  color: "#c8d4e0",
                  fontSize: 13,
                  padding: "9px 14px",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  outline: "none",
                  letterSpacing: 1,
                }}
              />
              <button
                type="submit"
                disabled={state === "loading"}
                style={{
                  background: state === "loading" ? "#1a2030" : "#e74c3c",
                  border: "none",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: "9px 20px",
                  textTransform: "uppercase",
                  cursor: state === "loading" ? "default" : "pointer",
                  opacity: state === "loading" ? 0.6 : 1,
                  transition: "opacity 0.15s",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  whiteSpace: "nowrap",
                }}>
                {state === "loading" ? "..." : "Notify Me"}
              </button>
            </form>
            {state === "error" && (
              <div style={{ fontSize: 11, color: "#c0392b", marginTop: 8, letterSpacing: 1 }}>{errMsg}</div>
            )}
          </>
        )}
      </div>

      {/* ── Vertical divider ── */}
      <div style={{
        width: 1,
        background: "#1a2030",
        margin: "0 32px",
        alignSelf: "stretch",
        flexShrink: 0,
      }} />

      {/* ── Buy Me a Coffee ── */}
      <div style={{ flex: "0 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 180 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          Support This Project
        </div>
        <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginBottom: 16 }}>
          This site has no ads. If you find it useful, a coffee keeps it running.
        </p>
        <a
          href={`https://www.buymeacoffee.com/${BMC_USERNAME}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#FFDD00",
            color: "#000",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: 1,
            padding: "9px 20px",
            textDecoration: "none",
            whiteSpace: "nowrap",
            alignSelf: "flex-start",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          ☕ Buy Me a Coffee
        </a>
      </div>

    </div>
  );
}
