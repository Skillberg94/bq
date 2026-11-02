function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var _excluded = ["data"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import generateWorkbookXml from './files/workbook.xml.js';
import generateWorkbookXmlRels from './files/workbook.xml.rels.js';
import generateRelsXml from './files/rels.js';
import generateContentTypesXml, { getDrawingContentTypeXml } from './files/[Content_Types].xml.js';
import generateDrawingXml, { DRAWING_XML_START, DRAWING_XML_END } from './files/drawing.xml.js';
import generateDrawingXmlRels from './files/drawing.xml.rels.js';
import generateSheetXml from './files/sheet.xml/sheet.xml.js';
import generateDrawingReferenceXml from './files/sheet.xml/drawingReference.js';
import generateSheetXmlRels, { getDrawingRelationshipXml } from './files/sheet.xml.rels.js';
import generateSharedStringsXml from './files/sharedStrings.xml.js';
import generateStylesXml from './files/styles.xml.js';
import getFeatures from './getFeatures.js';
import validateSheetData from './validateSheetData.js';
import initializeSheets from './initializeSheets.js';
import getSheetData from '../getSheetData/getSheetData.js';
import getWrittenFiles from './helpers/features/getWrittenFiles.js';
import isObject from './helpers/isObject.js';
import getSelfClosingTagMarkup from '../xml/getSelfClosingTagMarkup.js';

/**
 * Creates contents (files) an `*.xlsx` file.
 * @param {SheetData|Object[]|Sheet[]} arg1
 * @param {object} arg2 — If `arg1` is `SheetData`, `arg2` is `SheetOptions` and `arg3` is `Options`. If `arg1` is `Sheet[]`, `arg2` is `Options`.
 * @param {object} [arg3] — If `arg1` is `SheetData`, `arg2` is `SheetOptions` and `arg3` is `Options`. If `arg1` is `Sheet[]`, `arg2` is `Options`.
 * @return {Record<string,string|Blob>} A map of files that exist inside an `.xlsx` file.
 */
export default function generateXlsxFileContents(arg1, arg2, arg3) {
  var _getArguments = getArguments(arg1, arg2, arg3),
    sheetsDataAndOptions = _getArguments.sheets,
    options = _getArguments.options;
  var sheetsData = sheetsDataAndOptions.map(function (sheet) {
    return sheet.data;
  });
  var sheetsOptions = sheetsDataAndOptions.map(function (sheet) {
    return sheet.options;
  });
  sheetsOptions = setSheetNames(sheetsOptions);

  // Here's a small hack for `conditionalFormatting` feature support.
  // `.xlsx` format is weird and has many quirks.
  // One of those quirks is each conditional formatting rule has to be assigned a globally-unique ID.
  // That itself wouldn't be an issue if that globally-unique ID could be any string,
  // but `.xlsx` format specification complicates things by demanding it to be
  // a zero-based integer index (0, 1, 2, ...) referencing a specific `<dxf>` element in "styles.xml" file.
  // So a conditional formatting rule ID can't be just "sheet1-rule2", it has to be specifically
  // an index of this rule in the list of all rules for all sheets in a given `.xlsx` file.
  // Because a sheet-specific file tranform function doesn't have access to other sheets' options,
  // here it manually sets the global indexes of all conditional formatting rules,
  // and it has to do so without mutating any input arguments.
  sheetsOptions = setConditionalFormattingRulesGlobalIndexes(sheetsOptions);
  var features = getFeatures(options.features);
  var files = {};
  var readFile = function readFile(path) {
    return files[path];
  };
  // const fileExists = (path) => Boolean(files[path])

  var writeFiles = function writeFiles(filesToWrite) {
    for (var _i = 0, _Object$keys = Object.keys(filesToWrite); _i < _Object$keys.length; _i++) {
      var path = _Object$keys[_i];
      validateFilePath(path);
      validateFileContent(path, filesToWrite[path]);
      files[path] = filesToWrite[path];
    }
  };
  var _initializeSheets = initializeSheets(sheetsData, sheetsOptions, options),
    sheets = _initializeSheets.sheets,
    getSharedStrings = _initializeSheets.getSharedStrings,
    getCellStyles = _initializeSheets.getCellStyles;
  files['[Content_Types].xml'] = generateContentTypesXml({
    sheetIds: sheets.map(function (_) {
      return _.sheetId;
    }),
    features: features,
    sheetsOptions: sheetsOptions
  });
  files['_rels/.rels'] = generateRelsXml({
    features: features,
    sheetsOptions: sheetsOptions
  });
  files['xl/_rels/workbook.xml.rels'] = generateWorkbookXmlRels({
    sheetIds: sheets.map(function (_) {
      return _.sheetId;
    }),
    features: features,
    sheetsOptions: sheetsOptions
  });
  files['xl/workbook.xml'] = generateWorkbookXml({
    sheetIdsAndNames: sheets.map(function (_ref) {
      var sheetId = _ref.sheetId,
        sheetName = _ref.sheetName;
      return {
        sheetId: sheetId,
        sheetName: sheetName
      };
    }),
    features: features,
    sheetsOptions: sheetsOptions
  });
  var sheetIndex = 0;
  for (var _iterator = _createForOfIteratorHelperLoose(sheets), _step; !(_step = _iterator()).done;) {
    var _step$value = _step.value,
      sheetId = _step$value.sheetId,
      sheetXmlParameters = _step$value.sheetXmlParameters;
    var sheetOptions = sheetsOptions[sheetIndex];
    files["xl/worksheets/sheet".concat(sheetId, ".xml")] = generateSheetXml(sheetXmlParameters, features);
    files["xl/worksheets/_rels/sheet".concat(sheetId, ".xml.rels")] = generateSheetXmlRels({
      sheetIndex: sheetIndex,
      sheetId: sheetId,
      sheetOptions: sheetOptions,
      features: features
    });
    files["xl/drawings/drawing".concat(sheetId, ".xml")] = generateDrawingXml({
      sheetIndex: sheetIndex,
      sheetId: sheetId,
      sheetOptions: sheetOptions,
      features: features
    });
    files["xl/drawings/_rels/drawing".concat(sheetId, ".xml.rels")] = generateDrawingXmlRels({
      sheetIndex: sheetIndex,
      sheetId: sheetId,
      sheetOptions: sheetOptions,
      features: features
    });
    sheetIndex++;
  }
  writeFiles(getWrittenFiles(features, sheetsOptions, {
    read: readFile
  }));

  // After sheets' XML was generated, it can generate "styles.xml" and "sharedStrings.xml".
  files['xl/styles.xml'] = generateStylesXml(getCellStyles(), sheetsOptions, features);
  files['xl/sharedStrings.xml'] = generateSharedStringsXml(getSharedStrings());

  // (minor minimization) Remove unused `drawing${id}.xml` files.
  removeUnusedDrawings(files, sheets);
  return files;
}

// (minor minimization)
//
// For each `xl/drawings/drawing${id}.xml`, see if it has no actual content,
// i.e. the `<xdr:wsDr>` element has no child elements.
// If that's the case, remove `xl/drawings/drawing${sheetId}.xml` and `xl/drawings/drawing${sheetId}.xml.rels`,
// and also remove `<drawing r:id="..."/>` element from `xl/worksheets/sheet${sheetId}.xml`
// and the corresponding `<Relationship Id="..." .../>` element from `xl/worksheets/_rels/sheet${sheetId}.xml.rels`
// and the corresponding `<Override/> element from `[Content_Types].xml`.
//
function removeUnusedDrawings(files, sheets) {
  for (var _iterator2 = _createForOfIteratorHelperLoose(sheets), _step2; !(_step2 = _iterator2()).done;) {
    var sheetId = _step2.value.sheetId;
    if (files["xl/drawings/drawing".concat(sheetId, ".xml")] === DRAWING_XML_START + DRAWING_XML_END) {
      delete files["xl/drawings/drawing".concat(sheetId, ".xml")];
      delete files["xl/drawings/_rels/drawing".concat(sheetId, ".xml.rels")];
      if (!removeSubstring(files, "xl/worksheets/sheet".concat(sheetId, ".xml"), generateDrawingReferenceXml(getSelfClosingTagMarkup))) {
        throw new Error(COULD_NOT_REMOVE_UNUSED_DRAWINGS);
      }
      removeSubstring(files, "xl/worksheets/_rels/sheet".concat(sheetId, ".xml.rels"), getDrawingRelationshipXml(sheetId));
      removeSubstring(files, '[Content_Types].xml', getDrawingContentTypeXml(sheetId));
    }
  }
}
var COULD_NOT_REMOVE_UNUSED_DRAWINGS = 'Couldn\'t remove unused drawings';
function removeSubstring(files, key, substring) {
  if (!files[key]) {
    throw new Error("File not found: ".concat(key));
  }
  if (files[key].indexOf(substring) < 0) {
    throw new Error("Substring \"".concat(substring, "\" not found in \"").concat(key, "\""));
  }
  var stringBeforeRemoval = files[key];
  var stringAfterRemoval = stringBeforeRemoval.replace(substring, '');
  files[key] = stringAfterRemoval;
  return stringBeforeRemoval !== stringAfterRemoval;
}
function validateFilePath(path) {
  if (path[0] === '/') {
    throw new Error("File path must not start with a slash (/)");
  }
}
function validateFileContent(path, content) {
  if (!content) {
    throw new Error("File `content` not specified: ".concat(path));
  }
}
function getArguments(arg1, arg2, arg3) {
  if (Array.isArray(arg1)) {
    if (arg1.length === 0 || Array.isArray(arg1[0])) {
      // `arg1` is `SheetData`
      validateSheetData(arg1);
      // Validate that a developer is not using the legacy way of writing multiple sheets.
      if (Array.isArray(arg1[0]) && arg1.length > 0 && Array.isArray(arg1[0][0])) {
        throw new Error('In order to write multiple sheets, pass an array of sheet objects');
      }
      return {
        sheets: [{
          data: arg1,
          options: arg2 || {}
        }],
        options: arg3 || {}
      };
    } else if (isObject(arg1[0])) {
      // `arg1` is either `Sheet[]` or `Object[]`
      // Validate that a developer is not using a legacy parameter `schema`.
      if (isObject(arg2) && Array.isArray(arg2.schema)) {
        throw new Error('`schema` parameter was removed, use `columns` parameter instead');
      }
      if (isObject(arg2) && Array.isArray(arg2.columns)) {
        // `arg1` is `Object[]`.
        // Don't remove `columns` property from `arg2` because it's still required there
        // to apply the column `width`.
        return getArguments(getSheetData(arg1, arg2.columns), arg2, arg3);
      }
      // `arg1` is `Sheet[]`
      return {
        sheets: arg1.map(function (_ref2) {
          var data = _ref2.data,
            options = _objectWithoutProperties(_ref2, _excluded);
          if (!data) {
            throw new Error('`data` property is required for each sheet');
          }
          validateSheetData(data);
          return {
            data: data,
            options: options || {}
          };
        }),
        options: arg2 || {}
      };
    } else {
      throw new Error('Invalid first argument: must be either sheet data — an array of arrays — or an array of sheet objects');
    }
  } else {
    throw new Error('Invalid first argument: must be an array');
  }
}

// Sets a sheet name for each sheet.
function setSheetNames(sheetsOptions) {
  return sheetsOptions.map(function (sheetOptions, sheetIndex) {
    return _objectSpread(_objectSpread({}, sheetOptions), {}, {
      sheet: sheetOptions.sheet || "Sheet".concat(sheetIndex + 1)
    });
  });
}

// Sets a `_globalIndex: number` property on each conditional formatting rule.
function setConditionalFormattingRulesGlobalIndexes(sheetsOptions) {
  var globalIndex = 0;
  return sheetsOptions.map(function (sheetOptions) {
    return _objectSpread(_objectSpread({}, sheetOptions), {}, {
      conditionalFormatting: sheetOptions.conditionalFormatting && sheetOptions.conditionalFormatting.map(function (conditionalFormattingRule) {
        return _objectSpread(_objectSpread({}, conditionalFormattingRule), {}, {
          // `++` operator returns the value before the increment.
          _globalIndex: globalIndex++
        });
      })
    });
  });
}
//# sourceMappingURL=generateXlsxFileContents.js.map