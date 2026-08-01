/* =============================================================
   PROJETO: Minhas Receitas — App de receitas com login (Firebase)
   DATA DE CRIAÇÃO: 01/08/2026
   ARQUIVO: app.js
   DESCRIÇÃO: Autenticação (cadastro/login/logout) e CRUD de
   receitas em tempo real usando Firebase Auth + Realtime Database.
   ============================================================= */

/* -------------------------------------------------------------
   1. CONFIGURAÇÃO DO FIREBASE
   -------------------------------------------------------------
   >>> SUBSTITUA os valores abaixo pelos dados do SEU projeto <<<
   Como obter: Console do Firebase > Configurações do projeto >
   "Seus aplicativos" > selecione o app Web (ou crie um com o
   ícone </>) > copie o objeto "firebaseConfig".

   Lembre-se também de:
   a) Ativar o método de login "E-mail/senha" em
      Authentication > Sign-in method.
   b) Criar um Realtime Database (modo "bloqueado"/produção) e
      aplicar as regras de segurança fornecidas no final deste
      projeto (bloco separado "Regras de segurança").
   ------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCVXtFvIc9NLST5pMi4yGKpwfq2NL_U2Rs",
  authDomain: "teste-top-5e71d.firebaseapp.com",
  databaseURL: "https://teste-top-5e71d-default-rtdb.firebaseio.com",
  projectId: "teste-top-5e71d",
  storageBucket: "teste-top-5e71d.firebasestorage.app",
  messagingSenderId: "508513466627",
  appId: "1:508513466627:web:47118b2fd5dd05508cd136"
};

// Inicializa o Firebase com a configuração acima
firebase.initializeApp(firebaseConfig);

// Atalhos para os serviços que vamos usar
const auth = firebase.auth();
const db = firebase.database();

// Guarda a referência do "listener" de receitas em tempo real,
// para que possamos desligá-lo quando o usuário fizer logout.
let receitasRef = null;
let receitasListenerAtivo = null;

/* -------------------------------------------------------------
   2. REFERÊNCIAS AOS ELEMENTOS DO DOM
   ------------------------------------------------------------- */
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");

const authTabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("login-form");
const cadastroForm = document.getElementById("cadastro-form");
const authMensagemEl = document.getElementById("auth-mensagem");

const usuarioEmailEl = document.getElementById("usuario-email");
const btnLogout = document.getElementById("btn-logout");

const receitaForm = document.getElementById("receita-form");
const receitaMensagemEl = document.getElementById("receita-mensagem");
const salvarTextoEl = document.getElementById("salvar-texto");

const contadorEl = document.getElementById("contador-receitas");
const listaReceitasEl = document.getElementById("lista-receitas");
const listaVaziaEl = document.getElementById("lista-vazia");

/* -------------------------------------------------------------
   3. FUNÇÃO DE SEGURANÇA: escapeHTML
   -------------------------------------------------------------
   Evita XSS: qualquer texto digitado pelo usuário (título,
   ingredientes, preparo) passa por aqui antes de ser inserido
   no HTML da página, transformando caracteres perigosos como
   < > " ' & em suas versões seguras (entidades HTML).
   ------------------------------------------------------------- */
function escapeHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* -------------------------------------------------------------
   4. FUNÇÕES DE MENSAGEM (feedback visual)
   ------------------------------------------------------------- */
function mostrarMensagem(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.classList.remove("erro", "sucesso");
  elemento.classList.add(tipo); // "erro" ou "sucesso"
}

function limparMensagem(elemento) {
  elemento.textContent = "";
  elemento.classList.remove("erro", "sucesso");
}

/* -------------------------------------------------------------
   5. TRADUÇÃO DE ERROS DO FIREBASE PARA MENSAGENS AMIGÁVEIS
   ------------------------------------------------------------- */
function traduzirErroFirebase(codigo) {
  const mensagens = {
    "auth/invalid-email": "Este e-mail não parece válido.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/wrong-password": "Senha incorreta. Tente novamente.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente de novo."
  };
  return mensagens[codigo] || "Ocorreu um erro inesperado. Tente novamente.";
}

/* -------------------------------------------------------------
   6. ALTERNÂNCIA ENTRE AS ABAS "ENTRAR" E "CRIAR CONTA"
   ------------------------------------------------------------- */
authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authTabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    limparMensagem(authMensagemEl);

    if (tab.dataset.tab === "login") {
      loginForm.classList.remove("hidden");
      cadastroForm.classList.add("hidden");
    } else {
      cadastroForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    }
  });
});

