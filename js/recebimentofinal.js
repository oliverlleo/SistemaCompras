/**
 * MÓDULO DE RECEBIMENTO FINAL - Sistema de Gerenciamento de Pedidos
 * 
 * Este módulo gerencia o processo de recebimento de materiais da compra final no almoxarifado.
 * Foi criado separadamente para não interferir com a lógica existente do recebimento regular.
 * 
 * Funcionalidades principais:
 * - Gerencia itens da compra final
 * - Integra com o calendário existente 
 * - Salva dados em coleção separada no Firebase
 * - Mantém integridade dos dados originais
 */

class RecebimentoFinalManager {
    constructor() {
        // Configuração Firebase
        this.firebaseConfig = {
            apiKey: "AIzaSyC38MEJFXKITFrrGkwxmyotgD1mCBVctc4",
            authDomain: "compras-e492e.firebaseapp.com",
            projectId: "compras-e492e",
            storageBucket: "compras-e492e.appspot.com",
            messagingSenderId: "687023054155",
            appId: "1:687023054155:web:4b4bb2b47eb2b2dc06d50a"
        };

        // Estado da aplicação
        this.itensPendentes = [];
        this.originalCarregarItensPendentes = null;
        this.originalRenderizarTabela = null;
        this.originalSalvarRecebimento = null;
        this.originalPreencherTabelaRecebimento = null;
        
        // Referência ao RecebimentoManager original
        this.recebimentoOriginal = null;
        
        this.init();
    }

    async init() {
        try {
            // Inicializar Firebase (reutiliza a instância existente)
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.db = firebase.firestore();
            
            // Aguardar o RecebimentoManager original ser inicializado
            this.aguardarRecebimentoOriginal();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar RecebimentoFinalManager:', error);
        }
    }

    /**
     * Aguarda o RecebimentoManager original ser inicializado
     */
    aguardarRecebimentoOriginal() {
        const tentarConectar = () => {
            this.recebimentoOriginal = window.recebimentoManager;
            
            if (this.recebimentoOriginal && this.recebimentoOriginal.db) {
                console.log('✅ RecebimentoManager original encontrado!');
                
                // Modificar a tabela para adicionar coluna de tipo de compra
                this.adicionarColunaTipo();
                
                // Estender funcionalidades
                this.estenderFuncionalidades();
                
                console.log('✅ RecebimentoFinalManager inicializado com sucesso');
                
            } else {
                console.log('⏳ Aguardando RecebimentoManager original...');
                // Tentar novamente em 200ms
                setTimeout(tentarConectar, 200);
            }
        };
        
        // Iniciar tentativas
        tentarConectar();
    }

    /**
     * Adiciona a coluna "Tipo" na tabela de recebimento
     */
    adicionarColunaTipo() {
        try {
            // Adicionar coluna de tipo na tabela principal
            const headerRow = document.querySelector('#tabelaContainer table thead tr');
            if (headerRow && !headerRow.querySelector('.tipo-coluna')) {
                const tipoColumn = document.createElement('th');
                tipoColumn.className = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider tipo-coluna';
                tipoColumn.textContent = 'Tipo';
                
                // Inserir antes da coluna de cliente (segunda posição)
                headerRow.insertBefore(tipoColumn, headerRow.children[1]);
                
                console.log('✅ Coluna de tipo adicionada na tabela principal');
            }
            
            // Adicionar coluna de tipo na tabela do modal de recebimento
            const modalTable = document.querySelector('#corpoTabelaRecebimento').closest('table');
            const modalHeaderRow = modalTable.querySelector('thead tr');
            if (modalHeaderRow && !modalHeaderRow.querySelector('.tipo-coluna-modal')) {
                const tipoModalColumn = document.createElement('th');
                tipoModalColumn.className = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider tipo-coluna-modal';
                tipoModalColumn.textContent = 'Tipo';
                
                // Inserir depois da coluna de código (primeira posição)
                modalHeaderRow.insertBefore(tipoModalColumn, modalHeaderRow.children[1]);
                
                console.log('✅ Coluna de tipo adicionada na tabela do modal');
            }
            
        } catch (error) {
            console.error('❌ Erro ao adicionar coluna de tipo:', error);
        }
    }

