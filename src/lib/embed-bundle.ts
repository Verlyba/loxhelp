import { unzipSync } from "fflate";

// Supported subset: a single-page HTML/CSS/JS widget, or a .zip with one
// index.html plus local .css/.js/image files referenced by relative path.
// No bundlers, no external network requests, no multi-page navigation — the
// result always renders inside one fixed-size sandboxed iframe.
export const MAX_ZIP_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** Composes a self-contained HTML document from separately-authored HTML/CSS/JS. */
export function composeCodeEmbed(html: string, css: string, js: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="cs"><head><meta charset="utf-8" />',
    css.trim() ? `<style>${css}</style>` : "",
    "</head><body>",
    html,
    js.trim() ? `<script>${js}</script>` : "",
    "</body></html>",
  ].join("\n");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : "";
}

/** Resolves a relative href/src against the zip's flat file map, ignoring a leading "./". */
function resolveZipPath(files: Record<string, Uint8Array>, from: string): string | null {
  const cleaned = from.replace(/^\.\//, "").replace(/^\//, "");
  if (cleaned.includes("..")) return null;
  return cleaned in files ? cleaned : null;
}

/**
 * Unpacks a teacher-uploaded .zip (one index.html + local css/js/images) into
 * a single self-contained HTML document: relative <link rel="stylesheet">
 * and <script src> are inlined, and image references become data: URIs.
 * Throws a Czech, user-facing message on anything unsupported (no index.html,
 * path traversal, oversized input).
 */
export function bundleZipToHtml(zipBytes: Uint8Array): string {
  if (zipBytes.byteLength > MAX_ZIP_BYTES) {
    throw new Error("ZIP je příliš velký (max. 5 MB).");
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new Error("Soubor se nepodařilo rozbalit — není to platný .zip.");
  }

  const files: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) continue; // directory entry
    const cleaned = name.replace(/^\/+/, "");
    if (cleaned.includes("..")) {
      throw new Error("ZIP obsahuje nepovolenou cestu k souboru.");
    }
    files[cleaned] = data;
  }

  // Accept index.html at the zip root, or one folder deep (a common "export
  // wrapped my-site/index.html" shape).
  const indexPath =
    Object.keys(files).find((p) => p === "index.html") ??
    Object.keys(files).find((p) => /^[^/]+\/index\.html$/.test(p));
  if (!indexPath) {
    throw new Error("ZIP musí obsahovat index.html (v kořeni nebo v jedné složce).");
  }
  const baseDir = indexPath.includes("/") ? indexPath.slice(0, indexPath.lastIndexOf("/") + 1) : "";

  let html = Buffer.from(files[indexPath]).toString("utf-8");

  html = html.replace(
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (full, href: string) => {
      const path = resolveZipPath(files, baseDir + href) ?? resolveZipPath(files, href);
      if (!path) return full;
      return `<style>${Buffer.from(files[path]).toString("utf-8")}</style>`;
    },
  );

  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (full, _before: string, src: string) => {
      const path = resolveZipPath(files, baseDir + src) ?? resolveZipPath(files, src);
      if (!path) return full;
      return `<script>${Buffer.from(files[path]).toString("utf-8")}</script>`;
    },
  );

  html = html.replace(/\b(src|href)=["']([^"']+)["']/gi, (full, attr: string, ref: string) => {
    if (/^(https?:|data:|#)/i.test(ref)) return full;
    const path = resolveZipPath(files, baseDir + ref) ?? resolveZipPath(files, ref);
    if (!path) return full;
    const mime = MIME_BY_EXT[extOf(path)];
    if (!mime) return full; // leave non-image refs (already-inlined css/js) alone
    return `${attr}="data:${mime};base64,${toBase64(files[path])}"`;
  });

  return html;
}
