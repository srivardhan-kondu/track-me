"use client";

import * as React from "react";

import { METRIC, type UnitPrefs } from "@/lib/units";

/**
 * The signed-in athlete's units, for client components that sit deep inside
 * dialogs — the meal editor, chiefly — where threading a prop down from every
 * page that opens one would mean touching each of those pages.
 */
const UnitsContext = React.createContext<UnitPrefs>(METRIC);

export function UnitsProvider({
  units,
  children,
}: {
  units: UnitPrefs;
  children: React.ReactNode;
}) {
  return <UnitsContext.Provider value={units}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitPrefs {
  return React.useContext(UnitsContext);
}
