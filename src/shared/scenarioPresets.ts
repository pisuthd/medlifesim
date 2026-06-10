/**
 * Three placeholder prompts surfaced in the CanvasTemplateMenu's
 * "Prompt to scenario" submenu (F.15). The user can click any of these
 * to open the modal pre-filled with the corresponding prompt text.
 *
 * Each prompt is hand-tuned to ask the model for ~3-5 cards across all
 * three columns (subject / exposure / intervention) with realistic
 * evidence-based values. The model's output is unpredictable for very
 * long prompts; these stay short enough to be a single coherent
 * scenario.
 */
export const SCENARIO_PRESETS = [
  {
    id: 'kids-night-cough',
    label: 'Kids · Night Cough',
    prompt:
      'Young children with persistent nighttime cough. Explore different interventions: humidifier in the bedroom, over-the-counter cough medicine, allergen reduction (dust mites, pets), and seeing a pediatrician for underlying asthma evaluation.',
  },
  {
    id: 'office-allergen-spike',
    label: 'Office · Allergen Spike',
    prompt:
      'Office workers during a sudden allergen spike (e.g. a high-pollen day or a mold event in the HVAC system). Compare no intervention vs. HEPA air purifier deployment vs. antihistamine medication vs. work-from-home policy.',
  },
  {
    id: 'school-vaping-onset',
    label: 'School · Vaping Onset',
    prompt:
      'Adolescents showing early signs of vaping (occasional use escalating). Compare no intervention vs. school-wide education program vs. individual counseling vs. nicotine-replacement therapy vs. a vape-free campus policy.',
  },
] as const

export type ScenarioPresetId = (typeof SCENARIO_PRESETS)[number]['id']
export type ScenarioPreset = (typeof SCENARIO_PRESETS)[number]
