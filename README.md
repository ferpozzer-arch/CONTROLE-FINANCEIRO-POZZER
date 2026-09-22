# Controle Financeiro Pro 3.0

Versão reorganizada para ficar mais limpa e funcional no celular e no PC.

## Principais mudanças

- Um único botão principal: **Lançamento inteligente**.
- Fluxo inteligente com 4 caminhos: câmera, galeria, SMS e digitação manual.
- Removidos botões duplicados de scanner na tela inicial.
- OCR/IA local para ler comprovantes e preencher valor, data, categoria, descrição e forma de pagamento.
- Importação de SMS por copiar/colar, já que PWA/navegador não pode ler SMS automaticamente por segurança do Android/iPhone.
- Parcelamento automático em até 12x.
- Lançamento recorrente mensal por 12 meses.
- Relatórios, gráficos e PDF mensal ficam em áreas secundárias para não poluir a tela inicial.
- Layout responsivo para celular, tablet e PC.
- Cache do PWA atualizado para forçar a versão nova.

## Observação importante sobre câmera

A câmera do celular só abre de forma confiável quando o app está publicado em HTTPS ou rodando em localhost. Se abrir como arquivo local, alguns navegadores bloqueiam.

## Observação importante sobre SMS automático

No formato PWA/web, o app não consegue ler SMS sozinho. Para lançamento 100% automático a partir de SMS seria necessário criar um app Android nativo com permissão de SMS. Nesta versão, copie o SMS recebido e cole em **Lançamento inteligente > Importar SMS**.


## v8.0.0
- Faturas por PDF, imagem ou captura/foto.
- Holerites por PDF, imagem ou captura/foto com leitura do valor líquido e lançamento opcional como receita.
- Alertas reforçados de vencimento (7, 3, 2, 1 e 0 dias) ao abrir/usar o app.
- Dívidas com vencimento também entram nos alertas.
- Para push garantido com o app totalmente fechado, será necessário backend de notificações em etapa futura.
