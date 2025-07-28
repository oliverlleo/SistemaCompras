/**
 * Sistema de Empenho - Gestão de Materiais
 * Implementação completa conforme especificação
 */

class SistemaEmpenho {
    constructor() {
        // Elementos DOM
        this.selectCliente = document.getElementById('selectCliente');
        this.selectProjeto = document.getElementById('selectProjeto');
        this.selectLista = document.getElementById('selectLista');
        this.selectStatusFilter = document.getElementById('selectStatusFilter');
        this.tabelaItensBody = document.getElementById('tabelaItensBody');
        this.btnEmpenhar = document.getElementById('btnEmpenhar');
        this.btnVerEmpenhados = document.getElementById('btnVerEmpenhados');
        this.selectAll = document.getElementById('selectAll');
        
        // Modal de Empenho
        this.modalEmpenho = document.getElementById('modalEmpenho');
        this.modalTitle = document.getElementById('modalTitle');
        this.tabelaModalBody = document.getElementById('tabelaModalBody');
        this.btnSalvar = document.getElementById('btnSalvar');
        this.btnCancelar = document.getElementById('btnCancelar');
        
        // Modal de Itens Empenhados
        this.modalEmpenhados = document.getElementById('modalEmpenhados');
        this.tabelaEmpenhadosBody = document.getElementById('tabelaEmpenhadosBody');
        this.btnFecharEmpenhados = document.getElementById('btnFecharEmpenhados');

        // Estado da aplicação
        this.pedidosMap = new Map(); // Armazena dados dos pedidos por ID
        this.itensEnriquecidos = []; // Itens com dados do pedido pai
        this.itensSelecionados = new Set(); // IDs dos itens selecionados
        this.isLoading = false;

        // Inicializar
        this.init();
    }

