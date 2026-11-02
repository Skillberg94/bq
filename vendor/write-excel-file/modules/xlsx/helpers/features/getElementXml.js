function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import getOpeningTagMarkup from '../../../xml/getOpeningTagMarkup.js';
import getClosingTagMarkup from '../../../xml/getClosingTagMarkup.js';
import getSelfClosingTagMarkup from '../../../xml/getSelfClosingTagMarkup.js';
export default function getElementXml(fileName, tagName, attributes,
// Could be `undefined` or `null`
innerXml,
// Could be `undefined` or `null`
index,
// Could be `undefined`
properties, sheetOptionsOrSheetsOptions, features) {
  for (var _iterator = _createForOfIteratorHelperLoose(features), _step; !(_step = _iterator()).done;) {
    var feature = _step.value;
    var transform = feature.files && feature.files.transform && feature.files.transform[fileName];
    if (transform && transform.transformElementAttributes) {
      attributes = transform.transformElementAttributes(tagName, attributes || NO_ATTRIBUTES, index, sheetOptionsOrSheetsOptions, properties);
    }
  }
  if (innerXml) {
    return getOpeningTagMarkup(tagName, attributes) + innerXml + getClosingTagMarkup(tagName);
  } else {
    return getSelfClosingTagMarkup(tagName, attributes);
  }
}
var NO_ATTRIBUTES = {};
//# sourceMappingURL=getElementXml.js.map