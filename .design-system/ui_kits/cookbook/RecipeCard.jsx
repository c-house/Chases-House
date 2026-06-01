function RecipeCard({ recipe, onOpen, tilt = 0 }) {
  const [hover, setHover] = React.useState(false);
  const [fav, setFav] = React.useState(recipe.fav || false);
  return (
    <article
      onClick={() => onOpen && onOpen(recipe)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...recipeCardStyles.card,
        transform: `rotate(${tilt}deg) translateY(${hover ? -3 : 0}px)`,
      }}
    >
      <div
        style={{
          ...recipeCardStyles.thumb,
          backgroundImage: `url(${recipe.img})`,
          boxShadow: hover
            ? "inset 0 0 0 1px rgba(0,0,0,0.04), 0 6px 22px rgba(60,40,20,0.16)"
            : "inset 0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(60,40,20,0.10)",
        }}
      />
      <div style={recipeCardStyles.body}>
        <div style={recipeCardStyles.row}>
          <span className="smallcaps" style={recipeCardStyles.section}>{recipe.section}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setFav(!fav); }}
            style={{ ...recipeCardStyles.heart, color: fav ? "var(--burgundy)" : "var(--ink-mute)" }}
            aria-label={fav ? "Saved" : "Save recipe"}
          >
            {fav ? "♥" : "♡"}
          </button>
        </div>
        <h3 className="display" style={recipeCardStyles.title}>{recipe.title}</h3>
        <p style={recipeCardStyles.blurb}><em>{recipe.blurb}</em></p>
        <div style={recipeCardStyles.meta}>
          <span>⏱ {recipe.time}</span>
          <span>👥 {recipe.serves}</span>
          <span style={{ color: "var(--gold)" }}>★ {recipe.rating}</span>
        </div>
      </div>
    </article>
  );
}

const recipeCardStyles = {
  card: {
    background: "transparent",
    cursor: "pointer",
    transition: "transform 250ms cubic-bezier(0.2,0.7,0.3,1)",
  },
  thumb: {
    aspectRatio: "4/3",
    backgroundSize: "cover",
    backgroundPosition: "center",
    transition: "box-shadow 250ms",
  },
  body: { padding: "0.9rem 0.2rem 0" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.2rem" },
  section: { fontSize: "0.65rem", color: "var(--terracotta)" },
  heart: { background: "transparent", border: "none", fontSize: "1.05rem", cursor: "pointer", padding: 0, lineHeight: 1 },
  title: {
    fontFamily: "var(--font-display-rustic)",
    fontWeight: 500,
    fontSize: "1.45rem",
    lineHeight: 1.1,
    margin: "0.25rem 0 0.4rem",
    color: "var(--ink)",
  },
  blurb: {
    fontSize: "0.88rem",
    color: "var(--ink-soft)",
    lineHeight: 1.45,
    margin: "0 0 0.7rem",
  },
  meta: {
    display: "flex",
    gap: "0.9rem",
    fontSize: "0.78rem",
    color: "var(--ink-mute)",
    fontFamily: "var(--font-body-rustic)",
  },
};

window.RecipeCard = RecipeCard;
