function Nav({ active = "Home" }) {
  const items = ["Home", "Games", "Cookbook", "Files"];
  return (
    <nav style={navStyles.nav}>
      <a href="#" style={navStyles.brand}>
        <span style={{ color: "var(--text-heading)" }}>Chase's </span>
        <span style={{ color: "var(--accent-gold)" }}>House</span>
      </a>
      <div style={navStyles.links}>
        {items.map((label) => (
          <a
            key={label}
            href="#"
            style={{
              ...navStyles.link,
              color: label === active ? "var(--accent-gold)" : "var(--text-primary)",
            }}
            onMouseEnter={(e) => {
              if (label !== active) e.currentTarget.style.color = "var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              if (label !== active) e.currentTarget.style.color = "var(--text-primary)";
            }}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

const navStyles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.4rem clamp(1.5rem, 5vw, 4rem)",
    borderBottom: "1px solid rgba(160, 104, 40, 0.18)",
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 36, 'WONK' 1, 'SOFT' 50",
    fontWeight: 400,
    fontSize: "1.4rem",
    letterSpacing: "-0.01em",
    textDecoration: "none",
  },
  links: { display: "flex", gap: "clamp(1.5rem, 3vw, 2.5rem)" },
  link: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "var(--nav-vsetting)",
    fontSize: "var(--nav-size)",
    fontWeight: 450,
    letterSpacing: "0.03em",
    textDecoration: "none",
    transition: "color 200ms",
  },
};

window.Nav = Nav;
