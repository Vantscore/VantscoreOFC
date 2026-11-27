# Guia de Configuração do Firebase — VantScore

Este guia orienta passo a passo a configuração do Firebase para habilitar autenticação real (E-mail/senha, Google, Facebook e visitante Anônimo) e banco de dados Cloud Firestore no protótipo acadêmico **VantScore**.

---

## 1. Criar o Projeto no Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/) com sua conta Google.
2. Clique em **Adicionar projeto** (ou **Criar projeto**).
3. Defina um nome para o projeto (ex.: `vantscore-app`).
4. Desative o Google Analytics (opcional para o protótipo) e clique em **Criar projeto**.
5. Aguarde a finalização e clique em **Continuar**.

---

## 2. Registrar o Aplicativo Web e Obter as Chaves

1. Na tela inicial do projeto (Visão geral do projeto), clique no ícone **Web** (`</>`).
2. Digite um apelido para o app (ex.: `vantscore-web`).
3. Não precisa marcar a opção do Firebase Hosting neste momento.
4. Clique em **Registrar app**.
5. O console exibirá o objeto `firebaseConfig`. Copie os valores e cole no arquivo `firebase-config.js` na raiz do projeto:

```javascript
window.VS_FIREBASE = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    appId: "SEU_APP_ID"
};
```

> **Atenção**: Deixe o arquivo com aspas vazias caso não queira ativar o Firebase. O VantScore continuará funcionando normalmente com as contas de exemplo e autenticação local.

---

## 3. Ativar Métodos de Autenticação (Sign-in Providers)

1. No menu lateral esquerdo, vá em **Compilação** (Build) > **Authentication** e clique em **Vamos começar**.
2. Na aba **Sign-in method** (Método de login), ative os seguintes provedores:
   - **E-mail/senha**: ative a primeira chave ("Permitir que os usuários façam login usando o endereço de e-mail e a senha"). Deixe "Link do e-mail" desativado. Clique em **Salvar**.
   - **Google**: clique em Google, ative a chave, selecione seu e-mail para suporte ao projeto e clique em **Salvar**.
   - **Anônimo**: clique em Anônimo, ative a chave e clique em **Salvar**. Visitantes sem sessão entram de forma anônima para manter a segurança e permitir migração transparente ao criar conta.
   - **Facebook** (opcional, veja seção 7 abaixo).
3. **Apple**: o login com Apple exige uma conta paga no programa Apple Developer ($99/ano) com Service ID e chave privada configurados. No VantScore, o botão exibe um aviso claro informando essa exigência, sem simular sucesso indevidamente.

---

## 4. Configurar Domínios Autorizados

Para evitar erros de `auth/unauthorized-domain`:
1. No menu **Authentication**, acesse a aba **Settings** (Configurações) > **Authorized domains** (Domínios autorizados).
2. Verifique se `localhost` e `127.0.0.1` constam na lista.
3. Se for publicar o projeto no GitHub Pages, clique em **Add domain** (Adicionar domínio) e adicione:
   ```
   SEU-USUARIO.github.io
   ```

---

## 5. Criar o Banco de Dados Cloud Firestore

1. No menu lateral, acesse **Compilação** > **Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Selecione o local do servidor mais próximo (ex.: `southamerica-east1` em São Paulo, ou o padrão).
4. Escolha **Iniciar no modo de produção** e clique em **Criar**.

---

## 6. Regras de Segurança do Firestore

1. No painel do Firestore Database, vá na aba **Regras** (Rules).
2. Substitua as regras existentes pelas regras abaixo e clique em **Publicar**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas o usuário autenticado não anônimo pode ler e gravar seu próprio documento
    match /usuarios/{uid} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid
                         && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
  }
}
```

Essas regras garantem que:
- Apenas o proprietário dos dados (`request.auth.uid == uid`) pode ler ou editar seu perfil.
- Usuários anônimos não gravam nem leem dados de usuários reais no banco.
- Nenhum usuário pode visualizar ou alterar perfis de terceiros.

---

## 7. Passos para Ativar o Login com Facebook (Meta)

1. Acesse o portal [Meta for Developers](https://developers.facebook.com/) e faça login.
2. Clique em **Meus apps** > **Criar app**.
3. Selecione o caso de uso **Autenticar ou criar contas de usuários** (ou tipo **Consumidor**) e continue.
4. Adicione o produto **Login do Facebook para Empresas / Web**.
5. No Firebase Console, em **Authentication** > **Sign-in method**, abra o provedor **Facebook**.
6. Copie a **URI de redirecionamento do OAuth** exibida pelo Firebase (ex.: `https://SEU_PROJETO.firebaseapp.com/__/auth/handler`).
7. No painel de desenvolvedores do Facebook, em **Login do Facebook** > **Configurações**:
   - Cole a URI copiada em **URIs de redirecionamento do OAuth válidos**.
   - Salve as alterações.
8. No menu lateral da Meta, vá em **Configurações do app** > **Básico**:
   - Copie o **ID do aplicativo** (App ID) e a **Chave secreta do aplicativo** (App Secret).
9. Volte ao Firebase Console no provedor Facebook, cole o App ID e o App Secret, ative o provedor e clique em **Salvar**.

---

## 8. Execução e Contexto Local (iniciar-tcc.bat)

- **Importante**: O login social (Google e Facebook via popup) não funciona ao abrir o arquivo diretamente no navegador via protocolo `file:///`. Navegadores bloqueiam popups e redirecionamentos OAuth em arquivos locais por política de segurança (CORS e Web Storage).
- **Como executar corretamente**: Dê um duplo-clique no arquivo `iniciar-tcc.bat` na raiz do projeto. Ele iniciará o servidor local em `http://localhost:8321`, permitindo o funcionamento pleno de todas as APIs e provedores de autenticação.
