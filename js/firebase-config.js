// Importações do Firebase SDK v9+
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC2Zi40wsyBoTeXb2syXvrogTb56lAVjk0",
  authDomain: "pcp-2e388.firebaseapp.com",
  databaseURL: "https://pcp-2e388-default-rtdb.firebaseio.com",
  projectId: "pcp-2e388",
  storageBucket: "pcp-2e388.appspot.com",
  messagingSenderId: "725540904176",
  appId: "1:725540904176:web:5b60009763c36bb12d7635"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Realtime Database e obtém uma referência para o serviço
const database = getDatabase(app);

// Objeto exportado com as operações de banco de dados
export const DBOperations = {
  /**
   * Salva um novo pedido no Realtime Database.
   * @param {string} clienteNome - O nome do cliente.
   * @param {string} tipoProjeto - O tipo do projeto.
   * @param {object} dadosPedido - Os dados do pedido a serem salvos.
   * @returns {Promise<string>} - Uma promessa que resolve com a chave (ID) do novo pedido.
   */
  salvarPedido: function(clienteNome, tipoProjeto, dadosPedido) {
    return new Promise((resolve, reject) => {
      try {
        if (!clienteNome || !tipoProjeto) {
          throw new Error("Cliente e Tipo de Projeto são obrigatórios.");
        }

        // Constrói o caminho no banco de dados
        const caminho = `${clienteNome}/${tipoProjeto}`;
        const dbRef = ref(database, caminho);

        // Adiciona um timestamp do servidor aos dados
        const dadosComTimestamp = {
          ...dadosPedido,
          dataCriacao: serverTimestamp() // Usa o timestamp do servidor do Realtime Database
        };

        // Cria uma nova referência com um ID único
        const novoPedidoRef = push(dbRef);
        
        // Salva os dados na nova referência
        set(novoPedidoRef, dadosComTimestamp)
          .then(() => {
            console.log("Pedido salvo com sucesso! ID:", novoPedidoRef.key);
            resolve(novoPedidoRef.key); // Resolve a promessa com o ID do novo pedido
          })
          .catch((error) => {
            console.error("Erro ao salvar no DB:", error);
            reject(error);
          });
      } catch (error) {
        console.error("Erro ao tentar salvar pedido:", error);
        reject(error);
      }
    });
  }
  // Outras funções de DB (buscar, atualizar, deletar) podem ser adicionadas aqui no futuro.
};

// Para compatibilidade, se algum código antigo ainda usar a variável global.
// Idealmente, isso seria removido após a refatoração completa.
window.DBOperations = DBOperations;