const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Intentar cargar dotenv si existe localmente (para desarrollo local)
try {
  require('dotenv').config();
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (el frontend)
app.use(express.static(__dirname));

// Configuración de multer para guardar el archivo temporalmente en memoria o disco
// Usaremos la memoria para ser más rápidos y seguros en entornos como Render
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // Límite de 100MB
});

app.post('/api/extract', upload.single('document'), async (req, res) => {
  console.log("[BACKEND] Petición recibida en /api/extract");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor." });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No se subió ningún archivo." });
  }

  const mimeType = file.mimetype;
  let geminiFileToDelete = null;

  try {
    console.log(`[BACKEND] Archivo recibido: ${file.originalname} (${file.size} bytes). Subiendo a Gemini...`);

    // 1. Subir a Gemini File API
    const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Command': 'upload',
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: file.buffer, // Buffer directo en memoria
      duplex: 'half'
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`Fallo al subir a Gemini: ${errorText}`);
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file.uri;
    geminiFileToDelete = uploadData.file.name;
    console.log(`[BACKEND] Subida exitosa a Gemini. File URI: ${fileUri}`);

    // 2. Extraer el texto con Gemini 2.5 Flash
    console.log("[BACKEND] Solicitando extracción de texto a Gemini...");
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
    console.error("[BACKEND] Error interno:", error);
    return res.status(500).json({ error: error.message || "Error interno del servidor" });
  } finally {
    // 3. Limpieza: Eliminar archivo de Gemini para no ocupar espacio
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
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`[SERVIDOR] Iniciado correctamente en http://localhost:${PORT}`);
});
