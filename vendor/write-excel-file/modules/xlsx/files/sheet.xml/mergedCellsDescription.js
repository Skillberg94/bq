function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
import getCellAddress from '../../helpers/getCellAddress.js';

// Supports "merging cells" across columns and rows.
// https://rdrr.io/cran/openxlsx/man/mergeCells.html
//
// Returned XML example for merged cells range "A2:C3":
// `<sheetData>...</sheetData><mergeCells count="1"><mergeCell ref="A2:C3"/></mergeCells>`
//
// Data example:
//
// rows:
// [
//   [...],
//   [
//     { type: String, value: 'abc', columnSpan: 3, rowSpan: 2 },
//     { ... },
//     { ... }
//   ],
//   [...]
// ]

export default function generateMergedCellsDescription(tag, mergedCells) {
  if (mergedCells.length === 0) {
    return '';
  }
  var mergeCellsXml = mergedCells.map(function (_ref, index) {
    var _ref2 = _slicedToArray(_ref, 2),
      from = _ref2[0],
      to = _ref2[1];
    var ref = getCellAddress(from[0], from[1]) + ':' + getCellAddress(to[0], to[1]);
    return tag('mergeCell', {
      ref: ref
    }, null, index);
  }).join('');
  return tag('mergeCells', {
    count: mergedCells.length
  }, mergeCellsXml);
}
//# sourceMappingURL=mergedCellsDescription.js.map