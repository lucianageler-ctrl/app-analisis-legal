async function exportAnalysisToPDF() {
  const target = document.body;
  const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * imgWidth / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save("analisis-documental.pdf");
}

async function exportAnalysisToWord() {
  const { Document, Packer, Paragraph, TextRun } = window.docx;

  const lines = [];
  lines.push(new Paragraph({ children: [new TextRun({ text: "Análisis documental", bold: true, size: 32 })] }));
  lines.push(new Paragraph(" "));
  lines.push(new Paragraph(`Documentos cargados: ${state.docs.length}`));
  lines.push(new Paragraph(" "));

  state.docs.forEach((doc, index) => {
    const impact = deriveImpact(doc);
    lines.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${doc.filename}`, bold: true })] }));
    lines.push(new Paragraph(`Modo: ${doc.mode || "—"}`));
    lines.push(new Paragraph(`Estado: ${doc.status}`));
    lines.push(new Paragraph(`Categoría: ${impact.category}`));
    lines.push(new Paragraph(`Impacto: ${impact.label}`));
    lines.push(new Paragraph(`Observación: ${impact.observation}`));
    lines.push(new Paragraph(" "));
  });

  const doc = new Document({
    sections: [{ properties: {}, children: lines }]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analisis-documental.docx";
  a.click();
  URL.revokeObjectURL(url);
}