    /**
     * Estende as funcionalidades do RecebimentoManager original
     */
    estenderFuncionalidades() {
        console.log('🔧 Estendendo funcionalidades do RecebimentoManager...');
        
        // Salvar referências aos métodos originais
        this.originalCarregarItensPendentes = this.recebimentoOriginal.carregarItensPendentes.bind(this.recebimentoOriginal);
        this.originalRenderizarTabela = this.recebimentoOriginal.renderizarTabela.bind(this.recebimentoOriginal);
        this.originalSalvarRecebimento = this.recebimentoOriginal.salvarRecebimento.bind(this.recebimentoOriginal);
        this.originalPreencherTabelaRecebimento = this.recebimentoOriginal.preencherTabelaRecebimento.bind(this.recebimentoOriginal);

        // Substituir o método de carregar itens
        this.recebimentoOriginal.carregarItensPendentes = this.carregarItensCombinados.bind(this);
        console.log('🔄 Método carregarItensPendentes substituído');

        // Substituir o método de renderizar tabela
        this.recebimentoOriginal.renderizarTabela = this.renderizarTabelaComTipo.bind(this);
        console.log('🎨 Método renderizarTabela substituído');

        // Substituir o método de salvar recebimento
        this.recebimentoOriginal.salvarRecebimento = this.salvarRecebimentoDiferenciado.bind(this);
        console.log('💾 Método salvarRecebimento substituído');

        // Substituir o método de preencher tabela do modal
        this.recebimentoOriginal.preencherTabelaRecebimento = this.preencherTabelaModalComTipo.bind(this);
        console.log('📋 Método preencherTabelaRecebimento substituído');

        // 🔧 FORÇAR O PRIMEIRO CARREGAMENTO
        console.log('🚀 Forçando primeiro carregamento combinado...');
        setTimeout(() => {
            this.carregarItensCombinados();
        }, 500);

        console.log('✅ Funcionalidades estendidas com sucesso');
        
        // 🔧 ADICIONAR MÉTODOS DE DEBUG GLOBAIS
        window.debugRecebimentoFinal = () => {
            console.log('🐛 DEBUG RECEBIMENTO FINAL:');
            console.log('RecebimentoOriginal:', this.recebimentoOriginal);
            console.log('Itens pendentes:', this.recebimentoOriginal.itensPendentes);
            this.carregarItensCombinados();
        };
        
        window.criarItemTesteFinal = async () => {
            console.log('🧪 Criando item de teste para compra final...');
            try {
                const itemTeste = {
                    codigo: 'TESTE-FINAL-001',
                    descricao: 'Item de teste para recebimento final',
                    clienteNome: 'Cliente Teste',
                    tipoProjeto: 'Projeto Teste',
                    listaMaterial: 'Lista Teste',
                    fornecedor: 'Fornecedor Teste',
                    prazoEntrega: new Date().toISOString().split('T')[0],
                    qtdePendenteRecebimento: 10,
                    statusItem: 'Aguardando Recebimento Final',
                    dataUltimaAtualizacao: firebase.firestore.Timestamp.now(),
                    historicoCompraFinal: [{
                        dataCompra: firebase.firestore.Timestamp.now(),
                        fornecedor: 'Fornecedor Teste',
                        prazoEntrega: firebase.firestore.Timestamp.now(),
                        qtdeComprada: 10,
                        responsavel: 'Sistema Teste',
                        observacoes: 'Item criado para teste'
                    }]
                };
                
                const docRef = await this.db.collection('itens').add(itemTeste);
                console.log('✅ Item de teste criado com ID:', docRef.id);
                
                // Recarregar dados
                await this.carregarItensCombinados();
                
                return `Item de teste final criado com sucesso! ID: ${docRef.id}`;
                
            } catch (error) {
                console.error('❌ Erro ao criar item de teste:', error);
                return `Erro ao criar item: ${error.message}`;
            }
        };
        
        // Função para criar dados de demonstração finais
        window.criarDadosDemonstracaoFinal = async () => {
            console.log('🧪 Criando dados de demonstração para compra final...');
            try {
                const itensFinais = [
                    {
                        codigo: 'F001',
                        descricao: 'Janela 80x60cm',
                        clienteNome: 'Construtora Alfa',
                        tipoProjeto: 'Comercial',
                        listaMaterial: 'Acabamento',
                        fornecedor: 'Vidros & Janelas Ltda',
                        prazoEntrega: new Date().toISOString().split('T')[0],
                        qtdePendenteRecebimento: 5,
                        statusItem: 'Aguardando Recebimento Final',
                        dataUltimaAtualizacao: firebase.firestore.Timestamp.now(),
                        historicoCompraFinal: [{
                            dataCompra: firebase.firestore.Timestamp.now(),
                            fornecedor: 'Vidros & Janelas Ltda',
                            prazoEntrega: firebase.firestore.Timestamp.now(),
                            qtdeComprada: 5,
                            responsavel: 'Sistema',
                            observacoes: 'Dados de demonstração'
                        }]
                    },
                    {
                        codigo: 'F002',
                        descricao: 'Portas de madeira',
                        clienteNome: 'Construtora Beta',
                        tipoProjeto: 'Residencial',
                        listaMaterial: 'Acabamento',
                        fornecedor: 'Madeiras Brasil',
                        prazoEntrega: new Date().toISOString().split('T')[0],
                        qtdePendenteRecebimento: 8,
                        statusItem: 'Aguardando Recebimento Final',
                        dataUltimaAtualizacao: firebase.firestore.Timestamp.now(),
                        historicoCompraFinal: [{
                            dataCompra: firebase.firestore.Timestamp.now(),
                            fornecedor: 'Madeiras Brasil',
                            prazoEntrega: firebase.firestore.Timestamp.now(),
                            qtdeComprada: 8,
                            responsavel: 'Sistema',
                            observacoes: 'Dados de demonstração'
                        }]
                    }
                ];
                
                // Criar itens em batch
                const batch = this.db.batch();
                
                // Adicionar itens finais
                for (const item of itensFinais) {
                    const docRef = this.db.collection('itens').doc();
                    batch.set(docRef, item);
                }
                
                await batch.commit();
                console.log('✅ Dados de demonstração de compra final criados com sucesso!');
                
                // Recarregar dados
                await this.carregarItensCombinados();
                
                return `Dados de demonstração criados com sucesso! 2 itens de compra final foram adicionados.`;
            } catch (error) {
                console.error('❌ Erro ao criar dados de demonstração:', error);
                return `Erro ao criar dados: ${error.message}`;
            }
        };
        
        window.listarItensCompraFinal = async () => {
            console.log('📋 Listando todos os itens com compra final...');
            try {
                const snapshot = await this.db.collection('itens')
                    .where('historicoCompraFinal', '!=', null)
                    .get();
                    
                console.log(`📊 Encontrados ${snapshot.size} itens com historicoCompraFinal`);
                
                snapshot.docs.forEach((doc, index) => {
                    const item = doc.data();
                    console.log(`${index + 1}. ID: ${doc.id}`, {
                        codigo: item.codigo,
                        statusItem: item.statusItem,
                        qtdePendenteRecebimento: item.qtdePendenteRecebimento,
                        historicoCompraFinal: item.historicoCompraFinal?.length || 0
                    });
                });
                
            } catch (error) {
                console.error('❌ Erro ao listar itens:', error);
            }
        };
        
        // Disponibilizar o manager no escopo global para facilitar acesso
        window.recebimentoFinalManager = this;
        
        console.log('🐛 Métodos de debug disponíveis:');
        console.log('- window.debugRecebimentoFinal()');
        console.log('- window.criarItemTesteFinal()');
        console.log('- window.criarDadosDemonstracaoFinal()');
        console.log('- window.listarItensCompraFinal()');
    }

