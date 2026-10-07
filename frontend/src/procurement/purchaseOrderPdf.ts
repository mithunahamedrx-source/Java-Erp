/**
 * Turns the on-screen purchase order sheet into a PDF file ON THE PERSON'S OWN DEVICE - nothing is sent to a server.
 * The libraries are loaded only when a PDF is asked for, so they never weigh on any other page.
 * The sheet is photographed at twice its size and laid onto A4 pages, so Bangla names and any typeface the browser can draw
 * come out exactly as on screen.
 */
export async function sheetToPdf(sheet: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  const image = canvas.toDataURL('image/jpeg', 0.92);
  let offset = 0;
  do {
    if (offset > 0) pdf.addPage();
    pdf.addImage(image, 'JPEG', 0, -offset, pageWidth, imageHeight);
    offset += pageHeight;
  } while (offset < imageHeight - 1);
  return pdf.output('blob');
}

/** A Bangladesh mobile number in the international form WhatsApp links need (`01712-345678` -> `8801712345678`); null when it cannot be one. */
export function whatsAppNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
