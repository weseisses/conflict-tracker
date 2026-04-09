"use client";

import { useState } from "react";

const KOFI_USERNAME = "conflictcost";

type State = "idle" | "loading" | "success" | "error";

const TAG_STYLE: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 3,
  color: "#3d4a5a",
  textTransform: "uppercase",
  fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif",
};

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
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error || "Request failed");
      }

      if ((data as any)?.alreadySubscribed) {
        setState("error");
        setErrMsg("This email is already subscribed.");
        return;
      }

      setState("success");
      setEmail("");
    } catch (err: unknown) {
      setState("error");
      setErrMsg(err instanceof Error ? err.message : "Something went wrong — please try again.");
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
      alignItems: "stretch",
    }}>

      {/* ── Email capture ── */}
      <div style={{ flex: "1 1 280px", paddingRight: 32, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ ...TAG_STYLE, marginBottom: 12 }}>Stay Informed</div>

        {state === "success" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27ae60", flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#7a9a7a", lineHeight: 1.6 }}>
              You're in. We'll notify you when conflict data is updated or new conflicts are added.
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginBottom: 16, flex: 1 }}>
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
        flexShrink: 0,
      }} />

      {/* ── Ko-fi ── */}
      <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ ...TAG_STYLE, marginBottom: 12 }}>Support This Project</div>

        <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginBottom: 16, flex: 1 }}>
          Non-partisan · No advertising · Open methodology
        </p>

        <div>
          <a
            href={`https://ko-fi.com/${KOFI_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#29ABE0",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "9px 20px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            ☕ Support on Ko-fi
          </a>
        </div>
      </div>

    </div>
  );
}
