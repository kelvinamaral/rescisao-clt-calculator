<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora Simples (JS Avançado)
 * Description: Calculadora de rescisão CLT (client-side JS). Shortcode [rescisao_clt_calculator]. Valores estimativos.
 * Version: 1.2
 * Author: Kelvin Amaral
 */

if (!defined('ABSPATH')) exit;

class RescisaoCLTCalculatorJS {
    public function __construct() {
        add_shortcode('rescisao_clt_calculator', array($this, 'render_shortcode'));
        add_action('wp_enqueue_scripts', array($this,'enqueue'));
    }

    public function enqueue(){
        wp_enqueue_style('rescisao-clt-style', plugins_url('style.css', __FILE__));
        wp_enqueue_script(
            'rescisao-clt-script',
            plugins_url('script.js', __FILE__),
            array('jquery'),
            false,
            true
        );
    }

    public function render_shortcode($atts){
        ob_start();
        ?>
        <div class="rescisao-clt-wrap">
            <form id="rescisaoForm" class="rescisao-form" onsubmit="return false;">
                <p><label>Salário bruto mensal (R$)<br><input type="number" id="salary" min="0" step="0.01" placeholder="ex: 2600" required></label></p>

                <p><label>Data de admissão<br><input type="date" id="admission" required></label></p>
                <p><label>Data de demissão<br><input type="date" id="dismissal" required></label></p>

                <p><label>Dias trabalhados no mês da rescisão<br>
                <input type="number" id="days_worked" min="0" max="31" placeholder="deixe em branco para calcular automaticamente"></label></p>

                <p><label>Tipo de rescisão<br>
                    <select id="type">
                        <option value="sem_justa_causa">Demissão sem justa causa</option>
                        <option value="pedido">Pedido de demissão</option>
                        <option value="acordo">Rescisão por acordo</option>
                    </select>
                </label></p>

                <p><label><input type="checkbox" id="aviso_indennizado"> Aviso prévio indenizado</label></p>

                <p><label><input type="checkbox" id="vacation_vencida"> Férias vencidas</label>
                   <input type="number" id="vacation_days" min="1" max="365" value="30"></p>

                <p><label>Saldo FGTS atual (opcional, R$) — informe apenas se quiser estimar a multa FGTS<br>
                <input type="number" id="fgts_balance" min="0" step="0.01" placeholder="ex: 1200.00"></label></p>

                <p><button type="button" id="calcBtn">Calcular</button></p>
            </form>

            <div id="result" aria-live="polite"></div>

            <div id="legal" class="rescisao-legal">
                <p><strong>Aviso:</strong> Esta calculadora fornece estimativas. Multa do FGTS só pode ser calculada corretamente a partir do saldo real do FGTS. Valores exibidos não têm validade legal. Consulte um profissional ou o sindicato.</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculatorJS();