    /**
     * Carrega itens pendentes combinando compra inicial e final
     */
    async carregarItensCombinados() {
        try {
            console.log('🚀 Iniciando carregamento de itens combinados...');
            this.recebimentoOriginal.mostrarLoading();

            // Primeiro, carregar itens da compra inicial usando o método simplificado
            console.log('📦 Carregando itens da compra inicial...');
            await this.originalCarregarItensPendentes();
            console.log(`✅ ${this.recebimentoOriginal.itensPendentes.length} itens da compra inicial carregados`);

            // Marcar apenas os itens que ainda não têm tipoCompra como "Inicial"
            this.recebimentoOriginal.itensPendentes.forEach(item => {
                if (!item.tipoCompra) {
                    item.tipoCompra = 'Inicial';
                }
            });

            // Buscar itens da compra final
            console.log('🔍 Buscando itens da compra final...');
            const itensCompraFinal = await this.carregarItensCompraFinal();
            console.log(`✅ ${itensCompraFinal.length} itens da compra final encontrados`);

            // Combinar os arrays (preservar os itens de compra inicial)
            const totalAntes = this.recebimentoOriginal.itensPendentes.length;
            this.recebimentoOriginal.itensPendentes = [...this.recebimentoOriginal.itensPendentes, ...itensCompraFinal];
            const totalDepois = this.recebimentoOriginal.itensPendentes.length;
            
            console.log(`🔄 Combinação concluída: ${totalAntes} inicial + ${itensCompraFinal.length} final = ${totalDepois} total`);

            // Se não há itens, verificar se há dados de demonstração
            if (this.recebimentoOriginal.itensPendentes.length === 0) {
                console.log('⚠️ Nenhum item pendente encontrado. Sugerindo criar dados de demonstração...');
                const mensagemConsole = `
                    Para criar dados de demonstração, execute no console:
                    - window.criarDadosDemonstracao() - Itens de compra inicial
                    - window.criarDadosDemonstracaoFinal() - Itens de compra final
                `;
                console.log(mensagemConsole);
            }

            // Aplicar filtros e atualizar visualização
            console.log('🎨 Aplicando filtros e atualizando visualização...');
            this.recebimentoOriginal.aplicarFiltros();
            this.recebimentoOriginal.gerarCalendarioSemanal();

            this.recebimentoOriginal.esconderLoading();
            console.log('✅ Carregamento combinado concluído com sucesso!');

        } catch (error) {
            console.error('❌ Erro ao carregar itens combinados:', error);
            this.recebimentoOriginal.esconderLoading();
        }
    }

