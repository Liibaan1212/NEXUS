const MISSING_MARKERS = new Set(['na', 'n/a', 'null', 'none', 'nil', '?', '-', '--', 'unknown', 'not available', 'n.a.']);
const DELIMITERS = [',', '\t', ';', '|'];

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let rowStart = 1;
  const malformedRows = [];
  let emptyLineCount = 0;
  const finishRow = (line) => {
    row.push(cell);
    cell = '';
    if (row.some((value) => value.trim() !== '')) rows.push({ values: row, line });
    else emptyLineCount += 1;
    row = [];
    rowStart = line;
  };
  for (let index = 0, line = 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\n' && quoted) line += 1;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      finishRow(rowStart);
      line += 1;
      rowStart = line;
    } else cell += character;
  }
  if (quoted) malformedRows.push(rowStart);
  if (cell !== '' || row.length) finishRow(rowStart);
  return { rows, malformedRows, emptyLineCount };
}

function detectDelimiter(text) {
  return DELIMITERS.map((delimiter) => {
    const counts = parseCsv(text.split(/\r?\n/).slice(0, 12).join('\n'), delimiter).rows.map((row) => row.values.length);
    const width = counts[0] || 0;
    return { delimiter, score: width > 1 ? counts.filter((count) => count === width).length * 100 + width : 0 };
  }).sort((a, b) => b.score - a.score)[0].delimiter;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeHeader(value, index) {
  const normalized = String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || `column_${index + 1}`;
}

function normalizeValue(value) {
  const trimmed = String(value ?? '').trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || MISSING_MARKERS.has(lower) || /^\?+$/.test(trimmed) || /^-+$/.test(trimmed)) return '';
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

function typeOf(value) {
  if (!value) return 'empty';
  if (/^(true|false)$/.test(value)) return 'boolean';
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return 'number';
  if (/^-?\$?\d[\d,]*(?:\.\d+)?%?$/.test(value)) return 'formatted-number';
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)) return 'date';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  return 'text';
}

function normalizeByColumn(value, detectedType) {
  if (!value) return '';
  if (detectedType === 'number' || detectedType === 'formatted-number') {
    const compact = value.replace(/^\$/, '').replace(/,/g, '').replace(/%$/, '');
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(compact)) return compact;
  }
  return value;
}

function median(values) {
  const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return '';
  const middle = Math.floor(numbers.length / 2);
  const value = numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
  return String(value);
}

function valueCounts(values, missingCount = 0) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const result = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
  if (missingCount) result.push({ value: '[missing]', count: missingCount });
  return result;
}

function categoryKey(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function editDistance(left, right) {
  const distances = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = distances[0];
    distances[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = distances[column];
      distances[column] = left[row - 1] === right[column - 1]
        ? diagonal
        : Math.min(diagonal + 1, above + 1, distances[column - 1] + 1);
      diagonal = above;
    }
  }
  return distances[right.length];
}

