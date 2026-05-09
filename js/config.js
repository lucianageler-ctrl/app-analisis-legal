export const MAX_FILE_SIZE_MB = 100; // Límite aumentado (NOTA: Vercel bloqueará subidas >4.5MB en producción)
export const MAX_PDF_PAGES = 500;
export const NATIVE_TEXT_THRESHOLD = 120;
export const STORAGE_KEY = "doc-extractor-compare-v1";

export const extractionCache = new Map();

export const state = {
  docs: [],
  selectedPreviewId: null
};
