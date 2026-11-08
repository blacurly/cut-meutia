"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { filterDirectoryDaycares, parseDirectoryFilters } from "@/lib/daycare-directory";
import { requestApi } from "@/lib/api-client";
import { DaycareCard, EmptyState, PageHeader } from "./ParentUI";
import p from "./Parent.module.css";

function FilterFields({filters,change,prefix,daycares,facilityOptions}) {
  const options = key => [...new Set(daycares.filter(daycare =>
    (key === "province" || !filters.province || daycare.province === filters.province) &&
    (key !== "district" || !filters.city || daycare.city === filters.city)
  ).map(daycare => daycare[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
  return <>
    <div className={p.filterGroup}><p className={p.filterLabel}>Wilayah pencarian</p>
      {[["province","Provinsi"],["city","Kota / Kabupaten"],["district","Kecamatan"]].map(([key,label]) =>
        <div className={p.field} key={key}><label htmlFor={prefix+"-"+key}>{label}</label>
          <select className={p.select} id={prefix+"-"+key} value={filters[key]} disabled={key==="city"&&!filters.province||key==="district"&&!filters.city} onChange={e=>change(key,e.target.value)}>
            <option value="">Semua {label.toLowerCase()}</option>{options(key).map(value=><option key={value}>{value}</option>)}
          </select>
        </div>)}
    </div>
    {Object.keys(facilityOptions).length > 0 && <fieldset className={p.filterGroup}><legend>Fasilitas</legend>
      {Object.entries(facilityOptions).map(([key,label])=><label key={key} className={p.check}><input type="checkbox" checked={filters.facilities.includes(key)} onChange={()=>change("facilities",filters.facilities.includes(key)?filters.facilities.filter(value=>value!==key):[...filters.facilities,key])}/>{label}</label>)}
    </fieldset>}
  </>;
}
export default function DaycareSearch({initialFilters}) {
  const [filters,setFilters]=useState(initialFilters);const [page,setPage]=useState(1);const [open,setOpen]=useState(false);const [daycares,setDaycares]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [retry,setRetry]=useState(0);const close=useCallback(()=>setOpen(false),[]);
  const facilityOptions=useMemo(()=>Object.fromEntries(daycares.flatMap(daycare=>daycare.facilities.map((key,index)=>[key,daycare.facilityLabels[index]||key]))),[daycares]);
  const results=useMemo(()=>filterDirectoryDaycares(filters,daycares),[filters,daycares]);const totalPages=Math.max(1,Math.ceil(results.length/6));const currentPage=Math.min(page,totalPages);
  useEffect(()=>{const controller=new AbortController();async function load(){try{
    const payload=await requestApi("/api/daycare/list",{signal:controller.signal});if(!Array.isArray(payload))throw new Error("Format data daycare dari API tidak valid.");setDaycares(payload);
  }catch(error){if(error.name!=="AbortError")setError(error.message||"Data daycare tidak dapat dimuat.");}finally{if(!controller.signal.aborted)setLoading(false);}}void load();return()=>controller.abort();},[retry]);
  useEffect(()=>{const sync=()=>{setFilters(parseDirectoryFilters(new URLSearchParams(window.location.search)));setPage(1);};window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[]);
  function save(next){setFilters(next);setPage(1);const query=new URLSearchParams(Object.entries(next).map(([key,value])=>[key,Array.isArray(value)?value.join(","):value]).filter(([,value])=>value)).toString();window.history.replaceState(null,"",`/pencarian${query?`?${query}`:""}`);}
  function change(key,value){const next={...filters,[key]:value};if(key==="province"){next.city="";next.district="";}if(key==="city")next.district="";save(next);}
  function reset(){save(parseDirectoryFilters());}
  return <div className={p.page}><PageHeader eyebrow="DIREKTORI DAYCARE" title="Pengasuhan yang tepat dimulai di sini." description="Jelajahi daycare terdaftar dan sesuaikan pilihan dengan kebutuhan keluarga Anda."/><div style={{maxWidth:680,marginBottom:24}}><Input id="directory-query" aria-label="Cari daycare atau kota" type="search" icon={<Search size={17}/>} placeholder="Cari nama daycare atau kota…" value={filters.q} maxLength={100} onChange={e=>change("q",e.target.value)}/></div><div className={p.catalog}><aside className={p.filters} aria-label="Filter pencarian desktop"><div className={p.between}><strong style={{fontSize:14}}><SlidersHorizontal size={15} style={{display:"inline",marginRight:7}}/>Filter pencarian</strong><button type="button" className={p.link} onClick={reset}>Reset</button></div><FilterFields prefix="desktop" filters={filters} change={change} daycares={daycares} facilityOptions={facilityOptions}/></aside><section aria-label="Hasil pencarian"><div className={p.resultsBar}><div><strong style={{fontSize:15}}>{results.length} daycare ditemukan</strong><p className={p.small}>{[filters.district,filters.city,filters.province].filter(Boolean).join(", ")||"Semua wilayah"}</p></div><div className={p.row}><button className={`${p.button} ${p.secondary} ${p.mobileOnly}`} onClick={()=>setOpen(true)}><Filter size={15}/>Filter</button><span className={p.small}>Nama A–Z</span></div></div><div className={p.chips}>{[filters.province,filters.city,filters.district].filter(Boolean).map(value=><span className={p.chip} key={value}>{value}</span>)}{filters.facilities.map(key=><button className={p.chip} key={key} onClick={()=>change("facilities",filters.facilities.filter(v=>v!==key))}>{facilityOptions[key]||key}<X size={11}/></button>)}</div><div aria-live="polite" className="sr-only">{loading?"Memuat daycare…":error?`Gagal memuat daycare: ${error}`:`${results.length} hasil pencarian`}</div>{loading?<p className={p.notice} role="status">Memuat daycare…</p>:error?<div><p className={p.error} role="alert">Data daycare tidak dapat dimuat: {error}</p><button className={`${p.button} ${p.secondary}`} onClick={()=>{setError("");setLoading(true);setRetry(value=>value+1);}}>Coba lagi</button></div>:results.length?<><div className={p.grid}>{results.slice((currentPage-1)*6,currentPage*6).map(d=><DaycareCard key={d.id} daycare={d}/>)}</div><nav className={p.pagination} aria-label="Halaman hasil"><button className={`${p.button} ${p.secondary}`} disabled={currentPage===1} onClick={()=>setPage(v=>v-1)}>Sebelumnya</button><span>{currentPage} / {totalPages}</span><button className={`${p.button} ${p.secondary}`} disabled={currentPage===totalPages} onClick={()=>setPage(v=>v+1)}>Selanjutnya</button></nav></>:<EmptyState title="Belum ada pilihan yang cocok" description="Coba ubah kata pencarian, perluas wilayah, atau kurangi fasilitas yang dipilih."><button className={p.button} onClick={reset}>Reset semua filter</button></EmptyState>}</section></div><Modal open={open} onClose={close} title="Filter pencarian" size="sm"><button className={p.link} onClick={reset}>Reset filter</button><FilterFields prefix="mobile" filters={filters} change={change} daycares={daycares} facilityOptions={facilityOptions}/><button className={`${p.button} ${p.full}`} style={{marginTop:20}} onClick={close}>Tampilkan {results.length} daycare</button></Modal></div>;
}
