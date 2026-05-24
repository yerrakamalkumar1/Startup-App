# ConnectHub Mobile Explore Search Bar

Reusable React Native / Expo component for a Google-style Explore search bar with:

- Voice search using `@react-native-voice/voice`
- Camera and gallery image selection using `expo-image-picker`
- OCR using free on-device Google ML Kit via `@react-native-ml-kit/text-recognition`
- Multilingual text detection helper for English, Spanish, French, Hindi, Arabic, Chinese, and Portuguese
- RTL input support for Arabic/Hebrew text
- Animated listening transcription and sound-wave UI

## Install

```bash
npm install @react-native-voice/voice expo-image-picker expo-localization @expo/vector-icons @react-native-ml-kit/text-recognition
```

For Expo managed apps, run a development build because native voice and ML Kit modules are not available inside Expo Go:

```bash
npx expo prebuild
npx expo run:android
npx expo run:ios
```

## Permissions

Add camera, microphone, and speech recognition permissions in your native app config.

Example `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-image-picker",
      [
        "@react-native-voice/voice",
        {
          "microphonePermission": "Allow ConnectHub to use the microphone for voice search.",
          "speechRecognitionPermission": "Allow ConnectHub to convert speech into search text."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "ConnectHub uses camera for image search.",
        "NSPhotoLibraryUsageDescription": "ConnectHub uses gallery images for image search.",
        "NSMicrophoneUsageDescription": "ConnectHub uses microphone for voice search.",
        "NSSpeechRecognitionUsageDescription": "ConnectHub uses speech recognition for voice search."
      }
    },
    "android": {
      "permissions": ["CAMERA", "RECORD_AUDIO"]
    }
  }
}
```

## Usage

```jsx
import ExploreSearchBar from "./mobile/ExploreSearchBar";

export default function ExploreScreen() {
  return (
    <ExploreSearchBar
      onChangeText={(text, meta) => console.log(text, meta)}
      onSearch={({ text, language, imageUri }) => {
        console.log("search", text, language, imageUri);
      }}
      onVoiceResult={({ text, language }) => {
        console.log("voice", text, language);
      }}
      onImageTextExtracted={({ text, language, imageUri }) => {
        console.log("ocr", text, language, imageUri);
      }}
    />
  );
}
```

## Notes

- Voice recognition language support depends on the device speech engine. The component starts with the device locale and detects the transcript language locally.
- OCR is on-device and free. It does not send images to paid APIs.
- For stronger production language detection later, add a local open-source detector such as `franc-min`.
