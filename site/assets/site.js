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

// Newsletter and Earn sign-ups post to /api/signup on this site.
(function () {
  var loaded = Date.now();
  [].forEach.call(document.querySelectorAll('form.signup'), function (form) {
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('button');
    function say(text, cls) { msg.textContent = text; msg.className = 'form-msg ' + cls; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { list: form.getAttribute('data-list'), elapsed_ms: Date.now() - loaded };
      [].forEach.call(form.elements, function (el) { if (el.name) data[el.name] = el.value.trim(); });
      if (!/^\S+@\S+\.\S+$/.test(data.email || '')) { say('Add a real email address.', 'bad'); form.elements.email.focus(); return; }
      if (form.elements.first_name && !data.first_name) { say('Add your first name.', 'bad'); form.elements.first_name.focus(); return; }
      btn.disabled = true; say('Sending...', '');
      fetch(form.getAttribute('action'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          if (res.ok && out.ok) { form.reset(); say("You're in. Thanks.", 'ok'); }
          else { say(out.error || "That didn't go through. Try again in a minute.", 'bad'); }
        });
      }).catch(function () {
        say("That didn't go through. Check your connection and try again.", 'bad');
      }).then(function () { btn.disabled = false; });
    });
  });
})();
