/**
 * Valid color values for ViewDescriptor properties.
 * System colors, semantic colors, design tokens, and hex strings.
 */
/** System colors (AppKit NSColor) */
export type SystemColor = "systemRed" | "systemOrange" | "systemYellow" | "systemGreen" | "systemBlue" | "systemPurple" | "systemPink" | "systemTeal" | "systemIndigo" | "systemBrown" | "systemMint" | "systemCyan" | "red" | "orange" | "yellow" | "green" | "blue" | "purple";
/** Semantic colors */
export type SemanticColor = "primary" | "secondary" | "tertiary";
/** AppOS design tokens */
export type DesignTokenColor = "ux_synapse" | "ux_cortex" | "ux_pulse" | "ux_signal" | "ux_warning" | "ux_error" | "ux_success" | "ux_info";
/** Hex color string (e.g. "#FF5733") */
export type HexColor = `#${string}`;
/** All valid color values */
export type PluginColor = SystemColor | SemanticColor | DesignTokenColor | HexColor;
