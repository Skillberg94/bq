/**
 * Gets spreadsheet cell string coordinate from row index and column index.
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {string}
 */
export default function getCellAddress(rowIndex, columnIndex) {
  return "".concat(getColumnLetter(columnIndex)).concat(rowIndex + 1);
}

// `26` letters in the alphabet: from "A" to "Z".
var LETTERS_COUNT = 26;
function getColumnLetter(columnIndex) {
  if (typeof columnIndex !== 'number') {
    return '';
  }
  var prefix = Math.floor(columnIndex / LETTERS_COUNT);
  // Letter character codes start at `97`.
  var letter = String.fromCharCode(97 + columnIndex % LETTERS_COUNT).toUpperCase();
  if (prefix === 0) {
    return letter;
  }
  return getColumnLetter(prefix - 1) + letter;
}
//# sourceMappingURL=getCellAddress.js.map