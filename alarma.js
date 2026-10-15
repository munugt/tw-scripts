/*
 * Name:     Alarm
 * Author:   munugt
 * Version:  1.2
 * Game:     Tribal Wars
 *
 * Description:
 *   Opens a small panel where the player enters a time (server time).
 *   When that time is reached, an alarm sounds (beeps generated with the
 *   Web Audio API, no external files) for a few seconds or until STOP is
 *   pressed. Optionally, given one of the player's own villages as origin
 *   and target coordinates, it shows a button that opens the rally point of
 *   that village with the target pre-filled. The player sends troops manually.
 *
 * The script does NOT perform any automatic action in the game:
 *   - It does not send troops or click any game buttons.
 *   - It makes at most ONE request in total (cached), to the player's own
 *     village overview page, to look up the id of the origin village.
 *   - It does not contact external servers or load third-party resources.
 *   - All configuration is done through the in-game panel.
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

    var sonido = null;          // intervalo que repite los pitidos
    var finSonido = null;       // tiempo máximo sonando
    var DURACION_MS = 3 * 1000;

    // Ráfaga de pitidos con Web Audio (no carga archivos externos)
    function pitar() {
        for (var i = 0; i < 2; i++) {
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

    // Suena hasta pulsar STOP o hasta que pasen DURACION_MS
    function sonar() {
        pitar();
        sonido = setInterval(pitar, 1000);
        finSonido = setTimeout(silenciar, DURACION_MS);
        $('#' + ID + '-ok').text('STOP');
    }

    // Detiene la alarma y muestra el texto
    function silenciar() {
        clearInterval(sonido);
        clearTimeout(finSonido);
        sonido = null;
        $('#' + ID + '-ok').text('OK');
        generarTexto();
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

    // Extrae "xxx|yyy" de un texto, o null
    function parsearCoord(texto) {
        var m = /(\d{1,3})\|(\d{1,3})/.exec(texto);
        return m ? { x: m[1], y: m[2] } : null;
    }

    // Mapa "x|y" -> id de TUS pueblos, leído de la vista general de pueblos.
    // Se pide UNA sola vez por sesión del script (máx. 1 petición en total).
    var pueblosCache = null;
    function cargarPueblos() {
        if (pueblosCache) return pueblosCache;
        var url = game_data.link_base_pure + 'overview_villages&mode=prod&page=-1';
        pueblosCache = $.get(url).then(function (html) {
            var pueblos = {};
            $('<div>').append($.parseHTML(html)).find('a[href*="village="]').each(function () {
                var id = /village=(\d+)/.exec(this.href);
                var c = /\((\d{1,3})\|(\d{1,3})\)/.exec($(this).text());
                if (id && c) pueblos[c[1] + '|' + c[2]] = id[1];
            });
            return pueblos;
        }, function () {
            pueblosCache = null; // si falla, se puede reintentar más tarde
        });
        return pueblosCache;
    }

    // Genera el texto BBCode con el enlace a la plaza del origen apuntando al objetivo
    function generarTexto() {
        var coord = parsearCoord($('#' + ID + '-objetivo').val());
        var origen = parsearCoord($('#' + ID + '-origen').val());
        var $estado = $('#' + ID + '-estado');
        if (!coord) {
            $('#' + ID + '-resultado').hide();
            return;
        }
        if (!origen) {
            mostrarTexto('');
            return;
        }
        cargarPueblos().then(function (pueblos) {
            var id = pueblos[origen.x + '|' + origen.y];
            if (!id) {
                $estado.text('No tienes ningún pueblo en ' + origen.x + '|' + origen.y);
                $('#' + ID + '-resultado').hide();
                return;
            }
            mostrarTexto('village=' + id + '&');
        }, function () {
            $estado.text('No se pudo cargar la lista de pueblos');
        });

        function mostrarTexto(paramPueblo) {
            var url = location.origin + '/game.php?' + paramPueblo +
                'screen=place&x=' + coord.x + '&y=' + coord.y;
            $('#' + ID + '-enviar').attr('href', url);
            $('#' + ID + '-resultado').show();
        }
    }

    // OK: si suena, la para; si hay hora, programa la alarma (el texto sale al pararla);
    // sin hora, muestra el texto directamente
    function aceptar() {
        if (sonido) {
            silenciar();
        } else if ($('#' + ID + '-hora').val().trim()) {
            $('#' + ID + '-resultado').hide();
            activar();
        } else {
            generarTexto();
        }
    }

    // Si ya está abierto, no duplicar
    if ($('#' + ID).length) return;

    var html =
        '<div id="' + ID + '" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;' +
        'background:#f4e4bc;border:2px solid #7d510f;padding:10px;width:260px;font-size:12px;">' +
        '<b id="' + ID + '-titulo" style="cursor:move;display:inline-block;width:220px;">Alarma (hora servidor) ✥</b>' +
        '<span id="' + ID + '-cerrar" style="float:right;cursor:pointer;">✖</span><br><br>' +
        'Origen: <input id="' + ID + '-origen" type="text" placeholder="xxx|yyy" style="width:70px;"><br>' +
        'Objetivo: <input id="' + ID + '-objetivo" type="text" placeholder="xxx|yyy" style="width:70px;"><br>' +
        'Hora: <input id="' + ID + '-hora" type="text" placeholder="HH:MM:SS" style="width:70px;"> ' +
        '<button id="' + ID + '-ok" class="btn">OK</button>' +
        '<div id="' + ID + '-estado" style="margin-top:8px;"></div>' +
        '<div id="' + ID + '-resultado" style="display:none;margin-top:8px;">' +
        // Botón que lleva a la plaza del origen con el objetivo rellenado (1 clic = 1 acción)
        '<table class="vis" style="width:100%;"><tr><td style="text-align:center;padding:6px;">' +
        '<a id="' + ID + '-enviar" class="btn" href="#" style="font-size:13px;">⚔️ <b>ENVIAR</b></a>' +
        '</td></tr></table>' +
        '</div>' +
        '</div>';
    $('body').append(html);

    // Arrastrar la ventana desde el título
    $('#' + ID + '-titulo').on('mousedown', function (e) {
        var $v = $('#' + ID), pos = $v[0].getBoundingClientRect();
        var dx = e.clientX - pos.left, dy = e.clientY - pos.top;
        $v.css({ transform: 'none', left: pos.left, top: pos.top });
        $(document).on('mousemove.' + ID + 'drag', function (ev) {
            $v.css({ left: ev.clientX - dx, top: ev.clientY - dy });
        }).on('mouseup.' + ID + 'drag', function () {
            $(document).off('.' + ID + 'drag');
        });
        e.preventDefault();
    });

    $('#' + ID + '-ok').on('click', aceptar);
    $('#' + ID + ' input').on('keydown', function (e) { if (e.key === 'Enter') aceptar(); });
    $('#' + ID + '-cerrar').on('click', function () {
        parar();
        clearInterval(sonido);
        clearTimeout(finSonido);
        $(document).off('.' + ID + 'drag');
        $('#' + ID).remove();
    });
})();
