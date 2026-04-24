// Shared recipe logic — scaling, search, filtering, and small UI helpers.
// Exposed on `window` so both design directions can use them.

// ─── Amount formatting ────────────────────────────────────────
// Pretty fraction display: 0.5 → "½", 1.25 → "1¼", 0.333 → "⅓".
// Falls back to single-decimal rounding for non-canonical fractions.
const FRACTIONS = [
  [1/8, '⅛'], [1/6, '⅙'], [1/4, '¼'], [1/3, '⅓'],
  [3/8, '⅜'], [1/2, '½'], [5/8, '⅝'], [2/3, '⅔'],
  [3/4, '¾'], [5/6, '⅚'], [7/8, '⅞'],
];

function formatAmount(n) {
  if (n == null || isNaN(n)) return '';
  if (n === 0) return '0';
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.02) return String(whole);
  // try to match a known unicode fraction within 0.02
  let best = null, bestDist = 0.04;
  for (const [val, glyph] of FRACTIONS) {
    const d = Math.abs(frac - val);
    if (d < bestDist) { best = glyph; bestDist = d; }
  }
  if (best) return whole > 0 ? `${whole}${best}` : best;
  // no good fraction match — use up to 2 decimals, trim zeros
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

// Scale a recipe's ingredients to a target serving count.
function scaledIngredient(ing, servings, baseServings) {
  const factor = servings / baseServings;
  return { ...ing, amount: ing.amount * factor };
}

// Format one ingredient as "3½ cups flour".
function ingredientLine(ing, servings, baseServings) {
  const scaled = scaledIngredient(ing, servings, baseServings);
  const amt = formatAmount(scaled.amount);
  const parts = [amt];
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  return parts.filter(Boolean).join(' ');
}

// Replace {i:N} tokens in step text with scaled ingredient lines.
// Returns an array of {type:'text'|'ing', value} chunks so consumers can
// style ingredient references differently from plain text.
function renderStepText(text, recipe, servings) {
  const re = /\{i:(\d+)\}/g;
  const out = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    const ing = recipe.ingredients[+m[1]];
    if (ing) out.push({ type: 'ing', value: ingredientLine(ing, servings, recipe.baseServings) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

// ─── Search + filter ──────────────────────────────────────────
function matchesSearch(recipe, q) {
  if (!q) return true;
  const needle = q.toLowerCase().trim();
  if (!needle) return true;
  const hay = [
    recipe.title,
    recipe.blurb,
    recipe.author,
    recipe.category,
    recipe.cuisine,
    ...recipe.tags,
    ...recipe.ingredients.map(i => i.name),
    ...recipe.steps.map(s => s.title + ' ' + s.text),
  ].join(' ').toLowerCase();
  return hay.includes(needle);
}

function matchesTags(recipe, selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return true;
  // AND logic — recipe must include every selected tag.
  return selectedTags.every(t => recipe.tags.includes(t));
}

function filterRecipes(recipes, { query, tags, category, favoritesOnly, favorites }) {
  return recipes.filter(r => {
    if (category && category !== 'All' && r.category !== category) return false;
    if (favoritesOnly && !(favorites && favorites[r.id])) return false;
    if (!matchesTags(r, tags)) return false;
    if (!matchesSearch(r, query)) return false;
    return true;
  });
}

// Group recipes by category, preserving category display order.
function groupByCategory(recipes, order = ['Mains', 'Sides', 'Appetizers', 'Sauces', 'Breakfast', 'Desserts', 'Other']) {
  const groups = {};
  for (const c of order) groups[c] = [];
  for (const r of recipes) {
    const c = order.includes(r.category) ? r.category : 'Other';
    groups[c].push(r);
  }
  return order.map(c => ({ category: c, recipes: groups[c] })).filter(g => g.recipes.length > 0);
}

// ─── localStorage helpers ─────────────────────────────────────
// Keyed per design direction so rustic/minimal don't collide.
function useLocalState(key, initial) {
  const [val, setVal] = React.useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// ─── Count tag occurrences across a recipe set ────────────────
function tagCounts(recipes) {
  const counts = {};
  for (const r of recipes) for (const t of r.tags) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

window.RLib = {
  formatAmount,
  scaledIngredient,
  ingredientLine,
  renderStepText,
  matchesSearch,
  matchesTags,
  filterRecipes,
  groupByCategory,
  useLocalState,
  tagCounts,
};
