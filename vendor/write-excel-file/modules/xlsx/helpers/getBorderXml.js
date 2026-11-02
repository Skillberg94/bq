import sanitizeAttributeValue from '../../xml/sanitizeAttributeValue.js';
import getXlsxColorForHexColor from './getXlsxColorForHexColor.js';
export default function getBorderXml(_ref) {
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
  var left = {
    style: leftBorderStyle || borderStyle,
    color: leftBorderColor || borderColor
  };
  var right = {
    style: rightBorderStyle || borderStyle,
    color: rightBorderColor || borderColor
  };
  var top = {
    style: topBorderStyle || borderStyle,
    color: topBorderColor || borderColor
  };
  var bottom = {
    style: bottomBorderStyle || borderStyle,
    color: bottomBorderColor || borderColor
  };
  var xml = '<border>';
  xml += getSideBorderXml('left', left);
  xml += getSideBorderXml('right', right);
  xml += getSideBorderXml('top', top);
  xml += getSideBorderXml('bottom', bottom);
  xml += '<diagonal/>';
  xml += '</border>';
  return xml;
}
function getSideBorderXml(side, _ref2) {
  var style = _ref2.style,
    color = _ref2.color;
  if (color && !style) {
    style = 'thin';
  }
  var hasChildren = Boolean(color);
  return "<".concat(side) + (style ? " style=\"".concat(sanitizeAttributeValue(style), "\"") : '') + (hasChildren ? '>' : '/>') + (color ? "<color rgb=\"".concat(sanitizeAttributeValue(getXlsxColorForHexColor(color)), "\"/>") : '') + (hasChildren ? "</".concat(side, ">") : '');
}
//# sourceMappingURL=getBorderXml.js.map