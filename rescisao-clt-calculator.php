<?php
/**
 * Plugin Name: Rescisão CLT - Calculadora
 * Description: Calculadora de rescisão CLT com regras da CLT e tabelas de INSS/IRRF. Use o shortcode [rescisao_clt_calculator].
 * Version: 3.1
 * Author: Kelvin Amaral
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
            // Verifica se o shortcode está no conteúdo do post ou se é um post/page
            // Enqueue em todas as páginas e posts se não houver um método mais seletivo.
            // Para ser mais seletivo, você precisaria de um plugin de scanner de shortcodes
            // Para simplificar, vamos enfileirar se o shortcode for encontrado.
            if (has_shortcode($post->post_content, 'rescisao_clt_calculator')) {
                // É necessário o 'moment-js' para replicar a lógica de datas do Vue/calculadora-rescisao.min.js
                wp_enqueue_script('moment-js', 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js', [], '2.29.1', true);
                
                wp_enqueue_style('rescisao-clt-style', plugins_url('style.css', __FILE__));
                // Certifique-se de que o script.js depende de 'jquery' e 'moment-js'
                wp_enqueue_script('rescisao-clt-script', plugins_url('script.js', __FILE__), ['jquery', 'moment-js'], '3.1', true);
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
                        <label for="ultSal">Salário Bruto (R$)</label>
                        <input type="text" id="ultSal" placeholder="Ex: 1518,00" required>
                    </p>
                    <p class="form-group">
                        <label for="dataAdm">Data de Admissão</label>
                        <input type="date" id="dataAdm" required>
                    </p>
                    <p class="form-group">
                        <label for="dataRec">Data da Rescisão</label>
                        <input type="date" id="dataRec" required>
                    </p>
                    <p class="form-group">
                        <label for="motResc">Motivo da Rescisão</label>
                        <select id="motResc" required>
                            <option value="">Selecione...</option>
                            <option value="semJustaCausa">Dispensa sem justa causa</option>
                            <option value="pediDemiss">Pedido de demissão</option>
                            <option value="comJustaCausa">Dispensa com justa causa</option>
                            <option value="rescAntEmpre">Rescisão Antecipada pelo Empregador (Contrato Prazo)</option>
                            <option value="rescAntFunc">Rescisão Antecipada pelo Funcionário (Contrato Prazo)</option>
                            <option value="expTermino">Término de Contrato de Experiência/Prazo</option>
                        </select>
                    </p>
                    
                    <p id="data_prev_group" class="form-group" style="display:none;">
                        <label for="dataPrev">Data Prevista de Término do Contrato</label>
                        <input type="date" id="dataPrev">
                    </p>

                    <p class="form-group">
                        <label for="avsPrev">Aviso Prévio (Dispensa sem Justa Causa)</label>
                        <select id="avsPrev" required>
                            <option value="0">Trabalhado</option>
                            <option value="1">Indenizado</option>
                            </select>
                    </p>
                    
                    <p class="form-group">
                        <label for="ferVcd">Possui Férias Vencidas Integrais?</label>
                        <select id="ferVcd">
                            <option value="false" selected>Não</option>
                            <option value="true">Sim (Períodos aquisitivos completos vencidos)</option>
                        </select>
                    </p>

                    <p id="dias_ferias_vencidas_group" class="form-group" style="display:none;">
                        <label for="diasFerVenc">Dias de férias vencidas</label>
                        <input type="number" id="diasFerVenc" value="30" min="0">
                    </p>
                </div>

                <p class="form-actions">
                    <button type="button" id="calcular" class="elementor-button">Calcular Rescisão</button>
                    <button type="button" id="limpar" class="elementor-button" style="background-color:#c0392b; margin-left:10px;">Limpar</button>
                </p>
            </form>

            <div id="resultado" class="rescisao-resultado" aria-live="polite" style="display:none;">
                <h3 class="resultado-title">Visualize o Resultado Abaixo</h3>
                
                <div class="resultado-tabela">
                    <h4>Proventos</h4>
                    <table>
                        <tbody>
                            <tr><td>Saldo do salário</td><td id="res-saldo-salario" class="money">R$ 0,00</td></tr>
                            <tr><td>Aviso prévio indenizado</td><td id="res-aviso-previo" class="money">R$ 0,00</td></tr>
                            <tr><td>Reembolso Contrato Antecipado Empregador</td><td id="res-rec-ant-empre" class="money">R$ 0,00</td></tr>
                            <tr><td>13º salário proporcional</td><td id="res-13-proporcional" class="money">R$ 0,00</td></tr>
                            <tr><td>13º salário indenizado</td><td id="res-13-indenizado" class="money">R$ 0,00</td></tr>
                            <tr><td>Férias vencidas (30 dias ou mais)</td><td id="res-ferias-vencidas" class="money">R$ 0,00</td></tr>
                            <tr><td>1/3 sobre férias vencidas</td><td id="res-terco-ferias-vencidas" class="money">R$ 0,00</td></tr>
                            <tr><td>Férias proporcionais</td><td id="res-ferias-proporcionais" class="money">R$ 0,00</td></tr>
                            <tr><td>1/3 Sobre férias proporcionais</td><td id="res-terco-ferias-proporcionais" class="money">R$ 0,00</td></tr>
                            <tr><td>Férias Indenizadas (sobre aviso)</td><td id="res-ferias-indenizadas" class="money">R$ 0,00</td></tr>
                            <tr><td>1/3 Sobre Férias Indenizadas</td><td id="res-terco-ferias-indenizadas" class="money">R$ 0,00</td></tr>
                        </tbody>
                        <tfoot>
                            <tr class="total"><td>TOTAL DE PROVENTOS</td><td id="res-total-proventos" class="money">R$ 0,00</td></tr>
                        </tfoot>
                    </table>
                </div>

                <div class="resultado-tabela">
                    <h4>Descontos</h4>
                    <table>
                        <tbody>
                            <tr><td>INSS sobre Saldo de Salário</td><td id="res-inss-salario" class="money">R$ 0,00</td></tr>
                            <tr><td>IRRF sobre Saldo de Salário</td><td id="res-irrf-salario" class="money">R$ 0,00</td></tr>
                            <tr><td>INSS sobre 13º Salário</td><td id="res-inss-13" class="money">R$ 0,00</td></tr>
                            <tr><td>IRRF sobre 13º Salário</td><td id="res-irrf-13" class="money">R$ 0,00</td></tr>
                            <tr><td>Aviso Prévio Descontado (Pedido Demissão)</td><td id="res-desc-avs-prev" class="money">R$ 0,00</td></tr>
                            <tr><td>Multa Contrato Antecipado Funcionário</td><td id="res-desc-resc-ant" class="money">R$ 0,00</td></tr>
                        </tbody>
                        <tfoot>
                            <tr class="total"><td>TOTAL DE DESCONTOS</td><td id="res-total-descontos" class="money">R$ 0,00</td></tr>
                        </tfoot>
                    </table>
                </div>

                <div class="resultado-final">
                    <h3>LÍQUIDO A RECEBER</h3>
                    <p id="res-liquido" class="money">R$ 0,00</p>
                </div>

                 <div class="resultado-info-adicional">
                    <h4><strong>Informações Adicionais</strong><br><small>(valores não pagos diretamente ao trabalhador)</small></h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Valor</th>
                                <th>Observação</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>FGTS depositado (calculado de forma simulada)</td>
                                <td id="res-saldo-fgts-total" class="money">R$ 0,00</td>
                                <td>(Salário x Meses) + FGTS da rescisão</td>
                            </tr>
                            <tr>
                                <td>Multa de 40% sobre o FGTS (estimativa)</td>
                                <td id="res-multa-fgts" class="money">R$ 0,00</td>
                                <td>Pago apenas em caso de demissão sem justa causa</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="rescisao-legal">
                <p><strong>Aviso Legal:</strong> Esta é uma ferramenta de simulação e os resultados são estimativas. Os valores podem variar e dependem das informações prestadas, além de adequação a convenções coletivas e outras particularidades do contrato de trabalho, servindo apenas como mera estimativa aproximada.</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RescisaoCLTCalculator();