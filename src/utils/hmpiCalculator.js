import { HeavyMetalStandard, FormulaConfig } from '../models/index.js';

/**
 * Comprehensive Heavy Metal Pollution Indices Calculator
 * Implements multiple pollution assessment methodologies with standardized formulas
 */
class HMPICalculator {
  constructor() {
    this.standardsCache = new Map();
    this.formulaCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Standard values for heavy metals in drinking water (IS 10500:2012)
    this.drinkingWaterStandards = {
      'AS': { permissible: 0.05, ideal: 0.01, weightage: 5, unit: 'mg/L' },
      'CD': { permissible: 0.005, ideal: 0.003, weightage: 5, unit: 'mg/L' },
      'CR': { permissible: 0.05, ideal: 0, weightage: 4, unit: 'mg/L' },
      'CU': { permissible: 1.5, ideal: 0, weightage: 1, unit: 'mg/L' },
      'PB': { permissible: 0.01, ideal: 0, weightage: 5, unit: 'mg/L' },
      'HG': { permissible: 0.002, ideal: 0.001, weightage: 5, unit: 'mg/L' },
      'NI': { permissible: 0.07, ideal: 0.02, weightage: 2, unit: 'mg/L' },
      'ZN': { permissible: 15, ideal: 5, weightage: 1, unit: 'mg/L' },
      'FE': { permissible: 0.3, ideal: 0, weightage: 2, unit: 'mg/L' },
      'U': { permissible: 0.03, ideal: 0, weightage: 4, unit: 'mg/L' }
    };

    // Background concentrations for geoaccumulation index (typical crustal averages)
    this.backgroundConcentrations = {
      'AS': 1.5, 'CD': 0.1, 'CR': 100, 'CU': 50, 'PB': 20,
      'HG': 0.08, 'NI': 75, 'ZN': 70, 'FE': 35000, 'U': 2.7
    };

    // Toxic Response Factors for ERI calculation
    this.toxicResponseFactors = {
      'AS': 10, 'CD': 30, 'CR': 2, 'CU': 5, 'PB': 5,
      'HG': 40, 'NI': 5, 'ZN': 1, 'FE': 1, 'U': 5
    };

    // Reference doses for health risk assessment (mg/kg/day)
    this.referenceDoses = {
      'AS': 0.0003, 'CD': 0.001, 'CR': 0.003, 'CU': 0.04, 'PB': 0.0036,
      'HG': 0.0003, 'NI': 0.02, 'ZN': 0.3, 'FE': 0.7, 'U': 0.003
    };
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
   * Calculate Heavy Metal Pollution Index (HPI)
   * Formula: HPI = (Σ(Wᵢ × Qᵢ)) / (ΣWᵢ)
   * Where: Qᵢ = ((Mᵢ − Iᵢ) / (Sᵢ − Iᵢ)) × 100
   */
  calculateHPI(heavyMetalValues) {
    let weightedSum = 0;
    let totalWeight = 0;
    const metalDetails = {};

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const standard = this.drinkingWaterStandards[metalKey];

      if (!standard) {
        console.warn(`No standard found for metal: ${metal}`);
        continue;
      }

      // Normalize to mg/L
      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      
      // Calculate Qᵢ = ((Mᵢ − Iᵢ) / (Sᵢ − Iᵢ)) × 100
      const Mi = normalizedValue;
      const Ii = standard.ideal;
      const Si = standard.permissible;
      const Wi = standard.weightage;

      const Qi = ((Mi - Ii) / (Si - Ii)) * 100;
      
      weightedSum += Wi * Qi;
      totalWeight += Wi;

      metalDetails[metal] = {
        measuredValue: data.value,
        measuredUnit: data.unit,
        normalizedValue: Mi,
        idealValue: Ii,
        standardValue: Si,
        weightage: Wi,
        qualityRating: Qi,
        contribution: Wi * Qi
      };
    }

    if (totalWeight === 0) {
      throw new Error('No valid metals found for HPI calculation');
    }

    const hpi = weightedSum / totalWeight;

    return {
      value: Math.round(hpi * 100) / 100,
      interpretation: this.interpretHPI(hpi),
      metalDetails,
      totalWeight,
      metalCount: Object.keys(metalDetails).length
    };
  }

