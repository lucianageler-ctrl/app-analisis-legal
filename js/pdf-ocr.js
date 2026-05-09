import { extractionCache } from './config.js?v=3.0';
import { setStatus, toast } from './utils.js?v=3.0';
import { upload } from 'https://esm.sh/@vercel/blob@0.23.0/client?bundle';

export async function extractFile(file) {
  console.log(`[FRONTEND] Iniciando extracción para el archivo: ${file.name} (Tamaño: ${file.size} bytes)`);
  
  const cacheKey = `${file.name}::${file.size}::${file.lastModified}`;
  if (extractionCache.has(cacheKey)) {
    console.log("[FRONTEND] Archivo encontrado en caché.");
    return extractionCache.get(cacheKey);
  }

  try {
    const mimeType = file.type || "application/pdf";

    // 1. Subir archivo a Vercel Blob directamente desde el cliente
    setStatus(`Subiendo ${file.name} (esto puede tomar un tiempo para archivos grandes)...`, 20);
    // Limpiamos el nombre de archivo para evitar errores de CORS/400 en Vercel Blob por caracteres especiales
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    const blob = await upload(safeName, file, {
      access: 'public',
      handleUploadUrl: '/api/upload', // Nuestro nuevo endpoint de backend que autoriza la subida
    });

    console.log(`[FRONTEND] Archivo subido exitosamente a Vercel Blob: ${blob.url}`);

    // 2. Llamar a nuestro backend para que lo descargue y lo mande a Gemini
    setStatus(`Procesando con Gemini 2.5 Flash...`, 60);
    console.log(`[FRONTEND] Enviando POST a /api/extract | MimeType: ${mimeType}`);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mimeType: mimeType,
        blobUrl: blob.url // IMPORTANTE: Ahora enviamos la URL en vez del Base64 gigantesco
      })
    });

    if (!response.ok) {
      let errorMsg = `Error HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = `Error de backend/Gemini: ${errorData.error}`;
      } catch (e) {}
      
      console.error("[FRONTEND] Falló la petición a /api/extract:", errorMsg);
      toast(errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log("[FRONTEND] Respuesta exitosa del backend:", data);

    let extractedText = "";
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      extractedText = data.candidates[0].content.parts.map(p => p.text).join("\n");
    }

    if (!extractedText.trim()) {
      const errorMsg = "Gemini devolvió una respuesta vacía o sin texto detectado.";
      console.error("[FRONTEND]", errorMsg);
      toast(errorMsg);
      throw new Error(errorMsg);
    }

    const payload = {
      text: extractedText,
      mode: "Gemini 2.5 Flash",
      status: "ok",
      note: "Extraído vía IA (Gemini 2.5 Flash) usando Vercel Blob"
    };

    extractionCache.set(cacheKey, payload);
    return payload;

  } catch (error) {
    console.error("[FRONTEND] Fallo general durante la extracción:", error);
    toast(error.message || "Error desconocido al procesar el archivo");
    throw error;
  }
}
