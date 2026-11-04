// three.js with nothing to draw on: everything real (the scene graph, the maths, the geometry the rules measure), and
// a renderer that accepts anything and does nothing.
import { blank } from './dom-shim.mjs';
export * from 'three';

export class WebGLRenderer {
  constructor(opts = {}) {
    this.domElement = opts.canvas || document.createElement('canvas');
    return new Proxy(this, { get: (t, k) => (k in t ? t[k] : blank), set: (t, k, v) => { t[k] = v; return true; } });
  }
}
