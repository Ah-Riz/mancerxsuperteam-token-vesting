import { SmoothScrollLink } from "@/components/landing/SmoothScrollLink";

/**
 * Hero - Landing page hero section with animated Aperture brand mark.
 * All animations use native SVG <animate> elements (no JS required).
 * All class names are prefixed with `lp-` to avoid style conflicts.
 */
export function Hero() {
  return (
    <section className="lp-hero" id="top">
      <div className="lp-wrap">
        <div className="lp-hero-grid">
          <div className="lp-hero-left">
            <h1>
              Precision Vesting,
              <br />
              <em>with Zero Friction.</em>
            </h1>
            <p className="sub">
              Onchain vesting infrastructure, built for everyone. Teams, DAOs, and investors use Velthoryn to distribute tokens — automated, transparent, and trustless. 
            </p>
            <div className="cta-row">
              <SmoothScrollLink href="#waitlist" className="lp-btn primary">
                Join waitlist <span className="arrow">&rarr;</span>
              </SmoothScrollLink>
              <button className="lp-btn ghost" suppressHydrationWarning>
                Read the docs
              </button>
            </div>
            <div className="meta">
              <div>Audit by Mr G and Mr L</div>
              <div>
                <i style={{ background: "var(--lp-violet-2)" }} />{" "}
                <b>$0+</b> sent out so far
              </div>
              <div>
                <i style={{ background: "var(--lp-teal)" }} />{" "}
                <b>0</b> projects using it
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
