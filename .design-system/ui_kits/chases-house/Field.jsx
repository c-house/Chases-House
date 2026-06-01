function Field({ label, type = "text", value, onChange, placeholder }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={fieldStyles.field}>
      <span style={fieldStyles.label}>{label}</span>
      <span style={{ ...fieldStyles.wrap, ...(focus ? fieldStyles.wrapFocus : null) }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={fieldStyles.input}
        />
      </span>
    </label>
  );
}

function Progress({ value }) {
  return (
    <div style={progStyles.track}>
      <div style={{ ...progStyles.fill, width: `${value}%` }} />
    </div>
  );
}

const fieldStyles = {
  field: { display: "flex", flexDirection: "column", gap: "0.45rem", maxWidth: "380px" },
  label: {
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  wrap: {
    display: "flex",
    alignItems: "stretch",
    gap: "0.5rem",
    border: "1px solid var(--accent-ember)",
    borderRadius: "var(--radius-md)",
    background: "var(--bg-main)",
    transition: "border-color 200ms",
  },
  wrapFocus: { borderColor: "var(--accent-gold)" },
  input: {
    flex: 1,
    padding: "0.75rem 0.9rem",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
  },
};

const progStyles = {
  track: {
    height: "6px",
    borderRadius: "3px",
    background: "var(--bg-elevated)",
    overflow: "hidden",
    maxWidth: "380px",
  },
  fill: {
    height: "100%",
    background: "linear-gradient(90deg, var(--accent-ember), var(--accent-gold))",
    borderRadius: "3px",
    transition: "width 300ms var(--ease-out)",
  },
};

window.Field = Field;
window.Progress = Progress;
