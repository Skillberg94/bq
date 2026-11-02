import sanitizeAttributeValue from '../../../xml/sanitizeAttributeValue.js';
export default function generatePageMargins(tag, _ref) {
  var orientation = _ref.orientation;
  // Margins are required when setting custom orientation,
  // otherwise they'd be `0`.
  // https://gitlab.com/catamphetamine/write-excel-file/-/issues/7#note_782347297
  if (orientation) {
    // Page margins (when printing).
    // https://github.com/randym/axlsx/blob/master/lib/axlsx/workbook/worksheet/page_margins.rb

    var marginLeft = 0.7; // The left margin in inches.
    var marginRight = 0.7; // The right margin in inches.
    var marginTop = 0.75; // The top margin in inches.
    var marginBottom = 0.75; // The bottom margin in inches.
    var header = 0.3; // The header margin in inches.
    var footer = 0.3; // The footer margin in inches.

    return tag('pageMargins', {
      left: marginLeft,
      right: marginRight,
      top: marginTop,
      bottom: marginBottom,
      header: header,
      footer: footer
    });
  }
  return '';
}
//# sourceMappingURL=pageMargins.js.map