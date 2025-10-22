<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora Simples (JS)
 * Description: Calculadora de rescisão CLT (client-side JS). Shortcode [rescisao_clt_calculator].
 * Version: 1.1
 * Author: Kelvin F. Amaral
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
        <form id="rescisaoForm" class="rescisao-form">
            <p><label>Salário bruto mensal (R$)<br><input type="number" id="salary" required></label></p>
            <p><label>Data de admissão<br><input type="date" id="admission" required></label></p>
            <p><label>Data de demissão<br><input type="date" id="dismissal" required></label></p>
            <p><label>Dias trabalhados no mês da rescisão<br><input type="number" id="days_worked" min="0" max="30" value="30" required></label></p>
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
            <p><button type="button" id="calcBtn">Calcular</button></p>
        </form>
        <div id="result"></div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculatorJS();
