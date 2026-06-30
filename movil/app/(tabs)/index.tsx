import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
} from "react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
  <>


    <ScrollView style={styles.container}>
      {/* Banner principal */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1470&auto=format&fit=crop",
        }}
        style={styles.banner}
      >
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerTitle}>
            BIENVENIDO A JADDA SPORTS
          </Text>

          <Text style={styles.bannerSubtitle}>
            Tu tienda deportiva de confianza
          </Text>
        </View>
      </ImageBackground>

      {/* Imagen principal */}
      <View style={styles.heroContainer}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1470&auto=format&fit=crop",
          }}
          style={styles.heroImage}
        />

        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>
            SUPERA TUS{"\n"}LÍMITES
          </Text>

          <Text style={styles.heroSubtitle}>
            EDICIÓN LIMITADA 2026
          </Text>
        </View>
      </View>

      {/* ADN DEL DEPORTE */}
      <View style={styles.adnCard}>
        <Text style={styles.adnTitle}>
          EL ADN DEL DEPORTE
        </Text>

        <Text style={styles.adnText}>
          Tecnología diseñada para elevar tu rendimiento.
        </Text>

        <TouchableOpacity
          style={styles.collectionButton}
          onPress={() => router.push("/catalogo")}
        >
          <Text style={styles.collectionButtonText}>
            VER COLECCIÓN
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categorías */}
      <View style={styles.categoriesContainer}>
        <Text style={styles.sectionTitle}>
          CATEGORÍAS
        </Text>

        {["ROPA", "CALZADO", "ACCESORIOS"].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={styles.categoryCard}
            onPress={() =>
              router.push(`/catalogo?cat=${cat.toLowerCase()}`)
            }
          >
            <Text style={styles.categoryText}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Oferta */}
      <View style={styles.offerCard}>
        <Text style={styles.offerTitle}>
          ¡OFERTA DE TEMPORADA!
        </Text>

        <Text style={styles.offerText}>
          30% DE DESCUENTO EN TODA LA LÍNEA DE RUNNING
        </Text>

        <TouchableOpacity
          style={styles.offerButton}
          onPress={() => router.push("/catalogo")}
        >
          <Text style={styles.offerButtonText}>
            COMPRAR YA
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ©2026 JADDA SPORTS - Pasión por el Deporte
        </Text>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  banner: {
    height: 280,
    justifyContent: "center",
  },

  bannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  bannerTitle: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
  },

  bannerSubtitle: {
    color: "#fff",
    marginTop: 12,
    fontSize: 18,
    textAlign: "center",
  },

  heroContainer: {
    margin: 20,
    borderRadius: 15,
    overflow: "hidden",
  },

  heroImage: {
    width: "100%",
    height: 260,
  },

  heroOverlay: {
    position: "absolute",
    left: 15,
    bottom: 15,
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 15,
    borderLeftWidth: 5,
    borderLeftColor: "#e73737",
  },

  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  heroSubtitle: {
    color: "#fff",
    marginTop: 6,
    letterSpacing: 2,
  },

  adnCard: {
    backgroundColor: "#002244",
    marginHorizontal: 20,
    padding: 25,
    borderRadius: 15,
  },

  adnTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },

  adnText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 15,
  },

  collectionButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#fff",
    paddingVertical: 12,
    borderRadius: 10,
  },

  collectionButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },

  categoriesContainer: {
    margin: 20,
  },

  sectionTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  categoryCard: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 4,
  },

  categoryText: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 18,
  },

  offerCard: {
    margin: 20,
    padding: 30,
    borderRadius: 15,
    backgroundColor: "#e73737",
    alignItems: "center",
  },

  offerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },

  offerText: {
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
    fontSize: 16,
  },

  offerButton: {
    marginTop: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },

  offerButtonText: {
    color: "#e73737",
    fontWeight: "bold",
  },

  footer: {
    backgroundColor: "#002244",
    padding: 25,
    marginTop: 20,
  },

  footerText: {
    color: "#fff",
    textAlign: "center",
  },
});