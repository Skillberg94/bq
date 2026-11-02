function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
import findElement from './findElement.js';
import { getOpeningTagRegExpPattern } from './findElementsNonRecursive_.js';
import appendMarkupInsideElement from './appendMarkupInsideElement.js';
import getChildElements from './getChildElements.js';
import prependMarkupInsideElement from './prependMarkupInsideElement.js';
export default function insertElementMarkupAccordingToOrderOfSiblings(xml, elementMarkup, orderOfSiblings) {
  for (var _len = arguments.length, parentElementTagNames = new Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++) {
    parentElementTagNames[_key - 3] = arguments[_key];
  }
  if (parentElementTagNames.length === 0) {
    throw new Error('At least one parent element tag name is required');
  }

  // Reorder the parent elements from top to bottom.
  parentElementTagNames = parentElementTagNames.slice().reverse();

  // Find the immediate parent element.
  var parentElement;
  var _loop = function _loop() {
    var parentElementTagName = _step.value;
    if (parentElement) {
      // Doesn't use `findElementInsideElement()` here in order to only search
      // in the immediate children of the `parentElement`.
      // parentElement = findElementInsideElement(xml, parentElementTagName, parentElement)
      parentElement = getChildElements(xml, parentElement).find(function (_) {
        return _.tagName === parentElementTagName;
      });
    } else {
      parentElement = findElement(xml, parentElementTagName);
    }
    if (!parentElement) {
      throw new Error("Element not found: <".concat(parentElementTagName, ">"));
    }
  };
  for (var _iterator = _createForOfIteratorHelperLoose(parentElementTagNames), _step; !(_step = _iterator()).done;) {
    _loop();
  }

  // Get element's tag name.
  var elementTagNameMatch = elementMarkup.match(TAG_NAME_REG_EXP);
  if (!elementTagNameMatch) {
    throw new Error("Couldn't extract tag name from markup: ".concat(elementMarkup));
  }
  var elementTagName = elementTagNameMatch[1];

  // See if the `.xlsx` specification enforces a specific order of elements in such case.
  if (!orderOfSiblings || orderOfSiblings.length < 2) {
    return appendMarkupInsideElement(xml, parentElement, elementMarkup);
  }
  var children = getChildElements(xml, parentElement);
  if (children.length === 0) {
    return appendMarkupInsideElement(xml, parentElement, elementMarkup);
  }
  var elementTagNameOrder = orderOfSiblings.indexOf(elementTagName);
  if (elementTagNameOrder < 0) {
    // The element tag name is unknown.
    return appendMarkupInsideElement(xml, parentElement, elementMarkup);
  }
  var tagNamesBeforeElement = orderOfSiblings.slice(0, elementTagNameOrder).reverse();
  var _loop2 = function _loop2() {
      var tagName = _step2.value;
      var precedingElement = children.find(function (_) {
        return _.tagName === tagName;
      });
      if (precedingElement) {
        return {
          v: xml.slice(0, precedingElement.selfClosingTag ? precedingElement.openingTagEndIndex + 1 : precedingElement.closingTagEndIndex + 1) + elementMarkup + xml.slice(precedingElement.selfClosingTag ? precedingElement.openingTagEndIndex + 1 : precedingElement.closingTagEndIndex + 1)
        };
      }
    },
    _ret;
  for (var _iterator2 = _createForOfIteratorHelperLoose(tagNamesBeforeElement), _step2; !(_step2 = _iterator2()).done;) {
    _ret = _loop2();
    if (_ret) return _ret.v;
  }
  return prependMarkupInsideElement(xml, parentElement, elementMarkup);
}
var TAG_NAME_REG_EXP = new RegExp(getOpeningTagRegExpPattern());

// function findOrderOfElementsInsideParentElement(orderOfElements, parentElementTagName) {
// 	for (const element of orderOfElements) {
// 		if (Array.isArray(element)) {
// 			if (element[0] === parentElementTagName) {
// 				return element[1]
// 			}
// 			const recursionResult = findOrderOfElementsInsideParentElement(element[1], parentElementTagName)
// 			if (recursionResult) {
// 				return recursionResult
// 			}
// 		} else {
// 			// No order of child elements is specified for the `element`
// 			// so there's nothing to search for inside this `element`.
// 			// And if the `element` happens to be `parentElementTagName`,
// 			// there's no need to look any further at all
// 			// because it seems that no order of child elements is specified
// 			// for the `parentElementTagName`.
// 			if (element === parentElementTagName) {
// 				return
// 			}
// 		}
// 	}
// }
//# sourceMappingURL=insertElementMarkupAccordingToOrderOfSiblings.js.map