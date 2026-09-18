export type Appearance = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  chemistryColor: string;
  physicsColor: string;
  integratedColor: string;
};

export const defaultAppearance: Appearance = {
  primaryColor: "#113b36",
  accentColor: "#e76572",
  backgroundColor: "#edf5f1",
  chemistryColor: "#d95d6a",
  physicsColor: "#3f73c7",
  integratedColor: "#3f8f68",
};

export const appearancePresets: Array<Appearance & { name: string }> = [
  { name: "المختبر الأخضر", ...defaultAppearance },
  {
    name: "فضاء أزرق",
    primaryColor: "#17365d",
    accentColor: "#ff8a5b",
    backgroundColor: "#eef4fb",
    chemistryColor: "#df5868",
    physicsColor: "#3979d4",
    integratedColor: "#45976b",
  },
  {
    name: "بنفسجي حديث",
    primaryColor: "#3f2d5f",
    accentColor: "#e36b9d",
    backgroundColor: "#f5f0f8",
    chemistryColor: "#d85c76",
    physicsColor: "#6b62cf",
    integratedColor: "#4a9274",
  },
  {
    name: "حبر وليمون",
    primaryColor: "#263238",
    accentColor: "#d8a800",
    backgroundColor: "#f5f4ed",
    chemistryColor: "#c45a54",
    physicsColor: "#416eaa",
    integratedColor: "#56815f",
  },
];
