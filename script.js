// Constantes de configuração
const LOCAL_STORAGE_KEY_REPORTS = 'securityReports';
const LOCAL_STORAGE_KEY_AUTH = 'isAuthenticated';
const USERNAME = 'admin';
const PASSWORD = '1234';

// Estado global da aplicação
window.appState = {
    view: 'loading',
    reports: [],
    currentReport: {},
    currentReportId: null,
    authMessage: '',
    previewVisible: true
};

// Objeto para armazenar instâncias do SignaturePad
let signaturePads = {};

// ========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ========================================

window.checkAuth = function() {
    const isAuthenticated = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH) === 'true';
    window.appState.view = isAuthenticated ? 'create' : 'login';
    window.loadReportsLocal();
    window.renderApp();
    // Inicializa componentes dependentes do DOM (assinaturas)
    try {
        if (typeof initializeSignaturePads === 'function') {
            initializeSignaturePads();
        }
    } catch (e) {
        console.warn('Falha ao inicializar pads de assinatura:', e);
    }
};


window.login = function(username, password) {
    if (username === USERNAME && password === PASSWORD) {
        localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, 'true');
        window.appState.view = 'create';
        window.appState.authMessage = '';
        window.loadReportsLocal();
        window.renderApp();
    } else {
        window.appState.authMessage = 'Usuário ou senha inválidos.';
        window.renderApp();
    }
};

window.handleLoginSubmit = function() {
    const form = document.getElementById('login-form');
    if (form) {
        const username = form.elements['username'].value;
        const password = form.elements['password'].value;
        window.login(username, password);
    }
};

window.logout = function() {
    localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH);
    window.appState.view = 'login';
    window.appState.reports = [];
    window.appState.authMessage = 'Você saiu com segurança.';
    window.renderApp();
};

// ========================================
// FUNÇÕES DE PERSISTÊNCIA
// ========================================

window.loadReportsLocal = function() {
    try {
        const storedReports = localStorage.getItem(LOCAL_STORAGE_KEY_REPORTS);
        const loadedReports = storedReports ? JSON.parse(storedReports) : [];
        
        loadedReports.sort((a, b) => {
            const timeA = new Date(b.createdAt || b.shiftStart).getTime();
            const timeB = new Date(a.createdAt || a.shiftStart).getTime();
            return timeA - timeB;
        });
        
        window.appState.reports = loadedReports;
        
        if (Object.keys(window.appState.currentReport).length === 0) {
            window.appState.currentReport = window.getDefaultReportState(loadedReports);
        }
    } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
        window.appState.reports = [];
    }
};

window.saveReportsLocal = function(reports) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_REPORTS, JSON.stringify(reports));
    } catch (error) {
        console.error("Erro ao salvar relatórios:", error);
    }
};

// ========================================
// FUNÇÕES DE SEQUÊNCIA E ESTADO
// ========================================

window.getNextSequence = function(reports) {
    let latestOc = 0, latestMa = 0, latestAv = 0;
    
    const ocRegex = /OC\.(\d+)\/\d{4}/;
    const maRegex = /MA\.(\d+)\/\d{4}/;
    const avRegex = /AV\.(\d+)\/\d{4}/;

    reports.forEach(report => {
        const ocMatch = report.occurrences ? String(report.occurrences).match(ocRegex) : null;
        if (ocMatch && ocMatch[1]) latestOc = Math.max(latestOc, parseInt(ocMatch[1]));
        
        const maMatch = report.maintenance ? String(report.maintenance).match(maRegex) : null;
        if (maMatch && maMatch[1]) latestMa = Math.max(latestMa, parseInt(maMatch[1]));
        
        const avMatch = report.notices ? String(report.notices).match(avRegex) : null;
        if (avMatch && avMatch[1]) latestAv = Math.max(latestAv, parseInt(avMatch[1]));
    });

    const year = new Date().getFullYear();
    const formatNext = (latest, prefix) => {
        const nextNum = latest + 1;
        return `${prefix}.${String(nextNum).padStart(4, '0')}/${year}`;
    };

    return {
        nextOc: `Número: ${formatNext(latestOc, 'OC')} - [Detalhe da Ocorrência]`,
        nextMa: `Número: ${formatNext(latestMa, 'MA')} - [Detalhe da Manutenção]`,
        nextAv: `Número: ${formatNext(latestAv, 'AV')} - [Detalhe do Aviso]`,
    };
};

