/*
  posts.js
  ---------
  Aqui ficam os projetos que aparecem na seção "Projetos" do index.html.

  Como publicar um novo post de verdade (para quem visita o site ver):
  1. Abra painel.html, entre com a senha, adicione/edite os posts.
  2. Clique em "Baixar posts.js".
  3. Suba o arquivo baixado para o seu site, substituindo este aqui.

  Enquanto você não faz esse passo 3, os posts editados no painel só
  aparecem no seu próprio navegador (fica salvo localmente), porque este
  é um site estático sem servidor/banco de dados.
*/

const POSTS = [
  {
    id: "exemplo-inventario",
    title: "Sistema de Inventário",
    type: "LocalScript",
    tags: ["DataStore", "RemoteEvent", "UI"],
    description:
      "Sistema de inventário com grid arrastável, stacks de itens e persistência via DataStore, sincronizado entre servidor e cliente com RemoteEvents.",
    image: "",
    link: "",
    date: "2026-01-15"
  },
  {
    id: "exemplo-npc",
    title: "IA de NPC com Pathfinding",
    type: "Script",
    tags: ["PathfindingService", "State Machine"],
    description:
      "NPCs com máquina de estados (patrulha, perseguição, ataque) usando PathfindingService e detecção por raycast.",
    image: "",
    link: "",
    date: "2026-02-03"
  }
];
