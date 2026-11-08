import { daycares, facilities, regions } from "../data/daycares.js";
import { emptyCaregiver, normalizeCaregiver } from "../data/caregiver.js";
import { emptyAdmin, normalizeAdmin } from "../data/admin.js";

export const defaultFilters = { q: "", province: "", city: "", district: "", price: 5000000, score: 0, ratio: "", verified: false, facilities: [], sort: "score" };
export const statusLabels = { pending: "Menunggu verifikasi", approved: "Disetujui", active: "Sedang titip", rejected: "Ditolak", cancelled: "Dibatalkan" };
export const urgencyLabels = { low: "Rendah", medium: "Sedang", high: "Tinggi", critical: "Darurat" };
export const emptyDemo = { version: 1, member: false, profile: { name: "Orang Tua Demo", email: "", phone: "" }, compare: [], children: [], selectedChild: "", enrollments: [], incidents: [], notifications: [], reviews: [], reactions: {}, comments: {}, location: { province: "", city: "", district: "" }, caregiver: emptyCaregiver, admin: emptyAdmin };
export const getDaycare = (id) => daycares.find((daycare) => daycare.id === id);
export const rupiah = (amount) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
export const todayISO = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
export function dateLabel(value) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)); }

export function parseFilters(source = {}) {
  const get = (key) => { const value = source instanceof URLSearchParams ? source.get(key) : source[key]; return typeof value === "string" ? value : ""; };
  const bound = (key, min, max, fallback) => { const raw = get(key); return raw && Number.isFinite(Number(raw)) ? Math.min(max, Math.max(min, Number(raw))) : fallback; };
  const province = Object.hasOwn(regions, get("province")) ? get("province") : "";
  const city = province && Object.hasOwn(regions[province], get("city")) ? get("city") : "";
  const district = city && regions[province][city].includes(get("district")) ? get("district") : "";
  return { q: get("q").slice(0, 100), province, city, district, price: bound("price", 500000, 5000000, 5000000), score: bound("score", 0, 100, 0), ratio: ["3", "4", "6"].includes(get("ratio")) ? get("ratio") : "", verified: get("verified") === "true", facilities: [...new Set(get("facilities").split(",").filter(key => Object.hasOwn(facilities, key)))], sort: ["score", "price", "distance", "rating"].includes(get("sort")) ? get("sort") : "score" };
}
export function filterQuery(filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key === "facilities") { if (value.length) query.set(key, value.join(",")); }
    else if (String(value) !== String(defaultFilters[key])) query.set(key, String(value));
  }
  return query.toString();
}
export function filterDaycares(filters, source = daycares) {
  const result = source.filter(d => (!filters.q || `${d.name} ${d.address} ${d.city}`.toLocaleLowerCase("id").includes(filters.q.trim().toLocaleLowerCase("id"))) && (!filters.province || d.province === filters.province) && (!filters.city || d.city === filters.city) && (!filters.district || d.district === filters.district) && (d.price == null ? filters.price === defaultFilters.price : d.price <= filters.price) && (d.score == null ? filters.score === 0 : d.score >= filters.score) && (!filters.ratio || d.ratio === Number(filters.ratio)) && (!filters.verified || d.verified) && filters.facilities.every(f => d.facilities.includes(f)));
  const sorters = { score: (a, b) => b.score - a.score, price: (a, b) => a.price - b.price, distance: (a, b) => a.distance - b.distance, rating: (a, b) => b.rating - a.rating };
  return result.sort(sorters[filters.sort] || sorters.score);
}
export function decodeDemo(raw) {
  try {
    const parsed = JSON.parse(raw);
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    const text = value => typeof value === "string";
    if (parsed?.version !== 1 || typeof parsed.member !== "boolean" || !["compare", "children", "enrollments", "incidents", "notifications", "reviews"].every(key => Array.isArray(parsed[key])) || !object(parsed.profile) || !["name", "email", "phone"].every(key => text(parsed.profile[key])) || !object(parsed.location) || !["province", "city", "district"].every(key => text(parsed.location[key])) || !object(parsed.reactions) || !object(parsed.comments)) return emptyDemo;
    if (!parsed.children.every(c => object(c) && text(c.id) && text(c.name) && validISODate(c.dob))) return emptyDemo;
    if (!parsed.enrollments.every(e => object(e) && text(e.id) && parsed.children.some(c => c.id === e.childId) && getDaycare(e.daycareId) && Object.hasOwn(statusLabels, e.status) && validISODate(e.startDate) && Number.isFinite(Date.parse(e.createdAt)))) return emptyDemo;
    if (!parsed.notifications.every(n => object(n) && text(n.id) && text(n.title) && text(n.href) && n.href.startsWith("/") && !n.href.startsWith("//") && Number.isFinite(Date.parse(n.createdAt)))) return emptyDemo;
    if (!parsed.incidents.every(r => object(r) && text(r.id) && text(r.description) && getDaycare(r.daycareId) && Object.hasOwn(urgencyLabels, r.urgency) && Number.isFinite(Date.parse(r.createdAt)))) return emptyDemo;
    if (!parsed.reviews.every(r => object(r) && text(r.id) && text(r.text) && getDaycare(r.daycareId) && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5)) return emptyDemo;
    if (!Object.values(parsed.reactions).every(v => Array.isArray(v) && v.every(item => ["heart", "like"].includes(item))) || !Object.values(parsed.comments).every(v => Array.isArray(v) && v.every(c => object(c) && text(c.id) && text(c.text)))) return emptyDemo;
    const location = parseFilters(parsed.location);
    return { ...emptyDemo, ...parsed, caregiver: normalizeCaregiver(parsed.caregiver), admin: normalizeAdmin(parsed.admin), location: { province: location.province, city: location.city, district: location.district }, compare: [...new Set(parsed.compare.filter(id => getDaycare(id)))].slice(0, 3) };
  } catch { return emptyDemo; }
}
export function validISODate(value) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function availableSlots(daycare, state) { return Math.max(0, daycare.slots - state.enrollments.filter(e => e.daycareId === daycare.id && ["approved", "active"].includes(e.status)).length); }
export function toggleCompare(state, id) {
  if (!getDaycare(id)) throw new Error("Daycare tidak tersedia.");
  if (state.compare.includes(id)) return { ...state, compare: state.compare.filter(value => value !== id) };
  if (state.compare.length >= 3) throw new Error("Maksimal 3 daycare. Hapus satu pilihan terlebih dahulu.");
  return { ...state, compare: [...state.compare, id] };
}
export function activeEnrollments(state) { return state.enrollments.filter(e => e.status === "active"); }
export function ageMonths(dob, today = todayISO()) { const birth = new Date(`${dob}T00:00:00Z`), now = new Date(`${today}T00:00:00Z`); return (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth() - (now.getUTCDate() < birth.getUTCDate() ? 1 : 0); }
export function validateChild(child, today = todayISO()) {
  const errors = {}; if (!child.name?.trim() || child.name.trim().length < 2) errors.childName = "Isi nama anak, minimal 2 karakter.";
  const months = ageMonths(child.dob, today); if (!validISODate(child.dob) || !Number.isFinite(months) || months < 6 || months > 72) errors.dob = "Usia pada demo ini harus 6 bulan sampai 6 tahun, dengan tanggal lahir yang valid.";
  return errors;
}
export function validateEnrollment(form, state, today = todayISO()) {
  const errors = {}; const daycare = getDaycare(form.daycareId);
  if (!daycare) errors.daycareId = "Pilih daycare yang tersedia.";
  else if (!daycare.verified || availableSlots(daycare, state) < 1) errors.daycareId = "Daycare belum terverifikasi atau slot contoh sudah penuh.";
  const child = form.childId ? state.children.find(c => c.id === form.childId) : { name: form.childName, dob: form.dob };
  if (!child) errors.childId = "Pilih anak yang tersedia."; else Object.assign(errors, validateChild(child, today));
  if (form.childId && state.enrollments.some(e => e.childId === form.childId && e.daycareId === form.daycareId && ["pending", "approved", "active"].includes(e.status))) errors.childId = "Anak ini sudah memiliki pengajuan di daycare yang sama.";
  if (!daycare?.packages.some(p => p.id === form.packageId)) errors.packageId = "Pilih paket layanan.";
  if (!validISODate(form.startDate) || form.startDate < today) errors.startDate = "Pilih tanggal mulai yang valid, tidak sebelum hari ini.";
  if (form.consent !== true) errors.consent = "Konfirmasi bahwa Anda menggunakan data contoh pada demo.";
  return errors;
}
export function addNotification(state, title, href, urgent = false) {
  return { ...state, notifications: [{ id: crypto.randomUUID(), title, href, urgent, read: false, createdAt: new Date().toISOString() }, ...state.notifications].slice(0, 100) };
}
export function createEnrollment(state, form, today = todayISO()) {
  if (!state.member) throw new Error("Aktifkan mode demo Orang Tua terlebih dahulu.");
  const errors = validateEnrollment(form, state, today); if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const child = form.childId ? state.children.find(c => c.id === form.childId) : { id: crypto.randomUUID(), name: form.childName.trim(), dob: form.dob };
  const existing = state.children.find(c => c.name.toLowerCase() === child.name.toLowerCase() && c.dob === child.dob);
  const childId = existing?.id || child.id;
  if (state.enrollments.some(e => e.childId === childId && e.daycareId === form.daycareId && ["pending", "approved", "active"].includes(e.status))) throw new Error("Pengajuan yang sama sudah tersedia.");
  const enrollment = { id: crypto.randomUUID(), childId, daycareId: form.daycareId, packageId: form.packageId, startDate: form.startDate, status: "pending", createdAt: new Date().toISOString(), attachmentCount: form.attachmentCount || 0 };
  return addNotification({ ...state, children: existing ? state.children : [...state.children, child], selectedChild: childId, enrollments: [enrollment, ...state.enrollments] }, "Pengajuan demo baru disimpan", "/status-pendaftaran");
}
export function transitionEnrollment(state, id, status) {
  const entry = state.enrollments.find(e => e.id === id); if (!entry) throw new Error("Pengajuan tidak ditemukan.");
  const allowed = { pending: ["approved", "rejected", "cancelled"], approved: ["active", "cancelled"] };
  if (!allowed[entry.status]?.includes(status)) throw new Error("Perubahan status tidak tersedia.");
  if (status === "approved" && availableSlots(getDaycare(entry.daycareId), state) < 1) throw new Error("Slot demo sudah penuh. Pilih daycare lain.");
  if (status === "active" && state.enrollments.some(e => e.childId === entry.childId && e.status === "active")) throw new Error("Anak sudah terhubung ke daycare aktif.");
  return addNotification({ ...state, enrollments: state.enrollments.map(e => e.id === id ? { ...e, status, updatedAt: new Date().toISOString() } : e) }, `Status demo: ${statusLabels[status]}`, "/status-pendaftaran");
}
export function validateAttachments(files, kind = "document") {
  const types = kind === "document" ? ["application/pdf", "image/jpeg", "image/png"] : ["image/jpeg", "image/png", "image/webp", "video/mp4"];
  const max = kind === "document" ? 5 : 10;
  if (files.length > 4) return "Maksimal 4 berkas.";
  if (files.some(f => !types.includes(f.type))) return kind === "document" ? "Gunakan PDF, JPG, atau PNG." : "Gunakan JPG, PNG, WebP, atau MP4.";
  if (files.some(f => f.size > max * 1024 * 1024)) return `Ukuran setiap berkas maksimal ${max} MB.`;
  return "";
}
