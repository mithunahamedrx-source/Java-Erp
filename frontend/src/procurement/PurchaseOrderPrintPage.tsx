import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logoUrl from '../assets/brand/trioloo-logo-black.png';
import { PRINT_CSS } from '../order/InvoicePage';
import { messageOf } from '../masterdata/MasterDataParts';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { displayQuantity, fetchPurchaseOrder, STATUS_LABEL } from './purchaseApi';
import type { PurchaseOrderDetail } from './purchaseApi';
import { downloadBlob, sheetToPdf, whatsAppNumber } from './purchaseOrderPdf';

/**
 * The Purchase Order printable: print it, save it as a PDF on this computer, or send it to the supplier on WhatsApp.
 *
 * <p>It RENDERS the order as it stands and decides nothing (`PRN-001`, `PRN-022`): every figure is a stored column and none is
 * re-added. Printing, saving and sharing are not business events and change nothing (`PRN-010`). The PDF is made in the browser
 * and goes nowhere by itself; WhatsApp is opened as a link to the supplier's saved number - the ERP holds no WhatsApp
 * account and sends nothing on the person's behalf (`DM-074`). Where the device can share a file (a phone), the PDF itself
 * is offered to WhatsApp; elsewhere the file is saved and WhatsApp opens with the message, for the person to attach it.
 */
const PO_PRINT_CSS = PRINT_CSS.replaceAll('invoice-sheet', 'po-sheet').replaceAll('invoice-totals', 'po-totals');

const ink = '#111111';
const grey = '#6b6b6b';
const rule = '#d9d9d9';

