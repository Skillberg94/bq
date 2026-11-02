import sanitizeAttributeValue from '../../../xml/sanitizeAttributeValue.js';
export default function generatePageSetup(tag, _ref) {
  var orientation = _ref.orientation;
  // Allows setting "landscape" orientation.
  // https://gitlab.com/catamphetamine/write-excel-file/-/issues/7
  if (orientation) {
    // Paper size (when printing).
    // https://github.com/randym/axlsx/blob/master/lib/axlsx/workbook/worksheet/page_setup.rb
    //
    // `paperSize` `9` means "A4 paper (210 mm by 297 mm)".
    //
    var paperSize = 9;

    // Page orientation (when printing).
    //
    // `orientation` can be:
    // * `landscape`
    // * `portrait`
    // https://docs.microsoft.com/en-us/office/vba/api/excel.pagesetup.orientation

    return tag('pageSetup', {
      paperSize: paperSize,
      orientation: sanitizeAttributeValue(orientation)
    });
  }
  return '';
}
//# sourceMappingURL=pageSetup.js.map