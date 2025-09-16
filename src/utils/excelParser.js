import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * Excel file parser utility
 */
class ExcelParser {
  constructor() {
    this.heavyMetals = process.env.HEAVY_METALS?.split(',') || 
      ['Fe', 'As', 'U', 'Pb', 'Hg', 'Cd', 'Cr', 'Ni', 'Zn', 'Cu', 'Mn'];
  }

  /**
   * Parse Excel file and extract data
   * @param {string} filePath - Path to Excel file
   * @returns {Object} Parsed data with headers and rows
   */
  async parseFile(filePath) {
    try {
      // Read the file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, // Return array of arrays
        defval: null // Use null for empty cells
      });

      if (jsonData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1);

      // Clean headers (remove extra spaces, handle special characters)
      const cleanedHeaders = headers.map(header => 
        typeof header === 'string' ? header.trim() : String(header || '').trim()
      );

      return {
        headers: cleanedHeaders,
        rows: rows,
        totalRows: rows.length,
        metadata: {
          sheetName,
          originalFileName: path.basename(filePath)
        }
      };

    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Detect heavy metal columns in headers
   * @param {Array} headers - Array of header strings
   * @returns {Object} Mapping of detected heavy metals to column indices
   */
  detectHeavyMetalColumns(headers) {
    const metalColumns = {};
    const detectedMetals = [];

    headers.forEach((header, index) => {
      if (!header || typeof header !== 'string') return;

      const cleanHeader = header.trim().toUpperCase();
      
      // Check for exact matches first
      for (const metal of this.heavyMetals) {
        const metalUpper = metal.toUpperCase();
        
        // Exact match
        if (cleanHeader === metalUpper) {
          metalColumns[metal] = {
            index,
            originalHeader: header,
            unit: this.extractUnit(header)
          };
          detectedMetals.push(metal);
          break;
        }
        
        // Pattern matching for metals with units
        const patterns = [
          new RegExp(`^${metalUpper}\\s*\\(.*\\)$`), // Fe (ppm)
          new RegExp(`^${metalUpper}\\s*-.*$`), // Fe-ppm
          new RegExp(`^${metalUpper}\\s+.*$`), // Fe ppm
          new RegExp(`.*${metalUpper}.*\\(.*\\).*`) // any Fe (ppm) any
        ];

        for (const pattern of patterns) {
          if (pattern.test(cleanHeader)) {
            metalColumns[metal] = {
              index,
              originalHeader: header,
              unit: this.extractUnit(header)
            };
            detectedMetals.push(metal);
            break;
          }
        }
      }
    });

    return {
      metalColumns,
      detectedMetals,
      totalDetected: detectedMetals.length
    };
  }

  /**
   * Extract unit from header string
   * @param {string} header - Header string
   * @returns {string} Extracted unit or default 'ppm'
   */
  extractUnit(header) {
    if (!header || typeof header !== 'string') return 'ppm';

    const unitPatterns = [
      /\(([^)]+)\)/g, // Units in parentheses
      /\s+(ppm|ppb|mg\/L|μg\/L|ug\/L)\s*/gi // Common units
    ];

    for (const pattern of unitPatterns) {
      const matches = header.match(pattern);
      if (matches) {
        const unit = matches[0].replace(/[()]/g, '').trim().toLowerCase();
        
        // Normalize units
        switch (unit) {
          case 'ug/l':
            return 'μg/L';
          case 'mg/l':
            return 'mg/L';
          case 'ppm':
            return 'ppm';
          case 'ppb':
            return 'ppb';
          default:
            return unit;
        }
      }
    }

