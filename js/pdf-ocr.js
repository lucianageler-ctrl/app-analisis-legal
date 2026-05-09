import { extractionCache } from './config.js?v=3.0';
import { setStatus, toast } from './utils.js?v=3.0';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

export async function extractFile(file) {
  console.log(`[FRONTEND] Iniciando extracción para el archivo: ${file.name} (Tamaño: ${file.size} bytes)`);
  
  const cacheKey = `${file.name}::${file.size}::${file.lastModified}`;
  if (extractionCache.has(cacheKey)) {
    console.log("[FRONTEND] Archivo encontrado en caché.");
    return extractionCache.get(cacheKey);
  }

  setStatus(`Subiendo ${file.name} al backend...`, 20);

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || "application/pdf";

    setStatus(`Procesando con Gemini 1.5 Flash...`, 60);
    console.log(`[FRONTEND] Enviando POST a /api/extract | MimeType: ${mimeType}`);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mimeType: mimeType,
        data: base64Data
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
      mode: "Gemini 1.5 Flash",
      status: "ok",
      note: "Extraído vía Inteligencia Artificial (Gemini)"
    };

    extractionCache.set(cacheKey, payload);
    return payload;

  } catch (error) {
    console.error("[FRONTEND] Fallo general durante la extracción:", error);
    toast(error.message || "Error desconocido al procesar el archivo");
    throw error;
  }
}
