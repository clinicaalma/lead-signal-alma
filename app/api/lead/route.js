// Lead Signal OAGM: recebe o quiz, recalcula score/gates, grava no Supabase
// e dispara Lead + LeadQualificado via Conversions API (mesmos event_id do Pixel).
import { NextResponse } from "next/server";
import config from "../../../config/quiz.json";
import { avaliar, respostasValidas, normalizarTelefone } from "../../../lib/scoring";
import { sendCapiEvent } from "../../../lib/capi";

export const runtime = "nodejs";

const CAMPOS_ORIGEM = ["origem", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"];

async function salvarNoSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { pulado: true };
  const inserir = (dados) =>
    fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(dados),
    });
  let res = await inserir(lead);
  // Se as colunas de origem ainda não existem no banco, salva o lead sem elas (nunca perde lead).
  if (!res.ok && res.status === 400) {
    const texto = await res.text();
    if (/utm_|origem|referrer/.test(texto)) {
      const semOrigem = { ...lead };
      CAMPOS_ORIGEM.forEach((k) => delete semOrigem[k]);
      res = await inserir(semOrigem);
      if (res.ok) {
        console.error("[lead-signal] colunas de origem ausentes: rode supabase/utm.sql");
        return { ok: true };
      }
    } else {
      throw new Error(`Supabase 400: ${texto}`);
    }
  }
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return { ok: true };
}

const limpo = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Rótulo legível da origem, pra filtrar no CRM.
function rotuloOrigem({ utm_source, utm_medium, referrer }, fbclid) {
  const src = (utm_source || "").toLowerCase();
  const med = (utm_medium || "").toLowerCase();
  const pago = /paid|cpc|ads|pago|anuncio/.test(med);
  if (/facebook|fb|instagram|ig|meta/.test(src)) return pago || !med ? "Meta Ads" : `Meta (${utm_medium})`;
  if (utm_source) return utm_medium ? `${utm_source} / ${utm_medium}` : utm_source;
  if (fbclid) return "Facebook/Instagram";
  const ref = (referrer || "").toLowerCase();
  if (ref.includes("instagram")) return "Instagram (orgânico)";
  if (ref.includes("facebook")) return "Facebook (orgânico)";
  if (ref.includes("google")) return "Google";
  if (ref) return "Outro site";
  return "Direto";
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const { respostas, contato = {}, consentimento, eventId, fbp, fbc, fbclid, url, origem: origemBruta } = body || {};
  const o = origemBruta && typeof origemBruta === "object" ? origemBruta : {};
  const origem = {
    utm_source: limpo(o.utm_source),
    utm_medium: limpo(o.utm_medium),
    utm_campaign: limpo(o.utm_campaign),
    utm_content: limpo(o.utm_content),
    utm_term: limpo(o.utm_term),
    referrer: limpo(o.referrer, 300),
  };
  origem.origem = rotuloOrigem(origem, fbclid);
  if (!respostasValidas(config, respostas) || !eventId || typeof eventId !== "string") {
    return NextResponse.json({ erro: "Respostas incompletas" }, { status: 400 });
  }
  const telefone = normalizarTelefone(contato.whatsapp);
  if (!telefone) return NextResponse.json({ erro: "WhatsApp inválido" }, { status: 400 });
  if (consentimento !== true) return NextResponse.json({ erro: "Consentimento obrigatório" }, { status: 400 });

  // Recalcula no servidor: o browser nunca decide sozinho quem é qualificado.
  const { score, gatesAprovados, qualificado } = avaliar(config, respostas);

  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
  const clientUserAgent = req.headers.get("user-agent") || undefined;
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;

  const lead = {
    cliente_id: config.cliente_id,
    event_id: eventId,
    telefone,
    respostas: { ...respostas, nome: limpo(contato.nome, 120) },
    score,
    gates_aprovados: gatesAprovados,
    qualificado,
    consentimento: true,
    consentimento_em: new Date().toISOString(),
    fbp: fbp || null,
    fbc: fbc || null,
    fbclid: fbclid || null,
    client_ip_address: clientIp || null,
    client_user_agent: clientUserAgent || null,
    evento_lead_enviado: false,
    evento_qualificado_enviado: false,
    ...origem,
  };

  const comum = {
    pixelId,
    accessToken,
    eventSourceUrl: typeof url === "string" ? url : undefined,
    telefoneE164: telefone,
    nome: contato.nome,
    fbp,
    fbc,
    clientIp,
    clientUserAgent,
  };
  // Nada de respostas do quiz no Meta: a área que incomoda é dado de saúde (LGPD e regras do Meta).
  const customData = { score };

  const erros = [];
  if (!accessToken || !pixelId) {
    erros.push("META_CAPI_TOKEN ou META_PIXEL_ID não configurado");
  } else {
    try {
      await sendCapiEvent({ ...comum, eventName: config.nome_evento_lead, eventId, customData });
      lead.evento_lead_enviado = true;
    } catch (e) {
      erros.push(e.message);
    }
    if (qualificado) {
      try {
        await sendCapiEvent({ ...comum, eventName: config.nome_evento_qualificado, eventId: `${eventId}-q`, customData });
        lead.evento_qualificado_enviado = true;
      } catch (e) {
        erros.push(e.message);
      }
    }
  }

  try {
    await salvarNoSupabase(lead);
  } catch (e) {
    erros.push(e.message);
  }

  if (erros.length) console.error("[lead-signal]", erros);
  return NextResponse.json({ ok: true, qualificado, gatesAprovados });
}
