export const emptyAdmin = { enabled: false, verifications: [], responses: [], daycareStates: [], incidentStates: [], audit: [] };
export const examplePermits = [
  { id: "permit-example-mentari", daycareId: "mentari-pagi", number: "DEMO-IZIN-002", issuer: "Lembaga Penerbit Contoh", expires: "2028-08-15", filename: "izin-mentari-contoh.pdf", createdAt: "2026-10-26T08:00:00+07:00", example: true },
  { id: "permit-example-kuncup", daycareId: "kuncup-harapan", number: "DEMO-IZIN-003", issuer: "Lembaga Penerbit Contoh", expires: "2028-12-31", filename: "izin-kuncup-contoh.pdf", createdAt: "2026-10-27T08:00:00+07:00", example: true },
];
export const exampleIncidents = [
  { id: "incident-example-critical", daycareId: "kasih-bunda", childName: "Anak Contoh A", urgency: "critical", description: "Skenario latihan: orang tua melaporkan anak terjatuh saat bermain dan meminta konfirmasi kondisi serta tindak lanjut pengelola.", status: "local", anonymous: false, createdAt: "2026-10-28T09:00:00+07:00", example: true },
  { id: "incident-example-high", daycareId: "mentari-pagi", childName: "Anak Contoh B", urgency: "high", description: "Skenario latihan: pintu akses area bermain dilaporkan tidak tertutup dengan baik. Orang tua meminta pemeriksaan fasilitas.", status: "local", anonymous: true, createdAt: "2026-10-28T08:00:00+07:00", example: true },
  { id: "incident-example-medium", daycareId: "bumi-bermain", childName: "Anak Contoh C", urgency: "medium", description: "Skenario latihan: perubahan jadwal penjemputan belum diterima keluarga. Diperlukan klarifikasi prosedur komunikasi.", status: "local", anonymous: false, createdAt: "2026-10-27T08:00:00+07:00", example: true },
];
export function normalizeAdmin(value) {
  const object = v => v && typeof v === "object" && !Array.isArray(v); const text = v => typeof v === "string"; const dated = v => text(v) && Number.isFinite(Date.parse(v));
  if (!object(value)) return emptyAdmin;
  const list = (key, check) => Array.isArray(value[key]) ? value[key].filter(v => object(v) && check(v)).slice(0, 200) : [];
  return {
    enabled: value.enabled === true,
    verifications: list("verifications", v => text(v.documentId) && text(v.daycareId) && ["approved", "revision", "rejected"].includes(v.decision) && text(v.note) && object(v.fields) && ["number", "name", "address", "issuer", "expires"].every(k => text(v.fields[k])) && dated(v.createdAt)),
    responses: list("responses", v => text(v.incidentId) && text(v.text) && ["reviewing", "closed"].includes(v.status) && dated(v.createdAt)),
    daycareStates: list("daycareStates", v => text(v.daycareId) && ["active", "restricted"].includes(v.status) && text(v.note) && dated(v.createdAt)),
    incidentStates: list("incidentStates", v => text(v.incidentId) && ["reviewing", "closed"].includes(v.status)),
    audit: list("audit", v => text(v.id) && text(v.action) && text(v.target) && text(v.note) && dated(v.createdAt)),
  };
}