window.getDefaultReportState = function(reports = []) {
    const sequence = window.getNextSequence(reports);
    const now = Date.now();
    
    return {
        city: 'Anápolis',
        shiftStart: new Date(now - (6 * 3600 * 1000)).toISOString().slice(0, 16),
        shiftEnd: new Date(now + (6 * 3600 * 1000)).toISOString().slice(0, 16),
        incomingOperators: ['Rodrigo Garcia', 'José Geraldo'],
        operatorsOnDuty: ['Rainer Gomes', 'Max Lânio'],
        relator: 'Rainer Gomes',
        outgoingOperators: ['João Paulo', 'Júlio Cezar'],
        equipmentCheck: 'Foi realizado a verificação dos equipamentos relacionados no PO.39, intens. 4.1.3 a 4.1.6. Todos estão de acordo.',
        inactiveCameras: '3625\n3652\n3688\n3699',
        oscillatingCameras: '3125\n3155',
        occurrences: [sequence.nextOc],
        maintenance: [sequence.nextMa],
        notices: [sequence.nextAv],
        closingComments: 'Sem mais a relatar encerramos o plantão.',
        signatureOp1: null,
        signatureOp2: null,
        signatureSupervisor: null,
        createdAt: new Date().toISOString()
    };
};

// ========================================
// FUNÇÕES DE ASSINATURA
// ========================================

function resizeCanvas(canvas) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = signaturePads[canvas.dataset.key]?.toData();
    
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    
    if (data) signaturePads[canvas.dataset.key].fromData(data);
}

// Inicialização automática ao carregar a página
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.checkAuth);
} else {
    // Já carregado
    window.checkAuth();
}

function initializeSignaturePads() {
    const padsToInit = [
        { id: 'signature-op1', key: 'op1', stateKey: 'signatureOp1' },
        { id: 'signature-op2', key: 'op2', stateKey: 'signatureOp2' },
        { id: 'signature-supervisor', key: 'supervisor', stateKey: 'signatureSupervisor' }
    ];

    padsToInit.forEach(({ id, key, stateKey }) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;

        canvas.dataset.key = key;

        if (!signaturePads[key]) {
            signaturePads[key] = new SignaturePad(canvas);

            // Usar a callback onEnd fornecida pelo SignaturePad (instância),
            // pois não é um elemento DOM e não aceita addEventListener
            signaturePads[key].onEnd = () => {
                try {
                    const base64 = signaturePads[key].toDataURL();
                    window.appState.currentReport = {
                        ...window.appState.currentReport,
                        [stateKey]: base64
                    };
                    updatePreview();
                } catch (e) {
                    console.warn('Erro ao gerar base64 da assinatura:', e);
                }
            };
        }

        // Ajusta canvas ao tamanho atual
        resizeCanvas(canvas);

        // Gerencia handler de resize por canvas para não acumular listeners
        if (canvas._resizeHandler) {
            window.removeEventListener('resize', canvas._resizeHandler);
        }
        canvas._resizeHandler = () => resizeCanvas(canvas);
        window.addEventListener('resize', canvas._resizeHandler);

        // Carrega assinatura existente, se houver
        if (window.appState.currentReport[stateKey]) {
            if (signaturePads[key].isEmpty()) {
                try {
                    signaturePads[key].fromDataURL(window.appState.currentReport[stateKey]);
                } catch (e) {
                    console.warn(`Erro ao carregar assinatura ${stateKey}:`, e);
                }
            }
        } else {
            signaturePads[key].clear();
        }
    });
}

window.clearSignature = function(key) {
    const stateKey = `signature${key.charAt(0).toUpperCase() + key.slice(1)}`;
    if (signaturePads[key]) {
        signaturePads[key].clear();
        window.appState.currentReport = {
            ...window.appState.currentReport,
            [stateKey]: null
        };
        updatePreview();
    }
};