    /**
     * Inicialização da aplicação
     */
    async init() {
        try {
            this.setupEventListeners();
            await this.carregarDadosIniciais();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showToast('Erro ao carregar dados iniciais', 'error');
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
        
        // Filtro de status - recarregar todos os filtros quando mudar
        this.selectStatusFilter.addEventListener('change', () => {
            // Recarregar todos os filtros com base no novo status selecionado
            this.populateClientesFilter();
            
            // Se cliente selecionado, recarregar projeto e lista
            if (this.selectCliente.value) {
                this.onClienteChange();
            } else {
                this.limparTabela();
            }
        });

        // Checkbox "Selecionar Todos"
        this.selectAll.addEventListener('change', () => this.onSelectAllChange());

        // Botões de ação
        this.btnEmpenhar.addEventListener('click', () => this.abrirModal());
        this.btnVerEmpenhados.addEventListener('click', () => this.abrirModalEmpenhados());

        // Modal de Empenho
        this.btnSalvar.addEventListener('click', () => this.handleSalvarEmpenho());
        this.btnCancelar.addEventListener('click', () => this.fecharModal());
        
        // Modal de Itens Empenhados
        this.btnFecharEmpenhados.addEventListener('click', () => this.fecharModalEmpenhados());

        // Fechar modals ao clicar fora
        this.modalEmpenho.addEventListener('click', (e) => {
            if (e.target === this.modalEmpenho) {
                this.fecharModal();
            }
        });
        
        this.modalEmpenhados.addEventListener('click', (e) => {
            if (e.target === this.modalEmpenhados) {
                this.fecharModalEmpenhados();
            }
        });
    }

    /**
     * Carregar dados iniciais do Firebase
     */
    async carregarDadosIniciais() {
        try {
            this.setLoadingState(true);

            // Passo 1: Buscar TODOS os Pedidos
            console.log('Carregando pedidos...');
            const pedidosSnapshot = await db.collection('pedidos').get();

            this.pedidosMap.clear();
            pedidosSnapshot.docs.forEach(doc => {
                this.pedidosMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            console.log(`${this.pedidosMap.size} pedidos carregados`);

            // Passo 2: Buscar TODOS os Itens
            console.log('Carregando itens...');
            const itensSnapshot = await db.collection('itens').get();

            // Passo 3: Enriquecer os Itens com dados do pedido pai
            this.itensEnriquecidos = itensSnapshot.docs.map(doc => {
                const item = { id: doc.id, ...doc.data() };
                const pedidoPai = this.pedidosMap.get(item.pedidoId);

                if (pedidoPai) {
                    item.clienteNome = pedidoPai.clienteNome;
                    item.tipoProjeto = pedidoPai.tipoProjeto;
                    return item;
                }

                console.warn(`Item ${item.id} descartado - pedido pai (${item.pedidoId}) não encontrado`);
                return null;
            }).filter(Boolean);

            console.log(`${this.itensEnriquecidos.length} itens carregados e enriquecidos`);

            // Definir o valor padrão do filtro de status (pode ser necessário salvar/restaurar da preferência do usuário)
            this.selectStatusFilter.value = 'todos';

            // Passo 4: Popular primeiro filtro considerando o filtro de status
            this.populateClientesFilter();

        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            throw error;
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Popular dropdown de clientes com cores por status
     */
    populateClientesFilter() {
        const clientes = [...new Set(this.itensEnriquecidos.map(item => item.clienteNome))].sort();
        const statusFilter = this.selectStatusFilter.value;
        
        this.selectCliente.innerHTML = '<option value="">Selecione um Cliente</option>';
        
        clientes.forEach(cliente => {
            // Verificar se devemos ocultar este cliente por causa do filtro
            const statusCliente = this.calcularStatusCliente(cliente);
            if (statusFilter === 'ocultar-empenhadas' && statusCliente === 'empenhado') {
                // Não adicionar ao dropdown se o cliente estiver totalmente empenhado e o filtro estiver ativo
                return;
            }
            
            const option = document.createElement('option');
            option.value = cliente;
            option.textContent = cliente;
            
            // Aplicar cor baseada no status do cliente
            if (statusCliente === 'empenhado') {
                option.classList.add('cliente-empenhado');
            } else if (statusCliente === 'parcial') {
                option.classList.add('cliente-parcial');
            }
            
            this.selectCliente.appendChild(option);
        });
    }

    /**
     * Handler para mudança de cliente
     */
    onClienteChange() {
        const clienteSelecionado = this.selectCliente.value;
        
        // Reset dos filtros subsequentes
        this.resetFilter(this.selectProjeto, 'Selecione um Projeto');
        this.resetFilter(this.selectLista, 'Selecione uma Lista');
        this.limparTabela();

        if (!clienteSelecionado) return;

        // Popular projetos para o cliente selecionado
        const projetosDisponiveis = [...new Set(
            this.itensEnriquecidos
                .filter(item => item.clienteNome === clienteSelecionado)
                .map(item => item.tipoProjeto)
        )].sort();

        this.selectProjeto.innerHTML = '<option value="">Selecione um Projeto</option>';
        this.selectProjeto.disabled = false;

        const statusFilter = this.selectStatusFilter.value;
        
        projetosDisponiveis.forEach(projeto => {
            // Verificar se devemos ocultar este projeto por causa do filtro
            const statusProjeto = this.calcularStatusProjeto(clienteSelecionado, projeto);
            if (statusFilter === 'ocultar-empenhadas' && statusProjeto === 'empenhado') {
                // Não adicionar ao dropdown se o projeto estiver totalmente empenhado e o filtro estiver ativo
                return;
            }
            
            const option = document.createElement('option');
            option.value = projeto;
            option.textContent = projeto;
            
            // Aplicar cor baseada no status do projeto
            if (statusProjeto === 'empenhado') {
                option.classList.add('projeto-empenhado');
            } else if (statusProjeto === 'parcial') {
                option.classList.add('projeto-parcial');
            }
            
            this.selectProjeto.appendChild(option);
        });
    }

    /**
     * Handler para mudança de projeto
     */
    onProjetoChange() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        
        // Reset do filtro subsequente
        this.resetFilter(this.selectLista, 'Selecione uma Lista');
        this.limparTabela();

        if (!projetoSelecionado) return;

        // Popular listas para o projeto selecionado
        const listasDisponiveis = [...new Set(
            this.itensEnriquecidos
                .filter(item => 
                    item.clienteNome === clienteSelecionado && 
                    item.tipoProjeto === projetoSelecionado
                )
                .map(item => item.listaMaterial)
        )].sort();

        this.selectLista.innerHTML = '<option value="">Selecione uma Lista</option>';
        this.selectLista.disabled = false;

        const statusFilter = this.selectStatusFilter.value;
        
        listasDisponiveis.forEach(lista => {
            // Verificar se devemos ocultar esta lista por causa do filtro
            const statusLista = this.calcularStatusLista(clienteSelecionado, projetoSelecionado, lista);
            if (statusFilter === 'ocultar-empenhadas' && statusLista === 'empenhado') {
                // Não adicionar ao dropdown se a lista estiver totalmente empenhada e o filtro estiver ativo
                return;
            }
            
            const option = document.createElement('option');
            option.value = lista;
            option.textContent = lista;
            
            // Aplicar cor baseada no status da lista
            if (statusLista === 'empenhado') {
                option.classList.add('lista-empenhada');
            } else if (statusLista === 'parcial') {
                option.classList.add('lista-parcial');
            }
            
            this.selectLista.appendChild(option);
        });
    }

    /**
     * Handler para mudança de lista
     */
    onListaChange() {
        const listaSelecionada = this.selectLista.value;
        
        if (!listaSelecionada) {
            this.limparTabela();
            return;
        }

        this.renderTabelaEmpenho();
    }

    /**
     * Renderizar tabela de itens para empenho
     */
    renderTabelaEmpenho() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        const listaSelecionada = this.selectLista.value;
        const statusFilter = this.selectStatusFilter.value;

        // Filtrar itens finais
        let itensParaRenderizar = this.itensEnriquecidos.filter(item =>
            item.clienteNome === clienteSelecionado &&
            item.tipoProjeto === projetoSelecionado &&
            item.listaMaterial === listaSelecionada
        );

        // Aplicar filtro de status
        if (statusFilter === 'ocultar-empenhadas') {
            itensParaRenderizar = itensParaRenderizar.filter(item => {
                const saldos = this.calcularSaldos(item);
                const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
                return saldos.totalEmpenhado < qtdNecessaria; // Inclui apenas parciais e não empenhadas, oculta totalmente empenhadas
            });
        }

        // Atualizar botão de empenhar
        this.updateBotaoEmpenhar();

        if (itensParaRenderizar.length === 0) {
            this.tabelaItensBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <h3>Nenhum item disponível</h3>
                        <p>Não há itens disponíveis para empenho nesta lista de material.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Renderizar linhas
        const linhas = [];
        
        itensParaRenderizar.forEach(item => {
            const saldos = this.calcularSaldos(item);
            const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
            
            // Verificar se já está totalmente empenhado quando o filtro estiver ativo
            if (statusFilter === 'ocultar-empenhadas' && saldos.totalEmpenhado >= qtdNecessaria) {
                return; // Pula itens totalmente empenhados quando o filtro estiver ativo
            }
            
            // Só renderizar se houver saldo disponível em Estoque OU em Recebido
            if (saldos.saldoDisponivelEstoque > 0 || saldos.saldoDisponivelRecebido > 0) {
                linhas.push(this.criarLinhaItem(item, saldos));
            }
        });

        if (linhas.length === 0) {
            this.tabelaItensBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <h3>Nenhum item disponível</h3>
                        <p>Todos os itens desta lista já foram empenhados ou não possuem saldo disponível.</p>
                    </td>
                </tr>
            `;
            return;
        }

        this.tabelaItensBody.innerHTML = linhas.join('');
        this.setupTableEventListeners();
    }

    /**
     * Calcular saldos disponíveis para um item
     */
    calcularSaldos(item) {
        const historicoEmpenhos = item.historicoEmpenhos || [];
        const historicoRecebimentos = item.historicoRecebimentos || [];

        // Total empenhado
        const totalEmpenhado = historicoEmpenhos.reduce((total, empenho) => {
            return total + (empenho.qtdeEmpenhadaDoEstoque || 0) + (empenho.qtdeEmpenhadaDoRecebido || 0);
        }, 0);

        // Total recebido
        const totalRecebido = historicoRecebimentos.reduce((total, recebimento) => {
            return total + (recebimento.qtde || 0);
        }, 0);

        // Total empenhado do estoque vs recebido
        const totalEmpenhadoDoEstoque = historicoEmpenhos.reduce((total, empenho) => {
            return total + (empenho.qtdeEmpenhadaDoEstoque || 0);
        }, 0);

        const totalEmpenhadoDoRecebido = historicoEmpenhos.reduce((total, empenho) => {
            return total + (empenho.qtdeEmpenhadaDoRecebido || 0);
        }, 0);

        // Calcular saldos disponíveis
        // ATUALIZAÇÃO: Usar o campo estoqueDisponivel diretamente do Firebase
        let saldoDisponivelEstoque = Math.max(0, item.estoqueDisponivel || 0);
        const saldoDisponivelRecebido = Math.max(0, totalRecebido - totalEmpenhadoDoRecebido);
        
        // LIMITAÇÃO: Não permitir que o saldo disponível do estoque exceda a quantidade necessária
        const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
        const qtdRestante = Math.max(0, qtdNecessaria - totalEmpenhado);
        saldoDisponivelEstoque = Math.min(saldoDisponivelEstoque, qtdRestante);
        
        const saldoTotalDisponivel = saldoDisponivelEstoque + saldoDisponivelRecebido;

        return {
            saldoDisponivelEstoque: saldoDisponivelEstoque,
            saldoDisponivelRecebido: saldoDisponivelRecebido,
            saldoTotalDisponivel: saldoTotalDisponivel,
            totalEmpenhado
        };
    }

    /**
     * Criar linha HTML para um item
     */
    criarLinhaItem(item, saldos) {
        const isParcial = item.statusItem === 'Parcialmente Empenhado';
        const rowClass = isParcial ? 'row-parcial' : '';
        const isEmpenhado = item.statusItem === 'Empenhado';
        const botaoDisabled = isEmpenhado || (saldos.saldoDisponivelEstoque === 0 && saldos.saldoDisponivelRecebido === 0) ? 'disabled' : '';

        return `
            <tr class="${rowClass}" data-item-id="${item.id}">
                <td class="checkbox-cell">
                    <input type="checkbox" class="item-checkbox" value="${item.id}">
                </td>
                <td>${item.codigo || '-'}</td>
                <td>${item.descricao || item.item || item.produto || item.material || '-'}</td>
                <td>${item.quantidade || 0}</td>
                <td class="tooltip" data-tooltip="Último recebimento: ${this.getUltimaDataRecebimento(item)}">
                    ${saldos.saldoDisponivelEstoque}
                </td>
                <td class="tooltip" data-tooltip="Total recebido: ${item.historicoRecebimentos?.reduce((s, r) => s + r.qtde, 0) || 0}">
                    ${saldos.saldoDisponivelRecebido}
                </td>
                <td>${saldos.totalEmpenhado}</td>
                <td>
                    <span class="status-badge ${item.statusItem?.toLowerCase().replace(' ', '-') || 'indefinido'}">
                        ${item.statusItem || 'Indefinido'}
                    </span>
                </td>
                <td>
                    <button class="btn-empenhar-linha" data-item-id="${item.id}" ${botaoDisabled}>
                        Empenhar
                    </button>
                </td>
            </tr>
        `;
    }

    /**
     * Obter última data de recebimento
     */
    getUltimaDataRecebimento(item) {
        const recebimentos = item.historicoRecebimentos || [];
        if (recebimentos.length === 0) return 'Nunca';
        
        const ultimoRecebimento = recebimentos[recebimentos.length - 1];
        const data = new Date(ultimoRecebimento.dataRecebimento);
        return data.toLocaleDateString('pt-BR');
    }

    /**
     * Configurar event listeners da tabela
     */
    setupTableEventListeners() {
        // Checkboxes individuais
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.value;
                
                if (e.target.checked) {
                    this.itensSelecionados.add(itemId);
                } else {
                    this.itensSelecionados.delete(itemId);
                }
                
                this.updateSelectAllState();
                this.updateBotaoEmpenhar();
            });
        });

        // Adicionar listeners para botões "Empenhar" por linha
        const botoesEmpenharLinha = document.querySelectorAll('.btn-empenhar-linha');
        
        botoesEmpenharLinha.forEach(botao => {
            botao.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                
                // Limpar seleções anteriores
                this.itensSelecionados.clear();
                
                // Selecionar apenas este item
                this.itensSelecionados.add(itemId);
                
                // Atualizar checkbox visualmente (opcional)
                const checkbox = document.querySelector(`.item-checkbox[value="${itemId}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
                
                // Atualizar estado dos checkboxes e botões
                this.updateSelectAllState();
                this.updateBotaoEmpenhar();
                
                // Abrir modal de empenho
                this.abrirModal();
            });
        });
    }

    /**
     * Handler para "Selecionar Todos"
     */
    onSelectAllChange() {
        const checkboxes = document.querySelectorAll('.item-checkbox');
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
        
        this.updateBotaoEmpenhar();
    }

    /**
     * Atualizar estado do checkbox "Selecionar Todos"
     */
    updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = true;
        } else if (checkedBoxes.length > 0) {
            this.selectAll.indeterminate = true;
            this.selectAll.checked = false;
        } else {
            this.selectAll.indeterminate = false;
            this.selectAll.checked = false;
        }
    }