    /**
     * Carrega especificamente os itens da compra final
     */
    async carregarItensCompraFinal() {
        try {
            console.log('🔄 Carregando itens da compra final...');
            
            // 🔧 ESTRATÉGIA MÚLTIPLA DE BUSCA - buscar por diferentes campos
            
            // Primeira tentativa: itens com historicoCompraFinal
            let snapshot = await this.db.collection('itens')
                .where('historicoCompraFinal', '!=', null)
                .limit(1000)
                .get();
                
            console.log(`📊 Encontrados ${snapshot.size} itens com historicoCompraFinal`);

            const itensCompraFinal = [];

            for (const doc of snapshot.docs) {
                const item = doc.data();
                console.log(`🔍 Analisando item ${doc.id}:`, {
                    codigo: item.codigo,
                    historicoCompraFinal: item.historicoCompraFinal ? item.historicoCompraFinal.length : 'null',
                    qtdePendenteRecebimento: item.qtdePendenteRecebimento,
                    statusItem: item.statusItem
                });

                // Verificar se tem histórico de compra final
                if (Array.isArray(item.historicoCompraFinal) && item.historicoCompraFinal.length > 0) {
                    // Calcular quantidade total comprada e quantidade já recebida
                    let qtdeTotalComprada = 0;
                    let qtdeRecebida = 0;
                    
                    // Somar todas as quantidades compradas no histórico
                    item.historicoCompraFinal.forEach(compra => {
                        if (compra.qtdeComprada !== undefined && compra.qtdeComprada !== null) {
                            qtdeTotalComprada += compra.qtdeComprada;
                        } else if (compra.qtde !== undefined && compra.qtde !== null) {
                            qtdeTotalComprada += compra.qtde;
                        }
                    });
                    
                    // Calcular quantidade já recebida
                    if (item.historicoRecebimentos) {
                        item.historicoRecebimentos.forEach(rec => {
                            if (rec.tipoCompra === 'Final') {
                                qtdeRecebida += rec.qtde || rec.qtdeRecebida || 0;
                            }
                        });
                    }
                    
                    // Quantidade pendente = total comprada - já recebida
                    const qtdePendente = qtdeTotalComprada - qtdeRecebida;
                    console.log(`📦 Item ${item.codigo} - Qtde pendente: ${qtdePendente} (comprada: ${qtdeTotalComprada}, recebida: ${qtdeRecebida})`);

                    // Se já foi totalmente recebido, ignorar item
                    if (qtdePendente <= 0) {
                        console.log(`✅ Item ${item.codigo} - Totalmente recebido, não incluir na lista`);
                        continue;
                    }

                    if (qtdePendente > 0) {
                        // Buscar dados do pedido para obter cliente
                        let clienteNome = item.clienteNome || item.cliente || 'N/A';
                        let tipoProjeto = item.tipoProjeto || item.projetoNome || 'N/A';
                        
                        // Buscar dados do histórico de compra para preencher campos em falta
                        if (item.historicoCompraFinal.length > 0) {
                            const ultimaCompra = item.historicoCompraFinal[item.historicoCompraFinal.length - 1];
                            
                            // Se não tem prazo de entrega, usar da compra final
                            if (!item.prazoEntrega && ultimaCompra.prazoEntrega) {
                                try {
                                    // Verificar se prazoEntrega é um timestamp do Firebase ou uma string de data
                                    const prazoDate = typeof ultimaCompra.prazoEntrega.toDate === 'function' 
                                        ? ultimaCompra.prazoEntrega.toDate() 
                                        : new Date(ultimaCompra.prazoEntrega);
                                    item.prazoEntrega = prazoDate.toISOString().split('T')[0];
                                } catch (e) {
                                    console.warn('⚠️ Erro ao converter prazoEntrega:', e);
                                }
                            }
                            
                            // Se não tem fornecedor, usar da compra final
                            if (!item.fornecedor && ultimaCompra.fornecedor) {
                                item.fornecedor = ultimaCompra.fornecedor;
                            }
                        }

                        if (item.pedidoId && clienteNome === 'N/A') {
                            try {
                                const pedidoDoc = await this.db.collection('pedidos').doc(item.pedidoId).get();
                                if (pedidoDoc.exists) {
                                    const pedidoData = pedidoDoc.data();
                                    clienteNome = pedidoData.clienteNome || clienteNome;
                                    tipoProjeto = pedidoData.tipoProjeto || tipoProjeto;
                                }
                            } catch (error) {
                                console.warn('⚠️ Erro ao buscar dados do pedido:', error);
                            }
                        }

                        // Adicionar marcador de tipo
                        const itemEnriquecido = {
                            id: doc.id,
                            ...item,
                            qtdePendenteRecebimento: qtdePendente,
                            clienteNome,
                            tipoProjeto,
                            tipoCompra: 'Final' // Marcar como compra final
                        };

                        itensCompraFinal.push(itemEnriquecido);
                        console.log(`✅ Item ${item.codigo} adicionado à lista de recebimento final`);
                    } else {
                        console.log(`⚠️ Item ${item.codigo} ignorado - quantidade pendente é 0`);
                    }
                } else {
                    console.log(`⚠️ Item ${doc.id} ignorado - sem histórico de compra final válido`);
                }
            }
            
            // 🔧 SE NÃO ENCONTROU NADA, TENTAR BUSCA ALTERNATIVA
            if (itensCompraFinal.length === 0) {
                console.log('🔄 Tentando busca alternativa por statusItem...');
                snapshot = await this.db.collection('itens')
                    .where('statusItem', '==', 'Aguardando Recebimento Final')
                    .limit(1000)
                    .get();
                    
                console.log(`📊 Encontrados ${snapshot.size} itens com status 'Aguardando Recebimento Final'`);
                
                for (const doc of snapshot.docs) {
                    const item = doc.data();
                    
                    let qtdePendente = item.qtdePendenteRecebimento || 0;
                    if (qtdePendente === 0 && item.historicoCompraFinal && item.historicoCompraFinal.length > 0) {
                        const ultimaCompra = item.historicoCompraFinal[item.historicoCompraFinal.length - 1];
                        // Verificar se realmente existe qtdeComprada ou qtde antes de atribuir
                        if (ultimaCompra.qtdeComprada !== undefined && ultimaCompra.qtdeComprada !== null) {
                            qtdePendente = ultimaCompra.qtdeComprada;
                        } else if (ultimaCompra.qtde !== undefined && ultimaCompra.qtde !== null) {
                            qtdePendente = ultimaCompra.qtde;
                        } else {
                            qtdePendente = 0;
                        }
                    }
                    
                    if (qtdePendente > 0) {
                        const itemEnriquecido = {
                            id: doc.id,
                            ...item,
                            qtdePendenteRecebimento: qtdePendente,
                            clienteNome: item.clienteNome || item.cliente || 'N/A',
                            tipoProjeto: item.tipoProjeto || item.projetoNome || 'N/A',
                            tipoCompra: 'Final'
                        };
                        
                        itensCompraFinal.push(itemEnriquecido);
                        console.log(`✅ Item ${item.codigo} adicionado via busca alternativa`);
                    }
                }
            }

            console.log(`✅ Total final: ${itensCompraFinal.length} itens de compra final carregados`);
            return itensCompraFinal;

        } catch (error) {
            console.error('❌ Erro ao carregar itens da compra final:', error);
            return [];
        }
    }

