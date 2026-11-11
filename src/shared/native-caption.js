/**
 * Selector-independent detection of HBO's own (native) caption element.
 * HBO's class names are obfuscated and change between releases, so instead of guessing
 * selectors we find the element whose text IS the current English cue.
 */

/**
 * Lowercases and strips ALL whitespace so that separately rendered lines
 * ("Right, you're not" + "even getting your honeymoon.") compare equal to the cue text.
 * @param {string} s
 * @returns {string}
 */
export function compactCaptionText(s) {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/\s+/g, '');
}

function hasExcludedAncestor(node, root, isExcluded) {
  let cur = node;
  while (cur && cur !== root) {
    if (cur.nodeType === 1 && isExcluded(cur)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function walkTextNodes(node, visit) {
  const kids = node.childNodes || [];
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (child.nodeType === 3) visit(child);
    else if (child.nodeType === 1) walkTextNodes(child, visit);
  }
}

/**
 * Finds the outermost elements under `root` that render nothing but (parts of) the given cue text.
 * Text that is not part of the cue (episode title, tabs, buttons) is never matched.
 * @param {Node} root Search root (player container); never returned itself
 * @param {string} cueText Current English cue text (may contain several recent cues)
 * @param {(el: Element) => boolean} [isExcluded] Elements (and descendants) to skip
 * @returns {Element[]}
 */
export function findNativeCaptionElements(root, cueText, isExcluded = () => false) {
  const full = compactCaptionText(cueText);
  if (!root || !full) return [];

  const found = new Set();
  walkTextNodes(root, (textNode) => {
    const t = compactCaptionText(textNode.textContent);
    if (t.length < 2 || !full.includes(t)) return;

    let el = textNode.parentElement;
    if (!el || el === root || hasExcludedAncestor(el, root, isExcluded)) return;

    while (el.parentElement && el.parentElement !== root) {
      const parentText = compactCaptionText(el.parentElement.textContent);
      if (parentText && full.includes(parentText) && !isExcluded(el.parentElement)) {
        el = el.parentElement;
      } else {
        break;
      }
    }
    found.add(el);
  });

  // Drop elements nested inside another match (keep the outermost)
  const all = [...found];
  return all.filter((a) => !all.some((b) => b !== a && isInside(a, b)));
}

function isInside(node, ancestor) {
  let cur = node.parentElement;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parentElement;
  }
  return false;
}
