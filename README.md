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

O frontend é publicado automaticamente em `https://mateusechoesdigital.github.io/presente-casamento-web/` quando há um push para `main`. Para conectar uma API hospedada, cadastre a variável `VITE_API_URL` em **Settings → Secrets and variables → Actions → Variables** do repositório. Sem essa configuração, o frontend usa `http://localhost:3000`, que só funciona para desenvolvimento local.
