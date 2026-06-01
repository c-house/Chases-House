function RoomCard({ icon, title, desc, tag, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...roomCardStyles.card,
        ...(hover ? roomCardStyles.cardHover : null),
      }}
    >
      <span style={roomCardStyles.icon}>{icon}</span>
      <span style={roomCardStyles.title}>{title}</span>
      <span style={roomCardStyles.desc}>{desc}</span>
      {tag && <span style={roomCardStyles.tag}>{tag}</span>}
    </a>
  );
}

const roomCardStyles = {
  card: {
    display: "flex",
    flexDirection: "column",
    padding: "1.8rem 1.5rem",
    background: "var(--bg-surface)",
    border: "1px solid var(--accent-ember)",
    borderRadius: "var(--radius-md)",
    textDecoration: "none",
    color: "inherit",
    transition: "all 300ms var(--ease-out)",
  },
  cardHover: {
    transform: "translateY(-4px)",
    borderColor: "var(--accent-gold)",
    boxShadow: "var(--shadow-card-hover)",
  },
  icon: { fontSize: "1.8rem", marginBottom: "0.6rem", opacity: 0.9, lineHeight: 1 },
  title: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "var(--h3-vsetting)",
    fontSize: "1.3rem",
    fontWeight: 500,
    color: "var(--text-heading)",
    marginBottom: "0.3rem",
  },
  desc: {
    fontFamily: "var(--font-body)",
    fontSize: "0.92rem",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    flex: 1,
    marginBottom: "0.8rem",
  },
  tag: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--accent-gold)",
    border: "1px solid var(--accent-ember)",
    borderRadius: "var(--radius-sm)",
    alignSelf: "flex-start",
  },
};

window.RoomCard = RoomCard;
