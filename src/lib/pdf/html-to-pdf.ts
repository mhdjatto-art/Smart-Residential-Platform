/**
 * Lightweight client-side HTML → PDF.
 *
 * Loads html2pdf.bundle.min.js from a CDN on first use, then caches the loaded
 * module on `window`. No npm dep — keeps the production bundle small.
 *
 * The bundle wraps `html2canvas` + `jsPDF` so we get pixel-perfect rendering of
 * any DOM node (including brand colors, signatures, RTL Arabic).
 */

const CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

interface Html2PdfInstance {
  from(el: HTMLElement): Html2PdfInstance;
  set(opts: Record<string, unknown>): Html2PdfInstance;
  save(filename?: string): Promise<void>;
  output(type: string): Promise<Blob>;
  outputPdf(type: string): Promise<Blob>;
}

declare global {
  interface Window {
    html2pdf?: () => Html2PdfInstance;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function getHtml2Pdf(): Promise<() => Html2PdfInstance> {
  if (window.html2pdf) return window.html2pdf;
  await loadScript(CDN_URL);
  // Wait up to ~2s for global to attach
  for (let i = 0; i < 40; i++) {
    if (window.html2pdf) return window.html2pdf;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("html2pdf did not initialize");
}

/**
 * Renders `el` to a multi-page A4 PDF and triggers a browser download.
 */
export async function downloadElementAsPdf(el: HTMLElement, filename: string): Promise<void> {
  const html2pdf = await getHtml2Pdf();
  await html2pdf()
    .from(el)
    .set({
      margin:       [10, 10, 10, 10],
      filename,
      image:        { type: "jpeg", quality: 0.95 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak:    { mode: ["css", "legacy"] },
    })
    .save();
}

/**
 * Renders `el` to a PDF Blob (for uploading to storage / attaching).
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const html2pdf = await getHtml2Pdf();
  const worker = html2pdf()
    .from(el)
    .set({
      margin:       [10, 10, 10, 10],
      image:        { type: "jpeg", quality: 0.95 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak:    { mode: ["css", "legacy"] },
    });
  // html2pdf supports .outputPdf("blob") in 0.10.x
  return await worker.outputPdf("blob");
}
