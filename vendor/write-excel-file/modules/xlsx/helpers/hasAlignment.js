export default function hasAlignment(_ref) {
  var align = _ref.align,
    alignVertical = _ref.alignVertical,
    textRotation = _ref.textRotation,
    indent = _ref.indent,
    wrap = _ref.wrap;
  return Boolean(align || alignVertical || typeof textRotation === 'number' || indent || wrap);
}
//# sourceMappingURL=hasAlignment.js.map