function Chip({ children, count, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  const isOn = active;
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        fontFamily: "var(--font-body-rustic)",
        fontSize: "0.85rem",
        padding: "0.4rem 0.8rem",
        background: isOn ? "var(--ink)" : (hover ? "var(--paper-2)" : "transparent"),
        color: isOn ? "var(--paper)" : "var(--ink-soft)",
        border: `1px solid ${isOn ? "var(--ink)" : "var(--line)"}`,
        borderRadius: "100px",
        cursor: "pointer",
        letterSpacing: "0.04em",
        textTransform: "lowercase",
        transition: "all 200ms",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span style={{ marginLeft: "0.4rem", opacity: 0.55, fontSize: "0.72rem" }}>{count}</span>
      )}
    </button>
  );
}

window.Chip = Chip;
