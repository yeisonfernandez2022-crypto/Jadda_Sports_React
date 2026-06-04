import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from './themed-text';

export function ProductoCard({ producto }: { producto: any }) {
  return (
    <View style={styles.card}>
      {/* Si tienes una URL de imagen, la ponemos aquí */}
      <Image source={{ uri: producto.imagen }} style={styles.image} />
      <ThemedText type="defaultSemiBold">{producto.nombre}</ThemedText>
      <ThemedText>$ {producto.precio}</ThemedText>
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