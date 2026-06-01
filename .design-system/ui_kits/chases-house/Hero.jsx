/* global React */

// Hero blurb sits on a dark surface card that mirrors the RoomCard styling
// directly below — same --bg-surface, same --accent-ember border, same
// --radius-md. The hero and the grid read as one consistent system.

function Hero({ greeting, title, accent, blurb }) {
  return (
    <section style={heroStyles.hero}>
      {greeting && <div style={heroStyles.greeting}>{greeting}</div>}
      <h1 style={heroStyles.h1}>
        {title}
        {accent && <span style={heroStyles.accent}>{accent}</span>}
      </h1>
      {blurb && (
        <div style={heroStyles.blurbCard}>
          <p style={heroStyles.blurb}>{blurb}</p>
        </div>
      )}
    </section>
  );
}

const heroStyles = {
  hero: {
    padding: "clamp(4rem, 12vh, 10rem) clamp(1.5rem, 5vw, 4rem) clamp(2rem, 6vh, 5rem)",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  greeting: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 24, 'WONK' 1, 'SOFT' 60",
    fontStyle: "italic",
    fontSize: "1.1rem",
    color: "var(--accent-glow)",
    marginBottom: "1.4rem",
    letterSpacing: "0.02em",
  },
  h1: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 96, 'WONK' 1, 'SOFT' 50",
    fontSize: "var(--h1-size)",
    fontWeight: 350,
    lineHeight: 1.0,
    letterSpacing: "-0.015em",
    color: "var(--text-heading)",
    margin: 0,
    paddingBottom: "0.18em",
    animation: "warmGlow 8s ease-in-out infinite",
  },
  accent: { color: "var(--accent-gold)", display: "block" },
  blurbCard: {
    // Mirrors RoomCard exactly: same surface, border, radius — so the hero
    // and the grid below it feel like one family of objects.
    display: "inline-block",
    maxWidth: "min(620px, 100%)",
    marginTop: "2.2rem",
    padding: "1.6rem 1.9rem",
    background: "var(--bg-surface)",
    border: "1px solid var(--accent-ember)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
  },
  blurb: {
    fontFamily: "var(--font-body)",
    fontSize: "1.15rem",
    lineHeight: 1.6,
    color: "var(--text-primary)",
    margin: 0,
    textWrap: "pretty",
  },
};

window.Hero = Hero;
