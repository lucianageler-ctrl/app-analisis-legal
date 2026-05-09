const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  // CORS configuration
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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const jsonResponse = await handleUpload({
      body: body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Configuramos los límites y permisos de la subida directa del cliente
        return {
          allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/json', 'text/plain'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB (Límite máximo para cuentas gratuitas de Vercel)
        };
      }
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('[BACKEND] Error al generar token de Vercel Blob:', error);
    return res.status(400).json({ error: error.message });
  }
};
