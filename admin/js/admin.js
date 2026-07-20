/**
 * Panel admin — búsqueda y exportación CSV.
 */

const searchInput = document.getElementById('search-input');
const table = document.getElementById('registrations-table');
const filterCount = document.getElementById('filter-count');
const exportBtn = document.getElementById('btn-export');

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
