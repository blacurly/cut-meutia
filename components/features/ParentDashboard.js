"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, ClipboardList, ShieldAlert, Users } from "lucide-react";
import { useParentDemo } from "./ParentDemoProvider";
import { activeEnrollments, dateLabel, getDaycare, statusLabels, todayISO } from "@/lib/parent";
import { journalExamples } from "@/data/daycares";
import { parentJournals } from "@/lib/caregiver";
import { createClient } from "@/lib/supabase/client";
import { DemoGate, EmptyState, LinkButton, PageHeader, Panel } from "./ParentUI";
import p from "./Parent.module.css";

function Dashboard() {
  const { state, update } = useParentDemo(); const active = activeEnrollments(state); const pending = state.enrollments.filter(e => ["pending", "approved"].includes(e.status)); const chosen = active.find(e => e.childId === state.selectedChild) || active[0]; const child = state.children.find(c => c.id === chosen?.childId); const daycare = getDaycare(chosen?.daycareId); const hasToday = chosen && chosen.startDate <= todayISO();
  return <><PageHeader eyebrow={`DASHBOARD ORANG TUA · ${dateLabel(todayISO())}`} title={`Selamat datang, ${state.profile.name}.`} description="Ringkasan pengasuhan dan cerita kecil yang berarti. Seluruh informasi di halaman ini merupakan demo lokal." /><div className={p.metrics}>{[[Users, active.length, "Anak aktif"], [ClipboardList, pending.length, "Pengajuan berjalan"], [Bell, state.notifications.filter(n => !n.read).length, "Notifikasi belum dibaca"], [ShieldAlert, state.incidents.length, "Laporan demo"]].map(([Icon, value, label]) => <Panel key={label}><Icon size={19} color="#2a9d8f" /><strong>{value}</strong><p className={p.small}>{label}</p></Panel>)}</div><div className={p.twoColumns}><div className={p.stack}>{!active.length ? <EmptyState title="Pengasuhan aktif dimulai dari pendaftaran" description="Setelah pengajuan disetujui dan simulasi dikonfirmasi, anak akan terhubung ke daycare serta mendapatkan contoh logbook." href={pending.length ? "/status-pendaftaran" : "/pencarian"} action={pending.length ? "Lanjutkan status pendaftaran" : "Temukan daycare"} /> : <><Panel><div className={p.between}><h2 className={p.sectionTitle}>Anak saya</h2><LinkButton secondary href="/profil#anak">Kelola anak</LinkButton></div><div className={p.stack}>{active.map(entry => { const c = state.children.find(v => v.id === entry.childId); const d = getDaycare(entry.daycareId); return <div className={p.childCard} key={entry.id}><span className={p.avatar}>{c?.name.slice(0, 1)}</span><div style={{ flex: 1 }}><strong>{c?.name}</strong><p className={p.small}>{d?.name}</p></div><button className={`${p.button} ${entry.childId === chosen.childId ? "" : p.secondary}`} aria-pressed={entry.childId === chosen.childId} onClick={() => update(s => ({ ...s, selectedChild: entry.childId }))}>{entry.childId === chosen.childId ? "Aktif" : "Pilih"}</button></div>; })}</div></Panel><Panel><div className={p.between}><div><h2 className={p.sectionTitle}>Cerita hari ini · {child?.name}</h2><p className={p.small}>{daycare?.name} · contoh aktivitas</p></div><LinkButton secondary href="/catatan-harian"><BookOpen size={15} />Logbook</LinkButton></div>{hasToday ? <div className={p.stack} style={{ marginTop: 20 }}>{[...parentJournals(state, child.id, daycare.id, todayISO()), ...journalExamples].slice(0, 3).map(item => <div className={p.row} key={item.id}><span className={`${p.badge} ${p.neutral}`}>{item.time}</span><span style={{ fontSize: 13 }}>{item.title}</span></div>)}</div> : <p className={p.notice} style={{ marginTop: 18 }}>Jadwal mulai {dateLabel(chosen.startDate)}. Belum ada contoh aktivitas sebelum tanggal mulai.</p>}</Panel></>}</div><div className={p.stack}><Panel><h2 className={p.sectionTitle}>Pendaftaran berjalan</h2>{pending.length ? pending.slice(0, 3).map(e => <div key={e.id} style={{ paddingBlock: 12, borderBottom: "1px solid #eef2f5" }}><strong style={{ fontSize: 13 }}>{state.children.find(c => c.id === e.childId)?.name}</strong><p className={p.small}>{getDaycare(e.daycareId)?.name}</p><span className={`${p.badge} ${p.amber}`}>{statusLabels[e.status]}</span></div>) : <p className={p.muted}>Tidak ada pengajuan yang menunggu.</p>}<LinkButton className={p.full} secondary href="/status-pendaftaran" style={{ marginTop: 18 }}>Lihat semua pengajuan</LinkButton></Panel><Panel><h2 className={p.sectionTitle}>Akses cepat</h2><div className={p.stack} style={{ gap: 10 }}><LinkButton secondary href="/laporan"><ShieldAlert size={16} />Pusat laporan</LinkButton><LinkButton secondary href="/notifikasi"><Bell size={16} />Notifikasi</LinkButton><LinkButton secondary href="/ulasan">Tulis ulasan daycare</LinkButton></div></Panel></div></div></>;
}

function ConnectedParentDashboard({ user }) {
  const supabase = useMemo(() => createClient(), []);
  const [account, setAccount] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [{ data: profile, error: profileError }, { data: rows, error: childrenError }] = await Promise.all([
        supabase.from("users").select("role, status, full_name").eq("id", user.id).maybeSingle(),
        supabase.from("children").select("child_id, full_name, status").eq("parent_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
      ]);
      if (profileError || childrenError) throw new Error("load_failed");
      if (!profile || profile.role !== "parent" || profile.status !== "active") {
        setError("Dashboard ini hanya tersedia untuk akun Orang Tua yang aktif.");
        return;
      }
      setAccount(profile);
      setChildren(rows || []);
    } catch {
      setError("Data akun belum dapat dimuat. Periksa koneksi lalu muat ulang halaman.");
    } finally {
      setLoading(false);
    }
  }, [supabase, user.id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (loading) return <p className={p.notice} role="status">Memuat dashboard Ayomi…</p>;
  if (error) return <p className={p.error} role="alert">{error}</p>;

  return <>
    <PageHeader eyebrow={`DASHBOARD ORANG TUA · ${dateLabel(todayISO())}`} title={`Selamat datang, ${account?.full_name || user.email}.`} description="Ringkasan ini menampilkan data akun Ayomi yang tersimpan di Supabase." />
    <div className={p.metrics}><Panel><Users size={19} color="#2a9d8f" /><strong>{children.length}</strong><p className={p.small}>Anak terdaftar</p></Panel></div>
    <Panel>
      <div className={p.between}><h2 className={p.sectionTitle}>Anak saya</h2><LinkButton secondary href="/profil#anak">Kelola profil anak</LinkButton></div>
      {children.length ? <div className={p.stack} style={{ marginTop: 16 }}>{children.map((child) => <div className={p.childCard} key={child.child_id}><span className={p.avatar}>{child.full_name.slice(0, 1)}</span><div><strong>{child.full_name}</strong><p className={p.small}>{child.status === "active" ? "Profil aktif" : "Profil tidak aktif"}</p></div><LinkButton secondary href="/profil#anak">Lihat profil</LinkButton></div>)}</div> : <EmptyState title="Belum ada profil anak" description="Tambahkan profil anak dari halaman akun untuk mulai menggunakan layanan Ayomi." href="/profil#anak" action="Tambah profil anak" />}
    </Panel>
    <p className={p.notice} style={{ marginTop: 20 }}>Pendaftaran daycare, logbook, dan notifikasi masih dalam proses integrasi ke database.</p>
  </>;
}

function ParentDashboardContent() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active) setUser(error ? null : data.user || null);
    }).catch(() => { if (active) setUser(null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  if (user === undefined) return <p className={p.notice} role="status">Memeriksa sesi akun…</p>;
  if (user) return <ConnectedParentDashboard user={user} />;
  return <DemoGate><Dashboard /></DemoGate>;
}

export default function ParentDashboard() { return <div className={p.page}><ParentDashboardContent /></div>; }
