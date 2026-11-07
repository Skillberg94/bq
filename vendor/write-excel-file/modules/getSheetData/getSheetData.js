export default function getSheetData(objects, columns) {
  // Create header row.
  var headerRow;
  // If at least one column has a header
  // then a header row will be rendered.
  // Otherwise, there will be no header row.
  if (columns.some(function (column) {
    return column.header;
  })) {
    headerRow = columns.map(function (_ref) {
      var header = _ref.header;
      return header || null;
    });
  }
  return (headerRow ? [headerRow] : []).concat(objects.map(function (object, objectIndex) {
    return columns.map(function (_ref2) {
      var cell = _ref2.cell;
      return cell(object, objectIndex);
    });
  }));
}
//# sourceMappingURL=getSheetData.js.map