// three.js with nothing to draw on: everything real (the scene graph, the maths), a renderer that accepts anything and
// does nothing, and shapes without vertices. Only drawing reads a vertex, and building them is most of what a worker
// allocates while it loads: 190 MB of garbage, and buffers it would hold on to for good.
import { blank } from './dom-shim.mjs';
import { BufferGeometry, Float32BufferAttribute } from './generated/three.core.mjs';
export * from './generated/three.core.mjs';

export class WebGLRenderer {
  constructor(opts = {}) {
    this.domElement = opts.canvas || document.createElement('canvas');
    return new Proxy(this, { get: (t, k) => (k in t ? t[k] : blank), set: (t, k, v) => { t[k] = v; return true; } });
  }
}

class NoVertices extends BufferGeometry {
  constructor() { super(); this.setAttribute('position', new Float32BufferAttribute([], 3)); }
}
export {
  NoVertices as BoxGeometry, NoVertices as CylinderGeometry, NoVertices as EdgesGeometry, NoVertices as ExtrudeGeometry, NoVertices as LatheGeometry,
  NoVertices as OctahedronGeometry, NoVertices as PlaneGeometry, NoVertices as SphereGeometry, NoVertices as TorusGeometry, NoVertices as TubeGeometry,
};
