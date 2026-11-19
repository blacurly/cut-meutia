export const emptyAdmin = { enabled: false, verifications: [], responses: [], daycareStates: [], incidentStates: [], audit: [] };
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
