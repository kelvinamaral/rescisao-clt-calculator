jQuery(document).ready(function($){
    $("#calcBtn").on("click", function(){
        const salary = parseFloat($("#salary").val()) || 0;
        const daysWorked = parseInt($("#days_worked").val()) || 0;
        const admission = new Date($("#admission").val());
        const dismissal = new Date($("#dismissal").val());
        const type = $("#type").val();
        const avisoInd = $("#aviso_indennizado").is(":checked");
        const feriasVencidas = $("#vacation_vencida").is(":checked");
        const feriasDias = parseInt($("#vacation_days").val()) || 30;

        if (!salary || !admission || !dismissal) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        const diffYears = dismissal.getFullYear() - admission.getFullYear() -
            (dismissal < new Date(dismissal.getFullYear(), admission.getMonth(), admission.getDate()) ? 1 : 0);

        const diffMonths = (dismissal.getFullYear() - admission.getFullYear()) * 12 +
            (dismissal.getMonth() - admission.getMonth()) +
            (dismissal.getDate() >= admission.getDate() ? 1 : 0);
        const months = Math.min(12, Math.max(0, diffMonths));

        const saldoSalario = (salary / 30) * Math.min(30, daysWorked);
        const avisoExtra = Math.min(diffYears * 3, 60);
        const avisoDays = 30 + avisoExtra;
        const avisoValor = avisoInd ? (salary / 30) * avisoDays :
                                        (salary / 30) * Math.max(0, avisoDays - 30);
        const decimo = (salary * months) / 12;
        const feriasProp = (salary * months) / 12;
        const feriasPropComTerco = feriasProp * (4/3);
        const feriasVenc = feriasVencidas ? (salary / 30) * feriasDias * (4/3) : 0;

        const totalBruto = saldoSalario + avisoValor + decimo + feriasPropComTerco + feriasVenc;
        const fgts = totalBruto * 0.08;
        let multaFgts = 0;
        if (type === "sem_justa_causa") multaFgts = totalBruto * 0.4;
        else if (type === "acordo") multaFgts = totalBruto * 0.2;

        const total = totalBruto + multaFgts;

        $("#result").html(`
            <h3>Resultado estimado (bruto)</h3>
            <ul>
                <li>Saldo de salário: R$ ${saldoSalario.toFixed(2)}</li>
                <li>Aviso prévio (${avisoDays} dias): R$ ${avisoValor.toFixed(2)}</li>
                <li>13º proporcional: R$ ${decimo.toFixed(2)}</li>
                <li>Férias proporcionais +1/3: R$ ${feriasPropComTerco.toFixed(2)}</li>
                ${feriasVenc > 0 ? `<li>Férias vencidas +1/3: R$ ${feriasVenc.toFixed(2)}</li>` : ""}
                <li>FGTS (8%): R$ ${fgts.toFixed(2)}</li>
                <li>Multa FGTS: R$ ${multaFgts.toFixed(2)}</li>
                <li><strong>Total bruto: R$ ${total.toFixed(2)}</strong></li>
            </ul>
        `);
    });
});
