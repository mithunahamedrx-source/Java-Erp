/**
 * Reads a chosen file as text.
 *
 * <p>⚠ `File.text()` is the modern path and is NOT universally present — jsdom, which the
 * test environment uses, ships `File` without it. The `FileReader` fallback is therefore
 * load-bearing rather than defensive: without it every CSV upload silently produces an empty
 * string, and the import screens look like they simply did nothing.
 */
export async function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}
