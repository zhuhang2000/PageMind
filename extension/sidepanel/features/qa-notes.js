/**
 * QA Notes — 将问答记录转化为内容模块
 * 监听 add-qa-to-module 事件，支持单条加入和多条批量加入（合并/分别）
 */

import { addQaNoteModule } from "./content-modules.js";
import { pmChoice } from "./modal.js";

/**
 * 构建单个 QA_Note_Module 对象
 * @param {object} qaData
 * @param {string} qaData.question
 * @param {string} qaData.answer
 * @param {string} qaData.sourceUrl
 * @param {string} qaData.sourceTitle
 * @param {string[]} qaData.sourceModuleIds
 * @returns {object} QA_Note_Module
 */
function createQaNoteModule(qaData) {
  const { question = "", answer = "", sourceUrl = "", sourceTitle = "", sourceModuleIds = [] } = qaData;
  const label = question.slice(0, 30);
  const content = `问：${question}\n\n答：${answer}`;
  const preview = content.slice(0, 260);
  const charCount = content.length;

  return {
    id: `qa-${Date.now()}`,
    label,
    content,
    preview,
    charCount,
    sourceUrl,
    sourceTitle,
    isQaNote: true,
    sourceModuleIds,
  };
}

/**
 * 单条问答加入素材
 * @param {object} qaData
 * @returns {string} 新模块 ID
 */
export function addSingleQaAsModule(qaData) {
  const module = createQaNoteModule(qaData);
  return addQaNoteModule(module);
}

/**
 * 多条问答批量加入素材（弹出合并策略弹窗）
 * @param {Array<object>} qaDataArray
 */
export async function addMultipleQaAsModules(qaDataArray) {
  if (!qaDataArray || qaDataArray.length === 0) return;

  const count = qaDataArray.length;
  const choice = await pmChoice("如何加入素材？", {
    message: `已选择 ${count} 条问答记录`,
    choices: [
      { key: "merge", label: "合并为一个模块" },
      { key: "separate", label: "每条单独一个模块" },
    ],
  });

  if (!choice) return; // 用户取消

  if (choice === "merge") {
    // 合并策略：将多条格式化为一个模块
    const contentParts = qaDataArray.map((qa) => `问：${qa.question}\n\n答：${qa.answer}`);
    const content = contentParts.join("\n\n---\n\n");
    const firstQa = qaDataArray[0];
    const label = firstQa.question.slice(0, 30);
    const preview = content.slice(0, 260);
    const charCount = content.length;

    // Merge all sourceModuleIds from all items (deduplicated)
    const allSourceIds = [...new Set(qaDataArray.flatMap((qa) => qa.sourceModuleIds || []))];

    const module = {
      id: `qa-${Date.now()}`,
      label,
      content,
      preview,
      charCount,
      sourceUrl: firstQa.sourceUrl || "",
      sourceTitle: firstQa.sourceTitle || "",
      isQaNote: true,
      sourceModuleIds: allSourceIds,
    };

    addQaNoteModule(module);
  } else if (choice === "separate") {
    // 分别策略：逐条创建独立模块
    for (const qaData of qaDataArray) {
      const module = createQaNoteModule(qaData);
      addQaNoteModule(module);
    }
  }
}

/**
 * 初始化 QA Notes 事件监听
 * 监听 aiWebAssistant:add-qa-to-module 自定义事件
 */
export function initQaNotes() {
  document.addEventListener("aiWebAssistant:add-qa-to-module", (event) => {
    const { mode, qaData, qaDataArray } = event.detail || {};

    if (mode === "single" && qaData) {
      addSingleQaAsModule(qaData);
    } else if (mode === "multiple" && qaDataArray) {
      addMultipleQaAsModules(qaDataArray);
    }
  });
}
