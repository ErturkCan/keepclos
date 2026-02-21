import { Contact } from '@keepclos/shared';

/**
 * vCard 3.0/4.0 parser
 * Parses standard vCard format to extract contact information
 */

export interface VCardParseResult {
  success: boolean;
  contact?: Contact;
  errors: string[];
}

/**
 * Parse a single vCard string
 * @param vcard vCard content (entire card or FN:Name format)
 * @returns Parsed contact or error
 */
export function parseVCard(vcard: string): VCardParseResult {
  const errors: string[] = [];

  try {
    // Split into lines and normalize
    const lines = vcard
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return {
        success: false,
        errors: ['Empty vCard'],
      };
    }

    // Check for BEGIN:VCARD
    const hasBegin = lines.some((line) => line.toUpperCase() === 'BEGIN:VCARD');
    if (!hasBegin && lines.length > 1) {
      errors.push('Missing BEGIN:VCARD marker (partial format detected)');
    }

    // Extract fields
    const fields = new Map<string, string[]>();

    for (const line of lines) {
      if (line.toUpperCase() === 'BEGIN:VCARD' || line.toUpperCase() === 'END:VCARD') {
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = line.substring(0, colonIndex).toUpperCase();
      const value = line.substring(colonIndex + 1);

      // Handle multi-value fields
      if (!fields.has(key)) {
        fields.set(key, []);
      }
      fields.get(key)!.push(value);
    }

    // Extract name (FN or N)
    let name = '';
    if (fields.has('FN')) {
      name = fields.get('FN')![0];
    } else if (fields.has('N')) {
      const nameParts = fields.get('N')![0].split(';');
      // Format: LASTNAME;FIRSTNAME;MIDDLENAME;PREFIX;SUFFIX
      const lastName = nameParts[0];
      const firstName = nameParts[1];
      name = [firstName, lastName].filter((p) => p).join(' ');
    }

    if (!name) {
      errors.push('No name found (FN or N field required)');
      return {
        success: false,
        errors,
      };
    }

    // Extract email
    let email: string | undefined;
    if (fields.has('EMAIL')) {
      const emailValue = fields.get('EMAIL')![0];
      email = extractEmailValue(emailValue);
    }

    // Extract phone
    let phone: string | undefined;
    if (fields.has('TEL')) {
      const telValue = fields.get('TEL')![0];
      phone = extractPhoneValue(telValue);
    }

    // Extract birthday
    let birthdayNote = '';
    if (fields.has('BDAY')) {
      const bday = fields.get('BDAY')![0];
      birthdayNote = `Birthday: ${formatBirthday(bday)}`;
    }

    // Extract organization
    let orgNote = '';
    if (fields.has('ORG')) {
      const org = fields.get('ORG')![0].split(';')[0];
      orgNote = `Organization: ${org}`;
    }

    // Combine notes
    const notes = [birthdayNote, orgNote].filter((n) => n).join('\n');

    const contact: Contact = {
      id: generateId(),
      name: name.trim(),
      email,
      phone,
      tags: ['imported-vcard'],
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      success: true,
      contact,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [message],
    };
  }
}

/**
 * Parse multiple vCards from a string
 * @param content Multi-vCard content
 * @returns Array of parse results
 */
export function parseVCardBatch(content: string): VCardParseResult[] {
  // Split by BEGIN:VCARD ... END:VCARD blocks
  const vcardPattern = /BEGIN:VCARD[\s\S]*?END:VCARD/gi;
  const matches = content.match(vcardPattern) || [];

  return matches.map((vcard) => parseVCard(vcard));
}

/**
 * Extract email from EMAIL field value
 * Handles TYPE parameter: EMAIL;TYPE=INTERNET:user@example.com
 * @param fieldValue EMAIL field value
 * @returns Email address or undefined
 */
function extractEmailValue(fieldValue: string): string | undefined {
  // Handle format: TYPE=INTERNET:user@example.com or just user@example.com
  const parts = fieldValue.split(':');
  const email = parts.length > 1 ? parts[1] : parts[0];

  if (isValidEmail(email)) {
    return email;
  }

  return undefined;
}

/**
 * Extract phone from TEL field value
 * Handles TYPE parameter: TEL;TYPE=CELL:+1234567890
 * @param fieldValue TEL field value
 * @returns Phone number or undefined
 */
function extractPhoneValue(fieldValue: string): string | undefined {
  // Handle format: TYPE=CELL:+1234567890 or just +1234567890
  const parts = fieldValue.split(':');
  const phone = parts.length > 1 ? parts[1] : parts[0];

  if (phone && phone.length > 5) {
    // Basic validation: at least 5 characters
    return phone;
  }

  return undefined;
}

/**
 * Format birthday to readable string
 * Handles both YYYY-MM-DD and MMDD formats
 * @param bday Birthday value from BDAY field
 * @returns Formatted birthday
 */
function formatBirthday(bday: string): string {
  // Remove hyphens: 1980-06-15 -> 19800615
  const cleaned = bday.replace(/-/g, '');

  if (cleaned.length === 8) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${month}/${day}/${year}`;
  } else if (cleaned.length === 4) {
    // MMDD format (anniversary without year)
    const month = cleaned.substring(0, 2);
    const day = cleaned.substring(2, 4);
    return `${month}/${day}`;
  }

  return bday;
}

/**
 * Basic email validation
 * @param email Email to validate
 * @returns true if email looks valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a unique ID for contacts
 */
function generateId(): string {
  return `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
