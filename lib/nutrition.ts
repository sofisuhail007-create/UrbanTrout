/**
 * Trout Nutritional Science & Yield Calculator
 * Standardized against USDA FoodData Central (#173686) & ICAR-DCFR (Directorate of Coldwater Fisheries Research)
 * Species: Oncorhynchus mykiss (Rainbow Trout)
 */

export interface TroutNutrition {
  kg: number;
  proteinGrams: number;
  omega3Mg: number;
  vitaminDIU: number;
  caloriesKcal: number;
  eggWhiteEquivalent: number;
  wholeEggEquivalent: number;
  chickenBreastEquivalent: number;
  headlineFact: string;
  summarySentence: string;
}

export function calculateTroutNutrition(
  rawKg: number,
  isGutted: boolean = true
): TroutNutrition {
  const kg = Math.max(0, Number(rawKg) || 0);

  // Edible meat yield factor:
  // Cleaned & Gutted: ~85% edible muscle meat after post-cook deboning (175g protein / kg)
  // Whole Trout: ~75% edible muscle meat after viscera & head/bone removal (155g protein / kg)
  const proteinPerKg = isGutted ? 175 : 155;
  const omega3PerKg = isGutted ? 8500 : 7500;
  const vitDPerKg = 5400; // ~540 IU per 100g edible meat
  const caloriesPerKg = isGutted ? 1200 : 1050;

  const proteinGrams = Math.round(kg * proteinPerKg);
  const omega3Mg = Math.round(kg * omega3PerKg);
  const vitaminDIU = Math.round(kg * vitDPerKg);
  const caloriesKcal = Math.round(kg * caloriesPerKg);

  // Equivalencies:
  // 1 large whole egg ≈ 6g protein
  // 1 large egg white ≈ 4g protein
  // 1 medium chicken breast ≈ 31g lean protein
  const wholeEggEquivalent = Math.round(proteinGrams / 6);
  const eggWhiteEquivalent = Math.round(proteinGrams / 4);
  const chickenBreastEquivalent = Math.round(proteinGrams / 31);

  let headlineFact = "";
  let summarySentence = "";

  if (kg >= 4) {
    headlineFact = `Delivers ~${proteinGrams}g lean protein (≈ ${wholeEggEquivalent} whole eggs or ${chickenBreastEquivalent} chicken breasts) + ~${(omega3Mg / 1000).toFixed(1)}g Omega-3s!`;
    summarySentence = `Massive high-yield nutrition for family feasts & athlete recovery with 100% zero carbs.`;
  } else if (kg >= 3) {
    headlineFact = `Delivers ~${proteinGrams}g lean protein (≈ ${wholeEggEquivalent} whole eggs) + ~${(omega3Mg / 1000).toFixed(1)}g Omega-3s!`;
    summarySentence = `Supercharges muscle protein synthesis & heart health with clean, cold-water DHA/EPA.`;
  } else if (kg >= 2) {
    headlineFact = `Delivers ~${proteinGrams}g lean protein (≈ ${chickenBreastEquivalent} chicken breasts / ${wholeEggEquivalent} eggs) + ~${(omega3Mg / 1000).toFixed(1)}g Omega-3s!`;
    summarySentence = `Equivalent to ~${wholeEggEquivalent} whole eggs in clean protein — completely free of carbs or trans fats.`;
  } else {
    headlineFact = `Delivers ~${proteinGrams}g bioavailable lean protein + ~${(omega3Mg / 1000).toFixed(1)}g Omega-3s.`;
    summarySentence = `Rich in natural Vitamin D3 and complete essential amino acids.`;
  }

  return {
    kg,
    proteinGrams,
    omega3Mg,
    vitaminDIU,
    caloriesKcal,
    eggWhiteEquivalent,
    wholeEggEquivalent,
    chickenBreastEquivalent,
    headlineFact,
    summarySentence,
  };
}
