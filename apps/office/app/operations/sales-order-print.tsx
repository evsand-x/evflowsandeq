import Decimal from "decimal.js";
import type { DetailOrder } from "./sales-order-detail";
import { amount } from "./sales-order-types";

/** Only mounted with a server-authorized print action and the company profile. */
export function SalesOrderPrint({ row }: { row: DetailOrder }) {
  return (
    <article className="so-print-document" aria-label="Cetakan Sales Order">
      <header>
        <div>
          <h1>{row.companyProfile?.name}</h1>
          <p>{row.companyProfile?.address}</p>
          {row.companyProfile?.taxId && <p>NPWP {row.companyProfile.taxId}</p>}
        </div>
        <div>
          <h2>Sales Order</h2>
          <strong>{row.number}</strong>
          <p>{new Date(row.orderDate ?? row.createdAt).toLocaleDateString("id-ID")}</p>
          {row.state === "DRAFT" && <strong>Draft</strong>}
        </div>
      </header>
      <section>
        <h3>Kepada</h3>
        <strong>{row.customer?.name}</strong>
        <p>{row.deliveryAddress}</p>
        {row.customerReference && <p>No. SP: {row.customerReference}</p>}
      </section>
      <table>
        <thead>
          <tr>
            <th>Produk</th>
            <th>Jumlah</th>
            <th>Satuan</th>
            <th>Harga</th>
            <th>PPN</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.product.name}</td>
              <td>{amount(l.ordered ?? l.orderedQuantity)}</td>
              <td>{l.Uom?.name ?? l.product.baseUom?.name}</td>
              <td>{amount(l.unitPrice, "IDR")}</td>
              <td>{amount(l.taxAmount, "IDR")}</td>
              <td>
                {l.taxAmount == null
                  ? "Belum tersedia"
                  : amount(new Decimal(l.subtotal).add(l.taxAmount).toString(), "IDR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{amount(row.subtotal, "IDR")}</dd>
        </div>
        <div>
          <dt>PPN</dt>
          <dd>{amount(row.taxAmount, "IDR")}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{amount(row.total, "IDR")}</dd>
        </div>
      </dl>
      {row.notes && <p>Catatan: {row.notes}</p>}
    </article>
  );
}
