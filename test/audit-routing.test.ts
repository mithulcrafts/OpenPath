import test from 'node:test';
import assert from 'node:assert/strict';
import { nextInspectionLinks } from '../server/audit.js';
import type { PageEvidence } from '../shared/types.js';

const origin = 'https://product.example';
function page(pathname: string, links: [string, string][]): PageEvidence {
  return { id: 'page', url: `${origin}${pathname}`, title: 'Product', status: 200, rawTextLength: 100, renderedTextLength: 100, text: 'Product',
    headings: ['Product'], controls: [], links: links.map(([text, href]) => ({ text, href })), structuredData: { valid: 0, invalid: 0, types: [] },
    consoleErrors: [], requestErrors: [], inspectedAt: '2026-10-31T00:00:00.000Z' };
}

test('a focused product scan prioritizes relevant descendants over global shopping navigation', () => {
  const result = nextInspectionLinks(page('/in/tablet/', [
    ['Store', '/in/store'], ['Products', '/products'], ['Overview', '/in/tablet/'],
    ['Pricing', '/pricing'], ['Compare tablets', '/in/tablet/compare/'],
    ['Specifications', '/in/tablet/specs'], ['Learn more', '/in/tablet/features'],
    ['Sibling model', '/in/tablet-pro/'],
  ]), origin);
  assert.deepEqual(result.slice(0, 3), [`${origin}/in/tablet/compare/`, `${origin}/in/tablet/specs`, `${origin}/in/tablet/features`]);
  assert.equal(result.includes(`${origin}/in/tablet/`), false, 'Do not waste a page on a self link');
  assert(result.indexOf(`${origin}/in/tablet-pro/`) > result.indexOf(`${origin}/in/store`), 'A common string prefix is not a descendant path');
});

test('root scans rank task information before store and generic footer links', () => {
  const result = nextInspectionLinks(page('/', [
    ['Legal', '/legal'], ['Shop', '/shop'], ['About', '/about'], ['Features', '/features'],
    ['Compare options', '/compare'], ['Documentation', '/docs'], ['Pricing', '/pricing'],
  ]), origin);
  assert.deepEqual(result, ['/compare', '/pricing', '/features', '/docs', '/shop', '/about', '/legal'].map(pathname => origin + pathname));
});

test('focus remains on the original product when inspecting its descendants', () => {
  const result = nextInspectionLinks(page('/workspace/specs', [
    ['Store', '/store'], ['Manual', '/workspace/guide'], ['Compare', '/other/compare'], ['Specifications', '/workspace/specs#size'],
  ]), origin, `${origin}/workspace/`);
  assert.equal(result[0], `${origin}/workspace/guide`);
  assert.equal(result.some(url => url.includes('/workspace/specs')), false);
});

test('candidate selection excludes other origins, files, credentials and mutation-like paths', () => {
  const links: [string, string][] = [
    ['External', 'https://elsewhere.example/compare'], ['Other scheme', 'http://product.example/compare'],
    ['Email', 'mailto:sales@product.example'], ['Script', 'javascript:alert(1)'],
    ['Credentials', 'https://name:password@product.example/specs'],
    ['Download', '/guide.PDF#page=2'], ['App', '/app.apk'], ['API schema', '/spec.json'],
    ['Log out', '/logout'], ['Sign out', '/sign-out'], ['Delete', '/%64elete/account'],
    ['Remove', '/remove/item'], ['Unsubscribe', '/unsubscribe'], ['Checkout', '/checkout'], ['Payment', '/payment'],
    ['Broken encoding', '/bad%ZZ'], ['Supported', '/products/compare'],
  ];
  assert.deepEqual(nextInspectionLinks(page('/', links), origin), [`${origin}/products/compare`]);
});

test('fragments and slash aliases do not consume separate pages; query variants remain distinct', () => {
  const result = nextInspectionLinks(page('/products/', [
    ['Top', '#top'], ['Overview', '/products#overview'], ['Details', '/products/details#size'],
    ['Details duplicate', '/products/details/#colors'], ['Variant one', '/products/details?model=one'],
    ['Variant two', '/products/details?model=two'],
  ]), origin);
  assert.deepEqual(result, [`${origin}/products/details`, `${origin}/products/details?model=one`, `${origin}/products/details?model=two`]);
});