/* -------------------------------------------------------------
   7. AUTENTICAÇÃO — CADASTRO DE NOVO USUÁRIO
   ------------------------------------------------------------- */
cadastroForm.addEventListener("submit", (evento) => {
  evento.preventDefault();
  limparMensagem(authMensagemEl);

  const nome = document.getElementById("cadastro-nome").value.trim();
  const email = document.getElementById("cadastro-email").value.trim();
  const senha = document.getElementById("cadastro-senha").value;

  const botao = cadastroForm.querySelector("button[type=submit]");
  botao.disabled = true;

  auth
    .createUserWithEmailAndPassword(email, senha)
    .then((credenciais) => {
      // Salva o nome de exibição no perfil do usuário
      return credenciais.user.updateProfile({ displayName: nome });
    })
    .then(() => {
      mostrarMensagem(authMensagemEl, "Conta criada com sucesso! Bem-vindo(a).", "sucesso");
      // O listener onAuthStateChanged (abaixo) cuidará de mostrar o app
    })
    .catch((erro) => {
      mostrarMensagem(authMensagemEl, traduzirErroFirebase(erro.code), "erro");
    })
    .finally(() => {
      botao.disabled = false;
    });
});

/* -------------------------------------------------------------
   8. AUTENTICAÇÃO — LOGIN
   ------------------------------------------------------------- */
loginForm.addEventListener("submit", (evento) => {
  evento.preventDefault();
  limparMensagem(authMensagemEl);

  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;

  const botao = loginForm.querySelector("button[type=submit]");
  botao.disabled = true;

  auth
    .signInWithEmailAndPassword(email, senha)
    .catch((erro) => {
      mostrarMensagem(authMensagemEl, traduzirErroFirebase(erro.code), "erro");
    })
    .finally(() => {
      botao.disabled = false;
    });
});

/* -------------------------------------------------------------
   9. AUTENTICAÇÃO — LOGOUT
   ------------------------------------------------------------- */
btnLogout.addEventListener("click", () => {
  auth.signOut();
});

/* -------------------------------------------------------------
   10. LISTENER DE ESTADO DE AUTENTICAÇÃO
   -------------------------------------------------------------
   Esta é a função central: o Firebase chama este callback
   automaticamente sempre que o usuário faz login, logout, ou
   quando a página é recarregada (mantendo a sessão).
   ------------------------------------------------------------- */
auth.onAuthStateChanged((usuario) => {
  if (usuario) {
    // ---- Usuário está LOGADO ----
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");

    usuarioEmailEl.textContent = usuario.displayName
      ? `${usuario.displayName} · ${usuario.email}`
      : usuario.email;

    // Limpa os formulários de autenticação por segurança
    loginForm.reset();
    cadastroForm.reset();
    limparMensagem(authMensagemEl);

    // Começa a ouvir as receitas deste usuário em tempo real
    iniciarListenerDeReceitas(usuario.uid);
  } else {
    // ---- Usuário está DESLOGADO ----
    appContainer.classList.add("hidden");
    authContainer.classList.remove("hidden");

    // Para de ouvir as receitas do usuário anterior (evita
    // vazamento de listener e de dados entre contas)
    pararListenerDeReceitas();

    listaReceitasEl.innerHTML = "";
    contadorEl.textContent = "0";
  }
});

/* -------------------------------------------------------------
   11. SALVAR NOVA RECEITA NO REALTIME DATABASE
   -------------------------------------------------------------
   Cada receita é salva em: /receitas/{uid_do_usuario}/{id_gerado}
   Isso garante, junto com as regras de segurança, que cada
   usuário só acesse o seu próprio nó de receitas.
   ------------------------------------------------------------- */
receitaForm.addEventListener("submit", (evento) => {
  evento.preventDefault();
  limparMensagem(receitaMensagemEl);

  const usuario = auth.currentUser;
  if (!usuario) return; // segurança extra: sem usuário, não faz nada

  const titulo = document.getElementById("receita-titulo").value.trim();
  const ingredientes = document.getElementById("receita-ingredientes").value.trim();
  const preparo = document.getElementById("receita-preparo").value.trim();

  if (!titulo || !ingredientes || !preparo) {
    mostrarMensagem(receitaMensagemEl, "Preencha todos os campos antes de salvar.", "erro");
    return;
  }

  const botaoSalvar = receitaForm.querySelector("button[type=submit]");
  botaoSalvar.disabled = true;
  salvarTextoEl.textContent = "Salvando...";

  const novaReceita = {
    titulo: titulo,
    ingredientes: ingredientes,
    preparo: preparo,
    criadoEm: firebase.database.ServerValue.TIMESTAMP
  };

  // push() gera um ID único automaticamente para a nova receita
  db.ref(`receitas/${usuario.uid}`)
    .push(novaReceita)
    .then(() => {
      mostrarMensagem(receitaMensagemEl, "Receita salva com sucesso!", "sucesso");
      receitaForm.reset();
    })
    .catch((erro) => {
      console.error(erro);
      mostrarMensagem(receitaMensagemEl, "Não foi possível salvar a receita. Tente novamente.", "erro");
    })
    .finally(() => {
      botaoSalvar.disabled = false;
      salvarTextoEl.textContent = "Salvar receita";
    });
});

