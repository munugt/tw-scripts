/*
 * Nombre:    MP masivo
 * Autor:     munugt
 * Versión:   2.0
 * Juego:     Guerras Tribales
 *
 * Descripción:
 *   Abre un panel con un cuadro de texto donde se pega una lista de mensajes
 *   en BBCode. Cada mensaje empieza con el nombre del destinatario en una
 *   línea [u]Jugador[/u]; todo lo que hay debajo (hasta el siguiente
 *   [u]...[/u]) es el cuerpo del mensaje.
 *   Al pulsar "Cargar" aparece la lista de mensajes y cada pulsación de
 *   ENTER (o del botón "Abrir siguiente") abre la pantalla "Escribir mensaje"
 *   del juego con destinatario, asunto y texto rellenados. El script NO envía
 *   nada ni hace peticiones: el jugador pulsa "Enviar" en el propio juego.
 *
 *   El asunto se toma del primer [color=...]...[/color] del mensaje
 *   (p. ej. "🛡️ BLINDAJE") y se puede cambiar en el panel.
 */
(function () {
    'use strict';

    var ID = 'tw-mp';
    var mensajes = [];      // [{ jugador, asunto, texto, estado }]
    var asuntoManual = false; // true cuando el usuario escribe un asunto: se usa para todos los siguientes

    if ($('#' + ID).length) return;

    // Divide el texto pegado en mensajes: cada [u]Nombre[/u] en su propia línea abre uno nuevo
    function parsear(texto) {
        var lista = [];
        var re = /^\s*\[u\](.+?)\[\/u\]\s*$/gm;
        var marcas = [], m;
        while ((m = re.exec(texto))) marcas.push({ jugador: m[1].trim(), ini: m.index, fin: re.lastIndex });
        marcas.forEach(function (mk, i) {
            var cuerpo = texto.slice(mk.fin, i + 1 < marcas.length ? marcas[i + 1].ini : texto.length).trim();
            if (!cuerpo) return;
            var a = /\[color=[^\]]*\](.+?)\[\/color\]/.exec(cuerpo);
            lista.push({ jugador: mk.jugador, asunto: a ? a[1].trim() : '', texto: cuerpo, estado: 'pendiente' });
        });
        return lista;
    }

    function escapar(s) {
        return $('<div>').text(s).html();
    }

    function pintarLista() {
        var abiertos = mensajes.filter(function (x) { return x.estado === 'ok'; }).length;
        var html = '<table class="vis" style="width:100%;">' +
            '<tr><th>#</th><th>Jugador</th><th>Estado</th></tr>';
        mensajes.forEach(function (x, i) {
            var color = x.estado === 'ok' ? '#2a7a2a' : x.estado === 'error' ? '#b00' : '#000';
            var marca = x.estado === 'ok' ? '✔ abierto' : x.estado === 'error' ? '✖ ' + escapar(x.error || '') : '…';
            html += '<tr' + (i === siguiente() ? ' style="background:#fff3c4;"' : '') + '>' +
                '<td>' + (i + 1) + '</td><td>' + escapar(x.jugador) + '</td>' +
                '<td style="color:' + color + ';">' + marca + '</td></tr>';
        });
        html += '</table>';
        $('#' + ID + '-lista').html(html);
        $('#' + ID + '-progreso').text(abiertos + ' / ' + mensajes.length + ' preparados');
        var sig = siguiente();
        if (!asuntoManual) $('#' + ID + '-asunto').val(sig >= 0 ? mensajes[sig].asunto : '');
    }

    // Índice del siguiente mensaje pendiente, o -1
    function siguiente() {
        for (var i = 0; i < mensajes.length; i++) if (mensajes[i].estado === 'pendiente') return i;
        return -1;
    }

    function cargar() {
        mensajes = parsear($('#' + ID + '-texto').val());
        if (!mensajes.length) {
            $('#' + ID + '-progreso').text('No se ha encontrado ningún [u]Jugador[/u]');
            return;
        }
        $('#' + ID + '-paso1').hide();
        $('#' + ID + '-paso2').show();
        pintarLista();
        $('#' + ID + '-enviar').focus();
    }

    // Abre "Escribir mensaje" del juego en otra pestaña con todo rellenado.
    // El script NO envía nada: el jugador pulsa "Enviar" en el formulario del juego.
    function abrirSiguiente() {
        var i = siguiente();
        if (i < 0) return;
        var msg = mensajes[i];
        msg.asunto = $('#' + ID + '-asunto').val().trim() || msg.asunto || 'Mensaje';
        var w = window.open(game_data.link_base_pure + 'mail&mode=new', ID + '-redactar');
        if (!w) {
            $('#' + ID + '-progreso').text('El navegador ha bloqueado la pestaña: permite ventanas emergentes');
            return;
        }
        var intentos = 0;
        var rellenar = setInterval(function () {
            intentos++;
            try {
                var $d = $(w.document);
                var $text = $d.find('textarea[name="text"]');
                if ($text.length && w.document.readyState === 'complete') {
                    clearInterval(rellenar);
                    $d.find('input[name="to"]').val(msg.jugador);
                    $d.find('input[name="subject"]').val(msg.asunto);
                    $text.val(msg.texto);
                    msg.estado = 'ok';
                    pintarLista();
                    $('#' + ID + '-progreso').append(' — revisa la pestaña y pulsa Enviar');
                    w.focus();
                }
            } catch (e) { /* la pestaña aún está cargando */ }
            if (intentos > 40) {
                clearInterval(rellenar);
                $('#' + ID + '-progreso').text('No se pudo rellenar el formulario de ' + msg.jugador);
            }
        }, 250);
    }

    var html =
        '<div id="' + ID + '" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;' +
        'background:#f4e4bc;border:2px solid #7d510f;padding:10px;width:360px;font-size:12px;">' +
        '<b id="' + ID + '-titulo" style="cursor:move;display:inline-block;width:320px;">MP masivo ✥</b>' +
        '<span id="' + ID + '-cerrar" style="float:right;cursor:pointer;">✖</span><br><br>' +
        '<div id="' + ID + '-paso1">' +
        'Pega aquí los mensajes (cada uno empieza con [u]Jugador[/u]):<br>' +
        '<textarea id="' + ID + '-texto" style="width:100%;height:220px;box-sizing:border-box;"></textarea><br>' +
        '<button id="' + ID + '-cargar" class="btn">Cargar</button>' +
        '</div>' +
        '<div id="' + ID + '-paso2" style="display:none;">' +
        'Asunto: <input id="' + ID + '-asunto" type="text" style="width:250px;"><br><br>' +
        '<button id="' + ID + '-enviar" class="btn">Abrir siguiente (ENTER)</button> ' +
        '<button id="' + ID + '-volver" class="btn">Volver</button>' +
        '<div style="max-height:300px;overflow:auto;margin-top:8px;" id="' + ID + '-lista"></div>' +
        '</div>' +
        '<div id="' + ID + '-progreso" style="margin-top:8px;font-weight:bold;"></div>' +
        '</div>';
    $('body').append(html);

    // Asunto escrito a mano = asunto para este y todos los siguientes (vacío = el de cada mensaje)
    $('#' + ID + '-asunto').on('input', function () {
        asuntoManual = $(this).val().trim() !== '';
    });

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

    $('#' + ID + '-cargar').on('click', cargar);
    $('#' + ID + '-enviar').on('click', abrirSiguiente);
    $('#' + ID + '-volver').on('click', function () {
        $('#' + ID + '-paso2').hide();
        $('#' + ID + '-paso1').show();
        $('#' + ID + '-progreso').text('');
    });

    // ENTER = abrir el siguiente mensaje (ignora la tecla mantenida y el ENTER dentro del cuadro de texto)
    $(document).on('keydown.' + ID, function (e) {
        if (e.key !== 'Enter' || e.repeat) return;
        if (!$('#' + ID + '-paso2').is(':visible')) return;
        if ($(e.target).is('textarea')) return;
        e.preventDefault();
        abrirSiguiente();
    });

    $('#' + ID + '-cerrar').on('click', function () {
        $(document).off('keydown.' + ID);
        $('#' + ID).remove();
    });
})();
