/**
 * Sistema de Separação para Produção
 * Responsável por gerenciar a separação de itens para produção após análise final
 */

class SistemaSeparacaoProducao {
    constructor() {
        // Elementos DOM - Filtros
        this.selectCliente = document.getElementById('selectCliente');
        this.selectProjeto = document.getElementById('selectProjeto');
        this.selectLista = document.getElementById('selectLista');
        this.btnCarregarItens = document.getElementById('btnCarregarItens');
        
        // Aplicar estilo adequado aos selects
        const selectStyle = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500';
        this.selectCliente.className = selectStyle;
        this.selectProjeto.className = selectStyle;
        this.selectLista.className = selectStyle;
        
        // Elementos DOM - Tabela
        this.tabelaSection = document.getElementById('tabelaSection');
        this.tabelaItensBody = document.getElementById('tabelaItensBody');
        this.totalItensSeparacao = document.getElementById('totalItensSeparacao');
        this.selectAll = document.getElementById('selectAll');
        
        // Elementos DOM - Ações em Massa
        this.btnSeparacaoEmMassa = document.getElementById('btnSeparacaoEmMassa');
        this.btnDevolucaoEmMassa = document.getElementById('btnDevolucaoEmMassa');
        
        // Elementos DOM - Modal Separação
        this.modalSeparacao = document.getElementById('modalSeparacao');
        this.qtdItensSeparar = document.getElementById('qtdItensSeparar');
        this.listaItensSeparar = document.getElementById('listaItensSeparar');
        this.btnCancelarSeparacao = document.getElementById('btnCancelarSeparacao');
        this.btnConfirmarSeparacao = document.getElementById('btnConfirmarSeparacao');
        
        // Elementos DOM - Modal Devolução
        this.modalDevolucao = document.getElementById('modalDevolucao');
        this.qtdItensDevolucao = document.getElementById('qtdItensDevolucao');
        this.listaItensDevolucao = document.getElementById('listaItensDevolucao');
        this.btnCancelarDevolucao = document.getElementById('btnCancelarDevolucao');
        this.btnConfirmarDevolucao = document.getElementById('btnConfirmarDevolucao');
        
        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        
        // Dados da aplicação
        this.itensParaSeparacao = [];
        this.itensSelecionados = new Set();
        this.db = firebase.firestore();
        
        // Inicializar
        this.init();
    }
    
    /**
     * Inicializar o sistema
     */
    async init() {
        try {
            console.log('🚀 Inicializando Sistema de Separação para Produção...');
            
            this.setupEventListeners();
            await this.carregarClientesComItensParaSeparacao();
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema:', error);
            this.showToast('Erro ao inicializar: ' + error.message, 'error');
        }
    }
    
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Filtros em cascata
        this.selectCliente.addEventListener('change', () => this.onClienteChange());
        this.selectProjeto.addEventListener('change', () => this.onProjetoChange());
        this.selectLista.addEventListener('change', () => this.onListaChange());
        this.btnCarregarItens.addEventListener('click', () => this.carregarItensParaSeparacao());
        
        // Seleção de itens
        this.selectAll.addEventListener('change', () => this.onSelectAllChange());
        
        // Ações em massa
        this.btnSeparacaoEmMassa.addEventListener('click', () => this.abrirModalSeparacao());
        this.btnDevolucaoEmMassa.addEventListener('click', () => this.abrirModalDevolucao());
        
        // Modal Separação
        this.btnCancelarSeparacao.addEventListener('click', () => this.fecharModal(this.modalSeparacao));
        this.btnConfirmarSeparacao.addEventListener('click', () => this.confirmarSeparacaoProducao());
        
        // Modal Devolução
        this.btnCancelarDevolucao.addEventListener('click', () => this.fecharModal(this.modalDevolucao));
        this.btnConfirmarDevolucao.addEventListener('click', () => this.confirmarDevolucaoEstoque());
        
