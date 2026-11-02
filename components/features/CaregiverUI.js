"use client";

import { useId } from "react";
import p from "./Parent.module.css";

export function Field({ label, children, multiline = false, ...props }) {
  const generated = useId(); const id = props.id || generated;
  return <div className={p.field}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} id={id} className={p.select} rows={5} /> : <input {...props} id={id} className={p.select} />} {children}</div>;
}
export function SelectField({ label, children, ...props }) { const generated = useId(); const id = props.id || generated; return <div className={p.field}><label htmlFor={id}>{label}</label><select {...props} id={id} className={p.select}>{children}</select></div>; }
export function Feedback({ error, notice }) { return <>{error && <p role="alert" className={p.error}>{error}</p>}{notice && <p role="status" className={p.feedback}>{notice}</p>}</>; }
