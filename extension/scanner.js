/**
 * Encontra os produtos que estão na página do Mercado Livre (busca, ofertas,
 * categoria, loja). É heurístico de propósito: em vez de depender das classes
 * do ML, que mudam, parte dos links de produto e sobe até o cartão em volta.
 *
 * Só produto de catálogo (/p/MLB...) pode ser rastreado; anúncio avulso é
 * devolvido com catalogo=false para o painel mostrar desabilitado.
 */
function descuentoColetarProdutos(limite = 80) {
  const dinheiro = (el) => {
    if (!el) return null;
    const f = el.querySelector(".andes-money-amount__fraction");
    if (!f) return null;
    const c = el.querySelector(".andes-money-amount__cents");
    const valor = Number(f.textContent.replace(/\./g, "") + "." + (c ? c.textContent.trim() : "00"));
    return Number.isFinite(valor) ? valor : null;
  };

  const cartaoDe = (a) => {
    let el = a;
    for (let i = 0; i < 8 && el.parentElement; i++) {
      el = el.parentElement;
      if (el.matches("li, article, .poly-card, .andes-card, .ui-search-layout__item, .promotion-item")) return el;
      if (el.querySelector("img") && el.querySelector(".andes-money-amount")) return el;
    }
    return a.closest("li, article, div") ?? a.parentElement;
  };

  const produtos = new Map();

  for (const a of document.querySelectorAll('a[href*="/p/MLB"], a[href*="MLB-"]')) {
    if (produtos.size >= limite) break;
    if (a.closest("nav, header, footer")) continue;

    const url = a.href.split("#")[0];
    const catalogo = url.match(/\/p\/(MLB\d{6,})/i);
    const avulso = url.match(/(MLB-?\d{6,})/i);
    const id = catalogo ? catalogo[1].toUpperCase() : avulso ? avulso[1].toUpperCase().replace("-", "") : null;
    if (!id || produtos.has(id)) continue;

    const cartao = cartaoDe(a);
    const titulo = (a.getAttribute("title") || a.innerText || cartao?.querySelector("h2, h3")?.innerText || "").trim();
    if (!titulo || titulo.length < 8) continue;

    const valores = cartao ? [...cartao.querySelectorAll(".andes-money-amount")] : [];
    const riscado = valores.find((v) => v.closest("s") || v.classList.contains("andes-money-amount--previous"));
    const atual = valores.find((v) => v !== riscado);

    produtos.set(id, {
      id,
      url,
      titulo: titulo.split("\n")[0].slice(0, 160),
      preco: dinheiro(atual),
      precoOriginal: dinheiro(riscado),
      imagem: cartao?.querySelector("img")?.src ?? null,
      catalogo: Boolean(catalogo),
    });
  }

  return [...produtos.values()];
}
