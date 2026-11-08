"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Mail, Phone, Plus, ShieldCheck, UserRound } from "lucide-react";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/ui/StarRating";
import { normalizePhone } from "@/lib/auth";
import { ApiRequestError, requestApi } from "@/lib/api-client";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { activeEnrollments, dateLabel, emptyDemo, getDaycare, todayISO, validISODate, validateChild } from "@/lib/parent";
import { useParentDemo } from "./ParentDemoProvider";
import { DemoGate, EmptyState, LinkButton, PageHeader, Panel } from "./ParentUI";
import p from "./Parent.module.css";

function Profile() {
  const { state, update } = useParentDemo(); const router = useRouter(); const [profile, setProfile] = useState(state.profile); const [child, setChild] = useState({ name: "", dob: "" }); const [errors, setErrors] = useState({}); const [notice, setNotice] = useState(""); const [childError, setChildError] = useState(""); const [reset, setReset] = useState(false); const close = useCallback(() => setReset(false), []);
  function save(event) { event.preventDefault(); const next = {}; if (profile.name.trim().length < 2) next.name = "Isi nama, minimal 2 karakter."; if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) next.email = "Masukkan alamat email yang valid."; if (profile.phone && !/^8\d{8,11}$/.test(normalizePhone(profile.phone))) next.phone = "Masukkan nomor WhatsApp Indonesia yang valid."; setErrors(next); if (Object.keys(next).length) { event.currentTarget.elements.namedItem(Object.keys(next)[0])?.focus(); return; } const cleaned = { name: profile.name.trim(), email: profile.email.trim(), phone: normalizePhone(profile.phone) }; update(s => ({ ...s, profile: cleaned })); setProfile(cleaned); setNotice("Profil demo disimpan di browser ini."); }
  function addChild(event) { event.preventDefault(); const invalid = validateChild(child); if (Object.keys(invalid).length) { setChildError(Object.values(invalid)[0]); return; } if (state.children.some(c => c.name.toLowerCase() === child.name.trim().toLowerCase() && c.dob === child.dob)) { setChildError("Profil anak dengan nama dan tanggal lahir tersebut sudah tersedia."); return; } const newChild = { id: crypto.randomUUID(), name: child.name.trim(), dob: child.dob }; update(s => ({ ...s, children: [...s.children, newChild], selectedChild: newChild.id })); setChild({ name: "", dob: "" }); setChildError(""); }
  return <div className={p.stack}><div className={p.notice}>Gunakan identitas contoh. Informasi di halaman ini hanya disimpan di browser dan bukan akun Ayomi sungguhan.</div><div className={p.twoColumns}><Panel><h2 className={p.sectionTitle}>Profil Orang Tua</h2><form className={p.form} method="post" onSubmit={save} noValidate>{[["name", "Nama lengkap", UserRound, "text"], ["email", "Email contoh (opsional)", Mail, "email"], ["phone", "WhatsApp contoh (opsional)", Phone, "tel"]].map(([name, label, Icon, type]) => <div className={p.field} key={name}><label htmlFor={`profile-${name}`}>{label}</label><Input id={`profile-${name}`} name={name} type={type} value={profile[name]} onChange={e => { setProfile(v => ({ ...v, [name]: e.target.value })); setNotice(""); }} error={errors[name]} icon={<Icon size={17} />} prefix={name === "phone" ? "+62" : undefined} maxLength={name === "email" ? 254 : name === "phone" ? 24 : 80} required={name === "name"} /></div>)}{notice && <p className={p.feedback} role="status">{notice}</p>}<button className={p.button} type="submit">Simpan profil demo</button></form></Panel><Panel><h2 className={p.sectionTitle}>Pengaturan demo</h2><p className={p.muted}>Status, komentar, laporan, dan profil hanya tersedia di browser ini. Anda dapat menghapus semuanya untuk mengulang alur dari awal.</p><div className={p.stack} style={{ marginTop: 20, gap: 10 }}><LinkButton secondary href="/status-pendaftaran">Status pendaftaran</LinkButton><LinkButton secondary href="/notifikasi">Notifikasi</LinkButton><button className={`${p.button} ${p.danger}`} onClick={() => setReset(true)}>Hapus semua data demo</button></div></Panel></div><section id="anak" className={p.section}><h2 className={p.sectionTitle}>Anak saya ({state.children.length})</h2><div className={p.twoColumns}><div className={p.stack}>{state.children.length ? state.children.map(c => { const linked = state.enrollments.some(e => e.childId === c.id); const active = activeEnrollments(state).find(e => e.childId === c.id); return <Panel key={c.id}><div className={p.childCard} style={{ border: 0, padding: 0 }}><span className={p.avatar}>{c.name.slice(0, 1)}</span><div><h3 style={{ fontWeight: 700 }}>{c.name}</h3><p className={p.small}>Lahir {dateLabel(c.dob)}</p><p className={p.small}>{active ? getDaycare(active.daycareId)?.name : "Belum ada pengasuhan aktif"}</p></div></div><div className={p.row} style={{ marginTop: 15 }}><button className={`${p.button} ${p.secondary}`} aria-pressed={state.selectedChild === c.id} onClick={() => update(s => ({ ...s, selectedChild: c.id }))}>{state.selectedChild === c.id ? "Anak dipilih" : "Pilih anak"}</button><button className={p.link} disabled={linked} title={linked ? "Profil digunakan dalam riwayat pendaftaran" : "Hapus profil anak yang belum memiliki pengajuan"} onClick={() => update(s => ({ ...s, children: s.children.filter(v => v.id !== c.id), selectedChild: s.selectedChild === c.id ? "" : s.selectedChild }))}>Hapus</button></div>{linked && <p className={p.small} style={{ marginTop: 8 }}>Profil disimpan bersama riwayat pendaftaran. Gunakan reset demo untuk menghapus seluruh riwayat.</p>}</Panel>; }) : <EmptyState title="Belum ada profil anak" description="Tambahkan profil contoh di formulir atau saat melakukan pendaftaran daycare."><span className={p.small}>Data anak hanya tersimpan lokal.</span></EmptyState>}</div><Panel><h3 className={p.sectionTitle}>Tambahkan anak contoh</h3><form className={p.form} method="post" onSubmit={addChild} noValidate><div className={p.field}><label htmlFor="new-child-name">Nama anak</label><Input id="new-child-name" value={child.name} onChange={e => setChild(v => ({ ...v, name: e.target.value }))} placeholder="Contoh: Arka Pratama" maxLength={80} required /></div><div className={p.field}><label htmlFor="new-child-dob">Tanggal lahir</label><Input id="new-child-dob" type="date" max={todayISO()} value={child.dob} onChange={e => setChild(v => ({ ...v, dob: e.target.value }))} required /><p className={p.small}>Usia contoh yang didukung: 6 bulan–6 tahun.</p></div>{childError && <p role="alert" className={p.error}>{childError}</p>}<button type="submit" className={p.button}><Plus size={16} />Tambahkan anak</button></form></Panel></div></section><Modal open={reset} onClose={close} title="Hapus semua data demo?" size="sm"><p className={p.muted}>Profil, anak, pilihan komparasi, pengajuan, laporan, komentar, ulasan, dan notifikasi demo pada browser ini akan dihapus. Tindakan ini tidak memengaruhi akun nyata.</p><div className={p.row} style={{ marginTop: 20 }}><button className={`${p.button} ${p.danger}`} onClick={() => { update(() => emptyDemo); router.push("/"); }}>Hapus data demo</button><button className={`${p.button} ${p.secondary}`} onClick={close}>Batal</button></div></Modal></div>;
}
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
      const { profile: savedProfile } = await requestApi("/api/me", {
        method: "PATCH", body: { full_name: fullName, phone: phone || null },
      });
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
      await requestApi("/api/children", {
        method: "POST", body: { full_name: child.name.trim(), birth_date: child.dob },
      });

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

