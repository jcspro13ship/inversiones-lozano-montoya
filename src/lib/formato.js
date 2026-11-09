const fmtPesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function pesos(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "Sin dato";
  return fmtPesos.format(Number(v));
}

// $8.859 M / $1.106 M — para tarjetas donde el número completo no cabe.
export function pesosCorto(v) {
  if (v === null || v === undefined || v === "") return "Sin dato";
  const n = Number(v);
  const signo = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${signo}$${(a / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 2 })} mil M`;
  if (a >= 1e6) return `${signo}$${(a / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  return `${signo}${pesos(a)}`;
}

export function porcentaje(v, dec = 1) {
  if (v === null || v === undefined || v === "") return "Sin dato";
  return `${(Number(v) * 100).toLocaleString("es-CO", { maximumFractionDigits: dec, minimumFractionDigits: dec })}%`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function aFecha(s) {
  if (!s) return null;
  const [f, h] = String(s).split("T");
  const [a, m, d] = f.split("-").map(Number);
  if (!a || !m || !d) return null;
  if (!h) return new Date(a, m - 1, d);
  const [hh, mm] = h.split(":").map(Number);
  return new Date(a, m - 1, d, hh || 0, mm || 0);
}

export function fecha(s) {
  const d = aFecha(s);
  if (!d) return "";
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MESES[d.getMonth()]}${anio}`;
}

export function fechaHora(s) {
  const d = aFecha(s);
  if (!d) return "";
  return `${fecha(s)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function hace(s) {
  const d = aFecha(s);
  if (!d) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  if (dias < 7) return `hace ${dias} d`;
  return fecha(s);
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Días hasta una fecha límite (negativo = vencida).
export function diasHasta(s) {
  const d = aFecha(s);
  if (!d) return null;
  const hoy = aFecha(hoyISO());
  return Math.round((d - hoy) / 86400000);
}

export function iniciales(nombre = "") {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
}

export function tamano(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
