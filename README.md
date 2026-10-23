# Frontend — Nosso Sim

Interface React responsiva para administração de listas e páginas públicas de casamento.

## Inicialização

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Configure `VITE_API_URL` para a origem da API (padrão local `http://localhost:3000`). A API e seu Swagger/OpenAPI estão no repositório separado `api`.

## Funcionalidades

- Cadastro, login e recuperação de senha.
- Dashboard, convite de segundo integrante e administração de listas.
- Presentes simbólicos, publicação, página pública e respostas de RSVP.
- RSVP com e-mail verificado, bloqueio de resposta duplicada e reenvio limitado do link.
- Registro de intenção sem processamento financeiro.

## Limite explícito

Não há integração de pagamento. A mensalidade da plataforma e os pagamentos dos presentes serão avaliados em fase futura. A tela pública informa que intenção não é pagamento e não há compra/entrega de item físico.

## GitHub Pages

O frontend é publicado automaticamente em `https://vmsh.store/` quando há um push para `main`. As variáveis `VITE_API_URL` e `PAGES_CUSTOM_DOMAIN=true` ficam em **Settings → Secrets and variables → Actions → Variables** do repositório. `PAGES_CUSTOM_DOMAIN` faz o build usar a raiz do domínio próprio; sem ele, o workflow usa o caminho `/presente-casamento-web/` do GitHub Pages. Sem `VITE_API_URL`, o frontend usa `http://localhost:3000`, que só funciona para desenvolvimento local.