    /**
     * Atualizar botão de empenhar
     */
    updateBotaoEmpenhar() {
        const qtdSelecionados = this.itensSelecionados.size;
        
        if (qtdSelecionados === 0) {
            this.btnEmpenhar.disabled = true;
            this.btnEmpenhar.textContent = 'Empenhar Itens Selecionados';
        } else {
            this.btnEmpenhar.disabled = false;
            this.btnEmpenhar.textContent = `Empenhar ${qtdSelecionados} Item${qtdSelecionados > 1 ? 's' : ''}`;
        }
    }

    /**
     * Abrir modal de empenho
     */
    abrirModal() {
        if (this.itensSelecionados.size === 0) return;

        this.modalTitle.textContent = `Registrar Empenho para ${this.itensSelecionados.size} Item${this.itensSelecionados.size > 1 ? 's' : ''}`;
        
        this.renderTabelaModal();
        this.modalEmpenho.style.display = 'flex';
        
        // Focar no primeiro input
        setTimeout(() => {
            const firstInput = this.tabelaModalBody.querySelector('.input-empenho');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Renderizar tabela do modal
     */
    renderTabelaModal() {
        const linhas = [];
        
        this.itensSelecionados.forEach(itemId => {
            const item = this.itensEnriquecidos.find(i => i.id === itemId);
            if (!item) return;
            
            const saldos = this.calcularSaldos(item);
            linhas.push(this.criarLinhaModal(item, saldos));
        });
        
        this.tabelaModalBody.innerHTML = linhas.join('');
        this.setupModalInputListeners();
    }

    /**
     * Criar linha para o modal
     */
    criarLinhaModal(item, saldos) {
        // Calcular quantidades inteligentes para preenchimento automático
        const quantidadesInteligentes = this.calcularQuantidadesInteligentes(item, saldos);
        
        return `
            <tr data-item-id="${item.id}">
                <td>${item.codigo || '-'}</td>
                <td>${item.descricao || item.item || item.produto || item.material || '-'}</td>
                <td>${saldos.saldoDisponivelEstoque}</td>
                <td>${saldos.saldoDisponivelRecebido}</td>
                <td>
                    <input type="number" 
                           class="input-empenho input-estoque" 
                           min="0" 
                           max="${saldos.saldoDisponivelEstoque}"
                           value="${quantidadesInteligentes.empenharEstoque}"
                           data-item-id="${item.id}"
                           data-max="${saldos.saldoDisponivelEstoque}">
                </td>
                <td>
                    <input type="number" 
                           class="input-empenho input-recebido" 
                           min="0" 
                           max="${saldos.saldoDisponivelRecebido}"
                           value="${quantidadesInteligentes.empenharRecebido}"
                           data-item-id="${item.id}"
                           data-max="${saldos.saldoDisponivelRecebido}">
                </td>
            </tr>
        `;
    }

    /**
     * Calcular quantidades inteligentes para preenchimento automático
     */
    calcularQuantidadesInteligentes(item, saldos) {
        // Quantidade total necessária para o item
        const quantidadeNecessaria = item.quantidade || 0;
        
        // Quantidade ainda necessária (total - já empenhado)
        const quantidadeAindaNecessaria = Math.max(0, quantidadeNecessaria - saldos.totalEmpenhado);
        
        // Se não precisar de mais nada, retornar zeros
        if (quantidadeAindaNecessaria === 0) {
            return {
                empenharEstoque: 0,
                empenharRecebido: 0
            };
        }
        
        // Calcular quanto usar do estoque (prioridade)
        const empenharEstoque = Math.min(
            saldos.saldoDisponivelEstoque,  // Não pode exceder o disponível
            quantidadeAindaNecessaria       // Não pode exceder o necessário
        );
        
        // Calcular quanto usar do recebido (complementar)
        const quantidadeRestante = quantidadeAindaNecessaria - empenharEstoque;
        const empenharRecebido = Math.min(
            saldos.saldoDisponivelRecebido, // Não pode exceder o disponível
            quantidadeRestante              // Só o que ainda falta
        );
        
        return {
            empenharEstoque,
            empenharRecebido
        };
    }

    /**
     * Configurar listeners dos inputs do modal
     */
    setupModalInputListeners() {
        const inputs = this.tabelaModalBody.querySelectorAll('.input-empenho');
        
        inputs.forEach(input => {
            // Validação em tempo real
            input.addEventListener('input', () => {
                this.validateInput(input);
            });
            
            // Permitir apenas números
            input.addEventListener('keypress', (e) => {
                // Permitir backspace, delete, tab, escape, enter
                if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                }
                // Garantir que é um número
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    e.preventDefault();
                }
            });
        });
    }

    /**
     * Validar input do modal
     */
    validateInput(input) {
        const value = parseInt(input.value) || 0;
        const max = parseInt(input.dataset.max) || 0;
        
        if (value > max) {
            input.classList.add('error');
            input.value = max;
        } else if (value < 0) {
            input.classList.add('error');
            input.value = 0;
        } else {
            input.classList.remove('error');
        }
    }

    /**
     * Fechar modal de empenho
     */
    fecharModal() {
        this.modalEmpenho.style.display = 'none';
        this.tabelaModalBody.innerHTML = '';
        // Não limpar seleções ao fechar o modal
    }
    
    /**
     * Abrir modal de itens empenhados
     */
    abrirModalEmpenhados() {
        this.renderTabelaEmpenhados();
        this.modalEmpenhados.style.display = 'flex';
    }
    
    /**
     * Fechar modal de itens empenhados
     */
    fecharModalEmpenhados() {
        this.modalEmpenhados.style.display = 'none';
        this.tabelaEmpenhadosBody.innerHTML = '';
    }
    
    /**
     * Renderizar tabela de itens empenhados
     */
    renderTabelaEmpenhados() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        const listaSelecionada = this.selectLista.value;
        
        // Filtrar apenas itens que têm histórico de empenho
        let itensEmpenhados = this.itensEnriquecidos.filter(item => {
            const historicoEmpenhos = item.historicoEmpenhos || [];
            return historicoEmpenhos.length > 0;
        });
        
        // Aplicar filtros se selecionados
        if (clienteSelecionado) {
            itensEmpenhados = itensEmpenhados.filter(item => item.clienteNome === clienteSelecionado);
            
            if (projetoSelecionado) {
                itensEmpenhados = itensEmpenhados.filter(item => item.tipoProjeto === projetoSelecionado);
                
                if (listaSelecionada) {
                    itensEmpenhados = itensEmpenhados.filter(item => item.listaMaterial === listaSelecionada);
                }
            }
        }
        
        // Se não houver itens empenhados
        if (itensEmpenhados.length === 0) {
            this.tabelaEmpenhadosBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <h3>Nenhum item empenhado</h3>
                        <p>Não há itens empenhados para os filtros selecionados.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Construir linhas da tabela
        const linhas = itensEmpenhados.map(item => {
            const saldos = this.calcularSaldos(item);
            const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
            
            return `
                <tr>
                    <td>${item.codigo || '-'}</td>
                    <td>${item.descricao || '-'}</td>
                    <td>${qtdNecessaria}</td>
                    <td>${saldos.totalEmpenhado}</td>
                    <td>
                        <button class="btn-empenhar-linha btn-desfazer-empenho" data-item-id="${item.id}">
                            Desfazer Empenho
                        </button>
                    </td>
                </tr>
            `;
        });
        
        this.tabelaEmpenhadosBody.innerHTML = linhas.join('');
        
        // Adicionar event listeners para os botões de desfazer
        document.querySelectorAll('.btn-desfazer-empenho').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                this.handleDesfazerEmpenho(itemId);
            });
        });
    }

    /**
     * Desfazer empenho de um item
     */
    async handleDesfazerEmpenho(itemId) {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            
            // Buscar o item
            const item = this.itensEnriquecidos.find(i => i.id === itemId);
            if (!item) {
                this.showToast('Item não encontrado', 'error');
                return;
            }
            
            // Confirmar antes de desfazer
            if (!confirm(`Tem certeza que deseja desfazer o empenho do item ${item.codigo || itemId}?`)) {
                return;
            }
            
            // Iniciar transação no Firestore
            const batch = db.batch();
            const itemRef = db.collection('itens').doc(itemId);
            
            // Remover o histórico de empenho (zerando-o)
            batch.update(itemRef, {
                historicoEmpenhos: [],
                statusItem: 'Disponível', // Voltar para status disponível
                ultimaAtualizacao: new Date()
            });
            
            // Executar batch
            await batch.commit();
            
            // Atualizar os dados localmente
            item.historicoEmpenhos = [];
            item.statusItem = 'Disponível';
            item.ultimaAtualizacao = new Date();
            
            // Mostrar mensagem de sucesso
            this.showToast('Empenho desfeito com sucesso', 'success');
            
            // Recarregar tabela de empenhados
            this.renderTabelaEmpenhados();
            
            // Se a lista correspondente estiver sendo exibida, recarregar também
            if (this.selectLista.value === item.listaMaterial) {
                this.renderTabelaEmpenho();
            }
            
        } catch (error) {
            console.error('Erro ao desfazer empenho:', error);
            this.showToast('Erro ao desfazer empenho', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Salvar empenho
     */
    async handleSalvarEmpenho() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.btnSalvar.textContent = 'Salvando...';

            // Coletar dados do modal
            const empenhosParaSalvar = this.coletarDadosModal();
            
            if (empenhosParaSalvar.length === 0) {
                this.showToast('Nenhuma quantidade foi informada para empenho', 'error');
                return;
            }

            // Executar transação no Firebase
            await this.executarTransacaoEmpenho(empenhosParaSalvar);
            
            // Sucesso
            this.showToast('Empenho salvo com sucesso!', 'success');
            this.fecharModal();
            
            // Atualizar apenas os dados locais e re-renderizar a tabela MANTENDO OS FILTROS
            await this.atualizarDadosLocais();
            this.renderTabelaEmpenho();

        } catch (error) {
            console.error('Erro ao salvar empenho:', error);
            this.showToast('Erro ao salvar empenho: ' + error.message, 'error');
        } finally {
            this.isLoading = false;
            this.btnSalvar.textContent = 'Salvar Empenho';
        }
    }

    /**
     * Coletar dados do modal para salvamento
     */
    coletarDadosModal() {
        const empenhosParaSalvar = [];
        const rows = this.tabelaModalBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const itemId = row.dataset.itemId;
            const inputEstoque = row.querySelector('.input-estoque');
            const inputRecebido = row.querySelector('.input-recebido');
            
            const qtdeEstoque = parseInt(inputEstoque.value) || 0;
            const qtdeRecebido = parseInt(inputRecebido.value) || 0;
            
            if (qtdeEstoque > 0 || qtdeRecebido > 0) {
                empenhosParaSalvar.push({
                    itemId,
                    qtdeEmpenhadaDoEstoque: qtdeEstoque,
                    qtdeEmpenhadaDoRecebido: qtdeRecebido
                });
            }
        });
        
        return empenhosParaSalvar;
    }

    /**
     * Executar transação de empenho no Firebase
     */
    async executarTransacaoEmpenho(empenhosParaSalvar) {
        const batch = db.batch();
        const dataEmpenho = new Date().toISOString();
        
        for (const empenho of empenhosParaSalvar) {
            const itemRef = db.collection('itens').doc(empenho.itemId);
            const item = this.itensEnriquecidos.find(i => i.id === empenho.itemId);
            
            if (!item) {
                throw new Error(`Item ${empenho.itemId} não encontrado`);
            }

            // Criar registro de empenho
            const registroEmpenho = {
                dataEmpenho,
                qtdeEmpenhadaDoEstoque: empenho.qtdeEmpenhadaDoEstoque,
                qtdeEmpenhadaDoRecebido: empenho.qtdeEmpenhadaDoRecebido,
                responsavel: 'Sistema', // ou usuário logado
                observacoes: `Empenho realizado via sistema em ${new Date().toLocaleString('pt-BR')}`
            };

            // Atualizar histórico de empenhos
            const novoHistoricoEmpenhos = [...(item.historicoEmpenhos || []), registroEmpenho];
            
            // Calcular novo status do item
            const novoStatus = this.calcularNovoStatusItem(item, empenho);
            
            // Atualizar item no batch
            batch.update(itemRef, {
                historicoEmpenhos: novoHistoricoEmpenhos,
                statusItem: novoStatus,
                ultimaAtualizacao: dataEmpenho
            });
        }

        // Executar batch
        await batch.commit();

        // Verificar se algum pedido foi completado
        const pedidosVerificar = new Set();
        empenhosParaSalvar.forEach(empenho => {
            const item = this.itensEnriquecidos.find(i => i.id === empenho.itemId);
            if (item && item.pedidoId) {
                pedidosVerificar.add(item.pedidoId);
            }
        });

        // Verificar completude dos pedidos
        for (const pedidoId of pedidosVerificar) {
            await this.checkPedidoCompleto(pedidoId);
        }
    }

    /**
     * Calcular novo status do item após empenho
     */
    calcularNovoStatusItem(item, empenho) {
        const saldos = this.calcularSaldos(item);
        const totalEmpenhado = saldos.totalEmpenhado + empenho.qtdeEmpenhadaDoEstoque + empenho.qtdeEmpenhadaDoRecebido;
        const totalNecessario = item.quantidade || 0;

        if (totalEmpenhado >= totalNecessario) {
            return 'Empenhado';
        } else if (totalEmpenhado > 0) {
            return 'Parcialmente Empenhado';
        } else {
            return item.statusItem || 'Indefinido';
        }
    }

    /**
     * Verificar se pedido está completo
     */
    async checkPedidoCompleto(pedidoId) {
        try {
            // Buscar todos os itens do pedido
            const itensSnapshot = await db.collection('itens')
                .where('pedidoId', '==', pedidoId)
                .get();

            const todosEmpenhados = itensSnapshot.docs.every(doc => {
                const item = doc.data();
                return item.statusItem === 'Empenhado' || item.statusItem === 'Separado para Produção';
            });

            if (todosEmpenhados) {
                const pedidoRef = db.collection('pedidos').doc(pedidoId);
                await pedidoRef.update({
                    statusPedido: 'Empenhado',
                    ultimaAtualizacao: new Date().toISOString()
                });
                console.log(`Pedido ${pedidoId} marcado como empenhado`);
            }
        } catch (error) {
            console.error(`Erro ao verificar completude do pedido ${pedidoId}:`, error);
        }
    }

    /**
     * Atualizar apenas os dados locais sem mexer nos filtros
     */
    async atualizarDadosLocais() {
        try {
            console.log('Atualizando dados locais...');

            // Recarregar APENAS os itens do Firebase SEM mostrar loading (excluindo empenhados, separados e para compra)
            const itensSnapshot = await db.collection('itens')
                .where('statusItem', 'not-in', ['Empenhado', 'Separado para Produção', 'Para Compra'])
                .get();

            // Atualizar array local com dados atualizados
            this.itensEnriquecidos = itensSnapshot.docs.map(doc => {
                const item = { id: doc.id, ...doc.data() };
                const pedidoPai = this.pedidosMap.get(item.pedidoId);

                if (pedidoPai) {
                    item.clienteNome = pedidoPai.clienteNome;
                    item.tipoProjeto = pedidoPai.tipoProjeto;
                    return item;
                }

                return null;
            }).filter(Boolean);

            console.log(`${this.itensEnriquecidos.length} itens atualizados localmente`);

        } catch (error) {
            console.error('Erro ao atualizar dados locais:', error);
            throw error;
        }
    }

    /**
     * Resetar filtro
     */
    resetFilter(selectElement, defaultText) {
        selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        selectElement.disabled = true;
    }

    /**
     * Limpar tabela
     */
    limparTabela() {
        this.tabelaItensBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <h3>Aguardando Seleção</h3>
                    <p>Selecione um cliente, projeto e lista de material para ver os itens disponíveis para empenho.</p>
                </td>
            </tr>
        `;
        // Preservar seleções em vez de limpar
        this.updateBotaoEmpenhar();
        this.selectAll.checked = false;
        this.selectAll.indeterminate = false;
    }

    /**
     * Definir estado de carregamento
     */
    setLoadingState(loading) {
        this.isLoading = loading;
        
        if (loading) {
            this.selectCliente.innerHTML = '<option value="">Carregando...</option>';
        }
    }

    /**
     * Mostrar notificação toast
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
        
        // Remover toast após 5 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Calcular status de empenho para um cliente
     */
    calcularStatusCliente(cliente) {
        const itensCliente = this.itensEnriquecidos.filter(item => item.clienteNome === cliente);
        
        if (itensCliente.length === 0) return 'normal';

        let totalItens = 0;
        let itensEmpenhados = 0;
        let itensParciaisOuEmpenhados = 0;

        itensCliente.forEach(item => {
            const saldos = this.calcularSaldos(item);
            const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
            
            totalItens++;
            
            if (saldos.totalEmpenhado >= qtdNecessaria) {
                itensEmpenhados++;
                itensParciaisOuEmpenhados++;
            } else if (saldos.totalEmpenhado > 0) {
                itensParciaisOuEmpenhados++;
            }
        });

        if (itensEmpenhados === totalItens) {
            return 'empenhado'; // Todos empenhados
        } else if (itensParciaisOuEmpenhados > 0) {
            return 'parcial'; // Alguns empenhados ou parciais
        }
        return 'normal'; // Nenhum empenhado
    }

    /**
     * Calcular status de empenho para um projeto
     */
    calcularStatusProjeto(cliente, projeto) {
        const itensProjeto = this.itensEnriquecidos.filter(item => 
            item.clienteNome === cliente && item.tipoProjeto === projeto
        );
        
        if (itensProjeto.length === 0) return 'normal';

        let totalItens = 0;
        let itensEmpenhados = 0;
        let itensParciaisOuEmpenhados = 0;

        itensProjeto.forEach(item => {
            const saldos = this.calcularSaldos(item);
            const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
            
            totalItens++;
            
            if (saldos.totalEmpenhado >= qtdNecessaria) {
                itensEmpenhados++;
                itensParciaisOuEmpenhados++;
            } else if (saldos.totalEmpenhado > 0) {
                itensParciaisOuEmpenhados++;
            }
        });

        if (itensEmpenhados === totalItens) {
            return 'empenhado'; // Todos empenhados
        } else if (itensParciaisOuEmpenhados > 0) {
            return 'parcial'; // Alguns empenhados ou parciais
        }
        return 'normal'; // Nenhum empenhado
    }

    /**
     * Calcular status de empenho para uma lista de material
     */
    calcularStatusLista(cliente, projeto, lista) {
        const itensLista = this.itensEnriquecidos.filter(item => 
            item.clienteNome === cliente && 
            item.tipoProjeto === projeto && 
            item.listaMaterial === lista
        );
        
        if (itensLista.length === 0) return 'normal';

        let totalItens = 0;
        let itensEmpenhados = 0;
        let itensParciaisOuEmpenhados = 0;

        itensLista.forEach(item => {
            const saldos = this.calcularSaldos(item);
            const qtdNecessaria = item.quantidade || item.QtdItemNecFinal || 0;
            
            totalItens++;
            
            if (saldos.totalEmpenhado >= qtdNecessaria) {
                itensEmpenhados++;
                itensParciaisOuEmpenhados++;
            } else if (saldos.totalEmpenhado > 0) {
                itensParciaisOuEmpenhados++;
            }
        });

        if (itensEmpenhados === totalItens) {
            return 'empenhado'; // Todos empenhados
        } else if (itensParciaisOuEmpenhados > 0) {
            return 'parcial'; // Alguns empenhados ou parciais
        }
        return 'normal'; // Nenhum empenhado
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new SistemaEmpenho();
});