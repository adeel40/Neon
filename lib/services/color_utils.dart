import 'dart:ui' show Color;

/// Parses a hex color string like "#RRGGBB" or "#AARRGGBB" into a [Color].
///
/// If no alpha is supplied, full opacity (0xFF) is assumed. This keeps the
/// JSON data files terse ("#00E5FF") while still allowing alpha when needed.
Color colorFromHex(String hex) {
  var value = hex.trim();
  if (value.startsWith('#')) {
    value = value.substring(1);
  }
  if (value.length == 6) {
    value = 'FF$value'; // add opaque alpha
  }
  final intVal = int.parse(value, radix: 16);
  return Color(intVal);
}
