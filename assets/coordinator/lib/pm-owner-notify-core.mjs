function parseFrontmatter(markdown) {
  const text = String(markdown || "");
  if (!text.startsWith("---\n")) {
    return {};
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return {};
  }
  const block = text.slice(4, end).trim();
  const result = {};
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

function parseSection(markdown, headings) {
  const text = String(markdown || "");
  for (const heading of headings) {
    const marker = `## ${heading}\n`;
    const start = text.indexOf(marker);
    if (start === -1) {
      continue;
    }
    const afterStart = start + marker.length;
    const rest = text.slice(afterStart);
    const nextHeading = rest.search(/\n##\s+/);
    return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
  }
  return "";
}

function parseBullets(sectionText) {
  const text = String(sectionText || "").trim();
  if (!text || text === "无" || text === "或写：无") {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function changed(beforeMeta, afterMeta, key) {
  return String(beforeMeta[key] || "") !== String(afterMeta[key] || "");
}

export function shouldNotifyOwner({ actionType, beforeStatus, afterStatus, beforeSource, afterSource }) {
  const beforeMeta = parseFrontmatter(beforeStatus);
  const afterMeta = parseFrontmatter(afterStatus);
  const reasons = [];

  if (actionType === "status_updated") {
    if (changed(beforeMeta, afterMeta, "stage")) {
      reasons.push("stage_changed");
    }
    if (changed(beforeMeta, afterMeta, "frontend_status")) {
      reasons.push("frontend_status_changed");
    }
    if (changed(beforeMeta, afterMeta, "backend_status")) {
      reasons.push("backend_status_changed");
    }
    if (changed(beforeMeta, afterMeta, "needs_owner_action")) {
      reasons.push("needs_owner_action_changed");
    }
  }

  if (actionType === "demo_updated") {
    const beforeText = String(beforeSource || "").trim();
    const afterText = String(afterSource || "").trim();
    if (afterText && beforeText !== afterText) {
      reasons.push("demo_updated");
    }
  }

  return {
    shouldNotify: reasons.length > 0,
    reasons,
    beforeMeta,
    afterMeta,
  };
}

function humanizeStage(stage) {
  const map = {
    new: "项目刚建立",
    clarification_pending: "需求澄清中",
    ready_for_handoff: "已准备发开发任务",
    frontend_in_progress: "前端推进中",
    backend_in_progress: "后端推进中",
    blocked: "当前存在阻塞",
    ready_for_demo: "已可准备演示",
    iterating: "正在迭代中",
    done: "当前轮已完成",
  };
  return map[stage] || stage || "状态未明确";
}

function humanizeRole(label, status) {
  const map = {
    idle: "尚未开始",
    waiting_receipt: "已发任务，等待正式回执",
    blocked: "当前受阻",
    in_progress: "正在推进",
    done: "当前轮已完成",
  };
  return `${label}${map[status] || status || "状态未明确"}`;
}

function pickProjectStatusBullets(afterStatus) {
  const progressItems = parseBullets(parseSection(afterStatus, ["当前进展", "已推进内容"]));
  const blockingQuestions = parseBullets(parseSection(afterStatus, ["阻塞性未确认问题"]));
  const openQuestions = parseBullets(parseSection(afterStatus, ["未确认问题", "待确认问题"]));
  const nextSteps = parseBullets(parseSection(afterStatus, ["下一步"]));

  return {
    progressItems,
    questionItems: blockingQuestions.length > 0 ? blockingQuestions : openQuestions,
    nextSteps,
  };
}

function pickDemoBullets(afterSource) {
  const progressItems = [
    ...parseBullets(parseSection(afterSource, ["当前可展示内容"])),
    ...parseBullets(parseSection(afterSource, ["本轮交付清单"])),
    ...parseBullets(parseSection(afterSource, ["本轮主要变化"])),
  ];
  const issueItems = [
    ...parseBullets(parseSection(afterSource, ["当前仍未解决的问题"])),
    ...parseBullets(parseSection(afterSource, ["已知限制"])),
  ];
  const nextSteps = parseBullets(parseSection(afterSource, ["下一步"]));

  return {
    progressItems,
    questionItems: issueItems,
    nextSteps,
  };
}

function uniq(items) {
  return [...new Set(items)];
}

export function buildOwnerNotifyMessage({ projectId, actionType, afterStatus, afterSource }) {
  const meta = parseFrontmatter(afterStatus);
  const statusItems = [
    `项目：${projectId}`,
    `当前阶段：${humanizeStage(String(meta.stage || ""))}`,
    humanizeRole("前端：", String(meta.frontend_status || "")),
    humanizeRole("后端：", String(meta.backend_status || "")),
  ];

  const projectStatusBullets = pickProjectStatusBullets(afterStatus);
  const demoBullets = actionType === "demo_updated" ? pickDemoBullets(afterSource) : null;

  const progressItems = demoBullets
    ? uniq([...demoBullets.progressItems, ...projectStatusBullets.progressItems])
    : projectStatusBullets.progressItems;
  const questionItems = demoBullets
    ? uniq([...projectStatusBullets.questionItems, ...demoBullets.questionItems])
    : projectStatusBullets.questionItems;
  const nextSteps = demoBullets
    ? uniq([...demoBullets.nextSteps, ...projectStatusBullets.nextSteps])
    : projectStatusBullets.nextSteps;

  return [
    "当前状态",
    ...statusItems.map((item) => `- ${item}`),
    "",
    "已推进内容",
    ...(progressItems.length > 0 ? progressItems.map((item) => `- ${item}`) : ["- 已完成本轮状态更新"]),
    "",
    "待确认问题",
    ...(questionItems.length > 0 ? questionItems.map((item) => `- ${item}`) : ["- 暂无阻塞性待确认问题"]),
    "",
    "下一步",
    ...(nextSteps.length > 0 ? nextSteps.map((item) => `- ${item}`) : ["- 按当前项目状态继续推进"]),
  ].join("\n");
}

export function buildFollowupStatusMessage({ projectId, afterStatus, reason = "visibility_gap", waitingRoles = [] }) {
  const meta = parseFrontmatter(afterStatus);
  const { progressItems, questionItems, nextSteps } = pickProjectStatusBullets(afterStatus);
  const effectiveNextSteps =
    reason === "receipt_timeout" && waitingRoles.length > 0
      ? [
          `继续等待${waitingRoles.includes("frontend") && waitingRoles.includes("backend") ? "前后端" : waitingRoles.includes("frontend") ? "前端" : "后端"}正式回执`,
          ...nextSteps,
        ]
      : nextSteps;
  const effectiveProgress =
    reason === "receipt_timeout" && waitingRoles.length > 0
      ? [...progressItems, `当前仍在等待${waitingRoles.includes("frontend") && waitingRoles.includes("backend") ? "前后端" : waitingRoles.includes("frontend") ? "前端" : "后端"}回执`]
      : progressItems;

  return [
    "当前状态",
    `- 项目：${projectId}`,
    `- 当前阶段：${humanizeStage(String(meta.stage || ""))}`,
    `- ${humanizeRole("前端：", String(meta.frontend_status || ""))}`,
    `- ${humanizeRole("后端：", String(meta.backend_status || ""))}`,
    "",
    "已推进内容",
    ...(effectiveProgress.length > 0 ? effectiveProgress.slice(0, 3).map((item) => `- ${item}`) : ["- 当前按既定节奏推进中"]),
    "",
    "待确认问题",
    ...(questionItems.length > 0 ? questionItems.slice(0, 3).map((item) => `- ${item}`) : ["- 暂无新的阻塞性待确认问题"]),
    "",
    "下一步",
    ...(effectiveNextSteps.length > 0 ? effectiveNextSteps.slice(0, 2).map((item) => `- ${item}`) : ["- 继续按当前项目状态推进"]),
  ].join("\n");
}
