let GEMINI_API_KEY = window.ENV?.GEMINI_API_KEY || localStorage.getItem("gemini_api_key") || "";

function getApiKey() {
  if (!GEMINI_API_KEY) {
    const key = prompt("Para extraer texto se requiere Gemini 1.5 Flash.\n\nPor favor, ingresa tu API Key:");
    if (key) {
      GEMINI_API_KEY = key.trim();
      localStorage.setItem("gemini_api_key", GEMINI_API_KEY);
    } else {
      throw new Error("Se requiere una API Key de Gemini para continuar.");
    }
  }
  return GEMINI_API_KEY;
}


function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // FileReader returns "data:image/png;base64,iVBORw0KGgo..."
      // We only need the base64 part for Gemini API
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

async function extractFile(file) {
  const cacheKey = `${file.name}::${file.size}::${file.lastModified}`;
  if (extractionCache.has(cacheKey)) {
    return extractionCache.get(cacheKey);
  }

  setStatus(`Subiendo ${file.name} a Gemini API...`, 20);

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || "application/pdf"; // Fallback just in case

    setStatus(`Procesando con Gemini 1.5 Flash...`, 60);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${getApiKey()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extraer todo el texto de este documento de la forma más precisa posible."
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      throw new Error(`Error de la API de Gemini: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract text from Gemini response structure
    let extractedText = "";
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      extractedText = data.candidates[0].content.parts.map(p => p.text).join("\n");
    }

    if (!extractedText) {
      throw new Error("Gemini no pudo extraer texto del archivo.");
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
    throw error;
  }
}
