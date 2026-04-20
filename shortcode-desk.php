<?php
/**
 * Template: Shortcode Desk Tablet
 * [blu_alliance_desk] - Flusso: Destinazione → Barche → Prenota
 * Ottimizzato per tablet al desk della Stazione Marittima
 */

if (!defined('ABSPATH')) {
    exit;
}

$link_prenota = isset($atts['link_prenota']) ? esc_url($atts['link_prenota']) : '/prenota/';
$valuta = get_option('bab_valuta', '€');

// Lingua WPML
$current_lang = 'it';
if (defined('ICL_LANGUAGE_CODE')) {
    $current_lang = ICL_LANGUAGE_CODE;
} elseif (function_exists('pll_current_language')) {
    $current_lang = pll_current_language('slug');
}
?>

<div class="desk-app" data-link-prenota="<?php echo $link_prenota; ?>" data-lang="<?php echo $current_lang; ?>">

    <!-- ═══ HEADER ═══ -->
    <div class="desk-header">
        <img src="<?php echo get_option('bab_logo_url', '/wp-content/uploads/2024/12/blu-alliance-logo-white.png'); ?>" 
             alt="Blu Alliance" class="desk-logo">
        <div class="desk-header-text">
            <h1><?php echo ($current_lang === 'en') ? 'Choose Your Experience' : 'Scegli la Tua Esperienza'; ?></h1>
            <p><?php echo ($current_lang === 'en') ? 'Select a destination to begin' : 'Seleziona una destinazione per iniziare'; ?></p>
        </div>
        <button class="desk-lang-toggle" onclick="toggleDeskLang()">
            <?php echo ($current_lang === 'en') ? '🇮🇹 IT' : '🇬🇧 EN'; ?>
        </button>
    </div>

    <!-- ═══ SCHERMATA 1: DESTINAZIONI ═══ -->
    <div class="desk-screen desk-destinations active" id="desk-destinations">
        <div class="desk-grid" id="desk-destinations-grid">
            <div class="desk-loading">
                <div class="desk-spinner"></div>
                <p><?php echo ($current_lang === 'en') ? 'Loading destinations...' : 'Caricamento destinazioni...'; ?></p>
            </div>
        </div>
    </div>

    <!-- ═══ SCHERMATA 2: BARCHE PER DESTINAZIONE ═══ -->
    <div class="desk-screen desk-boats" id="desk-boats">
        <div class="desk-boats-header">
            <button class="desk-back-btn" onclick="deskGoBack()">
                ← <?php echo ($current_lang === 'en') ? 'Back' : 'Indietro'; ?>
            </button>
            <div class="desk-selected-dest">
                <h2 id="desk-dest-title"></h2>
                <p id="desk-dest-subtitle"></p>
            </div>
        </div>
        <div class="desk-grid desk-boats-grid" id="desk-boats-grid">
            <div class="desk-loading">
                <div class="desk-spinner"></div>
                <p><?php echo ($current_lang === 'en') ? 'Loading boats...' : 'Caricamento barche...'; ?></p>
            </div>
        </div>
    </div>

</div>