function ParentProfileContent() {
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, []);
  const [authUser, setAuthUser] = useState(supabaseConfigured ? undefined : null);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active) setAuthUser(error ? null : data.user || null);
    }).catch(() => { if (active) setAuthUser(null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  if (authUser === undefined) return <p className={p.notice} role="status">Memeriksa sesi akun…</p>;
  if (authUser) return <AuthenticatedParentProfile key={authUser.id} user={authUser} />;
  return <DemoGate><Profile /></DemoGate>;
}

export function ParentProfile() { return <div className={p.page}><PageHeader eyebrow="AKUN & KELUARGA" title="Ruang kecil untuk keluarga Anda." description="Kelola profil anak yang terhubung ke akun Ayomi." /><ParentProfileContent /></div>; }

function Notifications() {
  const { state, update } = useParentDemo(); const [onlyUnread, setOnlyUnread] = useState(false); const unread = state.notifications.filter(n => !n.read); const items = onlyUnread ? unread : state.notifications;
  return <><div className={p.between} style={{ marginBottom: 20 }}><label className={p.check}><input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)} />Hanya belum dibaca ({unread.length})</label><button className={`${p.button} ${p.secondary}`} disabled={!unread.length} onClick={() => update(s => ({ ...s, notifications: s.notifications.map(n => ({ ...n, read: true })) }))}><CheckCheck size={15} />Tandai semua dibaca</button></div>{items.length ? <div className={p.card}>{items.map(n => <article key={n.id} className={`${p.notification} ${n.read ? "" : p.unread}`}><Bell size={19} color={n.urgent ? "#e76f51" : "#2a9d8f"} style={{ flexShrink: 0, marginTop: 4 }} /><div style={{ flex: 1 }}><Link href={n.href} onClick={() => update(s => ({ ...s, notifications: s.notifications.map(item => item.id === n.id ? { ...item, read: true } : item) }))} style={{ fontSize: 13, fontWeight: n.read ? 500 : 700 }}>{n.title}</Link><p className={p.small}>{dateLabel(n.createdAt)} · notifikasi lokal</p>{n.urgent && <span className={`${p.badge} ${p.red}`}>Prioritas demo</span>}</div>{!n.read && <button className={p.link} onClick={() => update(s => ({ ...s, notifications: s.notifications.map(item => item.id === n.id ? { ...item, read: true } : item) }))}>Tandai dibaca</button>}</article>)}</div> : <EmptyState title={onlyUnread ? "Semua notifikasi sudah dibaca" : "Belum ada notifikasi"} description="Pembaruan pengajuan dan laporan demo akan muncul di sini." href="/beranda" action="Buka dashboard" />}</>;
}
export function ParentNotifications() { return <div className={p.page}><PageHeader eyebrow="KABAR UNTUK ANDA" title="Notifikasi" description="Ikuti pembaruan pada alur demo. Tidak ada pesan yang berasal dari layanan eksternal." /><DemoGate><Notifications /></DemoGate></div>; }

