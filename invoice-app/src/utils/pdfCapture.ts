import html2canvas from 'html2canvas';

/**
 * NOTE: We render via `html2canvas-pro` (aliased in vite.config.ts), which natively
 * supports oklch/oklab/color-mix. Earlier versions of this file stripped ALL page
 * stylesheets from the PDF clone to work around stock html2canvas's inability to
 * parse those color functions — that also destroyed borders, rounded corners, and
 * flex layout for every box on the invoice (visible as a "flat", unstyled PDF in
 * production builds, since prod CSS loads via a <link> tag rather than dev <style>
 * tags). We now keep the real stylesheet and only patch a few known html2canvas
 * quirks below.
 */

function isSafeCssColor(value: string | null | undefined): boolean {
  return !!value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
}

export async function convertClonedImagesToDataUrls(
  sourceRoot: HTMLElement,
  clonedDoc: Document
): Promise<void> {
  const clonedImages = clonedDoc.querySelectorAll('img');
  const originalImages = sourceRoot.querySelectorAll('img');

  await Promise.all(
    Array.from(clonedImages).map(async (img: HTMLImageElement) => {
      if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) {
        return;
      }

      try {
        const originalImg = Array.from(originalImages).find(
          (orig) => orig.src === img.src || orig.getAttribute('src') === img.getAttribute('src')
        ) as HTMLImageElement | undefined;

        if (
          originalImg?.complete &&
          originalImg.naturalWidth > 0 &&
          originalImg.naturalHeight > 0
        ) {
          const canvas = document.createElement('canvas');
          canvas.width = originalImg.naturalWidth;
          canvas.height = originalImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(originalImg, 0, 0);
            img.src = canvas.toDataURL('image/png');
            return;
          }
        }

        img.crossOrigin = 'anonymous';
        img.style.display = '';
        const originalSrc = img.src;
        img.src = '';
        await new Promise((resolve) => setTimeout(resolve, 10));
        img.src = originalSrc;
      } catch {
        // Continue PDF generation even if an image fails
      }
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 200));
}

export function inlineComputedColors(sourceRoot: HTMLElement, cloneRoot: HTMLElement): void {
  const walk = (source: Element, clone: Element) => {
    const computed = window.getComputedStyle(source);
    const el = clone as HTMLElement;

    if (isSafeCssColor(computed.backgroundColor)) {
      el.style.backgroundColor = computed.backgroundColor;
    }
    if (isSafeCssColor(computed.color)) {
      el.style.color = computed.color;
    }
    if (computed.borderWidth !== '0px' && isSafeCssColor(computed.borderColor)) {
      el.style.borderColor = computed.borderColor;
    }
    if (isSafeCssColor(computed.outlineColor)) {
      el.style.outlineColor = computed.outlineColor;
    }

    const srcChildren = source.children;
    const cloneChildren = clone.children;
    const count = Math.min(srcChildren.length, cloneChildren.length);
    for (let i = 0; i < count; i++) {
      walk(srcChildren[i], cloneChildren[i]);
    }
  };

  walk(sourceRoot, cloneRoot);
}

/**
 * Small, additive overrides layered ON TOP of the page's real stylesheet (which is
 * now preserved in the clone). Only fixes for known html2canvas rendering quirks —
 * must never hide/replace the site's own borders, colors, or layout.
 */
export const PDF_SAFE_INVOICE_CSS = `
.pdf-export {
  background-color: #ffffff !important;
}
/* Thinner table borders in PDF output (cosmetic preference, not a compatibility fix). */
.pdf-export .invoice-table,
.pdf-export .invoice-hierarchy-table,
.pdf-export .invoice-description-table,
.pdf-export .invoice-hierarchy-table-wrap,
.pdf-export .invoice-description-table-wrap,
.pdf-export .invoice-table th,
.pdf-export .invoice-table td,
.pdf-export .invoice-table tr,
.pdf-export .invoice-hierarchy-table th,
.pdf-export .invoice-hierarchy-table td {
  border-width: 0.5px !important;
}
`;

/** Replace regular spaces with NBSP so html2canvas cannot collapse them in flex layouts. */
export function preserveSpacesInClone(root: HTMLElement): void {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const node of textNodes) {
    const value = node.nodeValue;
    if (!value || !value.includes(' ')) continue;
    // Keep intentional multi-space / newlines; only harden single spaces between words
    node.nodeValue = value.replace(/ /g, '\u00A0');
  }
}

export function sanitizeClonedDocumentForHtml2Canvas(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement
): void {
  // Keep the page's real stylesheet(s) intact — html2canvas-pro can parse them,
  // and removing them was previously dropping every border/rounded-corner/flex layout.

  const safeStyle = clonedDoc.createElement('style');
  safeStyle.setAttribute('data-pdf-safe', 'true');
  safeStyle.textContent = PDF_SAFE_INVOICE_CSS;
  clonedDoc.head?.appendChild(safeStyle);

  cloneRoot.classList.add('pdf-export');
  const pdfRoot = cloneRoot.querySelector('[data-pdf-root="true"]');
  if (pdfRoot instanceof HTMLElement) {
    pdfRoot.classList.add('pdf-export');
  }

  // Reinforce computed colors as a safety net in case any inline style or dynamic
  // (user-picked) color slipped through as oklch/oklab that the browser resolves
  // to rgb() via getComputedStyle anyway.
  inlineComputedColors(sourceRoot, cloneRoot);

  preserveSpacesInClone(cloneRoot);
}

export type Html2CanvasOnClone = (
  clonedDoc: Document,
  cloneRoot: HTMLElement
) => void | Promise<void>;

export function buildHtml2CanvasOnClone(
  sourceRoot: HTMLElement,
  extra?: Html2CanvasOnClone
): Html2CanvasOnClone {
  return async (clonedDoc, cloneRoot) => {
    sanitizeClonedDocumentForHtml2Canvas(clonedDoc, sourceRoot, cloneRoot);
    await extra?.(clonedDoc, cloneRoot);
  };
}

export interface CaptureToCanvasOptions {
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  backgroundColor?: string;
  onClone?: Html2CanvasOnClone;
}

export async function captureElementToCanvas(
  element: HTMLElement,
  options: CaptureToCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    scale = 2,
    useCORS = true,
    allowTaint = false,
    backgroundColor = '#ffffff',
    onClone,
  } = options;

  element.classList.add('pdf-export');

  try {
    return await html2canvas(element, {
      scale,
      useCORS,
      allowTaint,
      logging: false,
      backgroundColor,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      removeContainer: false,
      onclone: buildHtml2CanvasOnClone(element, onClone),
    });
  } finally {
    element.classList.remove('pdf-export');
  }
}
