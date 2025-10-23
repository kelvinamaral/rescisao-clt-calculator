<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora (versão aprimorada)
 * Description: Calculadora de rescisão CLT com regras da CLT e tabelas de INSS/IRRF 2025. Use o shortcode [rescisao_clt_calculator].
 * Version: 2.0
 * Author: Kelvin Amaral
 */

if (!defined('ABSPATH')) exit;

class RescisaoCLTCalculator {
    public function __construct() {
        add_shortcode('rescisao_clt_calculator', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function enqueue_assets() {
        wp_enqueue_style('rescisao-clt-style', plugins_url('style.css', __FILE__));
        wp_enqueue_script('rescisao-clt-script', plugins_url('script.js', __FILE__), ['jquery'], false, true);
    }

    public function render_shortcode() {
        ob_start(); ?>
        <div class="rescisao-clt-wrap">
            <form id="rescisaoForm" class="rescisao-form" onsubmit="return false;">
                <h3>Simulador de Rescisão CLT</h3>

                <p><label>Salário base (R$)<br>
                    <input type="number" id="salary" min="0" step="0.01" placeholder="Ex: 1518.00" required>
                </label></p>

                <p><label>Data de admissão<br>
                    <input type="date" id="admission" required>
                </label></p>

                <p><label>Data de demissão<br>
                    <input type="date" id="dismissal" required>
                </label></p>

                <p><label>Tipo de rescisão<br>
                    <select id="type" required>
                        <option value="sem_justa_causa">Dispensa sem justa causa</option>
                        <option value="pedido">Pedido de demissão</option>
                        <option value="acordo">Rescisão por acordo</option>
                    </select>
                </label></p>

                <p><button type="button" id="calcBtn">Calcular</button></p>
            </form>

            <div id="result" class="rescisao-resultado" aria-live="polite"></div>

            <div class="rescisao-legal">
                <p><strong>Aviso:</strong> Esta ferramenta fornece estimativas baseadas na CLT e nas faixas de INSS e IRRF de 2025.  
                Os valores não substituem cálculos homologatórios nem consideram variações contratuais específicas.</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculator();
