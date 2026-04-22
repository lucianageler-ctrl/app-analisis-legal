function detectThematicCategory(text) {
  const source = (text || "").toLowerCase();

  const scores = [
    {
      name: "Seguridad social / Fiscal",
      score: (source.match(/aporte|aportes|contribuci[oó]n|contribuciones|seguridad social|fiscal|tribut|al[ií]cuota|retenci[oó]n/g) || []).length
    },
    {
      name: "Sindical / Colectivo",
      score: (source.match(/sindicat|convenio colectivo|paritaria|negociaci[oó]n colectiva|huelga|colectiv/g) || []).length
    },
    {
      name: "Justicia laboral / Procedimiento",
      score: (source.match(/juicio|procedimiento|tribunal|competencia|recurso|demanda|sentencia|justicia laboral/g) || []).length
    },
    {
      name: "Laboral individual",
      score: (source.match(/trabajador|empleador|contrato|jornada|remuneraci[oó]n|despido|indemnizaci[oó]n|licencia/g) || []).length
    }
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].name : "Laboral individual";
}

function analyzeNormativeChange(beforeText, afterText, changeType, mode = "") {
  const beforeClean = normalizeText(beforeText || "");
  const afterClean = normalizeText(afterText || "");
  const combined = `${beforeClean} ${afterClean}`.toLowerCase();
  const extractionMode = (mode || "").toLowerCase();

  const category = detectThematicCategory(combined);

  let legalImpact = "Introduce una modificación en el contenido normativo.";
  if (/indemniz|base de c[aá]lculo|monto/.test(combined)) {
    legalImpact = "Modifica criterios vinculados al cálculo o determinación de derechos económicos.";
  } else if (/exclu|inclu|alcance|aplicaci[oó]n|sujetos/.test(combined)) {
    legalImpact = "Redefine el alcance de aplicación de la norma y los sujetos comprendidos.";
  } else if (/aporte|contribuci[oó]n|seguridad social|tribut/.test(combined)) {
    legalImpact = "Altera obligaciones legales relacionadas con aportes, contribuciones o cargas del sistema.";
  } else if (/procedimiento|plazo|recurso|competencia|juicio|tribunal/.test(combined)) {
    legalImpact = "Modifica aspectos operativos o procesales de aplicación e interpretación jurídica.";
  } else if (/contrato|relaci[oó]n laboral|trabajador|empleador/.test(combined)) {
    legalImpact = "Introduce cambios en la regulación de la relación laboral entre las partes.";
  }

  let practicalImpact = "Puede generar efectos concretos en la aplicación práctica del régimen.";
  if (/aporte|contribuci[oó]n|costo|patronal|beneficio fiscal/.test(combined)) {
    practicalImpact = "Puede modificar costos, cargas operativas o criterios de liquidación para los sujetos alcanzados.";
  } else if (/registro|documentaci[oó]n|plazo|procedimiento|formalidad/.test(combined)) {
    practicalImpact = "Obliga a revisar procesos internos, documentación o formas de cumplimiento.";
  } else if (/exclu|inclu|alcance|sujetos/.test(combined)) {
    practicalImpact = "Amplía o restringe quiénes quedan efectivamente alcanzados por el régimen.";
  } else if (/despido|indemnizaci[oó]n|remuneraci[oó]n|licencia/.test(combined)) {
    practicalImpact = "Puede alterar derechos, obligaciones o costos derivados de la relación laboral concreta.";
  } else if (extractionMode.includes("ocr")) {
    practicalImpact = "Conviene revisar manualmente el contenido porque el texto fue obtenido mediante OCR.";
  }

  let observation = "El cambio requiere una lectura contextual dentro del conjunto normativo.";
  if (changeType === "Agregado") {
    observation = "Incorpora una regla nueva que amplía o complementa la estructura normativa existente.";
  } else if (changeType === "Eliminación") {
    observation = "Suprime una previsión previa, lo que puede modificar el equilibrio o alcance del régimen analizado.";
  } else if (changeType === "Modificación") {
    observation = "Reformula una disposición existente, por lo que el efecto depende del alcance exacto de la nueva redacción.";
  }

  if (beforeClean && afterClean) {
    if (beforeClean === afterClean) {
      observation = "No se advierte una variación sustantiva en la redacción comparada.";
    } else if (afterClean.length > beforeClean.length * 1.25) {
      observation = "La nueva redacción amplía el contenido regulado y agrega precisiones respecto de la versión anterior.";
    } else if (afterClean.length < beforeClean.length * 0.75) {
      observation = "La nueva redacción reduce o simplifica el contenido previamente previsto.";
    }
  }

  let politicalRelevance = "Media";
  if (/reforma|r[eé]gimen|indemniz|aporte|contribuci[oó]n|sindicat|negociaci[oó]n colectiva|justicia|despido/.test(combined)) {
    politicalRelevance = "Alta";
  } else if (/formal|procedimiento|plazo|registro/.test(combined)) {
    politicalRelevance = "Media";
  } else {
    politicalRelevance = "Baja";
  }

  return {
    category,
    legalImpact,
    practicalImpact,
    politicalRelevance,
    observation
  };
}

function deriveImpact(doc) {
  const text = (doc.text || "").toLowerCase();
  const words = countWords(doc.text || "");

  if (doc.status === "error") {
    return {
      level: "high",
      label: "posible riesgo o advertencia",
      category: "mejora estructural",
      observation: doc.note || "El archivo no pudo procesarse correctamente."
    };
  }

  if (doc.mode?.includes("OCR")) {
    return {
      level: "medium",
      label: "impacto medio",
      category: "mejora funcional",
      observation: "Se requirió OCR; conviene revisar la calidad del texto extraído."
    };
  }

  if (words > 1500 || /artículo|art\.|capítulo/.test(text)) {
    return {
      level: "high",
      label: "impacto alto",
      category: "mejora estructural",
      observation: "Documento con volumen o estructura normativa relevante."
    };
  }

  if (words > 300) {
    return {
      level: "medium",
      label: "impacto medio",
      category: "mejora funcional",
      observation: "Contenido suficiente para comparación sustantiva."
    };
  }

  return {
    level: "low",
    label: "impacto bajo",
    category: "mejora visual",
    observation: "Contenido breve o con baja complejidad documental."
  };
}
