// Las fotos del celular pesan varios MB: se reducen a 1600 px en JPEG antes de
// subirlas, así la subida es rápida aun con datos móviles.
const LADO_MAX = 1600;

export async function prepararArchivo(file) {
  if (/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && file.size > 400 * 1024) {
    try {
      const reducido = await reducirImagen(file);
      return { nombre: file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"), mime: "image/jpeg", base64: reducido };
    } catch {
      /* si el navegador no puede leerla, se sube tal cual */
    }
  }
  return { nombre: file.name, mime: file.type || "application/octet-stream", base64: await aBase64(file) };
}

function aBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function reducirImagen(file) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  return aBase64(blob);
}

export function base64ABlobUrl(base64, mime) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
