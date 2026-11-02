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
- Registro opcional de intenção sem pagamento, contribuições por Pix e cartão via Mercado Pago, página de status do pedido e painel de pagamentos.

## Pagamentos

O frontend não recebe nem armazena dados do cartão. O cartão é concluído no Checkout Pro do Mercado Pago e o Pix mostra o QR/copia e cola criado pela API. O retorno ao site consulta o status no backend; somente a notificação autenticada do Mercado Pago confirma o pagamento. Configure `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_WEBHOOK_URL` e `PAYMENT_TOKEN_SECRET` no backend. Para development, use credenciais de teste e um túnel HTTPS para receber webhooks. A mensalidade da plataforma e o split seguem fora do escopo.

## GitHub Pages

O frontend é publicado automaticamente em `https://vmsh.store/` quando há um push para `main`. As variáveis `VITE_API_URL` e `PAGES_CUSTOM_DOMAIN=true` ficam em **Settings → Secrets and variables → Actions → Variables** do repositório. `PAGES_CUSTOM_DOMAIN` faz o build usar a raiz do domínio próprio; sem ele, o workflow usa o caminho `/presente-casamento-web/` do GitHub Pages. Sem `VITE_API_URL`, o frontend usa `http://localhost:3000`, que só funciona para desenvolvimento local.
