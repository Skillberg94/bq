export default function hasFont(_ref) {
  var fontFamily = _ref.fontFamily,
    fontSize = _ref.fontSize,
    fontWeight = _ref.fontWeight,
    fontStyle = _ref.fontStyle,
    textDecoration = _ref.textDecoration,
    textColor = _ref.textColor;
  return Boolean(fontFamily || typeof fontSize === 'number' || fontWeight || fontStyle || textDecoration && Object.keys(textDecoration).length > 0 || textColor);
}
//# sourceMappingURL=hasFont.js.map