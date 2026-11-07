import getAdditionalContent from '../helpers/features/getAdditionalContent.js';
import transformContent from '../helpers/features/transformContent.js';
export default function generateWorkbookXmlRels(_ref) {
  var sheetIds = _ref.sheetIds,
    features = _ref.features,
    sheetsOptions = _ref.sheetsOptions;
  var xml = '<?xml version="1.0" ?>' + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheetIds.map(function (id) {
    return "<Relationship Id=\"rId".concat(id, "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet").concat(id, ".xml\"/>");
  }).join('') + "<Relationship Id=\"rId".concat(sheetIds.length + 1, "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/>") + "<Relationship Id=\"rId".concat(sheetIds.length + 2, "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>") +
  // Apply any plugins that insert additional content to this XML.
  getAdditionalContent('xl/_rels/workbook.xml.rels', features, sheetsOptions) + '</Relationships>';

  // Apply any plugins that transform this XML.
  xml = transformContent(xml, 'xl/_rels/workbook.xml.rels', features, sheetsOptions);
  return xml;
}
//# sourceMappingURL=workbook.xml.rels.js.map