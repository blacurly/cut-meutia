import p from "./Parent.module.css";

export function Feedback({ error, notice }) { return <>{error && <p role="alert" className={p.error}>{error}</p>}{notice && <p role="status" className={p.feedback}>{notice}</p>}</>; }
