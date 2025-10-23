jQuery(document).ready(function($){
    
    // --- FUNÇÕES UTILITÁRIAS ---
    function formatBR(v){
        return Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    }

    // Retorna dias do mês (monthIndex: 0-11)
    function daysInMonth(year, monthIndex){
        return new Date(year, monthIndex + 1, 0).getDate();
    }
    
    // Calcula dias de aviso prévio (30 + 3/ano completo, máximo 90)
    function calculateAvisoDays(admissionDate, dismissalDate) {
        const diffTime = dismissalDate.getTime() - admissionDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const fullYears = Math.floor(diffDays / 365.25);
        const extraDays = Math.min(fullYears * 3, 60); 
        return 30 + extraDays;
    }

    // Calcula meses proporcionais (Regra: 15+ dias = 1 mês)
    function calculateProportionalMonths(startDate, endDate) {
        if (endDate < startDate) return 0;
        
        let months = 0;
        let currentDate = new Date(startDate);
        
        // Determina o início do período proporcional (1º jan do ano da demissão ou admissão)
        const endYear = endDate.getFullYear();
        const periodStart = (startDate.getFullYear() === endYear) 
            ? new Date(startDate) 
            : new Date(endYear, 0, 1);
        
        currentDate = new Date(periodStart);
        
        while (currentDate <= endDate && months < 12) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            
            // Determina primeiro e último dia do mês a considerar
            let firstDay = 1;
            let lastDay = daysInMonth(year, month);
            
            // Se é o mês inicial, começa do dia de admissão
            if (year === periodStart.getFullYear() && month === periodStart.getMonth()) {
                firstDay = periodStart.getDate();
            }
            
            // Se é o mês final, termina no dia da demissão
            if (year === endDate.getFullYear() && month === endDate.getMonth()) {
                lastDay = endDate.getDate();
            }
            
            const daysWorked = lastDay - firstDay + 1;
            
            // Regra: 15 ou mais dias = conta 1 mês
            if (daysWorked >= 15) {
                months++;
            }
            
            // Avança para próximo mês
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
        }
        
        return Math.min(12, Math.max(0, months));
    }

    // Calcula dias trabalhados no mês da demissão
    function calculateDaysWorkedInMonth(dismissalDate) {
        return dismissalDate.getDate();
    }

    // --- EVENT HANDLER PRINCIPAL ---
    $("#calcBtn").on("click", function(){
        
        // 1. LEITURA DOS CAMPOS
        const salario = parseFloat($("#salario_bruto").val()) || 0;
        const dataAdmissaoInput = $("#data_contratacao").val();
        const dataDispensaInput = $("#data_dispensa").val();
        const type = $("#forma_demissao").val();
        const avisoType = $("#aviso_previo").val();
        
        const feriasVencidasDias = parseInt($("#ferias_vencidas_dias").val()) || 0;
        const decimoAtrasadoQtd = parseInt($("#decimo_terceiro_atrasado").val()) || 0;
        const horasExtrasValor = parseFloat($("#horas_extras_valor").val()) || 0;
        const adicionalCheck = $("#adicional_insalubridade").is(":checked");
        
        const resultDiv = $("#result");
        resultDiv.empty();

        // 2. VALIDAÇÕES
        if (!salario || !dataAdmissaoInput || !dataDispensaInput || !type || !avisoType) {
            resultDiv.html('<h3>Erro de Validação</h3><p style="color: red;">Preencha todos os campos obrigatórios (Salário, Datas, Forma de Demissão e Aviso Prévio).</p>');
            return;
        }

        const admission = new Date(dataAdmissaoInput + 'T00:00:00');
        const dismissal = new Date(dataDispensaInput + 'T00:00:00');

        // Valida se as datas são válidas
        if (isNaN(admission.getTime()) || isNaN(dismissal.getTime())) {
            resultDiv.html('<h3>Erro de Validação</h3><p style="color: red;">Datas inválidas. Verifique os campos de data.</p>');
            return;
        }

        if (dismissal < admission) {
            resultDiv.html('<h3>Erro de Validação</h3><p style="color: red;">A Data de Dispensa não pode ser anterior à Data de Contratação.</p>');
            return;
        }

        // --- 3. PREPARAÇÃO DE DADOS ---
        
        // Valores base (mês comercial = 30 dias, ano = 12 meses)
        const valorDia = salario / 30;
        const valorMes = salario / 12;

        // Data final do contrato (pode ser projetada pelo aviso)
        let projectedDismissalDate = new Date(dismissal);
        let avisoValor = 0;
        let avisoDesconto = 0;
        let diasAvisoTotal = 0;

        // Calcula aviso prévio
        if (avisoType === "indenizado" && (type === "sem_justa_causa" || type === "rescisao_indireta")) {
            diasAvisoTotal = calculateAvisoDays(admission, dismissal);
            avisoValor = valorDia * diasAvisoTotal;
            
            // Projeta a data final do contrato
            projectedDismissalDate = new Date(dismissal);
            projectedDismissalDate.setDate(dismissal.getDate() + diasAvisoTotal);
            
        } else if (avisoType === "trabalhado" && (type === "sem_justa_causa" || type === "rescisao_indireta")) {
            // Aviso trabalhado: dismissal já é o último dia
            diasAvisoTotal = calculateAvisoDays(admission, dismissal);
            
        } else if (avisoType === "nao_cumprido" && type === "pedido_demissao") {
            // Pedido de demissão sem cumprir aviso: desconta 30 dias
            avisoDesconto = salario;
        }

        // Dias trabalhados no mês da demissão
        const daysWorkedInDismissalMonth = calculateDaysWorkedInMonth(dismissal);
        
        // Meses proporcionais (usa data projetada para 13º e férias)
        const proportionalMonths = calculateProportionalMonths(admission, projectedDismissalDate);

        // --- 4. CÁLCULO DE VERBAS ---
        let proventos = 0;
        let descontos = 0;

        // 1. Saldo de Salário (baseado em dias trabalhados no mês)
        const saldoSalario = valorDia * daysWorkedInDismissalMonth;
        proventos += saldoSalario;

        // 2. Aviso Prévio
        if (avisoValor > 0) {
            proventos += avisoValor;
        }
        if (avisoDesconto > 0) {
            descontos += avisoDesconto;
        }

        // 3. 13º Salário Proporcional
        let decimoProporcional = 0;
        if (type !== "com_justa_causa") {
            decimoProporcional = valorMes * proportionalMonths;
            proventos += decimoProporcional;
        }
        
        // 4. Férias Proporcionais + 1/3
        let feriasPropComTerco = 0;
        if (type !== "com_justa_causa") {
            const feriasPropSimples = valorMes * proportionalMonths;
            feriasPropComTerco = feriasPropSimples * (4/3);
            proventos += feriasPropComTerco;
        }

        // 5. Férias Vencidas + 1/3
        let feriasVencValor = 0;
        if (feriasVencidasDias > 0) {
            const feriasVencSimples = valorDia * feriasVencidasDias;
            feriasVencValor = feriasVencSimples * (4/3);
            proventos += feriasVencValor;
        }
        
        // 6. 13º Atrasado
        let decimoAtrasadoValor = 0;
        if (decimoAtrasadoQtd > 0) {
            decimoAtrasadoValor = salario * decimoAtrasadoQtd;
            proventos += decimoAtrasadoValor;
        }
        
        // 7. Horas Extras
        if (horasExtrasValor > 0) {
            proventos += horasExtrasValor;
        }

        // --- 5. EXIBIÇÃO DE RESULTADOS ---
        let html = `<h3>Resultado Estimado (BRUTO)</h3>`;
        html += `<h4>Verbas Rescisórias (Proventos)</h4>`;
        html += `<ul class="rescisao-results-list">`;
        html += `<li><span>Saldo de salário (${daysWorkedInDismissalMonth} ${daysWorkedInDismissalMonth === 1 ? 'dia' : 'dias'}):</span> <strong>R$ ${formatBR(saldoSalario)}</strong></li>`;
        
        if (avisoValor > 0) {
            html += `<li><span>Aviso prévio indenizado (${diasAvisoTotal} dias):</span> <strong>R$ ${formatBR(avisoValor)}</strong></li>`;
        } else if (avisoType === "trabalhado") {
            html += `<li><span>Aviso prévio trabalhado (${diasAvisoTotal} dias):</span> <strong>Já incluso no salário</strong></li>`;
        }
        
        if (decimoProporcional > 0) {
            html += `<li><span>13º Salário Proporcional (${proportionalMonths}/12):</span> <strong>R$ ${formatBR(decimoProporcional)}</strong></li>`;
        } else if (type === "com_justa_causa") {
            html += `<li><span>13º Salário Proporcional:</span> <strong style="color: #999;">Perdido (justa causa)</strong></li>`;
        }
        
        if (feriasPropComTerco > 0) {
            html += `<li><span>Férias Proporcionais +1/3 (${proportionalMonths}/12):</span> <strong>R$ ${formatBR(feriasPropComTerco)}</strong></li>`;
        } else if (type === "com_justa_causa") {
            html += `<li><span>Férias Proporcionais +1/3:</span> <strong style="color: #999;">Perdidas (justa causa)</strong></li>`;
        }
        
        if (feriasVencValor > 0) {
            html += `<li><span>Férias Vencidas +1/3 (${feriasVencidasDias} dias):</span> <strong>R$ ${formatBR(feriasVencValor)}</strong></li>`;
        }
        
        if (decimoAtrasadoValor > 0) {
            html += `<li><span>13º Atrasados (${decimoAtrasadoQtd} ano(s)):</span> <strong>R$ ${formatBR(decimoAtrasadoValor)}</strong></li>`;
        }
        
        if (horasExtrasValor > 0) {
            html += `<li><span>Horas Extras não pagas:</span> <strong>R$ ${formatBR(horasExtrasValor)}</strong></li>`;
        }
        html += `</ul>`;

        // --- DESCONTOS ---
        if (descontos > 0) {
            html += `<h4>Descontos</h4>`;
            html += `<ul class="rescisao-results-list">`;
            html += `<li><span>Aviso prévio não cumprido:</span> <strong>- R$ ${formatBR(descontos)}</strong></li>`;
            html += `</ul>`;
        }

        // --- TOTAIS ---
        const totalProventos = proventos;
        const totalEstimado = totalProventos - descontos;
        
        html += `<h4>Total Estimado</h4>`;
        html += `<ul class="rescisao-results-list total-list">`;
        html += `<li><span>Total de Proventos:</span> <strong>R$ ${formatBR(totalProventos)}</strong></li>`;
        if (descontos > 0) {
            html += `<li><span>Total de Descontos:</span> <strong>R$ ${formatBR(descontos)}</strong></li>`;
        }
        html += `<li><strong>Total Líquido Estimado (Antes de INSS/IRRF):</strong> <strong>R$ ${formatBR(totalEstimado)}</strong></li>`;
        html += `</ul>`;

        // --- AVISOS LEGAIS ---
        let obs = `<div class="note"><strong>Observações Importantes:</strong><ul>`;
        obs += `<li>O <strong>Saldo de Salário</strong> foi calculado com base no <strong>mês comercial (30 dias)</strong>.</li>`;
        obs += `<li>Cálculos de 13º e Férias Proporcionais respeitam a <strong>regra de 15 dias</strong> para contar 1/12 avos.</li>`;
        
        if (avisoType === "indenizado" && (type === "sem_justa_causa" || type === "rescisao_indireta")) {
             obs += `<li>Os cálculos proporcionais foram projetados até <strong>${projectedDismissalDate.toLocaleDateString('pt-BR')}</strong> (considerando o aviso prévio indenizado de ${diasAvisoTotal} dias).</li>`;
        }
        
        if (type === "com_justa_causa") {
            obs += `<li style="color: #c00;"><strong>DEMISSÃO POR JUSTA CAUSA:</strong> Você perde o direito a 13º proporcional, férias proporcionais, aviso prévio e saque do FGTS. Recebe apenas saldo de salário e férias vencidas.</li>`;
        }
        
        if (adicionalCheck) {
            obs += `<li style="color: #b00; font-weight: bold;"><strong>⚠ ADICIONAL DE INSALUBRIDADE/PERICULOSIDADE:</strong> Você marcou esta opção. Se este adicional NÃO estava incluído no campo 'Salário Bruto', os valores apresentados estão <strong>SUBESTIMADOS</strong>. Estes adicionais devem integrar a base de cálculo de TODAS as verbas rescisórias. Procure um contador ou advogado trabalhista.</li>`;
        }
        
        obs += `<li><strong>IMPORTANTE:</strong> Esta calculadora NÃO desconta INSS, IRRF ou outras contribuições. O valor líquido real a receber será menor.</li>`;
        obs += `</ul></div>`;
        html += obs;

        resultDiv.html(html);
    });
});