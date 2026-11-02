export default function hasBorder(_ref) {
  var borderColor = _ref.borderColor,
    borderStyle = _ref.borderStyle,
    leftBorderColor = _ref.leftBorderColor,
    leftBorderStyle = _ref.leftBorderStyle,
    rightBorderColor = _ref.rightBorderColor,
    rightBorderStyle = _ref.rightBorderStyle,
    topBorderColor = _ref.topBorderColor,
    topBorderStyle = _ref.topBorderStyle,
    bottomBorderColor = _ref.bottomBorderColor,
    bottomBorderStyle = _ref.bottomBorderStyle;
  return Boolean(borderColor || borderStyle || leftBorderColor || leftBorderStyle || rightBorderColor || rightBorderStyle || topBorderColor || topBorderStyle || bottomBorderColor || bottomBorderStyle);
}
//# sourceMappingURL=hasBorder.js.map