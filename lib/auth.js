export const AUTH_ROLES = ["parent", "caregiver", "admin"];

export function normalizeAuthQuery(query = {}) {
  return {
    role: AUTH_ROLES.includes(query.role) ? query.role : "parent",
    language: query.lang === "en" ? "en" : "id",
  };
}

export function authHref(mode, role, language) {
  const query = normalizeAuthQuery({ role, lang: language });
  return `/${mode === "register" ? "daftar" : "masuk"}?role=${query.role}&lang=${query.language}`;
}

export function normalizePhone(value) {
  const phone = String(value ?? "").trim().replace(/[\s()-]/g, "");
  if (phone.startsWith("+62")) return phone.slice(3);
  if (phone.startsWith("62")) return phone.slice(2);
  if (phone.startsWith("0")) return phone.slice(1);
  return phone;
}

export function passwordCriteria(password = "") {
  return { length: password.length >= 8, letter: /[a-z]/i.test(password), number: /\d/.test(password) };
}

// Presentation validation only. A future auth service must validate all input
// independently and assign permissions on the server, never from the URL role.
export function validateAuthForm(values, { mode = "login", role = "parent" } = {}) {
  const errors = {};
  const text = (name) => typeof values[name] === "string" ? values[name].trim() : "";

  if (mode === "register" && role === "admin") return { role: "adminRegistration" };
  if (!AUTH_ROLES.includes(role)) return { role: "invalidRole" };

  if (mode === "register" && text("name").length < 2) errors.name = "name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text("email"))) errors.email = "email";
  if (mode === "register" && !/^8\d{8,11}$/.test(normalizePhone(values.phone))) errors.phone = "phone";

  const password = typeof values.password === "string" ? values.password : "";
  if (!password.trim()) errors.password = "passwordRequired";
  else if (mode === "register" && (!Object.values(passwordCriteria(password)).every(Boolean) || password.length > 128)) errors.password = "password";

  if (mode === "register" && role === "caregiver") {
    if (text("daycare").length < 2) errors.daycare = "daycare";
    if (text("city").length < 2) errors.city = "city";
  }
  if (mode === "register" && values.terms !== true) errors.terms = "terms";
  return errors;
}
