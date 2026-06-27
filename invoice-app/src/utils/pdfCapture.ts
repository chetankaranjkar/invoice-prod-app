import html2canvas from 'html2canvas';

/** Tailwind v4 emits oklab/oklch — html2canvas cannot parse them. Use hex/rgb only in PDF clone. */
const MODERN_COLOR_PATTERN =
  /(?:oklab|oklch|oslch|color-mix|lab|lch)\((?:[^()]*|\([^()]*\))*\)/gi;

export function stripModernColorFunctions(css: string): string {
  let result = css;
  for (let pass = 0; pass < 8; pass++) {
    const next = result.replace(MODERN_COLOR_PATTERN, '#6b7280');
    if (next === result) break;
    result = next;
  }
  return result;
}

function isSafeCssColor(value: string | null | undefined): boolean {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return false;
  return !/oklab|oklch|oslch|color-mix/i.test(value);
}

/** Walk source + clone trees in parallel; inline browser-computed RGB colors on clone. */
export function sanitizeInlineStyles(root: HTMLElement): void {
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
  allElements.forEach((el) => {
    const styleAttr = el.getAttribute('style');
    if (styleAttr && /oklab|oklch|oslch|color-mix/i.test(styleAttr)) {
      el.setAttribute('style', stripModernColorFunctions(styleAttr));
    }
  });
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

/** Invoice PDF shell — explicit hex/rgb (no Tailwind color utilities on clone). */
export const PDF_SAFE_INVOICE_CSS = `
.pdf-export {
  background-color: #ffffff !important;
  color: #0f172a !important;
}
.pdf-export .bg-\\[\\#d1d5dc\\],
.pdf-export .bg-\\[\\#d1d5dc\\] {
  background-color: #d1d5dc !important;
}
.pdf-export .bg-\\[\\#1f2937\\],
.pdf-export .bg-slate-100 {
  background-color: #d1d5dc !important;
  color: #0f172a !important;
}
.pdf-export .bg-\\[\\#1f2937\\] {
  background-color: #1f2937 !important;
  color: #ffffff !important;
}
.pdf-export .bg-sky-50\\/50,
.pdf-export .bg-slate-50\\/60 {
  background-color: #f8fafc !important;
}
.pdf-export .text-\\[\\#6b7280\\],
.pdf-export .text-\\[\\#4b5563\\] {
  color: #4b5563 !important;
}
.pdf-export .border,
.pdf-export .border-\\[\\#9ca3af\\],
.pdf-export .border-\\[\\#d1d5db\\],
.pdf-export .border-\\[\\#e5e7eb\\] {
  border-color: #9ca3af !important;
}
.pdf-export th,
.pdf-export td {
  border-color: #9ca3af !important;
}
/* Thinner table borders in PDF output. */
.pdf-export .invoice-table,
.pdf-export .invoice-hierarchy-table,
.pdf-export .invoice-description-table {
  border-width: 0.5px !important;
}
.pdf-export .invoice-hierarchy-table-wrap,
.pdf-export .invoice-description-table-wrap {
  border-width: 0.5px !important;
}
.pdf-export .invoice-table th,
.pdf-export .invoice-table td,
.pdf-export .invoice-table tr,
.pdf-export .invoice-hierarchy-table th,
.pdf-export .invoice-hierarchy-table td {
  border-width: 0.5px !important;
}
`;

export function sanitizeClonedDocumentForHtml2Canvas(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement
): void {
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    node.parentNode?.removeChild(node);
  });

  clonedDoc.querySelectorAll('style').forEach((tag) => {
    if (tag.textContent) {
      tag.textContent = stripModernColorFunctions(tag.textContent);
    }
  });

  const safeStyle = clonedDoc.createElement('style');
  safeStyle.setAttribute('data-pdf-safe', 'true');
  safeStyle.textContent = PDF_SAFE_INVOICE_CSS;
  clonedDoc.head?.appendChild(safeStyle);

  cloneRoot.classList.add('pdf-export');
  const pdfRoot = cloneRoot.querySelector('[data-pdf-root="true"]');
  if (pdfRoot instanceof HTMLElement) {
    pdfRoot.classList.add('pdf-export');
  }

  sanitizeInlineStyles(cloneRoot);
  inlineComputedColors(sourceRoot, cloneRoot);
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
