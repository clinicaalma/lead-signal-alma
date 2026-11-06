"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../painel.css";
import "./black-painel.css";

const TZ = "America/Sao_Paulo";
const ATUALIZAR_MS = 60_000;
// Cores validadas (scripts/validate_palette.js do dataviz) contra o fundo #382215, inclusive daltonismo.
const COR = { visitas: "#C47F33", cliques: "#3E9BD6", membros: "#4FA36B" };

const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const fmtDia = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");
const fmtHora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtN = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));
const pct = (a, b) => (b ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");
const somaDia = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function lerSenhaSalva() {
  try { return sessionStorage.getItem("crm_senha") || ""; } catch { return ""; }
}
function salvarSenha(s) {
  try { sessionStorage.setItem("crm_senha", s); } catch {}
}

// Junta visitas/cliques/membros numa linha por dia, do primeiro dia com dado até hoje.
function montarDias(dados) {
  const hoje = hojeISO();
  const porDia = Object.fromEntries((dados.dias || []).map((d) => [d.dia, d]));
  const membrosDia = Object.fromEntries((dados.membros_dia || []).map((m) => [m.dia, m.total_membros]));
  const todas = [...Object.keys(porDia), ...Object.keys(membrosDia)].sort();
  if (!todas.length) return [];
  const linhas = [];
  let membros = null; // repete o último total conhecido nos dias sem fotografia
  for (let dia = todas[0]; dia <= hoje; dia = somaDia(dia, 1)) {
    if (dia in membrosDia) membros = membrosDia[dia];
    linhas.push({ dia, visitas: porDia[dia]?.visitas || 0, cliques: porDia[dia]?.cliques || 0, membros });
  }
  return linhas;
}

export default function PainelBlack() {
  const [senha, setSenha] = useState("");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const senhaRef = useRef("");

  async function chamar(extra = {}, s = senhaRef.current) {
    const res = await fetch("/api/painel/black", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: s, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.erro || "Erro ao carregar");
    return json;
  }

  async function carregar(s = senhaRef.current) {
    setErro("");
    setCarregando(true);
    try {
      const json = await chamar({}, s);
      senhaRef.current = s;
      salvarSenha(s);
      setDados(json);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const s = lerSenhaSalva();
    if (s) { setSenha(s); carregar(s); }
  }, []);

  // Atualização automática a cada 60 s (só depois de entrar).
  const logado = !!dados;
  useEffect(() => {
    if (!logado) return;
    const id = setInterval(() => carregar(), ATUALIZAR_MS);
    return () => clearInterval(id);
  }, [logado]);

  async function salvarMembros(total) {
    const json = await chamar({ acao: "membros", total });
    setDados(json);
    setAtualizadoEm(new Date());
  }

  const dias = useMemo(() => (dados ? montarDias(dados) : []), [dados]);

  if (!dados) {
    return (
      <main className="tela">
        <section className="cartao">
          <img className="logo" src="/logo.png" alt="Clínica Alma" />
          <span className="selo">Black Alma · Painel</span>
          <h2>Entre com a senha</h2>
          <form onSubmit={(e) => { e.preventDefault(); carregar(senha); }} className="form">
            <input className="campo" type="password" value={senha} autoFocus onChange={(e) => setSenha(e.target.value)} placeholder="Senha do CRM" />
            {erro ? <p className="erro">{erro}</p> : null}
            <button className="botao" disabled={carregando || !senha}>{carregando ? "Entrando..." : "Entrar"}</button>
          </form>
        </section>
      </main>
    );
  }

  const hoje = hojeISO();
  const totalVisitas = dias.reduce((s, d) => s + d.visitas, 0);
  const totalCliques = dias.reduce((s, d) => s + d.cliques, 0);
  const diaHoje = dias.find((d) => d.dia === hoje) || { visitas: 0, cliques: 0 };

  const ultimo = dados.ultimo_snapshot;
  const membrosDia = dados.membros_dia || [];
  const snapHoje = membrosDia.find((m) => m.dia === hoje);
  const snapAntes = [...membrosDia].reverse().find((m) => m.dia < hoje);
  const novosHoje = snapHoje && snapAntes ? snapHoje.total_membros - snapAntes.total_membros : null;
  const rotuloNovos = snapAntes && snapAntes.dia !== somaDia(hoje, -1) ? `novos hoje (vs ${fmtDia(snapAntes.dia)})` : "novos membros hoje";

  return (
    <main className="painel">
      <header className="painel-topo">
        <div>
          <h1>Black Alma</h1>
          <p className="sub">Página /black → grupo VIP do WhatsApp. Atualiza sozinho a cada minuto.</p>
        </div>
        <div className="painel-acoes">
          <a className="botao-sec" href="/painel">← CRM</a>
          <button className="botao-sec" onClick={() => carregar()}>{carregando ? "Atualizando..." : "Atualizar"}</button>
        </div>
      </header>
      {erro ? <p className="erro bp-erro">{erro}</p> : null}

      <section className="numeros bp-numeros">
        <div className="numero"><span>{fmtN(totalVisitas)}</span><small>visitas · {fmtN(diaHoje.visitas)} hoje</small></div>
        <div className="numero"><span>{fmtN(totalCliques)}</span><small>cliques no botão · {fmtN(diaHoje.cliques)} hoje</small></div>
        <div className="numero"><span>{pct(totalCliques, totalVisitas)}</span><small>visita → clique</small></div>
        <div className="numero destaque">
          <span>{fmtN(ultimo?.total_membros)}</span>
          <small>membros no grupo agora{ultimo ? ` · ${fmtHora(ultimo.created_at)}${ultimo.origem === "manual" ? " (manual)" : ""}` : ""}</small>
        </div>
        <div className="numero">
          <span>{novosHoje == null ? "—" : `${novosHoje > 0 ? "+" : ""}${fmtN(novosHoje)}`}</span>
          <small>{rotuloNovos}</small>
        </div>
      </section>

      {!dados.evolution ? <MembrosManual onSalvar={salvarMembros} /> : null}

      <section className="bp-graficos">
        <div className="bp-grafico">
          <h3>Visitas e cliques por dia</h3>
          <Grafico
            dias={dias}
            series={[
              { id: "visitas", nome: "Visitas", cor: COR.visitas },
              { id: "cliques", nome: "Cliques", cor: COR.cliques },
            ]}
          />
        </div>
        <div className="bp-grafico">
          <h3>Membros no grupo</h3>
          <Grafico dias={dias} series={[{ id: "membros", nome: "Membros", cor: COR.membros }]} />
        </div>
      </section>

      <section className="bp-secao">
        <h3>Por anúncio (utm_content)</h3>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Anúncio</th><th>Visitas</th><th>Cliques</th><th>Taxa</th></tr></thead>
            <tbody className="sem-clique">
              {(dados.origens || []).map((o) => (
                <tr key={o.utm_content ?? "__sem"}>
                  <td><strong>{o.utm_content || "Sem utm_content"}</strong></td>
                  <td>{fmtN(o.visitas)}</td>
                  <td>{fmtN(o.cliques)}</td>
                  <td>{pct(o.cliques, o.visitas)}</td>
                </tr>
              ))}
              {!(dados.origens || []).length ? <tr><td colSpan={4} className="vazio">Nenhuma visita ainda</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <details className="respostas bp-secao">
        <summary>Números por dia (tabela)</summary>
        <div className="tabela-wrap bp-tabela-dias">
          <table className="tabela">
            <thead><tr><th>Dia</th><th>Visitas</th><th>Cliques</th><th>Taxa</th><th>Membros</th></tr></thead>
            <tbody className="sem-clique">
              {[...dias].reverse().map((d) => (
                <tr key={d.dia}>
                  <td>{fmtDia(d.dia)}</td><td>{fmtN(d.visitas)}</td><td>{fmtN(d.cliques)}</td><td>{pct(d.cliques, d.visitas)}</td><td>{fmtN(d.membros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {atualizadoEm ? <p className="bp-rodape">Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { timeZone: TZ })}</p> : null}
    </main>
  );
}

function MembrosManual({ onSalvar }) {
  const [valor, setValor] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setMsg("");
    setSalvando(true);
    try {
      await onSalvar(valor);
      setValor("");
      setMsg("Salvo ✓");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="bp-manual" onSubmit={salvar}>
      <label htmlFor="bp-membros">Membros no grupo agora</label>
      <input id="bp-membros" className="campo" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 230" />
      <button className="botao-sec" disabled={salvando || !valor}>{salvando ? "Salvando..." : "Salvar"}</button>
      {msg ? <span className="bp-msg">{msg}</span> : null}
    </form>
  );
}

// Gráfico de linhas em SVG: um eixo só, linhas de 2px, legenda, rótulo direto no último ponto
// e tooltip com cruz ao passar o mouse/dedo.
function Grafico({ dias, series }) {
  const caixa = useRef(null);
  const [largura, setLargura] = useState(600);
  const [foco, setFoco] = useState(null);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(260, el.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const temDado = dias.some((d) => series.some((s) => d[s.id] != null && d[s.id] > 0));
  if (!dias.length || !temDado) {
    return <div ref={caixa} className="bp-vazio">{series[0].id === "membros" ? "Nenhuma contagem de membros ainda" : "Nenhuma visita ainda"}</div>;
  }

  const A = 220;
  const m = { t: 14, r: 64, b: 26, l: 40 };
  const w = largura - m.l - m.r;
  const h = A - m.t - m.b;
  const maxBruto = Math.max(1, ...dias.flatMap((d) => series.map((s) => d[s.id] ?? 0)));
  const passo = Math.pow(10, Math.floor(Math.log10(maxBruto)));
  const max = Math.ceil(maxBruto / passo) * passo || 1;
  const n = dias.length;
  const x = (i) => m.l + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v) => m.t + h - (v / max) * h;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const cadaX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));

  const caminho = (id) => {
    let d = "";
    let caneta = false;
    dias.forEach((p, i) => {
      if (p[id] == null) { caneta = false; return; }
      d += `${caneta ? "L" : "M"}${x(i).toFixed(1)},${y(p[id]).toFixed(1)}`;
      caneta = true;
    });
    return d;
  };

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX ?? e.touches?.[0]?.clientX) - r.left;
    const i = n === 1 ? 0 : Math.round(((px - m.l) / w) * (n - 1));
    setFoco(Math.min(n - 1, Math.max(0, i)));
  }

  const pf = foco != null ? dias[foco] : null;

  return (
    <div ref={caixa} className="bp-svg-caixa">
      {series.length > 1 ? (
        <div className="bp-legenda">
          {series.map((s) => <span key={s.id}><i style={{ background: s.cor }} />{s.nome}</span>)}
        </div>
      ) : null}
      <svg width={largura} height={A} role="img" aria-label={`${series.map((s) => s.nome).join(" e ")} por dia`}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} className="bp-grade" />
            <text x={m.l - 8} y={y(v)} className="bp-eixo" textAnchor="end" dominantBaseline="middle">{fmtN(v)}</text>
          </g>
        ))}
        {dias.map((d, i) => (i % cadaX === 0 || i === n - 1 ? (
          <text key={d.dia} x={x(i)} y={A - 6} className="bp-eixo" textAnchor="middle">{fmtDia(d.dia)}</text>
        ) : null))}

        {pf ? <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={m.t + h} className="bp-cruz" /> : null}

        {series.map((s) => {
          const ultimoI = dias.map((d) => d[s.id]).findLastIndex((v) => v != null);
          return (
            <g key={s.id}>
              <path d={caminho(s.id)} fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {ultimoI >= 0 ? (
                <>
                  <circle cx={x(ultimoI)} cy={y(dias[ultimoI][s.id])} r="4" fill={s.cor} stroke="var(--cartao)" strokeWidth="2" />
                  <text x={x(ultimoI) + 9} y={y(dias[ultimoI][s.id])} className="bp-rotulo" dominantBaseline="middle">
                    {fmtN(dias[ultimoI][s.id])}{series.length > 1 ? ` ${s.nome.toLowerCase()}` : ""}
                  </text>
                </>
              ) : null}
              {pf && pf[s.id] != null ? (
                <circle cx={x(foco)} cy={y(pf[s.id])} r="5" fill={s.cor} stroke="var(--cartao)" strokeWidth="2" />
              ) : null}
            </g>
          );
        })}

        <rect x={m.l - 10} y={0} width={w + 20} height={A} fill="transparent"
          onMouseMove={mover} onTouchStart={mover} onTouchMove={mover} onMouseLeave={() => setFoco(null)} />
      </svg>
      {pf ? (
        <div className="bp-tooltip" style={{ left: Math.min(largura - 150, Math.max(0, x(foco) + 12)) }}>
          <strong>{fmtDia(pf.dia)}</strong>
          {series.map((s) => (
            <span key={s.id}><i style={{ background: s.cor }} />{s.nome}: {fmtN(pf[s.id])}</span>
          ))}
          {series.length > 1 ? <span className="bp-tooltip-extra">Taxa: {pct(pf.cliques, pf.visitas)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
