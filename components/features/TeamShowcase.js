"use client";
import { useState } from "react";
import Image from "next/image";
import { TEAM } from "@/lib/team";
import sitePhotos from "@/lib/site-photos.json";
import s from "./TeamShowcase.module.css";

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join("");
const safeLink = url => (typeof url === "string" && /^https:\/\/\S+$/.test(url) ? url : null);
const LINK_LABEL = { linkedin: "LinkedIn", github: "GitHub" };

// "Tentang Ayomi": four photo buttons; the chosen member's details show below.
export default function TeamShowcase() {
  const members = TEAM.filter(member => member.name.trim());
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? null);
  if (!members.length) return null;
  const selected = members.find(member => member.id === selectedId) ?? members[0];
  const links = Object.entries(selected.links ?? {}).map(([key, url]) => [key, safeLink(url)]).filter(([, url]) => url);
  return <div className={s.team}>
    <h3 className={s.title}>Tim di balik Ayomi</h3>
    <div className={s.grid}>
      {members.map(member => {
        const photo = sitePhotos.team?.[member.id];
        const active = member.id === selected.id;
        return <button key={member.id} type="button" className={`${s.card} ${active ? s.active : ""}`} aria-pressed={active}
          aria-controls="profil-tim" onClick={() => setSelectedId(member.id)}>
          <span className={s.photo}>
            {photo ? <Image src={photo} alt={`Foto ${member.name}`} fill sizes="(max-width: 700px) 45vw, 220px" /> : <span className={s.initials} aria-hidden="true">{initials(member.name)}</span>}
          </span>
          <strong>{member.name}</strong>
          {member.role && <span className={s.role}>{member.role}</span>}
        </button>;
      })}
    </div>
    <div id="profil-tim" className={s.detail} aria-live="polite">
      <strong>{selected.name}</strong>
      {selected.role && <span className={s.role}>{selected.role}</span>}
      {selected.focus && <p>{selected.focus}</p>}
      {links.length > 0 && <div className={s.links}>{links.map(([key, url]) => <a key={key} href={url} target="_blank" rel="noopener noreferrer">{LINK_LABEL[key] ?? key}</a>)}</div>}
    </div>
  </div>;
}
