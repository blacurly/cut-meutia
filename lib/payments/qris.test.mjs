import test from "node:test";
import assert from "node:assert/strict";
import { crc16, demoPayload, dynamicQris, parseTlv, paymentQr, verifyQris } from "./qris.js";

// Synthetic static QRIS (fictional merchant), built field by field so every
// length is right, with a valid CRC.
const tlv = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;
const body = tlv("00", "01") + tlv("01", "11")
  + tlv("26", tlv("00", "ID.CO.QRIS.WWW") + tlv("01", "936009150000000002") + tlv("02", "ID1020000000000") + tlv("03", "UMI"))
  + tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID2020000000000") + tlv("03", "UMI"))
  + tlv("52", "5812") + tlv("53", "360") + tlv("58", "ID") + tlv("59", "AYOMI DAYCARE")
  + tlv("60", "JAKARTA") + tlv("61", "12345") + tlv("62", tlv("07", "A01")) + "6304";
const STATIC = body + crc16(body);

test("CRC16-CCITT matches the standard check value", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("a static QRIS becomes dynamic with the exact amount and a valid CRC", () => {
  const dynamic = dynamicQris(STATIC, 1750000);
  verifyQris(dynamic);
  const fields = Object.fromEntries(parseTlv(dynamic).map(field => [field.id, field.value]));
  assert.equal(fields["01"], "12");
  assert.equal(fields["54"], "1750000");
  assert.equal(fields["59"], "AYOMI DAYCARE");
  const ids = parseTlv(dynamic).map(field => Number(field.id));
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.ok(dynamic.endsWith(crc16(dynamic.slice(0, -4))));
  // Converting again replaces the amount instead of adding a second one.
  assert.equal(parseTlv(dynamicQris(dynamic, 5000)).filter(field => field.id === "54").length, 1);
});

test("invalid inputs are refused", () => {
  assert.throws(() => dynamicQris(STATIC.slice(0, -1) + "0", 1000), /CRC/);
  assert.throws(() => dynamicQris("hello", 1000), /000201/);
  assert.throws(() => dynamicQris(STATIC, 0), /Nominal/);
  assert.throws(() => dynamicQris(STATIC, "12.5"), /Nominal/);
});

test("paymentQr uses the merchant code when configured, otherwise a marked demo code", async () => {
  const toDataURL = async payload => `data:image/png;base64,${Buffer.from(payload).toString("base64")}`;
  const real = await paymentQr({ transactionId: "t1", amount: 250000, currency: "IDR" }, { staticPayload: STATIC, toDataURL });
  assert.equal(real.mode, "qris_dynamic");
  assert.match(real.image_data_url, /^data:image\/png;base64,/);
  const demo = await paymentQr({ transactionId: "t1", amount: 250000, currency: "IDR" }, { staticPayload: "", toDataURL });
  assert.equal(demo.mode, "demo");
  assert.equal(demo.payload, demoPayload({ transactionId: "t1", amount: 250000, currency: "IDR" }));
  assert.match(demo.payload, /BUKAN-PEMBAYARAN/);
});
