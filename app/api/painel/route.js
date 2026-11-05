// CRM: lista os leads para quem informar a senha do painel.
import { NextResponse } from "next/server";
import config from "../../../config/quiz.json";
import { senhaOk, supabase, CAMPOS_PUBLICOS, CAMPOS_PUBLICOS_BASE } from "../../../lib/painel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!senhaOk(body.senha)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
  }
  const db = supabase();
  if (!db) return NextResponse.json({ erro: "Supabase não configurado na Netlify" }, { status: 500 });

  const consulta = (campos) =>
    db.get(`leads?select=${campos}&cliente_id=eq.${encodeURIComponent(config.cliente_id)}&order=created_at.desc&limit=2000`);
  try {
    let leads;
    try {
      leads = await consulta(CAMPOS_PUBLICOS);
    } catch (e) {
      // Colunas de origem ainda não criadas: abre o painel mesmo assim.
      if (!/utm_|origem|referrer/.test(e.message)) throw e;
      leads = await consulta(CAMPOS_PUBLICOS_BASE);
    }
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
