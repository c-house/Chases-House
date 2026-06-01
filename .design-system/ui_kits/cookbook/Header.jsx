function Header() {
  return (
    <header style={headerStyles.header}>
      <div style={headerStyles.smallcaps} className="smallcaps">Est. 2026 · Vol. I</div>
      <h1 style={headerStyles.title} className="display">The Family Cookbook</h1>
      <div style={headerStyles.script}>recipes worth keeping</div>
      <div style={headerStyles.rule} />
    </header>
  );
}

const headerStyles = {
  header: { textAlign: "center", padding: "1.5rem 0 2.5rem" },
  smallcaps: {
    fontSize: "0.7rem",
    color: "var(--ink-mute)",
    marginBottom: "0.8rem",
  },
  title: {
    fontFamily: "var(--font-display-rustic)",
    fontSize: "clamp(3rem, 7vw, 5.5rem)",
    fontWeight: 500,
    lineHeight: 0.95,
    letterSpacing: "-0.01em",
    margin: "0 0 0.4rem",
    color: "var(--ink)",
  },
  script: {
    fontFamily: "var(--font-script)",
    fontSize: "1.6rem",
    color: "var(--terracotta)",
  },
  rule: {
    width: "60px",
    height: "1px",
    background: "var(--line)",
    margin: "2rem auto 0",
  },
};

window.Header = Header;
