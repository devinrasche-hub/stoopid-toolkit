// Sizes each framed page to its own content, the way the old host did, so the
// whole page scrolls as one document. The frames are same-origin files in embeds/.
(function () {
  var frames = [].slice.call(document.querySelectorAll('iframe.embed'));
  if (!frames.length) return;

  function fit(f) {
    var doc;
    try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement || !doc.body) return;
    var h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    if (h && Math.abs(h - f.offsetHeight) > 1) f.style.height = h + 'px';
  }

  // Re-measure from a small height so a frame can shrink as well as grow.
  function refit(f) {
    f.style.height = '200px';
    fit(f);
  }

  function watch(f) {
    refit(f);
    var doc;
    try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
    if (window.ResizeObserver) {
      new ResizeObserver(function () { fit(f); }).observe(doc.body);
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { fit(f); });
    [300, 1200, 3000].forEach(function (t) { setTimeout(function () { fit(f); }, t); });
  }

  frames.forEach(function (f) {
    f.addEventListener('load', function () { watch(f); });
    try {
      if (f.contentDocument && f.contentDocument.readyState === 'complete' &&
          f.contentDocument.body && f.contentDocument.body.childElementCount) watch(f);
    } catch (e) {}
  });

  var timer, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return; // ignore mobile toolbar show/hide
    lastW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(function () { frames.forEach(refit); }, 150);
  });
})();
