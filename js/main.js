import { database } from './firebase-config.js';
import { ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Assumindo que DashboardManager está em seu próprio arquivo ou definido aqui.
// Se estiver em dashboard-manager.js, ele precisa EXPORTAR a classe/objeto
// e main.js precisa IMPORTAR. Ex: import DashboardManager from './dashboard-manager.js';

// Por segurança, vamos reescrever a lógica de leitura aqui.
function carregarPedidos() {
    const dbRef = ref(database); // Referência à raiz do banco

    onValue(dbRef, (snapshot) => {
        const listaPedidos = document.getElementById('lista-pedidos');
        if (!listaPedidos) return; // Adicionado para segurança
        listaPedidos.innerHTML = '';
        let count = 0;

        if (snapshot.exists()) {
            snapshot.forEach((clienteSnapshot) => {
                const clienteNome = clienteSnapshot.key;
                const tiposProjeto = clienteSnapshot.val();

                for (const tipoProjeto in tiposProjeto) {
                    const pedidos = tiposProjeto[tipoProjeto];
                    for (const pedidoId in pedidos) {
                        const pedido = pedidos[pedidoId];
                        count++;
                        const tr = document.createElement('tr');
                        // ... (código para criar a linha da tabela como na instrução anterior)
                        // IMPORTANTE: os botões devem ter os atributos data-*
                        tr.innerHTML = `
                            <td>${count}</td>
                            <td>${clienteNome}</td>
                            <td>${tipoProjeto}</td>
                            <td>${pedido.dataPedido || 'N/A'}</td>
                            <td>${pedido.status || 'N/A'}</td>
                            <td>${pedido.observacoes || ''}</td>
                            <td>
                                <button class="btn-delete"
                                        data-cliente="${clienteNome}"
                                        data-tipo-projeto="${tipoProjeto}"
                                        data-pedido-id="${pedidoId}">
                                    Excluir
                                </button>
                                </td>
                        `;
                        listaPedidos.appendChild(tr);
                    }
                }
            });
        }
        
        const contadorPedidos = document.getElementById('contador-pedidos');
        if (contadorPedidos) {
            contadorPedidos.innerText = count;
        }
    });
}

// Lógica de exclusão
const listaPedidosTable = document.getElementById('lista-pedidos');
if (listaPedidosTable) {
    listaPedidosTable.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('btn-delete')) {
            const cliente = target.dataset.cliente;
            const tipoProjeto = target.dataset.tipoProjeto;
            const pedidoId = target.dataset.pedidoId;

            if (confirm(`Tem certeza?`)) {
                const pedidoRef = ref(database, `${cliente}/${tipoProjeto}/${pedidoId}`);
                remove(pedidoRef);
            }
        }
    });
}

// Inicializa o carregamento dos pedidos
document.addEventListener('DOMContentLoaded', carregarPedidos);