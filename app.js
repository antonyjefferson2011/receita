/* =============================================================
   PROJETO: Rede Social de Receitas (com Firebase)
   DATA DE ATUALIZAÇÃO: 01/08/2026
   ARQUIVO: app.js
   DESCRIÇÃO: Autenticação (cadastro/login/logout), feed público
   de receitas em tempo real, upload de imagem via ImgBB, novos
   campos (tempo, acessórios, passo a passo), exclusão restrita
   ao autor e geração de receitas de demonstração em massa.
   ============================================================= */

/* -------------------------------------------------------------
   1. CONFIGURAÇÃO DO FIREBASE
   -------------------------------------------------------------
   >>> SUBSTITUA os valores abaixo pelos dados do SEU projeto <<<
   (os mesmos que você já usou na versão anterior do site).
   Console do Firebase > Configurações do projeto > "Seus
   aplicativos" > app Web > objeto "firebaseConfig".

   Lembre-se também de:
   a) Ter o método de login "E-mail/senha" ativado em
      Authentication > Sign-in method.
   b) Atualizar as regras do Realtime Database para o novo
      modelo de feed público (veja o bloco de regras entregue
      junto com este código).
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

/* -------------------------------------------------------------
   1.1 CONFIGURAÇÃO DO IMGBB (upload de imagens)
   -------------------------------------------------------------
   A chave abaixo é usada para enviar as imagens escolhidas no
   formulário para o ImgBB, que retorna uma URL pública. Essa
   URL é o que salvamos no Firebase (não a imagem em si).
   ------------------------------------------------------------- */
const IMGBB_API_KEY = "86427cccd2a94fb42a0754ffd7f19e79";
const IMGBB_UPLOAD_URL = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

// Referência do nó de receitas (agora é um feed único, não mais por usuário)
const receitasRef = db.ref("receitas");
let receitasListenerAtivo = null;

// Guarda o arquivo de imagem selecionado no formulário até o envio
let arquivoImagemSelecionado = null;

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

const inputImagem = document.getElementById("receita-imagem");
const previewWrapper = document.getElementById("preview-imagem-wrapper");
const previewImagem = document.getElementById("preview-imagem");
const btnRemoverImagem = document.getElementById("btn-remover-imagem");

const contadorEl = document.getElementById("contador-receitas");
const listaReceitasEl = document.getElementById("lista-receitas");
const listaVaziaEl = document.getElementById("lista-vazia");

const btnSeed = document.getElementById("btn-seed");
const seedProgressoEl = document.getElementById("seed-progresso");

/* -------------------------------------------------------------
   3. FUNÇÃO DE SEGURANÇA: escapeHTML
   -------------------------------------------------------------
   Evita XSS: qualquer texto digitado pelo usuário passa por
   aqui antes de ser inserido no HTML da página.
   ------------------------------------------------------------- */
function escapeHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
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
    .then((credenciais) => credenciais.user.updateProfile({ displayName: nome }))
    .then(() => {
      mostrarMensagem(authMensagemEl, "Conta criada com sucesso! Bem-vindo(a).", "sucesso");
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
   ------------------------------------------------------------- */
auth.onAuthStateChanged((usuario) => {
  if (usuario) {
    // ---- Usuário está LOGADO ----
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");

    usuarioEmailEl.textContent = usuario.displayName
      ? `${usuario.displayName} · ${usuario.email}`
      : usuario.email;

    loginForm.reset();
    cadastroForm.reset();
    limparMensagem(authMensagemEl);

    // Começa a ouvir o feed público de receitas
    iniciarListenerDoFeed();
  } else {
    // ---- Usuário está DESLOGADO ----
    appContainer.classList.add("hidden");
    authContainer.classList.remove("hidden");

    pararListenerDoFeed();

    listaReceitasEl.innerHTML = "";
    contadorEl.textContent = "0";
    limparPreviewImagem();
  }
});

/* -------------------------------------------------------------
   11. PRÉ-VISUALIZAÇÃO DA IMAGEM ESCOLHIDA
   ------------------------------------------------------------- */
inputImagem.addEventListener("change", () => {
  const arquivo = inputImagem.files[0];

  if (!arquivo) {
    limparPreviewImagem();
    return;
  }

  // Validação simples de tipo e tamanho (máx. 10 MB, limite do ImgBB no plano gratuito)
  if (!arquivo.type.startsWith("image/")) {
    mostrarMensagem(receitaMensagemEl, "Selecione um arquivo de imagem válido.", "erro");
    inputImagem.value = "";
    return;
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    mostrarMensagem(receitaMensagemEl, "A imagem deve ter no máximo 10 MB.", "erro");
    inputImagem.value = "";
    return;
  }

  arquivoImagemSelecionado = arquivo;

  const leitor = new FileReader();
  leitor.onload = (evento) => {
    previewImagem.src = evento.target.result;
    previewWrapper.classList.remove("hidden");
  };
  leitor.readAsDataURL(arquivo);
});

btnRemoverImagem.addEventListener("click", () => {
  limparPreviewImagem();
});

function limparPreviewImagem() {
  arquivoImagemSelecionado = null;
  inputImagem.value = "";
  previewImagem.src = "";
  previewWrapper.classList.add("hidden");
}

/* -------------------------------------------------------------
   12. UPLOAD DE IMAGEM PARA O IMGBB
   -------------------------------------------------------------
   Envia o arquivo escolhido para a API do ImgBB via FormData e
   retorna a URL pública da imagem hospedada (data.data.url).
   Se não houver arquivo selecionado, resolve com null e o
   card usa o ícone de fallback (🍳).
   ------------------------------------------------------------- */
async function enviarImagemParaImgBB(arquivo) {
  if (!arquivo) return null;

  const formData = new FormData();
  formData.append("image", arquivo);

  const resposta = await fetch(IMGBB_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  if (!resposta.ok) {
    throw new Error("Falha no upload da imagem para o ImgBB.");
  }

  const dados = await resposta.json();

  if (!dados || !dados.data || !dados.data.url) {
    throw new Error("O ImgBB não retornou uma URL de imagem válida.");
  }

  return dados.data.url;
}

/* -------------------------------------------------------------
   13. PUBLICAR NOVA RECEITA NO FEED
   -------------------------------------------------------------
   Estrutura salva: /receitas/{id_automatico}
   Cada receita guarda o autorId (uid) e autorNome, usados para
   exibir o autor no card e para decidir quem pode excluí-la.
   ------------------------------------------------------------- */
receitaForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem(receitaMensagemEl);

  const usuario = auth.currentUser;
  if (!usuario) return;

  const titulo = document.getElementById("receita-titulo").value.trim();
  const tempo = document.getElementById("receita-tempo").value.trim();
  const acessorios = document.getElementById("receita-acessorios").value.trim();
  const ingredientes = document.getElementById("receita-ingredientes").value.trim();
  const passos = document.getElementById("receita-passos").value.trim();

  if (!titulo || !ingredientes || !passos) {
    mostrarMensagem(receitaMensagemEl, "Preencha título, ingredientes e passo a passo.", "erro");
    return;
  }

  const botaoSalvar = receitaForm.querySelector("button[type=submit]");
  botaoSalvar.disabled = true;

  try {
    // 1) Se houver imagem selecionada, faz o upload primeiro
    let imagemUrl = null;
    if (arquivoImagemSelecionado) {
      salvarTextoEl.textContent = "Enviando imagem...";
      imagemUrl = await enviarImagemParaImgBB(arquivoImagemSelecionado);
    }

    // 2) Monta o objeto da receita
    salvarTextoEl.textContent = "Publicando...";
    const novaReceita = {
      titulo: titulo,
      tempo: tempo || null,
      acessorios: acessorios || null,
      ingredientes: ingredientes,
      passos: passos,
      imagemUrl: imagemUrl,
      autorId: usuario.uid,
      autorNome: usuario.displayName || usuario.email,
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    };

    // 3) Salva no feed público (push gera um ID único)
    await receitasRef.push(novaReceita);

    mostrarMensagem(receitaMensagemEl, "Receita publicada com sucesso!", "sucesso");
    receitaForm.reset();
    limparPreviewImagem();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(
      receitaMensagemEl,
      "Não foi possível publicar a receita. Tente novamente.",
      "erro"
    );
  } finally {
    botaoSalvar.disabled = false;
    salvarTextoEl.textContent = "Publicar receita";
  }
});

/* -------------------------------------------------------------
   14. OUVIR O FEED DE RECEITAS EM TEMPO REAL (evento 'value')
   -------------------------------------------------------------
   Como o feed agora é público e pode ter um volume grande de
   registros (inclusive as 1000 receitas de demonstração),
   ordenamos pelo campo 'criadoEm' no próprio servidor e
   limitamos às 300 mais recentes, evitando baixar o banco
   inteiro a cada atualização. Ajuste o limitToLast conforme a
   necessidade do seu projeto.
   ------------------------------------------------------------- */
function iniciarListenerDoFeed() {
  pararListenerDoFeed();

  const consulta = receitasRef.orderByChild("criadoEm").limitToLast(300);

  receitasListenerAtivo = consulta.on(
    "value",
    (snapshot) => {
      const dados = snapshot.val();
      renderizarFeed(dados);
    },
    (erro) => {
      console.error(erro);
      mostrarMensagem(
        receitaMensagemEl,
        "Não foi possível carregar o feed agora.",
        "erro"
      );
    }
  );
}

function pararListenerDoFeed() {
  if (receitasListenerAtivo) {
    receitasRef.orderByChild("criadoEm").off("value", receitasListenerAtivo);
  }
  receitasListenerAtivo = null;
}

/* -------------------------------------------------------------
   15. RENDERIZAR O FEED NA TELA
   ------------------------------------------------------------- */
function renderizarFeed(dados) {
  listaReceitasEl.innerHTML = "";

  if (!dados) {
    listaVaziaEl.classList.remove("hidden");
    contadorEl.textContent = "0";
    return;
  }

  // Transforma o objeto { id: {...}, id: {...} } em lista,
  // ordenando da mais recente para a mais antiga
  const receitas = Object.entries(dados)
    .map(([id, receita]) => ({ id, ...receita }))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  contadorEl.textContent = String(receitas.length);
  listaVaziaEl.classList.toggle("hidden", receitas.length > 0);

  const usuarioAtual = auth.currentUser;
  const fragment = document.createDocumentFragment();

  receitas.forEach((receita) => {
    fragment.appendChild(criarCardReceita(receita, usuarioAtual));
  });

  listaReceitasEl.appendChild(fragment);
}

/* -------------------------------------------------------------
   16. CRIAR O ELEMENTO HTML (card) DE UMA RECEITA
   -------------------------------------------------------------
   Todo texto vindo do banco passa por escapeHTML() antes de
   ser inserido via innerHTML, prevenindo ataques de XSS. O
   botão de excluir só é criado se o usuário logado for o autor.
   ------------------------------------------------------------- */
function criarCardReceita(receita, usuarioAtual) {
  const card = document.createElement("article");
  card.className = "receita-card";

  const ehAutor = !!usuarioAtual && receita.autorId === usuarioAtual.uid;
  const dataFormatada = formatarData(receita.criadoEm);

  // Bloco de imagem (ou ícone de fallback quando não há imagemUrl)
  const imagemHtml = receita.imagemUrl
    ? `<img class="receita-card-imagem" src="${escapeHTML(receita.imagemUrl)}" alt="Foto de ${escapeHTML(receita.titulo)}" loading="lazy" />`
    : `<span class="receita-card-imagem-fallback" aria-hidden="true">🍳</span>`;

  // Chips de metadados (tempo e acessórios), só aparecem se preenchidos
  let metaHtml = "";
  if (receita.tempo) {
    metaHtml += `<span class="receita-card-meta-item">⏱️ ${escapeHTML(receita.tempo)}</span>`;
  }
  if (receita.acessorios) {
    metaHtml += `<span class="receita-card-meta-item">🥄 ${escapeHTML(receita.acessorios)}</span>`;
  }

  card.innerHTML = `
    <div class="receita-card-imagem-wrapper">${imagemHtml}</div>
    <div class="receita-card-corpo">
      <p class="receita-card-autor">👤 ${escapeHTML(receita.autorNome || "Anônimo")}</p>
      <h4 class="receita-card-titulo">${escapeHTML(receita.titulo)}</h4>
      ${dataFormatada ? `<p class="receita-card-data">${dataFormatada}</p>` : ""}
      ${metaHtml ? `<div class="receita-card-meta">${metaHtml}</div>` : ""}

      <div class="receita-card-secao">
        <div class="receita-card-label">Ingredientes</div>
        <p class="receita-card-texto">${escapeHTML(receita.ingredientes)}</p>
      </div>

      <div class="receita-card-secao">
        <div class="receita-card-label">Passo a passo</div>
        <p class="receita-card-texto">${escapeHTML(receita.passos)}</p>
      </div>

      <div class="receita-card-footer">
        ${ehAutor ? `<button type="button" class="btn btn-excluir" data-id="${receita.id}">🗑️ Excluir</button>` : ""}
      </div>
    </div>
  `;

  if (ehAutor) {
    const botaoExcluir = card.querySelector(".btn-excluir");
    botaoExcluir.addEventListener("click", () => excluirReceita(receita.id));
  }

  return card;
}

function formatarData(timestamp) {
  if (!timestamp) return "";
  try {
    const data = new Date(timestamp);
    return data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (erro) {
    return "";
  }
}

/* -------------------------------------------------------------
   17. EXCLUIR RECEITA (apenas o autor consegue, graças às
   regras de segurança do Firebase — o botão só é exibido para
   o autor, mas a regra do servidor é a proteção de verdade)
   ------------------------------------------------------------- */
function excluirReceita(idReceita) {
  const usuario = auth.currentUser;
  if (!usuario) return;

  const confirmar = window.confirm("Tem certeza que deseja excluir esta receita?");
  if (!confirmar) return;

  db.ref(`receitas/${idReceita}`)
    .remove()
    .then(() => {
      mostrarMensagem(receitaMensagemEl, "Receita excluída.", "sucesso");
    })
    .catch((erro) => {
      console.error(erro);
      mostrarMensagem(receitaMensagemEl, "Não foi possível excluir a receita.", "erro");
    });
}

/* =============================================================
   18. GERAÇÃO DE RECEITAS DE DEMONSTRAÇÃO (botão "Gerar 1000")
   -------------------------------------------------------------
   Gera 1000 receitas com dados variados, combinando listas de
   pratos, ingredientes, tempos, acessórios e passos, todas
   atribuídas ao usuário logado no momento do clique.

   Observações de implementação:
   - As receitas demo NÃO fazem upload de imagem (evita gerar
     1000 chamadas ao ImgBB); elas usam o ícone de fallback 🍳,
     assim como qualquer receita real sem foto.
   - Em vez de 1000 chamadas separadas de push(), agrupamos as
     escritas em lotes com update() em múltiplos caminhos, que é
     muito mais rápido e eficiente no Realtime Database.
   ------------------------------------------------------------- */

const SEED_TOTAL = 1000;
const SEED_TAMANHO_LOTE = 100; // quantas receitas por chamada de update()

const SEED_PRATOS = [
  "Bolo de", "Torta de", "Sopa de", "Salada de", "Risoto de", "Escondidinho de",
  "Panqueca de", "Strogonoff de", "Lasanha de", "Omelete de", "Quiche de",
  "Bife de", "Suflê de", "Creme de", "Pastel de", "Empanada de", "Curry de",
  "Ensopado de", "Nhoque de", "Wrap de"
];

const SEED_SABORES = [
  "frango", "carne moída", "cenoura", "abóbora", "brócolis", "queijo e presunto",
  "cogumelos", "espinafre", "milho", "chocolate", "limão", "banana", "camarão",
  "berinjela", "abobrinha", "batata doce", "grão-de-bico", "lentilha", "tofu", "atum"
];

const SEED_INGREDIENTES = [
  "2 xícaras de farinha de trigo", "3 ovos", "1 xícara de leite", "1 colher de sopa de fermento",
  "2 colheres de sopa de azeite", "1 cebola picada", "2 dentes de alho", "sal e pimenta a gosto",
  "1 xícara de queijo ralado", "500g do ingrediente principal", "1 colher de chá de páprica",
  "2 xícaras de caldo de legumes", "1 xícara de creme de leite", "cheiro-verde picado",
  "1 colher de sopa de manteiga", "suco de 1 limão"
];

const SEED_UTENSILIOS = [
  "Forno", "Liquidificador", "Batedeira", "Panela de pressão", "Air fryer",
  "Processador de alimentos", "Frigideira antiaderente", "Panela funda", "Mixer", "Forma redonda"
];

function gerarNumeroAleatorio(max) {
  return Math.floor(Math.random() * max);
}

function embaralharEEscolher(lista, quantidade) {
  const copia = [...lista];
  const escolhidos = [];
  for (let i = 0; i < quantidade && copia.length > 0; i++) {
    const indice = gerarNumeroAleatorio(copia.length);
    escolhidos.push(copia.splice(indice, 1)[0]);
  }
  return escolhidos;
}

// Monta uma receita fake com dados variados, na mesma "forma" das receitas reais
function gerarReceitaDemo(indice, usuario) {
  const prato = SEED_PRATOS[gerarNumeroAleatorio(SEED_PRATOS.length)];
  const sabor = SEED_SABORES[gerarNumeroAleatorio(SEED_SABORES.length)];
  const titulo = `${prato} ${sabor} #${indice + 1}`;

  const listaIngredientes = embaralharEEscolher(SEED_INGREDIENTES, 4 + gerarNumeroAleatorio(4));
  const listaUtensilios = embaralharEEscolher(SEED_UTENSILIOS, 1 + gerarNumeroAleatorio(2));

  const passos = [
    "1. Separe e prepare todos os ingredientes.",
    `2. Misture os ingredientes principais com ${sabor}.`,
    "3. Tempere a gosto e ajuste o sal.",
    "4. Leve ao fogo/forno até atingir o ponto ideal.",
    "5. Deixe descansar alguns minutos antes de servir."
  ].join("\n");

  const tempoMinutos = 10 + gerarNumeroAleatorio(80);

  return {
    titulo: titulo,
    tempo: `${tempoMinutos} min`,
    acessorios: listaUtensilios.join(", "),
    ingredientes: listaIngredientes.join("\n"),
    passos: passos,
    imagemUrl: null, // receitas demo não fazem upload de imagem (veja observações acima)
    autorId: usuario.uid,
    autorNome: usuario.displayName || usuario.email,
    criadoEm: firebase.database.ServerValue.TIMESTAMP
  };
}

btnSeed.addEventListener("click", async () => {
  const usuario = auth.currentUser;
  if (!usuario) return;

  const confirmar = window.confirm(
    `Isso vai publicar ${SEED_TOTAL} receitas de exemplo no feed, usando a conta ${usuario.email}. Deseja continuar?`
  );
  if (!confirmar) return;

  btnSeed.disabled = true;
  seedProgressoEl.textContent = `Gerando 0/${SEED_TOTAL}...`;

  try {
    let geradas = 0;

    // Divide os 1000 registros em lotes, para não sobrecarregar
    // uma única chamada de update() nem travar a interface.
    while (geradas < SEED_TOTAL) {
      const tamanhoDoLote = Math.min(SEED_TAMANHO_LOTE, SEED_TOTAL - geradas);
      const atualizacoes = {};

      for (let i = 0; i < tamanhoDoLote; i++) {
        const idGerado = receitasRef.push().key; // gera um ID único sem gravar ainda
        atualizacoes[idGerado] = gerarReceitaDemo(geradas + i, usuario);
      }

      // Grava o lote inteiro em uma única operação (multi-path update)
      await receitasRef.update(atualizacoes);

      geradas += tamanhoDoLote;
      seedProgressoEl.textContent = `Gerando ${geradas}/${SEED_TOTAL}...`;
    }

    seedProgressoEl.textContent = `Pronto! ${SEED_TOTAL} receitas geradas.`;
    mostrarMensagem(receitaMensagemEl, `${SEED_TOTAL} receitas de demonstração foram publicadas.`, "sucesso");
  } catch (erro) {
    console.error(erro);
    seedProgressoEl.textContent = "Ocorreu um erro durante a geração.";
    mostrarMensagem(receitaMensagemEl, "Não foi possível concluir a geração das receitas demo.", "erro");
  } finally {
    btnSeed.disabled = false;
  }
});
