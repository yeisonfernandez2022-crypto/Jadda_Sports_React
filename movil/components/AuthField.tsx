import { useState } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AuthFieldProps extends TextInputProps {
  icon: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
}

export default function AuthField({ icon, secureTextEntry, style, ...rest }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const esPassword = secureTextEntry === true;

  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={18} color="#9aa0a6" style={styles.ico} />
      <TextInput
        {...rest}
        style={[styles.input, style]}
        secureTextEntry={esPassword && !visible}
        placeholderTextColor="#9aa0a6"
      />
      {esPassword && (
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          style={styles.eye}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={visible ? "eye-off" : "eye"} size={20} color="#9aa0a6" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  ico: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111",
  },
  eye: {
    paddingLeft: 8,
  },
});