// ========================================
// FUNÇÕES DE RELATÓRIO
// ========================================

window.resetReport = function() {
    window.appState.currentReport = window.getDefaultReportState(window.appState.reports);
    window.appState.currentReportId = null;
    signaturePads = {};
    window.appState.view = 'create';
    window.renderApp();
};

window.saveReport = async function() {
    const reportToSave = {
        ...window.appState.currentReport,
        operatorsOnDuty: String(window.appState.currentReport.operatorsOnDuty || '').split('\n').map(s => s.trim()).filter(s => s.length > 0),
        incomingOperators: String(window.appState.currentReport.incomingOperators || '').split('\n').map(s => s.trim()).filter(s => s.length > 0),
        outgoingOperators: String(window.appState.currentReport.outgoingOperators || '').split('\n').map(s => s.trim()).filter(s => s.length > 0),
        createdAt: new Date().toISOString(),
    };

    const reports = [...window.appState.reports];

    if (window.appState.currentReportId) {
        const index = reports.findIndex(r => r.id === window.appState.currentReportId);
        if (index !== -1) reports[index] = { ...reports[index], ...reportToSave };
    } else {
        reportToSave.id = crypto.randomUUID();
        reports.unshift(reportToSave);
    }

    window.saveReportsLocal(reports);
    window.appState.reports = reports;
    window.resetReport();

    showStatusMessage('save-message', '✓ Relatório salvo com sucesso!', 'success');
};

window.loadReportForEditing = function(reportId) {
    const report = window.appState.reports.find(r => r.id === reportId);
    if (report) {
        const loadedReport = {
            ...report,
            operatorsOnDuty: Array.isArray(report.operatorsOnDuty) ? report.operatorsOnDuty.join('\n') : report.operatorsOnDuty || '',
            incomingOperators: Array.isArray(report.incomingOperators) ? report.incomingOperators.join('\n') : report.incomingOperators || '',
            outgoingOperators: Array.isArray(report.outgoingOperators) ? report.outgoingOperators.join('\n') : report.outgoingOperators || '',
        };

        if (report.shiftStart) loadedReport.shiftStart = new Date(report.shiftStart).toISOString().slice(0, 16);
        if (report.shiftEnd) loadedReport.shiftEnd = new Date(report.shiftEnd).toISOString().slice(0, 16);

        // Ensure arrays for multiple sections
        loadedReport.occurrences = Array.isArray(report.occurrences) ? report.occurrences : [report.occurrences || ''];
        loadedReport.maintenance = Array.isArray(report.maintenance) ? report.maintenance : [report.maintenance || ''];
        loadedReport.notices = Array.isArray(report.notices) ? report.notices : [report.notices || ''];

        window.appState.currentReport = loadedReport;
        window.appState.currentReportId = reportId;
        window.appState.view = 'create';
        signaturePads = {};
        window.renderApp();
    }
};

window.handleInputChange = function(e) {
    const { name, value } = e.target;
    window.appState.currentReport = {
        ...window.appState.currentReport,
        [name]: value
    };
    updatePreview();
};

window.handleArrayInputChange = function(e, arrayName, index) {
    const { value } = e.target;
    const array = [...window.appState.currentReport[arrayName]];
    array[index] = value;
    window.appState.currentReport = {
        ...window.appState.currentReport,
        [arrayName]: array
    };
    updatePreview();
};

window.addNewSection = function(sectionName) {
    const sequence = window.getNextSequence(window.appState.reports);
    let newItem = '';
    if (sectionName === 'occurrences') {
        newItem = sequence.nextOc;
    } else if (sectionName === 'maintenance') {
        newItem = sequence.nextMa;
    } else if (sectionName === 'notices') {
        newItem = sequence.nextAv;
    }
    const array = [...window.appState.currentReport[sectionName], newItem];
    window.appState.currentReport = {
        ...window.appState.currentReport,
        [sectionName]: array
    };
    window.renderApp();
};

function updatePreview() {
    // Prévia removida da tela, função mantida para compatibilidade
}

// ========================================
// FORMATAÇÃO DO RELATÓRIO
// ========================================

