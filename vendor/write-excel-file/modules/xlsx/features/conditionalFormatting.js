function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import sanitizeTextContent from '../../xml/sanitizeTextContent.js';
import insertElementMarkupAccordingToOrderOfSiblings from '../../xml/insertElementMarkupAccordingToOrderOfSiblings.js';
import hasFill from '../helpers/hasFill.js';
import getFillXml from '../helpers/getFillXml.js';
import hasBorder from '../helpers/hasBorder.js';
import getBorderXml from '../helpers/getBorderXml.js';
import hasFont from '../helpers/hasFont.js';
import getFontXml from '../helpers/getFontXml.js';
import getCellAddress from '../helpers/getCellAddress.js';
import getOrderOfSiblings from '../helpers/getOrderOfSiblings.js';
export default {
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        // For some weird reason, Excel 2007 demands `<conditionalFormatting/>` element to go before `<drawing/>` element.
        // Because `<drawing/>` element is added before any of the `insert()`s of any features,
        // this feature has to use a `transform()` function instead of an `insert()` function.
        transform: function transform(xml, sheetOptions, _ref) {
          var sheetIndex = _ref.sheetIndex,
            sheetId = _ref.sheetId;
          var conditionalFormatting = sheetOptions.conditionalFormatting;
          if (conditionalFormatting) {
            var conditionalFormattingRulesXml = getConditionalFormattingRulesXml(conditionalFormatting);
            return insertElementMarkupAccordingToOrderOfSiblings(xml, conditionalFormattingRulesXml, getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet'), 'worksheet');
          }
          return xml;
        }
      },
      'xl/styles.xml': {
        insert: function insert(sheetsOptions) {
          var sheetsConditionalFormatting = sheetsOptions.map(function (sheetOptions) {
            return sheetOptions.conditionalFormatting;
          });
          if (sheetsConditionalFormatting.some(Boolean)) {
            return getConditionalFormattingStylesXml(sheetsConditionalFormatting);
          }
        }
      }
    }
  }
};
function getConditionalFormattingRulesXml(conditionalFormattingRules) {
  var xml = '';
  var i = 0;
  for (var _iterator = _createForOfIteratorHelperLoose(conditionalFormattingRules), _step; !(_step = _iterator()).done;) {
    var conditionalFormattingRule = _step.value;
    var _conditionalFormattin = conditionalFormattingRule.cellRange,
      from = _conditionalFormattin.from,
      to = _conditionalFormattin.to,
      _conditionalFormattin2 = conditionalFormattingRule.condition,
      formula = _conditionalFormattin2.formula,
      operator = _conditionalFormattin2.operator,
      value = _conditionalFormattin2.value,
      value2 = _conditionalFormattin2.value2;

    // Cell range example: "A1:C5"
    var cellRange = getCellAddress(from.row - 1, from.column - 1) + ':' + getCellAddress(to.row - 1, to.column - 1);
    xml += "<conditionalFormatting sqref=\"".concat(cellRange, "\">");

    // The priority attribute in conditional formatting XML is an integer value that must be a positive integer between 1 and the total number of conditional formatting rules on the worksheet.
    // * The value is defined by the W3C XML Schema int datatype.
    // * The valid range is dynamic, starting from 1 (highest priority) and ending at the total number of rules on that specific worksheet (lowest priority).
    // * Each priority value must be unique for all rules on the same worksheet. Changing the priority of one rule will automatically adjust the priorities of other rules to maintain uniqueness and order.
    // * A lower numeric value indicates a higher priority (e.g., priority 1 is the highest possible priority).
    var priority = i + 1;

    // The `dxfId` attribute in ".xlsx" (OpenXML) files is a zero-based integer index (0, 1, 2, ...)
    // referencing a specific differential format record (`<dxf>`) within the "styles.xml" file.
    //
    var dxfId = conditionalFormattingRule._globalIndex;
    //
    // const dxfId = getConditionalFormattingRuleGlobalIndex({
    // 	conditionalFormattingRuleIndex: i,
    // 	sheetsConditionalFormatting,
    // 	sheetIndex
    // })

    // There're a lot of possible `type`s of a `<cfRule/>`.
    // The full list could be viewed by googling for "ST_CfType".

    if (formula) {
      xml += "<cfRule type=\"expression\" dxfId=\"".concat(dxfId, "\" priority=\"").concat(priority, "\">");
      xml += "<formula>".concat(sanitizeTextContent(formula), "</formula>");
      xml += '</cfRule>';
    } else if (operator) {
      xml += "<cfRule type=\"cellIs\" operator=\"".concat(getXlsxOperatorName(operator), "\" dxfId=\"").concat(dxfId, "\" priority=\"").concat(priority, "\">");
      xml += "<formula>".concat(sanitizeTextContent(formatValue(value)), "</formula>");
      if (getXlsxOperatorName(operator) === 'between') {
        xml += "<formula>".concat(sanitizeTextContent(formatValue(value2)), "</formula>");
      }
      xml += '</cfRule>';
    } else {
      throw new Error("Invalid conditional formatting rule:\n".concat(JSON.stringify(conditionalFormattingRule, null, 2)));
    }
    xml += '</conditionalFormatting>';
    i++;
  }
  return xml;
}
function formatValue(value) {
  if (typeof value === 'string') {
    return '"' + value + '"';
  }
  return String(value);
}

