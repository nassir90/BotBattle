// What the game's code expects of a browser, for a worker with no browser: elements that accept anything and remember
// little, so the game's interface code runs without effect. No element keeps its children: nothing here is ever looked
// at, and the game adds and removes floating text all match.
const noop = () => {};
// something that can be called, read or set however deep: a renderer's settings, a 2D context
export const blank = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : blank),
  set: () => true,
  apply: () => blank,
  construct: () => blank,
});
const emptyStyle = new Proxy({}, { get: (t, k) => (k === 'setProperty' || k === 'removeProperty' ? noop : ''), set: () => true });
const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };

class El {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.hidden = true; this.dataset = {}; this.value = ''; this.textContent = ''; this.innerHTML = '';
    this.width = 1280; this.height = 720; this.clientWidth = 1280; this.clientHeight = 720; this.offsetWidth = 1280; this.offsetHeight = 720;
    this.clientLeft = 0; this.clientTop = 0; this.disabled = false; this.parentNode = null;
  }
  get style() { return emptyStyle; }
  set style(v) { /* nothing to style */ }
  get classList() { return classList; }
  get children() { return []; }
  get firstChild() { return null; }
  get offsetParent() { return null; }
  get parentElement() { return new El(); }
  addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
  appendChild(c) { return c; } append() {} prepend() {} remove() {} after() {} before() {} insertBefore(c) { return c; } replaceChildren() {}
  querySelector() { return new El(); } querySelectorAll() { return []; } closest() { return null; } contains() { return false; }
  cloneNode() { return new El(this.tagName); }
  setAttribute() {} getAttribute() { return null; } removeAttribute() {} hasAttribute() { return false; }
  focus() {} blur() {} click() {} scrollIntoView() {} setPointerCapture() {} releasePointerCapture() {} animate() { return blank; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720, x: 0, y: 0 }; }
  getContext() { return blank; } toDataURL() { return ''; }
}

const elements = new Map();
globalThis.window = globalThis;
globalThis.document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, new El()); return elements.get(id); },
  createElement: tag => new El(tag), createElementNS: (ns, tag) => new El(tag),
  querySelector: () => new El(), querySelectorAll: () => [],
  body: new El('body'), head: new El('head'), documentElement: new El('html'), activeElement: null,
  addEventListener: noop, removeEventListener: noop, hidden: false, visibilityState: 'visible',
};
globalThis.location = { hostname: 'headless', host: 'headless', origin: 'http://headless', href: 'http://headless/', protocol: 'http:', pathname: '/', search: '', hash: '', replace: noop, assign: noop };
globalThis.history = { replaceState: noop, pushState: noop };
const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, String(v)); }, removeItem: k => { memory.delete(k); } };
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { clipboard: blank, userAgent: 'headless', maxTouchPoints: 0 }, configurable: true });
Object.assign(globalThis, {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  addEventListener: noop, removeEventListener: noop, requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  getComputedStyle: () => emptyStyle, Image: class extends El {},
  // enough XML for three's SVGLoader, which is only ever given <svg ...><path d="..."/></svg> (the logos)
  DOMParser: class {
    parseFromString(text) {
      const node = (name, attrs, childNodes = []) => ({
        nodeName: name, nodeType: 1, childNodes, style: emptyStyle, textContent: '',
        hasAttribute: k => k in attrs, getAttribute: k => attrs[k] ?? null, getAttributeNS: () => null,
        querySelectorAll: () => [],
      });
      const attrsOf = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      const svg = text.match(/<svg([^>]*)>/), paths = [...text.matchAll(/<path([^>]*?)\/>/g)];
      return { documentElement: node('svg', attrsOf(svg[1]), paths.map(p => node('path', attrsOf(p[1])))), querySelectorAll: () => [] };
    }
  },
});
