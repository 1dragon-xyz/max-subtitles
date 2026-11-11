import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCaptionText, findNativeCaptionElements } from '../src/shared/native-caption.js';

// Minimal fake DOM (nodeType, childNodes, parentElement, textContent)
function txt(s) {
  return { nodeType: 3, textContent: s, parentElement: null };
}
function el(tag, children = [], attrs = {}) {
  const node = {
    nodeType: 1,
    tagName: tag,
    id: attrs.id || '',
    childNodes: children,
    parentElement: null,
    get textContent() {
      return this.childNodes.map((c) => c.textContent).join('');
    }
  };
  children.forEach((c) => {
    c.parentElement = node;
  });
  return node;
}

const notOurs = (node) => node.id === 'max-vietsub-overlay';

test('compactCaptionText - lowercases and strips all whitespace', () => {
  assert.equal(compactCaptionText("  Right, you're\n not  "), "right,you'renot");
  assert.equal(compactCaptionText(''), '');
  assert.equal(compactCaptionText(null), '');
});

test('findNativeCaptionElements - finds the two-line HBO caption wrapper regardless of class names', () => {
  const line1 = el('DIV', [txt("Right, you're not")]);
  const line2 = el('DIV', [txt('even getting your honeymoon.')]);
  const captionWrapper = el('DIV', [line1, line2]);
  const title = el('DIV', [txt('Mở Đầu')]);
  const tab = el('DIV', [txt('Tập')]);
  const root = el('DIV', [captionWrapper, title, tab]);

  const found = findNativeCaptionElements(root, "Right, you're not\neven getting your honeymoon.", notOurs);
  assert.deepEqual(found, [captionWrapper]);
});

test('findNativeCaptionElements - never touches episode title or other UI text', () => {
  const title = el('SPAN', [txt('Mở Đầu')]);
  const root = el('DIV', [title]);
  assert.deepEqual(findNativeCaptionElements(root, 'Hello there!', notOurs), []);
});

test('findNativeCaptionElements - ignores text inside our own overlay', () => {
  const span = el('SPAN', [txt('Hello there!')]);
  const overlay = el('DIV', [span], { id: 'max-vietsub-overlay' });
  const root = el('DIV', [overlay]);
  assert.deepEqual(findNativeCaptionElements(root, 'Hello there!', notOurs), []);
});

test('findNativeCaptionElements - returns [] for empty cue text or missing root', () => {
  const root = el('DIV', [el('DIV', [txt('Hello')])]);
  assert.deepEqual(findNativeCaptionElements(root, '', notOurs), []);
  assert.deepEqual(findNativeCaptionElements(null, 'Hello', notOurs), []);
});

test('findNativeCaptionElements - does not climb into a parent that also holds unrelated text', () => {
  const caption = el('DIV', [txt('Hello there!')]);
  const unrelated = el('DIV', [txt('Có thể bạn cũng thích')]);
  const parent = el('DIV', [caption, unrelated]);
  const root = el('DIV', [parent]);
  assert.deepEqual(findNativeCaptionElements(root, 'Hello there!', notOurs), [caption]);
});

test('findNativeCaptionElements - ignores 1-character text nodes', () => {
  const root = el('DIV', [el('SPAN', [txt('a')])]);
  assert.deepEqual(findNativeCaptionElements(root, 'a b c', notOurs), []);
});
