function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.docs));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state.docs = parsed;
  } catch (_) {}
}

function clearState() {
  state.docs = [];
  state.selectedPreviewId = null;
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  setStatus("Workspace limpiado.", 0);
  toast("Workspace limpiado");
}

function addDoc(file, payload) {
  const blocks = extractBlocks(payload.text);
  const doc = {
    id: uid(),
    filename: file.name,
    size: file.size,
    status: payload.status,
    mode: payload.mode,
    note: payload.note || "",
    text: normalizeText(payload.text),
    blocks,
    createdAt: new Date().toISOString()
  };

  state.docs.push(doc);
  state.selectedPreviewId = doc.id;
  saveState();
  renderAll();

  $("#statMode").textContent = doc.mode;
  $("#statBlocks").textContent = doc.blocks.length;
}

function validateFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowed = ["pdf", "jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext)) {
    throw new Error("Archivo inválido. Solo se admiten PDF, JPG, JPEG, PNG y WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    toast(`Archivo pesado detectado (${(file.size / 1024 / 1024).toFixed(1)} MB). El procesamiento puede tardar bastante.`);
  }
}

async function handleFiles(files) {
  const incoming = Array.from(files || []);
  if (!incoming.length) return;

  for (const file of incoming) {
    try {
      validateFile(file);
      setStatus(`Preparando ${file.name}...`, 5);
      toast(`Procesando ${file.name}...`);

      const payload = await extractFile(file);

      if (!payload.text || !payload.text.trim()) {
        throw new Error("No se pudo extraer texto útil del archivo.");
      }

      setStatus(`Procesamiento completado: ${file.name}`, 100);
      addDoc(file, payload);
      toast(`Archivo procesado: ${file.name}`);
    } catch (error) {
      console.error("Error procesando archivo", file.name, error);

      addDoc(file, {
        text: `[DATO NO DISPONIBLE EN EL TEXTO]\n\n${error.message}`,
        mode: "Error de extracción",
        status: "error",
        note: error.message
      });

      setStatus(`Error: ${error.message}`, 0);
      toast(`Error con ${file.name}`);
    }
  }
}

function bindEvents() {
  const input = $("#fileInput");
  const selectBtn = $("#selectBtn");
  const dropzone = $("#dropzone");

  const openPicker = () => {
    input.value = "";
    input.click();
  };

  selectBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPicker();
  });

  dropzone.addEventListener("click", (e) => {
    if (e.target.closest("#selectBtn")) return;
    openPicker();
  });

  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  input.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    await handleFiles(files);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "dragend"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    await handleFiles(files);
  });

  $("#previewSelect").addEventListener("change", (e) => {
    state.selectedPreviewId = e.target.value;
    renderPreviewOptions();
  });

  $("#compareBtn").addEventListener("click", renderComparison);
  $("#clearBtn").addEventListener("click", clearState);

  $("#downloadPdfBtn").addEventListener("click", exportAnalysisToPDF);
  $("#downloadWordBtn").addEventListener("click", exportAnalysisToWord);
  $("#compareBtnHero").addEventListener("click", () => {
    document.querySelector("#compareA")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindEvents();
  renderAll();
  setStatus("Listo para recibir archivos.", 0);
});
