// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2Zi40wsyBoTeXb2syXvrogTb56lAVjk0",
  authDomain: "pcp-2e388.firebaseapp.com",
  databaseURL: "https://pcp-2e388-default-rtdb.firebaseio.com",
  projectId: "pcp-2e388",
  storageBucket: "pcp-2e388.firebasestorage.app",
  messagingSenderId: "725540904176",
  appId: "1:725540904176:web:5b60009763c36bb12d7635",
  measurementId: "G-G4S09PBEFB"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firestore
const db = firebase.firestore();

// Configurar para usar offline
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
    console.log('Múltiplas abas abertas, persistência desabilitada');
  } else if (err.code == 'unimplemented') {
    console.log('Browser não suporta persistência offline');
  }
});

// Funções para interagir com o Firestore
const FirebaseService = {
  // Salvar pedido principal
  async salvarPedido(dadosPedido) {
    try {
      const docRef = await db.collection('pedidos').add({
        ...dadosPedido,
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
        statusGeral: 'Pendente de Análise'
      });
      
      console.log('Pedido salvo com ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      throw error;
    }
  },

  // Salvar itens do pedido
  async salvarItens(pedidoId, listaItens) {
    try {
      const batch = db.batch();
      
      listaItens.forEach(item => {
        const itemRef = db.collection('itens').doc();
        batch.set(itemRef, {
          ...item,
          pedidoId: pedidoId,
          statusItem: 'Pendente de Análise',
          dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`${listaItens.length} itens salvos com sucesso`);
      return true;
    } catch (error) {
      console.error('Erro ao salvar itens:', error);
      throw error;
    }
  },

  // Buscar todos os pedidos
  async buscarPedidos() {
    try {
      const snapshot = await db.collection('pedidos')
        .orderBy('dataCriacao', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      throw error;
    }
  },

  // Buscar itens de um pedido
  async buscarItensPedido(pedidoId) {
    try {
      const snapshot = await db.collection('itens')
        .where('pedidoId', '==', pedidoId)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao buscar itens do pedido:', error);
      throw error;
    }
  },

  // Excluir pedido
  async excluirPedido(pedidoId) {
    try {
      await db.collection('pedidos').doc(pedidoId).delete();
      console.log('Pedido excluído com sucesso:', pedidoId);
      return true;
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      throw error;
    }
  },

  // Excluir item
  async excluirItem(itemId) {
    try {
      await db.collection('itens').doc(itemId).delete();
      console.log('Item excluído com sucesso:', itemId);
      return true;
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      throw error;
    }
  },

  // Atualizar pedido
  async atualizarPedido(pedidoId, dadosPedido) {
    try {
      await db.collection('pedidos').doc(pedidoId).update({
        ...dadosPedido,
        dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Pedido atualizado com sucesso:', pedidoId);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      throw error;
    }
  },

  // Buscar pedidos com filtros
  async buscarPedidosFiltrados(filtros = {}) {
    try {
      let query = db.collection('pedidos');

      // Aplicar filtros
      if (filtros.tipoProjeto) {
        query = query.where('tipoProjeto', '==', filtros.tipoProjeto);
      }

      if (filtros.terceirizado !== undefined) {
        query = query.where('ehTerceirizado', '==', filtros.terceirizado);
      }

      // Ordenação padrão
      query = query.orderBy('dataCriacao', 'desc');

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao buscar pedidos filtrados:', error);
      throw error;
    }
  },

  // Buscar pedidos por lista de material (consulta em duas etapas)
  async buscarPedidosPorListaMaterial(listaMaterial) {
    try {
      // Primeiro: buscar itens que contêm a lista de material
      const itensSnapshot = await db.collection('itens')
        .where('listaMaterial', '==', listaMaterial)
        .get();

      if (itensSnapshot.empty) {
        return [];
      }

      // Extrair IDs únicos dos pedidos
      const pedidoIds = [...new Set(itensSnapshot.docs.map(doc => doc.data().pedidoId))];

      // Segundo: buscar pedidos usando os IDs encontrados
      // Firebase tem limite de 10 itens no operador 'in', então dividir se necessário
      const pedidos = [];
      for (let i = 0; i < pedidoIds.length; i += 10) {
        const batch = pedidoIds.slice(i, i + 10);
        const pedidosSnapshot = await db.collection('pedidos')
          .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        pedidosSnapshot.docs.forEach(doc => {
          pedidos.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }

      return pedidos;
    } catch (error) {
      console.error('Erro ao buscar pedidos por lista de material:', error);
      throw error;
    }
  },

  // Buscar listas de materiais únicas
  async buscarListasMateriais() {
    try {
      const snapshot = await db.collection('itens').get();
      
      const listas = new Set();
      snapshot.docs.forEach(doc => {
        const listaMaterial = doc.data().listaMaterial;
        if (listaMaterial) {
          listas.add(listaMaterial);
        }
      });

      return Array.from(listas);
    } catch (error) {
      console.error('Erro ao buscar listas de materiais:', error);
      throw error;
    }
  }
};

// Exportar para uso global
window.FirebaseService = FirebaseService;