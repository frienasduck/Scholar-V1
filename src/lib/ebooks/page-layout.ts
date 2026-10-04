/** Normal reading is width-fit; only immersive fit-page may constrain height. */
export function pdfPageScale(width: number, page: { width: number; height: number }, fit: "width" | "page", availableHeight: number) {
  const widthScale = Math.max(1, width) / Math.max(1, page.width);
  return fit === "width" ? widthScale : Math.min(widthScale, Math.max(240, availableHeight) / Math.max(1, page.height));
}
