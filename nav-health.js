// Nav-link health-probe helper. Each top-level page that has a "coming-soon"
// nav span tied to a Cloudflare-tunneled subsite calls enableNavWhenLive once
// per nav. On a 200 from the tunnel's /health, the <span> is replaced with a
// live <a> link.
//
// Replaces the per-page inline IIFE that previously did the same probe just
// for Music. See docs/adr/024-lookout-nav-and-shared-health-helper.md.
//
// New nav entry? Add the <span id="X-nav" class="nav-link coming-soon" ...>
// to the page, then add one enableNavWhenLive call below.

(function () {
  function enableNavWhenLive(id, healthUrl, label) {
    var el = document.getElementById(id);
    if (!el) return; // page doesn't carry this nav entry — silent no-op

    var ctrl = new AbortController();
    setTimeout(function () { ctrl.abort(); }, 4000);

    fetch(healthUrl, { signal: ctrl.signal, mode: 'cors' })
      .then(function (r) {
        if (!r.ok) return;
        var a = document.createElement('a');
        a.href = healthUrl.replace(/\/health$/, '');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'nav-link nav-link-live';
        a.style.cssText = el.style.cssText;
        a.textContent = label;
        el.replaceWith(a);
      })
      .catch(function () { /* tunnel down or timed out — keep "soon" placeholder */ });
  }

  // Music: separate Cloudflare zone (thewiseguy.ai), cross-origin probe.
  enableNavWhenLive('music-nav',   'https://dj.thewiseguy.ai/health', 'Music');

  // Lookout: same-origin path-based (chases.house/the-lookout/health behind
  // a Cloudflare Worker that splits traffic to a Tunnel). See ADR-024.
  enableNavWhenLive('lookout-nav', '/the-lookout/health',             'Lookout');
})();
