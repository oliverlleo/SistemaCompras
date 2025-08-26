/**
 * Módulo de Análise de Estoque
 * Sistema de confronto entre necessidades do pedido e estoque disponível
 */

class AnaliseEstoqueManager {
    constructor() {
        this.pedidoSelecionado = null;
        this.listaMaterialSelecionada = null;
        this.itensPedido = [];
        this.mapaEstoque = {};
        this.itensConfronto = [];
        this.isProcessingFile = false;
        this.selectedItems = new Set();
        this.lastSelectedIndex = -1;
        
        this.init();
    }

    init() {
        console.log('🔄 Inicializando Análise de Estoque Manager...');
        this.setupEventListeners();
        this.loadPedidosPendentes();
    }

    setupEventListeners() {
        // Seleção de pedido
        const selectPedido = document.getElementById('selectPedido');
        if (selectPedido) {
            selectPedido.addEventListener('change', (e) => {
                this.onPedidoSelecionado(e.target.value);
            });
        }

        // Seleção de lista de material
        const selectListaMaterial = document.getElementById('selectListaMaterial');
        if (selectListaMaterial) {
            selectListaMaterial.addEventListener('change', (e) => {
                this.onListaMaterialSelecionada(e.target.value);
            });
        }

        // Upload de arquivo
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileEstoque');
        const uploadBtn = document.getElementById('uploadBtn');

        if (uploadZone && fileInput) {
            // Drag and drop
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });

            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });

            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.processarArquivoEstoque(files[0]);
                }
            });

            // Click para upload - Corrigido para evitar ciclo infinito
            uploadZone.addEventListener('click', (e) => {
                // Verificar se o clique não foi no botão (que já tem seu próprio listener)
                if (e.target !== uploadBtn && !uploadBtn.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInput.click();
                }
            });

            fileInput.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.files.length > 0) {
                    this.processarArquivoEstoque(e.target.files[0]);
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Impedir propagação para o uploadZone
                fileInput.click();
            });
        }

        // Botão voltar para dashboard
        const btnVoltar = document.getElementById('btnVoltar');
        if (btnVoltar) {
            btnVoltar.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Controles de seleção em massa
        this.setupBulkControls();
        
        // Modal de quantidade
        this.setupQuantityModal();
    }

    setupBulkControls() {
        // Checkbox principal (selecionar todos)
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                this.toggleSelectAll();
            });
        }

        // Botão "Selecionar Todos"
        const btnSelectAll = document.getElementById('btnSelectAll');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', () => {
                this.selectAllItems();
            });
        }

        // Botões de ações em massa
        const btnBulkAllocate = document.getElementById('btnBulkAllocate');
        if (btnBulkAllocate) {
            btnBulkAllocate.addEventListener('click', () => {
                this.bulkAllocateItems();
            });
        }

        const btnBulkPurchase = document.getElementById('btnBulkPurchase');
        if (btnBulkPurchase) {
            btnBulkPurchase.addEventListener('click', () => {
                this.showQuantityModal(Array.from(this.selectedItems), 'bulk');
            });
        }
    }

    setupQuantityModal() {
        const modal = document.getElementById('quantityModal');
        const closeBtn = document.getElementById('quantityModalClose');
        const cancelBtn = document.getElementById('quantityModalCancel');
        const confirmBtn = document.getElementById('quantityModalConfirm');

        // Fechar modal
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.hideQuantityModal();
                });
            }
        });

        // Confirmar ação
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmQuantityAction();
            });
        }

        // Fechar modal clicando fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideQuantityModal();
                }
            });
        }
    }

    async loadPedidosPendentes() {
        try {
            const selectPedido = document.getElementById('selectPedido');
            if (!selectPedido) return;

            selectPedido.innerHTML = '<option value="">Carregando pedidos...</option>';

            // Buscar pedidos com status "Pendente de Análise"
            // Removendo orderBy para evitar necessidade de índice composto
            const snapshot = await db.collection('pedidos')
                .where('statusGeral', '==', 'Pendente de Análise')
                .get();

            selectPedido.innerHTML = '<option value="">Selecione um pedido</option>';

            if (snapshot.empty) {
                selectPedido.innerHTML = '<option value="">Nenhum pedido pendente encontrado</option>';
                this.showMessage('Nenhum pedido pendente de análise encontrado.', 'info');
                return;
            }

            // Converter para array e ordenar manualmente
            const pedidos = [];
            snapshot.forEach(doc => {
                pedidos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Ordenar por data de criação (mais recente primeiro)
            pedidos.sort((a, b) => {
                const dataA = a.dataCriacao?.toDate?.() || new Date(0);
                const dataB = b.dataCriacao?.toDate?.() || new Date(0);
                return dataB - dataA;
            });

            // Adicionar opções ao select
            pedidos.forEach(pedido => {
                const option = document.createElement('option');
                option.value = pedido.id;
                option.textContent = `${pedido.clienteNome} - Pedido ${pedido.numeroPedido}`;
                selectPedido.appendChild(option);
            });

            console.log(`✅ ${snapshot.size} pedidos pendentes carregados`);

        } catch (error) {
            console.error('❌ Erro ao carregar pedidos:', error);
            this.showMessage('Erro ao carregar pedidos. Verifique sua conexão.', 'error');
        }
    }

    async onPedidoSelecionado(pedidoId) {
        if (!pedidoId) {
            this.resetarSelecoes();
            return;
        }

        try {
            console.log('🔄 Carregando dados do pedido:', pedidoId);
            
            this.pedidoSelecionado = pedidoId;
            
            // Buscar listas de material únicas deste pedido
            const snapshot = await db.collection('itens')
                .where('pedidoId', '==', pedidoId)
                .get();

            if (snapshot.empty) {
                this.showMessage('Nenhum item encontrado para este pedido.', 'warning');
                return;
            }

            // Extrair listas de material únicas
            const listasSet = new Set();
            snapshot.forEach(doc => {
                const item = doc.data();
                if (item.listaMaterial) {
                    listasSet.add(item.listaMaterial);
                }
            });

            // Atualizar dropdown de lista de material
            const selectListaMaterial = document.getElementById('selectListaMaterial');
            selectListaMaterial.innerHTML = '<option value="">Selecione uma lista de material</option>';
            
            Array.from(listasSet).sort().forEach(lista => {
                const option = document.createElement('option');
                option.value = lista;
                option.textContent = lista;
                selectListaMaterial.appendChild(option);
            });

            // Habilitar e marcar como concluído
            selectListaMaterial.disabled = false;
            this.updateStepStatus(1, 'completed');
            this.updateStepStatus(2, 'active');

            console.log(`✅ ${listasSet.size} listas de material encontradas`);

        } catch (error) {
            console.error('❌ Erro ao carregar listas de material:', error);
            this.showMessage('Erro ao carregar listas de material.', 'error');
        }
    }

    async onListaMaterialSelecionada(listaMaterial) {
        if (!listaMaterial || !this.pedidoSelecionado) {
            return;
        }

        try {
            console.log('🔄 Carregando itens da lista:', listaMaterial);
            
            this.listaMaterialSelecionada = listaMaterial;

            // Buscar itens da lista selecionada
            const snapshot = await db.collection('itens')
                .where('pedidoId', '==', this.pedidoSelecionado)
                .where('listaMaterial', '==', listaMaterial)
                .get();

            this.itensPedido = [];
            snapshot.forEach(doc => {
                const itemData = doc.data();
                console.log('Item carregado do banco:', itemData); // Log para debug
                
                this.itensPedido.push({
                    id: doc.id,
                    ...itemData
                });
            });

            // Mostrar tabela de confronto
            this.renderTabelaConfronto();
            this.showUploadSection();
            this.updateStepStatus(2, 'completed');

            console.log(`✅ ${this.itensPedido.length} itens carregados para confronto`);

        } catch (error) {
            console.error('❌ Erro ao carregar itens:', error);
            this.showMessage('Erro ao carregar itens da lista.', 'error');
        }
    }

    showUploadSection() {
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.classList.add('visible');
        }
    }

    async processarArquivoEstoque(file) {
        if (this.isProcessingFile) {
            this.showMessage('Aguarde o processamento do arquivo anterior.', 'warning');
            return;
        }

        // Limpar input para permitir reselecionar o mesmo arquivo
        const fileInput = document.getElementById('fileEstoque');
        if (fileInput) {
            fileInput.value = '';
        }

        try {
            this.isProcessingFile = true;
            console.log('🔄 Processando arquivo de estoque:', file.name);

            // Validar tipo de arquivo
            const allowedTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv'
            ];

            if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
                throw new Error('Tipo de arquivo não suportado. Use CSV, XLS ou XLSX.');
            }

            // Usar o FileProcessor do sistema existente
            const result = await this.processFileWithSheetJS(file);
            
            if (!result.success) {
                throw new Error(result.error || 'Erro ao processar arquivo');
            }

            // Criar mapa de estoque
            this.criarMapaEstoque(result.data);
            
            // Preencher tabela com dados do estoque
            this.preencherEstoqueNaTabela();
            
            this.showMessage(`✅ Arquivo processado! ${result.data.length} itens de estoque carregados.`, 'success');

        } catch (error) {
            console.error('❌ Erro ao processar arquivo:', error);
            this.showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            this.isProcessingFile = false;
        }
    }

    async processFileWithSheetJS(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                    if (jsonData.length === 0) {
                        resolve({ success: false, error: 'Arquivo vazio ou sem dados válidos' });
                        return;
                    }

                    // Mapear cabeçalhos usando a mesma lógica do sistema
                    const processedData = this.mapearCabecalhosEstoque(jsonData);
                    
                    if (processedData.length === 0) {
                        resolve({ 
                            success: false, 
                            error: 'Não foi possível encontrar as colunas "Código" e "Quantidade" no arquivo' 
                        });
                        return;
                    }

                    resolve({ success: true, data: processedData });

                } catch (error) {
                    resolve({ success: false, error: error.message });
                }
            };

            reader.onerror = () => {
                resolve({ success: false, error: 'Erro ao ler arquivo' });
            };

            reader.readAsArrayBuffer(file);
        });
    }

    mapearCabecalhosEstoque(data) {
        if (!data || data.length === 0) return [];

        const firstRow = data[0];
        const headers = Object.keys(firstRow);

        // Variações possíveis para colunas de estoque (alinhado com file-processor.js)
        const headerVariations = {
            codigo: ['codigo', 'cod', 'cód', 'doc', 'code', 'id', 'código', 'cdigo', 'item'],
            quantidade: ['quantidade', 'quant', 'qtde', 'qtd', 'qty', 'qt', 'comprar', 'total', 'quantity', 'estoque']
        };

        // Função para normalizar texto (igual ao file-processor.js)
        const normalizeText = (text) => {
            if (!text) return '';
            try {
                return text.toString()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[;\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .trim();
            } catch (error) {
                return text.toString()
                    .toLowerCase()
                    .replace(/[áàãâä]/gi, 'a')
                    .replace(/[éèêë]/gi, 'e')
                    .replace(/[íìîï]/gi, 'i')
                    .replace(/[óòõôö]/gi, 'o')
                    .replace(/[úùûü]/gi, 'u')
                    .replace(/[ç]/gi, 'c')
                    .replace(/[;\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .trim();
            }
        };

        // Encontrar colunas correspondentes com busca melhorada
        const mappedHeaders = {};
        
        for (const [key, variations] of Object.entries(headerVariations)) {
            const foundHeader = headers.find(header => {
                if (!header) return false;
                const normalizedHeader = normalizeText(header);
                
                return variations.some(variation => {
                    const normalizedVariation = normalizeText(variation);
                    
                    // Correspondência exata tem prioridade
                    if (normalizedHeader === normalizedVariation) {
                        return true;
                    }
                    
                    // Para letras simples, exige correspondência exata
                    if (normalizedVariation.length === 1) {
                        return normalizedHeader === normalizedVariation;
                    }
                    
                    // Para palavras maiores, permite correspondência parcial
                    return normalizedHeader.includes(normalizedVariation) || 
                           normalizedVariation.includes(normalizedHeader);
                });
            });
            
            if (foundHeader) {
                mappedHeaders[key] = foundHeader;
                console.log(`✅ Campo '${key}' mapeado para coluna '${foundHeader}'`);
            }
        }

        // Verificar se as colunas essenciais foram encontradas
        if (!mappedHeaders.codigo || !mappedHeaders.quantidade) {
            console.error('❌ Colunas essenciais não encontradas:', mappedHeaders);
            console.error('❌ Cabeçalhos disponíveis:', headers);
            console.error('❌ Procurando por:', headerVariations);
            return [];
        }

        // Processar dados
        const processedData = data
            .map(row => {
                const codigo = String(row[mappedHeaders.codigo] || '').trim();
                const quantidade = this.parseQuantidade(row[mappedHeaders.quantidade]);
                
                if (!codigo || quantidade === null) {
                    return null;
                }

                return {
                    codigo: codigo.toUpperCase(),
                    quantidade: quantidade
                };
            })
            .filter(item => item !== null);

        console.log(`✅ ${processedData.length} itens de estoque processados`);
        return processedData;
    }

    parseQuantidade(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        // Converter para string e limpar
        const cleanValue = String(value)
            .replace(/\./g, '') // Remover pontos (separador de milhares)
            .replace(',', '.') // Trocar vírgula por ponto (decimal)
            .trim();

        const num = parseFloat(cleanValue);
        return isNaN(num) ? 0 : Math.max(0, num);
    }

    criarMapaEstoque(itensEstoque) {
        this.mapaEstoque = {};
        
        itensEstoque.forEach(item => {
            if (item.codigo && item.quantidade !== undefined) {
                this.mapaEstoque[item.codigo.toUpperCase()] = item.quantidade;
            }
        });

        console.log(`✅ Mapa de estoque criado com ${Object.keys(this.mapaEstoque).length} itens`);
    }

    renderTabelaConfronto() {
        const confrontoSection = document.getElementById('confrontoSection');
        const tableBody = document.getElementById('confrontoTableBody');
        
        if (!confrontoSection || !tableBody) return;

        // Limpar tabela
        tableBody.innerHTML = '';

        // 🎯 FUNCIONALIDADE APRIMORADA: Filtrar itens que não devem aparecer na análise
        console.log('🔍 Iniciando filtro de itens para exibição...');
        
        const itensParaExibir = this.itensPedido.filter(item => {
            const isCompleto = this.isItemTotalmenteCompleto(item);
            if (isCompleto) {
                console.log(`⏭️ Item ${item.codigo} não será exibido (completo)`);
            }
            return !isCompleto;
        });

        console.log(`📊 Filtro aplicado: ${this.itensPedido.length} total, ${itensParaExibir.length} para exibir`);
        
        // Se todos os itens foram processados, mostrar mensagem
        if (this.itensPedido.length > 0 && itensParaExibir.length === 0) {
            console.log('🎉 Todos os itens foram processados!');
            this.showMessage('🎉 Todos os itens deste pedido foram analisados e processados!', 'success');
        }

        // Renderizar apenas itens não completos
        itensParaExibir.forEach((item, index) => {
            const row = this.createItemRow(item, index);
            tableBody.appendChild(row);
        });

        // Mostrar seção
        confrontoSection.classList.add('visible');
        this.updateProgressStats();
    }

    /**
     * 🎯 FUNÇÃO APRIMORADA: Verifica se um item está totalmente completo
     * Um item está completo quando a soma de alocado + compra >= quantidade necessária
     * OU quando possui a flag ocultarDaAnalise = true salva no Firebase
     */
    isItemTotalmenteCompleto(item) {
        if (!item) {
            console.log('🔍 Item inválido para verificação de completude');
            return false;
        }

        // Verificar primeiro se existe a flag no Firebase
        if (item.ocultarDaAnalise === true) {
            console.log(`🎯 Item ${item.codigo} oculto por flag do Firebase`);
            return true;
        }

        const qtdeNecessaria = parseFloat(item.quantidade) || 0;
        const qtdeAlocar = parseFloat(item.quantidadeAlocar) || 0;
        const qtdeComprar = parseFloat(item.quantidadeComprar) || 0;
        
        // Verificar se as quantidades alocadas + compradas atendem à necessidade total
        const qtdeTotalProcessada = qtdeAlocar + qtdeComprar;
        
        // Usar uma pequena tolerância para evitar problemas de ponto flutuante
        const tolerancia = 0.001;
        const isCompleto = (qtdeTotalProcessada + tolerancia) >= qtdeNecessaria;

        // Log detalhado para debug
        console.log(`🔍 Verificação completude - Item ${item.codigo}:`);
        console.log(`   - Necessário: ${qtdeNecessaria}`);
        console.log(`   - Alocado: ${qtdeAlocar}`);
        console.log(`   - Compra: ${qtdeComprar}`);
        console.log(`   - Total Processado: ${qtdeTotalProcessada}`);
        console.log(`   - Status: ${item.statusItem || 'Pendente'}`);
        console.log(`   - Completo: ${isCompleto}`);

        return isCompleto;
    }

    createItemRow(item, index) {
        const row = document.createElement('tr');
        row.dataset.itemId = item.id;
        row.dataset.itemIndex = index;

        const statusClass = this.getStatusClass(item.statusItem || 'Pendente de Análise');
        const statusText = item.statusItem || 'Pendente de Análise';
        
        // Determinar os campos de descrição e especificações
        const descricao = item.descricao || item.item || item.produto || item.material || '-';
        const especificacoes = item.especificacoes || item.especificacao || item.detalhe || item.detalhes || '-';

        // Verificar se o item está totalmente processado, parcialmente processado ou pendente
        const isFullyProcessed = statusText === 'Em Estoque' || statusText === 'Para Compra';
        const isPartiallyProcessed = statusText === 'Parcialmente Processado';
        const isPending = statusText === 'Pendente de Análise';

        // Criar conteúdo dos botões baseado no status
        let actionButtonsContent;
        
        if (isFullyProcessed) {
            // Item totalmente processado - mostrar mensagem
            const actionMessage = statusText === 'Em Estoque' ? 
                'Item totalmente alocado do estoque' : 
                'Item totalmente marcado para compra';
            
            actionButtonsContent = `
                <div class="action-message">
                    <span class="action-completed-text">${actionMessage}</span>
                </div>
            `;
        } else if (isPartiallyProcessed) {
            // Item parcialmente processado - mostrar botões para continuar
            const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
            const qtdeNecessaria = item.quantidade || 0;
            const qtdeAlocarExistente = item.quantidadeAlocar || 0;
            const qtdeComprarExistente = item.quantidadeComprar || 0;
            const qtdeFaltante = qtdeNecessaria - qtdeAlocarExistente - qtdeComprarExistente;
            
            const canAllocate = qtdeEstoque >= qtdeFaltante && qtdeEstoque > 0 && qtdeFaltante > 0;
            const btnAlocarDisabled = !canAllocate ? 'disabled' : '';
            
            actionButtonsContent = `
                <button class="btn-alocar" ${btnAlocarDisabled} onclick="window.AnaliseEstoque.alocarItem('${item.id}')">
                    ${canAllocate ? `Alocar ${this.formatQuantidade(qtdeFaltante)}` : 'Alocar Restante'}
                </button>
                <button class="btn-comprar" onclick="window.AnaliseEstoque.showQuantityModal(['${item.id}'], 'single')">
                    Comprar Mais
                </button>
            `;
        } else {
            // Item pendente - mostrar botões padrão
            actionButtonsContent = `
                <button class="btn-alocar" disabled onclick="window.AnaliseEstoque.alocarItem('${item.id}')">
                    Alocar do Estoque
                </button>
                <button class="btn-comprar" onclick="window.AnaliseEstoque.showQuantityModal(['${item.id}'], 'single')">
                    Solicitar Compra
                </button>
            `;
        }

        // Calcular quantidades baseado no status atual
        let qtdeAlocar = 0;
        let qtdeComprar = 0;
        
        if (isFullyProcessed || isPartiallyProcessed) {
            // Item já processado ou parcial - usar valores salvos
            qtdeAlocar = item.quantidadeAlocar || 0;
            qtdeComprar = item.quantidadeComprar || 0;
        }

        row.innerHTML = `
            <td class="col-select">
                <input type="checkbox" class="item-checkbox" data-item-id="${item.id}" data-item-index="${index}" ${isFullyProcessed ? 'disabled' : ''}>
            </td>
            <td class="col-codigo">${item.codigo || '-'}</td>
            <td class="col-item">${descricao}</td>
            <td class="col-especificacoes">${especificacoes}</td>
            <td class="col-qtde-necessaria">${this.formatQuantidade(item.quantidade)}</td>
            <td class="col-qtde-estoque" data-field="estoque">
                <span class="qtde-aguardando">Aguardando Estoque</span>
            </td>
            <td class="col-qtde-alocar">
                <span class="qtde-alocar ${qtdeAlocar > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}">${qtdeAlocar}</span>
            </td>
            <td class="col-qtde-comprar">
                <span class="qtde-comprar ${qtdeComprar > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}">${qtdeComprar}</span>
            </td>
            <td class="col-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="col-acoes">
                <div class="action-buttons" data-field="actions">
                    ${actionButtonsContent}
                </div>
            </td>
        `;

        // Adicionar event listeners para seleção (apenas se não totalmente processado)
        const checkbox = row.querySelector('.item-checkbox');
        if (checkbox && !isFullyProcessed) {
            checkbox.addEventListener('change', (e) => {
                this.handleItemSelection(e);
            });

            checkbox.addEventListener('click', (e) => {
                this.handleItemClick(e, index);
            });
        }

        // Adicionar classes CSS baseadas no status
        if (isFullyProcessed) {
            row.classList.add('item-processed');
        } else if (isPartiallyProcessed) {
            row.classList.add('item-partial');
        }

        return row;
    }

    preencherEstoqueNaTabela() {
        const tableBody = document.getElementById('confrontoTableBody');
        if (!tableBody) return;

        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const itemId = row.dataset.itemId;
            const item = this.itensPedido.find(i => i.id === itemId);
            
            if (!item || !item.codigo) return;

            const codigoItem = item.codigo.toUpperCase();
            const qtdeEstoque = this.mapaEstoque[codigoItem] || 0;
            const qtdeNecessaria = item.quantidade || 0;
            
            // Calcular quanto já foi processado
            const qtdeAlocarExistente = item.quantidadeAlocar || 0;
            const qtdeComprarExistente = item.quantidadeComprar || 0;
            const qtdeFaltante = qtdeNecessaria - qtdeAlocarExistente - qtdeComprarExistente;

            // Calcular quantidades estimadas baseado no que ainda falta processar
            const qtdeAlocarEstimada = Math.min(qtdeEstoque, qtdeFaltante);
            const qtdeComprarEstimada = Math.max(0, qtdeFaltante - qtdeEstoque);

            // Atualizar célula de estoque
            const estoqueCell = row.querySelector('[data-field="estoque"]');
            if (estoqueCell) {
                // Verificar se há estoque suficiente para cobrir o que ainda falta
                const canAllocate = qtdeEstoque >= qtdeFaltante && qtdeFaltante > 0;
                const estoqueClass = qtdeEstoque > 0 ? 
                    (canAllocate ? 'qtde-disponivel' : 'qtde-insuficiente') : 
                    'qtde-aguardando';

                estoqueCell.innerHTML = `
                    <span class="${estoqueClass}">
                        ${this.formatQuantidade(qtdeEstoque)}
                    </span>
                `;
            }

            // Atualizar colunas de alocar e comprar apenas se item não foi totalmente processado
            const statusBadge = row.querySelector('.status-badge');
            const statusText = statusBadge ? statusBadge.textContent : 'Pendente de Análise';
            const isFullyProcessed = statusText === 'Em Estoque' || statusText === 'Para Compra';
            const isPartiallyProcessed = statusText === 'Parcialmente Processado';
            
            if (!isFullyProcessed) {
                // Atualizar célula de alocar
                const alocarCell = row.querySelector('.qtde-alocar');
                if (alocarCell) {
                    alocarCell.textContent = qtdeAlocarEstimada;
                    alocarCell.className = `qtde-alocar ${qtdeAlocarEstimada > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`;
                }

                // Atualizar célula de comprar
                const comprarCell = row.querySelector('.qtde-comprar');
                if (comprarCell) {
                    comprarCell.textContent = qtdeComprarEstimada;
                    comprarCell.className = `qtde-comprar ${qtdeComprarEstimada > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}`;
                }
            }

            // Atualizar botões - calcular quantidade restante para alocar
            const actionsCell = row.querySelector('[data-field="actions"]');
            if (actionsCell) {
                const btnAlocar = actionsCell.querySelector('.btn-alocar');
                
                // Para itens parcialmente processados, calcular a quantidade restante
                const qtdeAlocarExistente = item.quantidadeAlocar || 0;
                const qtdeComprarExistente = item.quantidadeComprar || 0;
                const qtdeFaltante = qtdeNecessaria - qtdeAlocarExistente - qtdeComprarExistente;
                
                const canAllocate = qtdeEstoque >= qtdeFaltante && qtdeEstoque > 0 && qtdeFaltante > 0;
                
                if (btnAlocar) {
                    btnAlocar.disabled = !canAllocate;
                    if (canAllocate && qtdeFaltante > 0) {
                        btnAlocar.textContent = `Alocar ${this.formatQuantidade(qtdeFaltante)}`;
                    } else if (qtdeFaltante <= 0) {
                        btnAlocar.textContent = `Item Processado`;
                        btnAlocar.disabled = true;
                    }
                }
            }
        });

        this.updateProgressStats();
        console.log('✅ Tabela de confronto atualizada com dados do estoque');
    }

    async alocarItem(itemId, showMessage = true) {
        try {
            console.log('🔄 Alocando item do estoque:', itemId);

            // Verificar se o item existe nos dados locais
            const item = this.itensPedido.find(i => i.id === itemId);
            if (!item) {
                console.error('❌ Item não encontrado nos dados locais:', itemId);
                this.showMessage(`Erro: Item com ID ${itemId} não encontrado nos dados locais`, 'error');
                return;
            }

            // VALIDAÇÃO DE SEGURANÇA: Verificar se o item ainda pode ser processado
            const statusAtual = item.statusItem || 'Pendente de Análise';
            if (statusAtual !== 'Pendente de Análise' && statusAtual !== 'Parcialmente Processado') {
                this.showMessage(`⚠️ Este item já foi totalmente processado! Status atual: ${statusAtual}`, 'warning');
                return;
            }

            const codigoItem = item.codigo.toUpperCase();
            const qtdeEstoque = this.mapaEstoque[codigoItem] || 0;
            const qtdeNecessaria = item.quantidade || 0;
            
            // Verificar quantidades já processadas
            const qtdeAlocarExistente = item.quantidadeAlocar || 0;
            const qtdeComprarExistente = item.quantidadeComprar || 0;
            const qtdeFaltante = qtdeNecessaria - qtdeAlocarExistente - qtdeComprarExistente;

            if (qtdeEstoque < qtdeFaltante) {
                throw new Error(`Quantidade em estoque insuficiente. Disponível: ${qtdeEstoque}, Necessário: ${qtdeFaltante}`);
            }
            
            if (qtdeFaltante <= 0) {
                this.showMessage('⚠️ Este item já foi totalmente processado!', 'warning');
                return;
            }

            // Calcular novas quantidades (alocando o restante do estoque)
            const novaQtdeAlocar = qtdeAlocarExistente + qtdeFaltante;
            const qtdeTotalProcessada = novaQtdeAlocar + qtdeComprarExistente;
            
            // Determinar novo status
            let novoStatus;
            if (qtdeTotalProcessada >= qtdeNecessaria) {
                if (novaQtdeAlocar === qtdeNecessaria && qtdeComprarExistente === 0) {
                    novoStatus = 'Em Estoque';
                } else if (qtdeComprarExistente > 0) {
                    novoStatus = 'Para Compra'; // Mix de estoque e compra
                } else {
                    novoStatus = 'Em Estoque';
                }
            } else {
                novoStatus = 'Parcialmente Processado';
            }

            console.log(`Alocando item: Necessário=${qtdeNecessaria}, Alocar=${novaQtdeAlocar}, Comprar=${qtdeComprarExistente}, Total=${qtdeTotalProcessada}, Status=${novoStatus}`);

            // 🔧 BUSCAR DADOS DO PEDIDO PAI PARA HERDAR PROJETO (também na alocação)
            let dadosPedidoPai = {};
            if (this.pedidoSelecionado) {
                try {
                    const pedidoDoc = await db.collection('pedidos').doc(this.pedidoSelecionado).get();
                    if (pedidoDoc.exists) {
                        dadosPedidoPai = pedidoDoc.data();
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao buscar dados do pedido pai na alocação:', error);
                }
            }

            // Declarar itemLocal no início para estar disponível em todo o escopo
            let itemLocal = null;
            
            // INÍCIO DO NOVO CÓDIGO - ARQUITETO DE CÓDIGO
            const itemLocalParaAnalise = this.itensPedido.find(i => i.id === itemId);
            const analiseArray = itemLocalParaAnalise['Analise de Estoque'] || [];

            // Verifica se "Precisamos" já foi gravado
            const precisamosJaGravado = analiseArray.some(reg => reg.hasOwnProperty('Precisamos'));
            if (!precisamosJaGravado) {
                analiseArray.push({ 'Precisamos': qtdeNecessaria });
            }

            // Grava a quantidade a alocar
            analiseArray.push({ 'Alocar': qtdeFaltante });
            // FIM DO NOVO CÓDIGO - ARQUITETO DE CÓDIGO

            // Usar set com merge para funcionar mesmo se documento não existir
            const itemRef = db.collection('itens').doc(itemId);
            try {
                // Preservar TODOS os dados originais do item + adicionar campos de alocação
                const updateData = {
                    ...item, // Preserva todos os campos originais (descrição, especificações, etc.)
                    statusItem: novoStatus,
                    dataAnalise: firebase.firestore.FieldValue.serverTimestamp(),
                    quantidadeAlocar: novaQtdeAlocar,
                    quantidadeComprar: qtdeComprarExistente, // Manter quantidade já comprada
                    estoqueDisponivel: qtdeEstoque,
                    qtdeAlocada: novaQtdeAlocar,
                    estoqueUtilizado: codigoItem,
                    // Garantir campos essenciais (caso não existam no item original)
                    codigo: item.codigo,
                    quantidade: item.quantidade,
                    pedidoId: item.pedidoId,
                    listaMaterial: item.listaMaterial || '',
                    // 🔧 BUSCAR CAMPO tipoProjeto DO PEDIDO PAI E SALVAR AMBOS OS CAMPOS NO ITEM
                    clienteNome: dadosPedidoPai.clienteNome || item.clienteNome,
                    projetoNome: dadosPedidoPai.tipoProjeto || item.projetoNome,
                    tipoProjeto: dadosPedidoPai.tipoProjeto || item.tipoProjeto,
                    // 🎯 NOVA FUNCIONALIDADE: Flag para ocultar da análise quando completo
                    ocultarDaAnalise: qtdeTotalProcessada >= qtdeNecessaria,
                    'Analise de Estoque': analiseArray // <-- ADICIONE ESTA LINHA EXATAMENTE AQUI
                };

                await itemRef.set(updateData, { merge: true });
                
                console.log('✅ Item salvo com sucesso usando set com merge');
                
                // Atualizar o item na lista local para refletir os novos valores
                itemLocal = this.itensPedido.find(i => i.id === itemId);
                if (itemLocal) {
                    itemLocal.statusItem = novoStatus;
                    itemLocal.quantidadeAlocar = novaQtdeAlocar;
                    itemLocal.quantidadeComprar = qtdeComprarExistente;
                }
                
            } catch (err) {
                console.error('❌ Erro ao usar set com merge:', err);
                throw err;
            }
            
            console.log('✅ Item atualizado com sucesso');
            
            // Gerenciar estoque separadamente
            const estoqueRef = db.collection('estoque').doc(codigoItem);
            const estoqueDoc = await estoqueRef.get();
            
            if (estoqueDoc.exists) {
                // Incrementar reserva
                const estoqueData = estoqueDoc.data();
                await estoqueRef.update({
                    qtdeReservada: (estoqueData.qtdeReservada || 0) + qtdeFaltante,
                    ultimaReserva: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Estoque atualizado com sucesso');
            } else {
                // Criar registro de estoque
                await estoqueRef.set({
                    codigo: codigoItem,
                    qtdeTotal: qtdeEstoque,
                    qtdeReservada: qtdeFaltante,
                    ultimaReserva: firebase.firestore.FieldValue.serverTimestamp(),
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Novo registro de estoque criado');
            }

            // Atualizar status primeiro
            this.updateItemStatus(itemId, novoStatus);
            this.updateProgressStats();
            
            // 🎯 FUNCIONALIDADE CORRIGIDA: Verificar se item está completo APÓS atualizar os dados
            // Usar os valores mais atualizados para a verificação
            const itemAtualizado = this.itensPedido.find(i => i.id === itemId);
            if (itemAtualizado) {
                // Atualizar com os novos valores calculados
                itemAtualizado.quantidadeAlocar = qtdeAlocarTotal;
                itemAtualizado.quantidadeComprar = qtdeComprarTotal;
                itemAtualizado.statusItem = novoStatus;
                
                const itemCompleto = this.isItemTotalmenteCompleto(itemAtualizado);
                
                // Se o item foi completado, re-renderizar a tabela para ocultá-lo
                if (itemCompleto) {
                    console.log(`🎯 Item ${item.codigo} completado após alocação - re-renderizando tabela`);
                    setTimeout(() => {
                        this.renderTabelaConfronto();
                    }, 100); // Pequeno delay para garantir que o DOM foi atualizado
                }
            }
            
            this.checkAnaliseCompleta();

            if (showMessage) {
                this.showMessage(`✅ Item ${item.codigo} alocado do estoque com sucesso!`, 'success');
            }

        } catch (error) {
            console.error('❌ Erro ao alocar item:', error);
            this.showMessage(`Erro ao alocar item: ${error.message}`, 'error');
        }
    }

    async solicitarCompra(itemId) {
        // Redirecionar para modal de quantidade
        this.showQuantityModal([itemId], 'single');
    }

    updateItemStatus(itemId, newStatus) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        if (!row) return;

        const statusBadge = row.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge ${this.getStatusClass(newStatus)}`;
            statusBadge.textContent = newStatus;
        }

        // Determinar se item está totalmente processado ou ainda pode ser modificado
        const isFullyProcessed = newStatus === 'Em Estoque' || newStatus === 'Para Compra';
        const isPartiallyProcessed = newStatus === 'Parcialmente Processado';

        // Obter o item para exibir as quantidades
        const item = this.itensPedido.find(i => i.id === itemId);
        if (!item) return;

        // Atualizar células de quantidade alocar e comprar
        const alocarCell = row.querySelector('.qtde-alocar');
        const comprarCell = row.querySelector('.qtde-comprar');
        
        if (alocarCell) {
            const qtdeAlocar = item.quantidadeAlocar || 0;
            alocarCell.textContent = qtdeAlocar;
            alocarCell.className = `qtde-alocar ${qtdeAlocar > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`;
        }
        
        if (comprarCell) {
            const qtdeComprar = item.quantidadeComprar || 0;
            comprarCell.textContent = qtdeComprar;
            comprarCell.className = `qtde-comprar ${qtdeComprar > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}`;
        }

        // Substituir botões por mensagem ou manter disponível se parcial
        const actionsCell = row.querySelector('[data-field="actions"]');
        if (actionsCell) {
            if (isFullyProcessed) {
                const actionMessage = newStatus === 'Em Estoque' ? 
                    'Item totalmente alocado do estoque' : 
                    'Item totalmente marcado para compra';
                
                actionsCell.innerHTML = `
                    <div class="action-message">
                        <span class="action-completed-text">${actionMessage}</span>
                    </div>
                `;
            } else if (isPartiallyProcessed) {
                // Verificar se há estoque disponível para o botão de alocar
                const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
                const qtdeNecessaria = item.quantidade || 0;
                const qtdeAlocarExistente = item.quantidadeAlocar || 0;
                const qtdeComprarExistente = item.quantidadeComprar || 0;
                const qtdeFaltante = qtdeNecessaria - qtdeAlocarExistente - qtdeComprarExistente;
                
                const canAllocate = qtdeEstoque > 0 && qtdeFaltante > 0;
                const btnAlocarDisabled = !canAllocate ? 'disabled' : '';
                
                // Manter botões disponíveis para completar o processamento
                actionsCell.innerHTML = `
                    <button class="btn-alocar" ${btnAlocarDisabled} onclick="window.AnaliseEstoque.alocarItem('${itemId}')">
                        Alocar Restante
                    </button>
                    <button class="btn-comprar" onclick="window.AnaliseEstoque.showQuantityModal(['${itemId}'], 'single')">
                        Comprar Mais
                    </button>
                `;
            }
        }

        // Adicionar classe CSS para estilização de itens
        if (isFullyProcessed) {
            row.classList.add('item-processed');
            row.classList.remove('item-partial');
        } else if (isPartiallyProcessed) {
            row.classList.remove('item-processed');
            row.classList.add('item-partial');
        } else {
            row.classList.remove('item-processed');
            row.classList.remove('item-partial');
        }

        // Desabilitar checkbox apenas se totalmente processado
        const checkbox = row.querySelector('.item-checkbox');
        if (checkbox) {
            if (isFullyProcessed) {
                checkbox.disabled = true;
                checkbox.checked = false;
                this.selectedItems.delete(itemId);
            } else {
                checkbox.disabled = false;
                // Manter na seleção se estava selecionado
            }
        }

        // Atualizar item na lista local se ainda não foi atualizado
        if (item && item.statusItem !== newStatus) {
            item.statusItem = newStatus;
            
            // 🎯 VERIFICAÇÃO ADICIONAL: Se o item ficou completo após atualização de status, re-renderizar
            const isCompletoAposStatus = this.isItemTotalmenteCompleto(item);
            if (isCompletoAposStatus) {
                console.log(`🎯 Item ${item.codigo} ficou completo após atualização de status - re-renderizando`);
                setTimeout(() => {
                    this.renderTabelaConfronto();
                }, 150);
            }
        }

        // Atualizar controles de seleção
        this.updateBulkControls();
        this.updateSelectAllCheckbox();
    }

    async checkAnaliseCompleta() {
        try {
            // Verificar se todos os itens do pedido foram analisados (considerando compras parciais)
            const snapshot = await db.collection('itens')
                .where('pedidoId', '==', this.pedidoSelecionado)
                .get();

            let todosAnalisados = true;
            let temItensParaCompra = false;

            snapshot.forEach(doc => {
                const item = doc.data();
                const status = item.statusItem || 'Pendente de Análise';
                const qtdeNecessaria = item.quantidade || 0;
                const qtdeAlocar = item.quantidadeAlocar || 0;
                const qtdeComprar = item.quantidadeComprar || 0;
                
                // Verificar se o item foi totalmente analisado (soma das quantidades cobre o necessário)
                const qtdeTotalProcessada = qtdeAlocar + qtdeComprar;
                
                if (status === 'Pendente de Análise' || qtdeTotalProcessada < qtdeNecessaria) {
                    todosAnalisados = false;
                }
                
                if (status === 'Para Compra' || qtdeComprar > 0) {
                    temItensParaCompra = true;
                }
            });

            if (todosAnalisados) {
                // Determinar novo status do pedido
                const novoStatus = temItensParaCompra ? 'Aguardando Compras' : 'Pronto para Separação';
                
                // Atualizar status do pedido
                await db.collection('pedidos').doc(this.pedidoSelecionado).update({
                    statusGeral: novoStatus,
                    dataAnaliseCompleta: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.showMessage(`🎉 Análise completa! Pedido atualizado para: ${novoStatus}`, 'success');
                
                // Atualizar dropdown de pedidos após um delay
                setTimeout(() => {
                    this.loadPedidosPendentes();
                    this.resetarSelecoes();
                }, 2000);
            }

        } catch (error) {
            console.error('❌ Erro ao verificar análise completa:', error);
        }
    }

    updateProgressStats() {
        const progressSection = document.getElementById('progressSection');
        if (!progressSection || !this.itensPedido.length) return;

        const stats = {
            pendente: 0,
            estoque: 0,
            compra: 0
        };

        this.itensPedido.forEach(item => {
            const status = item.statusItem || 'Pendente de Análise';
            switch (status) {
                case 'Em Estoque':
                    stats.estoque++;
                    break;
                case 'Para Compra':
                    stats.compra++;
                    break;
                default:
                    stats.pendente++;
            }
        });

        // Atualizar DOM
        const pendenteStat = document.getElementById('statPendente');
        const estoqueStat = document.getElementById('statEstoque');
        const compraStat = document.getElementById('statCompra');

        if (pendenteStat) pendenteStat.textContent = stats.pendente;
        if (estoqueStat) estoqueStat.textContent = stats.estoque;
        if (compraStat) compraStat.textContent = stats.compra;

        // Mostrar seção se houver dados
        if (stats.pendente > 0 || stats.estoque > 0 || stats.compra > 0) {
            progressSection.classList.add('visible');
        }
    }

    updateStepStatus(stepNumber, status) {
        const stepElement = document.querySelector(`[data-step="${stepNumber}"] .step-number`);
        if (!stepElement) return;

        stepElement.className = `step-number ${status}`;
    }

    getStatusClass(status) {
        const statusMap = {
            'Pendente de Análise': 'status-pendente',
            'Em Estoque': 'status-em-estoque',
            'Para Compra': 'status-para-compra',
            'Parcialmente Processado': 'status-parcial'
        };
        
        return statusMap[status] || 'status-pendente';
    }

    formatQuantidade(qtde) {
        if (qtde === null || qtde === undefined) return '0';
        
        const num = parseFloat(qtde);
        if (isNaN(num)) return '0';
        
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    resetarSelecoes() {
        this.pedidoSelecionado = null;
        this.listaMaterialSelecionada = null;
        this.itensPedido = [];
        this.mapaEstoque = {};
        this.selectedItems.clear();

        // Reset UI
        const selectListaMaterial = document.getElementById('selectListaMaterial');
        if (selectListaMaterial) {
            selectListaMaterial.innerHTML = '<option value="">Primeiro selecione um pedido</option>';
            selectListaMaterial.disabled = true;
        }

        // Esconder seções
        const sections = ['uploadSection', 'confrontoSection', 'progressSection', 'bulkControls'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.remove('visible');
            }
        });

        // Reset steps
        this.updateStepStatus(1, 'active');
        this.updateStepStatus(2, 'disabled');
    }

    // ===== MÉTODOS DE SELEÇÃO =====
    
    handleItemSelection(e) {
        const checkbox = e.target;
        const itemId = checkbox.dataset.itemId;
        const row = checkbox.closest('tr');

        if (checkbox.checked) {
            this.selectedItems.add(itemId);
            row.classList.add('row-selected');
        } else {
            this.selectedItems.delete(itemId);
            row.classList.remove('row-selected');
        }

        this.updateBulkControls();
        this.updateSelectAllCheckbox();
    }

    handleItemClick(e, index) {
        // Seleção em intervalo com Alt
        if (e.altKey && this.lastSelectedIndex !== -1) {
            e.preventDefault();
            this.selectRange(this.lastSelectedIndex, index);
        }
        
        this.lastSelectedIndex = index;
    }

    selectRange(startIndex, endIndex) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        for (let i = start; i <= end; i++) {
            const checkbox = document.querySelector(`[data-item-index="${i}"]`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                const itemId = checkbox.dataset.itemId;
                this.selectedItems.add(itemId);
                checkbox.closest('tr').classList.add('row-selected');
            }
        }

        this.updateBulkControls();
        this.updateSelectAllCheckbox();
    }

    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox.checked) {
            this.selectAllItems();
        } else {
            this.clearSelection();
        }
    }

    selectAllItems() {
        this.selectedItems.clear();
        
        const checkboxes = document.querySelectorAll('.item-checkbox:not(#selectAllCheckbox)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const itemId = checkbox.dataset.itemId;
            this.selectedItems.add(itemId);
            checkbox.closest('tr').classList.add('row-selected');
        });

        this.updateBulkControls();
        this.updateSelectAllCheckbox();
    }

    clearSelection() {
        this.selectedItems.clear();
        
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.remove('row-selected');
            }
        });

        this.updateBulkControls();
    }

    updateBulkControls() {
        const bulkControls = document.getElementById('bulkControls');
        const selectionInfo = document.getElementById('selectionInfo');
        const btnBulkAllocate = document.getElementById('btnBulkAllocate');
        const btnBulkPurchase = document.getElementById('btnBulkPurchase');

        const selectedCount = this.selectedItems.size;

        if (selectedCount > 0) {
            bulkControls.classList.add('visible');
            selectionInfo.textContent = `${selectedCount} item${selectedCount > 1 ? 'ns' : ''} selecionado${selectedCount > 1 ? 's' : ''}`;
            
            // Verificar se algum item selecionado pode ser alocado (status + estoque)
            const canAllocateAny = Array.from(this.selectedItems).some(itemId => {
                const item = this.itensPedido.find(i => i.id === itemId);
                if (!item) return false;
                
                // VALIDAÇÃO DE SEGURANÇA: Verificar status (permitir pendentes e parciais)
                const statusAtual = item.statusItem || 'Pendente de Análise';
                if (statusAtual === 'Em Estoque' || statusAtual === 'Para Compra') return false;
                
                const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
                const qtdeJaAlocada = item.quantidadeAlocar || 0;
                const qtdeJaComprada = item.quantidadeComprar || 0;
                const qtdeRestante = (item.quantidade || 0) - qtdeJaAlocada - qtdeJaComprada;
                
                return qtdeEstoque > qtdeJaAlocada && qtdeRestante > 0;
            });

            // Verificar se algum item selecionado pode ser comprado (status)
            const canPurchaseAny = Array.from(this.selectedItems).some(itemId => {
                const item = this.itensPedido.find(i => i.id === itemId);
                if (!item) return false;
                
                const statusAtual = item.statusItem || 'Pendente de Análise';
                return statusAtual === 'Pendente de Análise' || statusAtual === 'Parcialmente Processado';
            });

            btnBulkAllocate.disabled = !canAllocateAny;
            btnBulkPurchase.disabled = !canPurchaseAny;
        } else {
            bulkControls.classList.remove('visible');
        }
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const totalCheckboxes = document.querySelectorAll('.item-checkbox:not(#selectAllCheckbox)').length;
        const selectedCount = this.selectedItems.size;

        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    // ===== MÉTODOS DE AÇÕES EM MASSA =====

    async bulkAllocateItems() {
        const selectedItemIds = Array.from(this.selectedItems);
        const allocatableItems = [];

        // Filtrar itens que podem ser alocados (verificar status E estoque)
        selectedItemIds.forEach(itemId => {
            const item = this.itensPedido.find(i => i.id === itemId);
            if (item) {
                // VALIDAÇÃO DE SEGURANÇA: Verificar se não foi processado
                const statusAtual = item.statusItem || 'Pendente de Análise';
                if (statusAtual !== 'Pendente de Análise') {
                    console.warn(`⚠️ Item ${itemId} já foi processado (${statusAtual}), pulando`);
                    return;
                }

                const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
                if (qtdeEstoque >= (item.quantidade || 0)) {
                    allocatableItems.push(itemId);
                }
            }
        });

        if (allocatableItems.length === 0) {
            this.showMessage('Nenhum item selecionado possui estoque suficiente para alocação ou todos já foram processados.', 'warning');
            return;
        }

        if (allocatableItems.length !== selectedItemIds.length) {
            this.showMessage(`⚠️ ${selectedItemIds.length - allocatableItems.length} item(s) já processado(s) ou sem estoque foi(ram) removido(s)`, 'warning');
        }

        try {
            // Confirmar ação
            if (!confirm(`Alocar ${allocatableItems.length} item(s) do estoque?`)) {
                return;
            }

            // Alocar cada item
            let sucessos = 0;
            for (const itemId of allocatableItems) {
                try {
                    await this.alocarItem(itemId, false); // false = não mostrar mensagem individual
                    sucessos++;
                } catch (error) {
                    console.error(`❌ Erro ao alocar item ${itemId}:`, error);
                }
            }

            this.showMessage(`✅ ${sucessos} item(s) alocado(s) do estoque com sucesso!`, 'success');
            this.clearSelection();

        } catch (error) {
            console.error('❌ Erro na alocação em massa:', error);
            this.showMessage(`Erro na alocação em massa: ${error.message}`, 'error');
        }
    }

    // ===== MÉTODOS DO MODAL DE QUANTIDADE =====

    showQuantityModal(itemIds, mode = 'single') {
        // VALIDAÇÃO DE SEGURANÇA: Filtrar itens totalmente processados
        const validItemIds = itemIds.filter(itemId => {
            const item = this.itensPedido.find(i => i.id === itemId);
            if (!item) return false;
            
            const statusAtual = item.statusItem || 'Pendente de Análise';
            // Permitir itens pendentes e parcialmente processados
            if (statusAtual === 'Em Estoque' || statusAtual === 'Para Compra') {
                console.warn(`⚠️ Item ${itemId} já foi totalmente processado (${statusAtual}), removendo da seleção`);
                return false;
            }
            return true;
        });

        if (validItemIds.length === 0) {
            this.showMessage('⚠️ Todos os itens selecionados já foram processados!', 'warning');
            return;
        }

        if (validItemIds.length !== itemIds.length) {
            this.showMessage(`⚠️ ${itemIds.length - validItemIds.length} item(s) já processado(s) foi(ram) removido(s) da seleção`, 'warning');
        }

        const modal = document.getElementById('quantityModal');
        const title = document.getElementById('quantityModalTitle');
        const body = document.getElementById('quantityModalBody');

        // Configurar título
        if (mode === 'single') {
            title.textContent = 'Definir Quantidade para Compra';
        } else {
            title.textContent = `Definir Quantidades para Compra (${validItemIds.length} itens)`;
        }

        // Limpar conteúdo anterior
        body.innerHTML = '';

        // Criar campos para cada item válido
        validItemIds.forEach(itemId => {
            const item = this.itensPedido.find(i => i.id === itemId);
            if (!item) return;

            const quantityItem = document.createElement('div');
            quantityItem.className = 'quantity-item';
            quantityItem.dataset.itemId = itemId;

            const descricao = item.descricao || item.item || item.produto || item.material || '-';
            
            // Pegar estoque e necessidade para mostrar ao usuário
            const qtdeNecessaria = item.quantidade || 0;
            const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
            const qtdeComprarExistente = item.quantidadeComprar || 0;
            const qtdeAlocarExistente = item.quantidadeAlocar || 0;
            
            // Calcular quanto ainda falta processar
            const qtdeFaltante = qtdeNecessaria - qtdeComprarExistente - qtdeAlocarExistente;
            
            // Calcular quantidade estimada a comprar baseada no que falta
            const qtdeEstimada = Math.max(1, Math.min(qtdeFaltante, qtdeFaltante - qtdeEstoque));
            
            // Preparar a exibição de "Solicitado" se já houver quantidade comprada
            const solicitadoHtml = qtdeComprarExistente > 0 ? 
                `<span class="item-detail">Solicitado: <strong class="text-orange-600">${this.formatQuantidade(qtdeComprarExistente)}</strong></span>` : '';
            
            // Preparar a exibição de "Alocado" se já houver quantidade alocada
            const alocadoHtml = qtdeAlocarExistente > 0 ? 
                `<span class="item-detail">Alocado: <strong class="text-blue-600">${this.formatQuantidade(qtdeAlocarExistente)}</strong></span>` : '';
            
            quantityItem.innerHTML = `
                <div class="quantity-item-info">
                    <div class="quantity-item-code">${item.codigo || '-'}</div>
                    <div class="quantity-item-name">${descricao}</div>
                    <div class="quantity-item-details">
                        <span class="item-detail">Necessário: <strong>${this.formatQuantidade(qtdeNecessaria)}</strong></span>
                        <span class="item-detail">Estoque: <strong>${this.formatQuantidade(qtdeEstoque)}</strong></span>
                        ${solicitadoHtml}
                        ${alocadoHtml}
                    </div>
                </div>
                <div class="quantity-input-container">
                    <input type="number" 
                           class="quantity-item-input" 
                           value="${qtdeEstimada}" 
                           min="1" 
                           step="1"
                           placeholder="Qtde.">
                    <div class="input-help-text">Quantidade a comprar</div>
                </div>
            `;

            body.appendChild(quantityItem);
        });

        // Mostrar modal
        modal.classList.remove('hidden');
        
        // Focar no primeiro input
        const firstInput = body.querySelector('.quantity-item-input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    hideQuantityModal() {
        const modal = document.getElementById('quantityModal');
        modal.classList.add('hidden');
    }

    async confirmQuantityAction() {
        const modal = document.getElementById('quantityModal');
        const quantityItems = modal.querySelectorAll('.quantity-item');
        const purchaseData = [];

        // Coletar dados de quantidade
        quantityItems.forEach(itemDiv => {
            const itemId = itemDiv.dataset.itemId;
            const input = itemDiv.querySelector('.quantity-item-input');
            const quantidade = parseInt(input.value) || 0;

            // Verificar o item original para validações
            const item = this.itensPedido.find(i => i.id === itemId);
            if (!item) return;

            const qtdeNecessaria = item.quantidade || 0;
            
            // Permitir quantidades parciais - não tem mais validação que bloqueie
            if (quantidade > 0) {
                // Verificar se é maior que o necessário (apenas aviso)
                if (quantidade > qtdeNecessaria) {
                    console.warn(`⚠️ Quantidade para compra (${quantidade}) maior que o necessário (${qtdeNecessaria})`);
                    // Continua mesmo assim - não bloqueia
                }
                
                purchaseData.push({ itemId, quantidade });
            }
        });

        if (purchaseData.length === 0) {
            this.showMessage('Defina pelo menos uma quantidade válida.', 'warning');
            return;
        }

        try {
            // Processar compras
            for (const data of purchaseData) {
                await this.solicitarCompraComQuantidade(data.itemId, data.quantidade);
            }

            this.hideQuantityModal();
            this.showMessage(`✅ ${purchaseData.length} item(s) marcado(s) para compra!`, 'success');
            this.clearSelection();

        } catch (error) {
            console.error('❌ Erro ao processar compras:', error);
            this.showMessage(`Erro ao processar compras: ${error.message}`, 'error');
        }
    }

    async solicitarCompraComQuantidade(itemId, quantidade) {
        try {
            const item = this.itensPedido.find(i => i.id === itemId);
            if (!item) {
                throw new Error('Item não encontrado');
            }

            // VALIDAÇÃO DE SEGURANÇA: Verificar se o item ainda pode ser processado
            const statusAtual = item.statusItem || 'Pendente de Análise';
            if (statusAtual !== 'Pendente de Análise' && statusAtual !== 'Parcialmente Processado') {
                throw new Error(`Este item já foi totalmente processado! Status atual: ${statusAtual}`);
            }

            // 🔧 BUSCAR DADOS DO PEDIDO PAI PARA HERDAR PROJETO
            let dadosPedidoPai = {};
            if (this.pedidoSelecionado) {
                try {
                    const pedidoDoc = await db.collection('pedidos').doc(this.pedidoSelecionado).get();
                    if (pedidoDoc.exists) {
                        dadosPedidoPai = pedidoDoc.data();
                        console.log('📋 Dados do pedido pai carregados:', {
                            clienteNome: dadosPedidoPai.clienteNome,
                            projetoNome: dadosPedidoPai.projetoNome,
                            tipoProjeto: dadosPedidoPai.tipoProjeto
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao buscar dados do pedido pai:', error);
                }
            }

            // Dados do estoque e necessidade
            const qtdeNecessaria = item.quantidade || 0;
            const qtdeEstoque = this.mapaEstoque[item.codigo?.toUpperCase()] || 0;
            
            // Usar a quantidade informada pelo usuário para compra
            const qtdeComprar = Math.max(1, parseInt(quantidade) || 0);
            
            // Verificar quantidades já processadas (se existirem)
            const qtdeAlocarExistente = item.quantidadeAlocar || 0;
            const qtdeComprarExistente = item.quantidadeComprar || 0;
            
            // Calcular novas quantidades (acumulativas)
            const novaQtdeComprar = qtdeComprarExistente + qtdeComprar;
            
            // Para compra parcial, NÃO alocar automaticamente do estoque
            const qtdeAlocar = 0; // Não alocar automaticamente em compra parcial
            
            // Determinar status baseado apenas nas quantidades já processadas pelo usuário
            const qtdeTotalProcessada = qtdeAlocarExistente + novaQtdeComprar;
            let novoStatus;
            
            if (qtdeTotalProcessada >= qtdeNecessaria) {
                // Item totalmente processado pelo usuário
                if (novaQtdeComprar > 0 && qtdeAlocarExistente === 0) {
                    novoStatus = 'Para Compra';
                } else if (qtdeAlocarExistente > 0 && novaQtdeComprar === 0) {
                    novoStatus = 'Em Estoque';
                } else {
                    // Mix de estoque e compra
                    novoStatus = 'Para Compra';
                }
            } else {
                // Item parcialmente processado - ainda precisa de mais análise
                novoStatus = 'Parcialmente Processado';
            }

            console.log(`Processando item: Necessário=${qtdeNecessaria}, Comprar=${novaQtdeComprar}, Alocar=${qtdeAlocarExistente}, Total=${qtdeTotalProcessada}, Status=${novoStatus}`);

            // INÍCIO DO NOVO CÓDIGO - ARQUITETO DE CÓDIGO
            const analiseArrayCompra = item['Analise de Estoque'] || [];

            // Verifica se "Precisamos" já foi gravado
            const precisamosJaGravadoCompra = analiseArrayCompra.some(reg => reg.hasOwnProperty('Precisamos'));
            if (!precisamosJaGravadoCompra) {
                analiseArrayCompra.push({ 'Precisamos': qtdeNecessaria });
            }

            // Grava a quantidade a solicitar para compra
            analiseArrayCompra.push({ 'SolicitarCompra': qtdeComprar });
            // FIM DO NOVO CÓDIGO - ARQUITETO DE CÓDIGO

            // 🔧 GARANTIR HERANÇA DO PROJETO - Usar dados do pedido pai se disponível
            const setData = {
                ...item, // Preserva todos os campos originais (descrição, especificações, etc.)
                statusItem: novoStatus,
                dataAnalise: firebase.firestore.FieldValue.serverTimestamp(),
                quantidadeAlocar: qtdeAlocarExistente, // Manter quantidade alocada existente
                quantidadeComprar: novaQtdeComprar,
                estoqueDisponivel: qtdeEstoque,
                // Garantir campos essenciais (caso não existam no item original)
                codigo: item.codigo,
                quantidade: item.quantidade,
                pedidoId: item.pedidoId,
                listaMaterial: item.listaMaterial || '',
                // 🔧 BUSCAR CAMPO tipoProjeto DO PEDIDO PAI E SALVAR AMBOS OS CAMPOS NO ITEM
                clienteNome: dadosPedidoPai.clienteNome || item.clienteNome,
                projetoNome: dadosPedidoPai.tipoProjeto || item.projetoNome,
                tipoProjeto: dadosPedidoPai.tipoProjeto || item.tipoProjeto,
                // 🎯 NOVA FUNCIONALIDADE: Flag para ocultar da análise quando completo
                ocultarDaAnalise: qtdeTotalProcessada >= qtdeNecessaria,
                'Analise de Estoque': analiseArrayCompra // <-- ADICIONE ESTA LINHA EXATAMENTE AQUI
            };

            // Declarar itemLocal no início para estar disponível em todo o escopo
            let itemLocal = null;
            
            try {
                await db.collection('itens').doc(itemId).set(setData, { merge: true });
                console.log(`✅ Item atualizado: ${novoStatus} - Comprar: ${novaQtdeComprar}, Alocar: ${qtdeAlocarExistente}`);
                
                // Atualizar o item na lista local para refletir os novos valores
                itemLocal = this.itensPedido.find(i => i.id === itemId);
                if (itemLocal) {
                    itemLocal.statusItem = novoStatus;
                    itemLocal.quantidadeComprar = novaQtdeComprar;
                    itemLocal.quantidadeAlocar = qtdeAlocarExistente;
                }
                
            } catch (err) {
                console.error('❌ Erro ao atualizar item:', err);
                throw err;
            }

            // Atualizar status primeiro
            this.updateItemStatus(itemId, novoStatus);
            this.updateProgressStats();
            
            // 🎯 FUNCIONALIDADE CORRIGIDA: Verificar se item está completo APÓS atualizar os dados
            // Usar os valores mais atualizados para a verificação
            if (itemLocal) {
                const itemCompleto = this.isItemTotalmenteCompleto(itemLocal);
                
                // Se o item foi completado, re-renderizar a tabela para ocultá-lo
                if (itemCompleto) {
                    console.log(`🎯 Item ${item.codigo} completado após compra - re-renderizando tabela`);
                    setTimeout(() => {
                        this.renderTabelaConfronto();
                    }, 100); // Pequeno delay para garantir que o DOM foi atualizado
                }
            }
            
            this.checkAnaliseCompleta();

        } catch (error) {
            console.error('❌ Erro ao solicitar compra:', error);
            throw error;
        }
    }

    showMessage(message, type = 'info') {
        // Remover mensagens existentes
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());

        // Criar nova mensagem
        const messageElement = document.createElement('div');
        messageElement.className = type === 'error' ? 'error-message' : 'success-message';
        messageElement.textContent = message;

        // Adicionar após o header
        const header = document.querySelector('.analise-header');
        if (header) {
            header.insertAdjacentElement('afterend', messageElement);

            // Auto-remover após 5 segundos
            setTimeout(() => {
                messageElement.remove();
            }, 5000);
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se estamos na página de análise de estoque
    if (document.getElementById('analiseEstoqueContainer')) {
        window.AnaliseEstoque = new AnaliseEstoqueManager();
    }
});

// Expor globalmente para debug
window.AnaliseEstoqueManager = AnaliseEstoqueManager;