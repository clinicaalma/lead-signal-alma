// CRM: atualiza um lead (etapa, profissional, protocolo, valor, notas, datas).
// Quando o lead vai para "fechou" com valor, manda o evento de Compra para o Meta (CAPI), uma vez só.
import { NextResponse } from "next/server";
import config from "../../../../config/quiz.json";
import { senhaOk, supabase, ETAPAS, PROTOCOLOS, CAMPOS_PUBLICOS } from "../../../../lib/painel";
import { sendCapiEvent } from "../../../../lib/capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataOuNull = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const textoOuNull = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!senhaOk(body.senha)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
  }
  const db = supabase();
  if (!db) return NextResponse.json({ erro: "Supabase não configurado na Netlify" }, { status: 500 });

  const { id, mudancas = {} } = body;
  if (typeof id !== "string" || !/^[0-9a-f-]{8,}$/i.test(id)) {
    return NextResponse.json({ erro: "Lead inválido" }, { status: 400 });
  }

  // Só aceita campos conhecidos, já limpos.
  const upd = {};
  if ("etapa" in mudancas) {
    if (!ETAPAS.includes(mudancas.etapa)) return NextResponse.json({ erro: "Etapa inválida" }, { status: 400 });
    upd.etapa = mudancas.etapa;
  }
  if ("responsavel" in mudancas) upd.responsavel = textoOuNull(mudancas.responsavel, 60);
  if ("protocolo" in mudancas) upd.protocolo = PROTOCOLOS.includes(mudancas.protocolo) ? mudancas.protocolo : null;
  if ("notas" in mudancas) upd.notas = textoOuNull(mudancas.notas, 5000);
  if ("motivo_perda" in mudancas) upd.motivo_perda = textoOuNull(mudancas.motivo_perda, 200);
  if ("proximo_contato" in mudancas) upd.proximo_contato = dataOuNull(mudancas.proximo_contato);
  if ("data_reposicao" in mudancas) upd.data_reposicao = dataOuNull(mudancas.data_reposicao);
  if ("valor_pedido" in mudancas) {
    const bruto = String(mudancas.valor_pedido ?? "").replace(/[R$\s]/g, "");
    const n = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
    upd.valor_pedido = mudancas.valor_pedido === "" || mudancas.valor_pedido == null ? null : Number.isFinite(n) && n >= 0 ? n : null;
  }
  upd.atualizado_em = new Date().toISOString();

  try {
    const filtro = `id=eq.${id}&cliente_id=eq.${encodeURIComponent(config.cliente_id)}`;
    const [antes] = await db.get(`leads?select=*&${filtro}`);
    if (!antes) return NextResponse.json({ erro: "Lead não encontrado" }, { status: 404 });

    if (upd.etapa === "fechou" && antes.etapa !== "fechou") upd.fechado_em = new Date().toISOString();
    if (upd.etapa && upd.etapa !== "fechou") upd.fechado_em = null;

    let [depois] = await db.patch(`leads?${filtro}&select=*`, upd);

    // Evento de Compra: lead fechado, com valor, ainda não enviado.
    let compra = null;
    const valor = Number(depois.valor_pedido);
    if (depois.etapa === "fechou" && valor > 0 && !depois.evento_compra_enviado) {
      const token = process.env.META_CAPI_TOKEN;
      if (!token || !process.env.META_PIXEL_ID) {
        compra = { enviado: false, erro: "META_CAPI_TOKEN ou META_PIXEL_ID não configurado" };
      } else {
        try {
          await sendCapiEvent({
            pixelId: process.env.META_PIXEL_ID,
            accessToken: token,
            eventName: "Purchase",
            eventId: `${depois.event_id}-p`,
            eventSourceUrl: process.env.URL || undefined,
            telefoneE164: depois.telefone,
            nome: depois.respostas?.nome,
            fbp: depois.fbp,
            fbc: depois.fbc,
            clientIp: depois.client_ip_address,
            clientUserAgent: depois.client_user_agent,
            customData: { value: valor, currency: "BRL", content_name: "Protocolo Clínica Alma" },
          });
          [depois] = await db.patch(`leads?${filtro}&select=*`, { evento_compra_enviado: true });
          compra = { enviado: true };
        } catch (e) {
          console.error("[crm] compra", e.message);
          compra = { enviado: false, erro: "Não foi possível enviar a compra pro Meta agora. Ela será reenviada no próximo salvamento deste lead." };
        }
      }
    }

    const publico = Object.fromEntries(CAMPOS_PUBLICOS.split(",").map((k) => [k, depois[k]]));
    return NextResponse.json({ lead: publico, compra });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
