jQuery(document).ready(function ($) {

    // === Funções auxiliares ===
    function formatBR(v) {
        return Number(v).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // calcula meses proporcionais com regra dos 15 dias
    function calcMesesProporcionais(adm, dem) {
        const admDate = new Date(adm);
        const demDate = new Date(dem);
        let meses = (demDate.getFullYear() - admDate.getFullYear()) * 12 + (demDate.getMonth() - admDate.getMonth());

        // conta mês da demissão se >= 15 dias
        const dias = demDate.getDate() - admDate.getDate();
        if (dias >= 15) meses += 1;

        if (meses < 0) meses = 0;
        if (meses > 12) meses = 12;
        return meses;
    }

    // Tabela INSS 2025 (faixa simples, não progressiva)
    function calcINSS(base) {
        let inss = 0;
        if (base <= 1412.00) {
            inss = base * 0.075;
        } else if (base <= 2666.68) {
            inss = base * 0.09 - 21.18;
        } else if (base <= 4000.03) {
            inss = base * 0.12 - 101.18;
        } else if (base <= 7786.02) {
            inss = base * 0.14 - 181.18;
        } else {
            inss = 908.85; // teto fixo
        }
        return inss;
    }

    // Tabela IRRF 2025
    function calcIRRF(base) {
        if (base <= 2259.20) return 0;
        else if (base <= 2826.65) return base * 0.075 - 169.44;
        else if (base <= 3751.05) return base * 0.15 - 381.44;
        else if (base <= 4664.68) return base * 0.225 - 662.77;
        else return base * 0.275 - 896.00;
    }

    // === Ação principal ===
    $("#calcBtn").on("click", function () {
        const salario = parseFloat($("#salary").val().replace(",", ".")) || 0;
        const admissao = $("#admission").val();
        const demissao = $("#dismissal").val();
        const tipo = $("#type").val(); // sem_justa_causa, pedido, acordo
        const avisoTrabalhado = true; // conforme exemplo, sempre trabalhado

        if (!salario || !admissao || !demissao) {
            alert("Preencha salário, admissão e demissão corretamente.");
            return;
        }

        const adm = new Date(admissao);
        const dem = new Date(demissao);

        if (dem < adm) {
            alert("A data de demissão não pode ser anterior à de admissão.");
            return;
        }

        // === Cálculos principais ===
        const diasTrabalhados = 30; // aviso trabalhado, mês completo
        const mesesProp = calcMesesProporcionais(adm, dem);

        // 1. Saldo de salário
        const saldoSalario = (salario / 30) * diasTrabalhados;

        // 2. 13º proporcional
        const decimo = (salario / 12) * mesesProp;

        // 3. Férias proporcionais + 1/3
        const feriasBase = (salario / 12) * mesesProp;
        const feriasTerco = feriasBase / 3;
        const feriasTotal = feriasBase + feriasTerco;

        // 4. INSS
        const inssSalario = calcINSS(saldoSalario);
        const inss13 = calcINSS(decimo);
        const inssTotal = inssSalario + inss13;

        // 5. IRRF
        const irrfSalario = calcIRRF(saldoSalario - inssSalario);
        const irrf13 = calcIRRF(decimo - inss13);
        const irrfTotal = irrfSalario + irrf13;

        // 6. FGTS (estimado)
        const fgtsDeposito = (salario * 0.08) * mesesProp;
        let fgtsMulta = 0;
        if (tipo === "sem_justa_causa") fgtsMulta = fgtsDeposito * 0.40;
        else if (tipo === "acordo") fgtsMulta = fgtsDeposito * 0.20;

        // 7. Totais
        const totalProventos = saldoSalario + decimo + feriasTotal;
        const totalDescontos = inssTotal + irrfTotal;
        const totalLiquido = totalProventos - totalDescontos;

        // === Exibição ===
        let html = `<h3>Resultado Estimado (discriminação)</h3>`;
        

        html += `<h4>Proventos</h4><ul>`;
        html += `<li>Saldo de salário (30 dias): <strong>R$ ${formatBR(saldoSalario)}</strong></li>`;
        html += `<li>13º proporcional (${mesesProp}/12): <strong>R$ ${formatBR(decimo)}</strong></li>`;
        html += `<li>Férias proporcionais (${mesesProp}/12): <strong>R$ ${formatBR(feriasBase)}</strong></li>`;
        html += `<li>1/3 sobre férias: <strong>R$ ${formatBR(feriasTerco)}</strong></li>`;
        html += `<li><strong>Total de férias: R$ ${formatBR(feriasTotal)}</strong></li>`;
        html += `</ul>`;

        html += `<h4>Descontos (empregado)</h4><ul>`;
        html += `<li>INSS total (estimado): - R$ ${formatBR(inssTotal)}</li>`;
        html += `<li>IRRF total (estimado): - R$ ${formatBR(irrfTotal)}</li>`;
        html += `</ul>`;

        html += `<h4>FGTS</h4><ul>`;
        html += `<li>Depósito FGTS 8% (estimado): R$ ${formatBR(fgtsDeposito)}</li>`;
        html += `<li>Multa FGTS: `;
        if (tipo === "pedido")
            html += `Não aplicável (pedido de demissão)</li>`;
        else if (tipo === "sem_justa_causa")
            html += `40% sobre saldo (informativo): R$ ${formatBR(fgtsMulta)}</li>`;
        else
            html += `20% sobre saldo (informativo): R$ ${formatBR(fgtsMulta)}</li>`;
        html += `</ul>`;

        html += `<h4>Totais</h4><ul>`;
        html += `<li>Total de proventos (bruto): R$ ${formatBR(totalProventos)}</li>`;
        html += `<li>Total de descontos (estimado): - R$ ${formatBR(totalDescontos)}</li>`;
        html += `<li><strong>Total líquido estimado: R$ ${formatBR(totalLiquido)}</strong></li>`;
        html += `</ul>`;

        html += `<div class="note"><strong>Observações:</strong>
            <ul>
                <li>Os valores seguem critérios da CLT para pedido de demissão ou dispensa.</li>
                <li>INSS e IRRF calculados conforme faixas de 2025.</li>
                <li>FGTS estimado com base em depósitos mensais de 8% do salário.</li>
                <li>Multa do FGTS (40% ou 20%) é apenas informativa, não somada ao total.</li>
                <li>Este resultado é estimativo e não substitui cálculos oficiais ou homologatórios.</li>
            </ul>
        </div>`;

        $("#result").html(html);
    });
});
