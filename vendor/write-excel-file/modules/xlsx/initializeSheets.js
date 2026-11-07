function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import initializeStyles from './initializeStyles.js';
import initializeSharedStrings from './initializeSharedStrings.js';
import validateSheetName from './validateSheetName.js';
export default function initializeSheets(sheetsData, sheetsOptions, globalOptions) {
  var _initializeSharedStri = initializeSharedStrings(),
    getSharedStrings = _initializeSharedStri.getSharedStrings,
    findOrCreateSharedString = _initializeSharedStri.findOrCreateSharedString;

  // const sheetsDefaultFonts = sheetsOptions.map((sheetOptions) => {
  // 	const { fontFamily, fontSize } = sheetOptions
  //   if (fontFamily || fontSize) {
  // 		return { fontFamily, fontSize }
  // 	}
  // })

  var defaultFont = getDefaultFont(globalOptions);
  var _initializeStyles = initializeStyles(defaultFont),
    getCellStyles = _initializeStyles.getCellStyles,
    findOrCreateCellStyle = _initializeStyles.findOrCreateCellStyle;

  // Get sheet names.
  var sheetNames = sheetsOptions.map(function (sheetOptions) {
    return sheetOptions.sheet;
  });

  // Validate sheet names.
  for (var _iterator = _createForOfIteratorHelperLoose(sheetNames), _step; !(_step = _iterator()).done;) {
    var sheetName = _step.value;
    validateSheetName(sheetName);
  }
  var sheetXmlParameters = [];
  var sheetIndex = 0;
  while (sheetIndex < sheetNames.length) {
    sheetXmlParameters.push({
      sheetData: sheetsData[sheetIndex],
      sheetOptions: sheetsOptions[sheetIndex],
      sheetIndex: sheetIndex,
      sheetId: getSheetId(sheetIndex),
      hasDefaultFont: Boolean(defaultFont),
      // hasDefaultFont: Boolean(sheetsDefaultFonts[sheetIndex]),
      // findOrCreateCellStyle: (style) => findOrCreateCellStyle(style, sheetIndex),
      findOrCreateCellStyle: findOrCreateCellStyle,
      findOrCreateSharedString: findOrCreateSharedString
    });
    sheetIndex++;
  }
  return {
    sheets: sheetNames.map(function (sheetName, _i) {
      // Reassign the `_i` variable to prevent "closure" bug when in `generateSheetXml()` function
      // the `_i` value is always equal to the last sheet's index.
      var sheetIndex = _i;
      return {
        sheetId: getSheetId(sheetIndex),
        sheetName: sheetName,
        sheetXmlParameters: sheetXmlParameters[sheetIndex]
      };
    }),
    getSharedStrings: getSharedStrings,
    getCellStyles: getCellStyles
  };
}
function getSheetId(sheetIndex) {
  return String(sheetIndex + 1);
}
function getDefaultFont(globalOptions) {
  var fontFamily = globalOptions.fontFamily,
    fontSize = globalOptions.fontSize;
  if (fontFamily || typeof fontSize === 'number') {
    return {
      fontFamily: fontFamily,
      fontSize: fontSize
    };
  }
}
//# sourceMappingURL=initializeSheets.js.map