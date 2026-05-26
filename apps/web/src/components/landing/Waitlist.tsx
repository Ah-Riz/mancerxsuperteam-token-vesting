"use client";

import { useState, type FormEvent } from "react";

export function Waitlist() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const email = emailInput.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save your email.");
        return;
      }

      setSubmitted(true);
      form.reset();
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="lp-sect" id="waitlist" style={{ padding: "40px 0 100px" }}>
      <div className="lp-wrap">
        <div className="lp-waitlist lp-reveal">
          <div className="lp-waitlist-inner">
            <div className="eyebrow">
              <i /> EARLY ACCESS · LIMITED SPOTS
            </div>
            <h2>
              Be first on the <em>mainnet rollout.</em>
            </h2>
            <p className="lede">
              Leave your email. We&apos;ll let you know when live campaigns
              open, plus a personal onboarding session for the first 100 teams.
            </p>
            {!submitted ? (
              <form className="lp-waitlist-form" onSubmit={handleSubmit} noValidate>
                <input
                  type="email"
                  name="email"
                  placeholder="you@yourproject.xyz"
                  required
                  autoComplete="email"
                  disabled={submitting}
                  suppressHydrationWarning
                />
                <button type="submit" disabled={submitting} suppressHydrationWarning>
                  {submitting ? "Joining..." : <>Join waitlist <span className="arrow">→</span></>}
                </button>
              </form>
            ) : (
              <div className="lp-waitlist-success show">
                ✓ You&apos;re on the list. We&apos;ll reach out soon.
              </div>
            )}
            {error ? <div className="lp-waitlist-error">{error}</div> : null}
            <div className="lp-waitlist-meta">
              <div>
                <i style={{ background: "var(--lp-green)" }} /> <b>Founding</b>{" "}
                access open
              </div>
              <div>
                <i style={{ background: "var(--lp-violet-2)" }} />{" "}
                <b>Q3 2026</b> mainnet target
              </div>
              <div>
                <i style={{ background: "var(--lp-teal)" }} /> Product updates
                only
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
