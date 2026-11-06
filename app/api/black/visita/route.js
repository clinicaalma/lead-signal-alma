// Black Alma: grava a visita na /black (chega por sendBeacon, ninguém espera a resposta).
import { NextResponse } from "next/server";
import { inserir, lerCorpo, camposRastreio } from "../../../../lib/black";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await lerCorpo(req);
  try {
    await inserir("black_visitas", camposRastreio(body, req));
  } catch (e) {
    console.error("[black] visita", e.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
