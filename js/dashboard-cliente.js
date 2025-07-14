// Dashboard de Visualização de Dados dos Clientes
class DashboardCliente {
    constructor() {
        this.pedidos = [];
        this.clientesData = new Map();
        this.loading = false;
    }

    // Inicializar dashboard
    async init() {
        console.log('Inicializando Dashboard de Clientes...');
        try {
            await this.carregarDados();
            this.setupEventListeners();
        } catch (error) {
            console.error('Erro ao inicializar dashboard:', error);
            this.mostrarErro('Erro ao carregar dados do sistema');
        }
    }

    // Carregar todos os dados dos pedidos
    async carregarDados() {
        this.mostrarLoading(true);
        
        try {
            // Buscar todos os pedidos do Firestore
            const snapshot = await db.collection('pedidos').get();
            this.pedidos = [];
            
            // Para cada pedido, buscar também os itens/listas de materiais
            for (const doc of snapshot.docs) {
                const pedido = doc.data();
                pedido.id = doc.id;
                
                // Buscar itens deste pedido
                const itensSnapshot = await db.collection('itens')
                    .where('pedidoId', '==', doc.id)
                    .get();
                
                // Organizar itens por lista de material
                const listasMateriais = new Map();
                
                itensSnapshot.forEach(itemDoc => {
                    const item = itemDoc.data();
                    const nomeLista = item.listaMaterial || 'Lista Padrão';
                    
                    if (!listasMateriais.has(nomeLista)) {
                        listasMateriais.set(nomeLista, {
                            nome: nomeLista,
                            itens: []
                        });
                    }
                    
                    listasMateriais.get(nomeLista).itens.push({
                        nome: item.nome || item.material || item.descricao || 'Item sem nome',
                        codigo: item.codigo || 'N/A',
                        quantidade: item.quantidade || 0,
                        unidade: item.unidade || 'un',
                        descricao: item.descricao || item.observacoes || ''
                    });
                });
                
                // Converter Map para Array
                pedido.listaMateriais = Array.from(listasMateriais.values());
                
                this.pedidos.push(pedido);
            }

            console.log(`Carregados ${this.pedidos.length} pedidos com suas listas de materiais`);
            
            // Processar dados dos clientes
            await this.processarDadosClientes();
            
            // Renderizar interface
            await this.renderizarDashboard();
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.mostrarErro('Erro ao carregar dados dos pedidos');
        } finally {
            this.mostrarLoading(false);
        }
    }

    // Processar dados dos clientes e seus projetos
    async processarDadosClientes() {
        this.clientesData.clear();
        
        for (const pedido of this.pedidos) {
            const clienteNome = pedido.clienteNome || 'Cliente não informado';
            
            if (!this.clientesData.has(clienteNome)) {
                this.clientesData.set(clienteNome, {
                    nome: clienteNome,
                    projetos: []
                });
            }
            
            const cliente = this.clientesData.get(clienteNome);
            
            // Processar projeto do pedido
            const projeto = {
                numeroPedido: pedido.numeroPedido || 'N/A',
                tipoProjeto: pedido.tipoProjeto || 'Não informado',
                listasMateriais: [],
                dataCriacao: pedido.dataCriacao,
                pedidoId: pedido.id
            };
            
            // Processar listas de materiais do pedido (agora carregadas corretamente)
            const listas = pedido.listaMateriais || [];
            
            console.log(`Processando listas do pedido ${pedido.numeroPedido}:`, listas.length, 'listas encontradas');
            
            if (listas && Array.isArray(listas) && listas.length > 0) {
                console.log(`✅ ENCONTROU ${listas.length} LISTAS para pedido ${pedido.numeroPedido}`);
                for (const lista of listas) {
                    const listaMaterial = {
                        nome: lista.nome || 'Lista sem nome',
                        itens: lista.itens || [],
                        totalItens: (lista.itens || []).length,
                        quantidadeTotal: this.calcularQuantidadeTotal(lista.itens || []),
                        analiseEstoque: await this.analisarEstoque(lista.itens || [], pedido.id)
                    };
                    
                    projeto.listasMateriais.push(listaMaterial);
                }
            } else {
                console.warn(`Nenhuma lista de materiais encontrada para pedido ${pedido.numeroPedido}`);
            }
            
            cliente.projetos.push(projeto);
        }
        
        console.log(`Processados ${this.clientesData.size} clientes`);
    }

    // Calcular quantidade total de itens em uma lista
    calcularQuantidadeTotal(itens) {
        return itens.reduce((total, item) => {
            const qtde = parseFloat(item.quantidade) || 0;
            return total + qtde;
        }, 0);
    }

    // Analisar estoque para uma lista de itens
    async analisarEstoque(itens, pedidoId) {
        const analise = {
            totalAlocado: 0,
            totalCompra: 0,
            itensAlocados: [],
            itensCompra: []
        };

        for (const item of itens) {
            try {
                let qtdeAlocada = 0;
                let qtdeCompra = 0;
                
                // Primeiro, tentar buscar dados de análise de estoque tratados
                const analiseSnapshot = await db.collection('analiseEstoque')
                    .where('pedidoId', '==', pedidoId)
                    .where('itemCodigo', '==', item.codigo || item.nome)
                    .get();
                
                if (!analiseSnapshot.empty) {
                    // Item já foi tratado na análise - usar valores salvos
                    const analiseDoc = analiseSnapshot.docs[0].data();
                    qtdeAlocada = parseFloat(analiseDoc.quantidadeAlocar) || 0;
                    qtdeCompra = parseFloat(analiseDoc.quantidadeComprar) || 0;
                } else {
                    // Item ainda não foi tratado - buscar na coleção 'itens' pelos campos diretos
                    const itemSnapshot = await db.collection('itens')
                        .where('pedidoId', '==', pedidoId)
                        .where('codigo', '==', item.codigo)
                        .get();
                    
                    if (!itemSnapshot.empty) {
                        const itemData = itemSnapshot.docs[0].data();
                        qtdeAlocada = parseFloat(itemData.quantidadeAlocar) || 0;
                        qtdeCompra = parseFloat(itemData.quantidadeComprar) || 0;
                    }
                }

                analise.totalAlocado += qtdeAlocada;
                analise.totalCompra += qtdeCompra;

                if (qtdeAlocada > 0) {
                    analise.itensAlocados.push({
                        nome: item.nome || item.codigo,
                        codigo: item.codigo,
                        quantidade: qtdeAlocada,
                        unidade: item.unidade,
                        descricao: item.descricao || '',
                        pedidoId: pedidoId
                    });
                }

                if (qtdeCompra > 0) {
                    analise.itensCompra.push({
                        nome: item.nome || item.codigo,
                        codigo: item.codigo,
                        quantidade: qtdeCompra,
                        unidade: item.unidade,
                        descricao: item.descricao || '',
                        pedidoId: pedidoId
                    });
                }

            } catch (error) {
                console.error('Erro ao analisar estoque do item:', item, error);
                // Em caso de erro, não adiciona valores (dados não tratados)
            }
        }

        return analise;
    }

    // Renderizar o dashboard completo
    async renderizarDashboard() {
        if (this.clientesData.size === 0) {
            this.mostrarEstadoVazio();
            return;
        }

        this.ocultarEstados();
        document.getElementById('clientesContainer').classList.remove('hidden');
        
        const container = document.getElementById('clientesContainer');
        container.innerHTML = '';

        // Converter Map para Array e ordenar por nome do cliente
        const clientes = Array.from(this.clientesData.values())
            .sort((a, b) => a.nome.localeCompare(b.nome));

        for (const cliente of clientes) {
            const card = await this.criarCardCliente(cliente);
            container.appendChild(card);
        }
    }

    // Criar card para um cliente
    async criarCardCliente(cliente) {
        const card = document.createElement('div');
        card.className = 'client-card';
        
        const header = document.createElement('div');
        header.className = 'client-header';
        
        const nome = document.createElement('div');
        nome.className = 'client-name';
        nome.textContent = cliente.nome;
        
        header.appendChild(nome);
        
        // Mostrar tipos de projetos únicos do cliente
        const tiposProjetos = [...new Set(cliente.projetos.map(p => p.tipoProjeto))];
        tiposProjetos.forEach(tipo => {
            const badge = document.createElement('span');
            badge.className = `project-type ${tipo.toLowerCase().replace(/\s+/g, '')}`;
            badge.textContent = tipo;
            header.appendChild(badge);
        });
        
        card.appendChild(header);
        
        const body = document.createElement('div');
        body.className = 'client-body';
        
        // Criar seção para cada projeto
        for (const projeto of cliente.projetos) {
            const secao = await this.criarSecaoProjeto(projeto, cliente.nome);
            body.appendChild(secao);
        }
        
        // Debug: mostrar informações do cliente
        console.log(`Cliente ${cliente.nome}:`, cliente.projetos);
        
        card.appendChild(body);
        return card;
    }

