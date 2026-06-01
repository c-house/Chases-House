function Banner({ kind = "warn", children }) {
  const k = bannerStyles[kind] || bannerStyles.warn;
  return <div style={{ ...bannerStyles.base, ...k }}>{children}</div>;
}

const bannerStyles = {
  base: {
    padding: "0.9rem 1.1rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontSize: "0.92rem",
    lineHeight: 1.5,
    border: "1px solid",
  },
  warn: {
    background: "rgba(176, 90, 58, 0.08)",
    borderColor: "var(--terracotta)",
    color: "var(--text-primary)",
  },
  error: {
    background: "rgba(176, 90, 58, 0.12)",
    borderColor: "var(--terracotta)",
    color: "var(--text-heading)",
  },
  success: {
    background: "rgba(106, 125, 90, 0.12)",
    borderColor: "var(--sage)",
    color: "var(--text-heading)",
  },
};

function Footer() {
  return (
    <footer style={footStyles.footer}>
      <div>
        <span style={{ color: "var(--text-muted)" }}>Chase's </span>
        <span style={{ color: "var(--accent-gold)" }}>House</span>
      </div>
      <div style={footStyles.copy}>© 2026</div>
    </footer>
  );
}

const footStyles = {
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2rem clamp(1.5rem, 5vw, 4rem)",
    borderTop: "1px solid rgba(160, 104, 40, 0.18)",
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 18, 'WONK' 1, 'SOFT' 40",
    fontSize: "0.95rem",
  },
  copy: { color: "var(--text-faint)", fontSize: "0.8rem", letterSpacing: "0.04em" },
};

window.Banner = Banner;
window.Footer = Footer;
