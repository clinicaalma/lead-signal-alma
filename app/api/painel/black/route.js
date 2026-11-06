// Painel Black Alma: resumo (visitas, cliques, origens, membros) e gravação manual do total de membros.
import { NextResponse } from "next/server";
import { senhaOk } from "../../../../lib/painel";
import { resumo, inserir, evolutionConfigurada } from "../../../../lib/black";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!senhaOk(body.senha)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
  }

  try {
    if (body.acao === "membros") {
      const total = Number(String(body.total ?? "").replace(/\D/g, ""));
      if (String(body.total ?? "").trim() === "" || !Number.isInteger(total) || total < 0 || total > 1_000_000) {
        return NextResponse.json({ erro: "Digite um número de membros válido" }, { status: 400 });
      }
      await inserir("black_grupo_snapshots", { total_membros: total, origem: "manual" });
    }
    const dados = await resumo();
    return NextResponse.json({ ...dados, evolution: evolutionConfigurada() });
  } catch (e) {
    const msg = /black_resumo|black_/.test(e.message) ? `${e.message} (rode o supabase/black.sql)` : e.message;
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
