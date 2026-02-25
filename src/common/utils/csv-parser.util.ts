import { BadRequestException } from '@nestjs/common';

export interface CSVParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  headerRow?: boolean;
}

export class CSVParserUtil {
  static parseCSV(csvContent: string, options: CSVParseOptions = {}): any[] {
    const {
      delimiter = ',',
      skipEmptyLines = true,
      headerRow = true,
    } = options;

    if (!csvContent || csvContent.trim().length === 0) {
      throw new BadRequestException('CSV content is empty');
    }

    const lines = csvContent.split('\n');
    const result: any[] = [];
    let headers: string[] = [];

    let startIndex = 0;
    if (headerRow && lines.length > 0) {
      // Find the first non-empty line for headers (skip lines with only delimiters)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0) {
          continue;
        }
        // Check if line only contains delimiters (commas) with no actual data
        const onlyDelimiters = line.split(delimiter).every(field => field.trim().length === 0);
        if (onlyDelimiters) {
          continue;
        }
        // Found a valid header line
        headers = this.parseCSVLine(line, delimiter);
        startIndex = i + 1;
        break;
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines or lines that only contain delimiters
      if (skipEmptyLines) {
        if (line.length === 0) {
          continue;
        }
        // Check if line only contains delimiters (commas) with no actual data
        const onlyDelimiters = line.split(delimiter).every(field => field.trim().length === 0);
        if (onlyDelimiters) {
          continue;
        }
      }

      try {
        const values = this.parseCSVLine(line, delimiter);

        if (headerRow && headers.length > 0) {
          const row: any = {};
          headers.forEach((header, index) => {
            const value = values[index] || '';
            row[header.trim()] = value.trim();
          });
          result.push(row);
        } else {
          result.push(values);
        }
      } catch (error) {
        throw new BadRequestException(
          `Error parsing CSV line ${i + 1}: ${error.message}`,
        );
      }
    }

