import 'dart:math' as math;

import 'package:flame/components.dart' show Vector2;

import '../components/enemy.dart';

/// Uniform-grid spatial hash for broad-phase collision queries.
///
/// Instead of checking every projectile against every enemy (O(n*m)), we
/// bucket enemies into fixed-size cells keyed by (cellX, cellY). A query for
/// a point/radius only inspects the handful of cells that region overlaps.
///
/// Design notes for the perf target:
///  - Cells are stored in a Map<int, List<Enemy>> where the key packs the
///    signed cell coords into one int. This avoids allocating point objects.
///  - [rebuild] clears and repopulates each frame. Lists are reused across
///    frames via a small free-list so we don't allocate 300+ Lists per frame.
///  - [queryInto] fills a caller-provided list to avoid per-call allocation.
class SpatialHash {
  final double cellSize;

  // Active buckets this frame: packed cell key -> enemies in that cell.
  final Map<int, List<Enemy>> _cells = {};

  // Reusable empty lists so rebuild() doesn't allocate fresh Lists each frame.
  final List<List<Enemy>> _listPool = [];

  SpatialHash({this.cellSize = 48.0});

  /// Packs two signed 32-bit-ish cell coordinates into a single int key.
  /// Dart ints are 64-bit on native, so this is collision-free for our range.
  int _key(int cx, int cy) => (cx & 0xFFFFFFFF) | ((cy & 0xFFFFFFFF) << 32);

  int _cellCoord(double v) => (v / cellSize).floor();

  List<Enemy> _acquireList() {
    if (_listPool.isNotEmpty) {
      final l = _listPool.removeLast();
      l.clear();
      return l;
    }
    return <Enemy>[];
  }

  /// Rebuilds the grid from the given live enemies. Call once per update tick
  /// before running collision queries.
  void rebuild(List<Enemy> enemies) {
    // Return existing lists to the pool for reuse.
    _cells.forEach((_, list) => _listPool.add(list));
    _cells.clear();

    for (final e in enemies) {
      if (!e.isActive) continue;
      final cx = _cellCoord(e.position.x);
      final cy = _cellCoord(e.position.y);
      final key = _key(cx, cy);
      final bucket = _cells[key] ??= _acquireList();
      bucket.add(e);
    }
  }

  /// Fills [out] with enemies whose cells overlap a circle of [radius] around
  /// [point]. [out] is cleared first. Caller must still do a precise distance
  /// check (this is broad-phase only).
  void queryInto(Vector2 point, double radius, List<Enemy> out) {
    out.clear();
    final minCx = _cellCoord(point.x - radius);
    final maxCx = _cellCoord(point.x + radius);
    final minCy = _cellCoord(point.y - radius);
    final maxCy = _cellCoord(point.y + radius);

    for (var cx = minCx; cx <= maxCx; cx++) {
      for (var cy = minCy; cy <= maxCy; cy++) {
        final bucket = _cells[_key(cx, cy)];
        if (bucket == null) continue;
        for (var i = 0; i < bucket.length; i++) {
          out.add(bucket[i]);
        }
      }
    }
  }

  /// Number of non-empty cells this frame (for the debug overlay).
  int get activeCellCount => _cells.length;

  /// Squared distance helper — avoids sqrt in the hot path.
  static double distanceSq(Vector2 a, Vector2 b) {
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static double distance(Vector2 a, Vector2 b) => math.sqrt(distanceSq(a, b));
}
