import { getLastResult } from "../lib/state.js";
import { api } from "../lib/api.js";
import { renderError } from "./results.js";

function buildGoogleDocsExportPayload({ title = "", url = "", summary = "" }) {
  return {
    title: title || "AI 网页助手总结",
    url: url || "",
    summary: summary || "",
  };
}

async function exportResultToGoogleDocs(button, input) {
  button.disabled = true;
  const originalIcon = button.innerHTML;
  button.innerHTML = `<div class="spinner-mini"></div>`;

  try {
    const data = await api.exportGoogleDocs(buildGoogleDocsExportPayload(input));
    button.innerHTML = `<svg class="icon" style="color:var(--success)" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    if (data.url) {
      window.open(data.url, "_blank");
    }
  } catch (err) {
    button.innerHTML = originalIcon;
    renderError(err.message || "导出 Google Docs 失败");
  } finally {
    button.disabled = false;
  }
}

export function initGoogleDocsExport() {
  document.addEventListener("aiWebAssistant:result-card-rendered", (event) => {
    const { card, summary, context = {} } = event.detail || {};
    const actions = card?.querySelector?.(".result-actions");
    if (!actions || actions.querySelector(".google-docs-export-btn")) return;

    const lastResult = getLastResult();
    const button = document.createElement("button");
    button.className = "mini-action-btn google-docs-export-btn";
    button.type = "button";
    button.title = "导出 Google Docs";
    button.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <path d="M14 2v6h6"></path>
        <path d="M8 13h8"></path>
        <path d="M8 17h5"></path>
      </svg>
    `;

    button.addEventListener("click", () => {
      exportResultToGoogleDocs(button, {
        title: context.title || lastResult?.title || "AI 网页助手总结",
        url: context.url || lastResult?.url || "",
        summary,
      });
    });

    actions.appendChild(button);
  });
}

export const __googleDocsExportInternals = {
  buildGoogleDocsExportPayload,
};