    // Criar seção para um projeto
    async criarSecaoProjeto(projeto, clienteNome) {
        const section = document.createElement('div');
        section.className = 'materials-section';
        
        // Header do projeto
        const projetoHeader = document.createElement('div');
        projetoHeader.style.marginBottom = '1rem';
        
        // Debug para este projeto específico
        console.log(`Projeto ${projeto.numeroPedido}:`, {
            numeroPedido: projeto.numeroPedido,
            tipoProjeto: projeto.tipoProjeto,
            listasMateriais: projeto.listasMateriais,
            totalListas: projeto.listasMateriais.length
        });
        
        // Calcular totais do projeto
        const totaisProjeto = this.calcularTotaisProjeto(projeto);
        
        projetoHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="font-weight: 600; color: #2d3748; margin: 0;">
                    Pedido #${projeto.numeroPedido} - ${projeto.tipoProjeto}
                </h4>
                <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: #718096;">
                    <span><strong>${totaisProjeto.totalItens}</strong> itens</span>
                    <span><strong>${Math.round(totaisProjeto.totalQuantidade)}</strong> total</span>
                </div>
            </div>
            <p style="font-size: 0.875rem; color: #718096; margin: 0;">
                ${projeto.listasMateriais.length} lista(s) de material
            </p>
        `;
        section.appendChild(projetoHeader);
        
        // Criar card para cada lista de material
        for (const lista of projeto.listasMateriais) {
            const card = await this.criarCardListaMaterial(lista, projeto, clienteNome);
            section.appendChild(card);
        }
        
        return section;
    }

    // Calcular totais de um projeto
    calcularTotaisProjeto(projeto) {
        let totalItens = 0;
        let totalQuantidade = 0;
        
        projeto.listasMateriais.forEach(lista => {
            totalItens += lista.totalItens;
            totalQuantidade += lista.quantidadeTotal;
        });
        
        return {
            totalItens,
            totalQuantidade
        };
    }

    // Criar card para uma lista de material
    async criarCardListaMaterial(lista, projeto, clienteNome) {
        // Criar um container grid principal para todos os módulos
        const modulesContainer = document.createElement('div');
        modulesContainer.className = 'material-list';
        
        // Header da lista
        const header = document.createElement('div');
        header.className = 'material-list-header';
        header.innerHTML = `
            <div class="material-list-name">${lista.nome}</div>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: #718096;">
                <span><strong>${lista.totalItens}</strong> itens</span>
                <span><strong>${Math.round(lista.quantidadeTotal)}</strong> total</span>
            </div>
        `;
        modulesContainer.appendChild(header);
        
        // Seção de Informações Gerais
        const infoGeneralSection = document.createElement('div');
        infoGeneralSection.className = 'info-general-section';
        
        // Container de Fases
        const phasesContainer = document.createElement('div');
        phasesContainer.className = 'phases-container';
        
        // ========== CONTAINER PRINCIPAL COM DROPDOWN ==========
        
        // Container principal do dropdown
        const mainDropdownContainer = document.createElement('div');
        mainDropdownContainer.className = 'perfil-dropdown-container';
        mainDropdownContainer.id = `main-dropdown-${lista.nome.replace(/\s+/g, '-')}`;
        
        // Header da seção (clicável para dropdown)
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-dropdown-header';
        
        // Primeiro, precisamos calcular os dados do resumo
        const resumoData = await this.calcularResumoVisual(lista, projeto);
        
        sectionHeader.innerHTML = `
            <h3>Informações do Projeto</h3>
            <div class="project-summary-visual">
                ${this.criarResumoVisual(resumoData)}
            </div>
            <span class="dropdown-icon">▼</span>
        `;
        
        // Adicionar evento de clique no header
        sectionHeader.addEventListener('click', () => {
            mainDropdownContainer.classList.toggle('open');
        });
        
        mainDropdownContainer.appendChild(sectionHeader);
        
        // Container do conteúdo dropdown
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'perfil-dropdown-content';
        
        // ========== SEÇÃO INFORMAÇÕES GERAIS (sempre visível quando expandido) ==========
        
        // 1. Módulo Perfil (agora dentro da seção)
        const modulePerfil = this.criarModuloCard('Perfil', 'module-perfil', [
            { label: 'Total de Itens', value: lista.totalItens },
            { label: 'Quantidade Total', value: Math.round(lista.quantidadeTotal) }
        ]);
        infoGeneralSection.appendChild(modulePerfil);
        
        // 2. Módulo Análise Inicial (renomeado de Análise de Estoque)
        const moduleAnaliseInicial = this.criarModuloCard('Análise Inicial', 'module-analise-inicial', [
            { 
                label: 'Em Estoque', 
                value: Math.round(lista.analiseEstoque.totalAlocado),
                onClick: () => this.mostrarDetalhesAnaliseEstoque(
                    lista.analiseEstoque.itensAlocados,
                    `Itens Em Estoque - ${lista.nome}`,
                    'alocados'
                ),
                colorClass: 'stock-allocated'
            },
            { 
                label: 'Para Comprar', 
                value: Math.round(lista.analiseEstoque.totalCompra),
                onClick: () => this.mostrarDetalhesAnaliseEstoque(
                    lista.analiseEstoque.itensCompra,
                    `Itens Para Comprar - ${lista.nome}`,
                    'compra'
                ),
                colorClass: 'stock-purchase'
            }
        ]);
        infoGeneralSection.appendChild(moduleAnaliseInicial);
        
        // 3. Módulo Mudanças Finais (movido da Fase Final para Informações Gerais)
        this.obterDadosAnaliseFinal(lista.itens, projeto.pedidoId).then(dadosAnalise => {
            const moduleMudancasFinais = this.criarModuloCard('Mudanças Finais', 'module-mudancas-finais', [
                { 
                    label: 'Lista Inicial', 
                    value: Math.round(dadosAnalise.totalListaInicial),
                    onClick: () => this.mostrarDetalhesAnaliseFinal(
                        dadosAnalise.itensListaInicial,
                        `Itens Lista Inicial - ${lista.nome}`,
                        'lista_inicial'
                    ),
                    colorClass: 'stock-allocated'
                },
                { 
                    label: 'Lista Produção', 
                    value: Math.round(dadosAnalise.totalListaProducao),
                    onClick: () => this.mostrarDetalhesAnaliseFinal(
                        dadosAnalise.itensListaProducao,
                        `Itens Lista Produção - ${lista.nome}`,
                        'lista_producao'
                    ),
                    colorClass: 'stock-purchase'
                }
            ]);
            infoGeneralSection.appendChild(moduleMudancasFinais);
        });
        
        dropdownContent.appendChild(infoGeneralSection);
        
        // ========== SEÇÃO DE FASES ==========
        
        // Fase Inicial (esquerda)
        const phaseInicial = document.createElement('div');
        phaseInicial.className = 'phase-section phase-inicial';
        phaseInicial.innerHTML = '<div class="phase-title">Fase Inicial</div>';
        
        const phaseInicialGrid = document.createElement('div');
        phaseInicialGrid.className = 'phase-modules-grid';
        
        // Fase Final (direita)
        const phaseFinal = document.createElement('div');
        phaseFinal.className = 'phase-section phase-final';
        phaseFinal.innerHTML = '<div class="phase-title">Fase Final</div>';
        
        const phaseFinalGrid = document.createElement('div');
        phaseFinalGrid.className = 'phase-modules-grid';
        
        // ========== MÓDULOS FASE INICIAL ==========
        
        // 1. Módulo Compra Inicial (assíncrono)
        this.obterDadosCompra(lista.itens, projeto.pedidoId).then(dadosCompra => {
            const moduleCompraInicial = this.criarModuloCard('Compra Inicial', 'module-compra-inicial', [
                { 
                    label: 'Para Comprar', 
                    value: Math.round(dadosCompra.totalParaComprar),
                    onClick: () => this.mostrarDetalhesCompra(
                        dadosCompra.itensParaComprar,
                        `Itens Para Comprar - ${lista.nome}`,
                        'para_comprar'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Comprado', 
                    value: Math.round(dadosCompra.totalComprado),
                    onClick: () => this.mostrarDetalhesCompra(
                        dadosCompra.itensComprados,
                        `Itens Comprados - ${lista.nome}`,
                        'comprado'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseInicialGrid.appendChild(moduleCompraInicial);
        });
        
        // 2. Módulo Recebimento (assíncrono) - FASE INICIAL
        this.obterDadosRecebimento(lista.itens, projeto.pedidoId).then(dadosRecebimento => {
            const moduleRecebimento = this.criarModuloCard('Recebimento', 'module-recebimento', [
                { 
                    label: 'A Receber', 
                    value: Math.round(dadosRecebimento.totalAReceber),
                    onClick: () => this.mostrarDetalhesRecebimento(
                        dadosRecebimento.itensAReceber,
                        `Itens A Receber - ${lista.nome}`,
                        'a_receber'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Recebido', 
                    value: Math.round(dadosRecebimento.totalRecebido),
                    onClick: () => this.mostrarDetalhesRecebimento(
                        dadosRecebimento.itensRecebidos,
                        `Itens Recebidos - ${lista.nome}`,
                        'recebido'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseInicialGrid.appendChild(moduleRecebimento);
        });
        
        // 3. Módulo Empenho (assíncrono) - FASE INICIAL
        this.obterDadosEmpenho(lista.itens, projeto.pedidoId).then(dadosEmpenho => {
            const moduleEmpenho = this.criarModuloCard('Empenho', 'module-empenho', [
                { 
                    label: 'A Empenhar', 
                    value: Math.round(dadosEmpenho.totalAEmpenhar),
                    onClick: () => this.mostrarDetalhesEmpenho(
                        dadosEmpenho.itensAEmpenhar,
                        `Itens A Empenhar - ${lista.nome}`,
                        'a_empenhar'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Empenhado', 
                    value: Math.round(dadosEmpenho.totalEmpenhado),
                    onClick: () => this.mostrarDetalhesEmpenho(
                        dadosEmpenho.itensEmpenhados,
                        `Itens Empenhados - ${lista.nome}`,
                        'empenhado'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseInicialGrid.appendChild(moduleEmpenho);
        });
        
        // ========== MÓDULOS FASE FINAL ==========
        
        // 1. Módulo Compra Final (assíncrono) - FASE FINAL
        this.obterDadosCompraFinal(lista.itens, projeto.pedidoId).then(dadosCompraFinal => {
            const moduleCompraFinal = this.criarModuloCard('Compra Final', 'module-compra-final', [
                { 
                    label: 'A Comprar', 
                    value: Math.round(dadosCompraFinal.totalAComprar),
                    onClick: () => this.mostrarDetalhesCompraFinal(
                        dadosCompraFinal.itensAComprar,
                        `Itens A Comprar - ${lista.nome}`,
                        'a_comprar_final'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Comprado', 
                    value: Math.round(dadosCompraFinal.totalComprado),
                    onClick: () => this.mostrarDetalhesCompraFinal(
                        dadosCompraFinal.itensComprados,
                        `Itens Comprados - ${lista.nome}`,
                        'comprado_final'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseFinalGrid.appendChild(moduleCompraFinal);
        });
        
        // 2. Módulo Recebimento Final (assíncrono) - FASE FINAL  
        this.obterDadosRecebimentoFinal(lista.itens, projeto.pedidoId).then(dadosRecebimentoFinal => {
            const moduleRecebimentoFinal = this.criarModuloCard('Recebimento Final', 'module-recebimento-final', [
                { 
                    label: 'A Receber', 
                    value: Math.round(dadosRecebimentoFinal.totalAReceber),
                    onClick: () => this.mostrarDetalhesRecebimentoFinal(
                        dadosRecebimentoFinal.itensAReceber,
                        `Itens A Receber Final - ${lista.nome}`,
                        'a_receber_final'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Recebido', 
                    value: Math.round(dadosRecebimentoFinal.totalRecebido),
                    onClick: () => this.mostrarDetalhesRecebimentoFinal(
                        dadosRecebimentoFinal.itensRecebidos,
                        `Itens Recebidos Final - ${lista.nome}`,
                        'recebido_final'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseFinalGrid.appendChild(moduleRecebimentoFinal);
        });
        
        // 3. Módulo Separação (assíncrono) - FASE FINAL
        this.obterDadosSeparacao(lista.itens, projeto.pedidoId).then(dadosSeparacao => {
            const moduleSeparacao = this.criarModuloCard('Separação', 'module-separacao', [
                { 
                    label: 'A Separar', 
                    value: Math.round(dadosSeparacao.totalASeparar),
                    onClick: () => this.mostrarDetalhesSeparacao(
                        dadosSeparacao.itensASeparar,
                        `Itens A Separar - ${lista.nome}`,
                        'a_separar'
                    ),
                    colorClass: 'stock-purchase'
                },
                { 
                    label: 'Separado', 
                    value: Math.round(dadosSeparacao.totalSeparado),
                    onClick: () => this.mostrarDetalhesSeparacao(
                        dadosSeparacao.itensSeparados,
                        `Itens Separados - ${lista.nome}`,
                        'separado'
                    ),
                    colorClass: 'stock-comprado'
                }
            ]);
            phaseFinalGrid.appendChild(moduleSeparacao);
        });
        
        // ========== MONTAGEM FINAL ==========
        
        // Adicionar grids às fases
        phaseInicial.appendChild(phaseInicialGrid);
        phaseFinal.appendChild(phaseFinalGrid);
        
        // Adicionar fases ao container
        phasesContainer.appendChild(phaseInicial);
        phasesContainer.appendChild(phaseFinal);
        
        // Adicionar container de fases ao dropdown content
        dropdownContent.appendChild(phasesContainer);
        
        // Adicionar dropdown content ao container principal
        mainDropdownContainer.appendChild(dropdownContent);
        
        // Adicionar container dropdown ao módulos container
        modulesContainer.appendChild(mainDropdownContainer);
        
        return modulesContainer;
        quantidadeComprarItem.addEventListener('click', () => {
            this.mostrarDetalhesCompraFinal(
                dadosCompraFinal.itensAComprar,
                `A Comprar - ${lista.nome}`,
                'a_comprar'
            );
        });
        compraFinalGrid.appendChild(quantidadeComprarItem);
        
        // Card for 'Comprado'
        const quantidadeCompradaItem = document.createElement('div');
        quantidadeCompradaItem.className = 'stock-item stock-comprado';
        quantidadeCompradaItem.innerHTML = `
            <div class="stock-number">${Math.round(dadosCompraFinal.totalComprado)}</div>
            <div class="stock-label">Comprado</div>
        `;
        quantidadeCompradaItem.addEventListener('click', () => {
            this.mostrarDetalhesCompraFinal(
                dadosCompraFinal.itensComprados,
                `Comprado - ${lista.nome}`,
                'comprado'
            );
        });
        compraFinalGrid.appendChild(quantidadeCompradaItem);
        
        compraFinalAnalysis.appendChild(compraFinalGrid);
        materialCard.appendChild(compraFinalAnalysis);

        // Recebimento Final
        const recebimentoFinalAnalysis = document.createElement('div');
        recebimentoFinalAnalysis.className = 'stock-analysis';
        recebimentoFinalAnalysis.innerHTML = `<div class="stock-analysis-header">Recebimento Final</div>`;
        
        const recebimentoFinalGrid = document.createElement('div');
        recebimentoFinalGrid.className = 'stock-grid';
        
        const dadosRecebimentoFinal = await this.obterDadosRecebimentoFinal(lista.itens, projeto.pedidoId);
        
        // Card for 'A Receber'
        const aReceberFinalItem = document.createElement('div');
        aReceberFinalItem.className = 'stock-item stock-purchase';
        aReceberFinalItem.innerHTML = `
            <div class="stock-number">${Math.round(dadosRecebimentoFinal.totalAReceber)}</div>
            <div class="stock-label">A Receber</div>
        `;
        aReceberFinalItem.addEventListener('click', () => {
            this.mostrarDetalhesRecebimentoFinal(
                dadosRecebimentoFinal.itensAReceber,
                `A Receber Final - ${lista.nome}`,
                'a_receber'
            );
        });
        recebimentoFinalGrid.appendChild(aReceberFinalItem);
        
        // Card for 'Recebido'
        const recebidoFinalItem = document.createElement('div');
        recebidoFinalItem.className = 'stock-item stock-comprado';
        recebidoFinalItem.innerHTML = `
            <div class="stock-number">${Math.round(dadosRecebimentoFinal.totalRecebido)}</div>
            <div class="stock-label">Recebido</div>
        `;
        recebidoFinalItem.addEventListener('click', () => {
            this.mostrarDetalhesRecebimentoFinal(
                dadosRecebimentoFinal.itensRecebidos,
                `Recebido Final - ${lista.nome}`,
                'recebido'
            );
        });
        recebimentoFinalGrid.appendChild(recebidoFinalItem);
        
        recebimentoFinalAnalysis.appendChild(recebimentoFinalGrid);
        materialCard.appendChild(recebimentoFinalAnalysis);

        // Separação
        const separacaoAnalysis = document.createElement('div');
        separacaoAnalysis.className = 'stock-analysis';
        separacaoAnalysis.innerHTML = `<div class="stock-analysis-header">Separação</div>`;
        
        const separacaoGrid = document.createElement('div');
        separacaoGrid.className = 'stock-grid';
        
        const dadosSeparacao = await this.obterDadosSeparacao(lista.itens, projeto.pedidoId);
        
        // Card for 'A Separar'
        const aSepararItem = document.createElement('div');
        aSepararItem.className = 'stock-item stock-purchase';
        aSepararItem.innerHTML = `
            <div class="stock-number">${Math.round(dadosSeparacao.totalASeparar)}</div>
            <div class="stock-label">A Separar</div>
        `;
        aSepararItem.addEventListener('click', () => {
            this.mostrarDetalhesSeparacao(
                dadosSeparacao.itensASeparar,
                `A Separar - ${lista.nome}`,
                'a_separar'
            );
        });
        separacaoGrid.appendChild(aSepararItem);
        
        // Card for 'Separado'
        const separadoItem = document.createElement('div');
        separadoItem.className = 'stock-item stock-comprado';
        separadoItem.innerHTML = `
            <div class="stock-number">${Math.round(dadosSeparacao.totalSeparado)}</div>
            <div class="stock-label">Separado</div>
        `;
        separadoItem.addEventListener('click', () => {
            this.mostrarDetalhesSeparacao(
                dadosSeparacao.itensSeparados,
                `Separado - ${lista.nome}`,
                'separado'
            );
        });
        separacaoGrid.appendChild(separadoItem);
        
        separacaoAnalysis.appendChild(separacaoGrid);
        materialCard.appendChild(separacaoAnalysis);
        
        return materialCard;
    }
    
    // Método auxiliar para criar um módulo de card padronizado
    criarModuloCard(titulo, className, items) {
        const modulo = document.createElement('div');
        modulo.className = `modulo-card ${className}`;
        
        // Cabeçalho do módulo
        const header = document.createElement('div');
        header.className = 'modulo-header';
        header.textContent = titulo;
        modulo.appendChild(header);
        
        // Conteúdo do módulo
        const content = document.createElement('div');
        content.className = 'modulo-content';
        
        // Adicionar itens
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `modulo-item ${item.colorClass || ''}`;
            
            const valueElement = document.createElement('div');
            valueElement.className = 'modulo-value';
            valueElement.textContent = item.value;
            
            const labelElement = document.createElement('div');
            labelElement.className = 'modulo-label';
            labelElement.textContent = item.label;
            
            itemElement.appendChild(valueElement);
            itemElement.appendChild(labelElement);
            
            // Adicionar evento de clique se fornecido
            if (item.onClick) {
                itemElement.addEventListener('click', item.onClick);
                itemElement.style.cursor = 'pointer';
            }
            
            content.appendChild(itemElement);
        });
        
        modulo.appendChild(content);
        return modulo;
    }
    


    // Analisar prazos de entrega dos itens
    analisarPrazosEntrega(itensComprados) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const proximos7Dias = new Date(hoje);
        proximos7Dias.setDate(hoje.getDate() + 7);
        
        const analise = {
            emDia: [],
            hoje: [],
            atrasado: [],
            proximosDias: []
        };
        
        itensComprados.forEach(item => {
            const prazoEntrega = this.obterDataPrazoEntrega(item);
            
            if (!prazoEntrega) {
                // Se não tem prazo definido, considera como "em dia" por padrão
                analise.emDia.push(item);
                return;
            }
            
            if (prazoEntrega < hoje) {
                analise.atrasado.push(item);
            } else if (prazoEntrega.getTime() === hoje.getTime()) {
                analise.hoje.push(item);
            } else if (prazoEntrega <= proximos7Dias) {
                analise.proximosDias.push(item);
            } else {
                analise.emDia.push(item);
            }
        });
        
        return analise;
    }

    // Obter data do prazo de entrega de um item
    obterDataPrazoEntrega(item) {
        let prazoEntrega = null;
        
        // Tentar obter da ordem de compra primeiro
        if (item.ordemCompra && item.ordemCompra.prazoEntrega) {
            try {
                prazoEntrega = typeof item.ordemCompra.prazoEntrega.toDate === 'function' 
                    ? item.ordemCompra.prazoEntrega.toDate() 
                    : new Date(item.ordemCompra.prazoEntrega);
            } catch (e) {
                console.warn('Erro ao converter prazoEntrega da ordemCompra:', e);
            }
        }
        
        // Se não conseguiu da ordem de compra, tentar do campo direto
        if (!prazoEntrega && item.prazoEntrega) {
            try {
                if (typeof item.prazoEntrega === 'string') {
                    prazoEntrega = new Date(item.prazoEntrega + 'T00:00:00');
                } else if (typeof item.prazoEntrega.toDate === 'function') {
                    prazoEntrega = item.prazoEntrega.toDate();
                } else {
                    prazoEntrega = new Date(item.prazoEntrega);
                }
            } catch (e) {
                console.warn('Erro ao converter prazoEntrega do item:', e);
            }
        }
        
        // Validar se a data é válida
        if (prazoEntrega && isNaN(prazoEntrega.getTime())) {
            prazoEntrega = null;
        }
        
        return prazoEntrega;
    }

    // Obter status do prazo de entrega
    obterStatusPrazo(dataPrazo) {
        if (!dataPrazo) {
            return { texto: 'Não informado', classe: 'em-dia' };
        }
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const prazo = new Date(dataPrazo);
        prazo.setHours(0, 0, 0, 0);
        
        if (prazo < hoje) {
            return { texto: 'Atrasado', classe: 'atrasado' };
        } else if (prazo.getTime() === hoje.getTime()) {
            return { texto: 'Entrega Hoje', classe: 'hoje' };
        } else {
            const diffDias = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
            if (diffDias <= 7) {
                return { texto: `${diffDias} dia(s)`, classe: 'hoje' };
            } else {
                return { texto: 'Em dia', classe: 'em-dia' };
            }
        }
    }

    // Obter datas de entrega dos itens comprados
    obterDatasEntrega(itensComprados) {
        const datas = [];
        
        itensComprados.forEach(item => {
            const dataPrazo = this.obterDataPrazoEntrega(item);
            if (dataPrazo) {
                const dataFormatada = dataPrazo.toLocaleDateString('pt-BR');
                if (!datas.includes(dataFormatada)) {
                    datas.push(dataFormatada);
                }
            }
        });
        
        return datas.sort();
    }

    // Formatar informação de entrega para o card
    formatarInfoEntrega(datasEntrega) {
        if (datasEntrega.length === 0) {
            return '<div style="font-size: 0.6rem; color: #718096; font-weight: 600;">Sem prazo</div>';
        }
        
        if (datasEntrega.length === 1) {
            // Todos os itens têm a mesma data
            return `<div style="font-size: 0.6rem; color: #4299e1; font-weight: 600;">Entrega: ${datasEntrega[0]}</div>`;
        }
        
        // Múltiplas datas
        return '<div style="font-size: 0.6rem; color: #4299e1; font-weight: 600;">Múltiplas datas</div>';
    }

    // Obter dados de recebimento para uma lista de itens
    async obterDadosRecebimento(itens, pedidoId) {
        const resultado = {
            totalAReceber: 0,
            totalRecebido: 0,
            itensAReceber: [],
            itensRecebidos: [],
            ultimoStatus: null
        };

        for (const item of itens) {
            try {
                // Buscar dados do item no Firebase
                const itemSnapshot = await db.collection('itens')
                    .where('pedidoId', '==', pedidoId)
                    .where('codigo', '==', item.codigo || item.nome)
                    .get();

                if (!itemSnapshot.empty) {
                    const dadosItem = itemSnapshot.docs[0].data();
                    
                    // A Receber: usar qtdeComprada
                    const qtdeAReceber = parseFloat(dadosItem.qtdeComprada) || 0;
                    if (qtdeAReceber > 0) {
                        resultado.totalAReceber += qtdeAReceber;
                        resultado.itensAReceber.push({
                            nome: dadosItem.nome || item.nome,
                            codigo: dadosItem.codigo || item.codigo,
                            quantidade: qtdeAReceber,
                            unidade: dadosItem.unidade || item.unidade || 'un',
                            descricao: dadosItem.descricao || item.descricao || '',
                            fornecedor: dadosItem.fornecedor || 'Não informado',
                            prazoEntrega: dadosItem.prazoEntrega || null,
                            pedidoId: pedidoId
                        });
                    }

                    // Recebido: usar historicoRecebimentos
                    if (dadosItem.historicoRecebimentos && Array.isArray(dadosItem.historicoRecebimentos)) {
                        let totalRecebidoItem = 0;
                        let ultimoRecebimento = null;

                        // Ordenar por data para pegar o mais recente
                        const historico = dadosItem.historicoRecebimentos.sort((a, b) => {
                            const dataA = a.dataRecebimento?.toDate ? a.dataRecebimento.toDate() : new Date(a.dataRecebimento || 0);
                            const dataB = b.dataRecebimento?.toDate ? b.dataRecebimento.toDate() : new Date(b.dataRecebimento || 0);
                            return dataB - dataA; // Mais recente primeiro
                        });

                        // Somar todas as quantidades recebidas
                        historico.forEach(recebimento => {
                            const qtde = parseFloat(recebimento.qtde) || 0;
                            totalRecebidoItem += qtde;
                        });

                        // Pegar último status
                        if (historico.length > 0) {
                            ultimoRecebimento = historico[0];
                            resultado.ultimoStatus = ultimoRecebimento.status || ultimoRecebimento.statusRecebimento || 'Recebido';
                        }

                        if (totalRecebidoItem > 0) {
                            resultado.totalRecebido += totalRecebidoItem;
                            resultado.itensRecebidos.push({
                                nome: dadosItem.nome || item.nome,
                                codigo: dadosItem.codigo || item.codigo,
                                quantidade: totalRecebidoItem,
                                unidade: dadosItem.unidade || item.unidade || 'un',
                                descricao: dadosItem.descricao || item.descricao || '',
                                fornecedor: dadosItem.fornecedor || 'Não informado',
                                dataRecebimento: ultimoRecebimento?.dataRecebimento || null,
                                status: ultimoRecebimento?.status || ultimoRecebimento?.statusRecebimento || 'Recebido',
                                responsavel: ultimoRecebimento?.responsavel || 'Não informado',
                                pedidoId: pedidoId
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Erro ao obter dados de recebimento do item:', item, error);
            }
        }

        return resultado;
    }

    // Obter dados de empenho para uma lista de itens
    async obterDadosEmpenho(itens, pedidoId) {
        const resultado = {
            totalAEmpenhar: 0,
            totalEmpenhado: 0,
            itensAEmpenhar: [],
            itensEmpenhados: [],
            ultimoStatus: null
        };

        for (const item of itens) {
            try {
                // Buscar dados do item no Firebase
                const itemSnapshot = await db.collection('itens')
                    .where('pedidoId', '==', pedidoId)
                    .where('codigo', '==', item.codigo || item.nome)
                    .get();

                if (!itemSnapshot.empty) {
                    const dadosItem = itemSnapshot.docs[0].data();
                    
                    // A Empenhar: usar quantidade literal do campo "quantidade"
                    const qtdeAEmpenhar = parseFloat(dadosItem.quantidade) || 0;
                    if (qtdeAEmpenhar > 0) {
                        resultado.totalAEmpenhar += qtdeAEmpenhar;
                        resultado.itensAEmpenhar.push({
                            nome: dadosItem.nome || item.nome,
                            codigo: dadosItem.codigo || item.codigo,
                            quantidade: qtdeAEmpenhar,
                            unidade: dadosItem.unidade || item.unidade || 'un',
                            descricao: dadosItem.descricao || item.descricao || '',
                            pedidoId: pedidoId
                        });
                    }

                    // Empenhado: usar qtdeAlocada para contar quantidade empenhada
                    const qtdeEmpenhada = parseFloat(dadosItem.qtdeAlocada) || 0;
                    if (qtdeEmpenhada > 0) {
                        resultado.totalEmpenhado += qtdeEmpenhada;
                        resultado.itensEmpenhados.push({
                            nome: dadosItem.nome || item.nome,
                            codigo: dadosItem.codigo || item.codigo,
                            quantidade: qtdeEmpenhada,
                            unidade: dadosItem.unidade || item.unidade || 'un',
                            descricao: dadosItem.descricao || item.descricao || '',
                            dataEmpenho: dadosItem.dataAlocacao || dadosItem.dataEmpenho || null,
                            responsavel: dadosItem.responsavelAlocacao || dadosItem.responsavelEmpenho || 'Não informado',
                            status: dadosItem.statusAlocacao || dadosItem.statusEmpenho || 'Empenhado',
                            pedidoId: pedidoId
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao obter dados de empenho do item:', item, error);
            }
        }

        return resultado;
    }

    // Mostrar detalhes do empenho
    async mostrarDetalhesEmpenho(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'a_empenhar') {
                        // Detalhes para itens a empenhar
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-orange-600">Aguardando Empenho</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Detalhes para itens empenhados
                        const dataEmpenho = item.dataEmpenho ? 
                            (typeof item.dataEmpenho === 'string' ? item.dataEmpenho : 
                             item.dataEmpenho.toDate ? item.dataEmpenho.toDate().toLocaleDateString('pt-BR') :
                             new Date(item.dataEmpenho).toLocaleDateString('pt-BR')) 
                            : 'Não informado';
                        
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-green-600">${item.status}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Data Empenho:</span>
                                    <span class="font-medium text-gray-800">${dataEmpenho}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Responsável:</span>
                                    <span class="font-medium text-gray-800">${item.responsavel}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do empenho:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Mostrar detalhes do recebimento
    async mostrarDetalhesRecebimento(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'a_receber') {
                        // Detalhes para itens a receber
                        const prazoInfo = item.prazoEntrega ? 
                            (typeof item.prazoEntrega === 'string' ? item.prazoEntrega : new Date(item.prazoEntrega).toLocaleDateString('pt-BR')) 
                            : 'Não informado';
                        
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Fornecedor:</span>
                                    <span class="font-medium text-gray-800">${item.fornecedor}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Prazo de Entrega:</span>
                                    <span class="font-medium text-gray-800">${prazoInfo}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Detalhes para itens recebidos
                        const dataRecebimento = item.dataRecebimento ? 
                            (typeof item.dataRecebimento === 'string' ? item.dataRecebimento : 
                             item.dataRecebimento.toDate ? item.dataRecebimento.toDate().toLocaleDateString('pt-BR') :
                             new Date(item.dataRecebimento).toLocaleDateString('pt-BR')) 
                            : 'Não informado';
                        
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-green-600">${item.status}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Data Recebimento:</span>
                                    <span class="font-medium text-gray-800">${dataRecebimento}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Responsável:</span>
                                    <span class="font-medium text-gray-800">${item.responsavel}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do recebimento:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Obter dados de compra para uma lista de itens
    async obterDadosCompra(itens, pedidoId) {
        const resultado = {
            totalParaComprar: 0,
            totalComprado: 0,
            itensParaComprar: [],
            itensComprados: []
        };

        for (const item of itens) {
            try {
                let quantidadeComprar = 0;
                let qtdeComprada = 0;
                let dadosItem = null;
                
                // Primeiro, tentar buscar dados de análise de estoque tratados
                const analiseSnapshot = await db.collection('analiseEstoque')
                    .where('pedidoId', '==', pedidoId)
                    .where('itemCodigo', '==', item.codigo || item.nome)
                    .get();
                
                if (!analiseSnapshot.empty) {
                    // Item já foi tratado na análise - usar valores salvos
                    const analiseDoc = analiseSnapshot.docs[0].data();
                    quantidadeComprar = parseFloat(analiseDoc.quantidadeComprar) || 0;
                    qtdeComprada = parseFloat(analiseDoc.qtdeComprada) || 0;
                    dadosItem = analiseDoc;
                } else {
                    // Item ainda não foi tratado - buscar na coleção 'itens' pelos campos diretos
                    const itemSnapshot = await db.collection('itens')
                        .where('pedidoId', '==', pedidoId)
                        .where('codigo', '==', item.codigo)
                        .get();
                    
                    if (!itemSnapshot.empty) {
                        const itemData = itemSnapshot.docs[0].data();
                        quantidadeComprar = parseFloat(itemData.quantidadeComprar) || 0;
                        qtdeComprada = parseFloat(itemData.qtdeComprada) || 0;
                        dadosItem = itemData;
                    }
                }
                
                resultado.totalParaComprar += quantidadeComprar;
                resultado.totalComprado += qtdeComprada;
                
                if (quantidadeComprar > 0) {
                    resultado.itensParaComprar.push({
                        nome: dadosItem?.nome || dadosItem?.material || item.nome,
                        codigo: dadosItem?.codigo || item.codigo,
                        quantidade: quantidadeComprar,
                        unidade: dadosItem?.unidade || item.unidade || 'un',
                        descricao: dadosItem?.descricao || item.descricao || '',
                        pedidoId: pedidoId
                    });
                }
                
                if (qtdeComprada > 0) {
                    resultado.itensComprados.push({
                        nome: dadosItem?.nome || dadosItem?.material || item.nome,
                        codigo: dadosItem?.codigo || item.codigo,
                        quantidade: qtdeComprada,
                        unidade: dadosItem?.unidade || item.unidade || 'un',
                        descricao: dadosItem?.descricao || item.descricao || '',
                        fornecedor: dadosItem?.fornecedor || 'Não informado',
                        prazoEntrega: dadosItem?.prazoEntrega || 'Não informado',
                        ordemCompra: dadosItem?.ordemCompra || null,
                        pedidoId: pedidoId
                    });
                }
            } catch (error) {
                console.error('Erro ao obter dados de compra do item:', item, error);
            }
        }
        
        return resultado;
    }

    // Criar item de resumo
    criarSummaryItem(numero, label, onClick) {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <div class="summary-number">${numero}</div>
            <div class="summary-label">${label}</div>
        `;
        
        if (onClick) {
            item.addEventListener('click', onClick);
        }
        
        return item;
    }