window.formatReportText = function(data) {
    const formatDate = (datetime) => {
        if (!datetime) return "Data e Hora não fornecidas";
        const d = new Date(datetime);
        if (isNaN(d.getTime())) return "Data Inválida";
        
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        };
        const formatted = d.toLocaleDateString('pt-BR', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace(',', '').replace(' ', ', ').replace(':', 'h');
    };

    const getOperatorArray = (opData) => {
        if (Array.isArray(opData)) return opData;
        if (typeof opData === 'string') return opData.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        return [];
    };

    const operatorsOnDuty = getOperatorArray(data.operatorsOnDuty);
    const incomingOperators = getOperatorArray(data.incomingOperators);
    const outgoingOperators = getOperatorArray(data.outgoingOperators);

    const renderSignatureLine = (base64, label) => {
        const style = `display: inline-block; width: 30%; text-align: center; margin-top: 40px; font-size: 0.9rem;`;
        const labelStyle = `display: block; margin-top: 5px;`;

        if (base64) {
            return `
                <div style="${style}">
                    <img src="${base64}" alt="${label}" style="width: 100%; height: 60px; border-bottom: 1px solid #000; object-fit: contain;">
                    <span style="${labelStyle}">${label}</span>
                </div>
            `;
        }
        return `<div style="display: inline-block; width: 30%; margin-top: 40px; border-top: 1px solid #000; text-align: center; font-size: 0.9rem;">${label}</div>`;
    };

    return `
        <h1 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem; text-align: center;">RELATÓRIO DE PLANTÃO</h1>
        <p style="margin-bottom: 1rem;">${data.city || 'N/A'}, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

        <div class="report-section">
            <p><strong>Início do plantão:</strong> ${formatDate(data.shiftStart)}</p>
            <p><strong>Fim do plantão:</strong> ${formatDate(data.shiftEnd)}</p>
            <p><strong>Operadores:</strong> ${operatorsOnDuty.join(' e ') || 'N/A'}</p>
            <p><strong>Relator:</strong> ${data.relator || 'N/A'}</p>
        </div>

        <p style="margin-bottom: 1rem;">Recebemos o posto de serviço dos operadores ${incomingOperators.join(' e ') || 'N/A'}, juntamente com o ocorrido no último plantão.</p>

        <h2 style="font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">1. Verificação de Equipamentos</h2>
        <p style="font-size: 0.875rem;">${data.equipmentCheck || 'Nenhum comentário adicional sobre equipamentos.'}</p>
        <p style="margin-top: 0.5rem;">Foi realizado a verificação dos equipamentos relacionados no PO.39, intens. 4.1.3 a 4.1.6 e todos estão de acordo, à exceção de:</p>
        
        <div style="margin-left: 1rem; margin-top: 0.5rem; margin-bottom: 1rem;">
            <p><strong>Câmeras inoperantes GLPI:</strong> ${data.inactiveCameras.split('\n').filter(c => c.trim()).join(', ') || 'N/A'}</p>
            <p><strong>Câmeras oscilando GLPI:</strong> ${data.oscillatingCameras.split('\n').filter(c => c.trim()).join(', ') || 'N/A'}</p>
        </div>
        
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">2. Ocorrências do plantão</h2>
        <p style="font-size: 0.875rem;">${Array.isArray(data.occurrences) ? data.occurrences.join('<br><br>') : data.occurrences || 'Nenhuma ocorrência registrada neste plantão.'}</p>

        <h2 style="font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">3. Manutenções</h2>
        <p style="font-size: 0.875rem;">${Array.isArray(data.maintenance) ? data.maintenance.join('<br><br>') : data.maintenance || 'Nenhuma manutenção registrada neste plantão.'}</p>

        <h2 style="font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">4. Avisos</h2>
        <p style="font-size: 0.875rem;">${Array.isArray(data.notices) ? data.notices.join('<br><br>') : data.notices || 'Nenhum aviso registrado neste plantão.'}</p>

        <h2 style="font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">5. Encerramento</h2>
        <p style="margin-top: 1rem;">${data.closingComments || 'Sem mais a relatar, encerramos o plantão'}. Repassamos o posto de serviço aos operadores ${outgoingOperators.join(' e ') || 'N/A'}, para ciência:</p>

        <div style="margin-top: 2.5rem; display: flex; justify-content: space-between;">
            ${renderSignatureLine(data.signatureOp1, `Assinatura do Operador (${operatorsOnDuty[0] || 'N/A'})`)}
            ${renderSignatureLine(data.signatureOp2, `Assinatura do Operador (${operatorsOnDuty[1] || 'N/A'})`)}
            ${renderSignatureLine(data.signatureSupervisor, `Assinatura do Encarregado`)}
        </div>
    `;
};

