import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";

interface Props {
  texto?: string;
  color?: string;
  onPress?: () => void;
}

export default function BackButton({ texto = "Volver", color = "#111", onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[styles.back, { marginTop: insets.top + 8 }]}
      onPress={onPress ? onPress : volverAtras}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="arrow-back" size={20} color={color} />
      <Text style={[styles.backText, { color }]}>{texto}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  backText: {
    fontWeight: "600",
    marginLeft: 4,
  },
});
