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
        this.selectStatusFilter = document.getElementById('selectStatusFilter'); // Novo filtro de status
        this.btnCarregarItens = document.getElementById('btnCarregarItens');
        
        // Aplicar estilo adequado aos selects
        const selectStyle = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500';
        this.selectCliente.className = selectStyle;
        this.selectProjeto.className = selectStyle;
        this.selectLista.className = selectStyle;
        this.selectStatusFilter.className = selectStyle;
        
        // Elementos DOM - Tabela
        this.tabelaSection = document.getElementById('tabelaSection');
        this.tabelaItensBody = document.getElementById('tabelaItensBody');
        this.totalItensSeparacao = document.getElementById('totalItensSeparacao');
        this.selectAll = document.getElementById('selectAll');
        
        // Elementos DOM - Ações em Massa
        this.btnSeparacaoEmMassa = document.getElementById('btnSeparacaoEmMassa');
        this.btnDevolucaoEmMassa = document.getElementById('btnDevolucaoEmMassa');
        this.btnVerSeparados = document.getElementById('btnVerSeparados'); // Botão Ver Separados
        this.btnVerDevolvidos = document.getElementById('btnVerDevolvidos'); // Botão Ver Devolvidos
        
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
        
        // Elementos DOM - Modal Itens Separados
        this.modalSeparados = document.getElementById('modalSeparados');
        this.tabelaSeparadosBody = document.getElementById('tabelaSeparadosBody');
        this.btnFecharSeparados = document.getElementById('btnFecharSeparados');
        
        // Elementos DOM - Modal Itens Devolvidos
        this.modalDevolvidos = document.getElementById('modalDevolvidos');
        this.tabelaDevolvidosBody = document.getElementById('tabelaDevolvidosBody');
        this.btnFecharDevolvidos = document.getElementById('btnFecharDevolvidos');
        
        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        
        // Dados da aplicação
        this.itensParaSeparacao = [];
        this.itensSelecionados = new Set();
        this.db = firebase.firestore();
        
        // NOVA LÓGICA: Controle de estado das ações realizadas
        this.estadoAcoes = new Map(); // itemId -> { separacaoRealizada: boolean, devolucaoRealizada: boolean }
        
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
        
        // Filtro de status - recarregar todos os filtros quando mudar
        this.selectStatusFilter.addEventListener('change', () => {
            // Recarregar todos os filtros com base no novo status selecionado
            this.carregarClientesComItensParaSeparacao();
            
            // Se cliente selecionado, recarregar projeto e lista
            if (this.selectCliente.value) {
                this.onClienteChange();
            } else {
                this.limparTabelaParaSeparacao();
            }
        });
        
        // Seleção de itens
        this.selectAll.addEventListener('change', () => this.onSelectAllChange());
        
        // Ações em massa
        this.btnSeparacaoEmMassa.addEventListener('click', () => this.abrirModalSeparacao());
        this.btnDevolucaoEmMassa.addEventListener('click', () => this.abrirModalDevolucao());
        this.btnVerSeparados.addEventListener('click', () => this.abrirModalSeparados());
        this.btnVerDevolvidos.addEventListener('click', () => this.abrirModalDevolvidos());
        
        // Modal Separação
        this.btnCancelarSeparacao.addEventListener('click', () => this.fecharModal(this.modalSeparacao));
        this.btnConfirmarSeparacao.addEventListener('click', () => this.confirmarSeparacaoProducao());
        
        // Modal Devolução
        this.btnCancelarDevolucao.addEventListener('click', () => this.fecharModal(this.modalDevolucao));
        this.btnConfirmarDevolucao.addEventListener('click', () => this.confirmarDevolucaoEstoque());
        
        // Modal Itens Separados
        this.btnFecharSeparados.addEventListener('click', () => this.fecharModal(this.modalSeparados));
        this.btnExportarSeparados = document.getElementById('btnExportarSeparados');
        this.btnExportarSeparados.addEventListener('click', () => this.exportarTabelaSeparados());
        
        // Modal Itens Devolvidos
        this.btnFecharDevolvidos.addEventListener('click', () => this.fecharModal(this.modalDevolvidos));
        this.btnExportarDevolvidos = document.getElementById('btnExportarDevolvidos');
        this.btnExportarDevolvidos.addEventListener('click', () => this.exportarTabelaDevolvidos());
        
        // Fechar modais ao clicar fora
        window.addEventListener('click', (e) => {
            if (e.target === this.modalSeparacao) this.fecharModal(this.modalSeparacao);
            if (e.target === this.modalDevolucao) this.fecharModal(this.modalDevolucao);
            if (e.target === this.modalSeparados) this.fecharModal(this.modalSeparados);
            if (e.target === this.modalDevolvidos) this.fecharModal(this.modalDevolvidos);
        });
        
        // Fechar modais com ESC
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharModal(this.modalSeparacao);
                this.fecharModal(this.modalDevolucao);
                this.fecharModal(this.modalSeparados);
                this.fecharModal(this.modalDevolvidos);
            }
        });
        
        // Fechar modais pelos botões X
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('div[id^="modal"]');
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
            
            // Buscar itens que têm QtdItemNecFinal != 0 (incluindo valores negativos para devolução)
            // CORREÇÃO: Não usar > 0, pois valores negativos indicam devolução ao estoque
            const itensSnapshot = await this.db.collection('itens')
                .get();
            
            console.log(`📊 ${itensSnapshot.size} itens encontrados para análise`);
            
            if (itensSnapshot.empty) {
                this.showToast('Nenhum item encontrado. Verifique se há dados no sistema.', 'warning');
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
            const clienteInfos = new Map(); // Para armazenar informações sobre itens por cliente
            
            for (const pedidoId of pedidoIds) {
                try {
                    const pedidoDoc = await this.db.collection('pedidos').doc(pedidoId).get();
                    
                    if (pedidoDoc.exists) {
                        const pedido = pedidoDoc.data();
                        if (pedido.clienteNome) {
                            clientes.add(pedido.clienteNome);
                            
                            // Buscar itens deste pedido
                            const itensClienteSnapshot = await this.db.collection('itens')
                                .where('pedidoId', '==', pedidoId)
                                .get();
                            
                            itensClienteSnapshot.forEach(doc => {
                                const item = doc.data();
                                const clienteNome = pedido.clienteNome;
                                
                                if (!clienteInfos.has(clienteNome)) {
                                    clienteInfos.set(clienteNome, {
                                        totalItens: 0,
                                        itensSeparados: 0
                                    });
                                }
                                
                                const info = clienteInfos.get(clienteNome);
                                info.totalItens++;
                                
                                // Verificar se o item já foi separado para produção
                                if (item.statusItem === 'Separado para Produção' || item.qtdProducao > 0) {
                                    info.itensSeparados++;
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao buscar pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de clientes
            this.selectCliente.innerHTML = '<option value="">Selecione um Cliente</option>';
            
            // Verificar o filtro de status
            const statusFilter = this.selectStatusFilter.value;
            
            Array.from(clientes).sort().forEach(cliente => {
                const info = clienteInfos.get(cliente) || { totalItens: 0, itensSeparados: 0 };
                const statusCliente = this.calcularStatusCliente(cliente, info);
                
                // Se o filtro estiver ativo, não adicionar clientes totalmente separados
                if (statusFilter === 'ocultar-separados' && statusCliente === 'separado') {
                    return;
                }
                
                const option = document.createElement('option');
                option.value = cliente;
                option.textContent = cliente;
                
                // Aplicar cor baseada no status
                if (statusCliente === 'separado') {
                    option.classList.add('cliente-separado');
                } else if (statusCliente === 'parcial') {
                    option.classList.add('cliente-parcial');
                }
                
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
     * Calcular status de separação para um cliente
     */
    calcularStatusCliente(cliente, info) {
        if (!info || info.totalItens === 0) return 'normal';
        
        if (info.itensSeparados === info.totalItens) {
            return 'separado'; // Todos separados
        } else if (info.itensSeparados > 0) {
            return 'parcial'; // Alguns separados
        }
        
        return 'normal'; // Nenhum separado
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
            const projetoInfos = new Map(); // Para armazenar informações sobre itens por projeto
            
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
                            const temQuantidadeParaSeparar = (item.QtdItemNecFinal || 0) > 0;
                            const temQuantidadeParaDevolver = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
                            return temQuantidadeParaSeparar || temQuantidadeParaDevolver;
                        });
                        
                        if (pedido.tipoProjeto) {
                            // Adicionar projeto à lista
                            projetos.add(pedido.tipoProjeto);
                            
                            // Inicializar informações do projeto se necessário
                            if (!projetoInfos.has(pedido.tipoProjeto)) {
                                projetoInfos.set(pedido.tipoProjeto, {
                                    totalItens: 0,
                                    itensSeparados: 0
                                });
                            }
                            
                            // Atualizar informações do projeto
                            const projetoInfo = projetoInfos.get(pedido.tipoProjeto);
                            
                            itensSnapshot.forEach(doc => {
                                const item = doc.data();
                                const temQuantidadeParaSeparar = (item.QtdItemNecFinal || 0) > 0;
                                const temQuantidadeParaDevolver = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
                                
                                if (temQuantidadeParaSeparar || temQuantidadeParaDevolver) {
                                    projetoInfo.totalItens++;
                                    
                                    // Verificar se o item já foi separado para produção
                                    if (item.statusItem === 'Separado para Produção' || item.qtdProducao > 0) {
                                        projetoInfo.itensSeparados++;
                                    }
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao processar pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de projetos
            const statusFilter = this.selectStatusFilter.value;
            
            Array.from(projetos).sort().forEach(projeto => {
                const info = projetoInfos.get(projeto) || { totalItens: 0, itensSeparados: 0 };
                const statusProjeto = this.calcularStatusProjeto(projeto, info);
                
                // Se o filtro estiver ativo, não adicionar projetos totalmente separados
                if (statusFilter === 'ocultar-separados' && statusProjeto === 'separado') {
                    return;
                }
                
                const option = document.createElement('option');
                option.value = projeto;
                option.textContent = projeto;
                
                // Aplicar cor baseada no status
                if (statusProjeto === 'separado') {
                    option.classList.add('projeto-separado');
                } else if (statusProjeto === 'parcial') {
                    option.classList.add('projeto-parcial');
                }
                
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
     * Calcular status de separação para um projeto
     */
    calcularStatusProjeto(projeto, info) {
        if (!info || info.totalItens === 0) return 'normal';
        
        if (info.itensSeparados === info.totalItens) {
            return 'separado'; // Todos separados
        } else if (info.itensSeparados > 0) {
            return 'parcial'; // Alguns separados
        }
        
        return 'normal'; // Nenhum separado
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
            const listaInfos = new Map(); // Para armazenar informações sobre itens por lista
            
            for (const pedidoId of pedidoIds) {
                try {
                    const itensSnapshot = await this.db.collection('itens')
                        .where('pedidoId', '==', pedidoId)
                        .get();
                    
                    // Filtrar no lado do cliente para evitar índice composto
                    itensSnapshot.forEach(doc => {
                        const item = doc.data();
                        const temQuantidadeParaSeparar = (item.QtdItemNecFinal || 0) > 0;
                        const temQuantidadeParaDevolver = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
                        
                        if ((temQuantidadeParaSeparar || temQuantidadeParaDevolver) && item.listaMaterial) {
                            // Adicionar lista
                            listas.add(item.listaMaterial);
                            
                            // Inicializar informações da lista se necessário
                            if (!listaInfos.has(item.listaMaterial)) {
                                listaInfos.set(item.listaMaterial, {
                                    totalItens: 0,
                                    itensSeparados: 0
                                });
                            }
                            
                            // Atualizar informações da lista
                            const listaInfo = listaInfos.get(item.listaMaterial);
                            listaInfo.totalItens++;
                            
                            // Verificar se o item já foi separado para produção
                            if (item.statusItem === 'Separado para Produção' || item.qtdProducao > 0) {
                                listaInfo.itensSeparados++;
                            }
                        }
                    });
                } catch (err) {
                    console.warn(`⚠️ Erro ao processar itens do pedido ${pedidoId}:`, err);
                }
            }
            
            // Popular select de listas
            const statusFilter = this.selectStatusFilter.value;
            
            Array.from(listas).sort().forEach(lista => {
                const info = listaInfos.get(lista) || { totalItens: 0, itensSeparados: 0 };
                const statusLista = this.calcularStatusLista(lista, info);
                
                // Se o filtro estiver ativo, não adicionar listas totalmente separadas
                if (statusFilter === 'ocultar-separados' && statusLista === 'separado') {
                    return;
                }
                
                const option = document.createElement('option');
                option.value = lista;
                option.textContent = lista;
                
                // Aplicar cor baseada no status
                if (statusLista === 'separado') {
                    option.classList.add('lista-separada');
                } else if (statusLista === 'parcial') {
                    option.classList.add('lista-parcial');
                }
                
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
     * Calcular status de separação para uma lista
     */
    calcularStatusLista(lista, info) {
        if (!info || info.totalItens === 0) return 'normal';
        
        if (info.itensSeparados === info.totalItens) {
            return 'separado'; // Todos separados
        } else if (info.itensSeparados > 0) {
            return 'parcial'; // Alguns separados
        }
        
        return 'normal'; // Nenhum separado
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
        const statusFilter = this.selectStatusFilter.value;
        
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
                        
                        // CORREÇÃO: Incluir itens com QtdItemNecFinal > 0 (para separação) OU com devolucaoEstoque (para devolução)
                        const temQuantidadeParaSeparar = item.QtdItemNecFinal && item.QtdItemNecFinal > 0;
                        const temQuantidadeParaDevolver = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
                        
                        if (!temQuantidadeParaSeparar && !temQuantidadeParaDevolver) {
                            continue;
                        }
                        
                        // Verificar se já foi separado para produção
                        const jaSeparado = item.statusItem === 'Separado para Produção' || item.qtdProducao > 0;
                        
                        // Aplicar filtro de status
                        if (statusFilter === 'ocultar-separados' && jaSeparado) {
                            console.log(`⏭️ Item ${item.codigo} - Já foi separado para produção e filtro está ativo`);
                            continue;
                        }
                        
                        // CORREÇÃO: Incluir itens que foram recebidos e estão prontos para separação
                        // Não excluir itens recebidos! Eles devem aparecer para separação.
                        
                        // Adicionar item à lista - incluindo itens empenhados E itens recebidos
                        this.itensParaSeparacao.push(item);
                        
                        const motivo = temQuantidadeParaSeparar ? `separação (${item.QtdItemNecFinal})` : `devolução (${item.devolucaoEstoque?.qtde || 0})`;
                        console.log(`✅ Item ${item.codigo} - Incluído para ${motivo}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Erro ao buscar itens do pedido ${pedidoId}:`, err);
                }
            }
            
            // Busca adicional: encontrar itens criados pelo botão "Criar e Comprar" na análise final
            // Estes itens não têm pedidoId, mas têm criadoPorAnalise=true
            try {
                console.log('🔍 Buscando itens criados pela análise final...');
                
                const itensAnaliseSnapshot = await this.db.collection('itens')
                    .where('criadoPorAnalise', '==', true)
                    .where('listaMaterial', '==', lista)
                    .get();
                
                let itensIncluidos = 0;
                
                // Filtrar no lado do cliente
                for (const doc of itensAnaliseSnapshot.docs) {
                    const item = { id: doc.id, ...doc.data() };
                    
                    // Verificar se corresponde aos filtros de cliente e projeto
                    if (item.cliente !== cliente || item.tipoProjeto !== projeto) {
                        continue;
                    }
                    
                    // CORREÇÃO: Incluir itens com QtdItemNecFinal > 0 OU com devolucaoEstoque
                    const temQuantidadeParaSeparar = item.QtdItemNecFinal && item.QtdItemNecFinal > 0;
                    const temQuantidadeParaDevolver = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
                    
                    if (!temQuantidadeParaSeparar && !temQuantidadeParaDevolver) {
                        continue;
                    }
                    
                    // Verificar se já tem qtdProducao definida (já foi realmente separado)
                    if (item.qtdProducao > 0) {
                        console.log(`⏭️ Item ${item.codigo} (criado por análise) - Já foi separado para produção`);
                        continue;
                    }
                    
                    // Verificar se o item já está na lista (para evitar duplicatas)
                    const itemJaExiste = this.itensParaSeparacao.some(existente => existente.id === item.id);
                    if (itemJaExiste) {
                        continue;
                    }
                    
                    // Adicionar item à lista
                    this.itensParaSeparacao.push(item);
                    itensIncluidos++;
                    
                    const motivo = temQuantidadeParaSeparar ? `separação (${item.QtdItemNecFinal})` : `devolução (${item.devolucaoEstoque?.qtde || 0})`;
                    console.log(`✅ Item ${item.codigo} (criado por análise) - Incluído para ${motivo}`);
                }
                
                console.log(`📊 ${itensIncluidos} itens criados pela análise incluídos para separação`);
                
            } catch (error) {
                console.error('❌ Erro ao buscar itens criados pela análise:', error);
            }
            
            console.log(`📊 Total: ${this.itensParaSeparacao.length} itens encontrados para separação`);
            
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
     * Calcular total recebido geral (todos os tipos de recebimento)
     */
    calcularTotalRecebidoGeral(item) {
        if (!item.historicoRecebimentos || !Array.isArray(item.historicoRecebimentos)) {
            return 0;
        }
        
        // Somar todos os recebimentos
        return item.historicoRecebimentos.reduce((total, rec) => {
            return total + (rec.qtde || rec.qtdeRecebida || 0);
        }, 0);
    }
    
    /**
     * Renderizar tabela de itens para separação
     */
    renderizarTabelaItens() {
        // NOVA LÓGICA: Não resetar seleções se estamos apenas atualizando a tabela
        // (preserva seleções durante atualizações de estado)
        const selecoesAntigas = new Set(this.itensSelecionados);
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
                    <td colspan="10" class="empty-state">
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
            // ===== REGRA MATEMÁTICA DO SISTEMA =====
            // 1. Total Empenhado = quantidade originalmente empenhada
            // 2. Após análise final: Total Empenhado = Qtd Necessária + Devolução Estoque
            // 3. Qtd Necessária = vai para separação/produção
            // 4. Devolução Estoque = volta para estoque (pode ser parcial)
            // 5. Compra Final = quantidade adicional que precisa ser comprada
            
            const qtdNecessaria = Math.max(0, item.QtdItemNecFinal || 0); // Para separação/produção
            const compraFinal = item.compraFinal || 0; // Quantidade a comprar adicional
            const devolucaoEstoque = this.calcularDevolucaoEstoque(item); // Quantidade a devolver
            
            // Total empenhado original (reconstituído pela soma)
            const totalEmpenhado = qtdNecessaria + devolucaoEstoque;
            
            // Verificar se o item foi recebido (tem histórico de recebimentos)
            const totalRecebido = this.calcularTotalRecebidoGeral(item);
            const foiRecebido = totalRecebido > 0;
            
            // Status visual para mostrar se foi recebido
            const statusRecepcao = foiRecebido ? '✅ Recebido' : '📦 Pendente';
            const statusClass = foiRecebido ? 'status-recebido' : 'status-pendente';
            
            // NOVA LÓGICA: Obter estado visual das ações
            const estadoVisual = this.obterEstadoVisualItem(item);
            
            // Determinar se botões devem estar desabilitados ou mostrar como concluídos
            const separacaoDisabled = qtdNecessaria === 0 || estadoVisual.separacaoRealizada ? 'disabled' : '';
            const devolucaoDisabled = devolucaoEstoque === 0 || estadoVisual.devolucaoRealizada ? 'disabled' : '';
            
            // Classes e textos para indicar ações realizadas
            const separacaoClass = estadoVisual.separacaoRealizada ? 'btn-success' : 'btn-primary';
            const devolucaoClass = estadoVisual.devolucaoRealizada ? 'btn-success' : 'btn-warning';
            
            const separacaoTexto = estadoVisual.separacaoRealizada ? '✓ Separado' : 'Separar';
            const devolucaoTexto = estadoVisual.devolucaoRealizada ? '✓ Devolvido' : 'Devolver';
            
            html += `
                <tr data-id="${item.id}" class="${statusClass}">
                    <td class="checkbox-cell">
                        <input type="checkbox" class="item-checkbox" value="${item.id}">
                    </td>
                    <td>${item.codigo || '-'}</td>
                    <td>${item.descricao || item.item || item.produto || '-'}</td>
                    <td>${totalEmpenhado}</td>
                    <td>${qtdNecessaria}</td>
                    <td>${compraFinal}</td>
                    <td>${devolucaoEstoque}</td>
                    <td class="status-cell">${statusRecepcao}</td>
                    <td class="actions-cell">
                        <button class="btn-action ${separacaoClass} btn-sm btn-separar" data-id="${item.id}" ${separacaoDisabled}>
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            ${separacaoTexto}
                        </button>
                        <button class="btn-action ${devolucaoClass} btn-sm btn-devolver" data-id="${item.id}" ${devolucaoDisabled}>
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            ${devolucaoTexto}
                        </button>
                    </td>
                </tr>
            `;
        });
        
        this.tabelaItensBody.innerHTML = html;
        
        // NOVA LÓGICA: Restaurar seleções anteriores quando possível
        selecoesAntigas.forEach(itemId => {
            const checkbox = this.tabelaItensBody.querySelector(`input[value="${itemId}"]`);
            if (checkbox) {
                checkbox.checked = true;
                this.itensSelecionados.add(itemId);
            }
        });
        
        // Adicionar event listeners para checkboxes e botões
        this.setupTableEventListeners();
        
        // Atualizar estado dos botões após restaurar seleções
        if (this.itensSelecionados.size > 0) {
            this.atualizarBotoesAcaoEmMassa();
            this.atualizarSelectAll();
        }
    }
    
    /**
     * Calcular quantidade para devolução ao estoque
     * CORREÇÃO: devolucaoEstoque.qtde é a quantidade PARCIAL a devolver (não o total)
     */
    calcularDevolucaoEstoque(item) {
        // Se não há registro de devolução, não há nada para devolver
        if (!item.devolucaoEstoque || !item.devolucaoEstoque.qtde) {
            return 0;
        }
        
        // Retornar a quantidade específica a devolver (pode ser parcial)
        return item.devolucaoEstoque.qtde;
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
        
        // NOVA LÓGICA: Verificar se há itens que ainda precisam de separação (não foram separados ainda)
        const temItensSeparar = itensSelecionados.some(item => {
            const estado = this.estadoAcoes.get(item.id) || { separacaoRealizada: false };
            return (item.QtdItemNecFinal || 0) > 0 && !estado.separacaoRealizada;
        });
        
        // NOVA LÓGICA: Verificar se há itens que ainda precisam de devolução (não foram devolvidos ainda)
        const temItensDevolver = itensSelecionados.some(item => {
            const estado = this.estadoAcoes.get(item.id) || { devolucaoRealizada: false };
            return item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0 && !estado.devolucaoRealizada;
        });
        
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
        // NOVA LÓGICA: Obter itens selecionados para separação (apenas os que ainda não foram separados)
        const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
            this.itensParaSeparacao.find(item => item.id === id)
        ).filter(item => {
            if (!item || (item.QtdItemNecFinal || 0) === 0) return false;
            const estado = this.estadoAcoes.get(item.id) || { separacaoRealizada: false };
            return !estado.separacaoRealizada;
        });
        
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
                    <span class="modal-item-qty">Qtd: ${item.QtdItemNecFinal || 0}</span>
                </div>
            `;
        });
        
        this.listaItensSeparar.innerHTML = html;
        
        // Mostrar modal
        this.modalSeparacao.style.display = 'flex';
    }
    
    /**
     * Exportar tabela de itens separados para Excel
     */
    exportarTabelaSeparados() {
        try {
            console.log('📊 Exportando tabela de itens separados para Excel...');
            
            // Verificar se há itens para exportar
            const tbody = this.tabelaSeparadosBody;
            const rows = tbody.querySelectorAll('tr');
            
            if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('.empty-state'))) {
                this.showToast('Nenhum item separado para exportar', 'warning');
                return;
            }
            
            // Coletar dados das linhas da tabela
            const dados = [];
            
            rows.forEach(row => {
                // Ignorar linhas de mensagem vazia
                if (row.querySelector('.empty-state')) return;
                
                // Obter células de texto (não incluir a célula do botão)
                const cells = row.querySelectorAll('td:not(:last-child)');
                
                dados.push({
                    'Código': cells[0].textContent.trim(),
                    'Descrição': cells[1].textContent.trim(),
                    'Quantidade Separada': cells[2].textContent.trim(),
                    'Data Separação': cells[3].textContent.trim()
                });
            });
            
            if (dados.length === 0) {
                this.showToast('Erro ao processar dados para exportação', 'error');
                return;
            }
            
            // Criar workbook e worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dados);
            
            // Adicionar worksheet ao workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Itens Separados');
            
            // Gerar nome do arquivo com data atual
            const dataAtual = new Date().toISOString().split('T')[0];
            const nomeArquivo = `Itens_Separados_${dataAtual}.xlsx`;
            
            // Fazer o download do arquivo
            XLSX.writeFile(wb, nomeArquivo);
            
            console.log('✅ Tabela exportada com sucesso:', nomeArquivo);
            this.showToast(`Tabela exportada como "${nomeArquivo}"`, 'success');
            
        } catch (error) {
            console.error('❌ Erro ao exportar tabela:', error);
            this.showToast('Erro ao exportar tabela: ' + error.message, 'error');
        }
    }
    
    /**
     * Exportar tabela de itens devolvidos para Excel
     */
    exportarTabelaDevolvidos() {
        try {
            console.log('📊 Exportando tabela de itens devolvidos para Excel...');
            
            // Verificar se há itens para exportar
            const tbody = this.tabelaDevolvidosBody;
            const rows = tbody.querySelectorAll('tr');
            
            if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('.empty-state'))) {
                this.showToast('Nenhum item devolvido para exportar', 'warning');
                return;
            }
            
            // Coletar dados das linhas da tabela
            const dados = [];
            
            rows.forEach(row => {
                // Ignorar linhas de mensagem vazia
                if (row.querySelector('.empty-state')) return;
                
                // Obter células de texto (não incluir a célula do botão)
                const cells = row.querySelectorAll('td:not(:last-child)');
                
                dados.push({
                    'Código': cells[0].textContent.trim(),
                    'Descrição': cells[1].textContent.trim(),
                    'Quantidade Devolvida': cells[2].textContent.trim(),
                    'Data Devolução': cells[3].textContent.trim()
                });
            });
            
            if (dados.length === 0) {
                this.showToast('Erro ao processar dados para exportação', 'error');
                return;
            }
            
            // Criar workbook e worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dados);
            
            // Adicionar worksheet ao workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Itens Devolvidos');
            
            // Gerar nome do arquivo com data atual
            const dataAtual = new Date().toISOString().split('T')[0];
            const nomeArquivo = `Itens_Devolvidos_${dataAtual}.xlsx`;
            
            // Fazer o download do arquivo
            XLSX.writeFile(wb, nomeArquivo);
            
            console.log('✅ Tabela exportada com sucesso:', nomeArquivo);
            this.showToast(`Tabela exportada como "${nomeArquivo}"`, 'success');
            
        } catch (error) {
            console.error('❌ Erro ao exportar tabela:', error);
            this.showToast('Erro ao exportar tabela: ' + error.message, 'error');
        }
    }
    
    /**
     * Abrir modal de itens separados
     */
    async abrirModalSeparados() {
        try {
            this.showLoading('Carregando itens separados...');
            
            const cliente = this.selectCliente.value;
            const projeto = this.selectProjeto.value;
            const lista = this.selectLista.value;
            
            // Consultar itens já separados
            let itensSeparadosQuery = this.db.collection('itens')
                .where('statusItem', '==', 'Separado para Produção');
            
            // Filtrar por cliente, projeto e lista se estiverem selecionados
            if (cliente) {
                // Buscar todos os itens separados e filtrar no lado do cliente
                const separadosSnapshot = await itensSeparadosQuery.get();
                
                // Verificar se há itens
                if (separadosSnapshot.empty) {
                    this.showToast('Nenhum item separado encontrado', 'warning');
                    this.hideLoading();
                    return;
                }
                
                // Filtrar itens de acordo com os critérios selecionados
                const itensSeparados = [];
                
                // Precisamos primeiro obter os pedidos para poder relacionar com os itens
                const pedidosSnapshot = await this.db.collection('pedidos').get();
                const pedidosMap = new Map();
                
                pedidosSnapshot.forEach(doc => {
                    pedidosMap.set(doc.id, doc.data());
                });
                
                // Filtrar os itens
                for (const doc of separadosSnapshot.docs) {
                    const item = { id: doc.id, ...doc.data() };
                    
                    // Verificar se tem pedidoId e procurar o pedido pai
                    if (item.pedidoId) {
                        const pedido = pedidosMap.get(item.pedidoId);
                        
                        if (pedido) {
                            // Filtrar por cliente
                            if (cliente && pedido.clienteNome !== cliente) {
                                continue;
                            }
                            
                            // Filtrar por projeto
                            if (projeto && pedido.tipoProjeto !== projeto) {
                                continue;
                            }
                        }
                    }
                    
                    // Filtrar por lista
                    if (lista && item.listaMaterial !== lista) {
                        continue;
                    }
                    
                    // Adicionar item para exibição
                    itensSeparados.push(item);
                }
                
                // Renderizar itens na tabela
                this.renderTabelaSeparados(itensSeparados);
            } else {
                // Se não houver filtros, exibir todos os itens separados
                const separadosSnapshot = await itensSeparadosQuery.get();
                
                if (separadosSnapshot.empty) {
                    this.showToast('Nenhum item separado encontrado', 'warning');
                    this.hideLoading();
                    return;
                }
                
                const itensSeparados = separadosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderTabelaSeparados(itensSeparados);
            }
            
            // Mostrar o modal
            this.modalSeparados.style.display = 'flex';
            
        } catch (error) {
            console.error('Erro ao carregar itens separados:', error);
            this.showToast('Erro ao carregar itens separados: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Abrir modal de itens devolvidos
     */
    async abrirModalDevolvidos() {
        try {
            this.showLoading('Carregando itens devolvidos...');
            
            const cliente = this.selectCliente.value;
            const projeto = this.selectProjeto.value;
            const lista = this.selectLista.value;
            
            // Consultar itens devolvidos ao estoque
            let itensDevolvidosQuery = this.db.collection('itens')
                .where('devolvidoEstoque', '==', true);
            
            // Filtrar por cliente, projeto e lista se estiverem selecionados
            if (cliente) {
                // Buscar todos os itens devolvidos e filtrar no lado do cliente
                const devolvidosSnapshot = await itensDevolvidosQuery.get();
                
                // Verificar se há itens
                if (devolvidosSnapshot.empty) {
                    this.showToast('Nenhum item devolvido encontrado', 'warning');
                    this.hideLoading();
                    return;
                }
                
                // Filtrar itens de acordo com os critérios selecionados
                const itensDevolvidos = [];
                
                // Precisamos primeiro obter os pedidos para poder relacionar com os itens
                const pedidosSnapshot = await this.db.collection('pedidos').get();
                const pedidosMap = new Map();
                
                pedidosSnapshot.forEach(doc => {
                    pedidosMap.set(doc.id, doc.data());
                });
                
                // Filtrar os itens
                for (const doc of devolvidosSnapshot.docs) {
                    const item = { id: doc.id, ...doc.data() };
                    
                    // Verificar se tem pedidoId e procurar o pedido pai
                    if (item.pedidoId) {
                        const pedido = pedidosMap.get(item.pedidoId);
                        
                        if (pedido) {
                            // Filtrar por cliente
                            if (cliente && pedido.clienteNome !== cliente) {
                                continue;
                            }
                            
                            // Filtrar por projeto
                            if (projeto && pedido.tipoProjeto !== projeto) {
                                continue;
                            }
                        }
                    } else {
                        // Para itens sem pedidoId (criados pela análise), verificar campos diretos
                        if (cliente && item.cliente !== cliente) {
                            continue;
                        }
                        
                        if (projeto && item.tipoProjeto !== projeto) {
                            continue;
                        }
                    }
                    
                    // Filtrar por lista
                    if (lista && item.listaMaterial !== lista) {
                        continue;
                    }
                    
                    // Adicionar item para exibição
                    itensDevolvidos.push(item);
                }
                
                // Renderizar itens na tabela
                this.renderTabelaDevolvidos(itensDevolvidos);
            } else {
                // Se não houver filtros, exibir todos os itens devolvidos
                const devolvidosSnapshot = await itensDevolvidosQuery.get();
                
                if (devolvidosSnapshot.empty) {
                    this.showToast('Nenhum item devolvido encontrado', 'warning');
                    this.hideLoading();
                    return;
                }
                
                const itensDevolvidos = devolvidosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderTabelaDevolvidos(itensDevolvidos);
            }
            
            // Mostrar o modal
            this.modalDevolvidos.style.display = 'flex';
            
        } catch (error) {
            console.error('Erro ao carregar itens devolvidos:', error);
            this.showToast('Erro ao carregar itens devolvidos: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Renderizar tabela de itens separados
     */
    renderTabelaSeparados(itensSeparados) {
        if (itensSeparados.length === 0) {
            this.tabelaSeparadosBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <h3>Nenhum item separado encontrado</h3>
                        <p>Não existem itens separados para produção nos filtros selecionados.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar itens por código
        itensSeparados.sort((a, b) => {
            const codigoA = a.codigo || '';
            const codigoB = b.codigo || '';
            return codigoA.localeCompare(codigoB);
        });
        
        // Construir linhas da tabela
        const linhas = itensSeparados.map(item => {
            // Formatar data de separação
            let dataSeparacao = 'N/D';
            if (item.dataSeparacaoProducao) {
                const data = item.dataSeparacaoProducao.toDate ? item.dataSeparacaoProducao.toDate() : new Date(item.dataSeparacaoProducao);
                dataSeparacao = data.toLocaleString('pt-BR');
            }
            
            // Calcular quantidade separada - pode estar em qtdProducao ou QtdItemNecFinal
            const qtdSeparada = item.qtdProducao || item.QtdItemNecFinal || 0;
            
            return `
                <tr>
                    <td class="px-6 py-4">${item.codigo || '-'}</td>
                    <td class="px-6 py-4">${item.descricao || item.item || item.produto || '-'}</td>
                    <td class="px-6 py-4">${qtdSeparada}</td>
                    <td class="px-6 py-4">${dataSeparacao}</td>
                    <td class="px-6 py-4">
                        <button class="btn-action btn-warning btn-sm desfazer-separacao" data-id="${item.id}">
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            Desfazer Separação
                        </button>
                    </td>
                </tr>
            `;
        });
        
        this.tabelaSeparadosBody.innerHTML = linhas.join('');
        
        // Adicionar event listeners para os botões de desfazer separação
        const botoesDesfazer = this.tabelaSeparadosBody.querySelectorAll('.desfazer-separacao');
        botoesDesfazer.forEach(botao => {
            botao.addEventListener('click', () => {
                const itemId = botao.dataset.id;
                this.handleDesfazerSeparacao(itemId);
            });
        });
    }
    
    /**
     * Renderizar tabela de itens devolvidos
     */
    renderTabelaDevolvidos(itensDevolvidos) {
        if (itensDevolvidos.length === 0) {
            this.tabelaDevolvidosBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <h3>Nenhum item devolvido encontrado</h3>
                        <p>Não existem itens devolvidos ao estoque nos filtros selecionados.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar itens por código
        itensDevolvidos.sort((a, b) => {
            const codigoA = a.codigo || '';
            const codigoB = b.codigo || '';
            return codigoA.localeCompare(codigoB);
        });
        
        // Construir linhas da tabela
        const linhas = itensDevolvidos.map(item => {
            // Formatar data de devolução
            let dataDevolucao = 'N/D';
            if (item.dataDevolucaoEstoque) {
                const data = item.dataDevolucaoEstoque.toDate ? item.dataDevolucaoEstoque.toDate() : new Date(item.dataDevolucaoEstoque);
                dataDevolucao = data.toLocaleString('pt-BR');
            }
            
            // Calcular quantidade devolvida
            const qtdDevolvida = item.devolucaoEstoque?.qtde || 0;
            
            return `
                <tr>
                    <td class="px-6 py-4">${item.codigo || '-'}</td>
                    <td class="px-6 py-4">${item.descricao || item.item || item.produto || '-'}</td>
                    <td class="px-6 py-4">${qtdDevolvida}</td>
                    <td class="px-6 py-4">${dataDevolucao}</td>
                    <td class="px-6 py-4">
                        <button class="btn-action btn-warning btn-sm desfazer-devolucao" data-id="${item.id}">
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            Desfazer Devolução
                        </button>
                    </td>
                </tr>
            `;
        });
        
        this.tabelaDevolvidosBody.innerHTML = linhas.join('');
        
        // Adicionar event listeners para os botões de desfazer devolução
        const botoesDesfazer = this.tabelaDevolvidosBody.querySelectorAll('.desfazer-devolucao');
        botoesDesfazer.forEach(botao => {
            botao.addEventListener('click', () => {
                const itemId = botao.dataset.id;
                this.handleDesfazerDevolucao(itemId);
            });
        });
    }
    
    /**
     * Desfazer separação de um item
     */
    async handleDesfazerSeparacao(itemId) {
        try {
            if (!confirm('Tem certeza que deseja desfazer a separação deste item?')) {
                return;
            }
            
            this.showLoading('Desfazendo separação...');
            
            // Buscar item
            const itemDoc = await this.db.collection('itens').doc(itemId).get();
            
            if (!itemDoc.exists) {
                this.showToast('Item não encontrado', 'error');
                this.hideLoading();
                return;
            }
            
            const item = itemDoc.data();
            
            // Criar batch para transação
            const batch = this.db.batch();
            const itemRef = this.db.collection('itens').doc(itemId);
            
            // Atualizar status e remover informações de separação
            batch.update(itemRef, {
                statusItem: 'Disponível', // Voltar para status disponível
                qtdProducao: 0, // Zerar quantidade em produção
                dataSeparacaoProducao: null,
                responsavelSeparacao: '',
                observacoesSeparacao: ''
            });
            
            // Executar batch
            await batch.commit();
            
            this.showToast('Separação desfeita com sucesso', 'success');
            
            // Atualizar a lista de itens separados
            this.abrirModalSeparados();
            
            // Se os filtros estiverem selecionados, atualizar a tabela principal
            if (this.selectCliente.value && this.selectProjeto.value && this.selectLista.value) {
                this.carregarItensParaSeparacao();
            }
            
        } catch (error) {
            console.error('Erro ao desfazer separação:', error);
            this.showToast('Erro ao desfazer separação: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Desfazer devolução de um item
     */
    async handleDesfazerDevolucao(itemId) {
        try {
            if (!confirm('Tem certeza que deseja desfazer a devolução deste item?')) {
                return;
            }
            
            this.showLoading('Desfazendo devolução...');
            
            // Buscar item
            const itemDoc = await this.db.collection('itens').doc(itemId).get();
            
            if (!itemDoc.exists) {
                this.showToast('Item não encontrado', 'error');
                this.hideLoading();
                return;
            }
            
            const item = itemDoc.data();
            
            // Criar batch para transação
            const batch = this.db.batch();
            const itemRef = this.db.collection('itens').doc(itemId);
            
            // Atualizar status e remover informações de devolução
            batch.update(itemRef, {
                devolvidoEstoque: false, // Marcar como não devolvido
                dataDevolucaoEstoque: null, // Remover data de devolução
                responsavelDevolucao: '', // Limpar responsável
                observacoesDevolucao: '' // Limpar observações
            });
            
            // Executar batch
            await batch.commit();
            
            this.showToast('Devolução desfeita com sucesso', 'success');
            
            // Atualizar a lista de itens devolvidos
            this.abrirModalDevolvidos();
            
            // Se os filtros estiverem selecionados, atualizar a tabela principal
            if (this.selectCliente.value && this.selectProjeto.value && this.selectLista.value) {
                this.carregarItensParaSeparacao();
            }
            
        } catch (error) {
            console.error('Erro ao desfazer devolução:', error);
            this.showToast('Erro ao desfazer devolução: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
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
     * Limpar tabela para separação
     */
    limparTabelaParaSeparacao() {
        this.tabelaItensBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <h3>Aguardando Seleção</h3>
                    <p>Selecione um cliente, projeto e lista de material para ver os itens disponíveis para separação.</p>
                </td>
            </tr>
        `;
        this.tabelaSection.classList.add('hidden');
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
            
            // NOVA LÓGICA: Obter itens selecionados para separação (apenas os que ainda não foram separados)
            const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
                this.itensParaSeparacao.find(item => item.id === id)
            ).filter(item => {
                if (!item || (item.QtdItemNecFinal || 0) === 0) return false;
                const estado = this.estadoAcoes.get(item.id) || { separacaoRealizada: false };
                return !estado.separacaoRealizada;
            });
            
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
                
                // Registrar separação para produção (usando QtdItemNecFinal - campo correto)
                batch.update(itemRef, {
                    qtdProducao: item.QtdItemNecFinal,
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
            
            // NOVA LÓGICA: Marcar separação como realizada e verificar se pode remover
            this.marcarSeparacaoRealizada(itensSelecionados.map(item => item.id));
            
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
            
            // NOVA LÓGICA: Obter itens selecionados para devolução (apenas os que ainda não foram devolvidos)
            const itensSelecionados = Array.from(this.itensSelecionados).map(id => 
                this.itensParaSeparacao.find(item => item.id === id)
            ).filter(item => {
                if (!item || !item.devolucaoEstoque || item.devolucaoEstoque.qtde === 0) return false;
                const estado = this.estadoAcoes.get(item.id) || { devolucaoRealizada: false };
                return !estado.devolucaoRealizada;
            });
            
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
            
            // NOVA LÓGICA: Marcar devolução como realizada e verificar se pode remover
            this.marcarDevolucaoRealizada(itensSelecionados.map(item => item.id));
            
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
            // Se o item tem QtdItemNecFinal = 0 ou já foi separado (tem qtdProducao), remover da lista
            if ((item.QtdItemNecFinal || 0) === 0 || item.qtdProducao) {
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
    
    // NOVA LÓGICA: Funções para controle de estado das ações
    
    /**
     * Marcar separação como realizada para os itens
     */
    marcarSeparacaoRealizada(itemIds) {
        itemIds.forEach(itemId => {
            if (!this.estadoAcoes.has(itemId)) {
                this.estadoAcoes.set(itemId, { separacaoRealizada: false, devolucaoRealizada: false });
            }
            this.estadoAcoes.get(itemId).separacaoRealizada = true;
        });
        
        // Verificar quais itens podem ser removidos
        this.verificarRemocaoInteligente(itemIds);
    }
    
    /**
     * Marcar devolução como realizada para os itens
     */
    marcarDevolucaoRealizada(itemIds) {
        itemIds.forEach(itemId => {
            if (!this.estadoAcoes.has(itemId)) {
                this.estadoAcoes.set(itemId, { separacaoRealizada: false, devolucaoRealizada: false });
            }
            this.estadoAcoes.get(itemId).devolucaoRealizada = true;
        });
        
        // Verificar quais itens podem ser removidos
        this.verificarRemocaoInteligente(itemIds);
    }
    
    /**
     * Verificar se um item pode ser removido da lista (todas as ações necessárias foram realizadas)
     */
    podeRemoverItem(item) {
        const estado = this.estadoAcoes.get(item.id) || { separacaoRealizada: false, devolucaoRealizada: false };
        
        // Verificar se tem ações pendentes
        const precisaSeparacao = (item.QtdItemNecFinal || 0) > 0;
        const precisaDevolucao = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
        
        // Só pode remover se:
        // 1. Não precisa de separação OU separação foi realizada
        // 2. Não precisa de devolução OU devolução foi realizada
        const separacaoOk = !precisaSeparacao || estado.separacaoRealizada;
        const devolucaoOk = !precisaDevolucao || estado.devolucaoRealizada;
        
        return separacaoOk && devolucaoOk;
    }
    
    /**
     * Verificação inteligente de remoção - só remove se todas as ações foram realizadas
     */
    verificarRemocaoInteligente(itemIds) {
        const idsParaRemover = [];
        
        itemIds.forEach(itemId => {
            const item = this.itensParaSeparacao.find(i => i.id === itemId);
            if (item && this.podeRemoverItem(item)) {
                idsParaRemover.push(itemId);
            }
        });
        
        if (idsParaRemover.length > 0) {
            // Limpar estado dos itens removidos
            idsParaRemover.forEach(id => this.estadoAcoes.delete(id));
            this.removerItensSeparados(idsParaRemover);
        } else {
            // Apenas renderizar a tabela para atualizar status visual
            this.renderizarTabelaItens();
        }
    }
    
    /**
     * Obter estado visual de um item para mostrar na tabela
     */
    obterEstadoVisualItem(item) {
        const estado = this.estadoAcoes.get(item.id) || { separacaoRealizada: false, devolucaoRealizada: false };
        const precisaSeparacao = (item.QtdItemNecFinal || 0) > 0;
        const precisaDevolucao = item.devolucaoEstoque && item.devolucaoEstoque.qtde > 0;
        
        return {
            separacaoRealizada: estado.separacaoRealizada,
            devolucaoRealizada: estado.devolucaoRealizada,
            precisaSeparacao,
            precisaDevolucao
        };
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