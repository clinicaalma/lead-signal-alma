"use client";

import { useEffect, useRef, useState } from "react";

const UTMS = ["utm_source", "utm_campaign", "utm_content"];
const ORIGEM_DIAS = 7;
const REDIRECT_MS = 250; // dá tempo do Pixel sair; sempre abaixo de 300 ms

function lerCookie(nome) {
  return document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]+)`))?.[1];
}

function novoId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// UTMs + fbclid da URL. Guarda por 7 dias para quem volta sem parâmetros continuar atribuído ao anúncio.
function lerOrigem() {
  const params = new URLSearchParams(window.location.search);
  const atual = {};
  UTMS.forEach((k) => { const v = params.get(k); if (v) atual[k] = v.slice(0, 200); });
  const fbclid = params.get("fbclid") || undefined;
  if (atual.utm_source || atual.utm_campaign || atual.utm_content || fbclid) {
    try { localStorage.setItem("black_origem", JSON.stringify({ em: Date.now(), origem: atual, fbclid })); } catch {}
    return { origem: atual, fbclid };
  }
  try {
    const salva = JSON.parse(localStorage.getItem("black_origem") || "null");
    if (salva && Date.now() - salva.em < ORIGEM_DIAS * 864e5) return { origem: salva.origem || {}, fbclid: salva.fbclid };
  } catch {}
  return { origem: {}, fbclid: undefined };
}

// Igual ao quiz: monta o _fbc a partir do fbclid quando o cookie ainda não existe.
function lerFbc(fbclid) {
  let fbc = lerCookie("_fbc");
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    document.cookie = `_fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`;
  }
  return fbc;
}

// Envio que não segura a navegação: sendBeacon, ou fetch com keepalive.
function enviar(url, dados) {
  const corpo = JSON.stringify(dados);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([corpo], { type: "application/json" }))) return;
  } catch {}
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
}

function partes(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 };
}
const dois = (n) => String(n).padStart(2, "0");

export default function Black({ grupoLink, abertura }) {
  const alvo = Date.parse(abertura);
  const [restante, setRestante] = useState(null); // null até montar (evita diferença entre servidor e navegador)
  const rastreio = useRef({ origem: {}, fbclid: undefined, fbc: undefined });
  const saindo = useRef(false);

  useEffect(() => {
    const { origem, fbclid } = lerOrigem();
    const fbc = lerFbc(fbclid);
    rastreio.current = { origem, fbclid, fbc };
    // _fbp é criado pelo Pixel logo depois de carregar; espera um pouco antes de registrar a visita.
    const t = setTimeout(() => {
      enviar("/api/black/visita", { origem, fbclid, fbc, fbp: lerCookie("_fbp") });
    }, 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const tick = () => setRestante(alvo - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alvo]);

  function entrar(e) {
    e.preventDefault();
    if (saindo.current) return;
    saindo.current = true;

    const eventId = novoId();
    const { origem, fbclid, fbc } = rastreio.current;
    try {
      window.fbq?.("track", "Contact", { content_name: "Grupo VIP Black Alma" }, { eventID: eventId });
    } catch {}
    enviar("/api/black/clique", { eventId, origem, fbclid, fbc: fbc || lerCookie("_fbc"), fbp: lerCookie("_fbp"), url: window.location.href });

    setTimeout(() => {
      saindo.current = false;
      if (grupoLink) window.location.href = grupoLink;
    }, REDIRECT_MS);
  }

  const aberta = restante !== null && restante <= 0;
  const p = partes(restante ?? 0);

  return (
    <main className="black">
      <section className="black-conteudo">
        <img className="logo black-logo" src="/logo.png" alt="Clínica Alma" />
        <h1 className="black-titulo">Black Alma</h1>
        <p className="sub black-sub">As condições especiais da Black são só para quem está no grupo VIP.</p>

        <div className="black-contagem">
          {aberta ? (
            <p className="black-aviso">As ofertas já estão no grupo. Entre agora.</p>
          ) : (
            <>
              <div className="black-relogio" role="timer" aria-label="Tempo até as ofertas chegarem no grupo">
                {[
                  [restante === null ? "--" : p.dias, "dias"],
                  [restante === null ? "--" : dois(p.horas), "horas"],
                  [restante === null ? "--" : dois(p.minutos), "min"],
                  [restante === null ? "--" : dois(p.segundos), "seg"],
                ].map(([n, r]) => (
                  <div key={r} className="black-unidade"><span>{n}</span><small>{r}</small></div>
                ))}
              </div>
              <p className="black-aviso">As ofertas chegam no grupo na segunda, 9/11</p>
            </>
          )}
        </div>

        <ul className="black-areas">
          <li>Cílios e sobrancelhas</li>
          <li>Pele</li>
          <li>Corpo</li>
        </ul>

        <div className="black-acao">
          <a className="botao black-botao" href={grupoLink || "#"} onClick={entrar}>Entrar no grupo VIP</a>
          <p className="black-garantia">Gratuito. Só a equipe da Alma envia mensagens.</p>
        </div>
      </section>

      <footer className="black-rodape">
        <span>Clínica Alma · Cascavel, PR</span>
        <a href="/politica-de-privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>
      </footer>
    </main>
  );
}
