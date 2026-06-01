function RecipeView({ recipe, onBack }) {
  return (
    <article style={rvStyles.wrap}>
      <button onClick={onBack} style={rvStyles.back}>← back to the book</button>
      <div className="smallcaps" style={rvStyles.section}>{recipe.section}</div>
      <h1 className="display" style={rvStyles.title}>{recipe.title}</h1>
      <div style={rvStyles.script} className="script">{recipe.tagline}</div>

      <div style={rvStyles.metaRow}>
        <div style={rvStyles.metaCell}><div style={rvStyles.metaLabel} className="smallcaps">Time</div><div style={rvStyles.metaVal} className="mono">{recipe.time}</div></div>
        <div style={rvStyles.metaCell}><div style={rvStyles.metaLabel} className="smallcaps">Serves</div><div style={rvStyles.metaVal} className="mono">{recipe.serves}</div></div>
        <div style={rvStyles.metaCell}><div style={rvStyles.metaLabel} className="smallcaps">Heat</div><div style={rvStyles.metaVal} className="mono">{recipe.heat}</div></div>
      </div>

      <div style={rvStyles.hero} role="img" aria-label={recipe.title}>
        <img src={recipe.img} alt="" style={rvStyles.heroImg} />
      </div>

      <div style={rvStyles.cols}>
        <section>
          <h2 className="display" style={rvStyles.h2}>Ingredients</h2>
          <ul style={rvStyles.ingredients}>
            {recipe.ingredients.map((it, i) => (
              <li key={i} style={rvStyles.ingredient}>
                <span className="mono" style={rvStyles.qty}>{it.qty}</span>
                <span>{it.name}</span>
              </li>
            ))}
          </ul>
          {recipe.note && <ChefsNote>{recipe.note}</ChefsNote>}
        </section>

        <section>
          <h2 className="display" style={rvStyles.h2}>Method</h2>
          <ol style={rvStyles.method}>
            {recipe.method.map((step, i) => (
              <li key={i} style={rvStyles.step}>
                <span className="display" style={rvStyles.stepNum}>{i + 1}</span>
                <span style={rvStyles.stepBody}>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}

const rvStyles = {
  wrap: { padding: "1rem 0 4rem", maxWidth: "920px", margin: "0 auto" },
  back: {
    background: "transparent",
    border: "none",
    color: "var(--ink-mute)",
    fontFamily: "var(--font-body-rustic)",
    fontStyle: "italic",
    fontSize: "0.9rem",
    cursor: "pointer",
    padding: "0 0 1.5rem",
    letterSpacing: "0.02em",
  },
  section: { fontSize: "0.72rem", color: "var(--terracotta)", marginBottom: "0.6rem" },
  title: {
    fontFamily: "var(--font-display-rustic)",
    fontSize: "clamp(2.5rem, 6vw, 4.2rem)",
    fontWeight: 500,
    margin: "0 0 0.3rem",
    lineHeight: 1.0,
    letterSpacing: "-0.01em",
  },
  script: { color: "var(--terracotta)", fontSize: "1.5rem", marginBottom: "1.5rem" },
  metaRow: { display: "flex", gap: "2.4rem", padding: "1rem 0 1.4rem", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" },
  metaCell: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  metaLabel: { fontSize: "0.65rem", color: "var(--ink-mute)" },
  metaVal: { fontSize: "1.05rem", color: "var(--ink)", fontWeight: 500 },
  hero: { margin: "2rem 0 2.4rem", boxShadow: "0 4px 24px rgba(60,40,20,0.16)" },
  heroImg: { width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" },
  cols: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 1.5fr", gap: "3rem", alignItems: "start" },
  h2: {
    fontFamily: "var(--font-display-rustic)",
    fontStyle: "italic",
    fontSize: "1.8rem",
    fontWeight: 500,
    margin: "0 0 1rem",
    color: "var(--ink)",
  },
  ingredients: { listStyle: "none", padding: 0, margin: 0 },
  ingredient: {
    display: "grid",
    gridTemplateColumns: "5.5rem 1fr",
    gap: "0.6rem",
    padding: "0.55rem 0",
    borderBottom: "1px dotted var(--line-soft)",
    fontSize: "0.95rem",
    color: "var(--ink-soft)",
  },
  qty: { color: "var(--terracotta)", fontWeight: 500, fontSize: "0.9rem" },
  method: { listStyle: "none", padding: 0, margin: 0, counterReset: "step" },
  step: {
    display: "grid",
    gridTemplateColumns: "3rem 1fr",
    gap: "0.8rem",
    padding: "0.6rem 0 1rem",
    alignItems: "baseline",
    color: "var(--ink-soft)",
    fontSize: "0.98rem",
    lineHeight: 1.6,
  },
  stepNum: {
    fontFamily: "var(--font-display-rustic)",
    fontStyle: "italic",
    fontSize: "2rem",
    color: "var(--terracotta)",
    fontWeight: 500,
    lineHeight: 1,
  },
  stepBody: {},
};

window.RecipeView = RecipeView;
