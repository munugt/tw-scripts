/*
 * Nombre:    MP masivo
 * Autor:     munugt
 * Versión:   1.0
 * Juego:     Guerras Tribales
 *
 * Descripción:
 *   Abre un panel con un cuadro de texto donde se pega una lista de mensajes
 *   en BBCode. Cada mensaje empieza con el nombre del destinatario en una
 *   línea [u]Jugador[/u]; todo lo que hay debajo (hasta el siguiente
 *   [u]...[/u]) es el cuerpo del mensaje.
 *   Al pulsar "Cargar" aparece la lista de mensajes y cada pulsación de
 *   ENTER (o del botón "Enviar") envía UN solo mensaje privado, el siguiente
 *   de la lista. 1 pulsación = 1 mensaje.
 *
 *   El asunto se toma del primer [color=...]...[/color] del mensaje
 *   (p. ej. "🛡️ BLINDAJE") y se puede cambiar en el panel.
 */
(function () {
    'use strict';

    var ID = 'tw-mp';
    var mensajes = [];      // [{ jugador, asunto, texto, estado }]
    var enviando = false;
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
        var enviados = mensajes.filter(function (x) { return x.estado === 'ok'; }).length;
        var html = '<table class="vis" style="width:100%;">' +
            '<tr><th>#</th><th>Jugador</th><th>Estado</th></tr>';
        mensajes.forEach(function (x, i) {
            var color = x.estado === 'ok' ? '#2a7a2a' : x.estado === 'error' ? '#b00' : '#000';
            var marca = x.estado === 'ok' ? '✔' : x.estado === 'error' ? '✖ ' + escapar(x.error || '') : '…';
            html += '<tr' + (i === siguiente() ? ' style="background:#fff3c4;"' : '') + '>' +
                '<td>' + (i + 1) + '</td><td>' + escapar(x.jugador) + '</td>' +
                '<td style="color:' + color + ';">' + marca + '</td></tr>';
        });
        html += '</table>';
        $('#' + ID + '-lista').html(html);
        $('#' + ID + '-progreso').text(enviados + ' / ' + mensajes.length + ' enviados');
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

    // Envía UN mensaje: abre el formulario de "nuevo mensaje" del juego y lo envía con los datos
    function enviarSiguiente() {
        var i = siguiente();
        if (enviando || i < 0) return;
        var msg = mensajes[i];
        msg.asunto = $('#' + ID + '-asunto').val().trim() || msg.asunto || 'Mensaje';
        enviando = true;
        $('#' + ID + '-progreso').text('Enviando a ' + msg.jugador + '...');

        $.get(game_data.link_base_pure + 'mail&mode=new').then(function (html) {
            var $form = $('<div>').append($.parseHTML(html)).find('form').filter(function () {
                return $(this).find('textarea[name="text"]').length > 0;
            }).first();
            if (!$form.length) return $.Deferred().reject('No se encontró el formulario de mensajes');
            var datos = {};
            $form.serializeArray().forEach(function (c) { datos[c.name] = c.value; });
            datos.to = msg.jugador;
            datos.subject = msg.asunto;
            datos.text = msg.texto;
            // Los botones no entran en serializeArray: añadir el de "Enviar" (no el de vista previa)
            var $boton = $form.find('input[type="submit"][name], button[type="submit"][name], button[name]:not([type])')
                .filter(function () { return !/preview|vista/i.test(this.name + ' ' + $(this).val()); }).first();
            if ($boton.length) datos[$boton.attr('name')] = $boton.val() || '1';
            console.log('[MP masivo] POST', $form.attr('action'), datos);
            return $.post($form.attr('action'), datos);
        }).then(function (resp) {
            var $r = $('<div>').append($.parseHTML(resp || ''));
            var err = $r.find('.error_box').text().trim();
            if (err) {
                msg.estado = 'error';
                msg.error = err;
            } else if ($r.find('textarea[name="text"]').length) {
                // Si vuelve el formulario de redactar, el mensaje no se ha enviado
                msg.estado = 'error';
                msg.error = 'El juego no lo ha enviado';
            } else {
                msg.estado = 'ok';
            }
        }, function (e) {
            msg.estado = 'error';
            msg.error = typeof e === 'string' ? e : 'Error de conexión';
        }).always(function () {
            enviando = false;
            pintarLista();
            if (siguiente() < 0) $('#' + ID + '-progreso').append(' — ¡Terminado!');
        });
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
        '<button id="' + ID + '-enviar" class="btn">Enviar siguiente (ENTER)</button> ' +
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
    $('#' + ID + '-enviar').on('click', enviarSiguiente);
    $('#' + ID + '-volver').on('click', function () {
        $('#' + ID + '-paso2').hide();
        $('#' + ID + '-paso1').show();
        $('#' + ID + '-progreso').text('');
    });

    // ENTER = enviar un mensaje (ignora la tecla mantenida y el ENTER dentro del cuadro de texto)
    $(document).on('keydown.' + ID, function (e) {
        if (e.key !== 'Enter' || e.repeat) return;
        if (!$('#' + ID + '-paso2').is(':visible')) return;
        if ($(e.target).is('textarea')) return;
        e.preventDefault();
        enviarSiguiente();
    });

    $('#' + ID + '-cerrar').on('click', function () {
        $(document).off('keydown.' + ID);
        $('#' + ID).remove();
    });
})();
