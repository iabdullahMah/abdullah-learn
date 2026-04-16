/* abdullah-learn — shared page enhancements.
   Auto-wires on DOMContentLoaded for any page that includes this file.

   What it does:
     1. Copy-to-clipboard button on every <pre> block.
     2. Auto table of contents from <h2>/<h3> inside <article.page>,
        mounted into any <nav class="toc"> placeholder. Falls back to
        doing nothing if the page has fewer than 3 headings or no mount.
     3. Clickable tags: every <a class="tag" data-tag="foo"> points to
        /?tag=foo (index reads that param and pre-fills search).
     4. Prism init: if the page includes Prism and has <code class="language-*">
        blocks, runs highlight on load.
*/

(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // ---- 1. Copy buttons on <pre> blocks -------------------------------------
  function addCopyButtons() {
    var pres = document.querySelectorAll('article.page pre, .prose pre, main pre');
    pres.forEach(function (pre) {
      if (pre.dataset.copyWired === '1') return;
      pre.dataset.copyWired = '1';

      // Ensure positioning context.
      var cs = getComputedStyle(pre);
      if (cs.position === 'static') pre.style.position = 'relative';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.textContent = 'copy';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var code = pre.querySelector('code');
        var text = (code ? code.innerText : pre.innerText) || '';
        var done = function () {
          btn.textContent = 'copied';
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('is-copied');
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(fallback);
        } else {
          fallback();
        }
        function fallback() {
          try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
          } catch (err) { /* swallow */ }
        }
      });

      pre.appendChild(btn);
    });
  }

  // ---- 2. Auto table of contents -------------------------------------------
  function buildToc() {
    var mount = document.querySelector('nav.toc');
    if (!mount) return;

    var scope = document.querySelector('article.page') || document.querySelector('main') || document.body;
    var headings = scope.querySelectorAll('h2[id], h3[id], h2, h3');
    if (headings.length < 3) { mount.style.display = 'none'; return; }

    var slug = function (s) {
      return (s || '').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
    };

    var items = [];
    headings.forEach(function (h) {
      if (!h.id) {
        var base = slug(h.textContent);
        if (!base) return;
        var id = base, n = 2;
        while (document.getElementById(id)) { id = base + '-' + n++; }
        h.id = id;
      }
      items.push({ id: h.id, text: h.textContent.trim(), level: h.tagName === 'H2' ? 2 : 3 });
    });

    var html = '<div class="toc-title">on this page</div><ol class="toc-list">';
    items.forEach(function (it) {
      html += '<li class="toc-l' + it.level + '"><a href="#' + it.id + '">' + escapeHtml(it.text) + '</a></li>';
    });
    html += '</ol>';
    mount.innerHTML = html;

    // Active-state tracking on scroll.
    var links = mount.querySelectorAll('a[href^="#"]');
    var linkById = {};
    links.forEach(function (a) { linkById[a.getAttribute('href').slice(1)] = a; });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (ent) {
          var a = linkById[ent.target.id];
          if (!a) return;
          if (ent.isIntersecting) {
            links.forEach(function (x) { x.classList.remove('is-active'); });
            a.classList.add('is-active');
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      headings.forEach(function (h) { if (h.id) io.observe(h); });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- 3. Clickable tags ---------------------------------------------------
  function wireTags() {
    var tags = document.querySelectorAll('a.tag[data-tag], .tags a.tag[data-tag]');
    tags.forEach(function (a) {
      if (a.dataset.tagWired === '1') return;
      a.dataset.tagWired = '1';
      var t = a.getAttribute('data-tag');
      if (!a.getAttribute('href') && t) a.setAttribute('href', '/?tag=' + encodeURIComponent(t));
    });
  }

  // ---- 4. Prism init (if Prism loaded) -------------------------------------
  function initPrism() {
    if (window.Prism && typeof window.Prism.highlightAll === 'function') {
      try { window.Prism.highlightAll(); } catch (e) { /* noop */ }
    }
  }

  onReady(function () {
    addCopyButtons();
    buildToc();
    wireTags();
    initPrism();
  });
})();
