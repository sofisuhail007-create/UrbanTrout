/**
 * Maximum Dissolved Oxygen Saturation Table
 * Based on: Standard Methods for the Examination of Water and Wastewater
 * (Lake Stewards of Maine reference chart)
 *
 * Conditions: Zero salinity, 760mmHg (1 standard atmosphere)
 * Temperature in °C → Maximum DO in mg/L
 */

const DO_SATURATION_TABLE: Record<string, number> = {
  // 0°C – 4.9°C
  "0": 14.6, "0.1": 14.6, "0.2": 14.5, "0.3": 14.5, "0.4": 14.5,
  "0.5": 14.4, "0.6": 14.4, "0.7": 14.3, "0.8": 14.3, "0.9": 14.3,
  "1": 14.2, "1.1": 14.2, "1.2": 14.1, "1.3": 14.1, "1.4": 14.1,
  "1.5": 14, "1.6": 14, "1.7": 13.9, "1.8": 13.9, "1.9": 13.9,
  "2": 13.8, "2.1": 13.8, "2.2": 13.8, "2.3": 13.7, "2.4": 13.7,
  "2.5": 13.6, "2.6": 13.6, "2.7": 13.6, "2.8": 13.5, "2.9": 13.5,
  "3": 13.5, "3.1": 13.4, "3.2": 13.4, "3.3": 13.4, "3.4": 13.3,
  "3.5": 13.3, "3.6": 13.2, "3.7": 13.2, "3.8": 13.2, "3.9": 13.1,
  "4": 13.1, "4.1": 13.1, "4.2": 13, "4.3": 13, "4.4": 13,
  "4.5": 12.9, "4.6": 12.9, "4.7": 12.9, "4.8": 12.8, "4.9": 12.8,
  // 5°C – 9.9°C
  "5": 12.8, "5.1": 12.7, "5.2": 12.7, "5.3": 12.7, "5.4": 12.6,
  "5.5": 12.6, "5.6": 12.6, "5.7": 12.5, "5.8": 12.5, "5.9": 12.5,
  "6": 12.4, "6.1": 12.4, "6.2": 12.4, "6.3": 12.4, "6.4": 12.3,
  "6.5": 12.3, "6.6": 12.3, "6.7": 12.2, "6.8": 12.2, "6.9": 12.2,
  "7": 12.1, "7.1": 12.1, "7.2": 12.1, "7.3": 12.1, "7.4": 12,
  "7.5": 12, "7.6": 12, "7.7": 11.9, "7.8": 11.9, "7.9": 11.9,
  "8": 11.8, "8.1": 11.8, "8.2": 11.8, "8.3": 11.8, "8.4": 11.7,
  "8.5": 11.7, "8.6": 11.7, "8.7": 11.6, "8.8": 11.6, "8.9": 11.6,
  "9": 11.5, "9.1": 11.5, "9.2": 11.5, "9.3": 11.5, "9.4": 11.5,
  "9.5": 11.4, "9.6": 11.4, "9.7": 11.4, "9.8": 11.3, "9.9": 11.3,
  // 10°C – 14.9°C
  "10": 11.3, "10.1": 11.3, "10.2": 11.2, "10.3": 11.2, "10.4": 11.2,
  "10.5": 11.2, "10.6": 11.1, "10.7": 11.1, "10.8": 11.1, "10.9": 11.1,
  "11": 11, "11.1": 11, "11.2": 11, "11.3": 11, "11.4": 10.9,
  "11.5": 10.9, "11.6": 10.9, "11.7": 10.9, "11.8": 10.8, "11.9": 10.8,
  "12": 10.8, "12.1": 10.8, "12.2": 10.7, "12.3": 10.7, "12.4": 10.7,
  "12.5": 10.7, "12.6": 10.6, "12.7": 10.6, "12.8": 10.6, "12.9": 10.6,
  "13": 10.5, "13.1": 10.5, "13.2": 10.5, "13.3": 10.5, "13.4": 10.4,
  "13.5": 10.4, "13.6": 10.4, "13.7": 10.4, "13.8": 10.4, "13.9": 10.3,
  "14": 10.3, "14.1": 10.3, "14.2": 10.3, "14.3": 10.2, "14.4": 10.2,
  "14.5": 10.2, "14.6": 10.2, "14.7": 10.2, "14.8": 10.1, "14.9": 10.1,
  // 15°C – 19.9°C
  "15": 10.1, "15.1": 10.1, "15.2": 10, "15.3": 10, "15.4": 10,
  "15.5": 10, "15.6": 10, "15.7": 9.9, "15.8": 9.9, "15.9": 9.9,
  "16": 9.9, "16.1": 9.8, "16.2": 9.8, "16.3": 9.8, "16.4": 9.8,
  "16.5": 9.8, "16.6": 9.7, "16.7": 9.7, "16.8": 9.7, "16.9": 9.7,
  "17": 9.7, "17.1": 9.6, "17.2": 9.6, "17.3": 9.6, "17.4": 9.6,
  "17.5": 9.6, "17.6": 9.5, "17.7": 9.5, "17.8": 9.5, "17.9": 9.5,
  "18": 9.5, "18.1": 9.4, "18.2": 9.4, "18.3": 9.4, "18.4": 9.4,
  "18.5": 9.4, "18.6": 9.4, "18.7": 9.3, "18.8": 9.3, "18.9": 9.3,
  "19": 9.3, "19.1": 9.3, "19.2": 9.2, "19.3": 9.2, "19.4": 9.2,
  "19.5": 9.2, "19.6": 9.2, "19.7": 9.1, "19.8": 9.1, "19.9": 9.1,
  // 20°C – 24.9°C
  "20": 9.1, "20.1": 9.1, "20.2": 9.1, "20.3": 9, "20.4": 9,
  "20.5": 9, "20.6": 9, "20.7": 9, "20.8": 9, "20.9": 8.9,
  "21": 8.9, "21.1": 8.9, "21.2": 8.9, "21.3": 8.9, "21.4": 8.8,
  "21.5": 8.8, "21.6": 8.8, "21.7": 8.8, "21.8": 8.8, "21.9": 8.8,
  "22": 8.7, "22.1": 8.7, "22.2": 8.7, "22.3": 8.7, "22.4": 8.7,
  "22.5": 8.7, "22.6": 8.6, "22.7": 8.6, "22.8": 8.6, "22.9": 8.6,
  "23": 8.6, "23.1": 8.6, "23.2": 8.5, "23.3": 8.5, "23.4": 8.5,
  "23.5": 8.5, "23.6": 8.5, "23.7": 8.5, "23.8": 8.5, "23.9": 8.4,
  "24": 8.4, "24.1": 8.4, "24.2": 8.4, "24.3": 8.4, "24.4": 8.4,
  "24.5": 8.3, "24.6": 8.3, "24.7": 8.3, "24.8": 8.3, "24.9": 8.3,
  // 25°C – 30°C
  "25": 8.3, "25.1": 8.2, "25.2": 8.2, "25.3": 8.2, "25.4": 8.2,
  "25.5": 8.2, "25.6": 8.2, "25.7": 8.2, "25.8": 8.1, "25.9": 8.1,
  "26": 8.1, "26.1": 8.1, "26.2": 8.1, "26.3": 8.1, "26.4": 8.1,
  "26.5": 8, "26.6": 8, "26.7": 8, "26.8": 8, "26.9": 8,
  "27": 8, "27.1": 8, "27.2": 7.9, "27.3": 7.9, "27.4": 7.9,
  "27.5": 7.9, "27.6": 7.9, "27.7": 7.9, "27.8": 7.9, "27.9": 7.8,
  "28": 7.8, "28.1": 7.8, "28.2": 7.8, "28.3": 7.8, "28.4": 7.8,
  "28.5": 7.8, "28.6": 7.7, "28.7": 7.7, "28.8": 7.7, "28.9": 7.7,
  "29": 7.7, "29.1": 7.7, "29.2": 7.7, "29.3": 7.7, "29.4": 7.6,
  "29.5": 7.6, "29.6": 7.6, "29.7": 7.6, "29.8": 7.6, "29.9": 7.6,
  "30": 7.6,
};

