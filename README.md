# Cartões

Aplicativo web de gestão de cartões e despesas. Os dados ficam no armazenamento do navegador até você escolher um arquivo JSON local. Para sincronizá-los entre computadores, escolha o arquivo dentro da pasta sincronizada pelo Google Drive para computador.

## Executar localmente

Pré-requisito: Node.js e npm.

1. Instale as dependências com `npm install`.
2. Execute `npm run dev`.
3. Abra `http://localhost:3000` no Chrome ou Edge.
4. Em Configurações, escolha um arquivo local ou crie um novo. Veja [DRIVE_PASTA_LOCAL.md](DRIVE_PASTA_LOCAL.md).

Para gerar a versão web, execute `npm run build`.
