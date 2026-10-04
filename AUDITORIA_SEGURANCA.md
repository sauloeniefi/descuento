# Auditoria de Segurança

**Data:** 2026-10-04  
**Escopo:** leitura estática de migrations e código versionado, revisão de autenticação e APIs, inspeção de `.gitignore` e `git status`, e `npm audit` de dependências. Nenhuma credencial foi lida ou impressa; nenhuma correção foi aplicada como parte desta auditoria.

## Resumo

- Não foram encontrados valores de credenciais, chaves privadas ou QR codes literais nas migrations ou nos arquivos de código versionados examinados.
- `.env.local` está coberto por `.gitignore` e não está versionado no estado atual. Seu conteúdo não foi inspecionado.
- O QR de pareamento é enviado a um serviço de terceiros para gerar a imagem.
- O token da extensão aparece na query string da URL após ser criado.
- `npm audit` reportou 17 achados: 1 crítico e 16 altos no conjunto completo; nas dependências de produção, 1 crítico e 9 altos.
- A API da extensão aceita `categoryId` sem validar que a categoria pertence ao usuário autenticado.

## Achados

### Alto — QR de pareamento enviado a serviço externo

**Evidência:** a página usa `api.qrserver.com` e passa `latestQrCode` como parâmetro `data` em [src/app/automacao/page.tsx](src/app/automacao/page.tsx#L109).

**Impacto:** o valor do QR é uma credencial temporária de pareamento do WhatsApp. O serviço externo recebe o conteúdo e pode mantê-lo em logs. O QR também fica armazenado em texto puro na tabela `wa_qr_codes` enquanto existir no banco.

**Correção sugerida:** gerar o bitmap do QR localmente, sem chamada externa, por exemplo com uma biblioteca QR executada no servidor ou no navegador. Apagar o QR do banco após expirar, após autenticação bem-sucedida e em uma rotina periódica. Evitar incluir o valor do QR em logs.

### Alto — token da extensão exposto na query string

**Evidência:** [src/app/actions.ts](src/app/actions.ts#L262) redireciona para `/extensao?token=${token}` e [src/app/extensao/page.tsx](src/app/extensao/page.tsx) exibe o token.

**Impacto:** URLs podem ser gravadas no histórico do navegador, logs de proxy/servidor, ferramentas de monitoramento e capturas de tela. O token concede acesso às operações da extensão até ser substituído.

**Correção sugerida:** entregar o token por estado transitório não incluído na URL, limpar a URL após a exibição e definir `Referrer-Policy: no-referrer` na página. Manter a propriedade atual de armazenar somente o hash no banco e permitir revogação/rotação imediata.

### Crítico reportado — Next.js vulnerável

**Evidência:** `npm audit` marcou `next@16.3.5` como crítico para RCE associada a `next/og` / `ImageResponse` (GHSA-vcvr-r3jv-pc5j), com correção indicada em `16.3.8`. Não foi encontrada referência direta a `ImageResponse` ou `next/og` em `src/` durante esta revisão.

**Impacto:** a versão vulnerável está instalada em produção. A ausência de uso direto identificado reduz a evidência de exposição pela aplicação, mas não elimina a necessidade de atualizar o framework.

**Correção sugerida:** atualizar `next` para `16.3.8` ou superior em versão corrigida, atualizar o lockfile e executar build e testes. Verificar notas de versão antes do deploy. Não usar `npm audit fix --force` sem revisão: o audit propõe downgrades incompatíveis de dependências transitivas.

### Alto — vulnerabilidades em dependências de produção

**Evidência:** `npm audit --omit=dev` reportou 10 vulnerabilidades em 10 pacotes: 1 crítica e 9 altas. Os achados altos incluem `whatsapp-web.js@1.34.7`, Puppeteer, `basic-ftp`, `get-uri`, `proxy-agent` e `extract-zip`; os avisos de `extract-zip` incluem traversal por symlink. `npm audit` completo reportou ainda achados em ferramentas de desenvolvimento, incluindo `patch-package`.

**Impacto:** vulnerabilidades transitivas podem permitir negação de serviço ou, em certos cenários, escrita de arquivos. O caminho afetado e a explorabilidade dependem de como cada dependência é usada.

**Correção sugerida:** revisar cada advisory e atualizar por dependência, preservando a versão funcional do WhatsApp Web. O `npm audit` sugere downgrade de `whatsapp-web.js` para `1.34.2`; não aplicá-lo automaticamente, pois pode quebrar compatibilidade com o WhatsApp Web atual e o patch local de mídia. Avaliar substituição/fork atualizado ou `overrides` seletivos, e validar o fluxo real de login, envio de texto e envio de imagem.

### Médio — categoria de outro usuário pode ser associada pela API da extensão

**Evidência:** [src/app/api/extension/track/route.ts](src/app/api/extension/track/route.ts#L22) e [src/app/api/extension/track-bulk/route.ts](src/app/api/extension/track-bulk/route.ts#L28) aceitam `categoryId` do corpo autenticado pelo token e o encaminham a `addProduct()`. [src/lib/tracker/service.ts](src/lib/tracker/service.ts#L142) grava a categoria sem verificar seu `user_id`. A função `setProductCategory()` já faz uma verificação de proprietário, mas esse caminho não a utiliza.

**Impacto:** uma chamada com UUID de categoria de outra conta pode associar o produto do usuário autenticado à categoria alheia. A revisão não identificou leitura direta do conteúdo da categoria por esse caminho, mas há violação do isolamento entre contas e inconsistência de dados.

**Correção sugerida:** antes de inserir, validar que `categoryId` é nulo ou pertence ao usuário autenticado. Reutilizar uma função de serviço que aplique essa regra também para a extensão e testar os endpoints unitária/integrativamente.

### Médio, dependente da implantação — cadastro público e ausência de rate limiting

**Evidência:** o fluxo de registro está disponível publicamente em [src/app/auth-actions.ts](src/app/auth-actions.ts), e não foi identificado rate limiting no registro ou login durante a revisão. O README documenta que o primeiro usuário `admin` pode assumir produtos e categorias sem proprietário.

**Impacto:** endpoints públicos sem limitação facilitam abuso automatizado e tentativas de senha. Em uma instalação com dados legados sem proprietário, registrar `admin` antes do operador autorizado pode permitir apropriação desses dados.

**Correção sugerida:** em produção, restringir ou desabilitar cadastro aberto, criar a conta administrativa antes de importar/atribuir dados legados, e aplicar rate limiting por IP/conta no login e registro. Considerar verificação adicional ou convite para criação de contas.

### Baixo/Médio — credenciais padrão no Docker Compose

**Evidência:** [docker-compose.yml](docker-compose.yml) define usuário, senha e banco como `descuento`; a porta PostgreSQL está limitada a `127.0.0.1:5432`.

**Impacto:** é uma configuração de desenvolvimento exposta no repositório, não uma chave privada descoberta. Torna-se um risco se a configuração for reutilizada em produção ou se a rede/host local não for confiável.

**Correção sugerida:** manter valores de desenvolvimento apenas para uso local; em produção, usar credenciais aleatórias via secret manager/variáveis de ambiente, não publicar a porta do banco e aplicar privilégio mínimo ao usuário do PostgreSQL.

## Observações positivas

- `.env.local` está ignorado pelo Git e não consta como arquivo rastreado no estado atual.
- As migrations examinadas definem armazenamento para hashes de senha e tokens; não contêm valores de credenciais.
- Senhas são derivadas com `scrypt`; tokens de sessão e da extensão são armazenados como SHA-256, não em texto puro.
- As rotas de cron exigem `CRON_SECRET`; as APIs da extensão exigem token.
- As respostas CORS `*` das rotas da extensão são acompanhadas de autenticação por token. Ainda assim, o token precisa ser protegido no cliente e nos logs.

## Ordem recomendada

1. Atualizar Next.js para versão corrigida e validar o build/deploy.
2. Remover a chamada externa para renderização do QR e reduzir a retenção de QR codes no banco.
3. Tirar o token da URL, limpar a URL após exibição e configurar `Referrer-Policy`.
4. Validar `categoryId` por usuário na API da extensão.
5. Restringir cadastro público e adicionar rate limiting para autenticação.
6. Avaliar os advisories transitivos de Puppeteer/WhatsApp e definir uma estratégia de atualização testada, sem downgrade automático.
7. Garantir credenciais PostgreSQL fortes e secret management em qualquer implantação não local.

## Limitações

Esta foi uma auditoria estática e de dependências. Não houve teste de invasão, análise dinâmica, inspeção dos valores de `.env.local`, revisão de configuração do proxy/host de produção ou auditoria do histórico remoto completo do Git. A busca por segredos cobre padrões comuns nos arquivos versionados examinados; não garante ausência de toda credencial em formatos não reconhecidos.