export default function PurchaseOrderPrintPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sheet = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchPurchaseOrder(id).then(setDetail).catch((cause) => setError(messageOf(cause, 'The purchase order could not be loaded.')));
  }, [id]);

  if (error) return <Card><EmptyState title="Purchase order not available" guidance={error} /></Card>;
  if (!detail) return <Card><EmptyState title="Loading…" guidance="Preparing the purchase order." /></Card>;

  const { order: o, items, supplier } = detail;
  const approvedEntry = [...detail.history].reverse().find((h) => h.action === 'APPROVED');
  const fileName = `${o.poNumber}.pdf`;
  const phone = whatsAppNumber(supplier.phone);
  const message = `Purchase order ${o.poNumber} from Trioloo Technology\n${items.length} line${items.length === 1 ? '' : 's'}, total ৳ ${displayMoney(o.total)}`
    + `${o.expectedDate ? `\nExpected by ${o.expectedDate}` : ''}\nThe PDF is attached.`;

  const makePdf = async (): Promise<Blob> => {
    if (!sheet.current) throw new Error('The sheet is not ready.');
    return sheetToPdf(sheet.current);
  };

  const download = async (): Promise<void> => {
    setBusy('pdf');
    setNotice(null);
    try {
      downloadBlob(await makePdf(), fileName);
      setNotice(`${fileName} is saved to your downloads.`);
    } catch (cause) {
      setNotice(messageOf(cause, 'The PDF could not be made.'));
    } finally {
      setBusy(null);
    }
  };

  const share = async (): Promise<void> => {
    setBusy('share');
    setNotice(null);
    try {
      const blob = await makePdf();
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: message, title: o.poNumber });
        return;
      }
      downloadBlob(blob, fileName);
      window.open(`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      setNotice(phone
        ? `${fileName} is saved. WhatsApp opened for ${supplier.name} - attach the saved file to the message.`
        : `${fileName} is saved. This supplier has no phone number, so choose the contact in WhatsApp and attach the file.`);
    } catch (cause) {
      if ((cause as { name?: string }).name !== 'AbortError') setNotice(messageOf(cause, 'It could not be shared.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <style>{PO_PRINT_CSS}</style>
      <PageHeader
        title={`Purchase order ${o.poNumber}`}
        subtitle={`${o.supplierName} · ${STATUS_LABEL[o.status] ?? o.status}`}
        breadcrumb={<><span>Inventory</span><span>/</span><span>Purchasing</span><span>/</span><span style={{ fontWeight: 600 }}>{o.poNumber}</span></>}
        actions={
          <>
            <Button variant="secondary" size="page-header" onClick={() => navigate(`/purchasing/purchases/${o.id}`)} testId="po-print-back">Back to order</Button>
            <Button variant="secondary" size="page-header" onClick={() => void share()} disabled={busy !== null} testId="po-share-whatsapp">{busy === 'share' ? 'Preparing…' : 'Share on WhatsApp'}</Button>
            <Button variant="secondary" size="page-header" onClick={() => void download()} disabled={busy !== null} testId="po-download-pdf">{busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}</Button>
            <Button variant="primary" size="page-header" onClick={() => window.print()} testId="po-print">Print</Button>
          </>
        }
      />
      <div className="invoice-no-print" style={{ marginBottom: '12px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
        {notice ? <span data-testid="po-print-notice" role="status" style={{ fontWeight: 600 }}>{notice}</span>
          : phone ? `WhatsApp goes to ${supplier.name} on ${supplier.phone}.` : 'This supplier has no phone number saved - add one under Suppliers to send straight to them.'}
      </div>

      <div className="invoice-page" style={{ display: 'flex', justifyContent: 'center' }}>
        <article ref={sheet} data-testid="po-sheet"
          style={{ width: '794px', minHeight: '1123px', boxSizing: 'border-box', padding: '48px', background: '#ffffff', color: ink, fontFamily: "'Hanken Grotesk', system-ui, sans-serif", fontSize: '13px', lineHeight: 1.45, boxShadow: '0 1px 8px oklch(0 0 0 / 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
            <div>
              <img src={logoUrl} alt="Trioloo" style={{ height: '50px', width: 'auto', display: 'block' }} />
              <div style={{ marginTop: '10px', fontSize: '12px', color: grey }}>
                R.B Tower 4th Floor (Lift-3), 56/9, Panthapath, Dhaka-1205, Bangladesh<br />
                01963-956474 · trioloobd@gmail.com · contract@trioloo.com.bd
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>PURCHASE ORDER</div>
              <div data-testid="po-sheet-number" style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>{o.poNumber}</div>
              <div style={{ fontSize: '12px', color: grey, marginTop: '2px' }}>{STATUS_LABEL[o.status] ?? o.status}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', margin: '30px 0 24px', paddingTop: '18px', borderTop: `1px solid ${rule}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.06em', color: grey }}>SUPPLIER</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{supplier.name}</div>
              <div style={{ color: grey, marginTop: '2px' }}>
                {[supplier.contactName, supplier.phone].filter(Boolean).join(' · ')}
                {supplier.email ? <><br />{supplier.email}</> : null}
                {supplier.address ? <><br />{supplier.address}</> : null}
              </div>
            </div>
            <div style={{ width: '250px' }}>
              {([['Order date', o.orderDate], ['Expected delivery', o.expectedDate ?? '—'], ['Supplier reference', o.supplierOrderReference ?? '—'], ['Currency', 'BDT (taka)']] as const).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
                  <span style={{ color: grey }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: ink, color: '#ffffff' }}>
                {['#', 'SKU', 'Product', 'Qty', 'Unit cost (৳)', 'Total (৳)'].map((h, i) => (
                  <th key={h} style={{ padding: '9px 10px', fontSize: '11px', fontWeight: 600, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderBottom: `1px solid ${rule}` }}>
                  <td style={{ padding: '9px 10px', color: grey }}>{i.lineNumber}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: '11.5px' }}>{i.sku}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>{i.name}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>{displayQuantity(i.quantityOrdered)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>{displayMoney(i.unitCost)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600 }}>{displayMoney(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div data-testid="po-totals" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
            <div style={{ width: '280px', background: ink, color: '#ffffff', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>Order total</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>৳ {displayMoney(o.total)}</span>
            </div>
          </div>

          <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', gap: '24px', fontSize: '12px', color: grey }}>
            <div>
              Prepared by <strong style={{ color: ink }}>{o.createdBy ?? '—'}</strong><br />
              {approvedEntry ? <>Approved by <strong style={{ color: ink }}>{approvedEntry.actedBy ?? '—'}</strong> on {new Date(approvedEntry.actedAt).toLocaleDateString()}</> : 'Not yet approved'}
            </div>
            <div style={{ textAlign: 'right' }}>www.trioloo.com.bd &nbsp;·&nbsp; www.zeontechbd.com</div>
          </div>
        </article>
      </div>
    </>
  );
}
