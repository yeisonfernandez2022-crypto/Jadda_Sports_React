import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, View, type ImageStyle } from "react-native";
import { resolverImagen } from "../constants/api";

const ESCALA_MIN = 1;
const ESCALA_MAX = 4;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const distancia = (
  a: { pageX: number; pageY: number },
  b: { pageX: number; pageY: number }
) => Math.sqrt(Math.pow(a.pageX - b.pageX, 2) + Math.pow(a.pageY - b.pageY, 2));

interface Props {
  url: string;
  ancho: number;
  alto: number;
  estilo?: ImageStyle;
}

export default function ZoomableImage({ url, ancho, alto, estilo }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const base = useRef({ scale: 1, tx: 0, ty: 0, dist: 0, x: 0, y: 0 });
  const ultimoTap = useRef(0);

  useEffect(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    setScale(1);
    setTx(0);
    setTy(0);
    ultimoTap.current = 0;
  }, [url]);

  const aplicar = (s: number, x: number, y: number) => {
    scaleRef.current = s;
    txRef.current = x;
    tyRef.current = y;
    setScale(s);
    setTx(x);
    setTy(y);
  };

  const limites = (s: number) => ({
    x: (ancho * (s - 1)) / 2,
    y: (alto * (s - 1)) / 2,
  });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const t = evt.nativeEvent.touches;
          base.current = {
            scale: scaleRef.current,
            tx: txRef.current,
            ty: tyRef.current,
            dist: t.length >= 2 ? distancia(t[0], t[1]) : 0,
            x: t.length === 1 ? t[0].pageX : 0,
            y: t.length === 1 ? t[0].pageY : 0,
          };
        },
        onPanResponderMove: (evt) => {
          const t = evt.nativeEvent.touches;
          const b = base.current;
          if (t.length >= 2) {
            const d = distancia(t[0], t[1]);
            if (b.dist > 0) {
              const s = clamp(b.scale * (d / b.dist), ESCALA_MIN, ESCALA_MAX);
              aplicar(s, b.tx, b.ty);
            }
          } else if (t.length === 1 && scaleRef.current > 1) {
            const lim = limites(scaleRef.current);
            aplicar(
              scaleRef.current,
              clamp(b.tx + (t[0].pageX - b.x), -lim.x, lim.x),
              clamp(b.ty + (t[0].pageY - b.y), -lim.y, lim.y)
            );
          }
        },
        onPanResponderRelease: () => {
          if (scaleRef.current <= 1.02) {
            aplicar(1, 0, 0);
          } else {
            const lim = limites(scaleRef.current);
            aplicar(
              scaleRef.current,
              clamp(txRef.current, -lim.x, lim.x),
              clamp(tyRef.current, -lim.y, lim.y)
            );
          }
          const ahora = Date.now();
          if (ahora - ultimoTap.current < 300) {
            if (scaleRef.current > 1) {
              aplicar(1, 0, 0);
            } else {
              aplicar(2.5, 0, 0);
            }
          }
          ultimoTap.current = ahora;
        },
        onPanResponderTerminate: () => {
          aplicar(1, 0, 0);
        },
      }),
    [ancho, alto]
  );

  return (
    <View style={{ width: ancho, height: alto, overflow: "hidden" }} {...pan.panHandlers}>
      <Image
        source={{ uri: resolverImagen(url) || undefined }}
        style={[
          {
            width: ancho,
            height: alto,
            transform: [{ scale }, { translateX: tx }, { translateY: ty }],
          },
          estilo,
        ]}
        resizeMode="contain"
      />
    </View>
  );
}