    return result;
  }

  private static parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current);

    return result;
  }

  static mapCSVToFirstTimer(csvRow: any): any {
    // Map CSV headers to CreateFirstTimerDto properties
    const mappedData: any = {};

    // Handle core fields
    if (csvRow['First Name'] || csvRow['firstName']) {
      mappedData.firstName = csvRow['First Name'] || csvRow['firstName'];
    }
    if (csvRow['Last Name'] || csvRow['lastName']) {
      mappedData.lastName = csvRow['Last Name'] || csvRow['lastName'];
    }
    // Phone - support multiple header variations
    if (csvRow['Phone'] || csvRow['phone'] || csvRow['Phone Number']) {
      mappedData.phone = csvRow['Phone'] || csvRow['phone'] || csvRow['Phone Number'];
    }
    // Email - support multiple header variations
    if (csvRow['Email'] || csvRow['email'] || csvRow['Email Address']) {
      mappedData.email = csvRow['Email'] || csvRow['email'] || csvRow['Email Address'];
    }
    // Date of Visit / Entry Date
    if (csvRow['Date of Visit'] || csvRow['dateOfVisit'] || csvRow['Entry Date']) {
      const dateValue = csvRow['Date of Visit'] || csvRow['dateOfVisit'] || csvRow['Entry Date'];
      mappedData.dateOfVisit = dateValue;
    }

    // Handle optional fields
    // Invited By - support multiple variations
    if (csvRow['Invited By'] || csvRow['invitedBy'] || csvRow['Can you remember who invited you?']) {
      mappedData.invitedBy = csvRow['Invited By'] || csvRow['invitedBy'] || csvRow['Can you remember who invited you?'];
    }
    // How Did You Hear - support multiple variations
    if (csvRow['How Did You Hear'] || csvRow['howDidYouHear'] || csvRow['How did you hear about Us?']) {
      const howHeard = csvRow['How Did You Hear'] || csvRow['howDidYouHear'] || csvRow['How did you hear about Us?'];
      mappedData.howDidYouHear = this.mapHowDidYouHear(howHeard);
    }
    if (csvRow['Previous Church'] || csvRow['previousChurch']) {
      mappedData.previousChurch =
        csvRow['Previous Church'] || csvRow['previousChurch'];
    }
    if (csvRow['Visitor Type'] || csvRow['visitorType']) {
      mappedData.visitorType = csvRow['Visitor Type'] || csvRow['visitorType'];
    }
    if (csvRow['Marital Status'] || csvRow['maritalStatus']) {
      mappedData.maritalStatus =
        csvRow['Marital Status'] || csvRow['maritalStatus'];
    }
    if (csvRow['Number of Children'] || csvRow['numberOfChildren']) {
      const children =
        csvRow['Number of Children'] || csvRow['numberOfChildren'];
      if (children && !isNaN(parseInt(children))) {
        mappedData.numberOfChildren = parseInt(children);
      }
    }

    // Gender - support multiple variations
    if (csvRow['Gender'] || csvRow['gender']) {
      const gender = (csvRow['Gender'] || csvRow['gender'] || '').toLowerCase().trim();
      if (gender === 'male' || gender === 'm') {
        mappedData.gender = 'male';
      } else if (gender === 'female' || gender === 'f') {
        mappedData.gender = 'female';
      }
    }

    // Birthday / Date of Birth
    if (csvRow['Birthday'] || csvRow['Date of Birth'] || csvRow['dateOfBirth']) {
      mappedData.dateOfBirth = csvRow['Birthday'] || csvRow['Date of Birth'] || csvRow['dateOfBirth'];
    }

    // Occupation
    if (csvRow['Occupation'] || csvRow['occupation']) {
      mappedData.occupation = csvRow['Occupation'] || csvRow['occupation'];
    }

    // Alternate phone
    if (csvRow['Phone Number (2)'] || csvRow['alternateContactMethod']) {
      mappedData.alternateContactMethod = csvRow['Phone Number (2)'] || csvRow['alternateContactMethod'];
    }

    // Social Media Handle
    if (csvRow['Social Media handle'] || csvRow['socialMediaHandle']) {
      mappedData.socialMediaHandles = {
        other: csvRow['Social Media handle'] || csvRow['socialMediaHandle'],
      };
    }

    // Service Experience - What did you enjoy about today's service?
    if (csvRow['What did you enjoy about today\'s service?'] || csvRow['serviceExperience']) {
      mappedData.serviceExperience = csvRow['What did you enjoy about today\'s service?'] || csvRow['serviceExperience'];
    }

    // Interested in Joining - Would you like to join The PowerPoint Tribe?
    if (csvRow['Would you like to join The PowerPoint Tribe?'] || csvRow['interestedInJoining']) {
      const interested = (csvRow['Would you like to join The PowerPoint Tribe?'] || csvRow['interestedInJoining'] || '').toLowerCase().trim();
      if (interested === 'yes' || interested === 'y') {
        mappedData.interestedInJoining = 'yes';
      } else if (interested === 'no' || interested === 'n') {
        mappedData.interestedInJoining = 'no';
      } else if (interested === 'maybe' || interested === 'undecided') {
        mappedData.interestedInJoining = 'maybe';
      }
    }

    // Handle address - support "Home Address" as full address
    const address: any = {};
    if (csvRow['Home Address']) {
      address.street = csvRow['Home Address'];
    }
    if (csvRow['Street'] || csvRow['street']) {
      address.street = csvRow['Street'] || csvRow['street'];
    }
    if (csvRow['City'] || csvRow['city']) {
      address.city = csvRow['City'] || csvRow['city'];
    }
    if (csvRow['State'] || csvRow['state']) {
      address.state = csvRow['State'] || csvRow['state'];
    }
    if (csvRow['Country'] || csvRow['country']) {
      address.country = csvRow['Country'] || csvRow['country'];
    }
    if (Object.keys(address).length > 0) {
      mappedData.address = address;
    }

    // Handle arrays (comma-separated values)
    if (csvRow['Interests'] || csvRow['interests']) {
      const interests = csvRow['Interests'] || csvRow['interests'];
      if (interests) {
        mappedData.interests = interests
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0);
      }
    }
    if (csvRow['Prayer Requests'] || csvRow['prayerRequests']) {
      const requests = csvRow['Prayer Requests'] || csvRow['prayerRequests'];
      if (requests) {
        mappedData.prayerRequests = requests
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0);
      }
    }
    if (csvRow['Serving Interests'] || csvRow['servingInterests']) {
      const serving = csvRow['Serving Interests'] || csvRow['servingInterests'];
      if (serving) {
        mappedData.servingInterests = serving
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0);
      }
    }

    // Extract service attendance (for follow-up records)
    if (csvRow['Attended 2nd Service?']) {
      mappedData.attended2ndService = csvRow['Attended 2nd Service?'];
    }
    if (csvRow['Attended 3rd Service?']) {
      mappedData.attended3rdService = csvRow['Attended 3rd Service?'];
    }

    // Extract age range (for birthday inference)
    if (csvRow['How long have you been on this planet?']) {
      mappedData.ageRange = csvRow['How long have you been on this planet?'];
    }

    // Extract follow-up allocation
    if (csvRow['Follow Up Allocation']) {
      mappedData.followUpAllocation = csvRow['Follow Up Allocation'];
    }

    // Extract membership status and integration stage
    if (csvRow['Membership Database']) {
      mappedData.membershipDatabase = csvRow['Membership Database'];
    }
    if (csvRow['Integration Stage']) {
      mappedData.integrationStage = csvRow['Integration Stage'];
    }
    if (csvRow['Member Status'] || csvRow['memberStatus'] || csvRow['Membership Status']) {
      mappedData.memberStatus = csvRow['Member Status'] || csvRow['memberStatus'] || csvRow['Membership Status'];
    }

    // Extract call reports (for follow-up records creation)
    const callReports: any[] = [];
    if (csvRow['1st Call Report']) {
      callReports.push({
        type: '1st',
        content: csvRow['1st Call Report'],
        notes: csvRow['Call Report - Notes'] || '',
      });
    }
    if (csvRow['2nd Call Report']) {
      callReports.push({
        type: '2nd',
        content: csvRow['2nd Call Report'],
        notes: csvRow['Call Report - Notes 2'] || '',
      });
    }
    if (csvRow['3rd Call Report']) {
      callReports.push({
        type: '3rd',
        content: csvRow['3rd Call Report'],
      });
    }
    if (csvRow['4th Call Report']) {
      callReports.push({
        type: '4th',
        content: csvRow['4th Call Report'],
      });
    }
    if (csvRow['PCU Conversation Status']) {
      callReports.push({
        type: 'PCU',
        content: csvRow['PCU Conversation Status'],
      });
    }
    if (callReports.length > 0) {
      mappedData.callReports = callReports;
    }

    // Build notes from remaining fields
    const noteParts: string[] = [];
    if (csvRow['Notes'] || csvRow['notes']) {
      noteParts.push(csvRow['Notes'] || csvRow['notes']);
    }
    if (noteParts.length > 0) {
      mappedData.notes = noteParts.join('\n');
    }

    return mappedData;
  }

  /**
   * Map free-text "how did you hear" responses to valid enum values
   */
  private static mapHowDidYouHear(value: string): string {
    if (!value) return 'other';

    const lowerValue = value.toLowerCase().trim();

    // Direct matches
    const directMappings: Record<string, string> = {
      'friend': 'friend',
      'family': 'family',
      'facebook': 'facebook',
      'instagram': 'instagram',
      'twitter': 'twitter',
      'whatsapp': 'whatsapp',
      'youtube': 'youtube',
      'google': 'google_search',
      'google search': 'google_search',
      'website': 'website',
      'church website': 'church_website',
      'online': 'online',
      'social media': 'social_media',
      'radio': 'radio',
      'tv': 'television',
      'television': 'television',
      'podcast': 'podcast',
      'flyer': 'flyer',
      'banner': 'banner',
      'billboard': 'billboard',
      'invitation card': 'invitation_card',
      'outreach': 'outreach',
      'crusade': 'crusade',
      'conference': 'conference',
      'event': 'event',
      'advertisement': 'advertisement',
      'walkby': 'walkby',
      'walk by': 'walkby',
      'walked by': 'walkby',
    };

    // Check for direct match
    if (directMappings[lowerValue]) {
      return directMappings[lowerValue];
    }

    // Check for partial matches
    if (lowerValue.includes('friend')) return 'friend';
    if (lowerValue.includes('family') || lowerValue.includes('relative')) return 'family';
    if (lowerValue.includes('facebook')) return 'facebook';
    if (lowerValue.includes('instagram')) return 'instagram';
    if (lowerValue.includes('twitter') || lowerValue.includes('x.com')) return 'twitter';
    if (lowerValue.includes('whatsapp')) return 'whatsapp';
    if (lowerValue.includes('youtube')) return 'youtube';
    if (lowerValue.includes('google')) return 'google_search';
    if (lowerValue.includes('online') || lowerValue.includes('internet')) return 'online';
    if (lowerValue.includes('social media')) return 'social_media';
    if (lowerValue.includes('radio')) return 'radio';
    if (lowerValue.includes('tv') || lowerValue.includes('television')) return 'television';
    if (lowerValue.includes('flyer') || lowerValue.includes('handbill')) return 'flyer';
    if (lowerValue.includes('invite') || lowerValue.includes('invitation')) return 'invitation_card';
    if (lowerValue.includes('outreach') || lowerValue.includes('evangelism')) return 'outreach';
    if (lowerValue.includes('crusade')) return 'crusade';
    if (lowerValue.includes('conference')) return 'conference';
    if (lowerValue.includes('walk')) return 'walkby';

    return 'other';
  }

  static validateFileType(filename: string): boolean {
    const allowedExtensions = ['.csv', '.txt'];
    const extension = filename
      .toLowerCase()
      .substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(extension);
  }

  static generateSampleCSV(): string {
    const headers = [
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Date of Visit',
      'Invited By',
      'How Did You Hear',
      'Previous Church',
      'Visitor Type',
      'Marital Status',
      'Number of Children',
      'Street',
      'City',
      'State',
      'Country',
      'Interests',
      'Prayer Requests',
      'Serving Interests',
      'Notes',
    ];

    const sampleRow = [
      'John',
      'Doe',
      '+234801234567',
      'john.doe@email.com',
      '2024-01-15',
      'Jane Smith',
      'friend',
      'Previous Church Name',
      'first_time',
      'married',
      '2',
      '123 Main Street',
      'Lagos',
      'Lagos State',
      'Nigeria',
      'worship,youth ministry',
      'healing,financial breakthrough',
      'usher,media',
      'First time visitor, very friendly',
    ];

    return headers.join(',') + '\n' + sampleRow.join(',');
  }
}
