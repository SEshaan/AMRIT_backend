import { HeavyMetalStandard, FormulaConfig } from '../models/index.js';

/**
 * Initial configuration data for the HMPI system
 */

// Default heavy metal standards (WHO/EPA guidelines)
export const defaultHeavyMetalStandards = [
  {
    metal: 'FE',
    standardValue: 0.3,
    unit: 'ppm',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Iron - Secondary standard for taste and appearance'
  },
  {
    metal: 'AS',
    standardValue: 10,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Arsenic - Provisional guideline value'
  },
  {
    metal: 'U',
    standardValue: 15,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Uranium - Provisional guideline value'
  },
  {
    metal: 'PB',
    standardValue: 10,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Lead - Guideline value'
  },
  {
    metal: 'HG',
    standardValue: 6,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Mercury (inorganic) - Guideline value'
  },
  {
    metal: 'CD',
    standardValue: 3,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Cadmium - Guideline value'
  },
  {
    metal: 'CR',
    standardValue: 50,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Chromium (total) - Guideline value'
  },
  {
    metal: 'NI',
    standardValue: 70,
    unit: 'ppb',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Nickel - Guideline value'
  },
  {
    metal: 'ZN',
    standardValue: 3,
    unit: 'ppm',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Zinc - Secondary standard for taste'
  },
  {
    metal: 'CU',
    standardValue: 2,
    unit: 'ppm',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Copper - Guideline value'
  },
  {
    metal: 'MN',
    standardValue: 0.4,
    unit: 'ppm',
    source: 'WHO Guidelines for drinking-water quality, 4th edition',
    category: 'WHO',
    description: 'Manganese - Secondary standard for taste and appearance'
  }
];

// BIS (Bureau of Indian Standards) heavy metal standards
export const bisHeavyMetalStandards = [
  {
    metal: 'FE',
    standardValue: 0.3,
    unit: 'ppm',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Iron - Acceptable limit for drinking water'
  },
  {
    metal: 'AS',
    standardValue: 10,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Arsenic - Acceptable limit'
  },
  {
    metal: 'PB',
    standardValue: 10,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Lead - Acceptable limit'
  },
  {
    metal: 'HG',
    standardValue: 1,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Mercury - Acceptable limit'
  },
  {
    metal: 'CD',
    standardValue: 3,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Cadmium - Acceptable limit'
  },
  {
    metal: 'CR',
    standardValue: 50,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Chromium - Acceptable limit'
  },
  {
    metal: 'NI',
    standardValue: 20,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Nickel - Acceptable limit'
  },
  {
    metal: 'ZN',
    standardValue: 5,
    unit: 'ppm',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Zinc - Acceptable limit'
  },
  {
    metal: 'CU',
    standardValue: 0.05,
    unit: 'ppm',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Copper - Acceptable limit'
  },
  {
    metal: 'MN',
    standardValue: 0.1,
    unit: 'ppm',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Manganese - Acceptable limit'
  },
  {
    metal: 'U',
    standardValue: 30,
    unit: 'ppb',
    source: 'BIS 10500:2012 - Drinking Water Specifications',
    category: 'BIS',
    description: 'Uranium - Acceptable limit'
  }
];

// Default formula configurations
export const defaultFormulaConfigs = [
  {
    name: 'HMPI_Standard',
    type: 'HMPI',
    formula: 'sqrt(sum(CFi^2) / n)',
    description: 'Heavy Metal Pollution Index - Standard formula using contamination factors',
    variables: [
      {
        name: 'CFi',
        description: 'Contamination Factor for metal i (Ci/Si)',
        unit: 'dimensionless'
      },
      {
        name: 'Ci',
        description: 'Concentration of metal i in sample',
        unit: 'varies'
      },
      {
        name: 'Si',
        description: 'Standard/permissible value for metal i',
        unit: 'varies'
      },
      {
        name: 'n',
        description: 'Number of heavy metals considered',
        unit: 'count'
      }
    ],
    thresholds: {
      safe: { min: 0, max: 30 },
      mid: { min: 30, max: 100 },
      unsafe: { min: 100, max: Infinity }
    },
    version: '1.0.0'
  },
  {
    name: 'Contamination_Factor',
    type: 'contamination_factor',
    formula: 'Ci / Si',
    description: 'Contamination Factor - ratio of measured concentration to standard value',
    variables: [
      {
        name: 'Ci',
        description: 'Measured concentration of metal i',
        unit: 'varies'
      },
      {
        name: 'Si',
        description: 'Standard permissible value for metal i',
        unit: 'varies'
      }
    ],
    thresholds: {
      safe: { min: 0, max: 1 },
      mid: { min: 1, max: 3 },
      unsafe: { min: 3, max: Infinity }
    },
    version: '1.0.0'
  },
  {
    name: 'Degree_of_Contamination',
    type: 'pollution_index',
    formula: 'sum(CFi)',
    description: 'Degree of Contamination - sum of all contamination factors',
    variables: [
      {
        name: 'CFi',
        description: 'Contamination Factor for metal i',
        unit: 'dimensionless'
      }
    ],
    thresholds: {
      safe: { min: 0, max: 8 },
      mid: { min: 8, max: 24 },
      unsafe: { min: 24, max: Infinity }
    },
    version: '1.0.0'
  }
];

