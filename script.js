jQuery(document).ready(function ($) {

    // Certifica que o Moment.js está disponível
    if (typeof moment === 'undefined') {
        console.error("Moment.js não foi carregado. A calculadora pode não funcionar corretamente.");
        return;
    }

    // --- Constantes de Cálculo (INSS e IRRF - Tabela 2024/2025) ---
    const CONSTANTES = {
        descINSS: {
            limiteFaixa1: 1412,
            limiteFaixa2: 2666.68,
            limiteFaixa3: 4000.03,
            limiteFaixa4: 7786.02,
            aliquotaFaixa1: .075,
            aliquotaFaixa2: .09,
            aliquotaFaixa3: .12,
            aliquotaFaixa4: .14
        },
        descIRRF: {
            limiteFaixaIsencao: 2259.2,
            limiteFaixa1: 2826.65,
            limiteFaixa2: 3751.05,
            limiteFaixa3: 4664.68,
            aliquotaFaixa1: .075,
            aliquotaFaixa2: .15,
            aliquotaFaixa3: .225,
            aliquotaMaxima: .275
        }
    };

    // --- Funções de Formatação e Manipulação de Inputs ---

    // Formata um número para o padrão monetário brasileiro (R$)
    function formatCurrency(value) {
        if (value === "-" || isNaN(value)) return "R$ 0,00";
        return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Máscara para o campo de salário bruto
    $('#ultSal').on('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value) {
            value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (value === 'NaN' || value === '0,00') value = '';
            e.target.value = value;
        }
    });

    // Obtém o valor do salário como um número float
    function getSalario() {
        const val = $('#ultSal').val();
        return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Exibe/oculta o campo de data prevista de término para contratos com prazo
    $('#motResc').on('change', function() {
        const motivo = $(this).val();
        if (motivo === 'rescAntEmpre' || motivo === 'rescAntFunc') {
            $('#data_prev_group').slideDown();
        } else {
            $('#data_prev_group').slideUp();
        }
    });

    $('#ferVcd').on('change', function() {
        if ($(this).val() === 'true') {
            $('#dias_ferias_vencidas_group').slideDown();
        } else {
            $('#dias_ferias_vencidas_group').slideUp();
        }
    });

    // --- Funções Auxiliares de Data ---

    // Calcula a data de projeção do aviso prévio
    function calcDataProje(dataRec, diasAvsPrev) {
        return moment(dataRec).add(diasAvsPrev, "days").format("YYYY-MM-DD");
    }

    // Calcula os dias de aviso prévio indenizado (30 dias + 3 por ano trabalhado, limitado a 90)
    function calcDiasAvsPrev(dataAdm, dataRec, avsPrev) {
        if (avsPrev === "1") { // "1" corresponde a Aviso Prévio Indenizado
            const anosTrabalhados = moment(dataRec).diff(moment(dataAdm), 'years');
            let diasAdicionais = anosTrabalhados * 3;
            if (diasAdicionais > 60) {
                diasAdicionais = 60; // O máximo de acréscimo é 60 dias (para 20 anos), totalizando 90 dias.
            }
            return 30 + diasAdicionais;
        }
        return 0;
    }

    // Calcula a data de início do último período aquisitivo de férias
    function calcDataUltPerFer(dataAdm, dataRec) {
        const a = moment(dataAdm);
        const t = moment(dataRec);
        let dataBaseAnoAtual = moment(`${t.format("YYYY")}-${a.format("MM")}-${a.format("DD")}`);
        
        if (dataBaseAnoAtual.isAfter(t)) {
            // Se a "data de aniversário" do contrato ainda não passou no ano da rescisão, o período aquisitivo começou no ano anterior.
            let anoAnterior = parseInt(t.format("YYYY")) - 1;
            return moment(`${anoAnterior}-${a.format("MM")}-${a.format("DD")}`).format("YYYY-MM-DD");
        }
        
        return dataBaseAnoAtual.format("YYYY-MM-DD");
    }

    // --- Funções de Cálculo de Verbas Rescisórias (Proventos) ---

    function calculaSal(ultSal, dataRec) {
        const momentRec = moment(dataRec);
        return (ultSal / momentRec.daysInMonth() * parseInt(momentRec.format("DD"))).toFixed(2);
    }

    function calculaAvsPrev(ultSal, motResc, avsPrev, dataAdm, dataRec) {
        // Pagamento do aviso indenizado pelo empregador na dispensa sem justa causa
        if (motResc === "semJustaCausa" && avsPrev === "1") {
            const diasAvsPrev = calcDiasAvsPrev(dataAdm, dataRec, avsPrev);
            return (ultSal / 30 * diasAvsPrev).toFixed(2);
        }
        // Crédito do salário do aviso prévio trabalhado no pedido de demissão
        if (motResc === "pediDemiss" && avsPrev === "0") {
            return parseFloat(ultSal).toFixed(2);
        }
        return "-";
    }
    
    // Calcula 13º salário proporcional ao ano da rescisão
    function calc13Prop(ultSal, dataAdm, dataRec, motResc) {
        if (motResc === "comJustaCausa") return "-";

        const rescisaoDate = moment(dataRec);
        const admissaoDate = moment(dataAdm);
        let meses = 0;
        
        const anoRescisao = rescisaoDate.year();
        let mesInicio = 0;

        if (admissaoDate.year() === anoRescisao) {
            mesInicio = admissaoDate.month();
            if (admissaoDate.date() > 15) {
                mesInicio++;
            }
        }

        const mesFim = rescisaoDate.month();
        if (rescisaoDate.date() >= 15) {
            meses = mesFim - mesInicio + 1;
        } else {
            meses = mesFim - mesInicio;
        }
        
        if (meses < 0) meses = 0;

        const valor = (ultSal / 12) * meses;
        return valor > 0 ? valor.toFixed(2) : "-";
    }

    // Calcula o 13º salário indenizado (referente à projeção do aviso prévio)
    function calc13Indeni(ultSal, dataAdm, dataRec, motResc, avsPrev) {
        if (motResc !== "semJustaCausa" || avsPrev !== "1") return "-";

        const prop13 = parseFloat(calc13Prop(ultSal, dataAdm, dataRec, motResc)) || 0;
        const diasAviso = calcDiasAvsPrev(dataAdm, dataRec, avsPrev);
        const dataProjetada = calcDataProje(dataRec, diasAviso);

        const total13Avos = calc13Prop(ultSal, dataAdm, dataProjetada, motResc);
        const valorTotal13 = parseFloat(total13Avos) || 0;
        
        let indenizado;
        if (moment(dataRec).year() < moment(dataProjetada).year()) {
            const prop13FimAno = parseFloat(calc13Prop(ultSal, dataAdm, moment(dataRec).endOf('year').format('YYYY-MM-DD'), motResc)) || 0;
            indenizado = (prop13FimAno - prop13) + valorTotal13;
        } else {
            indenizado = valorTotal13 - prop13;
        }

        return indenizado > 0 ? indenizado.toFixed(2) : "-";
    }
    
    function calcFerVcd(ultSal, ferVcd, diasFerVenc) {
        if (ferVcd === "true") {
            const dias = diasFerVenc || 30;
            const valor = (dias == 30) ? ultSal : ultSal * (dias / 30);
            return parseFloat(valor).toFixed(2);
        }
        return "-";
    }

    function calcFerVcd1_3(ultSal, ferVcd, diasFerVenc) {
        const ferVcdVal = calcFerVcd(ultSal, ferVcd, diasFerVenc);
        if (ferVcdVal !== "-") {
            const terco = (ferVcdVal / 3).toFixed(2);
            return parseFloat(terco) > 0 ? terco : "-";
        }
        return "-";
    }
    
    // Indenização por rescisão antecipada de contrato com prazo (pelo empregador)
    function calcRescAntecip(ultSal, motResc, dataRec, dataPrev) {
        if (motResc !== "rescAntEmpre") return "-";
        
        const diasRestantes = moment(dataPrev).diff(moment(dataRec), 'days');
        if (diasRestantes <= 0) return "-";
        
        const salarioDia = ultSal / 30;
        const multa = (diasRestantes * salarioDia) / 2;

        return multa.toFixed(2);
    }

    // Helper para calcular "avos" de férias
    function getAvosDeFerias(dataAdm, dataRef) {
        const start = moment(calcDataUltPerFer(dataAdm, dataRef));
        const end = moment(dataRef);
        if (start.isAfter(end)) return 0;
        
        let avos = end.diff(start, 'months');
        start.add(avos, 'months');
        
        if (end.diff(start, 'days') >= 14) {
            avos++;
        }
        return avos;
    }

    function calcferPropor(ultSal, dataAdm, dataRec, motResc) {
        if (motResc === "comJustaCausa") return "-";
        const avos = getAvosDeFerias(dataAdm, dataRec);
        const valor = (ultSal / 12) * avos;
        return valor > 0 ? valor.toFixed(2) : "-";
    }

    function calcFerPropor1_3(ultSal, dataAdm, dataRec, motResc) {
        const ferProporVal = calcferPropor(ultSal, dataAdm, dataRec, motResc);
        if (ferProporVal !== "-") {
            const terco = (ferProporVal / 3).toFixed(2);
            return parseFloat(terco) > 0 ? terco : "-";
        }
        return "-";
    }

    function calcFerIndeni(ultSal, dataAdm, dataRec, motResc, avsPrev) {
        if (motResc !== "semJustaCausa" || avsPrev !== "1") return "-";
        
        const diasAvsPrev = calcDiasAvsPrev(dataAdm, dataRec, avsPrev);
        const dataProje = calcDataProje(dataRec, diasAvsPrev);
        
        const avosProporcionais = getAvosDeFerias(dataAdm, dataRec);
        const avosTotais = getAvosDeFerias(dataAdm, dataProje);

        const startRec = calcDataUltPerFer(dataAdm, dataRec);
        const startProj = calcDataUltPerFer(dataAdm, dataProje);

        let avosIndenizados;
        if (moment(startRec).isSame(startProj)) {
            avosIndenizados = avosTotais - avosProporcionais;
        } else {
            const fimPeriodoAntigo = moment(startRec).add(1, 'year').subtract(1, 'day');
            const avosFimPeriodo = getAvosDeFerias(dataAdm, fimPeriodoAntigo.format('YYYY-MM-DD'));
            const avosGanhosNoPeriodoAntigo = avosFimPeriodo - avosProporcionais;
            
            avosIndenizados = avosGanhosNoPeriodoAntigo + avosTotais;
        }
        
        if (avosIndenizados > 0) {
            const valor = (ultSal / 12) * avosIndenizados;
            return valor.toFixed(2);
        }

        return "-";
    }

    function calcFerIndeni1_3(ultSal, dataAdm, dataRec, motResc, avsPrev) {
        const ferIndeniVal = calcFerIndeni(ultSal, dataAdm, dataRec, motResc, avsPrev);
        if (ferIndeniVal !== "-") {
            const terco = (ferIndeniVal / 3).toFixed(2);
            return parseFloat(terco) > 0 ? terco : "-";
        }
        return "-";
    }

    // --- Funções de Cálculo de Descontos ---

    function calcDescINSS(base) {
        if (!base || base == "-") return "-";
        base = parseFloat(base);
        const t = CONSTANTES.descINSS;
        let r = 0;

        const i = t.limiteFaixa1 * t.aliquotaFaixa1;
        const e = (t.limiteFaixa2 - t.limiteFaixa1) * t.aliquotaFaixa2;
        const s = (t.limiteFaixa3 - t.limiteFaixa2) * t.aliquotaFaixa3;
        const o = (t.limiteFaixa4 - t.limiteFaixa3) * t.aliquotaFaixa4;
        const teto = i + e + s + o;

        if (base <= t.limiteFaixa1) r = base * t.aliquotaFaixa1;
        else if (base <= t.limiteFaixa2) r = i + (base - t.limiteFaixa1) * t.aliquotaFaixa2;
        else if (base <= t.limiteFaixa3) r = i + e + (base - t.limiteFaixa2) * t.aliquotaFaixa3;
        else if (base <= t.limiteFaixa4) r = i + e + s + (base - t.limiteFaixa3) * t.aliquotaFaixa4;
        else r = teto;
        
        return r.toFixed(2);
    }
    
    function calcDescIRFF(base, inss) {
        if (!base || base == "-") return "-";
        base = parseFloat(base);
        inss = parseFloat(inss) || 0;
        
        const baseCalculo = base - inss;
        const s = CONSTANTES.descIRRF;
        let o = 0;

        if (baseCalculo > s.limiteFaixaIsencao) {
            // Dedução por dependente não implementada
            if (baseCalculo > s.limiteFaixa3) {
                o = (baseCalculo * s.aliquotaMaxima) - 896; // Parcela a deduzir
            } else if (baseCalculo > s.limiteFaixa2) {
                o = (baseCalculo * s.aliquotaFaixa3) - 662.77;
            } else if (baseCalculo > s.limiteFaixa1) {
                o = (baseCalculo * s.aliquotaFaixa2) - 381.44;
            } else {
                o = (baseCalculo * s.aliquotaFaixa1) - 169.44;
            }
        }
        
        return o > 0 ? o.toFixed(2) : "-";
    }

    function calcDescINSS13(prop13) {
        if (prop13 === "-") return "-";
        return calcDescINSS(prop13);
    }
    
    function calcDescIRFF13(prop13, indeni13, inss13) {
        if (prop13 === "-" && indeni13 === "-") return "-";
        
        const baseCalculo = (parseFloat(prop13) || 0) + (parseFloat(indeni13) || 0) - (parseFloat(inss13) || 0);
        return calcDescIRFF(baseCalculo, 0); // INSS já foi deduzido
    }

    function calcDescAvsPrev(ultSal, motResc, avsPrev) {
        if (motResc === "pediDemiss" && avsPrev === "1") {
            return parseFloat(ultSal).toFixed(2);
        }
        return "-";
    }

    function calcDescRescAntecip(ultSal, motResc, dataRec, dataPrev) {
        if (motResc !== "rescAntFunc") return "-";
        
        const diasRestantes = moment(dataPrev).diff(moment(dataRec), 'days');
        if (diasRestantes <= 0) return "-";

        const salarioDia = ultSal / 30;
        const multa = (diasRestantes * salarioDia) / 2;

        return multa.toFixed(2);
    }
    
    // --- Funções de Totalização ---

    function calculaVencimentos(proventos) {
        return Object.values(proventos)
            .map(val => (val !== "-" && !isNaN(parseFloat(val))) ? parseFloat(val) : 0)
            .reduce((sum, current) => sum + current, 0)
            .toFixed(2);
    }

    function calculaDescontos(descontos) {
        return Object.values(descontos)
            .map(val => (val !== "-" && !isNaN(parseFloat(val))) ? parseFloat(val) : 0)
            .reduce((sum, current) => sum + current, 0)
            .toFixed(2);
    }

    function calculaValTotal(totalProventos, totalDescontos) {
        return (parseFloat(totalProventos) - parseFloat(totalDescontos)).toFixed(2);
    }

    // --- Eventos de Clique ---
    
    $('#limpar').on('click', function(e) {
        e.preventDefault();
        $('#rescisaoForm')[0].reset();
        $('#ultSal').val('');
        $('#resultado').slideUp();
        $('#data_prev_group').slideUp();
        $('#dias_ferias_vencidas_group').slideUp();
    });

    $('#calcular').on('click', function () {
        // Obter valores do formulário
        const calc = {
            ultSal: getSalario(),
            dataAdm: $('#dataAdm').val(),
            dataRec: $('#dataRec').val(),
            dataPrev: $('#dataPrev').val(),
            ferVcd: $('#ferVcd').val(),
            avsPrev: $('#avsPrev').val(),
            motResc: $('#motResc').val(),
            diasFerVenc: $('#diasFerVenc').val()
        };
        
        // Validações
        if (!calc.ultSal || !calc.dataAdm || !calc.dataRec || !calc.motResc) {
            alert('Por favor, preencha o Salário, Datas de Admissão/Rescisão e o Motivo da Rescisão.');
            return;
        }
        if (moment(calc.dataAdm).isAfter(moment(calc.dataRec))) {
             alert('A Data de Admissão não pode ser posterior à Data da Rescisão.');
             return;
        }
        if ((calc.motResc === "rescAntEmpre" || calc.motResc === "rescAntFunc") && !calc.dataPrev) {
             alert('Para Rescisão Antecipada, a Data Prevista de Término do Contrato é obrigatória.');
             return;
        }

        // --- Cálculo de Proventos ---
        const proventos = {};
        proventos.saldoSala = calculaSal(calc.ultSal, calc.dataRec);
        proventos.avPrev = calculaAvsPrev(calc.ultSal, calc.motResc, calc.avsPrev, calc.dataAdm, calc.dataRec);
        proventos.recAntEmpre = calcRescAntecip(calc.ultSal, calc.motResc, calc.dataRec, calc.dataPrev);
        
        const prop13 = calc13Prop(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc);
        proventos.prop13 = prop13;
        
        const indeni13 = calc13Indeni(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc, calc.avsPrev);
        proventos.prop13Inde = indeni13;
        
        proventos.ferVcd = calcFerVcd(calc.ultSal, calc.ferVcd, calc.diasFerVenc);
        proventos.ferVcd1_3 = calcFerVcd1_3(calc.ultSal, calc.ferVcd, calc.diasFerVenc);
        
        proventos.ferProps = calcferPropor(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc);
        proventos.ferProps1_3 = calcFerPropor1_3(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc);
        
        proventos.ferIndeni = calcFerIndeni(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc, calc.avsPrev);
        proventos.ferIndeni1_3 = calcFerIndeni1_3(calc.ultSal, calc.dataAdm, calc.dataRec, calc.motResc, calc.avsPrev);

        proventos.totalVenci = calculaVencimentos(proventos);

        // --- Cálculo de Descontos ---
        const descontos = {};
        const baseINSSMensal = parseFloat(proventos.saldoSala); // INSS incide apenas sobre saldo de salário
        
        const descINSS = calcDescINSS(baseINSSMensal);
        descontos.descINSS = descINSS;
        descontos.descIRFF = calcDescIRFF(baseINSSMensal, descINSS);

        const descINSS13 = calcDescINSS13(prop13);
        descontos.descINSS13 = descINSS13;
        descontos.descIRRF13 = calcDescIRFF13(prop13, indeni13, descINSS13);

        descontos.descAvsPrev = calcDescAvsPrev(calc.ultSal, calc.motResc);
        descontos.descResciAnt = calcDescRescAntecip(calc.ultSal, calc.motResc, calc.dataRec, calc.dataPrev);

        descontos.totalDesc = calculaDescontos(descontos);
        
        // --- Resultado Final ---
        const liquido = calculaValTotal(proventos.totalVenci, descontos.totalDesc);

        // --- Atualização da UI ---
        $('#res-saldo-salario').text(formatCurrency(proventos.saldoSala));
        $('#res-aviso-previo').text(formatCurrency(proventos.avPrev));
        $('#res-rec-ant-empre').text(formatCurrency(proventos.recAntEmpre));
        $('#res-13-proporcional').text(formatCurrency(proventos.prop13));
        $('#res-13-indenizado').text(formatCurrency(proventos.prop13Inde));
        $('#res-ferias-vencidas').text(formatCurrency(proventos.ferVcd));
        $('#res-terco-ferias-vencidas').text(formatCurrency(proventos.ferVcd1_3));
        $('#res-ferias-proporcionais').text(formatCurrency(proventos.ferProps));
        $('#res-terco-ferias-proporcionais').text(formatCurrency(proventos.ferProps1_3));
        $('#res-ferias-indenizadas').text(formatCurrency(proventos.ferIndeni));
        $('#res-terco-ferias-indenizadas').text(formatCurrency(proventos.ferIndeni1_3));
        $('#res-total-proventos').text(formatCurrency(proventos.totalVenci));

        $('#res-inss-salario').text(formatCurrency(descontos.descINSS));
        $('#res-irrf-salario').text(formatCurrency(descontos.descIRFF));
        $('#res-inss-13').text(formatCurrency(descontos.descINSS13));
        $('#res-irrf-13').text(formatCurrency(descontos.descIRRF13));
        $('#res-desc-avs-prev').text(formatCurrency(descontos.descAvsPrev));
        $('#res-desc-resc-ant').text(formatCurrency(descontos.descResciAnt));
        $('#res-total-descontos').text(formatCurrency(descontos.totalDesc));

        $('#res-liquido').text(formatCurrency(liquido));

        // --- FGTS ---
        // 1. Define as bases de cálculo para o FGTS (8%)
        const fgtsBaseItems = [
            proventos.saldoSala,
            proventos.avPrev,
            proventos.prop13, // 13º Proporcional (Mês a Mês)
            proventos.prop13Inde // 13º Indenizado (Aviso Prévio)
        ];

        // 2. Calcula o FGTS a ser depositado no MÊS DA RESCISÃO (FGTS Rescisório)
        // Isso inclui Saldo Salário, API, 13º Prop. do Mês, 13º Indenizado.
        const baseFgtsRescisorio = fgtsBaseItems
          .map(v => (v !== "-" && !isNaN(parseFloat(v))) ? parseFloat(v) : 0)
          .reduce((a, b) => a + b, 0);

        const fgtsDepositoMes = baseFgtsRescisorio * 0.08; // FGTS Rescisório

        let multaFgts = 0;
        
        // Calcula o saldo estimado TOTAL em todos os casos.
        const dataAdmObj = moment(calc.dataAdm);
        const dataRecObj = moment(calc.dataRec);
        const mesesCheiosAnteriores = dataRecObj.clone().startOf('month').diff(dataAdmObj.clone().startOf('month'), 'months');
        const fgtsEstimadoAnterior = calc.ultSal * mesesCheiosAnteriores * 0.08;
        const saldoFgtsTotalEstimado = fgtsEstimadoAnterior + fgtsDepositoMes;

        // A multa de 40% é devida SOMENTE em dispensas sem justa causa ou rescisão antecipada pelo empregador.
        if (calc.motResc === 'semJustaCausa' || calc.motResc === 'rescAntEmpre') {
            multaFgts = saldoFgtsTotalEstimado * 0.4;
        }

        // --- Atualização da UI (FGTS) ---
        $('#res-fgts-mes').text(formatCurrency(fgtsDepositoMes));
        $('#res-saldo-fgts-total').text(formatCurrency(saldoFgtsTotalEstimado));
        $('#res-multa-fgts').text(formatCurrency(multaFgts));

        $('#resultado').slideDown();
    });
});