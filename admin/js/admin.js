/**
 * Panel admin — búsqueda, exportación CSV y vaciado de pruebas.
 */

const searchInput = document.getElementById('search-input');
const table = document.getElementById('registrations-table');
const filterCount = document.getElementById('filter-count');
const exportBtn = document.getElementById('btn-export');
const exportAllBtn = document.getElementById('btn-export-all');
const purgeBtn = document.getElementById('btn-purge');

if (searchInput && table) {
  const rows = [...table.querySelectorAll('tbody tr')];

  const updateFilter = () => {
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach((row) => {
      const haystack = row.dataset.search ?? '';
      const match = query === '' || haystack.includes(query);
      row.classList.toggle('hidden', !match);
      if (match) visible += 1;
    });

    if (filterCount) {
      if (query === '') {
        filterCount.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
      } else {
        filterCount.textContent = `${visible} de ${rows.length} registro${rows.length === 1 ? '' : 's'}`;
      }
    }
  };

  searchInput.addEventListener('input', updateFilter);
  updateFilter();
}

if (exportBtn && table) {
  exportBtn.addEventListener('click', () => {
    const visibleRows = [...table.querySelectorAll('tbody tr')].filter(
      (row) => !row.classList.contains('hidden'),
    );

    const headers = ['Fecha', 'Nombre', 'Apellido', 'Localidad', 'Email', 'Estado', 'Archivo', 'Tamaño'];
    const lines = [headers.join(',')];

    visibleRows.forEach((row) => {
      const cells = [...row.querySelectorAll('td')].slice(0, 8);
      const values = cells.map((cell) => {
        const text = cell.textContent?.trim() ?? '';
        return `"${text.replace(/"/g, '""')}"`;
      });
      lines.push(values.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `registros-babysec-selfie-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

if (exportAllBtn instanceof HTMLAnchorElement) {
  exportAllBtn.addEventListener('click', () => {
    // Feedback breve: el navegador maneja la descarga del ZIP.
    const original = exportAllBtn.textContent;
    exportAllBtn.textContent = 'Preparando ZIP...';
    window.setTimeout(() => {
      exportAllBtn.textContent = original ?? 'Exportar todo';
    }, 2500);
  });
}

if (purgeBtn instanceof HTMLButtonElement) {
  purgeBtn.addEventListener('click', async () => {
    const key = window.prompt(
      'Vas a borrar TODOS los registros y videos.\nEscribí la clave de confirmación:',
    );

    if (key === null) {
      return;
    }

    const confirmed = window.confirm(
      '¿Confirmás vaciar la base de datos y eliminar los archivos de video?',
    );
    if (!confirmed) {
      return;
    }

    purgeBtn.disabled = true;
    const originalLabel = purgeBtn.textContent;
    purgeBtn.textContent = 'Vaciando...';

    try {
      const body = new FormData();
      body.append('key', key.trim());

      const response = await fetch('purge.php', {
        method: 'POST',
        body,
        credentials: 'same-origin',
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Respuesta inválida del servidor.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'No se pudo vaciar.');
      }

      const rows = data.deletedRows ?? 0;
      const files = data.deletedFiles ?? 0;
      window.alert(`Listo. Registros borrados: ${rows}. Archivos borrados: ${files}.`);
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo vaciar.');
      purgeBtn.disabled = false;
      purgeBtn.textContent = originalLabel ?? 'Vaciar';
    }
  });
}
