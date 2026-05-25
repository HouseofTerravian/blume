/**
 * The 7 Sales Switches™
 * BLUME's core framework for moving brands from $0 to momentum.
 */
export type SwitchNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface SalesSwitch {
    number: SwitchNumber;
    name: string;
    subtitle: string;
    bottleneck: string;
    focus: string;
    actions: string[];
    kpis: string[];
    nextSwitch: string;
}
export declare const SEVEN_SWITCHES: Record<SwitchNumber, SalesSwitch>;
export declare function diagnoseSwitchFromContext(context: string): SwitchNumber;
//# sourceMappingURL=switches.d.ts.map