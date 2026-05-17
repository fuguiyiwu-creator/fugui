import { NextResponse } from "next/server";
import crypto from "crypto";

const API_URLS = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  prod: "https://api.myinvois.hasil.gov.my",
};

async function getToken() {
  const clientId = process.env.MYINVOIS_CLIENT_ID;
  const secret = process.env.MYINVOIS_CLIENT_SECRET;
  const env = process.env.MYINVOIS_ENV || "sandbox";
  const r = await fetch(`${API_URLS[env]}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });
  const data = await r.json();
  return { token: data.access_token, env };
}

function buildInvoice(body) {
  const { supplierTin, supplierName, buyerTin, buyerName, lines, invoiceNo, issueDate, currency } = body;
  const lineItems = [];
  let totalNet = 0, totalTax = 0;

  lines.forEach((line, i) => {
    const net = +(line.quantity * line.unitPrice).toFixed(2);
    const tax = +(net * (line.taxRate || 0.08)).toFixed(2);
    totalNet += net;
    totalTax += tax;
    lineItems.push({
      id: { _text: String(i + 1) },
      invoicedQuantity: { _text: String(line.quantity), unitCode: "C62" },
      lineExtensionAmount: { _text: net.toFixed(2), currencyID: currency || "MYR" },
      item: { name: { _text: line.description } },
      price: {
        priceAmount: { _text: line.unitPrice.toFixed(2), currencyID: currency || "MYR" },
      },
      classifiedTaxCategory: {
        id: { _text: "6" },
        percent: { _text: String(line.taxRate || 0.08) },
        taxScheme: { id: { _text: "OTH", schemeID: "UN/ECE 5153", schemeAgencyID: "6" } },
      },
    });
  });

  const totalGross = +(totalNet + totalTax).toFixed(2);

  return {
    invoice: {
      ublVersionID: { _text: "2.1" },
      customizationID: { _text: "1.0" },
      id: { _text: invoiceNo || `SB-${Date.now()}` },
      issueDate: { _text: issueDate || new Date().toISOString().split("T")[0] },
      invoiceTypeCode: { _text: "01", listID: "UN/ECE 1001", listAgencyID: "6" },
      accountingSupplierParty: {
        party: {
          industryClassificationCode: { _text: "00000" },
          partyIdentification: [{
            id: { _text: buyerTin, schemeID: "TIN", schemeAgencyID: "MY-LHDN" },
          }],
          partyName: { name: { _text: buyerName } },
          postalAddress: { country: { identificationCode: { _text: "MY" } } },
        },
      },
      accountingCustomerParty: {
        party: {
          partyIdentification: [{
            id: { _text: supplierTin, schemeID: "TIN", schemeAgencyID: "MY-LHDN" },
          }],
          partyName: { name: { _text: supplierName } },
          postalAddress: { country: { identificationCode: { _text: "MY" } } },
        },
      },
      legalMonetaryTotal: {
        lineExtensionAmount: { _text: totalNet.toFixed(2), currencyID: currency || "MYR" },
        taxExclusiveAmount: { _text: totalNet.toFixed(2), currencyID: currency || "MYR" },
        taxInclusiveAmount: { _text: totalGross.toFixed(2), currencyID: currency || "MYR" },
        payableAmount: { _text: totalGross.toFixed(2), currencyID: currency || "MYR" },
      },
      invoiceLine: lineItems,
    },
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { token, env } = await getToken();

    // 构建发票
    const invoice = buildInvoice(body);
    const docStr = JSON.stringify(invoice);
    const docB64 = Buffer.from(docStr).toString("base64");
    const docHash = crypto.createHash("sha256").update(docStr).digest("hex").toUpperCase();

    const payload = {
      documents: [{
        format: "JSON",
        document: docB64,
        documentHash: docHash,
        codeNumber: body.invoiceNo || `SB-${Date.now()}`,
      }],
    };

    const r = await fetch(`${API_URLS[env]}/api/v1.0/documentsubmissions/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json(
        { error: `提交失败: ${err.substring(0, 500)}` },
        { status: r.status }
      );
    }

    const result = await r.json();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
