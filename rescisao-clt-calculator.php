<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora
 * Description: Calculadora de rescisão CLT (client-side JS) baseada em verbas rescisórias. Shortcode [rescisao_clt_calculator].
 * Version: 3.0
 * Author: Kelvin Amaral
 */

if (!defined('ABSPATH')) exit;

class RescisaoCLTCalculatorJS {
    public function __construct() {
        add_shortcode('rescisao_clt_calculator', array($this, 'render_shortcode'));
        add_action('wp_enqueue_scripts', array($this,'enqueue'));
    }

    public function enqueue(){
        wp_enqueue_style('rescisao-clt-style', plugins_url('style.css', __FILE__), array(), '3.0');
        wp_enqueue_script(
            'rescisao-clt-script',
            plugins_url('script.js', __FILE__),
            array('jquery'),
            '3.0',
            true
        );
    }

    public function render_shortcode($atts){
        ob_start();
        ?>
        <div class="rescisao-clt-wrap">
            <form id="rescisaoForm" class="rescisao-form" onsubmit="return false;">
                
                <div class="rescisao-form-grid">
                    
                    <div class="form-col">
                        <p><label>Salário (R$)
                            <br><small>Seu salário bruto médio (base de cálculo)</small>
                            <input type="number" id="salario_bruto" min="0" step="0.01" placeholder="ex: 2600.00" required>
                        </label></p>

                        <p><label>Data de contratação
                            <br><small>Data de início do contrato</small>
                            <input type="date" id="data_contratacao" required>
                        </label></p>

                        <p><label>Aviso prévio
                            <br><select id="aviso_previo">
                                <option value="" disabled selected>Selecione</option>
                                <option value="trabalhado">Trabalhado (cumpriu o aviso)</option>
                                <option value="indenizado">Indenizado (empresa pagou)</option>
                                <option value="nao_cumprido">Não cumprido (pedido de demissão)</option>
                            </select>
                        </label></p>
                        
                        <p><label>13º não recebidos
                            <br><small>Qtd. de 13º de anos anteriores não pagos</small>
                           <input type="number" id="decimo_terceiro_atrasado" min="0" value="0">
                        </label></p>
                    </div>

                    <div class="form-col">
                        <p><label>Forma de demissão
                            <br><select id="forma_demissao">
                                <option value="" disabled selected>Selecione</option>
                                <option value="sem_justa_causa">Sem justa causa</option>
                                <option value="com_justa_causa">Com justa causa</option>
                                <option value="rescisao_indireta">Rescisão indireta</option>
                                <option value="pedido_demissao">Pedido de demissão</option>
                            </select>
                        </label></p>

                        <p><label>Data de dispensa
                            <br><small>Último dia de trabalho</small>
                            <input type="date" id="data_dispensa" required>
                        </label></p>

                        <p><label>Férias vencidas
                           <br><small>Qtd. de dias de férias vencidas não gozadas</small>
                           <input type="number" id="ferias_vencidas_dias" min="0" max="30" value="0">
                        </label></p>
                        
                        <p><label>Horas extras não pagas (Valor em R$)
                           <br><small>Valor total em R$ (se souber)</small>
                           <input type="number" id="horas_extras_valor" min="0" step="0.01" value="0">
                        </label></p>
                    </div>
                </div>

                <p><label>
                    <input type="checkbox" id="adicional_insalubridade">
                    Você recebia ou deveria receber adicional de insalubridade e/ou periculosidade?
                </label></p>

                <p><button type="button" id="calcBtn">Calcular</button></p>
            </form>

            <div id="result" aria-live="polite"></div>

            <div id="legal" class="rescisao-legal">
                <p><strong>Aviso:</strong> Esta calculadora fornece estimativas brutas e não substitui o cálculo oficial. Valores exibidos não têm validade legal ou fiscal. **INSS e IRRF não são descontados**.</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculatorJS();