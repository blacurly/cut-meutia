"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { requestApi } from "@/lib/api-client";
import { compareName } from "@/lib/parent";
import { useParentDemo } from "./ParentDemoProvider";
import { DaycareCard, EmptyState, LinkButton, PageHeader, detailHref } from "./ParentUI";
import p from "./Parent.module.css";

// Result is keyed by path, so a new path reads as "loading" without a
// synchronous state reset inside the effect.
function useApi(path) {
  const [state, setState] = useState({ path: null, data: null, error: "" });
  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    requestApi(path, { signal: controller.signal })
      .then(data => setState({ path, data, error: "" }))
      .catch(error => { if (error.name !== "AbortError") setState({ path, data: null, error: error.message || "Data tidak dapat dimuat." }); });
    return () => controller.abort();
  }, [path]);
  const current = state.path === path;
  return { data: current ? state.data : null, error: current ? state.error : "", loading: Boolean(path) && !current };
}

function ComparisonTable({ result }) {
  const { daycares, rows, notes } = result;
  return <>
    <div className={p.tableWrap} tabIndex={0} aria-label="Tabel komparasi, geser untuk melihat seluruh kolom">
      <table className={p.table}>
        <caption className="sr-only">Perbandingan daycare dari katalog</caption>
        <thead><tr><th scope="col">Yang perlu Anda ketahui</th>{daycares.map(d => <th scope="col" key={d.id}><strong style={{ color: "#264653", fontSize: 16 }}>{d.name}</strong><p className={p.small}>{[d.district, d.city].filter(Boolean).join(", ")}</p></th>)}</tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.key}>
            <th scope="row">{row.label}{row.estimated && <span className={`${p.badge} ${p.amber}`} style={{ marginLeft: 6 }}>Estimasi</span>}</th>
            {row.values.map((value, index) => {
              const best = row.best.includes(index);
              return <td key={daycares[index].id} className={best ? p.best : ""}>{value.display}{best && <Check size={13} style={{ display: "inline", marginLeft: 5 }} aria-label="Nilai terbaik" />}</td>;
            })}
          </tr>)}
          <tr><th scope="row">Langkah berikutnya</th>{daycares.map(d => <td key={d.id}><Link className={p.link} href={detailHref(d)}>Lihat detail</Link></td>)}</tr>
        </tbody>
      </table>
    </div>
    <ul className={`${p.detailList} ${p.small}`} style={{ marginTop: 16 }}>{notes.map(note => <li key={note}>{note}</li>)}</ul>
  </>;
}

// Comparison for catalog daycares (stored by UUID in the compare tray).
export default function CatalogComparison({ ids, results }) {
  const { state, update } = useParentDemo();
  const comparePath = results && ids.length >= 2 ? `/api/daycares/compare?ids=${ids.map(encodeURIComponent).join(",")}` : null;
  const comparison = useApi(comparePath);
  const directory = useApi(results ? null : "/api/daycares");
  const remove = id => update(s => ({ ...s, compare: s.compare.filter(value => value !== id) }));
  const list = Array.isArray(directory.data) ? directory.data : [];
  const selected = ids.map(id => list.find(daycare => daycare.id === id)).filter(Boolean);
  const suggestions = list.filter(daycare => !ids.includes(daycare.id)).slice(0, 3);

  let body;
  if (results) {
    if (ids.length < 2) body = <EmptyState title="Pilih minimal 2 daycare" description="Tambahkan satu daycare lagi dari direktori untuk melihat perbandingan." />;
    else if (comparison.loading) body = <p className={p.notice} role="status">Menyiapkan perbandingan…</p>;
    else if (comparison.error) body = <p className={p.error} role="alert">Perbandingan belum dapat dimuat: {comparison.error}</p>;
    else if (comparison.data) body = <ComparisonTable result={comparison.data} />;
  } else if (directory.loading) {
    body = <p className={p.notice} role="status">Memuat pilihan…</p>;
  } else if (directory.error) {
    body = <p className={p.error} role="alert">Daycare belum dapat dimuat: {directory.error}</p>;
  } else {
    body = <>
      <div className={p.grid}>{selected.map(daycare => <DaycareCard key={daycare.id} daycare={daycare} />)}</div>
      <div className={p.row} style={{ marginTop: 24 }}>
        {ids.length >= 2 ? <LinkButton href="/bandingkan/hasil">Lihat hasil komparasi</LinkButton> : <span className={p.small}>Pilih minimal 2 daycare untuk dibandingkan.</span>}
        <button className={`${p.button} ${p.secondary}`} onClick={() => update(s => ({ ...s, compare: [], compareNames: {} }))}>Kosongkan pilihan</button>
      </div>
      {ids.length < 3 && suggestions.length > 0 && <section className={p.section}><h2 className={p.sectionTitle}>Tambahkan ke pilihan Anda</h2><div className={p.grid}>{suggestions.map(daycare => <DaycareCard key={daycare.id} daycare={daycare} />)}</div></section>}
    </>;
  }

  return <div className={p.page}>
    <PageHeader eyebrow="BANDINGKAN DENGAN LEBIH TENANG" title={results ? "Komparasi daycare pilihan" : "Pilih hingga 3 daycare"} description="Bandingkan legalitas, rating, biaya, rasio pengasuh, dan fasilitas secara berdampingan.">
      <LinkButton secondary href={results ? "/bandingkan" : "/pencarian"}><Plus size={16} />{results ? "Ubah pilihan" : "Cari daycare lainnya"}</LinkButton>
    </PageHeader>
    <div className={p.chips}>{ids.map(id => <button className={p.chip} key={id} onClick={() => remove(id)} aria-label={`Hapus ${compareName(state, id)}`}>{compareName(state, id)}<X size={13} /></button>)}</div>
    {body}
  </div>;
}
