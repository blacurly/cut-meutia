// Safety Score reviewed by Admin (migration 20261118100000). The database
// checks the evidence and computes the score; these handlers validate the
// request first so obvious mistakes never reach it.
import { readObject } from "./http.js";
import { reject } from "./errors.js";
import { boolean, invalid, oneOf, rpc, requestId, text, uuid } from "./validate.js";
import { SAFETY_CRITERIA, SAFETY_STATUSES } from "../safety-score.js";

const CRITERION_IDS = SAFETY_CRITERIA.map(criterion => criterion.id);
const STATUS_VALUES = SAFETY_STATUSES.map(status => status.value);
const MAX_EVIDENCE = 10;

const daycareId = async route => uuid((await route.params)?.id, "id", "ID daycare");

// GET /api/admin/daycares/{id}/safety-score
export async function getSafetyReview(context, _request, route) {
  return rpc(context, "app_admin_get_safety_review", { p_daycare_id: await daycareId(route) });
}

function readCriteria(value) {
  if (!Array.isArray(value) || value.length !== CRITERION_IDS.length) invalid("criteria", "Isi keempat komponen Safety Score.");
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) invalid("criteria", "Komponen Safety Score tidak valid.");
    const id = oneOf(item.id, "criteria", CRITERION_IDS, "Komponen");
    if (seen.has(id)) invalid("criteria", "Setiap komponen hanya boleh muncul sekali.");
    seen.add(id);
    const status = oneOf(item.status, "criteria", STATUS_VALUES, "Status");
    const reason = text(item.reason, "reason", { min: 5, max: 500, label: "Alasan" });
    const ids = item.document_ids ?? [];
    if (!Array.isArray(ids) || ids.length > MAX_EVIDENCE) invalid("document_ids", `Pilih paling banyak ${MAX_EVIDENCE} dokumen bukti per komponen.`);
    const documentIds = [...new Set(ids.map(documentId => uuid(documentId, "document_ids", "ID dokumen")))];
    if (["pass", "partial"].includes(status) && documentIds.length === 0) reject("invalid_safety_evidence");
    return { id, status, reason, document_ids: documentIds };
  });
}

// POST /api/admin/daycares/{id}/safety-score  { criteria: [...4], publish }
export async function saveSafetyScore(context, request, route) {
  const id = await daycareId(route);
  const body = await readObject(request, ["criteria", "publish"]);
  const publish = boolean(body.publish, "publish", "Publikasi");
  const criteria = readCriteria(body.criteria);
  if (criteria.some(item => item.status === "unknown")) reject("safety_score_incomplete");
  if (publish && criteria.find(item => item.id === "legal").status !== "pass") reject("safety_score_publication_blocked");
  return rpc(context, "app_admin_save_safety_score", {
    p_daycare_id: id, p_criteria: criteria, p_publish: publish, p_request_id: requestId(request),
  });
}

// DELETE /api/admin/daycares/{id}/safety-score  { reason }
export async function withdrawSafetyScore(context, request, route) {
  const id = await daycareId(route);
  const body = await readObject(request, ["reason"]);
  return rpc(context, "app_admin_withdraw_safety_score", {
    p_daycare_id: id, p_reason: text(body.reason, "reason", { min: 5, max: 500, label: "Alasan" }),
    p_request_id: requestId(request),
  });
}

// Published score for the public daycare page; null when there is none or
// the database has not been migrated yet (the page then shows "Belum dinilai").
export async function publicSafetyScore(supabase, id) {
  try {
    const { data, error } = await supabase.rpc("app_get_public_safety_score", { p_daycare_id: id });
    if (error) throw error;
    return data ?? null;
  } catch (error) {
    console.warn("Safety Score tidak dapat dimuat", error?.message ?? error);
    return null;
  }
}
