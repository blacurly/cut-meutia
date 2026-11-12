import { createHash, randomBytes } from "node:crypto";
import { ApiError, readObject } from "./http.js";
import { rpc, text, integer, requestId } from "./validate.js";

const DAYCARE_FIELDS = [
  "name", "description", "address", "province_code", "city_code", "district_code",
  "postal_code", "timezone", "contact_phone", "facilities", "opening_hours", "daily_capacity",
];

const requiredText = (value, field, label, min, max) => text(value, field, { min, max, label });

function parseDaycare(value) {
  if (!value || Array.isArray(value) || typeof value !== "object"
      || Object.keys(value).some(key => !DAYCARE_FIELDS.includes(key))) {
    throw new ApiError(400, "invalid_partner_fields", "Isian profil daycare tidak valid.");
  }
  const name = requiredText(value.name, "partner_name", "Nama daycare", 2, 200);
  const description = requiredText(value.description, "partner_description", "Deskripsi", 20, 1500);
  const address = requiredText(value.address, "partner_address", "Alamat", 5, 300);
  const provinceCode = requiredText(value.province_code, "province_code", "Kode provinsi", 2, 2);
  if (!/^\d{2}$/.test(provinceCode)) throw new ApiError(400, "invalid_partner_profile", "Kode provinsi harus dua angka.");
  const cityCode = requiredText(value.city_code, "city_code", "Kode kota", 2, 20);
  const districtCode = requiredText(value.district_code, "district_code", "Kode kecamatan", 2, 20);
  const postalCode = text(value.postal_code, "postal_code", { max: 5, label: "Kode pos", optional: true });
  if (postalCode && !/^\d{5}$/.test(postalCode)) throw new ApiError(400, "invalid_partner_profile", "Kode pos harus lima angka.");
  const timezone = requiredText(value.timezone, "timezone", "Zona waktu", 3, 100);
  const contactPhone = requiredText(value.contact_phone, "contact_phone", "Nomor kontak", 8, 20).replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,16}$/.test(contactPhone)) throw new ApiError(400, "invalid_partner_profile", "Nomor kontak daycare tidak valid.");
  if (!Array.isArray(value.facilities) || value.facilities.length > 50
      || value.facilities.some(item => typeof item !== "string" || item.trim().length > 80)) {
    throw new ApiError(400, "invalid_partner_profile", "Fasilitas daycare tidak valid.");
  }
  if (!value.opening_hours || Array.isArray(value.opening_hours) || typeof value.opening_hours !== "object"
      || Object.keys(value.opening_hours).length > 14
      || JSON.stringify(value.opening_hours).length > 10_000) {
    throw new ApiError(400, "invalid_partner_profile", "Jam operasional daycare tidak valid.");
  }
  return {
    name, description, address, province_code: provinceCode, city_code: cityCode,
    district_code: districtCode, postal_code: postalCode, timezone,
    contact_phone: contactPhone, facilities: value.facilities.map(item => item.trim()),
    opening_hours: value.opening_hours,
    daily_capacity: integer(value.daily_capacity, "daily_capacity", { min: 1, max: 1000, label: "Kapasitas harian" }),
  };
}

export const listPartners = context => rpc(context, "app_admin_list_partners");

export async function createPartner(context, request) {
  const body = await readObject(request, ["daycare", "manager_email"]);
  const daycare = parseDaycare(body.daycare);
  const managerEmail = requiredText(body.manager_email, "manager_email", "Email calon Manager", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
    throw new ApiError(400, "invalid_manager_email", "Email calon Manager tidak valid.");
  }

  // Store only a digest. The raw token is returned once so the Admin can share
  // the invitation link manually while custom SMTP delivery is unavailable.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await rpc(context, "app_admin_create_partner", {
    p_payload: daycare,
    p_manager_email: managerEmail,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
    p_request_id: requestId(request),
  });
  return { ...result, manager_email: managerEmail, invitation_token: token };
}
