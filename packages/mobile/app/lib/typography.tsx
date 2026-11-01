// One typeface across the phone app, matching the website: Nunito for all text,
// Fredoka One only for the Kinroost wordmark.
//
// Custom fonts on Android ignore fontWeight, so each weight is its own font file.
// These Text/TextInput wrappers read the fontWeight in a style and pick the right
// Nunito file. Screens import Text and TextInput from here instead of react-native.
import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type TextProps, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';

/** Pass to useFonts() once, at the root of the app. */
export const FONT_FILES = {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black,
  FredokaOne_400Regular,
};

export const FONTS = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  brand: 'FredokaOne_400Regular',
};

let loaded = false;
/** Called by the root layout once the fonts are ready (or failed: then the system font stays). */
export function setFontsLoaded(ok: boolean) { loaded = ok; }

function familyFor(weight: TextStyle['fontWeight']): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight) || 400;
  if (w >= 900) return FONTS.black;
  if (w >= 800) return FONTS.extrabold;
  if (w >= 700) return FONTS.bold;
  if (w >= 500) return FONTS.semibold;
  return FONTS.regular;
}

/** Adds the matching Nunito file to a style (unless the style already names a font). */
export function withFont(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (!loaded) return style;
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  return [style, { fontFamily: familyFor(flat.fontWeight), fontWeight: 'normal' }];
}

export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText {...props} ref={ref} style={withFont(props.style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput {...props} ref={ref} style={withFont(props.style as StyleProp<TextStyle>)} />;
});
