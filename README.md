# Descuento

Rastreador de preços de produtos do Mercado Livre. Você cadastra produtos, o site guarda o histórico de preços, destaca oportunidades e gera mensagens de compartilhamento com o seu link de afiliado.

Stack: Next.js 16 (App Router), TypeScript, Tailwind, PostgreSQL (Docker).

## Requisitos

- Node.js 24 ou mais recente
- Docker com Docker Compose (o seu usuário precisa conseguir rodar `docker ps` sem `sudo`)
- Um app no [Mercado Livre Developers](https://developers.mercadolivre.com.br) para obter `client_id` e `client_secret`

## Como subir

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env.local` na raiz do projeto:

   ```
   ML_CLIENT_ID=seu_client_id
   ML_CLIENT_SECRET=seu_client_secret
   DATABASE_URL=postgres://descuento:descuento@localhost:5432/descuento
   CRON_SECRET=uma_senha_qualquer
   ```

   | Variável | Para que serve |
   | --- | --- |
   | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | Credenciais do app do Mercado Livre (obrigatórias) |
   | `DATABASE_URL` | Conexão com o Postgres. O valor padrão já funciona com o `docker-compose.yml` |
   | `CRON_SECRET` | Senha para chamar a verificação automática de preços (ver abaixo) |
   | `AWIN_*`, `LOMADEE_*` | Só para a página de cupons, opcionais |

3. Suba o banco:

   ```bash
   npm run db:up
   ```

4. Inicie o site:

   ```bash
   npm run dev
   ```

   As migrations do banco são aplicadas automaticamente antes de iniciar. Acesse http://localhost:3000.

### Migrando dados antigos (SQLite)

Se você usou uma versão anterior, com os dados em `data/tracker.db` e `data/categories.json`, importe-os uma vez com `npm run db:import`. O comando pode ser repetido sem duplicar dados. Os dados importados também ficam sem dono até o usuário `admin` se cadastrar.

## Como usar

### Conta e login

O site exige login. Crie a conta em `/register` (usuário de 3 a 32 caracteres e senha de pelo menos 8) e entre em `/login`. O botão "Sair" fica no canto direito da barra de navegação. A sessão dura 30 dias.

Cada usuário vê e altera apenas os próprios produtos e categorias.

**Usuário admin:** os dados que já existiam antes do login (produtos, histórico de preços e categorias) ficam sem dono. Quem se cadastrar com o nome de usuário `admin` recebe todos esses dados automaticamente. Cadastre o `admin` antes de qualquer outra conta, porque a primeira conta com esse nome fica com tudo.

O site tem uma barra de navegação com sete páginas.

### Rastreador (`/`)

- **Buscar produto:** digite o nome no campo de busca. A lista mostra só produtos de catálogo com oferta ativa e o menor preço novo. Informe um nome reduzido e um preço-alvo (ambos opcionais) e clique em "Rastrear".
- **Cadastrar por link:** cole a URL ou o código de um produto de **catálogo**, no formato `mercadolivre.com.br/.../p/MLB12345678` ou `MLB12345678`, e clique em "Rastrear". Em "Mais opções" ficam o nome reduzido, o preço-alvo e de quantos em quantos dias o preço deve ser verificado (o padrão é 1).
- **Cabeçalho:** mostra o total de produtos e o botão "N oportunidades". Clicar nele filtra a lista para mostrar só os produtos em oportunidade, e clicar de novo volta para todos. O filtro fica na URL (`/?oportunidades=1`).
- **Cartões:** cada produto é um cartão com foto, título, número de coletas e data da última verificação. Os blocos de preço mostram o atual, o mínimo, a média e o alvo. Um selo verde aparece quando há oportunidade:
  - preço igual ou menor que o preço-alvo;
  - menor preço já registrado (precisa de 3 ou mais coletas);
  - menor preço dos últimos 90 dias, mesmo que um preço mais antigo tenha sido menor (precisa de 5 ou mais coletas na janela);
  - preço entre os 10% mais baratos dos últimos 90 dias (mesma exigência de coletas).

  O bloco "Mínimo" mostra o menor preço de todo o histórico com a data da coleta, para você comparar o mínimo antigo com o de agora.
- **Nível do preço:** um segundo selo classifica o preço atual pelo próprio histórico de 90 dias, sem depender do alvo — Ótimo (10% mais baratos), Bom (até 30%), Normal (até 70%) e Caro (o resto). Com menos de 5 coletas na janela, o cartão avisa que o histórico ainda é curto. A classificação usa percentil, não média, porque uma promoção isolada distorce a média.
- **Alvo sugerido:** quando o produto não tem alvo, o cartão mostra um valor realista tirado do histórico (o primeiro quartil dos últimos 90 dias: o preço que só 25% das coletas alcançaram). Se o seu alvo estiver mais de 10% abaixo do menor preço da janela, o cartão avisa que ele dificilmente será atingido e mostra a sugestão.
- **Cor do preço atual:** com preço-alvo definido, compara o preço com o alvo — verde: igual ou abaixo; amarelo: até 10% acima; vermelho: mais de 10% acima. Sem alvo, usa o nível do preço (verde para Ótimo e Bom, vermelho para Caro, cinza para Normal ou sem histórico).
- **Preço-alvo:** dá para alterar a qualquer momento no campo "Preço-alvo" do cartão; vazio remove o alvo. Quando há sugestão, o botão "Usar" grava o valor sugerido direto.
- **Desconto do anúncio:** quando a oferta tem preço "de", o cartão mostra a etiqueta "Anúncio X% OFF". Esse é o desconto que o vendedor anuncia agora, diferente do nível, que compara com o histórico.
- **Nome reduzido:** nome curto do produto, opcional, usado na mensagem de compartilhar no lugar do nome completo. Dá para preencher no cadastro ou depois, no cartão. Vazio, a mensagem usa o nome completo.
- **Categoria:** escolha a categoria do produto no seletor do cartão. Ela salva ao trocar.
- **Afiliado:** cole o seu link de afiliado (o `meli.la/...` que o Mercado Livre gera) e clique em "Salvar". O site não gera esse link, porque o Mercado Livre não oferece API para isso.
- **Nº da imagem:** escolha qual imagem do anúncio usar na miniatura e no compartilhar. O padrão é a 1. Se o número passar da quantidade de imagens do anúncio, aparece um erro.
- **Compartilhar:** monta uma mensagem com a mensagem da categoria, o nome reduzido (ou o nome completo, se não houver) e o link, separados por uma linha em branco. O link é o de afiliado, se houver, ou o do produto. Sem categoria, a mensagem leva só o nome e o link. No celular abre o menu de compartilhar do sistema, com a imagem do produto. No desktop tenta copiar a imagem e o texto juntos e, se o navegador não aceitar, copia só o texto. Nem todo app aproveita imagem e texto colados juntos.
- **Verificar preços agora:** consulta o preço de todos os produtos na hora.

### Produtos (`/produtos`)

Seus produtos em pastas — cada pasta é uma categoria sua, mais a pasta "Sem categoria". A pasta mostra quantos produtos tem, quantos vencem nos próximos 7 dias e quantos já venceram.

Dentro da pasta: busca por nome, seleção em massa para renovar ou remover, botão de renovar a pasta inteira e estrela para favoritar. Produto favorito vai na frente na hora de montar a fila de envio.

**Validade:** todo produto vale 30 dias a partir do cadastro e cada renovação dá mais 30. Produto vencido continua na lista, marcado em vermelho, mas fica fora dos envios até você renovar. A ideia é não divulgar oferta velha.

Para manter a pasta cheia sem trabalho: você escolhe os produtos uma vez, a varredura procura parecidos e eles entram na mesma pasta depois que você aprova em Sugestões.

### Sugestões (`/sugestoes`)

Varredura automática de produtos parecidos. Ela pega até 20 produtos da sua lista como semente, extrai as palavras-chave do título (ex.: "Fone de Ouvido Bluetooth JBL Tune 510BT" vira `fone ouvido bluetooth jbl`), procura no catálogo do Mercado Livre e guarda o que estiver com **10% de desconto ou mais** no anúncio. Produtos que você já rastreia, ou que já foram sugeridos antes, ficam de fora.

Cada sugestão traz desconto, preço de/por, a categoria herdada da semente e de qual produto ela veio. "Rastrear" adiciona à sua lista já na categoria certa; "Descartar" some com ela e não sugere de novo.

O botão "Procurar agora" roda na hora. Para rodar sozinho, chame `POST /api/cron/scan` com o `CRON_SECRET` (exemplo de crontab mais abaixo).

### Automação de envio (`/automacao`)

Cada automação tem: **um ou mais grupos**, categoria (ou todas), dias da semana, faixa do dia ("envia das 09:00 às 21:00"), **intervalo** ("a cada 60 min", mínimo 15), produtos por envio, desconto mínimo, **reenvio em X horas** (tempo até o mesmo produto poder repetir), data de início e data de fim (opcional).

O site só **monta a fila**: percorre a faixa do dia de intervalo em intervalo, escolhe os produtos da categoria que estão com desconto acima do mínimo ou em oportunidade — favoritos primeiro, vencidos de fora —, monta a legenda e grava uma linha por grupo em `send_queue`. Horário que já passou é descartado, e automação que já tem fila no dia não recebe outra. Quem envia é o worker.

No seletor só aparecem os grupos em que **você é administrador**: nos outros o WhatsApp costuma recusar o envio. Quem marca isso é o worker, ao sincronizar.

A legenda sai por modelo de texto, sem IA:

```
Achadinhos de tecnologia 👇

🔥 *Fone JBL 510BT* — 40% OFF

De ~R$ 249,90~ por *R$ 149,90*

📉 Menor preço que já vi neste produto

https://meli.la/abc
```

A primeira linha é a mensagem da categoria, e o link é o de afiliado quando existe.

#### Worker do WhatsApp

```bash
npm i whatsapp-web.js qrcode-terminal
WORKER_USER_ID=1 npm run whatsapp
```

Na primeira vez ele mostra um QR code: leia com o celular em "Aparelhos conectados". A sessão fica em `.wwebjs_auth/` (ignorada pelo git). Com o WhatsApp conectado, o worker grava a lista dos seus grupos (é assim que eles aparecem no seletor da página) e, a cada minuto, envia o que estiver vencido na fila. Item atrasado mais de 2 horas é descartado, para não despejar tudo de uma vez quando o worker volta.

Ritmo de envio, todos ajustáveis por variável de ambiente:

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `WA_DELAY_MIN` / `WA_DELAY_MAX` | 45 / 180 | pausa entre duas mensagens, sorteada nesse intervalo |
| `WA_MAX_PER_HOUR` | 12 | teto de mensagens por hora, somando todas as campanhas |
| `WA_BATCH` | 3 | máximo por rodada (o worker roda a cada minuto) |

**Risco, sem rodeios:** o worker controla o WhatsApp Web com o seu número, o que **viola os termos de uso do WhatsApp** e pode levar ao bloqueio do número. A API oficial da Meta não substitui isso: a Groups API só envia em grupos criados pela própria API, com no máximo 8 participantes, e exige Official Business Account. Use com moderação, em grupos seus, com o ritmo padrão do worker.

### Extensão do Chrome (`/extensao`)

Coloca um botão flutuante nas páginas do Mercado Livre. Clicando nele abre um painel com **todos os produtos que a extensão achou na página** — busca, ofertas, categoria, loja ou a página de um produto — para você marcar vários e mandar de uma vez para uma das suas listas.

1. Em `/extensao`, gere o token (o valor só aparece na hora; gerar outro invalida o anterior).
2. Em `chrome://extensions`, ligue o "Modo do desenvolvedor", clique em "Carregar sem compactação" e escolha a pasta `extension/`.
3. Abra o ícone da extensão, preencha endereço do site e token, escolha a categoria padrão e salve.
4. Navegue no Mercado Livre normalmente e clique no botão amarelo no canto da tela.

No painel: escolha a lista, marque os produtos (ou "Selecionar todos") e clique em "Adicionar N à lista". Cada linha mostra o resultado — adicionado, já tinha ou erro. O ⟳ relê a página depois de você rolar e carregar mais produtos.

Anúncio avulso aparece na lista, porém desabilitado e com o motivo: a API do Mercado Livre só deixa rastrear produto de catálogo (`/p/MLB…`). Numa busca comum quase tudo é catálogo; na página de ofertas costuma ter uns poucos avulsos.

A extensão conversa com três endpoints, autenticados pelo cabeçalho `X-Descuento-Token`: `GET /api/extension/categories` (as suas listas), `POST /api/extension/track` (um produto) e `POST /api/extension/track-bulk` (até 40 por vez). O token é guardado só como hash, na tabela `api_tokens`.

O coletor (`extension/scanner.js`) não depende das classes do ML: ele parte dos links de produto e sobe até o cartão em volta para pegar título, preço, preço "de" e imagem. Se um dia o layout mudar e o painel vier vazio, é esse arquivo que precisa de ajuste.

### Categorias (`/categorias`)

Crie, edite e exclua categorias. Cada uma tem um nome e uma mensagem, que vai no começo do texto compartilhado. Ao excluir uma categoria, os produtos dela ficam sem categoria.

### Cupons (`/cupons`)

Lista de cupons vindos do Awin e do Lomadee, se configurados. Sem configuração, mostra 3 cupons de exemplo. Essa parte é independente do rastreador.

## Verificação automática de preços

O site não agenda nada sozinho. Para coletar preços todo dia, chame o endpoint a partir de um agendador externo (cron do sistema, por exemplo):

```bash
curl -X POST http://localhost:3000/api/cron/check -H "Authorization: Bearer SEU_CRON_SECRET"
```

Cada produto só é consultado quando passou o intervalo em dias definido nele. Exemplo de linha no `crontab -e`, rodando às 8h:

```
0 8 * * * curl -s -X POST http://localhost:3000/api/cron/check -H "Authorization: Bearer SEU_CRON_SECRET"
0 7 * * * curl -s -X POST http://localhost:3000/api/cron/scan  -H "Authorization: Bearer SEU_CRON_SECRET"
5 0 * * * curl -s -X POST http://localhost:3000/api/cron/queue -H "Authorization: Bearer SEU_CRON_SECRET"
```

`/api/cron/scan` roda a varredura de produtos parecidos e `/api/cron/queue` monta a fila de envio do dia. A fila é idempotente: chamar de novo no mesmo dia não duplica.

## Parar o Docker

| Comando | O que faz | Dados |
| --- | --- | --- |
| `docker compose stop` | Para o container, sem removê-lo. Volte com `npm run db:up` | Mantidos |
| `npm run db:down` | Para e remove o container | Mantidos, ficam no volume |
| `docker compose down -v` | Para, remove o container **e apaga o volume** | **Apagados** |

Com o banco parado, o site dá erro de conexão. Para conferir o estado, use `docker compose ps`. Para voltar, rode `npm run db:up`.

## Banco de dados

- O Postgres roda pelo `docker-compose.yml`, com os dados num volume do Docker.
- O esquema é versionado em `db/migrations/*.sql`. Para mudar o banco, crie um novo arquivo numerado, como `005_descricao.sql`. Não edite migrations já aplicadas.
- As migrations aplicadas ficam registradas na tabela `schema_migrations`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Aplica migrations e inicia o site em modo desenvolvimento |
| `npm run db:up` | Sobe o Postgres no Docker |
| `npm run db:down` | Desliga o Postgres (os dados ficam no volume) |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:import` | Importa dados do SQLite antigo |
| `npm run whatsapp` | Worker que conecta no WhatsApp e envia a fila |
| `npm run build` / `npm start` | Build e execução em produção |
| `npm run lint` | Roda o ESLint |

## Limitações conhecidas

- **Só produtos de catálogo** (`/p/MLB...`) funcionam — isso vale também para a varredura, que só encontra produtos de catálogo. Links de anúncio avulso (`/up/MLBU...` ou `MLB-123456-...`) dão erro, porque a API do Mercado Livre bloqueia esses acessos com o token do app.
- O preço registrado é o menor preço entre as ofertas novas do produto de catálogo.
- O cadastro é aberto: qualquer pessoa que acessar o site pode criar uma conta. Não há limite de tentativas de login nem recuperação de senha. Antes de expor o site na internet, restrinja o cadastro e sirva o site por HTTPS.
- Não há gráfico de histórico de preços ainda, só mínimo e média.
