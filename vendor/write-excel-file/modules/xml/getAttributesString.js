import sanitizeAttributeName from './sanitizeAttributeName.js';
import sanitizeAttributeValue from './sanitizeAttributeValue.js';

/**
 * Converts an object with XML attribute values to a string.
 * Examples:
 * { a: 'b', c: 'd' } → ' a="b" c="d"'
 * {} → ''
 * @param {object} attributes
 * @returns {string}
 */
export default function getAttributesString(attributes) {
  return Object.keys(attributes).map(function (name) {
    return "".concat(sanitizeAttributeName(name), "=\"").concat(sanitizeAttributeValue(String(attributes[name])), "\"");
  }).reduce(function (combined, part) {
    return combined + ' ' + part;
  }, '');
}
//# sourceMappingURL=getAttributesString.js.map