<style>
/* ═══════════════════════════════════════
   DESK APP — Tablet-first Design
   ═══════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

.desk-app {
    --desk-primary: #0c4a6e;
    --desk-accent: #0ea5e9;
    --desk-gold: #d4a853;
    --desk-bg: #f0f4f8;
    font-family: 'DM Sans', -apple-system, sans-serif;
    min-height: 100vh;
    background: var(--desk-bg);
    overflow-x: hidden;
}

/* ═══ HEADER ═══ */
.desk-header {
    background: linear-gradient(135deg, var(--desk-primary) 0%, #1e3a5f 50%, var(--desk-primary) 100%);
    padding: 20px 30px;
    display: flex;
    align-items: center;
    gap: 20px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.desk-logo {
    height: 50px;
    width: auto;
    flex-shrink: 0;
}

.desk-header-text {
    flex: 1;
}

.desk-header-text h1 {
    font-family: 'Playfair Display', Georgia, serif;
    color: white;
    font-size: 26px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.5px;
}

.desk-header-text p {
    color: rgba(255,255,255,0.7);
    font-size: 14px;
    margin: 4px 0 0 0;
}

.desk-lang-toggle {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.desk-lang-toggle:hover {
    background: rgba(255,255,255,0.25);
}

/* ═══ SCREENS ═══ */
.desk-screen {
    display: none;
    padding: 25px;
    animation: deskFadeIn 0.4s ease;
}

.desk-screen.active {
    display: block;
}

@keyframes deskFadeIn {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ═══ GRID ═══ */
.desk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

/* ═══ DESTINATION CARDS ═══ */
.desk-dest-card {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    height: 260px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.desk-dest-card:hover,
.desk-dest-card:active {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 12px 30px rgba(0,0,0,0.2);
}

.desk-dest-card .desk-card-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: transform 0.5s ease;
}

.desk-dest-card:hover .desk-card-bg {
    transform: scale(1.08);
}

.desk-dest-card .desk-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%);
}

.desk-dest-card .desk-card-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 25px;
    color: white;
    z-index: 2;
}

.desk-dest-card .desk-card-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 6px 0;
    text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.desk-dest-card .desk-card-subtitle {
    font-size: 14px;
    opacity: 0.9;
    margin: 0 0 10px 0;
}

.desk-dest-card .desk-card-price {
    display: inline-block;
    background: var(--desk-gold);
    color: #1a1a1a;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 700;
}

.desk-dest-card .desk-card-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    background: white;
    color: var(--desk-primary);
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* ═══ BOATS SCREEN ═══ */
.desk-boats-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 25px;
}

.desk-back-btn {
    background: white;
    border: 2px solid #e2e8f0;
    color: var(--desk-primary);
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
}

.desk-back-btn:hover {
    background: var(--desk-primary);
    color: white;
    border-color: var(--desk-primary);
}

.desk-selected-dest h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    color: var(--desk-primary);
    margin: 0;
}

.desk-selected-dest p {
    font-size: 14px;
    color: #64748b;
    margin: 2px 0 0 0;
}

/* ═══ BOAT CARDS ═══ */
.desk-boat-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.desk-boat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
}

.desk-boat-img {
    height: 180px;
    background-size: cover;
    background-position: center;
    background-color: #e2e8f0;
    position: relative;
}

.desk-boat-img .desk-boat-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
}

.desk-badge-simple { background: #dcfce7; color: #166534; }
.desk-badge-premium { background: #fef3c7; color: #92400e; }
.desk-badge-luxury { background: #ede9fe; color: #5b21b6; }

.desk-boat-body {
    padding: 18px;
}

.desk-boat-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px 0;
}

.desk-boat-specs {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #64748b;
    margin-bottom: 12px;
}

.desk-boat-specs span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.desk-boat-features {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 15px;
}

.desk-boat-features span {
    background: #f1f5f9;
    color: #475569;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
}

.desk-boat-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 15px;
    border-top: 1px solid #f1f5f9;
}

.desk-boat-price {
    font-size: 24px;
    font-weight: 800;
    color: var(--desk-primary);
}

.desk-boat-price small {
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
}

.desk-book-btn {
    background: linear-gradient(135deg, var(--desk-primary) 0%, #1e3a5f 100%);
    color: white;
    border: none;
    padding: 12px 28px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.3px;
}

.desk-book-btn:hover,
.desk-book-btn:active {
    background: linear-gradient(135deg, #0ea5e9 0%, var(--desk-primary) 100%);
    transform: scale(1.03);
}

/* ═══ LOADING ═══ */
.desk-loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #64748b;
}

.desk-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: var(--desk-accent);
    border-radius: 50%;
    animation: deskSpin 0.8s linear infinite;
    margin: 0 auto 15px;
}

@keyframes deskSpin {
    to { transform: rotate(360deg); }
}

/* ═══ EMPTY STATE ═══ */
.desk-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
}

