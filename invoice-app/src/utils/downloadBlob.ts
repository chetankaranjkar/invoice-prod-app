/** Trigger a file download in the browser from a Blob response. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function getFilenameFromContentDisposition(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  if (!contentDisposition) return fallback;
  const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i)
    ?? contentDisposition.match(/filename="?(.+)"?/i);
  return filenameMatch?.[1] ?? fallback;
}
