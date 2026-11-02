# Escolher onde salvar o arquivo de dados

O Cartões pode ler e atualizar um arquivo JSON escolhido por você no computador. Não precisa configurar Google Cloud, OAuth ou faturamento. Se quiser sincronizar os dados entre computadores, escolha o arquivo dentro da pasta local sincronizada pelo Google Drive para computador.

## Configurar

1. Instale e configure o Google Drive para computador, se quiser sincronização.
2. Abra o Cartões no Chrome ou Edge em `http://localhost` ou num endereço HTTPS. A seleção local de arquivos depende de um contexto seguro e de uma ação direta do usuário.
3. Em **Configurações > Dados Locais e Cópias de Segurança**, escolha **Selecionar arquivo existente** para usar um JSON que já existe, ou **Criar ou escolher local do arquivo** para criar um novo arquivo em qualquer pasta.
4. Se o arquivo tiver dados reconhecidos, escolha se quer carregá-los no app ou substituí-los pelos dados que já estão neste navegador. Um arquivo vazio pode ser inicializado com os dados atuais.
5. Autorize leitura e gravação quando o navegador solicitar. Depois disso, as alterações são gravadas automaticamente no mesmo arquivo.

O app memoriza o identificador de acesso do arquivo no armazenamento do navegador. O navegador pode pedir autorização outra vez; use **Reconectar arquivo**. O site não recebe nem mostra o caminho completo do computador: o seletor nativo é quem mostra a pasta e o nome para você.

## Usar em outro computador

Instale o Google Drive para computador no outro PC, espere o arquivo sincronizar, abra o app e selecione esse arquivo novamente. Cada navegador e computador precisa conceder seu próprio acesso. Evite editar o arquivo ao mesmo tempo em dois dispositivos, para não sobrescrever mudanças ainda não sincronizadas.

Em celulares e tablets, a seleção direta de arquivo local não está disponível de forma consistente. Neles, use **Exportar JSON** e **Importar JSON**.

O JSON é legível e contém informações financeiras pessoais. Qualquer pessoa com acesso ao arquivo ou à pasta do Drive poderá lê-lo. A seleção de arquivos pode variar conforme o navegador; use Chrome ou Edge atualizados.
