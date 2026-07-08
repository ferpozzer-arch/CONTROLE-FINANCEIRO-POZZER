# Controle Financeiro Pro · Fernando & Vanessa

Versão profissional com foco em uso real no celular e no PC.

## Principais melhorias

- Botão grande de **Escanear comprovante** na tela inicial.
- Scanner por câmera do celular usando OCR com Tesseract.js.
- Interpretação automática local: valor, data, forma de pagamento, categoria e descrição.
- Fluxo seguro: o app preenche os campos, mas vocês conferem antes de salvar.
- Tela de **Gráficos** separada para não poluir a tela principal.
- Gráfico de pizza por categoria, evolução dos últimos 6 meses e comparação por pessoa.
- **PDF/relatório mensal** para imprimir ou salvar.
- Menu de ferramentas com Scanner, Gráficos, PDF e Backup.
- Interface melhorada para desktop/tablet.
- Backup e restauração em JSON.
- Sincronização opcional via Google Sheets + Apps Script.

## Importante para câmera

No celular, a câmera só abre de forma confiável quando o app está em **HTTPS** ou instalado como PWA a partir de um endereço seguro.

Não teste abrindo o arquivo `index.html` diretamente pelo explorador de arquivos do celular, porque muitos navegadores bloqueiam câmera nesse modo.

## Como testar

1. Publique a pasta em um servidor HTTPS, GitHub Pages, Netlify, Vercel ou similar.
2. Abra o app no celular.
3. Toque em **Escanear comprovante**.
4. Tire a foto do comprovante.
5. Confira os campos preenchidos.
6. Toque em **Salvar lançamento**.

## Google Sheets

Use o arquivo `apps-script.gs` dentro do Google Apps Script da sua planilha e publique como Web App. Depois cole a URL no botão ⚙️ do aplicativo.
