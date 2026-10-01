/*
 * Alarma - Guerras Tribales
 * Muestra un cuadro donde escribir una hora (hora del servidor) y, al llegar,
 * suena una alarma. No realiza ninguna acción en el juego.
 *
 * Uso (barra de acceso rápido):
 *   javascript:$.getScript("https://TU-HOSTING/alarma.js");
 */
(function () {
    'use strict';

    var ID = 'tw-alarma';
    var temporizador = null;
    var audioCtx = null;

    // Hora actual del servidor en ms del día (0 - 86.399.999)
    function horaServidorMs() {
        var texto = $('#serverTime').text().trim(); // "HH:MM:SS"
        var p = texto.split(':').map(Number);
        if (p.length !== 3 || p.some(isNaN)) {
            var d = new Date();
            return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000;
        }
        return ((p[0] * 60 + p[1]) * 60 + p[2]) * 1000;
    }

    // Convierte "HH:MM" o "HH:MM:SS" a ms del día, o null si no es válido
    function parsearHora(texto) {
        var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(texto.trim());
        if (!m) return null;
        var h = +m[1], min = +m[2], s = +(m[3] || 0);
        if (h > 23 || min > 59 || s > 59) return null;
        return ((h * 60 + min) * 60 + s) * 1000;
    }

    function formatear(ms) {
        var t = Math.floor(ms / 1000);
        var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
        return [h, m, s].map(function (n) { return n < 10 ? '0' + n : n; }).join(':');
    }

    // Pitido con Web Audio (no carga archivos externos)
    function sonar() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        for (var i = 0; i < 6; i++) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            var inicio = audioCtx.currentTime + i * 0.5;
            osc.type = 'square';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.2, inicio);
            gain.gain.setValueAtTime(0, inicio + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(inicio);
            osc.stop(inicio + 0.3);
        }
    }

    function parar() {
        clearInterval(temporizador);
        temporizador = null;
    }

    function activar() {
        var objetivo = parsearHora($('#' + ID + '-hora').val());
        var $estado = $('#' + ID + '-estado');
        if (objetivo === null) {
            $estado.text('Formato inválido. Usa HH:MM o HH:MM:SS');
            return;
        }
        // Crear el contexto de audio con el clic (requisito del navegador)
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        parar();

        temporizador = setInterval(function () {
            var faltan = objetivo - horaServidorMs();
            if (faltan < 0) faltan += 86400000; // la hora es de mañana
            if (faltan <= 1000) {
                parar();
                sonar();
                $estado.text('¡Alarma! ' + formatear(objetivo));
            } else {
                $estado.text('Suena en ' + formatear(faltan));
            }
        }, 250);
    }

    // Si ya está abierto, no duplicar
    if ($('#' + ID).length) return;

    var html =
        '<div id="' + ID + '" style="position:fixed;top:120px;right:20px;z-index:99999;' +
        'background:#f4e4bc;border:2px solid #7d510f;padding:10px;width:220px;font-size:12px;">' +
        '<b>Alarma (hora servidor)</b>' +
        '<span id="' + ID + '-cerrar" style="float:right;cursor:pointer;">✖</span><br><br>' +
        '<input id="' + ID + '-hora" type="text" placeholder="HH:MM:SS" style="width:90px;"> ' +
        '<button id="' + ID + '-ok" class="btn">OK</button>' +
        '<div id="' + ID + '-estado" style="margin-top:8px;"></div>' +
        '</div>';
    $('body').append(html);

    $('#' + ID + '-ok').on('click', activar);
    $('#' + ID + '-hora').on('keydown', function (e) { if (e.key === 'Enter') activar(); });
    $('#' + ID + '-cerrar').on('click', function () { parar(); $('#' + ID).remove(); });
})();
