// Every relative href/src referenced by index.html and README.md must
// resolve to a file that actually exists in the repo.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function isExternal(ref) {
  return /^(https?:)?\/\//i.test(ref) || /^(mailto:|tel:|data:|javascript:|#)/i.test(ref);
}

function stripRef(ref) {
  return ref.split('#')[0].split('?')[0];
}

function collectHtmlRefs(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const refs = [];
  const re = /(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[2]);
  return refs;
}

function collectMarkdownRefs(file) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const refs = [];
  // [text](target) and ![alt](target)
  const linkRe = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = linkRe.exec(md)) !== null) refs.push(m[1]);
  // raw html in markdown
  const htmlRe = /(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  while ((m = htmlRe.exec(md)) !== null) refs.push(m[2]);
  return refs;
}

const sources = [
  { file: 'index.html', refs: collectHtmlRefs('index.html') },
  { file: 'README.md', refs: collectMarkdownRefs('README.md') },
];

for (const { file, refs } of sources) {
  const relative = [...new Set(refs.map(stripRef))].filter((r) => r && !isExternal(r));

  test(`${file}: all ${relative.length} relative references resolve`, async () => {
    // guard against parser rot: an empty collection means the regexes
    // matched nothing, not that the file is clean
    expect(refs.length, `no references collected from ${file} at all`).toBeGreaterThan(0);
    const missing = relative.filter((ref) => {
      const target = path.resolve(ROOT, ref.replace(/^\//, ''));
      return !fs.existsSync(target);
    });
    expect(missing, `broken relative references in ${file}`).toEqual([]);
  });
}

// Files the README names in prose/backticks (which the markdown-link regex
// doesn't parse) must actually exist in the repo.
test('README.md: files named in prose exist', async () => {
  const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const ref of ['kwtf_trail_loop.mp3', 'registry/']) {
    expect(md, `README no longer mentions ${ref} — update this test`).toContain(ref);
    expect(fs.existsSync(path.resolve(ROOT, ref)), `${ref} named in README but missing from repo`).toBe(true);
  }
});
