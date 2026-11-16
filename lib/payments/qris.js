// QR code for a pending payment (no payment gateway).
//
// With QRIS_STATIC_PAYLOAD set (the merchant's static QRIS string), the
// static code is turned into a dynamic one carrying the exact bill amount:
// tag 01 becomes "12" (dynamic), tag 54 holds the amount, and the CRC (tag 63)
// is recomputed. Any banking/e-wallet app can scan it; the payment still has
// to be confirmed manually by an Admin (PATCH /api/admin/transactions/{id}).
//
// Without it, a clearly marked demo code is produced that no app can pay.
// EMVCo QR layout: ID (2 digits) + length (2 digits) + value, ending with
// "6304" + CRC16-CCITT (poly 0x1021, init 0xFFFF) in uppercase hex.

export class QrisError extends Error {}

export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseTlv(payload) {
  const fields = [];
  let index = 0;
  while (index < payload.length) {
    const id = payload.slice(index, index + 2);
    const length = Number(payload.slice(index + 2, index + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(payload.slice(index + 2, index + 4))) throw new QrisError("QRIS tidak valid: format TLV rusak.");
    const value = payload.slice(index + 4, index + 4 + length);
    if (value.length !== length) throw new QrisError("QRIS tidak valid: panjang data tidak sesuai.");
    fields.push({ id, value });
    index += 4 + length;
  }
  return fields;
}

const serialize = fields => fields.map(({ id, value }) => `${id}${String(value.length).padStart(2, "0")}${value}`).join("");

export function verifyQris(payload) {
  if (typeof payload !== "string" || !payload.startsWith("000201") || payload.length > 512 || !/6304[0-9A-Fa-f]{4}$/.test(payload)) {
    throw new QrisError("QRIS tidak valid: harus diawali 000201 dan diakhiri CRC (6304....).");
  }
  if (crc16(payload.slice(0, -4)) !== payload.slice(-4).toUpperCase()) throw new QrisError("QRIS tidak valid: CRC tidak cocok.");
  const fields = parseTlv(payload);
  const currency = fields.find(field => field.id === "53")?.value;
  if (currency && currency !== "360") throw new QrisError("QRIS harus memakai mata uang Rupiah (360).");
  return fields;
}

// amount: whole Rupiah (bigint/number/string of digits).
export function dynamicQris(staticPayload, amount) {
  const value = String(amount);
  if (!/^[1-9]\d{0,12}$/.test(value)) throw new QrisError("Nominal QRIS harus bilangan bulat Rupiah lebih dari 0.");
  const fields = verifyQris(staticPayload.trim()).filter(field => field.id !== "63" && field.id !== "54");
  const pointOfInitiation = fields.find(field => field.id === "01");
  if (pointOfInitiation) pointOfInitiation.value = "12"; else fields.splice(1, 0, { id: "01", value: "12" });
  fields.push({ id: "54", value });
  fields.sort((a, b) => Number(a.id) - Number(b.id));
  const body = `${serialize(fields)}6304`;
  return body + crc16(body);
}

export function demoPayload({ transactionId, amount, currency = "IDR" }) {
  return `AYOMI-DEMO-BUKAN-PEMBAYARAN|trx:${transactionId}|amount:${amount}|${currency}`;
}

// Returns { mode, payload, image_data_url }. `toDataURL` is injected so the
// QR library is only loaded on the server route that needs it.
export async function paymentQr({ transactionId, amount, currency }, { staticPayload, toDataURL }) {
  const real = typeof staticPayload === "string" && staticPayload.trim() !== "";
  const payload = real ? dynamicQris(staticPayload, amount) : demoPayload({ transactionId, amount, currency });
  const image = await toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 320 });
  return { mode: real ? "qris_dynamic" : "demo", payload, image_data_url: image };
}
