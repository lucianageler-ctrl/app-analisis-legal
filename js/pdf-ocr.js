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
    const mimeType = file.type || "application/pdf";

    // 1. Subir archivo a Vercel Blob directamente desde el cliente
    setStatus(`Subiendo ${file.name} (esto puede tomar un tiempo para archivos grandes)...`, 20);
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // 1. Pedir URL de subida segura a Gemini (pasando por nuestro backend para ocultar la API Key)
    setStatus(`Obteniendo permisos para ${safeName}...`, 10);
    const tokenRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: safeName,
        mimeType: mimeType,
        size: file.size
      })
    });
    
    if (!tokenRes.ok) throw new Error("Fallo al inicializar subida en Gemini");
    const { uploadUrl } = await tokenRes.json();

    // 2. Subir directamente el archivo pesado a los servidores de Google Gemini (Bypass de Vercel)
    setStatus(`Subiendo ${file.name} directamente a Google Gemini (hasta 100MB soportados)...`, 20);
    const blobRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': mimeType
      },
      body: file
    });

    if (!blobRes.ok) {
      const errorText = await blobRes.text();
      console.error("[FRONTEND] Gemini rechazó la subida:", errorText);
      throw new Error(`Google Gemini rechazó el archivo: HTTP ${blobRes.status}`);
    }

    const uploadData = await blobRes.json();
    const fileUri = uploadData.file.uri;
    const fileName = uploadData.file.name;
    console.log(`[FRONTEND] Archivo subido exitosamente a Gemini File API. URI: ${fileUri}`);

    // 3. Llamar a nuestro backend para que extraiga el texto usando la URI
    setStatus(`Procesando con Gemini 2.5 Flash...`, 60);
    console.log(`[FRONTEND] Enviando POST a /api/extract | MimeType: ${mimeType}`);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mimeType: mimeType,
        fileUri: fileUri,
        fileName: fileName
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
