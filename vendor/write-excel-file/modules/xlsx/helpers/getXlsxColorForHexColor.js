export default function getXlsxColorForHexColor(color) {
  if (color[0] !== '#') {
    throw new Error("Color \"".concat(color, "\" must start with a \"#\""));
  }
  return "FF".concat(color.slice('#'.length).toUpperCase());
}
//# sourceMappingURL=getXlsxColorForHexColor.js.map