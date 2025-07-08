class SistemaCompraFinal {
    constructor() {
        // Firebase
        this.db = firebase.firestore();
        
        // Elementos DOM
        this.selectCliente = document.getElementById('selectCliente');
        this.selectProjeto = document.getElementById('selectProjeto');
        this.selectLista = document.getElementById('selectLista');
        this.tabelaItens = document.getElementById('tabelaItens');
        this.selectAll = document.getElementById('selectAll');
        this.btnGerarLista = document.getElementById('btnGerarLista');
        this.totalItens = document.getElementById('totalItens');
        
        // Modal
        this.modalCompraFinal = document.getElementById('modalCompraFinal');
        this.btnFecharModal = document.getElementById('btnFecharModal');
        this.btnBaixarLista = document.getElementById('btnBaixarLista');
        this.btnConfirmarCompra = document.getElementById('btnConfirmarCompra');
        this.inputFornecedor = document.getElementById('inputFornecedor');
        this.inputPrazoEntrega = document.getElementById('inputPrazoEntrega');
        this.tabelaModalItens = document.getElementById('tabelaModalItens');
        
        // Estado da aplicação
        this.pedidosMap = new Map();
        this.itensEnriquecidos = [];
        this.itensFiltrados = [];
        this.itensSelecionados = new Set();
        
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando Sistema de Compra Final...');
        this.setupEventListeners();
        await this.carregarDadosIniciais();
    }

    setupEventListeners() {
        // Filtros em cascata
        this.selectCliente.addEventListener('change', () => this.onClienteChange());
        this.selectProjeto.addEventListener('change', () => this.onProjetoChange());
        this.selectLista.addEventListener('change', () => this.onListaChange());

        // Seleção de itens
        this.selectAll.addEventListener('change', () => this.onSelectAllChange());
        this.btnGerarLista.addEventListener('click', () => this.abrirModalCompra());

        // Modal
        this.btnFecharModal.addEventListener('click', () => this.fecharModal());
        this.btnBaixarLista.addEventListener('click', () => this.baixarListaExcel());
        this.btnConfirmarCompra.addEventListener('click', () => this.confirmarCompra());

        // Fechar modal ao clicar fora
        this.modalCompraFinal.addEventListener('click', (e) => {
            if (e.target === this.modalCompraFinal) {
                this.fecharModal();
            }
        });
    }

    /**
     * Carregar dados iniciais do Firebase
     */
    async carregarDadosIniciais() {
        try {
            this.showLoading('Carregando dados...');

            // Passo 1: Buscar TODOS os Pedidos
            console.log('🔄 Carregando pedidos...');
            const pedidosSnapshot = await this.db.collection('pedidos').get();

            this.pedidosMap.clear();
            pedidosSnapshot.docs.forEach(doc => {
                this.pedidosMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            console.log(`📦 ${this.pedidosMap.size} pedidos carregados`);

            // Passo 2: Buscar TODOS os Itens com compraFinal > 0
            console.log('🔄 Carregando itens com compra final...');
            const itensSnapshot = await this.db.collection('itens')
                .where('compraFinal', '>', 0)
                .get();

            console.log(`📊 ${itensSnapshot.size} itens com compra final encontrados`);

            // Passo 3: Enriquecer os Itens com dados do pedido pai
            this.itensEnriquecidos = [];
            
            for (const doc of itensSnapshot.docs) {
                const item = { id: doc.id, ...doc.data() };
                let dadosEnriquecidos = { ...item };



                // Tentar enriquecer com dados do pedido
                if (item.pedidoId) {
                    const pedidoPai = this.pedidosMap.get(item.pedidoId);
                    if (pedidoPai) {
                        dadosEnriquecidos.clienteNome = pedidoPai.clienteNome;
                        // 🔧 USAR tipoProjeto DO PEDIDO PAI PARA PREENCHER projetoNome
                        dadosEnriquecidos.projetoNome = pedidoPai.tipoProjeto || pedidoPai.projetoNome;
                        dadosEnriquecidos.listaMaterial = pedidoPai.listaMaterial;
                        

                    }
                }

                // 🔧 SE O ITEM JÁ TEM projetoNome SALVO DIRETAMENTE, USAR ELE (dados da Análise Final)
                if (!dadosEnriquecidos.projetoNome && item.projetoNome) {
                    dadosEnriquecidos.projetoNome = item.projetoNome;
                }

                // 🔧 FALLBACK: Se ainda não tem projetoNome, usar tipoProjeto do item
                if (!dadosEnriquecidos.projetoNome && item.tipoProjeto) {
                    dadosEnriquecidos.projetoNome = item.tipoProjeto;
                }
                
                // 🔧 SE O ITEM JÁ TEM clienteNome SALVO DIRETAMENTE, USAR ELE (dados da Análise Final)
                if (!dadosEnriquecidos.clienteNome && item.clienteNome) {
                    dadosEnriquecidos.clienteNome = item.clienteNome;
                }

                // Se não tem pedidoId, usar campos diretos se existirem  
                if (!dadosEnriquecidos.clienteNome && item.cliente) {
                    dadosEnriquecidos.clienteNome = item.cliente;
                }


                
                // Só adicionar se tiver pelo menos o cliente
                if (dadosEnriquecidos.clienteNome) {
                    this.itensEnriquecidos.push(dadosEnriquecidos);
                } else {
                    console.warn(`❌ Item ${item.id} descartado - sem dados de cliente`);
                }
            }

            console.log(`✅ ${this.itensEnriquecidos.length} itens carregados e enriquecidos`);

            // Passo 4: Popular primeiro filtro
            this.populateClientesFilter();
            this.atualizarContadorItens();
            this.atualizarBotaoGerar(); // 🔧 Inicializar botão desabilitado

        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.showToast('Erro ao carregar dados: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Popular dropdown de clientes
     */
    populateClientesFilter() {
        const clientes = [...new Set(this.itensEnriquecidos.map(item => item.clienteNome))].sort();
        

        
        this.selectCliente.innerHTML = '<option value="">Selecione um cliente</option>';
        
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente;
            option.textContent = cliente;
            this.selectCliente.appendChild(option);
        });

        console.log(`🎯 ${clientes.length} clientes disponíveis para compra final`);

        // Resetar filtros subsequentes
        this.resetProjetoFilter();
        this.resetListaFilter();
        this.limparTabela();
        
        console.log(`🎯 ${clientes.length} clientes disponíveis para compra final`);
    }

    /**
     * Popular dropdown de projetos baseado no cliente selecionado
     */
    populateProjetosFilter(clienteSelecionado) {
        const itensDoCliente = this.itensEnriquecidos.filter(item => item.clienteNome === clienteSelecionado);
        const projetos = [...new Set(itensDoCliente.map(item => item.projetoNome || 'Projeto não definido'))].sort();
        
        this.selectProjeto.innerHTML = '<option value="">Selecione um projeto</option>';
        this.selectProjeto.disabled = false;
        
        projetos.forEach(projeto => {
            const option = document.createElement('option');
            option.value = projeto;
            option.textContent = projeto;
            this.selectProjeto.appendChild(option);
        });

        console.log(`🎯 ${projetos.length} projetos disponíveis para cliente: ${clienteSelecionado}`);
    }

    /**
     * Popular dropdown de listas baseado no cliente e projeto selecionados
     */
    populateListasFilter(clienteSelecionado, projetoSelecionado) {
        const itensDoClienteProjeto = this.itensEnriquecidos.filter(item => 
            item.clienteNome === clienteSelecionado &&
            (item.projetoNome || 'Projeto não definido') === projetoSelecionado
        );
        
        const listas = [...new Set(itensDoClienteProjeto.map(item => item.listaMaterial || 'Lista não definida'))].sort();
        
        this.selectLista.innerHTML = '<option value="">Selecione uma lista</option>';
        this.selectLista.disabled = false;
        
        listas.forEach(lista => {
            const option = document.createElement('option');
            option.value = lista;
            option.textContent = lista;
            this.selectLista.appendChild(option);
        });

        console.log(`🎯 ${listas.length} listas disponíveis para cliente: ${clienteSelecionado}, projeto: ${projetoSelecionado}`);
    }

    /**
     * Eventos dos filtros
     */
    onClienteChange() {
        const clienteSelecionado = this.selectCliente.value;
        
        if (clienteSelecionado) {
            this.populateProjetosFilter(clienteSelecionado);
        } else {
            this.resetProjetoFilter();
        }
        
        this.resetListaFilter();
        this.limparTabela();
    }

    onProjetoChange() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        
        if (clienteSelecionado && projetoSelecionado) {
            this.populateListasFilter(clienteSelecionado, projetoSelecionado);
        } else {
            this.resetListaFilter();
        }
        
        this.limparTabela();
    }

    onListaChange() {
        this.filtrarEExibirItens();
    }

    /**
     * Filtrar e exibir itens baseado nas seleções atuais
     */
    filtrarEExibirItens() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        const listaSelecionada = this.selectLista.value;

        // Filtrar itens baseado nas seleções
        this.itensFiltrados = this.itensEnriquecidos.filter(item => {
            if (clienteSelecionado && item.clienteNome !== clienteSelecionado) return false;
            if (projetoSelecionado && (item.projetoNome || 'Projeto não definido') !== projetoSelecionado) return false;
            if (listaSelecionada && (item.listaMaterial || 'Lista não definida') !== listaSelecionada) return false;
            return true;
        });

        this.renderizarTabela();
        this.atualizarContadorItens();
    }

    /**
     * Renderizar tabela de itens
     */
    renderizarTabela() {
        this.tabelaItens.innerHTML = '';
        
        if (this.itensFiltrados.length === 0) {
            this.tabelaItens.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-gray-500 py-8">
                        ${this.selectCliente.value ? 'Nenhum item encontrado com os filtros selecionados' : 'Selecione os filtros para visualizar os itens com necessidade de compra final'}
                    </td>
                </tr>`;
            return;
        }

        this.itensFiltrados.forEach(item => {
            const linha = this.criarLinhaItem(item);
            this.tabelaItens.appendChild(linha);
        });
    }

    /**
     * Criar linha da tabela para um item
     */
    criarLinhaItem(item) {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-200 hover:bg-gray-50';
        tr.setAttribute('data-item-id', item.id);

        tr.innerHTML = `
            <td class="px-4 py-3">
                <input type="checkbox" class="item-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                       data-item-id="${item.id}">
            </td>
            <td class="px-4 py-3 font-mono text-sm">${item.codigo || 'N/A'}</td>
            <td class="px-4 py-3">${item.descricao || 'N/A'}</td>
            <td class="px-4 py-3 text-center font-semibold">${item.compraFinal || 0}</td>
        `;

        // Event listener para o checkbox
        const checkbox = tr.querySelector('.item-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.itensSelecionados.add(item.id);
            } else {
                this.itensSelecionados.delete(item.id);
            }
            this.atualizarSelectAll();
            this.atualizarBotaoGerar(); // 🔧 Atualizar estado do botão
        });

        return tr;
    }

    /**
     * Resetar filtros
     */
    resetProjetoFilter() {
        this.selectProjeto.innerHTML = '<option value="">Selecione um projeto</option>';
        this.selectProjeto.disabled = true;
    }

    resetListaFilter() {
        this.selectLista.innerHTML = '<option value="">Selecione uma lista</option>';
        this.selectLista.disabled = true;
    }

    limparTabela() {
        this.tabelaItens.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-gray-500 py-8">
                    Selecione os filtros para visualizar os itens com necessidade de compra final
                </td>
            </tr>`;
        this.itensSelecionados.clear();
        this.atualizarSelectAll();
        this.atualizarContadorItens();
        this.atualizarBotaoGerar(); // 🔧 Atualizar estado do botão
    }

    /**
     * Atualizar contador de itens
     */
    atualizarContadorItens() {
        const total = this.itensFiltrados.length;
        this.totalItens.textContent = `${total} ${total === 1 ? 'item' : 'itens'}`;
    }

    /**
     * Gerenciar seleção de todos os itens
     */
    onSelectAllChange() {
        const isChecked = this.selectAll.checked;
        const checkboxes = document.querySelectorAll('.item-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const itemId = checkbox.getAttribute('data-item-id');
            
            if (isChecked) {
                this.itensSelecionados.add(itemId);
            } else {
                this.itensSelecionados.delete(itemId);
            }
        });
        
        this.atualizarBotaoGerar(); // 🔧 Atualizar estado do botão
    }

    atualizarSelectAll() {
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
     * 🔧 Atualizar estado do botão "Gerar Lista de Compra"
     */
    atualizarBotaoGerar() {
        const temItensSelecionados = this.itensSelecionados.size > 0;
        this.btnGerarLista.disabled = !temItensSelecionados;
        
        if (temItensSelecionados) {
            this.btnGerarLista.classList.remove('opacity-50', 'cursor-not-allowed');
            this.btnGerarLista.classList.add('hover:bg-blue-600');
        } else {
            this.btnGerarLista.classList.add('opacity-50', 'cursor-not-allowed');
            this.btnGerarLista.classList.remove('hover:bg-blue-600');
        }
        
        console.log(`🔘 Botão Gerar Lista: ${temItensSelecionados ? 'HABILITADO' : 'DESABILITADO'} (${this.itensSelecionados.size} itens selecionados)`);
    }

    /**
     * Modal de compra
     */
    abrirModalCompra() {
        if (this.itensSelecionados.size === 0) {
            this.showToast('Selecione pelo menos um item para gerar a lista de compra', 'warning');
            return;
        }

        this.renderizarModalItens();
        this.modalCompraFinal.classList.remove('hidden');
    }

    renderizarModalItens() {
        this.tabelaModalItens.innerHTML = '';
        
        const itensSelecionadosArray = this.itensFiltrados.filter(item => 
            this.itensSelecionados.has(item.id)
        );

        itensSelecionadosArray.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-200';
            
            tr.innerHTML = `
                <td class="px-4 py-3 font-mono text-sm">${item.codigo || 'N/A'}</td>
                <td class="px-4 py-3">${item.descricao || 'N/A'}</td>
                <td class="px-4 py-3 text-center">${item.compraFinal}</td>
                <td class="px-4 py-3">
                    <input type="number" 
                           class="w-20 px-2 py-1 border border-gray-300 rounded text-center quantidade-modal" 
                           value="${item.compraFinal}" 
                           min="1" 
                           data-item-id="${item.id}">
                </td>
            `;
            
            this.tabelaModalItens.appendChild(tr);
        });
    }

    fecharModal() {
        this.modalCompraFinal.classList.add('hidden');
        this.inputFornecedor.value = '';
        this.inputPrazoEntrega.value = '';
    }

    /**
     * Baixar lista em Excel
     */
    baixarListaExcel() {
        const fornecedor = this.inputFornecedor.value.trim();
        const prazoEntrega = this.inputPrazoEntrega.value;
        
        if (!fornecedor || !prazoEntrega) {
            this.showToast('Preencha fornecedor e prazo de entrega antes de baixar a lista', 'warning');
            return;
        }

        const dadosCompra = this.obterDadosCompra();
        
        // Preparar dados para Excel
        const dadosExcel = [
            ['LISTA DE COMPRA FINAL'],
            [''],
            ['Fornecedor:', fornecedor],
            ['Prazo de Entrega:', new Date(prazoEntrega).toLocaleDateString('pt-BR')],
            ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
            [''],
            ['Código', 'Descrição', 'Quantidade']
        ];

        dadosCompra.forEach(item => {
            dadosExcel.push([
                item.codigo || 'N/A',
                item.descricao || 'N/A',
                item.quantidade
            ]);
        });

        // Criar workbook
        const ws = XLSX.utils.aoa_to_sheet(dadosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lista de Compra Final');

        // Download
        const nomeArquivo = `Compra_Final_${fornecedor.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);

        this.showToast('Lista baixada com sucesso!', 'success');
    }

    /**
     * Confirmar compra
     */
    async confirmarCompra() {
        const fornecedor = this.inputFornecedor.value.trim();
        const prazoEntrega = this.inputPrazoEntrega.value;
        
        if (!fornecedor || !prazoEntrega) {
            this.showToast('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        const dadosCompra = this.obterDadosCompra();
        
        if (dadosCompra.length === 0) {
            this.showToast('Nenhum item selecionado para compra', 'warning');
            return;
        }

        try {
            this.showLoading('Processando compra...');
            
            // Batch para transação atômica
            const batch = this.db.batch();
            
            dadosCompra.forEach(item => {
                const itemRef = this.db.collection('itens').doc(item.id);
                
                const registroCompra = {
                    dataCompra: firebase.firestore.Timestamp.now(),
                    fornecedor: fornecedor,
                    prazoEntrega: firebase.firestore.Timestamp.fromDate(new Date(prazoEntrega)),
                    qtdeComprada: item.quantidade,
                    responsavel: 'Sistema',
                    observacoes: `Compra final realizada via sistema`
                };

                batch.update(itemRef, {
                    historicoCompraFinal: firebase.firestore.FieldValue.arrayUnion(registroCompra),
                    compraFinal: 0,
                    statusItem: 'Aguardando Recebimento Final',
                    dataUltimaAtualizacao: firebase.firestore.Timestamp.now()
                });
            });

            await batch.commit();
            
            this.showToast(`Compra confirmada! ${dadosCompra.length} itens processados.`, 'success');
            this.fecharModal();
            
            // Recarregar dados
            await this.carregarDadosIniciais();
            
        } catch (error) {
            console.error('Erro ao confirmar compra:', error);
            this.showToast('Erro ao confirmar compra: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Obter dados da compra do modal
     */
    obterDadosCompra() {
        const quantidadeInputs = document.querySelectorAll('.quantidade-modal');
        const dadosCompra = [];
        
        quantidadeInputs.forEach(input => {
            const itemId = input.getAttribute('data-item-id');
            const quantidade = parseInt(input.value) || 0;
            
            if (quantidade > 0) {
                const item = this.itensFiltrados.find(i => i.id === itemId);
                if (item) {
                    dadosCompra.push({
                        id: itemId,
                        codigo: item.codigo,
                        descricao: item.descricao,
                        quantidade: quantidade
                    });
                }
            }
        });
        
        return dadosCompra;
    }

    /**
     * Utilitários de UI
     */
    showLoading(message = 'Carregando...') {
        // Implementação do loading
        console.log('Loading:', message);
    }

    hideLoading() {
        // Implementação para esconder loading
        console.log('Loading hidden');
    }

    showToast(message, type = 'info') {
        // Implementação simples de toast
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
        
        console.log(`Toast (${type}):`, message);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new SistemaCompraFinal();
});