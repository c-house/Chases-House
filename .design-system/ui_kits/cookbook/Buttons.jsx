function ChefsNote({ children }) {
  return (
    <aside style={noteStyles.note}>
      <div className="script" style={noteStyles.label}>chef's note —</div>
      <div style={noteStyles.body}>{children}</div>
    </aside>
  );
}

function RusticButton({ children, variant = "terracotta", onClick }) {
  const [hover, setHover] = React.useState(false);
  const v = rusticBtnStyles[variant] || rusticBtnStyles.terracotta;
  const h = hover ? rusticBtnStyles[variant + "Hover"] || {} : {};
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...rusticBtnStyles.base, ...v, ...h }}
    >
      {children}
    </button>
  );
}

const noteStyles = {
  note: {
    background: "var(--paper-deep)",
    padding: "1.2rem 1.4rem",
    borderRadius: "2px",
    boxShadow: "inset 0 0 0 1px var(--line-soft)",
    margin: "1.5rem 0",
  },
  label: { color: "var(--terracotta)", fontSize: "1.25rem", marginBottom: "0.2rem" },
  body: { fontSize: "0.95rem", color: "var(--ink-soft)", lineHeight: 1.55, fontStyle: "italic" },
};

const rusticBtnStyles = {
  base: {
    fontFamily: "var(--font-body-rustic)",
    padding: "0.65rem 1.1rem",
    borderRadius: "2px",
    fontSize: "0.82rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 180ms",
  },
  terracotta: { background: "var(--terracotta)", color: "var(--paper)" },
  terracottaHover: { background: "var(--terracotta-deep)" },
  ink: { background: "var(--ink)", color: "var(--paper)" },
  inkHover: { background: "#1c130b" },
  ghost: {
    background: "transparent",
    color: "var(--ink)",
    boxShadow: "inset 0 0 0 1.5px var(--ink)",
    textTransform: "lowercase",
    letterSpacing: "0.04em",
    fontStyle: "italic",
  },
  ghostHover: { background: "var(--paper-2)" },
};

window.ChefsNote = ChefsNote;
window.RusticButton = RusticButton;