/**
 * Get the maximum DO saturation for a given temperature.
 * Uses linear interpolation for temperatures between table values.
 */
export function getMaxDO(tempCelsius: number): number | null {
  if (tempCelsius < 0 || tempCelsius > 30) return null;

  // Round to 1 decimal place for lookup
  const rounded = Math.round(tempCelsius * 10) / 10;
  const key = rounded.toString();

  if (key in DO_SATURATION_TABLE) {
    return DO_SATURATION_TABLE[key];
  }

  // Interpolate between two nearest values
  const lower = Math.floor(tempCelsius * 10) / 10;
  const upper = Math.ceil(tempCelsius * 10) / 10;
  const lowerDO = DO_SATURATION_TABLE[lower.toString()];
  const upperDO = DO_SATURATION_TABLE[upper.toString()];

  if (lowerDO === undefined || upperDO === undefined) return null;

  const fraction = (tempCelsius - lower) / (upper - lower);
  return Math.round((lowerDO + fraction * (upperDO - lowerDO)) * 10) / 10;
}

/**
 * Get DO saturation percentage (how close actual DO is to max possible)
 */
export function getDOSaturationPercent(tempCelsius: number, actualDO: number): number | null {
  const maxDO = getMaxDO(tempCelsius);
  if (maxDO === null || maxDO === 0) return null;
  return Math.round((actualDO / maxDO) * 1000) / 10;
}

