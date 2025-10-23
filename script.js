jQuery(document).ready(function ($) {

    // Máscara para o campo de salário (formato monetário)
    $('#salario').on('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        if (value === 'NaN') value = '';
        e.target.value = value;
    });

    // Função para formatar número para o padrão monetário brasileiro
    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // === Funções de Cálculo ===

    // Tabela INSS 2025 (Cálculo Progressivo)
    function calcularINSS(base) {
        const teto = 908.85;
        let inss = 0;

        if (base <= 1412.00) {
            inss = base * 0.075;
        } else if (base <= 2666.68) {
            inss = (base - 1412.00) * 0.09 + 105.90;
        } else if (base <= 4000.03) {
            inss = (base - 2666.68) * 0.12 + 105.90 + 112.92;
        } else if (base <= 7786.02) {
            inss = (base - 4000.03) * 0.14 + 105.90 + 112.92 + 159.99;
        } else {
            return teto; // Contribuição máxima
        }
        return Math.min(inss, teto);
    }

    // Tabela IRRF 2025
    function calcularIRRF(base, inss) {
        const baseCalculo = base - inss;
        let irrf = 0;

        if (baseCalculo <= 2259.20) {
            irrf = 0;
        } else if (baseCalculo <= 2826.65) {
            irrf = (baseCalculo * 0.075) - 169.44;
        } else if (baseCalculo <= 3751.05) {
            irrf = (baseCalculo * 0.15) - 381.44;
        } else if (baseCalculo <= 4664.68) {
            irrf = (baseCalculo * 0.225) - 662.77;
        } else {
            irrf = (baseCalculo * 0.275) - 896.00;
        }
        return irrf > 0 ? irrf : 0;
    }

    // === Evento Principal ===
    $('#calcular').on('click', function () {
        // Obter e limpar valores dos inputs
        const salarioBruto = parseFloat($('#salario').val().replace(/\./g, '').replace(',', '.')) || 0;
        const dataAdmissao = new Date($('#data_admissao').val() + 'T00:00:00');
        const dataDemissao = new Date($('#data_demissao').val() + 'T00:00:00');
        const motivo = $('#motivo').val();
        const avisoPrevio = $('#aviso_previo').val();
        const feriasVencidas = $('#ferias_vencidas').is(':checked');

        if (!salarioBruto || isNaN(dataAdmissao) || isNaN(dataDemissao)) {
            alert('Por favor, preencha todos os campos corretamente.');
            return;
        }

        // --- CÁLCULOS --- 
        let proventos = {},
            descontos = {};

        // 1. Saldo de Salário
        const diasTrabalhadosMes = dataDemissao.getDate();
        proventos.saldoSalario = (salarioBruto / 30) * diasTrabalhadosMes;

        // 2. Aviso Prévio
        proventos.avisoPrevioIndenizado = 0;
        let diasAvisoPrevio = 0;
        if (motivo === 'dispensa_sem_justa_causa' && avisoPrevio === 'indenizado') {
            const anosTrabalhados = Math.floor((dataDemissao - dataAdmissao) / (365.25 * 24 * 60 * 60 * 1000));
            diasAvisoPrevio = 30 + (Math.min(anosTrabalhados, 20) * 3);
            proventos.avisoPrevioIndenizado = (salarioBruto / 30) * diasAvisoPrevio;
        }

        // Data final para cálculo (considerando projeção do aviso)
        const dataFinal = new Date(dataDemissao);
        if (avisoPrevio === 'indenizado') {
            dataFinal.setDate(dataFinal.getDate() + diasAvisoPrevio);
        }

        // 3. 13º Salário
        const meses13 = dataFinal.getMonth() + 1;
        proventos.decimoTerceiro = (salarioBruto / 12) * meses13;
        proventos.decimoTerceiroIndenizado = 0; // Simplificado, já incluso na projeção

        // 4. Férias
        const mesesTrabalhadosTotal = Math.floor((dataFinal - dataAdmissao) / (1000 * 60 * 60 * 24 * 30.4375));
        const avosFerias = mesesTrabalhadosTotal % 12;

        proventos.feriasProporcionais = (salarioBruto / 12) * avosFerias;
        proventos.tercoFeriasProporcionais = proventos.feriasProporcionais / 3;
        proventos.feriasVencidas = feriasVencidas ? salarioBruto : 0;
        proventos.tercoFeriasVencidas = feriasVencidas ? salarioBruto / 3 : 0;
        proventos.feriasIndenizadas = 0; // Simplificado
        proventos.tercoFeriasIndenizadas = 0; // Simplificado

        // 5. Descontos
        descontos.inssSalario = calcularINSS(proventos.saldoSalario);
        descontos.inss13 = calcularINSS(proventos.decimoTerceiro);
        descontos.irrf = calcularIRRF(proventos.saldoSalario, descontos.inssSalario);

        // --- TOTAIS ---
        const totalProventos = Object.values(proventos).reduce((a, b) => a + b, 0);
        const totalDescontos = Object.values(descontos).reduce((a, b) => a + b, 0);
        const liquido = totalProventos - totalDescontos;

        // --- ATUALIZAR UI ---
        $('#res-saldo-salario').text(formatCurrency(proventos.saldoSalario));
        $('#res-aviso-previo').text(formatCurrency(proventos.avisoPrevioIndenizado));
        $('#res-13-proporcional').text(formatCurrency(proventos.decimoTerceiro));
        $('#res-13-indenizado').text(formatCurrency(proventos.decimoTerceiroIndenizado));
        $('#res-ferias-vencidas').text(formatCurrency(proventos.feriasVencidas));
        $('#res-terco-ferias-vencidas').text(formatCurrency(proventos.tercoFeriasVencidas));
        $('#res-ferias-proporcionais').text(formatCurrency(proventos.feriasProporcionais));
        $('#res-terco-ferias-proporcionais').text(formatCurrency(proventos.tercoFeriasProporcionais));
        $('#res-ferias-indenizadas').text(formatCurrency(proventos.feriasIndenizadas));
        $('#res-terco-ferias-indenizadas').text(formatCurrency(proventos.tercoFeriasIndenizadas));
        $('#res-total-proventos').text(formatCurrency(totalProventos));

        $('#res-inss-salario').text(formatCurrency(descontos.inssSalario));
        $('#res-irrf-salario').text(formatCurrency(descontos.irrf));
        $('#res-inss-13').text(formatCurrency(descontos.inss13));
        $('#res-total-descontos').text(formatCurrency(totalDescontos));

        $('#res-liquido').text(formatCurrency(liquido));

        // FGTS (informativo)
        const fgtsMes = proventos.saldoSalario * 0.08;
        const multaFgts = (motivo === 'dispensa_sem_justa_causa') ? (salarioBruto * mesesTrabalhadosTotal * 0.08) * 0.4 : 0;
        $('#res-fgts-mes').text(formatCurrency(fgtsMes));
        $('#res-multa-fgts').text(formatCurrency(multaFgts));

        $('#resultado').slideDown();
    });
});