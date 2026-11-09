// Servidor de pruebas: ejecuta apps-script/Code.gs en Node con un Google Sheet
// simulado en memoria. Sirve para probar la app sin tocar la Hoja real.
// Uso: node scripts/servidor-local.mjs   (escucha en http://localhost:8787)
// Al iniciar imprime la clave temporal del administrador (admin@local.test).
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.PUERTO || 8787);

// ---- Hoja simulada ----
class Rango {
  constructor(hoja, f, c, nf = 1, nc = 1) { Object.assign(this, { hoja, f, c, nf, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nf; i++) {
      const fila = [];
      for (let j = 0; j < this.nc; j++) fila.push(this.hoja.celda(this.f + i, this.c + j));
      out.push(fila);
    }
    return out;
  }
  setValues(v) { v.forEach((fila, i) => fila.forEach((x, j) => this.hoja.poner(this.f + i, this.c + j, x))); return this; }
  setValue(x) { this.hoja.poner(this.f, this.c, x); return this; }
  clearContent() { for (let i = 0; i < this.nf; i++) for (let j = 0; j < this.nc; j++) this.hoja.poner(this.f + i, this.c + j, ""); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}
class Hoja {
  constructor(nombre) { this.nombre = nombre; this.datos = []; this.maxCols = 26; }
  celda(f, c) { return this.datos[f - 1]?.[c - 1] ?? ""; }
  poner(f, c, x) { while (this.datos.length < f) this.datos.push([]); this.datos[f - 1][c - 1] = x; }
  getLastRow() { for (let i = this.datos.length; i > 0; i--) if ((this.datos[i - 1] || []).some((x) => x !== "" && x !== undefined)) return i; return 0; }
  getLastColumn() { return Math.max(0, ...this.datos.map((f) => { for (let j = f.length; j > 0; j--) if (f[j - 1] !== "" && f[j - 1] !== undefined) return j; return 0; })); }
  getMaxColumns() { return this.maxCols; }
  getMaxRows() { return 1000; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  getRange(f, c, nf, nc) { return new Rango(this, f, c, nf, nc); }
  getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(fila) { const f = this.getLastRow() + 1; fila.forEach((x, j) => this.poner(f, j + 1, x)); }
  setFrozenRows() {}
}
const hojas = new Map();
["1. Inventario Propiedades", "4. Seguimiento Obras", "5. Unidades y Arriendos"].forEach((n) => hojas.set(n, new Hoja(n)));
const libro = {
  getSheetByName: (n) => hojas.get(n) || null,
  insertSheet: (n) => { const h = new Hoja(n); hojas.set(n, h); return h; },
};

// ---- Servicios de Apps Script simulados ----
const props = new Map();
const cache = new Map();
const archivos = new Map();
const ctx = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => libro, getUi: () => ({ alert: () => {}, ButtonSet: {} }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => props.get(k) ?? null,
      setProperty: (k, v) => props.set(k, v),
      deleteProperty: (k) => props.delete(k),
      getProperties: () => Object.fromEntries(props),
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => { const e = cache.get(k); return e && e.exp > Date.now() ? e.v : null; },
      put: (k, v, s = 600) => cache.set(k, { v, exp: Date.now() + s * 1000 }),
      remove: (k) => cache.delete(k),
    }),
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => "America/Bogota", getEffectiveUser: () => ({ getEmail: () => "admin@local.test" }) },
  ContentService: {
    MimeType: { JSON: "json" },
    createTextOutput: (t) => ({ getContent: () => t, setMimeType() { return this; } }),
  },
  Utilities: {
    getUuid: () => randomUUID(),
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    computeDigest: (_, txt) => [...createHash("sha256").update(String(txt), "utf8").digest()].map((b) => (b > 127 ? b - 256 : b)),
    base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 0xff)).toString("base64"),
    base64Decode: (s) => [...Buffer.from(s, "base64")].map((b) => (b > 127 ? b - 256 : b)),
    formatDate: (d) => {
      const z = new Date(d.getTime() - 5 * 3600000).toISOString();
      return z.slice(0, 19);
    },
    newBlob: (bytes, mime, nombre) => ({ bytes, mime, nombre }),
    sleep: () => {},
  },
  DriveApp: {
    createFolder: () => ({ getId: () => "carpeta", createFile: crearArchivo }),
    getFolderById: () => ({ createFile: crearArchivo }),
    getFileById: (id) => {
      const a = archivos.get(id);
      return { getBlob: () => ({ getBytes: () => a.bytes, getContentType: () => a.mime }) };
    },
  },
};
function crearArchivo(blob) {
  const id = randomUUID();
  archivos.set(id, blob);
  return { getId: () => id, setDescription() {} };
}
vm.createContext(ctx);
vm.runInContext(readFileSync(join(raiz, "apps-script/Semilla.gs"), "utf8"), ctx);
vm.runInContext(readFileSync(join(raiz, "apps-script/Code.gs"), "utf8"), ctx);

const inst = ctx.instalar();
console.log(`\nServidor de prueba en http://localhost:${PUERTO}`);
console.log(`Administrador: ${inst.email}  ·  Clave temporal: ${inst.clave}\n`);

export function llamar(body) {
  return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
export { ctx, hojas, inst };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.end();
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const salida = req.method === "POST" ? ctx.doPost({ postData: { contents: cuerpo } }) : ctx.doGet();
      res.setHeader("Content-Type", "application/json");
      setTimeout(() => res.end(salida.getContent()), 250); // simula la latencia de Google
    });
  }).listen(PUERTO);
}
