function getDocStatusClass(status) {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  return "error";
}

function getDocStatusLabel(status) {
  if (status === "ok") return "Procesado";
  if (status === "partial") return "Lectura parcial";
  return "Error";
}

function buildExecutiveSummary(compareData = null) {
  const docs = state.docs || [];
  const processed = docs.filter(d => d.status === "ok").length;
  const partial = docs.filter(d => d.status === "partial").length;
  const errors = docs.filter(d => d.status === "error").length;

  let important = "Todavía no hay comparación ejecutada.";
  let conclusion = "El sistema está listo para seguir procesando y comparar documentos.";
  let changeCount = 0;
  let topImpact = "sin clasificar";

  if (compareData) {
    changeCount = compareData.added.length + compareData.removed.length + compareData.modified.length;
    if (compareData.modified.length > 0) topImpact = "impacto alto";
    else if (compareData.added.length > 0 || compareData.removed.length > 0) topImpact = "impacto medio";
    else topImpact = "impacto bajo";

    important = `
      Se detectaron <strong>${changeCount}</strong> cambios totales:
      <strong>${compareData.modified.length}</strong> modificados,
      <strong>${compareData.added.length}</strong> agregados y
      <strong>${compareData.removed.length}</strong> ausentes o eliminados.
    `;

    conclusion =
      compareData.modified.length > 0
        ? "La comparación muestra cambios relevantes en el contenido. Conviene revisar primero los bloques modificados porque son los que más afectan el análisis."
        : compareData.added.length || compareData.removed.length
          ? "La principal diferencia está en bloques agregados o ausentes. El impacto es moderado y fácil de rastrear."
          : "No se detectaron diferencias sustantivas entre los documentos seleccionados.";
  }

  return `
    <div class="summary-grid">
      <div class="summary-mini"><span>Documentos procesados</span><strong>${processed}</strong></div>
      <div class="summary-mini"><span>Lectura parcial</span><strong>${partial}</strong></div>
      <div class="summary-mini"><span>Errores</span><strong>${errors}</strong></div>
      <div class="summary-mini"><span>Impacto general</span><strong>${topImpact}</strong></div>
    </div>

    <div class="summary-conclusion">
      <h3 style="margin-bottom:10px;">Conclusión general</h3>
      <p class="hint" style="margin-bottom:10px;">${important}</p>
      <p class="hint">${conclusion}</p>
    </div>
  `;
}

