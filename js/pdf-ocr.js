import { extractionCache } from './config.js?v=3.0';
import { setStatus, toast } from './utils.js?v=3.0';
// No usamos esm.sh import para evitar bugs de bundler

export async function extractFile(file) {
  console.log(`[FRONTEND] Iniciando extracción para el archivo: ${file.name} (Tamaño: ${file.size} bytes)`);
  const cacheKey = `${file.name}::${file.size}::${file.lastModified}`;
  if (extractionCache.has(cacheKey)) {
    console.log("[FRONTEND] Archivo encontrado en caché.");
    return extractionCache.get(cacheKey);
  }

  try {
    const mimeType = file.type || 'application/pdf';

    // Crear un formulario de datos (FormData) para enviar el archivo en bruto (hasta 100MB soportados por Render)
    const formData = new FormData();
    formData.append("document", file);
    formData.append("mimeType", mimeType);

    setStatus(`Enviando archivo de ${Math.round(file.size / 1024 / 1024)}MB al servidor... esto puede tardar unos minutos para archivos grandes.`, 20, "normal");

    const response = await fetch("/api/extract", {
      method: "POST",
      // No seteamos Content-Type, fetch lo hará automáticamente con el "boundary" necesario para FormData
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
      console.error("[FRONTEND] Error de la API:", errorMessage);
      throw new Error(`Error en el servidor: ${errorMessage}`);
    }

    setStatus('Procesando respuesta del servidor...', 90, "normal");
    const data = await response.json();
    console.log("[FRONTEND] Respuesta recibida de la API:", data);

    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!extractedText) {
       console.error("[FRONTEND] Formato de respuesta inesperado:", JSON.stringify(data, null, 2));
       throw new Error("La API no devolvió texto en el formato esperado.");
    }

    const payload = {
      text: extractedText,
      mode: "Gemini 2.5 Flash",
      status: "ok",
      note: "Extraído vía IA (Gemini 2.5 Flash)"
    };

    extractionCache.set(cacheKey, payload);
    return payload;

  } catch (error) {
    console.error("[FRONTEND] Fallo general durante la extracción:", error);
    toast(error.message || "Error desconocido al procesar el archivo");
    throw error;
  }
}
