const $ = (id) => document.getElementById(id);
const estado = (texto, cor = "#71717a") => {
  $("estado").textContent = texto;
  $("estado").style.color = cor;
};

async function carregarCategorias(site, token) {
  if (!site || !token) return;
  try {
    const r = await fetch(`${site.replace(/\/$/, "")}/api/extension/categories`, {
      headers: { "X-Descuento-Token": token },
    });
    if (!r.ok) return estado(r.status === 401 ? "Token inválido." : `Site respondeu ${r.status}.`, "#b91c1c");
    const categorias = await r.json();
    const { categoria } = await chrome.storage.sync.get("categoria");
    $("categoria").innerHTML = '<option value="">Nenhuma</option>';
    for (const c of categorias) {
      const opcao = document.createElement("option");
      opcao.value = c.id;
      opcao.textContent = c.name;
      if (c.id === categoria) opcao.selected = true;
      $("categoria").appendChild(opcao);
    }
    estado(`Conectado — ${categorias.length} categorias.`, "#15803d");
  } catch (e) {
    estado(`Não consegui falar com o site: ${e.message}`, "#b91c1c");
  }
}

(async () => {
  const { site, token } = await chrome.storage.sync.get(["site", "token"]);
  $("site").value = site ?? "http://localhost:3000";
  $("token").value = token ?? "";
  await carregarCategorias($("site").value, $("token").value);
})();

$("salvar").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    site: $("site").value.trim(),
    token: $("token").value.trim(),
    categoria: $("categoria").value,
  });
  estado("Salvo.", "#15803d");
  await carregarCategorias($("site").value.trim(), $("token").value.trim());
});
