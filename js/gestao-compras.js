/**
 * Gestão de Compras - Módulo 3 (Completamente Independente)
 * Responsável por gerir ordens de compra baseadas na análise de estoque
 */

// ============================================================================
// CONFIGURAÇÃO FIREBASE (INDEPENDENTE)
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyC38MEJFXKITFrrGkwxmyotgD1mCBVctc4",
    authDomain: "compras-e492e.firebaseapp.com",
    projectId: "compras-e492e",
    storageBucket: "compras-e492e.firebasestorage.app",
    messagingSenderId: "887834963114",
    appId: "1:887834963114:web:7cc2a590d840eb95fbb4d3",
    measurementId: "G-C95FD8WQQ9"
};

// Inicializar Firebase (se ainda não foi inicializado)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// ============================================================================
// CLASSE PRINCIPAL - GESTÃO DE COMPRAS
// ============================================================================
class GestaoCompras {
    constructor() {
        this.db = null;
        this.itensCarregados = [];
        this.itensSelecionados = [];
        this.filtroAtual = {
            cliente: '',
            tipoProjeto: '',
            listaMaterial: ''
        };
        
        this.init();
    }

    async init() {
        try {
            // Aguarda Firebase estar pronto
            if (typeof firebase === 'undefined') {
                console.error('Firebase não carregado');
                return;
            }
            
            this.db = firebase.firestore();
            
            // Configurar persistência offline
            try {
                await this.db.enablePersistence();
            } catch (err) {
                if (err.code == 'failed-precondition') {
                    console.log('Múltiplas abas abertas, persistência desabilitada');
                } else if (err.code == 'unimplemented') {
                    console.log('Browser não suporta persistência offline');
                }
            }
            
            await this.setupEventListeners();
            await this.carregarClientes();
            
            console.log('Gestão de Compras inicializada com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar Gestão de Compras:', error);
        }
    }

