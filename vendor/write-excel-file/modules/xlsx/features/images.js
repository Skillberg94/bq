function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import sanitizeAttributeValue from '../../xml/sanitizeAttributeValue.js';
import getFileExtensionForContentType from '../helpers/getFileExtensionForContentType.js';
export default {
  files: {
    transform: {
      '[Content_Types].xml': {
        insert: function insert(sheetsOptions) {
          var sheetsImages = sheetsOptions.map(function (sheetOptions) {
            return sheetOptions.images;
          });
          if (sheetsImages.some(Boolean)) {
            return getContentTypesXml(sheetsImages);
          }
        }
      },
      'xl/drawings/drawing{id}.xml': {
        insert: function insert(sheetOptions, _ref) {
          var sheetIndex = _ref.sheetIndex,
            sheetId = _ref.sheetId;
          var images = sheetOptions.images;
          if (images) {
            return getImagesDrawingXml({
              images: images
            });
          }
        }
      },
      'xl/drawings/_rels/drawing{id}.xml.rels': {
        insert: function insert(sheetOptions, _ref2) {
          var sheetIndex = _ref2.sheetIndex,
            sheetId = _ref2.sheetId;
          var images = sheetOptions.images;
          if (images) {
            return getImagesDrawingXmlRels({
              images: images,
              sheetIndex: sheetIndex
            });
          }
        }
      }
    },
    write: {
      files: function files(sheetsOptions, _ref3) {
        var read = _ref3.read;
        var sheetsImages = sheetsOptions.map(function (sheetOptions) {
          return sheetOptions.images;
        });
        if (sheetsImages.some(Boolean)) {
          return sheetsImages.map(function (images, sheetIndex) {
            if (images) {
              return images.reduce(function (imagesContent, image, imageIndex) {
                return _objectSpread(_objectSpread({}, imagesContent), {}, _defineProperty({}, "xl/media/".concat(getImageFileName(image, {
                  sheetIndex: sheetIndex,
                  imageIndex: imageIndex
                })), image.content));
              }, {});
            }
            return {};
          }).reduce(function (allImagesContent, sheetImagesContent) {
            return _objectSpread(_objectSpread({}, allImagesContent), sheetImagesContent);
          }, {});
        }
      }
    }
  }
};
function getContentTypesXml(sheetsImages) {
  // Get images from all sheets.
  var imagesFromAllSheets = sheetsImages.reduce(function (all, images) {
    return [].concat(_toConsumableArray(all), _toConsumableArray(images || []));
  }, []);
  var xml = '';

  // Elements with `PartName="/xl/drawings/drawing${sheetId}.xml"` are already added by default.
  // Hence, this block of code was commented out.
  //
  // let i = 0
  // for (const images of imagesPerSheet) {
  // 	if (images) {
  // 		xml += `<Override ContentType="application/vnd.openxmlformats-officedocument.drawing+xml" PartName="/xl/drawings/drawing${sheetId}.xml"/>`
  // 	}
  // 	i++
  // }

  for (var _iterator = _createForOfIteratorHelperLoose(getFileExtensionContentTypes(imagesFromAllSheets)), _step; !(_step = _iterator()).done;) {
    var _step$value = _step.value,
      fileExtension = _step$value.fileExtension,
      contentType = _step$value.contentType;
    xml += "<Default Extension=\"".concat(fileExtension, "\" ContentType=\"").concat(contentType, "\"/>");
  }
  return xml;
}
function getFileExtensionContentTypes(images) {
  var fileExtensionContentTypes = [];
  var addFileExtensionContentType = function addFileExtensionContentType(image) {
    var fileExtension = getFileExtensionForContentType(image.contentType);
    var existingFileExtensionContentType = fileExtensionContentTypes.find(function (_) {
      return _.fileExtension === fileExtension;
    });
    if (!existingFileExtensionContentType) {
      fileExtensionContentTypes.push({
        fileExtension: fileExtension,
        contentType: image.contentType
      });
    }
  };
  for (var _iterator2 = _createForOfIteratorHelperLoose(images), _step2; !(_step2 = _iterator2()).done;) {
    var image = _step2.value;
    addFileExtensionContentType(image);
  }
  return fileExtensionContentTypes;
}
function getImageFileName(image, _ref4) {
  var sheetIndex = _ref4.sheetIndex,
    imageIndex = _ref4.imageIndex;
  var sheetNumber = sheetIndex + 1;
  var imageNumber = imageIndex + 1;
  return "sheet".concat(sheetNumber, "-image").concat(imageNumber, ".").concat(getFileExtensionForContentType(image.contentType));
}
function getImagesDrawingXml(_ref5) {
  var images = _ref5.images;
  var xml = '';
  var i = 0;
  var _loop = function _loop() {
    var image = _step3.value;
    // `imageId` is used to get the "relationship ID" of the image.
    var imageId = i + 1;
    var pxToEmu = function pxToEmu(px) {
      return pxToEmu_(px, image.dpi);
    };

    // There're two ways an image could be "anchored" in a spreadsheet:
    // * One-cell anchor — "anchors" the image's top-left corner to a top-left corner of a cell.
    // * Two-cell anchor — "anchors" the image's top-left corner to a top-left corner of the first cell,
    //   and then the image's bottom-right corner to the bottom-right corner of the second cell.
    //   While doing so, it completely ignores the image's aspect ratio, so there seems to be
    //   no equivalent for CSS's `object-fit: contain` behavior.
    xml += '<xdr:oneCellAnchor>';
    xml += '<xdr:from>';
    xml += "<xdr:col>".concat(image.anchor.column - 1, "</xdr:col>");
    xml += "<xdr:colOff>".concat(typeof image.offsetX === 'number' ? pxToEmu(image.offsetX) : 0, "</xdr:colOff>");
    xml += "<xdr:row>".concat(image.anchor.row - 1, "</xdr:row>");
    xml += "<xdr:rowOff>".concat(typeof image.offsetY === 'number' ? pxToEmu(image.offsetY) : 0, "</xdr:rowOff>");
    xml += '</xdr:from>';
    xml += "<xdr:ext cx=\"".concat(pxToEmu(image.width), "\" cy=\"").concat(pxToEmu(image.height), "\"/>");
    xml += '<xdr:pic>';
    xml += '<xdr:nvPicPr>';
    xml += "<xdr:cNvPr id=\"".concat(imageId, "\" name=\"").concat(image.title ? sanitizeAttributeValue(image.title) : 'Picture ' + imageId, "\" descr=\"").concat(image.description ? sanitizeAttributeValue(image.description) : '', "\"/>");
    xml += '<xdr:cNvPicPr>';
    // Optional XML element. Locks the aspect ratio of the image. -->
    xml += '<a:picLocks noChangeAspect="1"/>';
    xml += '</xdr:cNvPicPr>';
    xml += '</xdr:nvPicPr>';
    xml += '<xdr:blipFill>';

    // The link to the image.
    xml += "<a:blip xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" r:embed=\"rId-image-".concat(imageId, "\" cstate=\"print\"/>");

    // Allows scaling the image.
    xml += '<a:stretch>';
    xml += '<a:fillRect/>';
    xml += '</a:stretch>';
    xml += '</xdr:blipFill>';

    // Dunno what this is.
    xml += '<xdr:spPr>';
    xml += '<a:prstGeom prst="rect">';
    xml += '<a:avLst/>';
    xml += '</a:prstGeom>';
    xml += '</xdr:spPr>';
    xml += '</xdr:pic>';
    xml += '<xdr:clientData/>';
    xml += '</xdr:oneCellAnchor>';
    i++;
  };
  for (var _iterator3 = _createForOfIteratorHelperLoose(images), _step3; !(_step3 = _iterator3()).done;) {
    _loop();
  }
  return xml;
}
function getImagesDrawingXmlRels(_ref6) {
  var images = _ref6.images,
    sheetIndex = _ref6.sheetIndex;
  return images.map(function (image, i) {
    var imageId = i + 1;
    return "<Relationship Id=\"rId-image-".concat(imageId, "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"../media/").concat(getImageFileName(image, {
      sheetIndex: sheetIndex,
      imageIndex: i
    }), "\"/>");
  }).join('');
}

// For legacy reasons, XLSX documents measure image dimensions not in pixels
// but rather in a weird measurement unit called EMU (English Metric Unit).
// https://gitlab.com/catamphetamine/write-excel-file/-/blob/main/docs/IMAGES.md#image-dimensions
// This function converts pixels to EMUs.
var DEFAULT_DISPLAY_DPI = 96;
var DEFAULT_IMAGE_DPI = 96;
function pxToEmu_(px, imageDpi) {
  var displayDpi = DEFAULT_DISPLAY_DPI;
  return Math.round(px * 9525 * (DEFAULT_DISPLAY_DPI / displayDpi) * (DEFAULT_IMAGE_DPI / imageDpi));
}
//# sourceMappingURL=images.js.map