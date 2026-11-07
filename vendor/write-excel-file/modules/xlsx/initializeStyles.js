function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import hasFont from './helpers/hasFont.js';
import hasFill from './helpers/hasFill.js';
import hasBorder from './helpers/hasBorder.js';

// There seem to be about 100 "built-in" formats in Excel.
// https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2010/ee857658(v=office.14)?redirectedfrom=MSDN
export var FORMAT_ID_STARTS_FROM = 100;
export default function initializeStyles(defaultFont) {
  var formats = [];
  var formatIdByFormat = {};
  var styles = [];
  var stylesIndex = {};
  var fonts = [];
  var fontIdByFontKey = {};
  var fills = [];
  var fillIdByFillKey = {};
  var borders = [];
  var borderIdByBorderKey = {};

  // Add default font.
  var defaultFontId = fonts.length;
  fontIdByFontKey[getKey(defaultFont)] = defaultFontId;
  fonts.push(defaultFont || {});

  // // If any of the sheets have a default font that is different from the generic one,
  // // add those fonts to the collection.
  // const sheetsDefaultFontIds = sheetsDefaultFonts.map((font) => {
  //   if (font) {
  //     const fontKey = getKey(font)
  //     if (fontIdByFontKey[fontKey] !== undefined) {
  //       return fontIdByFontKey[fontKey]
  //     }
  //     const fontId = fonts.length
  //     fontIdByFontKey[fontKey] = fontId
  //     fonts.push(font)
  //     return fontId
  //   } else {
  //     return defaultFontId
  //   }
  // })

  // Default fill (no color).
  var defaultFill = {};
  fillIdByFillKey[getKey(defaultFill)] = fills.length;
  fills.push(defaultFill);

  // Default border.
  var defaultBorder = {};
  borderIdByBorderKey[getKey(defaultBorder)] = borders.length;
  borders.push(defaultBorder);

  // Always add a mandatory "gray125" fill.
  // For some weird reason, MS Office 2007 Excel seems to require this type of `<fill>`
  // to always be present in an `*.xslx` document.
  // Otherwise, if this `<fill>` is absent in the document, it would forcefully overwrite
  // the first custom `backgroundColor` with a "gray125" fill.
  var gray125Fill = {
    gray125: true
  };
  fills.push(gray125Fill);

  // Returns a style ID number.
  // Adds a new style if it doesn't exist yet.
  // If it already exists, just reuses the existing one.
  function findOrCreateCellStyle(cellStyle) {
    var format = cellStyle.format,
      align = cellStyle.align,
      alignVertical = cellStyle.alignVertical,
      textRotation = cellStyle.textRotation,
      indent = cellStyle.indent,
      wrap = cellStyle.wrap,
      fontFamily = cellStyle.fontFamily,
      fontSize = cellStyle.fontSize,
      fontWeight = cellStyle.fontWeight,
      fontStyle = cellStyle.fontStyle,
      textDecoration = cellStyle.textDecoration,
      textColor = cellStyle.textColor,
      backgroundColor = cellStyle.backgroundColor,
      fillPatternStyle = cellStyle.fillPatternStyle,
      fillPatternColor = cellStyle.fillPatternColor,
      borderColor = cellStyle.borderColor,
      borderStyle = cellStyle.borderStyle,
      leftBorderColor = cellStyle.leftBorderColor,
      leftBorderStyle = cellStyle.leftBorderStyle,
      rightBorderColor = cellStyle.rightBorderColor,
      rightBorderStyle = cellStyle.rightBorderStyle,
      topBorderColor = cellStyle.topBorderColor,
      topBorderStyle = cellStyle.topBorderStyle,
      bottomBorderColor = cellStyle.bottomBorderColor,
      bottomBorderStyle = cellStyle.bottomBorderStyle;

    // const defaultFont = sheetsDefaultFonts[sheetIndex]
    // const defaultFontId = sheetsDefaultFontIds[sheetIndex]

    var font = {
      fontFamily: fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      textDecoration: textDecoration,
      textColor: textColor
    };
    var fill = {
      backgroundColor: backgroundColor,
      fillPatternStyle: fillPatternStyle,
      fillPatternColor: fillPatternColor
    };
    var border = {
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
    };
    var alignment = {
      align: align,
      alignVertical: alignVertical,
      textRotation: textRotation,
      indent: indent,
      wrap: wrap
    };
    var formatKey = getKey(format);
    var fontKey = getKey(font);
    var fillKey = getKey(fill);
    var borderKey = getKey(border);
    // const alignmentKey = getKey(alignment)

    var styleKey = getKey(cellStyle);

    // Returns style ID.
    var addStyle = function addStyle() {
      // Get format ID.
      var formatId;
      if (format) {
        formatId = formatIdByFormat[formatKey];
        if (formatId === undefined) {
          formatId = FORMAT_ID_STARTS_FROM + formats.length;
          formatIdByFormat[formatKey] = formatId;
          formats.push(format);
        }
      }

      // Get font ID.
      var fontId;
      if (hasFont(font)) {
        fontId = fontIdByFontKey[fontKey];
        if (fontId === undefined) {
          fontId = fonts.length;
          fontIdByFontKey[fontKey] = fontId;
          fonts.push(_objectSpread(_objectSpread({}, font), {}, {
            fontSize: font.fontSize || defaultFont && defaultFont.fontSize,
            fontFamily: font.fontFamily || defaultFont && defaultFont.fontFamily
          }));
        }
      } else if (defaultFont) {
        fontId = defaultFontId;
      }

      // Get fill ID.
      var fillId;
      if (hasFill(fill)) {
        fillId = fillIdByFillKey[fillKey];
        if (fillId === undefined) {
          fillId = fills.length;
          fillIdByFillKey[fillKey] = fillId;
          fills.push({
            backgroundColor: backgroundColor,
            fillPatternStyle: fillPatternStyle,
            fillPatternColor: fillPatternColor
          });
        }
      }

      // Get border ID.
      var borderId;
      if (hasBorder(border)) {
        borderId = borderIdByBorderKey[borderKey];
        if (borderId === undefined) {
          borderId = borders.length;
          borderIdByBorderKey[borderKey] = borderId;
          borders.push(border);
        }
      }
      var styleId = styles.length;
      stylesIndex[styleKey] = styleId;

      // Add a style.
      styles.push({
        formatId: formatId,
        fontId: fontId,
        fillId: fillId,
        borderId: borderId,
        alignment: alignment
      });
      return styleId;
    };

    // Look for an existing style.
    if (stylesIndex[styleKey] !== undefined) {
      return stylesIndex[styleKey];
    }

    // Create new style if doesn't exist.
    return addStyle();
  }

  // Add default style.
  // It will be used for any cell that doesn't specify any custom style properties.
  findOrCreateCellStyle({});
  return {
    getCellStyles: function getCellStyles() {
      return {
        formats: formats,
        styles: styles,
        fonts: fonts,
        fills: fills,
        borders: borders
      };
    },
    findOrCreateCellStyle: findOrCreateCellStyle
  };
}
function getKey(object) {
  return JSON.stringify(object);
}
//# sourceMappingURL=initializeStyles.js.map