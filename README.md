# Controle Financeiro Pro — IA, SMS, Gráficos e PDF

Aplicativo PWA para controle financeiro de Fernando & Vanessa, funcionando no celular e no PC.

## Principais recursos

- Lançamento manual de gastos e entradas.
- Botão principal **IA do comprovante** na tela inicial.
- Câmera do celular para fotografar comprovantes de maquininha.
- OCR local com Tesseract.js para sugerir valor, data, forma de pagamento, categoria e descrição.
- Importador de SMS: cole a mensagem recebida do cartão e o app preenche o gasto automaticamente.
- Histórico mensal.
- Gráficos em tela separada.
- PDF do mês para imprimir ou salvar.
- Backup em JSON.
- Sincronização opcional via Google Sheets + Apps Script.

## Sobre SMS automático

Por segurança, navegadores/PWAs não têm permissão para ler todos os SMS do celular automaticamente. A alternativa segura nesta versão é copiar a mensagem do cartão e colar em **Ferramentas > Importar SMS**. O app interpreta o texto e abre o lançamento já preenchido para conferência.

Para leitura totalmente automática de SMS seria necessário transformar o projeto em app Android nativo com permissão específica de SMS, o que exige publicação/instalação fora do navegador e revisão de privacidade.

## Câmera no celular

A câmera funciona melhor quando o app está publicado em HTTPS. Abrir o `index.html` diretamente como arquivo pode bloquear a câmera.

## Instalação

1. Publique os arquivos em um serviço com HTTPS, como GitHub Pages, Netlify, Vercel ou servidor próprio.
2. Abra o endereço no celular.
3. Use “Adicionar à tela inicial”.
4. Configure a sincronização em ⚙️ usando o Web App URL do Apps Script.

