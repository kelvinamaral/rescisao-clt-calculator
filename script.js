jQuery(document).ready(function ($) {

    // Máscara para o campo de salário (formato monetário)
    $('#salario').on('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        if (value === 'NaN') value = '';
        e.target.value = value;
    });

    // Exibir/ocultar campo de dias de férias vencidas
    $('#ferias_vencidas_select').on('change', function() {
        if ($(this).val() === 'sim') {
            $('#dias_ferias_vencidas_group').slideDown();
        } else {
            $('#dias_ferias_vencidas_group').slideUp();
        }
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

    // --- Helpers de datas --- 
    function getMonthsForTermination(startDate, endDate) {
        let months = 0;
        let current = new Date(startDate);
        current.setDate(1); // Normaliza para o primeiro dia do mês

        while (current <= endDate) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const endOfMonth = new Date(year, month + 1, 0);

            let workedDays = 0;
            if (startDate.getFullYear() === year && startDate.getMonth() === month) {
                // Mês de início
                workedDays = endOfMonth.getDate() - startDate.getDate() + 1;
            } else if (endDate.getFullYear() === year && endDate.getMonth() === month) {
                // Mês de fim
                workedDays = endDate.getDate();
            } else {
                // Mês intermediário
                workedDays = endOfMonth.getDate();
            }

            if (workedDays >= 15) {
                months++;
            }

            current.setMonth(month + 1);
        }
        return months;
    }


    // === Evento Principal ===
    $('#calcular').on('click', function () {
        // Obter e limpar valores dos inputs
        const salarioBruto = parseFloat($('#salario').val().replace(/\./g, '').replace(',', '.')) || 0;
        const dataAdmissao = new Date($('#data_admissao').val() + 'T00:00:00');
        const dataDemissao = new Date($('#data_demissao').val() + 'T00:00:00');
        const motivo = $('#motivo').val();
        const avisoPrevio = $('#aviso_previo').val();
        const possuiFeriasVencidasInput = $('#ferias_vencidas_select').val() === 'sim';

        if (!salarioBruto || isNaN(dataAdmissao) || isNaN(dataDemissao)) {
            alert('Por favor, preencha todos os campos corretamente.');
            return;
        }

        if (dataAdmissao > dataDemissao) {
            alert('A data de admissão não pode ser posterior à data de demissão.');
            return;
        }

        // --- Inicialização de Variáveis ---
        let proventos = {
            saldoSalario: 0,
            avisoPrevioIndenizado: 0,
            decimoTerceiro: 0,
            decimoTerceiroIndenizado: 0,
            feriasVencidas: 0,
            tercoFeriasVencidas: 0,
            feriasProporcionais: 0,
            tercoFeriasProporcionais: 0,
            feriasIndenizadas: 0,
            tercoFeriasIndenizadas: 0
        };
        let descontos = {};

        // --- CÁLCULOS ---

        // 1. Saldo de Salário
        proventos.saldoSalario = (salarioBruto / 30) * dataDemissao.getDate();

        // 2. Aviso Prévio
        let diasAvisoPrevio = 0;
        if (motivo === 'dispensa_sem_justa_causa' && avisoPrevio === 'indenizado') {
            const anosTrabalhados = Math.floor((dataDemissao.getTime() - dataAdmissao.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            diasAvisoPrevio = 30 + (Math.max(0, anosTrabalhados) * 3);
            proventos.avisoPrevioIndenizado = (salarioBruto / 30) * diasAvisoPrevio;
        }

        // 3. Data Final Projetada (inclui o aviso prévio para cálculo de 13º e Férias indenizadas)
        const dataFinalProjetada = new Date(dataDemissao);
        if (diasAvisoPrevio > 0) {
            dataFinalProjetada.setDate(dataFinalProjetada.getDate() + diasAvisoPrevio);
        }

        // 4. 13º Salário
        const admissaoAnoCorrente = new Date(dataDemissao.getFullYear(), 0, 1);
        if(dataAdmissao.getFullYear() === dataDemissao.getFullYear()){
             admissaoAnoCorrente.setMonth(dataAdmissao.getMonth());
             admissaoAnoCorrente.setDate(dataAdmissao.getDate());
        }
        const meses13Proporcional = getMonthsForTermination(admissaoAnoCorrente, dataDemissao);
        proventos.decimoTerceiro = (salarioBruto / 12) * meses13Proporcional;

        const avos13Indenizado = getMonthsForTermination(dataDemissao, dataFinalProjetada) -1;
        if (diasAvisoPrevio > 0 && avos13Indenizado > 0) {
             proventos.decimoTerceiroIndenizado = (salarioBruto / 12) * avos13Indenizado;
        }

        // 5. Férias
        const totalMesesTrabalhados = getMonthsForTermination(dataAdmissao, dataDemissao);
        const periodosFeriasIntegrais = Math.floor(totalMesesTrabalhados / 12);
        const mesesFeriasProporcionais = totalMesesTrabalhados % 12;

        proventos.feriasVencidas = periodosFeriasIntegrais * salarioBruto;
        if (possuiFeriasVencidasInput) {
            proventos.feriasVencidas += salarioBruto; // Adiciona um período vencido extra se informado pelo usuário
        }
        proventos.tercoFeriasVencidas = proventos.feriasVencidas / 3;

        proventos.feriasProporcionais = (salarioBruto / 12) * mesesFeriasProporcionais;
        proventos.tercoFeriasProporcionais = proventos.feriasProporcionais / 3;
        
        const avosFeriasIndenizadas = getMonthsForTermination(dataDemissao, dataFinalProjetada) - 1;
        if (diasAvisoPrevio > 0 && avosFeriasIndenizadas > 0) {
            proventos.feriasIndenizadas = (salarioBruto / 12) * avosFeriasIndenizadas;
            proventos.tercoFeriasIndenizadas = proventos.feriasIndenizadas / 3;
        }

        // 6. Descontos
        descontos.inssSalario = calcularINSS(proventos.saldoSalario);
        descontos.inss13 = calcularINSS(proventos.decimoTerceiro + proventos.decimoTerceiroIndenizado);
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
        // A multa é sobre o total depositado, esta é uma estimativa.
        const multaFgts = (motivo === 'dispensa_sem_justa_causa') ? (salarioBruto * totalMesesTrabalhados * 0.08) * 0.4 : 0;
        $('#res-fgts-mes').text(formatCurrency(fgtsMes));
        $('#res-multa-fgts').text(formatCurrency(multaFgts));

        $('#resultado').slideDown();
    });
});