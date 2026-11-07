function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import generateCell from './cell.js';
import getCellStyleProperties from './helpers/getCellStyleProperties.js';
import isCellObject from '../../helpers/isCellObject.js';
export default function generateRow(tag, row, index, parameters) {
  // Calculate row height.
  var rowHeight;
  for (var _iterator = _createForOfIteratorHelperLoose(row), _step; !(_step = _iterator()).done;) {
    var cell = _step.value;
    if (isCellObject(cell)) {
      if (cell.height) {
        if (rowHeight === undefined || rowHeight < cell.height) {
          rowHeight = cell.height;
        }
      }
    }
  }

  // Generate `<r/>` element inner XML.
  var rowIndex = index;
  var rowCellsXml = row.map(function (cell, index) {
    return getCellXml(tag, cell, index, rowIndex, parameters);
  }).join('');
  var rowAttributes = {
    r: index + 1
  };
  if (rowHeight) {
    rowAttributes.ht = rowHeight;
    rowAttributes.customHeight = 1;
  }
  return tag('row', rowAttributes, rowCellsXml, index);
}
function getCellXml(tag, cell, index, rowIndex, _ref) {
  var findOrCreateCellStyle = _ref.findOrCreateCellStyle,
    findOrCreateSharedString = _ref.findOrCreateSharedString,
    hasDefaultFont = _ref.hasDefaultFont,
    dateFormat = _ref.dateFormat,
    features = _ref.features;
  if (cell === undefined || cell === null) {
    return '';
  }
  var cellObject = isCellObject(cell) ? cell : {
    value: cell
  };
  var cellStyleProperties = getCellStyleProperties(cellObject, features);
  var type = cellObject.type,
    value = cellObject.value,
    format = cellObject.format;
  if (isEmpty(value)) {
    value = null;
  } else {
    // Get cell value type.
    if (type === undefined) {
      type = detectValueType(value);
      if (type === undefined) {
        // The default cell value type is `String`.
        type = String;
        value = String(value);
      }
    }
  }

  // Validate `format` property.
  if (format) {
    if (type !== Date && type !== Number && type !== String && type !== 'Formula') {
      throw new Error("`format` \"".concat(format, "\" was specified on a cell of type `").concat(type, "`. `format` could only be specified on a cell of type `Date`, `Number`, `String` or `\"Formula\"`."));
    }
    if (type === String && format !== '@') {
      throw new Error("`format` \"".concat(format, "\" was specified on a cell of type `String`. The only supported `format` for a cell of type `String` is \"@\"."));
    }
  } else {
    if (type === Date) {
      format = dateFormat;
    }
  }
  var hasFormat = Boolean(format);
  var hasCellStyle = Boolean(cellStyleProperties);
  var cellStyleId;
  if (hasDefaultFont || hasFormat || hasCellStyle) {
    cellStyleId = findOrCreateCellStyle(_objectSpread({
      format: format
    }, cellStyleProperties));
  }
  return generateCell(tag, {
    value: value,
    type: type,
    cellStyleId: cellStyleId,
    findOrCreateSharedString: findOrCreateSharedString
  }, index, rowIndex);
}
function isEmpty(value) {
  return value === undefined || value === null || value === '';
}
function detectValueType(value) {
  switch (_typeof(value)) {
    case 'string':
      return String;
    case 'number':
      return Number;
    case 'boolean':
      return Boolean;
    default:
      if (value instanceof Date) {
        return Date;
      }
  }
}
//# sourceMappingURL=row.js.map