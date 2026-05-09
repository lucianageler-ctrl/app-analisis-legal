export const MAX_FILE_SIZE_MB = 3.3; // Límite por Vercel Serverless (4.5MB máximo, y el base64 infla ~33%)
export const MAX_PDF_PAGES = 500;
export const NATIVE_TEXT_THRESHOLD = 120;
export const STORAGE_KEY = "doc-extractor-compare-v1";

export const extractionCache = new Map();

export const state = {
  docs: [],
  selectedPreviewId: null
};
