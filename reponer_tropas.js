(function(){
    const STORAGE_KEY = 'TW_REPOSITION_DATA';
    const UNITS = ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

    const urlParams = new URLSearchParams(window.location.search);
    const screen = urlParams.get('screen');
    const mode = urlParams.get('mode');

    // ==========================================
    // EJECUCIÓN EN APOYO MASIVO (MODE = CALL)
    // ==========================================
    if (mode === 'call' || screen === 'place') {
        const rawData = sessionStorage.getItem(STORAGE_KEY);
        if (!rawData) {
            UI.ErrorMessage('No hay datos de pérdidas guardados. Primero ejecuta el script sobre un informe de batalla.', 3000);
            return;
        }

        const data = JSON.parse(rawData);

        // Validar que los datos no tengan más de 10 minutos
        if (Date.now() - data.timestamp > 10 * 60 * 1000) {
            sessionStorage.removeItem(STORAGE_KEY);
            UI.ErrorMessage('Los datos guardados han caducado. Vuelve a ejecutar el script en el informe.', 3000);
            return;
        }

        let filledCount = 0;

        Object.keys(data.villages).forEach(villageId => {
            const losses = data.villages[villageId];

            // 1. Marcar checkbox de la aldea
            const checkbox = document.querySelector(`.troop-request-selector[data-village-id="${villageId}"]`);
            if (checkbox && !checkbox.checked) {
                checkbox.click();
            }

            // 2. Rellenar inputs de cada unidad
            Object.keys(losses).forEach(unit => {
                const amount = losses[unit];
                const input = document.querySelector(`input[name="call[${villageId}][${unit}]"]`);

                if (input) {
                    input.disabled = false;
                    input.value = amount;

                    // Disparar eventos para actualizar la interfaz del juego
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));

                    filledCount++;
                }
            });
        });

        if (filledCount > 0) {
            UI.SuccessMessage(`✅ Se han rellenado las pérdidas para ${Object.keys(data.villages).length} pueblo(s) de origen.`, 4000);
            sessionStorage.removeItem(STORAGE_KEY); // Limpiar tras completar
        } else {
            UI.ErrorMessage('No se encontraron las aldeas de origen en esta lista de Apoyo Masivo.', 3000);
        }
        return;
    }

    // ==========================================
    // EJECUCIÓN EN EL INFORME DE BATALLA (SCREEN = REPORT)
    // ==========================================
    if (screen === 'report') {
        // 1. Detectar ID del pueblo Destino
        let targetVillageId = null;
        const defenderLink = document.querySelector('a[href*="village="][href*="screen=info_village"]');
        if (defenderLink) {
            const match = defenderLink.href.match(/id=(\d+)/);
            if (match) targetVillageId = match[1];
        }

        if (!targetVillageId) {
            const allVillageLinks = document.querySelectorAll('a[href*="screen=info_village"]');
            for (let link of allVillageLinks) {
                const match = link.href.match(/id=(\d+)/);
                if (match) {
                    targetVillageId = match[1];
                    break;
                }
            }
        }

        if (!targetVillageId) {
            UI.ErrorMessage('No se pudo identificar el pueblo destino en este informe.', 3000);
            return;
        }

        // 2. Analizar tablas de origen y pérdidas
        const villagesData = {};
        let hasLosses = false;

        const tables = document.querySelectorAll('table.vis');
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            let originId = null;
            let lossRow = null;

            // Identificar ID de origen
            const originLink = table.querySelector('a[href*="screen=info_village"]');
            if (originLink) {
                const match = originLink.href.match(/id=(\d+)/);
                if (match) originId = match[1];
            }

            // Identificar fila de Pérdidas
            rows.forEach(row => {
                const firstTd = row.querySelector('td, th');
                if (firstTd && firstTd.innerText.toLowerCase().includes('pérdidas')) {
                    lossRow = row;
                }
            });

            if (originId && lossRow) {
                const lossCells = lossRow.querySelectorAll('td.unit-item, td[data-unit-count]');
                const villageLosses = {};

                lossCells.forEach((cell, index) => {
                    let unitType = null;
                    cell.classList.forEach(cls => {
                        if (cls.startsWith('unit-item-')) {
                            unitType = cls.replace('unit-item-', '');
                        }
                    });

                    if (!unitType) {
                        unitType = UNITS[index];
                    }

                    const count = parseInt(cell.getAttribute('data-unit-count') || cell.innerText.trim(), 10) || 0;

                    if (count > 0 && unitType) {
                        villageLosses[unitType] = count;
                        hasLosses = true;
                    }
                });

                if (Object.keys(villageLosses).length > 0) {
                    villagesData[originId] = villageLosses;
                }
            }
        });

        if (!hasLosses) {
            UI.InfoMessage('No se detectaron pérdidas de tropas en este informe.', 3000);
            return;
        }

        // 3. Guardar en memoria
        const payload = {
            target: targetVillageId,
            villages: villagesData,
            timestamp: Date.now()
        };

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        // 4. Redirigir a Apoyo Masivo
        UI.SuccessMessage('Pérdidas guardadas. Redirigiendo a Apoyo Masivo...', 2000);
        setTimeout(() => {
            const currentUrl = new URL(window.location.href);
            const baseUrl = `${currentUrl.origin}${currentUrl.pathname}?village=${currentUrl.searchParams.get('village') || ''}`;
            window.location.href = `${baseUrl}&screen=place&mode=call&target=${targetVillageId}`;
        }, 800);

        return;
    }

    UI.ErrorMessage('Este script debe ejecutarse dentro de un Informe o en la pantalla de Apoyo Masivo.', 3000);
})();