    return 'ppm'; // Default unit
  }

  /**
   * Extract location information from row
   * @param {Array} row - Data row
   * @param {Array} headers - Header array
   * @returns {Object} Location information
   */
  extractLocationInfo(row, headers) {
    const location = {};
    
    // Common location column patterns
    const locationPatterns = {
      name: ['location', 'place', 'site', 'area', 'locality'],
      state: ['state', 'province', 'region'],
      district: ['district', 'county', 'zone'],
      latitude: ['latitude', 'lat', 'y', 'coord_y'],
      longitude: ['longitude', 'lon', 'lng', 'x', 'coord_x'],
      year: ['year', 'sampling_year', 'collection_year'],
      serialNumber: ['s.no', 'sno', 'serial', 'id', 'sample_id']
    };

    // Find matching columns
    for (const [key, patterns] of Object.entries(locationPatterns)) {
      const columnIndex = headers.findIndex(header => {
        if (!header || typeof header !== 'string') return false;
        const cleanHeader = header.toLowerCase().trim();
        return patterns.some(pattern => 
          cleanHeader.includes(pattern) || 
          cleanHeader === pattern ||
          cleanHeader.replace(/[^a-z0-9]/g, '').includes(pattern.replace(/[^a-z0-9]/g, ''))
        );
      });

      if (columnIndex !== -1 && row[columnIndex] !== null && row[columnIndex] !== undefined) {
        const value = row[columnIndex];
        
        if (key === 'latitude' || key === 'longitude') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            location[key] = numValue;
          }
        } else if (key === 'year') {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 1900 && numValue <= new Date().getFullYear() + 1) {
            location[key] = numValue;
          }
        } else {
          location[key] = String(value).trim();
        }
      }
    }

    return location;
  }

  /**
   * Extract heavy metal values from row
   * @param {Array} row - Data row
   * @param {Object} metalColumns - Metal column mapping
   * @returns {Object} Heavy metal values
   */
  extractHeavyMetalValues(row, metalColumns) {
    const metalValues = {};

    for (const [metal, columnInfo] of Object.entries(metalColumns)) {
      const value = row[columnInfo.index];
      
      if (value !== null && value !== undefined && value !== '') {
        const numericValue = parseFloat(value);
        
        if (!isNaN(numericValue) && numericValue >= 0) {
          metalValues[metal] = {
            value: numericValue,
            unit: columnInfo.unit || 'ppm'
          };
        }
      }
    }

    return metalValues;
  }

  /**
   * Extract other environmental parameters
   * @param {Array} row - Data row
   * @param {Array} headers - Header array
   * @param {Object} metalColumns - Metal column mapping (to exclude)
   * @returns {Object} Environmental parameters
   */
  extractEnvironmentalParams(row, headers, metalColumns) {
    const params = {};
    const metalIndices = new Set(Object.values(metalColumns).map(col => col.index));
    const locationPatterns = ['location', 'place', 'site', 'state', 'district', 'latitude', 'longitude', 'year', 's.no', 'sno', 'serial'];

    headers.forEach((header, index) => {
      if (!header || typeof header !== 'string') return;
      
      const cleanHeader = header.toLowerCase().trim();
      
      // Skip if it's a metal column or location column
      if (metalIndices.has(index)) return;
      if (locationPatterns.some(pattern => cleanHeader.includes(pattern))) return;

      const value = row[index];
      if (value !== null && value !== undefined && value !== '') {
        // Try to convert to number if possible
        const numericValue = parseFloat(value);
        params[header.trim()] = !isNaN(numericValue) ? numericValue : String(value).trim();
      }
    });

    return params;
  }

  /**
   * Process entire Excel file and return structured data
   * @param {string} filePath - Path to Excel file
   * @returns {Object} Processed data
   */
  async processFile(filePath) {
    try {
      // Parse the file
      const { headers, rows, metadata } = await this.parseFile(filePath);

      // Detect heavy metal columns
      const { metalColumns, detectedMetals } = this.detectHeavyMetalColumns(headers);

      // Process each row
      const processedData = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // +2 because of 0-indexing and header row

        try {
          // Extract location information
          const locationInfo = this.extractLocationInfo(row, headers);

          // Skip row if essential data is missing
          if (!locationInfo.name || (!locationInfo.latitude && !locationInfo.longitude)) {
            errors.push({
              row: rowNumber,
              error: 'Missing essential location data (name or coordinates)'
            });
            continue;
          }

          // Extract heavy metal values
          const metalValues = this.extractHeavyMetalValues(row, metalColumns);

          // Extract other environmental parameters
          const environmentalParams = this.extractEnvironmentalParams(row, headers, metalColumns);

          // Create processed record
          const record = {
            location: {
              name: locationInfo.name,
              state: locationInfo.state || '',
              district: locationInfo.district || ''
            },
            coordinates: {
              type: "Point",
              coordinates: [
                parseFloat(locationInfo.longitude) || 0,  // longitude first in GeoJSON
                parseFloat(locationInfo.latitude) || 0    // latitude second in GeoJSON
              ]
            },
            sampleInfo: {
              year: locationInfo.year || new Date().getFullYear(),
              serialNumber: locationInfo.serialNumber || `ROW_${rowNumber}`
            },
            heavyMetals: metalValues,
            environmentalParams,
            originalData: Object.fromEntries(
              headers.map((header, index) => [header, row[index]])
            ),
            rowNumber
          };

          processedData.push(record);

        } catch (error) {
          errors.push({
            row: rowNumber,
            error: error.message
          });
        }
      }

      // Generate file hash for deduplication
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        success: true,
        data: processedData,
        metadata: {
          ...metadata,
          fileHash,
          totalRows: rows.length,
          processedRows: processedData.length,
          errorRows: errors.length,
          detectedMetals,
          metalColumns: Object.keys(metalColumns)
        },
        errors
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
        metadata: {},
        errors: []
      };
    }
  }

  /**
   * Validate processed data
   * @param {Object} record - Processed record
   * @returns {Object} Validation result
   */
  validateRecord(record) {
    const errors = [];

    // Validate coordinates (GeoJSON format)
    if (record.coordinates && record.coordinates.coordinates) {
      const [longitude, latitude] = record.coordinates.coordinates;
      
      if (latitude !== undefined && latitude !== null) {
        if (latitude < -90 || latitude > 90) {
          errors.push('Invalid latitude value');
        }
      }

      if (longitude !== undefined && longitude !== null) {
        if (longitude < -180 || longitude > 180) {
          errors.push('Invalid longitude value');
        }
      }
    }

    // Validate heavy metal values
    for (const [metal, data] of Object.entries(record.heavyMetals)) {
      if (data.value < 0) {
        errors.push(`Negative value for ${metal}`);
      }
      if (data.value > 10000) { // Reasonable upper limit
        errors.push(`Unusually high value for ${metal}: ${data.value}`);
      }
    }

    // Validate year
    if (record.sampleInfo.year) {
      const currentYear = new Date().getFullYear();
      if (record.sampleInfo.year < 1900 || record.sampleInfo.year > currentYear + 1) {
        errors.push('Invalid sample year');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default ExcelParser;