/**
 * MÓDULO DE RECEBIMENTO - Sistema de Gerenciamento de Pedidos
 * 
 * Este módulo gerencia o processo de recebimento de materiais no almoxarifado.
 * Funcionalidades principais:
 * - Calendário semanal/mensal de entregas
 * - Filtros avançados para busca
 * - Gestão de itens pendentes de recebimento
 * - Registro de recebimentos com histórico
 * - Atualização automática de quantidades pendentes
 */

class RecebimentoManager {
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
        this.itensSelecionados = [];
        this.filtrosAtivos = {};
        this.mesAtual = new Date();
        
        this.init();
    }

    async init() {
        try {
            // Inicializar Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.db = firebase.firestore();
            
            // Habilitar persistência offline
            await this.db.enablePersistence().catch(err => {
                console.warn('Persistência offline não disponível:', err);
            });

            // Configurar event listeners
            this.setupEventListeners();
            
            // Carregar dados iniciais
            await this.carregarItensPendentes();
            this.gerarCalendarioSemanal();
            
            console.log('Recebimento Manager inicializado com sucesso');
            
            // Adicionar funções de teste para criar itens de demonstração
            window.criarItemTesteInicial = async () => {
                try {
                    console.log('🧪 Criando item de teste para compra inicial...');
                    
                    const itemTeste = {
                        codigo: 'TESTE-INICIAL-001',
                        descricao: 'Item de teste para recebimento inicial',
                        clienteNome: 'Cliente Teste',
                        tipoProjeto: 'Projeto Teste',
                        listaMaterial: 'Lista Teste',
                        fornecedor: 'Fornecedor Teste',
                        prazoEntrega: new Date().toISOString().split('T')[0],
                        qtdeComprada: 5,
                        qtdePendenteRecebimento: 5,
                        statusItem: 'Aguardando Recebimento',
                        dataUltimaAtualizacao: firebase.firestore.Timestamp.now(),
                        ordemCompra: {
                            numeroOC: `OC-${Date.now()}`,
                            dataCompra: new Date().toISOString(),
                            cliente: 'Cliente Teste',
                            tipoProjeto: 'Projeto Teste',
                            listaMaterial: 'Lista Teste',
                            fornecedor: 'Fornecedor Teste',
                            prazoEntrega: new Date().toISOString().split('T')[0]
                        }
                    };
                    
                    const docRef = await this.db.collection('itens').add(itemTeste);
                    console.log('✅ Item de teste de compra inicial criado com ID:', docRef.id);
                    
                    // Recarregar dados
                    await this.carregarItensPendentes();
                    
                    // Recarregamento completo para exibir o item
                    if (window.recebimentoFinalManager) {
                        await window.recebimentoFinalManager.carregarItensCombinados();
                    }
                    
                    return `Item de teste criado com sucesso! ID: ${docRef.id}`;
                } catch (error) {
                    console.error('❌ Erro ao criar item de teste:', error);
                    return `Erro ao criar item: ${error.message}`;
                }
            };
            
            // Adicionar função para criar múltiplos itens de demonstração
            window.criarDadosDemonstracao = async () => {
                try {
                    console.log('🧪 Criando dados de demonstração de compra inicial...');
                    
                    // Criar 3 itens de compra inicial com a estrutura correta do módulo de gestão de compras
                    const itensPendentes = [
                        {
                            codigo: 'INICIAL-001',
                            descricao: 'Ferro de construção 12mm',
                            produtoDescricao: 'Ferro de construção 12mm',
                            clienteNome: 'Construtora Alfa',
                            tipoProjeto: 'Comercial',
                            listaMaterial: 'Estrutura',
                            fornecedor: 'Ferro & Aço Ltda',
                            prazoEntrega: new Date().toISOString().split('T')[0],
                            qtdeComprada: 50, // Quantidade já comprada
                            qtdePendenteRecebimento: 50, // Quantidade pendente de recebimento
                            quantidadeComprar: 0, // Não precisa mais comprar
                            statusItem: 'Comprado',
                            pedidoId: 'DEMO-PEDIDO-001',
                            ordemCompra: {
                                numeroOC: `OC-${Date.now()}-001`,
                                dataCompra: new Date().toISOString(),
                                cliente: 'Construtora Alfa',
                                tipoProjeto: 'Comercial',
                                listaMaterial: 'Estrutura',
                                fornecedor: 'Ferro & Aço Ltda',
                                prazoEntrega: new Date().toISOString().split('T')[0]
                            },
                            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            codigo: 'INICIAL-002',
                            descricao: 'Cimento Portland 50kg',
                            produtoDescricao: 'Cimento Portland 50kg',
                            clienteNome: 'Construtora Beta',
                            tipoProjeto: 'Residencial',
                            listaMaterial: 'Estrutura',
                            fornecedor: 'Materiais Brasil',
                            prazoEntrega: new Date().toISOString().split('T')[0],
                            qtdeComprada: 100,
                            qtdePendenteRecebimento: 100,
                            quantidadeComprar: 0,
                            statusItem: 'Comprado',
                            pedidoId: 'DEMO-PEDIDO-002',
                            ordemCompra: {
                                numeroOC: `OC-${Date.now()}-002`,
                                dataCompra: new Date().toISOString(),
                                cliente: 'Construtora Beta',
                                tipoProjeto: 'Residencial',
                                listaMaterial: 'Estrutura',
                                fornecedor: 'Materiais Brasil',
                                prazoEntrega: new Date().toISOString().split('T')[0]
                            },
                            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            codigo: 'INICIAL-003',
                            descricao: 'Areia Fina - Saco 20kg',
                            produtoDescricao: 'Areia Fina - Saco 20kg',
                            clienteNome: 'Construtora Gama',
                            tipoProjeto: 'Comercial',
                            listaMaterial: 'Acabamento',
                            fornecedor: 'Areial Brasil',
                            prazoEntrega: new Date().toISOString().split('T')[0],
                            qtdeComprada: 75,
                            qtdePendenteRecebimento: 75,
                            quantidadeComprar: 0,
                            statusItem: 'Comprado',
                            pedidoId: 'DEMO-PEDIDO-003',
                            ordemCompra: {
                                numeroOC: `OC-${Date.now()}-003`,
                                dataCompra: new Date().toISOString(),
                                cliente: 'Construtora Gama',
                                tipoProjeto: 'Comercial',
                                listaMaterial: 'Acabamento',
                                fornecedor: 'Areial Brasil',
                                prazoEntrega: new Date().toISOString().split('T')[0]
                            },
                            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    ];
                    
                    // Criar itens em batch
                    const batch = this.db.batch();
                    
                    // Adicionar itens iniciais
                    for (const item of itensPendentes) {
                        const docRef = this.db.collection('itens').doc();
                        batch.set(docRef, item);
                    }
                    
                    await batch.commit();
                    console.log('✅ Dados de demonstração de compra inicial criados com sucesso!');
                    
                    // Recarregar dados
                    if (window.recebimentoFinalManager) {
                        await window.recebimentoFinalManager.carregarItensCombinados();
                    } else {
                        await this.carregarItensPendentes();
                    }
                    
                    return `Dados de demonstração criados com sucesso! 3 itens de compra inicial foram adicionados.`;
                } catch (error) {
                    console.error('❌ Erro ao criar dados de demonstração:', error);
                    return `Erro ao criar dados: ${error.message}`;
                }
            };
            
            // Função para criar dados de teste de compra final
            window.criarDadosCompraFinal = async () => {
                console.log('🧪 Criando dados de teste para compra final...');
                try {
                    const itensCompraFinal = [
                        {
                            codigo: 'FINAL-001',
                            descricao: 'Janela de Alumínio 120x100cm',
                            produtoDescricao: 'Janela de Alumínio 120x100cm',
                            cliente: 'Construtora Alpha',
                            clienteNome: 'Construtora Alpha',
                            tipoProjeto: 'Residencial',
                            listaMaterial: 'Esquadria',
                            fornecedor: 'AlumínioMax',
                            prazoEntrega: new Date().toISOString().split('T')[0],
                            analiseFinalRealizada: true,
                            compraFinal: 5,
                            criadoPorAnalise: true,
                            dataAnalise: firebase.firestore.Timestamp.now(),
                            historicoCompraFinal: [
                                {
                                    data: firebase.firestore.Timestamp.now(),
                                    motivo: 'Item novo identificado em análise final',
                                    qtde: 3,
                                    status: 'Pendente'
                                },
                                {
                                    dataCompra: firebase.firestore.Timestamp.now(),
                                    fornecedor: 'AlumínioMax',
                                    observacoes: 'Compra final realizada via sistema',
                                    prazoEntrega: firebase.firestore.Timestamp.now(),
                                    qtdeComprada: 2,
                                    responsavel: 'Sistema',
                                    status: 'Pendente'
                                }
                            ],
                            statusItem: 'Aguardando Recebimento Final',
                            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            codigo: 'FINAL-002',
                            descricao: 'Porta de Madeira Maciça',
                            produtoDescricao: 'Porta de Madeira Maciça',
                            cliente: 'Construtora Beta',
                            clienteNome: 'Construtora Beta',
                            tipoProjeto: 'Comercial',
                            listaMaterial: 'Acabamento',
                            fornecedor: 'Madeiras Premium',
                            prazoEntrega: new Date().toISOString().split('T')[0],
                            analiseFinalRealizada: true,
                            compraFinal: 8,
                            criadoPorAnalise: true,
                            dataAnalise: firebase.firestore.Timestamp.now(),
                            historicoCompraFinal: [
                                {
                                    data: firebase.firestore.Timestamp.now(),
                                    motivo: 'Item novo identificado em análise final',
                                    qtde: 3,
                                    status: 'Pendente'
                                },
                                {
                                    dataCompra: firebase.firestore.Timestamp.now(),
                                    fornecedor: 'Rehau',
                                    observacoes: 'Compra final realizada via sistema',
                                    prazoEntrega: firebase.firestore.Timestamp.now(),
                                    qtdeComprada: 5,
                                    responsavel: 'Sistema',
                                    status: 'Pendente'
                                }
                            ],
                            statusItem: 'Aguardando Recebimento Final',
                            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    ];
                    
                    // Criar itens em batch
                    const batch = this.db.batch();
                    
                    // Adicionar itens de compra final
                    for (const item of itensCompraFinal) {
                        const docRef = this.db.collection('itens').doc();
                        batch.set(docRef, item);
                    }
                    
                    await batch.commit();
                    console.log('✅ Dados de demonstração de compra final criados com sucesso!');
                    
                    // Recarregar dados
                    await this.carregarItensPendentes();
                    
                    return `Dados de compra final criados com sucesso! 2 itens foram adicionados.`;
                } catch (error) {
                    console.error('❌ Erro ao criar dados de compra final:', error);
                    return `Erro ao criar dados: ${error.message}`;
                }
            };

            // Função para testar integração completa
            window.testarIntegracaoCompleta = async () => {
                console.log('🧪 Testando integração completa...');
                try {
                    // Limpar dados existentes
                    console.log('🧹 Limpando dados existentes...');
                    
                    // Criar dados de demonstração para compra inicial
                    await window.criarDadosDemonstracao();
                    
                    console.log('✅ Teste de integração completo finalizado!');
                    console.log('📊 Verifique a tabela para ver itens de compra inicial');
                    
                    return 'Teste completo finalizado! Verifique a tabela de recebimento.';
                } catch (error) {
                    console.error('❌ Erro no teste de integração:', error);
                    return `Erro no teste: ${error.message}`;
                }
            };

            console.log('🧪 Funções de teste disponíveis:');
            console.log('1. window.criarItemTesteInicial() - Cria um item individual');
            console.log('2. window.criarDadosDemonstracao() - Cria 3 itens de demonstração de compra inicial');
            console.log('3. window.testarIntegracaoCompleta() - Testa integração completa');
            
        } catch (error) {
            console.error('Erro ao inicializar Recebimento Manager:', error);
            this.mostrarErro('Erro ao conectar com o banco de dados');
        }
    }

    setupEventListeners() {
        // Botão voltar
        document.getElementById('btnVoltar').addEventListener('click', () => {
            window.location.href = './index.html';
        });

        // Calendário
        document.getElementById('btnCalendarioCompleto').addEventListener('click', () => {
            this.abrirModalCalendario();
        });

        document.getElementById('btnFecharModalCalendario').addEventListener('click', () => {
            this.fecharModalCalendario();
        });

        document.getElementById('btnMesAnterior').addEventListener('click', () => {
            this.navegarMes(-1);
        });

        document.getElementById('btnMesProximo').addEventListener('click', () => {
            this.navegarMes(1);
        });

        // Filtros
        document.getElementById('btnLimparFiltros').addEventListener('click', () => {
            this.limparFiltros();
        });

        // Event listeners para filtros em tempo real
        const campos = ['filtroCliente', 'filtroCodigo', 'filtroFornecedor', 'filtroTipoProjeto', 
                       'filtroListaMaterial', 'filtroDataDe', 'filtroDataAte'];
        
        campos.forEach(campoId => {
            const elemento = document.getElementById(campoId);
            if (elemento) {
                elemento.addEventListener('input', () => this.aplicarFiltros());
                elemento.addEventListener('change', () => this.aplicarFiltros());
            }
        });

        // Modal de detalhes do fornecedor
        document.getElementById('btnFecharModalDetalhesFornecedor').addEventListener('click', () => {
            this.fecharModalDetalhesFornecedor();
        });

        document.getElementById('btnFecharModalDetalhesFornecedor2').addEventListener('click', () => {
            this.fecharModalDetalhesFornecedor();
        });

        // Seleção
        document.getElementById('btnSelecionarTodos').addEventListener('click', () => {
            this.toggleSelecionarTodos();
        });

        document.getElementById('checkboxMaster').addEventListener('change', (e) => {
            this.selecionarTodos(e.target.checked);
        });

        // Recebimento
        document.getElementById('btnRegistrarRecebimento').addEventListener('click', () => {
            this.abrirModalRecebimento();
        });

        document.getElementById('btnFecharModalRecebimento').addEventListener('click', () => {
            this.fecharModalRecebimento();
        });

        document.getElementById('btnCancelarRecebimento').addEventListener('click', () => {
            this.fecharModalRecebimento();
        });

        document.getElementById('btnSalvarRecebimento').addEventListener('click', () => {
            this.salvarRecebimento();
        });
    }

    // ============================================================================
    // CARREGAMENTO DE DADOS
    // ============================================================================

    async carregarItensPendentes() {
        try {
            this.mostrarLoading();
            console.log('🔍 Carregando itens pendentes de recebimento (compra inicial + compra final)...');

            this.itensPendentes = [];

            // Carregar itens da compra inicial
            await this.carregarItensCompraInicial();

            console.log(`✅ Total de itens carregados: ${this.itensPendentes.length}`);
            
            // Verificar se há itens com recebimento parcial para debug
            const itensRecebimentoParcial = this.itensPendentes.filter(
                item => item.statusItem === 'Recebimento Parcial'
            );
            
            console.log(`🔍 Itens com status "Recebimento Parcial" encontrados: ${itensRecebimentoParcial.length}`);
            if (itensRecebimentoParcial.length > 0) {
                itensRecebimentoParcial.forEach(item => {
                    console.log(`  - Item ${item.codigo}: pendente=${item.qtdePendenteRecebimento}, status=${item.statusItem}`);
                });
            }
            
            this.aplicarFiltros();
            this.esconderLoading();

        } catch (error) {
            console.error('Erro ao carregar itens pendentes:', error);
            this.mostrarErro('Erro ao carregar itens pendentes');
            this.esconderLoading();
        }
    }

    async carregarItensCompraInicial() {
        console.log('🔍 Carregando itens de compra inicial...');

        // Buscar apenas itens com qtdeComprada > 0 que NÃO sejam de compra final
        const snapshot = await this.db.collection('itens')
            .where('qtdeComprada', '>', 0)
            .limit(1000)
            .get();
            
        console.log(`📊 Query de itens com qtdeComprada > 0: ${snapshot.size} itens`);

        for (const doc of snapshot.docs) {
            const item = doc.data();
            
            // Ignorar itens que têm historicoCompraFinal (são da compra final)
            if (item.historicoCompraFinal) {
                console.log(`⏭️ Item ${item.codigo || doc.id} - Ignorado (é de compra final)`);
                continue;
            }
            
            console.log(`🔍 Analisando item ${doc.id}:`, {
                codigo: item.codigo,
                qtdeComprada: item.qtdeComprada,
                qtdePendenteRecebimento: item.qtdePendenteRecebimento,
                statusItem: item.statusItem
            });
            
            // Determinar quantidade pendente
            let qtdePendente = 0;
            
            // Calcular quantidade já recebida baseada no histórico de recebimentos
            const qtdeRecebida = item.historicoRecebimentos 
                ? item.historicoRecebimentos.reduce((total, rec) => total + (rec.qtdeRecebida || rec.qtde || 0), 0)
                : 0;
            
            // Quantidade pendente = quantidade comprada - quantidade já recebida
            qtdePendente = item.qtdeComprada - qtdeRecebida;
            
            // Garantir que a quantidade pendente nunca seja negativa
            qtdePendente = Math.max(0, qtdePendente);
            console.log(`📦 Item ${item.codigo || doc.id} - Qtde pendente (calculada): ${qtdePendente} (comprada: ${item.qtdeComprada}, recebida: ${qtdeRecebida})`);
            
            // IMPORTANTE: Verificar primeiro o status de Recebimento Parcial
            const isRecebimentoParcial = item.statusItem === 'Recebimento Parcial';
            
            // Se o item tiver status de Recebimento Parcial, incluí-lo mesmo que a qtde pendente seja 0
            // porque pode ter sido um cálculo incorreto anteriormente
            if (isRecebimentoParcial) {
                console.log(`⚠️ Item ${item.codigo || doc.id} - Tem status de Recebimento Parcial e será incluído na lista independentemente da quantidade`);
                
                // Forçar uma quantidade pendente mínima para garantir que será exibido
                // Se a quantidade calculada for 0 mas o status for Recebimento Parcial, algo está errado
                if (qtdePendente <= 0) {
                    qtdePendente = item.qtdeComprada * 0.1; // 10% da quantidade original
                    console.log(`⚠️ Corrigindo item ${item.codigo}: Qtde pendente forçada para ${qtdePendente} já que é um recebimento parcial`);
                }
            }
            // Se não for recebimento parcial e não tiver quantidade pendente, pular
            else if (qtdePendente <= 0) {
                console.log(`✅ Item ${item.codigo || doc.id} - Totalmente recebido, não incluir na lista`);
                continue;
            }

            if (qtdePendente > 0) {
                // Buscar dados do pedido para obter cliente (se necessário)
                let clienteNome = item.clienteNome || 'N/A';
                let tipoProjeto = item.tipoProjeto || 'N/A';
                
                if (item.pedidoId && (clienteNome === 'N/A' || tipoProjeto === 'N/A')) {
                    try {
                        const pedidoDoc = await this.db.collection('pedidos').doc(item.pedidoId).get();
                        if (pedidoDoc.exists) {
                            const pedidoData = pedidoDoc.data();
                            clienteNome = pedidoData.clienteNome || clienteNome;
                            tipoProjeto = pedidoData.tipoProjeto || tipoProjeto;
                        }
                    } catch (error) {
                        console.warn('Erro ao buscar dados do pedido:', error);
                    }
                }
                
                // Garantir que o status está correto se for recebimento parcial
                const statusItem = item.statusItem === 'Recebimento Parcial' ? 'Recebimento Parcial' : item.statusItem;

                const itemParaAdicionar = {
                    id: doc.id,
                    ...item,
                    qtdePendenteRecebimento: qtdePendente,
                    clienteNome,
                    tipoProjeto,
                    tipoCompra: 'Compra Inicial', // Flag para identificar o tipo
                    statusItem: item.statusItem // Garantir que o status está correto
                };
                
                // Se for recebimento parcial, registrar explicitamente
                if (item.statusItem === 'Recebimento Parcial') {
                    console.log(`⚠️ Adicionando item ${item.codigo || doc.id} com status RECEBIMENTO PARCIAL`);
                    console.log(`   Quantidade pendente: ${qtdePendente}, Quantidade total: ${item.qtdeComprada}`);
                    itemParaAdicionar.statusItem = 'Recebimento Parcial';
                }
                
                this.itensPendentes.push(itemParaAdicionar);
                
                console.log(`✅ Item ${item.codigo || doc.id} adicionado à lista (compra inicial)`);
            } else {
                console.log(`⏭️ Item ${item.codigo || doc.id} - Sem quantidade pendente: ${qtdePendente}`);
            }
        }

        console.log(`✅ Itens de compra inicial carregados: ${this.itensPendentes.length}`);
    }

    // Método removido - compra final agora é tratada pelo recebimentofinal.js

    // ============================================================================
    // CALENDÁRIO DE ENTREGAS
    // ============================================================================

    gerarCalendarioSemanal() {
        const container = document.getElementById('calendarioSemanal');
        container.innerHTML = '';

        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo

        const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

        for (let i = 0; i < 7; i++) {
            const data = new Date(inicioSemana);
            data.setDate(inicioSemana.getDate() + i);
            
            const diaCard = this.criarCardDia(data, diasSemana[i]);
            container.appendChild(diaCard);
        }
    }

    criarCardDia(data, diaSemana) {
        const dia = data.getDate();
        const mes = data.getMonth() + 1;
        const dataFormatada = data.toISOString().split('T')[0];
        
        // Filtrar entregas para este dia
        const entregasDoDia = this.itensPendentes.filter(item => {
            return item.prazoEntrega === dataFormatada;
        });

        // Agrupar por fornecedor
        const fornecedores = {};
        entregasDoDia.forEach(item => {
            const fornecedor = item.fornecedor || 'Sem fornecedor';
            if (!fornecedores[fornecedor]) {
                fornecedores[fornecedor] = 0;
            }
            fornecedores[fornecedor]++;
        });

        const div = document.createElement('div');
        div.className = `bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[120px] ${
            data.toDateString() === new Date().toDateString() ? 'ring-2 ring-green-500' : ''
        }`;

        let fornecedoresHtml = '';
        Object.entries(fornecedores).forEach(([fornecedor, count]) => {
            fornecedoresHtml += `
                <button class="block w-full text-left bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mb-1 transition-colors"
                        onclick="recebimentoManager.abrirModalDetalhesFornecedor('${fornecedor}', '${dataFormatada}')">
                    ${fornecedor} (${count})
                </button>
            `;
        });

        div.innerHTML = `
            <div class="text-center mb-2">
                <div class="text-xs font-medium text-gray-500">${diaSemana}</div>
                <div class="text-lg font-bold text-gray-900">${dia}/${mes.toString().padStart(2, '0')}</div>
            </div>
            <div class="space-y-1">
                ${fornecedoresHtml || '<p class="text-xs text-gray-400 text-center">Sem entregas</p>'}
            </div>
        `;

        return div;
    }

    filtrarPorFornecedorEData(fornecedor, data) {
        // Aplicar filtros
        document.getElementById('filtroFornecedor').value = fornecedor;
        document.getElementById('filtroDataDe').value = data;
        document.getElementById('filtroDataAte').value = data;
        
        this.aplicarFiltros();
        
        // Scroll para a tabela
        document.getElementById('tabelaContainer').scrollIntoView({ behavior: 'smooth' });
    }

    // ============================================================================
    // MODAL DE DETALHES DO FORNECEDOR
    // ============================================================================

    abrirModalDetalhesFornecedor(fornecedor, data) {
        // Filtrar itens por fornecedor e data
        const itensFiltrados = this.itensPendentes.filter(item => {
            const fornecedorItem = item.fornecedor || 'Sem fornecedor';
            return fornecedorItem === fornecedor && item.prazoEntrega === data;
        });

        // Atualizar título e informações do modal
        const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
        document.getElementById('tituloModalFornecedor').textContent = `Entregas - ${fornecedor}`;
        document.getElementById('infoDataEntrega').textContent = `Data de entrega: ${dataFormatada} | Total de itens: ${itensFiltrados.length}`;

        // Preencher tabela
        this.preencherTabelaModalFornecedor(itensFiltrados);

        // Mostrar modal
        document.getElementById('modalDetalhesFornecedor').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    abrirModalDetalhesFornecedorNoCalendario(fornecedor, data) {
        // Filtrar itens por fornecedor e data
        const itensFiltrados = this.itensPendentes.filter(item => {
            const fornecedorItem = item.fornecedor || 'Sem fornecedor';
            return fornecedorItem === fornecedor && item.prazoEntrega === data;
        });

        // Atualizar título e informações do modal
        const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
        document.getElementById('tituloModalFornecedor').textContent = `Entregas - ${fornecedor}`;
        document.getElementById('infoDataEntrega').textContent = `Data de entrega: ${dataFormatada} | Total de itens: ${itensFiltrados.length}`;

        // Preencher tabela
        this.preencherTabelaModalFornecedor(itensFiltrados);

        // Mostrar modal sem fechar o modal do calendário
        document.getElementById('modalDetalhesFornecedor').classList.remove('hidden');
    }

    preencherTabelaModalFornecedor(itens) {
        const tbody = document.getElementById('tabelaItensFornecedor');
        tbody.innerHTML = '';

        if (itens.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                        Nenhum item encontrado
                    </td>
                </tr>
            `;
            return;
        }

        itens.forEach(item => {
            const prazoVencido = item.prazoEntrega < new Date().toISOString().split('T')[0];
            const statusClass = prazoVencido ? 'bg-red-50' : '';
            const statusText = prazoVencido ? 'Em atraso' : 'No prazo';
            const statusColor = prazoVencido ? 'text-red-600' : 'text-green-600';

            const tr = document.createElement('tr');
            tr.className = `hover:bg-gray-50 ${statusClass}`;
            
            tr.innerHTML = `
                <td class="px-4 py-3 text-sm text-gray-900">${item.codigo || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${item.descricao || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900 font-medium">${item.qtdePendenteRecebimento || 0}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${item.nomeCliente || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${item.listaMaterial || '-'}</td>
                <td class="px-4 py-3 text-sm ${statusColor} font-medium">${statusText}</td>
            `;
            
            tbody.appendChild(tr);
        });
    }

    fecharModalDetalhesFornecedor() {
        document.getElementById('modalDetalhesFornecedor').classList.add('hidden');
        
        // Restaurar overflow apenas se o modal de calendário também estiver fechado
        if (document.getElementById('modalCalendario').classList.contains('hidden')) {
            document.body.style.overflow = 'auto';
        }
    }

    // ============================================================================
    // MODAL DE CALENDÁRIO COMPLETO
    // ============================================================================

    abrirModalCalendario() {
        this.gerarCalendarioCompleto();
        document.getElementById('modalCalendario').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    fecharModalCalendario() {
        document.getElementById('modalCalendario').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    navegarMes(direcao) {
        this.mesAtual.setMonth(this.mesAtual.getMonth() + direcao);
        this.gerarCalendarioCompleto();
    }

    gerarCalendarioCompleto() {
        const container = document.getElementById('calendarioCompleto');
        const titulo = document.getElementById('tituloMes');
        
        container.innerHTML = '';
        
        const ano = this.mesAtual.getFullYear();
        const mes = this.mesAtual.getMonth();
        
        titulo.textContent = new Intl.DateTimeFormat('pt-BR', { 
            month: 'long', 
            year: 'numeric' 
        }).format(this.mesAtual);

        // Cabeçalho dos dias da semana
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        diasSemana.forEach(dia => {
            const header = document.createElement('div');
            header.className = 'text-center font-medium text-gray-700 py-2';
            header.textContent = dia;
            container.appendChild(header);
        });

        // Primeira data do mês
        const primeiroDia = new Date(ano, mes, 1);
        const ultimoDia = new Date(ano, mes + 1, 0);
        
        // Dias em branco antes do primeiro dia
        for (let i = 0; i < primeiroDia.getDay(); i++) {
            const celula = document.createElement('div');
            celula.className = 'p-2 min-h-[80px]';
            container.appendChild(celula);
        }

        // Dias do mês
        for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
            const data = new Date(ano, mes, dia);
            const celula = this.criarCelulaCalendario(data);
            container.appendChild(celula);
        }
    }

    criarCelulaCalendario(data) {
        const dia = data.getDate();
        const dataFormatada = data.toISOString().split('T')[0];
        
        const entregasDoDia = this.itensPendentes.filter(item => {
            return item.prazoEntrega === dataFormatada;
        });

        const fornecedores = {};
        entregasDoDia.forEach(item => {
            const fornecedor = item.fornecedor || 'Sem fornecedor';
            if (!fornecedores[fornecedor]) {
                fornecedores[fornecedor] = 0;
            }
            fornecedores[fornecedor]++;
        });

        const celula = document.createElement('div');
        celula.className = `p-2 border border-gray-200 min-h-[80px] ${
            data.toDateString() === new Date().toDateString() ? 'bg-green-100' : 'bg-white'
        } hover:bg-gray-50 cursor-pointer`;

        let fornecedoresHtml = '';
        Object.entries(fornecedores).slice(0, 3).forEach(([fornecedor, count]) => {
            fornecedoresHtml += `
                <div class="text-xs bg-blue-100 text-blue-800 px-1 rounded mb-1 cursor-pointer"
                     onclick="event.stopPropagation(); recebimentoManager.abrirModalDetalhesFornecedorNoCalendario('${fornecedor}', '${dataFormatada}')">
                    ${fornecedor.substring(0, 10)}... (${count})
                </div>
            `;
        });

        if (Object.keys(fornecedores).length > 3) {
            fornecedoresHtml += `<div class="text-xs text-gray-500">+${Object.keys(fornecedores).length - 3} mais</div>`;
        }

        celula.innerHTML = `
            <div class="font-medium text-gray-900 mb-1">${dia}</div>
            ${fornecedoresHtml}
        `;

        celula.addEventListener('click', (event) => {
            // Evitar que o clique na célula feche o modal quando estamos clicando em um fornecedor
            if (event.target.closest('.cursor-pointer:not(.min-h-\\[80px\\])')) {
                return;
            }
            
            this.fecharModalCalendario();
            if (entregasDoDia.length > 0) {
                document.getElementById('filtroDataDe').value = dataFormatada;
                document.getElementById('filtroDataAte').value = dataFormatada;
                this.aplicarFiltros();
                document.getElementById('tabelaContainer').scrollIntoView({ behavior: 'smooth' });
            }
        });

        return celula;
    }

    // ============================================================================
    // FILTROS E BUSCA
    // ============================================================================

    aplicarFiltros() {
        const filtros = {
            cliente: document.getElementById('filtroCliente').value.toLowerCase(),
            codigo: document.getElementById('filtroCodigo').value.toLowerCase(),
            fornecedor: document.getElementById('filtroFornecedor').value.toLowerCase(),
            tipoProjeto: document.getElementById('filtroTipoProjeto').value,
            listaMaterial: document.getElementById('filtroListaMaterial').value.toLowerCase(),
            dataDe: document.getElementById('filtroDataDe').value,
            dataAte: document.getElementById('filtroDataAte').value
        };

        const itensFiltrados = this.itensPendentes.filter(item => {
            // Filtro cliente
            if (filtros.cliente && !item.clienteNome.toLowerCase().includes(filtros.cliente)) {
                return false;
            }

            // Filtro código
            if (filtros.codigo && !item.codigo.toLowerCase().includes(filtros.codigo)) {
                return false;
            }

            // Filtro fornecedor
            if (filtros.fornecedor && !(item.fornecedor || '').toLowerCase().includes(filtros.fornecedor)) {
                return false;
            }

            // Filtro tipo projeto
            if (filtros.tipoProjeto && item.tipoProjeto !== filtros.tipoProjeto) {
                return false;
            }

            // Filtro lista material
            if (filtros.listaMaterial && !(item.listaMaterial || '').toLowerCase().includes(filtros.listaMaterial)) {
                return false;
            }

            // Filtro data
            if (filtros.dataDe && item.prazoEntrega < filtros.dataDe) {
                return false;
            }

            if (filtros.dataAte && item.prazoEntrega > filtros.dataAte) {
                return false;
            }

            return true;
        });

        this.renderizarTabela(itensFiltrados);
        this.gerarCalendarioSemanal(); // Atualizar calendário com filtros
    }

    limparFiltros() {
        document.getElementById('filtroCliente').value = '';
        document.getElementById('filtroCodigo').value = '';
        document.getElementById('filtroFornecedor').value = '';
        document.getElementById('filtroTipoProjeto').value = '';
        document.getElementById('filtroListaMaterial').value = '';
        document.getElementById('filtroDataDe').value = '';
        document.getElementById('filtroDataAte').value = '';
        
        this.aplicarFiltros();
    }

    // ============================================================================
    // RENDERIZAÇÃO DA TABELA
    // ============================================================================

    renderizarTabela(itens) {
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
            const isRecebimentoParcial = item.statusItem === 'Recebimento Parcial';
            
            // Adicionar destaque para recebimento parcial
            if (isRecebimentoParcial) {
                tr.className = 'hover:bg-green-50 bg-green-100';
                console.log(`🟢 Renderizando item ${item.codigo} com status Recebimento Parcial`);
            } else if (isAtrasado) {
                tr.className = 'hover:bg-red-50 bg-red-25';
            } else if (isHoje) {
                tr.className = 'hover:bg-yellow-50 bg-yellow-25';
            } else {
                tr.className = 'hover:bg-gray-50';
            }

            // Definir cor do badge do tipo de compra - só compra inicial
            const tipoCompraClass = 'bg-blue-100 text-blue-800';
            
            // Adicionar status ao item na tabela
            const statusLabel = item.statusItem === 'Recebimento Parcial' ? 
                `<span class="inline-block ml-2 bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full text-xs font-medium">Parcial</span>` : 
                '';

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <input type="checkbox" class="item-checkbox rounded" data-index="${index}">
                </td>
                <td class="px-4 py-3 text-sm">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tipoCompraClass}">
                        ${item.tipoCompra}
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
                    ${this.formatarQuantidade(item.qtdePendenteRecebimento)}
                    ${isRecebimentoParcial ? '<span class="ml-2 inline-block bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full text-xs font-medium">Parcial</span>' : ''}
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
                        ${this.formatarData(item.prazoEntrega)}
                    </span>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Event listeners para checkboxes
        tbody.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.onItemSelecionado();
            });
        });

        this.itensFiltrados = itens;
    }

    formatarQuantidade(quantidade) {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(quantidade || 0);
    }

    formatarData(data) {
        if (!data) return 'N/A';
        
        try {
            const dataObj = new Date(data + 'T00:00:00');
            return dataObj.toLocaleDateString('pt-BR');
        } catch {
            return data;
        }
    }

    // ============================================================================
    // SELEÇÃO DE ITENS
    // ============================================================================

    onItemSelecionado() {
        const checkboxesSelecionados = document.querySelectorAll('.item-checkbox:checked');
        const totalSelecionados = checkboxesSelecionados.length;
        
        // Atualizar checkbox master
        const checkboxMaster = document.getElementById('checkboxMaster');
        const totalItens = document.querySelectorAll('.item-checkbox').length;
        
        checkboxMaster.indeterminate = totalSelecionados > 0 && totalSelecionados < totalItens;
        checkboxMaster.checked = totalSelecionados === totalItens && totalItens > 0;
        
        // Habilitar/desabilitar botão
        document.getElementById('btnRegistrarRecebimento').disabled = totalSelecionados === 0;
        
        // Atualizar texto do botão
        const btnSelecionar = document.getElementById('btnSelecionarTodos');
        btnSelecionar.textContent = totalSelecionados === totalItens && totalItens > 0 ? 'Desmarcar Todos' : 'Selecionar Todos';
    }

    selecionarTodos(selecionar) {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.checked = selecionar;
        });
        this.onItemSelecionado();
    }

    toggleSelecionarTodos() {
        const checkboxesSelecionados = document.querySelectorAll('.item-checkbox:checked');
        const totalItens = document.querySelectorAll('.item-checkbox').length;
        const todosSeleecionados = checkboxesSelecionados.length === totalItens && totalItens > 0;
        this.selecionarTodos(!todosSeleecionados);
    }

    // ============================================================================
    // MODAL DE RECEBIMENTO
    // ============================================================================

    abrirModalRecebimento() {
        // Coletar itens selecionados
        this.itensSelecionados = [];
        document.querySelectorAll('.item-checkbox:checked').forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            this.itensSelecionados.push(this.itensFiltrados[index]);
        });

        if (this.itensSelecionados.length === 0) {
            alert('Selecione pelo menos um item');
            return;
        }

        // Configurar data padrão
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataRecebimento').value = hoje;
        
        // Limpar nota fiscal
        document.getElementById('numeroNotaFiscal').value = '';

        // Preencher tabela
        this.preencherTabelaRecebimento();
        
        // Atualizar contador
        document.getElementById('totalItensSelecionados').textContent = this.itensSelecionados.length;

        // Mostrar modal
        document.getElementById('modalRecebimento').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    fecharModalRecebimento() {
        document.getElementById('modalRecebimento').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    preencherTabelaRecebimento() {
        const tbody = document.getElementById('corpoTabelaRecebimento');
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
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">
                    ${this.formatarQuantidade(item.qtdePendenteRecebimento)}
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

    // ============================================================================
    // SALVAMENTO DE RECEBIMENTO
    // ============================================================================

    async salvarRecebimento() {
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
            const recebimentos = [];

            for (const input of inputs) {
                const index = parseInt(input.dataset.itemIndex);
                const item = this.itensSelecionados[index];
                const qtdRecebida = parseFloat(input.value) || 0;

                if (qtdRecebida <= 0) {
                    alert(`Quantidade inválida para o item ${item.codigo}`);
                    return;
                }
                
                // Verificar se é recebimento parcial
                const isRecebimentoParcial = qtdRecebida < item.qtdePendenteRecebimento;
                if (isRecebimentoParcial) {
                    console.log(`🔶 ATENÇÃO: Recebimento parcial detectado para o item ${item.codigo}`);
                    console.log(`Quantidade pendente: ${item.qtdePendenteRecebimento}, Quantidade recebida: ${qtdRecebida}, Restante: ${item.qtdePendenteRecebimento - qtdRecebida}`);
                    
                    // Alerta para o usuário sobre recebimento parcial
                    if (!window.recebimentoParcialAlertado) {
                        alert(`Atenção: O item ${item.codigo} terá um recebimento parcial. Após salvar, ele continuará visível na lista com a quantidade restante.`);
                        window.recebimentoParcialAlertado = true;
                    }
                }

                recebimentos.push({
                    item,
                    qtdRecebida,
                    isRecebimentoParcial
                });
            }

            // Mostrar loading
            this.mostrarLoading();

            // Executar batch update
            const batch = this.db.batch();
            const agora = new Date();

            for (const recebimento of recebimentos) {
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
                
                // Log para debug do status de recebimento parcial
                console.log(`Status do item ${item.codigo}: ${novoStatus}`);
                console.log(`Quantidade pendente anterior: ${item.qtdePendenteRecebimento}, Recebida: ${qtdRecebida}, Nova pendente: ${novaQtdePendente}`);

                // Criar entrada do histórico com flag de tipo de recebimento
                const historicoRecebimento = {
                    data: agora.toISOString(),
                    notaFiscal: numeroNotaFiscal,
                    qtde: qtdRecebida,
                    status: novoStatus,
                    qtdePendenteAnterior: item.qtdePendenteRecebimento,
                    qtdePendenteNova: novaQtdePendente,
                    tipoRecebimento: item.tipoCompra, // Flag para identificar se é recebimento de compra inicial ou final
                    dataRecebimento: dataRecebimento
                };

                // Preparar atualização
                const docRef = this.db.collection('itens').doc(item.id);
                
                // CORREÇÃO CRÍTICA: Verificar se o recebimento é realmente completo ou parcial
                // baseado na quantidade recebida vs. quantidade pendente
                let recebimentoCompleto = qtdRecebida >= item.qtdePendenteRecebimento;
                
                // Novo status baseado na análise correta
                let novoStatusFinal = novoStatus;
                if (recebimentoCompleto) {
                    novoStatusFinal = 'Recebido Completo';
                    console.log(`✅ Item ${item.codigo} - Recebimento COMPLETO - Qtd recebida: ${qtdRecebida}, Qtd pendente: ${item.qtdePendenteRecebimento}`);
                } else {
                    novoStatusFinal = 'Recebimento Parcial';
                    console.log(`🔶 Item ${item.codigo} - Recebimento PARCIAL - Qtd recebida: ${qtdRecebida}, Qtd pendente: ${item.qtdePendenteRecebimento}, Restante: ${novaQtdePendente}`);
                }

                const updateData = {
                    qtdePendenteRecebimento: Math.max(0, novaQtdePendente),
                    statusItem: novoStatusFinal,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
                    historicoRecebimentos: firebase.firestore.FieldValue.arrayUnion(historicoRecebimento)
                };

                // Garantir que items com recebimento parcial tenham quantidade pendente
                if (novoStatusFinal === 'Recebimento Parcial' && novaQtdePendente <= 0) {
                    // Caso a qtde pendente tenha sido calculada incorretamente, forçar um valor
                    updateData.qtdePendenteRecebimento = item.qtdePendenteRecebimento - qtdRecebida;
                    if (updateData.qtdePendenteRecebimento <= 0) {
                        // Último caso: forçar um valor mínimo
                        updateData.qtdePendenteRecebimento = 1;
                    }
                    console.log(`⚠️ CORREÇÃO: Forçando quantidade pendente para ${updateData.qtdePendenteRecebimento} no item ${item.codigo}`);
                }

                batch.update(docRef, updateData);
            }

            await batch.commit();

            // Feedback e limpeza
            this.esconderLoading();
            
            // Log para verificar os itens após o processamento
            console.log('Recebimento concluído, verificando resultados:');
            let temRecebimentoParcial = false;
            for (const recebimento of recebimentos) {
                const { item, qtdRecebida, isRecebimentoParcial } = recebimento;
                const novaQtde = Math.max(0, item.qtdePendenteRecebimento - qtdRecebida);
                console.log(`Item ${item.codigo}: ${novaQtde === 0 ? 'Completo' : 'Parcial (restante: ' + novaQtde + ')'}`);
                
                // Verificar se tem algum recebimento parcial
                if (isRecebimentoParcial || novaQtde > 0) {
                    temRecebimentoParcial = true;
                }
            }
            
            // Feedback diferenciado para recebimento parcial
            if (temRecebimentoParcial) {
                alert(`Recebimento parcial registrado com sucesso! ${recebimentos.length} itens processados. Os itens com recebimento parcial permanecerão na lista para futuro recebimento.`);
            } else {
                alert(`Recebimento registrado com sucesso! ${recebimentos.length} itens processados.`);
            }
            
            this.fecharModalRecebimento();
            
            // Recarregar dados e garantir que os itens com recebimento parcial sejam exibidos
            window.recebimentoParcialAlertado = false; // Reset do alerta
            await this.carregarItensPendentes();

        } catch (error) {
            console.error('Erro ao salvar recebimento:', error);
            this.esconderLoading();
            alert('Erro ao salvar recebimento. Tente novamente.');
        }
    }

    // ============================================================================
    // UTILITÁRIOS
    // ============================================================================

    mostrarLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
    }

    esconderLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    mostrarErro(mensagem) {
        console.error(mensagem);
        // Aqui poderia implementar um toast ou modal de erro
        alert(mensagem);
    }
}

// Inicializar quando a página carregar
let recebimentoManager;

document.addEventListener('DOMContentLoaded', () => {
    recebimentoManager = new RecebimentoManager();
    // Expor globalmente para debug APÓS a criação
    window.recebimentoManager = recebimentoManager;
});