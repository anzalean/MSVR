/**
 * components.js
 * A-Frame custom components for the AR Gross Topology Mesh scene.
 * Must be loaded AFTER aframe and AR.js, but BEFORE the <a-scene>.
 */

document.addEventListener('DOMContentLoaded', function () {

  /* ─────────────────────────────────────────────
   * shoe-surface
   * Parametric surface:  z = (s³/3 − t²/2) * zScale
   * Rebuilds geometry when structural params change;
   * hot-swaps material props (color, wireframe) without rebuild.
   * ───────────────────────────────────────────── */
  AFRAME.registerComponent('shoe-surface', {
    schema: {
      sMin:      { type: 'number',  default: -1.4   },
      sMax:      { type: 'number',  default:  1.4   },
      tMin:      { type: 'number',  default: -1.0   },
      tMax:      { type: 'number',  default:  1.0   },
      sSegs:     { type: 'number',  default:  60    },
      tSegs:     { type: 'number',  default:  60    },
      zScale:    { type: 'number',  default:  0.6   },
      color:     { type: 'color',   default: '#FF69B4' },
      wireframe: { type: 'boolean', default: false  }
    },

    init() {
      this.build();
    },

    update(old) {
      const geoKeys = ['sMin', 'sMax', 'tMin', 'tMax', 'sSegs', 'tSegs', 'zScale'];
      if (geoKeys.some(k => old[k] !== this.data[k])) {
        this.el.removeObject3D('mesh');
        this.build();
      } else if (this.mesh) {
        if (old.color     !== this.data.color)     this.mesh.material.color.set(this.data.color);
        if (old.wireframe !== this.data.wireframe) this.mesh.material.wireframe = this.data.wireframe;
      }
    },

    /** Evaluate one surface vertex at (s, t). */
    vertex(s, t, zScale) {
      const z = (Math.pow(s, 3) / 3 - Math.pow(t, 2) / 2) * zScale;
      return [s, z, t];
    },

    build() {
      const { sMin, sMax, tMin, tMax, sSegs, tSegs, zScale, color, wireframe } = this.data;
      const positions = [];
      const indices   = [];
      const cols      = tSegs + 1;

      for (let si = 0; si <= sSegs; si++) {
        const s = sMin + (si / sSegs) * (sMax - sMin);
        for (let ti = 0; ti <= tSegs; ti++) {
          const t = tMin + (ti / tSegs) * (tMax - tMin);
          positions.push(...this.vertex(s, t, zScale));
        }
      }

      for (let si = 0; si < sSegs; si++) {
        for (let ti = 0; ti < tSegs; ti++) {
          const a = si * cols + ti;
          const b = a + 1;
          const c = (si + 1) * cols + ti;
          const d = c + 1;
          indices.push(a, b, c,  b, d, c);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color,
        side:      THREE.DoubleSide,
        wireframe,
        metalness: 0.4,
        roughness: 0.4
      });

      this.mesh = new THREE.Mesh(geo, mat);
      this.el.setObject3D('mesh', this.mesh);
    },

    remove() {
      if (this.mesh) this.el.removeObject3D('mesh');
    }
  });


  /* ─────────────────────────────────────────────
   * spin-axis
   * Continuously rotates the entity around one or
   * more world axes at a configurable rate (rad/s).
   * ───────────────────────────────────────────── */
  AFRAME.registerComponent('spin-axis', {
    schema: {
      active: { type: 'boolean', default: true   },
      rate:   { type: 'number',  default: 0.35   },
      axes:   { type: 'string',  default: 'y'    }
    },

    init() {
      this.angle = { x: 0, y: 0, z: 0 };
    },

    tick(_, deltaMs) {
      if (!this.data.active) return;
      const delta = (deltaMs / 1000) * this.data.rate;
      const ax    = this.data.axes;
      if (ax.includes('x')) this.angle.x += delta;
      if (ax.includes('y')) this.angle.y += delta;
      if (ax.includes('z')) this.angle.z += delta;
      this.el.object3D.rotation.set(this.angle.x, this.angle.y, this.angle.z);
    }
  });

});