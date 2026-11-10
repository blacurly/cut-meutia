"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { FACILITY_TAGS } from "@/lib/daycare-facilities";
import { FEE_OPTIONS, RATING_OPTIONS, RATIO_OPTIONS, SORT_OPTIONS, directoryQuery, filterDirectoryDaycares, parseDirectoryFilters, rupiah } from "@/lib/daycare-directory";
import { requestApi } from "@/lib/api-client";
import { DaycareCard, EmptyState, PageHeader } from "./ParentUI";
import p from "./Parent.module.css";

const PAGE_SIZE = 9;
const AGE_OPTIONS = [["6", "6 bulan"], ["12", "1 tahun"], ["24", "2 tahun"], ["36", "3 tahun"], ["48", "4 tahun"], ["60", "5 tahun"]];
const REGION_FIELDS = [["province", "Provinsi"], ["city", "Kota / Kabupaten"], ["district", "Kecamatan"]];

// Region options come from the loaded data, narrowed by the parent selection.
function regionOptions(daycares, filters, key) {
  const matches = daycares.filter(daycare =>
    (key === "province" || !filters.province || daycare.province === filters.province) &&
    (key !== "district" || !filters.city || daycare.city === filters.city));
  return [...new Set(matches.map(daycare => daycare[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function FilterFields({ filters, change, prefix, daycares, facilityKeys }) {
  const toggleFacility = key => change("facilities", filters.facilities.includes(key)
    ? filters.facilities.filter(value => value !== key)
    : [...filters.facilities, key]);
  return <>
    <div className={p.filterGroup}>
      <p className={p.filterLabel}>Wilayah pencarian</p>
      {REGION_FIELDS.map(([key, label]) => <div className={p.field} key={key}>
        <label htmlFor={`${prefix}-${key}`}>{label}</label>
        <select className={p.select} id={`${prefix}-${key}`} value={filters[key]}
          disabled={(key === "city" && !filters.province) || (key === "district" && !filters.city)}
          onChange={event => change(key, event.target.value)}>
          <option value="">Semua {label.toLowerCase()}</option>
          {regionOptions(daycares, filters, key).map(value => <option key={value}>{value}</option>)}
        </select>
      </div>)}
    </div>
    <div className={p.filterGroup}>
      <p className={p.filterLabel}>Legalitas</p>
      <label className={p.check}>
        <input type="checkbox" checked={filters.legal === "referenced"} onChange={event => change("legal", event.target.checked ? "referenced" : "")} />
        Hanya yang ada referensi izin publik (NPSN/SK)
      </label>
    </div>
    <div className={p.filterGroup}>
      <label className={p.filterLabel} htmlFor={`${prefix}-rating`}>Rating publik minimal</label>
      <select className={p.select} id={`${prefix}-rating`} value={filters.minRating} onChange={event => change("minRating", event.target.value)}>
        <option value="">Semua rating</option>
        {RATING_OPTIONS.map(value => <option key={value} value={value}>{value.replace(".", ",")} ke atas</option>)}
      </select>
    </div>
    <div className={p.filterGroup}>
      <label className={p.filterLabel} htmlFor={`${prefix}-fee`}>Biaya bulanan maksimal</label>
      <select className={p.select} id={`${prefix}-fee`} value={filters.maxFee} onChange={event => change("maxFee", event.target.value)}>
        <option value="">Semua biaya</option>
        {FEE_OPTIONS.map(value => <option key={value} value={value}>{rupiah(Number(value))}</option>)}
      </select>
    </div>
    <div className={p.filterGroup}>
      <label className={p.filterLabel} htmlFor={`${prefix}-ratio`}>Rasio pengasuh : anak</label>
      <select className={p.select} id={`${prefix}-ratio`} value={filters.maxRatio} onChange={event => change("maxRatio", event.target.value)}>
        <option value="">Semua rasio</option>
        {RATIO_OPTIONS.map(value => <option key={value} value={value}>Maksimal 1 : {value}</option>)}
      </select>
    </div>
    <div className={p.filterGroup}>
      <label className={p.filterLabel} htmlFor={`${prefix}-age`}>Usia anak</label>
      <select className={p.select} id={`${prefix}-age`} value={filters.ageMonths} onChange={event => change("ageMonths", event.target.value)}>
        <option value="">Semua usia</option>
        {AGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <p className={p.small}>Biaya, rasio, dan usia adalah estimasi dari data sintetis.</p>
    </div>
    {facilityKeys.length > 0 && <fieldset className={p.filterGroup}>
      <legend>Fasilitas</legend>
      {facilityKeys.map(key => <label key={key} className={p.check}>
        <input type="checkbox" checked={filters.facilities.includes(key)} onChange={() => toggleFacility(key)} />{FACILITY_TAGS[key]}
      </label>)}
    </fieldset>}
  </>;
}

export default function DaycareSearch({ initialFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [daycares, setDaycares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const close = useCallback(() => setOpen(false), []);

  const facilityKeys = useMemo(() => Object.keys(FACILITY_TAGS).filter(key => daycares.some(daycare => daycare.facilities.includes(key))), [daycares]);
  const results = useMemo(() => filterDirectoryDaycares(filters, daycares), [filters, daycares]);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const payload = await requestApi("/api/daycare/list", { signal: controller.signal });
        if (!Array.isArray(payload)) throw new Error("Format data daycare dari API tidak valid.");
        setDaycares(payload);
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Data daycare tidak dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const sync = () => { setFilters(parseDirectoryFilters(new URLSearchParams(window.location.search))); setPage(1); };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function save(next) {
    setFilters(next);
    setPage(1);
    const query = directoryQuery(next);
    window.history.replaceState(null, "", `/pencarian${query ? `?${query}` : ""}`);
  }
  function change(key, value) {
    const next = { ...filters, [key]: value };
    if (key === "province") { next.city = ""; next.district = ""; }
    if (key === "city") next.district = "";
    save(next);
  }
  const reset = () => save(parseDirectoryFilters());
  const activeChips = [
    ...[filters.province, filters.city, filters.district].filter(Boolean).map(value => ({ key: value, label: value })),
    ...(filters.legal ? [{ key: "legal", label: "Ada referensi izin", remove: () => change("legal", "") }] : []),
    ...(filters.minRating ? [{ key: "rating", label: `Rating ≥ ${filters.minRating.replace(".", ",")}`, remove: () => change("minRating", "") }] : []),
    ...(filters.maxFee ? [{ key: "fee", label: `≤ ${rupiah(Number(filters.maxFee))}/bln`, remove: () => change("maxFee", "") }] : []),
    ...(filters.maxRatio ? [{ key: "ratio", label: `Rasio ≤ 1:${filters.maxRatio}`, remove: () => change("maxRatio", "") }] : []),
    ...(filters.ageMonths ? [{ key: "age", label: `Usia ${AGE_OPTIONS.find(([value]) => value === filters.ageMonths)?.[1] ?? `${filters.ageMonths} bulan`}`, remove: () => change("ageMonths", "") }] : []),
    ...filters.facilities.map(key => ({ key, label: FACILITY_TAGS[key] || key, remove: () => change("facilities", filters.facilities.filter(value => value !== key)) })),
  ];

  let body;
  if (loading) body = <p className={p.notice} role="status">Memuat daycare…</p>;
  else if (error) body = <div>
    <p className={p.error} role="alert">Data daycare tidak dapat dimuat: {error}</p>
    <button className={`${p.button} ${p.secondary}`} onClick={() => { setError(""); setLoading(true); setRetry(value => value + 1); }}>Coba lagi</button>
  </div>;
  else if (!results.length) body = <EmptyState title="Belum ada pilihan yang cocok" description="Coba ubah kata pencarian, perluas wilayah, atau kurangi filter yang dipilih.">
    <button className={p.button} onClick={reset}>Reset semua filter</button>
  </EmptyState>;
  else body = <>
    <div className={p.grid}>{results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(daycare => <DaycareCard key={daycare.id} daycare={daycare} />)}</div>
    <nav className={p.pagination} aria-label="Halaman hasil">
      <button className={`${p.button} ${p.secondary}`} disabled={currentPage === 1} onClick={() => setPage(value => value - 1)}>Sebelumnya</button>
      <span>{currentPage} / {totalPages}</span>
      <button className={`${p.button} ${p.secondary}`} disabled={currentPage === totalPages} onClick={() => setPage(value => value + 1)}>Selanjutnya</button>
    </nav>
  </>;

  const filterProps = { filters, change, daycares, facilityKeys };
  return <div className={p.page}>
    <PageHeader eyebrow="DIREKTORI DAYCARE" title="Pengasuhan yang tepat dimulai di sini." description="Daycare di DKI Jakarta, Jawa Barat, dan Jawa Timur. Status legalitas dan rating berasal dari sumber publik dan belum diverifikasi tim Ayomi." />
    <div style={{ maxWidth: 680, marginBottom: 24 }}>
      <Input id="directory-query" aria-label="Cari daycare, kota, atau kecamatan" type="search" icon={<Search size={17} />} placeholder="Cari nama daycare, kota, atau kecamatan…" value={filters.q} maxLength={100} onChange={event => change("q", event.target.value)} />
    </div>
    <div className={p.catalog}>
      <aside className={p.filters} aria-label="Filter pencarian desktop">
        <div className={p.between}>
          <strong style={{ fontSize: 14 }}><SlidersHorizontal size={15} style={{ display: "inline", marginRight: 7 }} />Filter pencarian</strong>
          <button type="button" className={p.link} onClick={reset}>Reset</button>
        </div>
        <FilterFields prefix="desktop" {...filterProps} />
      </aside>
      <section aria-label="Hasil pencarian">
        <div className={p.resultsBar}>
          <div>
            <strong style={{ fontSize: 15 }}>{loading ? "Memuat…" : `${results.length} daycare ditemukan`}</strong>
            <p className={p.small}>{[filters.district, filters.city, filters.province].filter(Boolean).join(", ") || "Semua wilayah"}</p>
          </div>
          <div className={p.row}>
            <button className={`${p.button} ${p.secondary} ${p.mobileOnly}`} onClick={() => setOpen(true)}><Filter size={15} />Filter</button>
            <label className="sr-only" htmlFor="directory-sort">Urutkan hasil</label>
            <select id="directory-sort" className={p.select} value={filters.sort} onChange={event => change("sort", event.target.value)}>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        {filters.sort === "recommended" && <p className={p.small} style={{ marginBottom: 12 }}>Urutan: mitra Ayomi, lalu daycare dengan referensi izin publik, rating publik, dan kelengkapan fasilitas.</p>}
        {activeChips.length > 0 && <div className={p.chips}>{activeChips.map(chip => chip.remove
          ? <button className={p.chip} key={chip.key} onClick={chip.remove}>{chip.label}<X size={11} /></button>
          : <span className={p.chip} key={chip.key}>{chip.label}</span>)}</div>}
        <div aria-live="polite" className="sr-only">{loading ? "Memuat daycare…" : error ? `Gagal memuat daycare: ${error}` : `${results.length} hasil pencarian`}</div>
        {body}
      </section>
    </div>
    <Modal open={open} onClose={close} title="Filter pencarian" size="sm">
      <button className={p.link} onClick={reset}>Reset filter</button>
      <FilterFields prefix="mobile" {...filterProps} />
      <button className={`${p.button} ${p.full}`} style={{ marginTop: 20 }} onClick={close}>Tampilkan {results.length} daycare</button>
    </Modal>
  </div>;
}