    /**
     * Renderiza a tabela incluindo a coluna de tipo
     */
    renderizarTabelaComTipo(itens) {
        const tbody = document.getElementById('corpoTabela');
        const tabelaContainer = document.getElementById('tabelaContainer');
        const estadoVazio = document.getElementById('estadoVazio');

        if (itens.length === 0) {
            tabelaContainer.classList.add('hidden');
            estadoVazio.classList.remove('hidden');
            return;
        }

        estadoVazio.classList.add('hidden');
        tabelaContainer.classList.remove('hidden');

        // Ordenar por prazo de entrega (mais próximo primeiro)
        itens.sort((a, b) => {
            const dataA = new Date(a.prazoEntrega || '9999-12-31');
            const dataB = new Date(b.prazoEntrega || '9999-12-31');
            return dataA - dataB;
        });

        tbody.innerHTML = '';

        itens.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Destacar itens atrasados ou com entrega hoje
            const hoje = new Date().toISOString().split('T')[0];
            const isAtrasado = item.prazoEntrega < hoje;
            const isHoje = item.prazoEntrega === hoje;

            if (isAtrasado) {
                tr.className = 'hover:bg-red-50 bg-red-25';
            } else if (isHoje) {
                tr.className = 'hover:bg-yellow-50 bg-yellow-25';
            } else {
                tr.className = 'hover:bg-gray-50';
            }

            // Determinar tipo de compra
            const tipoCompra = item.tipoCompra || 'Inicial';
            const tipoClass = tipoCompra === 'Final' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <input type="checkbox" class="item-checkbox rounded" data-index="${index}">
                </td>
                <td class="px-4 py-3 text-sm font-medium">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoClass}">
                        ${tipoCompra}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                    ${item.clienteNome}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.codigo || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.produtoDescricao || item.descricao || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">
                    ${this.recebimentoOriginal.formatarQuantidade(item.qtdePendenteRecebimento)}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.fornecedor || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.tipoProjeto}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.listaMaterial || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isAtrasado ? 'bg-red-100 text-red-800' : 
                        isHoje ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                    }">
                        ${this.recebimentoOriginal.formatarData(item.prazoEntrega)}
                    </span>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Event listeners para checkboxes
        tbody.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.recebimentoOriginal.onItemSelecionado();
            });
        });

        this.recebimentoOriginal.itensFiltrados = itens;
    }

    /**
     * Preenche a tabela do modal incluindo a coluna de tipo
     */
    preencherTabelaModalComTipo() {
        const tbody = document.getElementById('corpoTabelaRecebimento');
        tbody.innerHTML = '';

        this.recebimentoOriginal.itensSelecionados.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';

            // Determinar tipo de compra
            const tipoCompra = item.tipoCompra || 'Inicial';
            const tipoClass = tipoCompra === 'Final' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';

            tr.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                    ${item.codigo || 'N/A'}
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoClass}">
                        ${tipoCompra}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    ${item.produtoDescricao || item.descricao || 'N/A'}
                </td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">
                    ${this.recebimentoOriginal.formatarQuantidade(item.qtdePendenteRecebimento)}
                </td>
                <td class="px-4 py-3">
                    <input type="number" 
                           class="w-24 px-2 py-1 border border-gray-300 rounded text-sm qtd-recebida"
                           placeholder="${item.qtdePendenteRecebimento}"
                           min="0"
                           step="0.01"
                           data-item-index="${index}"
                           value="${item.qtdePendenteRecebimento}">
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    /**
     * Salva recebimentos diferenciando entre inicial e final
     */
    async salvarRecebimentoDiferenciado() {
        try {
            // Validações
            const dataRecebimento = document.getElementById('dataRecebimento').value;
            const numeroNotaFiscal = document.getElementById('numeroNotaFiscal').value.trim();

            if (!dataRecebimento) {
                alert('Por favor, informe a data do recebimento.');
                return;
            }

            if (!numeroNotaFiscal) {
                alert('Por favor, informe o número da nota fiscal.');
                return;
            }

            // Coletar quantidades recebidas
            const inputs = document.querySelectorAll('.qtd-recebida');
            const recebimentosInicial = [];
            const recebimentosFinal = [];

            for (const input of inputs) {
                const index = parseInt(input.dataset.itemIndex);
                const item = this.recebimentoOriginal.itensSelecionados[index];
                const qtdRecebida = parseFloat(input.value) || 0;

                if (qtdRecebida <= 0) {
                    alert(`Quantidade inválida para o item ${item.codigo}`);
                    return;
                }

                // Separar por tipo de compra
                if (item.tipoCompra === 'Final') {
                    recebimentosFinal.push({
                        item,
                        qtdRecebida
                    });
                } else {
                    recebimentosInicial.push({
                        item,
                        qtdRecebida
                    });
                }
            }

            // Mostrar loading
            this.recebimentoOriginal.mostrarLoading();

            // Executar batch update
            const batch = this.db.batch();
            const agora = new Date();

            // Processar recebimentos iniciais (usar método original para estes)
            for (const recebimento of recebimentosInicial) {
                this.processarRecebimentoInicial(batch, recebimento, dataRecebimento, numeroNotaFiscal, agora);
            }

            // Processar recebimentos finais (nova lógica)
            for (const recebimento of recebimentosFinal) {
                this.processarRecebimentoFinal(batch, recebimento, dataRecebimento, numeroNotaFiscal, agora);
            }

            await batch.commit();

            // Feedback e limpeza
            this.recebimentoOriginal.esconderLoading();
            alert(`Recebimento registrado com sucesso! ${recebimentosInicial.length + recebimentosFinal.length} itens processados.`);

            this.recebimentoOriginal.fecharModalRecebimento();
            await this.carregarItensCombinados(); // Recarregar os dados combinados

        } catch (error) {
            console.error('Erro ao salvar recebimento:', error);
            this.recebimentoOriginal.esconderLoading();
            alert('Erro ao salvar recebimento. Tente novamente.');
        }
    }

    /**
     * Processa recebimento inicial (lógica original)
     */
    processarRecebimentoInicial(batch, recebimento, dataRecebimento, numeroNotaFiscal, agora) {
        const { item, qtdRecebida } = recebimento;

        // Calcular nova quantidade pendente
        const novaQtdePendente = Math.max(0, item.qtdePendenteRecebimento - qtdRecebida);

        // Determinar status
        let novoStatus;
        if (qtdRecebida > item.qtdePendenteRecebimento) {
            novoStatus = 'Recebido com Divergência';
        } else if (novaQtdePendente === 0) {
            novoStatus = 'Recebido Completo';
        } else {
            novoStatus = 'Recebimento Parcial';
        }

        // Criar entrada do histórico
        const historicoRecebimento = {
            data: agora.toISOString(),
            notaFiscal: numeroNotaFiscal,
            qtde: qtdRecebida,
            status: novoStatus,
            qtdePendenteAnterior: item.qtdePendenteRecebimento,
            qtdePendenteNova: Math.max(0, novaQtdePendente)
        };

        // Preparar atualização
        const docRef = this.db.collection('itens').doc(item.id);
        const updateData = {
            qtdePendenteRecebimento: Math.max(0, novaQtdePendente),
            statusItem: novoStatus,
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
            historicoRecebimentos: firebase.firestore.FieldValue.arrayUnion(historicoRecebimento)
        };

        batch.update(docRef, updateData);
    }

    /**
     * Processa recebimento final (nova lógica)
     */
    processarRecebimentoFinal(batch, recebimento, dataRecebimento, numeroNotaFiscal, agora) {
        const { item, qtdRecebida } = recebimento;

        // Calcular nova quantidade pendente
        const novaQtdePendente = Math.max(0, item.qtdePendenteRecebimento - qtdRecebida);

        // Determinar status
        let novoStatus;
        if (qtdRecebida > item.qtdePendenteRecebimento) {
            novoStatus = 'Recebido com Divergência';
        } else if (novaQtdePendente === 0) {
            novoStatus = 'Recebido Completo';
        } else {
            novoStatus = 'Recebimento Parcial';
        }

        // Criar documento na coleção recebimentofinal
        const recebimentoFinalDoc = {
            itemId: item.id,
            codigo: item.codigo,
            descricao: item.descricao || item.produtoDescricao,
            clienteNome: item.clienteNome,
            projetoNome: item.projetoNome || item.tipoProjeto,
            listaMaterial: item.listaMaterial,
            fornecedor: item.fornecedor,
            dataRecebimento: firebase.firestore.Timestamp.fromDate(new Date(dataRecebimento)),
            notaFiscal: numeroNotaFiscal,
            qtdeRecebida: qtdRecebida,
            qtdePendenteAnterior: item.qtdePendenteRecebimento,
            qtdePendenteNova: novaQtdePendente,
            status: novoStatus,
            dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Adicionar documento à coleção recebimentofinal
        const recebimentoFinalRef = this.db.collection('recebimentofinal').doc();
        batch.set(recebimentoFinalRef, recebimentoFinalDoc);

        // Atualizar item original (apenas para manter o status)
        const docRef = this.db.collection('itens').doc(item.id);
        const historicoRecebimento = {
            data: agora.toISOString(),
            notaFiscal: numeroNotaFiscal,
            qtde: qtdRecebida,
            status: novoStatus,
            tipoCompra: 'Final',
            qtdePendenteAnterior: item.qtdePendenteRecebimento,
            qtdePendenteNova: Math.max(0, novaQtdePendente)
        };

        // Preparar atualização
        const updateData = {
            qtdePendenteRecebimento: Math.max(0, novaQtdePendente),
            statusItem: novoStatus,
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
            historicoRecebimentos: firebase.firestore.FieldValue.arrayUnion(historicoRecebimento)
        };

        batch.update(docRef, updateData);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Iniciar após um pequeno delay para garantir que o RecebimentoManager já foi inicializado
    setTimeout(() => {
        window.recebimentoFinalManager = new RecebimentoFinalManager();
    }, 1000);
});