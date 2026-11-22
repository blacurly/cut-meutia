"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, Phone, Plus, ShieldCheck, UserRound } from "lucide-react";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { normalizePhone } from "@/lib/auth";
import { ApiRequestError, actionResult, requestApi } from "@/lib/api-client";
import { addChildAction, updateProfileAction } from "@/lib/actions/parent";
import { dateLabel, todayISO, validISODate, validateChild } from "@/lib/parent";
import { useSession } from "@/components/session/SessionProvider";
import { RequireRole } from "@/components/live/ui";
import { EmptyState, LinkButton, PageHeader, Panel } from "./ParentUI";
import p from "./Parent.module.css";

// Parent profile, children, and health data. Reads use GET /api/me and
// /api/children/{id}/health; saving the profile and adding a child use the
// Server Actions in lib/actions/parent.js.
function HealthProfileEditor({ child, onClose }) {
  const [health, setHealth] = useState({ allergies: "", medical_history: "", special_needs: "", medication_notes: "" });
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { health: data } = await requestApi(`/api/children/${child.child_id}/health`);
        if (active && data) {
          setHealth({
            allergies: data.allergies || "",
            medical_history: data.medical_history || "",
            special_needs: data.special_needs || "",
            medication_notes: data.medication_notes || "",
          });
          setVersion(data.version || 1);
        }
      } catch {
        if (active) setError("Data kesehatan belum dapat dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void Promise.resolve().then(load);
    return () => { active = false; };
  }, [child.child_id]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (reason.trim().length > 500) {
      setError("Alasan perubahan maksimal 500 karakter.");
      return;
    }
    setSaving(true);
    try {
      const { version: nextVersion } = await requestApi(`/api/children/${child.child_id}/health`, {
        method: "PATCH", body: { ...health, reason: reason.trim() || null },
      });
      setVersion(Number(nextVersion) || version);
      setNotice("Data kesehatan tersimpan dan riwayat perubahannya tercatat.");
    } catch (error) {
      setError(error instanceof ApiRequestError ? error.message : "Koneksi terputus. Data kesehatan belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["allergies", "Alergi"],
    ["medical_history", "Riwayat kesehatan"],
    ["special_needs", "Kebutuhan khusus"],
    ["medication_notes", "Catatan obat"],
  ];

  return <Panel>
    <div className={p.between}><div><h3 className={p.sectionTitle}>Data kesehatan · {child.full_name}</h3><p className={p.small}>Versi {version} · perubahan dicatat dalam riwayat.</p></div><button type="button" className={p.link} onClick={onClose}>Tutup</button></div>
    {loading ? <p className={p.notice} role="status">Memuat data kesehatan…</p> : <form className={p.form} method="post" onSubmit={save} noValidate>
      {fields.map(([name, label]) => <div className={p.field} key={name}><label htmlFor={`health-${child.child_id}-${name}`}>{label}</label><Input id={`health-${child.child_id}-${name}`} type="textarea" value={health[name]} onChange={(event) => setHealth((value) => ({ ...value, [name]: event.target.value }))} maxLength={4000} /></div>)}
      <div className={p.field}><label htmlFor={`health-${child.child_id}-reason`}>Alasan perubahan (opsional)</label><Input id={`health-${child.child_id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></div>
      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.feedback} role="status">{notice}</p>}
      <button className={p.button} type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan data kesehatan"}</button>
    </form>}
  </Panel>;
}

function AuthenticatedParentProfile({ user }) {
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [children, setChildren] = useState([]);
  const [healthChildId, setHealthChildId] = useState("");
  const [child, setChild] = useState({ name: "", dob: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accessError, setAccessError] = useState("");

  const loadAccount = useCallback(async () => {
    try {
      const { profile: parent, children: rows } = await requestApi("/api/me");
      setError("");
      setAccessError("");
      setProfile(parent);
      setProfileDraft({
        name: parent.full_name || "",
        phone: parent.phone && parent.phone !== "NULL" ? normalizePhone(parent.phone) : "",
      });
      setChildren(rows || []);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 403) setAccessError(error.message);
      else setError(error instanceof ApiRequestError ? error.message : "Koneksi terputus. Data akun belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadAccount); }, [loadAccount]);

  async function saveParentProfile(event) {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");
    const fullName = profileDraft.name.trim();
    const phone = normalizePhone(profileDraft.phone);
    if (fullName.length < 2 || fullName.length > 100) {
      setProfileError("Nama harus terdiri dari 2 sampai 100 karakter.");
      return;
    }
    if (phone && !/^8\d{8,11}$/.test(phone)) {
      setProfileError("Masukkan nomor WhatsApp Indonesia yang valid.");
      return;
    }

    setProfileSaving(true);
    try {
      const { profile: savedProfile } = actionResult(await updateProfileAction({ full_name: fullName, phone: phone || null }));
      setProfile(savedProfile);
      setProfileNotice("Profil berhasil disimpan ke akun Ayomi.");
    } catch (error) {
      setProfileError(error instanceof ApiRequestError ? error.message : "Koneksi terputus. Profil belum dapat disimpan.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function addChild(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (child.name.trim().length < 2 || child.name.trim().length > 80) {
      setError("Nama anak harus terdiri dari 2 sampai 80 karakter.");
      return;
    }
    if (!validISODate(child.dob) || child.dob > todayISO()) {
      setError("Masukkan tanggal lahir yang valid dan tidak berada di masa depan.");
      return;
    }

    setSaving(true);
    try {
      actionResult(await addChildAction({ full_name: child.name.trim(), birth_date: child.dob }));

      setChild({ name: "", dob: "" });
      setNotice("Profil anak berhasil disimpan ke akun Ayomi.");
      await loadAccount();
    } catch (error) {
      setError(error instanceof ApiRequestError ? error.message : "Koneksi terputus. Profil anak belum dapat dipastikan tersimpan; periksa daftar anak sebelum mencoba lagi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={p.notice} role="status">Memuat profil Ayomi…</p>;
  if (accessError) return <p className={p.error} role="alert">{accessError}</p>;

  return <div className={p.stack}>
    <div className={p.notice}>Anda masuk sebagai {profile?.full_name || user.email}. Data anak yang ditambahkan tersimpan di database Ayomi.</div>
    <Panel>
      <h2 className={p.sectionTitle}>Profil Orang Tua</h2>
      <form className={p.form} method="post" onSubmit={saveParentProfile} noValidate>
        <div className={p.field}><label htmlFor="account-parent-name">Nama lengkap</label><Input id="account-parent-name" value={profileDraft.name} onChange={(event) => setProfileDraft((value) => ({ ...value, name: event.target.value }))} maxLength={100} required /></div>
        <div className={p.field}><label htmlFor="account-parent-email">Alamat email</label><Input id="account-parent-email" type="email" value={user.email || ""} readOnly icon={<Mail size={17} />} /></div>
        <div className={p.field}><label htmlFor="account-parent-phone">Nomor WhatsApp (opsional)</label><Input id="account-parent-phone" type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft((value) => ({ ...value, phone: event.target.value }))} prefix="+62" icon={<Phone size={17} />} maxLength={24} /></div>
        {profileError && <p className={p.error} role="alert">{profileError}</p>}
        {profileNotice && <p className={p.feedback} role="status">{profileNotice}</p>}
        <button className={p.button} type="submit" disabled={profileSaving}>{profileSaving ? "Menyimpan…" : "Simpan profil"}</button>
      </form>
    </Panel>
    <div className={p.twoColumns}>
      <Panel>
        <h2 className={p.sectionTitle}>Anak saya ({children.length})</h2>
        {children.length ? <div className={p.stack} style={{ marginTop: 16 }}>
          {children.map((item) => <div className={p.stack} key={item.child_id}>
            <div className={p.childCard}>
              <span className={p.avatar}>{item.full_name.slice(0, 1)}</span>
              <div style={{ flex: 1 }}><strong>{item.full_name}</strong><p className={p.small}>Lahir {dateLabel(item.birth_date)}</p></div>
              <button type="button" className={p.link} aria-expanded={healthChildId === item.child_id} onClick={() => setHealthChildId((current) => current === item.child_id ? "" : item.child_id)}>{healthChildId === item.child_id ? "Tutup kesehatan" : "Data kesehatan"}</button>
            </div>
            {healthChildId === item.child_id && <HealthProfileEditor child={item} onClose={() => setHealthChildId("")} />}
          </div>)}
        </div> : <p className={p.muted} style={{ marginTop: 12 }}>Belum ada profil anak di akun ini.</p>}
      </Panel>
      <Panel>
        <h2 className={p.sectionTitle}>Tambahkan anak</h2>
        <form className={p.form} method="post" onSubmit={addChild} noValidate>
          <div className={p.field}><label htmlFor="account-child-name">Nama anak</label><Input id="account-child-name" value={child.name} onChange={(event) => setChild((value) => ({ ...value, name: event.target.value }))} maxLength={80} required /></div>
          <div className={p.field}><label htmlFor="account-child-birth-date">Tanggal lahir</label><Input id="account-child-birth-date" type="date" max={todayISO()} value={child.dob} onChange={(event) => setChild((value) => ({ ...value, dob: event.target.value }))} required /></div>
          {error && <p className={p.error} role="alert">{error}</p>}
          {notice && <p className={p.feedback} role="status">{notice}</p>}
          <button className={p.button} type="submit" disabled={saving}>{saving ? "Menyimpan…" : <><Plus size={16} />Simpan profil anak</>}</button>
        </form>
      </Panel>
    </div>
  </div>;
}


function ProfileForSession() {
  const session = useSession();
  return <AuthenticatedParentProfile key={session.user.id} user={session.user} />;
}

export function ParentProfile() {
  return <div className={p.page}>
    <PageHeader eyebrow="AKUN & KELUARGA" title="Ruang kecil untuk keluarga Anda." description="Kelola profil Anda, data anak, dan informasi kesehatannya." />
    <RequireRole roles={["parent"]}><ProfileForSession /></RequireRole>
  </div>;
}
