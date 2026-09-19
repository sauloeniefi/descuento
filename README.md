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

2. Crie o `.env.local` a partir do exemplo e preencha as credenciais do Mercado Livre:

   ```bash
   cp .env.local.example .env.local
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

O site tem uma barra de navegação com três páginas.

### Rastreador (`/`)

- **Buscar produto:** digite o nome no campo de busca. A lista mostra só produtos de catálogo com oferta ativa e o menor preço novo. Informe um nome reduzido e um preço-alvo (ambos opcionais) e clique em "Rastrear".
- **Cadastrar por link:** cole a URL ou o código de um produto de **catálogo**, no formato `mercadolivre.com.br/.../p/MLB12345678` ou `MLB12345678`, e clique em "Rastrear". Em "Mais opções" ficam o nome reduzido, o preço-alvo e de quantos em quantos dias o preço deve ser verificado (o padrão é 1).
- **Cabeçalho:** mostra o total de produtos e o botão "N oportunidades". Clicar nele filtra a lista para mostrar só os produtos em oportunidade, e clicar de novo volta para todos. O filtro fica na URL (`/?oportunidades=1`).
- **Cartões:** cada produto é um cartão com foto, título, número de coletas e data da última verificação. Os blocos de preço mostram o atual, o mínimo, a média e o alvo. Um selo verde aparece quando há oportunidade:
  - preço igual ou menor que o preço-alvo;
  - preço pelo menos 10% abaixo da média (precisa de 3 ou mais coletas);
  - menor preço já registrado (precisa de 3 ou mais coletas).
- **Cor do preço atual:** compara o preço com o alvo. Verde: igual ou abaixo do alvo. Amarelo: até 10% acima. Vermelho: mais de 10% acima. Sem preço-alvo, fica cinza.
- **Nome reduzido:** nome curto do produto, opcional, usado na mensagem de compartilhar no lugar do nome completo. Dá para preencher no cadastro ou depois, no cartão. Vazio, a mensagem usa o nome completo.
- **Categoria:** escolha a categoria do produto no seletor do cartão. Ela salva ao trocar.
- **Afiliado:** cole o seu link de afiliado (o `meli.la/...` que o Mercado Livre gera) e clique em "Salvar". O site não gera esse link, porque o Mercado Livre não oferece API para isso.
- **Nº da imagem:** escolha qual imagem do anúncio usar na miniatura e no compartilhar. O padrão é a 1. Se o número passar da quantidade de imagens do anúncio, aparece um erro.
- **Compartilhar:** monta uma mensagem com a mensagem da categoria, o nome reduzido (ou o nome completo, se não houver) e o link, separados por uma linha em branco. O link é o de afiliado, se houver, ou o do produto. Sem categoria, a mensagem leva só o nome e o link. No celular abre o menu de compartilhar do sistema, com a imagem do produto. No desktop tenta copiar a imagem e o texto juntos e, se o navegador não aceitar, copia só o texto. Nem todo app aproveita imagem e texto colados juntos.
- **Verificar preços agora:** consulta o preço de todos os produtos na hora.

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
```

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
| `npm run build` / `npm start` | Build e execução em produção |
| `npm run lint` | Roda o ESLint |

## Limitações conhecidas

- **Só produtos de catálogo** (`/p/MLB...`) funcionam. Links de anúncio avulso (`/up/MLBU...` ou `MLB-123456-...`) dão erro, porque a API do Mercado Livre bloqueia esses acessos com o token do app.
- O preço registrado é o menor preço entre as ofertas novas do produto de catálogo.
- O cadastro é aberto: qualquer pessoa que acessar o site pode criar uma conta. Não há limite de tentativas de login nem recuperação de senha. Antes de expor o site na internet, restrinja o cadastro e sirva o site por HTTPS.
- Não há gráfico de histórico de preços ainda, só mínimo e média.
