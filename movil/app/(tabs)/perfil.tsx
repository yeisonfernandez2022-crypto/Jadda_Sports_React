import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import api, { resolverImagen } from "../../constants/api";

interface Tarjeta {
  icono: string;
  titulo: string;
  descripcion: string;
  ruta: string;
}

const TARJETAS: Tarjeta[] = [
  { icono: "person", titulo: "Información de mi perfil", descripcion: "Edita tus datos personales y foto de perfil.", ruta: "/perfil/editar" },
  { icono: "lock-closed", titulo: "Seguridad", descripcion: "Cambia tu contraseña y gestiona el acceso.", ruta: "/perfil/seguridad" },
  { icono: "cube", titulo: "Mis Compras", descripcion: "Consulta pedidos e historial de compras.", ruta: "/perfil/compras" },
  { icono: "map", titulo: "Direcciones", descripcion: "Administra direcciones de envío.", ruta: "/perfil/direcciones" },
  { icono: "card", titulo: "Métodos de pago", descripcion: "Guarda tu forma de pago para pagar más rápido.", ruta: "/perfil/metodos-pago" },
  { icono: "heart", titulo: "Favoritos", descripcion: "Consulta tus productos guardados.", ruta: "/(tabs)/favoritos" },
  { icono: "trophy", titulo: "Retos", descripcion: "Supera retos y gana descuentos.", ruta: "/retos" },
  { icono: "barbell", titulo: "Planes", descripcion: "Planes de entrenamiento personalizados.", ruta: "/mis-planes" },
];