.desk-empty-icon {
    font-size: 48px;
    margin-bottom: 15px;
}

/* ═══ TABLET LANDSCAPE (primary use case) ═══ */
@media (min-width: 768px) and (max-width: 1366px) {
    .desk-grid {
        grid-template-columns: repeat(3, 1fr);
    }
    .desk-dest-card {
        height: 280px;
    }
}

/* ═══ PHONE ═══ */
@media (max-width: 767px) {
    .desk-header {
        padding: 15px;
        gap: 12px;
    }
    .desk-header-text h1 {
        font-size: 20px;
    }
    .desk-screen {
        padding: 15px;
    }
    .desk-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    .desk-dest-card {
        height: 200px;
    }
    .desk-dest-card .desk-card-title {
        font-size: 18px;
    }
}
</style>

<script>
jQuery(document).ready(function($) {
    var deskApp = $('.desk-app');
    var linkPrenota = deskApp.data('link-prenota') || '/prenota/';
    var lang = deskApp.data('lang') || 'it';
    var valuta = '<?php echo $valuta; ?>';
    var serviziData = [];
    var imbarcazioniData = {};

    // ═══ Immagini di default per destinazione ═══
    var destImages = {
        'amalfi': 'https://images.unsplash.com/photo-1533656338503-b22f63e96d85?w=600&h=400&fit=crop',
        'positano': 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=600&h=400&fit=crop',
        'capri': 'https://images.unsplash.com/photo-1548525207-a4d71d637a3c?w=600&h=400&fit=crop',
        'costiera': 'https://images.unsplash.com/photo-1612698093158-e07ac200d44e?w=600&h=400&fit=crop',
        'sunset': 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=400&fit=crop',
        'locazione': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop',
        'taxi': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=400&fit=crop',
        'default': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop'
    };

    var i18n = {
        it: {
            from: 'Da', perPerson: '/persona', book: 'Prenota', guests: 'pax',
            noBoats: 'Nessuna barca disponibile per questa destinazione',
            tour: 'Tour', rental: 'Locazione', transfer: 'Transfer', collective: 'Tour Collettivo',
            halfDay: 'Half Day', fullDay: 'Full Day', chooseBoat: 'Scegli la tua barca'
        },
        en: {
            from: 'From', perPerson: '/person', book: 'Book Now', guests: 'guests',
            noBoats: 'No boats available for this destination',
            tour: 'Tour', rental: 'Rental', transfer: 'Transfer', collective: 'Group Tour',
            halfDay: 'Half Day', fullDay: 'Full Day', chooseBoat: 'Choose your boat'
        }
    };
    var t = i18n[lang] || i18n['it'];

    // ═══ CARICA SERVIZI (DESTINAZIONI) ═══
    function loadDestinations() {
        $.ajax({
            url: babConfig.ajaxUrl, type: 'POST',
            data: { action: 'bab_get_servizi', nonce: babConfig.nonce },
            success: function(response) {
                if (response.success && response.data && response.data.length > 0) {
                    serviziData = response.data.filter(function(s) { return s.attivo; });
                    renderDestinations();
                } else {
                    $('#desk-destinations-grid').html(
                        '<div class="desk-empty"><div class="desk-empty-icon">⛵</div><p>Nessun servizio disponibile</p></div>'
                    );
                }
            }
        });
    }

    // ═══ RENDER DESTINAZIONI ═══
    function renderDestinations() {
        var html = '';
        serviziData.forEach(function(servizio) {
            var nome = (lang !== 'it' && servizio.nome_en) ? servizio.nome_en : servizio.nome;
            var desc = (lang !== 'it' && servizio.descrizione_en) ? servizio.descrizione_en : (servizio.descrizione || '');
            // Troncate description
            if (desc.length > 80) desc = desc.substring(0, 80) + '...';

            var imgUrl = servizio.immagine_url || servizio.immagine_principale || getDestImage(servizio.nome);
            var prezzo = parseFloat(servizio.prezzo_base || 0);
            var isPerPersona = servizio.prezzo_per_persona;
            var prezzoLabel = prezzo > 0 
                ? t.from + ' ' + valuta + prezzo + (isPerPersona ? t.perPerson : '')
                : '';

            var tipoLabel = '';
            if (servizio.tipo === 'tour') tipoLabel = t.tour;
            else if (servizio.tipo === 'tour_collettivo') tipoLabel = t.collective;
            else if (servizio.tipo === 'locazione') tipoLabel = t.rental;
            else if (servizio.tipo === 'transfer') tipoLabel = t.transfer;

            var durata = '';
            if (servizio.durata_minuti) {
                var h = Math.floor(servizio.durata_minuti / 60);
                durata = h > 0 ? h + 'h' : servizio.durata_minuti + 'm';
            }

            html += `
                <div class="desk-dest-card" onclick="deskSelectDest('${servizio.id}')">
                    <div class="desk-card-bg" style="background-image: url('${imgUrl}')"></div>
                    <div class="desk-card-overlay"></div>
                    ${tipoLabel ? '<div class="desk-card-badge">' + tipoLabel + '</div>' : ''}
                    <div class="desk-card-content">
                        <div class="desk-card-title">${nome}</div>
                        <div class="desk-card-subtitle">${desc}</div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${prezzoLabel ? '<span class="desk-card-price">' + prezzoLabel + '</span>' : ''}
                            ${durata ? '<span style="color: rgba(255,255,255,0.8); font-size: 13px;">⏱ ' + durata + '</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        $('#desk-destinations-grid').html(html);
    }

    function getDestImage(nome) {
        var n = nome.toLowerCase();
        if (n.indexOf('capri') !== -1) return destImages.capri;
        if (n.indexOf('positano') !== -1) return destImages.positano;
        if (n.indexOf('amalfi') !== -1) return destImages.amalfi;
        if (n.indexOf('sunset') !== -1 || n.indexOf('tramonto') !== -1) return destImages.sunset;
        if (n.indexOf('locazione') !== -1 || n.indexOf('self') !== -1) return destImages.locazione;
        if (n.indexOf('taxi') !== -1) return destImages.taxi;
        return destImages.default;
    }

    // ═══ SELEZIONA DESTINAZIONE → MOSTRA BARCHE ═══
    window.deskSelectDest = function(servizioId) {
        var servizio = serviziData.find(function(s) { return s.id === servizioId; });
        if (!servizio) return;

        var nome = (lang !== 'it' && servizio.nome_en) ? servizio.nome_en : servizio.nome;
        $('#desk-dest-title').text(nome);
        $('#desk-dest-subtitle').text(t.chooseBoat);

        // Mostra schermata barche
        $('#desk-destinations').removeClass('active');
        $('#desk-boats').addClass('active');

        // Carica barche per questo servizio
        loadBoatsForService(servizioId);
    };

    // ═══ CARICA BARCHE PER SERVIZIO ═══
    function loadBoatsForService(servizioId) {
        $('#desk-boats-grid').html(
            '<div class="desk-loading"><div class="desk-spinner"></div><p>Caricamento barche...</p></div>'
        );

        // Carica tutte le imbarcazioni con i servizi associati
        $.ajax({
            url: babConfig.ajaxUrl, type: 'POST',
            data: { action: 'bab_get_imbarcazioni', nonce: babConfig.nonce },
            success: function(imbResp) {
                if (!imbResp.success) return;

                var imbarcazioni = imbResp.data || [];

                // Per ogni imbarcazione, carica servizi e verifica se ha questo servizio
                var promises = [];
                var boatsWithService = [];

                imbarcazioni.forEach(function(imb) {
                    var p = $.ajax({
                        url: babConfig.ajaxUrl, type: 'POST',
                        data: { action: 'bab_get_servizi_imbarcazione', nonce: babConfig.nonce, imbarcazione_id: imb.id }
                    }).then(function(resp) {
                        if (resp.success && resp.data) {
                            var match = resp.data.find(function(s) { return s.id === servizioId; });
                            if (match) {
                                boatsWithService.push({
                                    ...imb,
                                    servizio_match: match,
                                    prezzo: parseFloat(match.prezzo_effettivo || match.prezzo_base || 0)
                                });
                            }
                        }
                    });
                    promises.push(p);
                });

                $.when.apply($, promises).then(function() {
                    if (boatsWithService.length === 0) {
                        $('#desk-boats-grid').html(
                            '<div class="desk-empty"><div class="desk-empty-icon">🚤</div><p>' + t.noBoats + '</p></div>'
                        );
                    } else {
                        // Ordina per prezzo
                        boatsWithService.sort(function(a, b) { return a.prezzo - b.prezzo; });
                        renderBoats(boatsWithService, servizioId);
                    }
                });
            }
        });
    }

    // ═══ RENDER BARCHE ═══
    function renderBoats(boats, servizioId) {
        var html = '';
        var servizio = serviziData.find(function(s) { return s.id === servizioId; });
        var isPerPersona = servizio && servizio.prezzo_per_persona;

        boats.forEach(function(boat) {
            var imgUrl = boat.immagine_principale || '';
            var imgStyle = imgUrl 
                ? "background-image: url('" + imgUrl + "')" 
                : "background: linear-gradient(135deg, #e2e8f0, #cbd5e1); display: flex; align-items: center; justify-content: center;";

            var categoriaClass = 'desk-badge-' + (boat.categoria || 'simple');
            var categoriaLabel = (boat.categoria || 'simple').charAt(0).toUpperCase() + (boat.categoria || 'simple').slice(1);

            var features = '';
            if (boat.caratteristiche && boat.caratteristiche.length > 0) {
                var first3 = boat.caratteristiche.slice(0, 3);
                features = first3.map(function(c) { return '<span>' + c + '</span>'; }).join('');
            }

            var prezzoDisplay = boat.prezzo > 0 
                ? valuta + boat.prezzo.toFixed(0) + (isPerPersona ? '<small> ' + t.perPerson + '</small>' : '')
                : '';

            var bookUrl = linkPrenota + '?servizio=' + servizioId + '&imbarcazione=' + boat.id;

            html += `
                <div class="desk-boat-card">
                    <div class="desk-boat-img" style="${imgStyle}">
                        ${!imgUrl ? '<span style="font-size: 48px;">⛵</span>' : ''}
                        <span class="desk-boat-badge ${categoriaClass}">${categoriaLabel}</span>
                    </div>
                    <div class="desk-boat-body">
                        <div class="desk-boat-name">${boat.nome}</div>
                        <div class="desk-boat-specs">
                            ${boat.capacita_massima ? '<span>👥 Max ' + boat.capacita_massima + ' ' + t.guests + '</span>' : ''}
                            ${boat.tipo ? '<span>🚤 ' + boat.tipo + '</span>' : ''}
                        </div>
                        ${features ? '<div class="desk-boat-features">' + features + '</div>' : ''}
                        <div class="desk-boat-footer">
                            <div class="desk-boat-price">${prezzoDisplay}</div>
                            <a href="${bookUrl}" class="desk-book-btn">${t.book} →</a>
                        </div>
                    </div>
                </div>
            `;
        });

        $('#desk-boats-grid').html(html);
    }

    // ═══ NAVIGAZIONE ═══
    window.deskGoBack = function() {
        $('#desk-boats').removeClass('active');
        $('#desk-destinations').addClass('active');
    };

    window.toggleDeskLang = function() {
        var currentUrl = window.location.href;
        if (lang === 'it') {
            window.location.href = currentUrl.indexOf('/en/') !== -1 ? currentUrl : '/en' + window.location.pathname;
        } else {
            window.location.href = currentUrl.replace('/en/', '/');
        }
    };

    // ═══ INIT ═══
    loadDestinations();
});
</script>
