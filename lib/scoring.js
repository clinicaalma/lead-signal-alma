// Lead Signal OAGM: motor de score e gates.
// Usado no browser (para decidir o destino e disparar o Pixel) e no servidor
// (para recalcular e não confiar no que o browser manda).

// Gates também podem dar pontos (ex.: investimento é score + gate).
export function calcularScore(config, respostas) {
  return [...config.perguntas, ...config.gates].reduce((total, p) => {
    const opcao = p.opcoes.find((o) => o.label === respostas[p.id]);
    return total + (opcao?.pontos || 0);
  }, 0);
}

export function gatesAprovados(config, respostas) {
  return config.gates.every((g) => {
    const opcao = g.opcoes.find((o) => o.label === respostas[g.id]);
    return opcao?.aprova === true;
  });
}

export function avaliar(config, respostas) {
  const score = calcularScore(config, respostas);
  const gates = gatesAprovados(config, respostas);
  return { score, gatesAprovados: gates, qualificado: gates && score >= config.nota_de_corte };
}

// Verifica se todas as respostas existem e batem com as opções da config.
export function respostasValidas(config, respostas) {
  if (!respostas || typeof respostas !== "object") return false;
  return [...config.perguntas, ...config.gates].every((q) =>
    q.opcoes.some((o) => o.label === respostas[q.id])
  );
}

// "(45) 99999-9999" -> "5545999999999". Retorna null se não parecer telefone BR.
export function normalizarTelefone(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return null;
}

export function buscarPasso(config, id) {
  return config.perguntas.find((p) => p.id === id) || config.gates.find((g) => g.id === id);
}