function ReviewEditor({ daycareId }) {
  const { state, update } = useParentDemo(); const existing = state.reviews.find(r => r.daycareId === daycareId); const [rating, setRating] = useState(existing?.rating || 0); const [text, setText] = useState(existing?.text || ""); const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const daycare = getDaycare(daycareId); const reply = state.caregiver.replies.find(r => r.reviewId === existing?.id);
  function submit(event) { event.preventDefault(); setNotice(""); if (!activeEnrollments(state).some(e => e.daycareId === daycareId)) { setError("Ulasan hanya tersedia untuk daycare yang terhubung dengan anak aktif."); return; } if (!rating || text.trim().length < 20) { setError("Pilih rating dan tulis minimal 20 karakter ulasan."); return; } const review = { id: existing?.id || crypto.randomUUID(), daycareId, rating, text: text.trim(), createdAt: new Date().toISOString() }; update(s => ({ ...s, reviews: [review, ...s.reviews.filter(r => r.daycareId !== daycareId)] })); setError(""); setNotice("Ulasan demo disimpan lokal dan tampil pada tab ulasan daycare. Belum dipublikasikan ke layanan nyata."); }
  return <Panel><div className={p.between}><div><h2 className={p.sectionTitle}>{daycare?.name}</h2><span className={p.badge}><ShieldCheck size={13} />Anak terhubung · demo</span></div><LinkButton secondary href={`/detail/${daycareId}`}>Detail daycare</LinkButton></div><form className={p.form} style={{ marginTop: 24 }} method="post" onSubmit={submit} noValidate><fieldset><legend className={p.fieldLabel} style={{ marginBottom: 12 }}>Penilaian pengasuhan</legend><StarRating rating={rating} onChange={setRating} /></fieldset><div className={p.field}><label htmlFor="review-text">Ceritakan pengalaman contoh Anda</label><Input id="review-text" type="textarea" value={text} onChange={e => setText(e.target.value)} maxLength={1000} minLength={20} placeholder="Apa yang berjalan baik dan apa yang dapat ditingkatkan?" required /><p className={p.small}>{text.length}/1000 karakter</p></div>{error && <p role="alert" className={p.error}>{error}</p>}{notice && <p role="status" className={p.feedback}>{notice}</p>}<button className={p.button} type="submit">{existing ? "Perbarui ulasan demo" : "Simpan ulasan demo"}</button></form>{reply && <div className={p.notice} style={{ marginTop: 20 }}><div><strong>Balasan pengelola · demo</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reply.text}</p></div></div>}</Panel>;
}
function Reviews({ daycareId }) { const { state } = useParentDemo(); const options = [...new Set(activeEnrollments(state).map(e => e.daycareId))]; const [selected, setSelected] = useState(options.includes(daycareId) ? daycareId : options[0] || ""); if (!options.length) return <EmptyState title="Ulasan untuk pengasuhan yang Anda kenali" description="Aktifkan pendaftaran anak terlebih dahulu. Ulasan demo hanya dapat dibuat untuk daycare yang terhubung dengan anak aktif." href="/status-pendaftaran" action="Lihat pendaftaran" />; const current = options.includes(selected) ? selected : options[0]; return <div className={p.stack}><div className={p.field} style={{ maxWidth: 420 }}><label htmlFor="review-daycare">Daycare yang ingin diulas</label><select id="review-daycare" className={p.select} value={current} onChange={e => setSelected(e.target.value)}>{options.map(id => <option key={id} value={id}>{getDaycare(id)?.name}</option>)}</select></div><ReviewEditor key={current} daycareId={current} /></div>; }
export function ParentReviews({ daycareId }) { return <div className={p.page}><PageHeader eyebrow="ULASAN ORANG TUA" title="Pengalaman Anda membantu keluarga lain." description="Coba alur ulasan untuk daycare yang terhubung dengan anak Anda. Semua ulasan pada demo ini tersimpan lokal." /><DemoGate><Reviews daycareId={daycareId} /></DemoGate></div>; }
