// Uniform-grid spatial hash over the XZ plane for broad-phase collisions.
// Buckets enemy indices by cell so projectile/player queries only inspect a
// few cells instead of every enemy (O(1)-ish vs O(n)). Rebuilt each frame.
export class SpatialHash {
  constructor(cellSize = 4) {
    this.cellSize = cellSize;
    this.cells = new Map(); // packed key -> array of enemy indices
    this._pool = [];        // reusable arrays to avoid per-frame allocation
  }

  _key(cx, cz) {
    // Pack two signed ints into one string key (fast + collision-free here).
    return cx * 100000 + cz;
  }

  _acquire() {
    const a = this._pool.pop();
    if (a) { a.length = 0; return a; }
    return [];
  }

  // Rebuild from an EnemyManager's active slots.
  rebuild(enemies) {
    for (const arr of this.cells.values()) this._pool.push(arr);
    this.cells.clear();
    const cs = this.cellSize;
    for (let i = 0; i < enemies.capacity; i++) {
      if (!enemies.active[i]) continue;
      const cx = Math.floor(enemies.px[i] / cs);
      const cz = Math.floor(enemies.pz[i] / cs);
      const key = this._key(cx, cz);
      let bucket = this.cells.get(key);
      if (!bucket) { bucket = this._acquire(); this.cells.set(key, bucket); }
      bucket.push(i);
    }
  }

  // Fill `out` (an array) with enemy indices whose cells overlap the circle
  // centered at (x,z) with the given radius. Broad-phase only — caller does the
  // precise distance test.
  query(x, z, radius, out) {
    out.length = 0;
    const cs = this.cellSize;
    const minX = Math.floor((x - radius) / cs);
    const maxX = Math.floor((x + radius) / cs);
    const minZ = Math.floor((z - radius) / cs);
    const maxZ = Math.floor((z + radius) / cs);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this._key(cx, cz));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) out.push(bucket[k]);
      }
    }
  }

  get activeCellCount() { return this.cells.size; }
}
