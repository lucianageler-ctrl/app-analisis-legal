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
    
    // 1. Iniciar subida resumible en el backend
    setStatus(`Inicializando subida segura para ${safeName}...`, 10);
    const startRes = await fetch('/api/start-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: safeName,
        mimeType: mimeType,
        size: file.size
      })
    });
    
    if (!startRes.ok) throw new Error("Fallo al inicializar subida en el servidor");
    const { uploadUrl } = await startRes.json();

    // 2. Subir en partes (chunks) de 3MB para no superar el límite de Vercel
    const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB (seguro para el límite de 4.5MB de Vercel en Base64)
    let offset = 0;
    let fileUri, fileName;

    const chunkToBase64 = (chunk) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(chunk);
    });

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const isFinal = offset + CHUNK_SIZE >= file.size;
      const base64Chunk = await chunkToBase64(chunk);
      
      const progress = Math.round((offset / file.size) * 100);
      setStatus(`Subiendo archivo por partes... ${progress}% completado`, 15 + Math.floor((progress / 100) * 35));

      const chunkRes = await fetch('/api/upload-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadUrl,
          chunkBase64: base64Chunk,
          offset,
          isFinal
        })
      });

      if (!chunkRes.ok) {
        const errorData = await chunkRes.json();
        throw new Error(`Error al subir la parte del archivo: ${errorData.error}`);
      }

      const data = await chunkRes.json();
      if (isFinal) {
        fileUri = data.fileUri;
        fileName = data.fileName;
      }

      offset += CHUNK_SIZE;
    }

    console.log(`[FRONTEND] Archivo subido exitosamente a Gemini. URI: ${fileUri}`);

    // 3. Llamar a nuestro backend para que extraiga el texto usando la URI
    setStatus(`Procesando documento con Gemini 2.5 Flash...`, 60);
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