function renderComparison() {
  const resultBox = $("#compareResults");
  const idA = $("#compareA").value;
  const idB = $("#compareB").value;

  const docA = state.docs.find((d) => d.id === idA);
  const docB = state.docs.find((d) => d.id === idB);

  if (!docA || !docB) {
    resultBox.innerHTML = \`<div class="empty-state">Seleccioná dos documentos válidos para comparar.</div>\`;
    $("#analysisSummary").innerHTML = buildExecutiveSummary(null);
    return;
  }

  const result = compareDocs(docA, docB);

  resultBox.innerHTML = \`
    <div class="summary-grid">
      <div class="summary-mini"><span>Bloques en A</span><strong>\${result.totalA}</strong></div>
      <div class="summary-mini"><span>Bloques en B</span><strong>\${result.totalB}</strong></div>
      <div class="summary-mini"><span>Agregados</span><strong>\${result.added.length}</strong></div>
      <div class="summary-mini"><span>Modificados</span><strong>\${result.modified.length}</strong></div>
    </div>

    <div class="workspace-table-wrap">
      <table>
        <thead>
          <tr>
            <th>ARTÍCULO / SECCIÓN</th>
            <th>TIPO DE CAMBIO</th>
            <th>DESCRIPCIÓN DEL CAMBIO</th>
            <th>TEXTO ANTES (PROYECTO ORIGINAL)</th>
            <th>TEXTO DESPUÉS (VERSIÓN MODIFICADA / SANCIONADA)</th>
            <th>CATEGORÍA TEMÁTICA</th>
            <th>IMPACTO JURÍDICO</th>
            <th>IMPACTO PRÁCTICO</th>
            <th>RELEVANCIA POLÍTICA</th>
            <th>OBSERVACIÓN</th>
          </tr>
        </thead>
        <tbody>
          \${result.added.map((item) => {
            const analysis = analyzeNormativeChange("", item.b.content, "Agregado", docB.mode);
            return \`
            <tr>
              <td><strong>\${escapeHtml(toSentenceCase(item.b.title))}</strong></td>
              <td>Agregado</td>
              <td>Se incorpora un artículo o sección nueva que no estaba en el proyecto original.</td>
              <td>No estaba presente en el proyecto original.</td>
              <td>\${escapeHtml(simplifyText(item.b.content, 220))}</td>
              <td>\${escapeHtml(analysis.category)}</td>
              <td>\${escapeHtml(analysis.legalImpact)}</td>
              <td>\${escapeHtml(analysis.practicalImpact)}</td>
              <td>\${escapeHtml(analysis.politicalRelevance)}</td>
              <td><span class="hint">\${escapeHtml(analysis.observation)}</span></td>
            </tr>
            \`;
          }).join("")}

          \${result.removed.map((item) => {
            const analysis = analyzeNormativeChange(item.a.content, "", "Eliminación", docA.mode);
            return \`
            <tr>
              <td><strong>\${escapeHtml(toSentenceCase(item.a.title))}</strong></td>
              <td>Eliminación</td>
              <td>Se elimina un artículo o sección que estaba presente en el proyecto original.</td>
              <td>\${escapeHtml(simplifyText(item.a.content, 220))}</td>
              <td>No aparece en la versión modificada / sancionada.</td>
              <td>\${escapeHtml(analysis.category)}</td>
              <td>\${escapeHtml(analysis.legalImpact)}</td>
              <td>\${escapeHtml(analysis.practicalImpact)}</td>
              <td>\${escapeHtml(analysis.politicalRelevance)}</td>
              <td><span class="hint">\${escapeHtml(analysis.observation)}</span></td>
            </tr>
            \`;
          }).join("")}

          \${result.modified.map((item) => {
            const analysis = analyzeNormativeChange(item.a.content, item.b.content, "Modificación", docB.mode);
            return \`
            <tr>
              <td><strong>\${escapeHtml(toSentenceCase(item.a.title))}</strong></td>
              <td>Modificación</td>
              <td>Se modifica el contenido del artículo o sección existente entre ambas versiones.</td>
              <td>\${escapeHtml(simplifyText(item.a.content, 220))}</td>
              <td>\${escapeHtml(simplifyText(item.b.content, 220))}</td>
              <td>\${escapeHtml(analysis.category)}</td>
              <td>\${escapeHtml(analysis.legalImpact)}</td>
              <td>\${escapeHtml(analysis.practicalImpact)}</td>
              <td>\${escapeHtml(analysis.politicalRelevance)}</td>
              <td><span class="hint">\${escapeHtml(analysis.observation)}</span></td>
            </tr>
            \`;
          }).join("")}
        </tbody>
      </table>
    </div>\`;

  $("#analysisSummary").innerHTML = buildExecutiveSummary(result);
}

function renderDocList() {
  const tableBody = $("#workspaceTableBody");
  if (!tableBody) return;

  if (!state.docs.length) {
    tableBody.innerHTML = \`
      <tr>
        <td colspan="10">
          <div class="empty-state">Todavía no hay documentos cargados.</div>
        </td>
      </tr>
    \`;
    return;
  }

  tableBody.innerHTML = state.docs.map((doc) => {
    const firstBlock = doc.blocks?.[0];
    const articleSection = toSentenceCase(firstBlock?.title || doc.filename);
    const currentText = firstBlock?.content || doc.text || "";
    const analysis = analyzeNormativeChange("", currentText, "Modificación", doc.mode);

    return \`
      <tr>
        <td><strong>\${escapeHtml(articleSection)}</strong></td>
        <td>Modificación</td>
        <td>
          Documento procesado en modo \${escapeHtml(doc.mode || "—")} con \${countWords(doc.text)} palabra(s) extraída(s).
        </td>
        <td>No disponible hasta comparar con una versión original.</td>
        <td>\${escapeHtml(simplifyText(currentText, 220))}</td>
        <td>\${escapeHtml(analysis.category)}</td>
        <td>\${escapeHtml(analysis.legalImpact)}</td>
        <td>\${escapeHtml(analysis.practicalImpact)}</td>
        <td>\${escapeHtml(analysis.politicalRelevance)}</td>
        <td><span class="hint">\${escapeHtml(analysis.observation)}</span></td>
      </tr>
    \`;
  }).join("");
}

function renderPreviewOptions() {
  const selects = [$("#previewSelect"), $("#compareA"), $("#compareB")];
  const options = state.docs.length
    ? state.docs.map((doc) => \`<option value="\${doc.id}">\${escapeHtml(doc.filename)}</option>\`).join("")
    : \`<option value="">Sin documentos</option>\`;

  selects.forEach((select) => {
    select.innerHTML = options;
  });

  if (!state.docs.length) {
    $("#previewText").value = "";
    return;
  }

  if (!state.selectedPreviewId || !state.docs.find((d) => d.id === state.selectedPreviewId)) {
    state.selectedPreviewId = state.docs[0].id;
  }

  $("#previewSelect").value = state.selectedPreviewId;
  if (!$("#compareA").value) $("#compareA").value = state.docs[0].id;
  if (!$("#compareB").value && state.docs[1]) $("#compareB").value = state.docs[1].id;
  if (!$("#compareB").value) $("#compareB").value = state.docs[0].id;

  const doc = state.docs.find((d) => d.id === state.selectedPreviewId);
  $("#previewText").value = doc ? doc.text : "";
}

function renderStats() {
  $("#statDocs").textContent = state.docs.length;
  if (!state.docs.length) {
    $("#statMode").textContent = "—";
    $("#statBlocks").textContent = "0";
  }
}

function renderAll() {
  renderDocList();
  renderPreviewOptions();
  renderStats();
  $("#analysisSummary").innerHTML = buildExecutiveSummary(null);
}
