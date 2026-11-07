import getCellStyleProperties from './helpers/getCellStyleProperties.js';

// Supports "merging cells" across columns and rows.
// https://rdrr.io/cran/openxlsx/man/mergeCells.html
//
// Returned result example for merged cells range "A2:C3":
// { mergedCells: [ [0, 1], [2, 2] ] }
//
// Data example:
//
// rows:
// [
//   [...],
//   [
//     { type: String, value: 'abc', columnSpan: 3, rowSpan: 2 },
//     { ... },
//     { ... }
//   ],
//   [...]
// ]

export default function processMergedCells(sheetData, features) {
  var mergedCells = [];
  var _cloneSheetData = function cloneSheetData() {
    // The code will apply the style from the originating "merged" cells
    // to their adjacent `null` cells, so clone `sheetData` to prevent mutating it.
    sheetData = sheetData.slice();
    // Also clone each row of `sheetData`.
    var i = 0;
    while (i < sheetData.length) {
      sheetData[i] = sheetData[i].slice();
      i++;
    }
    // `sheetData` has been cloned. No need to clone it again.
    _cloneSheetData = function cloneSheetData() {
      return sheetData;
    };
    // Return the cloned `sheetData`.
    return sheetData;
  };
  var rowIndex = 0;
  while (rowIndex < sheetData.length) {
    var row = sheetData[rowIndex];
    var columnIndex = 0;
    while (columnIndex < row.length) {
      var cell = row[columnIndex];
      if (cell) {
        var _cell$rowSpan = cell.rowSpan,
          rowSpan = _cell$rowSpan === void 0 ? 1 : _cell$rowSpan;

        // `cell.span` property was renamed to `cell.columnSpan`.
        var columnSpan = typeof cell.span === 'number' ? cell.span : cell.columnSpan;
        if (typeof columnSpan !== 'number') {
          columnSpan = 1;
        }
        if (columnSpan > 1 || rowSpan > 1) {
          // Validate that `columnSpan`-ning or `rowSpan`-ning cells only overlap
          // `null` or `undefined` ones. Especially that `columnSpan`-ning or `rowSpan`-ning cells
          // don't overlap other `columnSpan`-ning or `rowSpan`-ning cells.
          processSpanningCells(sheetData, rowIndex, columnIndex, columnSpan, rowSpan, _cloneSheetData, features);

          // Add "merged cells" entry:
          // `[ [fromRowIndex, fromColumnIndex], [toRowIndex, toColumnIndex] ]`.
          mergedCells.push([[rowIndex, columnIndex], [rowIndex + (rowSpan ? rowSpan - 1 : 0), columnIndex + (columnSpan ? columnSpan - 1 : 0)]]);
        }
      }
      columnIndex++;
    }
    rowIndex++;
  }
  return {
    sheetData: sheetData,
    mergedCells: mergedCells
  };
}

// Validate that a `columnSpan`-ning / `rowSpan`-ning cell doesn't overlap
// with other cells, especially `columnSpan`-ning / `rowSpan`-ning ones,
// because those ones would make MS Office 2007 Excel say:
// "Excel found unreadable content in 'file.xlsx'.
//  Do you want to recover the contents of this workbook?
//  If you trust the source of this workbook, click Yes".
function processSpanningCells(sheetData, rowIndex, columnIndex, columnSpan, rowSpan, cloneSheetData, features) {
  var cellStyleProperties = getCellStyleProperties(sheetData[rowIndex][columnIndex], features);
  if (cellStyleProperties) {
    sheetData = cloneSheetData();
  }
  var i = rowIndex;
  while (i <= rowIndex + (rowSpan - 1)) {
    var j = columnIndex;
    while (j <= columnIndex + (columnSpan - 1)) {
      var cell = sheetData[i][j];
      if (i > rowIndex || j > columnIndex) {
        // Validate that all hidden cells are `null` or `undefined`.
        if (cell !== null && cell !== undefined) {
          throw new Error("[write-excel-file] When using `columnSpan` or `rowSpan` parameters, all hidden overlapped cells should be represented by `null`s or `undefined`s. Cell at row ".concat(rowIndex + 1, " and column ").concat(columnIndex + 1, " is configured with `columnSpan` ").concat(columnSpan, " and `rowSpan` ").concat(rowSpan, ". Cell at row ").concat(i + 1, " and column ").concat(j + 1, " is neither `null` nor `undefined`: ").concat(JSON.stringify(cell)));
        }
        // Apply the style from the original cell to this `null` cell.
        // https://gitlab.com/catamphetamine/write-excel-file/-/issues/43
        if (cellStyleProperties) {
          sheetData[i][j] = cellStyleProperties;
        }
      }
      j++;
    }
    i++;
  }
}
//# sourceMappingURL=processMergedCells.js.map