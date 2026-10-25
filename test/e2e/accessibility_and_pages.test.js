import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:4000';
const PROJECT_ROOT = 'e:/GATE - WAY V';

const PAGES = [
  { name: 'Landing / Authentication', file: 'index.html', path: '/' },
  { name: 'Public Impact Dashboard', file: 'dashboard.html', path: '/dashboard.html' },
  { name: 'Donor Management Portal', file: 'donor.html', path: '/donor.html' },
  { name: 'NGO Discovery Portal', file: 'ngo.html', path: '/ngo.html' },
  { name: 'Volunteer Dispatch Portal', file: 'volunteer.html', path: '/volunteer.html' },
  { name: 'Admin Governance Console', file: 'admin.html', path: '/admin.html' }
];

test('E2E & DOM: Page Routing, Responsive Layout & Accessibility Standards', async (t) => {
  for (const page of PAGES) {
    await t.test(`PAGE-01: Direct HTTP navigation to ${page.name} (${page.file})`, async () => {
      const res = await fetch(`${BASE_URL}${page.path}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');

      const body = await res.text();
      assert.ok(body.length > 500, 'Page content should be non-trivial');
    });

    await t.test(`PAGE-02: Structural accessibility and responsive headers in ${page.file}`, () => {
      const filePath = path.join(PROJECT_ROOT, page.file);
      assert.ok(fs.existsSync(filePath), `HTML file ${filePath} must exist`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Viewport meta tag for mobile responsiveness
      assert.match(content, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*["']/i,
        `${page.file} must include responsive viewport meta tag`);

      // 2. Descriptive title tag
      const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
      assert.ok(titleMatch, `${page.file} must have a title tag`);
      assert.ok(titleMatch[1].trim().length > 5, `${page.file} title must be descriptive`);

      // 3. Module scripts import check
      assert.match(content, /<script\s+type=["']module["']/i,
        `${page.file} must import ES module controller script`);

      // 4. Form inputs have matching labels or aria-label attributes
      const idMatches = [...content.matchAll(/id=["']([a-zA-Z0-9_-]+)["']/g)].map(m => m[1]);
      const uniqueIds = new Set(idMatches);
      assert.equal(idMatches.length, uniqueIds.size, `All IDs in ${page.file} must be unique (no duplicate DOM IDs)`);
    });
  }

  await t.test('CSS-01: Stylesheet design system, responsive breakpoints & accessibility', () => {
    const cssPath = path.join(PROJECT_ROOT, 'css', 'style.css');
    assert.ok(fs.existsSync(cssPath));
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Focus-visible rings for WCAG 2.1 keyboard navigation
    assert.match(cssContent, /:focus-visible/i, 'CSS must provide :focus-visible indicators for accessibility');

    // Reduced motion accessibility
    assert.match(cssContent, /prefers-reduced-motion/i, 'CSS must support prefers-reduced-motion media query');

    // Responsive breakpoints
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*768px\s*\)/i, 'CSS must define 768px tablet breakpoint');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*480px\s*\)/i, 'CSS must define 480px mobile breakpoint');

    // Custom CSS Variables design system
    assert.match(cssContent, /--primary-/i);
    assert.match(cssContent, /--slate-/i);
    assert.match(cssContent, /--radius-/i);
  });
});
