jQuery(document).ready(function($){
    function formatBR(v){
        return Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    }

    function daysInMonth(year, monthIndex){
        return new Date(year, monthIndex+1, 0).getDate();
    }

    // calcula meses trabalhados no ano da demissão usando regra de 15 dias
    function monthsWorkedInYear(admDate, disDate){
        const disYear = disDate.getFullYear();
        // início: se admissão no mesmo ano da demissão, começa no mês da admissão; senão começa em jan do ano da demissão
        let startMonth = (admDate.getFullYear() === disYear) ? admDate.getMonth() : 0;
        let endMonth = disDate.getMonth();
        let months = 0;

        for(let m = startMonth; m <= endMonth; m++){
            let year = disYear;
            let startDay = 1;
            let endDay = daysInMonth(year, m);

            if(m === admDate.getMonth() && admDate.getFullYear() === disYear){
                startDay = admDate.getDate();
            }
            if(m === disDate.getMonth()){
                endDay = disDate.getDate();
            }

            const daysWorkedThisMonth = endDay - startDay + 1;
            // regra: 15 dias ou mais conta como mês completo
            if(daysWorkedThisMonth >= 15) months += 1;
        }

        if(months < 0) months = 0;
        if(months > 12) months = 12;
        return months;
    }

    $("#calcBtn").on("click", function(){
        // inputs
        const rawSalary = $("#salary").val();
        const salary = parseFloat(String(rawSalary).replace(',','.')) || 0;
        const admissionRaw = $("#admission").val();
        const dismissalRaw = $("#dismissal").val();
        const daysWorkedInput = $("#days_worked").val();
        const type = $("#type").val();
        const avisoInd = $("#aviso_indennizado").is(":checked");
        const feriasVencidas = $("#vacation_vencida").is(":checked");
        const feriasDias = parseInt($("#vacation_days").val()) || 30;
        const fgtsBalanceRaw = $("#fgts_balance").val();
        const fgtsBalance = parseFloat(String(fgtsBalanceRaw).replace(',','.')) || 0;

        // validações básicas
        if(!(rawSalary && admissionRaw && dismissalRaw)){
            alert("Preencha salário, data de admissão e data de demissão.");
            return;
        }

        const admission = new Date(admissionRaw);
        const dismissal = new Date(dismissalRaw);

        if(isNaN(admission.getTime()) || isNaN(dismissal.getTime())){
            alert("Datas inválidas. Verifique os campos de data.");
            return;
        }

        if(dismissal < admission){
            alert("Erro: a data de demissão não pode ser anterior à data de admissão.");
            return;
        }

        // cálculo de dias possíveis no mês da demissão (para validação de daysWorked)
        const disYear = dismissal.getFullYear();
        const disMonth = dismissal.getMonth();
        const daysInDisMonth = daysInMonth(disYear, disMonth);

        // cálculo automático de dias trabalhados no mês da rescisão se usuário deixou em branco
        let daysWorkedCalculated;
        if(admission.getFullYear() === dismissal.getFullYear() && admission.getMonth() === dismissal.getMonth()){
            // admissão e demissão no mesmo mês
            daysWorkedCalculated = dismissal.getDate() - admission.getDate() + 1;
        } else {
            // admissão em mês anterior, dias trabalhados por padrão é dia da demissão
            daysWorkedCalculated = dismissal.getDate();
        }
        if(daysWorkedCalculated < 0) daysWorkedCalculated = 0;
        if(daysWorkedCalculated > daysInDisMonth) daysWorkedCalculated = daysInDisMonth;

        let daysWorked = daysWorkedInput ? parseInt(daysWorkedInput) : daysWorkedCalculated;
        if(isNaN(daysWorked) || daysWorked < 0) daysWorked = daysWorkedCalculated;
        // força limites
        if(daysWorked > daysInDisMonth) {
            alert("O campo Dias trabalhados excede o número de dias do mês da demissão. Ajustei para o máximo do mês.");
            daysWorked = daysInDisMonth;
        }
        // Se admissão no mesmo mês, também valida contra dias entre adm e dis
        if(admission.getFullYear() === dismissal.getFullYear() && admission.getMonth() === dismissal.getMonth()){
            const maxPossible = dismissal.getDate() - admission.getDate() + 1;
            if(daysWorked > maxPossible){
                alert("Dias trabalhados excedem o período entre admissão e demissão no mesmo mês. Ajustei automaticamente.");
                daysWorked = maxPossible;
            }
        }

        if(salary <= 0){
            alert("Salário deve ser maior que zero.");
            return;
        }

        // Saldo de salário
        const saldoSalario = (salary / 30) * Math.min(30, daysWorked);

        // meses proporcionais para 13º e férias (regra dos 15 dias)
        const monthsProporcionais = monthsWorkedInYear(admission, dismissal);

        const decimo = (salary * monthsProporcionais) / 12;

        // férias proporcionais (sem 1/3)
        const feriasProporcionaisBase = (salary * monthsProporcionais) / 12;
        const feriasProporcionaisTerco = feriasProporcionaisBase / 3;
        const feriasProporcionaisTotal = feriasProporcionaisBase + feriasProporcionaisTerco;

        // férias vencidas (base + 1/3)
        let feriasVencidasBase = 0;
        let feriasVencidasTerco = 0;
        let feriasVencidasTotal = 0;
        if(feriasVencidas){
            feriasVencidasBase = (salary / 30) * feriasDias;
            feriasVencidasTerco = feriasVencidasBase / 3;
            feriasVencidasTotal = feriasVencidasBase + feriasVencidasTerco;
        }

        // aviso prévio: só aplica proporcional extra se demissão pelo empregador (sem justa causa) ou acordo
        let diffYears = dismissal.getFullYear() - admission.getFullYear() -
            (dismissal < new Date(dismissal.getFullYear(), admission.getMonth(), admission.getDate()) ? 1 : 0);
        if(diffYears < 0) diffYears = 0;
        let avisoExtra = 0;
        if(type === "sem_justa_causa" || type === "acordo"){
            avisoExtra = Math.min(diffYears * 3, 60);
        }
        const avisoDaysPotential = 30 + avisoExtra;

        // cálculo do valor do aviso pago/indenizado/desconto
        let avisoPago = 0;
        let descontoAviso = 0;
        if(avisoInd){
            // indenizado: paga todo avisoDaysPotential
            avisoPago = (salary / 30) * avisoDaysPotential;
        } else {
            // não indenizado -> aviso trabalhado para demissão pelo empregador: empregado recebe salário normal durante aviso, portanto não há verba adicional a ind. 
            // Para pedido de demissão não cumprido, deve descontar 30 dias de salário.
            if(type === "pedido"){
                descontoAviso = (salary / 30) * 30;
            } else {
                // avisado trabalhado pelo empregado: não adicionar indenização
                avisoPago = 0;
            }
        }

        // total proventos (sem multa do FGTS)
        const proventos = saldoSalario + avisoPago + decimo + feriasProporcionaisTotal + feriasVencidasTotal;

        // base de FGTS: incide sobre verbas salariais (saldo salário + aviso pago + 13º + férias base sem 1/3)
        const fgtsBase = saldoSalario + avisoPago + decimo + feriasProporcionaisBase + feriasVencidasBase;
        const fgtsDeposit = fgtsBase * 0.08;

        // multa FGTS: somente se usuário informar saldo do FGTS na conta
        let multaFgts = 0;
        let multaFgtsNote = "";
        if(fgtsBalance > 0){
            if(type === "sem_justa_causa"){
                multaFgts = fgtsBalance * 0.40;
                multaFgtsNote = " (estimativa, baseada no saldo informado)";
            } else if(type === "acordo"){
                multaFgts = fgtsBalance * 0.20;
                multaFgtsNote = " (estimativa, baseada no saldo informado)";
            } else {
                multaFgts = 0;
                multaFgtsNote = " (não aplicável para pedido de demissão)";
            }
        } else {
            multaFgtsNote = " (não calculada sem saldo do FGTS)";
        }

        // descontos (somente aviso não cumprido por enquanto)
        const descontos = descontoAviso;
        const totalLiquidoEstimado = proventos - descontos;

        // montagem do resultado
        let html = `<h3>Resultado estimado (bruto)</h3>`;
        html += `<ul>`;
        html += `<li>Saldo de salário: R$ ${formatBR(saldoSalario)}</li>`;
        html += `<li>Aviso prévio (potencial ${avisoDaysPotential} dias): R$ ${formatBR(avisoPago)}${avisoInd ? " (indenizado)" : (type === "pedido" ? " (pode gerar desconto se não cumprido)" : " (presumido trabalhado)")}</li>`;
        html += `<li>13º proporcional (${monthsProporcionais} meses): R$ ${formatBR(decimo)}</li>`;
        html += `<li>Férias proporcionais (base R$ ${formatBR(feriasProporcionaisBase)} +1/3 = R$ ${formatBR(feriasProporcionaisTotal)}): R$ ${formatBR(feriasProporcionaisTotal)}</li>`;
        if(feriasVencidasTotal > 0){
            html += `<li>Férias vencidas (base R$ ${formatBR(feriasVencidasBase)} +1/3 = R$ ${formatBR(feriasVencidasTotal)}): R$ ${formatBR(feriasVencidasTotal)}</li>`;
        }
        html += `<li><strong>Total de proventos estimados: R$ ${formatBR(proventos)}</strong></li>`;
        html += `</ul>`;

        html += `<h4>FGTS</h4>`;
        html += `<ul>`;
        html += `<li>Base de cálculo do FGTS (8%): R$ ${formatBR(fgtsBase)}</li>`;
        html += `<li>Depósito estimado FGTS (8%): R$ ${formatBR(fgtsDeposit)}</li>`;
        if(fgtsBalance > 0){
            html += `<li>Multa FGTS estimada${multaFgtsNote}: R$ ${formatBR(multaFgts)}</li>`;
        } else {
            html += `<li>Multa FGTS: não calculada. Informe o saldo do FGTS para estimativa.</li>`;
        }
        html += `</ul>`;

        html += `<h4>Descontos</h4>`;
        html += `<ul>`;
        html += `<li>Desconto por não cumprimento de aviso (se aplicável): R$ ${formatBR(descontoAviso)}</li>`;
        html += `</ul>`;

        html += `<h4>Totais</h4>`;
        html += `<ul>`;
        html += `<li>Total proventos: R$ ${formatBR(proventos)}</li>`;
        if(multaFgts > 0) html += `<li>Multa FGTS (se informada): R$ ${formatBR(multaFgts)}</li>`;
        html += `<li>Total descontos: R$ ${formatBR(descontos)}</li>`;
        const totalGeralEstimado = proventos + multaFgts - descontos;
        html += `<li><strong>Total geral estimado (proventos + multa FGTS - descontos): R$ ${formatBR(totalGeralEstimado)}</strong></li>`;
        html += `</ul>`;

        html += `<div class="note"><strong>Observações:</strong>
            <ul>
                <li>Valores são estimativas. INSS, IRRF e outros descontos não foram aplicados.</li>
                <li>Multa FGTS só foi calculada se você informou o saldo do FGTS. Caso contrário o valor correto depende do histórico de depósitos.</li>
                <li>FGTS foi calculado sobre a base definida no resultado. O 1/3 constitucional das férias não integra a base do FGTS aqui.</li>
            </ul>
        </div>`;

        $("#result").html(html);
    });
});
