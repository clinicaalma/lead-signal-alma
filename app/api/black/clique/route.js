// Black Alma: clique em "Entrar no grupo VIP".
// Manda Contact via Conversions API com o MESMO event_id do Pixel (deduplicação) e grava o clique.
// O navegador já foi para o grupo: esta rota nunca segura o redirect.
import { NextResponse } from "next/server";
import { sendCapiEvent } from "../../../../lib/capi";
import { inserir, lerCorpo, camposRastreio, ipDoCliente } from "../../../../lib/black";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await lerCorpo(req);
  const eventId = typeof body.eventId === "string" ? body.eventId.slice(0, 100) : "";
  if (!eventId) return NextResponse.json({ erro: "event_id ausente" }, { status: 400 });

  const rastreio = camposRastreio(body, req);
  const erros = [];

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;
  const capi = !pixelId || !accessToken
    ? Promise.reject(new Error("META_CAPI_TOKEN ou META_PIXEL_ID não configurado"))
    : sendCapiEvent({
        pixelId,
        accessToken,
        eventName: "Contact",
        eventId,
        eventSourceUrl: typeof body.url === "string" ? body.url.slice(0, 1000) : undefined,
        fbp: rastreio.fbp,
        fbc: rastreio.fbc,
        clientIp: ipDoCliente(req),
        clientUserAgent: rastreio.user_agent,
        customData: { content_name: "Grupo VIP Black Alma" },
      });

  // CAPI e Supabase em paralelo; uma falha não impede a outra.
  const [rCapi, rDb] = await Promise.allSettled([capi, inserir("black_cliques", { event_id: eventId, ...rastreio })]);
  if (rCapi.status === "rejected") erros.push(rCapi.reason.message);
  if (rDb.status === "rejected") erros.push(rDb.reason.message);
  if (erros.length) console.error("[black] clique", erros);

  return NextResponse.json({ ok: !erros.length });
}
