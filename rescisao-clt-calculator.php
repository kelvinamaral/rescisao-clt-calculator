<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora
 * Description: Calculadora de rescisão CLT com regras da CLT e tabelas de INSS/IRRF. Use o shortcode [rescisao_clt_calculator].
 * Version: 3.1
 * Author: Seu Nome
 */

if (!defined('ABSPATH')) exit;

class RescisaoCLTCalculator {
    public function __construct() {
        add_shortcode('rescisao_clt_calculator', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function enqueue_assets() {
        if (is_page() || is_single()) {
            global $post;
            if (has_shortcode($post->post_content, 'rescisao_clt_calculator')) {
                wp_enqueue_style('rescisao-clt-style', plugins_url('style.css', __FILE__));
                wp_enqueue_script('rescisao-clt-script', plugins_url('script.js', __FILE__), ['jquery'], '3.1', true);
            }
        }
    }

    public function render_shortcode() {
        ob_start(); ?>
        <div class="rescisao-clt-wrap">
            <form id="rescisaoForm" class="rescisao-form">
                <h3 class="form-title">Simulador de Rescisão CLT</h3>

                <div class="form-grid">
                    <p class="form-group">
                        <label for="salario">Salário Bruto (R$)</label>
                        <input type="text" id="salario" placeholder="Ex: 1518,00" required>
                    </p>
                    <p class="form-group">
                        <label for="data_admissao">Data de Admissão</label>
                        <input type="date" id="data_admissao" required>
                    </p>
                    <p class="form-group">
                        <label for="data_demissao">Data de Demissão</label>
                        <input type="date" id="data_demissao" required>
                    </p>
                    <p class="form-group">
                        <label for="motivo">Motivo da Rescisão</label>
                        <select id="motivo" required>
                            <option value="dispensa_sem_justa_causa">Dispensa sem justa causa</option>
                            <option value="pedido_demissao">Pedido de demissão</option>
                            <option value="dispensa_com_justa_causa">Dispensa com justa causa</option>
                            <option value="acordo_empregador">Rescisão por acordo</option>
                            <option value="contrato_experiencia">Término de contrato de experiência</option>
                        </select>
                    </p>
                    <p class="form-group">
                        <label for="aviso_previo">Aviso Prévio</label>
                        <select id="aviso_previo" required>
                            <option value="indenizado">Indenizado</option>
                            <option value="trabalhado">Trabalhado</option>
                            <option value="dispensado">Dispensado (não se aplica no pedido de demissão)</option>
                        </select>
                    </p>
                    <p class="form-group">
                        <label for="ferias_vencidas_select">Possui férias vencidas?</label>
                        <select id="ferias_vencidas_select">
                            <option value="nao" selected>Não</option>
                            <option value="sim">Sim</option>
                        </select>
                    </p>
                    <p id="dias_ferias_vencidas_group" class="form-group" style="display:none;">
                        <label for="dias_ferias_vencidas">Dias de férias vencidas</label>
                        <input type="number" id="dias_ferias_vencidas" value="30" min="1" max="30">
                    </p>
                </div>

                <p class="form-actions">
                    <button type="button" id="calcular" class="elementor-button">Calcular Rescisão</button>
                </p>
            </form>

            <div id="resultado" class="rescisao-resultado" aria-live="polite" style="display:none;">
                <h3 class="resultado-title">Visualize o Resultado Abaixo</h3>
                
                <div class="resultado-tabela">
                    <h4>Proventos</h4>
                    <table>
                        <tbody>
                            <tr><td>Saldo do salário</td><td id="res-saldo-salario">R$ 0,00</td></tr>
                            <tr><td>Aviso prévio indenizado</td><td id="res-aviso-previo">R$ 0,00</td></tr>
                            <tr><td>13º salário proporcional</td><td id="res-13-proporcional">R$ 0,00</td></tr>
                            <tr><td>13º salário indenizado</td><td id="res-13-indenizado">R$ 0,00</td></tr>
                            <tr><td>Férias vencidas</td><td id="res-ferias-vencidas">R$ 0,00</td></tr>
                            <tr><td>1/3 sobre férias vencidas</td><td id="res-terco-ferias-vencidas">R$ 0,00</td></tr>
                            <tr><td>Férias proporcionais</td><td id="res-ferias-proporcionais">R$ 0,00</td></tr>
                            <tr><td>1/3 Sobre férias proporcionais</td><td id="res-terco-ferias-proporcionais">R$ 0,00</td></tr>
                            <tr><td>Férias indenizadas (sobre aviso)</td><td id="res-ferias-indenizadas">R$ 0,00</td></tr>
                            <tr><td>1/3 Sobre férias indenizadas</td><td id="res-terco-ferias-indenizadas">R$ 0,00</td></tr>
                        </tbody>
                        <tfoot>
                            <tr class="total"><td>TOTAL DE PROVENTOS</td><td id="res-total-proventos">R$ 0,00</td></tr>
                        </tfoot>
                    </table>
                </div>

                <div class="resultado-tabela">
                    <h4>Descontos</h4>
                    <table>
                        <tbody>
                            <tr><td>INSS sobre Saldo de Salário</td><td id="res-inss-salario">R$ 0,00</td></tr>
                            <tr><td>IRRF sobre Saldo de Salário</td><td id="res-irrf-salario">R$ 0,00</td></tr>
                            <tr><td>INSS sobre 13º Salário</td><td id="res-inss-13">R$ 0,00</td></tr>
                        </tbody>
                        <tfoot>
                            <tr class="total"><td>TOTAL DE DESCONTOS</td><td id="res-total-descontos">R$ 0,00</td></tr>
                        </tfoot>
                    </table>
                </div>

                <div class="resultado-final">
                    <h3>LÍQUIDO A RECEBER</h3>
                    <p id="res-liquido">R$ 0,00</p>
                </div>

                 <div class="resultado-info-adicional">
                    <h4>Outras Informações (Não incluídas no líquido)</h4>
                    <table>
                        <tbody>
                            <tr><td>FGTS a ser depositado na rescisão</td><td id="res-fgts-mes">R$ 0,00</td></tr>
                            <tr><td>Multa de 40% sobre FGTS (estimativa)</td><td id="res-multa-fgts">R$ 0,00</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="rescisao-legal">
                <p><strong>Aviso Legal:</strong> Esta é uma ferramenta de simulação e os resultados são estimativas. Os valores podem variar conforme convenções coletivas e outras particularidades do contrato de trabalho. Para valores exatos, consulte o sindicato da sua categoria ou um profissional de contabilidade.</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculator();
