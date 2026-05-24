import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Voice from "@react-native-voice/voice";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as Localization from "expo-localization";
import TextRecognition from "@react-native-ml-kit/text-recognition";

const SUPPORTED_LOCALES = [
  "en-US",
  "es-ES",
  "fr-FR",
  "hi-IN",
  "ar-SA",
  "zh-CN",
  "te-IN"
];

const LANGUAGE_LABELS = {
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  ar: "Arabic",
  zh: "Chinese",
  te: "Telugu",
  unknown: "Auto"
};

function getDeviceLocale() {
  const locale = Localization.getLocales?.()[0]?.languageTag;
  if (!locale) return "en-US";
  const supported = SUPPORTED_LOCALES.find(item => item.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
  return supported || "en-US";
}

function detectLanguage(text) {
  const value = String(text || "").toLowerCase();
  if (!value.trim()) return "unknown";
  if (/[\u0600-\u06ff]/.test(value)) return "ar";
  if (/[\u4e00-\u9fff]/.test(value)) return "zh";
  if (/[\u0900-\u097f]/.test(value)) return "hi";
  if (/[\u0c00-\u0c7f]/.test(value)) return "te";
  if (/[\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00bf\u00a1]/.test(value) || /\b(hola|trabajo|buscar|empresa|freelancer)\b/.test(value)) return "es";
  if (/[\u00e0\u00e2\u00e7\u00e8\u00e9\u00ea\u00eb\u00ee\u00ef\u00f4\u00fb\u00f9\u00fc\u00ff\u0153]/.test(value) || /\b(bonjour|travail|recherche|entreprise)\b/.test(value)) return "fr";
  return "en";
}

function isRTL(text) {
  return /[\u0590-\u05ff\u0600-\u06ff]/.test(String(text || ""));
}

function WaveBars({ active }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (!active) {
      bars.forEach(bar => bar.setValue(0.35));
      return;
    }
    const animations = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            toValue: 1,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(bar, {
            toValue: 0.35,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      )
    );
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [active, bars]);

  return (
    <View style={styles.wave}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              transform: [{ scaleY: bar }]
            }
          ]}
        />
      ))}
    </View>
  );
}

