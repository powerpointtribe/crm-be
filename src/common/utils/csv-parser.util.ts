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
      headers = this.parseCSVLine(lines[0], delimiter);
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();

      if (skipEmptyLines && line.length === 0) {
        continue;
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
    if (csvRow['Phone'] || csvRow['phone']) {
      mappedData.phone = csvRow['Phone'] || csvRow['phone'];
    }
    if (csvRow['Email'] || csvRow['email']) {
      mappedData.email = csvRow['Email'] || csvRow['email'];
    }
    if (csvRow['Date of Visit'] || csvRow['dateOfVisit']) {
      const dateValue = csvRow['Date of Visit'] || csvRow['dateOfVisit'];
      mappedData.dateOfVisit = dateValue;
    }

    // Handle optional fields
    if (csvRow['Invited By'] || csvRow['invitedBy']) {
      mappedData.invitedBy = csvRow['Invited By'] || csvRow['invitedBy'];
    }
    if (csvRow['How Did You Hear'] || csvRow['howDidYouHear']) {
      mappedData.howDidYouHear =
        csvRow['How Did You Hear'] || csvRow['howDidYouHear'];
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

    // Handle address
    const address: any = {};
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

    if (csvRow['Notes'] || csvRow['notes']) {
      mappedData.notes = csvRow['Notes'] || csvRow['notes'];
    }

    return mappedData;
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
