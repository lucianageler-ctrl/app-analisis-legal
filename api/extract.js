module.exports = async function handler(req, res) {
  console.log("[BACKEND] Petición recibida en /api/extract");

  // Habilitar CORS para evitar errores si se prueba desde localhost hacia Vercel
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.warn("[BACKEND] Método no permitido:", req.method);
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[BACKEND] GEMINI_API_KEY no está configurada.");
    return res.status(500).json({ error: "Configuración del servidor incompleta (API KEY faltante)." });
  }

  try {
    const { mimeType, data } = req.body;

    if (!mimeType || !data) {
      console.error("[BACKEND] Faltan mimeType o data en el body.");
      return res.status(400).json({ error: "Faltan datos requeridos (mimeType o data)." });
    }

    console.log(`[BACKEND] Procesando archivo. MimeType: ${mimeType}`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Extraer todo el texto de este documento de la forma más precisa posible sin inventar nada." },
              { inlineData: { mimeType: mimeType, data: data } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[BACKEND] Error de Gemini API:", errorData);
      return res.status(response.status).json({ error: `Error de Gemini: ${errorData.error?.message || response.statusText}` });
    }

    const responseData = await response.json();
    console.log("[BACKEND] Extracción completada con éxito.");
    return res.status(200).json(responseData);

  } catch (error) {
    console.error("[BACKEND] Error interno del servidor:", error);
    return res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};