export default function PerfilScreen() {
  const { usuario, logout, estaLogueado, cargando, refreshPerfil } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState(false);

  useEffect(() => {
    if (estaLogueado) {
      api
        .get("/api/auth/perfil")
        .then((res) => setPerfil(res.data.usuario || res.data))
        .catch(() => {})
        .finally(() => setLoadingPerfil(false));
    } else {
      setLoadingPerfil(false);
    }
  }, [estaLogueado]);

  const fotoActual = resolverImagen(perfil?.FOTO_URL || perfil?.foto_url || usuario?.foto_url) || "";

  async function subirFoto() {
    try {
      const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permisos.granted) {
        Alert.alert("PERMISO DENEGADO", "Necesitamos acceso a tus fotos para cambiar tu foto de perfil.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert("IMAGEN MUY GRANDE", "La foto debe pesar menos de 10 MB.");
        return;
      }

      setSubiendoFoto(true);
      const res = await api.post("/api/auth/foto", { foto: `data:${mime};base64,${asset.base64}` });
      if (res.data.ok) {
        await api.put("/api/auth/perfil", { foto_url: res.data.url });
        await refreshPerfil();
        api
          .get("/api/auth/perfil")
          .then((r) => setPerfil(r.data.usuario || r.data))
          .catch(() => {});
        Alert.alert("¡FOTO ACTUALIZADA!", "Tu foto de perfil se actualizó correctamente.");
      }
    } catch {
      Alert.alert("NO SE PUDO SUBIR", "Ocurrió un error al subir la foto. Intenta de nuevo.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  function cerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/login");
        },
      },
    ]);
  }

  if (cargando || loadingPerfil) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Inicia sesión para acceder a tu perfil</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/registro")}>
          <Text style={styles.linkText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nombre = perfil?.NOMBRE_USUARIO || usuario?.NOMBRE_USUARIO || "";
  const inicial = (nombre || "U").charAt(0).toUpperCase();
  const docLabels: Record<string, string> = {
    CC: "Cédula de Ciudadanía",
    CE: "Cédula de Extranjería",
    TI: "Tarjeta de Identidad",
    PAS: "Pasaporte",
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HERO */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.avatarWrap} onPress={() => setFotoAbierta(true)}>
          {fotoActual ? (
            <Image source={{ uri: fotoActual }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarLetra}>
              <Text style={styles.avatarLetraText}>{inicial}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.nombre}>{nombre}</Text>
          <Text style={styles.email}>{perfil?.EMAIL || usuario?.EMAIL || ""}</Text>
          {perfil?.FECHA_REGISTRO ? (
            <Text style={styles.miembro}>
              Miembro desde {new Date(perfil.FECHA_REGISTRO).toLocaleDateString("es-CO")}
            </Text>
          ) : null}
          {perfil?.TIPO_DOCUMENTO && perfil?.NUMERO_DOCUMENTO ? (
            <Text style={styles.doc}>
              {docLabels[perfil.TIPO_DOCUMENTO] || perfil.TIPO_DOCUMENTO}: {perfil.NUMERO_DOCUMENTO}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity style={styles.cambiarFotoBtn} onPress={subirFoto} disabled={subiendoFoto}>
        <Ionicons name="image" size={16} color="#e73737" />
        <Text style={styles.cambiarFotoText}>
          {subiendoFoto ? "Subiendo foto..." : "Cargar foto desde el dispositivo"}
        </Text>
      </TouchableOpacity>

      {/* DASHBOARD */}
      <View style={styles.dashboard}>
        {TARJETAS.map((t) => (
          <TouchableOpacity key={t.titulo} style={styles.card} onPress={() => router.push(t.ruta as any)}>
            <View style={styles.cardIcon}>
              <Ionicons name={t.icono as any} size={24} color="#e73737" />
            </View>
            <Text style={styles.cardTitulo}>{t.titulo}</Text>
            <Text style={styles.cardDesc}>{t.descripcion}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={cerrarSesion}>
        <Ionicons name="log-out" size={16} color="#e73737" />
        <Text style={styles.logoutText}> CERRAR SESIÓN</Text>
      </TouchableOpacity>

      {/* MODAL FOTO */}
      <Modal visible={fotoAbierta} transparent animationType="fade" onRequestClose={() => setFotoAbierta(false)}>
        <TouchableOpacity style={styles.fotoBackdrop} activeOpacity={1} onPress={() => setFotoAbierta(false)}>
          <View style={styles.fotoModal}>
            <TouchableOpacity style={styles.fotoCerrar} onPress={() => setFotoAbierta(false)}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
            {fotoActual ? (
              <Image source={{ uri: fotoActual }} style={styles.fotoGrande} resizeMode="contain" />
            ) : (
              <View style={styles.fotoGrandeLetra}>
                <Text style={styles.fotoGrandeText}>{inicial}</Text>
              </View>
            )}
            <Text style={styles.fotoNombre}>{nombre}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#f5f5f5",
  },
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    flexGrow: 1,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    elevation: 3,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#eee",
  },
  avatarLetra: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetraText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "bold",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#002244",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  nombre: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  email: {
    color: "#666",
    fontSize: 14,
    marginTop: 2,
  },
  miembro: {
    color: "#999",
    fontSize: 12,
    marginTop: 6,
  },
  doc: {
    color: "#555",
    fontSize: 12,
    marginTop: 4,
  },
  cambiarFotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cambiarFotoText: {
    color: "#e73737",
    fontWeight: "600",
    fontSize: 13,
  },
  dashboard: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 14,
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fdeaea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitulo: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111",
  },
  cardDesc: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e73737",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 24,
    backgroundColor: "#fff",
  },
  logoutText: {
    color: "#e73737",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  linkBtn: {
    padding: 15,
  },
  linkText: {
    color: "#e73737",
    textAlign: "center",
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "#666",
    marginBottom: 25,
    textAlign: "center",
  },
  fotoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  fotoModal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  fotoCerrar: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },
  fotoGrande: {
    width: "100%",
    height: 360,
  },
  fotoGrandeLetra: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  fotoGrandeText: {
    color: "#fff",
    fontSize: 80,
    fontWeight: "bold",
  },
  fotoNombre: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 14,
  },
});
