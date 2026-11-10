// /api/children and /api/children/[id] — Parent-owned child profiles.
// Creation and health data live in ./parent.js (createChild, child health).
import { readObject } from "./http.js";
import { databaseData, reject } from "./errors.js";
import { requireParent } from "./parent.js";
import { isoDate, oneOf, rpc, text, todayJakarta, invalid, uuid } from "./validate.js";

const COLUMNS = "child_id, full_name, birth_date, gender, general_notes, status, created_at, updated_at";

export async function listChildren(context) {
  await requireParent(context);
  const rows = databaseData(await context.supabase.from("children").select(COLUMNS)
    .eq("parent_id", context.user.id).is("deleted_at", null).order("created_at", { ascending: false }));
  return rows || [];
}

export async function getChild(context, id) {
  uuid(id, "child_id", "ID anak");
  await requireParent(context);
  const child = databaseData(await context.supabase.from("children").select(COLUMNS)
    .eq("child_id", id).eq("parent_id", context.user.id).is("deleted_at", null).maybeSingle());
  if (!child) reject("child_not_owned");
  return child;
}

export async function updateChild(context, request, id) {
  uuid(id, "child_id", "ID anak");
  const body = await readObject(request, ["full_name", "birth_date", "gender", "general_notes"]);
  const fullName = text(body.full_name, "child_name", { min: 2, max: 80, label: "Nama anak" });
  const birthDate = isoDate(body.birth_date, "child_birth_date", "Tanggal lahir");
  if (birthDate > todayJakarta()) invalid("child_birth_date", "Tanggal lahir tidak boleh di masa depan.");
  const gender = body.gender == null ? null : oneOf(body.gender, "gender", ["female", "male"], "Jenis kelamin");
  const notes = text(body.general_notes, "general_notes", { max: 2000, label: "Catatan umum", optional: true });
  await rpc(context, "app_parent_update_child", {
    p_child_id: id, p_full_name: fullName, p_birth_date: birthDate, p_gender: gender, p_general_notes: notes,
  });
  return getChild(context, id);
}

// Soft delete; refused once the child has any enrollment history.
export async function archiveChild(context, id) {
  uuid(id, "child_id", "ID anak");
  await rpc(context, "app_parent_archive_child", { p_child_id: id });
  return { child_id: id, archived: true };
}
