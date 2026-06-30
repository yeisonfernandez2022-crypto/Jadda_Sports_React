import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from './themed-text';

export function ProductoCard({ producto }: { producto: any }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: producto.IMAGEN }}
        style={styles.image}
      />
      <ThemedText type="defaultSemiBold">{producto.NOMBRE}</ThemedText>
      <ThemedText>$ {producto.PRECIO}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  image: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
});