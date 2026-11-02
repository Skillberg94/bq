import generateRow from './row.js';
export default function generateSheetData(tag, sheetData, parameters) {
  var sheetDataXml = sheetData.map(function (row, index) {
    return generateRow(tag, row, index, parameters);
  }).join('');
  return tag('sheetData', null, sheetDataXml);
}
//# sourceMappingURL=sheetData.js.map