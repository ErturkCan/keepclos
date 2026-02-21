import { Contact } from '@keepclos/shared';

/**
 * CSV importer for contacts with configurable column mapping
 */

export interface CSVImportConfig {
  nameColumn?: number | string; // Column index or header name (required)
  emailColumn?: number | string;
  phoneColumn?: number | string;
  tagsColumn?: number | string;
  notesColumn?: number | string;
  hasHeader: boolean; // Whether first row is header (default: true)
  delimiter: string; // CSV delimiter (default: ',')
  tagSeparator: string; // Separator for multi-value tags (default: ';')
}

export interface CSVImportResult {
  contacts: Contact[];
  errors: CSVImportError[];
  rowsProcessed: number;
  successCount: number;
}

export interface CSVImportError {
  rowIndex: number;
  message: string;
}

const DEFAULT_CONFIG: CSVImportConfig = {
  hasHeader: true,
  delimiter: ',',
  tagSeparator: ';',
};

/**
 * Parse CSV content and import contacts
 * @param csvContent CSV file content as string
 * @param config Import configuration
 * @returns Import results with contacts and errors
 */
export function importFromCSV(csvContent: string, config: Partial<CSVImportConfig> = {}): CSVImportResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.nameColumn) {
    throw new Error('nameColumn configuration is required');
  }

  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const contacts: Contact[] = [];
  const errors: CSVImportError[] = [];
  let headerMap: Map<string, number> | null = null;
  let startRow = 0;

  // Parse header if present
  if (finalConfig.hasHeader && lines.length > 0) {
    headerMap = parseCSVHeader(lines[0], finalConfig.delimiter);
    startRow = 1;
  }

  // Process data rows
  for (let i = startRow; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i], finalConfig.delimiter);

      const contact = parseContactFromRow(row, i + 1, headerMap, finalConfig);
      if (contact) {
        contacts.push(contact);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        rowIndex: i + 1,
        message,
      });
    }
  }

  return {
    contacts,
    errors,
    rowsProcessed: lines.length - startRow,
    successCount: contacts.length,
  };
}

/**
 * Parse CSV header to create column mapping
 * @param headerLine First line of CSV
 * @param delimiter CSV delimiter
 * @returns Map of column name to index
 */
function parseCSVHeader(headerLine: string, delimiter: string): Map<string, number> {
  const headers = parseCSVLine(headerLine, delimiter);
  const map = new Map<string, number>();

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();
    map.set(normalized, index);
  });

  return map;
}

/**
 * Parse a single CSV line
 * @param line Line to parse
 * @param delimiter CSV delimiter
 * @returns Array of field values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      // Handle quoted fields
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      // Field delimiter
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parse a contact from a CSV row
 * @param row CSV row fields
 * @param rowIndex Row number (for error reporting)
 * @param headerMap Header mapping (if headers present)
 * @param config Import configuration
 * @returns Contact or null if invalid
 */
function parseContactFromRow(
  row: string[],
  rowIndex: number,
  headerMap: Map<string, number> | null,
  config: CSVImportConfig,
): Contact | null {
  // Get column indices
  const nameIndex = getColumnIndex(config.nameColumn, headerMap);
  const emailIndex = config.emailColumn ? getColumnIndex(config.emailColumn, headerMap) : -1;
  const phoneIndex = config.phoneColumn ? getColumnIndex(config.phoneColumn, headerMap) : -1;
  const tagsIndex = config.tagsColumn ? getColumnIndex(config.tagsColumn, headerMap) : -1;
  const notesIndex = config.notesColumn ? getColumnIndex(config.notesColumn, headerMap) : -1;

  // Extract name (required)
  if (nameIndex < 0 || nameIndex >= row.length) {
    throw new Error(`Row ${rowIndex}: Name column index ${nameIndex} out of range`);
  }

  const name = row[nameIndex];
  if (!name) {
    throw new Error(`Row ${rowIndex}: Name is required`);
  }

  // Extract optional fields
  const email = emailIndex >= 0 && emailIndex < row.length ? row[emailIndex] : undefined;
  const phone = phoneIndex >= 0 && phoneIndex < row.length ? row[phoneIndex] : undefined;

  // Parse tags
  let tags: string[] = [];
  if (tagsIndex >= 0 && tagsIndex < row.length) {
    const tagsStr = row[tagsIndex];
    if (tagsStr) {
      tags = tagsStr
        .split(config.tagSeparator)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }
  }

  // Extract notes
  const notes = notesIndex >= 0 && notesIndex < row.length ? row[notesIndex] : '';

  const contact: Contact = {
    id: generateId(),
    name: name.trim(),
    email: email?.trim(),
    phone: phone?.trim(),
    tags: ['imported-csv', ...tags],
    notes: notes?.trim() || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return contact;
}

/**
 * Get column index from config (handles both numeric and string references)
 * @param columnRef Column reference (number or string)
 * @param headerMap Header mapping (if string reference)
 * @returns Column index or -1 if not found
 */
function getColumnIndex(
  columnRef: number | string | undefined,
  headerMap: Map<string, number> | null,
): number {
  if (columnRef === undefined) {
    return -1;
  }

  if (typeof columnRef === 'number') {
    return columnRef;
  }

  // String reference - use header map
  if (headerMap) {
    const normalized = columnRef.toLowerCase().trim();
    return headerMap.get(normalized) ?? -1;
  }

  return -1;
}

/**
 * Validate import configuration
 * @param config Configuration to validate
 */
export function validateImportConfig(config: Partial<CSVImportConfig>): string[] {
  const errors: string[] = [];

  if (!config.nameColumn) {
    errors.push('nameColumn is required');
  }

  if (config.tagSeparator && config.tagSeparator.length === 0) {
    errors.push('tagSeparator must not be empty');
  }

  return errors;
}

/**
 * Generate a unique ID for contacts
 */
function generateId(): string {
  return `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse CSV with automatic header detection
 * @param csvContent CSV content
 * @param config Partial configuration
 * @returns Import result with auto-detected columns
 */
export function importFromCSVAutoDetect(
  csvContent: string,
  config: Partial<CSVImportConfig> = {},
): CSVImportResult {
  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      contacts: [],
      errors: [{ rowIndex: 0, message: 'Empty CSV content' }],
      rowsProcessed: 0,
      successCount: 0,
    };
  }

  // Try to detect headers in first line
  const headerMap = parseCSVHeader(lines[0], config.delimiter ?? ',');

  // Auto-detect columns
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.nameColumn) {
    // Try common name column headers
    for (const nameAlias of ['name', 'fullname', 'full name', 'contact name']) {
      if (headerMap.has(nameAlias)) {
        finalConfig.nameColumn = nameAlias;
        break;
      }
    }
  }

  if (!finalConfig.emailColumn && headerMap.has('email')) {
    finalConfig.emailColumn = 'email';
  }

  if (!finalConfig.phoneColumn && headerMap.has('phone')) {
    finalConfig.phoneColumn = 'phone';
  }

  if (!finalConfig.tagsColumn && headerMap.has('tags')) {
    finalConfig.tagsColumn = 'tags';
  }

  return importFromCSV(csvContent, finalConfig);
}
