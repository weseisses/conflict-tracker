import { NextRequest, NextResponse } from "next/server";

const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    if (!BUTTONDOWN_API_KEY) {
      console.error("BUTTONDOWN_API_KEY is not set");
      return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
    }

    const res = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${BUTTONDOWN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email.trim(),
        tags: ["conflictcost"],
        metadata: { source: "homepage" },
      }),
    });

    // 201 = new subscriber, 200 = already subscribed (both fine for the user)
    if (res.ok) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const data = await res.json().catch(() => ({}));

    // Buttondown returns 422 with code "email_already_exists" if already subscribed
    if (res.status === 422 && (data as any)?.code === "email_already_exists") {
      return NextResponse.json({ ok: true, alreadySubscribed: true }, { status: 200 });
    }

    console.error("Buttondown error:", res.status, data);
    return NextResponse.json({ error: "Subscription failed." }, { status: 502 });

  } catch (err) {
    console.error("Subscribe route error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
