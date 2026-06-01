function Button({ children, variant = "primary", onClick, disabled }) {
  const [hover, setHover] = React.useState(false);
  const base = btnStyles.base;
  const v = btnStyles[variant] || btnStyles.primary;
  const h = !disabled && hover ? btnStyles[variant + "Hover"] : null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...v, ...(h || {}), ...(disabled ? btnStyles.disabled : null) }}
    >
      {children}
    </button>
  );
}

function LinkButton({ children, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        fontFamily: "var(--font-body)",
        fontSize: "0.85rem",
        color: hover ? "var(--terracotta)" : "var(--text-muted)",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
        cursor: "pointer",
        padding: "0.3rem 0.5rem",
        transition: "color 200ms",
      }}
    >
      {children}
    </button>
  );
}

const btnStyles = {
  base: {
    padding: "0.8rem 1.5rem",
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 20, 'WONK' 1, 'SOFT' 40",
    fontSize: "1rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    border: "1px solid",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    transition: "all 200ms var(--ease-out)",
  },
  primary: {
    background: "var(--accent-gold)",
    color: "var(--bg-deep)",
    borderColor: "var(--accent-gold)",
  },
  primaryHover: {
    background: "var(--accent-glow)",
    borderColor: "var(--accent-glow)",
    transform: "translateY(-1px)",
  },
  disabled: {
    background: "transparent",
    color: "var(--text-faint)",
    borderColor: "var(--text-faint)",
    cursor: "not-allowed",
  },
};

window.Button = Button;
window.LinkButton = LinkButton;
