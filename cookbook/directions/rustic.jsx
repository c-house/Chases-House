// Rustic Kitchen direction — warm paper, serifs, hand-drawn energy.
// Chef Jean-Pierre warmth: generous, tactile, a little imperfect.
//
// Palette + type set as CSS vars on :root, scoped via .rustic wrapper.
// Every screen (home → recipe → cook mode) lives in a single <RusticApp>
// with internal state for `view`, `activeRecipe`, search/filter, servings,
// favorites, notes, etc. All persistent bits (favorites, notes, checked
// steps) go through useLocalState keyed 'rustic:*'.

// Wrap everything in an IIFE — Babel standalone shares top-level scope
// across all <script type="text/babel"> tags, so bare top-level consts
// collide with the other direction file. The IIFE gives each file its
// own scope; we expose only what's needed via window at the end.
(function () {
const { RECIPES, TAG_GROUPS, RLib } = window;
const { formatAmount, renderStepText, ingredientLine, filterRecipes, groupByCategory, useLocalState, tagCounts } = RLib;

// ─── Inject rustic CSS once ──────────────────────────────────
if (!document.getElementById('rustic-styles')) {
  const s = document.createElement('style');
  s.id = 'rustic-styles';
  s.textContent = `
    .rustic {
      --paper: #f3ead8;
      --paper-2: #ead9bd;
      --paper-deep: #e2cfae;
      --ink: #2b1e14;
      --ink-soft: #5a4630;
      --ink-mute: #8a7354;
      --terracotta: #b8502a;
      --terracotta-deep: #8c3a1e;
      --olive: #5e6b3a;
      --burgundy: #6b2736;
      --gold: #c08a2e;
      --line: #c9b48d;
      --line-soft: rgba(139, 108, 61, 0.22);
      color: var(--ink);
      font-family: 'Lora', 'Iowan Old Style', Georgia, serif;
      background: var(--paper);
      background-image:
        radial-gradient(at 12% 8%, rgba(184,80,42,0.05) 0, transparent 50%),
        radial-gradient(at 88% 92%, rgba(94,107,58,0.06) 0, transparent 50%),
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.24 0 0 0 0 0.12 0 0 0 0.035 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
      line-height: 1.55;
    }
    .rustic * { box-sizing: border-box; }
    .rustic .display { font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif; font-weight: 500; letter-spacing: -0.01em; }
    .rustic .script { font-family: 'Caveat', 'Marker Felt', cursive; }
    .rustic .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
    .rustic .smallcaps { font-family: 'Cormorant Garamond', serif; text-transform: uppercase; letter-spacing: 0.24em; font-weight: 600; }
    .rustic .pull { text-shadow: 0 1px 0 rgba(255,255,255,0.4); }

    .rustic-btn {
      font-family: inherit;
      background: var(--ink);
      color: var(--paper);
      border: none;
      padding: 10px 18px;
      border-radius: 2px;
      font-size: 13px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background .15s, transform .08s;
      font-weight: 600;
    }
    .rustic-btn:hover { background: var(--terracotta-deep); }
    .rustic-btn:active { transform: translateY(1px); }
    .rustic-btn.ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
    .rustic-btn.ghost:hover { background: var(--ink); color: var(--paper); }
    .rustic-btn.terra { background: var(--terracotta); }
    .rustic-btn.terra:hover { background: var(--terracotta-deep); }

    .rustic-chip {
      font-family: inherit; font-size: 12px;
      padding: 6px 12px 7px;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--ink-soft);
      border-radius: 100px;
      cursor: pointer;
      letter-spacing: 0.04em;
      transition: all .12s;
      text-transform: lowercase;
    }
    .rustic-chip:hover { background: var(--paper-2); color: var(--ink); }
    .rustic-chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
    .rustic-chip .count { margin-left: 6px; opacity: 0.55; font-size: 10px; }

    .rustic-input {
      font-family: inherit; font-size: 16px;
      background: transparent;
      border: none;
      border-bottom: 1.5px solid var(--ink);
      padding: 10px 4px;
      color: var(--ink);
      width: 100%;
      outline: none;
    }
    .rustic-input::placeholder { color: var(--ink-mute); font-style: italic; }

    .rustic-card {
      background: var(--paper);
      position: relative;
      cursor: pointer;
      transition: transform .18s cubic-bezier(.2,.7,.3,1);
    }
    .rustic-card:hover { transform: translateY(-3px); }
    .rustic-card .thumb {
      aspect-ratio: 4 / 3;
      background-size: cover; background-position: center;
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(60,40,20,0.10);
    }
    .rustic-card .corner {
      position: absolute; top: 10px; left: 10px;
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--paper); color: var(--terracotta);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }

    .rustic-divider {
      display: flex; align-items: center; gap: 16px;
      color: var(--ink-mute);
    }
    .rustic-divider::before, .rustic-divider::after {
      content: ''; flex: 1; height: 1px;
      background: linear-gradient(to right, transparent, var(--line), transparent);
    }

    .rustic-cook-step {
      transition: all .25s;
    }
    .rustic-cook-step.done {
      opacity: 0.4;
    }
    .rustic-cook-step.done .step-text {
      text-decoration: line-through;
      text-decoration-thickness: 1.5px;
      text-decoration-color: var(--terracotta);
    }

    .rustic-checkbox {
      width: 22px; height: 22px; border-radius: 50%;
      border: 1.5px solid var(--ink-soft);
      background: var(--paper);
      cursor: pointer;
      flex-shrink: 0;
      transition: all .15s;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      color: transparent;
    }
    .rustic-checkbox:hover { border-color: var(--terracotta); }
    .rustic-checkbox.checked {
      background: var(--terracotta);
      border-color: var(--terracotta);
      color: var(--paper);
    }

    .rustic-stepper {
      display: inline-flex; align-items: stretch;
      border: 1.5px solid var(--ink);
      background: var(--paper);
      border-radius: 2px;
    }
    .rustic-stepper button {
      font-family: inherit; background: transparent; border: none;
      padding: 0 14px; cursor: pointer; font-size: 18px; color: var(--ink);
      transition: background .1s;
    }
    .rustic-stepper button:hover { background: var(--paper-2); }
    .rustic-stepper button:disabled { color: var(--ink-mute); cursor: not-allowed; }
    .rustic-stepper .val {
      padding: 8px 14px;
      border-left: 1.5px solid var(--ink);
      border-right: 1.5px solid var(--ink);
      font-weight: 600;
      min-width: 42px; text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .rustic-tab {
      font-family: inherit;
      background: transparent; border: none;
      padding: 8px 0; margin-right: 28px; cursor: pointer;
      font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--ink-mute); font-weight: 600;
      border-bottom: 2px solid transparent;
      transition: all .12s;
    }
    .rustic-tab:hover { color: var(--ink); }
    .rustic-tab.active { color: var(--ink); border-bottom-color: var(--terracotta); }

    .rustic-note {
      background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 28px,
        rgba(139, 108, 61, 0.18) 28px,
        rgba(139, 108, 61, 0.18) 29px
      );
      padding: 16px 20px;
      font-family: 'Caveat', cursive;
      font-size: 22px;
      color: var(--ink-soft);
      line-height: 29px;
      min-height: 120px;
      border: none;
      outline: none;
      width: 100%;
      resize: vertical;
    }

    .rustic-printable { display: block; }
    @media print {
      .rustic { background: white !important; color: black !important; }
      .rustic .no-print { display: none !important; }
      .rustic .thumb { max-height: 2.5in; }
    }

    @keyframes rustic-fade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rustic-fade { animation: rustic-fade .35s cubic-bezier(.2,.7,.3,1) both; }

    /* Scrollbars inside rustic stay warm */
    .rustic ::-webkit-scrollbar { width: 10px; height: 10px; }
    .rustic ::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }
    .rustic ::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(s);
}

// ─── Tiny SVG icons (hand-drawn-ish) ─────────────────────────
const RIcon = {
  search: (p={}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  heart: (filled) => <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></svg>,
  clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  users: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.8-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.5c2.8.2 5 2 5 4.5"/></svg>,
  spoon: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 3c2.8 0 5 2.5 5 5.5S16.8 14 14 14c-1.2 0-2-.3-2-.3L8 20a2 2 0 0 1-2.8-2.8l6.3-4S11 11.5 11 10c0-3.5 0-7 3-7Z"/></svg>,
  back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  print: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="9" rx="1"/><path d="M7 15h10v5H7z"/></svg>,
  star: (filled) => <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M12 3.5l2.7 5.5 6 .9-4.4 4.3 1 6.1L12 17.6 6.7 20.3l1-6.1L3.3 9.9l6-.9L12 3.5Z"/></svg>,
  check: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>,
};

// ─────────────────────────────────────────────────────────────
//  RUSTIC APP
// ─────────────────────────────────────────────────────────────
function RusticApp() {
  const [view, setView] = React.useState('home'); // 'home' | 'recipe' | 'cook'
  const [activeId, setActiveId] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [category, setCategory] = React.useState('All');
  const [favorites, setFavorites] = useLocalState('rustic:favorites', {});
  const [notes, setNotes] = useLocalState('rustic:notes', {});
  const [servingsMap, setServingsMap] = useLocalState('rustic:servings', {});
  const [checkedIng, setCheckedIng] = useLocalState('rustic:checkedIng', {});
  const [checkedSteps, setCheckedSteps] = useLocalState('rustic:checkedSteps', {});

  const activeRecipe = RECIPES.find(r => r.id === activeId);
  const counts = React.useMemo(() => tagCounts(RECIPES), []);
  const filtered = filterRecipes(RECIPES, {
    query, tags: selectedTags, category, favoritesOnly, favorites,
  });

  const toggleTag = (t) => setSelectedTags(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);
  const toggleFav = (id) => setFavorites(f => ({ ...f, [id]: !f[id] }));

  const openRecipe = (id) => { setActiveId(id); setView('recipe'); window.scrollTo(0, 0); };
  const goHome = () => { setView('home'); setActiveId(null); };

  return (
    <div className="rustic" style={{ minHeight: '100%', width: '100%' }}>
      {view === 'home' && (
        <RusticHome
          query={query} setQuery={setQuery}
          selectedTags={selectedTags} toggleTag={toggleTag}
          tagCounts={counts}
          category={category} setCategory={setCategory}
          favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}
          recipes={filtered}
          favorites={favorites} toggleFav={toggleFav}
          onOpen={openRecipe}
        />
      )}
      {view === 'recipe' && activeRecipe && (
        <RusticRecipe
          recipe={activeRecipe}
          onBack={goHome}
          onCook={() => setView('cook')}
          favorite={!!favorites[activeRecipe.id]}
          toggleFav={() => toggleFav(activeRecipe.id)}
          servings={servingsMap[activeRecipe.id] ?? activeRecipe.baseServings}
          setServings={(n) => setServingsMap(m => ({ ...m, [activeRecipe.id]: n }))}
          note={notes[activeRecipe.id] || ''}
          setNote={(v) => setNotes(n => ({ ...n, [activeRecipe.id]: v }))}
          checkedIng={checkedIng[activeRecipe.id] || {}}
          toggleIng={(i) => setCheckedIng(c => ({ ...c, [activeRecipe.id]: { ...(c[activeRecipe.id] || {}), [i]: !(c[activeRecipe.id] || {})[i] } }))}
        />
      )}
      {view === 'cook' && activeRecipe && (
        <RusticCookMode
          recipe={activeRecipe}
          onBack={() => setView('recipe')}
          servings={servingsMap[activeRecipe.id] ?? activeRecipe.baseServings}
          checkedSteps={checkedSteps[activeRecipe.id] || {}}
          toggleStep={(i) => setCheckedSteps(c => ({ ...c, [activeRecipe.id]: { ...(c[activeRecipe.id] || {}), [i]: !(c[activeRecipe.id] || {})[i] } }))}
        />
      )}
    </div>
  );
}

// ─── Home / Browse ───────────────────────────────────────────
function RusticHome({ query, setQuery, selectedTags, toggleTag, tagCounts, category, setCategory, favoritesOnly, setFavoritesOnly, recipes, favorites, toggleFav, onOpen }) {
  const grouped = groupByCategory(recipes);
  const categories = ['All', 'Mains', 'Sides', 'Appetizers', 'Sauces', 'Breakfast', 'Desserts'];

  return (
    <div className="rustic-fade" style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 56px 80px' }}>
      {/* Masthead */}
      <header style={{ borderBottom: '1.5px solid var(--ink)', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Est. 2026 · Vol. I</div>
          <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>"Hello my friends —"</div>
        </div>
        <h1 className="display" style={{ fontSize: 84, lineHeight: 0.95, margin: '14px 0 6px', fontWeight: 500 }}>
          The Family Cookbook
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
          <div className="script" style={{ fontSize: 26, color: 'var(--terracotta)' }}>
            recipes worth keeping
          </div>
          <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{RECIPES.length} recipes</div>
        </div>
      </header>

      {/* Search + category tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1.5px solid var(--ink)' }}>
          <div style={{ color: 'var(--ink-soft)' }}>{RIcon.search()}</div>
          <input className="rustic-input" style={{ borderBottom: 'none' }}
            placeholder="Search recipes, ingredients, stories…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="rustic-chip" style={{ borderColor: favoritesOnly ? 'var(--terracotta)' : undefined, color: favoritesOnly ? 'var(--terracotta)' : undefined }}
          onClick={() => setFavoritesOnly(v => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {RIcon.heart(favoritesOnly)} favorites only
          </span>
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ borderBottom: '1px solid var(--line-soft)', marginBottom: 24 }}>
        {categories.map(c => (
          <button key={c} className={'rustic-tab' + (category === c ? ' active' : '')} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* Ingredient filters */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14 }}>
          <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Filter by ingredient</div>
          {selectedTags.length > 0 && (
            <button onClick={() => selectedTags.forEach(toggleTag)} style={{ fontFamily: 'inherit', background: 'none', border: 'none', color: 'var(--terracotta)', fontSize: 12, cursor: 'pointer', fontStyle: 'italic' }}>
              clear all
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAG_GROUPS.flatMap(g => g.tags).filter(t => tagCounts[t]).map(t => (
            <button key={t} className={'rustic-chip' + (selectedTags.includes(t) ? ' active' : '')} onClick={() => toggleTag(t)}>
              {t}<span className="count">{tagCounts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {recipes.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
          <div className="script" style={{ fontSize: 32, color: 'var(--terracotta)', marginBottom: 8 }}>hmm…</div>
          Nothing matches that — try fewer filters.
        </div>
      ) : grouped.map(({ category: cat, recipes: items }) => (
        <section key={cat} style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20 }}>
            <h2 className="display" style={{ fontSize: 42, margin: 0, fontWeight: 500, fontStyle: 'italic' }}>{cat}</h2>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{items.length}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 36 }}>
            {items.map((r, idx) => (
              <RusticCard key={r.id} recipe={r} idx={idx} favorite={!!favorites[r.id]} onFav={(e) => { e.stopPropagation(); toggleFav(r.id); }} onOpen={() => onOpen(r.id)} />
            ))}
          </div>
        </section>
      ))}

      <footer style={{ marginTop: 80, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>
        <div className="rustic-divider" style={{ marginBottom: 18 }}>
          <span className="script" style={{ fontSize: 22, color: 'var(--terracotta)' }}>bon appétit, my friends</span>
        </div>
        <div className="smallcaps" style={{ fontSize: 10 }}>A family cookbook · made with butter and patience</div>
      </footer>
    </div>
  );
}

function RusticCard({ recipe, idx, favorite, onFav, onOpen }) {
  // Slight rotation + tape for a few cards so it feels scrapbook-y.
  const tilt = [0, 0, -0.4, 0.3, 0, -0.2, 0][idx % 7] || 0;
  return (
    <article className="rustic-card" onClick={onOpen} style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="thumb" style={{ backgroundImage: `url(${recipe.photo})` }}>
        {idx === 0 && (
          <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', width: 64, height: 18, background: 'rgba(220, 200, 160, 0.75)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
        )}
      </div>
      <div style={{ padding: '16px 4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="smallcaps" style={{ fontSize: 10, color: 'var(--terracotta)' }}>{recipe.category}</div>
          <button onClick={onFav} style={{ background: 'none', border: 'none', cursor: 'pointer', color: favorite ? 'var(--burgundy)' : 'var(--ink-mute)', padding: 0 }}>
            {RIcon.heart(favorite)}
          </button>
        </div>
        <h3 className="display" style={{ fontSize: 24, lineHeight: 1.1, margin: '2px 0 6px', fontWeight: 500 }}>{recipe.title}</h3>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.45, marginBottom: 10, textWrap: 'pretty' }}>
          {recipe.blurb}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-mute)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{RIcon.clock()} {recipe.prepMin + recipe.cookMin} min</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{RIcon.users()} {recipe.baseServings}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--gold)' }}>{RIcon.star(true)} {recipe.rating.toFixed(1)}</span>
        </div>
      </div>
    </article>
  );
}

// ─── Recipe detail ───────────────────────────────────────────
function RusticRecipe({ recipe, onBack, onCook, favorite, toggleFav, servings, setServings, note, setNote, checkedIng, toggleIng }) {
  const bump = (d) => setServings(Math.max(1, servings + d));
  return (
    <div className="rustic-fade" style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 56px 80px' }}>
      {/* Back + actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} className="rustic-btn ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {RIcon.back()} back to book
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="rustic-btn ghost" onClick={() => window.print()} title="Print recipe" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {RIcon.print()} print
          </button>
          <button className="rustic-btn ghost" onClick={toggleFav} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: favorite ? 'var(--burgundy)' : undefined, boxShadow: favorite ? 'inset 0 0 0 1.5px var(--burgundy)' : undefined }}>
            {RIcon.heart(favorite)} {favorite ? 'saved' : 'save'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <header style={{ marginBottom: 36 }}>
        <div className="smallcaps" style={{ fontSize: 11, color: 'var(--terracotta)', marginBottom: 12 }}>{recipe.category} · {recipe.cuisine}</div>
        <h1 className="display" style={{ fontSize: 64, lineHeight: 1.02, margin: '0 0 14px', fontWeight: 500, textWrap: 'balance' }}>{recipe.title}</h1>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', fontStyle: 'italic', margin: '0 0 20px', maxWidth: 640, lineHeight: 1.5, textWrap: 'pretty' }}>{recipe.blurb}</p>

        <div style={{ display: 'flex', gap: 28, fontSize: 13, color: 'var(--ink-soft)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="script" style={{ fontSize: 22, color: 'var(--terracotta)' }}>— from {recipe.author}</span>
          <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{RIcon.clock()} prep {recipe.prepMin}′ · cook {recipe.cookMin}′</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{RIcon.spoon()} {recipe.difficulty}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--gold)' }}>
            {[1,2,3,4,5].map(n => <span key={n}>{RIcon.star(n <= Math.round(recipe.rating))}</span>)}
            <span style={{ marginLeft: 6, color: 'var(--ink-soft)' }}>{recipe.rating.toFixed(1)}</span>
          </span>
        </div>
      </header>

      {/* Hero photo */}
      <div style={{ aspectRatio: '16 / 7', backgroundImage: `url(${recipe.photo})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: 36, boxShadow: '0 4px 24px rgba(60,40,20,0.15), inset 0 0 0 1px rgba(0,0,0,0.04)' }} />

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 56 }}>
        {/* Ingredients column */}
        <aside>
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="display" style={{ fontSize: 30, margin: 0, fontWeight: 500, fontStyle: 'italic' }}>Ingredients</h2>
            </div>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '12px 0', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
              <span className="smallcaps" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Servings</span>
              <div className="rustic-stepper">
                <button onClick={() => bump(-1)} disabled={servings <= 1}>–</button>
                <div className="val">{servings}</div>
                <button onClick={() => bump(1)}>+</button>
              </div>
              {servings !== recipe.baseServings && (
                <button onClick={() => setServings(recipe.baseServings)} style={{ fontFamily: 'inherit', background: 'none', border: 'none', color: 'var(--terracotta)', fontSize: 11, cursor: 'pointer', fontStyle: 'italic' }}>
                  reset to {recipe.baseServings}
                </button>
              )}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recipe.ingredients.map((ing, i) => {
                const checked = !!checkedIng[i];
                return (
                  <li key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px dotted var(--line-soft)', alignItems: 'flex-start' }}>
                    <button className={'rustic-checkbox no-print' + (checked ? ' checked' : '')} onClick={() => toggleIng(i)} aria-label="check off">
                      {checked && RIcon.check()}
                    </button>
                    <div style={{ fontSize: 15, lineHeight: 1.4, flex: 1, color: checked ? 'var(--ink-mute)' : 'var(--ink)', textDecoration: checked ? 'line-through' : 'none' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, ui-monospace, monospace', fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, marginRight: 8 }}>
                        {formatAmount(ing.amount * (servings / recipe.baseServings))}{ing.unit ? ' ' + ing.unit : ''}
                      </span>
                      {ing.name}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Steps + notes column */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 30, margin: 0, fontWeight: 500, fontStyle: 'italic' }}>Directions</h2>
            <button className="rustic-btn terra no-print" onClick={onCook}>Start cook mode →</button>
          </div>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, counterReset: 'step' }}>
            {recipe.steps.map((step, i) => {
              const chunks = renderStepText(step.text, recipe, servings);
              return (
                <li key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 16, padding: '18px 0', borderBottom: i < recipe.steps.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <div className="display" style={{ fontSize: 42, color: 'var(--terracotta)', lineHeight: 1, fontStyle: 'italic', fontWeight: 400 }}>{i + 1}</div>
                  <div>
                    <div className="smallcaps" style={{ fontSize: 10, color: 'var(--ink-mute)', marginBottom: 6 }}>{step.title}</div>
                    <p style={{ fontSize: 17, lineHeight: 1.6, margin: 0, color: 'var(--ink)', textWrap: 'pretty' }}>
                      {chunks.map((c, j) => c.type === 'ing'
                        ? <span key={j} style={{ color: 'var(--terracotta-deep)', fontWeight: 500, fontStyle: 'italic' }}>{c.value}</span>
                        : <span key={j}>{c.value}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {recipe.notes && (
            <div style={{ marginTop: 36, padding: '20px 24px', background: 'var(--paper-deep)', borderLeft: '3px solid var(--terracotta)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
              <div className="smallcaps" style={{ fontSize: 10, color: 'var(--terracotta)', marginBottom: 8, fontStyle: 'normal' }}>Chef's note</div>
              {recipe.notes}
            </div>
          )}

          {/* Personal notes */}
          <div style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <h3 className="display" style={{ fontSize: 24, margin: 0, fontWeight: 500, fontStyle: 'italic' }}>My notes</h3>
              <span className="script" style={{ fontSize: 16, color: 'var(--ink-mute)' }}>— what happened when you made it</span>
            </div>
            <textarea
              className="rustic-note"
              placeholder="e.g. 3lb roast, 90 min at 325°, added extra garlic — perfect."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Cook Mode — big type, step-by-step ──────────────────────
function RusticCookMode({ recipe, onBack, servings, checkedSteps, toggleStep }) {
  const [current, setCurrent] = React.useState(0);
  const step = recipe.steps[current];
  const chunks = renderStepText(step.text, recipe, servings);
  const done = !!checkedSteps[current];

  // Keep screen awake while cook mode is open.
  React.useEffect(() => {
    let wakeLock;
    (async () => {
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
    })();
    return () => { try { wakeLock && wakeLock.release(); } catch {} };
  }, []);

  return (
    <div className="rustic-fade" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 40px', borderBottom: '1.5px solid var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} className="rustic-btn ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {RIcon.back()} exit cook mode
        </button>
        <div className="smallcaps" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
          {recipe.title} · step {current + 1} of {recipe.steps.length}
        </div>
      </header>

      {/* Progress bar — chunky, hand-drawn */}
      <div style={{ padding: '0 40px', marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {recipe.steps.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{
              flex: 1, height: 10, border: '1.5px solid var(--ink)',
              background: checkedSteps[i] ? 'var(--terracotta)' : (i === current ? 'var(--ink)' : 'transparent'),
              cursor: 'pointer', padding: 0, borderRadius: 2,
            }} aria-label={`step ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* The step */}
      <main style={{ flex: 1, padding: '60px 40px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="display" style={{ fontSize: 120, color: 'var(--terracotta)', lineHeight: 1, fontStyle: 'italic', marginBottom: 16 }}>{current + 1}</div>
        <h1 className="display" style={{ fontSize: 56, lineHeight: 1.05, margin: '0 0 28px', fontWeight: 500, textWrap: 'balance' }}>{step.title}</h1>
        <p style={{ fontSize: 28, lineHeight: 1.5, color: 'var(--ink)', maxWidth: 820, textWrap: 'pretty' }}>
          {chunks.map((c, j) => c.type === 'ing'
            ? <span key={j} style={{ color: 'var(--terracotta-deep)', fontWeight: 500, background: 'rgba(184,80,42,0.08)', padding: '0 4px', borderRadius: 2 }}>{c.value}</span>
            : <span key={j}>{c.value}</span>
          )}
        </p>

        <button onClick={() => toggleStep(current)} style={{
          marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 12,
          fontFamily: 'inherit', border: 'none', cursor: 'pointer', padding: '14px 22px',
          background: done ? 'var(--olive)' : 'transparent',
          color: done ? 'var(--paper)' : 'var(--ink)',
          boxShadow: done ? 'none' : 'inset 0 0 0 1.5px var(--ink)',
          fontSize: 15, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, borderRadius: 2,
        }}>
          <span className={'rustic-checkbox ' + (done ? 'checked' : '')} style={{ background: done ? 'var(--paper)' : 'transparent', borderColor: done ? 'var(--paper)' : 'var(--ink)', color: done ? 'var(--olive)' : 'transparent' }}>
            {done && RIcon.check()}
          </span>
          {done ? 'done' : 'mark done'}
        </button>
      </main>

      {/* Footer nav */}
      <footer style={{ padding: '20px 40px', borderTop: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <button className="rustic-btn ghost" disabled={current === 0} onClick={() => setCurrent(c => c - 1)} style={{ opacity: current === 0 ? 0.4 : 1 }}>← previous</button>
        {current < recipe.steps.length - 1 ? (
          <button className="rustic-btn terra" onClick={() => { toggleStep(current); setCurrent(c => c + 1); }}>next step →</button>
        ) : (
          <button className="rustic-btn" onClick={onBack}>finish · you did it ✓</button>
        )}
      </footer>
    </div>
  );
}

window.RusticApp = RusticApp;
})();