  /**
   * Calculate Nemerow Pollution Index (PN)
   * Formula: PN = √((C_max / S_max)² + (C_mean / S_mean)²)
   */
  calculateNemerowIndex(heavyMetalValues) {
    const ratios = [];
    const concentrations = [];
    const standards = [];

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const standard = this.drinkingWaterStandards[metalKey];

      if (!standard) continue;

      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      const ratio = normalizedValue / standard.permissible;
      
      ratios.push(ratio);
      concentrations.push(normalizedValue);
      standards.push(standard.permissible);
    }

    if (ratios.length === 0) {
      throw new Error('No valid metals found for Nemerow Index calculation');
    }

    const maxRatio = Math.max(...ratios);
    const meanConcentration = concentrations.reduce((sum, c) => sum + c, 0) / concentrations.length;
    const meanStandard = standards.reduce((sum, s) => sum + s, 0) / standards.length;
    const meanRatio = meanConcentration / meanStandard;

    const pn = Math.sqrt((maxRatio * maxRatio) + (meanRatio * meanRatio));

    return {
      value: Math.round(pn * 100) / 100,
      interpretation: this.interpretNemerow(pn),
      maxRatio: Math.round(maxRatio * 100) / 100,
      meanRatio: Math.round(meanRatio * 100) / 100
    };
  }

  /**
   * Calculate Contamination Factor (CF) for all metals
   * Formula: CF = Mᵢ / Sᵢ
   */
  calculateContaminationFactors(heavyMetalValues) {
    const factors = {};

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const standard = this.drinkingWaterStandards[metalKey];

      if (!standard) continue;

      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      const cf = normalizedValue / standard.permissible;

      factors[metal] = {
        value: Math.round(cf * 100) / 100,
        interpretation: this.interpretCF(cf),
        measuredConcentration: normalizedValue,
        standardConcentration: standard.permissible
      };
    }

    return factors;
  }

  /**
   * Calculate Pollution Load Index (PLI)
   * Formula: PLI = (∏CFᵢ)^(1/n)
   */
  calculatePLI(heavyMetalValues) {
    const cfs = this.calculateContaminationFactors(heavyMetalValues);
    const cfValues = Object.values(cfs).map(cf => cf.value);

    if (cfValues.length === 0) {
      throw new Error('No valid metals found for PLI calculation');
    }

    // Calculate geometric mean
    const product = cfValues.reduce((prod, cf) => prod * cf, 1);
    const pli = Math.pow(product, 1 / cfValues.length);

    return {
      value: Math.round(pli * 100) / 100,
      interpretation: this.interpretPLI(pli),
      contaminationFactors: cfs,
      metalCount: cfValues.length
    };
  }

  /**
   * Calculate Geoaccumulation Index (Igeo)
   * Formula: Igeo = log₂(Mᵢ / 1.5 × Bᵢ)
   */
  calculateGeoaccumulationIndex(heavyMetalValues) {
    const indices = {};

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const background = this.backgroundConcentrations[metalKey];

      if (!background) continue;

      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      const igeo = Math.log2(normalizedValue / (1.5 * background));

      indices[metal] = {
        value: Math.round(igeo * 100) / 100,
        interpretation: this.interpretIgeo(igeo),
        measuredConcentration: normalizedValue,
        backgroundConcentration: background
      };
    }

    return indices;
  }

  /**
   * Calculate Health Risk Index (HRI)
   * Formula: HRI = DIMᵢ / RfDᵢ
   */
  calculateHealthRiskIndex(heavyMetalValues, bodyWeight = 70, waterIntake = 2) {
    const indices = {};

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const rfd = this.referenceDoses[metalKey];

      if (!rfd) continue;

      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      // Daily intake = (concentration × water intake) / body weight
      const dim = (normalizedValue * waterIntake) / bodyWeight;
      const hri = dim / rfd;

      indices[metal] = {
        value: Math.round(hri * 1000) / 1000, // 3 decimal places
        interpretation: this.interpretHRI(hri),
        dailyIntake: Math.round(dim * 1000000) / 1000000, // 6 decimal places
        referenceDose: rfd
      };
    }

    return indices;
  }

  /**
   * Calculate Ecological Risk Index (ERI)
   * Formula: ERI = Σ(CFᵢ × TRFᵢ)
   */
  calculateEcologicalRiskIndex(heavyMetalValues) {
    let totalERI = 0;
    const metalRisks = {};

    for (const [metal, data] of Object.entries(heavyMetalValues)) {
      const metalKey = metal.toUpperCase();
      const standard = this.drinkingWaterStandards[metalKey];
      const trf = this.toxicResponseFactors[metalKey];

      if (!standard || !trf) continue;

      const normalizedValue = this.normalizeToMgL(data.value, data.unit);
      const cf = normalizedValue / standard.permissible;
      const metalERI = cf * trf;
      
      totalERI += metalERI;
      metalRisks[metal] = {
        contaminationFactor: Math.round(cf * 100) / 100,
        toxicResponseFactor: trf,
        ecologicalRisk: Math.round(metalERI * 100) / 100
      };
    }

    return {
      totalValue: Math.round(totalERI * 100) / 100,
      interpretation: this.interpretERI(totalERI),
      metalRisks,
      metalCount: Object.keys(metalRisks).length
    };
  }

  /**
   * Normalize concentration values to mg/L
   */
  normalizeToMgL(value, unit) {
    const conversionFactors = {
      'mg/L': 1,
      'ppm': 1,
      'ppb': 0.001,
      'μg/L': 0.001,
      'g/L': 1000,
      'ng/L': 0.000001
    };

    const factor = conversionFactors[unit] || 1;
    return value * factor;
  }

  /**
   * Interpretation functions for different indices
   */
  interpretHPI(value) {
    if (value < 100) return { category: 'Low pollution', level: 'Safe' };
    if (value === 100) return { category: 'Near threshold', level: 'Warning' };
    return { category: 'High pollution', level: 'Unsafe' };
  }

  interpretNemerow(value) {
    if (value < 1) return { category: 'No pollution', level: 'Safe' };
    if (value < 2) return { category: 'Slight pollution', level: 'Low' };
    if (value < 3) return { category: 'Moderate pollution', level: 'Moderate' };
    return { category: 'Severe pollution', level: 'High' };
  }

  interpretCF(value) {
    if (value < 1) return { category: 'Low contamination', level: 'Safe' };
    if (value < 3) return { category: 'Moderate contamination', level: 'Moderate' };
    if (value < 6) return { category: 'Considerable contamination', level: 'High' };
    return { category: 'Very high contamination', level: 'Critical' };
  }

  interpretPLI(value) {
    if (value < 1) return { category: 'No pollution', level: 'Safe' };
    if (value === 1) return { category: 'Baseline pollution', level: 'Threshold' };
    return { category: 'Pollution present', level: 'Polluted' };
  }

  interpretIgeo(value) {
    if (value < 0) return { category: 'Unpolluted', level: 'Safe' };
    if (value < 1) return { category: 'Unpolluted to moderately polluted', level: 'Low' };
    if (value < 2) return { category: 'Moderately polluted', level: 'Moderate' };
    if (value < 3) return { category: 'Moderately to strongly polluted', level: 'High' };
    if (value < 4) return { category: 'Strongly polluted', level: 'Very High' };
    return { category: 'Very strongly polluted', level: 'Extreme' };
  }

  interpretHRI(value) {
    if (value < 1) return { category: 'No significant risk', level: 'Safe' };
    return { category: 'Potential health risk', level: 'Risk' };
  }

  interpretERI(value) {
    if (value < 40) return { category: 'Low ecological risk', level: 'Safe' };
    if (value < 80) return { category: 'Moderate ecological risk', level: 'Moderate' };
    return { category: 'High ecological risk', level: 'High' };
  }

  /**
   * Calculate comprehensive pollution assessment with all indices
   */
  calculateComprehensiveAssessment(heavyMetalValues, options = {}) {
    try {
      const bodyWeight = options.bodyWeight || 70; // kg
      const waterIntake = options.waterIntake || 2; // L/day

      // Validate input
      const validation = this.validateInputData(heavyMetalValues);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Calculate all pollution indices
      const results = {
        // Primary pollution indices
        hpi: this.calculateHPI(heavyMetalValues),
        nemerowIndex: this.calculateNemerowIndex(heavyMetalValues),
        contaminationFactors: this.calculateContaminationFactors(heavyMetalValues),
        pollutionLoadIndex: this.calculatePLI(heavyMetalValues),
        
        // Environmental indices
        geoaccumulationIndex: this.calculateGeoaccumulationIndex(heavyMetalValues),
        ecologicalRiskIndex: this.calculateEcologicalRiskIndex(heavyMetalValues),
        
        // Health risk indices
        healthRiskIndex: this.calculateHealthRiskIndex(heavyMetalValues, bodyWeight, waterIntake),
        
        // Metadata
        calculationParameters: {
          bodyWeight,
          waterIntake,
          standardsUsed: 'IS 10500:2012',
          calculatedAt: new Date(),
          metalCount: Object.keys(heavyMetalValues).length
        }
      };

      // Overall risk assessment
      results.overallAssessment = this.generateOverallAssessment(results);

      return results;

    } catch (error) {
      throw new Error(`Comprehensive assessment failed: ${error.message}`);
    }
  }

  /**
   * Generate overall risk assessment based on all calculated indices
   */
  generateOverallAssessment(results) {
    const riskFactors = [];
    
    // Analyze HPI
    if (results.hpi.interpretation.level === 'Unsafe') {
      riskFactors.push('High Heavy Metal Pollution Index');
    }
    
    // Analyze Nemerow Index
    if (results.nemerowIndex.interpretation.level === 'High') {
      riskFactors.push('Severe pollution detected by Nemerow Index');
    }
    
    // Analyze PLI
    if (results.pollutionLoadIndex.interpretation.level === 'Polluted') {
      riskFactors.push('Overall pollution load exceeds safe levels');
    }
    
    // Analyze Health Risk
    const healthRisks = Object.values(results.healthRiskIndex)
      .filter(hri => hri.interpretation.level === 'Risk').length;
    if (healthRisks > 0) {
      riskFactors.push(`${healthRisks} metals pose potential health risks`);
    }
    
    // Analyze Ecological Risk
    if (results.ecologicalRiskIndex.interpretation.level === 'High') {
      riskFactors.push('High ecological risk detected');
    }

    // Determine overall risk level
    let overallRisk = 'Safe';
    let recommendations = ['Continue regular monitoring'];

    if (riskFactors.length === 0) {
      overallRisk = 'Safe';
      recommendations = [
        'Water quality is within acceptable limits',
        'Continue routine monitoring',
        'Maintain current environmental practices'
      ];
    } else if (riskFactors.length <= 2) {
      overallRisk = 'Moderate';
      recommendations = [
        'Increase monitoring frequency',
        'Investigate sources of contamination',
        'Consider treatment options',
        'Monitor health indicators in exposed populations'
      ];
    } else {
      overallRisk = 'High';
      recommendations = [
        'Immediate action required',
        'Implement water treatment measures',
        'Restrict use for drinking and irrigation',
        'Identify and eliminate pollution sources',
        'Consider alternative water sources',
        'Monitor public health impacts'
      ];
    }

    return {
      riskLevel: overallRisk,
      riskFactors,
      recommendations,
      summary: `${riskFactors.length} risk factors identified from comprehensive pollution assessment`
    };
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
   * Get available metals with their standards
   */
  getAvailableMetals() {
    return Object.entries(this.drinkingWaterStandards).map(([metal, data]) => ({
      symbol: metal,
      name: this.getMetalName(metal),
      permissibleLimit: data.permissible,
      idealValue: data.ideal,
      unit: data.unit,
      weightage: data.weightage
    }));
  }

  /**
   * Get full metal names
   */
  getMetalName(symbol) {
    const names = {
      'AS': 'Arsenic', 'CD': 'Cadmium', 'CR': 'Chromium', 'CU': 'Copper',
      'PB': 'Lead', 'HG': 'Mercury', 'NI': 'Nickel', 'ZN': 'Zinc',
      'FE': 'Iron', 'U': 'Uranium'
    };
    return names[symbol] || symbol;
  }

  /**
   * Calculate legacy HMPI method for backward compatibility
   */
  async calculateHMPI(heavyMetalValues, standardCategory = 'BIS') {
    try {
      const hpiResult = this.calculateHPI(heavyMetalValues);
      return {
        hmpi: hpiResult.value,
        metalCount: hpiResult.metalCount,
        metalDetails: hpiResult.metalDetails,
        category: hpiResult.interpretation.level
      };
    } catch (error) {
      throw new Error(`HMPI calculation failed: ${error.message}`);
    }
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