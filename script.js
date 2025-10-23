jQuery(document).ready(function($){
    
    // --- FUNÇÕES UTILITÁRIAS ---
    function formatBR(v){
        return Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    }

    // Retorna dias do mês (base 0-11)
    function daysInMonth(year, monthIndex){
        return new Date(year, monthIndex + 1, 0).getDate();
    }
    
    // Calcula dias de aviso prévio (30 + 3/ano)
    function calculateAvisoDays(admissionDate, dismissalDate) {
        const diffTime = Math.abs(dismissalDate.getTime() - admissionDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const fullYears = Math.floor(diffDays / 365.25);
        const extraDays = Math.min(fullYears * 3, 60); 
        return 30 + extraDays;
    }

    // Calcula meses proporcionais (Regra de +15 dias)
    function monthsWorkedInYear(admDate, projectedDisDate) {
        const disYear = projectedDisDate.getFullYear();
        // Ponto de partida: 1º de Jan do ano da projeção, ou data de admissão se for no mesmo ano
        const startOfProportionalPeriod = (admDate.getFullYear() === disYear) ? admDate : new Date(disYear, 0, 1);
        
        let months = 0;
        // Inicia no dia 1 do mês de início do período
        let currentDate = new Date(startOfProportionalPeriod.getFullYear(), startOfProportionalPeriod.getMonth(), 1);

        while (currentDate <= projectedDisDate) {
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();
            
            // Fim do mês a verificar
            let endDayCheck = daysInMonth(currentYear, currentMonth);
            if (currentYear === projectedDisDate.getFullYear() && currentMonth === projectedDisDate.getMonth()) {
                endDayCheck = projectedDisDate.getDate();
            }

            // Início do mês a verificar
            let startDayCheck = 1;
            if (currentYear === startOfProportionalPeriod.getFullYear() && currentMonth === startOfProportionalPeriod.getMonth()) {
                startDayCheck = startOfProportionalPeriod.getDate();
            }

            const daysWorkedThisMonth = endDayCheck - startDayCheck + 1;
            
            if (daysWorkedThisMonth >= 15) {
                months++;
            }

            // Avança para o dia 1 do próximo mês
            currentDate.setMonth(currentDate.getMonth() + 1);
            if (currentDate.getMonth() === 0) currentDate.setFullYear(currentYear + 1);

            if (currentDate.getTime() > projectedDisDate.getTime()) break; 
            if (months >= 12) break;
        }
        
        return Math.min(12, Math.max(0, months));
    }

    // --- EVENT HANDLER PRINCIPAL (v3.0) ---
    $("#calcBtn").on("click", function(){
        
        // 1. LEITURA DOS CAMPOS (v3.0)
        const salario = parseFloat($("#salario_bruto").val()) || 0;
        const admission = new Date($("#data_contratacao").val());
        const dismissal = new Date($("#data_dispensa").val()); // Último dia trabalhado
        const type = $("#forma_demissao").val();
        const avisoType = $("#aviso_previo").val();
        
        const feriasVencidasDias = parseInt($("#ferias_vencidas_dias").val()) || 0;
        const decimoAtrasadoQtd = parseInt($("#decimo_terceiro_atrasado").val()) || 0;
        const horasExtrasValor = parseFloat($("#horas_extras_valor").val()) || 0;
        const adicionalCheck = $("#adicional_insalubridade").is(":checked");
        
        const resultDiv = $("#result");
        resultDiv.empty();

        // 2. VALIDAÇÕES
        if (!salario || isNaN(admission) || isNaN(dismissal) || !type || !avisoType) {
            resultDiv.html('<h3>Erro de Validação</h3><p style="color: red;">Preencha todos os campos obrigatórios (Salário, Datas, Forma de Demissão e Aviso Prévio).</p>');
            return;
        }
        if (dismissal < admission) {
            resultDiv.html('<h3>Erro de Validação</h3><p style="color: red;">A Data de Dispensa não pode ser anterior à Data de Contratação.</p>');
            return;
        }

        // --- 3. PREPARAÇÃO DE DADOS ---
        
        // ** CORREÇÃO DO BUG (R$ 86,67) **
        // Usa o "mês comercial" de 30 dias como base de cálculo
        const valorDia = salario / 30;
        const valorMes = salario / 12;

        let projectedDismissalDate = new Date(dismissal); // Data final do contrato
        let avisoValor = 0;
        let avisoDesconto = 0;

        if (avisoType === "indenizado" && (type === "sem_justa_causa" || type === "rescisao_indireta")) {
            const diasAvisoTotal = calculateAvisoDays(admission, dismissal);
            avisoValor = valorDia * diasAvisoTotal;
            // Projeta a data final do contrato
            projectedDismissalDate.setDate(dismissal.getDate() + diasAvisoTotal);
            
        } else if (avisoType === "nao_cumprido" && type === "pedido_demissao") {
            // Pedido de demissão sem cumprir, desconta 30 dias (1 salário)
            avisoDesconto = salario; 
        }
        // Se avisoType == "trabalhado", a data de dispensa já é o último dia.

        // Dias trabalhados no mês (baseado na data de dispensa)
        const daysWorkedInDismissalMonth = dismissal.getDate(); 
        
        // Meses Proporcionais (13º e Férias) - USA A DATA PROJETADA
        const proportionalMonths = monthsWorkedInYear(admission, projectedDismissalDate);

        // --- 4. CÁLCULO DE VERBAS ---
        let proventos = 0;
        let descontos = 0;

        // 1. Saldo de Salário
        const saldoSalario = valorDia * daysWorkedInDismissalMonth;
        proventos += saldoSalario;

        // 2. Aviso Prévio (calculado na seção 3)
        if (avisoValor > 0) {
            proventos += avisoValor;
        }
        if (avisoDesconto > 0) {
            descontos += avisoDesconto;
        }

        // 3. 13º Salário Proporcional
        let decimoProporcional = 0;
        if (type !== "com_justa_causa") { // Perde na Justa Causa
            decimoProporcional = valorMes * proportionalMonths;
            proventos += decimoProporcional;
        }
        
        // 4. Férias Proporcionais + 1/3
        let feriasPropComTerco = 0;
        if (type !== "com_justa_causa") { // Perde na Justa Causa
            const feriasPropSimples = valorMes * proportionalMonths;
            feriasPropComTerco = feriasPropSimples * (4/3); // Já inclui o 1/3
            proventos += feriasPropComTerco;
        }

        // 5. Férias Vencidas + 1/3 (Direito adquirido, pago até em justa causa)
        let feriasVencValor = 0;
        if (feriasVencidasDias > 0) {
            const feriasVencSimples = valorDia * feriasVencidasDias;
            feriasVencValor = feriasVencSimples * (4/3); // Já inclui o 1/3
            proventos += feriasVencValor;
        }
        
        // 6. Verbas Atrasadas (Campos novos)
        let decimoAtrasadoValor = 0;
        if (decimoAtrasadoQtd > 0) {
            decimoAtrasadoValor = salario * decimoAtrasadoQtd;
            proventos += decimoAtrasadoValor;
        }
        
        if (horasExtrasValor > 0) {
            proventos += horasExtrasValor;
        }

        // --- 5. EXIBIÇÃO DE RESULTADOS ---
        let html = `<h3>Resultado Estimado (BRUTO)</h3>`;
        html += `<h4>Verbas Rescisórias (Proventos)</h4>`;
        html += `<ul class="rescisao-results-list">`;
        html += `<li><span>Saldo de salário (${daysWorkedInDismissalMonth} dias):</span> <strong>R$ ${formatBR(saldoSalario)}</strong></li>`;
        
        if (avisoValor > 0) {
            html += `<li><span>Aviso prévio indenizado:</span> <strong>R$ ${formatBR(avisoValor)}</strong></li>`;
        }
        if (decimoProporcional > 0) {
            html += `<li><span>13º Salário Proporcional (${proportionalMonths}/12):</span> <strong>R$ ${formatBR(decimoProporcional)}</strong></li>`;
        }
        if (feriasPropComTerco > 0) {
            html += `<li><span>Férias Proporcionais +1/3 (${proportionalMonths}/12):</span> <strong>R$ ${formatBR(feriasPropComTerco)}</strong></li>`;
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
            html += `<li><span>Aviso prévio não cumprido (desconto):</span> <strong>R$ ${formatBR(descontos)}</strong></li>`;
            html += `</ul>`;
        }

        // --- TOTAIS ---
        const totalProventos = proventos;
        const totalEstimado = totalProventos - descontos;
        
        html += `<h4>Total Estimado</h4>`;
        html += `<ul class="rescisao-results-list total-list">`;
        html += `<li><span>Total de Proventos:</span> R$ ${formatBR(totalProventos)}</li>`;
        if (descontos > 0) html += `<li><span>Total de Descontos:</span> R$ ${formatBR(descontos)}</li>`;
        html += `<li><strong>Total Líquido Estimado (Antes de INSS/IRRF):</strong> <strong>R$ ${formatBR(totalEstimado)}</strong></li>`;
        html += `</ul>`;

        // --- AVISOS LEGAIS ---
        let obs = `<div class="note"><strong>Observações:</strong><ul>`;
        obs += `<li>O Saldo de Salário foi calculado com base no <strong>mês comercial (30 dias)</strong>.</li>`;
        obs += `<li>Cálculos de 13º e Férias Proporcionais respeitam a regra de 15 dias para 1/12 avos.</li>`;
        
        if (avisoType === "indenizado" && (type === "sem_justa_causa" || type === "rescisao_indireta")) {
             obs += `<li>Os cálculos proporcionais foram estendidos até a data final projetada do contrato (${projectedDismissalDate.toLocaleDateString('pt-BR')}).</li>`;
        }
        
        if (adicionalCheck) {
            obs += `<li style="color: #b00; font-weight: bold;"><strong>ADICIONAL DE INSALUBRIDADE/PERICULOSIDADE:</strong> Você marcou esta opção. Se este adicional não estava incluído no seu 'Salário Bruto', os valores aqui apresentados estão SUBESTIMADOS. Este adicional deve ser integrado à base de cálculo de todas as verbas. Procure um contador ou advogado.</li>`;
        }
        obs += `</ul></div>`;
        html += obs;

        resultDiv.html(html);
    });
});