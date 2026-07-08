# Controle Financeiro Pozzer

PWA de controle financeiro para casal/família, com uso em celular e computador, funcionamento offline e sincronização opcional via Google Sheets + Google Apps Script.

## O que o app já entrega

- Lançamentos de entradas e gastos por data, pessoa, categoria, forma de pagamento e tipo de gasto.
- Dashboard mensal com saldo, entradas, gastos, orçamento e taxa de poupança.
- Histórico mensal com edição e exclusão de lançamentos.
- Orçamento por categoria.
- Backup e restauração em JSON.
- Relatório mensal para impressão/PDF.
- Instalação como aplicativo PWA em Android, iPhone e desktop.
- Layout responsivo para celular, tablet e PC.
- Scanner de comprovante pelo celular: abre a câmera, roda OCR com Tesseract.js e pré-preenche valor, data, forma de pagamento, categoria e descrição para conferência.

## Como rodar localmente

Use um servidor local, porque Service Worker/PWA não funciona corretamente abrindo o `index.html` direto pelo arquivo.

```bash
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080` dentro da pasta do projeto.

## Como publicar

Opções simples:

1. GitHub Pages
2. Netlify
3. Vercel
4. Hospedagem própria com HTTPS

HTTPS é necessário para instalação PWA e Service Worker fora de `localhost`.

## Sincronização com Google Sheets

1. Crie uma planilha no Google Sheets.
2. Abra **Extensões > Apps Script**.
3. Cole o conteúdo de `apps-script.gs`.
4. Publique como **Web App** com acesso para “qualquer pessoa com o link”.
5. Copie a URL terminada em `/exec`.
6. No app, toque em ⚙️ e cole essa URL.

## Scanner de comprovantes

No botão **Escanear comprovante da maquininha**, o app usa a câmera do celular e a biblioteca Tesseract.js carregada via CDN. Por isso, para o OCR funcionar pela primeira vez, o aparelho precisa de internet. A captura de câmera exige HTTPS em hospedagem pública. Depois da leitura, o app apenas pré-preenche os campos: o usuário deve conferir e tocar em **Salvar lançamento**.

Dicas para melhor leitura:

- Tire a foto com boa iluminação.
- Deixe o comprovante reto e ocupando boa parte da tela.
- Confira valor e data antes de salvar, porque OCR pode errar números.

## Próximas melhorias profissionais recomendadas

- Autenticação com login próprio, caso vá ser usado por mais famílias/clientes.
- Banco de dados real, como Supabase/Firebase/PostgreSQL, se quiser escalar além de uso familiar.
- Parcelamentos de cartão, contas recorrentes e metas.
- Importação CSV/OFX de bancos.
- Controle de investimentos/reserva de emergência.
- Testes automatizados e pipeline de deploy.