    async setupEventListeners() {
        // Filtros cascata
        document.getElementById('filtroCliente').addEventListener('change', (e) => {
            this.onClienteChange(e.target.value);
        });
        
        document.getElementById('filtroTipoProjeto').addEventListener('change', (e) => {
            this.onTipoProjetoChange(e.target.value);
        });
        
        document.getElementById('filtroListaMaterial').addEventListener('change', (e) => {
            this.onListaMaterialChange(e.target.value);
        });

        // Botões principais
        document.getElementById('btnAplicarFiltros').addEventListener('click', () => {
            this.carregarItens();
        });
        
        document.getElementById('btnVoltarDashboard').addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Gerenciamento de seleção
        document.getElementById('checkboxMaster').addEventListener('change', (e) => {
            this.selecionarTodos(e.target.checked);
        });
        
        document.getElementById('btnSelecionarTodos').addEventListener('click', () => {
            this.toggleSelecionarTodos();
        });
        
        document.getElementById('btnGerarCompra').addEventListener('click', () => {
            this.abrirModalCompra();
        });

        // Modal eventos
        document.getElementById('btnFecharModal').addEventListener('click', () => {
            this.fecharModal();
        });
        
        document.getElementById('btnCancelarModal').addEventListener('click', () => {
            this.fecharModal();
        });
        
        document.getElementById('btnBaixarCSV').addEventListener('click', () => {
            this.baixarCSV();
        });
        
        document.getElementById('btnSalvarCompra').addEventListener('click', () => {
            this.salvarCompra();
        });

        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharModal();
            }
        });
    }

    // ============================================================================
    // MÉTODOS DE CARREGAMENTO DE DADOS (OTIMIZADOS PARA EVITAR ÍNDICES)
    // ============================================================================
    
    async carregarClientes() {
        try {
            this.showLoading('filtroCliente');
            
            // OTIMIZAÇÃO: Buscar apenas por quantidadeComprar (sem outros filtros)
            const itensSnapshot = await this.db.collection('itens')
                .where('quantidadeComprar', '>', 0)
                .get();
            
            if (itensSnapshot.empty) {
                this.updateSelectInfo('clienteInfo', 'Nenhum item precisa ser comprado');
                return;
            }

            // Extrair pedidoIds únicos
            const pedidoIds = [...new Set(itensSnapshot.docs.map(doc => doc.data().pedidoId))];
            
            // Buscar dados dos pedidos em lotes pequenos (para evitar limits)
            const clientesUnicos = new Set();
            const batchSize = 10;
            
            for (let i = 0; i < pedidoIds.length; i += batchSize) {
                const batch = pedidoIds.slice(i, i + batchSize);
                const pedidosPromises = batch.map(id => this.db.collection('pedidos').doc(id).get());
                const pedidosSnapshots = await Promise.all(pedidosPromises);
                
                pedidosSnapshots.forEach(snapshot => {
                    if (snapshot.exists) {
                        const dados = snapshot.data();
                        if (dados.clienteNome) {
                            clientesUnicos.add(dados.clienteNome);
                        }
                    }
                });
            }

            // Preencher dropdown de clientes
            const selectCliente = document.getElementById('filtroCliente');
            selectCliente.innerHTML = '<option value="">Selecione um cliente...</option>';
            
            Array.from(clientesUnicos).sort().forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente;
                option.textContent = cliente;
                selectCliente.appendChild(option);
            });

            this.updateSelectInfo('clienteInfo', `${clientesUnicos.size} clientes com itens para compra`);
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            this.updateSelectInfo('clienteInfo', 'Erro ao carregar clientes');
        } finally {
            this.hideLoading('filtroCliente');
        }
    }

    async onClienteChange(clienteSelecionado) {
        this.filtroAtual.cliente = clienteSelecionado;
        this.resetFiltrosFilhos('tipoProjeto');
        
        if (!clienteSelecionado) return;

        try {
            this.showLoading('filtroTipoProjeto');
            
            // OTIMIZAÇÃO: Buscar pedidos apenas por clienteNome
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', clienteSelecionado)
                .get();
            
            if (pedidosSnapshot.empty) {
                this.updateSelectInfo('tipoProjetoInfo', 'Cliente sem pedidos');
                return;
            }

            // Verificar quais pedidos têm itens para compra (método otimizado)
            const pedidosComItens = new Set();
            const pedidosIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            // Buscar todos os itens de uma vez, filtrando pelo pedidoId
            for (const pedidoId of pedidosIds) {
                // OTIMIZAÇÃO: Buscar apenas por quantidadeComprar, depois filtrar por pedidoId
                const itensSnapshot = await this.db.collection('itens')
                    .where('quantidadeComprar', '>', 0)
                    .limit(1000) // Limit razoável
                    .get();
                
                const itensDosPedidos = itensSnapshot.docs.filter(doc => 
                    doc.data().pedidoId === pedidoId
                );
                
                if (itensDosPedidos.length > 0) {
                    const pedidoDoc = pedidosSnapshot.docs.find(doc => doc.id === pedidoId);
                    if (pedidoDoc) {
                        pedidosComItens.add(pedidoDoc.data().tipoProjeto);
                    }
                }
            }

            // Preencher dropdown de tipos de projeto
            const selectTipoProjeto = document.getElementById('filtroTipoProjeto');
            selectTipoProjeto.innerHTML = '<option value="">Selecione um tipo de projeto...</option>';
            selectTipoProjeto.disabled = false;
            
            Array.from(pedidosComItens).sort().forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                selectTipoProjeto.appendChild(option);
            });

            this.updateSelectInfo('tipoProjetoInfo', `${pedidosComItens.size} tipos disponíveis`);
            
        } catch (error) {
            console.error('Erro ao carregar tipos de projeto:', error);
            this.updateSelectInfo('tipoProjetoInfo', 'Erro ao carregar tipos');
        } finally {
            this.hideLoading('filtroTipoProjeto');
        }
    }

    async onTipoProjetoChange(tipoSelecionado) {
        this.filtroAtual.tipoProjeto = tipoSelecionado;
        this.resetFiltrosFilhos('listaMaterial');
        
        if (!tipoSelecionado) return;

        try {
            this.showLoading('filtroListaMaterial');
            
            // OTIMIZAÇÃO: Buscar pedidos com filtros simples
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', this.filtroAtual.cliente)
                .where('tipoProjeto', '==', tipoSelecionado)
                .get();
            
            if (pedidosSnapshot.empty) {
                this.updateSelectInfo('listaMaterialInfo', 'Nenhum pedido encontrado');
                return;
            }

            // Buscar listas de materiais (método otimizado)
            const listasComItens = new Set();
            const pedidosIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            // Buscar itens de forma otimizada
            const itensSnapshot = await this.db.collection('itens')
                .where('quantidadeComprar', '>', 0)
                .limit(1000)
                .get();
            
            itensSnapshot.docs.forEach(doc => {
                const item = doc.data();
                if (pedidosIds.includes(item.pedidoId) && item.listaMaterial) {
                    listasComItens.add(item.listaMaterial);
                }
            });

            // Preencher dropdown de listas de material
            const selectListaMaterial = document.getElementById('filtroListaMaterial');
            selectListaMaterial.innerHTML = '<option value="">Selecione uma lista de material...</option>';
            selectListaMaterial.disabled = false;
            
            Array.from(listasComItens).sort().forEach(lista => {
                const option = document.createElement('option');
                option.value = lista;
                option.textContent = lista;
                selectListaMaterial.appendChild(option);
            });

            this.updateSelectInfo('listaMaterialInfo', `${listasComItens.size} listas disponíveis`);
            
        } catch (error) {
            console.error('Erro ao carregar listas de material:', error);
            this.updateSelectInfo('listaMaterialInfo', 'Erro ao carregar listas');
        } finally {
            this.hideLoading('filtroListaMaterial');
        }
    }

    onListaMaterialChange(listaSelecionada) {
        this.filtroAtual.listaMaterial = listaSelecionada;
        
        // Habilitar botão de aplicar filtros se todos os filtros estão preenchidos
        const btnAplicar = document.getElementById('btnAplicarFiltros');
        btnAplicar.disabled = !(this.filtroAtual.cliente && this.filtroAtual.tipoProjeto && this.filtroAtual.listaMaterial);
    }

    async carregarItens() {
        try {
            this.showLoading('secaoItens');
            
            // OTIMIZAÇÃO: Buscar pedidos com filtros simples
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', this.filtroAtual.cliente)
                .where('tipoProjeto', '==', this.filtroAtual.tipoProjeto)
                .get();
            
            if (pedidosSnapshot.empty) {
                this.mostrarEstadoVazio('Nenhum pedido encontrado com os filtros selecionados');
                return;
            }

            // OTIMIZAÇÃO: Buscar itens de forma eficiente
            const pedidoIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            // Buscar todos os itens que precisam ser comprados
            const itensSnapshot = await this.db.collection('itens')
                .where('quantidadeComprar', '>', 0)
                .limit(1000)
                .get();
            
            // Filtrar itens pelos critérios
            this.itensCarregados = [];
            itensSnapshot.docs.forEach(doc => {
                const item = doc.data();
                if (pedidoIds.includes(item.pedidoId) && 
                    item.listaMaterial === this.filtroAtual.listaMaterial) {
                    this.itensCarregados.push({
                        id: doc.id,
                        ...item
                    });
                }
            });

            if (this.itensCarregados.length === 0) {
                this.mostrarEstadoVazio('Nenhum item precisa ser comprado com os filtros selecionados');
                return;
            }

            // Exibir tabela
            this.renderizarTabelaItens();
            this.mostrarSecaoItens();
            
            // Atualizar info
            document.getElementById('infoItensCarregados').textContent = 
                `${this.itensCarregados.length} itens encontrados para compra`;
            
        } catch (error) {
            console.error('Erro ao carregar itens:', error);
            this.mostrarEstadoVazio('Erro ao carregar itens');
        } finally {
            this.hideLoading('secaoItens');
        }
    }

    // ============================================================================
    // MÉTODOS DE INTERFACE E INTERAÇÃO
    // ============================================================================
    
    renderizarTabelaItens() {
        const tbody = document.getElementById('corpoTabelaItens');
        tbody.innerHTML = '';

        this.itensCarregados.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <input type="checkbox" 
                           class="rounded item-checkbox" 
                           data-item-id="${item.id}"
                           data-index="${index}">
                </td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                    ${item.codigo || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.produtoDescricao || item.descricao || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-900 font-semibold">
                    ${this.formatarQuantidade(item.quantidadeComprar)}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Adicionar listeners aos checkboxes
        tbody.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.onItemSelecionado();
            });
        });
    }

    onItemSelecionado() {
        const checkboxesSelecionados = document.querySelectorAll('.item-checkbox:checked');
        const totalSelecionados = checkboxesSelecionados.length;
        
        // Atualizar checkbox master
        const checkboxMaster = document.getElementById('checkboxMaster');
        checkboxMaster.indeterminate = totalSelecionados > 0 && totalSelecionados < this.itensCarregados.length;
        checkboxMaster.checked = totalSelecionados === this.itensCarregados.length;
        
        // Habilitar/desabilitar botões
        document.getElementById('btnGerarCompra').disabled = totalSelecionados === 0;
        
        // Atualizar texto do botão
        const btnSelecionar = document.getElementById('btnSelecionarTodos');
        btnSelecionar.textContent = totalSelecionados === this.itensCarregados.length ? 'Desmarcar Todos' : 'Selecionar Todos';
    }

    selecionarTodos(selecionar) {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.checked = selecionar;
        });
        this.onItemSelecionado();
    }

    toggleSelecionarTodos() {
        const checkboxesSelecionados = document.querySelectorAll('.item-checkbox:checked');
        const todosSeleecionados = checkboxesSelecionados.length === this.itensCarregados.length;
        this.selecionarTodos(!todosSeleecionados);
    }

    // ============================================================================
    // MODAL E GERAÇÃO DE COMPRAS
    // ============================================================================
    
    abrirModalCompra() {
        // Coletar itens selecionados
        this.itensSelecionados = [];
        document.querySelectorAll('.item-checkbox:checked').forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            this.itensSelecionados.push(this.itensCarregados[index]);
        });

        if (this.itensSelecionados.length === 0) {
            alert('Selecione pelo menos um item');
            return;
        }

        // Preencher informações do contexto
        document.getElementById('modalCliente').textContent = this.filtroAtual.cliente;
        document.getElementById('modalTipoProjeto').textContent = this.filtroAtual.tipoProjeto;
        document.getElementById('modalListaMaterial').textContent = this.filtroAtual.listaMaterial;
        document.getElementById('totalItensSelecionados').textContent = this.itensSelecionados.length;
        
        // Configurar data padrão para prazo de entrega (7 dias a partir de hoje)
        const dataAtual = new Date();
        dataAtual.setDate(dataAtual.getDate() + 7);
        const dataFormatada = dataAtual.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        document.getElementById('inputPrazoEntrega').value = dataFormatada;

        // Renderizar tabela do modal
        this.renderizarTabelaModal();

        // Mostrar modal
        document.getElementById('modalCompra').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    renderizarTabelaModal() {
        const tbody = document.getElementById('corpoTabelaModalCompra');
        tbody.innerHTML = '';

        this.itensSelecionados.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                    ${item.codigo || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.produtoDescricao || item.descricao || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                    ${this.formatarQuantidade(item.quantidadeComprar)}
                </td>
                <td class="px-4 py-3">
                    <input type="number" 
                           class="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                           placeholder="${item.quantidadeComprar}"
                           min="0"
                           step="1"
                           data-item-index="${index}">
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    fecharModal() {
        document.getElementById('modalCompra').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    baixarCSV() {
        try {
            // Obter nome do fornecedor
            const fornecedor = document.getElementById('inputFornecedor').value.trim() || 'Não informado';

            // Coletar dados da tabela do modal
            const dadosCSV = [];
            const tbody = document.getElementById('corpoTabelaModalCompra');
            const linhas = tbody.querySelectorAll('tr');

            // Obter prazo de entrega
            const prazoEntrega = document.getElementById('inputPrazoEntrega').value;
            const dataFormatada = prazoEntrega ? new Date(prazoEntrega).toLocaleDateString('pt-BR') : 'Não informado';
            
            // Cabeçalho
            dadosCSV.push(['Código', 'Descrição', 'Qtd. Solicitada', 'Qtd. a Comprar (Real)', 'Fornecedor', 'Prazo de Entrega']);

            // Dados
            linhas.forEach((linha, index) => {
                const item = this.itensSelecionados[index];
                const inputQtd = linha.querySelector('input[type="number"]');
                const qtdComprar = inputQtd.value || item.quantidadeComprar;

                dadosCSV.push([
                    item.codigo || 'N/A',
                    item.produtoDescricao || item.descricao || 'N/A',
                    item.quantidadeComprar,
                    qtdComprar,
                    fornecedor,
                    dataFormatada
                ]);
            });

            // Criar workbook e planilha
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(dadosCSV);

            // Adicionar ao workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Ordem de Compra');

            // Gerar nome do arquivo
            const timestamp = new Date().toISOString().slice(0, 10);
            const nomeArquivo = `ordem-compra-${this.filtroAtual.cliente.replace(/\s+/g, '_')}-${timestamp}.xlsx`;

            // Download
            XLSX.writeFile(wb, nomeArquivo);

        } catch (error) {
            console.error('Erro ao gerar CSV:', error);
            alert('Erro ao gerar arquivo. Verifique se todos os campos estão preenchidos.');
        }
    }

    async salvarCompra() {
        try {
            this.showLoading('btnSalvarCompra');

            // Obter nome do fornecedor
            const fornecedor = document.getElementById('inputFornecedor').value.trim();
            if (!fornecedor) {
                alert('Por favor, informe o nome do fornecedor.');
                return;
            }
            
            // Obter prazo de entrega
            const prazoEntrega = document.getElementById('inputPrazoEntrega').value;
            if (!prazoEntrega) {
                alert('Por favor, informe o prazo de entrega.');
                return;
            }

            // Validar quantidades
            const tbody = document.getElementById('corpoTabelaModalCompra');
            const inputs = tbody.querySelectorAll('input[type="number"]');
            const atualizacoes = [];

            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                const item = this.itensSelecionados[i];
                const qtdComprar = parseFloat(input.value) || item.quantidadeComprar;

                if (qtdComprar <= 0) {
                    alert(`Quantidade inválida para o item ${item.codigo}`);
                    return;
                }

                // Calcular nova quantidade a comprar
                const novaQuantidadeComprar = Math.max(0, item.quantidadeComprar - qtdComprar);
                const novoStatus = novaQuantidadeComprar === 0 ? 'Comprado' : 'Parcialmente Processado';

                atualizacoes.push({
                    id: item.id,
                    qtdComprada: (item.qtdeComprada || 0) + qtdComprar,
                    quantidadeComprar: novaQuantidadeComprar,
                    statusItem: novoStatus,
                    fornecedor: fornecedor, // Adicionar fornecedor
                    prazoEntrega: prazoEntrega, // Adicionar prazo de entrega
                    ordemCompra: {
                        numeroOC: `OC-${Date.now()}`,
                        dataCompra: new Date().toISOString(),
                        cliente: this.filtroAtual.cliente,
                        tipoProjeto: this.filtroAtual.tipoProjeto,
                        listaMaterial: this.filtroAtual.listaMaterial,
                        fornecedor: fornecedor, // Também no objeto ordemCompra
                        prazoEntrega: prazoEntrega // Também no objeto ordemCompra
                    }
                });
            }

            // Executar batch update
            const batch = this.db.batch();
            atualizacoes.forEach(atualizacao => {
                const docRef = this.db.collection('itens').doc(atualizacao.id);
                batch.update(docRef, {
                    qtdeComprada: atualizacao.qtdComprada,
                    quantidadeComprar: atualizacao.quantidadeComprar,
                    statusItem: atualizacao.statusItem,
                    fornecedor: atualizacao.fornecedor, // Salvar fornecedor no item
                    prazoEntrega: atualizacao.prazoEntrega, // Salvar prazo de entrega no item
                    ordemCompra: atualizacao.ordemCompra,
                    // 🔧 ADICIONAR CAMPO qtdePendenteRecebimento PARA O MÓDULO DE RECEBIMENTO
                    qtdePendenteRecebimento: atualizacao.qtdComprada, // Mesmo valor da quantidade comprada
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();

            // Formatar data para exibição
            const dataFormatada = new Date(prazoEntrega).toLocaleDateString('pt-BR');
            
            // Feedback de sucesso
            alert(`Compra salva com sucesso! ${atualizacoes.length} itens atualizados com o fornecedor "${fornecedor}" e prazo de entrega para ${dataFormatada}.`);
            
            // Limpar campos
            document.getElementById('inputFornecedor').value = '';
            document.getElementById('inputPrazoEntrega').value = '';
            
            // Fechar modal e recarregar dados
            this.fecharModal();
            await this.carregarItens();

        } catch (error) {
            console.error('Erro ao salvar compra:', error);
            alert('Erro ao salvar compra. Tente novamente.');
        } finally {
            this.hideLoading('btnSalvarCompra');
        }
    }

    // ============================================================================
    // MÉTODOS AUXILIARES
    // ============================================================================
    
    resetFiltrosFilhos(nivel) {
        if (nivel === 'tipoProjeto') {
            const selectTipo = document.getElementById('filtroTipoProjeto');
            selectTipo.innerHTML = '<option value="">Primeiro selecione um cliente</option>';
            selectTipo.disabled = true;
            this.updateSelectInfo('tipoProjetoInfo', 'Aguardando seleção do cliente');
            this.filtroAtual.tipoProjeto = '';
            this.resetFiltrosFilhos('listaMaterial');
        }
        
        if (nivel === 'listaMaterial') {
            const selectLista = document.getElementById('filtroListaMaterial');
            selectLista.innerHTML = '<option value="">Primeiro selecione tipo projeto</option>';
            selectLista.disabled = true;
            this.updateSelectInfo('listaMaterialInfo', 'Aguardando seleção do tipo de projeto');
            this.filtroAtual.listaMaterial = '';
            document.getElementById('btnAplicarFiltros').disabled = true;
        }
    }

    mostrarSecaoItens() {
        document.getElementById('secaoItens').classList.remove('hidden');
        document.getElementById('estadoVazioItens').classList.add('hidden');
        document.getElementById('btnSelecionarTodos').disabled = false;
    }

    mostrarEstadoVazio(mensagem) {
        document.getElementById('secaoItens').classList.remove('hidden');
        document.getElementById('estadoVazioItens').classList.remove('hidden');
        document.getElementById('estadoVazioItens').querySelector('p').textContent = mensagem;
        document.getElementById('corpoTabelaItens').innerHTML = '';
        document.getElementById('btnSelecionarTodos').disabled = true;
        document.getElementById('btnGerarCompra').disabled = true;
    }

    updateSelectInfo(elementId, texto) {
        document.getElementById(elementId).textContent = texto;
    }

    showLoading(elementId) {
        const elemento = document.getElementById(elementId);
        if (elemento) {
            elemento.classList.add('loading');
        }
    }

    hideLoading(elementId) {
        const elemento = document.getElementById(elementId);
        if (elemento) {
            elemento.classList.remove('loading');
        }
    }

    formatarQuantidade(quantidade) {
        return Number(quantidade).toLocaleString('pt-BR');
    }
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.gestaoCompras = new GestaoCompras();
});

// Exportar para debug
window.debugGestaoCompras = () => {
    console.log('Estado atual da Gestão de Compras:', {
        filtros: window.gestaoCompras.filtroAtual,
        itensCarregados: window.gestaoCompras.itensCarregados.length,
        itensSelecionados: window.gestaoCompras.itensSelecionados.length
    });
};