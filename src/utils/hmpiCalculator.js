import { HeavyMetalStandard, FormulaConfig } from '../models/index.js';

/**
 * HMPI Calculation Engine
 * Handles pollution index calculations using configurable formulas and standards
 */
class HMPICalculator {
  constructor() {
    this.standardsCache = new Map();
    this.formulaCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get heavy metal standards with caching
   */
  async getHeavyMetalStandards(category = 'BIS') {
    const cacheKey = `standards_${category}`;
    const cached = this.standardsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const standards = await HeavyMetalStandard.find({ 
        isActive: true, 
        category: category 
      }).select('metal standardValue unit');
      
      const standardsMap = new Map();
      
      standards.forEach(standard => {
        standardsMap.set(standard.metal.toUpperCase(), {
          value: standard.standardValue,
          unit: standard.unit
        });
      });

      this.standardsCache.set(cacheKey, {
        data: standardsMap,
        timestamp: Date.now()
      });

      return standardsMap;
    } catch (error) {
      throw new Error(`Failed to fetch heavy metal standards: ${error.message}`);
    }
  }

  /**
   * Get formula configuration with caching
   */
  async getFormulaConfig(type = 'HMPI') {
    const cacheKey = `formula_${type}`;
    const cached = this.formulaCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const formula = await FormulaConfig.getActiveFormulaByType(type);
      
      if (!formula) {
        throw new Error(`No active formula found for type: ${type}`);
      }

      this.formulaCache.set(cacheKey, {
        data: formula,
        timestamp: Date.now()
      });

      return formula;
    } catch (error) {
      throw new Error(`Failed to fetch formula configuration: ${error.message}`);
    }
  }

  /**
   * Calculate contamination factor for a single metal
   * CF = C_metal / C_standard
   */
  calculateContaminationFactor(metalValue, standardValue) {
    if (standardValue <= 0) {
      throw new Error('Standard value must be greater than zero');
    }
    return metalValue / standardValue;
  }

  /**
   * Normalize units between measured value and standard
   */
  normalizeUnits(measuredValue, measuredUnit, standardUnit) {
    // If units are the same, no conversion needed
    if (measuredUnit === standardUnit) {
      return measuredValue;
    }

    const conversionFactors = {
      'ppm_to_ppb': 1000,
      'ppm_to_mg/L': 1,
      'ppm_to_μg/L': 1000,
      'ppb_to_ppm': 0.001,
      'ppb_to_mg/L': 0.001,
      'ppb_to_μg/L': 1,
      'mg/L_to_ppm': 1,
      'mg/L_to_ppb': 1000,
      'mg/L_to_μg/L': 1000,
      'μg/L_to_ppm': 0.001,
      'μg/L_to_ppb': 1,
      'μg/L_to_mg/L': 0.001
    };

    const conversionKey = `${measuredUnit}_to_${standardUnit}`;
    const factor = conversionFactors[conversionKey];

    if (factor === undefined) {
      // If no conversion found, assume same unit
      console.warn(`No conversion factor found for ${measuredUnit} to ${standardUnit}, assuming same unit`);
      return measuredValue;
    }

    return measuredValue * factor;
  }

  /**
   * Calculate HMPI using the standard formula
   * HMPI = Σ(CFᵢ²) / n
   * where CFᵢ is the contamination factor for metal i, and n is the number of metals
   */
  async calculateHMPI(heavyMetalValues, standardCategory = 'BIS') {
    try {
      const standards = await this.getHeavyMetalStandards(standardCategory);
      const contaminationFactors = [];
      const metalDetails = {};

      for (const [metal, data] of Object.entries(heavyMetalValues)) {
        const metalUpper = metal.toUpperCase();
        const standard = standards.get(metalUpper);

        if (!standard) {
          console.warn(`No ${standardCategory} standard found for metal: ${metal}`);
          continue;
        }

        // Normalize units
        const normalizedValue = this.normalizeUnits(
          data.value,
          data.unit,
          standard.unit
        );

        // Calculate contamination factor
        const cf = this.calculateContaminationFactor(normalizedValue, standard.value);
        contaminationFactors.push(cf);

        metalDetails[metal] = {
          measuredValue: data.value,
          measuredUnit: data.unit,
          standardValue: standard.value,
          standardUnit: standard.unit,
          normalizedValue,
          contaminationFactor: cf
        };
      }

      if (contaminationFactors.length === 0) {
        throw new Error('No valid heavy metals found for HMPI calculation');
      }

      // Calculate HMPI: sum of squares of contamination factors divided by number of metals
      const sumOfSquares = contaminationFactors.reduce((sum, cf) => sum + (cf * cf), 0);
      const hmpi = Math.sqrt(sumOfSquares / contaminationFactors.length);

      return {
        hmpi: Math.round(hmpi * 100) / 100, // Round to 2 decimal places
        metalCount: contaminationFactors.length,
        metalDetails,
        contaminationFactors
      };

    } catch (error) {
      throw new Error(`HMPI calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate alternative pollution indices
   */
  async calculateAlternativeIndices(heavyMetalValues) {
    const indices = {};

    try {
      const standards = await this.getHeavyMetalStandards();

      // Degree of Contamination (Cd)
      let cdSum = 0;
      let validMetals = 0;

      for (const [metal, data] of Object.entries(heavyMetalValues)) {
        const metalUpper = metal.toUpperCase();
        const standard = standards.get(metalUpper);

        if (standard) {
          const normalizedValue = this.normalizeUnits(data.value, data.unit, standard.unit);
          const cf = this.calculateContaminationFactor(normalizedValue, standard.value);
          cdSum += cf;
          validMetals++;
        }
      }

      if (validMetals > 0) {
        indices.degreeOfContamination = Math.round((cdSum) * 100) / 100;
      }

      // Pollution Index (PI) - average of contamination factors
      if (validMetals > 0) {
        indices.pollutionIndex = Math.round((cdSum / validMetals) * 100) / 100;
      }

      return indices;

    } catch (error) {
      console.error('Failed to calculate alternative indices:', error.message);
      return {};
    }
  }

  /**
   * Categorize HMPI value based on thresholds
   */
  async categorizeHMPI(hmpiValue) {
    try {
      const formula = await this.getFormulaConfig('HMPI');
      return formula.categorizeValue(hmpiValue);
    } catch (error) {
      // Fallback to default categorization
      if (hmpiValue < 30) {
        return 'Safe';
      } else if (hmpiValue < 100) {
        return 'Mid';
      } else {
        return 'Unsafe';
      }
    }
  }

  /**
   * Get detailed risk assessment
   */
  getRiskAssessment(hmpiValue, category) {
    const assessments = {
      'Safe': {
        riskLevel: 'Low',
        description: 'Heavy metal pollution is within acceptable limits',
        recommendations: ['Continue regular monitoring', 'Maintain current environmental practices']
      },
      'Mid': {
        riskLevel: 'Moderate',
        description: 'Heavy metal pollution requires attention and monitoring',
        recommendations: [
          'Increase monitoring frequency',
          'Investigate pollution sources',
          'Consider remediation strategies'
        ]
      },
      'Unsafe': {
        riskLevel: 'High',
        description: 'Heavy metal pollution poses significant environmental and health risks',
        recommendations: [
          'Immediate action required',
          'Implement remediation measures',
          'Restrict usage for drinking/irrigation',
          'Identify and eliminate pollution sources'
        ]
      }
    };

    return assessments[category] || {
      riskLevel: 'Unknown',
      description: 'Risk level could not be determined',
      recommendations: ['Review data and recalculate']
    };
  }

  /**
   * Calculate comprehensive pollution assessment
   */
  async calculateComprehensiveAssessment(heavyMetalValues) {
    try {
      // Calculate HMPI
      const hmpiResult = await this.calculateHMPI(heavyMetalValues);
      
      // Categorize HMPI
      const category = await this.categorizeHMPI(hmpiResult.hmpi);
      
      // Calculate alternative indices
      const alternativeIndices = await this.calculateAlternativeIndices(heavyMetalValues);
      
      // Get risk assessment
      const riskAssessment = this.getRiskAssessment(hmpiResult.hmpi, category);

      return {
        hmpi: {
          value: hmpiResult.hmpi,
          category,
          metalCount: hmpiResult.metalCount,
          calculatedAt: new Date()
        },
        alternativeIndices,
        riskAssessment,
        metalDetails: hmpiResult.metalDetails,
        calculationMetadata: {
          standardsUsed: await this.getHeavyMetalStandards(),
          formula: await this.getFormulaConfig('HMPI'),
          calculatedAt: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Comprehensive assessment failed: ${error.message}`);
    }
  }

  /**
   * Validate input data before calculation
   */
  validateInputData(heavyMetalValues) {
    const errors = [];

    if (!heavyMetalValues || typeof heavyMetalValues !== 'object') {
      errors.push('Heavy metal values must be an object');
      return { isValid: false, errors };
    }

    const metalKeys = Object.keys(heavyMetalValues);
    if (metalKeys.length === 0) {
      errors.push('At least one heavy metal value is required');
    }

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      if (!data || typeof data !== 'object') {
        errors.push(`Invalid data structure for metal: ${metal}`);
        continue;
      }

      if (typeof data.value !== 'number' || data.value < 0) {
        errors.push(`Invalid value for metal ${metal}: must be a non-negative number`);
      }

      if (!data.unit || typeof data.unit !== 'string') {
        errors.push(`Missing or invalid unit for metal: ${metal}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.standardsCache.clear();
    this.formulaCache.clear();
  }
}

// Create singleton instance
const hmpiCalculator = new HMPICalculator();

export default hmpiCalculator;