/* -------------------------------------------------------------
   12. OUVIR RECEITAS EM TEMPO REAL (evento 'value')
   -------------------------------------------------------------
   Usamos o evento 'value' do Realtime Database: toda vez que
   os dados mudam (criação ou exclusão), esta função é chamada
   de novo automaticamente e redesenha a lista.
   ------------------------------------------------------------- */
function iniciarListenerDeReceitas(uid) {
  // Se já havia um listener de outro usuário, remove antes
  pararListenerDeReceitas();

  receitasRef = db.ref(`receitas/${uid}`);

  receitasListenerAtivo = receitasRef.on(
    "value",
    (snapshot) => {
      const dados = snapshot.val();
      renderizarReceitas(dados);
    },
    (erro) => {
      console.error(erro);
      mostrarMensagem(
        receitaMensagemEl,
        "Não foi possível carregar suas receitas agora.",
        "erro"
      );
    }
  );
}

function pararListenerDeReceitas() {
  if (receitasRef && receitasListenerAtivo) {
    receitasRef.off("value", receitasListenerAtivo);
  }
  receitasRef = null;
  receitasListenerAtivo = null;
}

/* -------------------------------------------------------------
   13. RENDERIZAR A LISTA DE RECEITAS NA TELA
   ------------------------------------------------------------- */
function renderizarReceitas(dados) {
  listaReceitasEl.innerHTML = "";

  if (!dados) {
    listaVaziaEl.classList.remove("hidden");
    contadorEl.textContent = "0";
    return;
  }

  // Transforma o objeto { id: {...}, id: {...} } em uma lista,
  // ordenando pela mais recente primeiro
  const receitas = Object.entries(dados)
    .map(([id, receita]) => ({ id, ...receita }))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  contadorEl.textContent = String(receitas.length);
  listaVaziaEl.classList.toggle("hidden", receitas.length > 0);

  receitas.forEach((receita) => {
    listaReceitasEl.appendChild(criarCardReceita(receita));
  });
}

/* -------------------------------------------------------------
   14. CRIAR O ELEMENTO HTML (card) DE UMA RECEITA
   -------------------------------------------------------------
   Todo texto vindo do banco passa por escapeHTML() antes de
   ser inserido via innerHTML, prevenindo ataques de XSS.
   ------------------------------------------------------------- */
function criarCardReceita(receita) {
  const card = document.createElement("article");
  card.className = "receita-card";

  card.innerHTML = `
    <h4 class="receita-card-titulo">${escapeHTML(receita.titulo)}</h4>

    <div class="receita-card-secao">
      <div class="receita-card-label">Ingredientes</div>
      <p class="receita-card-texto">${escapeHTML(receita.ingredientes)}</p>
    </div>

    <div class="receita-card-secao">
      <div class="receita-card-label">Modo de preparo</div>
      <p class="receita-card-texto">${escapeHTML(receita.preparo)}</p>
    </div>

    <div class="receita-card-footer">
      <button type="button" class="btn btn-excluir" data-id="${receita.id}">
        Excluir
      </button>
    </div>
  `;

  // Liga o botão de excluir deste card específico
  const botaoExcluir = card.querySelector(".btn-excluir");
  botaoExcluir.addEventListener("click", () => excluirReceita(receita.id));

  return card;
}

/* -------------------------------------------------------------
   15. EXCLUIR RECEITA
   ------------------------------------------------------------- */
function excluirReceita(idReceita) {
  const usuario = auth.currentUser;
  if (!usuario) return;

  const confirmar = window.confirm("Tem certeza que deseja excluir esta receita?");
  if (!confirmar) return;

  db.ref(`receitas/${usuario.uid}/${idReceita}`)
    .remove()
    .then(() => {
      mostrarMensagem(receitaMensagemEl, "Receita excluída.", "sucesso");
      // A lista se atualiza sozinha graças ao listener 'value'
    })
    .catch((erro) => {
      console.error(erro);
      mostrarMensagem(receitaMensagemEl, "Não foi possível excluir a receita.", "erro");
    });
}
