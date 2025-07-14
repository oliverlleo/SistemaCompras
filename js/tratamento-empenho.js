/**
 * Sistema de Tratamento de Empenho
 * Análise Final - Confronto entre itens empenhados e lista final de produção
 */

class SistemaTratamentoEmpenho {
    constructor() {
        // Usar configuração Firebase já inicializada pelo firebase-config.js
        this.db = firebase.firestore();

        // Estado da aplicação
        this.pedidos = [];
        this.itensEmpenhados = [];
        this.listaFinal = [];
        this.tabelaConfronto = [];
        this.uploadedFile = null;

        // Maps para performance
        this.clientesMap = new Map();
        this.projetosMap = new Map();
        this.listasMap = new Map();

        // Elementos DOM
        this.selectCliente = document.getElementById('selectCliente');
        this.selectProjeto = document.getElementById('selectProjeto');
        this.selectLista = document.getElementById('selectLista');
        this.btnCarregarItens = document.getElementById('btnCarregarItens');
        this.uploadSection = document.getElementById('uploadSection');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.btnProcessarPlanilha = document.getElementById('btnProcessarPlanilha');
        this.resultsSection = document.getElementById('resultsSection');
        this.tabelaConfronto = document.getElementById('tabelaConfronto');
        this.totalItensConfronto = document.getElementById('totalItensConfronto');
        this.btnConfirmarTratamento = document.getElementById('btnConfirmarTratamento');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');

        this.init();
    }

    init() {
        console.log('🚀 Inicializando Sistema de Tratamento de Empenho...');
        this.setupEventListeners();
        this.carregarDadosIniciais();
    }

    setupEventListeners() {
        // Filtros em cascata
        this.selectCliente.addEventListener('change', () => this.onClienteChange());
        this.selectProjeto.addEventListener('change', () => this.onProjetoChange());
        this.selectLista.addEventListener('change', () => this.onListaChange());

        // Botão carregar itens
        this.btnCarregarItens.addEventListener('click', () => this.carregarItensEmpenhados());

        // Upload de arquivo
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Processar planilha
        this.btnProcessarPlanilha.addEventListener('click', () => this.processarPlanilha());

        // Confirmar tratamento
        this.btnConfirmarTratamento.addEventListener('click', () => this.confirmarTratamento());
    }