        // Fechar modais ao clicar fora
        window.addEventListener('click', (e) => {
            if (e.target === this.modalSeparacao) this.fecharModal(this.modalSeparacao);
            if (e.target === this.modalDevolucao) this.fecharModal(this.modalDevolucao);
        });
        
        // Fechar modais com ESC
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharModal(this.modalSeparacao);
                this.fecharModal(this.modalDevolucao);
            }
        });
        
        // Fechar modais pelos botões X
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.fecharModal(modal);
            });
        });
    }
    
    /**
     * Carregar clientes que têm itens para separação (compraFinal > 0)
     */
    async carregarClientesComItensParaSeparacao() {
        try {
            this.showLoading('Carregando clientes...');
            
            // Buscar itens que têm qtdNecessariaFinal > 0
            const itensSnapshot = await this.db.collection('itens')
                .where('qtdNecessariaFinal', '>', 0)
                .get();
            
            console.log(`📊 ${itensSnapshot.size} itens com qtdNecessariaFinal > 0 encontrados`);
            
            if (itensSnapshot.empty) {
                this.showToast('Nenhum item encontrado para separação', 'warning');
                this.hideLoading();
                return;
            }
            
            // Coletar IDs de pedidos para buscar clientes
            const pedidoIds = new Set();
            itensSnapshot.forEach(doc => {
                const item = doc.data();
                if (item.pedidoId) {
                    pedidoIds.add(item.pedidoId);
                }
            });
            
            console.log(`🔍 Buscando informações de ${pedidoIds.size} pedidos`);
            
            // Buscar pedidos para obter informações de clientes
            const clientes = new Set();
            
            for (const pedidoId of pedidoIds) {
                try {
                    const pedidoDoc = await this.db.collection('pedidos').doc(pedidoId).get();
                    
                    if (pedidoDoc.exists) {
                        const pedido = pedidoDoc.data();
                        if (pedido.clienteNome) {
                            clientes.add(pedido.clienteNome);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao buscar pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de clientes
            this.selectCliente.innerHTML = '<option value="">Selecione um Cliente</option>';
            
            Array.from(clientes).sort().forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente;
                option.textContent = cliente;
                this.selectCliente.appendChild(option);
            });
            
            console.log(`✅ ${clientes.size} clientes carregados`);
            
            if (clientes.size === 0) {
                this.showToast('Nenhum cliente encontrado com itens para separação', 'warning');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            this.showToast('Erro ao carregar clientes: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Handler para mudança de cliente
     */
    async onClienteChange() {
        const clienteSelecionado = this.selectCliente.value;
        // Reset de filtros dependentes
        this.selectProjeto.innerHTML = '<option value="">Selecione um Projeto</option>';
        this.selectProjeto.disabled = !clienteSelecionado;
        this.selectLista.innerHTML = '<option value="">Selecione uma Lista</option>';
        this.selectLista.disabled = true;
        this.btnCarregarItens.disabled = true;
        
        if (!clienteSelecionado) {
            this.tabelaSection.classList.add('hidden');
            return;
        }
        
        try {
            this.showLoading('Carregando projetos...');
            
            // Buscar pedidos do cliente selecionado
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', clienteSelecionado)
                .get();
            
            // Coletar IDs de pedidos para buscar itens
            const pedidoIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            if (pedidoIds.length === 0) {
                this.hideLoading();
                this.showToast('Nenhum pedido encontrado para este cliente', 'warning');
                return;
            }
            
            // Buscar projetos dos pedidos (sem filtrar por qtdNecessariaFinal para evitar índice composto)
            const projetos = new Set();
            
            for (const pedidoId of pedidoIds) {
                try {
                    // Buscar projeto do pedido primeiro
                    const pedidoDoc = await this.db.collection('pedidos').doc(pedidoId).get();
                    if (pedidoDoc.exists) {
                        const pedido = pedidoDoc.data();
                        
                        // Verificar se este pedido tem itens com qtdNecessariaFinal > 0
                        const itensSnapshot = await this.db.collection('itens')
                            .where('pedidoId', '==', pedidoId)
                            .get();
                        
                        // Filtrar no lado do cliente para evitar índice composto
                        const temItensParaSeparacao = itensSnapshot.docs.some(doc => {
                            const item = doc.data();
                            return (item.qtdNecessariaFinal || 0) > 0;
                        });
                        
                        if (temItensParaSeparacao && pedido.tipoProjeto) {
                            projetos.add(pedido.tipoProjeto);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao processar pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de projetos
            Array.from(projetos).sort().forEach(projeto => {
                const option = document.createElement('option');
                option.value = projeto;
                option.textContent = projeto;
                this.selectProjeto.appendChild(option);
            });
            
            console.log(`✅ ${projetos.size} projetos carregados`);
            
            if (projetos.size === 0) {
                this.showToast('Nenhum projeto encontrado com itens para separação', 'warning');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar projetos:', error);
            this.showToast('Erro ao carregar projetos: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Handler para mudança de projeto
     */
    async onProjetoChange() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        
        // Reset de filtros dependentes
        this.selectLista.innerHTML = '<option value="">Selecione uma Lista</option>';
        this.selectLista.disabled = !projetoSelecionado;
        this.btnCarregarItens.disabled = true;
        
        if (!projetoSelecionado) {
            this.tabelaSection.classList.add('hidden');
            return;
        }
        
        try {
            this.showLoading('Carregando listas...');
            
            // Buscar pedidos do cliente e projeto selecionados
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', clienteSelecionado)
                .where('tipoProjeto', '==', projetoSelecionado)
                .get();
            
            // Coletar IDs de pedidos para buscar itens
            const pedidoIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            if (pedidoIds.length === 0) {
                this.hideLoading();
                this.showToast('Nenhum pedido encontrado para este cliente e projeto', 'warning');
                return;
            }
            
            // Buscar listas de material (sem filtrar por qtdNecessariaFinal para evitar índice composto)
            const listas = new Set();
            
            for (const pedidoId of pedidoIds) {
                try {
                    const itensSnapshot = await this.db.collection('itens')
                        .where('pedidoId', '==', pedidoId)
                        .get();
                    
                    // Filtrar no lado do cliente para evitar índice composto
                    itensSnapshot.forEach(doc => {
                        const item = doc.data();
                        if ((item.qtdNecessariaFinal || 0) > 0 && item.listaMaterial) {
                            listas.add(item.listaMaterial);
                        }
                    });
                } catch (err) {
                    console.warn(`⚠️ Erro ao processar itens do pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de listas
            Array.from(listas).sort().forEach(lista => {
                const option = document.createElement('option');
                option.value = lista;
                option.textContent = lista;
                this.selectLista.appendChild(option);
            });
            
            console.log(`✅ ${listas.size} listas carregadas`);
            
            if (listas.size === 0) {
                this.showToast('Nenhuma lista encontrada com itens para separação', 'warning');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar listas:', error);
            this.showToast('Erro ao carregar listas: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Handler para mudança de lista
     */
    onListaChange() {
        const listaSelecionada = this.selectLista.value;
        this.btnCarregarItens.disabled = !listaSelecionada;
        
        if (!listaSelecionada) {
            this.tabelaSection.classList.add('hidden');
        }
    }
    
    /**
     * Carregar itens para separação
     */
    async carregarItensParaSeparacao() {
        const cliente = this.selectCliente.value;
        const projeto = this.selectProjeto.value;
        const lista = this.selectLista.value;
        
        if (!cliente || !projeto || !lista) {
            this.showToast('Selecione todos os filtros', 'warning');
            return;
        }
        
        try {
            this.showLoading('Carregando itens para separação...');
            
            // Buscar pedidos do cliente e projeto selecionados
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', cliente)
                .where('tipoProjeto', '==', projeto)
                .get();
            
            // Coletar IDs de pedidos para buscar itens
            const pedidoIds = pedidosSnapshot.docs.map(doc => doc.id);
            
            if (pedidoIds.length === 0) {
                this.hideLoading();
                this.showToast('Nenhum pedido encontrado para este cliente e projeto', 'warning');
                return;
            }
            
            // Buscar itens para separação (sem filtros compostos para evitar índice)
            this.itensParaSeparacao = [];
            
            for (const pedidoId of pedidoIds) {
                try {
                    // Buscar todos os itens do pedido com a lista de material específica
                    // (Apenas duas condições, não requer índice composto)
                    const itensSnapshot = await this.db.collection('itens')
                        .where('pedidoId', '==', pedidoId)
                        .where('listaMaterial', '==', lista)
                        .get();
                    
                    // Filtrar no lado do cliente
                    for (const doc of itensSnapshot.docs) {
                        const item = { id: doc.id, ...doc.data() };
                        
                        // Filtrar apenas itens com qtdNecessariaFinal > 0
                        if (!item.qtdNecessariaFinal || item.qtdNecessariaFinal <= 0) {
                            continue;
                        }
                        
                        // Verificar se o item com compraFinal > 0 já foi recebido
                        if (item.compraFinal > 0) {
                            // Verificar se a compra final já foi recebida (historicoRecebimento tem a quantia)
                            const totalRecebidoCompraFinal = this.calcularTotalRecebidoCompraFinal(item);
                            
                            // Se a compra final já foi totalmente recebida, pular este item
                            if (totalRecebidoCompraFinal >= item.compraFinal) {
                                console.log(`⏭️ Item ${item.codigo} - Compra final já foi recebida (${totalRecebidoCompraFinal}/${item.compraFinal})`);
                                continue;
                            }
                        }
                        
                        // Adicionar item à lista
                        this.itensParaSeparacao.push(item);
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao buscar itens do pedido ${pedidoId}:`, err);
                }
            }
            
            console.log(`📊 ${this.itensParaSeparacao.length} itens encontrados para separação`);
            
            // Mostrar tabela de itens
            this.renderizarTabelaItens();
            
        } catch (error) {
            console.error('❌ Erro ao carregar itens:', error);
            this.showToast('Erro ao carregar itens: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Calcular total recebido da compra final
     */
    calcularTotalRecebidoCompraFinal(item) {
        if (!item.historicoRecebimentos || !Array.isArray(item.historicoRecebimentos)) {
            return 0;
        }
        
        // Filtrar recebimentos de compra final e somar quantidades
        return item.historicoRecebimentos
            .filter(rec => rec.tipoCompra === 'Final')
            .reduce((total, rec) => {
                return total + (rec.qtde || rec.qtdeRecebida || 0);
            }, 0);
    }
    
    /**
     * Renderizar tabela de itens para separação
     */
    renderizarTabelaItens() {
        // Resetar seleções
        this.itensSelecionados.clear();
        this.selectAll.checked = false;
        
        // Mostrar seção da tabela
        this.tabelaSection.classList.remove('hidden');
        
        // Atualizar contador
        this.totalItensSeparacao.textContent = this.itensParaSeparacao.length;
        
        // Desabilitar botões de ação em massa
        this.btnSeparacaoEmMassa.disabled = true;
        this.btnDevolucaoEmMassa.disabled = true;
        
        // Se não houver itens, mostrar mensagem
        if (this.itensParaSeparacao.length === 0) {
            this.tabelaItensBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <h3>Nenhum item encontrado</h3>
                        <p>Não há itens pendentes para separação nesta lista.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Renderizar linhas da tabela
        let html = '';
        
        this.itensParaSeparacao.forEach(item => {
            // Calcular valores para as colunas
            const qtdNecessaria = item.qtdNecessariaFinal || 0;
            const compraFinal = item.compraFinal || 0;
            const empenhado = qtdNecessaria - compraFinal;
            const devolucaoEstoque = this.calcularDevolucaoEstoque(item);
            
            const separacaoDisabled = qtdNecessaria === 0 ? 'disabled' : '';
            const devolucaoDisabled = devolucaoEstoque === 0 ? 'disabled' : '';
            
            html += `
                <tr data-id="${item.id}">
                    <td class="checkbox-cell">
                        <input type="checkbox" class="item-checkbox" value="${item.id}">
                    </td>
                    <td>${item.codigo || '-'}</td>
                    <td>${item.descricao || item.item || item.produto || '-'}</td>
                    <td>${qtdNecessaria}</td>
                    <td>${empenhado}</td>
                    <td>${compraFinal}</td>
                    <td>${devolucaoEstoque}</td>
                    <td class="actions-cell">
                        <button class="btn-action btn-primary btn-sm btn-separar" data-id="${item.id}" ${separacaoDisabled}>
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Separar
                        </button>
                        <button class="btn-action btn-warning btn-sm btn-devolver" data-id="${item.id}" ${devolucaoDisabled}>
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            Devolver
                        </button>
                    </td>
                </tr>
            `;
        });
        
        this.tabelaItensBody.innerHTML = html;
        
        // Adicionar event listeners para checkboxes e botões
        this.setupTableEventListeners();
    }
    
    /**
     * Calcular quantidade para devolução ao estoque
     */
    calcularDevolucaoEstoque(item) {
        if (!item.devolucaoEstoque) {
            return 0;
        }
        
        return item.devolucaoEstoque.qtde || 0;
    }
    
    /**
     * Configurar event listeners da tabela
     */
    setupTableEventListeners() {
        // Checkboxes
        const checkboxes = this.tabelaItensBody.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const itemId = checkbox.value;
                
                if (checkbox.checked) {
                    this.itensSelecionados.add(itemId);
                } else {
                    this.itensSelecionados.delete(itemId);
                }
                
                this.atualizarBotoesAcaoEmMassa();
                this.atualizarSelectAll();
            });
        });
        
        // Botões de ação individual
        const btnsSeparar = this.tabelaItensBody.querySelectorAll('.btn-separar');
        btnsSeparar.forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.id;
                this.separacaoIndividual(itemId);
            });
        });
        
        const btnsDevolucao = this.tabelaItensBody.querySelectorAll('.btn-devolver');
        btnsDevolucao.forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.id;
                this.devolucaoIndividual(itemId);
            });
        });
    }
    
    /**
     * Atualizar estado do checkbox "Selecionar Todos"
     */
    atualizarSelectAll() {
        const checkboxes = this.tabelaItensBody.querySelectorAll('.item-checkbox');
        const checkedBoxes = this.tabelaItensBody.querySelectorAll('.item-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = true;
        } else if (checkedBoxes.length > 0) {
            this.selectAll.indeterminate = true;
        } else {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = false;
        }
    }
    
    /**
     * Handler para "Selecionar Todos"
     */
    onSelectAllChange() {
        const checkboxes = this.tabelaItensBody.querySelectorAll('.item-checkbox');
        const isChecked = this.selectAll.checked;
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const itemId = checkbox.value;
            
            if (isChecked) {
                this.itensSelecionados.add(itemId);
            } else {
                this.itensSelecionados.delete(itemId);
            }
        });
        
        this.atualizarBotoesAcaoEmMassa();
    }
    
    /**
     * Atualizar estado dos botões de ação em massa
     */
    atualizarBotoesAcaoEmMassa() {
        const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
            this.itensParaSeparacao.find(item => item.id === id)
        ).filter(Boolean);
        
        // Verificar se há itens com qtdNecessariaFinal > 0
        const temItensSeparar = itensSelecionados.some(item => (item.qtdNecessariaFinal || 0) > 0);
        
        // Verificar se há itens com devolucaoEstoque
        const temItensDevolver = itensSelecionados.some(item => 
            item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0
        );
        
        this.btnSeparacaoEmMassa.disabled = !temItensSeparar;
        this.btnDevolucaoEmMassa.disabled = !temItensDevolver;
    }
    
    /**
     * Separação individual de um item
     */
    separacaoIndividual(itemId) {
        // Limpar seleções anteriores
        this.itensSelecionados.clear();
        
        // Adicionar apenas este item
        this.itensSelecionados.add(itemId);
        
        // Abrir modal de separação
        this.abrirModalSeparacao();
    }
    
    /**
     * Devolução individual de um item
     */
    devolucaoIndividual(itemId) {
        // Limpar seleções anteriores
        this.itensSelecionados.clear();
        
        // Adicionar apenas este item
        this.itensSelecionados.add(itemId);
        
        // Abrir modal de devolução
        this.abrirModalDevolucao();
    }
    
    /**
     * Abrir modal de separação
     */
    abrirModalSeparacao() {
        // Obter itens selecionados
        const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
            this.itensParaSeparacao.find(item => item.id === id)
        ).filter(item => item && (item.qtdNecessariaFinal || 0) > 0);
        
        if (itensSelecionados.length === 0) {
            this.showToast('Nenhum item selecionado para separação', 'warning');
            return;
        }
        
        // Atualizar contador
        this.qtdItensSeparar.textContent = itensSelecionados.length;
        
        // Renderizar lista de itens
        let html = '';
        
        itensSelecionados.forEach(item => {
            html += `
                <div class="modal-item">
                    <span class="modal-item-code">${item.codigo || '-'}</span>
                    <span class="modal-item-desc">${item.descricao || item.item || item.produto || '-'}</span>
                    <span class="modal-item-qty">Qtd: ${item.qtdNecessariaFinal || 0}</span>
                </div>
            `;
        });
        
        this.listaItensSeparar.innerHTML = html;
        
        // Mostrar modal
        this.modalSeparacao.style.display = 'flex';
    }
    
    /**
     * Abrir modal de devolução
     */
    abrirModalDevolucao() {
        // Obter itens selecionados
        const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
            this.itensParaSeparacao.find(item => item.id === id)
        ).filter(item => item && item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0);
        
        if (itensSelecionados.length === 0) {
            this.showToast('Nenhum item selecionado com devolução pendente', 'warning');
            return;
        }
        
        // Atualizar contador
        this.qtdItensDevolucao.textContent = itensSelecionados.length;
        
        // Renderizar lista de itens
        let html = '';
        
        itensSelecionados.forEach(item => {
            html += `
                <div class="modal-item">
                    <span class="modal-item-code">${item.codigo || '-'}</span>
                    <span class="modal-item-desc">${item.descricao || item.item || item.produto || '-'}</span>
                    <span class="modal-item-qty">Qtd: ${item.devolucaoEstoque.qtde || 0}</span>
                </div>
            `;
        });
        
        this.listaItensDevolucao.innerHTML = html;
        
        // Mostrar modal
        this.modalDevolucao.style.display = 'flex';
    }
    
    /**
     * Fechar modal
     */
    fecharModal(modal) {
        modal.style.display = 'none';
    }
    
    /**
     * Confirmar separação para produção
     */
    async confirmarSeparacaoProducao() {
        try {
            this.showLoading('Separando itens para produção...');
            
            // Obter itens selecionados
            const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
                this.itensParaSeparacao.find(item => item.id === id)
            ).filter(item => item && (item.qtdNecessariaFinal || 0) > 0);
            
            if (itensSelecionados.length === 0) {
                this.showToast('Nenhum item selecionado para separação', 'warning');
                this.hideLoading();
                this.fecharModal(this.modalSeparacao);
                return;
            }
            
            // Processar separação em batch
            const batch = this.db.batch();
            const timestamp = firebase.firestore.Timestamp.now();
            
            itensSelecionados.forEach(item => {
                const itemRef = this.db.collection('itens').doc(item.id);
                
                // Registrar separação para produção
                batch.update(itemRef, {
                    qtdProducao: item.qtdNecessariaFinal,
                    statusItem: 'Separado para Produção',
                    dataSeparacaoProducao: timestamp,
                    responsavelSeparacao: 'Sistema',
                    observacoesSeparacao: 'Separado para produção via sistema'
                });
            });
            
            // Executar batch
            await batch.commit();
            
            console.log(`✅ ${itensSelecionados.length} itens separados para produção`);
            
            // Fechar modal
            this.fecharModal(this.modalSeparacao);
            
            // Mostrar toast
            this.showToast(`${itensSelecionados.length} itens separados para produção com sucesso!`, 'success');
            
            // Remover itens da lista
            this.removerItensSeparados(itensSelecionados.map(item => item.id));
            
        } catch (error) {
            console.error('❌ Erro ao separar itens para produção:', error);
            this.showToast('Erro ao separar itens: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Confirmar devolução ao estoque
     */
    async confirmarDevolucaoEstoque() {
        try {
            this.showLoading('Confirmando devolução ao estoque...');
            
            // Obter itens selecionados
            const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
                this.itensParaSeparacao.find(item => item.id === id)
            ).filter(item => item && item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0);
            
            if (itensSelecionados.length === 0) {
                this.showToast('Nenhum item selecionado com devolução pendente', 'warning');
                this.hideLoading();
                this.fecharModal(this.modalDevolucao);
                return;
            }
            
            // Processar devolução em batch
            const batch = this.db.batch();
            const timestamp = firebase.firestore.Timestamp.now();
            
            itensSelecionados.forEach(item => {
                const itemRef = this.db.collection('itens').doc(item.id);
                
                // Registrar devolução ao estoque
                batch.update(itemRef, {
                    devolvidoEstoque: true,
                    dataDevolucaoEstoque: timestamp,
                    responsavelDevolucao: 'Sistema',
                    observacoesDevolucao: 'Devolução ao estoque confirmada via sistema'
                });
            });
            
            // Executar batch
            await batch.commit();
            
            console.log(`✅ ${itensSelecionados.length} devoluções ao estoque confirmadas`);
            
            // Fechar modal
            this.fecharModal(this.modalDevolucao);
            
            // Mostrar toast
            this.showToast(`${itensSelecionados.length} devoluções ao estoque confirmadas com sucesso!`, 'success');
            
            // Verificar se os itens devem ser removidos da lista
            this.verificarRemocaoAposDevolucao(itensSelecionados);
            
        } catch (error) {
            console.error('❌ Erro ao confirmar devolução ao estoque:', error);
            this.showToast('Erro ao confirmar devolução: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Remover itens separados da lista
     */
    removerItensSeparados(ids) {
        // Filtrar itens para manter apenas os que não foram separados
        this.itensParaSeparacao = this.itensParaSeparacao.filter(item => !ids.includes(item.id));
        
        // Limpar seleções
        this.itensSelecionados.clear();
        
        // Renderizar tabela atualizada
        this.renderizarTabelaItens();
    }
    
    /**
     * Verificar se os itens devem ser removidos após devolução
     */
    verificarRemocaoAposDevolucao(itens) {
        const idsParaRemover = [];
        
        itens.forEach(item => {
            // Se o item tem qtdNecessariaFinal = 0 ou já foi separado (tem qtdProducao), remover da lista
            if ((item.qtdNecessariaFinal || 0) === 0 || item.qtdProducao) {
                idsParaRemover.push(item.id);
            }
        });
        
        if (idsParaRemover.length > 0) {
            this.removerItensSeparados(idsParaRemover);
        } else {
            // Apenas renderizar a tabela para atualizar status
            this.renderizarTabelaItens();
        }
    }
    
    /**
     * Mostrar loading overlay
     */
    showLoading(message = 'Carregando...') {
        this.loadingText.textContent = message;
        this.loadingOverlay.classList.remove('hidden');
    }
    
    /**
     * Esconder loading overlay
     */
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
    
    /**
     * Mostrar toast
     */
    showToast(message, type = 'success') {
        // Remover toasts existentes
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Criar novo toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Mostrar toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remover toast após alguns segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    const sistemaSeparacao = new SistemaSeparacaoProducao();
});