import { strToU8 } from 'fflate';

/**
 * Converts `files` values to `Uint8Array`s.
 * @param {Record<string,any>} files
 * @param {function} convertFileContentToUint8Array
 * @returns {Promise<Record<string,Uint8Array>>}
 */
export default function convertFilesContentToUint8Arrays(files, convertFileContentToUint8Array) {
  var convertedFiles = {};
  return Promise.all(Object.keys(files).map(function (key) {
    if (files[key] instanceof Uint8Array) {
      convertedFiles[key] = files[key];
    } else if (typeof files[key] === 'string') {
      convertedFiles[key] = convertStringToUint8Array(files[key]);
    } else {
      return convertFileContentToUint8Array(files[key]).then(function (uint8Array) {
        convertedFiles[key] = uint8Array;
      });
    }
  })).then(function () {
    return convertedFiles;
  });
}
function convertStringToUint8Array(string) {
  return strToU8(string);
}
//# sourceMappingURL=convertFilesContentToUint8Arrays.js.map