import { router } from "expo-router";

export function volverAtras() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}
