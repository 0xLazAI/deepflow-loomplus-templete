type SendTelegramMessageOptions = {
  token: string;
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
};

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
};

export async function sendTelegramMessage(options: SendTelegramMessageOptions): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: options.chatId,
    text: options.text,
  };
  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  const response = await fetch(`https://api.telegram.org/bot${options.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => ({}))) as TelegramApiResponse;
  if (!response.ok || json.ok !== true) {
    throw new Error(json.description || `Telegram sendMessage failed with status ${response.status}`);
  }
}

export function buildTelegramUserMention(userId: string, label: string): string {
  return `<a href="tg://user?id=${escapeHtml(userId)}">${escapeHtml(label)}</a>`;
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