    async carregarDadosIniciais() {
        try {
            this.showLoading('Carregando dados...');
            
            console.log('📊 Carregando pedidos...');
            const pedidosSnapshot = await this.db.collection('pedidos').get();
            
            this.pedidos = pedidosSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ ${this.pedidos.length} pedidos carregados`);
            
            // Popular clientes com itens empenhados
            this.popularClientesComItensEmpenhados();
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.showToast('Erro ao carregar dados: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async popularClientesComItensEmpenhados() {
        try {
            console.log('🔍 Buscando clientes com itens empenhados...');
            
            // Buscar itens com status empenhado
            const itensSnapshot = await this.db.collection('itens')
                .where('statusItem', 'in', ['Empenhado', 'Parcialmente Empenhado'])
                .get();

            console.log(`📊 Itens com status empenhado encontrados: ${itensSnapshot.size}`);

            const clientesComEmpenho = new Set();

            // Para cada item empenhado, buscar o pedido pai para obter o cliente
            for (const doc of itensSnapshot.docs) {
                const item = doc.data();
                
                if (item.pedidoId) {
                    try {
                        const pedidoSnapshot = await this.db.collection('pedidos').doc(item.pedidoId).get();
                        
                        if (pedidoSnapshot.exists) {
                            const pedido = pedidoSnapshot.data();
                            if (pedido.clienteNome) {
                                clientesComEmpenho.add(pedido.clienteNome);
                                console.log('📝 Cliente encontrado:', pedido.clienteNome);
                            }
                        }
                    } catch (error) {
                        console.warn(`Erro ao buscar pedido ${item.pedidoId}:`, error);
                    }
                }
            }

            // Popular select de clientes
            this.selectCliente.innerHTML = '<option value="">Selecione um cliente</option>';
            
            if (clientesComEmpenho.size === 0) {
                console.log('⚠️ Nenhum cliente com itens empenhados encontrado');
                this.showToast('Nenhum cliente com itens empenhados encontrado.', 'warning');
            } else {
                Array.from(clientesComEmpenho).sort().forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente;
                    option.textContent = cliente;
                    this.selectCliente.appendChild(option);
                });
            }

            console.log(`✅ ${clientesComEmpenho.size} clientes com itens empenhados encontrados`);

        } catch (error) {
            console.error('❌ Erro ao popular clientes:', error);
            this.showToast('Erro ao carregar clientes: ' + error.message, 'error');
        }
    }

    async onClienteChange() {
        const clienteSelecionado = this.selectCliente.value;
        
        // Reset de filtros dependentes
        this.selectProjeto.innerHTML = '<option value="">Selecione um projeto</option>';
        this.selectProjeto.disabled = !clienteSelecionado;
        this.selectLista.innerHTML = '<option value="">Selecione uma lista</option>';
        this.selectLista.disabled = true;
        this.btnCarregarItens.disabled = true;

        if (!clienteSelecionado) return;

        try {
            // Buscar pedidos do cliente selecionado que tenham itens empenhados
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', clienteSelecionado)
                .get();

            const projetosSet = new Set();

            // Para cada pedido, verificar se tem itens empenhados
            for (const pedidoDoc of pedidosSnapshot.docs) {
                const pedido = pedidoDoc.data();
                
                // Verificar se este pedido tem itens empenhados
                const itensSnapshot = await this.db.collection('itens')
                    .where('pedidoId', '==', pedidoDoc.id)
                    .where('statusItem', 'in', ['Empenhado', 'Parcialmente Empenhado'])
                    .get();

                if (!itensSnapshot.empty && pedido.tipoProjeto) {
                    projetosSet.add(pedido.tipoProjeto);
                }
            }

            Array.from(projetosSet).sort().forEach(projeto => {
                const option = document.createElement('option');
                option.value = projeto;
                option.textContent = projeto;
                this.selectProjeto.appendChild(option);
            });

            this.selectProjeto.disabled = false;
            console.log(`✅ ${projetosSet.size} projetos encontrados para ${clienteSelecionado}`);
            
            // Código de teste removido - funcionando corretamente

        } catch (error) {
            console.error('❌ Erro ao carregar projetos:', error);
            this.showToast('Erro ao carregar projetos: ' + error.message, 'error');
        }
    }

    async onProjetoChange() {
        const clienteSelecionado = this.selectCliente.value;
        const projetoSelecionado = this.selectProjeto.value;
        
        // Reset de filtros dependentes
        this.selectLista.innerHTML = '<option value="">Selecione uma lista</option>';
        this.selectLista.disabled = true;
        this.btnCarregarItens.disabled = true;

        if (!projetoSelecionado) return;

        try {
            // Buscar pedidos do cliente e projeto selecionados
            const pedidosSnapshot = await this.db.collection('pedidos')
                .where('clienteNome', '==', clienteSelecionado)
                .where('tipoProjeto', '==', projetoSelecionado)
                .get();

            const listasSet = new Set();

            // Para cada pedido, buscar itens empenhados e suas listas
            for (const pedidoDoc of pedidosSnapshot.docs) {
                const itensSnapshot = await this.db.collection('itens')
                    .where('pedidoId', '==', pedidoDoc.id)
                    .where('statusItem', 'in', ['Empenhado', 'Parcialmente Empenhado'])
                    .get();

                itensSnapshot.docs.forEach(doc => {
                    const item = doc.data();
                    if (item.listaMaterial) {
                        listasSet.add(item.listaMaterial);
                    }
                });
            }

            Array.from(listasSet).sort().forEach(lista => {
                const option = document.createElement('option');
                option.value = lista;
                option.textContent = lista;
                this.selectLista.appendChild(option);
            });

            this.selectLista.disabled = false;
            console.log(`✅ ${listasSet.size} listas encontradas para ${clienteSelecionado} - ${projetoSelecionado}`);
            
            // Código de teste removido - funcionando corretamente

        } catch (error) {
            console.error('❌ Erro ao carregar listas:', error);
            this.showToast('Erro ao carregar listas: ' + error.message, 'error');
        }
    }

    onListaChange() {
        const listaSelecionada = this.selectLista.value;
        this.btnCarregarItens.disabled = !listaSelecionada;
        
        // Quando a lista for selecionada, carregar automaticamente os itens
        if (listaSelecionada) {
            this.carregarItensEmpenhados();
        }
    }

    async carregarItensEmpenhados() {
        const cliente = this.selectCliente.value;
        const projeto = this.selectProjeto.value;
        const lista = this.selectLista.value;

        if (!cliente || !projeto || !lista) {
            this.showToast('Selecione todos os filtros primeiro', 'warning');
            return;
        }

        try {
            this.showLoading('Carregando itens empenhados...');

            // Buscar itens pelos dados enriquecidos que estão no formato pedido
            const itensSnapshot = await this.db.collection('itens')
                .where('statusItem', 'in', ['Empenhado', 'Parcialmente Empenhado'])
                .get();

            // Filtrar pelos critérios selecionados baseado nos dados do pedido associado
            const itensEmpenhados = [];
            
            for (const doc of itensSnapshot.docs) {
                const item = { id: doc.id, ...doc.data() };
                
                // Buscar dados do pedido pai
                if (item.pedidoId) {
                    const pedidoSnapshot = await this.db.collection('pedidos').doc(item.pedidoId).get();
                    
                    if (pedidoSnapshot.exists) {
                        const pedido = pedidoSnapshot.data();
                        
                        // Verificar se corresponde aos filtros selecionados
                        if (pedido.clienteNome === cliente && 
                            pedido.tipoProjeto === projeto && 
                            item.listaMaterial === lista) {
                            
                            // Enriquecer item com dados do pedido
                            item.clienteNome = pedido.clienteNome;
                            item.tipoProjeto = pedido.tipoProjeto;
                            itensEmpenhados.push(item);
                        }
                    }
                }
            }

            this.itensEmpenhados = itensEmpenhados;

            // Calcular total empenhado para cada item
            this.itensEmpenhados.forEach(item => {
                item.totalEmpenhado = this.calcularTotalEmpenhado(item);
            });

            console.log(`✅ ${this.itensEmpenhados.length} itens empenhados carregados (não processados)`);
            console.log('📊 Itens empenhados:', this.itensEmpenhados.map(i => ({
                codigo: i.codigo,
                descricao: i.descricao,
                totalEmpenhado: i.totalEmpenhado
            })));

            // Verificar se há itens para processar
            if (this.itensEmpenhados.length === 0) {
                this.showToast(
                    'Nenhum item empenhado disponível para análise final. ' +
                    'Não há itens empenhados para esta combinação de cliente, projeto e lista.',
                    'info'
                );
                // Esconder seções se não há itens
                this.uploadSection.classList.add('hidden');
                this.resultsSection.classList.add('hidden');
                return;
            }

            // Verificar itens já processados vs. não processados
            const itensJaProcessados = this.itensEmpenhados.filter(item => item.analiseFinalRealizada === true);
            const itensNaoProcessados = this.itensEmpenhados.filter(item => item.analiseFinalRealizada !== true);
            
            console.log(`✅ ${itensJaProcessados.length} itens já processados anteriormente`);
            console.log(`✅ ${itensNaoProcessados.length} itens não processados`);

            // Mostrar tabela com itens empenhados
            this.renderizarTabelaItensEmpenhados();

            // Mostrar mensagem apropriada baseada no status dos itens
            if (itensJaProcessados.length > 0 && itensNaoProcessados.length > 0) {
                this.showToast(
                    `${this.itensEmpenhados.length} itens empenhados carregados ` +
                    `(${itensJaProcessados.length} já processados, ${itensNaoProcessados.length} pendentes). ` +
                    `Para os itens pendentes, faça o upload da lista final.`,
                    'success'
                );
            } else if (itensNaoProcessados.length > 0) {
                this.showToast(
                    `${itensNaoProcessados.length} itens empenhados carregados. Agora faça o upload da lista final.`,
                    'success'
                );
            } else {
                this.showToast(
                    `${itensJaProcessados.length} itens já processados anteriormente foram carregados. ` +
                    `Os dados mostrados refletem o processamento anterior.`,
                    'info'
                );
            }

        } catch (error) {
            console.error('❌ Erro ao carregar itens empenhados:', error);
            this.showToast('Erro ao carregar itens: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    calcularTotalEmpenhado(item) {
        if (!item.historicoEmpenhos || !Array.isArray(item.historicoEmpenhos)) {
            return 0;
        }

        const total = item.historicoEmpenhos.reduce((soma, empenho) => {
            const qtdeEstoque = empenho.qtdeEmpenhadaDoEstoque || 0;
            const qtdeRecebido = empenho.qtdeEmpenhadaDoRecebido || 0;
            return soma + qtdeEstoque + qtdeRecebido;
        }, 0);

        return total;
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processUploadedFile(file);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const file = event.dataTransfer.files[0];
        if (file) {
            this.processUploadedFile(file);
        }
    }

    processUploadedFile(file) {
        // Validar tipo de arquivo
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            this.showToast('Tipo de arquivo não suportado. Use CSV ou XLSX.', 'error');
            return;
        }

        this.uploadedFile = file;

        // Mostrar informações do arquivo
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.classList.remove('hidden');
        this.btnProcessarPlanilha.disabled = false;

        console.log('📁 Arquivo carregado:', file.name);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processarPlanilha() {
        if (!this.uploadedFile) {
            this.showToast('Nenhum arquivo selecionado', 'error');
            return;
        }

        try {
            this.showLoading('Processando planilha...');

            // Identificar itens não processados (precisam ser processados)
            const itensNaoProcessados = this.itensEmpenhados.filter(item => item.analiseFinalRealizada !== true);
            
            // Se não houver itens para processar, mostrar mensagem e não fazer nada
            if (itensNaoProcessados.length === 0) {
                this.showToast('Não há itens pendentes para processar. Todos os itens já foram analisados anteriormente.', 'info');
                return;
            }

            // Usar FileProcessor para ler o arquivo
            const fileProcessor = new FileProcessor();
            const result = await fileProcessor.processFile(this.uploadedFile);

            if (!result.success) {
                throw new Error(result.error || 'Erro ao processar arquivo');
            }

            // FileProcessor retorna um objeto com propriedade 'items'
            this.listaFinal = result.items || [];

            console.log(`✅ Lista final processada: ${this.listaFinal.length} itens`);
            console.log('📊 Lista final:', this.listaFinal.slice(0, 5)); // Mostrar apenas os primeiros 5

            if (result.errors && result.errors.length > 0) {
                console.warn(`⚠️ ${result.errors.length} erros encontrados:`, result.errors);
                this.showToast(`Arquivo processado com ${result.errors.length} avisos. Verifique o console.`, 'warning');
            }

            // Primeiro salvar as quantidades no Firebase
            await this.salvarQuantidadesNoFirebase();
            
            // Depois executar confronto
            this.executarConfronto();

        } catch (error) {
            console.error('❌ Erro ao processar planilha:', error);
            this.showToast('Erro ao processar planilha: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async salvarQuantidadesNoFirebase() {
        console.log('💾 Salvando quantidades do arquivo no Firebase...');
        
        try {
            const batch = this.db.batch();
            
            // Para cada item da lista final, salvar no Firebase
            this.listaFinal.forEach(itemFinal => {
                // Encontrar o item empenhado correspondente
                const itemEmpenhado = this.itensEmpenhados.find(emp => emp.codigo === itemFinal.codigo);
                
                if (itemEmpenhado) {
                    const itemRef = this.db.collection('itens').doc(itemEmpenhado.id);
                    batch.update(itemRef, {
                        qtdNecFinal: itemFinal.quantidade,
                        QtdItemNecFinal: itemFinal.quantidade
                    });
                    console.log(`💾 Salvando qtdNecFinal e QtdItemNecFinal para ${itemFinal.codigo}: ${itemFinal.quantidade}`);
                }
            });
            
            await batch.commit();
            console.log('✅ Quantidades salvas no Firebase');
            
            // Atualizar os dados locais dos itens empenhados
            this.itensEmpenhados.forEach(item => {
                const itemFinal = this.listaFinal.find(final => final.codigo === item.codigo);
                if (itemFinal) {
                    item.qtdNecFinal = itemFinal.quantidade;
                    item.QtdItemNecFinal = itemFinal.quantidade;
                }
            });
            
        } catch (error) {
            console.error('❌ Erro ao salvar quantidades no Firebase:', error);
            throw error;
        }
    }

    executarConfronto() {
        console.log('🔄 Executando confronto...');
        
        // Criar maps para facilitar busca
        const itensEmpenhadosMap = new Map();
        this.itensEmpenhados.forEach(item => {
            itensEmpenhadosMap.set(item.codigo, item);
        });

        const listaFinalMap = new Map();
        this.listaFinal.forEach(item => {
            listaFinalMap.set(item.codigo, item);
        });

        this.tabelaConfronto = [];

        // Cenário 1 e 2: Itens empenhados
        itensEmpenhadosMap.forEach((itemEmpenhado, codigo) => {
            // SEMPRE usar qtdNecFinal do Firebase
            const qtdNecessariaFinal = itemEmpenhado.qtdNecFinal || 0;
            
            // Cenário 2 e 3: Item existe em ambas as listas
            const diferenca = itemEmpenhado.totalEmpenhado - qtdNecessariaFinal;
            
            if (qtdNecessariaFinal === 0) {
                // Cenário 1: Item empenhado mas qtdNecFinal é 0 (não necessário)
                this.tabelaConfronto.push({
                    codigo: itemEmpenhado.codigo,
                    descricao: itemEmpenhado.descricao,
                    qtdEmpenhada: itemEmpenhado.totalEmpenhado,
                    qtdNecessaria: qtdNecessariaFinal,
                    diferenca: itemEmpenhado.totalEmpenhado,
                    cenario: 1,
                    acaoSugerida: 'Devolver ao Estoque',
                    itemEmpenhado: itemEmpenhado,
                    itemFinal: null
                });
            } else if (diferenca > 0) {
                // Cenário 2: Empenhado > Necessário
                this.tabelaConfronto.push({
                    codigo: itemEmpenhado.codigo,
                    descricao: itemEmpenhado.descricao,
                    qtdEmpenhada: itemEmpenhado.totalEmpenhado,
                    qtdNecessaria: qtdNecessariaFinal,
                    diferenca: diferenca,
                    cenario: 2,
                    acaoSugerida: `Devolver ${diferenca} unidades ao Estoque`,
                    itemEmpenhado: itemEmpenhado,
                    itemFinal: null
                });
            } else if (diferenca < 0) {
                // Cenário 3: Empenhado < Necessário
                this.tabelaConfronto.push({
                    codigo: itemEmpenhado.codigo,
                    descricao: itemEmpenhado.descricao,
                    qtdEmpenhada: itemEmpenhado.totalEmpenhado,
                    qtdNecessaria: qtdNecessariaFinal,
                    diferenca: diferenca,
                    cenario: 3,
                    acaoSugerida: `Gerar Compra Final de ${Math.abs(diferenca)} unidades`,
                    itemEmpenhado: itemEmpenhado,
                    itemFinal: null
                });
            } else {
                // Diferença = 0: Item ok, sem ação necessária
                this.tabelaConfronto.push({
                    codigo: itemEmpenhado.codigo,
                    descricao: itemEmpenhado.descricao,
                    qtdEmpenhada: itemEmpenhado.totalEmpenhado,
                    qtdNecessaria: qtdNecessariaFinal,
                    diferenca: 0,
                    cenario: 0,
                    acaoSugerida: 'Nenhuma ação necessária',
                    itemEmpenhado: itemEmpenhado,
                    itemFinal: null
                });
            }
        });

        // Cenário 4: Itens da lista final que não foram empenhados - NECESSIDADE DE COMPRA
        listaFinalMap.forEach((itemFinal, codigo) => {
            // Se o item da lista final NÃO existe nos itens empenhados
            if (!itensEmpenhadosMap.has(codigo)) {
                this.tabelaConfronto.push({
                    codigo: itemFinal.codigo,
                    descricao: itemFinal.descricao || `Item ${itemFinal.codigo}`,
                    qtdEmpenhada: 0,
                    qtdNecessaria: itemFinal.quantidade,
                    diferenca: -itemFinal.quantidade,
                    cenario: 4,
                    acaoSugerida: `Gerar Compra Final de ${itemFinal.quantidade} unidades`,
                    itemEmpenhado: null,
                    itemFinal: itemFinal
                });
                console.log(`📋 Cenário 4 - Item novo encontrado: ${codigo} (${itemFinal.quantidade} unidades)`);
            }
        });

        console.log(`✅ Confronto executado: ${this.tabelaConfronto.length} linhas geradas`);
        this.renderizarTabelaConfronto();
    }

    renderizarTabelaItensEmpenhados() {
        const tbody = document.getElementById('tabelaConfronto');
        tbody.innerHTML = '';

        // Renderizar os itens empenhados (mostrando qtdNecFinal se já existir)
        this.itensEmpenhados.forEach((item, index) => {
            // Verificar se o item já foi analisado anteriormente
            const jaAnalisado = item.analiseFinalRealizada === true;
            // CORREÇÃO: Verificar se qtdNecFinal existe e não é null/undefined
            const temQtdNecFinal = item.qtdNecFinal !== undefined && item.qtdNecFinal !== null;
            const qtdNecessaria = temQtdNecFinal ? item.qtdNecFinal : '-';
            const diferenca = temQtdNecFinal ? item.totalEmpenhado - item.qtdNecFinal : '-';
            
            // Debug removido - funcionando corretamente
            
            const tr = document.createElement('tr');
            
            // Para itens já analisados OU que já tenham qtdNecFinal, mostrar informações completas
            if (jaAnalisado || temQtdNecFinal) {
                const classDiferenca = diferenca > 0 ? 'difference-positive' : 
                                      diferenca < 0 ? 'difference-negative' : 
                                      diferenca === 0 ? 'difference-zero' : '';
                
                let acaoSugerida = 'Nenhuma ação necessária';
                let classeStatus = 'status-criar';
                
                if (diferenca > 0) {
                    acaoSugerida = `Devolver ${diferenca} unidades ao Estoque`;
                    classeStatus = 'status-devolver';
                } else if (diferenca < 0) {
                    acaoSugerida = `Gerar Compra Final de ${Math.abs(diferenca)} unidades`;
                    classeStatus = 'status-comprar';
                }
                
                tr.innerHTML = `
                    <td class="font-mono">${item.codigo}</td>
                    <td>${item.descricao}</td>
                    <td class="text-center">${item.totalEmpenhado}</td>
                    <td class="text-center">${qtdNecessaria}</td>
                    <td class="text-center ${classDiferenca}">
                        ${diferenca !== '-' ? diferenca : '-'}
                    </td>
                    <td>
                        <span class="status-badge ${classeStatus}">
                            ${acaoSugerida}
                        </span>
                    </td>
                    <td>
                        <span class="text-green-600 font-medium">✓ Já processado</span>
                    </td>
                `;
            } else {
                // Para itens não analisados, mostrar aguardando comparação
                tr.innerHTML = `
                    <td class="font-mono">${item.codigo}</td>
                    <td>${item.descricao}</td>
                    <td class="text-center">${item.totalEmpenhado}</td>
                    <td class="text-center text-gray-400">-</td>
                    <td class="text-center text-gray-400">-</td>
                    <td>
                        <span class="status-badge status-pendente">
                            Aguardando comparação
                        </span>
                    </td>
                    <td>
                        <span class="text-gray-400">Pendente</span>
                    </td>
                `;
            }
            
            tbody.appendChild(tr);
        });

        // Verificar se há itens já analisados OU com qtdNecFinal
        const itensJaAnalisados = this.itensEmpenhados.filter(item => 
            item.analiseFinalRealizada === true || (item.qtdNecFinal !== undefined && item.qtdNecFinal !== null)
        );
        const itensNaoAnalisados = this.itensEmpenhados.filter(item => 
            item.analiseFinalRealizada !== true && (item.qtdNecFinal === undefined || item.qtdNecFinal === null)
        );
        
        if (itensJaAnalisados.length > 0) {
            this.totalItensConfronto.textContent = `${this.itensEmpenhados.length} itens (${itensJaAnalisados.length} já processados, ${itensNaoAnalisados.length} pendentes)`;
        } else {
            this.totalItensConfronto.textContent = `${this.itensEmpenhados.length} itens empenhados`;
        }
        
        this.resultsSection.classList.remove('hidden');
        
        // Habilitar o botão de confirmar apenas se houver itens não analisados
        this.btnConfirmarTratamento.disabled = itensNaoAnalisados.length === 0;
        
        // Se tiver apenas itens já analisados, mostrar mensagem informativa
        if (itensNaoAnalisados.length === 0 && itensJaAnalisados.length > 0) {
            this.showToast('Todos os itens já foram processados anteriormente. Caso queira reprocessar, use a função de novo tratamento.', 'info');
            this.uploadSection.classList.add('hidden');
        } else {
            this.uploadSection.classList.remove('hidden');
        }
    }

    renderizarTabelaConfronto() {
        const tbody = document.getElementById('tabelaConfronto');
        tbody.innerHTML = '';

        this.tabelaConfronto.forEach((linha, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">${linha.codigo}</td>
                <td>${linha.descricao}</td>
                <td class="text-center">${linha.qtdEmpenhada}</td>
                <td class="text-center">${linha.qtdNecessaria}</td>
                <td class="text-center ${this.getClasseDiferenca(linha.diferenca)}">
                    ${linha.diferenca !== null ? linha.diferenca : 'N/A'}
                </td>
                <td>
                    <span class="status-badge ${this.getClasseStatus(linha.cenario)}">
                        ${linha.acaoSugerida}
                    </span>
                </td>
                <td>
                    ${this.renderizarBotaoAcao(linha, index)}
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.totalItensConfronto.textContent = `${this.tabelaConfronto.length} itens`;
        this.resultsSection.classList.remove('hidden');
        this.btnConfirmarTratamento.disabled = false;
    }

    getClasseDiferenca(diferenca) {
        if (diferenca === null) return '';
        if (diferenca > 0) return 'difference-positive';
        if (diferenca < 0) return 'difference-negative';
        return 'difference-zero';
    }

    getClasseStatus(cenario) {
        switch (cenario) {
            case 1:
            case 2:
                return 'status-devolver';
            case 3:
            case 4:
                return 'status-comprar';
            default:
                return 'status-criar';
        }
    }

    renderizarBotaoAcao(linha, index) {
        // Se o item já foi processado, mostrar um indicador visual
        if (linha.processada) {
            return '<span class="text-green-600 font-medium">✓ Processado</span>';
        }
        
        switch (linha.cenario) {
            case 1:
                return `<button class="btn btn-danger btn-sm" onclick="sistemaTratamento.executarAcao(${index})">Devolver</button>`;
            case 2:
                return `<button class="btn btn-warning btn-sm" onclick="sistemaTratamento.executarAcao(${index})">Devolver Diferença</button>`;
            case 3:
                return `<button class="btn btn-primary btn-sm" onclick="sistemaTratamento.executarAcao(${index})">Gerar Compra Final</button>`;
            case 4:
                return `<button class="btn btn-success btn-sm" onclick="sistemaTratamento.executarAcao(${index})">Criar e Comprar</button>`;
            default:
                return '<span class="text-green-600 font-medium">✓ OK</span>';
        }
    }

    async executarAcao(index) {
        const linha = this.tabelaConfronto[index];
        
        try {
            this.showLoading(`Executando ação: ${linha.acaoSugerida}`);

            switch (linha.cenario) {
                case 1:
                    await this.devolverAoEstoque(linha.itemEmpenhado, linha.qtdEmpenhada);
                    break;
                case 2:
                    await this.devolverDiferenca(linha.itemEmpenhado, linha.diferenca);
                    break;
                case 3:
                    await this.gerarCompraFinal(linha.itemEmpenhado, Math.abs(linha.diferenca));
                    break;
                case 4:
                    await this.criarItemEComprar(linha.itemFinal);
                    break;
            }

            // Marcar linha como processada
            linha.processada = true;
            this.renderizarTabelaConfronto();
            this.showToast('Ação executada com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro ao executar ação:', error);
            this.showToast('Erro ao executar ação: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async devolverAoEstoque(item, quantidade) {
        console.log(`🔄 Devolvendo ${quantidade} unidades do item ${item.codigo} ao estoque`);
        
        const batch = this.db.batch();
        const itemRef = this.db.collection('itens').doc(item.id);

        // Criar registro de devolução
        const devolucao = {
            qtde: quantidade,
            data: firebase.firestore.Timestamp.now(),
            motivo: 'Devolução por análise final',
            usuario: 'Sistema'
        };

        // Atualizar item
        batch.update(itemRef, {
            devolucaoEstoque: devolucao,
            statusItem: 'Disponível',
            analiseFinalRealizada: true,
            dataAnalise: firebase.firestore.Timestamp.now(),
            qtdNecFinal: 0, // Definir qtdNecFinal como 0 para devolução
            historicoEmpenhos: firebase.firestore.FieldValue.arrayUnion({
                tipo: 'devolucao',
                qtde: -quantidade,
                data: firebase.firestore.Timestamp.now(),
                motivo: 'Devolução por análise final'
            })
        });

        await batch.commit();
        console.log('✅ Devolução ao estoque executada');
    }

    async devolverDiferenca(item, diferenca) {
        console.log(`🔄 Devolvendo diferença de ${diferenca} unidades do item ${item.codigo}`);
        
        const batch = this.db.batch();
        const itemRef = this.db.collection('itens').doc(item.id);

        // Calcular a quantidade necessária final (total empenhado - diferença)
        const qtdNecessariaFinal = item.totalEmpenhado - diferenca;

        // Criar registro de devolução parcial
        const devolucao = {
            qtde: diferenca,
            data: firebase.firestore.Timestamp.now(),
            motivo: 'Devolução parcial por análise final',
            usuario: 'Sistema'
        };

        // Atualizar item
        batch.update(itemRef, {
            devolucaoEstoque: devolucao,
            statusItem: 'Separado para Produção', // Avança para próximo estágio
            analiseFinalRealizada: true,
            dataAnalise: firebase.firestore.Timestamp.now(),
            qtdNecFinal: qtdNecessariaFinal, // Salvar a quantidade necessária final
            historicoEmpenhos: firebase.firestore.FieldValue.arrayUnion({
                tipo: 'devolucao_parcial',
                qtde: -diferenca,
                data: firebase.firestore.Timestamp.now(),
                motivo: 'Devolução parcial por análise final'
            })
        });

        await batch.commit();
        console.log('✅ Devolução de diferença executada');
    }

    async gerarCompraFinal(item, quantidadeFaltante) {
        console.log(`🛒 Gerando compra final de ${quantidadeFaltante} unidades para ${item.codigo}`);
        
        const batch = this.db.batch();
        const itemRef = this.db.collection('itens').doc(item.id);

        // Atualizar item com campo de compra final
        batch.update(itemRef, {
            compraFinal: quantidadeFaltante,
            qtdNecFinal: quantidadeFaltante, // Salvar a quantidade necessária final no campo qtdNecFinal
            statusItem: 'Separado para Produção', // Avança para próximo estágio
            analiseFinalRealizada: true,
            precisaCompraFinal: true, // 🔧 NOVA FLAG: Indica que este item realmente precisa aparecer na tela de compra final
            dataAnalise: firebase.firestore.Timestamp.now(),
            historicoCompraFinal: firebase.firestore.FieldValue.arrayUnion({
                qtde: quantidadeFaltante,
                data: firebase.firestore.Timestamp.now(),
                motivo: 'Compra final por análise final',
                status: 'Pendente'
            })
        });

        await batch.commit();
        console.log('✅ Compra final gerada');
    }

    async criarItemEComprar(itemFinal) {
        console.log(`🆕 Criando novo item ${itemFinal.codigo} com compra final`);
        
        // Buscar dados do pedido atual para preencher campos obrigatórios
        const cliente = this.selectCliente.value;
        const projeto = this.selectProjeto.value;
        const lista = this.selectLista.value;

        const novoItem = {
            codigo: itemFinal.codigo,
            descricao: itemFinal.descricao || 'Item criado por análise final',
            quantidade: itemFinal.quantidade,
            cliente: cliente,
            tipoProjeto: projeto,
            listaMaterial: lista,
            statusItem: 'Separado para Produção',
            compraFinal: itemFinal.quantidade,
            qtdNecFinal: itemFinal.quantidade, // Salvar a quantidade necessária final no campo qtdNecFinal
            QtdItemNecFinal: itemFinal.quantidade, // Salvar a quantidade necessária final no campo QtdItemNecFinal
            criadoPorAnalise: true,
            analiseFinalRealizada: true,
            precisaCompraFinal: true, // 🔧 NOVA FLAG: Indica que este item realmente precisa aparecer na tela de compra final
            dataAnalise: firebase.firestore.Timestamp.now(),
            historicoCompraFinal: [{
                qtde: itemFinal.quantidade,
                data: firebase.firestore.Timestamp.now(),
                motivo: 'Item novo identificado em análise final',
                status: 'Pendente'
            }]
        };

        await this.db.collection('itens').add(novoItem);
        console.log('✅ Novo item criado com compra final');
    }

    async confirmarTratamento() {
        const itensProcessados = this.tabelaConfronto.filter(linha => linha.processada);
        const itensPendentes = this.tabelaConfronto.filter(linha => !linha.processada);

        if (itensPendentes.length > 0) {
            const confirmar = confirm(
                `Ainda há ${itensPendentes.length} itens pendentes de ação. ` +
                'Deseja confirmar o tratamento mesmo assim?'
            );
            if (!confirmar) return;
        }

        try {
            this.showLoading('Finalizando tratamento e salvando quantidades necessárias finais...');

            // Marcar todos os itens e salvar Qtd. Necessária (Final)
            const batch = this.db.batch();
            
            // Processar TODOS os itens da tabela de confronto (processados e pendentes)
            this.tabelaConfronto.forEach(linha => {
                if (linha.itemEmpenhado) {
                    const itemRef = this.db.collection('itens').doc(linha.itemEmpenhado.id);
                    
                    // Dados base para todos os itens
                    const updateData = {
                        analiseFinalRealizada: true,
                        dataAnalise: firebase.firestore.Timestamp.now()
                    };
                    
                    // Salvar Qtd. Necessária (Final) se o item tem correspondente na lista final
                    if (linha.itemFinal) {
                        updateData.qtdNecFinal = linha.qtdNecessaria;
                        updateData.motivoAnalise = `Quantidade necessária final definida: ${linha.qtdNecessaria}`;
                        console.log(`💾 Salvando Qtd. Necessária Final para ${linha.codigo}: ${linha.qtdNecessaria}`);
                    } else {
                        // Item empenhado mas não está na lista final
                        updateData.qtdNecFinal = 0;
                        updateData.motivoAnalise = 'Item não necessário na lista final';
                        console.log(`💾 Salvando Qtd. Necessária Final para ${linha.codigo}: 0 (não está na lista final)`);
                    }
                    
                    // Se o item foi processado individualmente, não sobrescrever o status
                    if (!linha.processada) {
                        updateData.motivoAnalise = updateData.motivoAnalise || 'Item analisado mas sem ação necessária';
                    }
                    
                    batch.update(itemRef, updateData);
                }
            });

            // Avançar todos os itens tratados para o próximo estágio (apenas os processados)
            itensProcessados.forEach(linha => {
                if (linha.itemEmpenhado && linha.cenario !== 1) { // Exceto devoluções completas
                    const itemRef = this.db.collection('itens').doc(linha.itemEmpenhado.id);
                    batch.update(itemRef, {
                        statusItem: 'Separado para Produção',
                        dataLiberacaoSeparacao: firebase.firestore.Timestamp.now()
                    });
                }
            });

            await batch.commit();
            
            console.log(`✅ Quantidades necessárias finais salvas para ${this.tabelaConfronto.length} itens`);

            // Mostrar mensagem com botão para novo tratamento
            this.showToast(
                `Tratamento confirmado! ${itensProcessados.length} itens processados, ${this.tabelaConfronto.length} quantidades necessárias finais salvas e itens liberados para separação.`,
                'success'
            );
            
            // Adicionar botão para novo tratamento
            const btnNovoTratamento = document.createElement('button');
            btnNovoTratamento.className = 'btn btn-primary mt-4';
            btnNovoTratamento.textContent = 'Iniciar Novo Tratamento';
            btnNovoTratamento.onclick = () => this.resetarInterface();
            
            // Verificar se já existe um botão e remover
            const existingBtn = document.querySelector('#btnNovoTratamento');
            if (existingBtn) existingBtn.remove();
            
            // Adicionar ID para fácil remoção posterior
            btnNovoTratamento.id = 'btnNovoTratamento';
            
            // Adicionar ao final da seção de resultados
            this.resultsSection.appendChild(btnNovoTratamento);
            
            // Resetar automaticamente após alguns segundos se o usuário não clicar no botão
            setTimeout(() => {
                if (document.querySelector('#btnNovoTratamento')) {
                    this.resetarInterface();
                }
            }, 10000);

        } catch (error) {
            console.error('❌ Erro ao confirmar tratamento:', error);
            this.showToast('Erro ao confirmar tratamento: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    showLoading(message = 'Carregando...') {
        this.loadingText.textContent = message;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    // Método para resetar a interface e permitir novo tratamento
    resetarInterface() {
        // Limpar dados de estado
        this.itensEmpenhados = [];
        this.listaFinal = [];
        this.tabelaConfronto = [];
        this.uploadedFile = null;
        
        // Resetar interface visual
        this.selectCliente.value = '';
        this.selectProjeto.innerHTML = '<option value="">Selecione um projeto</option>';
        this.selectProjeto.disabled = true;
        this.selectLista.innerHTML = '<option value="">Selecione uma lista</option>';
        this.selectLista.disabled = true;
        this.btnCarregarItens.disabled = true;
        
        // Esconder seções
        this.uploadSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        
        // Limpar informações do arquivo
        this.fileInfo.classList.add('hidden');
        this.fileName.textContent = '';
        this.fileSize.textContent = '';
        this.fileInput.value = '';
        
        // Desabilitar botões
        this.btnProcessarPlanilha.disabled = true;
        this.btnConfirmarTratamento.disabled = true;
        
        // Recarregar dados iniciais
        this.carregarDadosIniciais();
        
        this.showToast('Interface resetada. Você pode iniciar um novo tratamento.', 'info');
    }

    showToast(message, type = 'success') {
        // Remove toast anterior se existir
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Mostrar toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Remover toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Inicializar sistema quando a página carregar
let sistemaTratamento;
document.addEventListener('DOMContentLoaded', () => {
    sistemaTratamento = new SistemaTratamentoEmpenho();
});