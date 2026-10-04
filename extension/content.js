/**
 * Botão flutuante do Descuento nas páginas do Mercado Livre.
 *
 * - Em qualquer página com produtos (busca, ofertas, categoria, loja): abre um
 *   painel com o que foi encontrado, para você marcar vários e mandar de uma vez
 *   para uma lista.
 * - Na página de um produto de catálogo: o painel já vem com ele marcado.
 *
 * Só produto de catálogo (/p/MLB...) pode ser rastreado — é o que a API do
 * Mercado Livre permite com token de aplicação. Anúncio avulso aparece no
 * painel desabilitado, para você saber que ele existe mas não entra.
 */

const $ = (tag, props = {}, filhos = []) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const f of filhos) el.append(f);
  return el;
};

let painel = null;
let produtos = [];

async function config() {
  const { site, token, categoria } = await chrome.storage.sync.get(["site", "token", "categoria"]);
  return { site: (site ?? "").replace(/\/$/, ""), token: token ?? "", categoria: categoria ?? "" };
}

function status(texto, cor = "#a1a1aa") {
  const alvo = painel?.querySelector("#dc-status");
  if (alvo) {
    alvo.textContent = texto;
    alvo.style.color = cor;
  }
}

function atualizarBotaoEnviar() {
  const marcados = painel.querySelectorAll(".dc-item input:checked").length;
  const botao = painel.querySelector("#dc-enviar");
  botao.textContent = marcados === 0 ? "Selecione produtos" : `Adicionar ${marcados} à lista`;
  botao.disabled = marcados === 0;
}

function linhaProduto(p) {
  const check = $("input", { type: "checkbox", value: p.url, disabled: !p.catalogo });
  check.addEventListener("change", atualizarBotaoEnviar);

  const preco = p.preco != null ? `R$ ${p.preco.toFixed(2).replace(".", ",")}` : "";
  const de =
    p.precoOriginal != null && p.preco != null && p.precoOriginal > p.preco
      ? `  ${Math.round((1 - p.preco / p.precoOriginal) * 100)}% OFF`
      : "";

  const item = $("label", { className: "dc-item" + (p.catalogo ? "" : " dc-item--off") }, [
    check,
    p.imagem ? $("img", { src: p.imagem, alt: "" }) : $("span", { className: "dc-sem-img" }),
    $("span", { className: "dc-texto" }, [
      $("span", { className: "dc-titulo", textContent: p.titulo }),
      $("span", {
        className: "dc-preco",
        textContent: p.catalogo ? preco + de : "anúncio avulso — o Descuento só rastreia produto de catálogo",
      }),
    ]),
    $("span", { className: "dc-resultado" }),
  ]);
  item.dataset.url = p.url;
  return item;
}

async function carregarListas(select) {
  const { site, token, categoria } = await config();
  select.innerHTML = "";
  select.append($("option", { value: "", textContent: "Sem lista" }));
  if (!site || !token) {
    status("Configure o site e o token no ícone da extensão.", "#f59e0b");
    return;
  }
  try {
    const r = await fetch(`${site}/api/extension/categories`, { headers: { "X-Descuento-Token": token } });
    if (!r.ok) return status(r.status === 401 ? "Token inválido." : `O site respondeu ${r.status}.`, "#ef4444");
    for (const c of await r.json()) {
      const o = $("option", { value: c.id, textContent: c.name });
      if (c.id === categoria) o.selected = true;
      select.append(o);
    }
  } catch (e) {
    status(`Não consegui falar com o site: ${e.message}`, "#ef4444");
  }
}

/** Mesmo teto do endpoint /api/extension/track-bulk. */
const TAMANHO_LOTE = 40;

function marcarResultados(resultados) {
  const marca = { ok: "✓", duplicado: "já tinha", erro: "erro" };
  for (const resultado of resultados) {
    const linha = painel?.querySelector(`.dc-item[data-url="${CSS.escape(resultado.url)}"]`);
    if (!linha) continue;
    const alvo = linha.querySelector(".dc-resultado");
    alvo.textContent = marca[resultado.status] ?? "";
    alvo.title = resultado.erro ?? "";
    alvo.style.color = resultado.status === "erro" ? "#ef4444" : resultado.status === "duplicado" ? "#a1a1aa" : "#22c55e";
    const check = linha.querySelector("input");
    check.checked = false;
    check.disabled = resultado.status !== "erro";
  }
}

