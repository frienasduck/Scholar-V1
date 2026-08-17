# Scholar for Android

Native Android client for Scholar, built with **React Native (Expo SDK 57)**.
It reuses the existing Scholar backend — the same account works on Scholar Web
and Scholar Android (one shared user database).

> **Phase 2** — strict web parity, animated Scholar backgrounds, the grouped
> mobile Scholar drawer, server-backed dashboard identity/intelligence, real
> streaming LAM chat, and hardened authentication/session cleanup. Study
> chapters, library sync, reminders, playback, payments, and offline features
> remain later-phase work.

## Architecture

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo SDK 57 (React Native 0.86) | Fast iteration, managed config, first-class Android build tooling; nothing in Phase 1 requires native code Expo blocks |
| Navigation | expo-router + Scholar drawer + compact mobile bottom bar | Mirrors the web hierarchy; unavailable web sections open an explicit migration placeholder |
| Auth | Scholar's existing cookie sessions (`scholar_session`) | One user database, no second backend |
| Session storage | `expo-secure-store` (Keystore-backed) + `react-native-cookies` | Token kept in secure storage; native cookie store forwards it automatically |
| Styling | Shared Scholar tokens, Source Serif 4, Inter, blur, gradients and Reanimated | Matches the web typography, liquid glass and restrained motion; honors reduced motion and app state |
| API | Single cookie-aware client in `src/api/` | Session, Scholar Intelligence and streaming LAM reuse the existing backend |

## Layout

```
apps/android/
  src/
    api/          # config.ts, client.ts (cookie-aware fetch), auth.ts, lam.ts
    auth/         # AuthProvider (session restore, login/logout)
    components/   # Scholar glass, live background, topbar, drawer and search
    hooks/        # use-auth
    navigation/   # bottom bar, Scholar web hierarchy and shell state
    screens/      # auth, real dashboard, streaming LAM and migration placeholders
    storage/      # secure.ts (token), app-storage.ts (prefs)
    theme/        # colors, spacing, typography, fonts
    types/        # api.ts, lam.ts — mirror the web backend contracts
  scripts/        # generate-icons.mjs (pure-Node icon renderer)
```

## Prerequisites

This Windows checkout uses these exact paths:

- JDK 21: `C:\Users\Lenovo\AppData\Local\Programs\Temurin21\jdk-21.0.12+8`
- Android SDK: `C:\Users\Lenovo\AppData\Local\Android\Sdk`
- NDK: `27.1.12297006`
- CMake: `3.22.1`

- Node 20+ and npm
- Android Studio with the Android SDK (platform 36 + build-tools 36.x)
- A JDK (Android Studio bundles one at `C:\Program Files\Android\Android
  Studio\jbr`)

## Setup

```bash
cd apps/android
npm install

# Point the app at the Scholar backend
cp .env.example .env
# edit .env -> EXPO_PUBLIC_SCHOLAR_API_URL=...

# (Optional) regenerate the brand icons — pure Node, no image tools
node scripts/generate-icons.mjs
```

## Run on an emulator or device

```bash
cd apps/android
npx expo start            # start the dev server (press a to open Android)
npx expo run:android      # prebuild + build + install on the connected emulator/device
```

- **Emulator**: use `http://10.0.2.2:3000` as the API URL (maps to your
  computer's localhost). Make sure the web app is running: `bun run dev` from
  the repo root.
- **Physical device**: use your computer's LAN IP (e.g.
  `http://192.168.1.10:3000`), start the web app with
  `bun run dev -H 0.0.0.0`, and connect the phone via USB (enable USB
  debugging) or the same Wi-Fi.

## Build a debug APK

```bash
cd apps/android
npx expo prebuild --platform android   # generates the native android/ project
cd android
./gradlew assembleDebug                # (gradlew.bat on Windows cmd)
```

The APK lands at:

```
apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected device with:

```bash
adb install apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```

## Build a standalone (release) APK — no Metro required

The release variant embeds the JavaScript bundle into the APK, so the app
runs without Metro, without a dev machine, and installs like a normal app.
Release builds are signed with the local debug keystore by default (fine for
testing; see *Signing* below for distribution).

```bash
cd apps/android
# Point the build at the DEPLOYED HTTPS backend (gitignored, not committed)
# The production-style standalone APK uses the deployed Scholar backend.
Set-Content .env 'EXPO_PUBLIC_SCHOLAR_API_URL=https://scholar-v1.vercel.app'

$env:JAVA_HOME='C:\Users\Lenovo\AppData\Local\Programs\Temurin21\jdk-21.0.12+8'
$env:ANDROID_HOME='C:\Users\Lenovo\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME

cd android
.\gradlew.bat assembleRelease --no-parallel
```

The standalone APK lands at:

```
apps/android/android/app/build/outputs/apk/release/app-release.apk
```

Install it on a phone/emulator:

```bash
adb install -r apps/android/android/app/build/outputs/apk/release/app-release.apk
```

Verify the embedded bundle before shipping (must print the URL, not localhost):

```bash
$bundle='app\build\generated\assets\react\release\index.android.bundle'
rg -a -F 'https://scholar-v1.vercel.app' $bundle
rg -a -F 'https://scholar.example.com' $bundle
rg -a -F '10.0.2.2' $bundle
```

### Safe Windows rebuild and recovery

- Do **not** routinely run `gradlew.bat clean`. Use
  `.\gradlew.bat assembleRelease --no-parallel` from `apps/android/android`.
- Do not run `expo prebuild` for every build. The native project already
  exists; prebuild is only needed if that project is deliberately regenerated.
- After changing `.env`, if Gradle says the release bundle is up to date, run
  `.\gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks --no-parallel`
  once, followed by `.\gradlew.bat assembleRelease --no-parallel`.
- If a failed clean reports missing `build/generated/source/codegen/jni`
  folders, run `.\gradlew.bat generateCodegenArtifactsFromSchema --no-parallel`
  once, followed by the normal release build. Do not clean again.
- The release APK contains its JavaScript/Hermes bundle and does not need
  Metro. Its output path is
  `apps/android/android/app/build/outputs/apk/release/app-release.apk`.
- The current release uses `android/app/debug.keystore`. It is suitable for
  local testing only, not Play Store distribution.
- Keep `patches/react-native-reanimated+4.5.1.patch`. The `npm install`
  postinstall hook applies it with `patch-package`; it prevents the Windows
  Reanimated CMake regeneration loop.
- Keep Ninja 1.12.1 at
  `C:\Users\Lenovo\AppData\Local\Android\Sdk\cmake\3.22.1\bin\ninja.exe`.
  The original Ninja 1.10.2 is backed up beside it as
  `ninja.exe.orig-1.10.2`. This long-path workaround is required.

### Signing (before public distribution)

The first standalone APK is signed with the **debug keystore**
(`android/app/debug.keystore`), which is fine for a personal test APK but not
for the Play Store. Before public distribution, generate a real upload
keystore and wire it into `android/app/build.gradle`:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore scholar-release.keystore \
  -alias scholar -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore + passwords in a password manager, never in the repo.

## Notes

- **No passwords are stored anywhere.** Only the session token lives in
  Keystore-backed secure storage.
- Debug builds allow HTTP (cleartext); release builds require HTTPS.
- Passwords, tokens and API keys must never be written to `.env.example` or
  the worklog.