export function inspectCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('The CSV file is empty.');
  const source = csvText.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const parsed = parseCsv(source, delimiter);
  if (parsed.rows.length < 1) throw new Error('No CSV rows were found.');

  const rawHeaders = parsed.rows[0].values;
  const headers = [];
  const headerCounts = new Map();
  const issues = [];
  rawHeaders.forEach((rawHeader, index) => {
    const base = normalizeHeader(rawHeader, index);
    const count = (headerCounts.get(base) || 0) + 1;
    headerCounts.set(base, count);
    const header = count > 1 ? `${base}_${count}` : base;
    headers.push(header);
    if (!String(rawHeader).trim()) issues.push({ severity: 'error', code: 'empty-header', message: `Column ${index + 1} has no header; generated "${header}".` });
    if (String(rawHeader) !== header) issues.push({ severity: 'fix', code: 'normalized-header', column: header, message: `Header "${rawHeader}" normalized to "${header}".` });
    if (count > 1) issues.push({ severity: 'error', code: 'duplicate-header', column: header, message: `Duplicate header renamed to "${header}".` });
  });

  const expected = rawHeaders.length;
  const sourceRows = parsed.rows.slice(1);
  const safeRows = [];
  const rejectedRows = [];
  const columnValues = headers.map(() => []);
  let emptyRows = parsed.emptyLineCount;
  sourceRows.forEach(({ values: rawRow, line }) => {
    if (rawRow.every((value) => !value.trim())) return;
    if (rawRow.length !== expected) {
      rejectedRows.push({ line, values: rawRow });
      issues.push({ severity: 'error', code: 'column-count', row: line, message: `Row ${line} has ${rawRow.length} fields; expected ${expected}. It was excluded from the cleaned export.` });
      return;
    }
    const row = rawRow.map(normalizeValue);
    row.forEach((value, index) => { if (value) columnValues[index].push(value); });
    safeRows.push({ line, values: row });
  });

  const columnTypes = columnValues.map((values) => {
    const counts = new Map();
    values.forEach((value) => counts.set(typeOf(value), (counts.get(typeOf(value)) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'empty';
  });
  const columnStats = headers.map((name, index) => ({ name, detectedType: columnTypes[index], missing: 0, imputed: 0, fillValue: '', valueCounts: [] }));
  const normalizedRows = safeRows.map(({ line, values }) => ({
    line,
    values: values.map((value, index) => {
      const normalized = normalizeByColumn(value, columnTypes[index]);
      if (!normalized) columnStats[index].missing += 1;
      if (value !== normalized) issues.push({ severity: 'fix', code: 'normalized-number', row: line, column: headers[index], message: `Numeric formatting normalized in ${headers[index]} on row ${line}.` });
      if (value && !normalized) issues.push({ severity: 'fix', code: 'missing-marker', row: line, column: headers[index], message: 'Missing marker normalized to an empty value.' });
      return normalized;
    }),
  }));

  columnStats.forEach((stat, index) => {
    if (!['text', 'email'].includes(stat.detectedType)) return;
    const variants = new Map();
    normalizedRows.forEach(({ values }) => {
      const value = values[index];
      if (!value) return;
      const key = categoryKey(value);
      const group = variants.get(key) || new Map();
      group.set(value, (group.get(value) || 0) + 1);
      variants.set(key, group);
    });
    variants.forEach((group, key) => {
      if (group.size < 2) return;
      const canonical = [...group.entries()].sort((left, right) => right[1] - left[1])[0][0];
      normalizedRows.forEach(({ line, values }) => {
        if (values[index] && categoryKey(values[index]) === key && values[index] !== canonical) {
          const original = values[index];
          values[index] = canonical;
          issues.push({ severity: 'fix', code: 'inconsistent-category', row: line, column: stat.name, message: `Inconsistent value "${original}" normalized to "${canonical}" in ${stat.name}.` });
        }
      });
    });
  });

  columnStats.forEach((stat, index) => {
    if (stat.detectedType !== 'text') return;
    const values = [...new Set(normalizedRows.map((row) => row.values[index]).filter(Boolean))];
    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const left = categoryKey(values[leftIndex]);
        const right = categoryKey(values[rightIndex]);
        const distance = editDistance(left, right);
        if (left.length >= 5 && right.length >= 5 && distance <= 2 && left !== right) {
          issues.push({ severity: 'warning', code: 'possible-category-typo', column: stat.name, message: `Possible inconsistent values in ${stat.name}: "${values[leftIndex]}" and "${values[rightIndex]}" differ by ${distance} character${distance === 1 ? '' : 's'}. Review before merging.` });
        }
      }
    }
  });

  columnStats.forEach((stat, index) => {
    const values = normalizedRows.map((row) => row.values[index]).filter(Boolean);
    const numeric = stat.detectedType === 'number' || stat.detectedType === 'formatted-number';
    stat.valueCounts = valueCounts(values, stat.missing).slice(0, 30);
    stat.fillValue = numeric ? median(values.map((value) => normalizeByColumn(value, stat.detectedType))) : (stat.valueCounts[0]?.value || '');
  });
  normalizedRows.forEach(({ line, values }) => {
    values.forEach((value, index) => {
      const stat = columnStats[index];
      if (value || !stat.fillValue) return;
      values[index] = stat.fillValue;
      stat.imputed += 1;
      issues.push({ severity: 'fix', code: 'imputed-value', row: line, column: stat.name, message: `Missing ${stat.name} filled with ${stat.detectedType === 'number' || stat.detectedType === 'formatted-number' ? `dataset median ${stat.fillValue}` : `dataset mode "${stat.fillValue}"`}.` });
    });
  });

  const seen = new Set();
  let duplicateRows = 0;
  const uniqueRows = normalizedRows.filter(({ values }) => {
    const key = JSON.stringify(values);
    if (seen.has(key)) { duplicateRows += 1; return false; }
    seen.add(key); return true;
  });
  if (emptyRows) issues.push({ severity: 'fix', code: 'empty-rows', message: `${emptyRows} empty row(s) removed.` });
  if (duplicateRows) issues.push({ severity: 'fix', code: 'duplicate-rows', message: `${duplicateRows} exact duplicate row(s) removed.` });
  if (parsed.malformedRows.length) issues.push({ severity: 'error', code: 'unclosed-quote', message: `Unclosed quoted field near row ${parsed.malformedRows[0]}; review the source file.` });
  columnStats.forEach((stat, index) => {
    if (stat.missing && !stat.imputed) issues.push({ severity: 'warning', code: 'missing-values', column: stat.name, message: `${stat.name} has ${stat.missing} missing value(s) and no safe fill value could be inferred.` });
    const types = new Set(columnValues[index].map(typeOf));
    if (types.size > 1) issues.push({ severity: 'warning', code: 'mixed-types', column: stat.name, message: `${stat.name} contains mixed detected types: ${[...types].join(', ')}.` });
  });

  const cleanedRows = uniqueRows.map(({ values }) => values);
  return {
    delimiter: delimiter === '\t' ? 'tab' : delimiter,
    headers,
    rows: cleanedRows.slice(0, 20),
    rowCount: cleanedRows.length,
    originalRowCount: sourceRows.length,
    rejectedRowCount: rejectedRows.length,
    emptyRowCount: emptyRows,
    columnCount: headers.length,
    duplicateRows,
    issues,
    columns: columnStats,
    cleanedCsv: [headers, ...cleanedRows].map((row) => row.map(csvEscape).join(delimiter)).join('\n'),
    recipe: [
      `Detected ${delimiter === '\t' ? 'tab' : `"${delimiter}"`} delimiter using consistent field counts and parsed quoted fields.`,
      'Inferred each column type and fill strategy from this uploaded dataset; no domain-specific column names or fixed schema were used.',
      'Removed a UTF-8 BOM when present.',
      'Normalized headers to unique lowercase snake_case names.',
      'Trimmed cell whitespace, normalized missing markers, and standardized booleans.',
      'Normalized safely recognized currency, thousands separators, and percent formatting to numeric text.',
      'Computed value_counts() for every column; filled numeric missing values with the observed median and categorical missing values with the observed mode.',
      `Removed ${emptyRows} empty row(s) and ${duplicateRows} exact duplicate row(s).`,
      `Excluded ${rejectedRows.length} structurally unsafe row(s) instead of exporting shifted data.`,
      'Preserved non-empty values and recorded every imputed cell.',
    ],
  };
}