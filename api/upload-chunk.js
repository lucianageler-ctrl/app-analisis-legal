module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { uploadUrl, chunkBase64, offset, isFinal } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Remove "data:application/pdf;base64," if present
    const base64Data = chunkBase64.replace(/^data:.*?;base64,/, "");
    const chunkBuffer = Buffer.from(base64Data, 'base64');

    const command = isFinal ? 'upload, finalize' : 'upload';

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'X-Goog-Upload-Offset': offset.toString(),
        'X-Goog-Upload-Command': command
      },
      body: chunkBuffer
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`Fallo en Gemini al subir chunk: ${errorText}`);
    }

    if (isFinal) {
      const data = await uploadRes.json();
      return res.status(200).json({ fileUri: data.file.uri, fileName: data.file.name });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[BACKEND] Error en upload-chunk:', error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb' // Vercel soporta hasta 4.5MB reales, 5mb asegura que no falle por bodyParser
    }
  }
};