// ========================================
// GERAÇÃO DE PDF
// ========================================

window.generatePDF = function() {
    const element = document.getElementById('report-output');
    element.innerHTML = window.formatReportText(window.appState.currentReport);
    element.style.display = 'block';

    const options = {
        margin: 10,
        filename: `Relatorio_Seguranca_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(options).save().then(() => {
        element.style.display = 'none';
    });

    showStatusMessage('pdf-message', '✓ PDF gerado e download iniciado!', 'success');
};

window.openPreviewInNewTab = function() {
    const reportHtml = window.formatReportText(window.appState.currentReport);
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Prévia do Relatório</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: white; color: black; }
                h1, h2 { color: #333; }
                p { line-height: 1.6; }
                .signature-line { border-top: 1px solid #000; margin-top: 40px; text-align: center; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            ${reportHtml}
        </body>
        </html>
    `);
    newWindow.document.close();
};

function showStatusMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status-message status-${type} pulse-animation`;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, 3000);
    }
}

// ========================================
// RENDERIZAÇÃO DA APLICAÇÃO
// ========================================

window.renderApp = function() {
    const appContainer = document.getElementById('app');

    // Tela de carregamento
    if (window.appState.view === 'loading') {
        appContainer.innerHTML = `
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: white;">
                    <div class="spinner" style="margin: 0 auto 20px;"></div>
                    <p style="font-size: 20px;">Carregando sistema...</p>
                </div>
            </div>
        `;
        return;
    }

    // Tela de login
    if (window.appState.view === 'login') {
        appContainer.innerHTML = `
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;" class="fade-in">
                <div style="width: 100%; max-width: 450px;">
                    <div class="glass-effect" style="border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <div style="display: inline-block; padding: 20px; background: white; border-radius: 50%; margin-bottom: 20px;">
                                <svg style="width: 60px; height: 60px; color: #667eea;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                </svg>
                            </div>
                            <h1 style="font-size: 32px; font-weight: 800; color: white; margin-bottom: 8px;">Sistema de Segurança</h1>
                            <p style="color: rgba(255,255,255,0.8); font-size: 16px;">Autenticação Segura</p>
                        </div>

                        ${window.appState.authMessage ? `
                            <div class="status-message status-error" style="margin-bottom: 20px;">
                                ${window.appState.authMessage}
                            </div>
                        ` : ''}

                        <form id="login-form" onsubmit="event.preventDefault(); window.handleLoginSubmit()">
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; color: white; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Usuário</label>
                                <input type="text" name="username" value="admin" required
                                    style="width: 100%; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 14px;"
                                    placeholder="Digite seu usuário">
                            </div>
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; color: white; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Senha</label>
                                <input type="password" name="password" value="1234" required
                                    style="width: 100%; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 14px;"
                                    placeholder="Digite sua senha">
                            </div>
                            <button type="submit" style="width: 100%; background: white; color: #667eea; font-weight: 700; padding: 14px; border-radius: 10px; border: none; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease;">
                                Acessar Sistema
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Tela principal
    const reports = window.appState.reports;
    let currentReport = window.appState.currentReport;

    const operatorsOnDutyString = Array.isArray(currentReport.operatorsOnDuty) ? currentReport.operatorsOnDuty.join('\n') : currentReport.operatorsOnDuty || '';
    const incomingOperatorsString = Array.isArray(currentReport.incomingOperators) ? currentReport.incomingOperators.join('\n') : currentReport.incomingOperators || '';
    const outgoingOperatorsString = Array.isArray(currentReport.outgoingOperators) ? currentReport.outgoingOperators.join('\n') : currentReport.outgoingOperators || '';

    appContainer.innerHTML = `
        <div class="container-main">
            <!-- Sidebar -->
            <div class="sidebar scrollbar-custom slide-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <h2 style="font-size: 22px; font-weight: 700;">Relatórios</h2>
                    <button onclick="window.logout()" class="btn btn-danger" style="font-size: 12px; padding: 8px 16px;">
                        Sair
                    </button>
                </div>

                <button onclick="window.resetReport()" class="btn btn-primary w-full mb-4">
                    ➕ Novo Relatório
                </button>

                <button onclick="openPreviewInNewTab()" class="btn btn-secondary w-full mb-4">
                    👁️ Prévia do Relatório
                </button>

                <div id="save-message" class="status-message"></div>

                <div class="scrollbar-custom" style="max-height: calc(100vh - 250px); overflow-y: auto;">
                    ${reports.length === 0 ? `
                        <p style="text-align: center; color: rgba(255,255,255,0.6); padding: 32px 0;">
                            Nenhum relatório salvo ainda.
                        </p>
                    ` : reports.map(report => `
                        <div class="report-card" onclick="window.loadReportForEditing('${report.id}')">
                            <div class="report-card-title">${report.city || 'Local não especificado'}</div>
                            <div class="report-card-subtitle">
                                ${new Date(report.shiftStart).toLocaleDateString('pt-BR')} - ${report.relator || 'Sem relator'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Área de conteúdo -->
            <div class="content-area scrollbar-custom">
                <h1 style="font-size: 32px; font-weight: 800; color: white; margin-bottom: 24px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                    ${window.appState.currentReportId ? '✏️ Editar Relatório' : '📝 Criar Novo Relatório'}
                </h1>

                <div class="form-grid">
                        <h2 class="form-section-title">📋 Dados do Plantão</h2>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label class="form-label">Cidade</label>
                                <input type="text" name="city" value="${currentReport.city || ''}" oninput="handleInputChange(event)" class="input-modern">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Relator Principal</label>
                                <input type="text" name="relator" value="${currentReport.relator || ''}" oninput="handleInputChange(event)" class="input-modern">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label class="form-label">Início do plantão</label>
                                <input type="datetime-local" name="shiftStart" value="${currentReport.shiftStart || ''}" oninput="handleInputChange(event)" class="input-modern">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Fim do plantão</label>
                                <input type="datetime-local" name="shiftEnd" value="${currentReport.shiftEnd || ''}" oninput="handleInputChange(event)" class="input-modern">
                            </div>
                        </div>

                        <h2 class="form-section-title">👥 Operadores</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label class="form-label">Operadores Recebendo o Turno</label>
                                <textarea name="operatorsOnDuty" oninput="handleInputChange(event)" class="input-modern" placeholder="Um por linha">${operatorsOnDutyString}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Operadores Encerrando o Turno</label>
                                <textarea name="incomingOperators" oninput="handleInputChange(event)" class="input-modern" placeholder="Um por linha">${incomingOperatorsString}</textarea>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Operadores do Próximo Turno</label>
                            <textarea name="outgoingOperators" oninput="handleInputChange(event)" class="input-modern" placeholder="Um por linha">${outgoingOperatorsString}</textarea>
                        </div>

                        <h2 class="form-section-title">🔧 Verificação de Equipamentos</h2>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Comentários sobre Equipamentos</label>
                            <textarea name="equipmentCheck" oninput="handleInputChange(event)" class="input-modern" placeholder="Descreva a verificação dos equipamentos">${currentReport.equipmentCheck || ''}</textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label class="form-label">Equipamentos Inoperantes (GLPI)</label>
                                <textarea name="inactiveCameras" oninput="handleInputChange(event)" class="input-modern" placeholder="Uma por linha">${currentReport.inactiveCameras || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Equipamentos Oscilando (GLPI)</label>
                                <textarea name="oscillatingCameras" oninput="handleInputChange(event)" class="input-modern" placeholder="Uma por linha">${currentReport.oscillatingCameras || ''}</textarea>
                            </div>
                        </div>

                        <h2 class="form-section-title">🚨 Ocorrências</h2>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Detalhes das Ocorrências</label>
                            ${Array.isArray(currentReport.occurrences) ? currentReport.occurrences.map((occ, index) => `
                                <textarea name="occurrences-${index}" oninput="handleArrayInputChange(event, 'occurrences', ${index})" class="input-modern" placeholder="Descreva a ocorrência ${index + 1}">${occ || ''}</textarea>
                            `).join('') : `<textarea name="occurrences" oninput="handleInputChange(event)" class="input-modern" placeholder="Descreva as ocorrências do plantão">${currentReport.occurrences || ''}</textarea>`}
                            <button onclick="addNewSection('occurrences')" class="btn btn-secondary" style="margin-top: 8px; font-size: 12px;">+ Adicionar Novo Espaço</button>
                        </div>

                        <h2 class="form-section-title">🛠️ Manutenções</h2>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Detalhes das Manutenções</label>
                            ${Array.isArray(currentReport.maintenance) ? currentReport.maintenance.map((mnt, index) => `
                                <textarea name="maintenance-${index}" oninput="handleArrayInputChange(event, 'maintenance', ${index})" class="input-modern" placeholder="Descreva a manutenção ${index + 1}">${mnt || ''}</textarea>
                            `).join('') : `<textarea name="maintenance" oninput="handleInputChange(event)" class="input-modern" placeholder="Descreva as manutenções realizadas">${currentReport.maintenance || ''}</textarea>`}
                            <button onclick="addNewSection('maintenance')" class="btn btn-secondary" style="margin-top: 8px; font-size: 12px;">+ Adicionar Novo Espaço</button>
                        </div>

                        <h2 class="form-section-title">📢 Avisos</h2>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Detalhes dos Avisos</label>
                            ${Array.isArray(currentReport.notices) ? currentReport.notices.map((not, index) => `
                                <textarea name="notices-${index}" oninput="handleArrayInputChange(event, 'notices', ${index})" class="input-modern" placeholder="Descreva o aviso ${index + 1}">${not || ''}</textarea>
                            `).join('') : `<textarea name="notices" oninput="handleInputChange(event)" class="input-modern" placeholder="Descreva os avisos do plantão">${currentReport.notices || ''}</textarea>`}
                            <button onclick="addNewSection('notices')" class="btn btn-secondary" style="margin-top: 8px; font-size: 12px;">+ Adicionar Novo Espaço</button>
                        </div>

                        <h2 class="form-section-title">📝 Encerramento</h2>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label">Comentários de Encerramento</label>
                            <textarea name="closingComments" oninput="handleInputChange(event)" class="input-modern" placeholder="Comentários finais">${currentReport.closingComments || ''}</textarea>
                        </div>

                        <h2 class="form-section-title">✍️ Assinaturas</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                            <div class="signature-container">
                                <label class="signature-label">Operador 1</label>
                                <canvas id="signature-op1" class="signature-canvas"></canvas>
                                <button onclick="window.clearSignature('op1')" class="signature-clear-btn">Limpar</button>
                            </div>
                            <div class="signature-container">
                                <label class="signature-label">Operador 2</label>
                                <canvas id="signature-op2" class="signature-canvas"></canvas>
                                <button onclick="window.clearSignature('op2')" class="signature-clear-btn">Limpar</button>
                            </div>
                            <div class="signature-container">
                                <label class="signature-label">Encarregado</label>
                                <canvas id="signature-supervisor" class="signature-canvas"></canvas>
                                <button onclick="window.clearSignature('supervisor')" class="signature-clear-btn">Limpar</button>
                            </div>
                        </div>

                        <div style="display:flex; gap:12px; margin-top:12px;">
                            <button onclick="window.saveReport()" class="btn btn-success">Salvar Relatório</button>
                            <button onclick="window.generatePDF()" class="btn btn-secondary">Gerar PDF</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Após injetar o HTML, inicializa elementos dependentes do DOM
    try {
        if (typeof initializeSignaturePads === 'function') initializeSignaturePads();
    } catch (e) {
        console.warn('Erro ao inicializar assinaturas após render:', e);
    }

    updatePreview();
};