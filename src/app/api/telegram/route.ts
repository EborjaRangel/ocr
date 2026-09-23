import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { getChatCoyoBot } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Falta TELEGRAM_BOT_TOKEN" },
      { status: 503 },
    );
  }
  const handle = webhookCallback(getChatCoyoBot(), "std/http");
  return handle(request);
}

export async function GET(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const setupKey = process.env.TELEGRAM_SETUP_KEY;
  const url = new URL(request.url);
  if (!token || !webhookUrl) {
    return NextResponse.json({
      ok: false,
      bot: "ChatCoyo",
      hint: "Define TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_URL",
    });
  }
  if (setupKey && url.searchParams.get("key") !== setupKey) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  const data = (await response.json()) as unknown;
  return NextResponse.json({ ok: true, bot: "ChatCoyo", webhook: data });
}