async function enviar() {
  const { site, token } = await config();
  if (!site || !token) return status("Configure o site e o token no ícone da extensão.", "#f59e0b");

  const urls = [...painel.querySelectorAll(".dc-item input:checked")].map((c) => c.value);
  const lotes = [];
  for (let i = 0; i < urls.length; i += TAMANHO_LOTE) lotes.push(urls.slice(i, i + TAMANHO_LOTE));

  const categoryId = painel.querySelector("#dc-lista").value || null;
  const botao = painel.querySelector("#dc-enviar");
  botao.disabled = true;

  const total = { adicionados: 0, duplicados: 0, erros: 0 };

  for (const [i, lote] of lotes.entries()) {
    status(lotes.length > 1 ? `Enviando lote ${i + 1} de ${lotes.length} (${lote.length} produtos)…` : `Enviando ${lote.length}…`);
    try {
      const r = await fetch(`${site}/api/extension/track-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Descuento-Token": token },
        body: JSON.stringify({ urls: lote, categoryId }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        status(`Lote ${i + 1} falhou: ${dados.error ?? r.status}. Os anteriores foram salvos.`, "#ef4444");
        atualizarBotaoEnviar();
        return;
      }
      total.adicionados += dados.adicionados ?? 0;
      total.duplicados += dados.duplicados ?? 0;
      total.erros += dados.erros ?? 0;
      marcarResultados(dados.resultados ?? []);
    } catch (e) {
      status(`Não consegui falar com o site no lote ${i + 1}: ${e.message}`, "#ef4444");
      atualizarBotaoEnviar();
      return;
    }
  }

  status(
    `${total.adicionados} adicionados · ${total.duplicados} já estavam · ${total.erros} com erro`,
    total.adicionados > 0 ? "#22c55e" : "#a1a1aa",
  );
  atualizarBotaoEnviar();
}

function montarPainel() {
  produtos = descuentoColetarProdutos();
  const daPagina = produtos.filter((p) => p.catalogo).length;

  const lista = $("select", { id: "dc-lista" });
  const itens = $("div", { id: "dc-itens" }, produtos.map(linhaProduto));

  const todos = $("input", { type: "checkbox", id: "dc-todos" });
  todos.addEventListener("change", () => {
    for (const c of painel.querySelectorAll(".dc-item input:not(:disabled)")) c.checked = todos.checked;
    atualizarBotaoEnviar();
  });

  const fechar = $("button", { className: "dc-icone", textContent: "×", title: "Fechar" });
  fechar.addEventListener("click", fecharPainel);

  const reler = $("button", { className: "dc-icone", textContent: "⟳", title: "Reler a página" });
  reler.addEventListener("click", () => {
    fecharPainel();
    abrirPainel();
  });

  const enviarBotao = $("button", { id: "dc-enviar", textContent: "Selecione produtos", disabled: true });
  enviarBotao.addEventListener("click", enviar);

  painel = $("div", { id: "descuento-painel" }, [
    $("div", { className: "dc-cabecalho" }, [
      $("strong", { textContent: "Descuento" }),
      $("span", { className: "dc-contagem", textContent: `${daPagina} de ${produtos.length} nesta página` }),
      reler,
      fechar,
    ]),
    $("div", { className: "dc-config" }, [
      $("label", { textContent: "Lista:" }, [lista]),
      $("label", { className: "dc-todos" }, [todos, $("span", { textContent: "Selecionar todos" })]),
    ]),
    itens,
    $("div", { className: "dc-rodape" }, [enviarBotao, $("p", { id: "dc-status" })]),
  ]);

  document.body.append(painel);
  carregarListas(lista);

  if (produtos.length === 0) status("Não achei produtos nesta página.", "#f59e0b");

  // Na página de um produto, já deixa ele marcado.
  const atual = produtos.find((p) => p.catalogo && location.href.includes(p.id));
  if (atual) {
    const linha = painel.querySelector(`.dc-item[data-url="${CSS.escape(atual.url)}"] input`);
    if (linha) linha.checked = true;
  }
  atualizarBotaoEnviar();
}

function fecharPainel() {
  painel?.remove();
  painel = null;
}

function abrirPainel() {
  if (painel) return fecharPainel();
  montarPainel();
}

function montarBotao() {
  if (document.getElementById("descuento-botao")) return;
  const botao = $("button", { id: "descuento-botao", textContent: "Descuento" });
  botao.addEventListener("click", abrirPainel);
  document.body.append(botao);
}

montarBotao();

// O ML troca de página sem recarregar; fecha o painel quando a URL muda.
let ultimaUrl = location.href;
setInterval(() => {
  if (location.href === ultimaUrl) return;
  ultimaUrl = location.href;
  fecharPainel();
  montarBotao();
}, 1000);
