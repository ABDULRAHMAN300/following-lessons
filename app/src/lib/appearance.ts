export type Appearance = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
};

export const defaultAppearance: Appearance = {
  primaryColor: "#113b36",
  accentColor: "#e76572",
  backgroundColor: "#edf5f1",
};

export const appearancePresets: Array<Appearance & { name: string }> = [
  { name: "المختبر الأخضر", ...defaultAppearance },
  {
    name: "فضاء أزرق",
    primaryColor: "#17365d",
    accentColor: "#ff8a5b",
    backgroundColor: "#eef4fb",
  },
  {
    name: "بنفسجي حديث",
    primaryColor: "#3f2d5f",
    accentColor: "#e36b9d",
    backgroundColor: "#f5f0f8",
  },
  {
    name: "حبر وليمون",
    primaryColor: "#263238",
    accentColor: "#d8a800",
    backgroundColor: "#f5f4ed",
  },
];
