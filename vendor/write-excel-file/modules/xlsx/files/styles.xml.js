function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import sanitizeAttributeValue from '../../xml/sanitizeAttributeValue.js';
import getFillXml from '../helpers/getFillXml.js';
import getBorderXml from '../helpers/getBorderXml.js';
import getFontXml from '../helpers/getFontXml.js';
import hasAlignment from '../helpers/hasAlignment.js';
import getAlignmentXml from '../helpers/getAlignmentXml.js';
import getAdditionalContent from '../helpers/features/getAdditionalContent.js';
import transformContent from '../helpers/features/transformContent.js';
import { FORMAT_ID_STARTS_FROM } from '../initializeStyles.js';
export default function generateStylesXml(cellStyles, sheetsOptions, features) {
  var formats = cellStyles.formats,
    styles = cellStyles.styles,
    fonts = cellStyles.fonts,
    fills = cellStyles.fills,
    borders = cellStyles.borders;
  var xml = '<?xml version="1.0" ?>';
  xml += '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

  // Turns out, as weird as it sounds, the order of XML elements matters to MS Office Excel.
  // https://social.msdn.microsoft.com/Forums/office/en-US/cc47ab65-dab7-4e32-b676-b641aa1e1411/how-to-validate-the-xlsx-that-i-generate?forum=oxmlsdk
  // For example, previously this library was inserting `<cellXfs/>` before `<fonts/>`
  // and that caused MS Office 2007 Excel to throw an error about the file being corrupt:
  // "Excel found unreadable content in '*.xlsx'. Do you want to recover the contents of this workbook?"
  // "Excel was able to open the file by repairing or removing the unreadable content."
  // "Removed Part: /xl/styles.xml part with XML error.  (Styles) Load error. Line 1, column ..."
  // "Repaired Records: Cell information from /xl/worksheets/sheet1.xml part"

  if (formats.length > 0) {
    xml += "<numFmts count=\"".concat(formats.length, "\">");
    for (var i = 0; i < formats.length; i++) {
      xml += "<numFmt numFmtId=\"".concat(FORMAT_ID_STARTS_FROM + i, "\" formatCode=\"").concat(sanitizeAttributeValue(formats[i]), "\"/>");
    }
    xml += "</numFmts>";
  }
  xml += "<fonts count=\"".concat(fonts.length, "\">");
  for (var _iterator = _createForOfIteratorHelperLoose(fonts), _step; !(_step = _iterator()).done;) {
    var font = _step.value;
    xml += getFontXml(font);
  }
  xml += '</fonts>';

  // MS Office 2007 Excel seems to require a `<fills/>` element to always exist.
  // without it, MS Office 2007 Excel thinks that the file is broken.
  xml += "<fills count=\"".concat(fills.length, "\">");
  for (var _iterator2 = _createForOfIteratorHelperLoose(fills), _step2; !(_step2 = _iterator2()).done;) {
    var fill = _step2.value;
    if (fill.gray125) {
      // "gray125" fill.
      // For some weird reason, MS Office 2007 Excel seems to require "gray125" fill to be present in styles.
      // Otherwise, if it's absent, it would replace the first custom `<fill/>` with a "gray125" fill.
      xml += '<fill>';
      xml += '<patternFill patternType="gray125"/>';
      xml += '</fill>';
    } else {
      xml += getFillXml(fill);
    }
  }
  xml += '</fills>';

  // MS Office 2007 Excel seems to require a `<borders/>` element to exist:
  // without it, MS Office 2007 Excel thinks that the file is broken.
  xml += "<borders count=\"".concat(borders.length, "\">");
  for (var _iterator3 = _createForOfIteratorHelperLoose(borders), _step3; !(_step3 = _iterator3()).done;) {
    var border = _step3.value;
    xml += getBorderXml(border);
  }
  xml += '</borders>';

  // What are `<cellXfs/>` and `<cellStyleXfs/>`:
  // http://officeopenxml.com/SSstyles.php
  //
  // `<cellStyleXfs/>` are referenced from `<cellXfs/>` as `<xf xfId="..."/>`.
  // `<cellStyleXfs/>` defines abstract "cell styles" that can be "extended"
  // by "cell styles" defined by `<cellXfs/>` that can be applied to individual cells:
  // 1. `<cellStyleXfs><xf .../></cellStyleXfs>`
  // 2. `<cellXfs><xf xfId={cellStyleXfs.xf.index}/></cellXfs>`
  // 3. `<c s={cellXfs.xf.index}/>`
  // Seems like "cell styles" defined by `<cellXfs/>` have to reference
  // some abstract "cell styles" defined by `<cellStyleXfs/>` by the spec.
  // Otherwise, there would be no need to use `<cellStyleXfs/>` at all.
  // The naming is ambiguous and weird. The whole scheme is needlessly redundant.

  // xml += '<cellStyleXfs count="2">'
  // xml += '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
  // // `applyFont="1"` means apply a custom font in this "abstract" "cell style"
  // // rather than using a default font.
  // // Seems like by default `applyFont` is `"0"` meaning that,
  // // unless `"1"` is specified, it would ignore the `fontId` attribute.
  // xml += '<xf numFmtId="0" fontId="1" applyFont="1" fillId="0" borderId="0"/>'
  // xml += '</cellStyleXfs>'

  xml += "<cellXfs count=\"".concat(styles.length, "\">");
  for (var _iterator4 = _createForOfIteratorHelperLoose(styles), _step4; !(_step4 = _iterator4()).done;) {
    var cellStyle = _step4.value;
    var fontId = cellStyle.fontId,
      fillId = cellStyle.fillId,
      borderId = cellStyle.borderId,
      alignment = cellStyle.alignment,
      formatId = cellStyle.formatId;
    // `applyNumberFormat="1"` means "apply the `numFmtId` attribute".
    // Seems like by default `applyNumberFormat` is `"0"` meaning that,
    // unless `"1"` is specified, it would ignore the `numFmtId` attribute.
    xml += '<xf ' + [formatId === undefined ? undefined : "numFmtId=\"".concat(formatId, "\" applyNumberFormat=\"1\""), fontId === undefined ? undefined : "fontId=\"".concat(fontId, "\" applyFont=\"1\""), fillId === undefined ? undefined : "fillId=\"".concat(fillId, "\" applyFill=\"1\""), borderId === undefined ? undefined : "borderId=\"".concat(borderId, "\" applyBorder=\"1\""), hasAlignment(alignment) ? 'applyAlignment="1"' : undefined
    // 'xfId="0"'
    ].filter(function (_) {
      return _;
    }).join(' ') + '>' + (
    // Possible horizontal alignment values:
    //  left, center, right, fill, justify, center_across, distributed.
    // Possible vertical alignment values:
    //  top, vcenter, bottom, vjustify, vdistributed.
    // https://xlsxwriter.readthedocs.io/format.html#set_align
    hasAlignment(alignment) ? getAlignmentXml(alignment) : '') + '</xf>';
  }
  xml += "</cellXfs>";

  // Apply any plugins that insert additional content to this XML.
  xml += getAdditionalContent('xl/styles.xml', features, sheetsOptions);
  xml += '</styleSheet>';

  // Apply any plugins that transform this XML.
  xml = transformContent(xml, 'xl/styles.xml', features, sheetsOptions);
  return xml;
}
//# sourceMappingURL=styles.xml.js.map