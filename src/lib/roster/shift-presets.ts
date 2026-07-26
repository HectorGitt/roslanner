/**
 * Starting shift models offered when creating a ward. These are only defaults —
 * a ward's shifts are editable data, so a hospital can rename, retime, add or
 * remove them afterwards.
 */
export interface ShiftPresetShift {
  code: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  isNightLike: boolean;
  payrollTag?: string;
}

export interface ShiftPreset {
  key: string;
  category: string;
  description: string;
  cycleLengthDays: number;
  shifts: ShiftPresetShift[];
}

const h = (hours: number) => hours * 60;

export const SHIFT_PRESETS: ShiftPreset[] = [
  {
    key: "standard",
    category: "Standard",
    description: "Morning / Afternoon / Night, planned a week at a time",
    cycleLengthDays: 7,
    shifts: [
      { code: "MORNING", label: "Morning", startMinutes: h(8), endMinutes: h(16), isNightLike: false },
      { code: "AFTERNOON", label: "Afternoon", startMinutes: h(16), endMinutes: h(22), isNightLike: false },
      { code: "NIGHT", label: "Night", startMinutes: h(22), endMinutes: h(8), isNightLike: true },
    ],
  },
  {
    key: "call_duty",
    category: "Call Duty",
    description: "Day shift vs overnight call duty, planned a month at a time",
    cycleLengthDays: 30,
    shifts: [
      { code: "DAY", label: "Day Shift", startMinutes: h(8), endMinutes: h(16), isNightLike: false },
      {
        code: "CALL_DUTY",
        label: "Call Duty",
        startMinutes: h(16),
        endMinutes: h(8),
        isNightLike: true,
        payrollTag: "CALL_ALLOWANCE",
      },
    ],
  },
  {
    key: "outpatient",
    category: "Outpatient Clinic",
    description: "Fixed clinic sessions, no nights",
    cycleLengthDays: 7,
    shifts: [
      { code: "CLINIC_AM", label: "Morning Clinic", startMinutes: h(8), endMinutes: h(12), isNightLike: false },
      { code: "CLINIC_PM", label: "Afternoon Clinic", startMinutes: h(13), endMinutes: h(17), isNightLike: false },
    ],
  },
];

export function findPreset(key: string | undefined): ShiftPreset {
  return SHIFT_PRESETS.find((p) => p.key === key) ?? SHIFT_PRESETS[0];
}

/** Rows ready for prisma.shiftDefinition.createMany. */
export function presetShiftRows(preset: ShiftPreset, wardId: string) {
  return preset.shifts.map((s, i) => ({
    wardId,
    code: s.code,
    label: s.label,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    crossesMidnight: s.endMinutes <= s.startMinutes,
    isNightLike: s.isNightLike,
    payrollTag: s.payrollTag ?? null,
    sortOrder: i,
  }));
}
