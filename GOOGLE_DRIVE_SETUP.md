# Configurar cópias de segurança no Google Drive

O Cartões continua salvando os dados localmente. A seção **Cópia de segurança no Google Drive**, em Configurações, permite enviar manualmente uma cópia JSON para sua conta Google e restaurá-la depois. O arquivo é chamado `Cartões - backup.json`.

## Configuração necessária

1. No Google Cloud Console, crie ou selecione um projeto e ative a **Google Drive API**.
2. Configure a tela de consentimento OAuth e inclua o escopo `https://www.googleapis.com/auth/drive.file`.
3. Crie uma credencial OAuth do tipo **Aplicativo da Web** e cadastre a origem do app em **Origens JavaScript autorizadas**. Para desenvolvimento local, use `http://localhost:3000`; para a versão publicada, use a origem HTTPS do site.
4. Copie o ID de cliente OAuth para `.env.local`:

   ```dotenv
   VITE_GOOGLE_CLIENT_ID="seu-id-de-cliente.apps.googleusercontent.com"
   ```

5. Reinicie o servidor de desenvolvimento ou gere novamente a versão publicada.

A integração pede o escopo `drive.file`: ela cria e atualiza o arquivo de backup que este app controla, sem solicitar acesso amplo a todo o Drive. O Google solicita autorização quando você salva ou restaura. O token de acesso fica apenas em memória e não é gravado no app.

## Uso

- **Salvar cópia no Drive** cria o arquivo na primeira vez e atualiza o mesmo arquivo nas próximas vezes.
- **Restaurar do Drive** carrega esse arquivo e pede confirmação antes de substituir os dados abertos no app.
- A cópia é manual; alterações posteriores no app não são enviadas automaticamente.
- A integração funciona no app servido em `localhost` ou HTTPS.

Os dados incluem informações financeiras pessoais. Ao autorizar, a cópia escolhida é transmitida para a conta Google selecionada.