export default function ExploreSearchBar({
  value,
  onChangeText,
  onSearch,
  onVoiceResult,
  onImageTextExtracted,
  placeholder = "Ask...",
  voiceLocale = "auto",
  autoFocus = false,
  style
}) {
  const [text, setText] = useState(value || "");
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("unknown");
  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState("");
  const pulse = useRef(new Animated.Value(0)).current;

  const writingDirection = useMemo(() => (isRTL(text) ? "rtl" : "ltr"), [text]);
  const languageName = LANGUAGE_LABELS[detectedLanguage] || LANGUAGE_LABELS.unknown;

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    Voice.onSpeechStart = () => {
      setListening(true);
      setError("");
    };
    Voice.onSpeechPartialResults = event => {
      const next = event.value?.[0] || "";
      setTranscript(next);
      setDetectedLanguage(detectLanguage(next));
    };
    Voice.onSpeechResults = event => {
      const next = event.value?.[0] || "";
      applyText(next, "voice");
      setTranscript("");
      setListening(false);
      onVoiceResult?.({ text: next, language: detectLanguage(next) });
    };
    Voice.onSpeechError = event => {
      setError(event.error?.message || "Voice search could not start.");
      setListening(false);
    };
    Voice.onSpeechEnd = () => setListening(false);
    return () => {
      Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    if (listening) animation.start();
    else {
      animation.stop();
      pulse.setValue(0);
    }
    return () => animation.stop();
  }, [listening, pulse]);

  function applyText(nextText, source = "typed") {
    const next = String(nextText || "");
    setText(next);
    setDetectedLanguage(detectLanguage(next));
    onChangeText?.(next, { source, language: detectLanguage(next) });
  }

  async function toggleVoice() {
    setError("");
    if (listening) {
      await Voice.stop();
      setListening(false);
      return;
    }
    const locale = voiceLocale === "auto" ? getDeviceLocale() : voiceLocale;
    try {
      setTranscript("");
      await Voice.start(locale);
    } catch (voiceError) {
      setError(voiceError.message || "Voice search failed.");
      setListening(false);
    }
  }

  async function pickImage(source) {
    setError("");
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === "camera" ? "Camera permission is required." : "Media permission is required.");
        return;
      }

      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false
          });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      setPreviewUri(uri);
      setMediaSheetOpen(false);
      await runOCR(uri);
    } catch (imageError) {
      setError(imageError.message || "Could not read that image.");
    }
  }

  async function runOCR(uri) {
    setOcrLoading(true);
    setError("");
    try {
      const result = await TextRecognition.recognize(uri);
      const extracted = result?.text || "";
      applyText(extracted, "ocr");
      onImageTextExtracted?.({
        text: extracted,
        language: detectLanguage(extracted),
        imageUri: uri,
        raw: result
      });
    } catch (ocrError) {
      setError(ocrError.message || "OCR could not extract text from this image.");
    } finally {
      setOcrLoading(false);
    }
  }

  function submitSearch() {
    Keyboard.dismiss();
    onSearch?.({
      text,
      language: detectLanguage(text),
      imageUri: previewUri || null
    });
  }

  const pulseStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.42] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }]
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.searchPill, focused && styles.searchPillFocused, listening && styles.searchPillListening]}>
        {listening ? <Animated.View pointerEvents="none" style={[styles.pulseRing, pulseStyle]} /> : null}

        <Pressable style={styles.iconButton} onPress={() => setMediaSheetOpen(true)} accessibilityRole="button" accessibilityLabel="Add attachment">
          <Ionicons name="add" size={22} color="#e5e7eb" />
        </Pressable>

        <TextInput
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          onChangeText={next => applyText(next, "typed")}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          multiline={false}
          style={[styles.input, { writingDirection, textAlign: writingDirection === "rtl" ? "right" : "left" }]}
        />

        <Pressable style={[styles.iconButton, listening && styles.iconButtonActive]} onPress={toggleVoice} accessibilityRole="button" accessibilityLabel="Voice search">
          <Ionicons name={listening ? "mic" : "mic-outline"} size={20} color="#ffffff" />
        </Pressable>

        <Pressable style={styles.iconButton} onPress={() => setMediaSheetOpen(true)} accessibilityRole="button" accessibilityLabel="Image search">
          <Ionicons name="camera-outline" size={21} color="#ffffff" />
        </Pressable>
      </Animated.View>

      {listening ? (
        <View style={styles.transcriptCard}>
          <WaveBars active={listening} />
          <View style={styles.transcriptTextWrap}>
            <Text style={styles.transcriptLabel}>Listening in {languageName}</Text>
            <Text style={[styles.transcriptText, { writingDirection }]}>{transcript || "Speak now..."}</Text>
          </View>
        </View>
      ) : null}

      {previewUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} />
          <View style={styles.previewCopy}>
            <Text style={styles.previewTitle}>{ocrLoading ? "Reading image text..." : "Image text added"}</Text>
            <Text style={styles.previewMeta}>{ocrLoading ? "OCR running" : `Detected: ${languageName}`}</Text>
          </View>
          {ocrLoading ? <ActivityIndicator color="#0d7377" /> : null}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={mediaSheetOpen} transparent animationType="slide" onRequestClose={() => setMediaSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMediaSheetOpen(false)} />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Search from image</Text>
          <Text style={styles.sheetSubtitle}>Take a photo or upload from gallery. OCR will read text and place it in search.</Text>

          <Pressable style={styles.sheetAction} onPress={() => pickImage("camera")}>
            <View style={styles.sheetIcon}>
              <Ionicons name="camera" size={22} color="#0d7377" />
            </View>
            <View style={styles.sheetCopy}>
              <Text style={styles.sheetActionTitle}>Take Photo</Text>
              <Text style={styles.sheetActionText}>Open camera and scan text</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>

          <Pressable style={styles.sheetAction} onPress={() => pickImage("gallery")}>
            <View style={styles.sheetIcon}>
              <Ionicons name="images" size={22} color="#0d7377" />
            </View>
            <View style={styles.sheetCopy}>
              <Text style={styles.sheetActionTitle}>Upload from Gallery/Media</Text>
              <Text style={styles.sheetActionText}>Choose an image already on your phone</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={() => setMediaSheetOpen(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 10
  },
  searchPill: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#2f3a45",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden"
  },
  searchPillFocused: {
    borderColor: "#0d7377",
    shadowColor: "#0d7377",
    shadowOpacity: 0.24
  },
  searchPillListening: {
    borderColor: "#2dd4bf"
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "#0d7377"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  iconButtonActive: {
    backgroundColor: "#0d7377"
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600"
  },
  transcriptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#99f6e4"
  },
  wave: {
    width: 42,
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  waveBar: {
    width: 5,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#0d7377"
  },
  transcriptTextWrap: {
    flex: 1
  },
  transcriptLabel: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800"
  },
  transcriptText: {
    marginTop: 2,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700"
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb"
  },
  previewImage: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#e5e7eb"
  },
  previewCopy: {
    flex: 1
  },
  previewTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  previewMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700"
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#ffffff"
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 16
  },
  sheetTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900"
  },
  sheetSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  sheetAction: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7"
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfeff"
  },
  sheetCopy: {
    flex: 1
  },
  sheetActionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  sheetActionText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#f1f5f9"
  },
  cancelText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900"
  }
});