// function getConditionalFormattingRuleGlobalIndex({
// 	conditionalFormattingRuleIndex,
// 	sheetsConditionalFormattingRules,
// 	sheetIndex
// }) {
// 	let sheetRulesIndexOffset = 0
//
// 	let i = 0
// 	while (i < sheetIndex) {
// 		if (sheetsConditionalFormattingRules[i]) {
// 			sheetRulesIndexOffset += sheetsConditionalFormattingRules[i].length
// 		}
// 		i++
// 	}
//
// 	return sheetRulesIndexOffset + conditionalFormattingRuleIndex
// }

function getXlsxOperatorName(operator) {
  switch (operator) {
    case '<':
      return 'lessThan';
    case '>':
      return 'greaterThan';
    case '<=':
      return 'lessThanOrEqual';
    case '>=':
      return 'greaterThanOrEqual';
    case '=':
      return 'equal';
    case '!=':
      return 'notEqual';
    case '...':
      return 'between';
    default:
      throw new Error("Unknown conditional formatting operator: ".concat(operator));
  }
}
function getConditionalFormattingStylesXml(sheetsConditionalFormatting) {
  var totalConditionalFormattingRulesCount = 0;
  for (var _iterator2 = _createForOfIteratorHelperLoose(sheetsConditionalFormatting), _step2; !(_step2 = _iterator2()).done;) {
    var conditionalFormattingOfSheet = _step2.value;
    if (conditionalFormattingOfSheet) {
      totalConditionalFormattingRulesCount += conditionalFormattingOfSheet.length;
    }
  }
  var xml = '';
  xml += "<dxfs count=\"".concat(totalConditionalFormattingRulesCount, "\">");
  for (var _iterator3 = _createForOfIteratorHelperLoose(sheetsConditionalFormatting), _step3; !(_step3 = _iterator3()).done;) {
    var _conditionalFormattingOfSheet = _step3.value;
    if (_conditionalFormattingOfSheet) {
      for (var _iterator4 = _createForOfIteratorHelperLoose(_conditionalFormattingOfSheet), _step4; !(_step4 = _iterator4()).done;) {
        var conditionalFormattingRule = _step4.value;
        var _conditionalFormattin3 = conditionalFormattingRule.style,
          fontFamily = _conditionalFormattin3.fontFamily,
          fontSize = _conditionalFormattin3.fontSize,
          fontWeight = _conditionalFormattin3.fontWeight,
          fontStyle = _conditionalFormattin3.fontStyle,
          textDecoration = _conditionalFormattin3.textDecoration,
          textColor = _conditionalFormattin3.textColor,
          backgroundColor = _conditionalFormattin3.backgroundColor,
          fillPatternStyle = _conditionalFormattin3.fillPatternStyle,
          fillPatternColor = _conditionalFormattin3.fillPatternColor,
          borderColor = _conditionalFormattin3.borderColor,
          borderStyle = _conditionalFormattin3.borderStyle,
          leftBorderColor = _conditionalFormattin3.leftBorderColor,
          leftBorderStyle = _conditionalFormattin3.leftBorderStyle,
          rightBorderColor = _conditionalFormattin3.rightBorderColor,
          rightBorderStyle = _conditionalFormattin3.rightBorderStyle,
          topBorderColor = _conditionalFormattin3.topBorderColor,
          topBorderStyle = _conditionalFormattin3.topBorderStyle,
          bottomBorderColor = _conditionalFormattin3.bottomBorderColor,
          bottomBorderStyle = _conditionalFormattin3.bottomBorderStyle;
        xml += '<dxf>';
        var font = {
          fontFamily: fontFamily,
          fontSize: fontSize,
          fontWeight: fontWeight,
          fontStyle: fontStyle,
          textDecoration: textDecoration,
          textColor: textColor
        };
        if (hasFont(font)) {
          // It seems that the "conditional formatting" feature in the XLSX specification
          // doesn't support setting custom `fontFamily` or `fontSize` for some weird reason.
          // https://github.com/catamphetamine/write-excel-file/pull/10#issuecomment-3960778016
          if (fontFamily) {
            throw new Error('Conditional formatting can\'t be used to override font family');
          }
          if (typeof fontSize === 'number') {
            throw new Error('Conditional formatting can\'t be used to override font size');
          }
          xml += getFontXml(font);
        }
        var fill = {
          backgroundColor: backgroundColor,
          fillPatternStyle: fillPatternStyle,
          fillPatternColor: fillPatternColor
        };
        if (hasFill(fill)) {
          xml += getFillXml(fill, {
            conditionalFormatting: true
          });
        }
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
        if (hasBorder(border)) {
          xml += getBorderXml(border);
        }
        xml += '</dxf>';
      }
    }
  }
  xml += '</dxfs>';
  return xml;
}
//# sourceMappingURL=conditionalFormatting.js.map