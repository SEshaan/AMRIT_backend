import XLSX from 'xlsx';
import path from 'path';

/**
 * Generate sample Excel file with pollution data
 */
function generateSampleExcelFile(outputPath = './sample_pollution_data.xlsx') {
  // Sample data structure
  const sampleData = [
    // Header row
    [
      'S. No.',
      'State',
      'District', 
      'Location',
      'Longitude',
      'Latitude',
      'Year',
      'pH',
      'EC (µS/cm at 25°C)',
      'CO3 (mg/L)',
      'HCO3 (mg/L)',
      'Cl (mg/L)',
      'F (mg/L)',
      'SO4 (mg/L)',
      'NO3 (mg/L)',
      'PO4 (mg/L)',
      'Total Hardness (mg/L)',
      'Ca (mg/L)',
      'Mg (mg/L)',
      'Na (mg/L)',
      'K (mg/L)',
      'Fe (ppm)',
      'As (ppb)',
      'U (ppb)',
      'Pb (ppb)',
      'Hg (ppb)',
      'Cd (ppb)',
      'Cr (ppb)',
      'Ni (ppb)',
      'Zn (ppm)',
      'Cu (ppm)',
      'Mn (ppm)'
    ],
    // Sample data rows
    [
      1,
      'Punjab',
      'Gurdaspur',
      'Shahpur Goraya',
      75.0943,
      32.0266,
      2023,
      7.2,
      850,
      0,
      280,
      45,
      0.8,
      120,
      25,
      2.1,
      320,
      85,
      28,
      55,
      8.5,
      2.24,
      23.20,
      3.22,
      8.5,
      0.8,
      2.1,
      35.6,
      45.2,
      0.85,
      1.2,
      0.35
    ],
    [
      2,
      'Andhra Pradesh',
      'Tirupathi',
      'Tallampadu',
      79.9503,
      13.7281,
      2023,
      6.8,
      1200,
      0,
      365,
      78,
      1.2,
      185,
      45,
      3.8,
      485,
      125,
      42,
      95,
      12.5,
      '',
      '',
      '',
      15.2,
      1.5,
      4.2,
      58.9,
      68.5,
      1.25,
      2.1,
      0.58
    ],
    [
      3,
      'Maharashtra',
      'Pune',
      'Katraj',
      73.8567,
      18.4529,
      2023,
      7.5,
      950,
      12,
      295,
      52,
      0.6,
      145,
      32,
      1.8,
      375,
      95,
      35,
      68,
      9.8,
      1.85,
      15.60,
      2.45,
      6.8,
      0.5,
      1.8,
      28.5,
      38.9,
      0.65,
      0.95,
      0.28
    ],
    [
      4,
      'Gujarat',
      'Ahmedabad',
      'Naroda',
      72.6369,
      23.0225,
      2023,
      8.1,
      1450,
      24,
      420,
      125,
      2.1,
      245,
      65,
      5.2,
      625,
      165,
      58,
      145,
      18.5,
      4.25,
      45.80,
      8.95,
      25.6,
      3.2,
      6.8,
      125.5,
      145.8,
      2.85,
      4.2,
      1.25
    ],
    [
      5,
      'Tamil Nadu',
      'Chennai',
      'Adyar',
      80.2707,
      13.0827,
      2023,
      7.8,
      1100,
      6,
      338,
      85,
      1.4,
      195,
      48,
      2.9,
      465,
      118,
      45,
      85,
      14.2,
      3.15,
      32.50,
      5.85,
      18.5,
      2.1,
      4.5,
      85.6,
      92.5,
      1.95,
      2.8,
      0.85
    ],
    [
      6,
      'Rajasthan',
      'Jaipur',
      'Sanganer',
      75.7873,
      26.9124,
      2023,
      7.9,
      1350,
      18,
      395,
      98,
      1.8,
      225,
      58,
      4.1,
      585,
      148,
      52,
      125,
      16.8,
      2.95,
      38.90,
      6.25,
      22.8,
      2.8,
      5.2,
      98.5,
      112.6,
      2.45,
      3.5,
      0.95
    ],
    [
      7,
      'West Bengal',
      'Kolkata',
      'Salt Lake',
      88.3639,
      22.5726,
      2023,
      6.9,
      1050,
      3,
      315,
      65,
      1.1,
      168,
      38,
      2.5,
      425,
      108,
      38,
      75,
      11.5,
      5.85,
      78.50,
      12.45,
      35.6,
      4.5,
      8.9,
      185.5,
      225.8,
      3.95,
      6.2,
      1.85
    ],
    [
      8,
      'Karnataka',
      'Bangalore',
      'Electronic City',
      77.5946,
      12.9716,
      2023,
      7.4,
      890,
      8,
      268,
      48,
      0.9,
      125,
      28,
      1.9,
      345,
      88,
      32,
      58,
      8.9,
      1.65,
      12.80,
      1.95,
      5.8,
      0.4,
      1.5,
      22.5,
      28.9,
      0.55,
      0.85,
      0.22
    ]
  ];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);

  // Set column widths
  const columnWidths = [
    { wch: 8 },  // S. No.
    { wch: 15 }, // State
    { wch: 15 }, // District
    { wch: 20 }, // Location
    { wch: 12 }, // Longitude
    { wch: 12 }, // Latitude
    { wch: 8 },  // Year
    { wch: 8 },  // pH
    { wch: 18 }, // EC
    { wch: 12 }, // CO3
    { wch: 12 }, // HCO3
    { wch: 12 }, // Cl
    { wch: 12 }, // F
    { wch: 12 }, // SO4
    { wch: 12 }, // NO3
    { wch: 12 }, // PO4
    { wch: 18 }, // Total Hardness
    { wch: 12 }, // Ca
    { wch: 12 }, // Mg
    { wch: 12 }, // Na
    { wch: 12 }, // K
    { wch: 12 }, // Fe
    { wch: 12 }, // As
    { wch: 12 }, // U
    { wch: 12 }, // Pb
    { wch: 12 }, // Hg
    { wch: 12 }, // Cd
    { wch: 12 }, // Cr
    { wch: 12 }, // Ni
    { wch: 12 }, // Zn
    { wch: 12 }, // Cu
    { wch: 12 }  // Mn
  ];

  worksheet['!cols'] = columnWidths;

  // Add the worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pollution Data');

  // Write the file
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`Sample Excel file generated: ${outputPath}`);
  return outputPath;
}

// Generate the sample file if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const outputDir = process.argv[2] || './';
  const outputPath = path.join(outputDir, 'sample_pollution_data.xlsx');
  generateSampleExcelFile(outputPath);
}

export default generateSampleExcelFile;