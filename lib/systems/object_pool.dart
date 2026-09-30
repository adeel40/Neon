/// A minimal generic object pool.
///
/// Poolable components (Enemy, Projectile, XpGem) are created up-front (or
/// lazily grown) and recycled instead of being allocated/GC'd every spawn.
/// This is central to hitting the "no per-frame allocations / 300+ enemies"
/// target: spawning becomes a list pop + reset, and death becomes a push.
///
/// Objects implement [Poolable] so the pool can reset them on reuse.
abstract class Poolable {
  /// Whether this object is currently in play. The pool sets this.
  bool get isActive;
  set isActive(bool value);
}

class ObjectPool<T extends Poolable> {
  final T Function() _factory;
  final List<T> _free = [];

  /// Every object the pool has ever created (active + free). Used so callers
  /// can iterate all live instances and for debug counts.
  final List<T> all = [];

  ObjectPool(this._factory, {int preallocate = 0}) {
    for (var i = 0; i < preallocate; i++) {
      final obj = _factory()..isActive = false;
      _free.add(obj);
      all.add(obj);
    }
  }

  /// Total objects created by this pool.
  int get capacity => all.length;

  /// Objects currently available for reuse.
  int get freeCount => _free.length;

  /// Objects currently in play.
  int get activeCount => all.length - _free.length;

  /// Obtains an object from the pool, growing it if necessary.
  /// The returned object is marked active; the caller must (re)initialize it.
  T obtain() {
    final T obj;
    if (_free.isNotEmpty) {
      obj = _free.removeLast();
    } else {
      obj = _factory();
      all.add(obj);
    }
    obj.isActive = true;
    return obj;
  }

  /// Returns an object to the pool. Safe to call twice (idempotent).
  void release(T obj) {
    if (!obj.isActive) return;
    obj.isActive = false;
    _free.add(obj);
  }
}
