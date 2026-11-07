import hasAlignment from '../../../helpers/hasAlignment.js';
import hasBorder from '../../../helpers/hasBorder.js';
import hasFill from '../../../helpers/hasFill.js';
import hasFont from '../../../helpers/hasFont.js';
export default function getCellStyleProperties(cell, features) {
  var align = cell.align,
    alignVertical = cell.alignVertical,
    textRotation = cell.textRotation,
    indent = cell.indent,
    wrap = cell.wrap,
    fontFamily = cell.fontFamily,
    fontSize = cell.fontSize,
    fontWeight = cell.fontWeight,
    fontStyle = cell.fontStyle,
    textDecoration = cell.textDecoration,
    textColor = cell.textColor,
    backgroundColor = cell.backgroundColor,
    fillPatternStyle = cell.fillPatternStyle,
    fillPatternColor = cell.fillPatternColor,
    borderColor = cell.borderColor,
    borderStyle = cell.borderStyle,
    leftBorderColor = cell.leftBorderColor,
    leftBorderStyle = cell.leftBorderStyle,
    rightBorderColor = cell.rightBorderColor,
    rightBorderStyle = cell.rightBorderStyle,
    topBorderColor = cell.topBorderColor,
    topBorderStyle = cell.topBorderStyle,
    bottomBorderColor = cell.bottomBorderColor,
    bottomBorderStyle = cell.bottomBorderStyle;
  if (hasAlignment({
    align: align,
    alignVertical: alignVertical,
    textRotation: textRotation,
    indent: indent,
    wrap: wrap
  }) || hasFont({
    fontFamily: fontFamily,
    fontSize: fontSize,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    textDecoration: textDecoration,
    textColor: textColor
  }) || hasFill({
    backgroundColor: backgroundColor,
    fillPatternStyle: fillPatternStyle,
    fillPatternColor: fillPatternColor
  }) || hasBorder({
    borderColor: borderColor,
    borderStyle: borderStyle,
    leftBorderColor: leftBorderColor,
    leftBorderStyle: leftBorderStyle,
    rightBorderColor: rightBorderColor,
    rightBorderStyle: rightBorderStyle,
    topBorderColor: topBorderColor,
    topBorderStyle: topBorderStyle,
    bottomBorderColor: bottomBorderColor,
    bottomBorderStyle: bottomBorderStyle
  })) {
    return omitUndefinedProperties({
      // alignment
      align: align,
      alignVertical: alignVertical,
      textRotation: textRotation,
      indent: indent,
      wrap: wrap,
      // font
      fontFamily: fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      textDecoration: textDecoration,
      textColor: textColor,
      // fill
      backgroundColor: backgroundColor,
      fillPatternStyle: fillPatternStyle,
      fillPatternColor: fillPatternColor,
      // border
      borderColor: borderColor,
      borderStyle: borderStyle,
      leftBorderColor: leftBorderColor,
      leftBorderStyle: leftBorderStyle,
      rightBorderColor: rightBorderColor,
      rightBorderStyle: rightBorderStyle,
      topBorderColor: topBorderColor,
      topBorderStyle: topBorderStyle,
      bottomBorderColor: bottomBorderColor,
      bottomBorderStyle: bottomBorderStyle
    });
  }
}
function omitUndefinedProperties(object) {
  var filteredObject = {};
  for (var key in object) {
    if (object[key] !== undefined) {
      filteredObject[key] = object[key];
    }
  }
  return filteredObject;
}
//# sourceMappingURL=getCellStyleProperties.js.map