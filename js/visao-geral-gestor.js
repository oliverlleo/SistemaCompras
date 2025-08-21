class VisaoGeralGestor {
    constructor() {
        this.db = firebase.firestore();
        this.clientes = new Map();

        this.loadingState = document.getElementById('loading-state');
        this.emptyState = document.getElementById('empty-state');
        this.clientesContainer = document.getElementById('clientes-container');
        this.modal = document.getElementById('details-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalTableHead = document.getElementById('modal-table-head');
        this.modalTableBody = document.getElementById('modal-table-body');
        this.modalCloseBtn = document.getElementById('modal-close-btn');

        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            await this.carregarDados();
            this.renderizar();
        } catch (error) {
            console.error("Erro fatal ao inicializar o dashboard do gestor:", error);
            this.showError("Não foi possível carregar os dados do sistema. Verifique o console para mais detalhes.");
        }
    }

    setupEventListeners() {
        this.modalCloseBtn.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }

    showError(message) {
        this.loadingState.classList.add('hidden');
        this.clientesContainer.innerHTML = `<div class="card p-8 text-center bg-red-50 text-red-700">${message}</div>`;
    }

    async carregarDados() {
        const [pedidosSnapshot, itensSnapshot] = await Promise.all([
            this.db.collection('pedidos').get(),
            this.db.collection('itens').get()
        ]);

        if (pedidosSnapshot.empty) return;

        const itensPorPedido = new Map();
        itensSnapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            if (item.pedidoId) {
                if (!itensPorPedido.has(item.pedidoId)) {
                    itensPorPedido.set(item.pedidoId, []);
                }
                itensPorPedido.get(item.pedidoId).push(item);
            }
        });

        pedidosSnapshot.forEach(doc => {
            const pedido = { id: doc.id, ...doc.data() };
            const itensDoPedido = itensPorPedido.get(pedido.id) || [];
            if (itensDoPedido.length === 0) return;

            const clienteNome = pedido.clienteNome || "Cliente não identificado";
            const projetoNome = pedido.tipoProjeto || "Projeto não identificado";

            if (!this.clientes.has(clienteNome)) this.clientes.set(clienteNome, new Map());
            const projetosDoCliente = this.clientes.get(clienteNome);

            if (!projetosDoCliente.has(projetoNome)) projetosDoCliente.set(projetoNome, new Map());
            const listasDoProjeto = projetosDoCliente.get(projetoNome);

            itensDoPedido.forEach(item => {
                const listaNome = item.listaMaterial || "Lista não identificada";
                if (!listasDoProjeto.has(listaNome)) listasDoProjeto.set(listaNome, []);
                listasDoProjeto.get(listaNome).push(item);
            });
        });
    }

    calcularStatusDaLista(itens) {
        if (!itens || itens.length === 0) return {};

        const resultado = {};

        // Etapa 1: Compra Inicial
        const itensCompraInicialConcluido = itens.filter(i => (i.qtdeComprada || 0) > 0);
        resultado['Compra Inicial'] = {
            total: itens.length,
            concluido: itensCompraInicialConcluido,
            pendente: itens.filter(i => !itensCompraInicialConcluido.includes(i)),
        };

        // Etapa 2: Recebimento Inicial
        const itensParaRecebimentoInicial = itens.filter(i => (i.qtdeComprada || 0) > 0);
        const itensRecebimentoInicialConcluido = itensParaRecebimentoInicial.filter(i => {
            const comprado = i.qtdeComprada || 0;
            const recebido = (i.historicoRecebimentos || [])
                .filter(r => r.tipoCompra !== 'Final' && r.tipoRecebimento !== 'Final')
                .reduce((acc, r) => acc + (r.qtde || r.qtdeRecebida || 0), 0);
            return recebido >= comprado;
        });
        resultado['Recebimento Inicial'] = {
            total: itensParaRecebimentoInicial.length,
            concluido: itensRecebimentoInicialConcluido,
            pendente: itensParaRecebimentoInicial.filter(i => !itensRecebimentoInicialConcluido.includes(i)),
        };

        // Etapa 3: Empenho
        const itensEmpenhados = itens.filter(i => i.statusItem === 'Empenhado');
        resultado['Empenho'] = {
            total: itens.length,
            concluido: itensEmpenhados,
            pendente: itens.filter(i => !itensEmpenhados.includes(i)),
        };

        // Etapa 4: Compra Final
        const itensQuePrecisamCompraFinal = itens.filter(i => i.precisaCompraFinal === true);
        if (itensQuePrecisamCompraFinal.length > 0) {
            const itensCompraFinalConcluida = itensQuePrecisamCompraFinal.filter(i => i.compraFinalConcluida === true);
            resultado['Compra Final'] = {
                total: itensQuePrecisamCompraFinal.length,
                concluido: itensCompraFinalConcluida,
                pendente: itensQuePrecisamCompraFinal.filter(i => !itensCompraFinalConcluida.includes(i)),
            };
        }

        // Etapa 5: Recebimento Final
        const itensQuePrecisamRecebimentoFinal = itens.filter(i => i.historicoCompraFinal && i.historicoCompraFinal.length > 0);
        if (itensQuePrecisamRecebimentoFinal.length > 0) {
            const itensRecebimentoFinalConcluido = itensQuePrecisamRecebimentoFinal.filter(i => {
                 const compradoFinal = (i.historicoCompraFinal || []).reduce((acc, c) => acc + (c.qtdeComprada || 0), 0);
                 if (compradoFinal === 0) return false;
                 const recebidoFinal = (i.historicoRecebimentos || []).filter(r => r.tipoCompra === 'Final' || r.tipoRecebimento === 'Final').reduce((acc, r) => acc + (r.qtde || r.qtdeRecebida || 0), 0);
                 return recebidoFinal >= compradoFinal;
            });
            resultado['Recebimento Final'] = {
                total: itensQuePrecisamRecebimentoFinal.length,
                concluido: itensRecebimentoFinalConcluido,
                pendente: itensQuePrecisamRecebimentoFinal.filter(i => !itensRecebimentoFinalConcluido.includes(i)),
            };
        }

        // Etapa 6: Separação para Produção
        const itensQuePrecisamSeparacao = itens.filter(i => (i.QtdItemNecFinal || 0) > 0);
        if (itensQuePrecisamSeparacao.length > 0) {
           const itensSeparados = itensQuePrecisamSeparacao.filter(i => i.statusItem === 'Separado para Produção' || (i.qtdProducao || 0) > 0);
           resultado['Separação Final'] = {
               total: itensQuePrecisamSeparacao.length,
               concluido: itensSeparados,
               pendente: itensQuePrecisamSeparacao.filter(i => !itensSeparados.includes(i)),
           };
        }

        return resultado;
    }

    renderizarStatusBadge(etapa, dadosEtapa) {
        if (!dadosEtapa || dadosEtapa.total === 0) {
            return `<span class="status-badge status-na">N/A</span>`;
        }

        const { total, concluido, pendente } = dadosEtapa;
        let status, classe, icone;

        if (concluido.length >= total) {
            status = 'Concluído';
            classe = 'status-concluido';
            icone = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`;
        } else if (concluido.length > 0) {
            status = 'Parcial';
            classe = 'status-parcial';
            icone = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"></path></svg>`;
        } else {
            status = 'Pendente';
            classe = 'status-pendente';
            icone = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg>`;
        }

        // Prepara os dados para o onclick do modal, escapando aspas
        const dataPendenteStr = JSON.stringify(pendente).replace(/"/g, '&quot;');
        const dataConcluidoStr = JSON.stringify(concluido).replace(/"/g, '&quot;');

        // Renderiza o badge completo com a contagem e os onclicks
        return `<span class="status-badge ${classe}"
                      onclick='window.visaoGeralGestor.mostrarDetalhes("${etapa}", this.dataset.itens, "pendente")'
                      data-itens="${dataPendenteStr}">
                    ${icone} ${status} (${concluido.length}/${total})
                </span>`;
    }

    renderizar() {
        this.loadingState.classList.add('hidden');
        if (this.clientes.size === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }

        let html = '';
        const sortedClientes = [...this.clientes.keys()].sort();

        for (const clienteNome of sortedClientes) {
            const projetos = this.clientes.get(clienteNome);
            let projetosHtml = '';
            const sortedProjetos = [...projetos.keys()].sort();

            for (const projetoNome of sortedProjetos) {
                const listas = projetos.get(projetoNome);
                let listasHtml = '';
                const sortedListas = [...listas.keys()].sort();

                for (const listaNome of sortedListas) {
                    const itens = listas.get(listaNome);
                    const statusPorEtapa = this.calcularStatusDaLista(itens);

                    let statusHtml = '';
                    const etapas = ['Compra Inicial', 'Recebimento Inicial', 'Empenho', 'Compra Final', 'Recebimento Final', 'Separação Final'];

                    etapas.forEach(etapa => {
                        statusHtml += `
                            <div class="flex justify-between items-center py-2">
                                <span class="text-sm text-slate-600 font-medium">${etapa}</span>
                                ${this.renderizarStatusBadge(etapa, statusPorEtapa[etapa])}
                            </div>
                        `;
                    });

                    listasHtml += `
                        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h5 class="font-semibold text-slate-800">${listaNome} <span class="text-sm font-normal text-slate-500">(${itens.length} itens)</span></h5>
                            <div class="mt-2 divide-y divide-slate-200">
                                ${statusHtml}
                            </div>
                        </div>
                    `;
                }

                projetosHtml += `
                    <div class="ml-4 mt-4 pl-4 border-l-2 border-slate-200">
                        <h4 class="text-lg font-semibold text-slate-800">${projetoNome}</h4>
                        <div class="mt-4 space-y-4">
                            ${listasHtml}
                        </div>
                    </div>
                `;
            }

            html += `
                <div class="card">
                    <div class="p-6">
                        <h2 class="text-2xl font-bold text-purple-800">${clienteNome}</h2>
                        <div class="mt-4">
                            ${projetosHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        this.clientesContainer.innerHTML = html;
        window.visaoGeralGestor = this; // Expor globalmente para os onclicks
    }

    mostrarDetalhes(etapa, itensStr, tipoStatus) {
        const itens = JSON.parse(itensStr);
        this.modalTitle.textContent = `Detalhes: ${etapa} (${tipoStatus})`;

        let headers = ['Código', 'Descrição', 'Qtd. Necessária'];
        if (etapa.includes('Recebimento')) {
            headers.push('Qtd. Comprada', 'Qtd. Recebida', 'Último Recebimento');
        } else if (etapa === 'Empenho') {
            headers.push('Status Atual');
        }

        this.modalTableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">${h}</th>`).join('')}</tr>`;

        let bodyHtml = '';
        if (!itens || itens.length === 0) {
            bodyHtml = '<tr><td colspan="100%" class="text-center p-8 text-slate-500">Nenhum item para exibir.</td></tr>';
        } else {
            itens.forEach(item => {
                let extraCols = '';
                if (etapa.includes('Recebimento')) {
                    const comprado = item.qtdeComprada || 0;
                    const recebido = (item.historicoRecebimentos || []).reduce((acc, r) => acc + (r.qtde || r.qtdeRecebida || 0), 0);
                    const ultimoRecebimento = (item.historicoRecebimentos || []).length > 0 ? new Date((item.historicoRecebimentos.slice(-1)[0].data)).toLocaleDateString('pt-BR') : 'N/A';
                    extraCols = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${comprado}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${recebido}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${ultimoRecebimento}</td>
                    `;
                } else if (etapa === 'Empenho') {
                    extraCols = `<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${item.statusItem || 'Pendente'}</td>`;
                }
                bodyHtml += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${item.codigo}</td>
                        <td class="px-6 py-4 text-sm text-slate-500">${item.descricao}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${item.quantidade || (item.qtdeComprada || 0)}</td>
                        ${extraCols}
                    </tr>
                `;
            });
        }
        this.modalTableBody.innerHTML = bodyHtml;

        this.modal.classList.remove('hidden');
    }

    closeModal() {
        this.modal.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VisaoGeralGestor();
});
