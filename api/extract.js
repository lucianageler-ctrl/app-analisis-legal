module.exports = async function handler(req, res) {
  console.log("[BACKEND] Petición recibida en /api/extract");

  // Habilitar CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API KEY faltante" });
  }

  let geminiFileToDelete = null;

  try {
    const { mimeType, fileUri, fileName } = req.body;

    if (!mimeType || !fileUri) {
      return res.status(400).json({ error: "Faltan datos requeridos (mimeType o fileUri)." });
    }

    geminiFileToDelete = fileName; // Para limpieza posterior
    console.log(`[BACKEND] Solicitando extracción de texto a Gemini para URI: ${fileUri}...`);

    // 1. Generar contenido con Gemini directamente usando el URI del archivo ya subido
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Extraer todo el texto de este documento de la forma más precisa posible sin inventar nada." },
              { fileData: { fileUri: fileUri, mimeType: mimeType } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error de Gemini: ${errorData.error?.message || response.statusText}`);
    }

    const responseData = await response.json();
    console.log("[BACKEND] Extracción completada con éxito.");
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error("[BACKEND] Error interno del servidor:", error);
    return res.status(500).json({ error: error.message || "Error interno del servidor" });
  } finally {
    // 2. Limpieza: Eliminar de Gemini
    if (geminiFileToDelete) {
      console.log(`[BACKEND] Limpiando archivo en Gemini: ${geminiFileToDelete}`);
      try {
        await fetch(`https://generativelanguage.googleapis.com/v1beta/${geminiFileToDelete}?key=${apiKey}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.error("[BACKEND] Error al borrar de Gemini:", e);
      }
    }
  }
};

module.exports.config = {
  maxDuration: 60, // Aumentamos a 60 segundos por si la extracción toma tiempo
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Ya no necesitamos body grande porque solo pasamos la URI
    }
  }
};