    // Mostrar detalhes dos itens no modal
    mostrarDetalhesItens(itens, titulo, tipo = '') {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '';
        
        if (!itens || itens.length === 0) {
            modalContent.innerHTML = '<p class="text-gray-500">Nenhum item encontrado.</p>';
        } else {
            itens.forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = 'item-detail-card';
                itemCard.innerHTML = `
                    <div class="item-name">${item.nome || item.codigo || 'Item sem nome'}</div>
                    ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                        <div style="font-size: 0.875rem; color: #718096;">
                            Código: ${item.codigo || 'N/A'}
                        </div>
                        <div class="item-quantity">
                            ${Math.round(parseFloat(item.quantidade || 0))} ${item.unidade || 'un'}
                        </div>
                    </div>
                `;
                modalContent.appendChild(itemCard);
            });
        }
        
        modal.classList.remove('hidden');
    }

    // Mostrar detalhes das quantidades (versão alternativa)
    mostrarDetalhesQuantidades(itens, titulo) {
        this.mostrarDetalhesItens(itens, titulo);
    }
    
    // Mostrar detalhes da compra
    async mostrarDetalhesCompra(itensBase, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itensBase.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itensBase.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'para_comprar') {
                        // Detalhes para itens a comprar
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                        `;
                    } else {
                        // Detalhes para itens já comprados (inclui fornecedor e prazo)
                        const prazo = item.prazoEntrega ? 
                            (typeof item.prazoEntrega === 'string' ? item.prazoEntrega : new Date(item.prazoEntrega).toLocaleDateString('pt-BR')) 
                            : 'Não informado';
                            
                        // Obter fornecedor e prazo de entrega do objeto ordemCompra se existir
                        let fornecedor = item.fornecedor || 'Não informado';
                        let prazoEntrega = prazo;
                        
                        if (item.ordemCompra) {
                            fornecedor = item.ordemCompra.fornecedor || fornecedor;
                            
                            if (item.ordemCompra.prazoEntrega) {
                                try {
                                    // Tentar converter prazoEntrega para formato legível
                                    const prazoDate = typeof item.ordemCompra.prazoEntrega.toDate === 'function' 
                                        ? item.ordemCompra.prazoEntrega.toDate() 
                                        : new Date(item.ordemCompra.prazoEntrega);
                                    prazoEntrega = prazoDate.toLocaleDateString('pt-BR');
                                } catch (e) {
                                    console.warn('Erro ao converter prazoEntrega da ordemCompra:', e);
                                    prazoEntrega = prazo; // Manter o valor original em caso de erro
                                }
                            }
                        }
                        
                        // Analisar status do prazo
                        const dataPrazo = this.obterDataPrazoEntrega(item);
                        const statusPrazo = this.obterStatusPrazo(dataPrazo);
                        
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Fornecedor:</span>
                                    <span class="font-medium text-gray-800">${fornecedor}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Prazo de Entrega:</span>
                                    <span class="font-medium text-gray-800">${prazoEntrega}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="prazo-badge ${statusPrazo.classe}" style="margin: 0;">${statusPrazo.texto}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes da compra:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Calcular dados para o resumo visual
    async calcularResumoVisual(lista, projeto) {
        const resumo = {
            compraInicial: { total: 0, comprado: 0, porcentagem: 0 },
            recebimento: { total: 0, recebido: 0, porcentagem: 0 },
            empenho: { status: 'Não', porcentagem: 0 },
            compraFinal: { total: 0, comprado: 0, porcentagem: 0 },
            recebimentoFinal: { total: 0, recebido: 0, porcentagem: 0 },
            separacao: { total: 0, separado: 0, porcentagem: 0 },
            mudancaFinal: { diferenca: 0, porcentagem: 0 }
        };

        // Compra Inicial
        const dadosCompra = await this.obterDadosCompra(lista.itens, projeto.pedidoId);
        resumo.compraInicial.total = dadosCompra.totalParaComprar + dadosCompra.totalComprado;
        resumo.compraInicial.comprado = dadosCompra.totalComprado;
        resumo.compraInicial.porcentagem = resumo.compraInicial.total > 0 ? 
            Math.round((resumo.compraInicial.comprado / resumo.compraInicial.total) * 100) : 0;

        // Recebimento
        const dadosRecebimento = await this.obterDadosRecebimento(lista.itens, projeto.pedidoId);
        resumo.recebimento.total = dadosRecebimento.totalAReceber + dadosRecebimento.totalRecebido;
        resumo.recebimento.recebido = dadosRecebimento.totalRecebido;
        resumo.recebimento.porcentagem = resumo.recebimento.total > 0 ? 
            Math.round((resumo.recebimento.recebido / resumo.recebimento.total) * 100) : 0;

        // Empenho - verificar se há itens empenhados
        const dadosEmpenho = await this.obterDadosEmpenho(lista.itens, projeto.pedidoId);
        const totalEmpenho = dadosEmpenho.totalAEmpenhar + dadosEmpenho.totalEmpenhado;
        if (totalEmpenho > 0) {
            const porcentagemEmpenho = Math.round((dadosEmpenho.totalEmpenhado / totalEmpenho) * 100);
            if (porcentagemEmpenho === 100) {
                resumo.empenho.status = 'Total';
            } else if (porcentagemEmpenho > 0) {
                resumo.empenho.status = 'Parcial';
            }
            resumo.empenho.porcentagem = porcentagemEmpenho;
        }

        // Compra Final
        const dadosCompraFinal = await this.obterDadosCompraFinal(lista.itens, projeto.pedidoId);
        resumo.compraFinal.total = dadosCompraFinal.totalAComprar + dadosCompraFinal.totalComprado;
        resumo.compraFinal.comprado = dadosCompraFinal.totalComprado;
        resumo.compraFinal.porcentagem = resumo.compraFinal.total > 0 ? 
            Math.round((resumo.compraFinal.comprado / resumo.compraFinal.total) * 100) : 0;

        // Recebimento Final
        const dadosRecebimentoFinal = await this.obterDadosRecebimentoFinal(lista.itens, projeto.pedidoId);
        resumo.recebimentoFinal.total = dadosRecebimentoFinal.totalAReceber + dadosRecebimentoFinal.totalRecebido;
        resumo.recebimentoFinal.recebido = dadosRecebimentoFinal.totalRecebido;
        resumo.recebimentoFinal.porcentagem = resumo.recebimentoFinal.total > 0 ? 
            Math.round((resumo.recebimentoFinal.recebido / resumo.recebimentoFinal.total) * 100) : 0;

        // Separação
        const dadosSeparacao = await this.obterDadosSeparacao(lista.itens, projeto.pedidoId);
        resumo.separacao.total = dadosSeparacao.totalParaSeparar + dadosSeparacao.totalSeparado;
        resumo.separacao.separado = dadosSeparacao.totalSeparado;
        resumo.separacao.porcentagem = resumo.separacao.total > 0 ? 
            Math.round((resumo.separacao.separado / resumo.separacao.total) * 100) : 0;

        // Mudança Final (diferença real entre lista produção e lista final)
        const dadosAnalise = await this.obterDadosAnaliseFinal(lista.itens, projeto.pedidoId);
        resumo.mudancaFinal.diferenca = Math.abs(dadosAnalise.totalListaProducao - dadosAnalise.totalListaFinal);
        resumo.mudancaFinal.valor = resumo.mudancaFinal.diferenca;

        return resumo;
    }

    // Criar HTML do resumo visual
    criarResumoVisual(resumoData) {
        // Verificar se há dados significativos para mostrar
        const temDados = resumoData.compraInicial.total > 0 || 
                         resumoData.recebimento.total > 0 || 
                         resumoData.empenho.porcentagem > 0 ||
                         resumoData.compraFinal.total > 0 || 
                         resumoData.recebimentoFinal.total > 0 || 
                         resumoData.separacao.total > 0 ||
                         resumoData.mudancaFinal.diferenca > 0;

        if (!temDados) {
            return ''; // Não mostrar resumo se não há dados
        }

        const items = [];

        // Adicionar itens apenas se tiverem dados
        if (resumoData.compraInicial.total > 0) {
            items.push(`<span class="summary-item">Compra inicial: ${resumoData.compraInicial.porcentagem}%</span>`);
        }

        if (resumoData.recebimento.total > 0) {
            items.push(`<span class="summary-item">Recebimento: ${resumoData.recebimento.porcentagem}%</span>`);
        }

        if (resumoData.empenho.porcentagem > 0) {
            items.push(`<span class="summary-item">Empenho: ${resumoData.empenho.status}</span>`);
        }

        if (resumoData.compraFinal.total > 0) {
            items.push(`<span class="summary-item">Compra final: ${resumoData.compraFinal.porcentagem}%</span>`);
        }

        if (resumoData.recebimentoFinal.total > 0) {
            items.push(`<span class="summary-item">Recebimento final: ${resumoData.recebimentoFinal.porcentagem}%</span>`);
        }

        if (resumoData.separacao.total > 0) {
            items.push(`<span class="summary-item">Separação: ${resumoData.separacao.porcentagem}%</span>`);
        }

        if (resumoData.mudancaFinal.diferenca > 0) {
            items.push(`<span class="summary-item">Mudança final: ${Math.round(resumoData.mudancaFinal.valor)}</span>`);
        }

        return items.length > 0 ? items.join(' / ') : '';
    }

    // Obter dados de separação
    async obterDadosSeparacao(itens, pedidoId) {
        const resultado = {
            totalParaSeparar: 0,
            totalSeparado: 0,
            itensParaSeparar: [],
            itensSeparados: []
        };

        for (const item of itens) {
            try {
                // Buscar dados na coleção separacaoProducao
                const separacaoSnapshot = await db.collection('separacaoProducao')
                    .where('pedidoId', '==', pedidoId)
                    .where('codigo', '==', item.codigo || item.nome)
                    .get();

                if (!separacaoSnapshot.empty) {
                    const dadosSeparacao = separacaoSnapshot.docs[0].data();
                    
                    // Para Separar: usar QtdItemNecFinal
                    const qtdeParaSeparar = parseFloat(dadosSeparacao.QtdItemNecFinal) || parseFloat(dadosSeparacao.qtdNecFinal) || 0;
                    if (qtdeParaSeparar > 0) {
                        resultado.totalParaSeparar += qtdeParaSeparar;
                        resultado.itensParaSeparar.push({
                            nome: dadosSeparacao.nome || item.nome,
                            codigo: dadosSeparacao.codigo || item.codigo,
                            quantidade: qtdeParaSeparar,
                            unidade: dadosSeparacao.unidade || item.unidade || 'un',
                            pedidoId: pedidoId
                        });
                    }

                    // Separado: usar qtdSeparada
                    const qtdeSeparada = parseFloat(dadosSeparacao.qtdSeparada) || 0;
                    if (qtdeSeparada > 0) {
                        resultado.totalSeparado += qtdeSeparada;
                        resultado.itensSeparados.push({
                            nome: dadosSeparacao.nome || item.nome,
                            codigo: dadosSeparacao.codigo || item.codigo,
                            quantidade: qtdeSeparada,
                            unidade: dadosSeparacao.unidade || item.unidade || 'un',
                            dataSeparacao: dadosSeparacao.dataSeparacao || null,
                            responsavel: dadosSeparacao.responsavel || 'Não informado',
                            pedidoId: pedidoId
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao obter dados de separação do item:', item, error);
            }
        }

        return resultado;
    }

    // Mostrar detalhes da análise de estoque (com dados tratados)
    async mostrarDetalhesAnaliseEstoque(itensBase, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            const itensDetalhados = [];
            
            for (const item of itensBase) {
                let quantidadeCorreta = 0;
                let dadosItem = {};
                
                // Primeiro tentar buscar dados da análise de estoque tratados
                const analiseSnapshot = await db.collection('analiseEstoque')
                    .where('pedidoId', '==', item.pedidoId || '')
                    .where('itemCodigo', '==', item.codigo || item.nome)
                    .get();
                
                if (!analiseSnapshot.empty) {
                    const analiseDoc = analiseSnapshot.docs[0].data();
                    quantidadeCorreta = tipo === 'alocados' 
                        ? parseFloat(analiseDoc.quantidadeAlocar) || 0
                        : parseFloat(analiseDoc.quantidadeComprar) || 0;
                    
                    dadosItem = {
                        nome: analiseDoc.itemNome || item.nome,
                        codigo: analiseDoc.itemCodigo || item.codigo,
                        unidade: analiseDoc.unidade || item.unidade || 'un',
                        descricao: analiseDoc.descricao || item.descricao || ''
                    };
                } else {
                    // Se não encontrou na análise, buscar diretamente na coleção 'itens'
                    const itemSnapshot = await db.collection('itens')
                        .where('pedidoId', '==', item.pedidoId || '')
                        .where('codigo', '==', item.codigo || item.nome)
                        .get();
                    
                    if (!itemSnapshot.empty) {
                        const itemData = itemSnapshot.docs[0].data();
                        quantidadeCorreta = tipo === 'alocados' 
                            ? parseFloat(itemData.quantidadeAlocar) || 0
                            : parseFloat(itemData.quantidadeComprar) || 0;
                        
                        dadosItem = {
                            nome: itemData.nome || itemData.material || item.nome,
                            codigo: itemData.codigo || item.codigo,
                            unidade: itemData.unidade || item.unidade || 'un',
                            descricao: itemData.descricao || item.descricao || ''
                        };
                    }
                }
                
                if (quantidadeCorreta > 0) {
                    itensDetalhados.push({
                        ...dadosItem,
                        quantidade: quantidadeCorreta
                    });
                }
            }
            
            modalContent.innerHTML = '';
            
            if (itensDetalhados.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500">Nenhum item processado encontrado. Os dados aparecerão após o tratamento na análise de estoque.</p>';
            } else {
                itensDetalhados.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    itemCard.innerHTML = `
                        <div class="item-name">${item.nome || 'Item sem nome'}</div>
                        ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                            <div style="font-size: 0.875rem; color: #718096;">
                                Código: ${item.codigo || 'N/A'}
                            </div>
                            <div class="item-quantity">
                                ${Math.round(parseFloat(item.quantidade))} ${item.unidade}
                            </div>
                        </div>
                    `;
                    modalContent.appendChild(itemCard);
                });
            }
            
        } catch (error) {
            console.error('Erro ao carregar detalhes da análise:', error);
            modalContent.innerHTML = '<p class="text-red-500">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Fechar modal padrão
        const closeModal = document.getElementById('closeModal');
        const modal = document.getElementById('itemModal');
        
        closeModal.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        // Fechar modal clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
        
        // ESC para fechar modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.classList.add('hidden');
            }
        });
    }

    // Mostrar loading
    mostrarLoading(show) {
        this.loading = show;
        const loadingState = document.getElementById('loadingState');
        
        if (show) {
            loadingState.classList.remove('hidden');
            this.ocultarEstados();
        } else {
            loadingState.classList.add('hidden');
        }
    }

    // Mostrar estado vazio
    mostrarEstadoVazio() {
        this.ocultarEstados();
        document.getElementById('emptyState').classList.remove('hidden');
    }

    // Mostrar erro
    mostrarErro(mensagem) {
        this.ocultarEstados();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'dashboard-card';
        errorDiv.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-xl font-semibold text-red-600 mb-2">Erro</h3>
                <p class="text-gray-600">${mensagem}</p>
                <button onclick="window.location.reload()" class="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                    Tentar Novamente
                </button>
            </div>
        `;
        
        document.querySelector('.dashboard-cliente-container').appendChild(errorDiv);
    }

    // Ocultar todos os estados
    ocultarEstados() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('clientesContainer').classList.add('hidden');
    }

    // Método de debug
    debug() {
        return {
            totalPedidos: this.pedidos.length,
            totalClientes: this.clientesData.size,
            loading: this.loading,
            clientes: Array.from(this.clientesData.values())
        };
    }

    // Obter dados de análise final para uma lista de itens
    async obterDadosAnaliseFinal(itens, pedidoId) {
        console.log('🔍 ANÁLISE FINAL - Iniciando busca para pedido:', pedidoId);
        console.log('🔍 ANÁLISE FINAL - Itens recebidos:', itens.length);
        
        const resultado = {
            totalQuantidadeInicial: 0,
            totalQuantidadeFinal: 0,
            itensQuantidadeInicial: [],
            itensQuantidadeFinal: []
        };

        for (const item of itens) {
            try {
                console.log('📝 Processando item:', item.codigo || item.nome);
                
                // Quantidade inicial: usar a quantidade original do item (cadastrada no pedido)
                const quantidadeInicial = parseFloat(item.quantidade) || 0;
                resultado.totalQuantidadeInicial += quantidadeInicial;
                
                if (quantidadeInicial > 0) {
                    resultado.itensQuantidadeInicial.push({
                        nome: item.nome || item.codigo,
                        codigo: item.codigo,
                        quantidade: quantidadeInicial,
                        unidade: item.unidade || 'un',
                        descricao: item.descricao || '',
                        pedidoId: pedidoId
                    });
                }

                // Quantidade final: buscar qtdNecFinal na coleção analiseItens
                console.log(`🔍 Buscando na coleção analiseItens para código: ${item.codigo || item.nome}`);
                
                // Primeiro, tentar buscar por pedidoId também
                let analiseSnapshot = await db.collection('analiseItens')
                    .where('codigo', '==', item.codigo || item.nome)
                    .where('pedidoId', '==', pedidoId)
                    .get();
                
                // Se não encontrou com pedidoId, tentar só com codigo
                if (analiseSnapshot.empty) {
                    analiseSnapshot = await db.collection('analiseItens')
                        .where('codigo', '==', item.codigo || item.nome)
                        .get();
                }
                
                // Se ainda não encontrou, tentar buscar na coleção 'itens' que pode ter qtdNecFinal
                if (analiseSnapshot.empty) {
                    console.log(`🔍 Tentando buscar na coleção 'itens' para código: ${item.codigo || item.nome}`);
                    analiseSnapshot = await db.collection('itens')
                        .where('codigo', '==', item.codigo || item.nome)
                        .where('pedidoId', '==', pedidoId)
                        .get();
                }
                
                console.log(`📊 Documentos encontrados: ${analiseSnapshot.size}`);
                
                if (!analiseSnapshot.empty) {
                    const analiseDoc = analiseSnapshot.docs[0].data();
                    console.log('📄 Dados do documento encontrado:', analiseDoc);
                    
                    // Tentar diferentes campos que podem conter a quantidade final
                    const quantidadeFinal = parseFloat(analiseDoc.qtdNecFinal) || 
                                          parseFloat(analiseDoc.quantidadeFinal) || 
                                          parseFloat(analiseDoc.qtdFinal) || 
                                          parseFloat(analiseDoc.quantidadeNecessaria) || 0;
                    
                    console.log(`📊 Quantidade final extraída: ${quantidadeFinal}`);
                    
                    if (quantidadeFinal > 0) {
                        resultado.totalQuantidadeFinal += quantidadeFinal;
                        resultado.itensQuantidadeFinal.push({
                            nome: analiseDoc.descricao || item.nome || item.codigo,
                            codigo: analiseDoc.codigo || item.codigo,
                            quantidade: quantidadeFinal,
                            unidade: item.unidade || 'un',
                            descricao: analiseDoc.descricao || item.descricao || '',
                            pedidoId: pedidoId
                        });
                    }
                } else {
                    console.log(`⚠️  Nenhum documento encontrado em nenhuma coleção para código: ${item.codigo || item.nome}`);
                    console.log(`💡 SUGESTÃO: Verifique se os dados foram processados na análise de estoque!`);
                }
            } catch (error) {
                console.error('❌ Erro ao obter dados de análise final do item:', item, error);
            }
        }

        console.log('✅ ANÁLISE FINAL - Resultado final:', resultado);
        
        // Renomear propriedades para corresponder ao que o código espera
        return {
            totalListaInicial: resultado.totalQuantidadeInicial,
            totalListaProducao: resultado.totalQuantidadeFinal,
            totalListaFinal: resultado.totalQuantidadeFinal, // Adicionando referência para lista final
            itensListaInicial: resultado.itensQuantidadeInicial || [],
            itensListaProducao: resultado.itensQuantidadeFinal || [],
            itensListaFinal: resultado.itensQuantidadeFinal || [] // Adicionando referência para lista final
        };
    }

    // Obter dados de compra final para uma lista de itens
    async obterDadosCompraFinal(itens, pedidoId) {
        console.log('🛒 COMPRA FINAL - Iniciando busca para pedido:', pedidoId);
        console.log('🛒 COMPRA FINAL - Itens recebidos:', itens.length);
        
        const resultado = {
            totalAComprar: 0,
            totalComprado: 0,
            itensAComprar: [],
            itensComprados: []
        };
        
        // Para contar NÚMERO DE ITENS únicos, não somar quantidades
        const itensComPendente = new Set();
        const itensComComprado = new Set();
        
        // Buscar TODOS os itens que têm historicoCompraFinal na coleção
        const todosItensComHistorico = await db.collection('itens')
            .where('historicoCompraFinal', '!=', null)
            .get();
        
        // CORREÇÃO: Usar TODOS os itens que têm historicoCompraFinal, não apenas os da lista original
        const itensParaProcessar = new Set();
        
        // Adicionar itens da lista original
        itens.forEach(item => {
            itensParaProcessar.add(JSON.stringify({
                codigo: item.codigo || item.nome,
                nome: item.nome,
                unidade: item.unidade,
                descricao: item.descricao
            }));
        });
        
        // Adicionar TODOS os itens que têm historicoCompraFinal (que podem não estar na lista original)
        todosItensComHistorico.forEach(doc => {
            const data = doc.data();
            itensParaProcessar.add(JSON.stringify({
                codigo: data.codigo,
                nome: data.descricao || data.codigo,
                unidade: 'un', // padrão
                descricao: data.descricao
            }));
        });
        
        const itensUnicos = Array.from(itensParaProcessar).map(item => JSON.parse(item));

        for (const item of itensUnicos) {
            try {
                // Buscar dados do item na coleção 'itens' do Firebase
                const itemSnapshot = await db.collection('itens')
                    .where('codigo', '==', item.codigo || item.nome)
                    .get();
                
                // Se não encontrou, tentar buscar sem o pedidoId para debug
                if (itemSnapshot.empty) {
                    console.log(`⚠️ Não encontrou com pedidoId. Tentando buscar apenas por código: "${item.codigo}"`);
                    const itemSnapshotSemPedido = await db.collection('itens')
                        .where('codigo', '==', item.codigo || item.nome)
                        .get();
                    console.log(`🔍 Resultado da busca sem pedidoId: ${itemSnapshotSemPedido.size} documentos`);
                    itemSnapshotSemPedido.forEach(doc => {
                        console.log(`📄 Documento encontrado:`, doc.id, doc.data());
                    });
                }
                
                if (!itemSnapshot.empty) {
                    const itemDoc = itemSnapshot.docs[0].data();
                    
                    // Quantidade a comprar (buscar no array historicoCompraFinal campo "qtde")
                    let quantidadeAComprar = 0;
                    const historicoCompras = itemDoc.historicoCompraFinal || [];
                    
                    // Somar quantidades do campo "qtde" apenas dos itens com status "Pendente" 
                    if (Array.isArray(historicoCompras) && historicoCompras.length > 0) {
                        quantidadeAComprar = historicoCompras.reduce((total, compra) => {
                            // Só contar se o status é "Pendente"
                            if (compra.status === "Pendente") {
                                return total + (parseFloat(compra.qtde) || 0);
                            }
                            return total;
                        }, 0);
                    }
                    
                    if (quantidadeAComprar > 0) {
                        // Contar NÚMERO DE ITENS únicos, não somar quantidades
                        itensComPendente.add(item.codigo);
                        resultado.totalAComprar = itensComPendente.size;
                        
                        // Adicionar detalhes apenas dos itens com status "Pendente"
                        historicoCompras.forEach(compra => {
                            const qtdeAComprar = parseFloat(compra.qtde) || 0;
                            if (qtdeAComprar > 0 && compra.status === "Pendente") {
                                resultado.itensAComprar.push({
                                    nome: itemDoc.descricao || item.nome || item.codigo,
                                    codigo: itemDoc.codigo || item.codigo,
                                    quantidade: qtdeAComprar,
                                    unidade: item.unidade || 'un',
                                    descricao: itemDoc.descricao || item.descricao || '',
                                    pedidoId: pedidoId
                                });
                            }
                        });
                    }
                    
                    // Quantidade comprada (histórico de compras - campo qtdeComprada)
                    let quantidadeComprada = 0;
                    
                    if (Array.isArray(historicoCompras) && historicoCompras.length > 0) {
                        quantidadeComprada = historicoCompras.reduce((total, compra) => {
                            return total + (parseFloat(compra.qtdeComprada) || 0);
                        }, 0);
                        
                        if (quantidadeComprada > 0) {
                            // Contar NÚMERO DE ITENS únicos, não somar quantidades
                            itensComComprado.add(item.codigo);
                            resultado.totalComprado = itensComComprado.size;
                            
                            // Adicionar detalhes de cada compra
                            historicoCompras.forEach(compra => {
                                const qtdeComprada = parseFloat(compra.qtdeComprada) || 0;
                                if (qtdeComprada > 0) {
                                    resultado.itensComprados.push({
                                        nome: itemDoc.descricao || item.nome || item.codigo,
                                        codigo: itemDoc.codigo || item.codigo,
                                        quantidade: qtdeComprada,
                                        unidade: item.unidade || 'un',
                                        descricao: itemDoc.descricao || item.descricao || '',
                                        pedidoId: pedidoId,
                                        fornecedor: compra.fornecedor || 'N/A'
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Erro ao obter dados de compra final do item:', item, error);
            }
        }

        return resultado;
    }

    // Mostrar detalhes da compra final
    async mostrarDetalhesCompraFinal(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'a_comprar') {
                        // Detalhes para itens a comprar
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-orange-600">Pendente Compra</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Detalhes para itens comprados
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Fornecedor:</span>
                                    <span class="font-medium">${item.fornecedor || 'N/A'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Data Compra:</span>
                                    <span class="font-medium">${item.dataCompra || 'N/A'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Prazo Entrega:</span>
                                    <span class="font-medium">${item.prazoEntrega || 'N/A'}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao exibir detalhes da compra final:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Mostrar detalhes da análise final
    async mostrarDetalhesAnaliseFinal(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'quantidade_inicial') {
                        // Detalhes para quantidade inicial (cadastrada no pedido)
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Tipo:</span>
                                    <span class="font-medium text-blue-600">Quantidade Original</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Detalhes para quantidade final (qtdNecFinal)
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Tipo:</span>
                                    <span class="font-medium text-green-600">Quantidade Necessária Final</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes da análise final:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Obter dados de recebimento final para uma lista de itens
    async obterDadosRecebimentoFinal(itens, pedidoId) {
        console.log('📦 RECEBIMENTO FINAL - Iniciando busca para pedido:', pedidoId);
        console.log('📦 RECEBIMENTO FINAL - Itens recebidos:', itens.length);
        
        const resultado = {
            totalAReceber: 0,
            totalRecebido: 0,
            itensAReceber: [],
            itensRecebidos: []
        };

        // Primeira busca: Todos os itens que têm historicoCompraFinal (compras da etapa final)
        console.log('🔍 Buscando todos os itens com historicoCompraFinal...');
        const todosItensComHistorico = await db.collection('itens')
            .where('historicoCompraFinal', '!=', null)
            .get();
        
        console.log(`📋 Encontrados ${todosItensComHistorico.size} itens com historicoCompraFinal`);
        
        // Para cada item que tem historicoCompraFinal, verificar recebimento
        for (const doc of todosItensComHistorico.docs) {
            try {
                const itemDoc = doc.data();
                const codigo = itemDoc.codigo;
                
                console.log(`🔍 Processando item: ${codigo}`);
                
                // Verificar histórico de compra final para calcular quantidade comprada total
                let qtdeCompradaTotal = 0;
                if (itemDoc.historicoCompraFinal && Array.isArray(itemDoc.historicoCompraFinal)) {
                    qtdeCompradaTotal = itemDoc.historicoCompraFinal.reduce((total, compra) => {
                        return total + (parseFloat(compra.qtdeComprada) || 0);
                    }, 0);
                }
                
                // Verificar histórico de recebimentos (campo correto: historicoRecebimentos)
                let qtdeRecebidaTotal = 0;
                if (itemDoc.historicoRecebimentos && Array.isArray(itemDoc.historicoRecebimentos)) {
                    // CORREÇÃO: Aceitar TODOS os recebimentos relacionados ao item de compra final
                    // Não filtrar apenas por 'Final', pois pode estar marcado diferente
                    qtdeRecebidaTotal = itemDoc.historicoRecebimentos.reduce((total, recebimento) => {
                        return total + (parseFloat(recebimento.qtde) || parseFloat(recebimento.qtdeRecebida) || 0);
                    }, 0);
                    
                    console.log(`📦 Item ${codigo} - Histórico de recebimentos encontrado:`, {
                        totalRecebimentos: itemDoc.historicoRecebimentos.length,
                        recebimentosDetalhes: itemDoc.historicoRecebimentos.map(r => ({
                            tipo: r.tipoRecebimento,
                            qtde: r.qtde || r.qtdeRecebida,
                            data: r.data
                        })),
                        qtdeRecebidaTotal
                    });
                }
                
                // Calcular quantidade a receber (comprada - já recebida)
                const qtdeAReceber = Math.max(0, qtdeCompradaTotal - qtdeRecebidaTotal);
                
                console.log(`📊 Item ${codigo}: Comprada=${qtdeCompradaTotal}, Recebida=${qtdeRecebidaTotal}, A Receber=${qtdeAReceber}`);
                
                // Adicionar aos totais
                resultado.totalAReceber += qtdeAReceber;
                resultado.totalRecebido += qtdeRecebidaTotal;
                
                // Adicionar aos arrays se há quantidade relevante
                if (qtdeAReceber > 0) {
                    resultado.itensAReceber.push({
                        nome: itemDoc.descricao || itemDoc.nome || codigo,
                        codigo: codigo,
                        quantidade: qtdeAReceber,
                        unidade: itemDoc.unidade || 'un',
                        descricao: itemDoc.descricao || '',
                        fornecedor: itemDoc.fornecedor || 'Não informado',
                        pedidoId: pedidoId,
                        tipo: 'Final'
                    });
                }

                if (qtdeRecebidaTotal > 0) {
                    resultado.itensRecebidos.push({
                        nome: itemDoc.descricao || itemDoc.nome || codigo,
                        codigo: codigo,
                        quantidade: qtdeRecebidaTotal,
                        unidade: itemDoc.unidade || 'un',
                        descricao: itemDoc.descricao || '',
                        fornecedor: itemDoc.fornecedor || 'Não informado',
                        pedidoId: pedidoId,
                        tipo: 'Final'
                    });
                }
                
            } catch (error) {
                console.error('Erro ao processar item do historicoCompraFinal:', error);
            }
        }

        console.log('✅ RECEBIMENTO FINAL - Resultado final:', resultado);
        return resultado;
    }

    // Obter dados de separação para uma lista de itens
    async obterDadosSeparacao(itens, pedidoId) {
        console.log('🔧 SEPARAÇÃO - Iniciando busca para pedido:', pedidoId);
        
        const resultado = {
            totalASeparar: 0,
            totalSeparado: 0,
            itensASeparar: [],
            itensSeparados: []
        };

        for (const item of itens) {
            try {
                // Buscar dados do item na coleção 'itens' do Firebase
                const itemSnapshot = await db.collection('itens')
                    .where('codigo', '==', item.codigo || item.nome)
                    .get();

                if (!itemSnapshot.empty) {
                    // Pode haver múltiplos documentos, vamos processar todos
                    for (const doc of itemSnapshot.docs) {
                        const itemDoc = doc.data();
                        
                        // Verificar se tem QtdItemNecFinal (quantidade para separar)
                        const qtdItemNecFinal = parseFloat(itemDoc.QtdItemNecFinal) || 0;
                        
                        if (qtdItemNecFinal > 0) {
                            // Verificar se já foi separado
                            const qtdProducao = parseFloat(itemDoc.qtdProducao) || 0;
                            const statusItem = itemDoc.statusItem || '';
                            
                            if (qtdProducao > 0 || statusItem === 'Separado para Produção') {
                                // Item já foi separado
                                resultado.totalSeparado += qtdProducao || qtdItemNecFinal;
                                resultado.itensSeparados.push({
                                    nome: itemDoc.descricao || itemDoc.nome || item.nome || item.codigo,
                                    codigo: itemDoc.codigo || item.codigo,
                                    quantidade: qtdProducao || qtdItemNecFinal,
                                    unidade: item.unidade || 'un',
                                    descricao: itemDoc.descricao || item.descricao || '',
                                    statusItem: statusItem,
                                    dataSeparacao: itemDoc.dataSeparacao || null,
                                    pedidoId: pedidoId
                                });
                            } else {
                                // Item ainda precisa ser separado
                                resultado.totalASeparar += qtdItemNecFinal;
                                resultado.itensASeparar.push({
                                    nome: itemDoc.descricao || itemDoc.nome || item.nome || item.codigo,
                                    codigo: itemDoc.codigo || item.codigo,
                                    quantidade: qtdItemNecFinal,
                                    unidade: item.unidade || 'un',
                                    descricao: itemDoc.descricao || item.descricao || '',
                                    statusItem: statusItem || 'Aguardando Separação',
                                    pedidoId: pedidoId
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Erro ao obter dados de separação do item:', item, error);
            }
        }

        console.log('✅ SEPARAÇÃO - Resultado:', resultado);
        return resultado;
    }

    // Mostrar detalhes do recebimento final
    async mostrarDetalhesRecebimentoFinal(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'a_receber') {
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Fornecedor:</span>
                                    <span class="font-medium text-gray-800">${item.fornecedor}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-orange-600">Aguardando Recebimento Final</span>
                                </div>
                            </div>
                        `;
                    } else {
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Fornecedor:</span>
                                    <span class="font-medium text-gray-800">${item.fornecedor}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-green-600">Recebido Final</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do recebimento final:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }

    // Mostrar detalhes da separação
    async mostrarDetalhesSeparacao(itens, titulo, tipo) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = titulo;
        modalContent.innerHTML = '<div class="text-center py-4">Carregando itens...</div>';
        modal.classList.remove('hidden');
        
        try {
            modalContent.innerHTML = '';
            
            if (itens.length === 0) {
                modalContent.innerHTML = '<p class="text-gray-500 p-4">Nenhum item encontrado.</p>';
            } else {
                itens.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-detail-card';
                    
                    if (tipo === 'a_separar') {
                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-orange-600">${item.statusItem}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        const dataSeparacao = item.dataSeparacao ? 
                            (typeof item.dataSeparacao === 'string' ? item.dataSeparacao : 
                             item.dataSeparacao.toDate ? item.dataSeparacao.toDate().toLocaleDateString('pt-BR') :
                             new Date(item.dataSeparacao).toLocaleDateString('pt-BR')) 
                            : 'Não informado';

                        itemCard.innerHTML = `
                            <div class="item-name">${item.nome || 'Item sem nome'}</div>
                            ${item.descricao ? `<div style="font-size: 0.875rem; color: #4a5568; margin: 0.5rem 0;">${item.descricao}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #718096;">
                                    Código: ${item.codigo || 'N/A'}
                                </div>
                                <div class="item-quantity">
                                    ${Math.round(parseFloat(item.quantidade))} ${item.unidade || 'un'}
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium text-green-600">${item.statusItem}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                    <span class="text-gray-600">Data Separação:</span>
                                    <span class="font-medium text-gray-800">${dataSeparacao}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    modalContent.appendChild(itemCard);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes da separação:', error);
            modalContent.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar detalhes dos itens.</p>';
        }
    }
}

// Criar instância global
window.DashboardCliente = new DashboardCliente();

// Debug helper
window.debugDashboard = () => {
    console.log('Dashboard Debug:', window.DashboardCliente.debug());
    return window.DashboardCliente.debug();
};