export type DOValidation = {
  status: 'optimal' | 'warning' | 'danger' | 'supersaturated' | 'calibration_error';
  message: string;
  maxDO: number;
  saturationPercent: number;
  color: string;
};

/**
 * Validate a DO reading against temperature-based saturation limits
 * and rainbow trout health thresholds.
 *
 * Rainbow trout DO requirements:
 *  - Optimal: ≥ 6.0 mg/L (and ≤ 100% saturation)
 *  - Warning: 4.0–5.9 mg/L
 *  - Danger:  < 4.0 mg/L
 *  - Supersaturated: 100–110% saturation (gas bubble disease risk)
 *  - Calibration Error: > 110% saturation (physically impossible, recalibrate meter)
 */
export function validateDO(tempCelsius: number, actualDO: number): DOValidation | null {
  const maxDO = getMaxDO(tempCelsius);
  if (maxDO === null) return null;

  const satPercent = (actualDO / maxDO) * 100;
  const roundedSatPercent = Math.round(satPercent * 10) / 10;

  // Calibration error: > 110% saturation — physically impossible reading
  if (satPercent > 110) {
    return {
      status: 'calibration_error',
      message: `⚠️ DO ${actualDO} mg/L exceeds max saturation of ${maxDO} mg/L at ${tempCelsius}°C by ${Math.round((satPercent - 100) * 10) / 10}%. Recalibrate your DO meter.`,
      maxDO,
      saturationPercent: roundedSatPercent,
      color: '#f43f5e', // red
    };
  }

  // Supersaturated: 100–110% — possible but dangerous (gas bubble disease)
  if (satPercent > 100) {
    return {
      status: 'supersaturated',
      message: `DO is supersaturated at ${roundedSatPercent}% (max ${maxDO} mg/L at ${tempCelsius}°C). Risk of gas bubble disease in fish.`,
      maxDO,
      saturationPercent: roundedSatPercent,
      color: '#f97316', // orange
    };
  }

  // Danger: < 4 mg/L
  if (actualDO < 4) {
    return {
      status: 'danger',
      message: `🔴 Critical! DO at ${actualDO} mg/L is dangerously low. Fish are at severe stress/mortality risk.`,
      maxDO,
      saturationPercent: roundedSatPercent,
      color: '#ef4444', // red
    };
  }

  // Warning: 4–5.9 mg/L
  if (actualDO < 6) {
    return {
      status: 'warning',
      message: `⚠️ DO at ${actualDO} mg/L is below optimal. Fish may show reduced appetite and growth.`,
      maxDO,
      saturationPercent: roundedSatPercent,
      color: '#eab308', // yellow
    };
  }

  // Optimal: ≥ 6 mg/L and ≤ 100% saturation
  return {
    status: 'optimal',
    message: `✅ DO at ${actualDO} mg/L (${roundedSatPercent}% saturation) is within optimal range for rainbow trout.`,
    maxDO,
    saturationPercent: roundedSatPercent,
    color: '#22c55e', // green
  };
}

/**
 * Get the status level for other water parameters
 */
export type ParamStatus = { status: 'optimal' | 'warning' | 'danger'; color: string; label: string };

export function getAmmoniaStatus(val: number): ParamStatus {
  if (val <= 0.02) return { status: 'optimal', color: '#22c55e', label: 'Optimal' };
  if (val <= 0.05) return { status: 'warning', color: '#eab308', label: 'Warning' };
  return { status: 'danger', color: '#ef4444', label: 'Danger' };
}

export function getPHStatus(val: number): ParamStatus {
  if (val >= 6.5 && val <= 8.0) return { status: 'optimal', color: '#22c55e', label: 'Optimal' };
  if ((val >= 6.0 && val < 6.5) || (val > 8.0 && val <= 8.5)) return { status: 'warning', color: '#eab308', label: 'Warning' };
  return { status: 'danger', color: '#ef4444', label: 'Danger' };
}

export function getTempStatus(val: number): ParamStatus {
  if (val >= 10 && val <= 18) return { status: 'optimal', color: '#22c55e', label: 'Optimal' };
  if ((val >= 8 && val < 10) || (val > 18 && val <= 20)) return { status: 'warning', color: '#eab308', label: 'Warning' };
  return { status: 'danger', color: '#ef4444', label: 'Danger' };
}

export function getNitriteStatus(val: number): ParamStatus {
  if (val <= 0.1) return { status: 'optimal', color: '#22c55e', label: 'Optimal' };
  if (val <= 0.25) return { status: 'warning', color: '#eab308', label: 'Warning' };
  return { status: 'danger', color: '#ef4444', label: 'Danger' };
}

export function getNitrateStatus(val: number): ParamStatus {
  if (val <= 40) return { status: 'optimal', color: '#22c55e', label: 'Optimal' };
  if (val <= 80) return { status: 'warning', color: '#eab308', label: 'Warning' };
  return { status: 'danger', color: '#ef4444', label: 'Danger' };
}
