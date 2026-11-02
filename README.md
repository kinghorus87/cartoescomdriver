# Cartões

Aplicativo de gestão de cartões e despesas. O armazenamento local continua ativo; as cópias no Google Drive são manuais e opcionais.

## Executar localmente

Pré-requisito: Node.js.

1. Instale as dependências com `npm install`.
2. (Opcional) Configure `VITE_GOOGLE_CLIENT_ID` em `.env.local` para habilitar os backups do Drive; veja [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).
3. Execute `npm run dev` e abra `http://localhost:3000`.

Para gerar a versão web, execute `npm run build`. O app salva os dados no armazenamento local do navegador.