/**
 * Initialize heavy metal standards in database
 */
export async function initializeHeavyMetalStandards() {
  try {
    console.log('Initializing heavy metal standards...');
    
    // Initialize WHO standards
    for (const standard of defaultHeavyMetalStandards) {
      const existing = await HeavyMetalStandard.findOne({ 
        metal: standard.metal, 
        category: standard.category 
      });
      
      if (!existing) {
        await HeavyMetalStandard.create(standard);
        console.log(`Created WHO standard for ${standard.metal}`);
      } else {
        console.log(`WHO standard for ${standard.metal} already exists`);
      }
    }
    
    // Initialize BIS standards
    for (const standard of bisHeavyMetalStandards) {
      const existing = await HeavyMetalStandard.findOne({ 
        metal: standard.metal, 
        category: standard.category 
      });
      
      if (!existing) {
        await HeavyMetalStandard.create(standard);
        console.log(`Created BIS standard for ${standard.metal}`);
      } else {
        console.log(`BIS standard for ${standard.metal} already exists`);
      }
    }
    
    console.log('Heavy metal standards initialization completed');
    return { success: true, message: 'Heavy metal standards initialized' };
    
  } catch (error) {
    console.error('Error initializing heavy metal standards:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize formula configurations in database
 */
export async function initializeFormulaConfigs() {
  try {
    console.log('Initializing formula configurations...');
    
    for (const formula of defaultFormulaConfigs) {
      const existing = await FormulaConfig.findOne({ name: formula.name });
      
      if (!existing) {
        await FormulaConfig.create(formula);
        console.log(`Created formula config: ${formula.name}`);
      } else {
        console.log(`Formula config ${formula.name} already exists`);
      }
    }
    
    console.log('Formula configurations initialization completed');
    return { success: true, message: 'Formula configurations initialized' };
    
  } catch (error) {
    console.error('Error initializing formula configurations:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize all configuration data
 */
export async function initializeAllConfigurations() {
  try {
    console.log('Starting configuration initialization...');
    
    const standardsResult = await initializeHeavyMetalStandards();
    const formulasResult = await initializeFormulaConfigs();
    
    if (standardsResult.success && formulasResult.success) {
      console.log('All configurations initialized successfully');
      return { 
        success: true, 
        message: 'All configurations initialized successfully',
        details: {
          standards: standardsResult.message,
          formulas: formulasResult.message
        }
      };
    } else {
      throw new Error('Some configurations failed to initialize');
    }
    
  } catch (error) {
    console.error('Error initializing configurations:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update heavy metal standard
 */
export async function updateHeavyMetalStandard(metal, newValue, updatedBy) {
  try {
    const standard = await HeavyMetalStandard.findOne({ metal: metal.toUpperCase() });
    
    if (!standard) {
      throw new Error(`Standard for metal ${metal} not found`);
    }
    
    await standard.updateStandard(newValue, updatedBy);
    
    return { 
      success: true, 
      message: `Standard for ${metal} updated to ${newValue}`,
      standard 
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current configuration summary
 */
export async function getConfigurationSummary() {
  try {
    const standardsCount = await HeavyMetalStandard.countDocuments({ isActive: true });
    const formulasCount = await FormulaConfig.countDocuments({ isActive: true });
    
    const standards = await HeavyMetalStandard.find({ isActive: true })
      .select('metal standardValue unit category')
      .sort({ metal: 1 });
    
    const formulas = await FormulaConfig.find({ isActive: true })
      .select('name type description version')
      .sort({ type: 1, name: 1 });
    
    return {
      success: true,
      summary: {
        standardsCount,
        formulasCount,
        lastUpdated: new Date()
      },
      standards,
      formulas
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  defaultHeavyMetalStandards,
  defaultFormulaConfigs,
  initializeHeavyMetalStandards,
  initializeFormulaConfigs,
  initializeAllConfigurations,
  updateHeavyMetalStandard,
  getConfigurationSummary
};