/**
 * Finds elements in valid XML markup.
 * Caveat: Every time it finds an element, it doesn't "step into" it but rather "steps over" it.
 * @param {string} xml — XML markup
 * @param {string} [options.tagName] — The name of the element to find
 * @param {boolean} [options.stopAfterFirstMatch] — If `true`, will only return a single result.
 * @returns {object[]} — Found elements, each element represented by an object with propeties: `{ openingTagStartIndex: number, openingTagEndIndex: number, openingTagAttributes: object, selfClosingTag?: boolean, closingTagStartIndex?: number, closingTagEndIndex?: number }`
 */
export default function findElementsNonRecursive_(xml) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    tagName = _ref.tagName,
    stopAfterFirstMatch = _ref.stopAfterFirstMatch;
  var openingTagRegExp = new RegExp(getOpeningTagRegExpPattern(tagName), stopAfterFirstMatch ? undefined : 'g');
  var results = [];
  var openingTagMatch;
  while ((openingTagMatch = openingTagRegExp.exec(xml)) !== null) {
    var openingTag = openingTagMatch[0];
    var openingTagName = tagName || openingTagMatch[1];
    var attributes = {};
    var attributeRegExp = new RegExp('\\s+([^\\s=>]+)(?:="([^\\s=>]+)")', 'g');
    var attributeMatch = void 0;
    while ((attributeMatch = attributeRegExp.exec(openingTag)) !== null) {
      attributes[attributeMatch[1]] = attributeMatch[2];
    }
    var result = {
      tagName: openingTagName,
      // openingTagMarkup: openingTag,
      openingTagStartIndex: openingTagMatch.index,
      openingTagEndIndex: openingTagMatch.index + openingTag.length - 1,
      openingTagAttributes: attributes,
      selfClosingTag: false,
      // closingTagMarkup: undefined,
      closingTagStartIndex: undefined,
      closingTagEndIndex: undefined
    };
    if (openingTag[openingTag.length - 2] === '/') {
      result.selfClosingTag = true;
    } else {
      var closingTagPosition = findClosingTagPosition(xml, result.openingTagEndIndex + 1, openingTagName);
      if (!closingTagPosition) {
        // `xml` is supposed to be "valid XML", so such situation isn't supposed to be possible.
        throw new Error("Invalid XML: opening tag was found but closing tag was not: </".concat(openingTagName, ">"));
      }
      result.closingTagStartIndex = closingTagPosition[0];
      result.closingTagEndIndex = closingTagPosition[1];
    }
    results.push(result);
    if (stopAfterFirstMatch) {
      break;
    }

    // Set "start from" index of the next match.
    if (result.selfClosingTag) {
      openingTagRegExp.lastIndex = result.openingTagEndIndex + 1;
    } else {
      openingTagRegExp.lastIndex = result.closingTagEndIndex + 1;
    }
  }
  return results;
}
function findClosingTagPosition(xml, startFromIndex, tagName) {
  var openingOrClosingTagRegExp = new RegExp('<(/)?' + tagName + '(?:\\s+[^>]+|/)?>', 'g');
  openingOrClosingTagRegExp.lastIndex = startFromIndex;
  var nestingLevel = 0;
  var openingOrClosingTagMatch;
  while ((openingOrClosingTagMatch = openingOrClosingTagRegExp.exec(xml)) !== null) {
    var openingOrClosingTag = openingOrClosingTagMatch[0];
    // Tells if it's a closing tag or an opening tag.
    var closingTagMarker = openingOrClosingTagMatch[1];
    if (closingTagMarker) {
      // Closing tag encountered.
      if (nestingLevel > 0) {
        nestingLevel--;
      } else {
        return [openingOrClosingTagMatch.index, openingOrClosingTagMatch.index + openingOrClosingTag.length - 1];
      }
    } else {
      // Opening tag encountered.
      nestingLevel++;
    }
  }
}
export function getOpeningTagRegExpPattern(tagName) {
  return '<' + (tagName || '([^\\s/>]+)') + '(?:\\s+[^>]+|/)?>';
}
//# sourceMappingURL=findElementsNonRecursive_.js.map