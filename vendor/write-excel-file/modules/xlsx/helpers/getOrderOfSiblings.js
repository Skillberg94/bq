import ORDER_OF_SIBLINGS from './orderOfSiblings.js';

/**
 * Returns the order of siblings in a given `.xml` file inside given parent tag(s).
 * @param {string} fileName
 * @param {string[]} parentTagNames
 * @returns {string[]}
 */
export default function getOrderOfSiblings(fileName) {
  var orderOfSiblings = ORDER_OF_SIBLINGS[fileName];
  if (!orderOfSiblings) {
    // File not supported.
    // Return nothing.
    return;
  }
  for (var _len = arguments.length, parentTagNames = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    parentTagNames[_key - 1] = arguments[_key];
  }
  if (parentTagNames.length === 0) {
    throw new Error('At least one parent element tag name is required');
  }
  var _loop = function _loop() {
      var tagName = _parentTagNames[_i];
      var orderOfSiblingsMatchingElement = orderOfSiblings.find(function (element) {
        if (Array.isArray(element)) {
          return element[0] === tagName;
        } else {
          return element === tagName;
        }
      });
      if (!orderOfSiblingsMatchingElement) {
        // The element is not present in the pre-defined order of elements.
        // Return nothing.
        return {
          v: void 0
        };
      }
      if (Array.isArray(orderOfSiblingsMatchingElement)) {
        orderOfSiblings = orderOfSiblingsMatchingElement[1];
      } else {
        // The element doesn't specify any child elements.
        // Return nothing.
        return {
          v: void 0
        };
      }
    },
    _ret;
  for (var _i = 0, _parentTagNames = parentTagNames; _i < _parentTagNames.length; _i++) {
    _ret = _loop();
    if (_ret) return _ret.v;
  }
  if (orderOfSiblings) {
    // Convert element of `OrderOfSiblings` array to a `string`.
    return orderOfSiblings.map(function (element) {
      if (Array.isArray(element)) {
        return element[0];
      } else {
        return element;
      }
    });
  }
}
//# sourceMappingURL=getOrderOfSiblings.js.map